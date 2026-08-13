"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import {
  Settings,
  User,
  Check,
  Loader2,
  Link as LinkIcon,
  FileText,
  Info,
  Plus,
  Trash2,
  Globe,
  Navigation,
  Palette,
  LayoutList,
  LayoutGrid,
  Video,
} from "lucide-react";
import {
  saveProfileSettings,
  saveSocialLinks,
  saveNavExternalLinks,
  saveAboutContent,
  saveThemeSettings,
  saveMediaSettings,
} from "@/server/actions/settings";
import type {
  SocialLinkItem,
  NavExternalLinkItem,
  SettingsPageData,
} from "./page";
import type { PostLayout } from "@/lib/theme-css";

export const SETTINGS_TABS = [
  "profile",
  "social",
  "nav",
  "about",
  "theme",
  "media",
] as const;

type TabId = (typeof SETTINGS_TABS)[number];

export function getNextSettingsStatusOnTabChange(): "idle" {
  return "idle";
}

interface SettingsManagerProps {
  initialData: SettingsPageData;
}

const inputClass =
  "min-w-0 flex-1 w-full rounded-xl border border-black/10 dark:border-white/20 bg-gray-100/70 dark:bg-white/5 px-4 py-2.5 text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-400 dark:focus:border-white/40 focus:outline-none";
const textareaClass = `${inputClass} min-h-32 resize-none leading-6`;

const labelClass = "mb-1.5 block text-xs font-medium text-white/50";

