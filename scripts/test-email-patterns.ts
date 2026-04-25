/**
 * Dry-run test for pattern-based email enrichment.
 *
 * Loads 5 prospects from Supabase and compares pattern results
 * against existing Hunter emails where available.
 *
 * Usage: npm run test:patterns
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getSupabaseServer } from '../src/lib/supabase/server'
import { enrichEmailViaPattern } from './lib/email-pattern'

async function main() {
  const sb = getSupabaseServer()
  if (!sb) {
    console.error('Supabase not configured')
    process.exit(1)
  }

  const { data: prospects } = await sb.from('prospects')
    .select('id, slug, business_name, owner_first_name, owner_last_name, website, email, email_source, email_confidence, email_is_role_based')
    .not('website', 'is', null)
    .in('pipeline_state', ['sent', 'opened', 'replied', 'mockup_ready', 'qualified'])
    .limit(5)

  if (!prospects || prospects.length === 0) {
    console.error('No prospects with websites found')
    process.exit(1)
  }

  console.log('\n=== Pattern Email Enrichment — Dry Run ===\n')

  for (const p of prospects) {
    console.log(`── ${p.business_name} (${p.slug}) ──`)
    console.log(`   Website: ${p.website}`)
    console.log(`   Owner: ${p.owner_first_name || '—'} ${p.owner_last_name || ''}`.trim())
    console.log(`   Current email: ${p.email || '(none)'} [source: ${p.email_source || '—'}, confidence: ${p.email_confidence ?? '—'}, role: ${p.email_is_role_based ?? '—'}]`)

    const result = await enrichEmailViaPattern(
      p.website!,
      p.owner_first_name || undefined,
      p.owner_last_name || undefined,
    )

    if (result.found) {
      console.log(`   Pattern email: ${result.email} [tier: ${result.tier}, confidence: ${result.confidence}, role: ${result.is_role_based}]`)
      console.log(`   All candidates: ${result.candidates?.join(', ')}`)

      if (p.email && p.email_source === 'hunter') {
        const same = p.email === result.email
        console.log(`   vs Hunter: ${same ? 'SAME' : 'DIFFERENT'} (Hunter: ${p.email}, Pattern: ${result.email})`)
      }
    } else {
      console.log(`   Pattern: NOT FOUND (MX: ${result.mx_verified ? 'yes' : 'no'})`)
    }

    console.log('')
  }
}

main().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
