/**
 * Instantly campaign poller — replaces webhooks (Hyper Growth tier only).
 *
 * Polls POST /api/v2/leads/list for all leads in INSTANTLY_CAMPAIGN_ID,
 * compares their Instantly status/engagement against our Supabase state,
 * and applies any state transitions.
 *
 * Instantly lead statuses:
 *   1 = active (not yet contacted or in sequence)
 *  -1 = bounced
 *  -2 = unsubscribed
 *   3 = completed (sequence finished)
 *
 * Engagement detection (from counters, not status):
 *   timestamp_last_contact set → email was sent
 *   email_open_count > 0 → email was opened
 *   email_reply_count > 0 → prospect replied
 *
 * State mapping:
 *   contacted + no opens → sent
 *   opened → log event (don't change state from sent, open is tracked via our pixel)
 *   replied → replied
 *   bounced → dead
 *   unsubscribed → dead
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../../.env.local') })

import { getSupabaseServer } from '../../src/lib/supabase/server'

const CAMPAIGN_ID = process.env.INSTANTLY_CAMPAIGN_ID
const API_KEY = process.env.INSTANTLY_API_KEY
const BASE_URL = 'https://api.instantly.ai'

interface InstantlyLead {
  id: string
  email: string
  first_name?: string
  last_name?: string
  status: number
  email_open_count?: number
  email_reply_count?: number
  email_click_count?: number
  email_replied_step?: number
  email_replied_variant?: string
  timestamp_last_contact?: string
  timestamp_last_open?: string
  timestamp_last_reply?: string
  campaign?: string
  [key: string]: unknown
}

interface PollSummary {
  leads_fetched: number
  state_changes: number
  events_logged: number
  errors: number
  details: string[]
}

const STATE_RANK: Record<string, number> = {
  discovered: 0, enriched: 1, qualified: 2,
  mockup_review_pending: 3, mockup_ready: 4,
  sent: 5, opened: 6, replied: 7,
  positive: 8, booked: 9, won: 10,
  lost: 11, dead: 12,
}

function shouldAdvance(current: string | null, target: string): boolean {
  if (!current) return true
  if (target === 'dead') return true
  return (STATE_RANK[target] ?? -1) > (STATE_RANK[current] ?? -1)
}

async function fetchLeads(): Promise<InstantlyLead[]> {
  const allLeads: InstantlyLead[] = []
  let cursor: string | undefined

  while (true) {
    const body: Record<string, unknown> = {
      campaign: CAMPAIGN_ID,
      limit: 100,
    }
    if (cursor) body.starting_after = cursor

    const res = await fetch(`${BASE_URL}/api/v2/leads/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Instantly API error ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const leads: InstantlyLead[] = data.items || data.data || data || []
    if (!Array.isArray(leads) || leads.length === 0) break

    allLeads.push(...leads)

    const nextCursor = data.next_starting_after
    if (!nextCursor || leads.length < 100) break
    cursor = nextCursor
  }

  return allLeads
}

export async function pollInstantly(): Promise<PollSummary> {
  const summary: PollSummary = {
    leads_fetched: 0, state_changes: 0, events_logged: 0, errors: 0, details: [],
  }

  if (!CAMPAIGN_ID || !API_KEY) {
    console.error('[poller] Missing INSTANTLY_CAMPAIGN_ID or INSTANTLY_API_KEY')
    summary.errors = 1
    return summary
  }

  const sb = getSupabaseServer()
  if (!sb) {
    console.error('[poller] Supabase not configured')
    summary.errors = 1
    return summary
  }

  // Fetch all leads from Instantly
  let leads: InstantlyLead[]
  try {
    leads = await fetchLeads()
  } catch (err) {
    console.error('[poller] Failed to fetch leads:', (err as Error).message)
    summary.errors = 1
    return summary
  }

  summary.leads_fetched = leads.length
  console.log(`[poller] Fetched ${leads.length} leads from Instantly`)

  // Match each lead against our DB
  for (const lead of leads) {
    try {
      const { data: prospect } = await sb
        .from('prospects')
        .select('id, slug, pipeline_state, instantly_lead_id')
        .eq('instantly_lead_id', lead.id)
        .single()

      if (!prospect) {
        // Try matching by email as fallback
        const { data: byEmail } = await sb
          .from('prospects')
          .select('id, slug, pipeline_state, instantly_lead_id')
          .eq('email', lead.email)
          .single()

        if (!byEmail) continue // Not our prospect
        // Update instantly_lead_id if missing
        if (!byEmail.instantly_lead_id) {
          await sb.from('prospects').update({ instantly_lead_id: lead.id }).eq('id', byEmail.id)
        }
        await processLead(sb, lead, byEmail, summary)
      } else {
        await processLead(sb, lead, prospect, summary)
      }
    } catch (err) {
      console.error(`[poller] Error processing ${lead.email}:`, (err as Error).message?.slice(0, 80))
      summary.errors++
    }
  }

  // Log poller run event
  await sb.from('prospect_events').insert({
    prospect_id: null,
    event: 'poller_run',
    payload: {
      leads_fetched: summary.leads_fetched,
      state_changes: summary.state_changes,
      events_logged: summary.events_logged,
      errors: summary.errors,
      campaign_id: CAMPAIGN_ID,
    },
  })

  return summary
}

async function processLead(
  sb: NonNullable<ReturnType<typeof getSupabaseServer>>,
  lead: InstantlyLead,
  prospect: { id: string; slug: string | null; pipeline_state: string | null },
  summary: PollSummary,
): Promise<void> {
  const currentState = prospect.pipeline_state || 'mockup_ready'

  // Bounced
  if (lead.status === -1) {
    if (shouldAdvance(currentState, 'dead')) {
      await sb.from('prospects').update({ pipeline_state: 'dead' }).eq('id', prospect.id)
      await logEvent(sb, prospect.id, 'instantly:email_bounced', { from: currentState, to: 'dead' })
      await logEvent(sb, prospect.id, 'state:dead', { from: currentState, to: 'dead', reason: 'email_bounced', actor: 'instantly_poller' })
      summary.state_changes++
      summary.details.push(`${prospect.slug}: ${currentState} → dead (bounced)`)
    }
    return
  }

  // Unsubscribed
  if (lead.status === -2) {
    if (shouldAdvance(currentState, 'dead')) {
      await sb.from('prospects').update({ pipeline_state: 'dead' }).eq('id', prospect.id)
      await logEvent(sb, prospect.id, 'instantly:email_unsubscribed', { from: currentState, to: 'dead' })
      await logEvent(sb, prospect.id, 'state:dead', { from: currentState, to: 'dead', reason: 'unsubscribed', actor: 'instantly_poller' })
      summary.state_changes++
      summary.details.push(`${prospect.slug}: ${currentState} → dead (unsubscribed)`)
    }
    return
  }

  // Replied (check before sent — reply implies sent + opened)
  if (lead.email_reply_count && lead.email_reply_count > 0) {
    if (shouldAdvance(currentState, 'replied')) {
      await sb.from('prospects').update({ pipeline_state: 'replied' }).eq('id', prospect.id)
      await logEvent(sb, prospect.id, 'instantly:email_replied', {
        from: currentState, to: 'replied',
        reply_count: lead.email_reply_count,
        replied_step: lead.email_replied_step,
        replied_variant: lead.email_replied_variant,
        timestamp: lead.timestamp_last_reply,
        actor: 'instantly_poller',
      })
      await logEvent(sb, prospect.id, 'state:replied', { from: currentState, to: 'replied', reason: 'email_replied', actor: 'instantly_poller' })
      summary.state_changes++
      summary.details.push(`${prospect.slug}: ${currentState} → replied`)
    }
    return
  }

  // Opened (log event but don't change state — our tracking pixel handles opened)
  if (lead.email_open_count && lead.email_open_count > 0 && currentState === 'sent') {
    await logEvent(sb, prospect.id, 'instantly:email_opened', {
      open_count: lead.email_open_count,
      timestamp: lead.timestamp_last_open,
      actor: 'instantly_poller',
    })
    summary.events_logged++
  }

  // Sent (contacted)
  if (lead.timestamp_last_contact && shouldAdvance(currentState, 'sent')) {
    await sb.from('prospects').update({ pipeline_state: 'sent' }).eq('id', prospect.id)
    await logEvent(sb, prospect.id, 'instantly:email_sent', {
      from: currentState, to: 'sent',
      timestamp: lead.timestamp_last_contact,
      actor: 'instantly_poller',
    })
    await logEvent(sb, prospect.id, 'state:sent', { from: currentState, to: 'sent', reason: 'email_sent', actor: 'instantly_poller' })
    summary.state_changes++
    summary.details.push(`${prospect.slug}: ${currentState} → sent`)
  }
}

async function logEvent(
  sb: NonNullable<ReturnType<typeof getSupabaseServer>>,
  prospectId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await sb.from('prospect_events').insert({ prospect_id: prospectId, event, payload })
}

// ─── CLI entry point ────────────────────────────────────

async function main() {
  console.log('\n═══ Instantly Poller ═══\n')
  const start = Date.now()
  const summary = await pollInstantly()
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\n═══ Poll Complete (${elapsed}s) ═══`)
  console.log(`  Leads fetched: ${summary.leads_fetched}`)
  console.log(`  State changes: ${summary.state_changes}`)
  console.log(`  Events logged: ${summary.events_logged}`)
  console.log(`  Errors: ${summary.errors}`)
  if (summary.details.length > 0) {
    console.log(`  Transitions:`)
    for (const d of summary.details) console.log(`    ${d}`)
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Poller failed:', err)
    process.exit(1)
  })
}
