import { useEffect, useRef, useState } from "react"
import "./video-preview.css"

type VideoPreviewPlayerProps = {
  src: string
  poster: string
  playing: boolean
  label: string
  onPlayingChange: (playing: boolean) => void
}

/** A completed file can still take a moment to decode, especially on the first mobile preview. */
export default function VideoPreviewPlayer({ src, poster, playing, label, onPlayingChange }: VideoPreviewPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const [readySource, setReadySource] = useState("")
  const [failedSource, setFailedSource] = useState("")
  const frameReady = readySource === src
  const failed = failedSource === src
  const markReady = () => {
    setReadySource(src)
    setFailedSource("")
  }

  useEffect(() => {
    const video = ref.current
    if (!video) return
    let cancelled = false
    if (playing) {
      video.muted = false
      void video.play().catch(() => {
        if (cancelled) return
        video.muted = true
        return video.play()
      }).catch(() => {
        if (!cancelled) onPlayingChange(false)
      })
    } else {
      video.pause()
      video.muted = true
    }
    return () => { cancelled = true }
  }, [playing, src, onPlayingChange])

  const showPreviewFrame = (video: HTMLVideoElement) => {
    if (playing) return
    // The first title has finished entering at 3 s, before the cut at 3.5 s.
    // Short restored clips use a valid point inside their own duration instead.
    const target = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(3, Math.max(0, video.duration - 0.05))
      : 3
    if (Math.abs(video.currentTime - target) > 0.01) {
      try { video.currentTime = target } catch { /* Keep the product-photo cover until playback can start. */ }
    } else if (!video.seeking && video.readyState >= 2) {
      markReady()
    }
  }

  return (
    <>
      <video
        key={src}
        ref={ref}
        className="motion-preview-video"
        data-frame-ready={frameReady ? "true" : "false"}
        src={src}
        poster={poster || undefined}
        muted
        loop
        playsInline
        preload="auto"
        onLoadedMetadata={(event) => showPreviewFrame(event.currentTarget)}
        onLoadedData={(event) => showPreviewFrame(event.currentTarget)}
        onSeeked={(event) => {
          if (playing && event.currentTarget.readyState >= 2) markReady()
          else showPreviewFrame(event.currentTarget)
        }}
        onPlaying={markReady}
        onError={() => {
          setReadySource("")
          setFailedSource(src)
          onPlayingChange(false)
        }}
        aria-label={label}
      />
      {!frameReady && poster && (
        <div className="video-first-frame-cover" aria-hidden="true">
          <img src={poster} alt="" />
        </div>
      )}
      {failed && <p className="video-preview-error" role="alert">영상을 불러오지 못했어요. 다시 만들어 주세요.</p>}
    </>
  )
}
