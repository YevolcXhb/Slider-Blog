import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { queryTotalContentChars } from "@/server/queries/stats";
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
 *
 * 【为什么必须缓存】本函数只被 getSidebarStats 与 getSiteStats 两个已缓存的
 * 聚合函数调用，因此它此前是「缓存体内的未缓存查询」：每次聚合缓存未命中，
 * 它都会先打一次 siteSetting、未命中再打一次 post（两条 SQL），却没有任何
 * tag 能让它单独失效 —— saveSiteSettings 只失效 profile/stats/posts/site-settings，
 * 覆盖不到它自身。
 *
 * 缓存 600 秒，与原调用方 getSidebarStats 的 revalidate 一致。该值按定义就是
 * 「站点创建那一刻」的常量（最早文章的 created_at，或管理端配置的启动日期），
 * 实际上不会变化，600 秒的 TTL 已足够宽松。
 *
 * 【不挂 tag 是刻意的】不能挂 site-settings：getSidebarStats 已经带 site-settings，
 * 而 getSiteLaunchDate 在它内部被调用 —— 若本函数也挂 site-settings，保存站点设置
 * 时两者会一起失效、本函数的缓存同样被清空，等于没有缓存。同理不挂 posts：
 * 文章的增删改会频繁失效它，而这个值在一次失效之后几乎总会算出同一个结果。
 * 因此这里只靠 TTL。key 用仓库统一的 kebab-case 数组形式
 * （unstable_cache 的类型是 keyParts: string[]，字符串会被静默忽略）。
 *
 * 注意返回值是 Date：Date 可被 Next 缓存层序列化（JSON 化后反序列化为 Date 对象），
 * 调用方 calcRunningDays 只读取 getTime()，不会就地修改，因此缓存安全。
 * 但它是服务端内部值，不要再直接透传给客户端组件。
 */
export const getSiteLaunchDate = unstable_cache(
  async (): Promise<Date | null> => {
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
  },
  ["site-launch-date"],
  { revalidate: 600 },
);

/**
 * 计算从站点启动日期到当前的天数。
 * 无启动日期时返回 0。
 */
export function calcRunningDays(launchDate: Date | null): number {
  if (!launchDate) return 0;
  return Math.max(0, Math.floor((Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24)));
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
  /**
   * 全站正文字符数（content_mdx 原始字符数，含 Markdown 标记、代码块与草稿）。
   *
   * 与 src/server/queries/stats.ts 的 SiteStats.totalWords 共用同一 SQL 实现
   * （queryTotalContentChars），因此两个页面显示的同名「总字数」数值一致。
   *
   * 注意：它与 estimateWords()（文章卡片/编辑器的单篇「字数」，剔除代码块、
   * 只数 CJK 汉字与英文字母）口径不同，两者本来就不相等，属预期行为；
   * 单篇阅读量级请用 estimateWords()，全站累计请用本字段。
   */
  totalWords: number;
  runningDays: number;
}

function serializeBigInt<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => (typeof value === "bigint" ? value.toString() : value)),
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

/**
 * 侧栏「最新动态」与 /moments 页共用的动态列表查询。
 *
 * 【为什么必须缓存】该查询此前未做任何缓存，是首页每次渲染固定打库的来源之一：
 * 一次 findMany + 一次 count，加上同页面的导航外链查询，构成每请求 3 条 SQL。
 * 动态属低频更新内容，这里用 unstable_cache 缓存 300 秒，并由
 * src/server/actions/dynamic.ts 的全部写操作调用 revalidateTag("moments")
 * 主动失效 —— 管理员发布后前台立即更新，不依赖 TTL 到期。
 *
 * 注意 page/limit 参与缓存键（unstable_cache 默认把实参并入 key），因此
 * 侧栏的 (1, 3) 与动态页的 (1, itemsPerPage) 是两个独立缓存条目。
 */
export const getMoments = unstable_cache(
  async (page: number = 1, limit: number = 10): Promise<{ items: MomentItem[]; total: number }> => {
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
  },
  ["moments"],
  { revalidate: 300, tags: ["moments"] },
);

/**
 * 相册列表（/gallery 页）。
 *
 * 【为什么必须缓存】此前未缓存，每次访问 /gallery 固定打库两条 SQL
 * （gallery_album + 关联的 gallery_photo）。相册属低频更新内容，缓存 300 秒；
 * src/server/actions/gallery.ts 的全部写操作已调用 revalidateTag("gallery")，
 * 管理端增删改后前台立即失效，不依赖 TTL 到期。
 */
