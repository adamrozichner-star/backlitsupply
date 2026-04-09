import Link from 'next/link'
import HeroBackground from '@/components/HeroBackground'
import MockupCard from '@/components/MockupCard'
import LeadForm from '@/components/LeadForm'
import StickyMobileCTA from '@/components/StickyMobileCTA'
import { HOMEPAGE_GALLERY, HOMEPAGE_REVIEWS } from '@/lib/gallery'
import { ArrowRight, Package, Eye, Truck } from '@phosphor-icons/react/dist/ssr'

// ─── Data ───────────────────────────────────────────

const STEPS = [
  { icon: Package, title: 'Send your logo', description: 'Upload your logo or brand assets. We handle the rest.' },
  { icon: Eye, title: 'We mockup', description: 'Receive a free photorealistic mockup of your sign within 24 hours.' },
  { icon: Truck, title: 'Ship in 10 days', description: 'Handcrafted and shipped to your door, ready to mount.' },
]

// ─── Page ───────────────────────────────────────────

export default function Home() {
  return (
    <div className="pb-20 md:pb-0">
      {/* ── Hero ────────────────────────────────── */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-5 py-24">
        <HeroBackground />
        <div className="relative mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white sm:text-5xl md:text-6xl">
            Your logo. Lit up.
            <br />
            <span className="text-amber-500">In 10 days.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-white/40 sm:text-lg">
            Custom backlit LED signs for modern businesses. Handcrafted, shipped to your door. Starting at $385.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="flex items-center gap-2 bg-amber-500 px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400"
            >
              Get a free mockup of your logo
              <ArrowRight size={16} weight="bold" />
            </Link>
            <Link
              href="/work"
              className="text-sm text-white/40 transition-colors hover:text-white"
            >
              See our work
            </Link>
          </div>
        </div>
      </section>

      {/* ── Process strip ───────────────────────── */}
      <section className="border-y border-white/5 bg-[#0d0d0d]">
        <div className="mx-auto grid max-w-4xl grid-cols-1 divide-y divide-white/5 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {STEPS.map((step, i) => (
            <div key={i} className="flex flex-col items-center gap-3 px-8 py-10 text-center">
              <div className="flex size-10 items-center justify-center border border-amber-500/20 bg-amber-500/[0.06]">
                <step.icon size={20} className="text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-white">{step.title}</p>
              <p className="text-xs leading-relaxed text-white/40">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Gallery ─────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-amber-500">Our work</p>
          <h2 className="mb-10 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Signs we&apos;ve built
          </h2>

          {/* Horizontal scroll on mobile, grid on desktop */}
          <div className="flex gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
            {HOMEPAGE_GALLERY.map((item) => (
              <MockupCard
                key={item.src}
                src={item.src}
                alt={item.alt}
                category={item.category}
              />
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/work" className="text-sm text-white/40 transition-colors hover:text-white">
              View all work &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social proof ────────────────────────── */}
      <section className="border-y border-white/5 bg-[#0d0d0d] py-20">
        <div className="mx-auto max-w-5xl px-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-amber-500">Reviews</p>
          <h2 className="mb-10 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            What our customers say
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {HOMEPAGE_REVIEWS.map((r) => (
              <div key={r.name} className="flex flex-col border border-white/[0.06] bg-[#111] p-6">
                {/* Stars */}
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <svg key={i} className="size-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="mb-4 flex-1 text-sm italic leading-relaxed text-white/60">
                  &ldquo;{r.quote}&rdquo;
                </p>
                <p className="text-xs font-medium text-white/80">{r.name}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-white/30">
            Verified reviews from our Etsy store{' '}
            <a
              href="https://www.etsy.com/shop/KnitAndThreads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500/60 transition-colors hover:text-amber-500"
            >
              &rarr; KnitAndThreads
            </a>
          </p>
        </div>
      </section>

      {/* ── Lead form ───────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-md px-5">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Get a free mockup
            </h2>
            <p className="mt-2 text-sm text-white/40">
              Send us your logo and we&apos;ll show you what your sign would look like. No commitment.
            </p>
          </div>
          <div className="mt-8">
            <LeadForm />
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────── */}
      <section className="border-t border-white/5 bg-[#0d0d0d] py-20">
        <div className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Ready to light up your brand?
          </h2>
          <p className="mt-3 text-sm text-white/40">
            Custom signs starting at $385. Free mockup, 10-day delivery.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 bg-amber-500 px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400"
          >
            Get started
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </section>

      <StickyMobileCTA />
    </div>
  )
}
