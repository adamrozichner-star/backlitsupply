/**
 * Lint outreach CSVs: subject length, body word count, personalization, blacklist phrases.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { readdirSync } from 'fs'

const OUTPUT_DIR = resolve(__dirname, 'output')

const BLACKLIST = [
  'hope this finds you well',
  "i hope you're doing well",
  'i wanted to reach out',
  'quick question',
  'circling back',
]

const MAX_SUBJECT_CHARS = 50
const MAX_BODY_WORDS = 75

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.trim().split('\n')
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

function main() {
  const csvFiles = readdirSync(OUTPUT_DIR).filter(f => f.startsWith('outreach-') && f.endsWith('.csv'))

  if (csvFiles.length === 0) {
    console.error('No outreach CSV files found in', OUTPUT_DIR)
    process.exit(1)
  }

  let allPassed = true

  for (const csvFile of csvFiles) {
    const csvPath = resolve(OUTPUT_DIR, csvFile)
    console.log(`\n=== ${csvFile} ===\n`)

    const raw = readFileSync(csvPath, 'utf-8')
    const rows = parseCSV(raw)

    if (rows.length === 0) {
      console.log('  (no data rows)')
      continue
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const slug = row.slug || '(unknown)'
      const subject = row.subject || ''
      const body = row.body || ''
      const url = row.personalized_url || ''
      let rowPassed = true

      console.log(`  Row ${i + 1}: ${slug}`)

      // Subject length
      if (subject.length <= MAX_SUBJECT_CHARS) {
        console.log(`    \u2705 Subject length: ${subject.length} chars`)
      } else {
        console.log(`    \u274C Subject length: ${subject.length} chars (max ${MAX_SUBJECT_CHARS})`)
        rowPassed = false
      }

      // Body word count (if body column exists)
      if (body) {
        const wordCount = body.split(/\s+/).filter(Boolean).length
        if (wordCount <= MAX_BODY_WORDS) {
          console.log(`    \u2705 Body words: ${wordCount}`)
        } else {
          console.log(`    \u274C Body words: ${wordCount} (max ${MAX_BODY_WORDS})`)
          rowPassed = false
        }
      } else {
        console.log(`    \u2705 Body: (no body column — outreach may be subject-only CSV)`)
      }

      // Personalized URL contains /for/{slug}
      if (url.includes(`/for/${slug}`)) {
        console.log(`    \u2705 Personalized URL contains /for/${slug}`)
      } else {
        console.log(`    \u274C Personalized URL missing /for/${slug}: "${url}"`)
        rowPassed = false
      }

      // Blacklist check
      const combined = (subject + ' ' + body).toLowerCase()
      let blacklistHit = false
      for (const phrase of BLACKLIST) {
        if (combined.includes(phrase)) {
          console.log(`    \u274C Blacklist phrase found: "${phrase}"`)
          blacklistHit = true
          rowPassed = false
        }
      }
      if (!blacklistHit) {
        console.log(`    \u2705 No blacklist phrases`)
      }

      if (!rowPassed) allPassed = false
    }
  }

  console.log(`\n${allPassed ? '\u2705 All outreach checks passed' : '\u274C Some outreach checks failed'}`)
}

main()
