"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  FolderTree,
  Settings,
  Zap,
  Image,
  Users,
  Music,
  Megaphone,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import { useTheme } from "@/components/theme/theme-system";

const navItems = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/posts", labelKey: "posts", icon: FileText },
  { href: "/comments", labelKey: "comments", icon: MessageSquare },
  { href: "/manage-categories", labelKey: "categories", icon: FolderTree },
  { href: "/manage-moments", labelKey: "moments", icon: Zap },
  { href: "/manage-gallery", labelKey: "gallery", icon: Image },
  { href: "/manage-music", labelKey: "music", icon: Music },
  { href: "/manage-announcements", labelKey: "announcements", icon: Megaphone },
  { href: "/manage-users", labelKey: "users", icon: Users },
  { href: "/settings", labelKey: "settings", icon: Settings },
] as const;

/**
 * 管理员侧边栏（客户端组件）
 *
 * 功能：
 * 1. 基于 usePathname 判断当前激活项，高亮显示
 * 2. 导航项逐级延迟入场动画（stagger）
 * 3. hover 时图标微动 + 背景渐变
 * 4. active 项左侧指示条
 * 5. 移动端：默认隐藏，通过顶部汉堡按钮展开为抽屉；
 *    支持 ESC 关闭、遮罩点击关闭、路由变化自动关闭，键盘焦点可返回。
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // 在 Suspense 外部调用 usePageTransition，确保导航时立即触发进度条
  // 不能放在 Template 中，因为 Template 在 Suspense 内部，挂起时会延迟触发
  usePageTransition();

  // 路由变化时自动关闭移动端抽屉
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setOpen(false);
      prevPathname.current = pathname;
    }
  }, [pathname]);

  // ESC 关闭抽屉并聚焦回开关按钮；移动端打开时锁定背景滚动
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const mq = window.matchMedia("(min-width: 768px)");
    if (!mq.matches) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  // 计算每个导航项是否激活
  // pathname 格式：/zh/dashboard 或 /en/posts/create
  // 需要匹配 /dashboard 前缀（含子路由如 /posts/create 也高亮 /posts）
  const activeHref = useMemo(() => {
    // 去掉 locale 前缀
    const withoutLocale = pathname.replace(/^\/(zh|en)/, "");
    // 找到匹配的最长前缀
    let best = "";
    for (const item of navItems) {
      if (
        withoutLocale === item.href ||
        withoutLocale.startsWith(item.href + "/")
      ) {
        if (item.href.length > best.length) best = item.href;
      }
    }
    return best;
  }, [pathname]);

  return (
    <>
      {/* 移动端遮罩层：打开抽屉时覆盖内容，点击关闭 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 移动端顶栏：汉堡按钮 + 标题（仅小屏显示） */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-black/50 px-4 backdrop-blur-2xl md:hidden dark:bg-black/20">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          aria-label={t("toggle_menu")}
          className="rounded-lg p-2 text-white/80 hover:bg-white/10"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-white/80">
          {t("slider_admin")}
        </span>
      </header>

      <aside
        id="admin-sidebar"
        className={`fixed left-0 top-0 z-50 flex h-screen w-[17rem] flex-col border-r border-white/15 bg-black/50 backdrop-blur-2xl transition-transform duration-300 md:translate-x-0 dark:bg-black/20 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label={t("slider_admin")}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 admin-nav-item-enter">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 transition-transform duration-300 hover:scale-105">
            <FileText className="size-5 text-white/80" />
          </div>
          <span className="flex-1 text-lg font-bold text-white/90">
            {t("slider_admin")}
          </span>
          {/* 移动端关闭按钮 */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("close_menu")}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 md:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                scroll={false}
                className={`admin-nav-item group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 admin-nav-item-enter ${
                  isActive
                    ? "bg-white/15 text-white/90 shadow-sm"
                    : "text-white/60 hover:bg-white/10 hover:text-white/80"
                }`}
                style={{
                  animationDelay: `${index * 35}ms`,
                }}
                aria-current={isActive ? "page" : undefined}
              >
                {/* 激活指示条 */}
                {isActive && (
                  <span className="admin-active-bar absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-(--primary)" />
                )}
                <Icon
                  className={`size-4 shrink-0 transition-transform duration-200 ${
                    isActive
                      ? "text-(--primary)"
                      : "group-hover:scale-110 group-hover:translate-x-0.5"
                  }`}
                />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* 左下角：管理面板独立的亮暗模式切换（与客户端分离） */}
        <AdminThemeToggle />
      </aside>
    </>
  );
}

/**
 * 管理面板亮暗模式切换（亮色 / 暗色 / 跟随系统）。
 *
 * 使用独立的 localStorage key（admin-theme），与博客客户端（theme）
 * 完全分离，切换互不影响。
 */
function AdminThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("Admin");

  const options = [
    { value: "light", icon: Sun, label: t("theme_light") },
    { value: "dark", icon: Moon, label: t("theme_dark") },
    { value: "system", icon: Monitor, label: t("theme_system") },
  ] as const;

  return (
    <div className="border-t border-white/10 p-3">
      <div
        className="flex items-center gap-1 rounded-xl bg-white/5 p-1"
        role="group"
        aria-label={t("theme_dark")}
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-label={opt.label}
              aria-pressed={isActive}
              title={opt.label}
              className={`flex h-9 flex-1 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/50 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
