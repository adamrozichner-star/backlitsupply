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
  description: 'Extract owner name and contact email from business website text.',
  input_schema: {
    type: 'object' as const,
    properties: {
      owner_first_name: { type: 'string', description: 'First name of the business owner or founder' },
      owner_last_name: { type: 'string', description: 'Last name of the business owner or founder' },
      contact_email: { type: 'string', description: 'Contact email address' },
    },
    required: ['owner_first_name'],
  },
}

interface ContactInfo {
  owner_first_name?: string
  owner_last_name?: string
  contact_email?: string
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

async function extractContact(
  html: string,
  businessName: string,
  llm: LlmClient,
): Promise<ContactInfo> {
  const $ = cheerio.load(html)

  // Extract text from relevant sections
  const aboutText = $('*:contains("about")').closest('section, div, main').first().text()
  const contactText = $('*:contains("contact")').closest('section, div, main').first().text()
  const bodyText = $('body').text()

  // Truncate to avoid token overflow
  const text = [aboutText, contactText, bodyText.slice(0, 2000)]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000)

  const result = await llm.extract<ContactInfo>({
    system: 'You extract structured contact information from business website text. Return null for any field you cannot find — never return placeholder strings like "unknown", "N/A", or "not found".',
    prompt: `Extract the owner/founder name and contact email for "${businessName}" from this website text. If a field is not present, return null — do NOT guess or use placeholders.\n\n${text}`,
    tools: [CONTACT_EXTRACT_TOOL],
    toolChoice: 'extract_contact',
  })

  // Normalize sentinel values — convert to undefined for interface compat
  return {
    owner_first_name: normalizeField(result.input.owner_first_name) ?? undefined,
    owner_last_name: normalizeField(result.input.owner_last_name) ?? undefined,
    contact_email: normalizeField(result.input.contact_email) ?? undefined,
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

  // Extract owner + email via LLM
  console.log(`    [enrich] Calling Haiku for owner/email extraction...`)
  const contact = await extractContact(html, listing.business_name, llm)
  console.log(`    [enrich] Haiku result: owner=${contact.owner_first_name || '(null)'} ${contact.owner_last_name || ''}, email=${contact.contact_email || '(null)'}`)

  if (qualifyConfig.requireOwnerName && !contact.owner_first_name) {
    console.log(`    [enrich] Skip — owner name required but not found`)
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
    email: `contact@${slugify(listing.business_name)}.example.com`,
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
