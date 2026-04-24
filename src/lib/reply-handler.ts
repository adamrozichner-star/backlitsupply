/**
 * Reply handler — shared between CLI and serverless pollers.
 *
 * Self-contained: inlines Haiku classification + Telegram notification
 * so it can be imported from both scripts/ and src/ without cross-boundary deps.
 */

import { getSupabaseServer } from '@/lib/supabase/server'

const INSTANTLY_API = 'https://api.instantly.ai'
const TELEGRAM_API = 'https://api.telegram.org'

export type ReplyClassification =
  | 'PRICING_QUESTION' | 'INTERESTED' | 'NOT_INTERESTED'
  | 'AUTO_REPLY' | 'SPAM' | 'QUESTION' | 'OTHER'

const CLASSIFICATION_EMOJI: Record<string, string> = {
  PRICING_QUESTION: '\u{1F4B0}', INTERESTED: '\u{1F7E2}', NOT_INTERESTED: '\u{1F534}',
  AUTO_REPLY: '\u{1F916}', SPAM: '\u{1F6AB}', QUESTION: '\u2753', OTHER: '\u{1F535}',
}

// ─── Fetch reply content from Instantly ─────────────────

async function fetchReplyContent(leadId: string): Promise<{ text: string; variant?: string } | null> {
  const apiKey = process.env.INSTANTLY_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
      `${INSTANTLY_API}/api/v2/emails?lead_id=${leadId}&email_type=received&limit=1`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      },
    )
    if (!res.ok) {
      console.error(`[reply-handler] Instantly emails API ${res.status}`)
      return null
    }
    const data = await res.json()
    const items = data.items || []
    if (items.length === 0) return null

    const email = items[0]
    const text = email.body?.text || email.body?.html?.replace(/<[^>]*>/g, '') || ''
    const variant = email.step ? `step ${email.step}` : undefined
    return { text: text.trim(), variant }
  } catch (err) {
    console.error('[reply-handler] Failed to fetch reply:', (err as Error).message?.slice(0, 80))
    return null
  }
}

// ─── Classify reply via Haiku (inline, no LLM abstraction) ──

const CLASSIFY_SYSTEM = `You classify cold email replies for a custom backlit sign company.

Classify into exactly ONE category:
- PRICING_QUESTION: asking about cost, quote, how much
- INTERESTED: positive intent, wants more info
- NOT_INTERESTED: no thanks, unsubscribe, remove me, wrong person
- AUTO_REPLY: out of office, auto-responder, vacation, delivery notification
- SPAM: irrelevant promotional content, phishing, nonsensical
- QUESTION: specific product question (materials, size, shipping, timeline)
- OTHER: doesn't fit above

Generate a 1-2 sentence suggested response for CS team.
Guidelines:
- PRICING_QUESTION: mention $400-$2,000 range, offer WhatsApp for exact quote
- INTERESTED: thank them, ask about size + indoor/outdoor, offer WhatsApp
- QUESTION: answer directly if possible, otherwise offer WhatsApp
- OTHER: acknowledge, offer to follow up
- NOT_INTERESTED, AUTO_REPLY, SPAM: set suggested_response to null`

const CLASSIFY_TOOL = {
  name: 'classify_reply',
  description: 'Classify a cold email reply and suggest a response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      classification: {
        type: 'string',
        enum: ['PRICING_QUESTION', 'INTERESTED', 'NOT_INTERESTED', 'AUTO_REPLY', 'SPAM', 'QUESTION', 'OTHER'],
      },
      suggested_response: {
        type: 'string',
        description: '1-2 sentence suggested response. Null for NOT_INTERESTED, AUTO_REPLY, SPAM.',
      },
    },
    required: ['classification'],
  },
}

