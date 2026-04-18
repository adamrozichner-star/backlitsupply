/**
 * Email enrichment via Hunter.io domain search API.
 *
 * API: GET https://api.hunter.io/v2/domain-search?domain=example.com&api_key=xxx
 * Returns: array of emails with confidence scores, first/last name, position, type.
 *
 * Name-matching tiers (descending preference):
 *   Tier 1: first-name match (diana@) at confidence >60
 *   Tier 2: full-name match (dianasmith@) at confidence >70
 *   Tier 3: role-based (info@, hello@, contact@) at confidence >80, flagged email_is_role_based
 *   Tier 4: generic (admin@, mail@, noreply@) → rejected
 *
 * Cache: Supabase-only (email_enrichment_cache table, keyed by domain, 90-day TTL).
 * Cost: 1 credit per domain search ($0.017 on Starter). Verification skipped for >80 confidence.
 *
 * Env var: HUNTER_API_KEY
 */

import { getSupabaseServer } from '../../src/lib/supabase/server'
import { recordCost } from './metrics'

const HUNTER_API_BASE = 'https://api.hunter.io/v2'
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000  // 90 days
const COST_PER_LOOKUP = 0.017  // 1 credit on Starter plan ($34/2000)

// Emails that are never useful for cold outreach
const REJECTED_PREFIXES = ['admin', 'mail', 'noreply', 'no-reply', 'webmaster', 'postmaster', 'support', 'help', 'billing', 'sales']
const ROLE_PREFIXES = ['info', 'hello', 'contact', 'office', 'team', 'general', 'reception']

export interface HunterEmail {
  value: string
  type: string | null           // 'personal' | 'generic' | null
  confidence: number            // 0-100
  first_name: string | null
  last_name: string | null
  position: string | null
}

export interface HunterResult {
  email: string
  confidence: number
  is_role_based: boolean
  source: 'hunter'
  tier: 1 | 2 | 3
  raw: HunterEmail
}

export interface EmailEnrichmentResult {
  found: boolean
  email?: string
  confidence?: number
  is_role_based?: boolean
  tier?: 1 | 2 | 3
  cache_hit?: boolean
}

