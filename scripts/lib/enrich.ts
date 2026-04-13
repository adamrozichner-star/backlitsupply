/**
 * Stage 3 — Enrichment
 *
 * Given a RawListing with a website, fetches HTML and extracts:
 * - Logo: og:image → twitter:image → apple-touch-icon → largest <img> in <header>
 *   Validates ≥ minLogoSize px, format png/jpg/svg/webp
 * - Owner + email: passes /about + /contact page text to LlmClient with tool schema
 *
 * Skips prospect if logo OR owner_first_name missing (configurable per niche).
 */

import * as cheerio from 'cheerio'
import type { RawListing, EnrichedProspect } from './types'
import type { LlmClient } from './llm'
import type { QualifyConfig } from '../../niches/types'

/**
 * Enrichment version — bump this when enrichment logic changes materially.
 * Pipeline will force-re-enrich any prospect with a lower version on resume.
 *   v1 = homepage-only, no role evidence gate
 *   v2 = multi-page crawl + owner role evidence guardrail
 *   v3 = expanded role tokens (founded/owns/led by/possessives) + same-sentence
 *        name extraction prompt — fixes false rejections of valid ownership signals
 */
export const CURRENT_ENRICHMENT_VERSION = 3

// ─── Logo discovery ─────────────────────────────────────

interface LogoCandidate {
  url: string
  priority: number  // lower = better
}

function extractLogoCandidates(html: string, baseUrl: string): LogoCandidate[] {
  const $ = cheerio.load(html)
  const candidates: LogoCandidate[] = []

  // Priority 1: og:image
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) candidates.push({ url: resolveUrl(ogImage, baseUrl), priority: 1 })

  // Priority 2: twitter:image
  const twImage = $('meta[name="twitter:image"]').attr('content')
  if (twImage) candidates.push({ url: resolveUrl(twImage, baseUrl), priority: 2 })

  // Priority 3: apple-touch-icon
  const touchIcon = $('link[rel="apple-touch-icon"]').attr('href')
  if (touchIcon) candidates.push({ url: resolveUrl(touchIcon, baseUrl), priority: 3 })

  // Priority 4: largest <img> in <header>
  $('header img, .header img, #header img, nav img').each((_, el) => {
    const src = $(el).attr('src')
    if (src) candidates.push({ url: resolveUrl(src, baseUrl), priority: 4 })
  })

  // Priority 5: any img with "logo" in src, alt, or class
  $('img').each((_, el) => {
    const src = $(el).attr('src') || ''
    const alt = $(el).attr('alt') || ''
    const cls = $(el).attr('class') || ''
    if (/logo/i.test(src + alt + cls) && src) {
      candidates.push({ url: resolveUrl(src, baseUrl), priority: 5 })
    }
  })

  return candidates.sort((a, b) => a.priority - b.priority)
}

function resolveUrl(url: string, base: string): string {
  try {
    return new URL(url, base).href
  } catch {
    return url
  }
}

const VALID_FORMATS = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])

async function validateLogo(url: string, minSize: number): Promise<{ url: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null

    const contentType = res.headers.get('content-type')?.split(';')[0]
    if (contentType && !VALID_FORMATS.has(contentType)) return null

    // For SVGs, we can't easily measure dimensions, but they're always scalable
    if (contentType === 'image/svg+xml') {
      return { url, width: 1000, height: 1000 }  // treat as large enough
    }

    // For raster images, check dimensions via sharp
    const buffer = Buffer.from(await res.arrayBuffer())
    const sharp = (await import('sharp')).default
    const meta = await sharp(buffer).metadata()

    if (!meta.width || !meta.height) return null
    if (meta.width < minSize) return null

    return { url, width: meta.width, height: meta.height }
  } catch {
    return null
  }
}

// ─── Owner/email extraction via LLM ────────────────────

