import { useCallback, useEffect, useRef, useState } from "react"

// 말로 쓰기 (쉬운 화면). One recognition session at a time for the whole info step.
// Web Speech API: Chrome/Edge/Samsung Internet support it (webkit prefix); Firefox has none;
// Safari is partial. It needs HTTPS or localhost, and the browser asks for the microphone.

type RecognitionAlternative = { transcript: string }
type RecognitionResult = { isFinal: boolean; length: number; [index: number]: RecognitionAlternative }
type RecognitionEvent = { resultIndex?: number; results: { length: number; [index: number]: RecognitionResult } }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionConstructor = new () => Recognition

export function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const voiceMessages = {
  unsupported: "이 브라우저는 말로 쓰기가 안 돼요. 글자로 써 주세요.",
  denied: "마이크를 허용해 주세요. 아니면 글자로 써 주세요.",
  noSpeech: "소리가 안 들렸어요. 다시 눌러 주세요.",
  noMic: "마이크를 찾지 못했어요. 글자로 써 주세요.",
  failed: "지금은 말로 쓰기가 안 돼요. 글자로 써 주세요.",
}

function errorMessage(error: string) {
  if (error === "aborted") return ""
  if (error === "not-allowed" || error === "service-not-allowed") return voiceMessages.denied
  if (error === "no-speech") return voiceMessages.noSpeech
  if (error === "audio-capture") return voiceMessages.noMic
  return voiceMessages.failed
}

export type VoiceNotice = { field: string; text: string }
export type VoiceSession = { field: string; interim: string }
export type VoiceStartSource = "tap" | "button"

export type VoiceInput = {
  session: VoiceSession | null
  notice: VoiceNotice | null
  /** False after the browser says no (unsupported or microphone blocked): taps go straight to typing. */
  autoStart: boolean
  start: (field: string, commit: (text: string) => void, source: VoiceStartSource) => boolean
  /** 다 했어요: stop listening and keep what was heard. */
  finish: () => void
  /** 키보드로 쓸게요 / leaving: stop listening and keep the old text. */
  cancel: () => void
  clearNotice: (field?: string) => void
}

export function useVoiceInput(onBeforeListen?: () => void): VoiceInput {
  const [session, setSession] = useState<VoiceSession | null>(null)
  const [notice, setNotice] = useState<VoiceNotice | null>(null)
  const [autoStart, setAutoStartState] = useState(true)
  const autoStartRef = useRef(true)
  const setAutoStart = (value: boolean) => {
    autoStartRef.current = value
    setAutoStartState(value)
  }
  const recognitionRef = useRef<Recognition | null>(null)
  const sessionIdRef = useRef(0)
  const heardRef = useRef("")
  const finishingRef = useRef(false)
  const finishTimerRef = useRef<number | undefined>(undefined)
  const beforeListenRef = useRef(onBeforeListen)
  beforeListenRef.current = onBeforeListen

  const release = useCallback(() => {
    sessionIdRef.current += 1
    window.clearTimeout(finishTimerRef.current)
    const recognition = recognitionRef.current
    recognitionRef.current = null
    setSession(null)
    return recognition
  }, [])

  const cancel = useCallback(() => {
    const recognition = release()
    try {
      recognition?.abort()
    } catch {
      // already stopped
    }
  }, [release])

  useEffect(() => cancel, [cancel])

  const start = useCallback<VoiceInput["start"]>((field, commit, source) => {
    const Constructor = recognitionConstructor()
    if (!Constructor) {
      // Show the message once for taps; the 말로 하기 button always explains.
      if (autoStartRef.current || source === "button") setNotice({ field, text: voiceMessages.unsupported })
      setAutoStart(false)
      return false
    }
    cancel()
    beforeListenRef.current?.()
    const id = sessionIdRef.current + 1
    sessionIdRef.current = id
    heardRef.current = ""
    finishingRef.current = false
    let recognition: Recognition
    try {
      recognition = new Constructor()
      recognition.lang = "ko-KR"
      recognition.interimResults = true
      recognition.continuous = false
      recognition.maxAlternatives = 1
    } catch {
      setAutoStart(false)
      setNotice({ field, text: voiceMessages.unsupported })
      return false
    }
    const done = (text: string) => {
      const value = text.replace(/\s+/g, " ").trim()
      const stopped = release()
      try {
        stopped?.stop()
      } catch {
        // already stopped
      }
      if (value) {
        commit(value)
        setNotice(null)
      } else setNotice({ field, text: voiceMessages.noSpeech })
    }
    recognition.onresult = (event) => {
      if (id !== sessionIdRef.current) return
      let final = ""
      let interim = ""
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result?.[0]?.transcript ?? ""
        if (result.isFinal) final += transcript
        else interim += transcript
      }
      if (final.trim()) {
        done(final)
        return
      }
      heardRef.current = interim
      setSession({ field, interim: interim.trim() })
    }
    recognition.onerror = (event) => {
      if (id !== sessionIdRef.current) return
      const message = errorMessage(event.error)
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setAutoStart(false)
      if (finishingRef.current && heardRef.current.trim() && event.error === "no-speech") {
        done(heardRef.current)
        return
      }
      cancel()
      if (message) setNotice({ field, text: message })
    }
    recognition.onend = () => {
      if (id !== sessionIdRef.current) return
      done(heardRef.current)
    }
    try {
      recognition.start()
    } catch {
      sessionIdRef.current += 1
      setNotice({ field, text: voiceMessages.failed })
      return false
    }
    recognitionRef.current = recognition
    setNotice(null)
    setSession({ field, interim: "" })
    return true
  }, [cancel, release])

  const finish = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    finishingRef.current = true
    const id = sessionIdRef.current
    try {
      recognition.stop()
    } catch {
      // ignore
    }
    // Some browsers never send a final result after stop(); keep what was heard.
    window.clearTimeout(finishTimerRef.current)
    finishTimerRef.current = window.setTimeout(() => {
      if (id === sessionIdRef.current) recognition.onend?.()
    }, 1500)
  }, [])

  const clearNotice = useCallback((field?: string) => {
    setNotice((current) => (!current || (field && current.field !== field) ? current : null))
  }, [])

  return { session, notice, autoStart, start, finish, cancel, clearNotice }
}
