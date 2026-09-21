"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { loadPlaylist, useMusicPlayer } from "@/lib/music-player-store";
import type { MusicItem } from "@/server/queries/site";

function formatTime(time: number): string {
  if (isNaN(time) || !isFinite(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function CoverImage({
  cover,
  title,
  isPlaying,
  size = "md",
}: {
  cover: string | null;
  title: string;
  isPlaying: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = {
    sm: "size-12",
    md: "size-14",
    lg: "size-40 sm:size-48",
  };
  const iconMap = {
    sm: "size-5",
    md: "size-6",
    lg: "size-16",
  };
  const sizeClasses = sizeMap[size];
  const iconSize = iconMap[size];

  return (
    <div className={`relative ${sizeClasses} shrink-0`}>
      <div
        className={`absolute inset-0 flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[var(--primary)]/10 shadow-lg dark:border-neutral-700 ${isPlaying ? "animate-spin-slow" : ""}`}
        style={{ animationPlayState: isPlaying ? "running" : "paused" }}
      >
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            sizes={size === "sm" ? "48px" : size === "md" ? "64px" : "256px"}
            unoptimized
            className="relative z-10 object-cover"
          />
        ) : (
          <div className="to-frost-200/80 dark:to-frost-500/30 flex size-full items-center justify-center bg-gradient-to-br from-pink-200/80 via-rose-100/80 dark:from-pink-500/30 dark:via-rose-500/20">
            <Music className={`${iconSize} text-pink-400/60 dark:text-pink-400/40`} />
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({
  progress,
  duration,
  onSeekStart,
  onSeekPreview,
  onSeekEnd,
}: {
  progress: number;
  duration: number;
  onSeekStart: () => void;
  onSeekPreview: (value: number) => void;
  onSeekEnd: (value: number) => void;
}) {
  const t = useTranslations("Player");
  // 进度直接来自 store（拖拽时由 seekPreview 实时更新 store.progress）
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const fractionFromEvent = (clientX: number): number | null => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    isDraggingRef.current = true;
    onSeekStart();
    const f = fractionFromEvent(e.clientX);
    if (f !== null) onSeekPreview(f * duration);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const f = fractionFromEvent(e.clientX);
    if (f !== null) onSeekPreview(f * duration);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const f = fractionFromEvent(e.clientX);
    if (f !== null) onSeekEnd(f * duration);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

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
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
      >
        <div
          className="progress-bar absolute top-0 left-0 h-full rounded-full bg-[var(--primary)] transition-[width] duration-100"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="progress-thumb absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-[var(--primary)] shadow-sm ring-2 ring-white dark:ring-neutral-800"
          style={{ left: `calc(${progressPercent}% - 6px)` }}
        />
      </div>
    </div>
  );
}

function VolumeControl({
  volume,
  isMuted,
  onToggleMute,
  onVolumeChange,
}: {
  volume: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
}) {
  const t = useTranslations("Player");
  // 音量直接来自 store，拖拽时实时调用 onVolumeChange 同步 store + audio
  const displayVolume = isMuted ? 0 : volume;
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const fractionFromEvent = (clientX: number): number | null => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    isDraggingRef.current = true;
    const f = fractionFromEvent(e.clientX);
    if (f !== null) onVolumeChange(f);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const f = fractionFromEvent(e.clientX);
    if (f !== null) onVolumeChange(f);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const f = fractionFromEvent(e.clientX);
    if (f !== null) onVolumeChange(f);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onToggleMute}
        className="rounded-md p-1 text-neutral-400 transition-colors hover:text-[var(--primary)]"
        aria-label={isMuted ? t("unmute") : t("mute")}
        title={t("volume")}
      >
        {isMuted || displayVolume === 0 ? (
          <VolumeX className="size-4" />
        ) : (
          <Volume2 className="size-4" />
        )}
      </button>
      <div
        ref={containerRef}
        className="vol-container relative h-1 w-16 cursor-pointer touch-none rounded-full bg-neutral-300/50 dark:bg-neutral-500/40"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label={t("volume")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayVolume * 100)}
      >
        <div
          className="vol-bar absolute top-0 left-0 h-full rounded-full bg-[var(--primary)] transition-[width] duration-75"
          style={{ width: `${displayVolume * 100}%` }}
        />
      </div>
    </div>
  );
}

function PlaylistDrawer({
  isOpen,
  playlist,
  currentIndex,
  isPlaying,
  onPlayTrack,
}: {
  isOpen: boolean;
  playlist: MusicItem[];
  currentIndex: number;
  isPlaying: boolean;
  onPlayTrack: (i: number) => void;
}) {
  const t = useTranslations("Player");
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
          <div className="min-h-0 overflow-hidden">
            <div className="mx-1 mt-2 border-t border-neutral-100 pt-2 dark:border-white/5">
              <div
                className="playlist-container custom-scrollbar relative max-h-48 overflow-y-auto pr-1 pb-1"
                role="listbox"
                aria-label={t("playlist")}
              >
                {playlist.map((track, index) => (
                  <button
                    key={track.id}
                    onClick={() => onPlayTrack(index)}
                    className={cn(
                      "playlist-item group flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-white/5",
                      index === currentIndex && "bg-neutral-100 dark:bg-white/10",
                    )}
                    role="option"
                    aria-selected={index === currentIndex}
                    aria-current={index === currentIndex}
                  >
                    <div className="relative size-8 shrink-0 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-700">
                      {track.cover ? (
                        <Image
                          src={track.cover}
                          alt={track.title}
                          fill
                          sizes="32px"
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Music className="size-3 text-neutral-400 dark:text-white/40" />
                        </div>
                      )}
                      {index === currentIndex && isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--primary)]/20">
                          <div className="flex h-3.5 items-end gap-[2px]">
                            <span
                              className="animate-eq-bar w-[3px] rounded-sm bg-[var(--primary)]"
                              style={{ animationDuration: "0.8s" }}
                            />
                            <span
                              className="animate-eq-bar w-[3px] rounded-sm bg-[var(--primary)]"
                              style={{ animationDuration: "0.6s", animationDelay: "0.15s" }}
                            />
                            <span
                              className="animate-eq-bar w-[3px] rounded-sm bg-[var(--primary)]"
                              style={{ animationDuration: "1s", animationDelay: "0.3s" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "truncate text-xs font-bold transition-colors group-hover:text-[var(--primary)]",
                          index === currentIndex && "text-[var(--primary)]",
                        )}
                      >
                        {track.title}
                      </div>
                      <div className="truncate text-[10px] text-neutral-400">{track.artist}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
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
  playlist: MusicItem[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playMode: "sequence" | "repeat" | "shuffle";
  isExpanded: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeekStart: () => void;
  onSeekPreview: (value: number) => void;
  onSeekEnd: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  onCycleMode: () => void;
  onToggleExpanded: () => void;
  onPlayTrack: (i: number) => void;
}) {
  const t = useTranslations("Player");
  const tWidgets = useTranslations("Widgets");
  const currentTrack = playlist[currentIndex] || null;
  const [showPlaylist, setShowPlaylist] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onToggleExpanded();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isExpanded, onToggleExpanded]);

  if (!currentTrack) return null;

  const ModeIcon = playMode === "shuffle" ? Shuffle : playMode === "repeat" ? Repeat1 : Repeat;
  const modeTitle =
    playMode === "sequence" ? t("sequence") : playMode === "repeat" ? t("repeat") : t("shuffle");

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: "spring", damping: 32, stiffness: 320 }}
      className={cn(
        // bottom-* 必须写死成一个值：原先折叠态没有 bottom，motion 的 layout
        // 动画在展开/收起时会因为"展开态有 bottom-24、折叠态没有"而把卡片
        // 从底部弹到顶再落回，同时收起态用 w-auto 让宽度随标题长度抖一下。
        // 折叠态给一个固定的 w-64，两种状态的左右锚点一致，layout 动画就只
        // 剩下高度变化，不会出现整块跳位。
        "fixed right-4 bottom-24 z-40 overflow-hidden shadow-2xl",
        isExpanded
          ? "glass-card w-80 rounded-2xl p-4 sm:w-96"
          : "glass-card w-64 cursor-pointer rounded-2xl p-2 hover:scale-[1.02] active:scale-[0.98]",
      )}
      onClick={!isExpanded ? onToggleExpanded : undefined}
    >
      {!isExpanded ? (
        <div className="flex items-center gap-3">
          <CoverImage
            cover={currentTrack.cover}
            title={currentTrack.title}
            isPlaying={isPlaying}
            size="sm"
          />
          <div className="min-w-0 flex-1 pr-1">
            <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              {currentTrack.title}
            </p>
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {currentTrack.artist}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            className="flex size-9 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-transform hover:scale-105 active:scale-95"
            aria-label={isPlaying ? tWidgets("pause") : tWidgets("play")}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              {t("title")}
            </span>
            <button
              onClick={onToggleExpanded}
              className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label={t("collapse")}
            >
              <ChevronDown className="size-4" />
            </button>
          </div>

          {/* Top Row: Cover & Info */}
          <div className="flex items-center gap-3 px-1">
            <CoverImage
              cover={currentTrack.cover}
              title={currentTrack.title}
              isPlaying={isPlaying}
              size="md"
            />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <div className="relative min-w-0 flex-1 overflow-hidden">
                  <h3
                    className="truncate text-base leading-tight font-bold text-neutral-800 dark:text-neutral-100"
                    title={currentTrack.title}
                  >
                    {currentTrack.title}
                  </h3>
                </div>
              </div>
              <div className="min-w-0 overflow-hidden">
                <p
                  className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400"
                  title={currentTrack.artist}
                >
                  {currentTrack.artist}
                </p>
              </div>
              <div className="mt-0.5 flex h-5 items-center gap-3 text-neutral-400">
                <div className="flex h-full shrink-0 items-center gap-1 font-mono text-[10px]">
                  <span>{formatTime(progress)}</span>
                  <span className="opacity-50">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="ml-auto">
                  <VolumeControl
                    volume={volume}
                    isMuted={isMuted}
                    onToggleMute={onToggleMute}
                    onVolumeChange={onVolumeChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <ProgressBar
            progress={progress}
            duration={duration}
            onSeekStart={onSeekStart}
            onSeekPreview={onSeekPreview}
            onSeekEnd={onSeekEnd}
          />

          {/* Controls Row */}
          <div className="flex items-center justify-between px-1 select-none">
            <button
              onClick={onCycleMode}
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:text-[var(--primary)] active:scale-95"
              title={modeTitle}
              aria-label={modeTitle}
            >
              <ModeIcon className="size-5" />
            </button>
            <button
              onClick={onPrev}
              className="rounded-lg p-2 text-neutral-600 transition-colors hover:text-[var(--primary)] active:scale-95 dark:text-neutral-300"
              aria-label={t("previous")}
            >
              <SkipBack className="size-6" />
            </button>
            <button
              onClick={onTogglePlay}
              className="flex size-12 items-center justify-center rounded-full bg-[var(--btn-regular-bg)] text-[var(--primary)] transition-all hover:bg-[var(--btn-regular-bg-hover)] active:scale-95 active:bg-[var(--btn-regular-bg-active)]"
              aria-label={isPlaying ? tWidgets("pause") : tWidgets("play")}
            >
              {isPlaying ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
            </button>
            <button
              onClick={onNext}
              className="rounded-lg p-2 text-neutral-600 transition-colors hover:text-[var(--primary)] active:scale-95 dark:text-neutral-300"
              aria-label={t("next")}
            >
              <SkipForward className="size-6" />
            </button>
            <button
              onClick={() => setShowPlaylist((prev) => !prev)}
              className={cn(
                "rounded-lg p-2 transition-colors active:scale-95",
                showPlaylist
                  ? "text-[var(--primary)]"
                  : "text-neutral-400 hover:text-[var(--primary)]",
              )}
              aria-label={t("playlist")}
              title={t("playlist")}
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
  );
}

function GlobalPlayer() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [visible, setVisible] = useState(true);

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
  } = useMusicPlayer();

  const {
    playlist,
    currentIndex,
    isPlaying,
    progress,
    duration,
    volume,
    isMuted,
    playMode,
    isLoaded,
  } = state;

  // 监听导航栏的显示/隐藏切换
  useEffect(() => {
    const handleToggle = () => setVisible((prev) => !prev);
    window.addEventListener("music-player-toggle", handleToggle);
    return () => window.removeEventListener("music-player-toggle", handleToggle);
  }, []);

  // 从 /api/music 拉取播放列表并喂入共享 store（先到先得）
  useEffect(() => {
    let mounted = true;
    fetch("/api/music")
      .then((res) => (res.ok ? res.json() : null))
      .then((tracks: MusicItem[] | null) => {
        // 先判 mounted 再写共享 store：原来 fetch 失败 / 返回非 2xx（例如
        // 500 的 JSON 错误体）时，finally 分支会把 store 重置成空列表，
        // 而成功分支又可能在 unmount 之后才写入，晚到的网络结果会覆盖掉
        // 更新的状态。两个分支都在 mounted 为 false 时直接放弃。
        if (!mounted) return;
        loadPlaylist(Array.isArray(tracks) ? tracks : []);
      })
      .catch(() => {
        if (!mounted) return;
        loadPlaylist([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  if (!isLoaded) return null;

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
  );
}

export { GlobalPlayer };
export default GlobalPlayer;
