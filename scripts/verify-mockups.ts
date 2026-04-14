/**
 * Mockup verification — fetch the production /for/{slug} page for every
 * mockup_ready+ prospect and confirm the mockup image actually renders.
 *
 * For each prospect:
 *   1. GET https://backlitsupply.com/for/{slug}
 *   2. Parse HTML, find mockup <img> tag
 *   3. GET the image src URL
 *   4. Verify: status 200, content-type image/*, content-length > 10KB
 *   5. Write a mockup_verified or mockup_broken event
 *
 * Exit code: 1 if ANY prospect has a broken mockup, 0 otherwise.
 *
 * Usage:
 *   npm run verify
 *   npx tsx scripts/verify-mockups.ts --slug=ulala-med-spa-austin  (single prospect)
 *   VERIFY_BASE_URL=http://localhost:3000 npm run verify            (local dev)
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getSupabaseServer } from '../src/lib/supabase/server'

const BASE_URL = process.env.VERIFY_BASE_URL || 'https://backlitsupply.com'
const MIN_IMAGE_BYTES = 10 * 1024  // 10KB — anything smaller is a 404 placeholder or broken gif
const VERIFIABLE_STATES = ['mockup_ready', 'sent', 'opened', 'replied', 'positive', 'booked', 'won']

export interface VerifyResult {
  slug: string
  state: string
  mockup_url: string | null
  page_status: number
  image_url: string | null
  image_status: number | null
  image_content_type: string | null
  image_size: number | null
  ok: boolean
  reason?: string
}

function parseArgs(): { slug?: string } {
  const args: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--(\w[\w-]*)=(.+)$/)
    if (m) args[m[1]] = m[2]
  }
  return args
}

export async function verifyOne(slug: string, state: string, mockupUrl: string | null): Promise<VerifyResult> {
  const result: VerifyResult = {
    slug, state, mockup_url: mockupUrl,
    page_status: 0, image_url: null, image_status: null,
    image_content_type: null, image_size: null,
    ok: false,
  }

  try {
    // 1. Fetch the personalized page
    const pageRes = await fetch(`${BASE_URL}/for/${slug}`, { signal: AbortSignal.timeout(15000) })
    result.page_status = pageRes.status
    if (!pageRes.ok) {
      result.reason = `page status ${pageRes.status}`
      return result
    }
    const html = await pageRes.text()

    // 2. Find the mockup image src
    // Next.js <Image> component transforms <img src="/mockups/foo.webp" unoptimized />
    // into plain <img src="/mockups/foo.webp" ...>. Look for /mockups/{slug}.webp OR
    // the _next/image optimized URL wrapping it.
    const patterns: RegExp[] = [
      /src=["']([^"']*\/mockups\/[^"']+\.webp[^"']*)["']/i,
      /src=["'](\/_next\/image\?url=[^"']*mockups[^"']+)["']/i,
    ]
    let imageUrl: string | null = null
    for (const re of patterns) {
      const m = html.match(re)
      if (m) { imageUrl = m[1].replace(/&amp;/g, '&'); break }
    }

    if (!imageUrl) {
      result.reason = 'no mockup <img> tag found in HTML'
      return result
    }
    if (imageUrl.startsWith('/')) imageUrl = BASE_URL + imageUrl
    result.image_url = imageUrl

    // 3. Fetch the image
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    result.image_status = imgRes.status
    result.image_content_type = imgRes.headers.get('content-type')

    if (!imgRes.ok) {
      result.reason = `image status ${imgRes.status}`
      return result
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer())
    result.image_size = buffer.length

    // 4. Content-type validation
    if (!result.image_content_type?.startsWith('image/')) {
      result.reason = `non-image content-type: ${result.image_content_type}`
      return result
    }

    // 5. Size validation
    if (buffer.length < MIN_IMAGE_BYTES) {
      result.reason = `image too small: ${buffer.length}B < ${MIN_IMAGE_BYTES}B`
      return result
    }

    result.ok = true
    return result
  } catch (err) {
    result.reason = `fetch error: ${(err as Error).message?.slice(0, 80)}`
    return result
  }
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
    const r = await verifyOne(p.slug!, p.pipeline_state!, p.mockup_url)
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

// Only run main() if invoked directly (not when imported for unit tests)
if (require.main === module) {
  main().catch(err => {
    console.error('Verification failed:', err)
    process.exit(2)
  })
}
