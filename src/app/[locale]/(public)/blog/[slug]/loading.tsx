import { GlassCard } from "@/components/ui/glass-card"

export default function Loading() {
  return (
    <article className="mx-auto max-w-4xl">
      {/* Back link placeholder */}
      <div className="mb-6 h-4 w-24 animate-pulse rounded bg-white/10" />

      <GlassCard className="space-y-6">
        {/* Category pill */}
        <div className="h-6 w-24 animate-pulse rounded-full bg-white/10" />

        {/* Title */}
        <div className="space-y-3">
          <div className="h-10 w-3/4 animate-pulse rounded-lg bg-white/10" />
          <div className="h-10 w-1/2 animate-pulse rounded-lg bg-white/10" />
        </div>

        {/* Excerpt lines */}
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-white/10" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4">
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
        </div>

        {/* Divider */}
        <div className="h-px w-full animate-pulse bg-white/10" />

        {/* Content lines */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-white/10" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>

        {/* Skeleton code block */}
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-full animate-pulse rounded bg-white/10" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
        </div>

        {/* More content lines */}
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-white/10" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
        </div>
      </GlassCard>
    </article>
  )
}
