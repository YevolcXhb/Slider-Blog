import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { estimateWords } from "@/lib/post";
import { siteConfig } from "@/config/siteConfig";
import { licenseConfig } from "@/config/slider-config";
import { getTranslations } from "next-intl/server";
import type { SiteInfoData } from "@/types/site-info";
import {
  DEFAULT_THEME_SETTINGS,
  THEME_SETTINGS_KEY,
  type PostLayout,
  type ThemeSettings,
} from "@/lib/theme-css";

export interface SidebarProfile {
  name: string;
  avatar: string;
  bio: string;
  location: string;
  socialLinks: { name: string; url: string; icon: string; showName?: boolean }[];
}

/**
 * 获取站点启动日期。
 * 优先级：SiteSetting.site_launch_date > 最早文章 created_at > null
 * 返回 null 表示站点尚未启动（显示 0 天）。
 */
export async function getSiteLaunchDate(): Promise<Date | null> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: "site_launch_date" },
    select: { value: true },
  });
  if (setting?.value) {
    const date = new Date(setting.value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const earliestPost = await prisma.post.findFirst({
    orderBy: { created_at: "asc" },
    select: { created_at: true },
  });

  return earliestPost?.created_at ?? null;
}

/**
 * 计算从站点启动日期到当前的天数。
 * 无启动日期时返回 0。
 */
export function calcRunningDays(launchDate: Date | null): number {
  if (!launchDate) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

export interface MusicItem {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  cover: string | null;
  url: string;
  lrc: string | null;
}

export interface AnnouncementItem {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
}

export interface MomentItem {
  id: string;
  content: string;
  images: string[] | null;
  location: string | null;
  likes: number;
  isPinned: boolean;
  createdAt: Date;
}

export interface GalleryPhotoItem {
  id: string;
  url: string;
  thumbnail: string | null;
  title: string | null;
  description: string | null;
  takenAt: Date | null;
}

export interface GalleryAlbumItem {
  id: string;
  name: string;
  description: string | null;
  cover: string | null;
  photos: GalleryPhotoItem[];
}

export interface SidebarStats {
  totalPosts: number;
  totalCategories: number;
  totalTags: number;
  totalViews: number;
  totalComments: number;
  totalWords: number;
  runningDays: number;
}

function serializeBigInt<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ) as T;
}

type SerializedMusic = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  cover: string | null;
  url: string;
  lrc: string | null;
};

type SerializedAnnouncement = {
  id: string;
  content: string;
  is_pinned: number;
  created_at: Date;
};

type SerializedDynamic = {
  id: string;
  content: string;
  images: string[] | null;
  location: string | null;
  likes: number;
  is_pinned: number;
  created_at: Date;
};

type SerializedGalleryPhoto = {
  id: string;
  url: string;
  thumbnail: string | null;
  title: string | null;
  description: string | null;
  taken_at: Date | null;
};

type SerializedGalleryAlbum = {
  id: string;
  name: string;
  description: string | null;
  cover: string | null;
  photos: SerializedGalleryPhoto[];
};

export const getMusicList = unstable_cache(
  async (): Promise<MusicItem[]> => {
    const musics = await prisma.music.findMany({
      where: { is_published: 1 },
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
    });
    return serializeBigInt(musics).map((m) => {
      const serialized = m as unknown as SerializedMusic;
      return {
        id: serialized.id,
        title: serialized.title,
        artist: serialized.artist,
        album: serialized.album,
        cover: serialized.cover,
        url: serialized.url,
        lrc: serialized.lrc,
      };
    });
  },
  ["music-list"],
  { revalidate: 3600, tags: ["music"] },
);

export const getActiveAnnouncements = unstable_cache(
  async (): Promise<AnnouncementItem[]> => {
    const announcements = await prisma.announcement.findMany({
      where: { is_active: 1 },
      orderBy: [{ is_pinned: "desc" }, { created_at: "desc" }],
      take: 5,
    });
    return serializeBigInt(announcements).map((a) => {
      const serialized = a as unknown as SerializedAnnouncement;
      return {
        id: serialized.id,
        content: serialized.content,
        isPinned: serialized.is_pinned === 1,
        createdAt: serialized.created_at,
      };
    });
  },
  ["announcements"],
  { revalidate: 300, tags: ["announcements"] },
);

function isPostLayout(value: unknown): value is PostLayout {
  return value === "list" || value === "grid";
}

/**
 * 读取主题外观配置（管理面板统一控制）。
 * 数据库为空时返回默认值（与客户端 DEFAULT_THEME_SETTINGS 一致）。
 */
