export interface SiteInfoData {
  blogVersion: string
  nextVersion: string
  nodeVersion: string
  buildTime: string
  buildPlatform: string
  systemInfo: string
  siteDomain: string
  licenseName: string
  packageManager: string
  labels: {
    siteInfo: string
    siteInfoBuildPlatform: string
    siteInfoBlogVersion: string
    siteInfoLicense: string
    siteInfoDomain: string
    siteInfoFrameworkVersion: string
    siteInfoNodeVersion: string
    siteInfoPackageManager: string
    siteInfoBuildTime: string
    siteInfoSystem: string
    siteInfoExpand: string
    siteInfoCollapse: string
  }
}
