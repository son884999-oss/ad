import { useRef, type ChangeEvent } from "react"
import Icon from "./Icon"
export default function PhotoStep({
  imageUrl,
  outputFormat,
  onOutputFormatChange,
  pending,
  message,
  onUpload,
  onNext,
}: {
  imageUrl: string
  outputFormat?: "both" | "poster" | "video"
  onOutputFormatChange?: (format: "both" | "poster" | "video") => void
  pending: boolean
  message: string
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onNext: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const selectPhoto = () => inputRef.current?.click()
  const input = (
    <input
      ref={inputRef}
      id="product-photo"
      type="file"
      hidden
      accept="image/*"
      aria-label={imageUrl ? "사진 바꾸기" : "제품 사진 올리기"}
      aria-describedby={"upload-help" + (message ? " upload-feedback" : "")}
      onChange={onUpload}
    />
  )
  return (
    <div className={"photo-step step-panel " + (imageUrl ? "is-ready" : "")}>
      <div className="photo-workspace">
        <section className="photo-section" aria-label="제품 사진 선택">
          <div className={imageUrl ? "section-heading sr-only" : "section-heading"}>
            <p id="upload-help">
              20MB 이하의 JPG·PNG 등 사진 한 장을 선택하세요.
            </p>
          </div>
          <div
            className={"photo-upload " + (imageUrl ? "has-photo" : "")}
            aria-busy={pending}
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt="넣은 제품 사진 미리보기"
                  className="selected-photo"
                />
                <div className="photo-confirmation">
                  <span className="photo-check">
                    <Icon name="check" />
                    사진 준비됨
                  </span>
                  <p className="sr-only">제품이 잘 보이는지 확인해 주세요.</p>
                  <button
                    type="button"
                    className="studio-secondary photo-change-button"
                    disabled={pending}
                    onClick={selectPhoto}
                  >
                    사진 바꾸기
                  </button>
                  {input}
                </div>
              </>
            ) : (
              <div className="upload-target photo-upload-choices">
                <button
                  type="button"
                  className="photo-upload-icon-button"
                  aria-label="사진 선택창 열기"
                  aria-describedby="upload-help"
                  disabled={pending}
                  onClick={selectPhoto}
                >
                  <Icon name="camera" size={44} />
                </button>
                <button
                  type="button"
                  className="studio-primary photo-upload-text-button"
                  disabled={pending}
                  onClick={selectPhoto}
                >
                  제품 사진 올리기
                </button>
                <span>이 기기에 있는 사진을 골라 주세요</span>
                {input}
              </div>
            )}
          </div>
          {message && (
            <p
              id="upload-feedback"
              className={message === "사진이 준비됐어요."
                ? "sr-only"
                : `upload-feedback ${pending ? "is-pending" : "is-error"}`}
              role={pending || message === "사진이 준비됐어요." ? "status" : "alert"}
              aria-atomic="true"
            >
              {pending && <span className="activity-dot" aria-hidden="true" />}
              {message}
            </p>
          )}
          {!imageUrl && <figure className="photo-example">
            <img
              src="/assets/samples/latte-product-sample.png"
              alt="제품 전체가 또렷하게 보이는 사진 예시"
              width="72"
              height="88"
            />
            <figcaption>
              <strong>이런 사진이 좋아요</strong>
              <span>제품 전체가 또렷하게 보이는 사진을 골라 주세요.</span>
            </figcaption>
          </figure>}
        </section>
      </div>
      {imageUrl && outputFormat && onOutputFormatChange && (
        <fieldset className="photo-output-format" disabled={pending}>
          <legend>만들 결과 <span>문구 포함</span></legend>
          <div className="photo-output-options">
            {([
              ["both", "둘 다"],
              ["poster", "포스터"],
              ["video", "영상"],
            ] as const).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="creation-output-format"
                  value={value}
                  checked={outputFormat === value}
                  onChange={() => onOutputFormatChange(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="photo-next-action">
        <button
          className="studio-primary"
          disabled={!imageUrl || pending}
          onClick={onNext}
        >
          {pending ? "사진 확인 중" : "다음 단계"}
          <Icon name="arrow" />
        </button>
      </div>
    </div>
  )
}
