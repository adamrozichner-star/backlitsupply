import type { Metadata } from 'next'
import LeadForm from '@/components/LeadForm'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get a free mockup of your custom backlit sign or ask us anything. We respond within hours, not days.',
  openGraph: { images: ['/mockups/brickell-yoga-miami.webp'] },
}

export default function ContactPage() {
  return (
    <div>
      {/* Hero */}
      <section className="px-5 pb-16 pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">Contact</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Let&apos;s light up your brand.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/40">
            Send us your logo for a free mockup, or message us with any question. We respond within hours, not days.
          </p>
        </div>
      </section>

      {/* Two-column: form + info */}
      <section className="mx-auto max-w-4xl px-5 pb-20">
        <div className="grid gap-12 md:grid-cols-2">
          {/* Lead form */}
          <div>
            <h2 className="mb-6 text-lg font-semibold text-white">Send us your logo</h2>
            <LeadForm />
          </div>

          {/* Contact info */}
          <div className="space-y-8">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/30">Email</p>
              <a href="mailto:hello@gotbacklit.com" className="text-sm text-white transition-colors hover:text-amber-500">
                hello@gotbacklit.com
              </a>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/30">WhatsApp</p>
              <a href="https://wa.me/15122701730" className="text-sm text-white transition-colors hover:text-amber-500">
                Message us on WhatsApp
              </a>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/30">Response time</p>
              <p className="text-sm text-white/60">We respond within hours, not days.</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/30">Location</p>
              <p className="text-sm text-white/60">Based in the US. Ships worldwide.</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/30">Etsy</p>
              <a
                href="https://www.etsy.com/shop/KnitAndThreads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/60 transition-colors hover:text-amber-500"
              >
                View our Etsy store &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
