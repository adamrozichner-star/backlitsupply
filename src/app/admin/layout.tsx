import type { Metadata } from 'next'
import Link from 'next/link'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

// Force dynamic rendering for all admin pages (no caching, live data every request)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Backlit Supply</span>
            <span className="text-xs font-medium uppercase tracking-widest text-amber-500">Admin</span>
          </Link>
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="text-xs text-white/40 transition-colors hover:text-amber-500"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  )
}
