import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getProspectBySlug, recordPageView } from '@/lib/data/prospects'
import ProspectPageView from '@/components/ProspectPageView'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const prospect = await getProspectBySlug(slug)

  if (!prospect) return { title: 'Not found' }

  return {
    title: `A custom backlit sign for ${prospect.business_name}`,
    description: 'We made you a free mockup of your logo as a premium backlit sign. See it before you commit.',
    openGraph: {
      title: `${prospect.business_name} × Backlit Supply`,
      images: [prospect.mockup_url || '/work/sign-06.webp'],
    },
  }
}

export default async function ProspectPage({ params }: Props) {
  const { slug } = await params
  const prospect = await getProspectBySlug(slug)

  if (!prospect) notFound()

  // Fire-and-forget view tracking (legacy — raw prospect_page_views table)
  const hdrs = await headers()
  recordPageView(prospect.id, hdrs.get('user-agent'), hdrs.get('referer'))

  return (
    <>
      <ProspectPageView prospect={prospect} />
      {/* Tracking pixel — writes page_visited event, auto-transitions sent→opened.
          1h cookie dedupe, bot-filtered server-side. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/track/visit?slug=${encodeURIComponent(slug)}`}
        width="1"
        height="1"
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
      />
    </>
  )
}
