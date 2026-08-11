import { Suspense } from "react"
import { FolderOpen, ChevronRight, BookOpen } from "lucide-react"

import { Link } from "@/i18n/routing"
import { getCategories } from "@/server/queries/post"
import { safeDbQuery } from "@/lib/safe-db"
import { getTranslations } from "next-intl/server"

export const revalidate = 3600

export default function CategoriesPage() {
  return (
    <Suspense fallback={null}>
      <CategoriesPageContent />
    </Suspense>
  )
}

async function CategoriesPageContent() {
  const categories = await safeDbQuery(getCategories, [])
  const totalPosts = categories.reduce((sum, cat) => sum + (cat._count?.posts || 0), 0)
  const t = await getTranslations("Categories")

  return (
    <>
      <div className="card-base px-8 py-6 mb-4">
        <div className="text-2xl font-bold text-(--primary) mb-2">{t("title")}</div>
        <p className="text-30 text-sm">
          {t("allCategories")} · {totalPosts} {t("postsCount")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {categories.map((category, index) => (
          <Link
            key={category.id}
            href={`/blog?category=${category.slug}`}
            className="card-base p-6 flex items-center gap-4 group onload-animation"
            style={{ animationDelay: `calc(var(--content-delay) + ${index * 50}ms)` }}
          >
            <div className="shrink-0 w-14 h-14 rounded-full bg-(--primary)/10 group-hover:bg-(--primary)/20 flex items-center justify-center transition-colors">
              <FolderOpen className="text-3xl text-(--primary) size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                className="text-lg font-bold text-90 truncate group-hover:text-(--primary) transition-colors"
                title={category.name}
              >
                {category.name}
              </h2>
              <p className="text-sm text-30 mt-1 group-hover:text-(--primary)/60 transition-colors">
                {category._count?.posts || 0} {t("postsCount")}
              </p>
            </div>
            <div className="shrink-0">
              <ChevronRight className="text-2xl text-30 group-hover:text-(--primary) transition-colors size-6" />
            </div>
          </Link>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="card-base px-8 py-12 text-center">
          <BookOpen className="text-5xl text-30 mx-auto mb-4 size-12" />
          <p className="text-30">{t("noData")}</p>
        </div>
      )}
    </>
  )
}
