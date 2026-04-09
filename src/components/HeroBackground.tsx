// Swappable hero background — replace with <video> when asset is ready

import Image from 'next/image'

export default function HeroBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Background image */}
      <Image
        src="/work/sign-06.webp"
        alt=""
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />

      {/* Dark overlay — keeps headline readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(10,10,10,0.88)] via-[rgba(10,10,10,0.7)] to-[rgba(10,10,10,0.85)]" />

      {/* Warm amber glow vignette */}
      <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.06] blur-[100px]" />
    </div>
  )
}
