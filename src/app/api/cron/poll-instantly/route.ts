/**
 * Vercel cron endpoint — polls Instantly every 5 minutes.
 *
 * Vercel sends a request with Authorization: Bearer <CRON_SECRET>.
 * We verify, run the poller, return summary.
 *
 * vercel.json cron schedule: every 5 minutes
 *
 * Vercel Hobby tier: crons run once/day max.
 * Vercel Pro tier ($20/mo): crons every minute.
 * If on Hobby, use external cron service (cron-job.org) hitting this endpoint.
 */

import { NextResponse, type NextRequest } from 'next/server'

export const maxDuration = 60  // Allow up to 60s for polling

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Dynamic import to avoid bundling the poller with the Next.js build
    // The poller uses dotenv + scripts-path imports that don't work in Vercel's edge/serverless.
    // Instead, we inline the core logic here using the same Supabase + Instantly API pattern.
    const { pollInstantly } = await import('@/lib/instantly-poller-serverless')
    const summary = await pollInstantly()

    return NextResponse.json({
      ok: true,
      ...summary,
    })
  } catch (err) {
    console.error('[cron/poll-instantly] Error:', err)
    return NextResponse.json({
      ok: false,
      error: (err as Error).message?.slice(0, 200),
    }, { status: 500 })
  }
}