const CONTACT_EXTRACT_TOOL = {
  name: 'extract_contact',
  description: 'Extract owner/founder name, their role evidence, and contact email from business website text.',
  input_schema: {
    type: 'object' as const,
    properties: {
      owner_first_name: { type: 'string', description: 'First name of the business owner or founder' },
      owner_last_name: { type: 'string', description: 'Last name of the business owner or founder' },
      owner_role_evidence: { type: 'string', description: 'Verbatim snippet (max 150 chars) from the source text that proves this person is the owner/founder. Must contain a role title like "founder", "owner", "CEO", "medical director", etc. If no such evidence exists, return null.' },
      contact_email: { type: 'string', description: 'Contact email address' },
    },
    required: ['owner_first_name'],
  },
}

interface ContactInfo {
  owner_first_name?: string
  owner_last_name?: string
  owner_role_evidence?: string
  contact_email?: string
}

/**
 * Validate that owner_role_evidence contains a recognized ownership/leadership signal.
 * Uses word-boundary regex (NOT substring includes) to prevent false positives like
 * "downtown" matching "own", "fueled by" matching "led by", "established neighborhood"
 * matching as ownership, etc.
 *
 * Categories covered:
 *   1. Noun titles: founder, owner, CEO, principal, proprietor, medical/clinic director
 *   2. Verb forms: founded, founded by/in, owns, owned by, started, opened, established by, led by, leads
 *   3. Possessives + noun: his/her/my practice|clinic|shop|studio|office
 *   4. Compound titles: owner-operator, owner/dentist, owner/founder
 *   5. Professional credentials: MD, DDS, DMD, NP, RN-BSN
 *
 * Plain "established" or "founders" alone are NOT enough — they need ownership context
 * (e.g., "founded by Dr. X", not "founders neighborhood").
 */
const ROLE_REGEX = new RegExp(
  [
    // Noun titles (singular forms with strict word boundaries)
    '\\b(co-?)?founder\\b',
    '\\b(co-?)?owner(s|-operator|/dentist|/founder|/physician)?\\b',
    '\\bproprietor\\b',
    '\\bprincipal\\b',
    '\\bpresident\\b',
    '\\bceo\\b',
    '\\b(medical|clinical) director\\b',
    '\\bmanaging (partner|director|member)\\b',
    // Explicit "X by Y" forms (always ownership context)
    '\\bfounded by\\b',
    '\\bestablished by\\b',
    '\\bopened by\\b',
    '\\bstarted by\\b',
    '\\bowned by\\b',
    // Year-anchored forms ("founded in 2010")
    '\\b(founded|established|opened|started) in \\d{4}\\b',
    // "led by Dr." or "led by Capital-Name" (not "led by passion")
    '\\bled by (dr\\.?|mr\\.?|mrs\\.?|ms\\.?|[A-Z][a-z]+)',
    // Subject + ownership verb, allowing 0-3 words between (handles "Dr. Smith owns",
    // "Dr Josh founded", "she founded", "he opened")
    '\\b(he|she|dr\\.?|mr\\.?|mrs\\.?|ms\\.?)(\\s+[A-Z][\\w\\.]*){0,3}\\s+(owns|founded|opened|started|leads|established)\\b',
    // Infinitive / coordinating forms: "to own X", "and own X", "to founded X"
    // Captures "opportunity to ... and own Treaty Oak Dental"
    '\\b(to|and) (own|found|open|start) [A-Z]',
    // Plural pronouns owning things
    '\\b(i|we|they) (own|founded|opened|started)\\b',
    // Possessive + business noun ("his practice", "her clinic")
    '\\b(his|her|my)\\s+(practice|clinic|shop|studio|office|business)\\b',
    // Professional credentials (post-nominal)
    '\\b(dds|dmd|md|np|rn-bsn|do|pa-c)\\b',
  ].join('|'),
  'i',
)

export function hasValidOwnerRole(evidence: string | null | undefined): boolean {
  if (!evidence) return false
  return ROLE_REGEX.test(evidence)
}

