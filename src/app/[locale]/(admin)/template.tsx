"use client"

import type { ReactNode } from "react"

/**
 * 后台路由的 template：
 * 仅添加 transition-main 类配合 CSS 过渡动画。
 *
 * 关键设计（与前台保持一致）：
 * 1. 不使用 key={pathname}：避免每次导航重新挂载整个子树（导致像"刷新"一样）
 * 2. 不在此调用 usePageTransition：因为 Template 在 Suspense 内部，
 *    挂起时会延迟触发进度条。usePageTransition 已移至 AdminSidebar（Suspense 外部）
 * 3. transition-main 类配合 html.is-animating 实现淡入淡出
 */
export default function AdminTemplate({ children }: { children: ReactNode }) {
  return <div className="transition-main">{children}</div>
}
