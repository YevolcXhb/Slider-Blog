import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { MessageCircle } from "lucide-react"

import { siteConfig, dynamicConfig } from "@/config/slider-config"
import { getMoments } from "@/server/queries/site"
import { DynamicFeed } from "@/components/pages/moments/dynamic-feed"

export const revalidate = 60

export default function MomentsPage() {
  return (
    <Suspense fallback={null}>
      <MomentsPageContent />
    </Suspense>
  )
}

async function MomentsPageContent() {
  if (!siteConfig.pages.dynamic) {
    notFound()
  }

  const t = await getTranslations("Moments")
  const { items: moments, total } = await getMoments(1, dynamicConfig.itemsPerPage)
  const title = dynamicConfig.title || t("title")
  const description = dynamicConfig.description || t("description")

  return (
    <section className="dynamic-page" aria-labelledby="dynamic-page-title">
      <header className="dynamic-page-header card-base p-5 rounded-(--radius-large) mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="dynamic-page-heading flex items-center gap-3">
            <div className="dynamic-page-icon h-10 w-10 rounded-lg bg-(--primary)/10 flex items-center justify-center text-(--primary)" aria-hidden="true">
              <MessageCircle className="size-6" />
            </div>
            <div>
              <h2 id="dynamic-page-title" className="text-2xl font-bold text-90">
                {title}
              </h2>
              {description && <p className="text-sm text-50">{description}</p>}
            </div>
          </div>
          <div className="dynamic-count text-sm text-50 flex items-center gap-2" aria-label={t("dynamic")}>
            <MessageCircle className="size-4" />
            <strong>{total}</strong>
            <span>{t("dynamic")}</span>
          </div>
        </div>
      </header>

      <DynamicFeed
        items={moments}
        total={total}
        locale="zh"
        i18n={{
          search: t("search"),
          allYears: t("allYears"),
          year: t("year"),
          empty: t("empty"),
          noResults: t("noResults"),
          loading: t("loading"),
          dynamic: t("dynamic"),
        }}
      />
    </section>
  )
}
