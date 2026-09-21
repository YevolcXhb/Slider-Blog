export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="size-10 animate-spin rounded-full border-2 border-black/10 border-t-black/50 dark:border-white/20 dark:border-t-white/70"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm text-30">Loading…</p>
      </div>
    </div>
  );
}
