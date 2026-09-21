import { Home, Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-center py-24 px-4">
      <div className="card-base flex flex-col items-center gap-6 py-16 px-8 text-center rounded-(--radius-large) w-full">
        <div className="flex size-20 items-center justify-center rounded-full bg-(--primary)/10 text-(--primary)">
          <Compass className="size-10" />
        </div>

        <div className="space-y-3">
          <h1 className="text-7xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 md:text-8xl">
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
            "hover:bg-(--primary)/90 active:scale-95 transition-all",
          )}
        >
          <Home className="size-4" />
          {t("backHome")}
        </a>
      </div>
    </div>
  );
}
