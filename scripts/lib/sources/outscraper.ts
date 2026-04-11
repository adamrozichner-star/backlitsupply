/**
 * Outscraper — primary generic discovery source.
 *
 * Endpoint: GET https://api.app.outscraper.com/maps/search-v3
 * Docs: https://app.outscraper.com/api-docs#tag/Google-Maps/paths/~1maps~1search-v3/get
 *
 * Works for any niche in any geo. Query = niche keyword, location = "city, state, country".
 * Returns: name, website, phone, address, lat/lng, rating, reviews count, emails.
 *
 * Env var: OUTSCRAPER_API_KEY
 * Rate limit: 429 → exponential backoff, max 3 retries.
 */

import type { RawListing } from '../types'
import type { GeoConfig } from '../../../niches/types'
import { registerSource, type BusinessSource } from './index'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export interface OutscraperResult {
  name: string
  site?: string
  phone?: string
  full_address?: string
  city?: string
  state?: string
  country?: string
  latitude?: number
  longitude?: number
  rating?: number
  reviews?: number
  emails_and_contacts?: { emails?: string[] }
  place_id?: string
  [key: string]: unknown
}

function parseResults(results: OutscraperResult[], geo: GeoConfig): RawListing[] {
  return results
    .filter(r => r.name && r.name.trim().length > 0)
    .map(r => ({
      business_name: r.name.trim(),
      address: r.full_address,
      city: r.city || geo.city,
      state: r.state || geo.state,
      website: r.site || undefined,
      phone: r.phone || undefined,
      email: r.emails_and_contacts?.emails?.[0] || undefined,
      rating: r.rating,
      review_count: r.reviews,
      latitude: r.latitude,
      longitude: r.longitude,
      source_slug: 'outscraper',
      source_id: r.place_id,
      raw_data: r as unknown as Record<string, unknown>,
    }))
}

async function fetchWithRetry(url: string, headers: Record<string, string>, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })

    if (res.ok) return res

    if (res.status === 429 && attempt < maxRetries) {
      const waitMs = Math.pow(2, attempt + 1) * 1000  // 2s, 4s, 8s
      console.log(`    [outscraper] Rate limited, waiting ${waitMs / 1000}s (attempt ${attempt + 1}/${maxRetries})...`)
      await new Promise(r => setTimeout(r, waitMs))
      continue
    }

    throw new Error(`[outscraper] API error ${res.status}: ${await res.text().catch(() => 'no body')}`)
  }
  throw new Error('[outscraper] Max retries exceeded')
}

const outscraper: BusinessSource = {
  slug: 'outscraper',

  async fetchNew(geo: GeoConfig, nameRegex?: RegExp): Promise<RawListing[]> {
    // Fixture mode
    if (process.env.PIPELINE_SOURCE === 'fixture') {
      const fixturePath = resolve(__dirname, '../../fixtures/outscraper-sample.json')
      const raw = readFileSync(fixturePath, 'utf-8')
      const data = JSON.parse(raw) as OutscraperResult[]
      return parseResults(data, geo).filter(l => !nameRegex || nameRegex.test(l.business_name))
    }

    // Live API call
    const apiKey = process.env.OUTSCRAPER_API_KEY
    if (!apiKey) {
      throw new Error('[outscraper] Missing OUTSCRAPER_API_KEY — set it in .env.local to use Outscraper source')
    }

    // Build query from niche keywords — caller provides these via geo config
    // The pipeline passes the niche display name as the search query
    const nicheQuery = process.env.PIPELINE_NICHE_QUERY || 'med spa'
    const location = [geo.city, geo.state, geo.country || 'US'].filter(Boolean).join(', ')
    const limit = 20

    const params = new URLSearchParams({
      query: `${nicheQuery} in ${location}`,
      limit: String(limit),
      language: 'en',
      region: 'us',
    })

    const url = `https://api.app.outscraper.com/maps/search-v3?${params}`
    const res = await fetchWithRetry(url, { 'X-API-KEY': apiKey })
    const json = await res.json()

    // Outscraper v3 returns { id, status, data: [[...results]] }
    const resultArrays = json.data as OutscraperResult[][] | undefined
    if (!resultArrays || resultArrays.length === 0) return []

    const results = resultArrays[0] || []
    return parseResults(results, geo).filter(l => !nameRegex || nameRegex.test(l.business_name))
  },
}

registerSource(outscraper)

export default outscraper
