import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  FileText,
  Clock,
  Eye,
  Heart,
  MessageCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { formatYMD } from "./post-meta";

interface StatItemProps {
  icon: LucideIcon;
  label?: string;
  value: ReactNode;
  showIcons?: boolean;
  textClass?: string;
  iconWrapperClass?: string;
  interactive?: boolean;
  onClick?: () => void;
}

function StatItem({
  icon: Icon,
  label,
  value,
  showIcons = false,
  textClass = "",
  iconWrapperClass = "",
  interactive,
  onClick,
}: StatItemProps) {
  const content = (
    <div className="flex items-center">
      {showIcons && (
        <div className={iconWrapperClass}>
          <Icon className="size-3.5" />
        </div>
      )}
      <span className={textClass}>
        {!showIcons && label !== undefined && `${label} `}
        {value}
      </span>
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex items-center transition active:scale-95"
      >
        {content}
      </button>
    );
  }

  return content;
}

interface PostStatsProps {
  published?: Date | string | number;
  words?: number;
  minutes?: number;
  showPublished?: boolean;
  showWords?: boolean;
  showReadingTime?: boolean;
  showIcons?: boolean;
  className?: string;
  locale?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  onLike?: () => void;
}

function PostStats({
  published,
  words,
  minutes,
  showPublished = true,
  showWords = true,
  showReadingTime = true,
  showIcons = false,
  className,
  // locale 仍然保留在 PostStatsProps 里（调用方会传，属于公开 props 契约），
  // 但文案已改由 next-intl 提供，因此这里不再解构使用。
  viewCount,
  likeCount,
  commentCount,
  onLike,
}: PostStatsProps) {
  // PostStats 是普通客户端组件，位于 NextIntlClientProvider 下游，useTranslations 安全。
  const tMeta = useTranslations("PostMeta");
  const tArchive = useTranslations("Archive");

  const hasPublished = showPublished && published !== undefined;
  const hasWords = showWords && typeof words === "number";
  const hasMinutes = showReadingTime && typeof minutes === "number";

  const textClass = "text-xs font-medium text-50";
  const dividerClass = "text-xs font-medium text-30";
  const iconWrapperClass =
    "transition h-5 w-5 rounded-md bg-black/5 dark:bg-white/10 text-50 flex items-center justify-center mr-1.5";

  const socialMode =
    viewCount !== undefined ||
    likeCount !== undefined ||
    commentCount !== undefined;

  if (socialMode) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {viewCount !== undefined && (
          <StatItem
            icon={Eye}
            value={viewCount}
            showIcons={showIcons}
            textClass={textClass}
            iconWrapperClass={iconWrapperClass}
          />
        )}
        {viewCount !== undefined && likeCount !== undefined && (
          <span className={dividerClass}>|</span>
        )}
        {likeCount !== undefined && (
          <StatItem
            icon={Heart}
            value={likeCount}
            showIcons={showIcons}
            textClass={textClass}
            iconWrapperClass={iconWrapperClass}
            interactive={!!onLike}
            onClick={onLike}
          />
        )}
        {((likeCount !== undefined && commentCount !== undefined) ||
          (viewCount !== undefined && commentCount !== undefined)) &&
          !(viewCount !== undefined && likeCount === undefined) && (
            <span className={dividerClass}>|</span>
          )}
        {commentCount !== undefined && (
          <StatItem
            icon={MessageCircle}
            value={commentCount}
            showIcons={showIcons}
            textClass={textClass}
            iconWrapperClass={iconWrapperClass}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {hasPublished && (
        <StatItem
          icon={CalendarDays}
          label={tArchive("publishedAt")}
          value={formatYMD(published)}
          showIcons={showIcons}
          textClass={textClass}
          iconWrapperClass={iconWrapperClass}
        />
      )}

      {hasPublished && hasWords && <span className={dividerClass}>|</span>}

      {hasWords && (
        <StatItem
          icon={FileText}
          value={tMeta("word", { count: words })}
          showIcons={showIcons}
          textClass={textClass}
          iconWrapperClass={iconWrapperClass}
        />
      )}

      {(hasPublished || hasWords) && hasMinutes && (
        <span className={dividerClass}>|</span>
      )}

      {hasMinutes && (
        <StatItem
          icon={Clock}
          value={tMeta("minute", { count: minutes })}
          showIcons={showIcons}
          textClass={textClass}
          iconWrapperClass={iconWrapperClass}
        />
      )}
    </div>
  );
}

export { PostStats, type PostStatsProps };
