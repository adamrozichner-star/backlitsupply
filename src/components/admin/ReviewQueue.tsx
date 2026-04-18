'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import type { ReviewQueueItem } from '@/lib/admin/queries'
import { approveProspectMockup, rejectProspectMockup, type RejectReason } from '@/lib/admin/actions'
import { StateBadge } from './StateBadge'

const REJECT_REASONS: { value: RejectReason; label: string; shortcut: string }[] = [
  { value: 'hallucinated_logo', label: 'Hallucinated logo (terminal → lost)', shortcut: '1' },
  { value: 'wrong_composition', label: 'Wrong composition (retry)', shortcut: '2' },
  { value: 'low_quality_source', label: 'Low quality source (terminal → lost)', shortcut: '3' },
  { value: 'other', label: 'Other (retry)', shortcut: '4' },
]

export function ReviewQueue({ items: initialItems }: { items: ReviewQueueItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showRejectDropdown, setShowRejectDropdown] = useState(false)
  const [pending, startTransition] = useTransition()

  const current = items[currentIndex] || null
  const remaining = items.length - currentIndex

  function advance() {
    setShowRejectDropdown(false)
    setCurrentIndex(i => Math.min(i + 1, items.length))
  }

  const handleApprove = useCallback(() => {
    if (!current || pending) return
    startTransition(async () => {
      const result = await approveProspectMockup(current.id)
      if (result.ok) {
        toast.success('Approved', { description: current.business_name })
        advance()
      } else {
        toast.error('Approve failed', { description: result.error })
      }
    })
  }, [current, pending])

  const handleReject = useCallback((reason: RejectReason) => {
    if (!current || pending) return
    setShowRejectDropdown(false)
    startTransition(async () => {
      const result = await rejectProspectMockup(current.id, reason)
      const isTerminal = reason === 'hallucinated_logo' || reason === 'low_quality_source'
      if (result.ok) {
        toast.success(isTerminal ? 'Rejected → lost' : 'Rejected → retry', { description: `${current.business_name}: ${reason.replace(/_/g, ' ')}` })
        advance()
      } else {
        toast.error('Reject failed', { description: result.error })
      }
    })
  }, [current, pending])

  // Keyboard shortcuts — only when queue has items
  useEffect(() => {
    if (!current) return

    function onKeyDown(e: KeyboardEvent) {
      // Don't fire if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        handleApprove()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setShowRejectDropdown(prev => !prev)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
      } else if (showRejectDropdown && /^[1-4]$/.test(e.key)) {
        e.preventDefault()
        const reason = REJECT_REASONS[parseInt(e.key, 10) - 1]
        if (reason) handleReject(reason.value)
      } else if (e.key === 'Escape') {
        setShowRejectDropdown(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, showRejectDropdown, handleApprove, handleReject])

  // ── Empty state ──
  if (!current) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-semibold text-white">Queue clear</p>
          <p className="mt-2 text-sm text-white/40">No mockups pending review.</p>
          <Link href="/admin" className="mt-4 inline-block text-xs text-amber-500 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">{current.business_name}</h2>
          <p className="text-xs text-white/50">
            {current.owner_first_name && <span>{current.owner_first_name} · </span>}
            {current.niche && <span>{current.niche} · </span>}
            {[current.city, current.state].filter(Boolean).join(', ')}
            {current.mockup_retry_count > 0 && (
              <span className="ml-2 text-yellow-400">retry #{current.mockup_retry_count}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StateBadge state="mockup_review_pending" />
          <span className="text-xs tabular-nums text-white/30">{remaining} remaining</span>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Source logo */}
        <div className="border border-white/[0.06] bg-[#111]">
          <p className="border-b border-white/[0.06] px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
            Source logo
          </p>
          <div className="flex min-h-[300px] items-center justify-center p-4">
            {current.logo_url ? (
              <Image
                src={current.logo_url}
                alt="Source logo"
                width={800}
                height={400}
                className="max-h-[400px] w-auto object-contain"
                unoptimized
              />
            ) : (
              <p className="text-xs text-white/30">No source logo available</p>
            )}
          </div>
        </div>

        {/* Generated mockup */}
        <div className="border border-white/[0.06] bg-[#111]">
          <p className="border-b border-white/[0.06] px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
            Generated mockup
          </p>
          <div className="flex min-h-[300px] items-center justify-center p-4">
            {current.mockup_url ? (
              <a href={current.mockup_url} target="_blank" rel="noopener noreferrer">
                <Image
                  src={current.mockup_url}
                  alt="Generated mockup"
                  width={1600}
                  height={1000}
                  className="max-h-[400px] w-auto object-contain"
                  unoptimized
                />
              </a>
            ) : (
              <p className="text-xs text-white/30">No mockup generated</p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="border border-white/[0.06] bg-[#111] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleApprove}
            disabled={pending}
            className="bg-amber-500 px-4 py-2.5 text-xs font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {pending ? '...' : 'Approve (A)'}
          </button>
          <button
            onClick={() => setShowRejectDropdown(!showRejectDropdown)}
            disabled={pending}
            className="border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {pending ? '...' : 'Reject / Lost (R)'}
          </button>
          <button
            onClick={() => advance()}
            disabled={pending}
            className="border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            Skip (→)
          </button>
          <Link
            href={`/admin/prospects/${current.id}`}
            className="ml-auto text-xs text-white/40 hover:text-amber-500"
          >
            Detail →
          </Link>
        </div>

        {showRejectDropdown && (
          <div className="mt-3 space-y-1 border border-white/[0.06] bg-black/40 p-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
              Select rejection reason:
            </p>
            {REJECT_REASONS.map(r => (
              <button
                key={r.value}
                onClick={() => handleReject(r.value)}
                disabled={pending}
                className="block w-full px-3 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <span className="mr-2 text-amber-500">{r.shortcut}</span>{r.label}
              </button>
            ))}
            <p className="mt-2 text-[10px] text-white/20">Press 1-4 to select, Esc to cancel</p>
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="text-center text-[10px] text-white/20">
        A = approve · R = reject menu · 1-4 = reason · → = skip · Esc = close menu
      </p>
    </div>
  )
}
