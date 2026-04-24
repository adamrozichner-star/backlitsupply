/**
 * Serverless-compatible Instantly poller — importable from Next.js API routes.
 * Core logic matches scripts/lib/instantly-poller.ts but uses process.env
 * directly (no dotenv, no scripts-path imports).
 */

import { getSupabaseServer } from '@/lib/supabase/server'
import { handleReply } from '@/lib/reply-handler'

const BASE_URL = 'https://api.instantly.ai'

interface InstantlyLead {
  id: string
  email: string
  status: number
  email_open_count?: number
  email_reply_count?: number
  email_replied_step?: number
  email_replied_variant?: string
  timestamp_last_contact?: string
  timestamp_last_open?: string
  timestamp_last_reply?: string
  [key: string]: unknown
}

export interface PollSummary {
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

async function fetchLeads(campaignId: string, apiKey: string): Promise<InstantlyLead[]> {
  const allLeads: InstantlyLead[] = []
  let cursor: string | undefined

  while (true) {
    const body: Record<string, unknown> = { campaign: campaignId, limit: 100 }
    if (cursor) body.starting_after = cursor

    const res = await fetch(`${BASE_URL}/api/v2/leads/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) throw new Error(`Instantly API ${res.status}`)

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
  const summary: PollSummary = { leads_fetched: 0, state_changes: 0, events_logged: 0, errors: 0, details: [] }

  const campaignId = process.env.INSTANTLY_CAMPAIGN_ID
  const apiKey = process.env.INSTANTLY_API_KEY
  if (!campaignId || !apiKey) {
    summary.errors = 1
    summary.details.push('Missing INSTANTLY_CAMPAIGN_ID or INSTANTLY_API_KEY')
    return summary
  }

  const sb = getSupabaseServer()
  if (!sb) { summary.errors = 1; return summary }

  let leads: InstantlyLead[]
  try {
    leads = await fetchLeads(campaignId, apiKey)
  } catch (err) {
    summary.errors = 1
    summary.details.push(`Fetch failed: ${(err as Error).message}`)
    return summary
  }

  summary.leads_fetched = leads.length

  for (const lead of leads) {
    try {
      // Match by instantly_lead_id or email
      let { data: prospect } = await sb.from('prospects')
        .select('id, slug, pipeline_state').eq('instantly_lead_id', lead.id).single()

      if (!prospect) {
        const { data: byEmail } = await sb.from('prospects')
          .select('id, slug, pipeline_state, instantly_lead_id').eq('email', lead.email).single()
        if (!byEmail) continue
        if (!byEmail.instantly_lead_id) await sb.from('prospects').update({ instantly_lead_id: lead.id }).eq('id', byEmail.id)
        prospect = byEmail
      }

      const currentState = prospect.pipeline_state || 'mockup_ready'

      // Bounced — preserve record (don't kill to dead).
      // Soft bounces (mailbox full, greylisting) are retryable; hard bounces
      // (invalid address) are not. Instantly API doesn't expose bounce reason,
      // so we log esp_code and default to bounce_type='unknown'. Admin can
      // manually classify via prospect_events.
      if (lead.status === -1 && currentState !== 'dead' && currentState !== 'lost') {
        // Only transition once — don't re-log on every poll
        if (currentState !== 'bounced') {
          await sb.from('prospects').update({ pipeline_state: 'bounced' as string }).eq('id', prospect.id)
          await sb.from('prospect_events').insert({
            prospect_id: prospect.id,
            event: 'instantly:email_bounced',
            payload: {
              from: currentState, to: 'bounced',
              bounce_type: 'unknown',
              esp_code: (lead as Record<string, unknown>).esp_code ?? null,
              actor: 'instantly_poller',
            },
          })
          await sb.from('prospect_events').insert({
            prospect_id: prospect.id,
            event: 'state:bounced',
            payload: { from: currentState, to: 'bounced', reason: 'email_bounced', actor: 'instantly_poller' },
          })
          summary.state_changes++
          summary.details.push(`${prospect.slug}: ${currentState} → bounced`)
        }
        continue
      }

      // Unsubscribed
      if (lead.status === -2 && shouldAdvance(currentState, 'dead')) {
        await sb.from('prospects').update({ pipeline_state: 'dead' }).eq('id', prospect.id)
        await sb.from('prospect_events').insert({ prospect_id: prospect.id, event: 'state:dead', payload: { from: currentState, to: 'dead', reason: 'unsubscribed', actor: 'instantly_poller' } })
        summary.state_changes++
        summary.details.push(`${prospect.slug}: unsubscribed → dead`)
        continue
      }

      // Replied
      if (lead.email_reply_count && lead.email_reply_count > 0 && shouldAdvance(currentState, 'replied')) {
        await sb.from('prospects').update({ pipeline_state: 'replied' }).eq('id', prospect.id)
        await sb.from('prospect_events').insert({ prospect_id: prospect.id, event: 'state:replied', payload: { from: currentState, to: 'replied', reason: 'email_replied', replied_variant: lead.email_replied_variant, actor: 'instantly_poller' } })
        summary.state_changes++
        summary.details.push(`${prospect.slug}: → replied`)

        try {
          await handleReply(prospect.id, lead.id, lead.email_replied_variant ?? undefined)
        } catch (err) {
          console.error(`[poller] Reply handler failed for ${prospect.slug}:`, (err as Error).message?.slice(0, 120))
          summary.errors++
        }
        continue
      }

      // Opened (log only)
      if (lead.email_open_count && lead.email_open_count > 0 && currentState === 'sent') {
        await sb.from('prospect_events').insert({ prospect_id: prospect.id, event: 'instantly:email_opened', payload: { open_count: lead.email_open_count, timestamp: lead.timestamp_last_open, actor: 'instantly_poller' } })
        summary.events_logged++
      }

      // Sent
      if (lead.timestamp_last_contact && shouldAdvance(currentState, 'sent')) {
        await sb.from('prospects').update({ pipeline_state: 'sent' }).eq('id', prospect.id)
        await sb.from('prospect_events').insert({ prospect_id: prospect.id, event: 'state:sent', payload: { from: currentState, to: 'sent', reason: 'email_sent', timestamp: lead.timestamp_last_contact, actor: 'instantly_poller' } })
        summary.state_changes++
        summary.details.push(`${prospect.slug}: → sent`)
      }
    } catch (err) {
      summary.errors++
    }
  }

  // Log poller run
  await sb.from('prospect_events').insert({ prospect_id: null, event: 'poller_run', payload: summary })

  return summary
}
