import type { CostBreakdownWeek } from '@/lib/admin/queries'

export function CostChart({
  weeks, firstCostDate,
}: { weeks: CostBreakdownWeek[]; firstCostDate: string | null }) {
  const totals = weeks.map(w => w.places + w.haiku + w.replicate)
  const maxTotal = Math.max(...totals, 0.01)
  const grandTotal = totals.reduce((sum, t) => sum + t, 0)

  return (
    <div className="border border-white/[0.06] bg-[#111] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Cost (last 8 weeks)</h2>
        <p className="text-lg font-semibold text-amber-500 tabular-nums">
          ${grandTotal.toFixed(2)}
        </p>
      </div>

      {grandTotal === 0 ? (
        <p className="text-xs text-white/30">
          No cost events recorded yet. Run the pipeline to populate.
        </p>
      ) : (
        <div className="flex h-40 items-end gap-1 sm:gap-2">
          {weeks.map(w => {
            const total = w.places + w.haiku + w.replicate
            const heightPct = (total / maxTotal) * 100
            const placesPct = total > 0 ? (w.places / total) * heightPct : 0
            const haikuPct = total > 0 ? (w.haiku / total) * heightPct : 0
            const replicatePct = total > 0 ? (w.replicate / total) * heightPct : 0
            const label = w.week_start.slice(5)  // MM-DD

            return (
              <div key={w.week_start} className="group flex flex-1 flex-col items-center gap-1">
                <div className="relative flex w-full flex-col-reverse" style={{ height: '100%' }}>
                  <div className="w-full bg-cyan-500/50" style={{ height: `${placesPct}%` }} title={`Places $${w.places.toFixed(3)}`} />
                  <div className="w-full bg-amber-500/50" style={{ height: `${haikuPct}%` }} title={`Haiku $${w.haiku.toFixed(3)}`} />
                  <div className="w-full bg-pink-500/50" style={{ height: `${replicatePct}%` }} title={`Replicate $${w.replicate.toFixed(3)}`} />
                </div>
                <p className="text-[9px] tabular-nums text-white/30">{label}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/40">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 bg-cyan-500/50" />Places</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 bg-amber-500/50" />Haiku</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 bg-pink-500/50" />Replicate</span>
      </div>

      {firstCostDate ? (
        <p className="mt-3 text-[10px] text-white/20">
          Cost data starts from {firstCostDate.slice(0, 10)}
        </p>
      ) : (
        <p className="mt-3 text-[10px] text-white/20">
          No cost events yet — cost tracking starts with next pipeline run.
        </p>
      )}
    </div>
  )
}
