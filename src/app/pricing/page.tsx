import type { Metadata } from 'next'
import Link from 'next/link'
import { PRICING_TIERS } from '@/lib/pricing'
import { Check, ArrowRight } from '@phosphor-icons/react/dist/ssr'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Custom backlit LED signs starting at $385. Transparent pricing, no hidden fees. See our three tiers: Compact, Standard, and Statement.',
  openGraph: { images: ['/work/sign-06.webp'] },
}

const FAQ = [
  { q: "What's included in the price?", a: 'Sign, LED system, mounting hardware, free international shipping, 2-year electronics warranty.' },
  { q: 'How long until delivery?', a: 'Mockups are usually ready within minutes of your request. 10 days from approved mockup to delivery.' },
  { q: "What if I don't like the mockup?", a: "Unlimited revisions until you're 100% happy. You don't pay until you approve." },
  { q: 'Do you ship internationally?', a: 'Yes, free tracked shipping to every country we serve, with signature on delivery.' },
  { q: 'Is the price in USD?', a: 'Yes. All prices are in US dollars.' },
  { q: 'Can I pay with a credit card?', a: 'Yes, secure checkout via Stripe. All major cards accepted.' },
]

export default function PricingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="px-5 pb-16 pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">Pricing</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Premium signs, transparent prices.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/40">
            No hidden fees. No &ldquo;contact us for a quote.&rdquo; Pick a tier, see your mockup, ship in 10 days.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative flex flex-col border p-6 ${
                tier.popular
                  ? 'border-amber-500/40 bg-amber-500/[0.03]'
                  : 'border-white/[0.06] bg-[#111]'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-4 bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-black">
                  Most popular
                </span>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
                <p className="mt-4 text-3xl font-semibold text-amber-500">{tier.priceDisplay}</p>
                <p className="mt-1 text-xs text-white/30">{tier.tagline}</p>
              </div>

              <div className="mb-6 space-y-1 text-sm text-white/50">
                <p>{tier.dimensions}</p>
                <p>Best for: {tier.bestFor}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                    <Check size={16} weight="bold" className="mt-0.5 flex-shrink-0 text-amber-500" />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={tier.stripeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  tier.popular
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                Start your order
                <ArrowRight size={14} weight="bold" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Custom quote */}
      <section className="border-y border-white/5 bg-[#0d0d0d] py-16">
        <div className="mx-auto max-w-2xl px-5 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-amber-500/60">Bigger project?</p>
          <h3 className="text-xl font-semibold text-white">Need something larger or fully custom?</h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/40">
            For multi-location rollouts, oversized installations, or fully bespoke designs, we&apos;ll build you a custom quote.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex items-center gap-2 border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Get a custom quote
            <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
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
    </div>
  )
}
