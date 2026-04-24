import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, UploadSimple, Sparkle, ChatCircleText, Truck } from '@phosphor-icons/react/dist/ssr'

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'From logo upload to doorstep delivery in 10 days. See how Backlit Supply builds custom backlit LED signs with free mockups and unlimited revisions.',
  openGraph: { images: ['/mockups/brickell-yoga-miami.webp'] },
}

const STEPS = [
  {
    num: '01',
    title: 'Send us your logo',
    icon: UploadSimple,
    copy: "You upload your logo and tell us where the sign is going. That's the entire form. No long questionnaires, no \"schedule a discovery call,\" no waiting. Takes 30 seconds.",
  },
  {
    num: '02',
    title: 'See your sign before you buy it',
    icon: Sparkle,
    copy: "Within 24 hours, we render your logo as a real backlit sign \u2014 on the kind of wall, surface, or storefront you'd actually mount it on. You see exactly what you'll get. No deposit, no commitment.",
  },
  {
    num: '03',
    title: "Refine until it's perfect",
    icon: ChatCircleText,
    copy: 'Want it bigger? Different color? Message us directly. We respond within hours during business days. Unlimited revisions until you\'re happy.',
  },
  {
    num: '04',
    title: 'Approve, pay, and we ship in 10 days',
    icon: Truck,
    copy: 'One-click checkout. As soon as payment clears, your sign goes into production with our manufacturing partner. Hand-crafted in premium acrylic and brushed steel, free international shipping, fully tracked, signature on delivery.',
  },
]

const COMPARISON = [
  { label: 'First mockup', traditional: '3\u20137 days', us: 'Minutes' },
  { label: 'Revisions', traditional: 'Email chains', us: 'Live, unlimited' },
  { label: 'Quoting', traditional: 'Phone, PDFs, back-and-forth', us: 'One click' },
  { label: 'Support', traditional: 'Business hours', us: 'Same-day response' },
  { label: 'Delivery', traditional: '4\u20138 weeks', us: '10 days' },
  { label: 'Pricing', traditional: '\u201CContact us\u201D', us: 'Public, on-site' },
]

export default function ProcessPage() {
  return (
    <div>
      {/* Hero */}
      <section className="px-5 pb-16 pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">How it works</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Your sign, ready in days. Not weeks.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/40">
            Most sign shops take 4&ndash;8 weeks of email back-and-forth before you even see what you&apos;re paying for. We compress that into days &mdash; so you can decide, approve, and ship without the wait.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-2xl px-5 pb-20">
        <div className="space-y-16">
          {STEPS.map((step, i) => (
            <div key={step.num}>
              <div className="flex items-start gap-5">
                <div className="flex flex-col items-center">
                  <div className="flex size-12 items-center justify-center border border-amber-500/20 bg-amber-500/[0.06]">
                    <step.icon size={24} className="text-amber-500" />
                  </div>
                  {i < STEPS.length - 1 && <div className="mt-3 h-16 w-px bg-white/10" />}
                </div>
                <div className="pt-1">
                  <p className="mb-1 text-xs font-medium text-amber-500/60">Step {step.num}</p>
                  <h3 className="mb-3 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{step.copy}</p>
                </div>
              </div>

              {/* Mid-page CTA after step 02 */}
              {step.num === '02' && (
                <div className="mt-10 text-center">
                  <Link
                    href="/#lead-form"
                    className="inline-flex items-center gap-2 bg-amber-500 px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400"
                  >
                    Get your free mockup
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="border-y border-white/5 bg-[#0d0d0d] py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Why we&apos;re different
          </h2>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-3 gap-px overflow-hidden border border-white/[0.06]">
              <div className="bg-[#111] p-4 text-xs font-medium uppercase tracking-wider text-white/30" />
              <div className="bg-[#111] p-4 text-xs font-medium uppercase tracking-wider text-white/30">Traditional sign shops</div>
              <div className="bg-[#111] p-4 text-xs font-medium uppercase tracking-wider text-amber-500/60">Backlit Supply</div>
              {COMPARISON.map((row) => (
                <>
                  <div key={`${row.label}-label`} className="border-t border-white/[0.06] bg-[#0f0f0f] p-4 text-sm font-medium text-white/60">{row.label}</div>
                  <div key={`${row.label}-trad`} className="border-t border-white/[0.06] bg-[#0f0f0f] p-4 text-sm text-white/30">{row.traditional}</div>
                  <div key={`${row.label}-us`} className="border-t border-white/[0.06] bg-[#0f0f0f] p-4 text-sm font-medium text-white">{row.us}</div>
                </>
              ))}
            </div>
          </div>

          {/* Mobile stacked */}
          <div className="space-y-3 sm:hidden">
            {COMPARISON.map((row) => (
              <div key={row.label} className="border border-white/[0.06] bg-[#111] p-4">
                <p className="mb-2 text-xs font-medium text-white/40">{row.label}</p>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-white/25 line-through">{row.traditional}</span>
                  <span className="text-sm font-medium text-amber-500">{row.us}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            See what your logo looks like, lit up.
          </h2>
          <Link
            href="/#lead-form"
            className="mt-8 inline-flex items-center gap-2 bg-amber-500 px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400"
          >
            Get your free mockup
            <ArrowRight size={16} weight="bold" />
          </Link>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/30">
            <span className="flex items-center gap-1.5"><span className="text-amber-500">&#10003;</span> Free, no commitment</span>
            <span className="flex items-center gap-1.5"><span className="text-amber-500">&#10003;</span> See it before you pay</span>
            <span className="flex items-center gap-1.5"><span className="text-amber-500">&#10003;</span> Unlimited revisions</span>
            <span className="flex items-center gap-1.5"><span className="text-amber-500">&#10003;</span> Ships in 10 days</span>
          </div>
        </div>
      </section>
    </div>
  )
}
