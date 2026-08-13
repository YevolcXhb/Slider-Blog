"use client"

import { useSyncExternalStore } from "react"

import { musicPlayerConfig } from "@/config/musicConfig"
import type { MusicItem } from "@/server/queries/site"

export type PlayMode = "sequence" | "repeat" | "shuffle"

export interface MusicPlayerState {
  playlist: MusicItem[]
  currentIndex: number
  isPlaying: boolean
  progress: number
  duration: number
  volume: number
  isMuted: boolean
  playMode: PlayMode
  isLoaded: boolean
}

const DEFAULT_VOLUME = musicPlayerConfig.volume ?? 0.7

// =============================================================================
// 持久化：音量/静音/播放模式 + 每首歌的播放进度
// =============================================================================

const SETTINGS_KEY = "music-player:settings"
const PROGRESS_KEY = "music-player:progress"
const PROGRESS_SAVE_INTERVAL = 5000 // timeupdate 节流间隔（ms）
const MAX_PROGRESS_ENTRIES = 50 // 最多保存多少首歌的进度

interface PersistedSettings {
  volume: number
  isMuted: boolean
  playMode: PlayMode
}

interface ProgressEntry {
  progress: number
  duration: number
  timestamp: number
}

type ProgressMap = Record<string, ProgressEntry>

/** 从 localStorage 读取持久化设置（仅浏览器侧） */
function loadPersistedSettings(): Partial<PersistedSettings> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSettings
  } catch {
    return null
  }
}

/** 保存设置到 localStorage */
function persistSettings() {
  if (typeof window === "undefined") return
  try {
    const settings: PersistedSettings = {
      volume: state.volume,
      isMuted: state.isMuted,
      playMode: state.playMode,
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // 忽略 quota / 序列化错误
  }
}

/** 读取全部进度记录 */
function loadProgressMap(): ProgressMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ProgressMap
  } catch {
    return {}
  }
}

/** 保存单首歌的播放进度（自动限制条目数量） */
function persistProgress(url: string, progress: number, duration: number) {
  if (typeof window === "undefined") return
  if (!url || progress <= 0) return
  try {
    const map = loadProgressMap()
    map[url] = { progress, duration, timestamp: Date.now() }
    // 超出上限时按 timestamp 保留最近的条目
    const entries = Object.entries(map)
    if (entries.length > MAX_PROGRESS_ENTRIES) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
      const trimmed: ProgressMap = {}
      for (const [k, v] of entries.slice(0, MAX_PROGRESS_ENTRIES)) {
        trimmed[k] = v
      }
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(trimmed))
    } else {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(map))
    }
  } catch {
    // 忽略写入错误
  }
}

/** 获取单首歌的保存进度 */
function getSavedProgress(url: string): ProgressEntry | null {
  if (typeof window === "undefined" || !url) return null
  const map = loadProgressMap()
  return map[url] ?? null
}

/** 清除单首歌的保存进度（歌曲自然结束时调用） */
function clearSavedProgress(url: string) {
  if (typeof window === "undefined") return
  if (!url) return
  try {
    const map = loadProgressMap()
    if (map[url]) {
      delete map[url]
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(map))
    }
  } catch {
    // 忽略
  }
}

// =============================================================================
// 模块级单例状态：两个组件共享同一个 audio 元素和状态源
// =============================================================================

// 初始快照：SSR 和 client 首次渲染必须返回**完全相同的对象引用**，
// 否则 useSyncExternalStore 会触发 hydration mismatch 并回退到 client rendering
const INITIAL_SNAPSHOT: MusicPlayerState = {
  playlist: [],
  currentIndex: 0,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: DEFAULT_VOLUME,
  isMuted: false,
  playMode: "sequence",
  isLoaded: false,
}

let state: MusicPlayerState = INITIAL_SNAPSHOT

const listeners = new Set<() => void>()
let audio: HTMLAudioElement | null = null
let isSeeking = false
let audioInitialized = false
// 标记下一次 loadedmetadata 时需要恢复进度的歌曲 URL
let pendingRestoreUrl: string | null = null

