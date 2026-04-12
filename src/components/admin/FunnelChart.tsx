import type { FunnelCounts } from '@/lib/admin/queries'
import { StateBadge } from './StateBadge'

export function FunnelChart({ funnel }: { funnel: FunnelCounts[] }) {
  const maxCount = Math.max(...funnel.map(f => f.count), 1)

  return (
    <div className="border border-white/[0.06] bg-[#111] p-4 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold text-white">Funnel</h2>
      <div className="space-y-2">
        {funnel.map(row => {
          const width = (row.count / maxCount) * 100
          const isTerminal = row.state === 'lost' || row.state === 'dead'
          return (
            <div key={row.state} className="flex items-center gap-3 text-xs">
              <div className="w-28 shrink-0 sm:w-32">
                <StateBadge state={row.state} />
              </div>
              <div className="relative flex-1">
                <div className="h-6 overflow-hidden bg-white/[0.03]">
                  <div
                    className={`h-full ${isTerminal ? 'bg-white/10' : 'bg-amber-500/60'}`}
                    style={{ width: `${Math.max(width, 0.5)}%` }}
                  />
                </div>
              </div>
              <div className="w-20 shrink-0 text-right tabular-nums text-white/70">
                {row.count}
                <span className="ml-1 text-white/30">
                  {row.percent_of_discovered.toFixed(0)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
