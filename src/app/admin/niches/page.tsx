import Link from 'next/link'
import { getMetricsByNiche } from '@/lib/admin/queries'
import { NicheTable } from '@/components/admin/NicheTable'
import { NicheMiniFunnels } from '@/components/admin/NicheMiniFunnels'
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'

export default async function NichesPage() {
  const rows = await getMetricsByNiche()

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-amber-500">
        <ArrowLeft size={14} weight="bold" /> Back to dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Niches</h1>
        <p className="mt-1 text-sm text-white/50">
          Comparative performance across all niches. Click any niche to filter the prospect table.
        </p>
      </div>

      <NicheMiniFunnels rows={rows} />

      <NicheTable rows={rows} />

      <p className="text-[11px] text-white/30">
        <strong className="text-white/50">Hit %</strong> = prospects that reached mockup_ready or later,
        as a share of all prospects that got past qualify (qualified + mockup_ready+ + lost).
        Higher = the niche generates sendable prospects (owner + email) efficiently.
      </p>
    </div>
  )
}
