import { Sidebar } from "./sidebar"
import { getSidebarStats, getMoments, getSiteInfoData } from "@/server/queries/site"
import { safeDbQuery } from "@/lib/safe-db"

async function RightSidebar() {
  const [stats, momentsResult, siteInfo] = await Promise.all([
    safeDbQuery(getSidebarStats, {
      totalPosts: 0,
      totalCategories: 0,
      totalTags: 0,
      totalViews: 0,
      totalComments: 0,
      totalWords: 0,
      runningDays: 1,
      lastPostDate: null,
    }),
    safeDbQuery(() => getMoments(1, 3), { items: [], total: 0 }),
    safeDbQuery(() => getSiteInfoData("Unknown CI"), {
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
    }),
  ])

  return (
    <Sidebar
      side="right"
      data={{
        stats,
        moments: momentsResult.items,
        siteInfo,
      }}
    />
  )
}

export { RightSidebar }
export default RightSidebar
