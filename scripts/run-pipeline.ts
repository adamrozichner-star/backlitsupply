/**
 * Stage 11 — Pipeline orchestrator
 *
 * Runs the full lead generation pipeline for ONE niche.
 * Idempotent on slug, resumable from any state.
 *
 * Usage:
 *   npx tsx scripts/run-pipeline.ts --niche=med-spa --geo=austin --source=fixture --limit=5
 *   npx tsx scripts/run-pipeline.ts --niche=med-spa --dry-run
 *   npm run pipeline -- --niche=med-spa --source=fixture
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getNiche } from '../niches'
import { getSource } from './lib/sources'
import './lib/sources/comptroller-tx'
import './lib/sources/travis-dba'
import './lib/sources/fixture'
import { enrichFromFixture, enrichListing } from './lib/enrich'
import { qualifyProspect } from './lib/qualify'
import { compositeMockup, TEMPLATES } from './lib/composite'
import { createStorage } from './lib/storage'
import { generateOutreachFixture, generateOutreach } from './lib/outreach'
import { createLlmClient, FixtureLlmClient } from './lib/llm'
import { makeSlug } from './lib/slug'
import { getSupabaseServer } from '../src/lib/supabase/server'
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs'
import type { EnrichedProspect } from './lib/types'

// ─── Parse CLI args ─────────────────────────────────────

function parseArgs() {
  const args: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(\w[\w-]*)=(.+)$/)
    if (match) args[match[1]] = match[2]
    else if (arg.startsWith('--')) args[arg.slice(2)] = 'true'
  }
  return args
}

const args = parseArgs()
const nicheName = args.niche
const sourceOverride = args.source  // 'fixture' to use fixture source
const dryRun = args['dry-run'] === 'true'
const limit = args.limit ? parseInt(args.limit, 10) : Infinity
const geoFilter = args.geo?.toLowerCase()

if (!nicheName) {
  console.error('Usage: npx tsx scripts/run-pipeline.ts --niche=med-spa [--source=fixture] [--limit=5] [--dry-run] [--geo=austin]')
  process.exit(1)
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  const startTime = Date.now()
  const nicheConfig = getNiche(nicheName)
  console.log(`\n═══ Pipeline: ${nicheConfig.displayName} ═══`)
  console.log(`  Source: ${sourceOverride || nicheConfig.sources.join(', ')}`)
  console.log(`  Dry run: ${dryRun}`)
  console.log(`  Limit: ${limit === Infinity ? 'none' : limit}`)

  const isFixture = sourceOverride === 'fixture'
  const useFixtureLlm = isFixture || !process.env.ANTHROPIC_API_KEY

  // Set env for source fixture mode
  if (isFixture) process.env.PIPELINE_SOURCE = 'fixture'

  const llm = useFixtureLlm
    ? new FixtureLlmClient({
        extract_contact: {
          name: 'extract_contact',
          input: { owner_first_name: 'Test', owner_last_name: 'Owner', contact_email: 'test@example.com' },
        },
        draft_outreach: {
          name: 'draft_outreach',
          input: { subject: 'Quick mockup for you', body: 'Fixture outreach body' },
        },
      })
    : createLlmClient()

  const storage = createStorage()
  const supabase = getSupabaseServer()

  // Prepare output directories
  const outputDir = resolve(__dirname, 'output')
  const mockupDir = resolve(outputDir, 'test-mockups')
  if (!existsSync(mockupDir)) mkdirSync(mockupDir, { recursive: true })

  // CSV output
  const dateStr = new Date().toISOString().slice(0, 10)
  const csvPath = resolve(outputDir, `outreach-${nicheName}-${dateStr}.csv`)
  if (!existsSync(csvPath)) {
    writeFileSync(csvPath, 'slug,business_name,owner,email,subject,personalized_url\n')
  }

  const geos = geoFilter
    ? nicheConfig.geos.filter(g => g.city.toLowerCase() === geoFilter)
    : nicheConfig.geos

  if (geos.length === 0) {
    console.error(`No geos match filter "${geoFilter}". Available: ${nicheConfig.geos.map(g => g.city).join(', ')}`)
    process.exit(1)
  }

  let successCount = 0
  const stats = { discovered: 0, enriched: 0, qualified: 0, mockups: 0, outreach: 0, skipped_existing: 0 }

  for (const geo of geos) {
    console.log(`\n── Geo: ${geo.city}, ${geo.state} ──`)

    // Stage 2: Discovery
    const sourceSlugs = isFixture ? ['fixture'] : nicheConfig.sources
    const allListings = []

    for (const srcSlug of sourceSlugs) {
      const source = getSource(srcSlug)
      console.log(`  [discover] Fetching from ${srcSlug}...`)
      const listings = await source.fetchNew(geo)
      console.log(`  [discover] Found ${listings.length} listings from ${srcSlug}`)
      allListings.push(...listings)
    }

    stats.discovered += allListings.length

    for (const listing of allListings) {
      if (successCount >= limit) break

      const slug = makeSlug(listing.business_name, listing.city)
      console.log(`\n  ▸ ${listing.business_name} (${slug})`)

      // Idempotency check: skip if slug already exists in Supabase
      if (supabase) {
        const { data: existing } = await supabase
          .from('prospects')
          .select('id, status')
          .eq('slug', slug)
          .single()

        if (existing) {
          console.log(`    [skip] Already in DB (status: ${existing.status})`)
          stats.skipped_existing++
          continue
        }
      }

      // Stage 3: Enrichment
      let enriched: EnrichedProspect | null
      if (isFixture) {
        enriched = enrichFromFixture(listing)
      } else {
        enriched = await enrichListing(listing, { llm, qualifyConfig: nicheConfig.qualify })
      }

      if (!enriched) {
        console.log('    [skip] Enrichment failed')
        continue
      }
      stats.enriched++

      // Stage 4: Qualify
      const qual = qualifyProspect(enriched, nicheConfig.qualify)
      console.log(`    [qualify] Score: ${qual.score} (threshold: ${nicheConfig.qualify.scoreThreshold}) → ${qual.passed ? 'PASS' : 'FAIL'}`)

      if (!qual.passed && !isFixture) {
        console.log('    [skip] Below threshold')
        continue
      }
      stats.qualified++

      // Stage 5: Composite mockup
      const logoPath = isFixture
        ? resolve(__dirname, 'fixtures/sample-logo-light.png')
        : enriched.logo_url!

      // For live mode, we'd need to download the logo first
      // For fixture mode, we use the local file directly
      const templateId = nicheConfig.templates[successCount % nicheConfig.templates.length]
      const mockupOutputPath = resolve(mockupDir, `${slug}.webp`)

      if (!dryRun) {
        try {
          const mockup = await compositeMockup({
            logoPath,
            templateId,
            outputPath: mockupOutputPath,
            slug,
          })
          console.log(`    [mockup] ${mockup.template_id} → ${mockup.mockup_path}`)
          stats.mockups++
        } catch (err) {
          console.error(`    [mockup] Failed:`, err)
          continue
        }

        // Stage 6: Upload to storage
        const mockupUrl = await storage.upload(slug, mockupOutputPath)
        console.log(`    [storage] ${mockupUrl}`)

        // Stage 7: Generate outreach
        const email = enriched.email || `contact@${slug}.example.com`
        const draft = isFixture
          ? generateOutreachFixture({
              slug,
              business_name: enriched.business_name,
              owner_first_name: enriched.owner_first_name,
              email,
            })
          : await generateOutreach({
              llm,
              copyAngle: nicheConfig.copyAngle,
              prospect: {
                slug,
                business_name: enriched.business_name,
                owner_first_name: enriched.owner_first_name,
                email,
                city: enriched.city,
              },
            })

        console.log(`    [outreach] Subject: "${draft.subject}"`)
        stats.outreach++

        // Write to CSV
        const csvLine = [slug, enriched.business_name, enriched.owner_first_name || '', email, draft.subject, draft.personalized_url]
          .map(v => `"${(v || '').replace(/"/g, '""')}"`)
          .join(',')
        appendFileSync(csvPath, csvLine + '\n')

        // Insert into Supabase if available
        if (supabase) {
          const { error } = await supabase.from('prospects').insert({
            slug,
            business_name: enriched.business_name,
            owner_first_name: enriched.owner_first_name,
            owner_last_name: enriched.owner_last_name,
            email,
            phone: enriched.phone,
            website: enriched.website,
            city: enriched.city,
            state: enriched.state,
            niche: nicheName,
            logo_url: enriched.logo_url,
            mockup_url: mockupUrl,
            suggested_dimensions: nicheConfig.priceRange[0] <= 600 ? '24" wide' : '28" wide',
            suggested_price_usd: nicheConfig.priceRange[0],
            source: enriched.source_slug,
            status: 'mockup_ready',
          })

          if (error) {
            console.error(`    [db] Insert failed: ${error.message}`)
          } else {
            console.log('    [db] Prospect saved')
          }
        }
      } else {
        console.log('    [dry-run] Would generate mockup + outreach')
      }

      successCount++
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n═══ Done ═══`)
  console.log(`  Time: ${elapsed}s`)
  console.log(`  Discovered: ${stats.discovered}`)
  console.log(`  Enriched: ${stats.enriched}`)
  console.log(`  Qualified: ${stats.qualified}`)
  console.log(`  Mockups: ${stats.mockups}`)
  console.log(`  Outreach: ${stats.outreach}`)
  console.log(`  Skipped (existing): ${stats.skipped_existing}`)
  console.log(`  CSV: ${csvPath}`)
}

main().catch(err => {
  console.error('Pipeline failed:', err)
  process.exit(1)
})
