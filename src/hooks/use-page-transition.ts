"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * 页面切换进度条 + 过渡动画
 *
 * 时序（与 Suspense + 流式渲染配合）：
 * - pathname 变化：立即触发进度条 loading + 离场动画（80ms）
 * - 进度条 finishing 触发：max(280ms, 数据到达预估时长)
 * - 命中 staleTimes 缓存时（dynamic=30s）：进度条几乎不出现
 *
 * 关键设计：
 * 1. 离场动画缩短到 80ms，让切换更跟手
 * 2. 进度条最小显示 280ms，避免一闪而过
 * 3. 进度条最大 1500ms 后强制 finishing，防止网络慢时一直转
 * 4. Suspense fallback=null 让旧页面继续显示直到新内容就绪（避免白屏）
 */

const LEAVING_DURATION = 80      // 离场动画时长
const MIN_PROGRESS_DURATION = 280  // 进度条最小显示时长，防闪烁

export function usePageTransition() {
  const pathname = usePathname()
  const previousPathname = useRef<string>(pathname)
  const isFirstRender = useRef(true)

  // 首次加载与每次路由切换都重置滚动到顶部，避免保留旧页面位置
  useEffect(() => {
    if (typeof window === "undefined") return
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [pathname])

  useEffect(() => {
    if (typeof document === "undefined") return

    // 跳过首次渲染（初始加载）
    if (isFirstRender.current) {
      isFirstRender.current = false
      previousPathname.current = pathname
      return
    }

    if (previousPathname.current === pathname) return

    const html = document.documentElement
    const progressBar = document.getElementById("progress-bar")

    // 阶段 1：离开 - 内容淡出 + 进度条 loading
    html.classList.add("is-changing", "is-leaving", "is-animating", "is-page-transitioning")
    if (progressBar) {
      progressBar.classList.remove("finishing", "done")
      // 触发 reflow 重启动画
      void progressBar.offsetWidth
      progressBar.classList.add("loading")
    }

    // 阶段 2：离开动画结束 → 切换为进入状态
    const enterTimer = window.setTimeout(() => {
      html.classList.remove("is-leaving")
    }, LEAVING_DURATION)

    // 阶段 3：进度条 finishing 触发
    // 命中缓存时数据几乎瞬时到达，280ms 最小值防止闪烁
    // 网络慢时 1500ms 强制 finishing，避免一直转
    const finishTimer = window.setTimeout(() => {
      html.classList.remove("is-changing", "is-animating", "is-leaving", "is-page-transitioning")

      if (progressBar) {
        progressBar.classList.remove("loading")
        progressBar.classList.add("finishing")

        window.setTimeout(() => {
          progressBar.classList.remove("finishing")
          progressBar.classList.add("done")
          window.setTimeout(() => {
            progressBar.classList.remove("done")
          }, 300)
        }, 200)
      }
    }, MIN_PROGRESS_DURATION)

    previousPathname.current = pathname

    return () => {
      window.clearTimeout(enterTimer)
      window.clearTimeout(finishTimer)
      // 防御性清理：避免 React StrictMode / 快速切换时 class 残留
      // 导致 .transition-main 被永久 translateY(2rem) 影响正常浏览
      html.classList.remove("is-changing", "is-leaving", "is-animating", "is-page-transitioning")
    }
  }, [pathname])
}
