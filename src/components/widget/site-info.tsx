"use client"

import {
  Cloud,
  Clover,
  Copyright,
  Globe,
  Rocket,
  Braces,
  Package,
  Wrench,
  Monitor,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { WidgetLayout } from "./widget-layout"
import { SiteInfoCollapse } from "./site-info-collapse"
import type { SiteInfoData } from "@/types/site-info"
import type { WidgetComponentConfig } from "@/types/sidebarConfig"

interface SiteInfoWidgetProps {
  widgetConfig?: WidgetComponentConfig
  siteInfo?: SiteInfoData
  className?: string
  style?: React.CSSProperties
}

function SiteInfoWidget({ widgetConfig, siteInfo, className, style }: SiteInfoWidgetProps) {
  const showTitle = widgetConfig?.showTitle !== false

  if (!siteInfo) {
    return null
  }

  const labels = siteInfo.labels

  const mainItems = [
    { icon: Cloud, label: labels.siteInfoBuildPlatform, value: siteInfo.buildPlatform },
    { icon: Clover, label: labels.siteInfoBlogVersion, value: `Slider Blog v${siteInfo.blogVersion}`, href: "https://github.com/YevolcXhb" },
    { icon: Copyright, label: labels.siteInfoLicense, value: siteInfo.licenseName },
  ]

  const detailItems = [
    { icon: Globe, label: labels.siteInfoDomain, value: siteInfo.siteDomain, fullWidth: true },
    { icon: Clover, label: "Slider Blog", value: `v${siteInfo.blogVersion}` },
    { icon: Rocket, label: labels.siteInfoFrameworkVersion, value: `Next.js v${siteInfo.nextVersion}` },
    { icon: Braces, label: labels.siteInfoNodeVersion, value: siteInfo.nodeVersion },
    { icon: Package, label: labels.siteInfoPackageManager, value: siteInfo.packageManager },
    { icon: Wrench, label: labels.siteInfoBuildTime, value: siteInfo.buildTime, fullWidth: true },
    { icon: Monitor, label: labels.siteInfoSystem, value: siteInfo.systemInfo, fullWidth: true },
  ]

  return (
    <WidgetLayout
      name={labels.siteInfo}
      showTitle={showTitle}
      id="site-info"
      className={className}
      style={style}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          {mainItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-100/60 dark:bg-neutral-800/50"
            >
              <div className="flex items-center gap-2.5">
                <div className="text-[var(--primary)] text-lg">
                  <item.icon className="size-5" />
                </div>
                <span className="text-neutral-700 dark:text-neutral-300 font-medium text-sm">{item.label}</span>
              </div>
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-neutral-900 dark:text-neutral-100 text-right max-w-[55%] truncate hover:text-[var(--primary)] transition-colors"
                  title={item.value}
                >
                  {item.value}
                </a>
              ) : (
                <span
                  className="text-xs font-bold text-neutral-900 dark:text-neutral-100 text-right max-w-[55%] truncate"
                  title={item.value}
                >
                  {item.value}
                </span>
              )}
            </div>
          ))}
        </div>

        <SiteInfoCollapse expandText={labels.siteInfoExpand} collapseText={labels.siteInfoCollapse}>
          <div className="grid grid-cols-2 gap-2">
            {detailItems.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-1 rounded-lg bg-neutral-100/60 dark:bg-neutral-800/50",
                  item.fullWidth && "col-span-2",
                )}
              >
                <div className="text-[var(--primary)] text-lg">
                  <item.icon className="size-5" />
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{item.label}</span>
                <span
                  className={cn(
                    "text-sm font-bold text-neutral-900 dark:text-neutral-100 text-center truncate w-full",
                    item.fullWidth && "text-xs",
                  )}
                  title={item.value}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </SiteInfoCollapse>
      </div>
    </WidgetLayout>
  )
}

export { SiteInfoWidget, type SiteInfoWidgetProps }
export default SiteInfoWidget
