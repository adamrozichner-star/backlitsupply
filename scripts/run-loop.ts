/**
 * Stage 12 — Meta-runner
 *
 * Reads all enabled niches, runs pipeline per niche, checks killSwitches.
 * Auto-pauses a niche if reply rate < threshold or spam > threshold.
 *
 * Usage:
 *   npx tsx scripts/run-loop.ts [--source=fixture] [--limit=5]
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getAllNiches } from '../niches'
import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'

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

async function main() {
  const niches = getAllNiches()
  const dateStr = new Date().toISOString().slice(0, 10)
  const reportLines: string[] = [`# Loop Report — ${dateStr}\n`]

  console.log(`\n════════════════════════════════════════`)
  console.log(`  Pipeline Loop — ${niches.length} niches`)
  console.log(`════════════════════════════════════════\n`)

  for (const niche of niches) {
    console.log(`\n┌── ${niche.displayName} (${niche.slug}) ──┐`)
    reportLines.push(`## ${niche.displayName} (${niche.slug})\n`)

    // TODO: Check killSwitch by querying metrics
    // For now, always run — killSwitch checks require the metrics table
    // which is created in Stage 9/10 migration

    try {
      const extraArgs = Object.entries(args)
        .map(([k, v]) => `--${k}=${v}`)
        .join(' ')

      const cmd = `npx tsx scripts/run-pipeline.ts --niche=${niche.slug} ${extraArgs}`
      console.log(`  Running: ${cmd}`)

      const output = execSync(cmd, {
        cwd: resolve(__dirname, '..'),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 300000,  // 5 min per niche
        env: { ...process.env },
      })

      console.log(output)
      reportLines.push('Status: ✅ Completed\n')
      reportLines.push('```')
      reportLines.push(output.trim())
      reportLines.push('```\n')
    } catch (err) {
      const error = err as { stderr?: string; message?: string }
      console.error(`  ❌ Failed: ${error.stderr || error.message}`)
      reportLines.push(`Status: ❌ Failed\n`)
      reportLines.push(`Error: ${error.stderr || error.message}\n`)
    }
  }

  // Write batch report
  const outputDir = resolve(__dirname, 'output')
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  const reportPath = resolve(outputDir, `loop-${dateStr}.md`)
  writeFileSync(reportPath, reportLines.join('\n'))
  console.log(`\nReport: ${reportPath}`)
}

main().catch(err => {
  console.error('Loop failed:', err)
  process.exit(1)
})
