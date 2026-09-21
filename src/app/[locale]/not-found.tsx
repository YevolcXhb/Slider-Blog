import { Home, Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-center px-4 py-24">
      <div className="card-base flex w-full flex-col items-center gap-6 rounded-(--radius-large) px-8 py-16 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-(--primary)/10 text-(--primary)">
          <Compass className="size-10" />
        </div>

        <div className="space-y-3">
          <h1 className="text-7xl font-bold tracking-tight text-neutral-900 md:text-8xl dark:text-neutral-100">
            404
          </h1>
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
            {t("title")}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {t("description")}
          </p>
        </div>

        {/*
          Plain anchor (not next-intl Link) — this not-found boundary can
          render without NextIntlClientProvider when [locale]/layout.tsx
          itself throws notFound() for an unsupported locale. The middleware
          will redirect "/" to the default locale.
        */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional, see comment above */}
        <a
          href="/"
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium",
            "bg-(--primary) text-white dark:text-black/70", // 白字压在 --primary 饱和色块上，浅色/深色都必须保留
            "transition-all hover:bg-(--primary)/90 active:scale-95",
          )}
        >
          <Home className="size-4" />
          {t("backHome")}
        </a>
      </div>
    </div>
  );
}
