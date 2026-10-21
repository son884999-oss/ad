// Fast MP4 for the motion video (2026-10-22): the frames are drawn by time (drawMotionFrame is deterministic), so
// instead of recording 10 s in real time with MediaRecorder they are fed to a WebCodecs VideoEncoder (H.264) as fast
// as the device can encode, the same mix is rendered offline (videoSound.renderVideoSoundOffline) and encoded to AAC,
// and mp4-muxer (MIT) writes a plain, non-fragmented MP4 with the index up front (works in KakaoTalk, no flatten step).
// Everything here is all-or-nothing: if the browser cannot do H.264 + AAC, fastVideoPlan() says so and the caller
// keeps the MediaRecorder path; a throw in encodeFastVideo() also means "use the old path" (unless cancelled).

import { ArrayBufferTarget, Muxer } from "mp4-muxer"
import { renderVideoSoundOffline } from "./videoSound"

export const FAST_WIDTH = 1080
export const FAST_HEIGHT = 1920
export const FAST_FPS = 30
const SAMPLE_RATE = 48000

type VideoKind = "avc" | "vp9"
type AudioKind = "aac" | "opus"

export type FastVideoPlan = {
  video: VideoEncoderConfig
  audio: AudioEncoderConfig
  videoKind: VideoKind
  audioKind: AudioKind
}

const VIDEO_CANDIDATES: { codec: string; kind: VideoKind }[] = [
  { codec: "avc1.640028", kind: "avc" }, // High 4.0: the level that fits 1080x1920 at 30 fps
  { codec: "avc1.4D0028", kind: "avc" }, // Main 4.0
  { codec: "avc1.42E028", kind: "avc" }, // Baseline 4.0
]
// Only for testing the pipeline in browsers without H.264 (headless Chromium); never used by the app.
const TEST_VIDEO_CANDIDATES: { codec: string; kind: VideoKind }[] = [{ codec: "vp09.00.40.08", kind: "vp9" }]

/**
 * The encoder settings this browser can really do (checked with isConfigSupported), or null when the fast path is
 * unavailable. H.264 and AAC are both required: no silent video, no WebM. `allowTestCodecs` is for tests only.
 */
export async function fastVideoPlan(allowTestCodecs = false): Promise<FastVideoPlan | null> {
  try {
    if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined" || typeof VideoFrame === "undefined" || typeof AudioData === "undefined" || typeof OfflineAudioContext === "undefined") return null
    let video: { config: VideoEncoderConfig; kind: VideoKind } | null = null
    for (const { codec, kind } of allowTestCodecs ? [...VIDEO_CANDIDATES, ...TEST_VIDEO_CANDIDATES] : VIDEO_CANDIDATES) {
      const config: VideoEncoderConfig = { codec, width: FAST_WIDTH, height: FAST_HEIGHT, framerate: FAST_FPS, bitrate: 6_000_000, ...(kind === "avc" ? { avc: { format: "avc" as const } } : {}) }
      if ((await VideoEncoder.isConfigSupported(config)).supported) {
        video = { config, kind }
        break
      }
    }
    if (!video) return null
    let audio: { config: AudioEncoderConfig; kind: AudioKind } | null = null
    const audioCandidates: { codec: string; kind: AudioKind }[] = [{ codec: "mp4a.40.2", kind: "aac" }, ...(allowTestCodecs ? [{ codec: "opus", kind: "opus" as const }] : [])]
    for (const { codec, kind } of audioCandidates) {
      const config: AudioEncoderConfig = { codec, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 128_000 }
      if ((await AudioEncoder.isConfigSupported(config)).supported) {
        audio = { config, kind }
        break
      }
    }
    if (!audio) return null
    return { video: video.config, audio: audio.config, videoKind: video.kind, audioKind: audio.kind }
  } catch {
    return null
  }
}

type AudioPart = { chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }

async function encodeAudio(config: AudioEncoderConfig, buffer: AudioBuffer, isCancelled: () => boolean) {
  const parts: AudioPart[] = []
  let failure: unknown = null
  const encoder = new AudioEncoder({
    output: (chunk, meta) => parts.push({ chunk, meta }),
    error: (error) => {
      failure = error
    },
  })
  try {
    encoder.configure(config)
    const channels = [buffer.getChannelData(0), buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0)]
    const step = 4800
    for (let at = 0; at < buffer.length; at += step) {
      if (failure) throw failure
      if (isCancelled()) return null
      const frames = Math.min(step, buffer.length - at)
      const data = new Float32Array(frames * 2)
      data.set(channels[0].subarray(at, at + frames), 0)
      data.set(channels[1].subarray(at, at + frames), frames)
      const audioData = new AudioData({ format: "f32-planar", sampleRate: buffer.sampleRate, numberOfFrames: frames, numberOfChannels: 2, timestamp: Math.round((at / buffer.sampleRate) * 1e6), data })
      encoder.encode(audioData)
      audioData.close()
    }
    await encoder.flush()
    if (failure) throw failure
    return parts
  } finally {
    if (encoder.state !== "closed") encoder.close()
  }
}

