import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowLeft, ImageIcon } from "lucide-react"
import Image from "next/image"

import { Link } from "@/i18n/routing"
import { siteConfig } from "@/config/slider-config"
import { getGalleryAlbumById } from "@/server/queries/site"
import { PhotoCard } from "@/components/pages/gallery/photo-card"

export const metadata: Metadata = {
  title: "Album",
  description: "Photo album",
}

export const revalidate = 300

interface AlbumPageProps {
  params: Promise<{
    album: string
  }>
}

type AlbumDetail = NonNullable<Awaited<ReturnType<typeof getGalleryAlbumById>>>

/**
 * 取相册，并把"这个 id 没有相册"归一化成 null。
 *
 * 解码：与 blog/[slug] 同理 —— Next.js 16 交给页面的动态段**已经是解码态**
 * （route-matcher 里解过一次），这里不能再 decodeURIComponent。albumId 只是
 * 十进制主键，getGalleryAlbumById 内部用 isGalleryAlbumId 做白名单校验，
 * 任何非数字（含带 `%`、`/` 的畸形值）都直接返回 null → 调用方 notFound()。
 * 也就是说这条路径**不可能**抛出 URIError，无需额外 try/catch。
 */
export default async function AlbumPage({ params }: AlbumPageProps) {
  if (!siteConfig.pages.gallery) {
    notFound()
  }

  const { album: albumId } = await params

  // 同 blog/[slug]：notFound() 必须发生在 <Suspense> 之前，否则 200 已经发出，
  // 不存在的相册会被搜索引擎当有效页面收录。
  const album = await getGalleryAlbumById(albumId)
  if (!album) {
    notFound()
  }

  return (
    <Suspense fallback={null}>
      <AlbumPageContent album={album} />
    </Suspense>
  )
}

async function AlbumPageContent({ album }: { album: AlbumDetail }) {
  const t = await getTranslations("Gallery")

  const cover = album.cover || (album.photos.length > 0 ? album.photos[0].url : null)

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full rounded-(--radius-large) overflow-hidden relative">
        {cover ? (
          <div className="relative w-full aspect-[3/1] min-h-[200px] max-h-[360px] overflow-hidden">
            <Image
              src={cover}
              alt={album.name}
              fill
              sizes="100vw"
              unoptimized
              className="w-full h-full object-cover"
              priority
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />

            <Link
              href="/gallery"
              className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              <ArrowLeft className="text-base size-4" />
              {t("galleryBackToAlbums")}
            </Link>

            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-2 drop-shadow-lg">
                {album.name}
              </div>
              {album.description && (
                <p className="text-sm text-white/75 leading-relaxed mb-2 max-w-2xl line-clamp-2">
                  {album.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-white/80 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="text-sm size-4" />
                  {album.photos.length} {t("galleryPhotos")}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card-base px-6 py-4">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-1 text-sm text-(--primary) hover:underline mb-3"
            >
              <ArrowLeft className="text-base size-4" />
              {t("galleryBackToAlbums")}
            </Link>
            <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {album.name}
            </div>
            <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="text-sm size-4" />
                {album.photos.length} {t("galleryPhotos")}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="w-full rounded-(--radius-large) overflow-hidden relative">
        <div className="card-base z-10 px-6 py-6 relative w-full">
          {album.photos.length > 0 ? (
            <div
              className="gallery-masonry"
              style={{
                columnCount: 2,
                columnGap: "0.75rem",
              }}
            >
              {album.photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  src={photo.url}
                  albumId={album.id}
                  alt={photo.title || album.name}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-500">
              <ImageIcon className="text-6xl mb-4 opacity-50 size-16" />
              <p className="text-lg">{t("galleryNoPhotos")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
