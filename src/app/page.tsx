import Link from 'next/link'

export default function Home() {
  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-5">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">
        Coming soon
      </p>
      <h1 className="max-w-lg text-center text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
        Custom backlit signs, made for your business.
      </h1>
      <p className="mt-4 max-w-md text-center text-sm leading-relaxed text-white/40">
        Your logo. Lit up. Shipped in 10 days. Starting at $385.
      </p>
      <Link
        href="/contact"
        className="mt-8 bg-amber-500 px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-amber-400"
      >
        Get a free mockup
      </Link>
    </section>
  )
}
