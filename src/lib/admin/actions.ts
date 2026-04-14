'use server'

/**
 * Admin server actions — manual state transitions + notes.
 * Every action re-verifies the admin session (belt-and-suspenders alongside middleware).
 */

import { revalidatePath } from 'next/cache'
import { getSessionFromCookies } from './auth'
import { getSupabaseServer } from '@/lib/supabase/server'
import { PIPELINE_STATES, type PipelineState } from './queries'

export interface ActionResult {
  ok: boolean
  error?: string
}

async function requireAdmin(): Promise<void> {
  const ok = await getSessionFromCookies()
  if (!ok) throw new Error('Unauthorized')
}

export async function updateProspectState(
  prospectId: string,
  newState: PipelineState,
  reason?: string,
): Promise<ActionResult> {
  try {
    await requireAdmin()

    if (!PIPELINE_STATES.includes(newState)) {
      return { ok: false, error: 'Invalid state' }
    }

    const sb = getSupabaseServer()
    if (!sb) return { ok: false, error: 'Supabase not configured' }

    // Get current state for the from→to payload
    const { data: current } = await sb
      .from('prospects')
      .select('pipeline_state')
      .eq('id', prospectId)
      .single()

    if (!current) return { ok: false, error: 'Prospect not found' }

    const fromState = current.pipeline_state as PipelineState

    // Update the prospect
    const { error: updateErr } = await sb
      .from('prospects')
      .update({ pipeline_state: newState })
      .eq('id', prospectId)

    if (updateErr) {
      console.error('[actions] updateProspectState failed:', updateErr.message)
      return { ok: false, error: 'Failed to update state' }
    }

    // Log the transition event
    await sb.from('prospect_events').insert({
      prospect_id: prospectId,
      event: `state:${newState}`,
      payload: {
        from: fromState,
        to: newState,
        reason: reason || null,
        actor: 'admin_manual',
      },
    })

    revalidatePath('/admin')
    revalidatePath(`/admin/prospects/${prospectId}`)

    return { ok: true }
  } catch (err) {
    const msg = (err as Error).message || 'Unknown error'
    console.error('[actions] updateProspectState error:', msg)
    return { ok: false, error: msg === 'Unauthorized' ? 'Unauthorized' : 'Action failed' }
  }
}

/**
 * Run mockup verification against production for a single prospect.
 * Writes a mockup_verified or mockup_broken event.
 */
export async function verifyProspectMockup(prospectId: string): Promise<ActionResult & { detail?: string }> {
  try {
    await requireAdmin()

    const sb = getSupabaseServer()
    if (!sb) return { ok: false, error: 'Supabase not configured' }

    const { data: p } = await sb
      .from('prospects')
      .select('slug, pipeline_state, mockup_url')
      .eq('id', prospectId)
      .single()

    if (!p || !p.slug) return { ok: false, error: 'Prospect not found' }

    const { verifyOne } = await import('../../../scripts/verify-mockups')
    const result = await verifyOne(p.slug, p.pipeline_state!, p.mockup_url)

    await sb.from('prospect_events').insert({
      prospect_id: prospectId,
      event: result.ok ? 'mockup_verified' : 'mockup_broken',
      payload: {
        url: result.image_url,
        image_status: result.image_status,
        content_type: result.image_content_type,
        size: result.image_size,
        reason: result.reason,
        actor: 'admin_manual',
      },
    })

    revalidatePath('/admin')
    revalidatePath(`/admin/prospects/${prospectId}`)

    return {
      ok: result.ok,
      error: result.ok ? undefined : result.reason,
      detail: result.ok
        ? `${((result.image_size || 0) / 1024).toFixed(0)}KB ${result.image_content_type}`
        : result.reason,
    }
  } catch (err) {
    const msg = (err as Error).message || 'Unknown error'
    console.error('[actions] verifyProspectMockup error:', msg)
    return { ok: false, error: msg === 'Unauthorized' ? 'Unauthorized' : 'Action failed' }
  }
}

export async function addProspectNote(
  prospectId: string,
  note: string,
): Promise<ActionResult> {
  try {
    await requireAdmin()

    const trimmed = note.trim()
    if (!trimmed) return { ok: false, error: 'Note cannot be empty' }
    if (trimmed.length > 2000) return { ok: false, error: 'Note too long (max 2000 chars)' }

    const sb = getSupabaseServer()
    if (!sb) return { ok: false, error: 'Supabase not configured' }

    // Verify prospect exists
    const { data: exists } = await sb.from('prospects').select('id').eq('id', prospectId).single()
    if (!exists) return { ok: false, error: 'Prospect not found' }

    await sb.from('prospect_events').insert({
      prospect_id: prospectId,
      event: 'note',
      payload: { note: trimmed, actor: 'admin_manual' },
    })

    revalidatePath(`/admin/prospects/${prospectId}`)

    return { ok: true }
  } catch (err) {
    const msg = (err as Error).message || 'Unknown error'
    console.error('[actions] addProspectNote error:', msg)
    return { ok: false, error: msg === 'Unauthorized' ? 'Unauthorized' : 'Action failed' }
  }
}
