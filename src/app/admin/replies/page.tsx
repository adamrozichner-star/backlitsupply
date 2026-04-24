import Link from 'next/link'
import { getReplies } from '@/lib/admin/queries'
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'
import { StateBadge } from '@/components/admin/StateBadge'

export default async function RepliesPage() {
  const replies = await getReplies()

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-amber-500">
        <ArrowLeft size={14} weight="bold" /> Back to dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Replies</h1>
        <p className="mt-1 text-sm text-white/50">
          Prospects who replied to outreach. Classification powered by Haiku.
        </p>
      </div>

      {replies.length === 0 ? (
        <p className="text-sm text-white/30">No replies yet.</p>
      ) : (
        <div className="space-y-3">
          {replies.map(r => (
            <Link
              key={r.id}
              href={`/admin/prospects/${r.id}`}
              className="block border border-white/[0.06] bg-[#111] p-4 transition-colors hover:border-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {r.classification_emoji && (
                      <span className="text-base">{r.classification_emoji}</span>
                    )}
                    <span className="text-sm font-medium text-white">
                      {r.business_name || r.slug || 'Unknown'}
                    </span>
                    {r.classification && (
                      <span className="text-[10px] uppercase tracking-wider text-white/40">
                        {r.classification.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                    {r.owner_first_name && <span>{r.owner_first_name}</span>}
                    {r.niche && <span>{r.niche}</span>}
                    {r.city && <span>{r.city}</span>}
                    {r.phone && <span>{r.phone}</span>}
                  </div>

                  {r.reply_body && (
                    <p className="mt-2 text-xs leading-relaxed text-white/50">
                      &ldquo;{r.reply_body.slice(0, 150)}{r.reply_body.length > 150 ? '...' : ''}&rdquo;
                    </p>
                  )}

                  {r.suggested_response && (
                    <p className="mt-1.5 text-xs text-amber-500/70">
                      Suggested: {r.suggested_response}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <StateBadge state={r.pipeline_state} />
                  <span className="text-[10px] tabular-nums text-white/25">{r.days_in_state}d</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
