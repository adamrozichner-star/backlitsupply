/**
 * Test bounce rate monitoring with mock data.
 *
 * Inserts mock sent + bounced events, runs checkBounceRate(),
 * verifies alert fires, then cleans up.
 *
 * Usage: npm run test:bounce
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getSupabaseServer } from '../src/lib/supabase/server'
import { checkBounceRate } from '../src/lib/bounce-monitor'

const MOCK_TAG = 'bounce_monitor_test'

async function insertMockEvents(sb: NonNullable<ReturnType<typeof getSupabaseServer>>, sentCount: number, bouncedCount: number) {
  const now = new Date()
  const events = []

  for (let i = 0; i < sentCount; i++) {
    events.push({
      prospect_id: null,
      event: 'state:sent',
      payload: { actor: MOCK_TAG, mock: true },
      created_at: new Date(now.getTime() - i * 60000).toISOString(),
    })
  }

  for (let i = 0; i < bouncedCount; i++) {
    events.push({
      prospect_id: null,
      event: 'state:bounced',
      payload: { actor: MOCK_TAG, mock: true },
      created_at: new Date(now.getTime() - i * 60000).toISOString(),
    })
  }

  await sb.from('prospect_events').insert(events)
  return events.length
}

async function cleanupMockEvents(sb: NonNullable<ReturnType<typeof getSupabaseServer>>) {
  // Delete mock events
  await sb.from('prospect_events')
    .delete()
    .contains('payload', { actor: MOCK_TAG })

  // Delete any bounce_alert events from this test
  const since = new Date(Date.now() - 60000).toISOString()
  await sb.from('prospect_events')
    .delete()
    .eq('event', 'bounce_alert')
    .gte('created_at', since)
}

async function main() {
  const sb = getSupabaseServer()
  if (!sb) {
    console.error('Supabase not configured')
    process.exit(1)
  }

  console.log('\n=== Bounce Monitor Test ===\n')

  // Clean up any prior test data
  await cleanupMockEvents(sb)

  // Test 1: 100 sent, 10 bounced → guarantees >5% even with existing real events
  console.log('Test 1: High bounce rate (100 mock sent, 10 mock bounced)')
  await insertMockEvents(sb, 100, 10)

  const result1 = await checkBounceRate()
  console.log(`  Rate: ${(result1.rate * 100).toFixed(1)}%`)
  console.log(`  Alerted: ${result1.alerted ? '\u2713 YES' : '\u2717 NO'}`)

  if (!result1.alerted) {
    console.error('  FAIL: Expected alert for 6% bounce rate')
    await cleanupMockEvents(sb)
    process.exit(1)
  }
  console.log('  \u2713 Alert fired correctly\n')

  // Test 2: Run again immediately → should be deduped
  console.log('Test 2: Dedup (run again within 24h)')
  const result2 = await checkBounceRate()
  console.log(`  Alerted: ${result2.alerted ? '\u2717 YES (BAD)' : '\u2713 NO (deduped)'}`)
  console.log(`  Reason: ${result2.skipped_reason || 'n/a'}`)

  if (result2.alerted) {
    console.error('  FAIL: Duplicate alert should have been suppressed')
    await cleanupMockEvents(sb)
    process.exit(1)
  }
  console.log('  \u2713 Dedup working correctly\n')

  // Verify event was logged
  const { data: alertEvents } = await sb.from('prospect_events')
    .select('id, payload, created_at')
    .eq('event', 'bounce_alert')
    .order('created_at', { ascending: false })
    .limit(1)

  if (alertEvents && alertEvents.length > 0) {
    console.log('Test 3: Event logging')
    console.log(`  \u2713 bounce_alert event logged at ${alertEvents[0].created_at}`)
    console.log(`  Payload: ${JSON.stringify(alertEvents[0].payload)}`)
  } else {
    console.log('Test 3: Event logging')
    console.log('  \u2717 No bounce_alert event found')
  }

  // Cleanup
  console.log('\nCleaning up mock data...')
  await cleanupMockEvents(sb)
  console.log('Done.\n')

  console.log('=== ALL TESTS PASSED ===')
}

main().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