export const getThemeSettings = unstable_cache(
  async (): Promise<ThemeSettings> => {
    try {
      const setting = await prisma.siteSetting.findUnique({
        where: { key: THEME_SETTINGS_KEY },
        select: { value: true },
      });
      if (!setting?.value) return DEFAULT_THEME_SETTINGS;
      const parsed = JSON.parse(setting.value) as Partial<ThemeSettings>;
      return {
        hue:
          typeof parsed.hue === "number" &&
          Number.isFinite(parsed.hue) &&
          parsed.hue >= 0 &&
          parsed.hue <= 360
            ? parsed.hue
            : DEFAULT_THEME_SETTINGS.hue,
        postLayout: isPostLayout(parsed.postLayout)
          ? parsed.postLayout
          : DEFAULT_THEME_SETTINGS.postLayout,
        cardBorderShadow:
          typeof parsed.cardBorderShadow === "boolean"
            ? parsed.cardBorderShadow
            : DEFAULT_THEME_SETTINGS.cardBorderShadow,
        cardThemeColored:
          typeof parsed.cardThemeColored === "boolean"
            ? parsed.cardThemeColored
            : DEFAULT_THEME_SETTINGS.cardThemeColored,
      };
    } catch {
      return DEFAULT_THEME_SETTINGS;
    }
  },
  ["theme-settings"],
  { revalidate: 3600, tags: ["theme-settings"] },
);

export async function getMoments(
  page: number = 1,
  limit: number = 10,
): Promise<{ items: MomentItem[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.dynamic.findMany({
      where: { status: 1 },
      orderBy: [{ is_pinned: "desc" }, { created_at: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dynamic.count({ where: { status: 1 } }),
  ]);
  return {
    items: serializeBigInt(items).map((m) => {
      const serialized = m as unknown as SerializedDynamic;
      return {
        id: serialized.id,
        content: serialized.content,
        images: serialized.images,
        location: serialized.location,
        likes: serialized.likes,
        isPinned: serialized.is_pinned === 1,
        createdAt: serialized.created_at,
      };
    }),
    total,
  };
}

export async function getGalleryAlbums(): Promise<GalleryAlbumItem[]> {
  const albums = await prisma.galleryAlbum.findMany({
    orderBy: { sort_order: "asc" },
    include: {
      photos: {
        orderBy: [{ sort_order: "asc" }, { taken_at: "desc" }],
      },
    },
  });
  return serializeBigInt(albums).map((a) => {
    const serialized = a as unknown as SerializedGalleryAlbum;
    return {
      id: serialized.id,
      name: serialized.name,
      description: serialized.description,
      cover: serialized.cover,
      photos: serialized.photos.map((p) => ({
        id: p.id,
        url: p.url,
        thumbnail: p.thumbnail,
        title: p.title,
        description: p.description,
        takenAt: p.taken_at,
      })),
    };
  });
}

export async function getGalleryAlbumById(
  id: string,
): Promise<GalleryAlbumItem | null> {
  const album = await prisma.galleryAlbum.findUnique({
    where: { id: BigInt(id) },
    include: {
      photos: {
        orderBy: [{ sort_order: "asc" }, { taken_at: "desc" }],
      },
    },
  });
  if (!album) return null;
  const serialized = serializeBigInt(album) as unknown as SerializedGalleryAlbum;
  return {
    id: serialized.id,
    name: serialized.name,
    description: serialized.description,
    cover: serialized.cover,
    photos: serialized.photos.map((p) => ({
      id: p.id,
      url: p.url,
      thumbnail: p.thumbnail,
      title: p.title,
      description: p.description,
      takenAt: p.taken_at,
    })),
  };
}

export interface SidebarStatsWithDate extends SidebarStats {
  lastPostDate: Date | null;
}

function detectBuildPlatform(unknownBuildPlatform = "Unknown CI"): string {
  if (process.env.VERCEL) return "Vercel";
  if (process.env.NETLIFY) return "Netlify";
  if (process.env.GITHUB_ACTIONS) return "GitHub Actions";
  if (process.env.GITLAB_CI) return "GitLab CI";
  if (process.env.CI) return process.env.CI_NAME || unknownBuildPlatform;
  return "Local";
}

function detectPackageManager(): string {
  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.includes("pnpm")) return "pnpm";
  if (userAgent.includes("yarn")) return "Yarn";
  if (userAgent.includes("bun")) return "Bun";
  return "npm";
}

function formatBuildTime(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
}

// package.json 只需读一次，缓存到模块级变量
let _cachedPkg: { version: string; nextVersion: string } | null = null;
function readPackageInfo(): { version: string; nextVersion: string } {
  if (_cachedPkg) return _cachedPkg;
  let blogVersion = "0.1.0";
  let nextVersion = "16.2.12";
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf-8"),
    );
    blogVersion = pkg.version || blogVersion;
    const nextDep = pkg.dependencies?.next;
    if (nextDep) nextVersion = nextDep.replace(/^[^\d]*/, "");
  } catch {
    // ignore read errors
  }
  _cachedPkg = { version: blogVersion, nextVersion };
  return _cachedPkg;
}

