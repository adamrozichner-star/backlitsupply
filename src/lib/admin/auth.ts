/**
 * Admin authentication — JWT-based session cookie.
 * Password check uses timing-safe compare.
 * JWT signing/verification uses jose (edge-compatible).
 */

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'admin_session'
const SESSION_DURATION_DAYS = 7

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be set and at least 32 chars')
  }
  return new TextEncoder().encode(secret)
}

/**
 * Sign a new admin session JWT.
 */
export async function signSession(): Promise<string> {
  return await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getSecret())
}

/**
 * Verify a JWT token. Returns true if valid and not expired.
 * Edge-compatible (no Node crypto).
 */
export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    return payload.admin === true
  } catch {
    return false
  }
}

/**
 * Read the session cookie and verify it. Server-side only (uses next/headers).
 */
export async function getSessionFromCookies(): Promise<boolean> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  return verifySession(token)
}

/**
 * Set the session cookie. Call from a server action or route handler.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  })
}

/**
 * Clear the session cookie (logout).
 */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/**
 * Timing-safe password comparison.
 */
export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  const inputBuf = Buffer.from(input)
  const expectedBuf = Buffer.from(expected)
  if (inputBuf.length !== expectedBuf.length) {
    // Still do a constant-time comparison against expected to avoid length leak
    const padded = Buffer.alloc(expectedBuf.length)
    inputBuf.copy(padded, 0, 0, Math.min(inputBuf.length, expectedBuf.length))
    timingSafeEqual(padded, expectedBuf)
    return false
  }
  return timingSafeEqual(inputBuf, expectedBuf)
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME
