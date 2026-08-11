import type { Metadata } from "next";
// 自托管 Quicksand 字体（@fontsource 本地 woff2，构建/开发均不再请求 Google Fonts）
import "@fontsource/quicksand/300.css";
import "@fontsource/quicksand/400.css";
import "@fontsource/quicksand/500.css";
import "@fontsource/quicksand/600.css";
import "@fontsource/quicksand/700.css";
import { SessionProvider } from "next-auth/react";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import { siteConfig } from "@/config/slider-config";

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  icons: siteConfig.favicon.map((f) => ({
    url: f.src,
    rel: f.src.endsWith(".ico") ? "icon" : undefined,
  })),
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`h-full antialiased dark`}
      style={{
        "--font-quicksand": "Quicksand, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        "--font-geist-sans": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        "--font-geist-mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
