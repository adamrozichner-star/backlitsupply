/**
 * Stage 11 — Pipeline orchestrator
 *
 * Runs the full lead generation pipeline for ONE niche.
 * Idempotent on slug, resumable from any pipeline_state.
 *
 * State machine flow:
 *   discovered → enriched → qualified → mockup_ready → (sent → opened → replied → ...)
 *
 * Each stage checks current state and picks up where it left off.
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
import './lib/sources/outscraper'
import './lib/sources/google-places'
import './lib/sources/fixture'
import { mergeListings_multi } from './lib/sources/merge'
import { enrichFromFixture, enrichListing, CURRENT_ENRICHMENT_VERSION } from './lib/enrich'
import { qualifyProspect } from './lib/qualify'
import { createMockupGenerator } from './lib/mockup-generator'
import { createStorage } from './lib/storage'
import { generateOutreachFixture, generateOutreach } from './lib/outreach'
import { createLlmClient, FixtureLlmClient } from './lib/llm'
import { makeSlug } from './lib/slug'
import { updatePipelineState, recordEvent, recordCost } from './lib/metrics'
import { getSupabaseServer } from '../src/lib/supabase/server'
import { writeFileSync, readFileSync, mkdirSync, existsSync, appendFileSync } from 'fs'
import type { EnrichedProspect } from './lib/types'

/**
 * Validate email is real — rejects example.com, empty, and obviously fake addresses.
 */
function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return false
  if (trimmed.includes('example.com')) return false
  if (trimmed.includes('example.org')) return false
  // Basic RFC 5322-ish check: local@domain.tld
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
}

// Pipeline state ordering — used to determine which stages to skip on resume
const STATE_ORDER = [
  'discovered', 'enriched', 'qualified', 'mockup_ready',
  'sent', 'opened', 'replied', 'positive', 'booked', 'won', 'lost', 'dead',
] as const

function stateIndex(state: string): number {
  return STATE_ORDER.indexOf(state as typeof STATE_ORDER[number])
}

