import Link from 'next/link'
import type { BrokenMockup } from '@/lib/admin/queries'
import { WarningCircle } from '@phosphor-icons/react/dist/ssr'

export function HealthBanner({ broken }: { broken: BrokenMockup[] }) {
  if (broken.length === 0) return null

  return (
    <div className="border border-red-500/30 bg-red-500/10 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <WarningCircle size={24} weight="fill" className="shrink-0 text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-300">
            {broken.length} prospect{broken.length === 1 ? '' : 's'} {broken.length === 1 ? 'has' : 'have'} broken mockup{broken.length === 1 ? '' : 's'} — not safe to send
          </p>
          <p className="mt-1 text-xs text-white/60">
            Mockup images failed verification in the last 24h. Do not send outreach to these prospects
            until the image renders correctly on production.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs">
            {broken.slice(0, 5).map(b => (
              <li key={b.id}>
                <Link
                  href={`/admin/prospects/${b.id}`}
                  className="text-red-300 hover:text-red-200 hover:underline"
                >
                  {b.business_name || b.slug} — {b.reason || 'unknown'}
                </Link>
              </li>
            ))}
            {broken.length > 5 && (
              <li className="text-white/40">…and {broken.length - 5} more</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
