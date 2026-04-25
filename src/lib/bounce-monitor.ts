/**
 * Bounce rate monitor — runs after every poller cycle.
 *
 * Only counts prospects with email_source='pattern' to avoid
 * false positives from pre-pivot Hunter-era bounces.
 * Alerts via Telegram if hard bounce rate >5% (24h dedup).
 */

import { getSupabaseServer } from '@/lib/supabase/server'

const TELEGRAM_API = 'https://api.telegram.org'
const WINDOW_DAYS = 7
const MIN_SAMPLE = 50
const WARN_THRESHOLD = 0.03
const ALERT_THRESHOLD = 0.05
const DEDUP_HOURS = 24

export interface BounceCheckResult {
  sent: number
  bounced: number
  rate: number
  alerted: boolean
  skipped_reason?: string
}

export async function checkBounceRate(): Promise<BounceCheckResult> {
  const sb = getSupabaseServer()
  if (!sb) return { sent: 0, bounced: 0, rate: 0, alerted: false, skipped_reason: 'no_supabase' }

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Only count prospects that used pattern-based email enrichment
  const { data: patternProspects } = await sb.from('prospects')
    .select('id')
    .eq('email_source', 'pattern')

  if (!patternProspects || patternProspects.length === 0) {
    return { sent: 0, bounced: 0, rate: 0, alerted: false, skipped_reason: 'no_pattern_prospects' }
  }

  const ids = patternProspects.map(p => p.id)

  const [sentResult, bouncedResult] = await Promise.all([
    sb.from('prospect_events')
      .select('id', { count: 'exact', head: true })
      .eq('event', 'state:sent')
      .in('prospect_id', ids)
      .gte('created_at', since),
    sb.from('prospect_events')
      .select('id', { count: 'exact', head: true })
      .eq('event', 'state:bounced')
      .in('prospect_id', ids)
      .gte('created_at', since),
  ])

  const sent = sentResult.count ?? 0
  const bounced = bouncedResult.count ?? 0

  if (sent < MIN_SAMPLE) {
    return { sent, bounced, rate: 0, alerted: false, skipped_reason: `sample_too_small (${sent}/${MIN_SAMPLE})` }
  }

  const rate = bounced / sent

  if (rate < WARN_THRESHOLD) {
    console.log(`[bounce-monitor] Healthy: ${(rate * 100).toFixed(1)}% (${bounced}/${sent} pattern-email)`)
    return { sent, bounced, rate, alerted: false }
  }

  if (rate < ALERT_THRESHOLD) {
    console.warn(`[bounce-monitor] Warning: ${(rate * 100).toFixed(1)}% (${bounced}/${sent} pattern-email) — watch zone`)
    return { sent, bounced, rate, alerted: false }
  }

  // >5% — check dedup before alerting
  const dedupSince = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000).toISOString()
  const { data: priorAlert } = await sb.from('prospect_events')
    .select('id')
    .eq('event', 'bounce_alert')
    .gte('created_at', dedupSince)
    .limit(1)

  if (priorAlert && priorAlert.length > 0) {
    console.warn(`[bounce-monitor] Critical ${(rate * 100).toFixed(1)}% but already alerted in last ${DEDUP_HOURS}h — skipping`)
    return { sent, bounced, rate, alerted: false, skipped_reason: 'dedup_24h' }
  }

  // Fire Telegram alert
  const alertSent = await sendBounceAlert(rate, bounced, sent)

  // Log event
  await sb.from('prospect_events').insert({
    prospect_id: null,
    event: 'bounce_alert',
    payload: {
      rate: Math.round(rate * 1000) / 10,
      bounced,
      sent,
      window_days: WINDOW_DAYS,
      email_source_filter: 'pattern',
      telegram_sent: alertSent,
      actor: 'bounce_monitor',
    },
  })

  return { sent, bounced, rate, alerted: true }
}

async function sendBounceAlert(rate: number, bounced: number, sent: number): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.error('[bounce-monitor] Telegram not configured — cannot send alert')
    return false
  }

  const pct = (rate * 100).toFixed(1)

  const text = [
    `\u{1F6A8} <b>BOUNCE RATE ALERT</b>`,
    '',
    `Last 7 days (pattern emails only): <b>${pct}%</b> (${bounced}/${sent})`,
    `Threshold: &gt;5%`,
    '',
    `Investigate bounced prospects before next batch.`,
    '',
    `Check: /admin \u2192 prospects \u2192 filter by bounced`,
  ].join('\n')

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('[bounce-monitor] Telegram send failed:', data.description)
      return false
    }
    console.error(`[bounce-monitor] CRITICAL: ${pct}% bounce rate — Telegram alert sent`)
    return true
  } catch (err) {
    console.error('[bounce-monitor] Telegram error:', (err as Error).message?.slice(0, 80))
    return false
  }
}
