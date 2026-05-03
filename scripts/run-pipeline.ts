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

// Catch async AbortErrors and other unhandled rejections that escape try/catch
// (Node undici throws from process.nextTick on fetch abort — uncatchable in sync flow)
process.on('uncaughtException', (err) => {
  console.error(`[fatal] Uncaught exception: ${err.message?.slice(0, 150)}`)
})
process.on('unhandledRejection', (err) => {
  console.error(`[fatal] Unhandled rejection: ${err instanceof Error ? err.message?.slice(0, 150) : String(err)}`)
})

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
import { writeFileSync, readFileSync, mkdirSync, existsSync, appendFileSync, statSync } from 'fs'
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
  'discovered', 'enriched', 'qualified', 'mockup_review_pending', 'mockup_ready',
  'sent', 'opened', 'replied', 'positive', 'booked', 'won', 'bounced', 'lost', 'dead',
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
  if (!isFixture) {
    console.log('[email] Pattern-based email enrichment enabled (MX verification)')
  }

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
  const stats: Record<string, number> = { discovered: 0, enriched: 0, qualified: 0, pattern_found: 0, mockup_gated: 0, mockups: 0, outreach: 0, skipped_done: 0, resumed: 0, enrichment_failures: 0 }
  // Track prospect IDs that reached mockup_ready in THIS run (for end-of-pipeline verification)
  const newlyMockupReady: { id: string; slug: string }[] = []

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

      try {

      // ── Check existing state (Supabase or file tracker) ──
      let existingId: string | null = null
      let currentState: string = 'new'  // 'new' means not yet in DB
      let retryCount = 0

      if (supabase) {
        const { data: existing } = await supabase
          .from('prospects')
          .select('id, pipeline_state, enrichment_version, mockup_retry_count')
          .eq('slug', slug)
          .single()

        if (existing) {
          existingId = existing.id
          currentState = existing.pipeline_state || 'discovered'
          retryCount = (existing.mockup_retry_count as number) || 0
          const existingVersion = existing.enrichment_version ?? 1

          // Check enrichment version — force re-enrich if stale
          // CEILING: never re-enrich prospects at sent or later — the email is already
          // delivered. Re-enriching would regress state and risk duplicate sends.
          const TERMINAL_SEND_STATES = ['sent', 'opened', 'replied', 'positive', 'booked', 'won', 'bounced', 'lost', 'dead']
          if (isAtOrPast(currentState, 'enriched') && existingVersion < CURRENT_ENRICHMENT_VERSION) {
            if (TERMINAL_SEND_STATES.includes(currentState)) {
              console.log(`    [version] Skipping re-enrichment — prospect at '${currentState}' (terminal send state). v${existingVersion} → v${CURRENT_ENRICHMENT_VERSION} would regress.`)
              await recordEvent(existingId!, 'reenrichment_skipped_terminal_state', {
                version_would_be: CURRENT_ENRICHMENT_VERSION,
                current_version: existingVersion,
                current_state: currentState,
              })
              // Don't reset state, don't re-enrich. Let the skip-done check below handle it.
            } else {
              console.log(`    [version] enrichment_version ${existingVersion} < ${CURRENT_ENRICHMENT_VERSION} — resetting to discovered for re-enrichment`)
              await supabase.from('prospects').update({ pipeline_state: 'discovered' }).eq('id', existingId)
              await recordEvent(existingId!, 're-enriched_version_bump', { from_version: existingVersion, to_version: CURRENT_ENRICHMENT_VERSION })
              currentState = 'discovered'
            }
          }

          // Already has mockup generated (review_pending or beyond) → skip
          if (isAtOrPast(currentState, 'mockup_review_pending')) {
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
        try {
          if (isFixture) {
            enriched = enrichFromFixture(listing)
          } else {
            enriched = await enrichListing(listing, { llm, qualifyConfig: nicheConfig.qualify })
          }
        } catch (enrichErr) {
          const msg = (enrichErr as Error).message || ''

          // Auth/credit errors → abort the entire batch (fundamental config issue)
          if (msg.includes('credit balance') || msg.includes('401') || msg.includes('authentication') || msg.includes('api_key')) {
            console.error(`\n    ❌ FATAL: ${msg.slice(0, 120)}`)
            console.error('    Pipeline aborting — fix API credentials/credits before re-running.\n')
            throw enrichErr
          }

          // Transient failure → log, skip this prospect, continue batch
          console.error(`    [enrich] ERROR (skipping): ${msg.slice(0, 100)}`)
          stats.enrichment_failures = (stats.enrichment_failures || 0) + 1
          if (existingId && supabase) {
            await recordEvent(existingId, 'enrichment_failed', {
              error: msg.slice(0, 200),
              actor: 'pipeline',
            }).catch(() => {})  // don't let event logging crash the recovery path
          }
          continue
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
            logo_extraction_trace: enriched.logo_extraction_trace || null,
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
            logo_width: enriched.logo_width || null,
            logo_height: enriched.logo_height || null,
            logo_extraction_trace: enriched.logo_extraction_trace || null,
            website: enriched.website || null,
            rating: enriched.rating || null,
            review_count: enriched.review_count || null,
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
              logo_width: row.logo_width ?? undefined,
              logo_height: row.logo_height ?? undefined,
              rating: row.rating ?? undefined,
              review_count: row.review_count ?? undefined,
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
      if (gateEnabled && !isAtOrPast(currentState, 'mockup_review_pending')) {
        // If no valid email, generate pattern-based email
        if ((!enriched.email || !isValidEmail(enriched.email)) && enriched.website) {
          const { enrichEmailViaPattern } = await import('./lib/email-pattern')
          const patternResult = await enrichEmailViaPattern(
            enriched.website,
            enriched.owner_first_name,
            enriched.owner_last_name,
          )
          if (patternResult.found && patternResult.email) {
            enriched.email = patternResult.email
            stats.pattern_found++
            if (supabase && existingId) {
              await supabase.from('prospects').update({
                email: patternResult.email,
                email_source: 'pattern',
                email_confidence: patternResult.confidence,
                email_is_role_based: patternResult.is_role_based || false,
              }).eq('id', existingId)
              if (patternResult.is_role_based) {
                await recordEvent(existingId, 'email_low_confidence', {
                  email: patternResult.email,
                  confidence: patternResult.confidence,
                  tier: patternResult.tier,
                  is_role_based: true,
                  source: 'pattern',
                })
              }
            }
          }
        }

        const hasEmail = !!enriched.email && isValidEmail(enriched.email)
        if (!hasEmail) {
          console.log(`    [gate] Skipping mockup — no_email`)
          if (existingId) {
            await recordEvent(existingId, 'gate:mockup_skipped', {
              reason: 'no_email',
              has_email: false,
            })
          }
          stats.mockup_gated++
          continue  // stay at qualified, don't advance
        }
      }

      // ── Stage: qualified → mockup_ready ──
      if (!isAtOrPast(currentState, 'mockup_review_pending') && !dryRun) {
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

          // Rasterize SVGs to PNG (Replicate expects raster image, not XML)
          const contentType = logoRes.headers.get('content-type') || ''
          const isSvg = contentType.includes('svg') || enriched.logo_url!.endsWith('.svg')
          if (isSvg) {
            console.log(`    [mockup] SVG detected — rasterizing to PNG`)
            const sharpMod = (await import('sharp')).default
            logoBuffer = await sharpMod(logoBuffer)
              .resize(800, 800, { fit: 'inside', withoutEnlargement: false })
              .png()
              .toBuffer()
          }

          // Log dimensions for debugging
          try {
            const sharpMod = (await import('sharp')).default
            const meta = await sharpMod(logoBuffer).metadata()
            console.log(`    [mockup] Sending to Replicate: ${meta.format} ${meta.width}x${meta.height}`)
          } catch {
            console.log(`    [mockup] Sending to Replicate: unknown format`)
          }
        }

        const mockupOutputPath = resolve(mockupDir, `${slug}.webp`)

        try {
          const result = await mockupGen.generate(logoBuffer, nicheConfig, slug, retryCount)
          writeFileSync(mockupOutputPath, result.buffer)
          console.log(`    [mockup] ${result.model} → ${mockupOutputPath} ($${result.cost_usd.toFixed(3)})`)
          stats.mockups++

          if (existingId) {
            await recordEvent(existingId, 'mockup_generated', {
              model: result.model,
              cost_usd: result.cost_usd,
              prediction_id: result.prediction_id,
              prompt_used: result.prompt_used,
              retry_count: retryCount,
            })
            // Cost event for Replicate (0 when SharpCompositor fallback)
            if (result.cost_usd > 0) {
              await recordCost('replicate', result.cost_usd, { model: result.model, prediction_id: result.prediction_id, prospect_id: existingId })
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
          const mockupImageUrl = `https://backlitsupply.com${mockupUrl}`
          await supabase.from('prospects').update({
            mockup_url: mockupUrl,
            mockup_image_url: mockupImageUrl,
            suggested_dimensions: nicheConfig.priceRange[0] <= 600 ? '24" wide' : '28" wide',
            suggested_price_usd: nicheConfig.priceRange[0],
          }).eq('id', existingId)

          await updatePipelineState(existingId, 'mockup_review_pending', { mockup_url: mockupUrl })
          console.log(`    [state] qualified → mockup_review_pending (needs human review)`)
          newlyMockupReady.push({ id: existingId, slug })
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

      } catch (prospectErr) {
        const msg = (prospectErr as Error).message || String(prospectErr)
        if (msg.includes('credit balance') || msg.includes('401') || msg.includes('authentication')) {
          throw prospectErr
        }
        console.error(`    [CRASH GUARD] Unexpected error on ${slug}: ${msg.slice(0, 150)}`)
        stats.enrichment_failures = (stats.enrichment_failures || 0) + 1
      }
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
  console.log(`  Pattern emails found: ${stats.pattern_found}`)
  console.log(`  Mockup-gated (no owner/email): ${stats.mockup_gated}`)
  console.log(`  Mockups: ${stats.mockups}`)
  console.log(`  Outreach: ${stats.outreach}`)
  console.log(`  Skipped (done): ${stats.skipped_done}`)
  console.log(`  Resumed: ${stats.resumed}`)
  if (stats.enrichment_failures > 0) {
    console.log(`  ⚠ Enrichment failures: ${stats.enrichment_failures} (see prospect_events for details)`)
  }
  console.log(`  CSV: ${csvPath}`)

  // ── Mockup verification tail ──
  // Verify mockup files exist locally (not against production — files aren't deployed yet).
  // Production verification runs separately after git push via `npm run verify`.
  if (!dryRun && newlyMockupReady.length > 0 && supabase) {
    console.log(`\n── Verifying ${newlyMockupReady.length} new mockups (local file check) ──`)
    const broken: string[] = []
    for (const { id, slug } of newlyMockupReady) {
      const localPath = resolve(__dirname, '../public/mockups', `${slug}.webp`)
      const exists = existsSync(localPath)
      const size = exists ? statSync(localPath).size : 0
      const ok = exists && size > 30720  // >30KB — real mockups are 50-200KB

      if (ok) {
        console.log(`  ✅ ${slug} (${(size / 1024).toFixed(0)} KB)`)
        await supabase.from('prospect_events').insert({
          prospect_id: id,
          event: 'mockup_verified',
          payload: { path: localPath, size, verification: 'local' },
        })
      } else {
        console.log(`  ❌ ${slug} — ${!exists ? 'file not found' : `too small (${(size / 1024).toFixed(0)} KB)`}`)
        broken.push(slug)
        await supabase.from('prospects').update({ pipeline_state: 'qualified' }).eq('id', id)
        await supabase.from('prospect_events').insert({
          prospect_id: id,
          event: 'mockup_gate_failed',
          payload: { reason: !exists ? 'file_not_found' : 'file_too_small', size, path: localPath },
        })
      }
    }

    if (broken.length > 0) {
      console.log(`\n  ⚠ ${broken.length} mockup(s) failed local verification — downgraded to qualified`)
    }

    console.log(`\n  After batch: git add public/mockups/ && git commit -m "feat: new mockups" && git push`)
    console.log(`  Then run: npm run verify (checks production URLs after deploy)`)
  }
}

main().catch(err => {
  console.error('Pipeline failed:', err)
  process.exit(1)
})
