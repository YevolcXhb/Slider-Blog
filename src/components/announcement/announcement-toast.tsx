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

  // 首次挂载：筛选未读公告并排队（最多 3 条）
  //
  // 这里的 ref 比较**必须**保留：PublicLayout 每次导航都会重新从数据库取
  // 公告，把这些新数组 prop 传下来。若只看依赖数组而没有这道比较，每次导航
  // 都会重新排队，被用户手动关掉（或已经自动消失）的 toast 会在下一次导航时
  // 复活 —— markSeen 只写 localStorage，ToastCard 的卸载并不会调用它。
  //
  // 但数组身份并不足以代表「内容没变」：DB 往返后 orderBy 可能给出不同顺序
  // （存在 sort_order 并列时），或者一次 revalidate 返回了内容完全相同的新
  // 数组。这两种情况下引用都变了，只看引用同样会让旧公告复活。
  // 因此改为比较**内容签名**：只有「未读公告集合」真的变化时才重新排队。
  const prevAnnouncementsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (announcements.length === 0) return;
    // 只对 id 排序：内容变化不由本组件负责（同一条已读公告改了正文也不该复活）
    const key = announcements
      .map((a) => a.id)
      .slice()
      .sort()
      .join(",");
    if (prevAnnouncementsKeyRef.current === key) return;
    prevAnnouncementsKeyRef.current = key;

    const seen = readSeen();
    const now = Date.now();
    const unseen = announcements
      .filter((a) => (seen[a.id] ?? 0) + SEEN_TTL < now)
      .slice(0, MAX_TOASTS)
      .map((a) => ({ ...a, key: a.id }));
    setItems(unseen);
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
          <ToastCard key={item.key} item={item} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastCardProps {
  item: QueuedToast;
  onDismiss: (item: QueuedToast) => void;
}

function ToastCard({ item, onDismiss }: ToastCardProps) {
  const t = useTranslations("Widgets");

  // 自动消失计时器。
  //
  // 依赖必须**稳定**：onDismiss 是 useCallback([])，item 是 items 数组里的
  // 同一个对象引用。此前父组件写的是 onDismiss={() => dismiss(item)}，每次父组件
  // 重渲染都产生新的函数身份，于是 effect 反复 cleanup + 重建定时器 —— 表现是
  // 「每多弹一条公告，先前所有 toast 的 8 秒倒计时都被重置」。
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item), AUTO_DISMISS);
    return () => clearTimeout(timer);
  }, [onDismiss, item]);

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
          onClick={() => onDismiss(item)}
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
