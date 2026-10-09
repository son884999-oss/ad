import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
type Preferences = {
  sound: boolean
  vibration: boolean
}
type FeedbackEvent = "upload" | "result" | "copy" | "download"
type Feedback = {
  preferences: Preferences
  soundSupported: boolean
  vibrationSupported: boolean
  message: string
  setPreference: (key: keyof Preferences, value: boolean) => void
  notify: (event: FeedbackEvent) => void
  preview: () => void
}
const key = "hongboitda.feedback.v1"
const FeedbackContext = createContext<Feedback | null>(null)
function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}")
    return {
      sound: value?.sound === true,
      vibration: value?.vibration === true,
    }
  } catch {
    return { sound: false, vibration: false }
  }
}
export default function FeedbackProvider({
  children,
}: {
  children: ReactNode
}) {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences)
  const preferencesRef = useRef(preferences)
  const [message, setMessage] = useState("")
  const context = useRef<AudioContext | null>(null)
  const tones = useRef(new Set<OscillatorNode>())
  const lastEvent = useRef(0)
  const soundSupported = typeof window.AudioContext === "function"
  const vibrationSupported = typeof navigator.vibrate === "function"
  const activate = useCallback(() => {
    if (!preferencesRef.current.sound || !soundSupported) return
    try {
      context.current ??= new AudioContext()
      if (context.current.state === "suspended")
        void context.current
          .resume()
          .catch(() =>
            setMessage(
              "이 기기에서는 효과음을 재생하지 못했어요. 화면 안내로 확인해 주세요.",
            ),
          )
    } catch {
      setMessage("이 기기에서는 효과음을 사용할 수 없어요.")
    }
  }, [soundSupported])
  const play = useCallback((event: FeedbackEvent) => {
    const audio = context.current
    if (
      !preferencesRef.current.sound ||
      !audio ||
      audio.state !== "running" ||
      document.hidden
    )
      return
    if (window.speechSynthesis?.speaking) return
    try {
      const start = audio.currentTime
      const notes =
        event === "result"
          ? [523.25, 659.25]
          : [event === "upload" ? 587.33 : 523.25]
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        const at = start + index * 0.11
        oscillator.type = "sine"
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(0.045, at + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.14)
        oscillator.connect(gain)
        gain.connect(audio.destination)
        tones.current.add(oscillator)
        oscillator.onended = () => {
          oscillator.disconnect()
          gain.disconnect()
          tones.current.delete(oscillator)
        }
        oscillator.start(at)
        oscillator.stop(at + 0.16)
      })
    } catch {
      setMessage("효과음을 재생하지 못했어요. 화면 안내로 확인해 주세요.")
    }
  }, [])
  const setPreference = useCallback(
    (name: keyof Preferences, value: boolean) => {
      if (
        (name === "sound" && !soundSupported) ||
        (name === "vibration" && !vibrationSupported)
      )
        return
      const next = { ...preferencesRef.current, [name]: value }
      preferencesRef.current = next
      setPreferences(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
        setMessage("알림 설정을 이 기기에 기억했어요.")
      } catch {
        setMessage("설정은 이 창에서만 유지돼요.")
      }
      if (name === "sound") {
        if (value) activate()
        else {
          for (const oscillator of tones.current) {
            try {
              oscillator.stop()
            } catch {}
          }
          tones.current.clear()
        }
      }
      if (name === "vibration" && !value) {
        try {
          navigator.vibrate?.(0)
        } catch {}
      }
    },
    [activate, soundSupported, vibrationSupported],
  )
  const notify = useCallback(
    (event: FeedbackEvent) => {
      if (document.hidden || Date.now() - lastEvent.current < 180) return
      lastEvent.current = Date.now()
      play(event)
      if (
        preferencesRef.current.vibration &&
        vibrationSupported &&
        (event === "upload" || event === "result")
      ) {
        try {
          navigator.vibrate(20)
        } catch {}
      }
    },
    [play, vibrationSupported],
  )
  useEffect(() => {
    // 복원된 설정도 사용자 동작 전에는 AudioContext를 생성하거나 재생하지 않는다.
    const activateFromUser = () => activate()
    document.addEventListener("pointerdown", activateFromUser)
    document.addEventListener("keydown", activateFromUser)
    return () => {
      document.removeEventListener("pointerdown", activateFromUser)
      document.removeEventListener("keydown", activateFromUser)
      const audio = context.current
      context.current = null
      if (audio && audio.state !== "closed") void audio.close().catch(() => {})
    }
  }, [activate])
  return (
    <FeedbackContext.Provider
      value={{
        preferences,
        soundSupported,
        vibrationSupported,
        message,
        setPreference,
        notify,
        preview: () => {
          activate()
          play("result")
        },
      }}
    >
      {children}
    </FeedbackContext.Provider>
  )
}
export function useFeedback() {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error("FeedbackProvider is required")
  return value
}