export default function SettingsManager({ initialData }: SettingsManagerProps) {
  const t = useTranslations("AdminSettings");
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // 个人资料 & 站点信息共享一个 form state
  const [name, setName] = useState(initialData.profile.profile_name);
  const [avatar, setAvatar] = useState(initialData.profile.profile_avatar);
  const [bio, setBio] = useState(initialData.profile.profile_bio);
  const [location, setLocation] = useState(initialData.profile.profile_location);
  const [launchDate, setLaunchDate] = useState(
    initialData.profile.site_launch_date,
  );
  const [siteTitle, setSiteTitle] = useState(initialData.profile.site_title);
  const [siteSubtitle, setSiteSubtitle] = useState(
    initialData.profile.site_subtitle,
  );
  const [siteDescription, setSiteDescription] = useState(
    initialData.profile.site_description,
  );

  // 社交链接
  const [socialLinks, setSocialLinks] = useState<SocialLinkItem[]>(
    initialData.socialLinks.length > 0
      ? initialData.socialLinks
      : [
          {
            name: "GitHub",
            url: "https://github.com/YevolcXhb",
            icon: "github",
            showName: false,
          },
        ],
  );

  // 导航外链
  const [navLinks, setNavLinks] = useState<NavExternalLinkItem[]>(
    initialData.navExternalLinks.length > 0
      ? initialData.navExternalLinks
      : [
          {
            i18nKey: "github",
            name: "GitHub",
            url: "https://github.com/YevolcXhb",
            icon: "fa7-brands:github",
            external: true,
          },
          {
            i18nKey: "cloudDrive",
            name: "Slider云盘",
            url: "https://alist.slidercore.com/s/vAtJ/Slider",
            icon: "material-symbols:cloud",
            external: true,
          },
        ],
  );

  // 关于我
  const [aboutContent, setAboutContent] = useState(initialData.aboutContent);

  // 主题外观（管理面板统一控制客户端配色）
  const [hue, setHue] = useState(initialData.themeSettings.hue);
  const [postLayout, setPostLayout] = useState<PostLayout>(
    initialData.themeSettings.postLayout,
  );
  const [cardBorderShadow, setCardBorderShadow] = useState(
    initialData.themeSettings.cardBorderShadow,
  );
  const [cardThemeColored, setCardThemeColored] = useState(
    initialData.themeSettings.cardThemeColored,
  );
  const [homepageVideoUrl, setHomepageVideoUrl] = useState(
    initialData.homepageVideoUrl,
  );

  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const handleSaveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("idle");
    const formData = new FormData();
    formData.set("profile_name", name);
    formData.set("profile_avatar", avatar);
    formData.set("profile_bio", bio);
    formData.set("profile_location", location);
    formData.set("site_launch_date", launchDate);
    formData.set("site_title", siteTitle);
    formData.set("site_subtitle", siteSubtitle);
    formData.set("site_description", siteDescription);

    startTransition(async () => {
      try {
        await saveProfileSettings(formData);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  const handleSaveSocial = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("idle");
    const formData = new FormData();
    formData.set("social_links", JSON.stringify(socialLinks));

    startTransition(async () => {
      try {
        await saveSocialLinks(formData);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  const handleSaveNav = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("idle");
    const formData = new FormData();
    formData.set("nav_external_links", JSON.stringify(navLinks));

    startTransition(async () => {
      try {
        await saveNavExternalLinks(formData);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  const handleSaveAbout = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("idle");
    const formData = new FormData();
    formData.set("about_content", aboutContent);

    startTransition(async () => {
      try {
        await saveAboutContent(formData);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  const handleSaveTheme = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("idle");
    const formData = new FormData();
    formData.set("theme_hue", String(hue));
    formData.set("theme_post_layout", postLayout);
    formData.set("theme_card_border_shadow", cardBorderShadow ? "1" : "0");
    formData.set("theme_card_theme_colored", cardThemeColored ? "1" : "0");

    startTransition(async () => {
      try {
        await saveThemeSettings(formData);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  const handleSaveMedia = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("idle");
    const formData = new FormData();
    formData.set("homepage_video_url", homepageVideoUrl);

    startTransition(async () => {
      try {
        await saveMediaSettings(formData);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  // 社交链接操作
  const addSocialLink = () => {
    setSocialLinks([
      ...socialLinks,
      { name: "", url: "", icon: "link", showName: false },
    ]);
  };

  const updateSocialLink = (index: number, field: keyof SocialLinkItem, value: string | boolean) => {
    setSocialLinks(
      socialLinks.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const removeSocialLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  // 导航外链操作
  const addNavLink = () => {
    setNavLinks([
      ...navLinks,
      {
        i18nKey: "",
        name: "",
        url: "",
        icon: "material-symbols:link",
        external: true,
      },
    ]);
  };

  const updateNavLink = (
    index: number,
    field: keyof NavExternalLinkItem,
    value: string | boolean,
  ) => {
    setNavLinks(
      navLinks.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const removeNavLink = (index: number) => {
    setNavLinks(navLinks.filter((_, i) => i !== index));
  };

  const tabs: Array<{ id: TabId; icon: React.ElementType; label: string }> = [
    { id: "profile", icon: User, label: t("profileSection") },
    { id: "social", icon: LinkIcon, label: t("socialLinksSection") },
    { id: "nav", icon: Navigation, label: t("navLinksSection") },
    { id: "about", icon: FileText, label: t("aboutSection") },
    { id: "theme", icon: Palette, label: t("themeSection") },
    { id: "media", icon: Video, label: t("mediaSection") },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Settings className="size-7 text-white/70" aria-hidden="true" />
          <h1 className="admin-page-title text-3xl font-bold text-white/90 md:text-4xl">{t("title")}</h1>
        </div>
        <p className="text-sm text-white/50">{t("subtitle")}</p>
      </header>

      {/* Tab 切换 */}
      <div
        className="relative z-10 flex flex-wrap gap-2"
        role="tablist"
        aria-label={t("title")}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setStatus(getNextSettingsStatusOnTabChange());
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.id}`}
              id={`settings-tab-${tab.id}`}
              className={`inline-flex cursor-pointer touch-manipulation items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/15 text-white/90"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 个人资料 + 站点信息 */}
      {activeTab === "profile" && (
        <form
          onSubmit={handleSaveProfile}
          className="space-y-6"
          role="tabpanel"
          id="settings-panel-profile"
          aria-labelledby="settings-tab-profile"
        >
          <GlassCard className="space-y-5 p-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <User className="size-5 text-white/60" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-white/80">
                {t("profileSection")}
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="profile_name">
                  {t("profileName")}
                </label>
                <input
                  id="profile_name"
                  name="profile_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("profileNamePlaceholder")}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="profile_location">
                  {t("profileLocation")}
                </label>
                <input
                  id="profile_location"
                  name="profile_location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("profileLocationPlaceholder")}
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="profile_avatar">
                  {t("profileAvatar")}
                </label>
                <input
                  id="profile_avatar"
                  name="profile_avatar"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder={t("profileAvatarPlaceholder")}
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="profile_bio">
                  {t("profileBio")}
                </label>
                <textarea
                  id="profile_bio"
                  name="profile_bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t("profileBioPlaceholder")}
                  rows={3}
                  className={textareaClass}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="space-y-5 p-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Globe className="size-5 text-white/60" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-white/80">
                {t("siteInfoSection")}
              </h2>
            </div>

            <div className="grid gap-5">
              <div>
                <label className={labelClass} htmlFor="site_title">
                  {t("siteTitle")}
                </label>
                <input
                  id="site_title"
                  name="site_title"
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  placeholder={t("siteTitlePlaceholder")}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-white/40">
                  {t("siteTitleHint")}
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="site_subtitle">
                  {t("siteSubtitle")}
                </label>
                <input
                  id="site_subtitle"
                  name="site_subtitle"
                  value={siteSubtitle}
                  onChange={(e) => setSiteSubtitle(e.target.value)}
                  placeholder={t("siteSubtitlePlaceholder")}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="site_description">
                  {t("siteDescription")}
                </label>
                <textarea
                  id="site_description"
                  name="site_description"
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  placeholder={t("siteDescriptionPlaceholder")}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="site_launch_date">
                  {t("siteLaunchDate")}
                </label>
                <input
                  id="site_launch_date"
                  name="site_launch_date"
                  type="date"
                  value={launchDate}
                  onChange={(e) => setLaunchDate(e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-white/40">
                  {t("siteLaunchDateHint")}
                </p>
              </div>
            </div>
          </GlassCard>

          <SaveButton isPending={isPending} status={status} />
        </form>
      )}

      {/* 社交链接 */}
      {activeTab === "social" && (
        <form
          onSubmit={handleSaveSocial}
          className="space-y-6"
          role="tabpanel"
          id="settings-panel-social"
          aria-labelledby="settings-tab-social"
        >
          <GlassCard className="space-y-5 p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="size-5 text-white/60" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-white/80">
                  {t("socialLinksSection")}
                </h2>
              </div>
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={addSocialLink}
              >
                <Plus className="size-4" />
                {t("addLink")}
              </GlassButton>
            </div>

            <p className="text-xs text-white/40">{t("socialLinksHint")}</p>

            <div className="space-y-4">
              {socialLinks.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/30">
                  {t("noLinks")}
                </p>
              ) : (
                socialLinks.map((link, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-white/10 p-4 md:grid-cols-[1fr_1.5fr_0.8fr_auto_auto]"
                  >
                    <div>
                      <label className={labelClass}>
                        {t("linkName")}
                      </label>
                      <input
                        value={link.name}
                        onChange={(e) =>
                          updateSocialLink(index, "name", e.target.value)
                        }
                        placeholder="GitHub"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("linkUrl")}</label>
                      <input
                        value={link.url}
                        onChange={(e) =>
                          updateSocialLink(index, "url", e.target.value)
                        }
                        placeholder="https://github.com/username"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("linkIcon")}</label>
                      <input
                        value={link.icon}
                        onChange={(e) =>
                          updateSocialLink(index, "icon", e.target.value)
                        }
                        placeholder="github / mail / link"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex h-10 items-center gap-2 text-xs text-white/60">
                        <input
                          type="checkbox"
                          checked={link.showName}
                          onChange={(e) =>
                            updateSocialLink(
                              index,
                              "showName",
                              e.target.checked,
                            )
                          }
                          className="size-4 rounded border-white/20 bg-white/5"
                        />
                        {t("showName")}
                      </label>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeSocialLink(index)}
                        className="inline-flex size-10 items-center justify-center rounded-lg text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        aria-label={t("removeLink")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          <SaveButton isPending={isPending} status={status} />
        </form>
      )}

      {/* 导航外链 */}
      {activeTab === "nav" && (
        <form
          onSubmit={handleSaveNav}
          className="space-y-6"
          role="tabpanel"
          id="settings-panel-nav"
          aria-labelledby="settings-tab-nav"
        >
          <GlassCard className="space-y-5 p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Navigation
                  className="size-5 text-white/60"
                  aria-hidden="true"
                />
                <h2 className="text-lg font-semibold text-white/80">
                  {t("navLinksSection")}
                </h2>
              </div>
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={addNavLink}
              >
                <Plus className="size-4" />
                {t("addLink")}
              </GlassButton>
            </div>

            <p className="text-xs text-white/40">{t("navLinksHint")}</p>

            <div className="space-y-4">
              {navLinks.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/30">
                  {t("noLinks")}
                </p>
              ) : (
                navLinks.map((link, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-white/10 p-4 md:grid-cols-[1fr_1fr_1.5fr_auto_auto]"
                  >
                    <div>
                      <label className={labelClass}>{t("linkName")}</label>
                      <input
                        value={link.name}
                        onChange={(e) =>
                          updateNavLink(index, "name", e.target.value)
                        }
                        placeholder="GitHub / Slider云盘"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("navI18nKey")}</label>
                      <input
                        value={link.i18nKey}
                        onChange={(e) =>
                          updateNavLink(index, "i18nKey", e.target.value)
                        }
                        placeholder="github / cloudDrive（可空）"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("linkUrl")}</label>
                      <input
                        value={link.url}
                        onChange={(e) =>
                          updateNavLink(index, "url", e.target.value)
                        }
                        placeholder="https://..."
                        className={inputClass}
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex h-10 items-center gap-2 text-xs text-white/60">
                        <input
                          type="checkbox"
                          checked={link.external}
                          onChange={(e) =>
                            updateNavLink(
                              index,
                              "external",
                              e.target.checked,
                            )
                          }
                          className="size-4 rounded border-white/20 bg-white/5"
                        />
                        {t("external")}
                      </label>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeNavLink(index)}
                        className="inline-flex size-10 items-center justify-center rounded-lg text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        aria-label={t("removeLink")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-xl bg-white/5 p-3 text-xs text-white/40">
              <p>
                <strong className="text-white/60">{t("iconHintLabel")}:</strong>{" "}
                {t("navIconHint")}
              </p>
            </div>
          </GlassCard>

          <SaveButton isPending={isPending} status={status} />
        </form>
      )}

      {/* 关于我 */}
      {activeTab === "about" && (
        <form
          onSubmit={handleSaveAbout}
          className="space-y-6"
          role="tabpanel"
          id="settings-panel-about"
          aria-labelledby="settings-tab-about"
        >
          <GlassCard className="space-y-5 p-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Info className="size-5 text-white/60" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-white/80">
                {t("aboutSection")}
              </h2>
            </div>

            <div>
              <label className={labelClass} htmlFor="about_content">
                {t("aboutContent")}
              </label>
              <textarea
                id="about_content"
                name="about_content"
                value={aboutContent}
                onChange={(e) => setAboutContent(e.target.value)}
                placeholder={t("aboutContentPlaceholder")}
                rows={16}
                className={`${textareaClass} font-mono`}
              />
              <p className="mt-1.5 text-xs text-white/40">
                {t("aboutContentHint")}
              </p>
            </div>
          </GlassCard>

          <SaveButton isPending={isPending} status={status} />
        </form>
      )}

      {/* 主题外观（管理面板统一控制客户端配色） */}
      {activeTab === "theme" && (
        <form
          onSubmit={handleSaveTheme}
          className="space-y-6"
          role="tabpanel"
          id="settings-panel-theme"
          aria-labelledby="settings-tab-theme"
        >
          <GlassCard className="space-y-6 p-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Palette className="size-5 text-white/60" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-white/80">
                {t("themeSection")}
              </h2>
            </div>

            <p className="text-sm text-white/50">{t("themeHint")}</p>

            {/* 主题色相 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white/80">
                  {t("themeHue")}
                </label>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block size-6 rounded-full ring-1 ring-white/20"
                    style={{
                      background: `oklch(0.65 0.18 ${hue})`,
                    }}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-sm text-white/60">
                    {hue}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={hue}
                onChange={(e) => setHue(Number(e.target.value))}
                className="hue-slider w-full"
                aria-label={t("themeHue")}
              />
              <p className="text-xs text-white/40">{t("themeHueHint")}</p>
            </div>

            {/* 文章布局 */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-white/80">
                {t("themePostLayout")}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPostLayout("list")}
                  aria-pressed={postLayout === "list"}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    postLayout === "list"
                      ? "bg-brand-frost/20 text-white ring-1 ring-brand-frost/40"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  <LayoutList className="size-4" aria-hidden="true" />
                  {t("themePostLayoutList")}
                </button>
                <button
                  type="button"
                  onClick={() => setPostLayout("grid")}
                  aria-pressed={postLayout === "grid"}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    postLayout === "grid"
                      ? "bg-brand-frost/20 text-white ring-1 ring-brand-frost/40"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  <LayoutGrid className="size-4" aria-hidden="true" />
                  {t("themePostLayoutGrid")}
                </button>
              </div>
            </div>

            {/* 卡片开关 */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-white/80">
                    {t("themeCardBorderShadow")}
                  </p>
                  <p className="text-xs text-white/40">
                    {t("themeCardBorderShadowHint")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={cardBorderShadow}
                  onChange={(e) => setCardBorderShadow(e.target.checked)}
                  className="size-4 rounded border-white/20 bg-white/5"
                  aria-label={t("themeCardBorderShadow")}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-white/80">
                    {t("themeCardThemeColored")}
                  </p>
                  <p className="text-xs text-white/40">
                    {t("themeCardThemeColoredHint")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={cardThemeColored}
                  onChange={(e) => setCardThemeColored(e.target.checked)}
                  className="size-4 rounded border-white/20 bg-white/5"
                  aria-label={t("themeCardThemeColored")}
                />
              </div>
            </div>
          </GlassCard>

          <SaveButton isPending={isPending} status={status} />
        </form>
      )}

      {/* 媒体资源（首页背景视频直链，留空则不播放） */}
      {activeTab === "media" && (
        <form
          onSubmit={handleSaveMedia}
          className="space-y-6"
          role="tabpanel"
          id="settings-panel-media"
          aria-labelledby="settings-tab-media"
        >
          <GlassCard className="space-y-5 p-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Video className="size-5 text-white/60" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-white/80">
                {t("mediaSection")}
              </h2>
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="homepage_video_url">
                {t("homepageVideo")}
              </label>
              <input
                id="homepage_video_url"
                name="homepage_video_url"
                value={homepageVideoUrl}
                onChange={(e) => setHomepageVideoUrl(e.target.value)}
                placeholder={t("homepageVideoPlaceholder")}
                className={inputClass}
              />
              <p className="text-xs text-white/40">{t("homepageVideoHint")}</p>
            </div>

            <p className="text-xs text-white/40">
              {t("musicManageHint")}
            </p>
          </GlassCard>

          <SaveButton isPending={isPending} status={status} />
        </form>
      )}
    </div>
  );
}

interface SaveButtonProps {
  isPending: boolean;
  status: "idle" | "saved" | "error";
}

function SaveButton({ isPending, status }: SaveButtonProps) {
  const t = useTranslations("AdminSettings");
  return (
    <div className="flex items-center gap-4">
      <GlassButton type="submit" variant="brand" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("saving")}
          </>
        ) : (
          t("save")
        )}
      </GlassButton>

      {status === "saved" && (
        <span className="inline-flex items-center gap-1.5 text-sm text-green-400">
          <Check className="size-4" aria-hidden="true" />
          {t("saved")}
        </span>
      )}
      {status === "error" && (
        <span className="text-sm text-red-400">{t("saveFailed")}</span>
      )}
    </div>
  );
}
