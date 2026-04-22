/**
 * Instantly.ai webhook handler.
 *
 * Receives events: email_sent, email_opened, reply_received,
 * email_bounced, lead_unsubscribed.
 *
 * Updates prospect pipeline_state in Supabase and logs full
 * payload to prospect_events for audit trail.
 *
 * Verification: checks X-Webhook-Secret header against
 * INSTANTLY_WEBHOOK_SECRET env var.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

const EVENT_TO_STATE: Record<string, string> = {
  email_sent: 'sent',
  email_opened: 'opened',
  reply_received: 'replied',
  email_bounced: 'dead',
  lead_unsubscribed: 'dead',
}

// Don't regress state — only advance forward in the funnel
const STATE_RANK: Record<string, number> = {
  discovered: 0, enriched: 1, qualified: 2,
  mockup_review_pending: 3, mockup_ready: 4,
  sent: 5, opened: 6, replied: 7,
  positive: 8, booked: 9, won: 10,
  lost: 11, dead: 12,
}

function shouldAdvance(current: string | null, target: string): boolean {
  if (!current) return true
  const currentRank = STATE_RANK[current] ?? -1
  const targetRank = STATE_RANK[target] ?? -1
  // Allow advance unless target is behind current
  // Exception: dead/lost can always override (bounce/unsub kills the prospect)
  if (target === 'dead' || target === 'lost') return true
  return targetRank > currentRank
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET
  if (secret) {
    const headerSecret = request.headers.get('x-webhook-secret')
    if (headerSecret !== secret) {
      console.warn('[instantly webhook] Invalid secret')
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = (payload.event_type || payload.event || '') as string
  const leadEmail = (payload.lead_email || payload.email || (payload.lead as Record<string, unknown>)?.email || '') as string

  if (!eventType || !leadEmail) {
    // Log raw payload for inspection on first call (unknown structure)
    console.log('[instantly webhook] Unknown payload shape:', JSON.stringify(payload).slice(0, 500))
    return NextResponse.json({ received: true, processed: false })
  }

  const sb = getSupabaseServer()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  // Find prospect by email
  const { data: prospect } = await sb
    .from('prospects')
    .select('id, pipeline_state, slug')
    .eq('email', leadEmail)
    .single()

  if (!prospect) {
    console.log(`[instantly webhook] ${eventType} for unknown email: ${leadEmail}`)
    return NextResponse.json({ received: true, matched: false })
  }

  // Log the raw event for audit
  await sb.from('prospect_events').insert({
    prospect_id: prospect.id,
    event: `instantly:${eventType}`,
    payload: {
      ...payload,
      actor: 'instantly_webhook',
    },
  })

  // Map event to pipeline state
  const targetState = EVENT_TO_STATE[eventType]
  if (!targetState) {
    console.log(`[instantly webhook] Unhandled event: ${eventType} for ${prospect.slug}`)
    return NextResponse.json({ received: true, processed: false })
  }

  // Only advance, never regress
  if (!shouldAdvance(prospect.pipeline_state, targetState)) {
    console.log(`[instantly webhook] ${eventType}: ${prospect.slug} already at ${prospect.pipeline_state}, not regressing to ${targetState}`)
    return NextResponse.json({ received: true, already_past: true })
  }

  // Update state
  await sb.from('prospects').update({ pipeline_state: targetState }).eq('id', prospect.id)

  // Log state transition
  await sb.from('prospect_events').insert({
    prospect_id: prospect.id,
    event: `state:${targetState}`,
    payload: {
      from: prospect.pipeline_state,
      to: targetState,
      reason: eventType,
      actor: 'instantly_webhook',
    },
  })

  console.log(`[instantly webhook] ${eventType}: ${prospect.slug} ${prospect.pipeline_state} → ${targetState}`)

  return NextResponse.json({ received: true, processed: true, state: targetState })
}
