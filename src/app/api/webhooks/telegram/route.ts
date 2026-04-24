/**
 * Telegram Bot webhook — receives callback_query updates when CS taps
 * "Mark Handled" on a reply notification.
 *
 * Security: verifies X-Telegram-Bot-Api-Secret-Token header against
 * TELEGRAM_WEBHOOK_SECRET. This secret is set via setWebhook's
 * secret_token param (see scripts/setup-telegram.ts).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

const API_BASE = 'https://api.telegram.org'

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const authorizedChatId = process.env.TELEGRAM_CHAT_ID
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!token || !authorizedChatId) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 })
  }

  // Verify secret_token header — rejects spoofed payloads
  if (webhookSecret) {
    const headerSecret = req.headers.get('x-telegram-bot-api-secret-token')
    if (headerSecret !== webhookSecret) {
      console.error(`[telegram-webhook] Secret mismatch — rejecting request`)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const callbackQuery = body.callback_query as Record<string, unknown> | undefined
  if (!callbackQuery) return NextResponse.json({ ok: true })

  const data = callbackQuery.data as string | undefined
  if (!data?.startsWith('handled:')) return NextResponse.json({ ok: true })

  const prospectId = data.slice('handled:'.length)
  const message = callbackQuery.message as Record<string, unknown> | undefined
  const chat = message?.chat as Record<string, unknown> | undefined
  const chatId = chat?.id as number | undefined
  const messageId = message?.message_id as number | undefined
  const from = callbackQuery.from as Record<string, unknown> | undefined
  const callbackQueryId = callbackQuery.id as string

  if (!chatId || !messageId || !from) return NextResponse.json({ ok: true })

  // Belt: also verify chat_id matches authorized group
  if (String(chatId) !== authorizedChatId) {
    console.error(`[telegram-webhook] Unauthorized chat ${chatId}, expected ${authorizedChatId}`)
    await fetch(`${API_BASE}/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: '\u274C Unauthorized', show_alert: true }),
    })
    return NextResponse.json({ ok: true })
  }

  const fromFirstName = (from.first_name as string) || 'Unknown'

  // Answer callback (removes loading spinner)
  await fetch(`${API_BASE}/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: '\u2705 Marked as handled' }),
  })

  // Edit button to show who handled it
  await fetch(`${API_BASE}/bot${token}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: `\u2705 Handled by ${fromFirstName}`, callback_data: 'noop' }]] },
    }),
  })

  // Log event in Supabase
  const sb = getSupabaseServer()
  if (sb) {
    await sb.from('prospect_events').insert({
      prospect_id: prospectId,
      event: 'reply_handled',
      payload: {
        handler_name: fromFirstName,
        handler_telegram_id: from.id,
        message_id: messageId,
        actor: 'telegram_callback',
      },
    })
  }

  return NextResponse.json({ ok: true })
}
