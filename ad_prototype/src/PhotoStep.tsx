import type { ChangeEvent } from "react"
import Icon from "./Icon"
import ChannelPicker from "./ChannelPicker"
import ServiceArt from "./ServiceArt"
import { channelNames, type Channel } from "./channels"
type Format = "poster" | "video" | "both"
type Kind = "all" | "poster" | "video" | "copy"
const formats = [
  { id: "poster" as const, title: "포스터", icon: "picture" as const },
  { id: "video" as const, title: "영상", icon: "video" as const },
  {
    id: "both" as const,
    title: "포스터와 영상 둘 다",
    icon: "window" as const,
  },
]
export default function PhotoStep({
  imageUrl,
  pending,
  message,
  onUpload,
  type,
  format,
  onFormat,
  channel,
  onChannel,
  onNext,
}: {
  imageUrl: string
  pending: boolean
  message: string
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  type: Kind
  format: Format
  onFormat: (format: Format) => void
  channel: Channel
  onChannel: (channel: Channel) => void
  onNext: () => void
}) {
  const input = (
    <input
      id="product-photo"
      type="file"
      accept="image/*"
      aria-label={imageUrl ? "사진 바꾸기" : "제품 사진 올리기"}
      aria-describedby={"upload-help" + (message ? " upload-feedback" : "")}
      onChange={onUpload}
      className="sr-only"
    />
  )
  return (
    <div className={"photo-step step-panel " + (imageUrl ? "is-ready" : "")}>
      <div className="photo-workspace">
        <section className="photo-section" aria-labelledby="photo-title">
          <div className="section-heading">
            <span className="section-kicker">먼저, 사진 한 장</span>
            <h3 id="photo-title">제품 사진을 올려 주세요</h3>
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
                    사진이 준비됐어요
                  </span>
                  <p>제품이 잘 보이는지 확인해 주세요.</p>
                  <label htmlFor="product-photo" className="studio-secondary">
                    사진 바꾸기
                  </label>
                  {input}
                </div>
              </>
            ) : (
              <label htmlFor="product-photo" className="upload-target">
                <strong>제품 사진 올리기</strong>
                <ServiceArt name="workflow-photo" className="upload-art" />
                <span>이 기기에 있는 사진을 골라 주세요</span>
                {input}
              </label>
            )}
          </div>
          {message && (
            <p id="upload-feedback" className="upload-feedback" role="status">
              {pending && <span className="activity-dot" aria-hidden="true" />}
              {message}
            </p>
          )}
        </section>
        <section className="format-section" aria-labelledby="format-title">
          <div className="section-heading">
            <span className="section-kicker">사진으로 만들 홍보물</span>
            <h3 id="format-title">
              {type === "all"
                ? "어떤 홍보물이 필요하세요?"
                : "이번에 만들 홍보물"}
            </h3>
          </div>
          {type === "all" ? (
            <fieldset className="format-picker">
              <legend className="sr-only">결과 형식</legend>
              {formats.map((item) => (
                <label
                  key={item.id}
                  className={
                    "format-option " + (format === item.id ? "is-selected" : "")
                  }
                >
                  <input
                    type="radio"
                    name="output-format"
                    value={item.id}
                    checked={format === item.id}
                    onChange={() => onFormat(item.id)}
                    aria-label={item.title}
                  />
                  <Icon name={item.icon} size={28} />
                  <strong>
                    {item.id === "both" ? "포스터 + 영상" : item.title}
                  </strong>
                  <span>{format === item.id ? "선택됨" : "선택하기"}</span>
                </label>
              ))}
              <p>어느 것을 골라도 홍보 글을 함께 만들어요.</p>
            </fieldset>
          ) : (
            <div className="single-format">
              <Icon
                name={
                  type === "poster"
                    ? "picture"
                    : type === "video"
                      ? "video"
                      : "copy"
                }
                size={32}
              />
              <strong>
                {type === "poster"
                  ? "포스터"
                  : type === "video"
                    ? "동영상"
                    : "홍보 글"}{" "}
                만들기
              </strong>
              <span>사진과 설명으로 예시 결과를 만들어요.</span>
            </div>
          )}
          <div className="photo-next-summary">
            <Icon name="copy" />
            <p>
              다음 단계에서 제품 설명을 적어요.
              <br />
              사진과 선택한 내용은 그대로 이어져요.
            </p>
          </div>
        </section>
      </div>
      <details className="destination-settings">
        <summary>
          <span>
            홍보할 곳 고르기 <small>선택 사항</small>
          </span>
          <strong>{channelNames[channel]}</strong>
          <span className="details-action">열기 / 닫기</span>
        </summary>
        <ChannelPicker value={channel} onChange={onChannel} />
      </details>
      <div className="mobile-primary-bar photo-next-action">
        <span>
          {imageUrl
            ? "사진이 준비됐어요. 설명을 적어 볼까요?"
            : "사진을 올리면 다음으로 갈 수 있어요."}
        </span>
        <button
          className="studio-primary"
          disabled={!imageUrl || pending}
          onClick={onNext}
        >
          {pending ? "사진 확인 중" : "사진 확인하고 다음"}
          <Icon name="arrow" />
        </button>
      </div>
    </div>
  )
}
