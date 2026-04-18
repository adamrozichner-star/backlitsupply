import type { NicheMetrics } from '@/lib/admin/queries'

/**
 * 5 small stacked-bar funnels, one per niche, with SHARED max so the
 * y-axis is honest for visual comparison. Mobile: stacks vertically.
 */

const STAGES: { key: keyof NicheMetrics; label: string; color: string }[] = [
  { key: 'total', label: 'Total', color: 'bg-white/10' },
  { key: 'qualified', label: 'Qual', color: 'bg-cyan-500/50' },
  { key: 'sendable', label: 'Send', color: 'bg-blue-500/50' },
  { key: 'mockup_review_pending', label: 'Rev', color: 'bg-yellow-500/50' },
  { key: 'mockup_ready', label: 'Mock', color: 'bg-amber-500/50' },
  { key: 'sent', label: 'Sent', color: 'bg-purple-500/50' },
  { key: 'replied', label: 'Rep', color: 'bg-pink-500/50' },
  { key: 'positive', label: 'Pos', color: 'bg-emerald-500/60' },
  { key: 'won', label: 'Won', color: 'bg-green-500/70' },
]

export function NicheMiniFunnels({ rows }: { rows: NicheMetrics[] }) {
  if (rows.length === 0) return null

  // Shared max for honest comparison
  const maxValue = Math.max(
    ...rows.flatMap(r => STAGES.map(s => (r[s.key] as number) || 0)),
    1,
  )

  return (
    <div className="border border-white/[0.06] bg-[#111] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Funnel comparison</h2>
        <p className="text-[10px] text-white/30">Shared scale: 0–{maxValue}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {rows.map(row => (
          <div key={row.niche} className="border border-white/[0.04] bg-black/20 p-3">
            <p className="mb-3 truncate text-xs font-medium text-white">{row.niche}</p>
            <div className="flex h-32 items-end gap-1">
              {STAGES.map(s => {
                const v = (row[s.key] as number) || 0
                const h = (v / maxValue) * 100
                return (
                  <div key={s.key} className="group flex flex-1 flex-col items-center justify-end" title={`${s.label}: ${v}`}>
                    <span className="mb-0.5 text-[9px] tabular-nums text-white/50">{v}</span>
                    <div className={`w-full ${s.color}`} style={{ height: `${Math.max(h, 1)}%` }} />
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex gap-1">
              {STAGES.map(s => (
                <p key={s.key} className="flex-1 truncate text-center text-[9px] text-white/30">{s.label}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
