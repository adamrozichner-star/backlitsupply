/**
 * One-time backfill: tag existing cost:replicate events that lack prediction_id
 * with cost_estimated: true so the dashboard can flag them.
 *
 * If prediction_id IS present, fetch real cost from Replicate API and update.
 *
 * Usage: npx tsx scripts/backfill-replicate-costs.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getSupabaseServer } from '../src/lib/supabase/server'
import Replicate from 'replicate'

async function main() {
  const sb = getSupabaseServer()
  if (!sb) {
    console.error('No Supabase')
    process.exit(1)
  }

  const { data: events } = await sb
    .from('prospect_events')
    .select('id, event, payload')
    .eq('event', 'cost:replicate')

  if (!events || events.length === 0) {
    console.log('No cost:replicate events found.')
    return
  }

  console.log(`Found ${events.length} cost:replicate events\n`)

  const token = process.env.REPLICATE_API_TOKEN
  const client = token ? new Replicate({ auth: token }) : null

  let updated = 0
  let tagged = 0

  for (const e of events) {
    const payload = e.payload as Record<string, unknown>
    const predictionId = payload.prediction_id as string | undefined

    if (predictionId && client) {
      // Try to fetch real cost
      try {
        const prediction = await client.predictions.get(predictionId)
        const rawCost = (prediction as unknown as Record<string, unknown>).cost
        if (typeof rawCost === 'number' && rawCost > 0) {
          await sb.from('prospect_events').update({
            payload: { ...payload, usd: rawCost, cost_estimated: false, original_estimate: payload.usd },
          }).eq('id', e.id)
          console.log(`  ✅ ${predictionId.slice(0, 8)} — real cost: $${rawCost.toFixed(4)}`)
          updated++
          continue
        }
      } catch {
        // API call failed — fall through to tag as estimated
      }
    }

    // No prediction_id or couldn't fetch — tag as estimated
    if (!payload.cost_estimated) {
      await sb.from('prospect_events').update({
        payload: { ...payload, cost_estimated: true },
      }).eq('id', e.id)
      tagged++
      console.log(`  ⚠ ${e.id.slice(0, 8)} — tagged cost_estimated: true (usd: $${payload.usd})`)
    }
  }

  console.log(`\nDone. ${updated} updated with real cost, ${tagged} tagged as estimated.`)
}

main().catch(err => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
