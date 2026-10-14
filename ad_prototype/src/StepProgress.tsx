import Icon from "./Icon"
export type CreationStep = 1 | 2 | 3
const steps = [
  { short: "사진 등록", label: "사진 등록" },
  { short: "정보 입력", label: "정보 입력" },
  { short: "결과 확인", label: "결과 확인" },
]
export default function StepProgress({
  step,
  onBack,
}: {
  step: CreationStep
  onBack: (step: CreationStep) => void
}) {
  return (
    <nav className="journey-progress" aria-label="홍보물 만들기 진행 단계">
      <ol>
        {steps.map((item, index) => {
          const number = (index + 1) as CreationStep
          const state =
            number < step
              ? "complete"
              : number === step
                ? "current"
                : "upcoming"
          const content = (
            <>
              <span className="journey-node">
                {state === "complete" ? (
                  <Icon name="check" size={20} />
                ) : (
                  number
                )}
              </span>
              <span className="journey-label">
                <span className="journey-short">{item.short}</span>
                <span className="journey-long">{item.label}</span>
                <small>
                  {state === "complete"
                    ? "완료 · 수정"
                    : state === "current"
                      ? "현재 단계"
                      : "다음 단계"}
                </small>
              </span>
            </>
          )
          return (
            <li
              key={number}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              {state === "complete" ? (
                <button
                  type="button"
                  onClick={() => onBack(number)}
                  aria-label={item.label + " 단계로 돌아가기"}
                >
                  {content}
                </button>
              ) : (
                <span className="journey-static">{content}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
