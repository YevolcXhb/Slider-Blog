function PageBackground() {
  return (
    <div className="fixed inset-0 -z-1 overflow-hidden" aria-hidden="true">
      {/* NapCat 风格：3 个彩色光斑（樱花粉 / 冰霜蓝 / 粉色） */}
      {/* 亮色模式：更大更饱和的光斑让玻璃效果明显可见 */}
      <div className="page-background-blob absolute -top-60 -left-60 size-[700px] rounded-full bg-gradient-to-br from-pink-400/60 via-rose-300/45 to-fuchsia-400/55 blur-[140px] dark:from-pink-400/25 dark:via-rose-300/15 dark:to-fuchsia-400/25 dark:blur-[100px]" />
      <div className="page-background-blob absolute top-[10%] -right-60 size-[650px] rounded-full bg-gradient-to-br from-sky-400/55 via-cyan-300/40 to-blue-400/50 blur-[140px] dark:from-sky-400/25 dark:via-cyan-300/15 dark:to-blue-400/25 dark:blur-[90px]" style={{ animationDelay: "-7s" }} />
      <div className="page-background-blob absolute -bottom-60 left-[15%] size-[750px] rounded-full bg-gradient-to-br from-pink-300/50 via-rose-200/35 to-pink-400/50 blur-[150px] dark:from-pink-300/20 dark:via-rose-200/10 dark:to-pink-400/20 dark:blur-[110px]" style={{ animationDelay: "-14s" }} />
    </div>
  )
}

export { PageBackground }
