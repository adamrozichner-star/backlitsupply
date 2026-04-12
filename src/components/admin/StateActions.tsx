'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import type { PipelineState } from '@/lib/admin/queries'
import { StateBadge } from './StateBadge'
import { updateProspectState } from '@/lib/admin/actions'

// State machine: what transitions are available from each state
const ACTIONS: Record<PipelineState, Array<{ label: string; to: PipelineState; variant: 'primary' | 'danger' | 'ghost' }>> = {
  discovered: [],
  enriched: [],
  qualified: [],
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
    { label: 'Mark as Positive', to: 'positive', variant: 'primary' },
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
  const actions = ACTIONS[currentState] || []

  function handleAction(to: PipelineState, label: string, reason?: string) {
    startTransition(async () => {
      const result = await updateProspectState(prospectId, to, reason)
      if (result.ok) {
        toast.success(`${label}`, {
          description: `${currentState} → ${to}`,
        })
      } else {
        toast.error('Update failed', { description: result.error || 'Unknown error' })
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

      {actions.length === 0 ? (
        <p className="text-xs text-white/30">
          {currentState === 'won'
            ? 'Terminal state — no further transitions.'
            : 'No manual transitions available from this state.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map(action => (
            <button
              key={action.to}
              onClick={() => handleAction(action.to, action.label)}
              disabled={pending}
              className={`px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLS[action.variant]}`}
            >
              {pending ? '...' : action.label}
            </button>
          ))}
        </div>
      )}

      {/* Reset — visually separated, confirms before firing.
          Hidden when already at 'discovered' (no-op). */}
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
