/**
 * In-memory rate limiter for admin login attempts.
 * 5 failed attempts within 15 minutes → blocked for 15 minutes.
 * Resets on server restart — acceptable for one-user app.
 */

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000  // 15 minutes

interface Entry {
  failures: number
  firstFailAt: number
}

const attempts = new Map<string, Entry>()

export function isRateLimited(ip: string): boolean {
  const entry = attempts.get(ip)
  if (!entry) return false

  // Reset if window expired
  if (Date.now() - entry.firstFailAt > WINDOW_MS) {
    attempts.delete(ip)
    return false
  }

  return entry.failures >= MAX_ATTEMPTS
}

export function recordLoginAttempt(ip: string, success: boolean): void {
  if (success) {
    attempts.delete(ip)
    return
  }

  const entry = attempts.get(ip)
  if (!entry) {
    attempts.set(ip, { failures: 1, firstFailAt: Date.now() })
    return
  }

  // Reset window if expired
  if (Date.now() - entry.firstFailAt > WINDOW_MS) {
    attempts.set(ip, { failures: 1, firstFailAt: Date.now() })
    return
  }

  entry.failures++
}