function setState(partial: Partial<MusicPlayerState>) {
  state = { ...state, ...partial }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// server snapshot：与 INITIAL_SNAPSHOT 同引用，确保 SSR/CSR 首次渲染一致
function getServerSnapshot(): MusicPlayerState {
  return INITIAL_SNAPSHOT
}

// client snapshot：返回当前 state。第一次调用时 state 指向 INITIAL_SNAPSHOT，
// ensureAudio/loadPlaylist 修改后会创建新对象引用，触发 React 重渲染（这是期望行为）
function getSnapshot(): MusicPlayerState {
  return state
}

// =============================================================================
// audio 元素懒初始化（仅浏览器侧执行一次）
// =============================================================================

function ensureAudio() {
  if (audioInitialized) return
  if (typeof window === "undefined") return
  audioInitialized = true

  // 从 localStorage 恢复持久化设置（音量/静音/播放模式）
  // 必须通过 setState() 触发订阅，避免直接修改 state 引发 hydration mismatch
  const saved = loadPersistedSettings()
  if (saved) {
    const restored: Partial<MusicPlayerState> = {}
    if (typeof saved.volume === "number" && saved.volume >= 0 && saved.volume <= 1) {
      restored.volume = saved.volume
    }
    if (typeof saved.isMuted === "boolean") {
      restored.isMuted = saved.isMuted
    }
    if (saved.playMode === "sequence" || saved.playMode === "repeat" || saved.playMode === "shuffle") {
      restored.playMode = saved.playMode
    }
    if (Object.keys(restored).length > 0) {
      setState(restored)
    }
  }

  audio = new Audio()
  audio.volume = state.isMuted ? 0 : state.volume

  // timeupdate：更新进度 + 节流保存
  let lastSaveTime = 0
  audio.addEventListener("timeupdate", () => {
    if (isSeeking) return
    if (!audio) return
    setState({ progress: audio.currentTime })
    const now = Date.now()
    if (now - lastSaveTime > PROGRESS_SAVE_INTERVAL) {
      lastSaveTime = now
      const track = state.playlist[state.currentIndex]
      if (track) {
        persistProgress(track.url, audio.currentTime, audio.duration || state.duration)
      }
    }
  })
  audio.addEventListener("loadedmetadata", () => {
    if (!audio) return
    setState({ duration: audio.duration || 0 })
    // 恢复保存的播放进度
    if (pendingRestoreUrl) {
      const entry = getSavedProgress(pendingRestoreUrl)
      if (entry && entry.progress > 0 && entry.progress < audio.duration) {
        audio.currentTime = entry.progress
        setState({ progress: entry.progress })
      }
      pendingRestoreUrl = null
    }
  })
  audio.addEventListener("ended", () => {
    handleEnded()
  })
  // 暂停时立即保存进度
  audio.addEventListener("pause", () => {
    if (!audio) return
    const track = state.playlist[state.currentIndex]
    if (track) {
      persistProgress(track.url, audio.currentTime, audio.duration || state.duration)
    }
  })
  // 页面隐藏/卸载时立即保存进度
  window.addEventListener("pagehide", () => {
    if (!audio) return
    const track = state.playlist[state.currentIndex]
    if (track) {
      persistProgress(track.url, audio.currentTime, audio.duration || state.duration)
    }
  })
}

function handleEnded() {
  const s = state
  // 歌曲自然结束：非 repeat 模式下清除该歌曲保存的进度
  if (s.playMode !== "repeat") {
    const endedTrack = s.playlist[s.currentIndex]
    if (endedTrack) clearSavedProgress(endedTrack.url)
  }
  if (s.playMode === "repeat") {
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => setState({ isPlaying: false }))
    }
  } else if (s.playMode === "shuffle") {
    if (s.playlist.length > 1) {
      let next = Math.floor(Math.random() * s.playlist.length)
      if (next === s.currentIndex) next = (next + 1) % s.playlist.length
      loadTrack(next, true)
    } else if (s.playlist.length === 1) {
      loadTrack(0, true)
    }
  } else {
    // 顺序播放
    if (s.currentIndex < s.playlist.length - 1) {
      loadTrack(s.currentIndex + 1, true)
    } else {
      // 播完最后一首，回到第一首但不自动播放
      const track = s.playlist[0]
      if (audio && track) {
        audio.src = track.url
        audio.load()
      }
      setState({ currentIndex: 0, isPlaying: false, progress: 0 })
    }
  }
}

