"use client"

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react"
import Image from "next/image"
import { X, ArrowUpRightFromSquare } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { WidgetLayout } from "./widget-layout"
import type { WidgetComponentConfig } from "@/types/sidebarConfig"

interface AdvertisementWidgetProps {
  widgetConfig?: WidgetComponentConfig
  className?: string
  style?: React.CSSProperties
}

function useLocalStorageNumber(key: string) {
  return useSyncExternalStore(
    () => () => {},
    () => Number.parseInt(localStorage.getItem(key) || "0", 10),
    () => 0,
  )
}

function AdvertisementWidget({
  widgetConfig,
  className,
  style,
}: AdvertisementWidgetProps) {
  const t = useTranslations("Widgets")
  const showTitle = widgetConfig?.showTitle !== false
  const adConfig = widgetConfig?.specificConfig?.ad

  const widgetId = useId()
  const storageKey = adConfig ? `ad-display-${widgetId}` : ""
  const displayCount = useLocalStorageNumber(storageKey)

  const [closed, setClosed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const paddingStyle: React.CSSProperties = useMemo(() => {
    if (!adConfig?.padding) return { padding: "1rem" }
    const { all, top, right, bottom, left } = adConfig.padding
    if (all !== undefined) {
      return { padding: all === "0" ? "0" : all }
    }
    return {
      paddingTop: top,
      paddingRight: right,
      paddingBottom: bottom,
      paddingLeft: left,
    }
  }, [adConfig?.padding])

  useEffect(() => {
    if (!storageKey) return
    const count = adConfig?.displayCount ?? -1
    if (count > 0) {
      const currentCount = Number.parseInt(localStorage.getItem(storageKey) || "0", 10)
      if (currentCount < count) {
        localStorage.setItem(storageKey, (currentCount + 1).toString())
      }
    }
  }, [storageKey, adConfig?.displayCount])

  if (!adConfig) return null

  const count = adConfig.displayCount ?? -1
  const displayCountReached = count > 0 ? displayCount >= count : false

  const isExpired = adConfig.expireDate
    ? new Date() > new Date(adConfig.expireDate)
    : false
  if (isExpired || closed || displayCountReached) return null

  const useContentPadding = !adConfig.padding

  const imageSrc = adConfig.image?.src.startsWith("/")
    ? adConfig.image.src
    : adConfig.image?.src

  function handleClose() {
    if (!adConfig?.closable) return
    setIsClosing(true)
    window.setTimeout(() => {
      setClosed(true)
    }, 300)
  }

  return (
    <WidgetLayout
      name={adConfig.title || t("advertisement")}
      showTitle={showTitle}
      id={widgetId}
      contentPadding={useContentPadding}
      className={cn(
        "advertisement-widget group relative transition-all duration-300 ease-out",
        isClosing && "translate-x-full opacity-0",
        className,
      )}
      style={style}
    >
      {adConfig.closable && (
        <button
          type="button"
          className="close-ad-btn absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 opacity-0 transition-all duration-200 hover:bg-neutral-300 hover:text-neutral-700 group-hover:opacity-100 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600 dark:hover:text-neutral-200"
          title={t("close")}
          aria-label={t("close")}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleClose()
          }}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}

      <div style={paddingStyle}>
        {adConfig.image && imageSrc && (
          <div className={cn({ "mb-3": adConfig.content || adConfig.link })}>
            {adConfig.image.link ? (
              <a
                href={adConfig.image.link}
                target={adConfig.image.external ? "_blank" : "_self"}
                rel={adConfig.image.external ? "noopener noreferrer" : undefined}
                className="block overflow-hidden rounded-lg"
              >
                <Image
                  src={imageSrc}
                  alt={adConfig.image.alt || t("advertisement")}
                  width={400}
                  height={200}
                  className="h-auto w-full"
                  unoptimized
                  loading="lazy"
                />
              </a>
            ) : (
              <Image
                src={imageSrc}
                alt={adConfig.image.alt || t("advertisement")}
                width={400}
                height={200}
                className="h-auto w-full rounded-lg"
                unoptimized
                loading="lazy"
              />
            )}
          </div>
        )}

        {adConfig.content && (
          <p className="mb-3 text-center text-sm leading-relaxed text-neutral-600 transition dark:text-neutral-300">
            {adConfig.content}
          </p>
        )}

        {adConfig.link && (
          <div className="text-center">
            <a
              href={adConfig.link.url}
              target={adConfig.link.external ? "_blank" : "_self"}
              rel={adConfig.link.external ? "noopener noreferrer" : undefined}
              className="btn-regular inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-105"
            >
              <span>{adConfig.link.text}</span>
              {adConfig.link.external && (
                <ArrowUpRightFromSquare className="size-3.5" aria-hidden="true" />
              )}
            </a>
          </div>
        )}
      </div>
    </WidgetLayout>
  )
}

export { AdvertisementWidget, type AdvertisementWidgetProps }
export default AdvertisementWidget
