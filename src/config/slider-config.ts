/**
 * Slider 统一配置文件
 * 从 Slider 源码的 src/config/*.ts 中提取默认值，并迁移静态资源路径到 /slider/*
 * 注意：本文件不包含任何敏感信息（如统计 ID、评论系统密钥等）
 */

// =============================================================================
// 类型定义
// =============================================================================

export type LIGHT_DARK_MODE = "light" | "dark" | "system"
export type WALLPAPER_MODE = "banner" | "fullscreen" | "overlay" | "none"

export type FaviconConfig = {
  src: string
  theme?: "light" | "dark"
  sizes?: string
}

export type SiteConfig = {
  title: string
  subtitle: string
  site_url: string
  description?: string
  keywords?: string[]
  lang: "en" | "zh_CN" | "zh_TW" | "ja" | "ru" | "ko"
  themeColor: {
    hue: number
    defaultMode?: LIGHT_DARK_MODE
  }
  pageWidth?: number
  card: {
    border: boolean
    followTheme?: boolean
  }
  siteStartDate?: string
  timezone?: string
  favicon: FaviconConfig[]
  navbar: {
    logo?: {
      type: "icon" | "image" | "url"
      value: string
      alt?: string
    }
    title?: string
    widthFull?: boolean
    menuAlign?: "left" | "center"
    followTheme?: boolean
    stickyNavbar?: boolean
  }
  pages: {
    guestbook: boolean
    gallery: boolean
    dynamic: boolean
  }
  categoryBar?: boolean
  foldArticle?: boolean
  postListLayout: {
    defaultMode: "list" | "grid"
    mobileDefaultMode?: "list" | "grid"
    descriptionLines?: number
    showStatsIcons?: boolean
    tagsPosition?: "meta" | "bottom"
    meta?: {
      showPublished?: boolean
      showCategory?: boolean
      showTags?: boolean
      tagCount?: number
      showWords?: boolean
      showReadingTime?: boolean
    }
    stats?: {
      showPublished?: boolean
      showWords?: boolean
      showReadingTime?: boolean
    }
    grid: {
      masonry: boolean
      columnWidth?: number
    }
  }
  post: {
    rehypeCallouts: {
      theme: "github" | "obsidian" | "vitepress" | "docusaurus"
      enablePythonMarkdownAdmonitions?: boolean
    }
    showLastModified: boolean
    outdatedThreshold?: number
    sharePoster?: boolean
    generateOgImages: boolean
  }
  pagination: {
    postsPerPage: number
  }
  imageOptimization?: {
    formats?: "avif" | "webp" | "both"
    quality?: number
    noReferrerDomains?: string[]
  }
}

export type NavBarLink = {
  /**
   * i18n key（指向 messages/*.json 中的 Nav 命名空间），用于运行时翻译。
   * 组件渲染时会通过 useTranslations("Nav") 获取真实文案。
   */
  i18nKey: string
  url: string
  external?: boolean
  icon?: string
  children?: NavBarLink[]
  pageKey?: string
}

export enum NavBarSearchMethod {
  PageFind = 0,
}

export type NavBarSearchConfig = {
  method: NavBarSearchMethod
}

export type NavBarConfig = {
  links: NavBarLink[]
}

export type WidgetComponentType =
  | "profile"
  | "announcement"
  | "categories"
  | "tags"
  | "sidebarToc"
  | "advertisement"
  | "stats"
  | "calendar"
  | "music"
  | "siteInfo"
  | "dynamic"

export type WidgetSpecificConfig = {
  hidden?: ("mobile" | "tablet" | "desktop")[]
  collapseThreshold?: number
  calendar?: {
    showHeatmap: boolean
  }
  ad?: {
    title?: string
    content?: string
    image?: {
      src: string
      alt?: string
      link?: string
      external?: boolean
    }
    link?: {
      text: string
      url: string
      external?: boolean
    }
    padding?: {
      top?: string
      right?: string
      bottom?: string
      left?: string
      all?: string
    }
    closable?: boolean
    displayCount?: number
    expireDate?: string
  }
  siteInfo?: {
    unknownBuildPlatform?: string
  }
  dynamic?: {
    limit?: number
  }
}

