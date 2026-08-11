export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm text-white/40">Loading…</p>
      </div>
    </div>
  )
}
