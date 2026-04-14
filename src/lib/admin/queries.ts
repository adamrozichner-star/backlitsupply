/**
 * Admin dashboard data layer. All read-only Supabase queries.
 * Server-side only — uses the service-role client.
 */

import { getSupabaseServer } from '@/lib/supabase/server'

export type PipelineState =
  | 'discovered' | 'enriched' | 'qualified' | 'mockup_ready'
  | 'sent' | 'opened' | 'replied' | 'positive' | 'booked' | 'won' | 'lost' | 'dead'

export const PIPELINE_STATES: PipelineState[] = [
  'discovered', 'enriched', 'qualified', 'mockup_ready',
  'sent', 'opened', 'replied', 'positive', 'booked', 'won',
  'lost', 'dead',
]

export interface AdminProspect {
  id: string
  slug: string | null
  business_name: string | null
  owner_first_name: string | null
  owner_last_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  city: string | null
  state: string | null
  niche: string | null
  logo_url: string | null
  mockup_url: string | null
  pipeline_state: PipelineState | null
  enrichment_version: number | null
  source: string | null
  created_at: string
  days_in_state: number
}

export interface AdminEvent {
  id: string
  prospect_id: string | null
  event: string
  payload: Record<string, unknown>
  created_at: string
  business_name?: string | null
}

export interface FunnelCounts {
  state: PipelineState
  count: number
  percent_of_discovered: number
}

export interface MetricsTotals {
  total_prospects: number
  total_cost_usd: number
  avg_cost_per_qualified_usd: number
  reply_rate: number
  positive_reply_rate: number
  conversion_rate: number
  first_cost_event_date: string | null
}

export interface CostBreakdownWeek {
  week_start: string  // ISO date (Monday)
  places: number
  haiku: number
  replicate: number
}

export interface NicheMetrics {
  niche: string
  total: number
  discovered: number
  enriched: number
  qualified: number
  mockup_ready: number
  sent: number
  opened: number
  replied: number
  positive: number
  booked: number
  won: number
  lost: number
  sendable: number             // has owner_first_name AND email
  mockup_hit_rate: number      // mockup_ready / qualified (0-1)
}

// ─── Funnel ─────────────────────────────────────────────

export async function getFunnelCounts(): Promise<FunnelCounts[]> {
  const sb = getSupabaseServer()
  if (!sb) return []

  const { data } = await sb.from('prospects').select('pipeline_state')
  if (!data) return []

  const counts = new Map<PipelineState, number>()
  for (const state of PIPELINE_STATES) counts.set(state, 0)
  for (const row of data) {
    const s = row.pipeline_state as PipelineState | null
    if (s && counts.has(s)) counts.set(s, counts.get(s)! + 1)
  }

  const discovered = counts.get('discovered') || 0
  // For funnel %, use total prospects as the denominator instead of just 'discovered'
  // since 'discovered' is the very first state and everyone passes through it
  const total = data.length || 1

  return PIPELINE_STATES.map(state => ({
    state,
    count: counts.get(state) || 0,
    percent_of_discovered: ((counts.get(state) || 0) / total) * 100,
  }))
}

// ─── Prospects list ─────────────────────────────────────

export interface ProspectFilters {
  niche?: string
  state?: PipelineState
  search?: string
}

export async function getProspects(filters: ProspectFilters = {}): Promise<AdminProspect[]> {
  const sb = getSupabaseServer()
  if (!sb) return []

  let q = sb.from('prospects').select('*').order('created_at', { ascending: false })
  if (filters.niche) q = q.eq('niche', filters.niche)
  if (filters.state) q = q.eq('pipeline_state', filters.state)
  if (filters.search) {
    const term = `%${filters.search}%`
    q = q.or(`business_name.ilike.${term},owner_first_name.ilike.${term},owner_last_name.ilike.${term}`)
  }

  const { data } = await q.limit(500)
  if (!data) return []

  // Compute days_in_state from latest state:* event or created_at
  const prospectIds = data.map(p => p.id)
  const { data: events } = await sb
    .from('prospect_events')
    .select('prospect_id, event, created_at')
    .in('prospect_id', prospectIds)
    .like('event', 'state:%')
    .order('created_at', { ascending: false })

  const latestStateEvent = new Map<string, string>()
  for (const e of events || []) {
    if (!latestStateEvent.has(e.prospect_id)) {
      latestStateEvent.set(e.prospect_id, e.created_at)
    }
  }

  const now = Date.now()
  return data.map(p => {
    const anchor = latestStateEvent.get(p.id) || p.created_at
    const days = Math.floor((now - new Date(anchor).getTime()) / (1000 * 60 * 60 * 24))
    return { ...p, days_in_state: days } as AdminProspect
  })
}

// ─── Prospect detail ────────────────────────────────────

