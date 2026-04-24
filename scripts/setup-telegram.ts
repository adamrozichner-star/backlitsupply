/**
 * One-time setup: registers the Telegram webhook with secret_token.
 *
 * Usage: npm run setup:telegram
 *
 * Reads TELEGRAM_BOT_TOKEN from .env.local.
 * Generates TELEGRAM_WEBHOOK_SECRET if not already set.
 * Registers webhook URL + secret + allowed_updates.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { randomBytes } from 'crypto'

config({ path: resolve(__dirname, '../.env.local') })

const API_BASE = 'https://api.telegram.org'
const WEBHOOK_URL = 'https://backlitsupply.com/api/webhooks/telegram'

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('Missing TELEGRAM_BOT_TOKEN in .env.local')
    process.exit(1)
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || randomBytes(32).toString('hex')
  const isNewSecret = !process.env.TELEGRAM_WEBHOOK_SECRET

  console.log('\n=== Telegram Webhook Setup ===\n')
  console.log(`Bot token: ${token.slice(0, 8)}...${token.slice(-4)}`)
  console.log(`Webhook URL: ${WEBHOOK_URL}`)
  console.log(`Secret: ${isNewSecret ? '(generated new)' : '(from env)'}`)

  // Delete any existing webhook first
  const delRes = await fetch(`${API_BASE}/bot${token}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const delData = await delRes.json()
  if (!delData.ok) {
    console.error('Failed to delete old webhook:', delData.description)
    process.exit(1)
  }
  console.log('Cleared existing webhook')

  // Register new webhook
  const res = await fetch(`${API_BASE}/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      secret_token: secret,
      allowed_updates: ['callback_query'],
    }),
  })

  const data = await res.json()
  if (!data.ok) {
    console.error('setWebhook failed:', data.description)
    process.exit(1)
  }

  console.log('Webhook registered successfully\n')

  // Verify
  const infoRes = await fetch(`${API_BASE}/bot${token}/getWebhookInfo`)
  const info = await infoRes.json()
  console.log('Webhook info:')
  console.log(`  URL: ${info.result?.url}`)
  console.log(`  Has secret: ${info.result?.has_custom_certificate !== undefined ? 'yes' : 'check manually'}`)
  console.log(`  Allowed updates: ${JSON.stringify(info.result?.allowed_updates)}`)
  console.log(`  Pending updates: ${info.result?.pending_update_count}`)

  if (isNewSecret) {
    console.log('\n=== ACTION REQUIRED ===')
    console.log('Add this to .env.local AND Vercel env vars:\n')
    console.log(`TELEGRAM_WEBHOOK_SECRET=${secret}`)
    console.log('')
  } else {
    console.log('\nUsing existing secret from env — no action needed.')
  }
}

main().catch(err => {
  console.error('Setup failed:', err)
  process.exit(1)
})
