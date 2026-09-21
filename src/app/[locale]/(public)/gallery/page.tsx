import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ImageIcon } from "lucide-react";

import { siteConfig } from "@/config/slider-config";
import { getGalleryAlbums } from "@/server/queries/site";
import { GalleryFilter } from "@/components/pages/gallery/gallery-filter";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photo albums",
};

export const revalidate = 300;

export default function GalleryPage() {
  // notFound() 必须在 <Suspense> 之外：否则状态码已锁定为 200（见 streaming.md）。
  if (!siteConfig.pages.gallery) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <GalleryPageContent />
    </Suspense>
  );
}

async function GalleryPageContent() {
  const t = await getTranslations("Gallery");
  const albums = await getGalleryAlbums();

  return (
    <div className="relative flex min-h-32 w-full overflow-hidden rounded-(--radius-large)">
      <div className="card-base relative z-10 w-full px-6 py-6 md:px-9 md:py-6">
        <div className="mb-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--primary) text-white dark:text-black/70">
              <ImageIcon className="size-6 text-[1.5rem]" />
            </div>
            <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {t("title")}
            </div>
          </div>
          {t("description") && (
            <p className="mb-4 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
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
  );
}
