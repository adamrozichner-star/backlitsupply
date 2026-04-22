/**
 * Instantly.ai API v2 client.
 *
 * Base URL: https://api.instantly.ai
 * Auth: Bearer token (INSTANTLY_API_KEY)
 * Flat-rate pricing ($37/mo) — no per-lead cost, but we log events for audit.
 *
 * Endpoints used:
 *   POST /api/v2/leads       — create single lead (attached to campaign)
 *   POST /api/v2/leads/add   — bulk add leads to campaign (max 1000)
 *   POST /api/v2/webhooks    — create webhook subscription
 *
 * Merge tag mapping (Instantly template syntax):
 *   {{firstName}}  ← prospect.owner_first_name
 *   {{companyName}} ← prospect.business_name
 *   {{mockupUrl}}  ← custom_variables.mockupUrl
 *   {{personalizedPageUrl}} ← custom_variables.personalizedPageUrl
 */

const BASE_URL = 'https://api.instantly.ai'

function getApiKey(): string {
  const key = process.env.INSTANTLY_API_KEY
  if (!key) throw new Error('[instantly] Missing INSTANTLY_API_KEY')
  return key
}

async function fetchWithRetry(
  path: string,
  opts: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  const url = `${BASE_URL}${path}`
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      ...opts,
      signal: AbortSignal.timeout(30000),
    })

    if (res.ok) return res

    if (res.status === 429 && attempt < maxRetries) {
      const waitSec = Math.pow(2, attempt + 1)
      console.log(`    [instantly] Rate limited, waiting ${waitSec}s (attempt ${attempt + 1}/${maxRetries})...`)
      await new Promise(r => setTimeout(r, waitSec * 1000))
      continue
    }

    const body = await res.text().catch(() => '')
    throw new Error(`[instantly] API error ${res.status}: ${body.slice(0, 200)}`)
  }
  throw new Error('[instantly] Max retries exceeded')
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getApiKey()}`,
  }
}

// ─── Lead types ─────────────────────────────────────────

export interface InstantlyLeadInput {
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  website?: string
  phone?: string
  custom_variables?: Record<string, string | number | boolean | null>
}

export interface InstantlyLeadResult {
  id: string
  email: string
  status: string
}

// ─── Create single lead ─────────────────────────────────

export async function createLead(
  lead: InstantlyLeadInput,
  campaignId: string,
): Promise<InstantlyLeadResult> {
  const res = await fetchWithRetry('/api/v2/leads', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email: lead.email,
      first_name: lead.first_name,
      last_name: lead.last_name,
      company_name: lead.company_name,
      website: lead.website,
      phone: lead.phone,
      campaign: campaignId,
      custom_variables: lead.custom_variables || {},
      skip_if_in_campaign: true,
      skip_if_in_workspace: false,
    }),
  })

  const data = await res.json()
  return {
    id: data.id || data.lead_id || '',
    email: lead.email,
    status: data.status || 'created',
  }
}

// ─── Bulk add leads ─────────────────────────────────────

export async function bulkAddLeads(
  leads: InstantlyLeadInput[],
  campaignId: string,
): Promise<{ leads_uploaded: number; created_leads: Array<{ id: string; index: number }> }> {
  if (leads.length === 0) return { leads_uploaded: 0, created_leads: [] }
  if (leads.length > 1000) throw new Error('[instantly] Max 1000 leads per bulk add')

  const res = await fetchWithRetry('/api/v2/leads/add', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      campaign_id: campaignId,
      leads: leads.map(l => ({
        email: l.email,
        first_name: l.first_name,
        last_name: l.last_name,
        company_name: l.company_name,
        website: l.website,
        phone: l.phone,
        custom_variables: l.custom_variables || {},
      })),
      skip_if_in_campaign: true,
      skip_if_in_workspace: false,
    }),
  })

  return await res.json()
}

// ─── Create webhook ─────────────────────────────────────

export async function createWebhook(
  targetUrl: string,
  eventType: string,
  secret: string,
  campaignId?: string,
): Promise<{ id: string }> {
  const res = await fetchWithRetry('/api/v2/webhooks', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name: `backlit-${eventType}`,
      target_hook_url: targetUrl,
      event_type: eventType,
      campaign: campaignId || null,
      headers: {
        'X-Webhook-Secret': secret,
      },
    }),
  })

  return await res.json()
}

// ─── Prospect → Instantly lead conversion ───────────────

export interface ProspectForInstantly {
  email: string
  owner_first_name?: string | null
  owner_last_name?: string | null
  business_name?: string | null
  website?: string | null
  phone?: string | null
  slug?: string | null
  mockup_url?: string | null
}

export function prospectToLead(prospect: ProspectForInstantly): InstantlyLeadInput {
  const personalizedPageUrl = prospect.slug
    ? `https://backlitsupply.com/for/${prospect.slug}`
    : null

  return {
    email: prospect.email,
    first_name: prospect.owner_first_name || undefined,
    last_name: prospect.owner_last_name || undefined,
    company_name: prospect.business_name || undefined,
    website: prospect.website || undefined,
    phone: prospect.phone || undefined,
    custom_variables: {
      mockupUrl: personalizedPageUrl || '',
      personalizedPageUrl: personalizedPageUrl || '',
      businessName: prospect.business_name || '',
    },
  }
}
