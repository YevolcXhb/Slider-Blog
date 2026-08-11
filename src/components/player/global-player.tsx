"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Repeat,
  Repeat1,
  Shuffle,
  ChevronDown,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import {
  DEFAULT_MUSIC,
  loadPlaylist,
  useMusicPlayer,
} from "@/lib/music-player-store"
import type { MusicItem } from "@/server/queries/site"

function formatTime(time: number): string {
  if (isNaN(time) || !isFinite(time)) return "0:00"
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function CoverImage({
  cover,
  title,
  isPlaying,
  size = "md",
}: {
  cover: string | null
  title: string
  isPlaying: boolean
  size?: "sm" | "md" | "lg"
}) {
  const sizeMap = {
    sm: "size-12",
    md: "size-14",
    lg: "size-40 sm:size-48",
  }
  const iconMap = {
    sm: "size-5",
    md: "size-6",
    lg: "size-16",
  }
  const sizeClasses = sizeMap[size]
  const iconSize = iconMap[size]

  return (
    <div className={`relative ${sizeClasses} shrink-0`}>
      <div
        className={`absolute inset-0 rounded-full overflow-hidden shadow-lg border-2 border-white dark:border-neutral-700 bg-[var(--primary)]/10 flex items-center justify-center ${isPlaying ? "animate-spin-slow" : ""}`}
        style={{ animationPlayState: isPlaying ? "running" : "paused" }}
      >
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            sizes={size === "sm" ? "48px" : size === "md" ? "64px" : "256px"}
            unoptimized
            className="object-cover relative z-10"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-pink-200/80 via-rose-100/80 to-frost-200/80 dark:from-pink-500/30 dark:via-rose-500/20 dark:to-frost-500/30">
            <Music className={`${iconSize} text-pink-400/60 dark:text-pink-400/40`} />
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressBar({
  progress,
  duration,
  onSeekStart,
  onSeekPreview,
  onSeekEnd,
}: {
  progress: number
  duration: number
  onSeekStart: () => void
  onSeekPreview: (value: number) => void
  onSeekEnd: (value: number) => void
}) {
  // 进度直接来自 store（拖拽时由 seekPreview 实时更新 store.progress）
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const fractionFromEvent = (clientX: number): number | null => {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return null
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.preventDefault()
    isDraggingRef.current = true
    onSeekStart()
    const f = fractionFromEvent(e.clientX)
    if (f !== null) onSeekPreview(f * duration)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const f = fractionFromEvent(e.clientX)
    if (f !== null) onSeekPreview(f * duration)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    const f = fractionFromEvent(e.clientX)
    if (f !== null) onSeekEnd(f * duration)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  return (
    <div className="px-1">
      <div
        ref={containerRef}
        className="progress-container group relative h-1 w-full cursor-pointer touch-none rounded-full bg-neutral-300/60 dark:bg-neutral-500/40"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
      >
        <div
          className="progress-bar absolute left-0 top-0 h-full rounded-full bg-[var(--primary)] transition-[width] duration-100"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="progress-thumb absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-[var(--primary)] ring-2 ring-white dark:ring-neutral-800 shadow-sm"
          style={{ left: `calc(${progressPercent}% - 6px)` }}
        />
      </div>
    </div>
  )
}

function VolumeControl({
  volume,
  isMuted,
  onToggleMute,
  onVolumeChange,
}: {
  volume: number
  isMuted: boolean
  onToggleMute: () => void
  onVolumeChange: (value: number) => void
}) {
  // 音量直接来自 store，拖拽时实时调用 onVolumeChange 同步 store + audio
  const displayVolume = isMuted ? 0 : volume
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const fractionFromEvent = (clientX: number): number | null => {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return null
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.preventDefault()
    isDraggingRef.current = true
    const f = fractionFromEvent(e.clientX)
    if (f !== null) onVolumeChange(f)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const f = fractionFromEvent(e.clientX)
    if (f !== null) onVolumeChange(f)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    const f = fractionFromEvent(e.clientX)
    if (f !== null) onVolumeChange(f)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onToggleMute}
        className="p-1 rounded-md text-neutral-400 hover:text-[var(--primary)] transition-colors"
        aria-label={isMuted ? "取消静音" : "静音"}
        title="音量"
      >
        {isMuted || displayVolume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      <div
        ref={containerRef}
        className="vol-container h-1 w-16 bg-neutral-300/50 dark:bg-neutral-500/40 rounded-full cursor-pointer relative touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label="音量"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayVolume * 100)}
      >
        <div
          className="vol-bar absolute left-0 top-0 h-full bg-[var(--primary)] rounded-full transition-[width] duration-75"
          style={{ width: `${displayVolume * 100}%` }}
        />
      </div>
    </div>
  )
}

function PlaylistDrawer({
  isOpen,
  playlist,
  currentIndex,
  isPlaying,
  onPlayTrack,
}: {
  isOpen: boolean
  playlist: MusicItem[]
  currentIndex: number
  isPlaying: boolean
  onPlayTrack: (i: number) => void
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ gridTemplateRows: "0fr", opacity: 0 }}
          animate={{ gridTemplateRows: "1fr", opacity: 1 }}
          exit={{ gridTemplateRows: "0fr", opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="grid"
        >
          <div className="overflow-hidden min-h-0">
            <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-white/5 mx-1">
              <div
                className="playlist-container max-h-48 overflow-y-auto custom-scrollbar pr-1 pb-1 relative"
                role="listbox"
                aria-label="播放列表"
              >
                {playlist.map((track, index) => (
                  <button
                    key={track.id}
                    onClick={() => onPlayTrack(index)}
                    className={cn(
                      "playlist-item flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors group w-full text-left",
                      index === currentIndex && "bg-neutral-100 dark:bg-white/10"
                    )}
                    role="option"
                    aria-selected={index === currentIndex}
                    aria-current={index === currentIndex}
                  >
                    <div className="size-8 rounded-md overflow-hidden shrink-0 relative bg-neutral-200 dark:bg-neutral-700">
                      {track.cover ? (
                        <Image src={track.cover} alt={track.title} fill sizes="32px" unoptimized className="object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Music className="size-3 text-neutral-400 dark:text-white/40" />
                        </div>
                      )}
                      {index === currentIndex && isPlaying && (
                        <div className="absolute inset-0 bg-[var(--primary)]/20 flex items-center justify-center">
                          <div className="flex items-end gap-[2px] h-3.5">
                            <span className="w-[3px] bg-[var(--primary)] rounded-sm animate-eq-bar" style={{ animationDuration: "0.8s" }} />
                            <span className="w-[3px] bg-[var(--primary)] rounded-sm animate-eq-bar" style={{ animationDuration: "0.6s", animationDelay: "0.15s" }} />
                            <span className="w-[3px] bg-[var(--primary)] rounded-sm animate-eq-bar" style={{ animationDuration: "1s", animationDelay: "0.3s" }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-xs font-bold truncate group-hover:text-[var(--primary)] transition-colors", index === currentIndex && "text-[var(--primary)]")}>
                        {track.title}
                      </div>
                      <div className="text-[10px] text-neutral-400 truncate">{track.artist}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PlayerCard({
  playlist,
  currentIndex,
  isPlaying,
  progress,
  duration,
  volume,
  isMuted,
  playMode,
  isExpanded,
  onTogglePlay,
  onNext,
  onPrev,
  onSeekStart,
  onSeekPreview,
  onSeekEnd,
  onVolumeChange,
  onToggleMute,
  onCycleMode,
  onToggleExpanded,
  onPlayTrack,
}: {
  playlist: MusicItem[]
  currentIndex: number
  isPlaying: boolean
  progress: number
  duration: number
  volume: number
  isMuted: boolean
  playMode: "sequence" | "repeat" | "shuffle"
  isExpanded: boolean
  onTogglePlay: () => void
  onNext: () => void
  onPrev: () => void
  onSeekStart: () => void
  onSeekPreview: (value: number) => void
  onSeekEnd: (value: number) => void
  onVolumeChange: (value: number) => void
  onToggleMute: () => void
  onCycleMode: () => void
  onToggleExpanded: () => void
  onPlayTrack: (i: number) => void
}) {
  const currentTrack = playlist[currentIndex] || null
  const [showPlaylist, setShowPlaylist] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isExpanded) return

    const handlePointerDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onToggleExpanded()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [isExpanded, onToggleExpanded])

  if (!currentTrack) return null

  const ModeIcon = playMode === "shuffle" ? Shuffle : playMode === "repeat" ? Repeat1 : Repeat
  const modeTitle = playMode === "sequence" ? "顺序播放" : playMode === "repeat" ? "单曲循环" : "随机播放"

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: "spring", damping: 32, stiffness: 320 }}
      className={cn(
        "fixed right-4 z-40 overflow-hidden shadow-2xl",
        isExpanded
          ? "bottom-24 w-80 sm:w-96 rounded-2xl glass-card p-4"
          : "bottom-24 w-auto rounded-2xl glass-card p-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
      )}
      onClick={!isExpanded ? onToggleExpanded : undefined}
    >
      {!isExpanded ? (
        <div className="flex items-center gap-3">
          <CoverImage cover={currentTrack.cover} title={currentTrack.title} isPlaying={isPlaying} size="sm" />
          <div className="min-w-0 flex-1 pr-1">
            <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">{currentTrack.title}</p>
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{currentTrack.artist}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTogglePlay()
            }}
            className="flex size-9 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-transform hover:scale-105 active:scale-95"
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">音乐播放器</span>
            <button
              onClick={onToggleExpanded}
              className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="收起"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>

          {/* Top Row: Cover & Info */}
          <div className="flex items-center gap-3 px-1">
            <CoverImage cover={currentTrack.cover} title={currentTrack.title} isPlaying={isPlaying} size="md" />
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between overflow-hidden gap-2">
                <div className="flex-1 min-w-0 overflow-hidden relative">
                  <h3 className="font-bold text-base text-neutral-800 dark:text-neutral-100 leading-tight truncate" title={currentTrack.title}>
                    {currentTrack.title}
                  </h3>
                </div>
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate" title={currentTrack.artist}>
                  {currentTrack.artist}
                </p>
              </div>
              <div className="flex items-center gap-3 text-neutral-400 h-5 mt-0.5">
                <div className="text-[10px] font-mono flex items-center gap-1 shrink-0 h-full">
                  <span>{formatTime(progress)}</span>
                  <span className="opacity-50">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="ml-auto">
                  <VolumeControl volume={volume} isMuted={isMuted} onToggleMute={onToggleMute} onVolumeChange={onVolumeChange} />
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <ProgressBar progress={progress} duration={duration} onSeekStart={onSeekStart} onSeekPreview={onSeekPreview} onSeekEnd={onSeekEnd} />

          {/* Controls Row */}
          <div className="flex items-center justify-between px-1 select-none">
            <button
              onClick={onCycleMode}
              className="p-2 rounded-lg text-neutral-400 hover:text-[var(--primary)] transition-colors active:scale-95"
              title={modeTitle}
              aria-label={modeTitle}
            >
              <ModeIcon className="size-5" />
            </button>
            <button
              onClick={onPrev}
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-[var(--primary)] transition-colors active:scale-95"
              aria-label="上一首"
            >
              <SkipBack className="size-6" />
            </button>
            <button
              onClick={onTogglePlay}
              className="size-12 rounded-full bg-[var(--btn-regular-bg)] hover:bg-[var(--btn-regular-bg-hover)] active:bg-[var(--btn-regular-bg-active)] text-[var(--primary)] flex items-center justify-center transition-all active:scale-95"
              aria-label={isPlaying ? "暂停" : "播放"}
            >
              {isPlaying ? <Pause className="size-6" /> : <Play className="size-6 ml-0.5" />}
            </button>
            <button
              onClick={onNext}
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-[var(--primary)] transition-colors active:scale-95"
              aria-label="下一首"
            >
              <SkipForward className="size-6" />
            </button>
            <button
              onClick={() => setShowPlaylist((prev) => !prev)}
              className={cn(
                "p-2 rounded-lg transition-colors active:scale-95",
                showPlaylist ? "text-[var(--primary)]" : "text-neutral-400 hover:text-[var(--primary)]"
              )}
              aria-label="播放列表"
              title="播放列表"
            >
              <ListMusic className="size-5" />
            </button>
          </div>

          {/* Playlist Drawer */}
          <PlaylistDrawer
            isOpen={showPlaylist}
            playlist={playlist}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
          />
        </div>
      )}
    </motion.div>
  )
}

function GlobalPlayer() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [visible, setVisible] = useState(true)

  const {
    state,
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
  } = useMusicPlayer()

  const { playlist, currentIndex, isPlaying, progress, duration, volume, isMuted, playMode, isLoaded } = state

  // 监听导航栏的显示/隐藏切换
  useEffect(() => {
    const handleToggle = () => setVisible((prev) => !prev)
    window.addEventListener("music-player-toggle", handleToggle)
    return () => window.removeEventListener("music-player-toggle", handleToggle)
  }, [])

  // 从 /api/music 拉取播放列表并喂入共享 store（先到先得）
  useEffect(() => {
    let mounted = true
    fetch("/api/music")
      .then((res) => res.json())
      .then((tracks: MusicItem[]) => {
        if (!mounted) return
        loadPlaylist(tracks && tracks.length > 0 ? tracks : DEFAULT_MUSIC)
      })
      .catch(() => {
        if (!mounted) return
        loadPlaylist(DEFAULT_MUSIC)
      })
    return () => {
      mounted = false
    }
  }, [])

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  if (!isLoaded) return null

  return (
    <>
      {visible && (
        <PlayerCard
          playlist={playlist}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          playMode={playMode}
          isExpanded={isExpanded}
          onTogglePlay={togglePlay}
          onNext={nextTrack}
          onPrev={prevTrack}
          onSeekStart={seekStart}
          onSeekPreview={seekPreview}
          onSeekEnd={seekEnd}
          onVolumeChange={setVolume}
          onToggleMute={toggleMute}
          onCycleMode={cyclePlayMode}
          onToggleExpanded={toggleExpanded}
          onPlayTrack={playTrack}
        />
      )}
    </>
  )
}

export { GlobalPlayer }
export default GlobalPlayer
