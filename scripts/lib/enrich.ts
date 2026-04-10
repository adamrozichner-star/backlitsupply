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
    system: 'You extract structured contact information from business website text.',
    prompt: `Extract the owner/founder name and contact email for "${businessName}" from this website text:\n\n${text}`,
    tools: [CONTACT_EXTRACT_TOOL],
    toolChoice: 'extract_contact',
  })

  return result.input
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
    console.log(`  [enrich] Skip ${listing.business_name} — no website`)
    return null
  }

  // Fetch homepage HTML
  let html: string
  try {
    const res = await fetch(listing.website, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      console.log(`  [enrich] Skip ${listing.business_name} — website returned ${res.status}`)
      return null
    }
    html = await res.text()
  } catch (err) {
    console.log(`  [enrich] Skip ${listing.business_name} — website fetch failed: ${err}`)
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
    console.log(`  [enrich] Skip ${listing.business_name} — no valid logo found`)
    return null
  }

  // Extract owner + email via LLM
  const contact = await extractContact(html, listing.business_name, llm)

  if (qualifyConfig.requireOwnerName && !contact.owner_first_name) {
    console.log(`  [enrich] Skip ${listing.business_name} — no owner name found`)
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
