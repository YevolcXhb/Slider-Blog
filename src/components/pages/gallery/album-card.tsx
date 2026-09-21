"use client";

import Image from "next/image";

import { Link } from "@/i18n/routing";
import type { GalleryAlbumItem } from "@/server/queries/site";

interface AlbumCardProps {
  album: GalleryAlbumItem;
  photoLabel?: string;
}

export function AlbumCard({ album, photoLabel = "张照片" }: AlbumCardProps) {
  return (
    <Link
      href={`/gallery/${album.id}`}
      data-tags={album.description || ""}
      className="album-card group relative block overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
    >
      <div className="relative aspect-4/3 overflow-hidden">
        {album.cover ? (
          <Image
            src={album.cover}
            alt={album.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
            className="pointer-events-none h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-105"
          />
        ) : album.photos && album.photos.length > 0 ? (
          <Image
            src={album.photos[0].thumbnail || album.photos[0].url}
            alt={album.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
            className="pointer-events-none h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 dark:bg-gray-700">
            <div className="text-5xl text-gray-400">📷</div>
          </div>
        )}

        <div className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {album.photos?.length || 0} {photoLabel}
        </div>

        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute right-0 bottom-0 left-0 p-4">
          {/* 保留白字：封面图 + from-black/70 渐变蒙层上，两种主题都必须保持白色 */}
          <h3 className="line-clamp-1 text-base font-bold text-white drop-shadow-lg">
            {album.name}
          </h3>
          {/* 保留白字 75%：同上，图片蒙层 */}
          {album.description && (
            <p
              className="mt-1 line-clamp-1 text-xs leading-relaxed text-white/75"
              title={album.description}
            >
              {album.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
