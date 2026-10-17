// Puts the poster-style caption (src/videoCaption.ts) on the real AI clip, in the browser: each frame of the
// clip is drawn on a 1080 × 1920 canvas with the caption on top and recorded again (MediaRecorder). No server,
// no extra cost. The AI photo carries no text (the model garbles text), so text only ever arrives this way.
// Returns null when the browser cannot record; the caller then uses the clip as it is.

import { drawElegantCaption, drawVideoCaption, type VideoCaption } from "./videoCaption"

const MIME_CANDIDATES = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"]

/** style: "bold" = the poster-style caption; "elegant" = the quiet 고급형 caption (drawElegantCaption). */
export async function captionVideo(clip: Blob, caption: VideoCaption, accent?: string, name = "홍보잇다_AI영상", style: "bold" | "elegant" = "bold"): Promise<File | null> {
  if (typeof MediaRecorder === "undefined") return null
  const mimeType = MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate))
  if (!mimeType) return null
  const source = URL.createObjectURL(clip)
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.src = source
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error("video-load"))
    })
    const canvas = document.createElement("canvas")
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext("2d")
    if (!ctx || !("captureStream" in canvas)) return null
    const draw = () => {
      // The clip is 9:16 already (src/videoFrame.ts); cover keeps any other shape full-frame too.
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight)
      const width = video.videoWidth * scale
      const height = video.videoHeight * scale
      ctx.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
      if (style === "elegant") drawElegantCaption(ctx, video.currentTime, caption)
      else drawVideoCaption(ctx, video.currentTime, caption, accent)
    }
    draw()
    const stream = canvas.captureStream(30)
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
    const loop = () => {
      draw()
      if (!video.ended) frame = requestAnimationFrame(loop)
    }
    video.onended = () => {
      cancelAnimationFrame(frame)
      draw()
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
    URL.revokeObjectURL(source)
  }
}
