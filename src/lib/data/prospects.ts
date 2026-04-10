import { getSupabaseServer } from '@/lib/supabase/server'
import type { Prospect, NewProspect } from '@/lib/types/prospect'

export async function getProspectBySlug(slug: string): Promise<Prospect | null> {
  const supabase = getSupabaseServer()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return data as Prospect
}

export async function recordPageView(
  prospectId: string,
  userAgent: string | null,
  referrer: string | null,
): Promise<void> {
  try {
    const supabase = getSupabaseServer()
    if (!supabase) return

    await supabase.from('prospect_page_views').insert({
      prospect_id: prospectId,
      user_agent: userAgent,
      referrer: referrer,
    })
  } catch (err) {
    console.error('[PageView] Failed to record:', err)
  }
}

export async function seedProspect(data: NewProspect): Promise<Prospect | null> {
  const supabase = getSupabaseServer()
  if (!supabase) {
    console.error('[Seed] No Supabase client — check env vars')
    return null
  }

  const { data: row, error } = await supabase
    .from('prospects')
    .insert(data)
    .select()
    .single()

  if (error) {
    console.error('[Seed] Insert failed:', error.message)
    return null
  }

  return row as Prospect
}