/**
 * Normalize sentinel values to null. LLMs sometimes return placeholder strings
 * like "<UNKNOWN>" or "N/A" instead of null — these must never leak into
 * prospect data as if they were real names.
 */
const SENTINEL_VALUES = new Set([
  'unknown', '<unknown>', 'n/a', 'na', 'none', 'not found', 'not listed',
  'null', 'undefined', 'not available', 'not provided', 'n/a', '-',
])

export function normalizeField(v: string | null | undefined): string | null {
  if (!v) return null
  const trimmed = v.trim()
  if (!trimmed) return null
  if (SENTINEL_VALUES.has(trimmed.toLowerCase())) return null
  return trimmed
}

// ─── Multi-page crawling ────────────────────────────────

const OWNER_PAGE_PATTERNS = [
  /\/team/i, /\/about-us/i, /\/about$/i, /\/our-team/i, /\/meet-the-team/i,
  /\/providers/i, /\/our-providers/i, /\/staff/i, /\/leadership/i,
  /\/founder/i, /\/owner/i, /\/physician/i, /\/doctor/i, /\/dr-/i,
  /\/meet-/i, /\/story/i, /\/who-we-are/i,
]

const OWNER_LINK_TEXT_PATTERNS = [
  /team/i, /about/i, /provider/i, /staff/i, /meet/i, /founder/i,
  /our (team|story|doctors|providers)/i, /who we are/i, /leadership/i,
]

/** Priority: lower index = fetch first */
function ownerPagePriority(url: string, text: string): number {
  const u = url.toLowerCase()
  const t = text.toLowerCase()
  if (/team|our-team|meet-the-team|providers|our-providers/.test(u) || /team|provider/.test(t)) return 0
  if (/about|about-us|who-we-are|story/.test(u) || /about|story/.test(t)) return 1
  if (/founder|owner|leadership|physician|doctor/.test(u) || /founder|doctor|physician/.test(t)) return 2
  return 3
}

function findOwnerPageLinks(html: string, baseUrl: string): { url: string; priority: number }[] {
  const $ = cheerio.load(html)
  const found = new Map<string, number>()

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text() || ''
    const resolved = resolveUrl(href, baseUrl)

    // Must be same domain
    try {
      const linkHost = new URL(resolved).hostname
      const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '')
      if (!linkHost.replace(/^www\./, '').endsWith(baseHost)) return
    } catch { return }

    const pathMatches = OWNER_PAGE_PATTERNS.some(p => p.test(resolved))
    const textMatches = OWNER_LINK_TEXT_PATTERNS.some(p => p.test(text))

    if (pathMatches || textMatches) {
      const priority = ownerPagePriority(resolved, text)
      const existing = found.get(resolved)
      if (existing === undefined || priority < existing) {
        found.set(resolved, priority)
      }
    }
  })

  return [...found.entries()]
    .map(([url, priority]) => ({ url, priority }))
    .sort((a, b) => a.priority - b.priority)
}

async function fetchPageText(url: string, timeoutMs: number): Promise<{ text: string; size: number } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const html = await res.text()
    const $ = cheerio.load(html)
    // Remove script/style noise
    $('script, style, nav, footer, header').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim()
    return { text, size: html.length }
  } catch {
    return null
  }
}

const MAX_TEXT_BYTES = 30_000
const PER_PROSPECT_TIMEOUT_MS = 15_000

