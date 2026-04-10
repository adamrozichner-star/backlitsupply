/**
 * Travis County Clerk — Assumed Name (DBA) Records
 *
 * Source: Travis County Clerk public records
 * Note: The clerk's website was unreachable during initial development (2026-04-10).
 * This source uses a JSON fixture modeled on the known DBA filing format.
 * When the site becomes accessible, replace fetchLive() with actual HTTP calls.
 *
 * DBA records contain: filing number, assumed name, owner name, address, filing date, status.
 * Much richer than Comptroller data — gives us owner name and full address directly.
 */

import type { RawListing } from '../types'
import type { GeoConfig } from '../../../niches/types'
import { registerSource, type BusinessSource } from './index'
import { readFileSync } from 'fs'
import { resolve } from 'path'

interface DbaRecord {
  filing_number: string
  assumed_name: string
  owner_name: string
  address: string
  filing_date: string
  expiration_date: string
  status: string
}

interface DbaFixture {
  records: DbaRecord[]
}

function parseRecords(records: DbaRecord[], geo: GeoConfig, nameRegex?: RegExp): RawListing[] {
  return records
    .filter(r => {
      if (r.status !== 'Active') return false
      if (nameRegex && !nameRegex.test(r.assumed_name)) return false
      return true
    })
    .map(r => ({
      business_name: r.assumed_name,
      owner_name: r.owner_name,
      address: r.address,
      city: geo.city,
      state: geo.state,
      county: geo.county,
      filing_date: r.filing_date,
      source_slug: 'travis-dba',
      source_id: r.filing_number,
      raw_data: r as unknown as Record<string, unknown>,
    }))
}

const travisDba: BusinessSource = {
  slug: 'travis-dba',

  async fetchNew(geo: GeoConfig, nameRegex?: RegExp): Promise<RawListing[]> {
    // Always fixture for now — replace with live fetch when site is accessible
    const fixturePath = resolve(__dirname, '../../fixtures/travis-dba-response.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const fixture: DbaFixture = JSON.parse(raw)
    return parseRecords(fixture.records, geo, nameRegex)
  },
}

registerSource(travisDba)

export default travisDba
