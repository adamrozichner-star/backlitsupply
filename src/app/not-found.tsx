import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <div className="text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-amber-500">404</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/40">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 bg-amber-500 px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-400"
        >
          Back to homepage
          <ArrowRight size={16} weight="bold" />
        </Link>
      </div>
    </div>
  )
}
