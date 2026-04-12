'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { NicheMetrics } from '@/lib/admin/queries'

type SortKey = keyof NicheMetrics

export function NicheTable({ rows }: { rows: NicheMetrics[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const cols: { key: SortKey; label: string }[] = [
    { key: 'total', label: 'Total' },
    { key: 'qualified', label: 'Qual' },
    { key: 'sendable', label: 'Sendable' },
    { key: 'mockup_hit_rate', label: 'Hit %' },
    { key: 'mockup_ready', label: 'Mockup' },
    { key: 'sent', label: 'Sent' },
    { key: 'opened', label: 'Opened' },
    { key: 'replied', label: 'Replied' },
    { key: 'positive', label: 'Positive' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
  ]

  return (
    <div className="overflow-x-auto border border-white/[0.06] bg-[#111]">
      <table className="w-full min-w-[720px] text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-[10px] font-medium uppercase tracking-wider text-white/40">
            <th className="sticky left-0 z-10 bg-[#111] p-3">
              <button onClick={() => toggleSort('niche')} className="hover:text-white">Niche {sortKey === 'niche' && (sortDir === 'asc' ? '↑' : '↓')}</button>
            </th>
            {cols.map(c => (
              <th key={c.key} className="whitespace-nowrap p-3 text-right">
                <button onClick={() => toggleSort(c.key)} className="hover:text-white">
                  {c.label} {sortKey === c.key && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
            ))}
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={cols.length + 2} className="p-8 text-center text-white/30">
                No niche data yet. Run <code className="text-amber-500">npm run batch</code> to populate.
              </td>
            </tr>
          ) : sorted.map(row => (
            <tr key={row.niche} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
              <td className="sticky left-0 z-10 bg-[#111] p-3 font-medium text-white">{row.niche}</td>
              <td className="p-3 text-right tabular-nums text-white/70">{row.total}</td>
              <td className="p-3 text-right tabular-nums text-white/70">{row.qualified}</td>
              <td className="p-3 text-right tabular-nums text-white/70">{row.sendable}</td>
              <td className="p-3 text-right tabular-nums text-amber-400">
                {row.mockup_hit_rate > 0 ? `${(row.mockup_hit_rate * 100).toFixed(0)}%` : '—'}
              </td>
              <td className="p-3 text-right tabular-nums text-white/70">{row.mockup_ready}</td>
              <td className="p-3 text-right tabular-nums text-white/70">{row.sent}</td>
              <td className="p-3 text-right tabular-nums text-white/70">{row.opened}</td>
              <td className="p-3 text-right tabular-nums text-white/70">{row.replied}</td>
              <td className="p-3 text-right tabular-nums text-emerald-300">{row.positive}</td>
              <td className="p-3 text-right tabular-nums text-green-200">{row.won}</td>
              <td className="p-3 text-right tabular-nums text-white/40">{row.lost}</td>
              <td className="whitespace-nowrap p-3 text-right">
                <Link href={`/admin?niche=${encodeURIComponent(row.niche)}`} className="text-amber-500 hover:underline">
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
