'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_LINKS, SITE_NAME } from '@/lib/config'

export default function Footer() {
  const pathname = usePathname()
  if (pathname?.startsWith('/admin')) return null

  return (
    <footer className="border-t border-white/5 bg-[#0a0a0a]">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <p className="text-sm font-semibold text-white">{SITE_NAME}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/40">
              Custom backlit signs for modern businesses. Your logo, lit up, shipped in 10 days.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12">
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">Pages</p>
              <div className="flex flex-col gap-2">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[13px] text-white/40 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">Contact</p>
              <div className="flex flex-col gap-2 text-[13px] text-white/40">
                <a href="mailto:hello@gotbacklit.com" className="transition-colors hover:text-white">
                  hello@gotbacklit.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-white/5 pt-6 text-center text-xs text-white/20">
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
