"use client"

/**
 * 自定义主题管理系统
 *
 * 背景：next-themes 0.4.6 的 ThemeProvider 内部会渲染 <script> 标签
 * （用于在 React 水合前根据 localStorage / 系统偏好设置主题，防止 FOUC）。
 * React 19 已不再执行组件树内的 <script>，这会触发控制台警告。
 *
 * 本模块的 FOUC 防护策略（无需 <script>）：
 *   1. layout 在 <html> 上预设 "dark" class（与 defaultTheme 一致）
 *   2. ThemeProvider 在 useState 初始化时直接读取 localStorage（客户端首次渲染即拿到正确主题）
 *   3. useLayoutEffect 在浏览器绘制前将正确主题应用到 DOM
 *   这样在首帧绘制前主题就已修正，用户不会看到闪烁
 *
 * API 与 next-themes 兼容：useTheme 返回 { theme, setTheme, resolvedTheme, ... }
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export interface UseThemeProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme?: ResolvedTheme
  forcedTheme?: Theme
  themes: Theme[]
  systemTheme?: ResolvedTheme
}

const DEFAULT_STORAGE_KEY = "theme"
const DEFAULT_THEMES: Theme[] = ["light", "dark", "system"]

const ThemeContext = createContext<UseThemeProps | undefined>(undefined)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyThemeToDom(theme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(theme)
  root.style.colorScheme = theme
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  enableSystem?: boolean
  storageKey?: string
  themes?: Theme[]
  attribute?: string
  value?: Record<string, string>
  disableTransitionOnChange?: boolean
  forcedTheme?: Theme
}

/**
 * 自定义 ThemeProvider
 * - 不在组件树内渲染 <script>，规避 React 19 警告
 * - useState 初始化时直接读取 localStorage，客户端首次渲染即拿到正确主题
 * - useLayoutEffect 在绘制前应用主题，防止 FOUC
 * - 监听 prefers-color-scheme 变化
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  storageKey = DEFAULT_STORAGE_KEY,
  themes = DEFAULT_THEMES,
  forcedTheme,
}: ThemeProviderProps) {
  // 客户端首次渲染时直接从 localStorage 读取主题，避免水合后再切换导致的闪烁
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme
    try {
      const stored = localStorage.getItem(storageKey) as Theme | null
      if (stored && themes.includes(stored)) return stored
    } catch {
      // 忽略 localStorage 访问错误
    }
    return defaultTheme
  })
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") return "light"
    return getSystemTheme()
  })

  // 监听系统主题变化
  useEffect(() => {
    if (!enableSystem) return
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? "dark" : "light"
      setSystemTheme(next)
      if (theme === "system") {
        applyThemeToDom(next)
      }
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme, enableSystem])

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (forcedTheme && (forcedTheme === "light" || forcedTheme === "dark")) {
      return forcedTheme
    }
    return theme === "system" ? systemTheme : (theme as ResolvedTheme)
  }, [theme, systemTheme, forcedTheme])

  // useLayoutEffect 在浏览器绘制前执行，确保用户不会看到主题闪烁
  useLayoutEffect(() => {
    applyThemeToDom(resolvedTheme)
  }, [resolvedTheme])

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next)
      try {
        localStorage.setItem(storageKey, next)
      } catch {
        // 忽略写入失败
      }
    },
    [storageKey],
  )

  const value = useMemo<UseThemeProps>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      forcedTheme,
      themes,
      systemTheme: enableSystem ? systemTheme : undefined,
    }),
    [theme, setTheme, resolvedTheme, forcedTheme, themes, systemTheme, enableSystem],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * 与 next-themes 同名 hook，保持现有调用点零成本迁移
 */
export function useTheme(): UseThemeProps {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // 在 Provider 外部使用时返回安全的默认值，避免崩溃
    return {
      theme: "system",
      setTheme: () => {},
      themes: DEFAULT_THEMES,
      systemTheme: undefined,
    }
  }
  return ctx
}
