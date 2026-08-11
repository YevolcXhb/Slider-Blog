"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"

interface BackgroundPlayerProps {
  playerUrl: string | string[]
  playerMode?: "order" | "random"
}

function BackgroundPlayer({ playerUrl, playerMode = "order" }: BackgroundPlayerProps) {
  const urls = useMemo(() => {
    const list = Array.isArray(playerUrl) ? playerUrl : [playerUrl]
    return list.filter(Boolean)
  }, [playerUrl])

  const isMultiple = urls.length > 1
  const videoRef = useRef<HTMLVideoElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const currentIndexRef = useRef(currentIndex)
  const isPlayingRef = useRef(isPlaying)
  const errorCountRef = useRef(0)
  const hasUserInteractedRef = useRef(false)
  const onEndedRef = useRef<() => void>(() => {})
  const onErrorRef = useRef<() => void>(() => {})
  const togglePlayRef = useRef<() => void>(() => {})

  const syncAttr = useCallback((playing: boolean) => {
    if (typeof document === "undefined") return
    if (playing) {
      document.documentElement.setAttribute("data-bg-video-playing", "")
      document.body.setAttribute("data-bg-video-playing", "")
    } else {
      document.documentElement.removeAttribute("data-bg-video-playing")
      document.body.removeAttribute("data-bg-video-playing")
    }
    window.dispatchEvent(
      new CustomEvent("bg-player-state-change", { detail: { playing } }),
    )
  }, [])

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    isPlayingRef.current = isPlaying
    syncAttr(isPlaying)
  }, [isPlaying, syncAttr])

  const pickIndex = useCallback((except: number) => {
    if (urls.length <= 1) return 0
    if (playerMode === "random") {
      let n: number
      do {
        n = Math.floor(Math.random() * urls.length)
      } while (n === except)
      return n
    }
    return (except + 1) % urls.length
  }, [urls.length, playerMode])

  const doPlay = useCallback(() => {
    const video = videoRef.current
    if (!video || urls.length === 0) return

    if (video.src !== urls[currentIndexRef.current]) {
      video.src = urls[currentIndexRef.current]
      video.load()
    }

    video.muted = false
    video
      .play()
      .then(() => {
        errorCountRef.current = 0
      })
      .catch(() => {
        isPlayingRef.current = false
        setIsPlaying(false)
        syncAttr(false)
      })
  }, [urls, syncAttr])

  const switchTrack = useCallback((index: number) => {
    if (index < 0 || index >= urls.length) return
    currentIndexRef.current = index
    setCurrentIndex(index)
    const video = videoRef.current
    if (!video) return
    if (isPlayingRef.current) {
      doPlay()
    } else {
      video.src = urls[index]
      video.load()
    }
  }, [urls, doPlay])

  const togglePlay = useCallback(() => {
    hasUserInteractedRef.current = true
    const nextPlaying = !isPlayingRef.current
    isPlayingRef.current = nextPlaying
    setIsPlaying(nextPlaying)

    const video = videoRef.current
    if (!video) return

    if (nextPlaying) {
      if (currentIndexRef.current >= urls.length) {
        currentIndexRef.current = 0
        setCurrentIndex(0)
      }
      syncAttr(true)
      doPlay()
    } else {
      video.pause()
      syncAttr(false)
    }
  }, [urls.length, doPlay, syncAttr])

  const onEnded = useCallback(() => {
    if (isMultiple) {
      const next = pickIndex(currentIndexRef.current)
      switchTrack(next)
      requestAnimationFrame(() => doPlay())
    } else {
      isPlayingRef.current = false
      setIsPlaying(false)
      syncAttr(false)
    }
  }, [isMultiple, pickIndex, switchTrack, doPlay, syncAttr])

  const onError = useCallback(() => {
    errorCountRef.current++
    const video = videoRef.current
    if (isMultiple && errorCountRef.current < urls.length) {
      const next = pickIndex(currentIndexRef.current)
      switchTrack(next)
      if (video) {
        video.src = urls[next]
        video.load()
      }
    } else {
      isPlayingRef.current = false
      setIsPlaying(false)
      syncAttr(false)
    }
  }, [isMultiple, urls, pickIndex, switchTrack, syncAttr])

  const onPlaying = useCallback(() => {
    errorCountRef.current = 0
  }, [])

  // Keep refs in sync with latest callbacks (must be after callback definitions)
  useEffect(() => { onEndedRef.current = onEnded }, [onEnded])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { togglePlayRef.current = togglePlay }, [togglePlay])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleToggle = () => togglePlayRef.current()
    const handleEnded = () => onEndedRef.current()
    const handleError = () => onErrorRef.current()
    const handlePlaying = () => onPlaying()

    window.addEventListener("bg-player-toggle", handleToggle)
    video.addEventListener("ended", handleEnded)
    video.addEventListener("error", handleError)
    video.addEventListener("playing", handlePlaying)

    return () => {
      window.removeEventListener("bg-player-toggle", handleToggle)
      video.removeEventListener("ended", handleEnded)
      video.removeEventListener("error", handleError)
      video.removeEventListener("playing", handlePlaying)
      video.pause()
      syncAttr(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (urls.length === 0) return null

  return (
    <div id="bg-player" className="pointer-events-none">
      <div
        id="bg-player-overlay"
        className={`absolute inset-0 z-[15] overflow-hidden transition-opacity duration-500 ease-in-out ${
          isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        <video
          id="bg-player-video"
          ref={videoRef}
          preload="none"
          playsInline
          className="size-full object-cover"
        />
      </div>

      {/* 背景视频不再显示任何控件：默认开启声音播放 */}
    </div>
  )
}

export { BackgroundPlayer }
export type { BackgroundPlayerProps }