export type WidgetComponentConfig = {
  type: WidgetComponentType
  enable: boolean
  showTitle?: boolean
  position: "top" | "sticky"
  showOnPostPage?: boolean
  hideOnNonPostPage?: boolean
  specificConfig?: WidgetSpecificConfig
  customProps?: Record<string, unknown>
}

export type MobileBottomComponentConfig = Omit<WidgetComponentConfig, "position">

export type SidebarLayoutConfig = {
  enable: boolean
  position: "left" | "right" | "both"
  tabletSidebar?: "left" | "right"
  hideSidebarOnPostPage?: boolean
  showBothSidebarsOnPostPage?: boolean
  leftComponents: WidgetComponentConfig[]
  rightComponents: WidgetComponentConfig[]
  mobileBottomComponents: MobileBottomComponentConfig[]
}

export type BackgroundWallpaperConfig = {
  mode: WALLPAPER_MODE
  playerEnable?: boolean
  src:
    | string
    | string[]
    | {
        desktop?: string | string[]
        mobile?: string | string[]
        playerUrl?: string | string[]
      }
  common?: {
    dimOpacity?: number
    playerMode?: "order" | "random"
    homeText?: {
      enable: boolean
      title?: string
      subtitle?: string | string[]
      titleSize?: string
      subtitleSize?: string
      typewriter?: {
        enable: boolean
        speed: number
        deleteSpeed: number
        pauseTime: number
      }
    }
    postInfo?: {
      mode: "description" | "meta"
    }
    navbar?: {
      transparentMode?: "semi" | "full" | "semifull"
      enableBlur?: boolean
      blur?: number
    }
    waves?: {
      enable:
        | boolean
        | {
            desktop: boolean
            mobile: boolean
          }
    }
    gradient?: {
      enable:
        | boolean
        | {
            desktop: boolean
            mobile: boolean
          }
      height?: string
    }
    carousel?: {
      enable: boolean
      interval?: number
      transitionEffect?: "fade" | "zoom" | "slide" | "kenburns"
    }
  }
  banner?: {
    position?: string
  }
  overlay?: {
    zIndex?: number
    opacity?: number
    blur?: number
    cardOpacity?: number
  }
  fullscreen?: {
    position?: string
  }
}

export type DisplaySettingsConfig = {
  themeColorSwitchable: boolean
  layoutSwitchable: boolean
  cardBorderSwitchable: boolean
  cardFollowThemeSwitchable: boolean
  wallpaperModeSwitchable: boolean
  wavesSwitchable: boolean
  gradientSwitchable: boolean
  bannerTitleSwitchable: boolean
  bannerCarouselSwitchable: boolean
  overlaySwitchable:
    | boolean
    | {
        opacity?: boolean
        blur?: boolean
        cardOpacity?: boolean
      }
  sakuraSwitchable: boolean
}

export type MusicPlayerConfig = {
  mode?: "meting" | "local"
  volume?: number
  playMode?: "list" | "one" | "random"
  showLyrics?: boolean
  showInNavbar?: boolean
  showInSidebar?: boolean
  meting?: {
    api?: string
    server?: "netease" | "tencent" | "kugou" | "xiami" | "baidu"
    type?: "song" | "playlist" | "album" | "search" | "artist"
    id?: string
    auth?: string
    fallbackApis?: string[]
  }
  local?: {
    playlist?: Array<{
      name: string
      artist: string
      url: string
      cover?: string
      lrc?: string
    }>
  }
}

export type ProfileConfig = {
  avatar?: string
  name: string
  bio?: string
  links: {
    name: string
    url: string
    icon: string
    showName?: boolean
  }[]
}



