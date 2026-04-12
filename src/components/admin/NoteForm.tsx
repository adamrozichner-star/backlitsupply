'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addProspectNote } from '@/lib/admin/actions'

export function NoteForm({ prospectId }: { prospectId: string }) {
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = note.trim()
    if (!trimmed) return

    startTransition(async () => {
      const result = await addProspectNote(prospectId, trimmed)
      if (result.ok) {
        toast.success('Note added')
        setNote('')
      } else {
        toast.error('Failed to add note', { description: result.error || 'Unknown error' })
      }
    })
  }

  const chars = note.length

  return (
    <form onSubmit={handleSubmit} className="border border-white/[0.06] bg-[#111] p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-white">Add note</h2>
        <p className="text-[10px] tabular-nums text-white/30">{chars}/2000</p>
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Paste reply text, log call notes, flag concerns..."
        rows={3}
        maxLength={2000}
        disabled={pending}
        className="w-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none transition-colors focus:border-amber-500/50 disabled:opacity-50"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={pending || !note.trim()}
          className="bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Adding...' : 'Add note'}
        </button>
      </div>
    </form>
  )
}
