"use client"

import { BookOpen, Shuffle } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"

import { TypewriterText } from "@/components/ui/typewriter-text"
import { BackgroundPlayer } from "@/components/hero/background-player"

interface HeroSectionProps {
  backgroundImage?: string
  backgroundVideo?: string | string[]
  title?: string
  subtitleTexts?: string[]
}

function HeroSection({
  backgroundImage = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80",
  backgroundVideo,
  title = "Lovely Slider!",
  subtitleTexts,
}: HeroSectionProps) {
  const t = useTranslations("Hero")

  const videoUrls = backgroundVideo
    ? Array.isArray(backgroundVideo)
      ? backgroundVideo
      : [backgroundVideo]
    : []

  const finalSubtitleTexts =
    subtitleTexts ?? (t.raw("subtitles") as string[] | undefined) ?? []

  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative h-screen w-full min-h-[600px]">
        <div
          id="banner-images-container"
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
        >
          {backgroundImage && (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat onload-animation"
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
          )}
        </div>

        {videoUrls.length > 0 && (
          <BackgroundPlayer playerUrl={videoUrls} playerMode="order" />
        )}

        <div
          id="banner-dim-container"
          className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/50 dark:from-black/30 dark:via-black/20 dark:to-black/60 transition-opacity duration-500 ease-in-out"
        />

        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/15 via-transparent to-frost-500/15 dark:from-pink-500/10 dark:via-transparent dark:to-frost-500/10" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,127,172,0.2),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,127,172,0.12),transparent_60%)]" />

        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-6 text-center">
          <h1 className="text-5xl font-bold text-white drop-shadow-lg md:text-7xl lg:text-8xl onload-animation">
            <span
              className="break-words px-4"
              style={{ textShadow: "0 2px 16px rgba(0, 0, 0, 0.6)" }}
            >
              {title}
            </span>
          </h1>
          <div className="mt-6 text-xl text-white/90 drop-shadow md:text-2xl onload-animation" style={{ animationDelay: "150ms" }}>
            <TypewriterText
              texts={finalSubtitleTexts}
              typingSpeed={100}
              deletingSpeed={50}
              pauseTime={2500}
              className="text-white/90 dark:text-white/80"
            />
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 onload-animation" style={{ animationDelay: "300ms" }}>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-400 to-frost-400 px-8 py-4 text-base font-medium text-white shadow-lg shadow-pink-500/30 backdrop-blur-sm transition-all hover:from-pink-500 hover:to-frost-500 hover:shadow-pink-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <BookOpen className="size-5" />
              {t("browsePosts")}
            </Link>
            <Link
              href="/moments"
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-8 py-4 text-base font-medium text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/30 hover:scale-[1.02] active:scale-[0.98] dark:bg-white/10 dark:hover:bg-white/20 border border-white/30 dark:border-white/20"
            >
              <Shuffle className="size-5" />
              {t("exploreMore")}
            </Link>
          </div>
        </div>

        <div className="waves absolute -bottom-px left-0 w-full" style={{ transform: "translateZ(0)" }}>
          <svg
            className="waves"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            viewBox="0 24 150 28"
            preserveAspectRatio="none"
            shapeRendering="geometricPrecision"
          >
            <defs>
              <path
                id="gentle-wave"
                d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v48h-352z"
              />
            </defs>
            <g className="parallax">
              <use xlinkHref="#gentle-wave" x="48" y="0" className="opacity-25 fill-white dark:fill-gray-950" />
              <use xlinkHref="#gentle-wave" x="48" y="3" className="opacity-50 fill-white dark:fill-gray-950" />
              <use xlinkHref="#gentle-wave" x="48" y="5" className="opacity-65 fill-white dark:fill-gray-950" />
              <use xlinkHref="#gentle-wave" x="48" y="7" className="opacity-75 fill-white dark:fill-gray-950" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  )
}

export { HeroSection }
export default HeroSection
