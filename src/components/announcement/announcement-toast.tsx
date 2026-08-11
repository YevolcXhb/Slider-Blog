"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Megaphone, X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * 公告右上角弹窗提示。
 *
 * 进入站点时读取数据库中激活的公告，把「未读（或 24h 内已关闭）」的公告
 * 依次以 toast 形式从右上角弹出，带 spring 入场动效，可手动关闭或自动消失。
 * 关闭后 24 小时内不再重复提示该公告（localStorage 去重）。
 */

export interface ToastAnnouncement {
  id: string;
  content: string;
  isPinned?: boolean;
}

interface AnnouncementToastProps {
  announcements: ToastAnnouncement[];
}

const SEEN_KEY = "slider-blog-announcement-toast-seen";
const SEEN_TTL = 24 * 60 * 60 * 1000; // 24 小时
const MAX_TOASTS = 3; // 单次最多弹出的公告数
const STAGGER_DELAY = 900; // 每条之间的入场间隔
const INITIAL_DELAY = 250; // 进入页面后的首个延迟
const AUTO_DISMISS = 8000; // 自动消失时长

function readSeen(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
}

function markSeen(id: string) {
  try {
    const seen = readSeen();
    seen[id] = Date.now();
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // 忽略 localStorage 访问错误
  }
}

interface QueuedToast extends ToastAnnouncement {
  key: string;
}

function AnnouncementToast({ announcements }: AnnouncementToastProps) {
  const [items, setItems] = useState<QueuedToast[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevAnnouncementsRef = useRef(announcements);

  // 首次挂载：筛选未读公告并排队（最多 3 条）
  useEffect(() => {
    if (announcements.length > 0 && prevAnnouncementsRef.current !== announcements) {
      prevAnnouncementsRef.current = announcements;
      const seen = readSeen();
      const now = Date.now();
      const unseen = announcements
        .filter((a) => (seen[a.id] ?? 0) + SEEN_TTL < now)
        .slice(0, MAX_TOASTS)
        .map((a) => ({ ...a, key: a.id }));
      setItems(unseen);
    }
  }, [announcements]);

  // 依次入场：每条间隔 STAGGER_DELAY
  useEffect(() => {
    if (items.length === 0) return;
    let i = 0;
    const addNext = () => {
      setVisibleKeys((prev) => {
        const next = new Set(prev);
        next.add(items[i].key);
        return next;
      });
      i += 1;
      if (i < items.length) {
        timersRef.current.push(setTimeout(addNext, STAGGER_DELAY));
      }
    };
    timersRef.current.push(setTimeout(addNext, INITIAL_DELAY));
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
    };
  }, [items]);

  const dismiss = useCallback((item: QueuedToast) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.delete(item.key);
      return next;
    });
    markSeen(item.id);
  }, []);

  const visible = items.filter((item) => visibleKeys.has(item.key));

  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] flex flex-col gap-3">
      <AnimatePresence>
        {visible.map((item) => (
          <ToastCard
            key={item.key}
            item={item}
            onDismiss={() => dismiss(item)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastCardProps {
  item: QueuedToast;
  onDismiss: () => void;
}

function ToastCard({ item, onDismiss }: ToastCardProps) {
  const t = useTranslations("Widgets");

  // 自动消失计时器
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="pointer-events-auto w-80 max-w-[calc(100vw-2rem)]"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-pink-200/60 bg-white/90 p-4 shadow-xl shadow-pink-900/10 backdrop-blur-xl dark:border-pink-400/20 dark:bg-gray-900/90">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-pink-500 dark:bg-pink-400/15 dark:text-pink-300">
          <Megaphone className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
              {t("announcement")}
            </span>
            {item.isPinned && (
              <span className="rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-medium text-pink-600 dark:bg-pink-400/20 dark:text-pink-300">
                {t("pinned")}
              </span>
            )}
          </div>
          <p className="line-clamp-3 text-sm leading-6 text-gray-700 dark:text-white/70">
            {item.content}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("announcementClose")}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-white/70"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}

export { AnnouncementToast, type AnnouncementToastProps };
export default AnnouncementToast;
