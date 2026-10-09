import { useFeedback } from "./FeedbackProvider"
export default function FeedbackSettings() {
  const {
    preferences,
    soundSupported,
    vibrationSupported,
    message,
    setPreference,
    preview,
  } = useFeedback()
  return (
    <fieldset className="feedback-settings">
      <legend>
        완료 알림 <span>처음에는 모두 꺼져 있어요</span>
      </legend>
      <div className="feedback-options">
        <button
          type="button"
          role="switch"
          aria-label="효과음"
          aria-checked={preferences.sound}
          disabled={!soundSupported}
          onClick={() => setPreference("sound", !preferences.sound)}
        >
          <span>효과음</span>
          <strong>{preferences.sound ? "켜짐" : "꺼짐"}</strong>
        </button>
        <button
          type="button"
          role="switch"
          aria-label="진동 피드백"
          aria-checked={preferences.vibration}
          disabled={!vibrationSupported}
          onClick={() => setPreference("vibration", !preferences.vibration)}
        >
          <span>진동 피드백</span>
          <strong>
            {vibrationSupported
              ? preferences.vibration
                ? "켜짐"
                : "꺼짐"
              : "지원 안 됨"}
          </strong>
        </button>
        {preferences.sound && soundSupported && (
          <button type="button" className="studio-tool" onClick={preview}>
            효과음 들어보기
          </button>
        )}
      </div>
      <p>
        사진 확인과 결과 준비를 짧게 알려요. 소리나 진동 없이도 모든 기능을
        사용할 수 있어요.
      </p>
      {!vibrationSupported && <p>이 브라우저에서는 진동을 지원하지 않아요.</p>}
      {!soundSupported && <p>이 브라우저에서는 효과음을 지원하지 않아요.</p>}
      {message && <p role="status">{message}</p>}
    </fieldset>
  )
}
