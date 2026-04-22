/**
 * Dry-run test: compare old vs new logo extraction for 15 prospects.
 * Re-fetches each prospect's website and runs both old and new extraction.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import * as cheerio from 'cheerio'
import sharp from 'sharp'
import { getSupabaseServer } from '../src/lib/supabase/server'

// ─── Content-type scoring ───────────────────────────────

const FORMAT_SCORE: Record<string, number> = {
  'image/svg+xml': 10,
  'image/png': 8,
  'image/webp': 5,
  'image/jpeg': 2,
  'image/x-icon': 1,
  'image/vnd.microsoft.icon': 1,
}

const VALID_FORMATS = new Set(Object.keys(FORMAT_SCORE))

// ─── New extraction logic ───────────────────────────────

interface LogoCandidate {
  url: string
  tier: number       // 1-6 (1 = best)
  tierName: string
  formatScore: number
}

interface ExtractionTrace {
  candidates: Array<{
    url: string
    tier: number
    tierName: string
    formatScore: number
    width?: number
    height?: number
    ratio?: number
    rejected?: string
  }>
  winner: { url: string; tier: number; tierName: string; width: number; height: number; formatScore: number } | null
}

function resolveUrl(url: string, base: string): string {
  try { return new URL(url, base).href } catch { return url }
}

function extractCandidatesNew(html: string, baseUrl: string): LogoCandidate[] {
  const $ = cheerio.load(html)
  const candidates: LogoCandidate[] = []
  const seen = new Set<string>()

  function add(url: string, tier: number, tierName: string) {
    const resolved = resolveUrl(url, baseUrl)
    if (seen.has(resolved)) return
    seen.add(resolved)
    candidates.push({ url: resolved, tier, tierName, formatScore: 0 })
  }

  // Tier 1: <img> with "logo" in src, alt, class, or id
  $('img').each((_, el) => {
    const src = $(el).attr('src') || ''
    const alt = $(el).attr('alt') || ''
    const cls = $(el).attr('class') || ''
    const id = $(el).attr('id') || ''
    if (/logo/i.test(src + alt + cls + id) && src) {
      add(src, 1, 'logo-attr')
    }
  })

  // Tier 2: <img> in <header> or <nav>
  $('header img, .header img, #header img, nav img, .nav img, .navbar img').each((_, el) => {
    const src = $(el).attr('src')
    if (src) add(src, 2, 'header-nav')
  })

  // Tier 3: High-res favicon chain (512→192→96→32)
  for (const size of ['512x512', '192x192', '96x96', '32x32']) {
    $(`link[rel="icon"][sizes="${size}"]`).each((_, el) => {
      const href = $(el).attr('href')
      if (href) add(href, 3, `favicon-${size}`)
    })
  }
  $('link[rel="icon"]:not([sizes])').each((_, el) => {
    const href = $(el).attr('href')
    if (href) add(href, 3, 'favicon-default')
  })

  // Tier 4: apple-touch-icon
  $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) add(href, 4, 'apple-touch-icon')
  })

  // Tier 5: SVG in header/nav (not <img>, but inline or <object>)
  $('header svg, nav svg').each((_, el) => {
    // Can't extract URL from inline SVG easily; skip for now
  })

  // Tier 6: og:image (LAST RESORT)
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) add(ogImage, 6, 'og:image')

  // twitter:image (same tier as og:image)
  const twImage = $('meta[name="twitter:image"]').attr('content')
  if (twImage) add(twImage, 6, 'twitter:image')

  return candidates.sort((a, b) => a.tier - b.tier)
}

async function validateAndScore(
  candidates: LogoCandidate[],
  minSize: number,
): Promise<ExtractionTrace> {
  const trace: ExtractionTrace = { candidates: [], winner: null }

  for (const c of candidates) {
    const entry: ExtractionTrace['candidates'][0] = {
      url: c.url,
      tier: c.tier,
      tierName: c.tierName,
      formatScore: 0,
    }

    try {
      const res = await fetch(c.url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) { entry.rejected = `http-${res.status}`; trace.candidates.push(entry); continue }

      const contentType = res.headers.get('content-type')?.split(';')[0] || ''
      entry.formatScore = FORMAT_SCORE[contentType] || 0

      if (!VALID_FORMATS.has(contentType) && !contentType.startsWith('image/')) {
        entry.rejected = `bad-content-type: ${contentType}`
        trace.candidates.push(entry)
        continue
      }

      // SVGs are always valid logos
      if (contentType === 'image/svg+xml') {
        entry.width = 500
        entry.height = 500
        entry.ratio = 1
        entry.formatScore = 10
        trace.candidates.push(entry)
        if (!trace.winner) trace.winner = { url: c.url, tier: c.tier, tierName: c.tierName, width: 500, height: 500, formatScore: 10 }
        continue
      }

      const buffer = Buffer.from(await res.arrayBuffer())
      const meta = await sharp(buffer).metadata()
      if (!meta.width || !meta.height) { entry.rejected = 'no-dimensions'; trace.candidates.push(entry); continue }

      entry.width = meta.width
      entry.height = meta.height
      entry.ratio = +(meta.width / meta.height).toFixed(2)

      // Dimension filter: reject >1000px in either dimension
      if (meta.width > 1000 || meta.height > 1000) {
        entry.rejected = `too-large: ${meta.width}x${meta.height}`
        trace.candidates.push(entry)
        continue
      }

      // Aspect ratio filter: reject outside 1:3 to 3:1
      const ratio = meta.width / meta.height
      if (ratio > 3 || ratio < 1 / 3) {
        entry.rejected = `bad-ratio: ${ratio.toFixed(2)}`
        trace.candidates.push(entry)
        continue
      }

      // Min size
      if (meta.width < minSize) {
        entry.rejected = `too-small: ${meta.width}px < ${minSize}px`
        trace.candidates.push(entry)
        continue
      }

      trace.candidates.push(entry)

      // Pick winner: first valid candidate (already tier-sorted), break ties by format score
      if (!trace.winner || c.tier < trace.winner.tier || (c.tier === trace.winner.tier && entry.formatScore > trace.winner.formatScore)) {
        trace.winner = {
          url: c.url, tier: c.tier, tierName: c.tierName,
          width: meta.width, height: meta.height,
          formatScore: entry.formatScore,
        }
      }
    } catch (err) {
      entry.rejected = `fetch-error: ${(err as Error).message?.slice(0, 40)}`
      trace.candidates.push(entry)
    }
  }

  return trace
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  const sb = getSupabaseServer()!
  const { data: prospects } = await sb
    .from('prospects')
    .select('slug, logo_url, website, business_name')
    .not('mockup_url', 'is', null)
    .not('website', 'is', null)
    .order('created_at', { ascending: false })
    .limit(15)

  console.log(`Testing new extraction on ${prospects?.length} prospects...\n`)
  console.log('Prospect'.padEnd(42) + 'Old Logo Tier'.padEnd(16) + 'New Logo Tier'.padEnd(16) + 'What Changed')
  console.log('─'.repeat(100))

  for (const p of prospects || []) {
    try {
      const res = await fetch(p.website!, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) { console.log(p.slug?.slice(0, 40)?.padEnd(42) + 'FETCH FAILED'); continue }
      const html = await res.text()

      const newCandidates = extractCandidatesNew(html, p.website!)
      const trace = await validateAndScore(newCandidates, 120)

      const oldUrl = p.logo_url || '(none)'
      const newUrl = trace.winner?.url || '(none)'
      const same = oldUrl === newUrl

      // Classify old logo
      let oldTier = '?'
      if (/og.image|social|share/i.test(oldUrl)) oldTier = 'og:image'
      else if (/favicon|apple-touch|icon/i.test(oldUrl)) oldTier = 'favicon'
      else if (/logo/i.test(oldUrl)) oldTier = 'logo-attr'
      else if (/header|nav/i.test(oldUrl)) oldTier = 'header'
      else oldTier = 'unknown'

      const newTier = trace.winner?.tierName || '(none)'
      const change = same ? '✓ same' : `CHANGED → ${newTier} (${trace.winner?.width}x${trace.winner?.height})`

      console.log(
        (p.slug || '').slice(0, 40).padEnd(42) +
        oldTier.padEnd(16) +
        newTier.padEnd(16) +
        change
      )
    } catch {
      console.log((p.slug || '').slice(0, 40).padEnd(42) + 'ERROR')
    }
  }
}

main().catch(console.error)
