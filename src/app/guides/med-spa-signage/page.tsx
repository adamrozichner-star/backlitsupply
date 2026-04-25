import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

export const metadata: Metadata = {
  title: 'Custom Backlit Signs for Med Spas: A Complete Guide',
  description: 'Everything med spa owners need to know about backlit LED signage — materials, sizing, pricing, and installation. With real mockup examples.',
  openGraph: {
    title: 'Med Spa Signage Guide | Backlit Supply',
    images: ['/mockups/aesthetica-med-spa-austin.webp'],
  },
}

const EXAMPLES = [
  { src: '/mockups/aesthetica-med-spa-austin.webp', label: 'Med spa, Austin' },
  { src: '/mockups/alchemy-wellness-med-spa-austin.webp', label: 'Wellness spa, Austin' },
  { src: '/mockups/glo-med-spa-austin-austin.webp', label: 'Med spa, Austin' },
  { src: '/mockups/rejuvenate-austin-austin.webp', label: 'Wellness studio, Austin' },
]

export default function MedSpaSignageGuide() {
  return (
    <div>
      {/* Hero */}
      <section className="px-5 pb-16 pt-24">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">Guide</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Custom Backlit Signs for Med Spas
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/40">
            A med spa&apos;s signage is the first thing clients see and the last thing they remember. The right sign doesn&apos;t just mark your location &mdash; it signals that what happens inside is premium. Backlit signs do this better than anything else on the market.
          </p>
        </div>
      </section>

      {/* Content */}
      <article className="mx-auto max-w-2xl px-5 pb-20">
        <div className="space-y-12 text-[15px] leading-relaxed text-white/60">

          {/* Section 1 */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">What makes a great med spa sign</h2>
            <p className="mb-4">
              Three factors separate forgettable signs from ones that build your brand on sight: material, lighting, and scale.
            </p>
            <p className="mb-4">
              <strong className="text-white/80">Material matters.</strong> Flat vinyl and foam board look cheap up close. Clients walking into a $300 facial expect to see solid materials. Cast acrylic letters with brushed aluminum backing feel as premium as the treatments you offer. They&apos;re durable, easy to clean, and age well in climate-controlled interiors.
            </p>
            <p className="mb-4">
              <strong className="text-white/80">Halo-lit (backlit) vs. front-lit.</strong> Front-lit signs wash out detail and cast harsh shadows on surrounding walls. Backlit signs project a warm halo onto the wall behind them, creating depth and dimension. The effect is subtle but unmistakable &mdash; the logo appears to float, glowing from behind. This is the look that high-end hospitality and wellness brands use, and there&apos;s a reason for it.
            </p>
            <p>
              <strong className="text-white/80">Scale.</strong> Entrance signs should be large enough to see from the parking lot or sidewalk. Interior signs &mdash; behind the reception desk, in treatment hallways &mdash; can be smaller and more intimate. Most med spas need both: one outdoor-facing sign and one interior statement piece.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Typical sizes and pricing</h2>
            <p className="mb-4">
              Most med spa signs fall between 24 and 48 inches wide. The right size depends on your wall space, viewing distance, and logo complexity. Simple wordmarks can go larger; detailed logos with fine lines work better at moderate sizes where every detail stays crisp.
            </p>
            <div className="my-6 space-y-px overflow-hidden border border-white/[0.06]">
              {[
                ['24" wide', '$385 – $500', 'Interior, reception desk backdrop'],
                ['36" wide', '$600 – $900', 'Most popular. Entrance + interior'],
                ['48" wide', '$1,000 – $1,500', 'Storefront, visible from street'],
                ['60"+ wide', '$1,500 – $2,000+', 'Large facades, multi-tenant buildings'],
              ].map(([size, price, use]) => (
                <div key={size} className="flex items-baseline justify-between gap-4 bg-[#111] px-5 py-3">
                  <span className="text-sm font-medium text-white/80">{size}</span>
                  <span className="text-sm text-amber-500/80">{price}</span>
                  <span className="hidden text-xs text-white/30 sm:block">{use}</span>
                </div>
              ))}
            </div>
            <p>
              Pricing includes LED modules, driver, mounting hardware, and free shipping. Custom colors, finishes, or oversized signs are quoted individually.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Installation options</h2>
            <p className="mb-4">
              Every sign ships ready to mount. You don&apos;t need a sign contractor &mdash; any handyman or general contractor can install one in under an hour. There are three common mounting methods:
            </p>
            <p className="mb-4">
              <strong className="text-white/80">Standoff mount</strong> is the most common for backlit signs. Metal standoff pins hold each letter 15mm from the wall, creating the gap that allows light to project behind the letters. This produces the classic halo effect. Works on drywall, wood, brick, or concrete.
            </p>
            <p className="mb-4">
              <strong className="text-white/80">Flush mount</strong> mounts the sign flat against the wall with no gap. The light projects forward through the acrylic face rather than behind it. This gives a different look &mdash; more even, less dramatic. Good for interior accent walls where you want soft ambient light.
            </p>
            <p>
              <strong className="text-white/80">Raceway mount</strong> attaches all letters to a single aluminum bar (raceway) that mounts to the wall. This simplifies installation on brick or stone exteriors where drilling individual holes for each letter isn&apos;t practical. The raceway can be powder-coated to match your wall color.
            </p>
          </section>

          {/* Examples */}
          <section>
            <h2 className="mb-6 text-xl font-semibold text-white">Examples</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <div key={ex.src} className="overflow-hidden border border-white/[0.06]">
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={ex.src}
                      alt={ex.label}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  </div>
                  <p className="px-4 py-3 text-xs text-white/30">{ex.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Materials and durability</h2>
            <p className="mb-4">
              Our signs are built with commercial-grade components rated for years of continuous use. The LED modules are Epistar SMD 2835 strips running at 60 LEDs per meter, powered by a 12V UL-listed driver. Rated life is 50,000+ hours &mdash; that&apos;s over 11 years of 12-hour daily operation.
            </p>
            <p>
              The face is 3mm cast acrylic (clear or frosted), mounted on a brushed aluminum backplate. Both materials resist humidity, temperature swings, and UV exposure. For indoor use, which covers most med spas, the signs will look identical years after installation.
            </p>
          </section>

          {/* CTA */}
          <section className="border-t border-white/5 pt-12">
            <h2 className="mb-4 text-xl font-semibold text-white">See your logo as a backlit sign</h2>
            <p className="mb-6">
              Send us your logo and we&apos;ll create a free mockup showing exactly what your sign would look like. No deposit, no commitment. Most mockups are ready within 24 hours.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-amber-500 px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400"
            >
              Get a free mockup
              <ArrowRight size={16} weight="bold" />
            </Link>
          </section>
        </div>
      </article>
    </div>
  )
}
