import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ImageIcon } from "lucide-react"

import { siteConfig } from "@/config/slider-config"
import { getGalleryAlbums } from "@/server/queries/site"
import { GalleryFilter } from "@/components/pages/gallery/gallery-filter"

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photo albums",
}

export const revalidate = 300

export default function GalleryPage() {
  return (
    <Suspense fallback={null}>
      <GalleryPageContent />
    </Suspense>
  )
}

async function GalleryPageContent() {
  if (!siteConfig.pages.gallery) {
    notFound()
  }

  const t = await getTranslations("Gallery")
  const albums = await getGalleryAlbums()

  return (
    <div className="flex w-full rounded-(--radius-large) overflow-hidden relative min-h-32">
      <div className="card-base z-10 px-6 py-6 md:px-9 md:py-6 relative w-full">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-(--primary) flex items-center justify-center text-white dark:text-black/70">
              <ImageIcon className="text-[1.5rem] size-6" />
            </div>
            <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {t("title")}
            </div>
          </div>
          {t("description") && (
            <p className="text-base text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
              {t("description")}
            </p>
          )}
        </div>

        <GalleryFilter
          albums={albums}
          searchPlaceholder={t("searchAlbums")}
          allLabel={t("all")}
          emptyLabel={t("galleryNoAlbums")}
          noResultsLabel={t("searchNoResults")}
          photoLabel={t("galleryPhotos")}
        />
      </div>
    </div>
  )
}
