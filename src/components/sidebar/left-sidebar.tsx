import { Sidebar } from "./sidebar"
import { profileConfig } from "@/config/profileConfig"
import {
  getSidebarProfile,
  getActiveAnnouncements,
  getSiteInfoData,
} from "@/server/queries/site"
import { getMusicListWithAutoSync } from "@/server/queries/music-sync"
import { getCategories, getTags } from "@/server/queries/post"
import { safeDbQuery } from "@/lib/safe-db"

const siteInfoFallback = {
  blogVersion: "0.1.0",
  nextVersion: "16.2.12",
  nodeVersion: "unknown",
  buildTime: new Date().toISOString(),
  buildPlatform: "Unknown",
  systemInfo: "unknown",
  siteDomain: "unknown",
  licenseName: "None",
  packageManager: "npm",
  labels: {
    siteInfo: "Site Info",
    siteInfoBuildPlatform: "Build Platform",
    siteInfoBlogVersion: "Blog Version",
    siteInfoLicense: "License",
    siteInfoDomain: "Domain",
    siteInfoFrameworkVersion: "Framework",
    siteInfoNodeVersion: "Node",
    siteInfoPackageManager: "Package Manager",
    siteInfoBuildTime: "Build Time",
    siteInfoSystem: "System",
    siteInfoExpand: "Expand",
    siteInfoCollapse: "Collapse",
  },
}

async function LeftSidebar() {
  const [profile, announcements, categories, tags, musicList, siteInfo] =
    await Promise.all([
      safeDbQuery(getSidebarProfile, {
        name: profileConfig.name,
        avatar: profileConfig.avatar ?? "",
        bio: profileConfig.bio ?? "",
        location: "Internet",
        socialLinks: [
          { name: "GitHub", url: "https://github.com/YevolcXhb", icon: "github" },
        ],
      }),
      safeDbQuery(getActiveAnnouncements, []),
      safeDbQuery(getCategories, []),
      safeDbQuery(
        () => getTags(),
        [] as Array<{
          id: number
          name: string
          slug: string
          _count?: { posts: number }
        }>,
      ),
      safeDbQuery(getMusicListWithAutoSync, []),
      safeDbQuery(() => getSiteInfoData("Unknown CI"), siteInfoFallback),
    ])

  return (
    <Sidebar
      side="left"
      data={{
        profile,
        announcements,
        categories,
        tags,
        musicList,
        siteInfo,
      }}
    />
  )
}

export { LeftSidebar }
export default LeftSidebar
