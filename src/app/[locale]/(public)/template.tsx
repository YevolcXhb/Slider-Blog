import type { ReactNode } from "react"

/**
 * template.tsx 在路由切换时会重新挂载（不同于 layout 缓存）。
 * 这里仅做"包一层"用，动画由 usePageTransition + globals.css 控制，
 * 不再叠加 page-transition-enter 以免双动画冲突。
 */
export default function Template({ children }: { children: ReactNode }) {
  return <>{children}</>
}
