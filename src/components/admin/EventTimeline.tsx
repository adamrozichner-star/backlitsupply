'use client'

import { useState } from 'react'
import type { AdminEvent } from '@/lib/admin/queries'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Math.floor((Date.now() - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const EVENT_COLORS: Record<string, string> = {
  'state:discovered': 'bg-white/5 text-white/60 border-white/10',
  'state:enriched': 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  'state:qualified': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  'state:mockup_ready': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'state:sent': 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  'state:opened': 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20',
  'state:replied': 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  'state:positive': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'state:booked': 'bg-green-500/15 text-green-300 border-green-500/30',
  'state:won': 'bg-green-500/25 text-green-200 border-green-400/40',
  'state:lost': 'bg-red-500/10 text-red-300 border-red-500/20',
  mockup_generated: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  outreach_drafted: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  're-enriched_version_bump': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  'cost:places': 'bg-cyan-500/10 text-cyan-200 border-cyan-500/20',
  'cost:haiku': 'bg-amber-500/10 text-amber-200 border-amber-500/20',
  'cost:replicate': 'bg-pink-500/10 text-pink-200 border-pink-500/20',
  'state:mockup_review_pending': 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  mockup_approved: 'bg-green-500/15 text-green-300 border-green-500/30',
  mockup_rejected: 'bg-red-500/10 text-red-300 border-red-500/20',
  mockup_rejected_terminal: 'bg-red-500/15 text-red-200 border-red-500/30',
  mockup_rejected_source_quality: 'bg-red-500/15 text-red-200 border-red-500/30',
  note: 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20',
  page_visited: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20',
}

function EventRow({ event }: { event: AdminEvent }) {
  const [open, setOpen] = useState(false)
  const color = EVENT_COLORS[event.event] || 'bg-white/5 text-white/50 border-white/10'
  const hasPayload = event.payload && Object.keys(event.payload).length > 0

  return (
    <li className="border-b border-white/[0.04] py-3 text-xs">
      <div className="flex items-start gap-3">
        <span className="w-20 shrink-0 pt-0.5 text-[10px] tabular-nums text-white/30">
          {relativeTime(event.created_at)}
        </span>
        <span className={`shrink-0 border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${color}`}>
          {event.event}
        </span>
        {hasPayload && (
          <button
            onClick={() => setOpen(o => !o)}
            className="ml-auto text-[10px] text-white/30 hover:text-amber-500"
          >
            {open ? 'hide' : 'payload'}
          </button>
        )}
      </div>
      {/* Inline render note content */}
      {event.event === 'note' && typeof event.payload.note === 'string' && (
        <p className="mt-2 whitespace-pre-wrap border-l-2 border-yellow-500/30 bg-yellow-500/5 p-3 text-xs leading-relaxed text-white/70">
          {event.payload.note}
        </p>
      )}
      {open && hasPayload && (
        <pre className="mt-2 overflow-x-auto border border-white/5 bg-black/40 p-3 text-[10px] text-white/60">
{JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </li>
  )
}

export function EventTimeline({ events }: { events: AdminEvent[] }) {
  return (
    <div className="border border-white/[0.06] bg-[#111] p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-white">Event timeline</h2>
      {events.length === 0 ? (
        <p className="text-xs text-white/30">No events yet.</p>
      ) : (
        <ul>
          {events.map(e => <EventRow key={e.id} event={e} />)}
        </ul>
      )}
    </div>
  )
}
