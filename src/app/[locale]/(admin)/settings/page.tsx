import type { Metadata } from "next";
import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import SettingsManager from "./settings-manager";
import {
  DEFAULT_THEME_SETTINGS,
  type ThemeSettings,
} from "@/lib/theme-css";

export interface ProfileSettings {
  profile_name: string;
  profile_avatar: string;
  profile_bio: string;
  profile_location: string;
  site_launch_date: string;
  site_title: string;
  site_subtitle: string;
  site_description: string;
}

export interface SocialLinkItem {
  name: string;
  url: string;
  icon: string;
  showName: boolean;
}

export interface NavExternalLinkItem {
  i18nKey: string;
  name: string;
  url: string;
  icon: string;
  external: boolean;
}

export interface SettingsPageData {
  profile: ProfileSettings;
  socialLinks: SocialLinkItem[];
  navExternalLinks: NavExternalLinkItem[];
  aboutContent: string;
  themeSettings: ThemeSettings;
  homepageVideoUrl: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminSettings" });
  return { title: t("title") };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale, "/settings");

  // 一次性读取所有设置项
  const rows = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: [
          "profile_name",
          "profile_avatar",
          "profile_bio",
          "profile_location",
          "site_launch_date",
          "site_title",
          "site_subtitle",
          "site_description",
          "social_links",
          "nav_external_links",
          "about_content",
          "theme_settings",
          "homepage_video_url",
        ],
      },
    },
  });

  const map = new Map(rows.map((r) => [r.key, r.value ?? ""]));

  const profile: ProfileSettings = {
    profile_name: map.get("profile_name") ?? "",
    profile_avatar: map.get("profile_avatar") ?? "",
    profile_bio: map.get("profile_bio") ?? "",
    profile_location: map.get("profile_location") ?? "",
    site_launch_date: map.get("site_launch_date") ?? "",
    site_title: map.get("site_title") ?? "",
    site_subtitle: map.get("site_subtitle") ?? "",
    site_description: map.get("site_description") ?? "",
  };

  // 解析社交链接
  let socialLinks: SocialLinkItem[] = [];
  const socialLinksStr = map.get("social_links");
  if (socialLinksStr) {
    try {
      const parsed = JSON.parse(socialLinksStr);
      if (Array.isArray(parsed)) socialLinks = parsed;
    } catch {
      // 解析失败使用空数组（回退到默认由前端处理）
    }
  }

  // 解析导航外链
  let navExternalLinks: NavExternalLinkItem[] = [];
  const navLinksStr = map.get("nav_external_links");
  if (navLinksStr) {
    try {
      const parsed = JSON.parse(navLinksStr);
      if (Array.isArray(parsed)) navExternalLinks = parsed;
    } catch {
      // 解析失败使用空数组
    }
  }

  const aboutContent = map.get("about_content") ?? "";
  const homepageVideoUrl = map.get("homepage_video_url") ?? "";

  // 解析主题外观配置
  let themeSettings: ThemeSettings = DEFAULT_THEME_SETTINGS;
  const themeStr = map.get("theme_settings");
  if (themeStr) {
    try {
      const parsed = JSON.parse(themeStr) as Partial<ThemeSettings>;
      themeSettings = {
        hue:
          typeof parsed.hue === "number" &&
          Number.isFinite(parsed.hue) &&
          parsed.hue >= 0 &&
          parsed.hue <= 360
            ? parsed.hue
            : DEFAULT_THEME_SETTINGS.hue,
        postLayout:
          parsed.postLayout === "list" || parsed.postLayout === "grid"
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
      // 解析失败使用默认值
    }
  }

  const data: SettingsPageData = {
    profile,
    socialLinks,
    navExternalLinks,
    aboutContent,
    themeSettings,
    homepageVideoUrl,
  };

  return <SettingsManager initialData={data} />;
}
