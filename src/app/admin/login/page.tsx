import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { passwordMatches, signSession, setSessionCookie } from '@/lib/admin/auth'
import { recordLoginAttempt, isRateLimited } from '@/lib/admin/rate-limit'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: 'Admin Login',
  robots: { index: false, follow: false },
}

async function login(formData: FormData) {
  'use server'

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim()
    || hdrs.get('x-real-ip')
    || 'unknown'

  if (isRateLimited(ip)) {
    redirect('/admin/login?error=rate_limited')
  }

  const password = (formData.get('password') as string) || ''
  if (!passwordMatches(password)) {
    recordLoginAttempt(ip, false)
    redirect('/admin/login?error=wrong')
  }

  recordLoginAttempt(ip, true)
  const token = await signSession()
  await setSessionCookie(token)
  redirect('/admin')
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-amber-500">
            Backlit Supply
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Admin</h1>
        </div>
        <form action={login} className="space-y-4">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            required
            className="w-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-amber-500/50"
          />
          <button
            type="submit"
            className="w-full bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Sign in
          </button>
          {error === 'wrong' && (
            <p className="text-center text-xs text-red-400">Wrong password.</p>
          )}
          {error === 'rate_limited' && (
            <p className="text-center text-xs text-red-400">
              Too many attempts. Try again in 15 minutes.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