export type AnnouncementConfig = {
  title?: string
  content: string
  icon?: string
  type?: "info" | "warning" | "success" | "error"
  closable?: boolean
  link?: {
    enable: boolean
    text: string
    url: string
    external?: boolean
  }
}

export type SakuraConfig = {
  enable: boolean
  sakuraNum: number
  limitTimes: number
  size: {
    min: number
    max: number
  }
  opacity: {
    min: number
    max: number
  }
  speed: {
    horizontal: {
      min: number
      max: number
    }
    vertical: {
      min: number
      max: number
    }
    rotation: number
    fadeSpeed: number
  }
  zIndex: number
}

export type FooterConfig = {
  enable: boolean
  customHtml?: string
}

export type CoverImageConfig = {
  enableInPost: boolean
  enableInPostOverlay: boolean
  showLoading: boolean
  randomCoverImage: {
    enable: boolean
    apis: string[]
  }
}

export type DynamicConfig = {
  title?: string
  description?: string
  profileUrl: string
  showComment: boolean
  itemsPerPage: number
  apiUrl: string
  memos?: {
    enable: boolean
    apiUrl: string
    parent: string
  }
}

export type FontDefinition = {
  name: string
  cssVariable: string
  provider: "fontsource" | "local" | "google" | "bunny" | "fontshare" | "npm"
  weights?: string[]
  styles?: string[]
  subsets?: string[]
  fallbacks?: string[]
  options?: {
    variants?: Array<{
      src: string[]
    }>
  }
}

export type FontSelectionConfig = {
  enable: boolean
  selected: string[]
  bannerTitleFont?: string
  bannerSubtitleFont?: string
  navbarTitleFont?: string
  codeFont?: string
  subsetFonts?: Record<
    string,
    {
      extraChars?: string
    }
  >
}

export type LicenseConfig = {
  enable: boolean
  name: string
  url: string
  icon?: string
}

export type SliderConfig = {
  siteConfig: SiteConfig
  navBarConfig: NavBarConfig
  navBarSearchConfig: NavBarSearchConfig
  sidebarConfig: SidebarLayoutConfig
  backgroundWallpaper: BackgroundWallpaperConfig
  displaySettingsConfig: DisplaySettingsConfig
  musicPlayerConfig: MusicPlayerConfig
  profileConfig: ProfileConfig
  announcementConfig: AnnouncementConfig
  effectsConfig: SakuraConfig
  footerConfig: FooterConfig
  coverImageConfig: CoverImageConfig
  dynamicConfig: DynamicConfig
  fontConfig: FontSelectionConfig
  fontsList: FontDefinition[]
  licenseConfig: LicenseConfig
}

// =============================================================================
// 路径常量：所有静态资源统一收敛到 /slider/*
// =============================================================================

const SLIDER_BASE = "/slider"
const SLIDER_IMAGES = `${SLIDER_BASE}/images`
const SLIDER_FONTS = `${SLIDER_BASE}/fonts`
const SLIDER_FAVICON = `${SLIDER_BASE}/favicon`

// =============================================================================
// 核心配置
// =============================================================================

const SITE_LANG: SiteConfig["lang"] = "zh_CN"

