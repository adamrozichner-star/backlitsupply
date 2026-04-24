import type { PipelineState } from '@/lib/admin/queries'

const COLORS: Record<PipelineState, string> = {
  discovered: 'bg-white/5 text-white/50 border-white/10',
  enriched: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  qualified: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  mockup_review_pending: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  mockup_ready: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  sent: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  opened: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20',
  replied: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  positive: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  booked: 'bg-green-500/15 text-green-300 border-green-500/30',
  won: 'bg-green-500/25 text-green-200 border-green-400/40',
  bounced: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  lost: 'bg-red-500/10 text-red-300 border-red-500/20',
  dead: 'bg-white/[0.03] text-white/20 border-white/5',
}

export function StateBadge({ state }: { state: PipelineState | null }) {
  if (!state) return <span className="text-xs text-white/30">—</span>
  const cls = COLORS[state] || COLORS.discovered
  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}>
      {state.replace(/_/g, ' ')}
    </span>
  )
}
