'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { verifyProspectMockup } from '@/lib/admin/actions'

export function VerifyMockupButton({ prospectId }: { prospectId: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await verifyProspectMockup(prospectId)
      if (result.ok) {
        toast.success('Mockup verified', { description: result.detail })
      } else {
        toast.error('Mockup broken', { description: result.error || result.detail })
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="w-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Verifying...' : 'Verify mockup'}
    </button>
  )
}
