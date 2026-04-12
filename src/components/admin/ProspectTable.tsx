'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import type { AdminProspect, PipelineState } from '@/lib/admin/queries'
import { PIPELINE_STATES } from '@/lib/admin/queries'
import { StateBadge } from './StateBadge'

interface Props {
  prospects: AdminProspect[]
  niches: string[]
  initialNiche?: string
}

type SortKey = 'business_name' | 'owner' | 'niche' | 'geo' | 'state' | 'days' | 'score'

export function ProspectTable({ prospects, niches, initialNiche }: Props) {
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<PipelineState | 'all'>('all')
  const [nicheFilter, setNicheFilter] = useState<string>(initialNiche && niches.includes(initialNiche) ? initialNiche : 'all')
  const [sortKey, setSortKey] = useState<SortKey>('days')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filtered = useMemo(() => {
    let rows = prospects
    if (stateFilter !== 'all') rows = rows.filter(p => p.pipeline_state === stateFilter)
    if (nicheFilter !== 'all') rows = rows.filter(p => p.niche === nicheFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(p =>
        (p.business_name || '').toLowerCase().includes(q) ||
        (p.owner_first_name || '').toLowerCase().includes(q) ||
        (p.owner_last_name || '').toLowerCase().includes(q)
      )
    }

    const sorted = [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'business_name': cmp = (a.business_name || '').localeCompare(b.business_name || ''); break
        case 'owner': cmp = (a.owner_first_name || '').localeCompare(b.owner_first_name || ''); break
        case 'niche': cmp = (a.niche || '').localeCompare(b.niche || ''); break
        case 'geo': cmp = ((a.city || '') + (a.state || '')).localeCompare((b.city || '') + (b.state || '')); break
        case 'state':
          cmp = PIPELINE_STATES.indexOf(a.pipeline_state as PipelineState)
              - PIPELINE_STATES.indexOf(b.pipeline_state as PipelineState); break
        case 'days': cmp = a.days_in_state - b.days_in_state; break
        case 'score': cmp = 0; break  // no score field directly; could derive from events
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [prospects, search, stateFilter, nicheFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div className="border border-white/[0.06] bg-[#111]">
      <div className="border-b border-white/[0.06] p-4 sm:p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">Prospects</h2>
          <span className="text-xs text-white/30">{filtered.length} of {prospects.length}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="search"
            placeholder="Search business or owner..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-amber-500/50"
          />
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value as PipelineState | 'all')}
            className="border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          >
            <option value="all">All states</option>
            {PIPELINE_STATES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select
            value={nicheFilter}
            onChange={e => setNicheFilter(e.target.value)}
            className="border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          >
            <option value="all">All niches</option>
            {niches.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-[10px] font-medium uppercase tracking-wider text-white/40">
              <Th onClick={() => toggleSort('business_name')} active={sortKey === 'business_name'} dir={sortDir}>Business</Th>
              <Th onClick={() => toggleSort('owner')} active={sortKey === 'owner'} dir={sortDir}>Owner</Th>
              <Th onClick={() => toggleSort('niche')} active={sortKey === 'niche'} dir={sortDir}>Niche</Th>
              <Th onClick={() => toggleSort('geo')} active={sortKey === 'geo'} dir={sortDir}>Geo</Th>
              <Th onClick={() => toggleSort('state')} active={sortKey === 'state'} dir={sortDir}>State</Th>
              <Th onClick={() => toggleSort('days')} active={sortKey === 'days'} dir={sortDir}>Days</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-white/30">No prospects match.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="p-3">
                  <Link href={`/admin/prospects/${p.id}`} className="text-white hover:text-amber-500">
                    {p.business_name || '—'}
                  </Link>
                </td>
                <td className="p-3 text-white/60">
                  {[p.owner_first_name, p.owner_last_name].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="p-3 text-white/50">{p.niche || '—'}</td>
                <td className="p-3 text-white/50">
                  {[p.city, p.state].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="p-3"><StateBadge state={p.pipeline_state} /></td>
                <td className="p-3 tabular-nums text-white/50">{p.days_in_state}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, onClick, active, dir }: { children: React.ReactNode; onClick: () => void; active: boolean; dir: string }) {
  return (
    <th className="whitespace-nowrap p-3">
      <button onClick={onClick} className="flex items-center gap-1 transition-colors hover:text-white">
        {children}
        {active && <span className="text-amber-500">{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  )
}