async function classifyReply(
  replyText: string,
  prospectName: string,
): Promise<{ classification: ReplyClassification; suggested_response: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[reply-handler] No ANTHROPIC_API_KEY — defaulting to OTHER')
    return { classification: 'OTHER', suggested_response: null }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: CLASSIFY_SYSTEM,
      messages: [{ role: 'user', content: `Classify this reply from ${prospectName}:\n\n${replyText.slice(0, 2000)}` }],
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: 'tool', name: 'classify_reply' },
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[reply-handler] Haiku API ${res.status}: ${body.slice(0, 200)}`)
    return { classification: 'OTHER', suggested_response: null }
  }

  const data = await res.json()
  const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use')
  if (!toolUse) {
    console.error('[reply-handler] No tool_use in Haiku response')
    return { classification: 'OTHER', suggested_response: null }
  }

  return {
    classification: toolUse.input.classification || 'OTHER',
    suggested_response: toolUse.input.suggested_response || null,
  }
}

// ─── Send Telegram notification ─────────────────────────

interface TelegramNotifPayload {
  prospectId: string
  firstName: string
  lastName?: string
  businessName: string
  niche?: string
  city?: string
  campaignVariant?: string
  replyBody: string
  phone?: string | null
  website?: string | null
  mockupUrl: string
  classification: string
  suggestedResponse?: string | null
}

async function sendTelegramNotification(notif: TelegramNotifPayload): Promise<{ ok: boolean; messageId?: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.warn('[reply-handler] Telegram not configured — skipping notification')
    return { ok: false }
  }

  const emoji = CLASSIFICATION_EMOJI[notif.classification] || '\u{1F535}'
  const contactLine = notif.phone
    ? `\u{1F4DE} ${notif.phone}`
    : notif.website
      ? `\u{1F310} ${notif.website}`
      : '\u{1F4DE} no phone on file'

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const text = [
    `\u{1F514} <b>NEW REPLY</b> \u00B7 ${emoji}`,
    '',
    `\u{1F464} <b>${esc(notif.firstName)}${notif.lastName ? ' ' + esc(notif.lastName) : ''}</b> \u00B7 ${esc(notif.businessName)}`,
    `\u{1F3F7} ${esc(notif.niche || '\u2014')} \u00B7 ${esc(notif.city || '\u2014')}`,
    notif.campaignVariant ? `\u{1F4E7} Replied to variant: ${esc(notif.campaignVariant)}` : '',
    '',
    `\u{1F4AC} Their message:`,
    `"${esc(notif.replyBody.slice(0, 500))}"`,
    '',
    contactLine,
    `\u{1F5BC} ${notif.mockupUrl}`,
    '',
    `\u{1F916} <b>Classification:</b> ${notif.classification}`,
    notif.suggestedResponse ? `\n\u{1F4CB} <b>Suggested response:</b>\n"${esc(notif.suggestedResponse)}"` : '',
  ].filter(Boolean).join('\n')

  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '\u2705 Mark Handled', callback_data: `handled:${notif.prospectId}` },
      ]],
    },
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })

  const data = await res.json()
  if (!data.ok) {
    console.error('[reply-handler] Telegram send failed:', data.description)
    return { ok: false }
  }
  return { ok: true, messageId: data.result?.message_id }
}

// ─── Main handler ───────────────────────────────────────

export interface ReplyHandlerResult {
  classification: ReplyClassification
  notified: boolean
  deduped: boolean
  reason?: string
  telegramMessageId?: number
}

export interface HandleReplyOptions {
  repliedVariant?: string
  dryRun?: boolean
  overrideReplyText?: string
}

export async function handleReply(
  prospectId: string,
  instantlyLeadId: string,
  optionsOrVariant?: HandleReplyOptions | string,
): Promise<ReplyHandlerResult> {
  const opts: HandleReplyOptions = typeof optionsOrVariant === 'string'
    ? { repliedVariant: optionsOrVariant }
    : optionsOrVariant || {}

  const sb = getSupabaseServer()
  if (!sb) throw new Error('Supabase not configured')

  const { data: prospect } = await sb.from('prospects')
    .select('id, slug, business_name, owner_first_name, owner_last_name, niche, city, phone, website, mockup_url')
    .eq('id', prospectId)
    .single()

  if (!prospect) throw new Error(`Prospect ${prospectId} not found`)

  // Dedup: skip if already classified in last 24h (skip in dryRun)
  if (!opts.dryRun) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: priorClassification } = await sb.from('prospect_events')
      .select('id')
      .eq('prospect_id', prospectId)
      .eq('event', 'reply_classified')
      .gte('created_at', since)
      .limit(1)

    if (priorClassification && priorClassification.length > 0) {
      console.log(`[reply-handler] Dedup: ${prospect.slug} already classified in last 24h`)
      await sb.from('prospect_events').insert({
        prospect_id: prospectId,
        event: 'reply_classified_dedup',
        payload: { reason: 'already_classified_within_24h', actor: 'reply_handler' },
      })
      return { classification: 'OTHER', notified: false, deduped: true, reason: 'dedup_24h' }
    }
  }

  // Fetch reply content (skip Instantly fetch if override provided)
  let replyText: string
  let replyVariant: string | undefined
  if (opts.overrideReplyText) {
    replyText = opts.overrideReplyText
  } else {
    await new Promise(r => setTimeout(r, 1000))
    const reply = await fetchReplyContent(instantlyLeadId)
    replyText = reply?.text || '(reply content unavailable)'
    replyVariant = reply?.variant
  }

  // Classify via Haiku
  await new Promise(r => setTimeout(r, 1000))
  const { classification, suggested_response } = await classifyReply(
    replyText,
    prospect.owner_first_name || prospect.business_name || 'prospect',
  )

  // Log classification event (skip in dryRun)
  if (!opts.dryRun) {
    await sb.from('prospect_events').insert({
      prospect_id: prospectId,
      event: 'reply_classified',
      payload: {
        classification,
        suggested_response,
        reply_body: replyText.slice(0, 1000),
        replied_variant: opts.repliedVariant || replyVariant,
        actor: 'reply_handler',
      },
    })
  }

  // AUTO_REPLY + SPAM: log silently, no notification
  if (classification === 'AUTO_REPLY' || classification === 'SPAM') {
    console.log(`[reply-handler] ${prospect.slug}: ${classification} — logged silently`)
    return { classification, notified: false, deduped: false, reason: 'silent_category' }
  }

  // Send Telegram notification (always, even in dryRun — this IS the test)
  await new Promise(r => setTimeout(r, 1000))

  const mockupUrl = prospect.slug
    ? `https://backlitsupply.com/for/${prospect.slug}`
    : '\u2014'

  let telegramMessageId: number | undefined
  try {
    const sendResult = await sendTelegramNotification({
      prospectId,
      firstName: prospect.owner_first_name || '\u2014',
      lastName: prospect.owner_last_name || undefined,
      businessName: prospect.business_name || '\u2014',
      niche: prospect.niche || undefined,
      city: prospect.city || undefined,
      campaignVariant: opts.repliedVariant || replyVariant,
      replyBody: replyText,
      phone: prospect.phone,
      website: prospect.website,
      mockupUrl,
      classification,
      suggestedResponse: classification === 'NOT_INTERESTED' ? null : suggested_response,
    })

    if (sendResult.ok) {
      telegramMessageId = sendResult.messageId
      console.log(`[reply-handler] ${prospect.slug}: ${classification} — Telegram sent (msg_id=${telegramMessageId})`)
    } else {
      console.error(`[reply-handler] ${prospect.slug}: Telegram send failed`)
    }
  } catch (err) {
    console.error(`[reply-handler] Telegram error:`, (err as Error).message?.slice(0, 80))
  }

  return { classification, notified: !!telegramMessageId, deduped: false, telegramMessageId }
}
