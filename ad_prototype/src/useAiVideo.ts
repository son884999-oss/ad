// State + polling for the real (Higgsfield) video of the current creation. Lives in App so it keeps
// working while the user moves between tabs, and so a finished video can be written into the saved
// record (내 홍보물). Never starts a paid job by itself: only start() and retry() do, once per call.
import { useCallback, useEffect, useRef, useState } from "react"
import {
  cancelAiVideo,
  fetchAiVideoStatus,
  isVideoUnavailable,
  newVideoJobId,
  startAiVideo,
  videoSignature,
  type AiVideoDetails,
} from "./video"

export type AiVideoPhase = "off" | "idle" | "starting" | "generating" | "completed" | "failed" | "timeout"

export type AiVideoState = {
  phase: AiVideoPhase
  jobId: string
  signature: string
  requestId?: string
  videoUrl?: string
  error?: string
  startedAt: number
  /** The finished video could not be loaded (provider URLs expire); the sample is shown instead. */
  broken?: boolean
}

/** What a saved record keeps, enough to reopen or resume the video later. */
export type SavedAiVideo = { jobId: string; signature: string; requestId?: string; videoUrl?: string }

export type AiVideoInput = { imageUrl: string; details: AiVideoDetails }

const POLL_MS = 5_000
const MAX_POLL_MS = 20_000
const DEADLINE_MS = 10 * 60_000

/**
 * The idempotency key to send again after a failure of the same photo + details. Re-sending it is always safe:
 * if the first request never reached the provider the key is new to it, and if it did (network error, a
 * response we could not read, a timeout) the provider returns that job instead of charging again. Only when
 * the provider rejected the key itself (same key, different request) is a new one needed.
 */
const keyToReuse = (current: AiVideoState, signature: string) =>
  current.phase === "failed" && current.jobId && current.signature === signature && current.error !== "VIDEO_INVALID_REQUEST" ? current.jobId : undefined

const idleState = (): AiVideoState => ({ phase: isVideoUnavailable() ? "off" : "idle", jobId: "", signature: "", startedAt: 0 })

/**
 * @param onJobUpdate a job learned its request id or URL (update the saved record)
 * @param isSaved whether a job belongs to a saved record: such a job is never refunded when a new one replaces it
 */