function extractDomain(website: string): string | null {
  try {
    return new URL(website).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

function getLocalPart(email: string): string {
  return email.split('@')[0].toLowerCase()
}

function isRejectedEmail(email: string): boolean {
  const local = getLocalPart(email)
  return REJECTED_PREFIXES.some(p => local === p || local.startsWith(p + '.'))
}

function isRoleBasedEmail(email: string): boolean {
  const local = getLocalPart(email)
  return ROLE_PREFIXES.some(p => local === p || local.startsWith(p + '.'))
}

/**
 * Score and rank Hunter emails using the name-matching tier system.
 */
function rankEmails(
  hunterEmails: HunterEmail[],
  ownerFirstName?: string,
  ownerLastName?: string,
): HunterResult[] {
  const results: HunterResult[] = []
  const firstLower = ownerFirstName?.toLowerCase()
  const lastLower = ownerLastName?.toLowerCase()

  for (const he of hunterEmails) {
    if (!he.value || isRejectedEmail(he.value)) continue

    const local = getLocalPart(he.value)
    const roleFlag = isRoleBasedEmail(he.value)

    // Tier 1: first-name match at confidence >60
    if (firstLower && local.includes(firstLower) && he.confidence > 60) {
      results.push({ email: he.value, confidence: he.confidence, is_role_based: false, source: 'hunter', tier: 1, raw: he })
      continue
    }

    // Tier 2: full-name match at confidence >70
    if (firstLower && lastLower) {
      const fullMatch = local.includes(firstLower) && local.includes(lastLower)
      const dotMatch = local === `${firstLower}.${lastLower}` || local === `${firstLower}${lastLower}`
      if ((fullMatch || dotMatch) && he.confidence > 70) {
        results.push({ email: he.value, confidence: he.confidence, is_role_based: false, source: 'hunter', tier: 2, raw: he })
        continue
      }
    }

    // Tier 3: role-based at confidence >80
    if (roleFlag && he.confidence > 80) {
      results.push({ email: he.value, confidence: he.confidence, is_role_based: true, source: 'hunter', tier: 3, raw: he })
      continue
    }

    // Hunter returns a name match we didn't detect (e.g., hunter's own first_name field matches)
    if (firstLower && he.first_name?.toLowerCase() === firstLower && he.confidence > 60) {
      results.push({ email: he.value, confidence: he.confidence, is_role_based: roleFlag, source: 'hunter', tier: 1, raw: he })
    }
  }

  // Sort by tier (lower = better), then by confidence (higher = better)
  return results.sort((a, b) => a.tier - b.tier || b.confidence - a.confidence)
}

// ─── Cache ──────────────────────────────────────────────

async function getCached(domain: string): Promise<HunterEmail[] | null> {
  const sb = getSupabaseServer()
  if (!sb) return null
  const { data } = await sb
    .from('email_enrichment_cache')
    .select('emails, created_at')
    .eq('domain', domain)
    .single()
  if (!data) return null
  // Check TTL
  const age = Date.now() - new Date(data.created_at).getTime()
  if (age > CACHE_TTL_MS) return null
  return data.emails as HunterEmail[]
}

async function writeCache(domain: string, emails: HunterEmail[]): Promise<void> {
  const sb = getSupabaseServer()
  if (!sb) return
  await sb.from('email_enrichment_cache').upsert({
    domain,
    emails,
    created_at: new Date().toISOString(),
  })
}

// ─── API ────────────────────────────────────────────────

async function hunterDomainSearch(domain: string, apiKey: string): Promise<HunterEmail[]> {
  const url = `${HUNTER_API_BASE}/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=20`

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })

  if (res.status === 429) {
    // Rate limited — wait and retry once
    console.log('    [hunter] Rate limited, waiting 2s...')
    await new Promise(r => setTimeout(r, 2000))
    const retry = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!retry.ok) throw new Error(`[hunter] API error ${retry.status} after retry`)
    const json = await retry.json()
    return (json.data?.emails || []) as HunterEmail[]
  }

  if (!res.ok) {
    throw new Error(`[hunter] API error ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const json = await res.json()
  return (json.data?.emails || []) as HunterEmail[]
}

// ─── Main entry point ───────────────────────────────────

/**
 * Try to find an email for a prospect via Hunter.io domain search.
 *
 * Only called when the prospect has a website but no email from web scraping.
 * Returns the best email match using the name-matching tier system.
 */
export async function enrichEmailViaHunter(
  website: string,
  ownerFirstName?: string,
  ownerLastName?: string,
  prospectId?: string,
): Promise<EmailEnrichmentResult> {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) {
    return { found: false }
  }

  const domain = extractDomain(website)
  if (!domain) {
    console.log('    [hunter] Cannot extract domain from:', website)
    return { found: false }
  }

  // Check cache first
  let emails = await getCached(domain)
  let cacheHit = !!emails

  if (emails) {
    console.log(`    [hunter] Cache hit for ${domain} (${emails.length} emails)`)
  } else {
    // API call
    console.log(`    [hunter] Searching ${domain}...`)
    try {
      emails = await hunterDomainSearch(domain, apiKey)
      await writeCache(domain, emails)
      await recordCost('hunter', COST_PER_LOOKUP, {
        domain,
        results_count: emails.length,
        prospect_id: prospectId,
      })
    } catch (err) {
      console.error(`    [hunter] Failed:`, (err as Error).message?.slice(0, 100))
      return { found: false }
    }
  }

  if (!emails || emails.length === 0) {
    console.log(`    [hunter] No emails found for ${domain}`)
    return { found: false, cache_hit: cacheHit }
  }

  // Rank and pick best match
  const ranked = rankEmails(emails, ownerFirstName, ownerLastName)

  if (ranked.length === 0) {
    console.log(`    [hunter] ${emails.length} emails found but none passed tier criteria`)
    return { found: false, cache_hit: cacheHit }
  }

  const best = ranked[0]
  console.log(`    [hunter] Best match: ${best.email} (tier ${best.tier}, confidence ${best.confidence}${best.is_role_based ? ', role-based' : ''})`)

  return {
    found: true,
    email: best.email,
    confidence: best.confidence,
    is_role_based: best.is_role_based,
    tier: best.tier,
    cache_hit: cacheHit,
  }
}
