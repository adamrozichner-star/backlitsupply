/**
 * Placeholder webhook for inbound reply classification.
 * Shape only — no Instantly.ai integration yet.
 *
 * Expected payload: { from: string, subject: string, body: string, prospect_slug: string }
 */

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    // Validate shape
    if (!payload.body || !payload.prospect_slug) {
      return NextResponse.json({ error: 'Missing body or prospect_slug' }, { status: 400 })
    }

    // TODO: Wire to reply-classifier + state machine update
    console.log('[reply webhook] Received:', {
      from: payload.from,
      subject: payload.subject,
      prospect_slug: payload.prospect_slug,
      body_preview: payload.body?.slice(0, 100),
    })

    return NextResponse.json({ received: true, classified: false })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}
