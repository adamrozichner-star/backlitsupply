/**
 * Test harness for the reply notification pipeline.
 *
 * Usage: npm run test:reply -- <prospect_slug>
 *
 * Calls the REAL handleReply() code path with dryRun=true
 * (skips dedup + event logging, but sends real Haiku + Telegram calls).
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getSupabaseServer } from '../src/lib/supabase/server'
import { handleReply } from '../src/lib/reply-handler'

const TEST_REPLY_BODY = `Hi Adam, this looks great — how much for a 36 inch backlit sign installed?`

async function main() {
  const slug = process.argv[2]
  if (!slug) {
    console.error('Usage: npm run test:reply -- <prospect_slug>')
    process.exit(1)
  }

  console.log('\n=== Reply Notification Test ===\n')

  // Step 1: Load prospect
  const sb = getSupabaseServer()
  if (!sb) {
    console.error('\u2717 Supabase not configured')
    process.exit(1)
  }

  const { data: prospect, error } = await sb.from('prospects')
    .select('id, slug, business_name, owner_first_name, pipeline_state, instantly_lead_id')
    .eq('slug', slug)
    .single()

  if (!prospect || error) {
    console.error(`\u2717 Prospect "${slug}" not found`)
    process.exit(1)
  }

  console.log(`\u2713 Loaded prospect: ${prospect.business_name} (${prospect.slug})`)
  console.log(`  State: ${prospect.pipeline_state}`)
  console.log(`  Instantly lead ID: ${prospect.instantly_lead_id || '(none)'}`)
  console.log(`  Owner: ${prospect.owner_first_name || '(unknown)'}`)
  console.log(`\n  Test reply body: "${TEST_REPLY_BODY}"\n`)

  // Step 2: Check env vars
  const envChecks = [
    ['ANTHROPIC_API_KEY', !!process.env.ANTHROPIC_API_KEY],
    ['TELEGRAM_BOT_TOKEN', !!process.env.TELEGRAM_BOT_TOKEN],
    ['TELEGRAM_CHAT_ID', !!process.env.TELEGRAM_CHAT_ID],
  ] as const

  let envOk = true
  for (const [name, ok] of envChecks) {
    console.log(`  ${ok ? '\u2713' : '\u2717'} ${name} ${ok ? 'set' : 'MISSING'}`)
    if (!ok) envOk = false
  }
  if (!envOk) {
    console.error('\nMissing env vars — cannot run test')
    process.exit(1)
  }

  console.log('')

  // Step 3: Call handleReply with dryRun + overrideReplyText
  const start = Date.now()
  let result
  try {
    result = await handleReply(prospect.id, prospect.instantly_lead_id || 'test-lead-id', {
      dryRun: true,
      overrideReplyText: TEST_REPLY_BODY,
    })
  } catch (err) {
    console.error(`\u2717 handleReply threw: ${(err as Error).message}`)
    process.exit(1)
  }
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  // Step 4: Report results
  console.log(`--- Results (${elapsed}s) ---\n`)
  console.log(`  ${result.classification ? '\u2713' : '\u2717'} Haiku classified: ${result.classification}`)
  console.log(`  ${result.notified ? '\u2713' : '\u2717'} Posted to Telegram${result.telegramMessageId ? ` msg_id=${result.telegramMessageId}` : ''}`)
  console.log(`  ${result.deduped ? '\u26A0' : '\u2713'} Dedup: ${result.deduped ? 'SKIPPED (already classified)' : 'not triggered (dryRun bypasses)'}`)
  console.log(`  \u2713 Event logging: skipped (dryRun=true)`)

  // Step 5: Verify event was NOT logged (dryRun)
  const { data: events } = await sb.from('prospect_events')
    .select('id, event, created_at')
    .eq('prospect_id', prospect.id)
    .eq('event', 'reply_classified')
    .order('created_at', { ascending: false })
    .limit(1)

  const latestEvent = events?.[0]
  if (latestEvent) {
    const eventAge = Date.now() - new Date(latestEvent.created_at).getTime()
    if (eventAge < 10000) {
      console.log(`  \u2717 UNEXPECTED: reply_classified event was logged despite dryRun`)
    } else {
      console.log(`  \u2713 No new reply_classified event (dryRun working correctly)`)
    }
  } else {
    console.log(`  \u2713 No reply_classified events exist (dryRun working correctly)`)
  }

  console.log('')

  if (result.notified && result.classification === 'PRICING_QUESTION') {
    console.log('=== ALL CHECKS PASSED ===')
    console.log('Check Telegram group for the notification.')
    console.log('Tap "Mark Handled" to test callback flow.\n')
  } else if (result.notified) {
    console.log(`=== PARTIAL PASS: classified as ${result.classification} (expected PRICING_QUESTION) ===`)
    console.log('Telegram notification was sent. Check group.\n')
  } else {
    console.log('=== FAILED: Telegram notification was not sent ===\n')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
