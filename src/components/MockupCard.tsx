import Image from 'next/image'

interface MockupCardProps {
  name: string
  imageUrl?: string
}

export default function MockupCard({ name, imageUrl }: MockupCardProps) {
  return (
    <div className="group relative flex h-64 w-72 flex-shrink-0 items-center justify-center overflow-hidden border border-white/[0.06] bg-[#111] transition-all hover:border-amber-500/20 sm:h-72 sm:w-80">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${name} backlit sign`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <>
          {/* Placeholder glow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-40 rounded-sm bg-amber-500/[0.06] blur-2xl" />
          </div>
          <div className="relative text-center">
            <p className="text-lg font-semibold tracking-tight text-white/80">{name}</p>
            <div className="mx-auto mt-2 h-px w-12 bg-amber-500/40" />
          </div>
        </>
      )}

      {/* Bottom label */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
        <p className="text-xs font-medium text-white/60">{name}</p>
      </div>
    </div>
  )
}
