/**
 * Google Places API (New) — primary generic discovery source.
 *
 * Endpoint: POST https://places.googleapis.com/v1/places:searchText
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * $200/month free credit from Google Cloud. Works for any niche, any geo.
 * Email is not returned — that's enrich.ts's job.
 * Env var: GOOGLE_PLACES_API_KEY
 */

import type { RawListing } from '../types'
import type { GeoConfig } from '../../../niches/types'
import { registerSource, type BusinessSource } from './index'

interface PlaceResult {
  displayName?: { text: string }
  formattedAddress?: string
  websiteUri?: string
  nationalPhoneNumber?: string
  rating?: number
  userRatingCount?: number
  location?: { latitude: number; longitude: number }
  id?: string
}

const googlePlaces: BusinessSource = {
  slug: 'google-places',

  async fetchNew(geo: GeoConfig, nameRegex?: RegExp): Promise<RawListing[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      throw new Error('[google-places] Missing GOOGLE_PLACES_API_KEY — set it in .env.local')
    }

    const nicheQuery = process.env.PIPELINE_NICHE_QUERY || 'med spa'
    const location = [geo.city, geo.state, geo.country || 'US'].filter(Boolean).join(', ')

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.location,places.id',
      },
      body: JSON.stringify({
        textQuery: `${nicheQuery} in ${location}`,
        maxResultCount: 20,
        languageCode: 'en',
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      throw new Error(`[google-places] API error ${res.status}: ${await res.text().catch(() => '')}`)
    }

    const json = await res.json()
    const places: PlaceResult[] = json.places || []

    return places
      .filter(p => p.displayName?.text)
      .filter(p => !nameRegex || nameRegex.test(p.displayName!.text))
      .map(p => ({
        business_name: p.displayName!.text,
        address: p.formattedAddress,
        city: geo.city,
        state: geo.state,
        website: p.websiteUri,
        phone: p.nationalPhoneNumber,
        rating: p.rating,
        review_count: p.userRatingCount,
        latitude: p.location?.latitude,
        longitude: p.location?.longitude,
        source_slug: 'google-places',
        source_id: p.id,
        raw_data: p as unknown as Record<string, unknown>,
      }))
  },
}

registerSource(googlePlaces)

export default googlePlaces
