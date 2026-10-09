import { channels, type Channel } from "./channels"
import ServiceArt from "./ServiceArt"

export default function PublishingGuide({
  channel,
  hasVideo,
}: {
  channel: Channel
  hasVideo: boolean
}) {
  const destination = channels[channel]
  return (
    <section className="publishing-guide" aria-labelledby="publishing-title">
      <ServiceArt name="guide-save" className="save-guide-art" />
      <div>
        <span className="studio-eyebrow">저장한 다음에는</span>
        <h2 id="publishing-title">
          {channel === "download"
            ? "원하는 곳에 직접 올려 보세요"
            : `${destination.name}에 직접 올려 보세요`}
        </h2>
        <p>
          {channel === "youtube" && !hasVideo
            ? "쇼츠에는 영상이 필요해요. 지금 만든 사진과 글은 먼저 저장해 두세요. ‘새 홍보물 만들기’에서 영상을 선택하면 짧은 영상도 만들 수 있어요."
            : destination.next}
        </p>
        <p className="channel-manual-note">
          이 화면에서 외부 계정에 로그인하거나 자동으로 게시하지 않아요.
        </p>
      </div>
      {destination.url && (
        <a
          className="studio-secondary"
          href={destination.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {destination.name} 열기 <span className="link-window">새 창 ↗</span>
        </a>
      )}
    </section>
  )
}
