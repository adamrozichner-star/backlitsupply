'use client'

import { useState } from 'react'
import { submitLead } from '@/app/actions'

export default function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')

    const formData = new FormData(e.currentTarget)
    const result = await submitLead(formData)

    if (result.success) {
      setStatus('success')
      ;(e.target as HTMLFormElement).reset()
    } else {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="mb-3 text-3xl">&#10003;</div>
        <p className="text-lg font-semibold text-white">We got your request.</p>
        <p className="mt-1 text-sm text-white/40">We&apos;ll send your mockup within 24 hours.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        name="name"
        type="text"
        required
        placeholder="Your name"
        className="w-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-amber-500/50"
      />
      <input
        name="business_name"
        type="text"
        placeholder="Business name"
        className="w-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-amber-500/50"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        className="w-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-amber-500/50"
      />
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full bg-amber-500 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sending...' : 'Get a free mockup'}
      </button>
      {status === 'error' && (
        <p className="text-center text-xs text-red-400">Something went wrong. Try again.</p>
      )}
    </form>
  )
}
