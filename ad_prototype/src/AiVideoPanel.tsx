// 영상 결과 탭의 진짜 영상 (Higgsfield) 부분: 만드는 중 상태 카드, 완성된 영상 플레이어, 실패 안내.
// When the video service is not configured (phase "off") nothing here renders, so the tab keeps
// showing the browser-made sample video exactly as before.
import { useEffect, useRef, useState } from "react"
import { uiText } from "./easyText"
import type { AiVideoState } from "./useAiVideo"
import { downloadAiVideo, shareAiVideo } from "./video"
import "./ai-video.css"

/** True when the real video should replace the sample preview. */
export const showsRealVideo = (state: AiVideoState) => state.phase === "completed" && !!state.videoUrl && !state.broken

function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

const FAILURE_TEXT: Record<string, string> = {
  VIDEO_BLOCKED: "사진이나 내용 때문에 진짜 영상을 만들 수 없었어요. 다른 사진으로 해 보세요.",
  VIDEO_BUSY: "지금은 영상 만들기가 붐벼요. 잠시 뒤 다시 만들어 주세요.",
  VIDEO_NO_CREDITS: "영상 만들기 이용권이 부족해요. 관리자에게 알려 주세요.",
  VIDEO_DAILY_LIMIT: "오늘 만들 수 있는 AI 영상을 다 만들었어요. 내일 다시 만들 수 있어요. 예시 영상은 그대로 쓸 수 있어요.",
}

export function AiVideoPlayer({
  state,
  easyMode,
  playing,
  onPlayingChange,
  onBroken,
}: {
  state: AiVideoState
  easyMode: boolean
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  onBroken: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (playing && video.paused) void video.play().catch(() => onPlayingChange(false))
    if (!playing && !video.paused) video.pause()
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <video
      ref={ref}
      className="ai-video-player"
      src={state.videoUrl}
      controls
      playsInline
      preload="metadata"
      aria-label={uiText("AI가 만든 홍보 영상", easyMode)}
      onPlay={() => onPlayingChange(true)}
      onPause={() => onPlayingChange(false)}
      onError={onBroken}
    />
  )
}

export type PremiumStepState = "waiting" | "working" | "done" | "skipped"

/**
 * 고급형 progress as named steps (포스터 배경 when a poster is made → 영상 속 세계 → 편집), the pattern AI generation products use for
 * long waits: the owner sees what is happening and that each part is real work, not a spinner.
 */
export function PremiumSteps({ scene, camera, edit, easyMode }: { scene: PremiumStepState | null; camera: PremiumStepState; edit: PremiumStepState; easyMode: boolean }) {
  const t = (text: string) => uiText(text, easyMode)
  const steps: [string, string, PremiumStepState][] = [
    // The scene is for the poster only (no poster chosen → no step); the film changes its own world.
    ...(scene ? [["AI가 포스터 배경을 만들어요", "약 1분", scene] as [string, string, PremiumStepState]] : []),
    ["AI가 영상 속 세계를 바꿔요", "1~3분", camera],
    ["자막·편집·소리를 입혀요", "약 10초", edit],
  ]
  const mark = { waiting: "", working: "진행 중", done: "완료", skipped: "원래 사진 사용" }
  return (
    <ol className="premium-steps" aria-label={t("고급형 만드는 과정")}>
      {steps.map(([label, time, state], index) => (
        <li key={label} className={`premium-steps__item is-${state}`} aria-current={state === "working" ? "step" : undefined}>
          <span className="premium-steps__dot" aria-hidden="true">{state === "done" ? "✓" : index + 1}</span>
          <span className="premium-steps__label">{t(label)}</span>
          <span className="premium-steps__meta">{state === "waiting" ? t(time) : t(mark[state])}</span>
        </li>
      ))}
    </ol>
  )
}

export function AiVideoStatus({
  state,
  easyMode,
  onRetry,
  onResume,
}: {
  state: AiVideoState
  easyMode: boolean
  onRetry: () => void
  onResume: () => void
}) {
  const t = (text: string) => uiText(text, easyMode)
  const working = state.phase === "starting" || state.phase === "generating"
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!working) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [working])

  if (working) {
    return (
      <div className="ai-video-status" role="status" aria-live="polite">
        <p className="ai-video-status__title">{t("진짜 영상을 만들고 있어요 · 1~3분 걸려요")}</p>
        <div className="ai-video-progress" aria-hidden="true"><span /></div>
        <p className="ai-video-status__meta">
          <span>{t("지금 보이는 것은 예시 영상이에요. 다른 결과는 바로 쓸 수 있어요.")}</span>
          <span className="ai-video-status__elapsed">
            {formatElapsed(now - state.startedAt)}
          </span>
        </p>
      </div>
    )
  }
  if (state.phase === "completed") {
    return (
      <p className={`ai-video-note${state.broken ? " is-warning" : ""}`} role="status">
        {state.broken
          ? t("진짜 영상을 더 이상 불러올 수 없어서 예시 영상을 보여 드려요.")
          : t("AI가 만든 진짜 영상이에요.")}
      </p>
    )
  }
  if (state.phase === "timeout") {
    return (
      <div className="ai-video-status is-error" role="alert">
        <p className="ai-video-status__title">{t("진짜 영상이 아직 오지 않았어요. 예시 영상은 그대로 쓸 수 있어요.")}</p>
        <button type="button" className="ai-video-action" onClick={onResume}>{t("다시 확인하기")}</button>
      </div>
    )
  }
  if (state.phase === "failed") {
    return (
      <div className="ai-video-status is-error" role="alert">
        <p className="ai-video-status__title">
          {t(FAILURE_TEXT[state.error ?? ""] ?? "진짜 영상을 만들지 못했어요. 예시 영상은 그대로 쓸 수 있어요.")}
        </p>
        <button
          type="button"
          className="ai-video-action"
          onClick={() => {
            if (window.confirm(t("다시 만들면 영상 만들기 요청이 1번 더 들어가고 비용이 새로 들어요. 다시 만들까요?"))) onRetry()
          }}
        >
          {t("다시 만들기")}
        </button>
      </div>
    )
  }
  return null
}

/** 다운로드 for the real video; returns the message for the action bar. */
export async function saveRealVideo(state: AiVideoState, title: string, prepared?: File | null) {
  if (!state.videoUrl) return ""
  const result = await downloadAiVideo(state.videoUrl, title, prepared)
  return result === "saved" ? "AI가 만든 영상을 저장했어요." : "새 창에서 영상을 열었어요. 그 화면에서 저장해 주세요."
}

/** 공유하기 for the real video; returns the message for the share status. */
export async function shareRealVideo(state: AiVideoState, title: string, prepared?: File | null) {
  if (!state.videoUrl) return ""
  const result = await shareAiVideo(state.videoUrl, title, prepared)
  if (result === "shared") return "공유 요청을 전달했어요."
  if (result === "cancelled") return "공유를 취소했어요. 결과는 그대로 있어요."
  if (result === "unsupported") return "이 브라우저는 공유를 지원하지 않아요. 다운로드한 뒤 원하는 앱에서 공유해 주세요."
  return "공유하지 못했어요. 다시 시도하거나 다운로드로 가져가 주세요."
}
