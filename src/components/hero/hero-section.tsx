"use client";

import { BookOpen, Shuffle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { TypewriterText } from "@/components/ui/typewriter-text";
import { BackgroundPlayer } from "@/components/hero/background-player";

interface HeroSectionProps {
  backgroundImage?: string;
  backgroundVideo?: string | string[];
  title?: string;
  subtitleTexts?: string[];
}

function HeroSection({
  backgroundImage = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80",
  backgroundVideo,
  title = "Lovely Slider!",
  subtitleTexts,
}: HeroSectionProps) {
  const t = useTranslations("Hero");

  const videoUrls = backgroundVideo
    ? Array.isArray(backgroundVideo)
      ? backgroundVideo
      : [backgroundVideo]
    : [];

  const finalSubtitleTexts = subtitleTexts ?? (t.raw("subtitles") as string[] | undefined) ?? [];

  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative h-screen min-h-[600px] w-full">
        <div
          id="banner-images-container"
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
        >
          {backgroundImage && (
            <div
              className="onload-animation absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
          )}
        </div>

        {videoUrls.length > 0 && <BackgroundPlayer playerUrl={videoUrls} playerMode="order" />}

        <div
          id="banner-dim-container"
          className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/50 transition-opacity duration-500 ease-in-out dark:from-black/30 dark:via-black/20 dark:to-black/60"
        />

        <div className="to-frost-500/15 dark:to-frost-500/10 absolute inset-0 bg-gradient-to-br from-pink-500/15 via-transparent dark:from-pink-500/10 dark:via-transparent" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,127,172,0.2),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,127,172,0.12),transparent_60%)]" />

        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-6 text-center">
          <h1 className="onload-animation text-5xl font-bold text-white drop-shadow-lg md:text-7xl lg:text-8xl">
            <span
              className="px-4 break-words"
              style={{ textShadow: "0 2px 16px rgba(0, 0, 0, 0.6)" }}
            >
              {title}
            </span>
          </h1>
          <div
            className="onload-animation mt-6 text-xl text-white/90 drop-shadow md:text-2xl"
            style={{ animationDelay: "150ms" }}
          >
            <TypewriterText
              texts={finalSubtitleTexts}
              typingSpeed={100}
              deletingSpeed={50}
              pauseTime={2500}
              className="text-white/90 dark:text-white/80"
            />
          </div>
          <div
            className="onload-animation mt-10 flex flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: "300ms" }}
          >
            <Link
              href="/blog"
              className="to-frost-400 hover:to-frost-500 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-400 px-8 py-4 text-base font-medium text-white shadow-lg shadow-pink-500/30 backdrop-blur-sm transition-all hover:scale-[1.02] hover:from-pink-500 hover:shadow-pink-500/40 active:scale-[0.98]"
            >
              <BookOpen className="size-5" />
              {t("browsePosts")}
            </Link>
            <Link
              href="/moments"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-8 py-4 text-base font-medium text-white shadow-lg backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-white/30 active:scale-[0.98] dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/20"
            >
              <Shuffle className="size-5" />
              {t("exploreMore")}
            </Link>
          </div>
        </div>

        <div
          className="waves absolute -bottom-px left-0 w-full"
          style={{ transform: "translateZ(0)" }}
        >
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
              <use
                xlinkHref="#gentle-wave"
                x="48"
                y="0"
                className="fill-white opacity-25 dark:fill-gray-950"
              />
              <use
                xlinkHref="#gentle-wave"
                x="48"
                y="3"
                className="fill-white opacity-50 dark:fill-gray-950"
              />
              <use
                xlinkHref="#gentle-wave"
                x="48"
                y="5"
                className="fill-white opacity-65 dark:fill-gray-950"
              />
              <use
                xlinkHref="#gentle-wave"
                x="48"
                y="7"
                className="fill-white opacity-75 dark:fill-gray-950"
              />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}

export { HeroSection };
export default HeroSection;
