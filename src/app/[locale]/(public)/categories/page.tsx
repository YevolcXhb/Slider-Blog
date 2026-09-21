import { Suspense } from "react";
import { FolderOpen, ChevronRight, BookOpen } from "lucide-react";

import { Link } from "@/i18n/routing";
import { getCategories } from "@/server/queries/post";
import { safeDbQuery } from "@/lib/safe-db";
import { getTranslations } from "next-intl/server";

export const revalidate = 3600;

export default function CategoriesPage() {
  return (
    <Suspense fallback={null}>
      <CategoriesPageContent />
    </Suspense>
  );
}

async function CategoriesPageContent() {
  const categories = await safeDbQuery(getCategories, []);
  const totalPosts = categories.reduce((sum, cat) => sum + (cat._count?.posts || 0), 0);
  const t = await getTranslations("Categories");

  return (
    <>
      <div className="card-base mb-4 px-8 py-6">
        <div className="mb-2 text-2xl font-bold text-(--primary)">{t("title")}</div>
        <p className="text-30 text-sm">
          {t("allCategories")} · {totalPosts} {t("postsCount")}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category, index) => (
          <Link
            key={category.id}
            href={`/blog?category=${category.slug}`}
            className="card-base group onload-animation flex items-center gap-4 p-6"
            style={{ animationDelay: `calc(var(--content-delay) + ${index * 50}ms)` }}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-(--primary)/10 transition-colors group-hover:bg-(--primary)/20">
              <FolderOpen className="size-7 text-3xl text-(--primary)" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-90 truncate text-lg font-bold transition-colors group-hover:text-(--primary)"
                title={category.name}
              >
                {category.name}
              </h2>
              <p className="text-30 mt-1 text-sm transition-colors group-hover:text-(--primary)/60">
                {category._count?.posts || 0} {t("postsCount")}
              </p>
            </div>
            <div className="shrink-0">
              <ChevronRight className="text-30 size-6 text-2xl transition-colors group-hover:text-(--primary)" />
            </div>
          </Link>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="card-base px-8 py-12 text-center">
          <BookOpen className="text-30 mx-auto mb-4 size-12 text-5xl" />
          <p className="text-30">{t("noData")}</p>
        </div>
      )}
    </>
  );
}
