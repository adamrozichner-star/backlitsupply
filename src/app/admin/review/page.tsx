import Link from 'next/link'
import { getReviewQueue } from '@/lib/admin/queries'
import { ReviewQueue } from '@/components/admin/ReviewQueue'
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'

export default async function ReviewPage() {
  const items = await getReviewQueue()

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-amber-500">
        <ArrowLeft size={14} weight="bold" /> Back to dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Mockup Review</h1>
        <p className="mt-1 text-sm text-white/50">
          Compare source logo against generated mockup. Approve to advance to sendable, reject to retry or kill.
        </p>
      </div>

      <ReviewQueue items={items} />
    </div>
  )
}
