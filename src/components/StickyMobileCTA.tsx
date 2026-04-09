'use client'

import Link from 'next/link'

export default function StickyMobileCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur-sm md:hidden">
      <Link
        href="/contact"
        className="flex w-full items-center justify-center gap-2 bg-amber-500 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400"
      >
        Free mockup of your logo
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </div>
  )
}
