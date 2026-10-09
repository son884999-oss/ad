import { useState } from "react"
import { channels, channelIds, recommendations, type Channel } from "./channels"
import ServiceArt from "./ServiceArt"

export default function ChannelPicker({
  value,
  onChange,
}: {
  value: Channel
  onChange: (value: Channel) => void
}) {
  const [category, setCategory] =
    useState<keyof typeof recommendations>("general")
  const recommended: Channel[] = recommendations[category].ids
  const alternatives = channelIds.filter(
    (id) => id !== "download" && !recommended.includes(id),
  )
  const [expanded, setExpanded] = useState(false)
  const option = (id: Channel, rank?: number) => (
    <label
      className={`channel-option ${value === id ? "is-selected" : ""}`}
      key={id}
    >
      <input
        type="radio"
        name="promotion-channel"
        value={id}
        checked={value === id}
        onChange={() => onChange(id)}
        aria-label={channels[id].name}
      />
      <span>
        {rank && <span className="channel-rank">추천 {rank}</span>}
        <strong>{channels[id].name}</strong>
        <span className="channel-description">{channels[id].description}</span>
      </span>
      {value === id && (
        <span className="channel-selected" aria-hidden="true">
          선택
        </span>
      )}
    </label>
  )
  return (
    <fieldset
      className="channel-picker"
      aria-describedby="channel-help channel-tone-guide"
    >
      <legend>
        어디에 홍보할까요? <span>선택 사항</span>
      </legend>
      <div className="channel-intro">
        <ServiceArt name="workflow-channel" />
        <p id="channel-help">
          아직 정하지 않았다면 파일만 저장해도 돼요. 만든 홍보물은 원하는 곳에
          직접 올릴 수 있어요.
        </p>
      </div>
      {option("download")}
      <div className="channel-category">
        <label htmlFor="business-category">가게에 맞는 추천 보기</label>
        <select
          id="business-category"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as keyof typeof recommendations)
          }
        >
          {Object.entries(recommendations).map(([id, item]) => (
            <option key={id} value={id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="channel-recommended">
        {recommended.map((id, index) => option(id, index + 1))}
      </div>
      <details
        open={expanded || alternatives.includes(value)}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary>다른 홍보할 곳 보기</summary>
        <div className="channel-alternatives">
          {alternatives.map((id) => option(id))}
        </div>
      </details>
      <p id="channel-tone-guide" className="channel-tone-guide" role="status">
        {channels[value].guide}
      </p>
      <p className="channel-manual-note">
        홍보물은 저장한 뒤 직접 올려요. 자동으로 게시되지 않아요.
      </p>
    </fieldset>
  )
}
