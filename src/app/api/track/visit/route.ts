/**
 * Tracking pixel endpoint.
 * GET /api/track/visit?slug=xxx — returns 1x1 transparent gif, writes prospect_event.
 *
 * Features:
 * - 1h per-slug dedupe via 'visited' cookie
 * - Bot/previewer filter (Googlebot, Slackbot, LinkedInBot, GoogleImageProxy, etc.)
 * - IP truncation (first 3 octets IPv4, first 4 segments IPv6)
 * - Auto-transition: if prospect.pipeline_state === 'sent', move to 'opened'
 *   and write state:opened event with actor='tracking_pixel'
 * - Always returns the gif, even if write is skipped
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1x1 transparent GIF
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

const COOKIE_NAME = 'visited'
const DEDUPE_WINDOW_MS = 60 * 60 * 1000  // 1 hour

// Bot/previewer user agent patterns
const BOT_PATTERNS = [
  /googlebot/i,
  /googleimageproxy/i,
  /mediapartners-google/i,
  /google-read-aloud/i,
  /slackbot/i,
  /discordbot/i,
  /linkedinbot/i,
  /twitterbot/i,
  /facebookexternalhit/i,
  /bingbot/i,
  /yandex/i,
  /duckduckbot/i,
  /baiduspider/i,
  /applebot/i,
  /whatsapp/i,
  /telegrambot/i,
  /embedly/i,
  /iframely/i,
  /skypeuripreview/i,
  /curl\//i,
  /wget\//i,
  /headlesschrome/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /chrome-lighthouse/i,
]

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true  // suspicious — treat as bot
  return BOT_PATTERNS.some(re => re.test(userAgent))
}

function truncateIp(ip: string | null): string | null {
  if (!ip) return null
  const clean = ip.split(',')[0].trim()
  if (!clean) return null
  // IPv4 (a.b.c.d → a.b.c.0)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    const parts = clean.split('.')
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`
  }
  // IPv6 (keep first 4 segments, mask rest as ::)
  if (clean.includes(':')) {
    const parts = clean.split(':').filter(Boolean)
    if (parts.length >= 4) return `${parts.slice(0, 4).join(':')}::`
    return clean
  }
  return null
}

function parseVisitedCookie(raw: string | undefined): Record<string, number> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, number>
    // Purge expired entries
    const now = Date.now()
    const cleaned: Record<string, number> = {}
    for (const [slug, ts] of Object.entries(parsed)) {
      if (now - ts < DEDUPE_WINDOW_MS) cleaned[slug] = ts
    }
    return cleaned
  } catch {
    return {}
  }
}

function pixelResponse(visited: Record<string, number>): NextResponse {
  const res = new NextResponse(PIXEL_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
  res.cookies.set(COOKIE_NAME, JSON.stringify(visited), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,  // 1 hour
  })
  return res
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  const ua = request.headers.get('user-agent')
  const ip = truncateIp(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'))
  const referer = request.headers.get('referer')

  const visited = parseVisitedCookie(request.cookies.get(COOKIE_NAME)?.value)

  // Always respond with the pixel — skip writes on missing slug, bot, dedupe hit
  if (!slug) return pixelResponse(visited)
  if (isBot(ua)) return pixelResponse(visited)
  if (visited[slug] && Date.now() - visited[slug] < DEDUPE_WINDOW_MS) {
    return pixelResponse(visited)
  }

  // Write event
  try {
    const sb = getSupabaseServer()
    if (!sb) return pixelResponse(visited)

    const { data: prospect } = await sb
      .from('prospects')
      .select('id, pipeline_state')
      .eq('slug', slug)
      .single()

    if (!prospect) return pixelResponse(visited)

    // Log the visit
    await sb.from('prospect_events').insert({
      prospect_id: prospect.id,
      event: 'page_visited',
      payload: {
        user_agent: ua?.slice(0, 500) || null,
        referer: referer?.slice(0, 500) || null,
        ip_truncated: ip,
        actor: 'tracking_pixel',
      },
    })

    // Auto-transition: sent → opened
    if (prospect.pipeline_state === 'sent') {
      await sb.from('prospects').update({ pipeline_state: 'opened' }).eq('id', prospect.id)
      await sb.from('prospect_events').insert({
        prospect_id: prospect.id,
        event: 'state:opened',
        payload: {
          from: 'sent',
          to: 'opened',
          reason: 'page_visited',
          actor: 'tracking_pixel',
        },
      })
      revalidatePath('/admin')
      revalidatePath(`/admin/prospects/${prospect.id}`)
    }
  } catch (err) {
    console.error('[track] write failed:', err)
  }

  // Mark this slug as visited
  visited[slug] = Date.now()
  return pixelResponse(visited)
}
