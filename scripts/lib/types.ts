// ─── Prospect state machine ─────────────────────────────

export const PROSPECT_STATES = [
  'discovered',
  'enriched',
  'qualified',
  'mockup_ready',
  'sent',
  'opened',
  'replied',
  'positive',
  'booked',
  'won',
  'lost',
  'dead',
] as const

export type ProspectState = (typeof PROSPECT_STATES)[number]

// ─── Raw discovery output ───────────────────────────────

export interface RawListing {
  business_name: string
  owner_name?: string
  address?: string
  city?: string
  state?: string
  county?: string
  website?: string
  phone?: string
  filing_date?: string
  source_slug: string       // which source plugin found this
  source_id?: string        // unique ID from the source (filing number, etc.)
  raw_data?: Record<string, unknown>  // original parsed fields for debugging
}

// ─── Enriched prospect ──────────────────────────────────

export interface EnrichedProspect {
  business_name: string
  owner_first_name?: string
  owner_last_name?: string
  email?: string
  phone?: string
  website?: string
  instagram?: string
  city?: string
  state?: string
  county?: string
  logo_url?: string         // URL of discovered logo
  logo_width?: number       // validated dimensions
  logo_height?: number
  niche?: string
  source_slug: string
  source_id?: string
}

// ─── Mockup result ──────────────────────────────────────

export interface MockupResult {
  slug: string
  template_id: string
  mockup_path: string       // local path or URL depending on storage
  width: number
  height: number
}

// ─── Outreach draft ─────────────────────────────────────

export interface OutreachDraft {
  slug: string
  subject: string           // <50 chars
  body: string              // <75 words
  to_email: string
  to_name: string
  personalized_url: string  // https://backlitsupply.com/for/{slug}
}

// ─── Prospect event (metrics) ───────────────────────────

export interface ProspectEvent {
  prospect_id: string
  event: string
  payload?: Record<string, unknown>
  created_at?: string       // ISO timestamp, defaults to now() in DB
}

// ─── Reply classification ───────────────────────────────

export type ReplyClass = 'interested' | 'objection' | 'unsubscribe' | 'ooo' | 'other'
