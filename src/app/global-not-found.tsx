import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Home, Compass } from "lucide-react";

// global-not-found.tsx bypasses the entire app render tree, so nothing that
// [locale]/layout.tsx provides is available here: no NextIntlClientProvider,
// no SessionProvider, and — importantly — no global stylesheet. Everything the
// page needs must be imported by this file itself.
import "./globals.css";

import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";

/**
 * The global 404 for URLs that match NO route at all.
 *
 * Next.js returns this file directly at the routing level (enabled by
 * `experimental.globalNotFound` in next.config.ts). It replaces the root
 * layout for the `/_not-found` route, which is exactly why it must return a
 * complete HTML document — see the official convention: "not-found.js" renders
 * inside a layout and must NOT emit <html>/<body>, whereas "global-not-found.js"
 * must.
 *
 * Because no provider is mounted above this component, message lookup is done
 * by static import rather than via useTranslations/getTranslations. The
 * `NotFound` namespace is shared with src/app/[locale]/not-found.tsx, so both
 * 404 surfaces stay in sync through messages/{zh,en}.json.
 */

const messagesByLocale = { en, zh } as const;

type SupportedLocale = keyof typeof messagesByLocale;

function isSupportedLocale(
  value: string | undefined | null,
): value is SupportedLocale {
  return value === "en" || value === "zh";
}

/**
 * Mirror next-intl's middleware negotiation, which is not running on this
 * code path:
 *
 *   1. the NEXT_LOCALE cookie (next-intl's default `localeCookie.name`; see
 *      src/i18n/routing.ts, which does not override it)
 *   2. the Accept-Language request header (ordered by q, q=0 dropped)
 *   3. `routing.defaultLocale`
 */
async function resolveLocale(): Promise<SupportedLocale> {
  try {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get("NEXT_LOCALE")?.value;
    if (isSupportedLocale(fromCookie)) return fromCookie;
  } catch {
    // cookies() throws outside a request scope; fall through to the
    // header / default-locale fallbacks below.
  }

  try {
    const acceptLanguage = (await headers()).get("accept-language");
    if (acceptLanguage) {
      const ranked = acceptLanguage
        .split(",")
        .map((part) => {
          const [tag, ...params] = part.trim().split(";");
          const qParam = params.find((p) => p.trim().startsWith("q="));
          const q = qParam ? Number.parseFloat(qParam.split("=")[1]) : 1;
          return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
        })
        .filter((entry) => entry.q > 0)
        .sort((a, b) => b.q - a.q);

      for (const { tag } of ranked) {
        const base = tag.split("-")[0];
        if (isSupportedLocale(base)) return base;
      }
    }
  } catch {
    // Same story as cookies(): be defensive so an unmatched URL can never
    // escalate into a 500.
  }

  return routing.defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const t = messagesByLocale[locale].NotFound;

  return {
    title: `404 - ${t.title}`,
    description: t.description,
    // Next.js already injects <meta name="robots" content="noindex"> for 404
    // responses; this keeps the intent explicit at the document level too.
    robots: { index: false, follow: false },
  };
}

export default async function GlobalNotFound() {
  const locale = await resolveLocale();
  const t = messagesByLocale[locale].NotFound;

  return (
    <html lang={locale} className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">
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
                {t.title}
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t.description}
              </p>
            </div>

            {/*
              Plain anchor, not next-intl's Link: this boundary renders outside
              the [locale] segment, so no NextIntlClientProvider / useLocale()
              context exists here. The middleware redirects "/" to a
              locale-prefixed path.
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
              {t.backHome}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