export async function getProspectDetail(id: string): Promise<{ prospect: AdminProspect; events: AdminEvent[] } | null> {
  const sb = getSupabaseServer()
  if (!sb) return null

  const { data: prospect } = await sb.from('prospects').select('*').eq('id', id).single()
  if (!prospect) return null

  const { data: events } = await sb
    .from('prospect_events')
    .select('*')
    .eq('prospect_id', id)
    .order('created_at', { ascending: false })

  const anchor = (events || []).find(e => e.event.startsWith('state:'))?.created_at || prospect.created_at
  const days_in_state = Math.floor((Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60 * 24))

  return {
    prospect: { ...prospect, days_in_state } as AdminProspect,
    events: (events || []) as AdminEvent[],
  }
}

// ─── Metrics totals ─────────────────────────────────────

export async function getMetricsTotals(): Promise<MetricsTotals> {
  const sb = getSupabaseServer()
  if (!sb) {
    return {
      total_prospects: 0, total_cost_usd: 0, avg_cost_per_qualified_usd: 0,
      reply_rate: 0, positive_reply_rate: 0, conversion_rate: 0,
      first_cost_event_date: null,
    }
  }

  const { count: totalCount } = await sb.from('prospects').select('*', { count: 'exact', head: true })

  const { data: costEvents } = await sb
    .from('prospect_events')
    .select('payload, created_at')
    .like('event', 'cost:%')
    .order('created_at', { ascending: true })

  const total_cost_usd = (costEvents || []).reduce((sum, e) => {
    const usd = (e.payload as { usd?: number })?.usd || 0
    return sum + usd
  }, 0)

  const first_cost_event_date = costEvents && costEvents.length > 0 ? costEvents[0].created_at : null

  const { count: qualifiedCount } = await sb
    .from('prospects').select('*', { count: 'exact', head: true })
    .in('pipeline_state', ['qualified', 'mockup_ready', 'sent', 'opened', 'replied', 'positive', 'booked', 'won'])

  const { count: sentCount } = await sb
    .from('prospects').select('*', { count: 'exact', head: true })
    .in('pipeline_state', ['sent', 'opened', 'replied', 'positive', 'booked', 'won'])

  const { count: repliedCount } = await sb
    .from('prospects').select('*', { count: 'exact', head: true })
    .in('pipeline_state', ['replied', 'positive', 'booked', 'won'])

  const { count: positiveCount } = await sb
    .from('prospects').select('*', { count: 'exact', head: true })
    .in('pipeline_state', ['positive', 'booked', 'won'])

  const { count: wonCount } = await sb
    .from('prospects').select('*', { count: 'exact', head: true })
    .eq('pipeline_state', 'won')

  const total_prospects = totalCount || 0
  const sent = sentCount || 0
  const replied = repliedCount || 0
  const positive = positiveCount || 0
  const won = wonCount || 0
  const qualified = qualifiedCount || 0

  return {
    total_prospects,
    total_cost_usd,
    avg_cost_per_qualified_usd: qualified > 0 ? total_cost_usd / qualified : 0,
    reply_rate: sent > 0 ? replied / sent : 0,
    positive_reply_rate: sent > 0 ? positive / sent : 0,
    conversion_rate: sent > 0 ? won / sent : 0,
    first_cost_event_date,
  }
}

// ─── Cost breakdown by week ─────────────────────────────

export async function getCostBreakdown(weeks = 8): Promise<CostBreakdownWeek[]> {
  const sb = getSupabaseServer()
  if (!sb) return []

  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  const { data } = await sb
    .from('prospect_events')
    .select('event, payload, created_at')
    .like('event', 'cost:%')
    .gte('created_at', since.toISOString())

  if (!data) return []

  // Week bucket = Monday of the week containing created_at
  function weekStart(iso: string): string {
    const d = new Date(iso)
    const day = d.getUTCDay()
    const daysToMonday = (day + 6) % 7
    d.setUTCDate(d.getUTCDate() - daysToMonday)
    d.setUTCHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }

  const bucketMap = new Map<string, CostBreakdownWeek>()

  // Pre-populate last N weeks (so empty weeks show as zero)
  for (let i = 0; i < weeks; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i * 7)
    const wk = weekStart(d.toISOString())
    if (!bucketMap.has(wk)) {
      bucketMap.set(wk, { week_start: wk, places: 0, haiku: 0, replicate: 0 })
    }
  }

  for (const row of data) {
    const wk = weekStart(row.created_at)
    if (!bucketMap.has(wk)) {
      bucketMap.set(wk, { week_start: wk, places: 0, haiku: 0, replicate: 0 })
    }
    const bucket = bucketMap.get(wk)!
    const usd = (row.payload as { usd?: number })?.usd || 0
    if (row.event === 'cost:places') bucket.places += usd
    else if (row.event === 'cost:haiku') bucket.haiku += usd
    else if (row.event === 'cost:replicate') bucket.replicate += usd
  }

  return [...bucketMap.values()].sort((a, b) => a.week_start.localeCompare(b.week_start))
}

