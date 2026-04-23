/**
 * DEPRECATED: Instantly webhooks require Hyper Growth tier ($40+/mo).
 * Replaced by polling via /api/cron/poll-instantly (every 5 min).
 *
 * This endpoint is kept as a stub in case we upgrade later.
 * It returns 410 Gone to any caller.
 */

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Instantly webhooks deprecated. Using polling instead. See /api/cron/poll-instantly.' },
    { status: 410 },
  )
}