/**
 * Draws and encodes the whole video. Resolves with the MP4 file, or null when `isCancelled()` turned true.
 * Throws on any failure; the caller then falls back to the MediaRecorder path.
 */
export async function encodeFastVideo({ plan, canvas, draw, seconds, musicUrl, cues, fileName, isCancelled, onProgress }: {
  plan: FastVideoPlan
  canvas: HTMLCanvasElement
  draw: (context: CanvasRenderingContext2D, seconds: number) => void
  seconds: number
  musicUrl: string
  cues: number[]
  fileName: string
  isCancelled: () => boolean
  onProgress?: (done: number) => void
}): Promise<File | null> {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("canvas-unavailable")
  canvas.width = FAST_WIDTH
  canvas.height = FAST_HEIGHT

  // Sound first: it renders in well under a second, and a failure here must come before any video work.
  const rendered = await renderVideoSoundOffline({ musicUrl, seconds, cues, sampleRate: SAMPLE_RATE })
  if (isCancelled()) return null
  const audioParts = await encodeAudio(plan.audio, rendered, isCancelled)
  if (!audioParts || audioParts.length === 0) {
    if (isCancelled()) return null
    throw new Error("audio-empty")
  }

  const target = new ArrayBufferTarget()
  // fastStart "in-memory": one plain MP4 with the moov index before the media data (no fragments).
  const muxer = new Muxer({
    target,
    video: { codec: plan.videoKind, width: FAST_WIDTH, height: FAST_HEIGHT, frameRate: FAST_FPS },
    audio: { codec: plan.audioKind, numberOfChannels: 2, sampleRate: SAMPLE_RATE },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  })
  // Audio chunks go in just ahead of the video chunk with the same time, so the two tracks interleave in the file.
  let nextAudio = 0
  const flushAudio = (untilMicros: number) => {
    while (nextAudio < audioParts.length && audioParts[nextAudio].chunk.timestamp <= untilMicros) {
      muxer.addAudioChunk(audioParts[nextAudio].chunk, audioParts[nextAudio].meta)
      nextAudio++
    }
  }

  let failure: unknown = null
  // A wait for the queue to drain also ends when the encoder fails (it would never fire "dequeue" again).
  let wake: (() => void) | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        flushAudio(chunk.timestamp)
        muxer.addVideoChunk(chunk, meta)
      } catch (error) {
        failure = error
        wake?.()
      }
    },
    error: (error) => {
      failure = error
      wake?.()
    },
  })
  try {
    encoder.configure(plan.video)
    const total = Math.round(seconds * FAST_FPS)
    const frameMicros = 1e6 / FAST_FPS
    for (let index = 0; index < total; index++) {
      if (failure) throw failure
      if (isCancelled()) return null
      draw(context, index / FAST_FPS)
      const frame = new VideoFrame(canvas, { timestamp: Math.round(index * frameMicros), duration: Math.round(frameMicros) })
      encoder.encode(frame, { keyFrame: index % FAST_FPS === 0 })
      frame.close()
      onProgress?.((index + 1) / total)
      // Keep the encoder queue short (memory) and give the page a turn so a cancel tap is seen.
      if (encoder.encodeQueueSize > 4) {
        await new Promise<void>((resolve) => {
          const done = () => { wake = null; window.clearTimeout(timer); resolve() }
          const timer = window.setTimeout(done, 3000) // never wait forever
          wake = done
          encoder.addEventListener("dequeue", done, { once: true })
        })
      }
      else if (index % 10 === 9) await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    await encoder.flush()
    if (failure) throw failure
    if (isCancelled()) return null
    flushAudio(Infinity)
    muxer.finalize()
    if (target.buffer.byteLength === 0) throw new Error("empty-video")
    return new File([target.buffer], fileName, { type: "video/mp4" })
  } finally {
    if (encoder.state !== "closed") encoder.close()
  }
}