export const getGalleryAlbums = unstable_cache(
  async (): Promise<GalleryAlbumItem[]> => {
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
  },
  ["gallery-albums"],
  { revalidate: 300, tags: ["gallery"] },
);

/**
 * 判断路由段 /gallery/[album] 传来的 id 是否可能是相册主键。
 *
 * 只接受纯十进制数字串（允许一个前导 + 号）：不接受空串、空白、负号、小数点、
 * 0x/科学计数法、下划线等 BigInt() 会接受或会抛错的宽松写法。
 * BigInt("") 是 0n、BigInt("0x10") 是 16n、BigInt("abc") 直接抛异常 —— 三种
 * 都不该被当成一次合法的相册查询。
 */
export function isGalleryAlbumId(id: string): boolean {
  return /^\+?[0-9]+$/.test(id);
}

/**
 * 单个相册详情（/gallery/[album] 页）。与 getGalleryAlbums 同属 gallery 标签，
 * 管理端任何相册/照片写操作都会通过 revalidateTag("gallery") 一并失效。
 * id 参与缓存键，因此每个相册是独立条目。
 */
export const getGalleryAlbumById = unstable_cache(
  async (id: string): Promise<GalleryAlbumItem | null> => {
    // id 直接来自路由段（/gallery/[album]），可能是任意字符串。
    // BigInt("abc") 会抛 RangeError/SyntaxError，让整个页面变成 500；
    // 但它语义上显然是「找不到相册」→ 返回 null，由页面调用 notFound() 给出 404。
    // 非法 id 直接当作「相册不存在」返回 null，让页面走 notFound() 给出 404。
    if (!isGalleryAlbumId(id)) return null;

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
  },
  ["gallery-album"],
  { revalidate: 300, tags: ["gallery"] },
);

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
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
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
    const [totalPosts, totalCategories, totalTags, viewAgg, totalComments, latestPost, launchDate] =
      await Promise.all([
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

    // 字数口径与管理后台统一为「全站正文字符数」SQL 聚合（见 stats.ts 的
    // queryTotalContentChars 注释）。这里不再 findMany 把全站 content_mdx 拉回 Node
    // 逐篇 estimateWords()，那是第一轮修掉的性能问题。
    //
    // 已知差异边界：该 SQL 口径包含草稿文章，而侧边栏其它统计（totalPosts）只算
    // status = 1，因此当存在草稿时「总字数」会略大于「文章数量」所对应的正文量。
    // 这是刻意取舍：宁可让字数口径覆盖草稿（数据不丢），也不为对齐而多扫一遍全表。
    const totalWords = await queryTotalContentChars();

    const runningDays = calcRunningDays(launchDate);

    const lastPostDate = latestPost
      ? (latestPost.updated_at ?? latestPost.published_at ?? latestPost.created_at)
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
 * 读取导航栏外链（GitHub、Slider云盘等）。
 * 数据库为空时返回 null，调用方应回退到 slider-config.ts 的 navBarConfig。
 */
/**
 * 【为什么必须缓存】该查询被 (public)/layout.tsx 在每次页面渲染时调用，
 * 此前未缓存，是首页每请求 3 条 SQL 中的一条。导航外链几乎不变，
 * 缓存 3600 秒；管理端 saveNavExternalLinks 已调用
 * revalidateTag("site-settings")，保存后立即失效。
 */
export const getNavExternalLinks = unstable_cache(
  async (): Promise<NavExternalLinkItem[] | null> => {
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
  },
  ["nav-external-links"],
  { revalidate: 3600, tags: ["site-settings"] },
);

/**
 * 读取关于我页面 MDX 内容。数据库为空时返回 null，调用方回退到
 * src/content/spec/about.md。
 *
 * 【为什么必须缓存】此前未缓存，每次访问 /about 都会打库一次。缓存 3600 秒；
 * saveAboutContent 已调用 revalidateTag("site-settings") 与 revalidateTag("about")，
 * 管理端保存后前台立即失效。
 */
export const getAboutContent = unstable_cache(
  async (): Promise<string | null> => {
    try {
      const setting = await prisma.siteSetting.findUnique({
        where: { key: "about_content" },
        select: { value: true },
      });
      return setting?.value ?? null;
    } catch {
      return null;
    }
  },
  ["about-content"],
  { revalidate: 3600, tags: ["site-settings", "about"] },
);

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
      socialLinks: [{ name: "GitHub", url: "https://github.com/YevolcXhb", icon: "github" }],
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