export const getSiteInfoData = unstable_cache(
  async (unknownBuildPlatform?: string): Promise<SiteInfoData> => {
    const locale = siteConfig.lang?.startsWith("zh") ? "zh-CN" : "en-US";
    const t = await getTranslations("Widgets");

    const { version: blogVersion, nextVersion } = readPackageInfo();

    const nodeVersion = process.version;
    const buildTime = formatBuildTime(new Date(), locale);
    const buildPlatform = detectBuildPlatform(unknownBuildPlatform);
    const osName = process.platform;
    const archName = process.arch;
    const systemInfo = `${osName} / ${archName}`;
    const siteDomain = siteConfig.site_url
      ? siteConfig.site_url.replace(/^https?:\/\//, "").replace(/\/$/, "")
      : "unknown";

    return {
      blogVersion,
      nextVersion,
      nodeVersion,
      buildTime,
      buildPlatform,
      systemInfo,
      siteDomain,
      licenseName: licenseConfig?.enable ? licenseConfig.name : "None",
      packageManager: detectPackageManager(),
      labels: {
        siteInfo: t("siteInfo"),
        siteInfoBuildPlatform: t("siteInfoBuildPlatform"),
        siteInfoBlogVersion: t("siteInfoBlogVersion"),
        siteInfoLicense: t("siteInfoLicense"),
        siteInfoDomain: t("siteInfoDomain"),
        siteInfoFrameworkVersion: t("siteInfoFrameworkVersion"),
        siteInfoNodeVersion: t("siteInfoNodeVersion"),
        siteInfoPackageManager: t("siteInfoPackageManager"),
        siteInfoBuildTime: t("siteInfoBuildTime"),
        siteInfoSystem: t("siteInfoSystem"),
        siteInfoExpand: t("siteInfoExpand"),
        siteInfoCollapse: t("siteInfoCollapse"),
      },
    };
  },
  ["site-info"],
  { revalidate: 3600, tags: ["site-info"] },
);

export const getSidebarStats = unstable_cache(
  async (): Promise<SidebarStatsWithDate> => {
    const [
      totalPosts,
      totalCategories,
      totalTags,
      viewAgg,
      totalComments,
      latestPost,
      launchDate,
    ] = await Promise.all([
      prisma.post.count({ where: { status: 1 } }),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.post.aggregate({
        _sum: { view_count: true },
        where: { status: 1 },
      }),
      prisma.comment.count({ where: { status: 1 } }),
      prisma.post.findFirst({
        where: { status: 1 },
        orderBy: [{ updated_at: "desc" }, { published_at: "desc" }, { created_at: "desc" }],
        select: { updated_at: true, published_at: true, created_at: true },
      }),
      getSiteLaunchDate(),
    ]);

    const postsForWordCount = await prisma.post.findMany({
      where: { status: 1 },
      select: { content_mdx: true },
    });
    const totalWords = postsForWordCount.reduce(
      (total, post) => total + estimateWords(post.content_mdx),
      0,
    );

    const runningDays = calcRunningDays(launchDate);

    const lastPostDate = latestPost
      ? latestPost.updated_at ?? latestPost.published_at ?? latestPost.created_at
      : null;

    return {
      totalPosts,
      totalCategories,
      totalTags,
      totalViews: viewAgg._sum.view_count ?? 0,
      totalComments,
      totalWords,
      runningDays,
      lastPostDate,
    };
  },
  ["sidebar-stats"],
  { revalidate: 600, tags: ["posts", "stats"] },
);

export interface SocialLinkItem {
  name: string;
  url: string;
  icon: string;
  showName?: boolean;
}

export interface NavExternalLinkItem {
  i18nKey: string;
  name: string;
  url: string;
  icon: string;
  external: boolean;
}

export interface SiteInfoSettings {
  site_title: string;
  site_subtitle: string;
  site_description: string;
}

/**
 * 读取侧边栏社交链接。
 * 数据库为空时回退到默认 GitHub 链接。
 */
export async function getSocialLinks(): Promise<SocialLinkItem[]> {
  const defaultLinks: SocialLinkItem[] = [
    { name: "GitHub", url: "https://github.com/YevolcXhb", icon: "github", showName: false },
  ];
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "social_links" },
      select: { value: true },
    });
    if (!setting?.value) return defaultLinks;
    const parsed = JSON.parse(setting.value);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultLinks;
    return parsed as SocialLinkItem[];
  } catch {
    return defaultLinks;
  }
}