export const siteConfig: SiteConfig = {
  title: "Slider",
  subtitle: "Demo site",
  site_url: "https://slider.cuteleaf.cn",
  description:
    "Slider 是一款基于 Astro 框架和 Fuwari 模板开发的清新美观且现代化个人博客主题模板，专为技术爱好者和内容创作者设计。该主题融合了现代 Web 技术栈，提供了丰富的功能模块和高度可定制的界面，让您能够轻松打造出专业且美观的个人博客网站。",
  keywords: [
    "Slider",
    "Fuwari",
    "Astro",
    "ACGN",
    "博客",
    "技术博客",
    "静态博客",
  ],
  themeColor: {
    hue: 165,
    defaultMode: "system",
  },
  pageWidth: 100,
  card: {
    border: false,
    followTheme: false,
  },
  favicon: [
    {
      src: `${SLIDER_FAVICON}/favicon.ico`,
    },
  ],
  navbar: {
    logo: {
      type: "image",
      value: `${SLIDER_IMAGES}/slider.png`,
      alt: "🍀",
    },
    title: "Slider",
    widthFull: false,
    menuAlign: "center",
    followTheme: false,
    stickyNavbar: true,
  },
  siteStartDate: "2025-01-01",
  timezone: "Asia/Shanghai",
  pages: {
    guestbook: false,
    gallery: true,
    dynamic: true,
  },
  categoryBar: true,
  foldArticle: true,
  postListLayout: {
    defaultMode: "list",
    mobileDefaultMode: "grid",
    descriptionLines: 2,
    showStatsIcons: true,
    tagsPosition: "bottom",
    meta: {
      showPublished: true,
      showCategory: true,
      showTags: true,
      tagCount: 5,
      showWords: false,
      showReadingTime: false,
    },
    stats: {
      showPublished: true,
      showWords: true,
      showReadingTime: true,
    },
    grid: {
      masonry: false,
      columnWidth: 320,
    },
  },
  post: {
    rehypeCallouts: {
      theme: "github",
      enablePythonMarkdownAdmonitions: false,
    },
    showLastModified: true,
    outdatedThreshold: 30,
    sharePoster: true,
    generateOgImages: false,
  },
  pagination: {
    postsPerPage: 10,
  },
  imageOptimization: {
    formats: "webp",
    quality: 85,
    noReferrerDomains: [],
  },
  lang: SITE_LANG,
}

// ============================================================================
// 导航栏配置
// ============================================================================

export const LinkPresets: Record<string, NavBarLink> = {
  Home: {
    i18nKey: "home",
    url: "/",
    icon: "material-symbols:home",
  },
  Dynamic: {
    i18nKey: "moments",
    url: "/moments/",
    icon: "material-symbols:forum-rounded",
    pageKey: "dynamic",
  },
  Archive: {
    i18nKey: "archive",
    url: "/archive/",
    icon: "material-symbols:archive",
  },
  Categories: {
    i18nKey: "categories",
    url: "/categories/",
    icon: "material-symbols:folder-open-rounded",
  },
  Tags: {
    i18nKey: "tags",
    url: "/tags/",
    icon: "material-symbols:tag-rounded",
  },
  About: {
    i18nKey: "about",
    url: "/about/",
    icon: "material-symbols:person",
  },
  Gallery: {
    i18nKey: "gallery",
    url: "/gallery/",
    icon: "material-symbols:photo-library",
    pageKey: "gallery",
  },
}

const getDynamicNavBarConfig = (): NavBarConfig => {
  const links: NavBarLink[] = []

  links.push(LinkPresets.Home)

  links.push({
    i18nKey: "blog",
    url: "#",
    icon: "material-symbols:article",
    children: [LinkPresets.Archive, LinkPresets.Categories, LinkPresets.Tags],
  })

  links.push({
    i18nKey: "me",
    url: "#",
    icon: "material-symbols:person",
    children: [LinkPresets.Dynamic, LinkPresets.Gallery],
  })

  links.push({
    i18nKey: "info",
    url: "#",
    icon: "material-symbols:info",
    children: [LinkPresets.About],
  })

  links.push({
    i18nKey: "links",
    url: "#",
    icon: "material-symbols:link",
    children: [
      {
        i18nKey: "github",
        url: "https://github.com/YevolcXhb",
        external: true,
        icon: "fa7-brands:github",
      },
      {
        i18nKey: "cloudDrive",
        url: "https://alist.slidercore.com/s/vAtJ/Slider",
        external: true,
        icon: "material-symbols:cloud",
      },
    ],
  })

  return { links }
}

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig()

export const navBarSearchConfig: NavBarSearchConfig = {
  method: NavBarSearchMethod.PageFind,
}

