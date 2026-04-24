import type { Metadata } from 'next'
import Link from 'next/link'
import { WORK_GALLERY } from '@/lib/gallery'
import MockupCard from '@/components/MockupCard'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

export const metadata: Metadata = {
  title: 'Our Work',
  description: 'Browse our portfolio of custom backlit LED signs. Premium signage for hospitality, retail, wellness, restaurants, hotels, and more.',
  openGraph: { images: ['/mockups/brickell-yoga-miami.webp'] },
}

export default function WorkPage() {
  return (
    <div>
      {/* Hero */}
      <section className="px-5 pb-16 pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">Our work</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Signs we&apos;ve built.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/40">
            Premium backlit signage for businesses across hospitality, retail, wellness, and more. Every sign is custom-built to spec.
          </p>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORK_GALLERY.map((item) => (
            <MockupCard
              key={item.src}
              src={item.src}
              alt={item.alt}
              category={item.category}
            />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 bg-[#0d0d0d] py-20">
        <div className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Ready to see yours?
          </h2>
          <Link
            href="/#lead-form"
            className="mt-8 inline-flex items-center gap-2 bg-amber-500 px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400"
          >
            Get a free mockup of your logo
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </section>
    </div>
  )
}