async function extractContact(
  homepageHtml: string,
  baseUrl: string,
  businessName: string,
  llm: LlmClient,
): Promise<{ contact: ContactInfo; pagesCrawled: string[]; roleValid: boolean }> {
  const startTime = Date.now()
  const pagesCrawled: string[] = [baseUrl]

  // Extract homepage body text
  const $home = cheerio.load(homepageHtml)
  $home('script, style, nav, footer').remove()
  let combinedText = $home('body').text().replace(/\s+/g, ' ').trim()

  // Find owner-relevant subpage links
  const ownerLinks = findOwnerPageLinks(homepageHtml, baseUrl)
  const subpagesToFetch = ownerLinks.slice(0, 3) // top 3 by priority

  if (subpagesToFetch.length > 0) {
    console.log(`    [enrich] Found ${ownerLinks.length} owner-page links, fetching top ${subpagesToFetch.length}: ${subpagesToFetch.map(l => new URL(l.url).pathname).join(', ')}`)
  }

  // Fetch subpages (respect per-prospect timeout)
  for (const link of subpagesToFetch) {
    const elapsed = Date.now() - startTime
    const remaining = PER_PROSPECT_TIMEOUT_MS - elapsed
    if (remaining < 2000) {
      console.log(`    [enrich] Timeout approaching (${(elapsed / 1000).toFixed(1)}s), skipping remaining subpages`)
      break
    }

    const result = await fetchPageText(link.url, Math.min(remaining, 8000))
    if (result) {
      pagesCrawled.push(link.url)
      combinedText += '\n\n--- PAGE: ' + new URL(link.url).pathname + ' ---\n\n' + result.text
    }
  }

  // Cap total text at 30KB, truncating the longest parts
  if (combinedText.length > MAX_TEXT_BYTES) {
    combinedText = combinedText.slice(0, MAX_TEXT_BYTES)
  }

  const result = await llm.extract<ContactInfo>({
    system: 'You extract structured contact information from business website text. Return null for any field you cannot find — never return placeholder strings like "unknown", "N/A", or "not found".',
    prompt: `Extract the owner/founder name and contact email for "${businessName}" from this website text (may include multiple pages).

OWNERSHIP SIGNALS to look for include:
- Noun titles: "owner", "founder", "CEO", "principal", "proprietor", "medical director"
- Verb forms: "founded by X", "founded in YEAR by X", "owns", "started by X", "opened by X", "led by X", "established by X"
- Possessives: "his practice", "her clinic", "my studio"
- Doctor titles in single-doctor practices: "Dr. X is the dentist/physician at..."

CRITICAL EXTRACTION RULE: When you find any ownership signal above, extract the person's name from the SAME SENTENCE and return it as owner_first_name + owner_last_name. Do NOT return null for the name if a name is present in the ownership-signal sentence.

For owner_role_evidence, return the EXACT verbatim sentence (max 150 chars) containing the ownership signal — not a paraphrase.

If no ownership signal exists anywhere in the text, return null for all fields.

Do NOT use placeholder strings like "unknown", "N/A", "not found".

${combinedText}`,
    tools: [CONTACT_EXTRACT_TOOL],
    toolChoice: 'extract_contact',
  })

  const firstName = normalizeField(result.input.owner_first_name) ?? undefined
  const lastName = normalizeField(result.input.owner_last_name) ?? undefined
  const roleEvidence = normalizeField(result.input.owner_role_evidence) ?? undefined
  const email = normalizeField(result.input.contact_email) ?? undefined

  // Validate: owner must have role evidence (founder, owner, CEO, etc.)
  // This prevents testimonial names, staff mentions, etc. from leaking through
  const roleValid = hasValidOwnerRole(roleEvidence)

  return {
    contact: {
      owner_first_name: roleValid ? firstName : undefined,
      owner_last_name: roleValid ? lastName : undefined,
      owner_role_evidence: roleEvidence,
      contact_email: email,
    },
    pagesCrawled,
    roleValid,
  }
}

// ─── Main enrichment ────────────────────────────────────

export interface EnrichOptions {
  llm: LlmClient
  qualifyConfig: QualifyConfig
}

