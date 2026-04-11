import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Star } from '@phosphor-icons/react/dist/ssr'
import type { Prospect } from '@/lib/types/prospect'
import { HOMEPAGE_REVIEWS } from '@/lib/gallery'
import { FAQ } from '@/lib/faq'

const TRUST_REVIEWS = HOMEPAGE_REVIEWS.filter(r =>
  ['Lauren', 'Natalie', 'Haley'].includes(r.name)
)

function formatPrice(usd: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(usd)
}

export default function ProspectPageView({ prospect }: { prospect: Prospect }) {
  const firstName = prospect.owner_first_name || 'there'
  const dimensions = prospect.suggested_dimensions || '24" wide'
  const price = prospect.suggested_price_usd ? formatPrice(prospect.suggested_price_usd) : 'From $385'
  const hasMockup = !!prospect.mockup_url

  return (
    <div>
      {/* ── Hero ── */}
      <section className="px-5 pb-16 pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">
            Made for {prospect.business_name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Hi {firstName}, here&apos;s what your sign would look like.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/40">
            We took your logo and rendered it as a premium backlit sign &mdash; the same kind we make for hospitality
            and retail brands. Below is yours, free, no commitment.
          </p>
        </div>
      </section>

      {/* ── Mockup ── */}
      <section className="mx-auto max-w-3xl px-5 pb-16">
        {hasMockup ? (
          <div className="overflow-hidden border border-white/[0.06]">
            <Image
              src={prospect.mockup_url!}
              alt={`Backlit sign mockup for ${prospect.business_name}`}
              width={1200}
              height={800}
              className="w-full"
              priority
            />
          </div>
        ) : (
          <div className="flex aspect-[3/2] items-center justify-center border border-dashed border-white/10 bg-[#111]">
            <div className="text-center">
              <p className="text-lg font-medium text-white/40">Generating your mockup&hellip;</p>
              <p className="mt-2 text-sm text-white/20">We&apos;ll email you when it&apos;s ready.</p>
            </div>
          </div>
        )}
        <p className="mt-4 text-center text-sm text-white/30">
          Your logo, {dimensions}, halo-lit on premium acrylic with brushed steel returns.
        </p>
      </section>

      {/* ── Spec block ── */}
      <section className="border-y border-white/5 bg-[#0d0d0d] py-12">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-8 px-5 sm:grid-cols-3">
          <div className="text-center">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/30">Dimensions</p>
            <p className="text-lg font-semibold text-white">{dimensions}</p>
          </div>
          <div className="text-center">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/30">Price</p>
            <p className="text-lg font-semibold text-amber-500">{price}</p>
          </div>
          <div className="text-center">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/30">Lead time</p>
            <p className="text-lg font-semibold text-white">10 days from approval</p>
          </div>
        </div>
      </section>

      {/* ── Primary CTA ── */}
      <section className="py-16">
        <div className="mx-auto max-w-2xl px-5 text-center">
          <a
            href="mailto:adam@backlitsupply.com"
            className="inline-flex items-center gap-2 bg-amber-500 px-8 py-4 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Reply to Adam
            <ArrowRight size={16} weight="bold" />
          </a>
          <p className="mt-4">
            <span className="text-sm text-white/20">
              WhatsApp &mdash; coming soon
            </span>
          </p>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="border-y border-white/5 bg-[#0d0d0d] py-16">
        <div className="mx-auto max-w-3xl px-5">
          <div className="grid gap-6 sm:grid-cols-3">
            {TRUST_REVIEWS.map((review) => (
              <div key={review.name} className="border border-white/[0.06] bg-[#111] p-5">
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} size={14} weight="fill" className="text-amber-500" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-white/50">&ldquo;{review.quote}&rdquo;</p>
                <p className="mt-3 text-xs font-medium text-white/30">&mdash; {review.name}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-white/20">
            Verified reviews from our{' '}
            <a
              href="https://www.etsy.com/shop/KnitAndThreads"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-amber-500"
            >
              Etsy store
            </a>
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20">
        <div className="mx-auto max-w-2xl px-5">
          <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight text-white">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-white/[0.06]">
            {FAQ.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer items-center justify-between py-4 text-sm font-medium text-white transition-colors hover:text-amber-500">
                  {item.q}
                  <span className="ml-4 text-white/20 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-white/40">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-16">
        <div className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Ready to light up {prospect.business_name}?
          </h2>
          <a
            href="mailto:adam@backlitsupply.com"
            className="mt-8 inline-flex items-center gap-2 bg-amber-500 px-8 py-4 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Reply to Adam
            <ArrowRight size={16} weight="bold" />
          </a>
        </div>
      </section>

      {/* ── Footer note ── */}
      <section className="border-t border-white/5 py-8">
        <p className="mx-auto max-w-2xl px-5 text-center text-xs leading-relaxed text-white/20">
          This page was built specifically for {prospect.business_name}. Questions? Reply to the email
          we sent you, or reach out at{' '}
          <a href="mailto:adam@backlitsupply.com" className="underline underline-offset-2 hover:text-amber-500">
            adam@backlitsupply.com
          </a>
          .
        </p>
      </section>
    </div>
  )
}
