import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
import { flushSync } from "react-dom"
import Icon from "./Icon"
import { recognitionConstructor, type VoiceInput } from "./useVoiceInput"

export type VoiceBind = {
  id: string
  readOnly?: boolean
  onPointerDown?: (event: PointerEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}

const UNDO_MS = 10_000

// Wraps one info-step text field. 쉬운 화면 only: a tap on the field (not keyboard focus)
// or the 말로 하기 button starts listening; the spoken text REPLACES the field through
// onVoiceText (the same update path as typing) and 되돌리기 brings the old text back.
// 기본 화면 renders the field unchanged.
export default function VoiceField({
  voice,
  field,
  label,
  inputId,
  value,
  maxLength,
  easyMode,
  onVoiceText,
  children,
}: {
  voice: VoiceInput
  field: string
  label: string
  inputId: string
  value: string
  maxLength?: number
  easyMode: boolean
  onVoiceText: (text: string) => void
  children: (bind: VoiceBind) => ReactNode
}) {
  const hasRecognition = recognitionConstructor() !== null
  const [undo, setUndo] = useState<{ previous: string; applied: string } | null>(null)
  const [keyboardChosen, setKeyboardChosen] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const valueRef = useRef(value)
  valueRef.current = value
  const onVoiceTextRef = useRef(onVoiceText)
  onVoiceTextRef.current = onVoiceText
  const micRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLSpanElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const listening = easyMode && voice.session?.field === field
  const notice = easyMode && voice.notice?.field === field ? voice.notice.text : ""

  // Typing (or any other change) after the voice result ends the undo offer.
  const visibleUndo = undo && undo.applied === value ? undo : null
  useEffect(() => {
    if (!visibleUndo) return
    let timer = 0
    const hide = () => {
      // Keep it while a keyboard user is on the button.
      if (document.activeElement === undoRef.current) timer = window.setTimeout(hide, 2000)
      else setUndo(null)
    }
    timer = window.setTimeout(hide, UNDO_MS)
    return () => window.clearTimeout(timer)
  }, [visibleUndo])

  useEffect(() => {
    if (!easyMode) {
      if (voice.session?.field === field) voice.cancel()
      setUndo(null)
    }
  }, [easyMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (listening) panelRef.current?.scrollIntoView({ block: "nearest" })
  }, [listening])

  const lastValueRef = useRef(value)
  useEffect(() => {
    if (lastValueRef.current !== value) voice.clearNotice(field)
    lastValueRef.current = value
  }, [value, field, voice])

  if (!easyMode) return <>{children({ id: inputId })}</>

  const commit = (text: string) => {
    const previous = valueRef.current
    const next = maxLength ? text.slice(0, maxLength) : text
    onVoiceTextRef.current(next)
    setUndo({ previous, applied: next })
    setAnnouncement(`${label}: “${next}”(으)로 바꿨어요. 되돌리기를 누르면 먼저 글로 돌아가요.`)
  }
  const startListening = (source: "tap" | "button") => {
    setAnnouncement("")
    if (voice.start(field, commit, source)) setAnnouncement("듣고 있어요. 말씀하세요.")
  }
  const chooseKeyboard = () => {
    flushSync(() => {
      voice.cancel()
      setKeyboardChosen(true)
      setAnnouncement("글자로 써 주세요.")
    })
    document.getElementById(inputId)?.focus()
  }
  const restore = () => {
    if (!visibleUndo) return
    onVoiceTextRef.current(visibleUndo.previous)
    setUndo(null)
    setAnnouncement("먼저 글로 되돌렸어요.")
    micRef.current?.focus({ preventScroll: true })
  }

  const bind: VoiceBind = {
    id: inputId,
    readOnly: listening || undefined,
    onPointerDown:
      voice.autoStart && !listening && !keyboardChosen
        ? (event) => {
            if (event.button > 0 || document.activeElement === event.currentTarget) return
            startListening("tap")
          }
        : undefined,
  }

  return (
    <span className={`voice-field${listening ? " is-listening" : ""}`}>
      <span className="voice-field-row">
        {children(bind)}
        {/* No Web Speech here (some Safari / Samsung Internet builds): no button that can only fail. */}
        {hasRecognition && <button
          ref={micRef}
          type="button"
          className="voice-mic-button"
          aria-label={`${label} 말로 하기`}
          disabled={listening}
          onClick={() => startListening("button")}
        >
          <Icon name="mic" size={26} />
          <span>말로 하기</span>
        </button>}
      </span>
      {listening && (
        <span ref={panelRef} className="voice-panel" role="group" aria-label={`${label} 말로 쓰는 중`}>
          <span className="voice-panel-head">
            <span className="voice-pulse" aria-hidden="true">
              <Icon name="mic" size={30} />
            </span>
            <strong>듣고 있어요. 말씀하세요</strong>
          </span>
          <span className={`voice-interim${voice.session?.interim ? "" : " is-empty"}`}>
            {voice.session?.interim || "여기에 말이 글자로 나와요"}
          </span>
          <span className="voice-panel-actions">
            <button type="button" className="studio-primary voice-done" onClick={voice.finish}>
              <Icon name="check" size={24} />
              다 했어요
            </button>
            <button type="button" className="studio-secondary voice-keyboard" onClick={chooseKeyboard}>
              <Icon name="keyboard" size={24} />
              키보드로 쓸게요
            </button>
          </span>
        </span>
      )}
      {visibleUndo && (
        <span className="voice-undo-row">
          <span>말한 대로 바꿨어요.</span>
          <button ref={undoRef} type="button" className="studio-secondary voice-undo" aria-label={`${label} 되돌리기`} onClick={restore}>
            <Icon name="undo" size={22} />
            되돌리기
          </button>
        </span>
      )}
      {notice && (
        <span className="voice-notice" role="alert">
          {notice}
        </span>
      )}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {notice ? "" : announcement}
      </span>
    </span>
  )
}
