"use client"

import Image from "next/image"

interface PhotoCardProps {
  src: string
  albumId: string
  alt?: string
}

export function PhotoCard({ src, albumId, alt = "" }: PhotoCardProps) {
  return (
    <div className="gallery-photo-card break-inside-avoid mb-3">
      <div
        data-fancybox={`gallery-${albumId}`}
        data-src={src}
        data-type="image"
        className="block rounded-xl overflow-hidden relative group cursor-pointer"
      >
        <Image
          src={src}
          alt={alt}
          width={400}
          height={600}
          unoptimized
          className="w-full h-auto object-cover transition-all duration-500 ease-out group-hover:scale-105"
        />
      </div>
    </div>
  )
}