function isAtOrPast(currentState: string, targetState: string): boolean {
  return stateIndex(currentState) >= stateIndex(targetState)
}

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
const sourceOverride = args.source
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

  // In production mode (not fixture), ANTHROPIC_API_KEY is required.
  // Fake owner names from fixture LLM would be catastrophic in real outreach.
  if (!isFixture && !process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is required for live pipeline runs.')
    console.error('Fixture LLM fallback is only allowed with --source=fixture.')
    console.error('Set ANTHROPIC_API_KEY in .env.local or use --source=fixture for offline tests.')
    process.exit(1)
  }

  const useFixtureLlm = isFixture

  if (isFixture) process.env.PIPELINE_SOURCE = 'fixture'
  // Set niche query for Outscraper/Google Places search term(s).
  // PIPELINE_NICHE_QUERIES is a JSON array for multi-query niches (fitness, coffee, etc.)
  process.env.PIPELINE_NICHE_QUERY = nicheConfig.displayName
  if (nicheConfig.placesQueries && nicheConfig.placesQueries.length > 0) {
    process.env.PIPELINE_NICHE_QUERIES = JSON.stringify(nicheConfig.placesQueries)
  } else {
    delete process.env.PIPELINE_NICHE_QUERIES
  }

  const llm = useFixtureLlm
    ? new FixtureLlmClient({
        extract_contact: {
          name: 'extract_contact',
          input: { owner_first_name: 'Test', owner_last_name: 'Owner', contact_email: null },
        },
        draft_outreach: {
          name: 'draft_outreach',
          input: { subject: 'Quick mockup for you', body: 'Fixture outreach body' },
        },
      })
    : createLlmClient()

  const mockupGen = createMockupGenerator()
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
    writeFileSync(csvPath, 'slug,business_name,owner,email,subject,body,personalized_url\n')
  }

  const geos = geoFilter
    ? nicheConfig.geos.filter(g => g.city.toLowerCase() === geoFilter)
    : nicheConfig.geos

  if (geos.length === 0) {
    console.error(`No geos match filter "${geoFilter}". Available: ${nicheConfig.geos.map(g => g.city).join(', ')}`)
    process.exit(1)
  }

  // File-based slug tracker for offline idempotency (fallback when no Supabase)
  const processedSlugsPath = resolve(outputDir, `.processed-slugs-${nicheName}.json`)
  const processedSlugs: Set<string> = existsSync(processedSlugsPath)
    ? new Set(JSON.parse(readFileSync(processedSlugsPath, 'utf-8')))
    : new Set()

  // Load existing CSV slugs to prevent duplicate rows
  const existingCsvSlugs = new Set<string>()
  if (existsSync(csvPath)) {
    const lines = readFileSync(csvPath, 'utf-8').trim().split('\n').slice(1)
    for (const line of lines) {
      const match = line.match(/^"([^"]*)"/)
      if (match) existingCsvSlugs.add(match[1])
    }
  }

  let successCount = 0
  const stats = { discovered: 0, enriched: 0, qualified: 0, mockup_gated: 0, mockups: 0, outreach: 0, skipped_done: 0, resumed: 0 }

  for (const geo of geos) {
    console.log(`\n── Geo: ${geo.city}, ${geo.state} ──`)

    // Stage 2: Discovery — fetch from all configured sources, merge + dedup
    const sourceSlugs = isFixture ? ['fixture'] : nicheConfig.sources
    const rawListings = []

    for (const srcSlug of sourceSlugs) {
      try {
        const source = getSource(srcSlug)
        console.log(`  [discover] Fetching from ${srcSlug}...`)
        const listings = await source.fetchNew(geo)
        console.log(`  [discover] Found ${listings.length} listings from ${srcSlug}`)
        rawListings.push(...listings)
        // Cost: Places searchText ≈ $0.032 per call; Comptroller + fixture are free.
        // Niches with multiple placesQueries make N API calls — emit one cost event per query.
        if (srcSlug === 'google-places') {
          const numQueries = nicheConfig.placesQueries?.length || 1
          for (let i = 0; i < numQueries; i++) {
            await recordCost('places', 0.032, {
              niche: nicheName,
              geo: `${geo.city},${geo.state}`,
              query_index: i,
            })
          }
        }
      } catch (err) {
        console.warn(`  [discover] ${srcSlug} failed: ${(err as Error).message?.slice(0, 100)}`)
        // Continue with other sources — don't let one failure stop the pipeline
      }
    }

    // Merge and dedup across sources
    const allListings = rawListings.length > 0 ? mergeListings_multi(rawListings) : []
    console.log(`  [discover] ${rawListings.length} raw → ${allListings.length} after merge/dedup`)

    stats.discovered += allListings.length

    for (const listing of allListings) {
      if (successCount >= limit) break

      const slug = makeSlug(listing.business_name, listing.city)
      console.log(`\n  ▸ ${listing.business_name} (${slug})`)

      // ── Check existing state (Supabase or file tracker) ──
      let existingId: string | null = null
      let currentState: string = 'new'  // 'new' means not yet in DB

      if (supabase) {
        const { data: existing } = await supabase
          .from('prospects')
          .select('id, pipeline_state, enrichment_version')
          .eq('slug', slug)
          .single()

        if (existing) {
          existingId = existing.id
          currentState = existing.pipeline_state || 'discovered'
          const existingVersion = existing.enrichment_version ?? 1

          // Check enrichment version — force re-enrich if stale
          if (isAtOrPast(currentState, 'enriched') && existingVersion < CURRENT_ENRICHMENT_VERSION) {
            console.log(`    [version] enrichment_version ${existingVersion} < ${CURRENT_ENRICHMENT_VERSION} — resetting to discovered for re-enrichment`)
            await supabase.from('prospects').update({ pipeline_state: 'discovered' }).eq('id', existingId)
            await recordEvent(existingId!, 're-enriched_version_bump', { from_version: existingVersion, to_version: CURRENT_ENRICHMENT_VERSION })
            currentState = 'discovered'
          }

          // Already fully processed (mockup_ready or beyond) → skip
          if (isAtOrPast(currentState, 'mockup_ready')) {
            console.log(`    [skip] Already at '${currentState}'`)
            stats.skipped_done++
            continue
          }

          console.log(`    [resume] Picking up from '${currentState}'`)
          stats.resumed++
        }
      } else if (processedSlugs.has(slug)) {
        console.log(`    [skip] Already processed (file tracker)`)
        stats.skipped_done++
        continue
      }

      // ── Stage: discovered → enriched ──
      let enriched: EnrichedProspect | null = null

      if (!isAtOrPast(currentState, 'enriched')) {
        if (isFixture) {
          enriched = enrichFromFixture(listing)
        } else {
          enriched = await enrichListing(listing, { llm, qualifyConfig: nicheConfig.qualify })
        }

        if (!enriched) {
          console.log('    [skip] Enrichment failed')
          continue
        }

        // Insert into Supabase as 'discovered' then transition to 'enriched'
        if (supabase && !existingId) {
          const { data: inserted, error } = await supabase.from('prospects').insert({
            slug,
            business_name: enriched.business_name,
            owner_first_name: enriched.owner_first_name,
            owner_last_name: enriched.owner_last_name,
            email: enriched.email || null,
            phone: enriched.phone,
            website: enriched.website,
            city: enriched.city,
            state: enriched.state,
            niche: nicheName,
            logo_url: enriched.logo_url,
            source: enriched.source_slug,
            pipeline_state: 'discovered',
            enrichment_version: CURRENT_ENRICHMENT_VERSION,
          }).select('id').single()

          if (error) {
            console.error(`    [db] Insert failed: ${error.message}`)
            continue
          }
          existingId = inserted!.id
          await recordEvent(existingId!, 'state:discovered', { source: enriched.source_slug })
        }

        // Transition: discovered → enriched
        if (existingId) {
          // Update prospect fields with enrichment data (also handles re-enrichment)
          await supabase!.from('prospects').update({
            owner_first_name: enriched.owner_first_name || null,
            owner_last_name: enriched.owner_last_name || null,
            email: enriched.email || null,
            logo_url: enriched.logo_url || null,
            website: enriched.website || null,
            enrichment_version: CURRENT_ENRICHMENT_VERSION,
          }).eq('id', existingId)

          await updatePipelineState(existingId, 'enriched', {
            logo_url: enriched.logo_url,
            owner: enriched.owner_first_name,
            enrichment_version: CURRENT_ENRICHMENT_VERSION,
          })
          console.log(`    [state] discovered → enriched (v${CURRENT_ENRICHMENT_VERSION})`)
        }
      } else {
        // Resuming from enriched+ — rebuild enriched from DB
        if (supabase && existingId) {
          const { data: row } = await supabase.from('prospects').select('*').eq('id', existingId).single()
          if (row) {
            enriched = {
              business_name: row.business_name,
              owner_first_name: row.owner_first_name,
              owner_last_name: row.owner_last_name,
              email: row.email,
              phone: row.phone,
              website: row.website,
              city: row.city,
              state: row.state,
              county: undefined,
              logo_url: row.logo_url,
              logo_width: undefined,
              logo_height: undefined,
              source_slug: row.source || 'unknown',
              source_id: undefined,
            }
          }
        }
        if (!enriched) {
          console.log('    [skip] Cannot rebuild enrichment data for resume')
          continue
        }
      }

      stats.enriched++
      // Cost: Haiku extraction ≈ $0.003 per call (multi-page text + tool-use)
      if (!isFixture && existingId) {
        await recordCost('haiku', 0.003, { stage: 'enrichment', prospect_id: existingId })
      }

      // ── Stage: enriched → qualified ──
      if (!isAtOrPast(currentState, 'qualified')) {
        const qual = qualifyProspect(enriched, nicheConfig.qualify, {
          chainBlocklist: nicheConfig.chainBlocklist,
          qualifyBoosts: nicheConfig.qualifyBoosts,
        })

        if (qual.killed_as_chain) {
          console.log(`    [qualify] CHAIN KILLED — ${qual.chain_reason}`)
          continue
        }

        console.log(`    [qualify] Score: ${qual.score} (threshold: ${nicheConfig.qualify.scoreThreshold}) → ${qual.passed ? 'PASS' : 'FAIL'}`)

        if (!qual.passed && !isFixture) {
          console.log('    [skip] Below threshold')
          continue
        }

        if (existingId) {
          await updatePipelineState(existingId, 'qualified', { score: qual.score, breakdown: qual.breakdown })
          console.log(`    [state] enriched → qualified`)
        }
      }

      stats.qualified++

      // ── Sendability gate: skip mockup generation if owner or email missing ──
      // Default gate is true; niche config can set mockupGate: false to override.
      const gateEnabled = nicheConfig.mockupGate !== false
      if (gateEnabled && !isAtOrPast(currentState, 'mockup_ready')) {
        const hasOwner = !!enriched.owner_first_name
        const hasEmail = !!enriched.email && isValidEmail(enriched.email)
        if (!hasOwner || !hasEmail) {
          const reason = !hasOwner ? 'no_owner' : 'no_email'
          console.log(`    [gate] Skipping mockup — ${reason}`)
          if (existingId) {
            await recordEvent(existingId, 'gate:mockup_skipped', {
              reason,
              has_owner: hasOwner,
              has_email: hasEmail,
            })
          }
          stats.mockup_gated++
          continue  // stay at qualified, don't advance
        }
      }

      // ── Stage: qualified → mockup_ready ──
      if (!isAtOrPast(currentState, 'mockup_ready') && !dryRun) {
        // Load logo buffer
        let logoBuffer: Buffer
        if (isFixture) {
          logoBuffer = readFileSync(resolve(__dirname, 'fixtures/sample-logo-light.png'))
        } else {
          // Download logo from URL
          const logoRes = await fetch(enriched.logo_url!)
          if (!logoRes.ok) {
            console.error(`    [mockup] Logo download failed: ${logoRes.status}`)
            continue
          }
          logoBuffer = Buffer.from(await logoRes.arrayBuffer())
        }

        const mockupOutputPath = resolve(mockupDir, `${slug}.webp`)

        try {
          const result = await mockupGen.generate(logoBuffer, nicheConfig, slug)
          writeFileSync(mockupOutputPath, result.buffer)
          console.log(`    [mockup] ${result.model} → ${mockupOutputPath} ($${result.cost_usd.toFixed(3)})`)
          stats.mockups++

          if (existingId) {
            await recordEvent(existingId, 'mockup_generated', {
              model: result.model,
              cost_usd: result.cost_usd,
            })
            // Cost event for Replicate (0 when SharpCompositor fallback)
            if (result.cost_usd > 0) {
              await recordCost('replicate', result.cost_usd, { model: result.model, prospect_id: existingId })
            }
          }
        } catch (err) {
          console.error(`    [mockup] Failed:`, err)
          continue
        }

        // Upload to storage
        const mockupUrl = await storage.upload(slug, mockupOutputPath)
        console.log(`    [storage] ${mockupUrl}`)

        // Update DB with mockup URL + transition state
        if (supabase && existingId) {
          await supabase.from('prospects').update({
            mockup_url: mockupUrl,
            suggested_dimensions: nicheConfig.priceRange[0] <= 600 ? '24" wide' : '28" wide',
            suggested_price_usd: nicheConfig.priceRange[0],
          }).eq('id', existingId)

          await updatePipelineState(existingId, 'mockup_ready', { mockup_url: mockupUrl })
          console.log(`    [state] qualified → mockup_ready`)
        }

        // Generate outreach copy — only if we have a real email
        const email = enriched.email
        if (!email || !isValidEmail(email)) {
          console.log(`    [outreach] Skipped — no real email (prospect stays at mockup_ready pending manual email discovery)`)
        } else {
          const draft = isFixture
            ? generateOutreachFixture({ slug, business_name: enriched.business_name, owner_first_name: enriched.owner_first_name, email })
            : await generateOutreach({
                llm,
                copyAngle: nicheConfig.copyAngle,
                prospect: { slug, business_name: enriched.business_name, owner_first_name: enriched.owner_first_name, email, city: enriched.city },
              })

          console.log(`    [outreach] Subject: "${draft.subject}"`)
          stats.outreach++

          if (existingId) {
            await recordEvent(existingId, 'outreach_drafted', { subject: draft.subject })
            // Cost: Haiku outreach draft ≈ $0.002 per call
            if (!isFixture) {
              await recordCost('haiku', 0.002, { stage: 'outreach', prospect_id: existingId })
            }
          }

          // Write to CSV with body (dedup by slug)
          if (!existingCsvSlugs.has(slug)) {
            const csvLine = [slug, enriched.business_name, enriched.owner_first_name || '', email, draft.subject, draft.body, draft.personalized_url]
              .map(v => `"${(v || '').replace(/"/g, '""')}"`)
              .join(',')
            appendFileSync(csvPath, csvLine + '\n')
            existingCsvSlugs.add(slug)
          }
        }
      } else if (dryRun) {
        console.log('    [dry-run] Would generate mockup + outreach')
      }

      // Mark slug as processed (file-based tracker)
      processedSlugs.add(slug)
      successCount++
    }
  }

  // Persist file-based slug tracker
  writeFileSync(processedSlugsPath, JSON.stringify([...processedSlugs], null, 2))

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n═══ Done ═══`)
  console.log(`  Time: ${elapsed}s`)
  console.log(`  Discovered: ${stats.discovered}`)
  console.log(`  Enriched: ${stats.enriched}`)
  console.log(`  Qualified: ${stats.qualified}`)
  console.log(`  Mockup-gated (no owner/email): ${stats.mockup_gated}`)
  console.log(`  Mockups: ${stats.mockups}`)
  console.log(`  Outreach: ${stats.outreach}`)
  console.log(`  Skipped (done): ${stats.skipped_done}`)
  console.log(`  Resumed: ${stats.resumed}`)
  console.log(`  CSV: ${csvPath}`)
}

main().catch(err => {
  console.error('Pipeline failed:', err)
  process.exit(1)
})