/**
 * 读取导航栏外链（GitHub、Slider云盘等）。
 * 数据库为空时返回 null，调用方应回退到 slider-config.ts 的 navBarConfig。
 */
export async function getNavExternalLinks(): Promise<NavExternalLinkItem[] | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "nav_external_links" },
      select: { value: true },
    });
    if (!setting?.value) return null;
    const parsed = JSON.parse(setting.value);
    if (!Array.isArray(parsed)) return null;
    return parsed as NavExternalLinkItem[];
  } catch {
    return null;
  }
}

/**
 * 读取关于我页面 MDX 内容。
 * 数据库为空时返回 null，调用方应回退到 src/content/spec/about.md。
 */
export async function getAboutContent(): Promise<string | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "about_content" },
      select: { value: true },
    });
    return setting?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * 读取站点信息（标题、副标题、描述）。
 * 数据库为空时返回空字符串，调用方应回退到 siteConfig。
 * 使用 unstable_cache 配合 tags，以便管理面板保存后通过 revalidateTag 刷新。
 */
export const getSiteInfoSettings = unstable_cache(
  async (): Promise<SiteInfoSettings> => {
    try {
      const settings = await prisma.siteSetting.findMany({
        where: {
          key: { in: ["site_title", "site_subtitle", "site_description"] },
        },
      });
      const map = new Map(settings.map((s) => [s.key, s.value ?? ""]));
      return {
        site_title: map.get("site_title") ?? "",
        site_subtitle: map.get("site_subtitle") ?? "",
        site_description: map.get("site_description") ?? "",
      };
    } catch {
      return { site_title: "", site_subtitle: "", site_description: "" };
    }
  },
  ["site-info-settings"],
  { revalidate: 3600, tags: ["site-settings"] },
);

/**
 * 获取首页背景视频直链（管理端可配置；空字符串表示不播放视频）。
 */
export const getHomepageVideoUrl = unstable_cache(
  async (): Promise<string> => {
    try {
      const setting = await prisma.siteSetting.findUnique({
        where: { key: "homepage_video_url" },
        select: { value: true },
      });
      return setting?.value?.trim() ?? "";
    } catch {
      return "";
    }
  },
  ["homepage-video-url"],
  { revalidate: 3600, tags: ["site-settings"] },
);

export const getSidebarProfile = unstable_cache(
  async (): Promise<SidebarProfile> => {
    const defaultProfile: SidebarProfile = {
      name: "Slider小汉堡",
      avatar: "/slider/favicon/head.png",
      bio: "Hello，I'm Slider.",
      location: "Internet",
      socialLinks: [
        { name: "GitHub", url: "https://github.com/YevolcXhb", icon: "github" },
      ],
    };

    try {
      const settings = await prisma.siteSetting.findMany({
        where: {
          key: {
            in: [
              "profile_name",
              "profile_avatar",
              "profile_bio",
              "profile_location",
              "social_links",
            ],
          },
        },
      });

      const settingMap = new Map(settings.map((s) => [s.key, s.value]));

      // 解析社交链接：优先使用数据库配置，回退到默认
      let socialLinks = defaultProfile.socialLinks;
      const socialLinksStr = settingMap.get("social_links");
      if (socialLinksStr) {
        try {
          const parsed = JSON.parse(socialLinksStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            socialLinks = parsed as SidebarProfile["socialLinks"];
          }
        } catch {
          // JSON 解析失败，使用默认值
        }
      }

      return {
        name: settingMap.get("profile_name") || defaultProfile.name,
        avatar: settingMap.get("profile_avatar") || defaultProfile.avatar,
        bio: settingMap.get("profile_bio") || defaultProfile.bio,
        location: settingMap.get("profile_location") || defaultProfile.location,
        socialLinks,
      };
    } catch {
      return defaultProfile;
    }
  },
  ["sidebar-profile"],
  { revalidate: 3600, tags: ["profile"] },
);
