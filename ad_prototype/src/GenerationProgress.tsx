import { useEffect, useRef, useState } from "react"
import Icon from "./Icon"
import { uiText } from "./easyText"

type Kind = "all" | "poster" | "video" | "copy"
type Step = { label: string; active: string; until: number }
const flows: Record<Kind, { heading: string; done: string; steps: Step[] }> = {
  all: { heading: "홍보물을 만들고 있어요", done: "홍보물이 준비됐어요", steps: [
    { label: "사진 확인", active: "사진을 살펴보고 있어요", until: 30 },
    { label: "홍보 문구 쓰기", active: "홍보 문구를 쓰고 있어요", until: 68 },
    { label: "포스터·영상 꾸미기", active: "포스터와 영상을 꾸미고 있어요", until: 100 },
  ] },
  poster: { heading: "이미지를 만들고 있어요", done: "이미지가 준비됐어요", steps: [
    { label: "사진 확인", active: "사진을 살펴보고 있어요", until: 30 },
    { label: "넣을 문구 정하기", active: "이미지에 넣을 문구를 정하고 있어요", until: 68 },
    { label: "이미지 꾸미기", active: "이미지를 꾸미고 있어요", until: 100 },
  ] },
  video: { heading: "영상을 만들고 있어요", done: "영상이 준비됐어요", steps: [
    { label: "사진 확인", active: "사진을 살펴보고 있어요", until: 30 },
    { label: "장면 구성하기", active: "영상 장면을 구성하고 있어요", until: 68 },
    { label: "영상 다듬기", active: "영상을 다듬고 있어요", until: 100 },
  ] },
  copy: { heading: "홍보 글을 쓰고 있어요", done: "홍보 글이 준비됐어요", steps: [
    { label: "사진 살펴보기", active: "사진 속 장점을 찾고 있어요", until: 30 },
    { label: "글 쓰기", active: "홍보 글을 쓰고 있어요", until: 68 },
    { label: "해시태그 고르기", active: "어울리는 해시태그를 고르고 있어요", until: 100 },
  ] },
}

// Shown between "홍보물 만들기" and the results: the user's own photo becomes a poster preview
// while a short checklist ticks off. Progress is time-based for the prototype and only reaches
// 100% once the real preview is ready.
export default function GenerationProgress({
  kind,
  imageUrl,
  title,
  ready,
  onDone,
  onCancel,
  easyMode = false,
}: {
  easyMode?: boolean
  kind: Kind
  imageUrl: string
  title: string
  ready: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const t = (text: string) => uiText(text, easyMode)
  const [percent, setPercent] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPercent((value) => Math.min(ready ? 100 : 95, value + (value < 70 ? 2 : 1)))
    }, 40)
    return () => window.clearInterval(timer)
  }, [ready])

  useEffect(() => {
    if (percent < 100) return
    const timer = window.setTimeout(() => doneRef.current(), 450)
    return () => window.clearTimeout(timer)
  }, [percent])

  const { heading, done, steps } = flows[kind]
  const current = steps.findIndex((step) => percent < step.until)
  const activeIndex = current === -1 ? steps.length : current
  const blur = Math.max(0, 14 - percent * 0.16)
  const showText = percent >= steps[1].until
  return (
    <section className="generation" aria-labelledby="generation-title">
      <h2 id="generation-title" ref={headingRef} tabIndex={-1} data-screen-heading>
        {t(heading)}
      </h2>
      <div className={`generation-card is-${kind}${percent >= 100 ? " is-done" : ""}`} aria-hidden="true">
        <div className="generation-photo">
          <img src={imageUrl} alt="" style={{ filter: `blur(${blur}px) saturate(${0.6 + percent / 250})` }} />
          {percent < 100 && <span className="generation-shimmer" />}
          {kind === "video" && <span className="generation-play" />}
        </div>
        <div className="generation-copy">
          {showText ? (
            <>
              <strong>{title}</strong>
              <span>{kind === "copy" ? "#우리가게 #동네추천" : "우리 가게 소식을 전해요"}</span>
            </>
          ) : (
            <>
              <i className="generation-line is-title" />
              <i className="generation-line" />
            </>
          )}
          {kind === "copy" && (
            <span className="generation-body">
              <i className="generation-line" />
              <i className="generation-line" />
              <i className="generation-line is-short" />
            </span>
          )}
        </div>
      </div>
      <ol className="generation-checklist">
        {steps.map((step, index) => {
          const state = index < activeIndex ? "done" : index === activeIndex ? "current" : "upcoming"
          return (
            <li key={step.label} className={`is-${state}`}>
              <span className="generation-check" aria-hidden="true">
                {state === "done" && <Icon name="check" size={16} />}
              </span>
              <span>
                {t(state === "current" ? step.active : step.label)}
                <span className="sr-only">{t(state === "done" ? " 완료" : state === "current" ? " 진행 중" : " 대기")}</span>
              </span>
            </li>
          )
        })}
      </ol>
      <p className="sr-only" role="status">
        {t(activeIndex < steps.length ? steps[activeIndex].active : done)}
      </p>
      <div className="generation-bar">
        <div
          className="generation-track"
          role="progressbar"
          aria-label={t("홍보물 만드는 중")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="generation-percent" aria-hidden="true">
          {percent}%
        </span>
      </div>
      <button type="button" className="studio-secondary generation-cancel" onClick={onCancel}>
        {t("취소")}
      </button>
    </section>
  )
}
