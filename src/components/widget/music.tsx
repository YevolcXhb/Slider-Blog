"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Music2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Repeat,
  Repeat1,
  Shuffle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";
import { WidgetLayout } from "./widget-layout";
import { loadPlaylist, useMusicPlayer } from "@/lib/music-player-store";
import type { MusicItem } from "@/server/queries/site";
import type { WidgetComponentConfig } from "@/types/sidebarConfig";

interface MusicWidgetProps {
  musicList?: MusicItem[];
  widgetConfig?: WidgetComponentConfig;
  className?: string;
  style?: React.CSSProperties;
}

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
}: {
  cover: string | null;
  title: string;
  isPlaying: boolean;
}) {
  return (
    <div className="relative size-14 shrink-0">
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[var(--primary)]/10 shadow-lg dark:border-neutral-700",
          isPlaying && "animate-spin-slow",
        )}
        style={{ animationPlayState: isPlaying ? "running" : "paused" }}
      >
        <Music2 className="absolute size-6 text-[var(--primary)] opacity-40" />
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            sizes="56px"
            unoptimized
            className="relative z-10 object-cover"
          />
        ) : (
          <div className="to-frost-200/80 dark:to-frost-500/30 relative z-10 flex size-full items-center justify-center bg-gradient-to-br from-pink-200/80 via-rose-100/80 dark:from-pink-500/30 dark:via-rose-500/20">
            <Music2 className="size-6 text-pink-400/60 dark:text-pink-400/40" />
          </div>
        )}
      </div>
    </div>
  );
}

function useDragSlider(
  onCommit: (fraction: number) => void,
  onPreview?: (fraction: number) => void,
) {
  // 通用拖拽 hook：pointerdown 启动，move 期间持续回调，up 时提交
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const fractionFromEvent = (clientX: number): number | null => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const raw = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, raw));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    isDraggingRef.current = true;
    const f = fractionFromEvent(e.clientX);
    if (f === null) return;
    onPreview?.(f);
    onCommit(f);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const f = fractionFromEvent(e.clientX);
    if (f === null) return;
    onPreview?.(f);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const f = fractionFromEvent(e.clientX);
    if (f !== null) onCommit(f);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return {
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
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
  // 进度直接来自 store（拖拽时 store 的 progress 由 seekPreview 实时更新）
  const t = useTranslations("Player");
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const handleCommit = (fraction: number) => {
    onSeekEnd(fraction * duration);
  };
  const handlePreview = (fraction: number) => {
    onSeekPreview(fraction * duration);
  };

  const { containerRef, handlePointerDown, handlePointerMove, handlePointerUp } = useDragSlider(
    handleCommit,
    handlePreview,
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onSeekStart();
    handlePointerDown(e);
  };

  return (
    <div className="px-1">
      <div
        ref={containerRef}
        className="group relative h-1 w-full cursor-pointer touch-none rounded-full bg-neutral-300/60 dark:bg-neutral-500/40"
        onPointerDown={onPointerDown}
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
          className="absolute top-0 left-0 h-full rounded-full bg-[var(--primary)] transition-[width] duration-100"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-[var(--primary)] shadow-sm ring-2 ring-white dark:ring-neutral-800"
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
  // 音量直接来自 store，拖拽时实时调用 onVolumeChange 更新 store
  const displayVolume = isMuted ? 0 : volume;

  const handleCommit = (fraction: number) => {
    onVolumeChange(fraction);
  };
  const handlePreview = (fraction: number) => {
    onVolumeChange(fraction);
  };

  const { containerRef, handlePointerDown, handlePointerMove, handlePointerUp } = useDragSlider(
    handleCommit,
    handlePreview,
  );

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
        className="relative h-1 w-16 cursor-pointer touch-none rounded-full bg-neutral-300/50 dark:bg-neutral-500/40"
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
          className="absolute top-0 left-0 h-full rounded-full bg-[var(--primary)] transition-[width] duration-75"
          style={{ width: `${displayVolume * 100}%` }}
        />
      </div>
    </div>
  );
}

