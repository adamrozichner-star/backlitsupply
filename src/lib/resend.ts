import { Resend } from 'resend'

// Server-only Resend client with graceful fallback
// Returns null if RESEND_API_KEY is missing — never crashes the build

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Resend] Missing RESEND_API_KEY — email notifications disabled')
    return null
  }
  return new Resend(apiKey)
}
