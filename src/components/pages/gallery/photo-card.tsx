"use client";

import Image from "next/image";

interface PhotoCardProps {
  src: string;
  albumId: string;
  alt?: string;
}

export function PhotoCard({ src, albumId, alt = "" }: PhotoCardProps) {
  return (
    <div className="gallery-photo-card mb-3 break-inside-avoid">
      <div
        data-fancybox={`gallery-${albumId}`}
        data-src={src}
        data-type="image"
        className="group relative block cursor-pointer overflow-hidden rounded-xl"
      >
        <Image
          src={src}
          alt={alt}
          width={400}
          height={600}
          unoptimized
          className="h-auto w-full object-cover transition-all duration-500 ease-out group-hover:scale-105"
        />
      </div>
    </div>
  );
}
