"use client"

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import {
  applyThemeClasses,
  buildThemeCss,
  DEFAULT_THEME_SETTINGS,
  type PostLayout,
  type ThemeSettings,
} from "@/lib/theme-css"

/**
 * 主题外观配置（客户端）。
 *
 * 配色统一由管理面板控制：服务端读取 SiteSetting.theme_settings 后
 * 通过 initialSettings 下发，客户端仅负责应用 CSS 变量，不再允许
 * 用户本地修改配色（localStorage 持久化已移除）。
 */

interface ThemeSettingsContextType extends ThemeSettings {
  setHue: (hue: number) => void
  setPostLayout: (layout: PostLayout) => void
  setCardBorderShadow: (enabled: boolean) => void
  setCardThemeColored: (enabled: boolean) => void
  resetSettings: () => void
}

const STYLE_ID = "theme-settings-css"

const ThemeSettingsContext = createContext<ThemeSettingsContextType | null>(null)

function applyTheme(settings: ThemeSettings) {
  if (typeof document === "undefined") return
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement("style")
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = buildThemeCss(settings)
  applyThemeClasses(settings)
}

interface ThemeSettingsProviderProps {
  children: React.ReactNode
  /** 管理面板统一配置，由服务端下发；缺失时回退默认值 */
  initialSettings?: Partial<ThemeSettings>
}

function ThemeSettingsProvider({
  children,
  initialSettings,
}: ThemeSettingsProviderProps) {
  const [settings, setSettings] = useState<ThemeSettings>(() => ({
    ...DEFAULT_THEME_SETTINGS,
    ...initialSettings,
  }))

  // 应用主题配置。服务端已在首帧注入 <style>，此处确保客户端 JS 状态一致
  useEffect(() => {
    applyTheme(settings)
  }, [settings])

  const updateSettings = useCallback((updates: Partial<ThemeSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }, [])

  const setHue = useCallback(
    (hue: number) => {
      updateSettings({ hue })
    },
    [updateSettings],
  )

  const setPostLayout = useCallback(
    (layout: PostLayout) => {
      updateSettings({ postLayout: layout })
    },
    [updateSettings],
  )

  const setCardBorderShadow = useCallback(
    (enabled: boolean) => {
      updateSettings({ cardBorderShadow: enabled })
    },
    [updateSettings],
  )

  const setCardThemeColored = useCallback(
    (enabled: boolean) => {
      updateSettings({ cardThemeColored: enabled })
    },
    [updateSettings],
  )

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_THEME_SETTINGS)
  }, [])

  const value = useMemo(
    () => ({
      ...settings,
      setHue,
      setPostLayout,
      setCardBorderShadow,
      setCardThemeColored,
      resetSettings,
    }),
    [settings, setHue, setPostLayout, setCardBorderShadow, setCardThemeColored, resetSettings],
  )

  return (
    <ThemeSettingsContext.Provider value={value}>
      {children}
    </ThemeSettingsContext.Provider>
  )
}

function useThemeSettings() {
  const ctx = useContext(ThemeSettingsContext)
  if (!ctx) {
    throw new Error("useThemeSettings must be used within ThemeSettingsProvider")
  }
  return ctx
}

export { ThemeSettingsProvider, useThemeSettings }
