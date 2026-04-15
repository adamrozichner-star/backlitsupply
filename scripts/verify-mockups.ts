/**
 * CLI mockup verification runner. Uses the shared verifyOne() from
 * src/lib/mockup-verification.ts so admin actions and this script
 * share identical verification logic.
 *
 * Usage:
 *   npm run verify
 *   npx tsx scripts/verify-mockups.ts --slug=ulala-med-spa-austin  (single prospect)
 *   VERIFY_BASE_URL=http://localhost:3000 npm run verify            (local dev)
 *
 * Exit 1 if any prospect has a broken mockup.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getSupabaseServer } from '../src/lib/supabase/server'
import { verifyOne, type VerifyResult } from '../src/lib/mockup-verification'

export { verifyOne } from '../src/lib/mockup-verification'
export type { VerifyResult } from '../src/lib/mockup-verification'

const BASE_URL = process.env.VERIFY_BASE_URL || 'https://backlitsupply.com'
const VERIFIABLE_STATES = ['mockup_ready', 'sent', 'opened', 'replied', 'positive', 'booked', 'won']

function parseArgs(): { slug?: string } {
  const args: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--(\w[\w-]*)=(.+)$/)
    if (m) args[m[1]] = m[2]
  }
  return args
}

async function writeVerificationEvent(prospectId: string, result: VerifyResult): Promise<void> {
  try {
    const sb = getSupabaseServer()
    if (!sb) return
    await sb.from('prospect_events').insert({
      prospect_id: prospectId,
      event: result.ok ? 'mockup_verified' : 'mockup_broken',
      payload: {
        url: result.image_url,
        page_status: result.page_status,
        image_status: result.image_status,
        content_type: result.image_content_type,
        size: result.image_size,
        reason: result.reason,
        base_url: BASE_URL,
      },
    })
  } catch (err) {
    console.error('[verify] Failed to write event:', err)
  }
}

async function main() {
  const args = parseArgs()
  const sb = getSupabaseServer()
  if (!sb) {
    console.error('No Supabase — set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY')
    process.exit(1)
  }

  let q = sb.from('prospects').select('id, slug, pipeline_state, mockup_url').in('pipeline_state', VERIFIABLE_STATES)
  if (args.slug) q = q.eq('slug', args.slug)
  const { data: prospects } = await q.order('pipeline_state')

  if (!prospects || prospects.length === 0) {
    console.log('No mockup_ready+ prospects found.')
    process.exit(0)
  }

  console.log(`\nVerifying ${prospects.length} prospect(s) against ${BASE_URL}...\n`)

  const results: (VerifyResult & { id: string })[] = []
  for (const p of prospects) {
    const r = await verifyOne(p.slug!, p.pipeline_state!, p.mockup_url, BASE_URL)
    results.push({ ...r, id: p.id })
    await writeVerificationEvent(p.id, r)
    const icon = r.ok ? '✅' : '❌'
    const detail = r.ok
      ? `${((r.image_size || 0) / 1024).toFixed(0)}KB ${r.image_content_type}`
      : r.reason || 'unknown'
    console.log(`${icon}  ${p.slug!.padEnd(55)} [${p.pipeline_state}]  ${detail}`)
  }

  const broken = results.filter(r => !r.ok)
  console.log('\n' + '─'.repeat(80))
  console.log(`Result: ${results.length - broken.length}/${results.length} passed${broken.length > 0 ? `, ${broken.length} BROKEN` : ''}`)

  if (broken.length > 0) {
    console.log('\nBroken prospects:')
    for (const b of broken) console.log(`  ❌ ${b.slug} — ${b.reason}`)
    process.exit(1)
  }
  process.exit(0)
}

if (require.main === module) {
  main().catch(err => {
    console.error('Verification failed:', err)
    process.exit(2)
  })
}