export async function enrichListing(
  listing: RawListing,
  opts: EnrichOptions,
): Promise<EnrichedProspect | null> {
  const { llm, qualifyConfig } = opts

  if (!listing.website) {
    console.log(`    [enrich] Skip — no website`)
    return null
  }

  // Fetch homepage HTML
  console.log(`    [enrich] Fetching ${listing.website} ...`)
  let html: string
  try {
    const res = await fetch(listing.website, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      console.log(`    [enrich] Skip — website returned ${res.status}`)
      return null
    }
    html = await res.text()
    console.log(`    [enrich] HTML received: ${(html.length / 1024).toFixed(0)}KB`)
  } catch (err) {
    console.log(`    [enrich] Skip — website fetch failed: ${(err as Error).message?.slice(0, 80)}`)
    return null
  }

  // Find logo
  const logoCandidates = extractLogoCandidates(html, listing.website)
  let logo: { url: string; width: number; height: number } | null = null

  for (const candidate of logoCandidates) {
    logo = await validateLogo(candidate.url, qualifyConfig.minLogoSize)
    if (logo) break
  }

  if (!logo) {
    console.log(`    [enrich] Skip — no valid logo found (${logoCandidates.length} candidates checked, min ${qualifyConfig.minLogoSize}px)`)
    return null
  }
  console.log(`    [enrich] Logo found: ${logo.url.slice(0, 80)}... (${logo.width}x${logo.height})`)

  // Extract owner + email via LLM (multi-page crawl)
  console.log(`    [enrich] Crawling for owner/email (homepage + subpages)...`)
  const { contact, pagesCrawled, roleValid } = await extractContact(html, listing.website, listing.business_name, llm)
  console.log(`    [enrich] Crawled ${pagesCrawled.length} pages: ${pagesCrawled.map(u => { try { return new URL(u).pathname } catch { return u } }).join(', ')}`)
  console.log(`    [enrich] Haiku result: owner=${contact.owner_first_name || '(null)'} ${contact.owner_last_name || ''}, email=${contact.contact_email || '(null)'}`)
  const roleStatus = roleValid ? 'VALID' : 'REJECTED'
  console.log(`    [enrich] Role evidence: "${contact.owner_role_evidence || '(none)'}" → ${roleStatus}`)

  if (qualifyConfig.requireOwnerName && !contact.owner_first_name) {
    console.log(`    [enrich] Skip — owner name required but not found (role gate ${roleValid ? 'passed' : 'failed'})`)
    return null
  }

  // Parse owner_name from raw listing if available and LLM didn't find one
  let ownerFirst = contact.owner_first_name
  let ownerLast = contact.owner_last_name
  if (!ownerFirst && listing.owner_name) {
    const parts = listing.owner_name.trim().split(/\s+/)
    ownerFirst = parts[0]
    ownerLast = parts.slice(1).join(' ') || undefined
  }

  return {
    business_name: listing.business_name,
    owner_first_name: ownerFirst,
    owner_last_name: ownerLast,
    owner_role_evidence: contact.owner_role_evidence,
    email: contact.contact_email,
    phone: listing.phone,
    website: listing.website,
    city: listing.city,
    state: listing.state,
    county: listing.county,
    logo_url: logo.url,
    logo_width: logo.width,
    logo_height: logo.height,
    source_slug: listing.source_slug,
    source_id: listing.source_id,
  }
}

/**
 * Fixture-mode enrichment — skips HTTP and LLM calls entirely.
 * Uses data from the RawListing directly.
 */
export function enrichFromFixture(listing: RawListing): EnrichedProspect {
  const parts = (listing.owner_name || '').trim().split(/\s+/)
  return {
    business_name: listing.business_name,
    owner_first_name: parts[0] || undefined,
    owner_last_name: parts.slice(1).join(' ') || undefined,
    email: undefined,  // fixture mode: no synthesized emails
    phone: listing.phone,
    website: listing.website,
    city: listing.city,
    state: listing.state,
    county: listing.county,
    logo_url: undefined,  // fixture mode uses sample-logo-light.png
    logo_width: 800,
    logo_height: 200,
    source_slug: listing.source_slug,
    source_id: listing.source_id,
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
