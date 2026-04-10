/**
 * Seed a prospect into Supabase from a JSON file.
 *
 * Usage:
 *   npx tsx scripts/seed-prospect.ts
 *   npm run seed-prospect
 *
 * Reads from: scripts/data/prospect-input.json
 * Copy prospect-input.json.example → prospect-input.json and fill in real data.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env from .env.local
import { config } from 'dotenv'
config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const inputPath = resolve(__dirname, 'data/prospect-input.json')
let input: Record<string, unknown>

try {
  input = JSON.parse(readFileSync(inputPath, 'utf-8'))
} catch {
  console.error(`Could not read ${inputPath}`)
  console.error('Copy prospect-input.json.example → prospect-input.json and fill in your data.')
  process.exit(1)
}

async function main() {
  const { data, error } = await supabase
    .from('prospects')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('Insert failed:', error.message)
    process.exit(1)
  }

  console.log('✅ Prospect seeded successfully')
  console.log(`   Slug: ${data.slug}`)
  console.log(`   URL:  https://backlitsupply.com/for/${data.slug}`)
  console.log(`   Dev:  http://localhost:3000/for/${data.slug}`)
  console.log(`   ID:   ${data.id}`)
}

main()