export function useAiVideo(onJobUpdate?: (jobId: string, saved: SavedAiVideo) => void, isSaved?: (jobId: string) => boolean) {
  const [state, setState] = useState<AiVideoState>(idleState)
  const stateRef = useRef(state)
  stateRef.current = state
  const updateRef = useRef(onJobUpdate)
  updateRef.current = onJobUpdate
  const isSavedRef = useRef(isSaved)
  isSavedRef.current = isSaved
  // Bumped whenever the current job changes; any async answer for an older generation is ignored.
  const generationRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const inputRef = useRef<AiVideoInput | null>(null)
  const cancelledJobsRef = useRef(new Set<string>())

  const stopPolling = useCallback(() => {
    generationRef.current += 1
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  const set = (generation: number, patch: Partial<AiVideoState>) => {
    if (generation !== generationRef.current) return
    setState((current) => ({ ...current, ...patch }))
  }

  const poll = useCallback((generation: number, requestId: string, startedAt: number, delay = POLL_MS) => {
    if (generation !== generationRef.current) return
    timerRef.current = window.setTimeout(async () => {
      timerRef.current = null
      if (generation !== generationRef.current) return
      if (Date.now() - startedAt > DEADLINE_MS) {
        set(generation, { phase: "timeout" })
        return
      }
      const controller = new AbortController()
      controllerRef.current = controller
      const result = await fetchAiVideoStatus(requestId, controller.signal)
      if (generation !== generationRef.current) return
      controllerRef.current = null
      const { jobId, signature } = stateRef.current
      if (!result) {
        poll(generation, requestId, startedAt, Math.min(MAX_POLL_MS, Math.round(delay * 1.5)))
      } else if (result.status === "completed") {
        set(generation, { phase: "completed", videoUrl: result.videoUrl, broken: false })
        updateRef.current?.(jobId, { jobId, signature, requestId, videoUrl: result.videoUrl })
      } else if (result.status === "failed") {
        set(generation, { phase: "failed", error: result.error })
      } else {
        set(generation, { phase: "generating" })
        poll(generation, requestId, startedAt, POLL_MS)
      }
    }, delay)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Refund the job that is still starting/generating; used before it is replaced or abandoned. */
  const dropRunningJob = useCallback(() => {
    const current = stateRef.current
    if (current.jobId && current.phase === "starting") cancelledJobsRef.current.add(current.jobId)
    if (current.requestId && (current.phase === "starting" || current.phase === "generating")) cancelAiVideo(current.requestId)
  }, [])

  const begin = useCallback((input: AiVideoInput, signature: string, reuseJobId?: string) => {
    // A new paid job replaces the running one (e.g. the details were edited): cancel the old one first, unless a
    // saved record (내 홍보물) holds it: that video keeps being made and is resumed when the record is reopened.
    if (!isSavedRef.current?.(stateRef.current.jobId)) dropRunningJob()
    stopPolling()
    const generation = generationRef.current
    const jobId = reuseJobId ?? newVideoJobId()
    const startedAt = Date.now()
    inputRef.current = input
    setState({ phase: "starting", jobId, signature, startedAt })
    void startAiVideo(input.imageUrl, input.details, { idempotencyKey: jobId }).then((result) => {
      if (result.kind === "started") {
        // Even for an older generation: tell the record, or refund it if the user cancelled it.
        if (cancelledJobsRef.current.has(jobId)) {
          cancelAiVideo(result.requestId)
          return
        }
        updateRef.current?.(jobId, { jobId, signature, requestId: result.requestId })
      }
      if (generation !== generationRef.current) return
      if (result.kind === "off") setState({ ...idleState(), phase: "off" })
      else if (result.kind === "error") set(generation, { phase: "failed", error: result.code })
      else {
        set(generation, { phase: "generating", requestId: result.requestId })
        poll(generation, result.requestId, startedAt, POLL_MS)
      }
    })
  }, [dropRunningJob, poll, stopPolling])

  /** Starts the video for this creation, unless the same photo + details already has one. */
  const start = useCallback((input: AiVideoInput) => {
    if (isVideoUnavailable()) return
    const signature = videoSignature(input.imageUrl, input.details)
    const current = stateRef.current
    if (current.signature === signature && ["starting", "generating", "completed", "timeout"].includes(current.phase)) {
      if (current.phase === "timeout" && current.requestId) resume()
      return
    }
    begin(input, signature, keyToReuse(current, signature))
  }, [begin]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Manual 다시 만들기 after a failure: the same photo + details send the same idempotency key again
   * (see keyToReuse), so a job the provider already started is returned instead of charged twice.
   */
  const retry = useCallback(() => {
    const input = inputRef.current
    if (!input || isVideoUnavailable()) return
    const signature = videoSignature(input.imageUrl, input.details)
    begin(input, signature, keyToReuse(stateRef.current, signature))
  }, [begin])

  /** After the 10-minute window: check the same job again (free, no new request). */
  const resume = useCallback(() => {
    const { requestId } = stateRef.current
    if (!requestId) return
    stopPolling()
    const generation = generationRef.current
    const startedAt = Date.now()
    setState((current) => ({ ...current, phase: "generating", startedAt }))
    poll(generation, requestId, startedAt, 0)
  }, [poll, stopPolling])

  /** The user cancelled while making: stop and refund the job if it has not started yet. */
  const cancel = useCallback(() => {
    stopPolling()
    dropRunningJob()
    inputRef.current = null
    setState(idleState())
  }, [dropRunningJob, stopPolling])

  /** New creation: stop watching. A job already saved in a record can be resumed from 내 홍보물. */
  const reset = useCallback(() => {
    stopPolling()
    inputRef.current = null
    setState(idleState())
  }, [stopPolling])

  /** Reopening a saved record. */
  const restore = useCallback((saved?: SavedAiVideo) => {
    stopPolling()
    inputRef.current = null
    if (!saved || isVideoUnavailable()) {
      setState(idleState())
      return
    }
    if (saved.videoUrl) {
      setState({ phase: "completed", jobId: saved.jobId, signature: saved.signature, requestId: saved.requestId, videoUrl: saved.videoUrl, startedAt: 0 })
      return
    }
    if (!saved.requestId) {
      setState(idleState())
      return
    }
    const generation = generationRef.current
    const startedAt = Date.now()
    setState({ phase: "generating", jobId: saved.jobId, signature: saved.signature, requestId: saved.requestId, startedAt })
    poll(generation, saved.requestId, startedAt, 0)
  }, [poll, stopPolling])

  const markBroken = useCallback(() => {
    setState((current) => (current.phase === "completed" ? { ...current, broken: true } : current))
  }, [])

  const saved = (): SavedAiVideo | undefined =>
    state.jobId && state.phase !== "off" && state.phase !== "idle" && state.phase !== "failed"
      ? { jobId: state.jobId, signature: state.signature, requestId: state.requestId, videoUrl: state.videoUrl }
      : undefined

  return { state, start, retry, resume, cancel, reset, restore, markBroken, saved }
}

export type AiVideoController = ReturnType<typeof useAiVideo>
