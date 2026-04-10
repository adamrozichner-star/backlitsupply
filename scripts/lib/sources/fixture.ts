/**
 * Fixture source — returns canned RawListings for offline testing.
 * Used by test suite and --source=fixture flag.
 */

import type { RawListing } from '../types'
import type { GeoConfig } from '../../../niches/types'
import { registerSource, type BusinessSource } from './index'

const FIXTURE_LISTINGS: RawListing[] = [
  {
    business_name: 'Glow MedSpa',
    owner_name: 'Jessica Chen',
    city: 'Austin',
    state: 'TX',
    county: 'Travis',
    website: 'https://glowmedspa.example.com',
    source_slug: 'fixture',
    source_id: 'FIX-001',
  },
  {
    business_name: 'Radiance Aesthetics & Wellness',
    owner_name: 'Sarah Mitchell',
    city: 'Austin',
    state: 'TX',
    county: 'Travis',
    website: 'https://radianceaesthetics.example.com',
    source_slug: 'fixture',
    source_id: 'FIX-002',
  },
  {
    business_name: 'Luxe Skin Studio',
    owner_name: 'Maria Rodriguez',
    city: 'Austin',
    state: 'TX',
    county: 'Travis',
    website: 'https://luxeskinstudio.example.com',
    source_slug: 'fixture',
    source_id: 'FIX-003',
  },
  {
    business_name: 'Central Texas Laser & Aesthetics',
    owner_name: 'James Park',
    city: 'Austin',
    state: 'TX',
    county: 'Travis',
    website: 'https://centraltexaslaser.example.com',
    source_slug: 'fixture',
    source_id: 'FIX-004',
  },
  {
    business_name: 'Drip IV Bar & Med Spa',
    owner_name: 'Amanda Chen',
    city: 'Austin',
    state: 'TX',
    county: 'Travis',
    website: 'https://dripivbar.example.com',
    source_slug: 'fixture',
    source_id: 'FIX-005',
  },
  {
    business_name: 'Elm Street Grill',
    owner_name: 'David Thompson',
    city: 'Austin',
    state: 'TX',
    county: 'Travis',
    website: 'https://elmstreetgrill.example.com',
    source_slug: 'fixture',
    source_id: 'FIX-006',
  },
  {
    business_name: 'La Cocina de Familia',
    owner_name: 'Rosa Martinez',
    city: 'Austin',
    state: 'TX',
    county: 'Travis',
    website: 'https://lacocina.example.com',
    source_slug: 'fixture',
    source_id: 'FIX-007',
  },
  {
    business_name: 'North & Pine Eatery',
    owner_name: 'Tom Bradley',
    city: 'Austin',
    state: 'TX',
    county: 'Travis',
    website: 'https://northandpine.example.com',
    source_slug: 'fixture',
    source_id: 'FIX-008',
  },
]

const fixtureSource: BusinessSource = {
  slug: 'fixture',

  async fetchNew(geo: GeoConfig, nameRegex?: RegExp): Promise<RawListing[]> {
    return FIXTURE_LISTINGS.filter(listing => {
      // Filter by geo if specified
      if (geo.city && listing.city?.toLowerCase() !== geo.city.toLowerCase()) return false
      if (nameRegex && !nameRegex.test(listing.business_name)) return false
      return true
    })
  },
}

registerSource(fixtureSource)

export default fixtureSource