function loadTrack(index: number, autoplay: boolean) {
  const track = state.playlist[index]
  if (!track) {
    setState({ currentIndex: index, isPlaying: autoplay })
    return
  }
  if (audio) {
    audio.pause()
    audio.src = track.url
    audio.load()
  }
  // 尝试恢复该歌曲的保存进度
  const saved = getSavedProgress(track.url)
  if (saved && saved.progress > 0 && saved.duration > 0 && saved.progress < saved.duration) {
    pendingRestoreUrl = track.url
    setState({ currentIndex: index, progress: saved.progress, isPlaying: autoplay })
  } else {
    setState({ currentIndex: index, progress: 0, isPlaying: autoplay })
  }
  if (autoplay && audio) {
    audio.play().catch(() => setState({ isPlaying: false }))
  }
}

// =============================================================================
// Actions — 直接操作 audio 元素并更新 state
// =============================================================================

export function loadPlaylist(tracks: MusicItem[]) {
  ensureAudio()
  if (state.playlist.length > 0) return // 已有播放列表，不覆盖
  if (tracks.length === 0) {
    setState({ isLoaded: true })
    return
  }
  setState({ playlist: tracks, isLoaded: true })
  // 不预加载音频：等用户点击播放时才设置 src，避免 ERR_ABORTED
}

export function togglePlay() {
  if (state.playlist.length === 0) return
  const next = !state.isPlaying
  setState({ isPlaying: next })
  if (!audio) return
  if (next) {
    const track = state.playlist[state.currentIndex]
    if (track && audio.src !== track.url) {
      audio.src = track.url
      audio.load()
      // 首次加载该歌曲，尝试恢复进度
      const saved = getSavedProgress(track.url)
      if (saved && saved.progress > 0 && saved.duration > 0 && saved.progress < saved.duration) {
        pendingRestoreUrl = track.url
        setState({ progress: saved.progress })
      }
    }
    audio.play().catch(() => setState({ isPlaying: false }))
  } else {
    audio.pause()
  }
}

export function nextTrack() {
  if (state.playlist.length === 0) return
  if (state.playMode === "shuffle") {
    let next = Math.floor(Math.random() * state.playlist.length)
    if (next === state.currentIndex && state.playlist.length > 1) {
      next = (next + 1) % state.playlist.length
    }
    loadTrack(next, true)
  } else {
    const next =
      state.currentIndex < state.playlist.length - 1
        ? state.currentIndex + 1
        : 0
    loadTrack(next, true)
  }
}

export function prevTrack() {
  if (state.playlist.length === 0) return
  if (audio && audio.currentTime > 3) {
    audio.currentTime = 0
    return
  }
  const prev =
    state.currentIndex > 0
      ? state.currentIndex - 1
      : state.playlist.length - 1
  loadTrack(prev, true)
}

export function playTrack(index: number) {
  if (index < 0 || index >= state.playlist.length) return
  loadTrack(index, true)
}

export function seekStart() {
  isSeeking = true
}

/** 拖拽过程中实时更新 progress（仅视觉，不操作 audio.currentTime） */
export function seekPreview(value: number) {
  setState({ progress: value })
}

/** 拖拽结束，跳转 audio.currentTime */
export function seekEnd(value: number) {
  isSeeking = false
  if (audio) {
    audio.currentTime = value
  }
  setState({ progress: value })
  // 拖动结束立即保存进度
  const track = state.playlist[state.currentIndex]
  if (track) {
    persistProgress(track.url, value, state.duration)
  }
}

export function setVolume(value: number) {
  const v = Math.max(0, Math.min(1, value))
  if (audio) audio.volume = v
  setState({ volume: v, isMuted: false })
  persistSettings()
}

export function toggleMute() {
  const nextMuted = !state.isMuted
  if (audio) audio.volume = nextMuted ? 0 : state.volume
  setState({ isMuted: nextMuted })
  persistSettings()
}

export function cyclePlayMode() {
  const next: PlayMode =
    state.playMode === "sequence"
      ? "repeat"
      : state.playMode === "repeat"
        ? "shuffle"
        : "sequence"
  setState({ playMode: next })
  persistSettings()
}

// =============================================================================
// Hook — 组件通过此 hook 订阅状态并获取 actions
// =============================================================================

export function useMusicPlayer() {
  // 关键：传入 server snapshot 参数，确保 SSR 和 client 首次渲染返回相同引用，
  // 避免 React 19 因 useSyncExternalStore 不一致而回退到 client rendering
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return {
    state: snapshot,
    togglePlay,
    nextTrack,
    prevTrack,
    playTrack,
    seekStart,
    seekPreview,
    seekEnd,
    setVolume,
    toggleMute,
    cyclePlayMode,
  }
}
