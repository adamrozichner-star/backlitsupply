import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getProspectDetail, type PipelineState } from '@/lib/admin/queries'
import { StateBadge } from '@/components/admin/StateBadge'
import { EventTimeline } from '@/components/admin/EventTimeline'
import { StateActions } from '@/components/admin/StateActions'
import { NoteForm } from '@/components/admin/NoteForm'
import { ArrowLeft, ArrowSquareOut } from '@phosphor-icons/react/dist/ssr'

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getProspectDetail(id)
  if (!data) notFound()

  const { prospect, events } = data
  const qualifyEvent = events.find(e => e.event === 'state:qualified')
  const score = qualifyEvent?.payload.score as number | undefined
  const breakdown = qualifyEvent?.payload.breakdown as Record<string, number> | undefined

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-amber-500">
        <ArrowLeft size={14} weight="bold" /> Back to dashboard
      </Link>

      {/* Header */}
      <header className="border border-white/[0.06] bg-[#111] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              {prospect.business_name || '(no name)'}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {[prospect.owner_first_name, prospect.owner_last_name].filter(Boolean).join(' ') || '—'}
              {prospect.niche && <span className="mx-2 text-white/20">·</span>}
              {prospect.niche}
              {prospect.city && <span className="mx-2 text-white/20">·</span>}
              {[prospect.city, prospect.state].filter(Boolean).join(', ')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StateBadge state={prospect.pipeline_state} />
            <p className="text-[10px] tabular-nums text-white/30">
              {prospect.days_in_state}d in state
            </p>
          </div>
        </div>
      </header>

      {/* Two column */}
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        {/* Left col */}
        <div className="space-y-4">
          {/* Mockup */}
          {prospect.mockup_url ? (
            <a
              href={prospect.mockup_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden border border-white/[0.06]"
            >
              <Image
                src={prospect.mockup_url}
                alt={`Mockup for ${prospect.business_name}`}
                width={1600}
                height={1000}
                className="w-full"
                unoptimized
              />
            </a>
          ) : (
            <div className="flex aspect-[8/5] items-center justify-center border border-dashed border-white/10 bg-[#111] text-xs text-white/30">
              No mockup yet
            </div>
          )}

          {/* Details */}
          <div className="border border-white/[0.06] bg-[#111] p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-white">Details</h2>
            <dl className="space-y-2 text-xs">
              <Row label="Slug" value={prospect.slug} />
              <Row label="Website" value={prospect.website} link={prospect.website || undefined} />
              <Row label="Email" value={prospect.email} link={prospect.email ? `mailto:${prospect.email}` : undefined} />
              <Row label="Phone" value={prospect.phone} />
              <Row label="Source" value={prospect.source} />
              <Row label="Enrichment v" value={prospect.enrichment_version?.toString() || '—'} />
              <Row label="Created" value={new Date(prospect.created_at).toISOString().slice(0, 10)} />
            </dl>
          </div>

          {/* Qualify score */}
          {score !== undefined && (
            <div className="border border-white/[0.06] bg-[#111] p-4 sm:p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-white">Qualify score</h2>
                <span className="text-lg font-semibold text-amber-500 tabular-nums">{score}</span>
              </div>
              {breakdown && (
                <dl className="space-y-1 text-xs">
                  {Object.entries(breakdown).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-white/40">{k}</dt>
                      <dd className="tabular-nums text-white/60">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {/* Preview link */}
          {prospect.slug && (
            <Link
              href={`/for/${prospect.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              Preview personalized page
              <ArrowSquareOut size={14} weight="bold" />
            </Link>
          )}
        </div>

        {/* Right col — state actions + timeline + note form */}
        <div className="space-y-4">
          {prospect.pipeline_state && (
            <StateActions
              prospectId={prospect.id}
              currentState={prospect.pipeline_state as PipelineState}
              daysInState={prospect.days_in_state}
            />
          )}
          <EventTimeline events={events} />
          <NoteForm prospectId={prospect.id} />
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-white/30">{label}</dt>
      <dd className="min-w-0 max-w-full truncate text-right text-white/70">
        {value ? (
          link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="hover:text-amber-500">{value}</a>
          ) : value
        ) : <span className="text-white/20">—</span>}
      </dd>
    </div>
  )
}
