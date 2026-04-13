/**
 * Texas Comptroller Franchise Tax Account Status Search
 *
 * Endpoint: GET https://comptroller.texas.gov/data-search/franchise-tax?name={query}
 * Response: { success: boolean, data: Array<{ name, taxpayerId, mailingAddressZip }>, count: number }
 *
 * Limitations:
 * - Name search only (no city/county filter server-side)
 * - Returns max ~100 results per query
 * - Only provides name, taxpayer ID, and zip code
 * - We filter by zip code ranges to approximate geo filtering
 *
 * Austin-area zip codes (Travis County): 78701–78799, 78613, 78620, 78641, 78652, 78653, 78660, 78664, 78681
 */

import type { RawListing } from '../types'
import type { GeoConfig } from '../../../niches/types'
import { registerSource, type BusinessSource } from './index'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Travis County / Austin area zip prefixes
const AUSTIN_ZIPS = new Set([
  '78701', '78702', '78703', '78704', '78705', '78712', '78717', '78719',
  '78721', '78722', '78723', '78724', '78725', '78726', '78727', '78728',
  '78729', '78730', '78731', '78732', '78733', '78734', '78735', '78736',
  '78737', '78738', '78739', '78741', '78742', '78744', '78745', '78746',
  '78747', '78748', '78749', '78750', '78751', '78752', '78753', '78754',
  '78756', '78757', '78758', '78759',
  // Adjacent cities often considered Austin metro
  '78613', '78620', '78641', '78652', '78653', '78660', '78664', '78681',
])

// Zip prefix map for other geos (extend as needed)
const GEO_ZIPS: Record<string, Set<string>> = {
  'Austin-TX': AUSTIN_ZIPS,
}

function getZipsForGeo(geo: GeoConfig): Set<string> | null {
  const key = `${geo.city}-${geo.state}`
  return GEO_ZIPS[key] || null
}

export interface ComptrollerEntity {
  name: string
  taxpayerId: string
  mailingAddressZip: string
}

export interface ComptrollerResponse {
  success: boolean
  data: ComptrollerEntity[]
  count: number
}

/**
 * Detect administrative shell entities that exist on paper but aren't real
 * customer-facing businesses. Comptroller returns name+taxpayerId+zip only —
 * no website or phone — so we can't gate on contact info. The cleanest
 * available signal is the entity name itself: pure-corporate-suffix names
 * ("Medspa Logic LLC", "Aesthetics By Tess LLC") are paperwork holdings,
 * not storefronts.
 *
 * Heuristic: drop if name ends in a corporate suffix AND has no descriptive
 * brand word (no spa/clinic/aesthetics/dental/etc.) before the suffix.
 * In practice the simplest version — drop anything ending in a bare suffix
 * after stripping common business descriptors — catches all the offenders
 * tonight without killing real "Glow MedSpa LLC" style names.
 *
 * Approach: consider the name without the trailing suffix. If what remains
 * looks like a generic word combo with no proper noun (e.g. "Aesthetics By
 * Tess", "Medspa Logic", "Medspa Resources"), drop it. We approximate this
 * as: drop if name ends in a corporate suffix, since real businesses
 * (Glow MedSpa, Beaux MedSpa, Drip IV Bar) typically don't include the
 * suffix in their public-facing name. The few legitimate hits with " LLC"
 * (e.g. "Aesthetica Med Spa, LLC") will be re-discovered via Google Places
 * with the cleaner name and merged.
 */
const SHELL_SUFFIX_REGEX = /\b(LLC|L\.L\.C\.|Inc\.?|PLLC|P\.L\.L\.C\.|LP|L\.P\.|Corp\.?|Limited Liability Company|Limited Partnership)\.?$/i

export function isAdministrativeShell(name: string): boolean {
  return SHELL_SUFFIX_REGEX.test(name.trim())
}

function parseResponse(json: ComptrollerResponse, geo: GeoConfig, nameRegex?: RegExp): RawListing[] {
  if (!json.success || !json.data) return []

  const validZips = getZipsForGeo(geo)

  return json.data
    .filter(entity => {
      // Drop administrative shells (LLC/Inc/PLLC names with no website signal).
      // Comptroller returns no contact info, so name pattern is the only filter we have.
      if (isAdministrativeShell(entity.name)) return false

      // Filter by zip if we have a zip set for this geo
      if (validZips) {
        const zip5 = entity.mailingAddressZip?.slice(0, 5)
        if (!zip5 || !validZips.has(zip5)) return false
      }
      // Filter by name regex if provided
      if (nameRegex && !nameRegex.test(entity.name)) return false
      return true
    })
    .map(entity => ({
      business_name: titleCase(entity.name),
      city: geo.city,
      state: geo.state,
      county: geo.county,
      source_slug: 'comptroller-tx',
      source_id: entity.taxpayerId,
      raw_data: entity as unknown as Record<string, unknown>,
    }))
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bLlc\b/g, 'LLC')
    .replace(/\bPllc\b/g, 'PLLC')
    .replace(/\bInc\b/g, 'Inc.')
}

const comptrollerTx: BusinessSource = {
  slug: 'comptroller-tx',

  async fetchNew(geo: GeoConfig, nameRegex?: RegExp): Promise<RawListing[]> {
    // TX-only source — skip for non-Texas geos
    if (geo.state !== 'TX' && geo.state !== 'Texas') {
      console.log(`    [comptroller-tx] Skipping — only available for Texas (got ${geo.state})`)
      return []
    }

    // Check for fixture mode
    if (process.env.PIPELINE_SOURCE === 'fixture') {
      const fixturePath = resolve(__dirname, '../../fixtures/comptroller-response.json')
      const raw = readFileSync(fixturePath, 'utf-8')
      return parseResponse(JSON.parse(raw), geo, nameRegex)
    }

    // Live API call
    const searchTerms = ['med spa', 'medspa', 'aesthetics', 'wellness spa']
    const allListings: RawListing[] = []
    const seen = new Set<string>()

    for (const term of searchTerms) {
      const url = `https://comptroller.texas.gov/data-search/franchise-tax?name=${encodeURIComponent(term)}`
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`[comptroller-tx] Search failed for "${term}": ${res.status}`)
        continue
      }
      const json: ComptrollerResponse = await res.json()
      const listings = parseResponse(json, geo, nameRegex)

      for (const listing of listings) {
        const key = listing.source_id || listing.business_name
        if (!seen.has(key)) {
          seen.add(key)
          allListings.push(listing)
        }
      }
    }

    return allListings
  },
}

registerSource(comptrollerTx)

export default comptrollerTx
