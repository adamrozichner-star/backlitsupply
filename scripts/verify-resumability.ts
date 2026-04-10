/**
 * Verify pipeline resumability: run twice, check for no duplicate slugs in CSV or mockup files.
 */

import { execSync } from 'child_process'
import { resolve } from 'path'
import { readdirSync, readFileSync, rmSync, existsSync, mkdirSync } from 'fs'

const PROJECT_DIR = resolve(__dirname, '..')
const OUTPUT_DIR = resolve(__dirname, 'output')
const MOCKUP_DIR = resolve(OUTPUT_DIR, 'test-mockups')

function parseCSVSlugs(csvPath: string): string[] {
  const raw = readFileSync(csvPath, 'utf-8').trim()
  const lines = raw.split('\n').slice(1) // skip header
  return lines.map(line => {
    // Extract first quoted field (slug)
    const match = line.match(/^"([^"]*)"/)
    return match ? match[1] : line.split(',')[0]
  }).filter(Boolean)
}

function main() {
  console.log('\n=== Resumability Test ===\n')

  // Clean output directory (CSVs and mockups for med-spa)
  const dateStr = new Date().toISOString().slice(0, 10)
  const csvPath = resolve(OUTPUT_DIR, `outreach-med-spa-${dateStr}.csv`)

  console.log('Cleaning previous output...')
  if (existsSync(csvPath)) rmSync(csvPath)
  if (existsSync(MOCKUP_DIR)) rmSync(MOCKUP_DIR, { recursive: true })
  mkdirSync(MOCKUP_DIR, { recursive: true })

  const pipelineCmd = `npx tsx scripts/run-pipeline.ts --niche=med-spa --source=fixture --limit=5`

  // Run 1
  console.log('\n--- Run 1 ---')
  try {
    const out1 = execSync(pipelineCmd, { cwd: PROJECT_DIR, encoding: 'utf-8', timeout: 60_000 })
    console.log(out1)
  } catch (err: any) {
    console.log(err.stdout || '')
    console.error('Run 1 output (stderr):', err.stderr || '')
  }

  // Capture state after run 1
  const mockupsAfterRun1 = existsSync(MOCKUP_DIR)
    ? readdirSync(MOCKUP_DIR).filter(f => f.endsWith('.webp'))
    : []
  const slugsAfterRun1 = existsSync(csvPath) ? parseCSVSlugs(csvPath) : []

  console.log(`\nAfter run 1: ${mockupsAfterRun1.length} mockups, ${slugsAfterRun1.length} CSV rows`)

  // Run 2
  console.log('\n--- Run 2 ---')
  try {
    const out2 = execSync(pipelineCmd, { cwd: PROJECT_DIR, encoding: 'utf-8', timeout: 60_000 })
    console.log(out2)
  } catch (err: any) {
    console.log(err.stdout || '')
    console.error('Run 2 output (stderr):', err.stderr || '')
  }

  // Capture state after run 2
  const mockupsAfterRun2 = existsSync(MOCKUP_DIR)
    ? readdirSync(MOCKUP_DIR).filter(f => f.endsWith('.webp'))
    : []
  const slugsAfterRun2 = existsSync(csvPath) ? parseCSVSlugs(csvPath) : []

  console.log(`\nAfter run 2: ${mockupsAfterRun2.length} mockups, ${slugsAfterRun2.length} CSV rows`)

  let allPassed = true

  // Check: no duplicate mockup files (file names are unique by nature, but count shouldn't double)
  if (mockupsAfterRun2.length === mockupsAfterRun1.length) {
    console.log(`\n\u2705 Mockup count unchanged: ${mockupsAfterRun2.length} files (no duplicates)`)
  } else {
    console.log(`\n\u274C Mockup count changed: ${mockupsAfterRun1.length} -> ${mockupsAfterRun2.length}`)
    allPassed = false
  }

  // Check: no duplicate slugs in CSV
  const slugSet = new Set<string>()
  const duplicates: string[] = []
  for (const slug of slugsAfterRun2) {
    if (slugSet.has(slug)) duplicates.push(slug)
    slugSet.add(slug)
  }

  if (duplicates.length === 0) {
    console.log(`\u2705 No duplicate slugs in CSV (${slugsAfterRun2.length} rows, ${slugSet.size} unique)`)
  } else {
    console.log(`\u274C Duplicate slugs found in CSV: ${[...new Set(duplicates)].join(', ')}`)
    console.log(`  Total rows: ${slugsAfterRun2.length}, Unique: ${slugSet.size}`)
    allPassed = false
  }

  console.log(`\n${allPassed ? '\u2705 Resumability checks passed' : '\u274C Resumability checks failed (see above)'}`)
  process.exit(allPassed ? 0 : 1)
}

main()