// ─── Recent events ──────────────────────────────────────

export async function getRecentEvents(limit = 20): Promise<AdminEvent[]> {
  const sb = getSupabaseServer()
  if (!sb) return []

  const { data } = await sb
    .from('prospect_events')
    .select('id, prospect_id, event, payload, created_at, prospects(business_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map(e => ({
    id: e.id,
    prospect_id: e.prospect_id,
    event: e.event,
    payload: (e.payload as Record<string, unknown>) || {},
    created_at: e.created_at,
    business_name: (e.prospects as { business_name?: string } | null)?.business_name || null,
  }))
}

// ─── Niche list for filter dropdown ─────────────────────

// ─── Per-niche metrics (for /admin/niches comparative view) ────────────

export async function getMetricsByNiche(): Promise<NicheMetrics[]> {
  const sb = getSupabaseServer()
  if (!sb) return []

  // Single query, groupable client-side — Supabase doesn't do GROUP BY via PostgREST,
  // so we pull the minimal columns and bucket in JS. Still one round-trip.
  const { data } = await sb
    .from('prospects')
    .select('niche, pipeline_state, owner_first_name, email')
    .not('niche', 'is', null)

  if (!data) return []

  const byNiche = new Map<string, NicheMetrics>()

  function ensure(niche: string): NicheMetrics {
    let m = byNiche.get(niche)
    if (!m) {
      m = {
        niche,
        total: 0,
        discovered: 0, enriched: 0, qualified: 0, mockup_ready: 0,
        sent: 0, opened: 0, replied: 0, positive: 0, booked: 0, won: 0, lost: 0,
        sendable: 0,
        mockup_hit_rate: 0,
      }
      byNiche.set(niche, m)
    }
    return m
  }

  for (const row of data) {
    const niche = row.niche as string
    const state = row.pipeline_state as PipelineState | null
    const m = ensure(niche)
    m.total++

    if (state && state in m) {
      // @ts-expect-error dynamic field access is safe here
      m[state]++
    }

    if (row.owner_first_name && row.email) m.sendable++
  }

  // Compute hit rate: mockup_ready+ / (qualified + mockup_ready+)
  // (prospects that reached the mockup stage, out of those that got past qualify)
  for (const m of byNiche.values()) {
    const reachedMockup = m.mockup_ready + m.sent + m.opened + m.replied + m.positive + m.booked + m.won
    const pastQualify = m.qualified + reachedMockup + m.lost
    m.mockup_hit_rate = pastQualify > 0 ? reachedMockup / pastQualify : 0
  }

  return [...byNiche.values()].sort((a, b) => b.total - a.total)
}

// ─── Mockup health check (for admin banner) ─────────────

export interface BrokenMockup {
  id: string
  slug: string | null
  business_name: string | null
  reason: string | null
  last_broken_at: string
}

/**
 * Returns prospects that have a mockup_broken event newer than their most
 * recent mockup_verified event (and are still at mockup_ready+). Used by the
 * admin dashboard health banner.
 */
export async function getBrokenMockups(): Promise<BrokenMockup[]> {
  const sb = getSupabaseServer()
  if (!sb) return []

  // Pull last 24h of mockup_broken + mockup_verified events
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: events } = await sb
    .from('prospect_events')
    .select('prospect_id, event, payload, created_at')
    .in('event', ['mockup_broken', 'mockup_verified'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (!events || events.length === 0) return []

  // Keep only the LATEST event per prospect
  const latestByProspect = new Map<string, typeof events[0]>()
  for (const e of events) {
    if (!latestByProspect.has(e.prospect_id)) latestByProspect.set(e.prospect_id, e)
  }

  const broken = [...latestByProspect.values()].filter(e => e.event === 'mockup_broken')
  if (broken.length === 0) return []

  // Join with prospects, filter to mockup_ready+ only
  const ids = broken.map(b => b.prospect_id)
  const { data: prospects } = await sb
    .from('prospects')
    .select('id, slug, business_name, pipeline_state')
    .in('id', ids)
    .in('pipeline_state', ['mockup_ready', 'sent', 'opened', 'replied', 'positive', 'booked'])

  const prospectMap = new Map((prospects || []).map(p => [p.id, p]))

  return broken
    .map(b => {
      const p = prospectMap.get(b.prospect_id)
      if (!p) return null
      return {
        id: p.id,
        slug: p.slug,
        business_name: p.business_name,
        reason: ((b.payload as Record<string, unknown>)?.reason as string) || null,
        last_broken_at: b.created_at,
      }
    })
    .filter((r): r is BrokenMockup => r !== null)
}

export async function getNiches(): Promise<string[]> {
  const sb = getSupabaseServer()
  if (!sb) return []
  const { data } = await sb.from('prospects').select('niche').not('niche', 'is', null)
  if (!data) return []
  return [...new Set(data.map(r => r.niche as string).filter(Boolean))].sort()
}
