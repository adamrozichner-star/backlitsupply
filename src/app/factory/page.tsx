import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

export const metadata: Metadata = {
  title: 'Our Factory',
  description: 'How we build custom backlit LED signs. Premium materials, precise engineering, and a 10-day turnaround from order to doorstep.',
  openGraph: { images: ['/factory/hero.webp'] },
}

const PROCESS_STEPS = [
  {
    num: '01',
    title: 'Design & engineering',
    copy: 'Your logo is converted into production-ready vector files. Every letter, curve, and detail is mapped for CNC routing and LED placement.',
    image: '/factory/step-01.webp',
  },
  {
    num: '02',
    title: 'CNC cutting & shaping',
    copy: 'Individual letters and shapes are precision-cut from 3mm cast acrylic on CNC routers. Each piece is hand-finished to remove tooling marks.',
    image: '/factory/step-02.webp',
  },
  {
    num: '03',
    title: 'LED assembly & wiring',
    copy: 'Epistar LED strips are fitted behind each letter on an aluminum housing. Every module is wired in parallel with a UL-listed 12V driver for even, reliable illumination.',
    image: '/factory/step-03.webp',
  },
  {
    num: '04',
    title: 'Testing & shipping',
    copy: 'Every sign runs a 24-hour burn-in test before packing. Signs ship fully assembled in custom foam crating with tracked international delivery.',
    image: '/factory/step-04.webp',
  },
]

const MATERIALS = [
  { label: 'Face material', value: '3mm cast acrylic (clear or frosted)' },
  { label: 'LED modules', value: 'Epistar SMD 2835, 60 LEDs/m' },
  { label: 'Housing', value: 'Brushed aluminum backplate, powder-coated' },
  { label: 'Driver', value: '12V UL-listed constant-voltage driver' },
  { label: 'Mounting', value: 'Standoff pins (included), 15mm wall gap for halo effect' },
  { label: 'Rated life', value: '50,000+ hours' },
]

export default function FactoryPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative px-5 pb-16 pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">Our factory</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Built by hand. Lit by design.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/40">
            Every Backlit Supply sign is made to order. No templates, no shortcuts. Your logo, precision-cut and backlit with commercial-grade LEDs.
          </p>
        </div>
      </section>

      {/* Full-bleed image */}
      <section className="relative mx-auto max-w-5xl px-5 pb-20">
        <div className="relative aspect-[2/1] w-full overflow-hidden">
          <Image
            src="/factory/hero.webp"
            alt="Factory workshop with backlit signs in production"
            fill
            className="object-cover"
            sizes="(max-width: 1280px) 100vw, 1280px"
            priority
          />
        </div>
      </section>

      {/* How signs are made */}
      <section className="border-y border-white/5 bg-[#0d0d0d] py-20">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            How your sign is made
          </h2>
          <p className="mb-12 max-w-2xl text-sm leading-relaxed text-white/40">
            From your logo file to a finished sign on your wall, the process takes about 10 days. Here&apos;s what happens inside the factory.
          </p>

          <div className="space-y-16">
            {PROCESS_STEPS.map((step, i) => (
              <div key={step.num} className={`flex flex-col gap-8 md:flex-row md:items-center ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                <div className="relative aspect-[4/3] w-full overflow-hidden md:w-1/2">
                  <Image
                    src={step.image}
                    alt={step.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <div className="md:w-1/2">
                  <p className="mb-1 text-xs font-medium text-amber-500/60">Step {step.num}</p>
                  <h3 className="mb-3 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{step.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Materials spec */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Materials &amp; specs
          </h2>
          <p className="mb-10 text-sm text-white/40">
            Commercial-grade components rated for indoor and sheltered outdoor use.
          </p>

          <div className="space-y-px overflow-hidden border border-white/[0.06]">
            {MATERIALS.map((m) => (
              <div key={m.label} className="flex items-baseline justify-between bg-[#111] px-5 py-4">
                <span className="text-sm font-medium text-white/60">{m.label}</span>
                <span className="text-sm text-white">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 bg-[#0d0d0d] py-20">
        <div className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            See what your logo looks like, lit up.
          </h2>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 bg-amber-500 px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400"
          >
            Get a free mockup
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </section>
    </div>
  )
}
