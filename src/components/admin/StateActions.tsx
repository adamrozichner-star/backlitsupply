'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { PipelineState } from '@/lib/admin/queries'
import { StateBadge } from './StateBadge'
import { updateProspectState, approveProspectMockup, rejectProspectMockup, type RejectReason } from '@/lib/admin/actions'

// State machine: what transitions are available from each state
const ACTIONS: Record<PipelineState, Array<{ label: string; to: PipelineState; variant: 'primary' | 'danger' | 'ghost'; reason?: string }>> = {
  discovered: [],
  enriched: [],
  qualified: [],
  mockup_review_pending: [], // handled separately below
  mockup_ready: [
    { label: 'Mark as Sent', to: 'sent', variant: 'primary' },
    { label: 'Mark as Lost', to: 'lost', variant: 'danger' },
  ],
  sent: [
    { label: 'Mark as Opened', to: 'opened', variant: 'primary' },
    { label: 'Mark as Replied', to: 'replied', variant: 'primary' },
    { label: 'Mark as Lost', to: 'lost', variant: 'danger' },
  ],
  opened: [
    { label: 'Mark as Replied', to: 'replied', variant: 'primary' },
    { label: 'Mark as Lost', to: 'lost', variant: 'danger' },
  ],
  replied: [
    { label: 'Quote Sent', to: 'positive', variant: 'primary', reason: 'quote_sent' },
    { label: 'In Conversation', to: 'positive', variant: 'primary', reason: 'in_conversation' },
    { label: 'Mark as Lost', to: 'lost', variant: 'danger' },
  ],
  positive: [
    { label: 'Mark as Booked', to: 'booked', variant: 'primary' },
    { label: 'Mark as Lost', to: 'lost', variant: 'danger' },
  ],
  booked: [
    { label: 'Mark as Won', to: 'won', variant: 'primary' },
    { label: 'Mark as Lost', to: 'lost', variant: 'danger' },
  ],
  won: [],
  bounced: [
    { label: 'Mark as Lost (hard bounce)', to: 'lost', variant: 'danger' },
    { label: 'Reactivate to Discovered', to: 'discovered', variant: 'ghost' },
  ],
  lost: [
    { label: 'Reactivate to Discovered', to: 'discovered', variant: 'ghost' },
  ],
  dead: [
    { label: 'Reactivate to Discovered', to: 'discovered', variant: 'ghost' },
  ],
}

const VARIANT_CLS: Record<'primary' | 'danger' | 'ghost', string> = {
  primary: 'bg-amber-500 text-black hover:bg-amber-400',
  danger: 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20',
  ghost: 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
}

const REJECT_REASONS: { value: RejectReason; label: string }[] = [
  { value: 'hallucinated_logo', label: 'Hallucinated logo (terminal → lost)' },
  { value: 'wrong_composition', label: 'Wrong composition (retry once)' },
  { value: 'low_quality_source', label: 'Low quality source (terminal → lost)' },
  { value: 'other', label: 'Other (retry once)' },
]

export function StateActions({
  prospectId,
  currentState,
  daysInState,
}: {
  prospectId: string
  currentState: PipelineState
  daysInState: number
}) {
  const [pending, startTransition] = useTransition()
  const [showRejectDropdown, setShowRejectDropdown] = useState(false)
  const actions = ACTIONS[currentState] || []
  const isReviewPending = currentState === 'mockup_review_pending'

  function handleAction(to: PipelineState, label: string, reason?: string) {
    startTransition(async () => {
      const result = await updateProspectState(prospectId, to, reason)
      if (result.ok) {
        toast.success(label, { description: `${currentState} → ${to}` })
      } else {
        toast.error('Update failed', { description: result.error || 'Unknown error' })
      }
    })
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approveProspectMockup(prospectId)
      if (result.ok) {
        toast.success('Mockup approved', { description: 'mockup_review_pending → mockup_ready' })
      } else {
        toast.error('Approve failed', { description: result.error || 'Unknown error' })
      }
    })
  }

  function handleReject(reason: RejectReason) {
    setShowRejectDropdown(false)
    startTransition(async () => {
      const result = await rejectProspectMockup(prospectId, reason)
      const isTerminal = reason === 'hallucinated_logo' || reason === 'low_quality_source'
      if (result.ok) {
        toast.success(isTerminal ? 'Rejected → lost (terminal)' : 'Rejected → qualified (retry)', { description: reason.replace(/_/g, ' ') })
      } else {
        toast.error('Reject failed', { description: result.error || 'Unknown error' })
      }
    })
  }

  function handleReset() {
    const ok = window.confirm(
      `Reset this prospect from "${currentState}" back to "discovered"?\n\nThis re-opens them to the pipeline. Use only for corrections.`
    )
    if (!ok) return
    handleAction('discovered', 'Reset to Discovered', 'manual_reset')
  }

  return (
    <div className="border border-white/[0.06] bg-[#111] p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-white">State</h2>
        <p className="text-[10px] tabular-nums text-white/30">{daysInState}d in state</p>
      </div>

      <div className="mb-4">
        <StateBadge state={currentState} />
      </div>

      {/* mockup_review_pending: approve / reject+reason / lost+reason */}
      {isReviewPending && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleApprove}
              disabled={pending}
              className={`px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLS.primary}`}
            >
              {pending ? '...' : 'Approve (A)'}
            </button>
            <button
              onClick={() => setShowRejectDropdown(!showRejectDropdown)}
              disabled={pending}
              className={`px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLS.danger}`}
            >
              {pending ? '...' : 'Reject / Lost (R)'}
            </button>
          </div>

          {showRejectDropdown && (
            <div className="space-y-1 border border-white/[0.06] bg-black/40 p-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">Select reason:</p>
              {REJECT_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => handleReject(r.value)}
                  disabled={pending}
                  className="block w-full px-3 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Standard state actions (non-review states) */}
      {!isReviewPending && actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map(action => (
            <button
              key={action.reason || action.to}
              onClick={() => handleAction(action.to, action.label, action.reason)}
              disabled={pending}
              className={`px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLS[action.variant]}`}
            >
              {pending ? '...' : action.label}
            </button>
          ))}
        </div>
      )}

      {!isReviewPending && actions.length === 0 && (
        <p className="text-xs text-white/30">
          {currentState === 'won'
            ? 'Terminal state — no further transitions.'
            : 'No manual transitions available from this state.'}
        </p>
      )}

      {/* Reset — visually separated, confirms before firing */}
      {currentState !== 'discovered' && (
        <div className="mt-5 border-t border-white/[0.04] pt-4">
          <button
            onClick={handleReset}
            disabled={pending}
            className="text-[10px] uppercase tracking-wider text-white/25 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ↺ Reset to Discovered
          </button>
        </div>
      )}
    </div>
  )
}
