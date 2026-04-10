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

  // Fire-and-forget view tracking
  const hdrs = await headers()
  recordPageView(prospect.id, hdrs.get('user-agent'), hdrs.get('referer'))

  return <ProspectPageView prospect={prospect} />
}