// ============================================================================
// 侧边栏布局配置
// ============================================================================

export const sidebarConfig: SidebarLayoutConfig = {
  enable: true,
  position: "both",
  tabletSidebar: "left",
  hideSidebarOnPostPage: false,
  showBothSidebarsOnPostPage: true,
  leftComponents: [
    {
      type: "profile",
      enable: true,
      position: "top",
      showOnPostPage: true,
    },
    {
      type: "announcement",
      enable: true,
      position: "top",
      showOnPostPage: true,
    },
    {
      type: "music",
      enable: true,
      position: "sticky",
      showOnPostPage: true,
    },
    {
      type: "categories",
      enable: true,
      position: "sticky",
      showOnPostPage: true,
      specificConfig: {
        collapseThreshold: 5,
      },
    },
    {
      type: "tags",
      enable: true,
      position: "sticky",
      showOnPostPage: true,
      specificConfig: {
        collapseThreshold: 10,
      },
    },
  ],
  rightComponents: [
    {
      type: "dynamic",
      enable: true,
      position: "top",
      showOnPostPage: true,
      specificConfig: {
        dynamic: {
          limit: 2,
        },
      },
    },
    {
      type: "stats",
      enable: true,
      position: "top",
      showOnPostPage: false,
    },
    {
      type: "siteInfo",
      enable: true,
      position: "top",
      showOnPostPage: true,
      specificConfig: {
        siteInfo: {
          unknownBuildPlatform: "Unknown CI",
        },
      },
    },
    {
      type: "calendar",
      enable: true,
      showTitle: false,
      position: "sticky",
      showOnPostPage: false,
      specificConfig: {
        calendar: {
          showHeatmap: true,
        },
      },
    },
    {
      type: "sidebarToc",
      enable: true,
      position: "sticky",
      showOnPostPage: true,
      hideOnNonPostPage: true,
    },
    {
      type: "advertisement",
      enable: false,
      showTitle: false,
      position: "sticky",
      showOnPostPage: true,
      specificConfig: {
        ad: {
          image: {
            src: `${SLIDER_IMAGES}/ad/ad1.webp`,
            alt: "广告横幅",
            link: "https://haoka.lot-ml.com/plugreg.html?agentid=1423316",
            external: true,
          },
          closable: false,
          displayCount: -1,
          padding: {
            all: "1rem",
          },
        },
      },
    },
    {
      type: "advertisement",
      enable: false,
      position: "sticky",
      showOnPostPage: true,
      specificConfig: {
        ad: {
          title: "支持博主",
          content:
            "如果您觉得本站内容对您有帮助，欢迎支持我们的创作！您的支持是我们持续更新的动力。",
          link: {
            text: "支持一下",
            url: "about/",
            external: false,
          },
          closable: false,
          displayCount: -1,
        },
      },
    },
  ],
  mobileBottomComponents: [
    {
      type: "profile",
      enable: true,
      showOnPostPage: true,
    },
    {
      type: "announcement",
      enable: true,
      showOnPostPage: true,
    },
    {
      type: "categories",
      enable: true,
      showOnPostPage: true,
      specificConfig: {
        collapseThreshold: 5,
      },
    },
    {
      type: "tags",
      enable: true,
      showOnPostPage: true,
      specificConfig: {
        collapseThreshold: 10,
      },
    },
    {
      type: "dynamic",
      enable: true,
      showOnPostPage: true,
      specificConfig: {
        dynamic: {
          limit: 2,
        },
      },
    },
    {
      type: "stats",
      enable: true,
      showOnPostPage: true,
    },
    {
      type: "siteInfo",
      enable: true,
      showOnPostPage: true,
      specificConfig: {
        siteInfo: {
          unknownBuildPlatform: "Unknown CI",
        },
      },
    },
  ],
}

// ============================================================================
// 背景壁纸配置
// ============================================================================

