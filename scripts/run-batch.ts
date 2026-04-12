/**
 * Batch runner — runs run-pipeline.ts for multiple niches with a gap
 * between each to avoid Places rate limits.
 *
 * Usage:
 *   npx tsx scripts/run-batch.ts --niches=med-spa,dental-practices,boutique-fitness,tattoo-shops,coffee-shops --limit-per-niche=50
 *   npx tsx scripts/run-batch.ts --niches=med-spa,dental-practices --limit-per-niche=2 --dry-run
 *
 * Output:
 *   scripts/output/batch-{YYYY-MM-DD}/
 *     {niche}.log       — full stdout+stderr from each pipeline run
 *     summary.md        — per-niche counts, costs, enrichment hit rates, totals
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { spawn } from 'child_process'
import { mkdirSync, existsSync, writeFileSync, createWriteStream } from 'fs'
import { getNiche } from '../niches'

// ─── CLI args ───────────────────────────────────────────

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--(\w[\w-]*)=(.+)$/)
    if (m) args[m[1]] = m[2]
    else if (arg.startsWith('--')) args[arg.slice(2)] = 'true'
  }
  return args
}

const args = parseArgs()
const nicheList = (args.niches || '').split(',').map(s => s.trim()).filter(Boolean)
const limitPerNiche = args['limit-per-niche'] ? parseInt(args['limit-per-niche'], 10) : 50
const dryRun = args['dry-run'] === 'true'

if (nicheList.length === 0) {
  console.error('Usage: npx tsx scripts/run-batch.ts --niches=slug1,slug2 --limit-per-niche=50 [--dry-run]')
  process.exit(1)
}

// Validate every niche exists
for (const slug of nicheList) {
  try { getNiche(slug) } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }
}

// ─── Per-niche pipeline run ─────────────────────────────

interface NicheRunResult {
  niche: string
  discovered: number
  enriched: number
  qualified: number
  mockup_gated: number
  mockups: number
  outreach: number
  elapsed_sec: number
  exit_code: number
  log_path: string
  enrichment_hit_rate: number  // mockups / qualified (the single most valuable number)
}

async function runOne(slug: string, logPath: string): Promise<NicheRunResult> {
  const start = Date.now()
  return new Promise(resolvePromise => {
    const pipelineArgs = ['tsx', 'scripts/run-pipeline.ts', `--niche=${slug}`, `--limit=${limitPerNiche}`]
    if (dryRun) pipelineArgs.push('--dry-run')

    const child = spawn('npx', pipelineArgs, {
      cwd: resolve(__dirname, '..'),
      env: process.env,
    })

    const logStream = createWriteStream(logPath)
    let buffer = ''

    child.stdout.on('data', (d: Buffer) => {
      const s = d.toString()
      buffer += s
      logStream.write(s)
      process.stdout.write(s)
    })
    child.stderr.on('data', (d: Buffer) => {
      const s = d.toString()
      buffer += s
      logStream.write(s)
      process.stderr.write(s)
    })

    child.on('close', code => {
      logStream.end()
      // Parse summary numbers from the pipeline's final stats block
      const parse = (re: RegExp): number => {
        const m = buffer.match(re)
        return m ? parseInt(m[1], 10) : 0
      }
      const discovered = parse(/Discovered: (\d+)/)
      const enriched = parse(/Enriched: (\d+)/)
      const qualified = parse(/Qualified: (\d+)/)
      const mockup_gated = parse(/Mockup-gated[^:]*: (\d+)/)
      const mockups = parse(/Mockups: (\d+)/)
      const outreach = parse(/Outreach: (\d+)/)
      const enrichment_hit_rate = qualified > 0 ? mockups / qualified : 0

      resolvePromise({
        niche: slug,
        discovered, enriched, qualified, mockup_gated, mockups, outreach,
        elapsed_sec: (Date.now() - start) / 1000,
        exit_code: code ?? -1,
        log_path: logPath,
        enrichment_hit_rate,
      })
    })
  })
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  const dateStr = new Date().toISOString().slice(0, 10)
  const batchDir = resolve(__dirname, 'output', `batch-${dateStr}`)
  if (!existsSync(batchDir)) mkdirSync(batchDir, { recursive: true })

  console.log(`\n╔═══════════════════════════════════════════════════════════╗`)
  console.log(`║  Batch run: ${nicheList.length} niches × ${String(limitPerNiche).padStart(3)} limit${dryRun ? ' (DRY RUN)' : ''}              ║`)
  console.log(`║  Output:    ${batchDir}`)
  console.log(`╚═══════════════════════════════════════════════════════════╝\n`)

  const batchStart = Date.now()
  const results: NicheRunResult[] = []

  for (let i = 0; i < nicheList.length; i++) {
    const slug = nicheList[i]
    console.log(`\n═══ Running ${slug} (${i + 1}/${nicheList.length}) ═══\n`)
    const logPath = resolve(batchDir, `${slug}.log`)
    const result = await runOne(slug, logPath)
    results.push(result)

    // 60s gap between niches (except after the last one)
    if (i < nicheList.length - 1) {
      console.log(`\n─── Waiting 60s before next niche (rate limit safety) ───\n`)
      await new Promise(r => setTimeout(r, 60_000))
    }
  }

  const totalElapsed = (Date.now() - batchStart) / 1000

  // ── Summary report ──
  const totals = results.reduce(
    (acc, r) => ({
      discovered: acc.discovered + r.discovered,
      enriched: acc.enriched + r.enriched,
      qualified: acc.qualified + r.qualified,
      mockup_gated: acc.mockup_gated + r.mockup_gated,
      mockups: acc.mockups + r.mockups,
      outreach: acc.outreach + r.outreach,
    }),
    { discovered: 0, enriched: 0, qualified: 0, mockup_gated: 0, mockups: 0, outreach: 0 },
  )

  // Print terminal summary
  console.log(`\n╔═══════════════════════════════════════════════════════════╗`)
  console.log(`║                    BATCH COMPLETE                         ║`)
  console.log(`╚═══════════════════════════════════════════════════════════╝\n`)
  console.log(`Total elapsed: ${(totalElapsed / 60).toFixed(1)} min\n`)

  console.log('Niche                   Disc  Enr  Qual  Gated  Mock  Out  Hit%   Time')
  console.log('─'.repeat(72))
  for (const r of results) {
    const hitPct = r.enrichment_hit_rate > 0 ? `${(r.enrichment_hit_rate * 100).toFixed(0)}%` : '—'
    console.log(
      r.niche.padEnd(22) +
      String(r.discovered).padStart(6) +
      String(r.enriched).padStart(5) +
      String(r.qualified).padStart(6) +
      String(r.mockup_gated).padStart(7) +
      String(r.mockups).padStart(6) +
      String(r.outreach).padStart(5) +
      hitPct.padStart(6) +
      `  ${r.elapsed_sec.toFixed(0)}s`
    )
  }
  console.log('─'.repeat(72))
  console.log(
    'TOTAL'.padEnd(22) +
    String(totals.discovered).padStart(6) +
    String(totals.enriched).padStart(5) +
    String(totals.qualified).padStart(6) +
    String(totals.mockup_gated).padStart(7) +
    String(totals.mockups).padStart(6) +
    String(totals.outreach).padStart(5)
  )

  // Write summary.md
  const summaryLines: string[] = []
  summaryLines.push(`# Batch Run Summary — ${dateStr}\n`)
  summaryLines.push(`- Niches: ${nicheList.join(', ')}`)
  summaryLines.push(`- Limit per niche: ${limitPerNiche}`)
  summaryLines.push(`- Dry run: ${dryRun}`)
  summaryLines.push(`- Total elapsed: ${(totalElapsed / 60).toFixed(1)} min\n`)

  summaryLines.push(`## Per-niche enrichment hit rate\n`)
  summaryLines.push(`The single most valuable number from this batch: **what % of qualified prospects actually`)
  summaryLines.push(`survived to mockup generation?** Low hit rate = niche's prospects don't have discoverable`)
  summaryLines.push(`email addresses on their websites, so the pipeline can't send outreach even if the prospect`)
  summaryLines.push(`looks good. High hit rate = niche is viable with current enrichment.\n`)

  summaryLines.push(`| Niche | Discovered | Enriched | Qualified | Gated (no owner/email) | Mockups | **Hit rate** | Outreach | Time |`)
  summaryLines.push(`|-------|-----------:|---------:|----------:|----------------------:|--------:|-------------:|---------:|-----:|`)
  for (const r of results) {
    const hitPct = r.enrichment_hit_rate > 0 ? `${(r.enrichment_hit_rate * 100).toFixed(1)}%` : '—'
    summaryLines.push(
      `| ${r.niche} | ${r.discovered} | ${r.enriched} | ${r.qualified} | ${r.mockup_gated} | ${r.mockups} | **${hitPct}** | ${r.outreach} | ${r.elapsed_sec.toFixed(0)}s |`,
    )
  }
  summaryLines.push(`| **TOTAL** | **${totals.discovered}** | **${totals.enriched}** | **${totals.qualified}** | **${totals.mockup_gated}** | **${totals.mockups}** | — | **${totals.outreach}** | |\n`)

  summaryLines.push(`## Per-niche logs\n`)
  for (const r of results) {
    summaryLines.push(`- [${r.niche}.log](./${r.niche}.log) — exit ${r.exit_code}`)
  }
  summaryLines.push('')

  summaryLines.push(`## Cost note\n`)
  summaryLines.push(`Cost events recorded in \`prospect_events\` during each pipeline run.`)
  summaryLines.push(`Check /admin for the live cost breakdown chart, or run:`)
  summaryLines.push(`\`\`\`sql`)
  summaryLines.push(`select event, sum((payload->>'usd')::numeric) as total`)
  summaryLines.push(`from prospect_events`)
  summaryLines.push(`where event like 'cost:%' and created_at > now() - interval '1 day'`)
  summaryLines.push(`group by event;`)
  summaryLines.push(`\`\`\`\n`)

  const summaryPath = resolve(batchDir, 'summary.md')
  writeFileSync(summaryPath, summaryLines.join('\n'))
  console.log(`\nSummary: ${summaryPath}`)
}

main().catch(err => {
  console.error('Batch failed:', err)
  process.exit(1)
})
