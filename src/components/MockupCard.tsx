import Image from 'next/image'

interface MockupCardProps {
  src?: string
  alt?: string
  category: string
}

export default function MockupCard({ src, alt, category }: MockupCardProps) {
  return (
    <div className="group relative aspect-[4/5] w-72 flex-shrink-0 overflow-hidden border border-white/[0.06] bg-[#111] sm:w-auto">
      {src ? (
        <Image
          src={src}
          alt={alt || `${category} backlit sign`}
          fill
          sizes="(max-width: 640px) 288px, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-40 rounded-sm bg-amber-500/[0.06] blur-2xl" />
          </div>
          <p className="relative text-sm text-white/30">Photo coming soon</p>
        </div>
      )}

      {/* Category label */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
        <p className="text-xs font-medium text-amber-500/80">{category}</p>
      </div>
    </div>
  )
}