export const backgroundWallpaper: BackgroundWallpaperConfig = {
  mode: "banner",
  playerEnable: true,
  src: {
    desktop: [
      `${SLIDER_IMAGES}/DesktopWallpaper/d1.avif`,
      `${SLIDER_IMAGES}/DesktopWallpaper/d2.avif`,
      `${SLIDER_IMAGES}/DesktopWallpaper/d3.avif`,
      `${SLIDER_IMAGES}/DesktopWallpaper/d4.avif`,
      `${SLIDER_IMAGES}/DesktopWallpaper/d5.avif`,
      `${SLIDER_IMAGES}/DesktopWallpaper/d6.avif`,
    ],
    mobile: [
      `${SLIDER_IMAGES}/MobileWallpaper/m1.avif`,
      `${SLIDER_IMAGES}/MobileWallpaper/m2.avif`,
      `${SLIDER_IMAGES}/MobileWallpaper/m3.avif`,
      `${SLIDER_IMAGES}/MobileWallpaper/m4.avif`,
      `${SLIDER_IMAGES}/MobileWallpaper/m5.avif`,
      `${SLIDER_IMAGES}/MobileWallpaper/m6.avif`,
    ],
  },
  common: {
    dimOpacity: 0.2,
    playerMode: "random",
    homeText: {
      enable: true,
      title: "Lovely Slider!",
      titleSize: "4.5rem",
      subtitle: [
        "In Reddened Chrysalis, I Once Rest",
        "From Shattered Sky, I Free Fall",
        "Amidst Silenced Stars, I Deep Sleep",
        "Upon Lighted Fyrefly, I Soon Gaze",
        "From Undreamt Night, I Thence Shine",
        "In Finalized Morrow, I Full Bloom",
      ],
      subtitleSize: "1.5rem",
      typewriter: {
        enable: true,
        speed: 100,
        deleteSpeed: 50,
        pauseTime: 2000,
      },
    },
    postInfo: {
      mode: "description",
    },
    navbar: {
      transparentMode: "semi",
      enableBlur: true,
      blur: 5,
    },
    waves: {
      enable: {
        desktop: true,
        mobile: true,
      },
    },
    gradient: {
      enable: {
        desktop: true,
        mobile: true,
      },
      height: "10%",
    },
    carousel: {
      enable: false,
      interval: 5000,
      transitionEffect: "zoom",
    },
  },
  banner: {
    position: "0% 20%",
  },
  overlay: {
    zIndex: -1,
    opacity: 0.8,
    blur: 10,
    cardOpacity: 0.5,
  },
  fullscreen: {
    position: "center",
  },
}

// ============================================================================
// 显示设置面板开关配置
// ============================================================================

export const displaySettingsConfig: DisplaySettingsConfig = {
  themeColorSwitchable: true,
  layoutSwitchable: true,
  cardBorderSwitchable: true,
  cardFollowThemeSwitchable: true,
  wallpaperModeSwitchable: true,
  wavesSwitchable: true,
  gradientSwitchable: true,
  bannerTitleSwitchable: true,
  bannerCarouselSwitchable: true,
  overlaySwitchable: {
    opacity: true,
    blur: true,
    cardOpacity: true,
  },
  sakuraSwitchable: true,
}

// ============================================================================
// 音乐播放器配置
// ============================================================================

export const musicPlayerConfig: MusicPlayerConfig = {
  showInNavbar: true,
  showInSidebar: true,
  mode: "local",
  volume: 0.7,
  playMode: "list",
  showLyrics: true,
  meting: {
    api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
    server: "netease",
    type: "playlist",
    id: "10046455237",
    auth: "",
    fallbackApis: [
      "https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
      "https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
    ],
  },
  local: {
    playlist: [],
  },
}

// ============================================================================
// 用户资料配置
// ============================================================================

