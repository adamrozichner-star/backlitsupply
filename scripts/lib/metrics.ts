/**
 * Stage 10 — Metrics tracking
 *
 * Writes prospect events to Supabase prospect_events table.
 * Also provides batch reporting utilities.
 */

import { getSupabaseServer } from '../../src/lib/supabase/server'
import type { ProspectEvent } from './types'

/**
 * Transition a prospect to a new pipeline state and log the event.
 * Atomic: updates state + inserts event. Fire-and-forget — never throws.
 */
export async function updatePipelineState(
  prospectId: string,
  newState: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getSupabaseServer()
    if (!supabase) return

    // Update state
    await supabase
      .from('prospects')
      .update({ pipeline_state: newState })
      .eq('id', prospectId)

    // Log event
    await supabase.from('prospect_events').insert({
      prospect_id: prospectId,
      event: `state:${newState}`,
      payload: payload || {},
    })
  } catch (err) {
    console.error(`[metrics] Failed to update state to "${newState}":`, err)
  }
}

/**
 * Record a cost event (API spend). Not tied to a specific prospect.
 * event format: 'cost:places' | 'cost:haiku' | 'cost:replicate'
 */
export async function recordCost(
  provider: 'places' | 'haiku' | 'replicate' | 'hunter',
  usd: number,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getSupabaseServer()
    if (!supabase) return
    await supabase.from('prospect_events').insert({
      prospect_id: null,
      event: `cost:${provider}`,
      payload: { usd, ...details },
    })
  } catch (err) {
    console.error(`[metrics] Failed to record cost:${provider}:`, err)
  }
}

/**
 * Record a prospect event. Fire-and-forget — never throws.
 */
export async function recordEvent(
  prospectId: string,
  event: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getSupabaseServer()
    if (!supabase) return

    await supabase.from('prospect_events').insert({
      prospect_id: prospectId,
      event,
      payload: payload || {},
    })
  } catch (err) {
    console.error(`[metrics] Failed to record event "${event}":`, err)
  }
}

/**
 * Record multiple events in batch.
 */
export async function recordEvents(events: ProspectEvent[]): Promise<void> {
  try {
    const supabase = getSupabaseServer()
    if (!supabase) return

    await supabase.from('prospect_events').insert(events)
  } catch (err) {
    console.error('[metrics] Batch insert failed:', err)
  }
}

/**
 * Get metrics summary for a niche batch.
 * Returns counts per event type.
 */
export async function getBatchMetrics(
  niche: string,
  batchDate?: string,
): Promise<Record<string, number>> {
  const supabase = getSupabaseServer()
  if (!supabase) return {}

  // Query prospect_events joined with prospects for niche filtering
  const query = supabase
    .from('prospect_events')
    .select('event, prospects!inner(niche)')
    .eq('prospects.niche', niche)

  if (batchDate) {
    query.gte('created_at', batchDate)
  }

  const { data, error } = await query
  if (error || !data) return {}

  const counts: Record<string, number> = {}
  for (const row of data) {
    const evt = (row as { event: string }).event
    counts[evt] = (counts[evt] || 0) + 1
  }

  return counts
}
