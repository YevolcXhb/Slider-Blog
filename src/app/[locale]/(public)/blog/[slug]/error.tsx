"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

import { Link } from "@/i18n/routing";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { useBlogErrorCopy } from "@/app/[locale]/error-copy";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * 文章页错误边界。与 [locale]/error.tsx 共用 ./error-copy 的同步查表，
 * 同样**刻意不调用 useTranslations()**：错误边界不能依赖可能已经失效的
 * NextIntlClientProvider（详细原因见 error-copy.ts）。
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Surface the error to the console for debugging; Sentry integration
    // (if configured) will also pick this up via the global instrumentation.
    console.error("Blog post failed to load:", error);
  }, [error]);

  const m = useBlogErrorCopy();

  return (
    <article className="mx-auto max-w-4xl">
      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="size-4" />
        {m.backToBlog}
      </Link>

      <GlassCard className="flex flex-col items-center gap-6 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="size-8 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white/90">{m.title}</h1>
          <p className="max-w-md text-sm leading-relaxed text-white/60">{m.description}</p>
        </div>

        {error.digest && (
          <p className="font-mono text-xs text-white/30">{m.errorId(error.digest)}</p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <GlassButton variant="primary" onClick={reset}>
            <RotateCcw className="size-4" />
            {m.retry}
          </GlassButton>
          <Link href="/blog">
            <GlassButton variant="secondary">
              <ArrowLeft className="size-4" />
              {m.backToBlog}
            </GlassButton>
          </Link>
        </div>
      </GlassCard>
    </article>
  );
}
