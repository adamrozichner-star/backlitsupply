export interface Prospect {
  id: string
  slug: string
  business_name: string
  owner_first_name: string | null
  owner_last_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  instagram: string | null
  city: string | null
  state: string | null
  country: string | null
  niche: string | null
  logo_url: string | null
  mockup_url: string | null
  suggested_dimensions: string | null
  suggested_price_usd: number | null
  notes: string | null
  source: string | null
  status: string | null
  created_at: string
  sent_at: string | null
  opened_at: string | null
  replied_at: string | null
  closed_at: string | null
  deal_value: number | null
}

export interface ProspectPageView {
  id: string
  prospect_id: string
  viewed_at: string
  user_agent: string | null
  referrer: string | null
}

export type NewProspect = Omit<Prospect, 'id' | 'created_at' | 'sent_at' | 'opened_at' | 'replied_at' | 'closed_at'>