function MusicWidget({ musicList, widgetConfig, className, style }: MusicWidgetProps) {
  const t = useTranslations("Widgets");
  const tPlayer = useTranslations("Player");
  const showTitle = widgetConfig?.showTitle !== false;

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

  const [showPlaylist, setShowPlaylist] = useState(false);

  // 将播放列表喂入共享 store（先到先得，已加载则跳过）
  useEffect(() => {
    loadPlaylist(musicList ?? []);
  }, [musicList]);

  const { playlist, currentIndex, isPlaying, progress, duration, volume, isMuted, playMode } =
    state;
  const currentTrack = playlist[currentIndex];

  if (playlist.length === 0) {
    return (
      <WidgetLayout
        name={t("music")}
        showTitle={showTitle}
        id="music"
        className={className}
        style={style}
      >
        <p className="text-30 py-6 text-center text-sm">{t("musicNoSongs")}</p>
      </WidgetLayout>
    );
  }

  const ModeIcon = playMode === "shuffle" ? Shuffle : playMode === "repeat" ? Repeat1 : Repeat;
  const modeTitle =
    playMode === "sequence"
      ? tPlayer("sequence")
      : playMode === "repeat"
        ? tPlayer("repeat")
        : tPlayer("shuffle");

  return (
    <WidgetLayout
      name={t("music")}
      showTitle={showTitle}
      id="music"
      className={className}
      style={style}
    >
      <div className="flex flex-col gap-3">
        {/* Top Row: Cover & Info */}
        <div className="flex items-center gap-3 px-1">
          <CoverImage
            cover={currentTrack?.cover ?? null}
            title={currentTrack?.title ?? ""}
            isPlaying={isPlaying}
          />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 overflow-hidden">
              <div className="relative min-w-0 flex-1 overflow-hidden">
                <h3
                  className="truncate text-base leading-tight font-bold text-neutral-800 dark:text-neutral-100"
                  title={currentTrack?.title}
                >
                  {currentTrack?.title || t("musicEmpty")}
                </h3>
              </div>
            </div>
            <div className="min-w-0 overflow-hidden">
              <p
                className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400"
                title={currentTrack?.artist}
              >
                {currentTrack?.artist || "—"}
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
                  onToggleMute={toggleMute}
                  onVolumeChange={setVolume}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar
          progress={progress}
          duration={duration}
          onSeekStart={seekStart}
          onSeekPreview={seekPreview}
          onSeekEnd={seekEnd}
        />

        {/* Controls Row */}
        <div className="flex items-center justify-between px-1 select-none">
          <button
            onClick={cyclePlayMode}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:text-[var(--primary)] active:scale-95"
            title={modeTitle}
            aria-label={modeTitle}
          >
            <ModeIcon className="size-5" />
          </button>
          <button
            onClick={prevTrack}
            className="rounded-lg p-2 text-neutral-600 transition-colors hover:text-[var(--primary)] active:scale-95 dark:text-neutral-300"
            aria-label={t("previous")}
          >
            <SkipBack className="size-6" />
          </button>
          <button
            onClick={togglePlay}
            className="flex size-12 items-center justify-center rounded-full bg-[var(--btn-regular-bg)] text-[var(--primary)] transition-all hover:bg-[var(--btn-regular-bg-hover)] active:scale-95 active:bg-[var(--btn-regular-bg-active)]"
            aria-label={isPlaying ? t("pause") : t("play")}
          >
            {isPlaying ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
          </button>
          <button
            onClick={nextTrack}
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
        <AnimatePresence>
          {showPlaylist && (
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
                    className="custom-scrollbar relative max-h-48 overflow-y-auto pr-1 pb-1"
                    role="listbox"
                    aria-label={t("playlist")}
                  >
                    {playlist.map((track, index) => (
                      <button
                        key={track.id}
                        onClick={() => playTrack(index)}
                        className={cn(
                          "group flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-white/5",
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
                              <Music2 className="size-3 text-neutral-400" />
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
                                  style={{
                                    animationDuration: "0.6s",
                                    animationDelay: "0.15s",
                                  }}
                                />
                                <span
                                  className="animate-eq-bar w-[3px] rounded-sm bg-[var(--primary)]"
                                  style={{
                                    animationDuration: "1s",
                                    animationDelay: "0.3s",
                                  }}
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
                          <div className="truncate text-[10px] text-neutral-400">
                            {track.artist}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </WidgetLayout>
  );
}

export { MusicWidget, type MusicWidgetProps };
export default MusicWidget;
