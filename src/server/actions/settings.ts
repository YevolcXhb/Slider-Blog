"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/user";
import {
  validateContentLength,
  validateDateString,
  validateSafeUrl,
  ValidationError,
} from "@/lib/validation";
import { THEME_SETTINGS_KEY } from "@/lib/theme-css";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    throw new Error("Unauthorized: admin access required");
  }
}

function getStringFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (value === null) return "";
  if (typeof value !== "string") return "";
  return value.trim();
}

// 允许写入的设置键白名单，防止任意键注入
const ALLOWED_KEYS = new Set([
  "profile_name",
  "profile_avatar",
  "profile_bio",
  "profile_location",
  "site_launch_date",
  "site_title",
  "site_subtitle",
  "site_description",
]);

// 各字段校验规则（P2-009）：
// 值类型、长度、日期格式、URL 协议与数量上限
const FIELD_VALIDATORS: Record<
  string,
  (value: string) => string
> = {
  profile_name: (v) => {
    if (v.length > 50) throw new ValidationError("profileNameTooLong");
    return v;
  },
  profile_avatar: (v) => (v ? validateSafeUrl(v, "profile_avatar", { maxLength: 255 }) : ""),
  profile_bio: (v) => {
    if (v.length > 500) throw new ValidationError("profileBioTooLong");
    return v;
  },
  profile_location: (v) => {
    if (v.length > 100) throw new ValidationError("profileLocationTooLong");
    return v;
  },
  site_launch_date: (v) => (v ? validateDateString(v, "site_launch_date") : ""),
  site_title: (v) => {
    if (v.length > 100) throw new ValidationError("siteTitleTooLong");
    return v;
  },
  site_subtitle: (v) => {
    if (v.length > 200) throw new ValidationError("siteSubtitleTooLong");
    return v;
  },
  site_description: (v) => {
    if (v.length > 500) throw new ValidationError("siteDescriptionTooLong");
    return v;
  },
};

// JSON 数组数量上限，防止超大 payload（P2-009）
const MAX_ARRAY_ITEMS = 50;
// 每条记录的 URL 长度上限
const MAX_URL_LENGTH = 500;
const MAX_NAME_LENGTH = 100;
const MAX_ICON_LENGTH = 100;

/**
 * 保存个人资料与站点基本信息。
 * 使用 upsert 保证幂等：键不存在则创建，存在则更新。
 */
export async function saveProfileSettings(formData: FormData) {
  await requireAdmin();

  const entries: Array<{ key: string; value: string }> = [];
  for (const key of ALLOWED_KEYS) {
    const raw = getStringFromFormData(formData, key);
    const validator = FIELD_VALIDATORS[key];
    const value = validator ? validator(raw) : raw;
    entries.push({ key, value });
  }

  // 批量 upsert，避免 N+1 往返
  await Promise.all(
    entries.map((entry) =>
      prisma.siteSetting.upsert({
        where: { key: entry.key },
        update: { value: entry.value, type: "string" },
        create: { key: entry.key, value: entry.value, type: "string" },
      }),
    ),
  );

  // 刷新受影响的缓存与页面
  // Next.js 16: revalidateTag 单参数形式已弃用，使用 (tag, "max") 两参数形式
  revalidateTag("profile", "max");
  revalidateTag("stats", "max");
  revalidateTag("posts", "max");
  revalidateTag("site-settings", "max");
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/zh");
  revalidatePath("/en");
}

/**
 * 保存社交链接（侧边栏展示）。
 * 输入为 JSON 字符串，格式：[{name, url, icon, showName}]
 */
