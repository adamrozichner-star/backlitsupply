import { NextResponse, type NextRequest } from 'next/server'
import { clearSessionCookie } from '@/lib/admin/auth'

export async function POST(request: NextRequest) {
  await clearSessionCookie()
  return NextResponse.redirect(new URL('/admin/login', request.url), { status: 303 })
}
