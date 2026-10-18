// Puts the poster-style caption (src/videoCaption.ts) on the real AI clip, in the browser: each frame of the
// clip is drawn on a 1080 × 1920 canvas with the caption on top and recorded again (MediaRecorder). No server,
// no extra cost. The AI photo carries no text (the model garbles text), so text only ever arrives this way.
// Returns null when the browser cannot record; the caller then uses the clip as it is.
//
// 고급형 ("elegant") gets a commercial finish on top (owner's goal 2026-10-18: show off the technology and make the
// ad work): a light grade and vignette, an opening that pulls focus from a soft flash, three shots cut from the
// clip (wide, close-up on the detail, hero), an end hold of 1.6 s on
// the last frame with a slow push while the invitation fills in, and synthesized sound (a whoosh into the
// opening, a warm pad under the shot, a chime with the invitation). No music licence is needed.

import { drawElegantCaption, drawVideoCaption, loadCaptionFonts, type VideoCaption } from "./videoCaption"

// With sound (H.264 + AAC first, as in the 기본형 recorder), then video only.
const MIME_WITH_AUDIO = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"]
const MIME_CANDIDATES = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"]

/** Seconds the 고급형 film holds its last frame for the invitation. */
export const END_HOLD_SECONDS = 1.6
/** Share of the AI clip the 고급형 film uses before the hold. */
const CLIP_USED = 0.88
const INTRO_SECONDS = 0.7

// The edit: the real clip is cut into three shots — wide, a close-up on the top detail, wide again for the hero
// frame. The close-up is a crop of the real pixels, so it adds a camera angle without the model ever inventing
// one (three paid runs showed Kling invents the product when asked to move around it).
const CLOSE_UP = { from: 0.44, to: 0.72, scale: 1.5, anchor: 0.34 }
const CUT_BLUR_SECONDS = 0.14

/** The grade, opening, cuts and end-hold push for one 고급형 frame (exported for the checks). */
export function finishFor(seconds: number, clipSeconds: number) {
  const intro = Math.max(0, 1 - seconds / INTRO_SECONDS)
  const hold = Math.min(Math.max((seconds - clipSeconds) / END_HOLD_SECONDS, 0), 1)
  const closeFrom = clipSeconds * CLOSE_UP.from
  const closeTo = clipSeconds * CLOSE_UP.to
  const closeUp = clipSeconds >= 4 && seconds >= closeFrom && seconds < closeTo
  // A short motion blur and a faint flash on each cut.
  const fromCut = Math.min(...[closeFrom, closeTo].map((cut) => Math.abs(seconds - cut)))
  const cut = clipSeconds >= 4 && seconds > INTRO_SECONDS ? Math.max(0, 1 - fromCut / CUT_BLUR_SECONDS) : 0
  // Inside the close-up the crop keeps drifting in, so the shot is alive.
  const drift = closeUp ? (seconds - closeFrom) / (closeTo - closeFrom) : 0
  return {
    // Soft focus pulling sharp, with a warm flash that fades (the "reveal").
    blur: Math.round((intro * intro * 14 + cut * 6) * 10) / 10,
    flash: intro * 0.38 + cut * 0.12,
    // The close-up, then a slow eased push on the frozen last frame.
    scale: closeUp ? CLOSE_UP.scale + 0.08 * drift : 1 + 0.045 * (1 - (1 - hold) * (1 - hold)),
    // Where the zoom is anchored (0 top … 1 bottom): the product's upper middle for the close-up.
    anchor: closeUp ? CLOSE_UP.anchor : 0.5,
  }
}

/** Synthesized sound for the 고급형 film, mixed into `stream`. Returns the context to close, or null. */
function addSound(stream: MediaStream, seconds: number, ctaAt: number) {
  try {
    const audio = new AudioContext()
    const destination = audio.createMediaStreamDestination()
    const master = audio.createGain()
    master.gain.value = 0.9
    master.connect(destination)
    const now = audio.currentTime + 0.05
    // A whoosh into the reveal: band-passed noise sweeping up.
    const length = 0.8
    const buffer = audio.createBuffer(1, Math.round(audio.sampleRate * length), audio.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1
    const noise = audio.createBufferSource()
    noise.buffer = buffer
    const band = audio.createBiquadFilter()
    band.type = "bandpass"
    band.Q.value = 1.1
    band.frequency.setValueAtTime(260, now)
    band.frequency.exponentialRampToValueAtTime(3200, now + length)
    const swell = audio.createGain()
    swell.gain.setValueAtTime(0.0001, now)
    swell.gain.exponentialRampToValueAtTime(0.16, now + length * 0.55)
    swell.gain.exponentialRampToValueAtTime(0.0001, now + length)
    noise.connect(band).connect(swell).connect(master)
    noise.start(now)
    noise.stop(now + length + 0.05)
    // A warm pad under the shot (A major add9, low and soft), fading in and out.
    const pad = audio.createGain()
    pad.gain.setValueAtTime(0.0001, now)
    pad.gain.exponentialRampToValueAtTime(0.05, now + 1.2)
    pad.gain.setValueAtTime(0.05, now + seconds - 1.2)
    pad.gain.exponentialRampToValueAtTime(0.0001, now + seconds)
    const warm = audio.createBiquadFilter()
    warm.type = "lowpass"
    warm.frequency.value = 1400
    pad.connect(warm).connect(master)
    for (const frequency of [110, 164.81, 220, 277.18, 493.88]) {
      const oscillator = audio.createOscillator()
      oscillator.type = "triangle"
      oscillator.frequency.value = frequency
      oscillator.detune.value = (Math.random() - 0.5) * 8
      oscillator.connect(pad)
      oscillator.start(now)
      oscillator.stop(now + seconds + 0.1)
    }
    // A bright two-note chime as the invitation appears, and again as it fills on the end hold.
    const chime = (at: number, frequencies: number[], level: number) => {
      for (const [index, frequency] of frequencies.entries()) {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        const startAt = now + at + index * 0.08
        oscillator.type = "sine"
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.exponentialRampToValueAtTime(level, startAt + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.1)
        oscillator.connect(gain).connect(master)
        oscillator.start(startAt)
        oscillator.stop(startAt + 1.2)
      }
    }
    chime(ctaAt, [880, 1318.51], 0.08)
    chime(seconds - END_HOLD_SECONDS + 0.1, [659.25, 987.77, 1318.51], 0.09)
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track))
    return audio
  } catch {
    return null
  }
}