export async function saveSocialLinks(formData: FormData) {
  await requireAdmin();

  const jsonStr = getStringFromFormData(formData, "social_links");
  let parsed: unknown;
  try {
    parsed = jsonStr ? JSON.parse(jsonStr) : [];
  } catch {
    throw new ValidationError("socialLinksInvalidJson");
  }

  if (!Array.isArray(parsed)) {
    throw new ValidationError("socialLinksNotArray");
  }
  if (parsed.length > MAX_ARRAY_ITEMS) {
    throw new ValidationError("socialLinksTooMany");
  }

  // 清洗每条记录，仅保留白名单字段，并校验 URL 协议与长度（P2-009）
  const cleaned = parsed
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      const url = typeof obj.url === "string" ? obj.url.trim() : "";
      if (!name || !url) return null;
      if (name.length > MAX_NAME_LENGTH) return null;
      try {
        validateSafeUrl(url, "url", { allowRelative: true, maxLength: MAX_URL_LENGTH });
      } catch {
        return null;
      }
      return {
        name,
        url,
        icon:
          typeof obj.icon === "string" && obj.icon.length <= MAX_ICON_LENGTH
            ? obj.icon
            : "link",
        showName: obj.showName !== false,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  await prisma.siteSetting.upsert({
    where: { key: "social_links" },
    update: { value: JSON.stringify(cleaned), type: "json" },
    create: {
      key: "social_links",
      value: JSON.stringify(cleaned),
      type: "json",
    },
  });

  revalidateTag("profile", "max");
  revalidateTag("site-settings", "max");
  revalidatePath("/");
}

/**
 * 保存导航栏外链（如 GitHub、Slider云盘）。
 * 输入为 JSON 字符串，格式：[{i18nKey, url, icon, external, name}]
 */
export async function saveNavExternalLinks(formData: FormData) {
  await requireAdmin();

  const jsonStr = getStringFromFormData(formData, "nav_external_links");
  let parsed: unknown;
  try {
    parsed = jsonStr ? JSON.parse(jsonStr) : [];
  } catch {
    throw new ValidationError("navLinksInvalidJson");
  }

  if (!Array.isArray(parsed)) {
    throw new ValidationError("navLinksNotArray");
  }
  if (parsed.length > MAX_ARRAY_ITEMS) {
    throw new ValidationError("navLinksTooMany");
  }

  const cleaned = parsed
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item as Record<string, unknown>;
      const url = typeof obj.url === "string" ? obj.url.trim() : "";
      if (!url) return null;
      try {
        validateSafeUrl(url, "url", { allowRelative: true, maxLength: MAX_URL_LENGTH });
      } catch {
        return null;
      }
      return {
        // i18nKey 可选；若不提供则使用 name 作为显示文本
        i18nKey: typeof obj.i18nKey === "string" ? obj.i18nKey.slice(0, 100) : "",
        name:
          typeof obj.name === "string" ? obj.name.slice(0, MAX_NAME_LENGTH) : "",
        url,
        icon:
          typeof obj.icon === "string" && obj.icon.length <= MAX_ICON_LENGTH
            ? obj.icon
            : "material-symbols:link",
        external: obj.external !== false,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  await prisma.siteSetting.upsert({
    where: { key: "nav_external_links" },
    update: { value: JSON.stringify(cleaned), type: "json" },
    create: {
      key: "nav_external_links",
      value: JSON.stringify(cleaned),
      type: "json",
    },
  });

  revalidateTag("site-settings", "max");
  revalidatePath("/");
}

/**
 * 保存关于我页面 MDX 内容。
 * 留空则回退到静态 src/content/spec/about.md。
 */
export async function saveAboutContent(formData: FormData) {
  await requireAdmin();

  const content = getStringFromFormData(formData, "about_content");
  // 长度上限，防止超大 payload（P2-009 / P1-008）
  validateContentLength(content, "about_content", 200_000);

  await prisma.siteSetting.upsert({
    where: { key: "about_content" },
    update: { value: content, type: "mdx" },
    create: { key: "about_content", value: content, type: "mdx" },
  });

  revalidateTag("site-settings", "max");
  revalidateTag("about", "max");
  revalidatePath("/zh/about");
  revalidatePath("/en/about");
}

/**
 * 保存主题外观配置（管理面板统一控制客户端配色）。
 * 输入字段：theme_hue / theme_post_layout / theme_card_border_shadow / theme_card_theme_colored
 */
export async function saveThemeSettings(formData: FormData) {
  await requireAdmin();

  const hueRaw = getStringFromFormData(formData, "theme_hue");
  const postLayout = getStringFromFormData(formData, "theme_post_layout");
  const cardBorderShadowRaw = getStringFromFormData(
    formData,
    "theme_card_border_shadow",
  );
  const cardThemeColoredRaw = getStringFromFormData(
    formData,
    "theme_card_theme_colored",
  );

  const hue = Number(hueRaw);
  if (!Number.isFinite(hue) || hue < 0 || hue > 360) {
    throw new ValidationError("themeHueOutOfRange");
  }
  if (postLayout !== "list" && postLayout !== "grid") {
    throw new ValidationError("themePostLayoutInvalid");
  }

  const toBool = (raw: string): boolean =>
    raw === "1" || raw === "on" || raw === "true";

  const value = JSON.stringify({
    hue,
    postLayout,
    cardBorderShadow: toBool(cardBorderShadowRaw),
    cardThemeColored: toBool(cardThemeColoredRaw),
  });

  await prisma.siteSetting.upsert({
    where: { key: THEME_SETTINGS_KEY },
    update: { value, type: "json" },
    create: { key: THEME_SETTINGS_KEY, value, type: "json" },
  });

  // 刷新客户端主题设置缓存
  revalidateTag("theme-settings", "max");
  revalidatePath("/");
  revalidatePath("/zh");
  revalidatePath("/en");
}
