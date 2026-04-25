/**
 * Test bounce rate monitoring with mock data.
 *
 * Creates temporary test prospects with email_source='pattern',
 * inserts mock sent + bounced events, runs checkBounceRate(),
 * then cleans up.
 *
 * Usage: npm run test:bounce
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getSupabaseServer } from '../src/lib/supabase/server'
import { checkBounceRate } from '../src/lib/bounce-monitor'

const MOCK_TAG = 'bounce_monitor_test'

async function createMockProspects(sb: NonNullable<ReturnType<typeof getSupabaseServer>>, count: number): Promise<string[]> {
  const prospects = Array.from({ length: count }, (_, i) => ({
    slug: `bounce-test-${i}-${Date.now()}`,
    business_name: `Bounce Test ${i}`,
    email: `test${i}@example.com`,
    email_source: 'pattern',
    pipeline_state: 'sent',
    source: MOCK_TAG,
  }))

  const { data, error } = await sb.from('prospects').insert(prospects).select('id')
  if (error) throw new Error(`Failed to create mock prospects: ${error.message}`)
  return (data || []).map(p => p.id)
}

async function insertMockEvents(
  sb: NonNullable<ReturnType<typeof getSupabaseServer>>,
  prospectIds: string[],
  sentCount: number,
  bouncedCount: number,
) {
  const now = new Date()
  const events = []

  for (let i = 0; i < sentCount && i < prospectIds.length; i++) {
    events.push({
      prospect_id: prospectIds[i],
      event: 'state:sent',
      payload: { actor: MOCK_TAG, mock: true },
      created_at: new Date(now.getTime() - i * 60000).toISOString(),
    })
  }

  for (let i = 0; i < bouncedCount && i < prospectIds.length; i++) {
    events.push({
      prospect_id: prospectIds[i],
      event: 'state:bounced',
      payload: { actor: MOCK_TAG, mock: true },
      created_at: new Date(now.getTime() - i * 60000).toISOString(),
    })
  }

  await sb.from('prospect_events').insert(events)
}

async function cleanup(sb: NonNullable<ReturnType<typeof getSupabaseServer>>) {
  // Delete mock prospects (cascades to their events via FK)
  await sb.from('prospects').delete().eq('source', MOCK_TAG)

  // Delete bounce_alert events from this test
  const since = new Date(Date.now() - 120000).toISOString()
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

  await cleanup(sb)

  // Create 60 mock prospects with email_source='pattern'
  console.log('Setting up: 60 mock prospects (email_source=pattern)')
  const ids = await createMockProspects(sb, 60)
  console.log(`  Created ${ids.length} test prospects\n`)

  // Test 1: 60 sent, 5 bounced = 8.3% → should alert
  console.log('Test 1: 8.3% bounce rate (60 sent, 5 bounced, pattern-only)')
  await insertMockEvents(sb, ids, 60, 5)

  const result1 = await checkBounceRate()
  console.log(`  Rate: ${(result1.rate * 100).toFixed(1)}%`)
  console.log(`  Sent: ${result1.sent}, Bounced: ${result1.bounced}`)
  console.log(`  Alerted: ${result1.alerted ? '\u2713 YES' : '\u2717 NO'}`)

  if (!result1.alerted) {
    console.error(`  FAIL: Expected alert (reason: ${result1.skipped_reason || 'unknown'})`)
    await cleanup(sb)
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
    await cleanup(sb)
    process.exit(1)
  }
  console.log('  \u2713 Dedup working correctly\n')

  // Test 3: Verify event logged
  const { data: alertEvents } = await sb.from('prospect_events')
    .select('id, payload, created_at')
    .eq('event', 'bounce_alert')
    .order('created_at', { ascending: false })
    .limit(1)

  console.log('Test 3: Event logging')
  if (alertEvents && alertEvents.length > 0) {
    console.log(`  \u2713 bounce_alert event logged`)
    console.log(`  Payload: ${JSON.stringify(alertEvents[0].payload)}`)
  } else {
    console.log('  \u2717 No bounce_alert event found')
  }

  // Cleanup
  console.log('\nCleaning up mock data...')
  await cleanup(sb)
  console.log('Done.\n')

  console.log('=== ALL TESTS PASSED ===')
}

main().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
