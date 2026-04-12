import Link from 'next/link'
import type { AdminEvent } from '@/lib/admin/queries'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const EVENT_COLORS: Record<string, string> = {
  'state:discovered': 'bg-white/5 text-white/50',
  'state:enriched': 'bg-blue-500/10 text-blue-300',
  'state:qualified': 'bg-cyan-500/10 text-cyan-300',
  'state:mockup_ready': 'bg-amber-500/15 text-amber-300',
  'state:sent': 'bg-purple-500/10 text-purple-300',
  'state:opened': 'bg-fuchsia-500/10 text-fuchsia-300',
  'state:replied': 'bg-pink-500/10 text-pink-300',
  'state:positive': 'bg-emerald-500/15 text-emerald-300',
  'state:booked': 'bg-green-500/15 text-green-300',
  'state:won': 'bg-green-500/25 text-green-200',
  'state:lost': 'bg-red-500/10 text-red-300',
  'mockup_generated': 'bg-amber-500/10 text-amber-300',
  'outreach_drafted': 'bg-purple-500/10 text-purple-300',
  're-enriched_version_bump': 'bg-cyan-500/10 text-cyan-300',
  'cost:places': 'bg-cyan-500/10 text-cyan-200',
  'cost:haiku': 'bg-amber-500/10 text-amber-200',
  'cost:replicate': 'bg-pink-500/10 text-pink-200',
}

function summarize(event: AdminEvent): string {
  const p = event.payload
  if (event.event.startsWith('cost:')) {
    const usd = typeof p.usd === 'number' ? p.usd : 0
    return `$${usd.toFixed(3)}${p.model ? ` · ${p.model}` : ''}${p.stage ? ` · ${p.stage}` : ''}`
  }
  if (event.event === 'mockup_generated') return `${p.model || ''} · $${(p.cost_usd as number || 0).toFixed(3)}`
  if (event.event === 'outreach_drafted') return `"${p.subject || ''}"`
  if (event.event.startsWith('state:')) {
    if (p.score) return `score ${p.score}`
    if (p.source) return `source: ${p.source}`
  }
  return ''
}

export function ActivityFeed({ events }: { events: AdminEvent[] }) {
  return (
    <div className="border border-white/[0.06] bg-[#111] p-4 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold text-white">Recent activity</h2>
      {events.length === 0 ? (
        <p className="text-xs text-white/30">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {events.map(e => {
            const color = EVENT_COLORS[e.event] || 'bg-white/5 text-white/50'
            return (
              <li key={e.id} className="flex items-start gap-3 py-3 text-xs">
                <span className="w-16 shrink-0 pt-0.5 text-[10px] tabular-nums text-white/30">
                  {relativeTime(e.created_at)}
                </span>
                <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${color}`}>
                  {e.event.replace('state:', '').replace('cost:', '$').replace(/_/g, ' ')}
                </span>
                <div className="min-w-0 flex-1">
                  {e.business_name && e.prospect_id ? (
                    <Link href={`/admin/prospects/${e.prospect_id}`} className="block truncate text-white/70 hover:text-amber-500">
                      {e.business_name}
                    </Link>
                  ) : (
                    <span className="block truncate text-white/40">
                      {e.business_name || '(no prospect)'}
                    </span>
                  )}
                  {summarize(e) && <p className="truncate text-[11px] text-white/30">{summarize(e)}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
