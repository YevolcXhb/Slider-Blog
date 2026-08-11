import { Home, Compass } from "lucide-react"

import { cn } from "@/lib/utils"

export default function NotFound() {
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
            Page not found
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            The page you are looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back on track.
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
            "bg-(--primary) text-white dark:text-black/70",
            "hover:bg-(--primary)/90 active:scale-95 transition-all",
          )}
        >
          <Home className="size-4" />
          Back to home
        </a>
      </div>
    </div>
  )
}
