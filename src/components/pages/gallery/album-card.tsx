"use client"

import Image from "next/image"


import { Link } from "@/i18n/routing"
import type { GalleryAlbumItem } from "@/server/queries/site"

interface AlbumCardProps {
  album: GalleryAlbumItem
  photoLabel?: string
}

export function AlbumCard({ album, photoLabel = "张照片" }: AlbumCardProps) {
  return (
    <Link
      href={`/gallery/${album.id}`}
      data-tags={album.description || ""}
      className="album-card group relative block overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
    >
      <div className="aspect-4/3 relative overflow-hidden">
        {album.cover ? (
          <Image
            src={album.cover}
            alt={album.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
            className="w-full h-full object-cover pointer-events-none transition-all duration-500 ease-out group-hover:scale-105"
          />
        ) : album.photos && album.photos.length > 0 ? (
          <Image
            src={album.photos[0].thumbnail || album.photos[0].url}
            alt={album.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
            className="w-full h-full object-cover pointer-events-none transition-all duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <div className="text-gray-400 text-5xl">📷</div>
          </div>
        )}

        <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs text-white font-medium bg-black/50 backdrop-blur-sm">
          {album.photos?.length || 0} {photoLabel}
        </div>

        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-base text-white line-clamp-1 drop-shadow-lg">{album.name}</h3>
          {album.description && (
            <p className="text-xs text-white/75 line-clamp-1 mt-1 leading-relaxed" title={album.description}>
              {album.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
