/**
 * Push mockup_ready prospects to Instantly campaign.
 *
 * Reads prospects where:
 *   pipeline_state = 'mockup_ready'
 *   instantly_lead_id IS NULL (not yet pushed)
 *   email IS NOT NULL
 *
 * Deduplication: max 1 lead per email domain per batch.
 * If multiple prospects share a domain, pick by:
 *   1. Highest email_confidence (Hunter score)
 *   2. Personal email over role-based
 *   3. Most recently updated
 *
 * Sort: freshest reviews first (updated_at DESC via created_at proxy).
 *
 * Usage:
 *   npm run push-instantly
 *   npx tsx scripts/push-to-instantly.ts --dry-run   (preview, no API calls)
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getSupabaseServer } from '../src/lib/supabase/server'
import { createLead, prospectToLead } from './lib/instantly'

const CAMPAIGN_ID = process.env.INSTANTLY_CAMPAIGN_ID
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  if (!CAMPAIGN_ID) {
    console.error('ERROR: INSTANTLY_CAMPAIGN_ID not set in .env.local')
    console.error('Create a campaign in Instantly UI, copy the UUID, add to .env.local')
    process.exit(1)
  }

  if (!process.env.INSTANTLY_API_KEY) {
    console.error('ERROR: INSTANTLY_API_KEY not set')
    process.exit(1)
  }

  const sb = getSupabaseServer()
  if (!sb) {
    console.error('ERROR: Supabase not configured')
    process.exit(1)
  }

  console.log(`\n═══ Push to Instantly ═══`)
  console.log(`  Campaign: ${CAMPAIGN_ID}`)
  console.log(`  Dry run: ${DRY_RUN}\n`)

  // Fetch mockup_ready prospects not yet pushed
  const { data: prospects } = await sb
    .from('prospects')
    .select('id, slug, email, owner_first_name, owner_last_name, business_name, website, phone, mockup_url, mockup_image_url, email_confidence, email_is_role_based, created_at')
    .eq('pipeline_state', 'mockup_ready')
    .is('instantly_lead_id', null)
    .not('email', 'is', null)
    .order('created_at', { ascending: false })

  if (!prospects || prospects.length === 0) {
    console.log('No prospects to push. All mockup_ready prospects are either already pushed or missing email.')
    return
  }

  console.log(`Found ${prospects.length} prospect(s) ready to push.\n`)

  // Dedupe by email domain — max 1 per domain per batch
  const byDomain = new Map<string, typeof prospects[0]>()
  const skippedDupes: string[] = []

  for (const p of prospects) {
    const domain = p.email!.split('@')[1]?.toLowerCase()
    if (!domain) continue

    const existing = byDomain.get(domain)
    if (!existing) {
      byDomain.set(domain, p)
      continue
    }

    // Keep the better one: higher confidence > personal > fresher
    const existingScore = (existing.email_confidence || 0) + (existing.email_is_role_based ? 0 : 50)
    const newScore = (p.email_confidence || 0) + (p.email_is_role_based ? 0 : 50)

    if (newScore > existingScore) {
      skippedDupes.push(existing.slug!)
      byDomain.set(domain, p)
    } else {
      skippedDupes.push(p.slug!)
    }
  }

  const afterDedup = [...byDomain.values()]

  if (skippedDupes.length > 0) {
    console.log(`Deduped: ${skippedDupes.length} prospect(s) skipped (same domain as higher-priority lead):`)
    for (const s of skippedDupes) console.log(`  ⊘ ${s}`)
    console.log()
  }

  // Send-history guard: skip any prospect with prior send history
  // Belt-and-suspenders protection against duplicate outreach, independent of state or instantly_lead_id
  const SEND_EVENTS = ['state:sent', 'instantly:email_sent', 'instantly_lead_created']
  const toPush: typeof afterDedup = []
  const skippedHistory: string[] = []

  for (const p of afterDedup) {
    const { data: sendEvents } = await sb
      .from('prospect_events')
      .select('event')
      .eq('prospect_id', p.id)
      .in('event', SEND_EVENTS)
      .limit(1)

    if (sendEvents && sendEvents.length > 0) {
      console.log(`  ⚠ Skipping ${p.slug} — prior send history (${sendEvents[0].event}), preventing duplicate outreach`)
      skippedHistory.push(p.slug!)
      continue
    }
    toPush.push(p)
  }

  if (skippedHistory.length > 0) {
    console.log(`\nSend-history guard: ${skippedHistory.length} prospect(s) skipped to prevent duplicate outreach.\n`)
  }

  console.log(`Pushing ${toPush.length} prospect(s):\n`)

  let pushed = 0
  let failed = 0

  for (const p of toPush) {
    const lead = prospectToLead(p as any)
    console.log(`  ▸ ${p.business_name} (${p.slug})`)
    console.log(`    email: ${p.email}`)
    console.log(`    mockup: https://backlitsupply.com/for/${p.slug}`)

    if (DRY_RUN) {
      console.log(`    [dry-run] Would push to Instantly\n`)
      continue
    }

    try {
      const result = await createLead(lead, CAMPAIGN_ID)
      const leadId = result.id

      // Write lead ID back to prospect
      await sb.from('prospects').update({ instantly_lead_id: leadId }).eq('id', p.id)

      // Log audit event
      await sb.from('prospect_events').insert({
        prospect_id: p.id,
        event: 'instantly_lead_created',
        payload: {
          instantly_lead_id: leadId,
          campaign_id: CAMPAIGN_ID,
          email: p.email,
          custom_variables: lead.custom_variables,
        },
      })

      console.log(`    ✅ Pushed (lead_id: ${leadId})\n`)
      pushed++

      // Small delay between pushes to avoid rate limits
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`    ❌ Failed: ${(err as Error).message?.slice(0, 100)}\n`)
      failed++
    }
  }

  console.log(`═══ Done ═══`)
  console.log(`  Pushed: ${pushed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Skipped (dedup): ${skippedDupes.length}`)
  if (DRY_RUN) console.log(`  (Dry run — no API calls made)`)
}

main().catch(err => {
  console.error('Push failed:', err)
  process.exit(1)
})