/** style: "bold" = the poster-style caption; "elegant" = the 고급형 caption with the commercial finish. */
export async function captionVideo(clip: Blob, caption: VideoCaption, accent?: string, name = "홍보잇다_AI영상", style: "bold" | "elegant" = "bold"): Promise<File | null> {
  if (typeof MediaRecorder === "undefined") return null
  const elegant = style === "elegant"
  const withSound = elegant && typeof AudioContext === "function"
  const mimeType = (withSound ? [...MIME_WITH_AUDIO, ...MIME_CANDIDATES] : MIME_CANDIDATES).find((candidate) => MediaRecorder.isTypeSupported(candidate))
  if (!mimeType) return null
  const source = URL.createObjectURL(clip)
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.src = source
  let audio: AudioContext | null = null
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error("video-load"))
    })
    if (elegant) await loadCaptionFonts([caption.headline, caption.subline ?? "", caption.price ?? "", caption.cta ?? "", caption.eyebrow ?? ""])
    const canvas = document.createElement("canvas")
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext("2d")
    if (!ctx || !("captureStream" in canvas)) return null
    // 고급형 leaves the clip at 88 %: Kling's last half second is where stray things drift in (a light stand in a
    // real run), and that frame would be frozen for the whole end hold.
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5
    const clipSeconds = elegant ? duration * CLIP_USED : duration
    const vignette = ctx.createRadialGradient(540, 820, 520, 540, 960, 1250)
    vignette.addColorStop(0, "rgba(0,0,0,0)")
    vignette.addColorStop(1, "rgba(0,0,0,.34)")
    const drawClip = (scale = 1, anchor = 0.5) => {
      // The clip is 9:16 already (src/videoFrame.ts); cover keeps any other shape full-frame too.
      const cover = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight) * scale
      const width = video.videoWidth * cover
      const height = video.videoHeight * cover
      ctx.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) * anchor, width, height)
    }
    const draw = (seconds: number) => {
      if (!elegant) {
        drawClip()
        drawVideoCaption(ctx, seconds, caption, accent)
        return
      }
      const finish = finishFor(seconds, clipSeconds)
      ctx.save()
      ctx.filter = `contrast(1.06) saturate(1.1) brightness(1.02)${finish.blur ? ` blur(${finish.blur}px)` : ""}`
      drawClip(finish.scale, finish.anchor)
      ctx.restore()
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (finish.flash > 0.01) {
        ctx.fillStyle = `rgba(255,238,214,${finish.flash.toFixed(3)})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      drawElegantCaption(ctx, seconds, caption, clipSeconds)
    }
    draw(0)
    const stream = canvas.captureStream(30)
    const total = clipSeconds + (elegant ? END_HOLD_SECONDS : 0)
    if (withSound && mimeType.includes(",")) audio = addSound(stream, total, 2.0)
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }))
      recorder.onerror = () => reject(new Error("record-failed"))
    })
    let frame = 0
    let endedAt = 0
    const loop = () => {
      if (!endedAt && elegant && video.currentTime >= clipSeconds) {
        video.pause()
        endedAt = performance.now()
      }
      if (!endedAt) {
        draw(video.currentTime)
        frame = requestAnimationFrame(loop)
        return
      }
      // The end hold: the last frame stays while the time runs on for the push and the invitation.
      const held = (performance.now() - endedAt) / 1000
      draw(clipSeconds + held)
      if (held < END_HOLD_SECONDS) frame = requestAnimationFrame(loop)
      else recorder.stop()
    }
    video.onended = () => {
      if (elegant) {
        endedAt = performance.now()
        return
      }
      cancelAnimationFrame(frame)
      draw(video.currentTime)
      recorder.stop()
    }
    recorder.start(250)
    await video.play()
    frame = requestAnimationFrame(loop)
    const blob = await done
    stream.getTracks().forEach((track) => track.stop())
    if (!blob.size) return null
    const extension = blob.type.startsWith("video/mp4") ? "mp4" : "webm"
    return new File([blob], `${name}.${extension}`, { type: blob.type })
  } catch {
    return null
  } finally {
    void audio?.close().catch(() => undefined)
    URL.revokeObjectURL(source)
  }
}
