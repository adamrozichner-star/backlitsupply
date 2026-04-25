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
      images: [prospect.mockup_url || '/mockups/brickell-yoga-miami.webp'],
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `Custom Backlit Sign for ${prospect.business_name}`,
    description: `A premium backlit LED sign featuring the ${prospect.business_name} logo. Precision-cut acrylic with warm LED backlighting.`,
    image: `https://backlitsupply.com${prospect.mockup_url || '/mockups/brickell-yoga-miami.webp'}`,
    brand: { '@type': 'Brand', name: 'Backlit Supply' },
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: 385,
      highPrice: 2000,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://backlitsupply.com' },
      { '@type': 'ListItem', position: 2, name: 'Our Work', item: 'https://backlitsupply.com/work' },
      { '@type': 'ListItem', position: 3, name: prospect.business_name, item: `https://backlitsupply.com/for/${slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <ProspectPageView prospect={prospect} />
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