export const profileConfig: ProfileConfig = {
  avatar: `${SLIDER_IMAGES}/avatar.avif`,
  name: "Slider",
  bio: "Hello, I'm Slider.",
  links: [
    {
      name: "qq",
      icon: "fa7-brands:qq",
      url: "https://qm.qq.com/q/ZGsFa8qX2G",
      showName: false,
    },
    {
      name: "GitHub",
      icon: "fa7-brands:github",
      url: "https://github.com/YevolcXhb",
      showName: false,
    },
    {
      name: "Email",
      icon: "fa7-solid:envelope",
      url: "mailto:xiaye@msn.com",
      showName: false,
    },
  ],
}

// ============================================================================
// 公告配置
// ============================================================================

export const announcementConfig: AnnouncementConfig = {
  title: "公告",
  content: "欢迎来到我的博客！这是一则示例公告。",
  closable: true,
  link: {
    enable: true,
    text: "了解更多",
    url: "/about/",
    external: false,
  },
}

// ============================================================================
// 特效配置（樱花等）
// ============================================================================

export const effectsConfig: SakuraConfig = {
  enable: false,
  sakuraNum: 21,
  limitTimes: -1,
  size: {
    min: 0.5,
    max: 1.1,
  },
  opacity: {
    min: 0.3,
    max: 0.9,
  },
  speed: {
    horizontal: {
      min: -1.7,
      max: -1.2,
    },
    vertical: {
      min: 1.5,
      max: 2.2,
    },
    rotation: 0.03,
    fadeSpeed: 0.03,
  },
  zIndex: 100,
}

// ============================================================================
// 页脚配置
// ============================================================================

export const footerConfig: FooterConfig = {
  enable: false,
}

// ============================================================================
// 文章封面图配置
// ============================================================================

export const coverImageConfig: CoverImageConfig = {
  enableInPost: true,
  enableInPostOverlay: true,
  showLoading: false,
  randomCoverImage: {
    enable: false,
    apis: [
      "https://t.alcy.cc/pc",
      "https://www.dmoe.cc/random.php",
      "https://uapis.cn/api/v1/random/image?category=acg&type=pc",
    ],
  },
}

// ============================================================================
// 动态页面配置
// ============================================================================

export const dynamicConfig: DynamicConfig = {
  title: "",
  description: "",
  profileUrl: "/about/",
  showComment: true,
  itemsPerPage: 20,
  apiUrl: "/api/dynamic.json",
  memos: {
    enable: false,
    apiUrl: "https://memos.example.com",
    parent: "users/xiaye",
  },
}

// ============================================================================
// 字体配置（已适配 Next.js：本地字体通过 /slider/fonts 提供）
// ============================================================================

export const fontsList: FontDefinition[] = [
  {
    name: "GreatVibes Regular 2",
    cssVariable: "--font-greatvibes",
    provider: "local",
    fallbacks: ["sans-serif"],
    options: {
      variants: [
        {
          src: [`${SLIDER_FONTS}/GreatVibes-Regular-2.otf`],
        },
      ],
    },
  },
]

export const fontConfig: FontSelectionConfig = {
  enable: true,
  selected: ["system"],
  bannerTitleFont: "",
  bannerSubtitleFont: "",
  navbarTitleFont: "",
  codeFont: "",
  subsetFonts: {
    "--font-greatvibes": {
      extraChars: "",
    },
  },
}

// ============================================================================
// 许可证配置
// ============================================================================

export const licenseConfig: LicenseConfig = {
  enable: true,
  name: "CC BY-NC-SA 4.0",
  url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  icon: "",
}

// =============================================================================
// 统一导出：sliderConfig
// =============================================================================

export const sliderConfig: SliderConfig = {
  siteConfig,
  navBarConfig,
  navBarSearchConfig,
  sidebarConfig,
  backgroundWallpaper,
  displaySettingsConfig,
  musicPlayerConfig,
  profileConfig,
  announcementConfig,
  effectsConfig,
  footerConfig,
  coverImageConfig,
  dynamicConfig,
  fontConfig,
  fontsList,
  licenseConfig,
}

export default sliderConfig
