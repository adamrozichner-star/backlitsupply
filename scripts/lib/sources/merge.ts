/**
 * Multi-source merge + dedup.
 *
 * When a niche lists multiple sources, fetch from each, deduplicate by
 * normalized business name + domain, merge fields (prefer populated over empty).
 */

import type { RawListing } from '../types'

/**
 * Normalize a business name for dedup: lowercase, strip LLC/Inc, collapse whitespace.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc\.?|pllc|corp\.?|co\.?|ltd\.?)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract domain from a URL for dedup matching.
 */
function extractDomain(url?: string): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * Merge two listings: prefer populated fields from the richer record.
 */
function mergeListings(a: RawListing, b: RawListing): RawListing {
  return {
    business_name: a.business_name || b.business_name,
    owner_name: a.owner_name || b.owner_name,
    address: a.address || b.address,
    city: a.city || b.city,
    state: a.state || b.state,
    county: a.county || b.county,
    website: a.website || b.website,
    phone: a.phone || b.phone,
    email: a.email || b.email,
    filing_date: a.filing_date || b.filing_date,
    rating: a.rating ?? b.rating,
    review_count: a.review_count ?? b.review_count,
    latitude: a.latitude ?? b.latitude,
    longitude: a.longitude ?? b.longitude,
    source_slug: a.source_slug,  // keep first source as primary
    source_id: a.source_id || b.source_id,
    raw_data: { ...b.raw_data, ...a.raw_data },  // first source's data wins on conflicts
  }
}

/**
 * Deduplicate and merge listings from multiple sources.
 * Match by: normalized name, or by domain if both have websites.
 */
export function mergeListings_multi(allListings: RawListing[]): RawListing[] {
  const byName = new Map<string, RawListing>()
  const byDomain = new Map<string, string>()  // domain → normalized name

  for (const listing of allListings) {
    const normName = normalizeName(listing.business_name)
    const domain = extractDomain(listing.website)

    // Check if we've seen this domain before (strong dedup signal)
    let matchKey = normName
    if (domain && byDomain.has(domain)) {
      matchKey = byDomain.get(domain)!
    }

    if (byName.has(matchKey)) {
      // Merge into existing
      byName.set(matchKey, mergeListings(byName.get(matchKey)!, listing))
    } else {
      byName.set(matchKey, listing)
    }

    // Track domain → name mapping
    if (domain) {
      byDomain.set(domain, matchKey)
    }
  }

  return [...byName.values()]
}
