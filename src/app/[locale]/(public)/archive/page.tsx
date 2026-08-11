import { Suspense } from "react"
import { getLocale } from "next-intl/server"
import { getTranslations } from "next-intl/server"

import { getPublishedPostsForArchive } from "@/server/queries/post"
import { ArchivePanel } from "@/components/pages/archive/archive-panel"

export const revalidate = 3600

export default function ArchivePage() {
  return (
    <Suspense fallback={null}>
      <ArchivePageContent />
    </Suspense>
  )
}

async function ArchivePageContent() {
  const locale = await getLocale()
  const t = await getTranslations("Archive")
  const posts = await getPublishedPostsForArchive(locale)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">归档</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-white/50">所有文章按年份整理</p>
      </div>
      <ArchivePanel
        posts={posts}
        locale={locale}
        i18n={{
          categories: t("categories"),
          tags: t("tags"),
          uncategorized: t("uncategorized"),
          postCount: t("postCount"),
          postsCount: t("postsCount"),
        }}
      />
    </div>
  )
}
