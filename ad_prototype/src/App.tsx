import { createPortal } from "react-dom"
import {
  ChangeEvent,
  Fragment,
  type ComponentPropsWithoutRef,
  FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { uiText } from "./easyText"
import { recognitionConstructor, useVoiceInput } from "./useVoiceInput"
import VoiceField from "./VoiceField"
import { isMobileDevice } from "./DesktopStage"
import { loadRecords, saveRecords } from "./recordsStore"
import { authConfigured, authErrorMessage, deleteAccount, signInWithEmail, signInWithProvider, signOut, signUpWithEmail, useAuth } from "./auth"
import { deleteCloudRecord, loadCloudRecords, pictureKey, saveCloudFile, saveCloudRecord, toDataUrl } from "./cloudRecords"
import { analyzePhotoOnce, generatePromoText, isAiUnavailable, type PhotoCheck, type PhotoSuggestion, type PromoTextResult } from "./ai"
import { useAiVideo, type AiVideoController, type SavedAiVideo } from "./useAiVideo"
import { hasPremiumCode } from "./premiumAccess"
import { AiVideoPlayer, AiVideoStatus, PremiumSteps, saveRealVideo, shareRealVideo, showsRealVideo, type PremiumStepState } from "./AiVideoPanel"
import { isVideoUnavailable, prepareAiVideoFile, toVideoDetails } from "./video"
import { buildPosterContent, loadPosterFonts, posterThemeFor, renderPosterToCanvas } from "./poster"
import { photoPalette } from "./poster/photoColor"
import { localBody, localCopy } from "./localCopy"
import { type VideoCaption } from "./videoCaption"
import { drawStoryFrame } from "./videoFrame"
import { makeScene } from "./scene"
import { outputFolder, saveToComputer } from "./localSave"
import { drawMotionFrame, MOTION_SECONDS, motionEffectFor, type MotionScene } from "./motionVideo"
import { plainMp4File } from "./mp4Flatten"
import { musicFor, prepareVideoSound } from "./videoSound"
import { makeAdBackground } from "./background"
import type { PosterThemeKey } from "./poster"
import PhotoStep from "./PhotoStep"
import GenerationProgress from "./GenerationProgress"
import StepProgress from "./StepProgress"
import Icon from "./Icon"
import { useFeedback } from "./FeedbackProvider"
import PublishingGuide from "./PublishingGuide"
import {
  channels as channelThemes,
  channelNames,
  mapChannels,
  type Channel,
} from "./channels"
import {
  StudioShell as Shell,
  StudioHome as Home,
  StudioLogin as Login,
} from "./StudioScreens"

/** Photo analysis with nothing in it: used when the analysis failed, to clear AI text left from an earlier photo. */
const EMPTY_SUGGESTION: PhotoSuggestion = { productName: "", description: "", highlights: "", keyFeatures: [], targetAudience: "", tones: [], visualDetails: [], subjectBox: null, photoCheck: { isRealPhoto: true, isBlurry: false, reason: "" } }

type Page = "login" | "home" | "create" | "records" | "plan"

type CreationType = "all" | "poster" | "video" | "copy"

type Step = 1 | 2 | 3

type OutputFormat = "poster" | "video" | "both"

type FileStatus = "idle" | "preparing" | "ready" | "cancelled" | "failed" | "unsupported"

type GeneratedRecord = {
  editedHashtags?: Record<Channel, boolean>
  id: string
  /** 고급형 "배경 바꾸기" picture (data URL) the poster and the AI video were made from. */
  sceneUrl?: string
  /** Results the owner deleted from 내 홍보물 (the record goes when all of them are gone). */
  removed?: ("poster" | "video" | "copy")[]

  createdAt: string

  type: CreationType

  outputFormat: OutputFormat

  channel: Channel

  imageUrl: string

  details: {
    shopName?: string
    name?: string
    description: string

    features: string

    audience: string

    keywords?: string

    /** Shop info (B_이창훈 prompt fields): 위치, 가격, 주문·연락 방법. ≤60 characters each. */
    location?: string
    priceInfo?: string
    contact?: string

    /** 홍보 분위기, in the order chosen (the first one leads). Empty = 자동. */
    tones?: Tone[]

    /** Legacy single value from before multi-select; read by normalizeTones() only. */
    tone?: string

    /** Poster shape chosen on the result screen (D_고혜숙 ratios / compositions / themes). */
    posterRatio?: PosterRatioKey
    posterLayout?: PosterLayoutKey
    /** Empty = follow the first 홍보 분위기. */
    posterTheme?: PosterThemeKey | ""
    /** 기본형 = the free motion video made in the browser; 고급형 = the paid AI video (Higgsfield). */
    videoMode?: "basic" | "premium"
    /** 고급형 "특별": the bold concept film (the world changes, the product may change a little). Off = safe push-in. */
    specialFilm?: boolean
  }

  userHashtags: Record<Channel, string>

  /** AI 홍보 글 used for this result, if it arrived in time. */
  promo?: AiPromo

  /** Real (Higgsfield) video job for this result; the URL may expire after about a week. */
  video?: SavedAiVideo

  /** Signed-in owner (Supabase user id) when this record is also kept on the server (src/cloudRecords.ts). */
  owner?: string
  /** What already went up: the photo and background fingerprints (pictureKey), so edits send the row only. */
  cloud?: { photo?: string; scene?: string }
  /** Links to the saved poster and video (records read from the server). */
  cloudFiles?: { poster?: string; video?: string }
}

/** AI 홍보 글 for one set of inputs; `signature` ties it to the details and channel it was made for. */
type AiPromo = PromoTextResult & { signature: string; /** Index of the first line chosen on the 홍보 글 tab. */ chosen?: number }


type Tone = "natural" | "premium" | "friendly" | "trendy"

type PosterRatioKey = "4:5" | "1:1" | "9:16"
type PosterLayoutKey = "vertical" | "split" | "editorial"
// Labels say what each shape is for, so nobody has to know what "4:5" means.
const posterRatioOptions: [PosterRatioKey, string, string][] = [
  ["4:5", "인스타 피드", "세로"],
  ["1:1", "카톡·블로그", "정사각"],
  ["9:16", "스토리·쇼츠", "길쭉"],
]
/** The old 기본형/고급형 screens, hidden since plan C; open the app with ?premiumui to see them (development, checks). */
const premiumUi = typeof location !== "undefined" && new URLSearchParams(location.search).has("premiumui")

/** 기본형 (free motion video) or 고급형 (paid AI video), chosen under the photo. */
function VideoModeToggle({ value, premiumAvailable, easyMode, onChange, withVideo = true }: { value: "basic" | "premium"; premiumAvailable: boolean; easyMode: boolean; onChange: (value: "basic" | "premium") => void; withVideo?: boolean }) {
  const t = (text: string) => uiText(text, easyMode)
  const options: ["basic" | "premium", string, string][] = [
    ["basic", "기본형", "무료 · 바로 만들어요"],
    ["premium", "고급형", premiumAvailable ? (withVideo ? "AI 배경 + AI 영상 · 유료 · 약 3분" : "AI 배경 · 유료 · 약 1분") : "지금은 쓸 수 없어요"],
  ]
  const current = premiumAvailable ? value : "basic"
  return (
    <fieldset className="video-mode" role="radiogroup">
      <legend>{t(withVideo ? "영상은 어떻게 만들까요?" : "포스터는 어떻게 만들까요?")}</legend>
      <div>
        {options.map(([id, label, note], index) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={current === id}
            disabled={id === "premium" && !premiumAvailable}
            onClick={() => onChange(id)}
            {...radioNav(index, options.length, options.findIndex(([option]) => option === current), (next) => onChange(options[next][0]))}
          >
            <strong>{t(label)}</strong>
            <small>{t(note)}</small>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * 배경 바꾸기 popup (plan C): one question with two large answers, asked once per photo on 다음으로. Escape or the
 * backdrop closes it without an answer (nothing paid, the owner stays where they were). Focus starts on 바꾸기,
 * stays inside while it is open, and goes back to the button that opened it.
 */
function BackgroundAskDialog({ easyMode, onAnswer, onClose }: { easyMode: boolean; onAnswer: (change: boolean) => void; onClose: () => void }) {
  const t = (text: string) => uiText(text, easyMode)
  const first = useRef<HTMLButtonElement | null>(null)
  // Drawn inside the app shell, so on a PC (the phone frame) it stays inside the frame (reference-ui.css).
  const shell = document.querySelector(".reference-app")
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    // Everything behind the popup is inert while it is open: no taps, no Tab stops, not read out.
    const behind = shell ? [...shell.children].filter((el) => !el.classList.contains("bg-ask-backdrop") && !el.hasAttribute("inert")) : []
    behind.forEach((el) => el.setAttribute("inert", ""))
    first.current?.focus()
    return () => {
      behind.forEach((el) => el.removeAttribute("inert"))
      opener?.focus?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const dialog = (
    <div className="bg-ask-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div
        className="bg-ask"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bg-ask-title"
        aria-describedby="bg-ask-body"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose()
          if (event.key === "Tab") {
            const buttons = [...event.currentTarget.querySelectorAll("button")]
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
            const next = buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]
            next?.focus()
            event.preventDefault()
          }
        }}
      >
        <h2 id="bg-ask-title">{t("배경을 광고 사진처럼 바꿀까요?")}</h2>
        <p id="bg-ask-body">{t("AI가 제품은 그대로 두고 주변만 광고 사진처럼 바꿔요. 정보를 적는 동안 만들어 둘게요.")}</p>
        <div className="bg-ask-actions">
          <button ref={first} type="button" className="studio-primary" onClick={() => onAnswer(true)}>{t("바꾸기")}</button>
          <button type="button" className="studio-secondary" onClick={() => onAnswer(false)}>{t("그대로 쓰기")}</button>
        </div>
        <small>{t("결과에서 원래 사진으로 되돌릴 수 있어요.")}</small>
      </div>
    </div>
  )
  return shell ? createPortal(dialog, shell) : dialog
}

/** 고급형 "특별 연출" on the 정보 입력 step: off = the safe push-in (default), on = the bold concept film. */
function SpecialFilmToggle({ value, easyMode, onChange }: { value: boolean; easyMode: boolean; onChange: (value: boolean) => void }) {
  const t = (text: string) => uiText(text, easyMode)
  return (
    <button type="button" id="field-special-film" className="video-special" role="switch" aria-checked={value} onClick={() => onChange(!value)}>
      <span>
        <strong>{t("고급형 특별 연출")}</strong>
        <small>{t(value ? "켜짐 · 배경이 다른 세계로 바뀌어요. 제품 모양이 조금 달라질 수 있어요" : "꺼짐 · 제품은 그대로, 카메라가 천천히 다가가요")}</small>
      </span>
      <i aria-hidden="true" />
    </button>
  )
}

// 홍보 글 channels shown as chips; labels are the names shop owners use. Three at most (owner, 2026-10-19), picked from
// the nine B_이창훈/prompt.mjs CHANNEL_STYLES can write for: the three places small shops post most. KakaoTalk goes
// through the share button; a record saved with another channel still shows its text.
const copyChannelOptions: [Channel, string][] = [
  ["instagram", "인스타그램"],
  ["naver_place", "네이버 플레이스"],
  ["daangn", "당근"],
]

const toneValues: readonly Tone[] = ["natural", "premium", "friendly", "trendy"]

const toneOptions: { value: Tone | ""; label: string; name: string }[] = [
  { value: "", label: "자동", name: "AI 자동 추천" },
  { value: "natural", label: "자연", name: "자연스럽고 건강한" },
  { value: "premium", label: "고급", name: "고급스럽고 전문적인" },
  { value: "friendly", label: "친근", name: "친근하고 따뜻한" },
  { value: "trendy", label: "트렌디", name: "트렌디하고 활기찬" },
]

// Closing line added to every channel copy so the chosen mood is visible in the result.
// With several moods the first one chosen leads (see toneClosing).
// Same rules as the AI copy (api/_lib/promo-prompt.js, B_이창훈): no clichés such as 정성/특별한/최고,
// no unverified rankings ("가장 많이 찾는").
const toneLines: Record<Tone, string> = {
  natural: "꾸밈없이 있는 그대로 담았어요.",
  premium: "소중한 날, 고마운 분께 권하기 좋아요.",
  friendly: "편하게 들러 주세요. 반갑게 맞이할게요!",
  trendy: "가볍게 들러서 지금 바로 만나 보세요!",
}

/** Reads `tones`, or migrates the old single `tone` value ("" = 자동). */
function normalizeTones(details: { tones?: unknown; tone?: unknown }): Tone[] {
  const raw = Array.isArray(details.tones) ? details.tones : typeof details.tone === "string" ? [details.tone] : []
  return [...new Set(raw.filter((tone): tone is Tone => toneValues.includes(tone as Tone)))]
}

function toneClosing(tones: readonly Tone[]) {
  return tones.length ? toneLines[tones[0]] : ""
}

// Mirrors api/_lib/promo.js featureText(): ≤20 items of ≤40 chars, joined with ", " to ≤300 chars.
// Over-long lists are cut here because the server rejects them instead of trimming.
function promoKeyFeatures(keywords: string) {
  const items: string[] = []
  let length = 0
  for (const raw of keywords.split(",")) {
    const item = Array.from(raw.replace(/\s+/g, " ").trim()).slice(0, 40).join("").trim()
    if (!item) continue
    const next = length + (items.length ? 2 : 0) + item.length
    if (items.length === 20 || next > 300) break
    items.push(item)
    length = next
  }
  return items
}

/** Identifies the inputs an AI 홍보 글 was written for, so edited inputs fall back to local copy. */
function promoSignature(details: GeneratedRecord["details"], channel: Channel) {
  return JSON.stringify([
    channel,
    details.name?.trim() ?? "",
    details.shopName?.trim() ?? "",
    details.description.trim(),
    details.features.trim(),
    details.keywords?.trim() ?? "",
    details.audience.trim(),
    details.location?.trim() ?? "",
    details.priceInfo?.trim() ?? "",
    details.contact?.trim() ?? "",
    normalizeTones(details),
  ])
}

/** Joins the AI copy into the 홍보 글 text; makes sure the product name appears. */
/** True when two paragraphs share a run of `limit` characters (spaces/punctuation ignored), like B's REPEAT_LIMIT. */
function repeatsText(a: string, b: string, limit = 12) {
  const squeeze = (value: string) => value.replace(/[\s.,!?·~"'“”‘’()[\]…-]/g, "")
  const x = squeeze(a)
  const y = squeeze(b)
  for (let i = 0; i + limit <= x.length; i += 1) if (y.includes(x.slice(i, i + limit))) return true
  return false
}

function composePromoText(promo: PromoTextResult, details: GeneratedRecord["details"]) {
  const name = details.name?.trim() ?? ""
  // The model sometimes writes the intro as a copy of the SNS text; showing both reads as a mistake.
  const withoutName = (value: string) => (name ? value.split(name).join("") : value)
  const intro = promo.intro && promo.sns && repeatsText(withoutName(promo.sns), withoutName(promo.intro)) ? "" : promo.intro
  const text = [promo.copy, promo.sns, intro].filter(Boolean).join("\n\n")
  return name && !text.includes(name) ? `${name}\n\n${text}` : text
}

/** How long 홍보물 만들기 waits for the AI 홍보 글 before using the local template. */
const PROMO_WAIT_MS = 21_000
// Another channel picked on the result screen: the owner is looking at 글을 맞추는 중, so it may take longer. On Vercel a
// second channel took about 10 s (2026-10-20), and with a phone network the 12 s cap fell back to the plain text
// without first-line choices ("다른 채널은 문구가 아예 안 뜬다").
const PROMO_SWITCH_WAIT_MS = 25_000

const MAX_PHOTO_SIZE = 10 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]

const creationNames: Record<CreationType, string> = {
  all: "한 번에 완성",

  poster: "이미지 만들기",

  video: "동영상 만들기",

  copy: "홍보 글 만들기",
}

// Restore the result help menus by enabling this flag.
const RESULT_SECONDARY_FEATURES_ENABLED = false

const initialDetails = {
  shopName: "",
  name: "",
  description: "",

  features: "",

  audience: "",

  keywords: "",

  tones: [] as Tone[],
}

const outputFormatNames: Record<OutputFormat, string> = {
  poster: "포스터",

  video: "영상",

  both: "포스터와 영상 둘 다",
}


const knownRegions = new Set([
  "서울",

  "부산",

  "대구",

  "인천",

  "광주",

  "대전",

  "울산",

  "세종",

  "경기",

  "강원",

  "충북",

  "충남",

  "전북",

  "전남",

  "경북",

  "경남",

  "제주",
])

const hashtagStopWords = new Set([
  "사용하",
  "있어",
  "확인해",
  "주세요",
  "정성",

  "담아",

  "만든",

  "직접",

  "우리",

  "가게",

  "대표",

  "제품",

  "좋은",

  "꼼꼼한",

  "완성한",

  "특별한",

  "중요하게",

  "생각하는",

  "고객",

  "분들",

  "추천",
])

function cleanKeyword(word: string) {
  return word

    .replace(/[^\p{L}\p{N}]/gu, "")

    .replace(/(입니다|이에요|예요|합니다|해요|입니다만)$/u, "")

    .replace(/(에서|에게|으로|로|와|과|을|를|은|는|이|가|의)$/u, "")
}

function extractHashtagKeywords(value: string) {
  const rawWords = value

    .split(/\s+/)

    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))

    .filter(Boolean)

  const keywords: string[] = []

  for (let index = 0; index < rawWords.length; index += 1) {
    const rawWord = rawWords[index]

    const keyword = cleanKeyword(rawWord)

    if (!keyword || keyword.length < 2) continue

    const regionCandidate = rawWord.replace(/(에서|의)$/u, "")

    if (knownRegions.has(regionCandidate)) {
      keywords.push(regionCandidate)

      continue
    }

    if (hashtagStopWords.has(keyword)) continue

    if (keyword === "수제") {
      const nextKeyword = cleanKeyword(rawWords[index + 1] ?? "")

      if (
        nextKeyword &&
        nextKeyword.length > 1 &&
        !hashtagStopWords.has(nextKeyword)
      ) {
        keywords.push(`수제${nextKeyword}`)

        index += 1
      }

      continue
    }

    keywords.push(keyword)
  }

  return keywords
}

function makeHashtags(
  channel: Channel,

  details: {
    description: string

    features: string

    audience: string

    keywords?: string

    name?: string

    shopName?: string

    location?: string
  },
) {
  // B_이창훈 rule: tags without spaces, ≤10 characters. The product and shop names lead so a
  // name-only input still gets tags.
  const nameTag = (value?: string) => (value ?? "").replace(/[^0-9A-Za-z가-힣]/g, "")
  const keywords = [
    // The neighbourhood ("서울 망원동" → #망원동) is how locals search.
    ...[nameTag(details.name), nameTag(details.shopName), nameTag(details.location?.trim().split(/s+/).pop())].filter((tag) => tag.length > 1 && tag.length <= 10),

    ...(details.keywords ?? "").split(",").map((item) => item.replace(/[^0-9A-Za-z가-힣]/g, "")).filter((item) => item.length > 1),

    ...extractHashtagKeywords(details.description),

    ...extractHashtagKeywords(details.features),

    ...extractHashtagKeywords(details.audience),
  ]

  return [...new Set(keywords)]

    .slice(0, channelThemes[channel].tagLimit)

    .map((tag) => `#${tag}`)
}

function initialHashtagValues(
  details: {
    description: string

    features: string

    audience: string

    name?: string

    shopName?: string
  } = initialDetails,
) {
  return mapChannels((channel) => makeHashtags(channel, details).join(" "))
}

function normalizeHashtagValues(
  value: unknown,

  details: {
    description: string

    features: string

    audience: string
  } = initialDetails,
): Record<Channel, string> {
  const fallback = initialHashtagValues(details)

  const candidate =
    value && typeof value === "object"
      ? value as Partial<Record<Channel, unknown>>
      : {}

  return mapChannels((id) =>
    typeof candidate[id] === "string" ? candidate[id] as string : fallback[id],
  )
}

function parseHashtags(value: unknown) {
  return (typeof value === "string" ? value : "")

    .split(/[\s,]+/)

    .map((tag) => tag.trim())

    .filter(Boolean)

    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)

    image.onerror = () => reject(new Error("image-load-failed"))

    image.src = src
  })
}

function drawImageCover(
  context: CanvasRenderingContext2D,

  image: HTMLImageElement,

  width: number,

  height: number,
) {
  const scale = Math.max(
    width / image.naturalWidth,

    height / image.naturalHeight,
  )

  const drawWidth = image.naturalWidth * scale

  const drawHeight = image.naturalHeight * scale

  context.drawImage(
    image,

    (width - drawWidth) / 2,

    (height - drawHeight) / 2,

    drawWidth,

    drawHeight,
  )
}


/** "바닐라_라떼_포스터_20261016.png" — product name and date, like D_고혜숙's generatePosterFilename. */
function outputFileName(title: string, kind: string, extension: string) {
  // Array.from keeps emoji (surrogate pairs) whole when cutting.
  const safe = Array.from(title.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "")).slice(0, 30).join("") || "홍보잇다"
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  return `${safe}_${kind}_${date}.${extension}`
}

/**
 * Adds a UTF-8 iTXt chunk to a PNG (after IHDR). Used to mark posters whose text an AI wrote, the
 * machine-readable half of the AI 표시 rule (인공지능기본법 제31조); the result screen says it visibly.
 */
async function withPngText(blob: Blob, keyword: string, text: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const encode = (value: string) => new TextEncoder().encode(value)
  // keyword \0, compression flag 0, method 0, language "" \0, translated keyword "" \0, text
  const data = new Uint8Array([...encode(keyword), 0, 0, 0, 0, 0, ...encode(text)])
  const type = encode("iTXt")
  let crc = ~0
  for (const byte of [...type, ...data]) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  chunk.set(type, 4)
  chunk.set(data, 8)
  view.setUint32(8 + data.length, ~crc >>> 0)
  const afterHeader = 33 // 8-byte signature + 25-byte IHDR chunk
  return new Blob([bytes.slice(0, afterHeader), chunk, bytes.slice(afterHeader)], { type: "image/png" })
}

/** A phone with a touch screen, where saving should go to the photo gallery via the share sheet. */
const isTouchPhone = () => isMobileDevice() && window.matchMedia?.("(pointer: coarse)").matches === true

/**
 * Saves a result. On a phone the share sheet opens so "이미지 저장 / 동영상 저장" puts it in the photo
 * gallery (a plain download lands in the Files app on iPhone). Elsewhere, or if sharing fails, it downloads.
 */
function triggerFileDownload(file: File) {
  if (isTouchPhone() && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file] }).catch((error: unknown) => {
      if ((error as { name?: string })?.name !== "AbortError") downloadFile(file)
    })
    return
  }
  downloadFile(file)
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)

  const anchor = document.createElement("a")

  anchor.href = url

  anchor.download = file.name

  document.body.appendChild(anchor)

  anchor.click()

  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function PrimaryButton({
  children,

  onClick,

  disabled = false,

  type = "button",

  className = "",
}: {
  children: ReactNode

  onClick?: () => void

  disabled?: boolean

  type?: "button" | "submit"

  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`studio-primary w-full sm:w-auto ${className}`}
    >
      {children}
    </button>
  )
}

function ResultCardHeading({
  icon,
  title,
  control,
  extra,
  easyMode = false,
}: {
  icon: "picture" | "video" | "copy"
  title: string
  control?: ReactNode
  /** Extra controls under the main one (e.g. the poster shape picker). */
  extra?: ReactNode
  easyMode?: boolean
}) {
  return (
    <div className="result-card-heading">
      <span aria-hidden="true"><Icon name={icon} size={22} /></span>
      <div className="result-card-title">
        <h3>{easyMode ? title : `${title} 결과`}</h3>
        <small>{uiText("바로 쓸 수 있어요", easyMode)}</small>
      </div>
      {(control || extra) && <div className="result-preview-controls">{control}{extra}</div>}
    </div>
  )
}

/** Radio group keyboard behaviour: one Tab stop (the checked option), arrow keys move and select. */
function radioNav(index: number, count: number, selected: number, pick: (index: number) => void) {
  return {
    tabIndex: index === (selected < 0 ? 0 : selected) ? 0 : -1,
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
      if (!step) return
      event.preventDefault()
      const next = (index + step + count) % count
      pick(next)
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
    },
  }
}

/**
 * Poster shape: three choices by where it will be posted, always in view right under the poster (owner,
 * 2026-10-19: "at most three choices at a time, for everyone"; the old folded picker had 12 — size, layout, colour —
 * and opened below the poster, so every change meant scrolling back up). The layout is 사진 크게 and the colour
 * follows the photo; records saved with another layout or colour still draw as saved until a size is picked.
 */
function PosterStyleControls({
  ratio,
  easyMode,
  onChange,
}: {
  ratio: PosterRatioKey
  easyMode: boolean
  onChange: (next: { posterRatio: PosterRatioKey; posterLayout: PosterLayoutKey; posterTheme: "" }) => void
}) {
  const t = (text: string) => uiText(text, easyMode)
  const groupRef = useRef<HTMLFieldSetElement>(null)
  // The new size changes the poster's height, which pushed the choices out of view on the basic screen (UX audit
  // 2026-10-20): once the new poster is drawn, the choices are brought back into view.
  const pick = (posterRatio: PosterRatioKey) => {
    onChange({ posterRatio, posterLayout: "vertical", posterTheme: "" })
    for (const wait of [250, 700]) window.setTimeout(() => groupRef.current?.scrollIntoView({ block: "nearest" }), wait)
  }
  const selected = posterRatioOptions.findIndex(([id]) => id === ratio)
  return (
    <fieldset ref={groupRef} className="poster-use" role="radiogroup">
      <legend className="sr-only">{t("어디에 올릴 포스터인가요?")}</legend>
      <div>
        {posterRatioOptions.map(([id, label], index) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={ratio === id}
            onClick={() => pick(id)}
            {...radioNav(index, posterRatioOptions.length, selected, (next) => pick(posterRatioOptions[next][0]))}
          >
            <span>{t(label)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ResultPreview({ children, text = false }: { children: ReactNode; text?: boolean }) {
  return <div className={`result-preview${text ? " result-preview--copy" : ""}`}>{children}</div>
}

function AutoSizeTextarea({
  resizeKey,
  ...props
}: ComponentPropsWithoutRef<"textarea"> & { resizeKey?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const field = ref.current
    if (!field) return
    let active = true
    let width = field.clientWidth
    const resize = () => {
      if (!active) return
      field.style.height = "auto"
      const style = getComputedStyle(field)
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
      field.style.height = `${field.scrollHeight + border}px`
      field.scrollTop = 0
    }
    resize()
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== width) {
        width = field.clientWidth
        resize()
      }
    })
    observer.observe(field)
    void document.fonts.ready.then(resize)
    return () => { active = false; observer.disconnect() }
  }, [props.value, resizeKey])
  return <textarea {...props} ref={ref} />
}

function ResultActionBar({
  label,
  accessibleLabel,
  icon,
  onClick,
  disabled = false,
  busy = false,
  message = "",
  error = false,
  onShare,
  shareMessage = "",
  shareDisabled = false,
  shareLabel = "공유하기",
}: {
  shareLabel?: string
  label: string
  accessibleLabel: string
  icon: "download" | "copy" | null
  onClick: () => unknown
  disabled?: boolean
  busy?: boolean
  message?: string
  error?: boolean
  onShare?: () => unknown
  shareMessage?: string
  shareDisabled?: boolean
}) {
  const statusId = useId()
  return (
    <div className="result-card-actions" aria-busy={busy}>
      <div className="result-action-buttons">
      <button
        type="button"
        className={`result-primary-action${busy ? " is-cancel" : ""}`}
        aria-label={accessibleLabel}
        aria-describedby={message ? statusId : undefined}
        disabled={disabled}
        onClick={async (event) => {
          const button = event.currentTarget
          try {
            await onClick()
          } finally {
            if (button.isConnected && !button.disabled && document.activeElement === document.body) {
              button.focus({ preventScroll: true })
            }
          }
        }}
      >
        {icon && <Icon name={icon} />}
        <span>{label}</span>
      </button>
      {onShare && <button type="button" className="result-share-action" disabled={shareDisabled || busy} onClick={async (event) => {
        const button = event.currentTarget
        try { await onShare() } finally {
          if (button.isConnected && document.activeElement === document.body) button.focus({preventScroll:true})
        }
      }}>
        <Icon name="share" /><span>{shareLabel}</span>
      </button>}
      </div>
      {shareMessage && <p className="result-share-status" role="status" aria-atomic="true">{shareMessage}</p>}
      {message && (
        <p
          id={statusId}
          className={`result-inline-status${error ? " is-error" : ""}`}
          role={error ? "alert" : "status"}
          aria-atomic="true"
        >
          {message}
        </p>
      )}
    </div>
  )
}

function StepHeader({
  step,
  onBack,
  easyMode,
}: {
  step: Step
  onBack: (step: Step) => void
  easyMode: boolean
}) {
  const stepGuides: Record<Step, {
    title: string

    description: string
  }> = {
    1: {
      title: "사진을 올려 주세요",

      description: "제품이나 가게 사진 한 장을 준비해 주세요.",
    },

    2: {
      title: "가게와 제품을 알려 주세요",

      description: "제품의 특징을 적어 주세요.",
    },

    3: {
      title: "홍보물이 준비됐어요",

      description:
        "선택한 결과와 홍보 문구를 확인하고 필요한 파일을 저장해 주세요.",
    },
  }

  return (
    <div className="creation-header">
      <StepProgress step={step} onBack={onBack} easyMode={easyMode} />
      <div className={step < 3 ? "sr-only" : "mt-5"}>
        <h2
          data-screen-heading
          tabIndex={-1}
          className="text-[26px] font-bold leading-tight text-[#222222] sm:text-[28px]"
        >
          {uiText(stepGuides[step].title, easyMode)}
        </h2>
        <p className="mt-2 text-[18px] leading-7 text-[#545454]">
          {uiText(stepGuides[step].description, easyMode)}
        </p>
      </div>
    </div>
  )
}

function CreateFlow({
  type,

  step,

  setStep,

  channel,
  setChannel,


  imageUrl,

  setImageUrl,

  details,

  setDetails,

  recommendedHashtagsByChannel,

  setRecommendedHashtagsByChannel,

  userHashtagsByChannel,

  setUserHashtagsByChannel,

  outputFormat,
  onOutputFormatChange,
  continuationNotice,

  onDraftTouched,

  easyMode,

  onResultCreated,
  onResultFile,

  onDashboard,

  onStartNew,
  onResultTabChange,
  initialResultTab,
  onGeneratingChange,
  aiPromo,
  setAiPromo,
  aiVideo,
  sceneImage,
  setSceneImage,
  onStopSpeech,
}: {
  onStopSpeech?: () => void
  type: CreationType

  step: Step

  setStep: (step: Step) => void

  channel: Channel
  setChannel: (channel: Channel) => void


  imageUrl: string

  setImageUrl: (url: string) => void

  details: GeneratedRecord["details"]

  setDetails: (details: GeneratedRecord["details"]) => void

  recommendedHashtagsByChannel: Record<Channel, string> | undefined

  setRecommendedHashtagsByChannel: (hashtags: Record<Channel, string>) => void

  userHashtagsByChannel: Record<Channel, string> | undefined

  setUserHashtagsByChannel: (hashtags: Record<Channel, string>) => void

  outputFormat: OutputFormat
  onOutputFormatChange: (format: OutputFormat) => void
  continuationNotice: boolean

  onDraftTouched: () => void

  easyMode: boolean

  onResultCreated: () => void
  /** The poster or video file the moment it is ready (saved to the server for signed-in owners). */
  onResultFile?: (kind: "poster" | "video", file: Blob) => void

  onDashboard: () => void

  onStartNew: () => void
  onResultTabChange: () => void
  initialResultTab: "poster" | "video" | "copy"
  onGeneratingChange?: (generating: boolean) => void
  aiPromo: AiPromo | null
  setAiPromo: (promo: AiPromo | null) => void
  aiVideo: AiVideoController
  /** 고급형 scene picture for the photo it was made from (kept in App so 내 홍보물 can save and reopen it). */
  sceneImage: { forImage: string; url: string } | null
  setSceneImage: (scene: { forImage: string; url: string } | null) => void
}) {
  const { notify } = useFeedback()
  const t = (text: string) => uiText(text, easyMode)
  const saveLabel = isMobileDevice() ? "폰에 저장" : "컴퓨터에 저장"
  // 말로 쓰기 (쉬운 화면): one session for the info step; stops 화면 설명 듣기 before listening.
  const voice = useVoiceInput(onStopSpeech)
  useEffect(() => {
    if (step !== 2 || !easyMode) voice.cancel()
  }, [step, easyMode]) // eslint-disable-line react-hooks/exhaustive-deps
  const [playing, setPlaying] = useState(false)
  const [selectedResultTab, setSelectedResultTab] =
    useState<"poster" | "video" | "copy">(initialResultTab)

  const [copyMessage, setCopyMessage] = useState("")

  const [posterStatus, setPosterStatus] = useState<FileStatus>("idle")
  const [posterPreviewStatus, setPosterPreviewStatus] = useState<FileStatus>("idle")
  const [generating, setGenerating] = useState(false)
  useEffect(() => {
    if (step !== 3) setGenerating(false)
  }, [step])
  useEffect(() => {
    onGeneratingChange?.(generating)
    return () => onGeneratingChange?.(false)
  }, [generating, onGeneratingChange])
  // Focus the result heading once the result screen has actually rendered (a rAF from onDone could
  // run before the commit and leave focus on <body>).
  const focusResultRef = useRef(false)
  useEffect(() => {
    if (generating || !focusResultRef.current) return
    focusResultRef.current = false
    document.querySelector<HTMLElement>(".result-screen-heading [data-screen-heading]")?.focus({ preventScroll: true })
  }, [generating])
  const [posterRetry, setPosterRetry] = useState(0)
  const [posterPreviewUrl, setPosterPreviewUrl] = useState("")
  const [posterVisibleText, setPosterVisibleText] = useState("")
  const [posterExpanded, setPosterExpanded] = useState(false)
  const posterPreviewRef = useRef<HTMLDivElement>(null)
  const posterPreviewFileRef = useRef<File | null>(null)

  const [videoStatus, setVideoStatus] = useState<FileStatus>("idle")

  const [videoMessage, setVideoMessage] = useState("")

  const [uploadMessage, setUploadMessage] = useState("")
  const [uploadPending, setUploadPending] = useState(false)
  const detailsPhotoRef = useRef<HTMLInputElement>(null)
  const [nameTouched, setNameTouched] = useState(false)

  const uploadRequestRef = useRef(0)
  useEffect(() => {
    uploadRequestRef.current += 1
    setUploadPending(false)
    setUploadMessage("")
    setNameTouched(false)
    return () => {
      uploadRequestRef.current += 1
    }
  }, [type])

  const missingFields = [
    !details.name?.trim() && "제품 이름",
  ].filter(Boolean)

  const tones = normalizeTones(details)
  const tonesKey = tones.join(",")

  // ---- Photo auto-fill (AI). Only fields that are empty — or still hold an earlier AI suggestion —
  // and that the user never edited are filled; stale answers are ignored.
  const detailsRef = useRef(details)
  detailsRef.current = details
  const userEditedRef = useRef(new Set<string>())
  const aiFilledRef = useRef<Partial<Record<string, string>>>({})
  const aiEligibleImageRef = useRef("")
  const analyzedImageRef = useRef("")
  const [photoFill, setPhotoFill] = useState<"idle" | "loading" | "filled" | "failed">("idle")
  // The owner asks for it (owner, 2026-10-19): the photo is read by the AI only when "자동으로 채워 주기" is pressed,
  // not the moment it is added — no AI call for anyone who types themselves, and nothing filled in unasked.
  const [scanImage, setScanImage] = useState("")
  // AI photo check (from the same analysis): shown on the photo step only if it arrives while the
  // user is still there; after moving on it is dropped so nothing interrupts.
  const [aiPhotoCheck, setAiPhotoCheck] = useState<{ image: string; check: PhotoCheck } | null>(null)
  const stepRef = useRef(step)
  stepRef.current = step
  // What the photo shows (colour, texture, plating…) for the 홍보 글 prompt; kept per photo, never waited for.
  const photoDetailsRef = useRef<{ image: string; details: string[]; box: [number, number, number, number] | null }>({ image: "", details: [], box: null })
  const [photoBox, setPhotoBox] = useState<{ image: string; box: [number, number, number, number] } | null>(null)
  const startPhotoAnalysis = (image: string) => {
    void analyzePhotoOnce(image).then((result) => {
      if (result) photoDetailsRef.current = { image, details: result.visualDetails ?? [], box: result.subjectBox ?? null }
      if (result?.subjectBox) setPhotoBox({ image, box: result.subjectBox })
      const check = result?.photoCheck
      if (check && (!check.isRealPhoto || check.isBlurry) && stepRef.current === 1) setAiPhotoCheck({ image, check })
    })
  }

  useEffect(() => {
    if (imageUrl) return
    // A new creation starts without a photo: forget what belonged to the previous one.
    userEditedRef.current.clear()
    aiFilledRef.current = {}
    aiEligibleImageRef.current = ""
    analyzedImageRef.current = ""
  }, [imageUrl])

  useEffect(() => {
    if (step !== 2 || !imageUrl || scanImage !== imageUrl || aiEligibleImageRef.current !== imageUrl || analyzedImageRef.current === imageUrl) return
    const controller = new AbortController()
    setPhotoFill("loading")
    void analyzePhotoOnce(imageUrl).then((suggestion) => {
      if (controller.signal.aborted) return
      analyzedImageRef.current = imageUrl
      // No answer for this photo: what the AI wrote for an earlier photo no longer fits, so it is cleared too.
      const applied = applyPhotoSuggestion(suggestion ?? EMPTY_SUGGESTION)
      // A failed analysis is said out loud, so the owner knows to type instead of waiting (not when AI is off).
      setPhotoFill(suggestion ? (applied ? "filled" : "idle") : isAiUnavailable() ? "idle" : "failed")
    })
    return () => {
      controller.abort()
      setPhotoFill("idle")
    }
  }, [step, imageUrl, scanImage])
  const scanPhoto = () => {
    if (!imageUrl) return
    // The same single analysis also gives what the photo shows (for the 홍보 글) and where the product is (poster).
    startPhotoAnalysis(imageUrl)
    setScanImage(imageUrl)
  }

  const applyPhotoSuggestion = (suggestion: PhotoSuggestion) => {
    const current = detailsRef.current
    const next: GeneratedRecord["details"] = { ...current }
    const filled = aiFilledRef.current
    const fillable = (key: string, value: string) =>
      !userEditedRef.current.has(key) && (!value.trim() || value === filled[key])
    const textFields: [keyof GeneratedRecord["details"] & string, string][] = [
      ["name", suggestion.productName],
      ["description", suggestion.description],
      ["features", suggestion.highlights],
      ["keywords", suggestion.keyFeatures.join(", ")],
      ["audience", suggestion.targetAudience],
    ]
    let changed = false
    for (const [key, value] of textFields) {
      const currentValue = String(current[key] ?? "")
      // The new photo has nothing for this field: an AI value from the previous photo (not edited by the owner)
      // would describe the wrong thing, so it is cleared.
      if (!value && filled[key] && currentValue === filled[key] && !userEditedRef.current.has(key)) {
        Object.assign(next, { [key]: "" })
        delete filled[key]
        changed = true
        continue
      }
      if (!value || !fillable(key, currentValue) || currentValue === value) continue
      Object.assign(next, { [key]: value })
      filled[key] = value
      changed = true
    }
    const currentTones = normalizeTones(current)
    const suggestedTones = normalizeTones({ tones: suggestion.tones })
    if (suggestedTones.length && fillable("tones", currentTones.join(",")) && currentTones.join(",") !== suggestedTones.join(",")) {
      next.tones = suggestedTones
      filled.tones = suggestedTones.join(",")
      changed = true
    }
    if (!changed) return false
    detailsRef.current = next
    setDetails(next)
    return true
  }

  // ---- AI 홍보 글: requested when 홍보물 만들기 is pressed, in parallel with the local result.
  const promoControllerRef = useRef<AbortController | null>(null)
  const [promoPending, setPromoPending] = useState(false)
  useEffect(() => () => promoControllerRef.current?.abort(), [])
  const cancelPromoRequest = () => {
    promoControllerRef.current?.abort()
    promoControllerRef.current = null
    setPromoPending(false)
  }
  // One AI answer per channel and inputs, so going back to a channel shows its text without a new request.
  const promoCacheRef = useRef(new Map<string, AiPromo>())
  const requestPromoText = (forChannel: Channel = channel, waitMs = PROMO_WAIT_MS) => {
    cancelPromoRequest()
    const signature = promoSignature(details, forChannel)
    if (aiPromo?.signature === signature) return
    const cached = promoCacheRef.current.get(signature)
    if (cached) {
      setAiPromo(cached)
      return
    }
    setAiPromo(null)
    const controller = new AbortController()
    promoControllerRef.current = controller
    setPromoPending(true)
    void generatePromoText(
      {
        productName: details.name?.trim() ?? "",
        productDescription: details.description.trim(),
        highlights: details.features.trim().slice(0, 1000),
        keyFeatures: promoKeyFeatures(details.keywords ?? ""),
        // The server rejects (400) instead of cutting, which would silently drop to the template text.
        targetAudience: Array.from(details.audience.trim()).slice(0, 200).join(""),
        tones,
        shopName: details.shopName?.trim(),
        location: details.location?.trim() || undefined,
        priceInfo: details.priceInfo?.trim() || undefined,
        contact: details.contact?.trim() || undefined,
        visualDetails: photoDetailsRef.current.image === imageUrl ? photoDetailsRef.current.details : undefined,
        channel: forChannel,
      },
      { signal: controller.signal, timeoutMs: waitMs },
    ).then((result) => {
      if (promoControllerRef.current !== controller) return
      promoControllerRef.current = null
      if (result) {
        const promo = { ...result, signature }
        promoCacheRef.current.set(signature, promo)
        setAiPromo(promo)
      }
      setPromoPending(false)
    })
  }

  const videoRecorderRef = useRef<MediaRecorder | null>(null)

  const videoFrameRef = useRef<number | null>(null)

  const videoCancelledRef = useRef(false)
  const videoTaskRef = useRef<Promise<File | null> | null>(null)
  const videoShareFileRef = useRef<File | null>(null)
  // The finished sample file, also played in the preview so what you see is exactly what is saved.
  const [sampleVideoFile, setSampleVideoFile] = useState<File | null>(null)
  const [shareMessages, setShareMessages] = useState<Partial<Record<"poster" | "video" | "copy", string>>>({})
  const videoContextRef = useRef(0)
  // 배경 바꾸기 (plan C, 2026-10-19): the owner's answer to the photo popup, the job's status, and which photo the
  // result uses ("원래 사진" when the AI changed how the product looks). The picture itself is sceneImage (kept
  // with the record). The poster and the 기본형 video use it as soon as it arrives.
  const [bgChoice, setBgChoice] = useState<{ forImage: string; change: boolean } | null>(null)
  const [bgState, setBgState] = useState<{ forImage: string; status: "making" | "ready" | "failed" | "limit" | "off" } | null>(null)
  const [photoPick, setPhotoPick] = useState<"changed" | "original">("changed")
  const bgControllerRef = useRef<AbortController | null>(null)
  const sceneUrl = photoPick === "changed" && sceneImage?.forImage === imageUrl ? sceneImage.url : ""

  useEffect(() => {
    videoContextRef.current += 1
    videoShareFileRef.current = null
    setSampleVideoFile(null)
    setShareMessages({})
    setPlaying(false)
    setPosterExpanded(false)

    setPosterStatus("idle")

    setVideoStatus("idle")

    setVideoMessage("")

    setCopyMessage("")

    const stopPreparation = () => {
      videoCancelledRef.current = true
      if (videoFrameRef.current !== null) {
        window.cancelAnimationFrame(videoFrameRef.current)
        videoFrameRef.current = null
      }
      if (videoRecorderRef.current?.state === "recording") {
        videoRecorderRef.current.stop()
      }
    }
    stopPreparation()
    return () => {
      videoContextRef.current += 1
      stopPreparation()
    }
  }, [
    step,
    type,

    outputFormat,

    channel,

    imageUrl,

    details.name,
    details.shopName,

    details.description,

    details.features,

    details.audience,

    details.keywords,

    tonesKey,
    // The advertising background arriving, or the owner switching 바뀐/원래 사진, makes a new video.
    sceneUrl,
  ])

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ""
    if (file) uploadFile(file)
  }

  const uploadFile = (file: File) => {
    const request = ++uploadRequestRef.current
    const keepNotice = imageUrl ? " 기존 사진은 그대로예요." : ""

    const fail = () => {
      if (request === uploadRequestRef.current) {
        setUploadPending(false)
        setUploadMessage(
          "새 사진을 읽지 못했어요." +
            keepNotice +
            " JPG, PNG, WebP 사진을 다시 선택해 주세요.",
        )
      }
    }

    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      setUploadPending(false)
      setUploadMessage("JPG, PNG, WebP 사진만 올릴 수 있어요." + keepNotice)
      return
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setUploadPending(false)
      setUploadMessage("10MB 이하의 사진을 선택해 주세요." + keepNotice)
      return
    }

    setUploadMessage("사진을 확인하고 있어요.")
    setUploadPending(true)

    const reader = new FileReader()

    reader.onerror = fail

    reader.onload = async () => {
      if (typeof reader.result === "string") {
        try {
          await loadCanvasImage(reader.result)

          if (request !== uploadRequestRef.current) return

          aiEligibleImageRef.current = reader.result
          setImageUrl(reader.result)
          setUploadPending(false)

          setUploadMessage("사진이 준비됐어요.")
          notify("upload")

          onDraftTouched()
        } catch {
          fail()
        }
      } else fail()
    }

    try {
      reader.readAsDataURL(file)
    } catch {
      fail()
    }
  }

  // The app's own 홍보 글 (src/localCopy.ts), shown whenever the AI text is not available.
  const resultCopy = mapChannels((id) => localCopy({ ...details, tones }, id))
  const body = localBody({ ...details, tones })
  const channelTheme = channelThemes[channel]

  const safeRecommendations = normalizeHashtagValues(
    recommendedHashtagsByChannel,

    details,
  )

  const safeUserHashtags = normalizeHashtagValues(
    userHashtagsByChannel,

    details,
  )

  // The AI 홍보 글 is used only while the inputs still match what it was written for.
  const activePromo = aiPromo && aiPromo.signature === promoSignature(details, channel) ? aiPromo : null
  // B_이창훈 writes three one-line angles; the user can pick one. It leads the 홍보 글 and the poster.
  const headlineOptions = activePromo
    ? [...new Set([activePromo.copy, ...(activePromo.copyCandidates ?? [])].filter(Boolean))].slice(0, 3)
    : []
  // Stored on the AI answer itself: a fresh answer starts at its own first line, and the record keeps the choice.
  const headlineIndex = Math.min(activePromo?.chosen ?? 0, Math.max(headlineOptions.length - 1, 0))
  const chosenHeadline = headlineOptions[headlineIndex] ?? activePromo?.copy ?? ""
  // AI 표시 at the moment a result leaves the app (save, share, copy), when an AI wrote part of it.
  const aiNote = (message: string) =>
    activePromo && message && !/못|실패|않/.test(message) ? `${message} ${t("AI가 쓴 글이 들어 있어요.")}` : message
  // Where the 홍보 글 will be posted (B_이창훈 channel styles). Picking one asks the AI once for that channel.
  const pickChannel = (next: Channel) => {
    if (next === channel) return
    setChannel(next)
    if (showCopy) requestPromoText(next, PROMO_SWITCH_WAIT_MS)
  }
  const pickHeadline = (index: number) => { if (activePromo) setAiPromo({ ...activePromo, chosen: index }) }
  const copyText = activePromo ? composePromoText({ ...activePromo, copy: chosenHeadline }, details) : resultCopy[channel]

  const hashtags = activePromo
    ? activePromo.hashtags.slice(0, Math.max(channelThemes[channel].tagLimit, 4)).map((tag) => `#${tag}`)
    : parseHashtags(safeUserHashtags[channel])

  const recommendationTags = parseHashtags(safeRecommendations[channel])

  const needsMoreKeywords = recommendationTags.length < channelTheme.minimum

  const showPoster =
    type === "poster" ||
    (type === "all" && (outputFormat === "poster" || outputFormat === "both"))

  const showVideo =
    type === "video" ||
    (type === "all" && (outputFormat === "video" || outputFormat === "both"))

  const showCopy = type === "copy" || type === "all"

  const resultTabs = [
    { id: "poster" as const, label: easyMode ? "포스터" : "이미지", available: showPoster },
    { id: "video" as const, label: easyMode ? "짧은 영상" : "영상", available: showVideo },
    { id: "copy" as const, label: "홍보 글", available: showCopy },
  ].filter((tab) => tab.available)
  const activeResultTab = resultTabs.some((tab) => tab.id === selectedResultTab)
    ? selectedResultTab
    : resultTabs[0].id
  const selectResultTab = (id: "poster" | "video" | "copy", focus = false) => {
    if (id !== activeResultTab) onResultTabChange()
    setSelectedResultTab(id)
    if (id !== "video") setPlaying(false)
    if (focus)
      document
        .getElementById(`result-tab-${id}`)
        ?.focus({ preventScroll: true })
  }

  // "다음: 영상 ▶" under a result, so the results can be gone through in order without knowing the tabs are tabs.
  const nextResultButton = (id: "poster" | "video" | "copy") => {
    const next = resultTabs[resultTabs.findIndex((tab) => tab.id === id) + 1]
    if (!next) return null
    return (
      <button
        type="button"
        className="result-next"
        onClick={() => {
          selectResultTab(next.id, true)
          document.querySelector(".result-tabs-bar")?.scrollIntoView({ block: "start" })
        }}
      >
        {t("다음")}: {next.label} <span aria-hidden="true">▶</span>
      </button>
    )
  }

  const finalText = `${copyText.trim()}\n\n${hashtags.join(" ")}`.trim()
  const updateDetails = (nextDetails: GeneratedRecord["details"]) => {
    for (const key of Object.keys(nextDetails) as (keyof GeneratedRecord["details"])[]) {
      if (nextDetails[key] !== details[key]) userEditedRef.current.add(key === "tone" ? "tones" : key)
    }
    detailsRef.current = nextDetails
    setDetails(nextDetails)

    onDraftTouched()
  }

  const copyFinalText = async () => {
    try {
      let copied = false

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(finalText)

          copied = true
        } catch {
          copied = false
        }
      }

      if (!copied) {
        const textarea = document.createElement("textarea")

        textarea.value = finalText

        textarea.style.position = "fixed"

        textarea.style.opacity = "0"

        textarea.setAttribute("readonly", "")

        document.body.appendChild(textarea)

        textarea.focus()

        textarea.select()

        textarea.setSelectionRange(0, textarea.value.length)

        copied = document.execCommand("copy")

        textarea.remove()
      }

      if (!copied) throw new Error("copy-failed")

      setCopyMessage(uiText("문구와 확정 해시태그를 복사했어요.", easyMode))
      notify("copy")
    } catch {
      setCopyMessage(uiText("복사하지 못했어요. 다시 시도해 주세요.", easyMode))
    }
  }

  const posterContent = {
    ...buildPosterContent(details, chosenHeadline || body, Boolean(chosenHeadline)),
    callToAction: activePromo?.cta || (details.shopName?.trim() ? `${details.shopName.trim()}에서 만나보세요` : ""),
  }
  const videoCaption = (() => {
    const name = details.name?.trim() ?? ""
    const shop = details.shopName?.trim() ?? ""
    const headline = activePromo?.videoHeadline || name || shop || details.description.trim()
    return {
      headline,
      // A name the headline already contains ("오늘 만든 크림 커피") is not repeated underneath.
      brand: [shop, name].filter((value) => value && !headline.includes(value)).join(" · "),
      cta: activePromo?.cta || (shop ? `${shop}에서 만나요` : ""),
    }
  })()
  // The same caption drawn into the 9:16 video file.
  const sampleCaption: VideoCaption = {
    eyebrow: details.shopName?.trim() || undefined,
    headline: videoCaption.headline,
    subline: details.name?.trim() && !videoCaption.headline.includes(details.name.trim()) ? details.name.trim() : undefined,
    price: details.priceInfo?.trim() || undefined,
    cta: videoCaption.cta || undefined,
  }
  // The real AI clip with the same caption, made once when it is ready (저장 / 공유하기 then need no wait).
  const [realVideoFile, setRealVideoFile] = useState<File | null>(null)
  const realVideoKey = aiVideo.state.phase === "completed" && aiVideo.state.videoUrl ? JSON.stringify([aiVideo.state.videoUrl, sampleCaption]) : ""
  useEffect(() => {
    setRealVideoFile(null)
    if (!realVideoKey || !aiVideo.state.videoUrl) return
    let live = true
    // 고급형 gets the quiet caption of the reference ad (drawElegantCaption); the invitation names the shop.
    const shop = details.shopName?.trim() ?? ""
    // The label above already names the shop, so the invitation names the place when there is one.
    const place = details.location?.trim() ?? ""
    // One message across the campaign: the film opens on the poster's line when it fits one caption line.
    const posterLine = posterContent.productDescription?.trim() ?? ""
    const headline = posterLine && posterLine.length <= 16 && posterLine !== details.name?.trim() ? posterLine : sampleCaption.headline
    const premiumCaption: VideoCaption = { ...sampleCaption, headline, cta: place ? `${place} 매장에서 만나보세요` : shop ? `${shop}에서 만나보세요` : sampleCaption.cta }
    void prepareAiVideoFile(aiVideo.state.videoUrl, shop || details.name?.trim() || "", premiumCaption, channelTheme.rgb, "elegant")
      .then((file) => { if (live) setRealVideoFile(file) })
      .catch(() => undefined)
    return () => { live = false }
  }, [realVideoKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // 고급형: one scene picture (about a minute), then the AI video from it. Without the scene (failed or
  // switched off) the AI video is made from the photo as before.
  const [sceneState, setSceneState] = useState<{ forImage: string; status: "making" | "ready" | "failed" | "off" } | null>(null)
  const sceneControllerRef = useRef<AbortController | null>(null)
  useEffect(() => () => sceneControllerRef.current?.abort(), [])
  const currentImageRef = useRef(imageUrl)
  currentImageRef.current = imageUrl
  const dropScene = () => {
    sceneControllerRef.current?.abort()
    sceneControllerRef.current = null
    setSceneState((current) => (current?.status === "making" ? null : current))
  }
  // A new photo or leaving the 만드는 중 / result step without a result: the scene being made no longer applies.
  useEffect(() => dropScene(), [imageUrl])
  useEffect(() => {
    if (step !== 3) dropScene()
  }, [step])

  // 배경 바꾸기: started the moment the owner answers 바꾸기, so it runs while they type (about 5–10 s with Flash-Lite Image). A new
  // photo cancels it and asks again; leaving a step does not (unlike the paid 고급형 video above).
  useEffect(() => () => bgControllerRef.current?.abort(), [])
  useEffect(() => {
    bgControllerRef.current?.abort()
    bgControllerRef.current = null
    setBgState((current) => (current?.forImage === imageUrl ? current : null))
    setPhotoPick("changed")
  }, [imageUrl])
  const startBackground = (forImage: string) => {
    if (sceneImage?.forImage === forImage) {
      setBgState({ forImage, status: "ready" })
      return
    }
    bgControllerRef.current?.abort()
    const controller = new AbortController()
    bgControllerRef.current = controller
    setBgState({ forImage, status: "making" })
    void makeAdBackground(forImage, { productName: details.name?.trim() || undefined, productDescription: details.description || undefined, highlights: details.features || undefined }, controller.signal).then((result) => {
      if (controller.signal.aborted || currentImageRef.current !== forImage) return
      if ("url" in result) {
        setSceneImage({ forImage, url: result.url })
        setBgState({ forImage, status: "ready" })
      } else {
        // Not set up (no key) or today's cap: plainly said, and the original photo is used.
        setBgState({ forImage, status: result.error === "AI_NOT_CONFIGURED" ? "off" : result.error === "BACKGROUND_DAILY_LIMIT" ? "limit" : "failed" })
      }
    })
  }
  // The popup asks once per photo, for posters and videos (a 홍보 글 alone has no picture to change). It opens on
  // the photo step's 다음으로, after any 흐려요/어두워요 warning is settled (never on top of it), and again on the
  // info step when the owner swaps the photo there.
  const [asking, setAsking] = useState(false)
  const needsAnswer = Boolean(imageUrl) && (showPoster || showVideo) && bgChoice?.forImage !== imageUrl
  const goToDetails = () => {
    if (needsAnswer) setAsking(true)
    else setStep(2)
  }
  useEffect(() => {
    if (step === 2 && bgChoice && needsAnswer && !uploadPending) setAsking(true)
  }, [imageUrl, uploadPending]) // eslint-disable-line react-hooks/exhaustive-deps
  const answerBackground = (change: boolean) => {
    setAsking(false)
    setBgChoice({ forImage: imageUrl, change })
    if (change) startBackground(imageUrl)
    else {
      bgControllerRef.current?.abort()
      setBgState(null)
    }
    if (step === 1) setStep(2)
  }
  const asksBackground = asking && Boolean(imageUrl) && (step === 1 || step === 2)
  const ownBg = bgState?.forImage === imageUrl ? bgState.status : undefined
  const bgNotice = !ownBg
    ? ""
    : ownBg === "making"
      ? "광고 배경을 만들고 있어요 · 30초 안팎. 다 되면 포스터와 영상이 바뀌어요."
      : ownBg === "ready"
        ? photoPick === "changed"
          ? "AI가 배경을 광고 사진처럼 바꿨어요. 제품이 달라 보이면 \"원래 사진\"을 골라 주세요."
          : "원래 사진으로 만들었어요."
        : ownBg === "limit"
          ? "오늘 배경 바꾸기를 다 써서 원래 사진으로 만들었어요."
          : ownBg === "off"
            ? "배경 바꾸기가 지금 꺼져 있어서 원래 사진으로 만들었어요."
            : "배경을 바꾸지 못해서 원래 사진으로 만들었어요."
  // The photo the current AI video job was started for (its own input may be the scene picture instead).
  const aiVideoForImageRef = useRef("")
  const startPremium = () => {
    const forImage = imageUrl
    const box = photoBox?.image === imageUrl ? photoBox.box : null
    // Two 고급형 films (owner's call, 2026-10-18):
    // - 특별 on: one clip from the ORIGINAL photo that changes the world around the product (owner's reference:
    //   쵸이셀). Bold, and the product may change a little. It starts at once; the scene is for the poster only.
    // - 특별 off (default): the scene picture first, then a slow push-in on it. The product stays exactly as it is
    //   (the showcase films, outputs/시연_최고결과물_2026-10-18).
    const special = Boolean(details.specialFilm) && showVideo
    const startFilm = (from: string, fromBox: typeof box) => {
      aiVideoForImageRef.current = forImage
      aiVideo.start({ imageUrl: from, details: special ? { ...toVideoDetails(details), style: "concept" } : toVideoDetails(details), box: fromBox })
    }
    if (special) startFilm(forImage, box)
    if (special && !showPoster) return
    if (sceneImage?.forImage === forImage) {
      setSceneState({ forImage, status: "ready" })
      if (showVideo && !special) startFilm(sceneImage.url, null)
      return
    }
    sceneControllerRef.current?.abort()
    const controller = new AbortController()
    sceneControllerRef.current = controller
    setSceneState({ forImage, status: "making" })
    void makeScene(forImage, { productName: details.name?.trim() ?? "", productDescription: details.description, highlights: details.features }, box, controller.signal).then((result) => {
      // Cancelled, or the photo changed meanwhile: never start a paid video for it.
      if (controller.signal.aborted || currentImageRef.current !== forImage) return
      if ("url" in result) {
        setSceneImage({ forImage, url: result.url })
        setSceneState({ forImage, status: "ready" })
        if (showVideo && !special) startFilm(result.url, null)
      } else {
        // Switched off on the server (no paid generation) is not a failure: say so plainly.
        setSceneState({ forImage, status: result.error === "VIDEO_NOT_CONFIGURED" ? "off" : "failed" })
        if (showVideo && !special) startFilm(forImage, box)
      }
    })
  }
  const specialFilm = Boolean(details.specialFilm) && showVideo
  // Plan C (2026-10-19): everyone gets 기본형 + 배경 바꾸기; the paid 고급형 video waits for [특급]
  // (docs/나중에_할일.md). Its screens stay reachable for development and the checks with ?premiumui.
  const videoMode = premiumUi ? details.videoMode ?? (hasPremiumCode() ? "premium" : "basic") : "basic"
  const sceneNotice = videoMode === "premium" && sceneState?.forImage === imageUrl
    ? sceneState.status === "making"
      ? specialFilm
        ? "고급형 포스터 배경을 만들고 있어요 · 약 1분. 다 되면 포스터가 바뀌어요."
        : "고급형 배경을 만들고 있어요 · 약 1분. 다 되면 포스터와 영상이 바뀌어요."
      : sceneState.status === "ready"
        ? specialFilm ? "AI가 포스터 배경을 바꿨어요." : "AI가 배경을 바꿨어요. 제품은 그대로예요."
        : sceneState.status === "off"
          ? "고급형(AI 배경)이 지금 꺼져 있어서 원래 사진으로 만들었어요."
          : specialFilm ? "포스터 배경을 바꾸지 못해서 원래 사진으로 만들었어요." : "배경을 바꾸지 못해서 원래 사진으로 만들었어요."
    : ""
  // 고급형 progress in three named steps, shown from the start until the finished film is ready.
  const premiumSteps = (() => {
    if (videoMode !== "premium" || (!["starting", "generating", "completed"].includes(aiVideo.state.phase) && sceneState?.status !== "making")) return null
    const ownScene = sceneState?.forImage === imageUrl ? sceneState.status : undefined
    // The scene is for the poster only: no poster, no scene step.
    const scene: PremiumStepState | null = ownScene === "making" ? "working" : ownScene === "ready" ? "done" : ownScene ? "skipped" : null
    // No video chosen → no film steps (nothing would ever start them).
    const camera: PremiumStepState | null = !showVideo ? null : aiVideo.state.phase === "completed" ? "done" : aiVideo.state.phase === "starting" || aiVideo.state.phase === "generating" ? "working" : "waiting"
    const edit: PremiumStepState | null = !showVideo ? null : realVideoFile ? "done" : showsRealVideo(aiVideo.state) ? "working" : "waiting"
    // The film and the poster scene run side by side: hide only when neither is still running.
    return (edit === null || edit === "done") && scene !== "working" ? null : { scene, camera, edit, special: specialFilm }
  })()
  // Preview = the file that will be saved: the captioned AI clip (고급형) or the 6-second motion video (기본형).
  const previewVideoFile = showsRealVideo(aiVideo.state) ? realVideoFile : sampleVideoFile
  const [previewVideoUrl, setPreviewVideoUrl] = useState("")
  useEffect(() => {
    if (!previewVideoFile) {
      setPreviewVideoUrl("")
      return
    }
    const url = URL.createObjectURL(previewVideoFile)
    setPreviewVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [previewVideoFile])
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const video = previewVideoRef.current
    if (!video) return
    // 재생하기 plays with sound (the owner heard nothing: the preview was always muted). A browser that refuses
    // sound still plays it silent rather than not at all; pausing mutes again for the quiet still frame.
    if (playing) {
      video.muted = false
      void video.play().catch(() => {
        video.muted = true
        return video.play()
      }).catch(() => setPlaying(false))
    } else {
      video.pause()
      video.muted = true
    }
  }, [playing, previewVideoUrl])
  // A copy of every result on this computer (local dev server only, src/localSave.ts): one folder per creation,
  // filled as each file becomes ready; a restyled poster or another channel's text replaces the earlier one.
  const [outputFolderName, setOutputFolderName] = useState("")
  useEffect(() => setOutputFolderName(""), [imageUrl])
  useEffect(() => {
    if (!outputFolderName) return
    const { tone: _tone, ...inputs } = details as typeof details & { tone?: unknown }
    void saveToComputer(outputFolderName, [{ name: "입력내용.json", text: JSON.stringify({ type, channel, ...inputs }, null, 2) }])
  }, [outputFolderName]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // The text the owner copies, hashtags included.
    if (outputFolderName && showCopy && finalText) void saveToComputer(outputFolderName, [{ name: "홍보글.txt", text: finalText }])
  }, [outputFolderName, finalText, showCopy])
  useEffect(() => {
    // The PNG is ready a moment after the quick preview (see the poster effect below), when the status says so.
    if (outputFolderName && posterPreviewStatus === "ready" && posterPreviewFileRef.current) void saveToComputer(outputFolderName, [{ name: "포스터.png", blob: posterPreviewFileRef.current }])
  }, [outputFolderName, posterPreviewUrl, posterPreviewStatus])
  // Signed-in owners: the finished poster and video also go to 내 홍보물 on the server (App saveResultFile).
  // Only once 만드는 중 is over: that is when the record (and its id) exists; before it, the id on hand is still
  // the previous record's, and a poster drawn early would be filed under it.
  useEffect(() => {
    if (step === 3 && !generating && posterPreviewStatus === "ready" && posterPreviewFileRef.current) onResultFile?.("poster", posterPreviewFileRef.current)
  }, [posterPreviewUrl, posterPreviewStatus, generating]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step === 3 && !generating && previewVideoFile) onResultFile?.("video", previewVideoFile)
  }, [previewVideoFile, generating]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!outputFolderName || !previewVideoFile) return
    const ext = previewVideoFile.name.split(".").pop() || "mp4"
    void saveToComputer(outputFolderName, [{ name: `${showsRealVideo(aiVideo.state) ? "영상_AI" : "영상_기본형"}.${ext}`, blob: previewVideoFile }])
  }, [outputFolderName, previewVideoFile]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const scene = sceneImage?.forImage === imageUrl ? sceneImage.url : ""
    if (outputFolderName && scene) void fetch(scene).then((r) => r.blob()).then((blob) => saveToComputer(outputFolderName, [{ name: "고급형_배경.jpg", blob }])).catch(() => undefined)
  }, [outputFolderName, sceneImage]) // eslint-disable-line react-hooks/exhaustive-deps
  const posterRatio: PosterRatioKey = details.posterRatio ?? "4:5"
  // D's renderer has no side-by-side layout for a square; it would quietly fall back.
  const posterLayout: PosterLayoutKey = posterRatio === "1:1" && details.posterLayout === "split" ? "vertical" : details.posterLayout ?? "vertical"
  const posterTheme: PosterThemeKey = details.posterTheme || posterThemeFor(tones)
  // The poster is drawn from the advertising background once it is back (sceneUrl, see 배경 바꾸기 above).
  const posterKey = JSON.stringify([posterContent, posterTheme, posterRatio, posterLayout, photoBox?.image === imageUrl ? photoBox.box : null, sceneUrl.length])
  const posterDrawnTextRef = useRef("")

  const createPosterFile = async (download: boolean, onDrawn?: (canvas: HTMLCanvasElement) => void) => {
    if (download && posterPreviewFileRef.current) {
      triggerFileDownload(posterPreviewFileRef.current)
      setPosterStatus("ready")
      notify("download")
      return posterPreviewFileRef.current
    }
    if (!imageUrl) {
      if (download) setPosterStatus("failed")

      return null
    }

    if (download) setPosterStatus("preparing")

    try {
      const image = await loadCanvasImage(sceneUrl || imageUrl)
      // Poster renderer ported from D_고혜숙 (src/poster). The first 홍보 분위기 picks the theme.
      await loadPosterFonts(Object.values(posterContent).filter(Boolean) as string[])

      const canvas = document.createElement("canvas")

      const drawnText = renderPosterToCanvas({
        canvas,
        content: posterContent,
        productImage: image,
        themeKey: posterTheme,
        ratioKey: posterRatio,
        compositionKey: posterLayout,
        // AI 표시 when an AI wrote the copy or drew the background (인공지능기본법 제31조).
        aiMark: Boolean(activePromo) || Boolean(sceneUrl),
        // "색: 분위기대로" follows the product photo; a colour the user picked is kept as is.
        photoColors: details.posterTheme ? null : photoPalette(image),
        // An AI background is drawn with the product about 25–60% from the top (api/_lib/background.js): the wide
        // 사진 먼저 panel centres that band instead of the middle, so the top of the product is not cut
        // ([사진먼저-잘림], 2026-10-19: macaron fully shown, cake shows more). Full width, so it never zooms in.
        focusBox: sceneUrl ? (posterLayout === "editorial" ? [250, 0, 600, 1000] : null) : photoBox?.image === imageUrl ? photoBox.box : null,
      })

      if (!drawnText) throw new Error("canvas-unavailable")
      posterDrawnTextRef.current = drawnText.map((line) => line.replace(/[.!?。]+$/, "")).join(". ")
      onDrawn?.(canvas)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      )

      if (!blob || blob.size === 0) throw new Error("empty-png")

      const marked = activePromo
        ? await withPngText(blob, "Comment", "홍보잇다: 포스터 문구 일부를 AI(Gemini)가 작성함 / Text partly AI-generated").catch(() => blob)
        : blob

      const file = new File([marked], outputFileName(posterContent.productName, "포스터", "png"), {
        type: "image/png",
      })

      if (download) setPosterStatus("ready")

      if (download) {
        triggerFileDownload(file)
        notify("download")
      }

      return file
    } catch {
      if (download) setPosterStatus("failed")

      return null
    }
  }

  // The poster on screen. Changing its size or first line keeps the current picture up until the new one is drawn,
  // then shows a quick JPEG of it at once; the PNG that is saved and shared is made right after (owner, 2026-10-19:
  // every change used to blank the poster and wait for a 1–2.5 MB PNG, slow on phones). A different photo starts
  // from blank, so an earlier poster never shows for the new one.
  const posterUrlRef = useRef("")
  const posterUrlImageRef = useRef("")
  const showPosterUrl = (url: string) => {
    if (posterUrlRef.current && posterUrlRef.current !== url) URL.revokeObjectURL(posterUrlRef.current)
    posterUrlRef.current = url
    posterUrlImageRef.current = url ? imageUrl : ""
    setPosterPreviewUrl(url)
  }
  useEffect(() => () => { if (posterUrlRef.current) URL.revokeObjectURL(posterUrlRef.current) }, [])
  useEffect(() => {
    if (step !== 3 || !showPoster || !imageUrl) return
    let cancelled = false
    posterPreviewFileRef.current = null
    if (posterUrlImageRef.current !== imageUrl) showPosterUrl("")
    setPosterPreviewStatus("preparing")
    // A redrawn poster has not been saved yet, so the earlier "저장했어요" status no longer applies.
    setPosterStatus("idle")
    // The preview and download use the same Canvas renderer and copy.
    void createPosterFile(false, (canvas) => {
      canvas.toBlob((quick) => {
        if (!cancelled && quick && !posterPreviewFileRef.current) showPosterUrl(URL.createObjectURL(quick))
      }, "image/jpeg", 0.9)
    }).then((file) => {
      if (cancelled) return
      if (!file) throw new Error("poster-preview-failed")
      posterPreviewFileRef.current = file
      showPosterUrl(URL.createObjectURL(file))
      setPosterPreviewStatus("ready")
      notify("result")
      setPosterVisibleText(posterDrawnTextRef.current)
    }).catch(() => {
      if (!cancelled) setPosterPreviewStatus("failed")
    })
    return () => {
      cancelled = true
      posterPreviewFileRef.current = null
    }
  }, [
    step,
    showPoster,
    imageUrl,
    posterKey,
    posterRetry,
  ])

  const cancelVideoPreparation = () => {
    videoCancelledRef.current = true

    if (videoFrameRef.current !== null) {
      window.cancelAnimationFrame(videoFrameRef.current)

      videoFrameRef.current = null
    }

    if (videoRecorderRef.current?.state === "recording") {
      videoRecorderRef.current.stop()
    } else {
      setVideoStatus("cancelled")

      setVideoMessage(uiText("영상 준비를 취소했어요.", easyMode))
    }
  }

  const createVideoFile = async (download: boolean) => {
    const canvas = document.createElement("canvas")

    const captureStream = canvas.captureStream

    if (
      !imageUrl ||
      typeof captureStream !== "function" ||
      typeof window.MediaRecorder === "undefined"
    ) {
      setVideoStatus("unsupported")

      setVideoMessage(
        uiText("현재 브라우저에서는 예시 영상을 만들 수 없어요.", easyMode),
      )

      return null
    }

    // H.264 + AAC first: Instagram/Kakao want MP4, and Chrome only offers it for an exact codec string.
    const mimeCandidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",

      "video/mp4;codecs=avc1.640028",

      "video/mp4;codecs=avc1",

      "video/mp4",

      "video/webm;codecs=vp9",

      "video/webm;codecs=vp8",

      "video/webm",
    ]

    const mimeType = mimeCandidates.find((candidate) =>
      MediaRecorder.isTypeSupported(candidate),
    )

    if (!mimeType) {
      setVideoStatus("unsupported")

      setVideoMessage(
        uiText(
          "이 브라우저에서 저장할 수 있는 영상 형식을 찾지 못했어요.",

          easyMode,
        ),
      )

      return null
    }

    setVideoStatus("preparing")

    setVideoMessage(uiText("확인용 예시 영상을 준비하고 있어요.", easyMode))

    videoCancelledRef.current = false

    try {
      // The advertising background when there is one (배경 바꾸기), else the photo.
      const image = await loadCanvasImage(sceneUrl || imageUrl)

      if (videoCancelledRef.current) {
        setVideoStatus("cancelled")

        setVideoMessage(uiText("영상 준비를 취소했어요.", easyMode))

        return null
      }

      // 9:16 at 1080×1920, the size Reels/Shorts/Stories expect.
      canvas.width = 1080

      canvas.height = 1920

      const context = canvas.getContext("2d")

      if (!context) throw new Error("canvas-unavailable")

      const stream = canvas.captureStream(30)

      // A classical bed chosen by the kind of product and one soft effect on each scene change (src/videoSound.ts);
      // the synthetic whoosh/chimes are gone (owner, 2026-10-18: they sounded broken). Silent if sound is unavailable.
      const sound = await prepareVideoSound(stream, {
        musicUrl: musicFor([details.name, details.description, details.features, details.keywords].filter(Boolean).join(" "), tones),
        seconds: MOTION_SECONDS,
        cues: [2.35, 4.15], // into the close-up (motionVideo.ts scene 2 at 2.6 s) and the end card (4.4 s)
      })
      const audio: AudioContext | null = sound?.audio ?? null

      const chunks: BlobPart[] = []

      const recorder = new MediaRecorder(stream, { mimeType })

      videoRecorderRef.current = recorder

      const result = await new Promise<File | null>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }

        recorder.onerror = () => reject(new Error("recording-failed"))

        recorder.onstop = () => {
          videoFrameRef.current = null

          stream.getTracks().forEach((track) => track.stop())
          void audio?.close().catch(() => undefined)

          videoRecorderRef.current = null

          if (videoCancelledRef.current) {
            setVideoStatus("cancelled")

            setVideoMessage(uiText("영상 준비를 취소했어요.", easyMode))

            resolve(null)

            return
          }

          const actualType = recorder.mimeType || mimeType

          const blob = new Blob(chunks, { type: actualType })

          if (blob.size === 0) {
            reject(new Error("empty-video"))

            return
          }

          const extension = actualType.toLowerCase().startsWith("video/mp4")
            ? "mp4"
            : "webm"

          // Recorded MP4 is fragmented with no duration: KakaoTalk posted only the first 3 s. Made plain here.
          resolve(
            plainMp4File(new File([blob], outputFileName(posterContent.productName, "영상", extension), {
              type: actualType,
            })),
          )
        }

        const startedAt = performance.now()

        // The photo framed exactly like the one sent for the AI clip (src/videoFrame.ts), so the product is never
        // cut at the sides and both videos look the same.
        const framed = document.createElement("canvas")
        framed.width = canvas.width
        framed.height = canvas.height
        const framedContext = framed.getContext("2d")
        if (!framedContext || !drawStoryFrame(framedContext, image, !sceneUrl && photoBox?.image === imageUrl ? photoBox.box : null)) framedContext?.drawImage(image, 0, 0, framed.width, framed.height)

        // 6-second motion graphic (src/motionVideo.ts): push-in, close-up with a light sweep and the key points,
        // end card with the price and the call to action.
        const duration = MOTION_SECONDS * 1000
        const motion: MotionScene = {
          framed,
          caption: sampleCaption,
          points: (details.keywords ?? "").split(",").map((item) => item.trim()).filter(Boolean),
          // The photo's own deep colour (as on the poster) for the shop pill and the call to action; the channel
          // colour (navy for 파일만 저장) clashed with warm food photos.
          accent: (() => {
            const ink = photoPalette(image)?.ink
            return ink ? [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16)).join(", ") : channelTheme.rgb
          })(),
          effect: motionEffectFor([details.name, details.description, details.features, details.keywords].filter(Boolean).join(" ")),
          // One "AI 활용" mark when an AI wrote the copy or drew the background, as on the poster.
          aiMark: Boolean(activePromo) || Boolean(sceneUrl),
        }

        const drawFrame = (now: number) => {
          if (videoCancelledRef.current) return

          const progress = Math.min((now - startedAt) / duration, 1)
          drawMotionFrame(context, progress * MOTION_SECONDS, motion)

          if (progress < 1) {
            videoFrameRef.current = window.requestAnimationFrame(drawFrame)
          } else if (recorder.state === "recording") {
            recorder.stop()
          }
        }

        sound?.start()
        recorder.start(250)

        videoFrameRef.current = window.requestAnimationFrame(drawFrame)
      })

      if (!result) return null

      setVideoStatus("ready")
      videoShareFileRef.current = result
      setSampleVideoFile(result)

      const extension = result.name.endsWith(".mp4") ? "MP4" : "WebM"

      setVideoMessage(
        easyMode
          ? "영상이 준비됐어요."
          : `${extension} 확인용 예시 영상이 준비됐어요.`,
      )

      if (download) {
        triggerFileDownload(result)
        notify("download")
      }

      return result
    } catch {
      setVideoStatus("failed")

      setVideoMessage(
        uiText("영상 준비에 실패했어요. 다시 시도해 주세요.", easyMode),
      )

      return null
    }
  }

  // Cancelled work settles before another preparation can reuse its recorder refs.
  const prepareVideoDownload = async (download = true) => {
    const context = videoContextRef.current
    const previous = videoTaskRef.current
    if (previous) {
      if (!videoCancelledRef.current) return previous
      await previous
      if (context !== videoContextRef.current) return null
    }
    if (context !== videoContextRef.current || step !== 3) return null
    if (videoTaskRef.current && !videoCancelledRef.current) return videoTaskRef.current
    const task = createVideoFile(download)
    videoTaskRef.current = task
    try {
      return await task
    } finally {
      if (videoTaskRef.current === task) videoTaskRef.current = null
    }
  }

  // The sample video is recorded while the loading screen is still up, once the poster and the 홍보 글 (its caption)
  // are ready, so the 영상 tab plays the real file the moment the results open (owner, 2026-10-20: the tab used to
  // show a pretend zoom of the photo first). After the results open, opening the 영상 tab prepares it if needed,
  // so 공유하기 works on the first tap (a share sheet must open right after the tap).
  const videoPreparedForRef = useRef(-1)
  useEffect(() => {
    if (step !== 3 || !showVideo || showsRealVideo(aiVideo.state)) return
    if (generating ? promoPending || (showPoster && posterPreviewStatus === "preparing") : activeResultTab !== "video") return
    if (videoShareFileRef.current || videoPreparedForRef.current === videoContextRef.current) return
    videoPreparedForRef.current = videoContextRef.current
    void prepareVideoDownload(false)
  }, [step, generating, activeResultTab, aiVideo.state, promoPending, posterPreviewStatus, showVideo]) // eslint-disable-line react-hooks/exhaustive-deps
  // The loading screen waits for that video too, but never more than 25 s for it.
  const [videoWaitOver, setVideoWaitOver] = useState(false)
  useEffect(() => {
    if (!generating) { setVideoWaitOver(false); return }
    const timer = window.setTimeout(() => setVideoWaitOver(true), 25_000)
    return () => window.clearTimeout(timer)
  }, [generating])
  const videoReadyForResults = !showVideo || showsRealVideo(aiVideo.state) || Boolean(sampleVideoFile) || videoStatus === "failed" || videoStatus === "unsupported" || videoWaitOver

  const shareResult = async (kind: "poster" | "video" | "copy") => {
    const update = (message: string) => setShareMessages(current => ({...current, [kind]: message}))
    if (typeof navigator.share !== "function") {
      update(kind === "copy" ? "이 브라우저는 공유창을 지원하지 않아요. 문구를 복사해 원하는 앱에 붙여 넣어 주세요." : "이 브라우저는 공유창을 지원하지 않아요. 파일을 다운로드한 뒤 원하는 앱에서 공유해 주세요.")
      return
    }
    const title = details.shopName?.trim() || details.name?.trim() || "홍보잇다"
    const file = kind === "poster" ? posterPreviewFileRef.current : videoShareFileRef.current
    if (kind === "video" && !file) {
      update("공유할 영상 파일을 준비하고 있어요.")
      const prepared = await prepareVideoDownload(false)
      update(prepared ? "파일이 준비됐어요. 공유하기를 다시 눌러 주세요." : "공유 파일 준비를 마치지 못했어요. 다시 시도해 주세요.")
      return
    }
    const data: ShareData = kind === "copy" ? {title, text: finalText} : file ? {title, files: [file]} : {title}
    if (kind !== "copy" && (!file || !navigator.canShare?.(data))) {
      update("이 브라우저는 파일 공유를 지원하지 않아요. 다운로드한 뒤 원하는 앱에서 공유해 주세요.")
      return
    }
    try {
      await navigator.share(data)
      update("공유 요청을 전달했어요.")
    } catch (error) {
      update(error instanceof DOMException && error.name === "AbortError" ? "공유를 취소했어요. 결과는 그대로 있어요." : "공유하지 못했어요. 다시 시도하거나 다운로드·복사로 가져가 주세요.")
    }
  }


  return (
    <section
      className={`creation-flow mx-auto ${
        step === 3 ? "results-flow" : "max-w-[920px]"
      }`}
    >
      {step === 3 && generating ? (
        <GenerationProgress
          kind={type}
          imageUrl={imageUrl}
          title={details.shopName?.trim() || details.name?.trim() || details.description.trim() || "우리 가게"}
          ready={(!showPoster || posterPreviewStatus !== "preparing") && !promoPending && videoReadyForResults}
          easyMode={easyMode}
          onCancel={() => {
            cancelPromoRequest()
            dropScene()
            aiVideo.cancel()
            setGenerating(false)
            setStep(2)
          }}
          onDone={() => {
            focusResultRef.current = true
            setGenerating(false)
            setOutputFolderName(outputFolder(details.name?.trim() || details.shopName?.trim() || ""))
            onResultCreated()
            if (!showPoster) notify("result")
          }}
        />
      ) : step === 3 ? (
        <div className="result-screen-heading">
          <div className="sr-only">
            <h2 data-screen-heading tabIndex={-1}>
              {t("결과 보기")}
            </h2>
            <p>{t("사진과 입력한 내용으로 만든 체험 결과예요. ")}</p>
          </div>
          {sceneNotice && <p className={`ai-notice scene-notice${sceneState?.status === "ready" ? " is-ai" : ""}`} role="status">{t(sceneNotice)}</p>}
          {bgNotice && <p className={`ai-notice scene-notice${ownBg === "ready" && photoPick === "changed" ? " is-ai" : ""}`} role="status">{t(bgNotice)}</p>}
          {ownBg === "ready" && sceneImage?.forImage === imageUrl && (
            <div className="photo-pick" role="radiogroup" aria-label={t("포스터와 영상에 쓸 사진")}>
              {([["changed", "바뀐 사진"], ["original", "원래 사진"]] as const).map(([id, label], index) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={photoPick === id}
                  onClick={() => setPhotoPick(id)}
                  {...radioNav(index, 2, photoPick === "changed" ? 0 : 1, (next) => setPhotoPick(next === 0 ? "changed" : "original"))}
                >
                  <img src={id === "changed" ? sceneImage.url : imageUrl} alt="" width="44" height="44" />
                  <span>{t(label)}</span>
                </button>
              ))}
            </div>
          )}
          {/* Owner, 2026-10-21: the results already carry the AI mark, so only the no-AI fallback is said here. */}
          {showCopy && !activePromo && <p className="ai-notice">{t("AI 없이 기본 문구로 만들었어요.")}</p>}
        </div>
      ) : (
        <StepHeader step={step} onBack={setStep} easyMode={easyMode} />
      )}
      {step === 1 && continuationNotice && (
        <p className="sr-only" role="status">
          진행하던 작업을 이어서 사용해요.
        </p>
      )}
      {step === 1 && (
        <PhotoStep
          imageUrl={imageUrl}
          outputFormat={type === "all" ? outputFormat : undefined}
          onOutputFormatChange={type === "all" ? onOutputFormatChange : undefined}
          pending={uploadPending}
          message={uploadMessage}
          onUpload={upload}
          onDropFile={uploadFile}
          aiCheck={aiPhotoCheck?.image === imageUrl ? aiPhotoCheck.check : null}
          onNext={goToDetails}
          easyMode={easyMode}
          extra={premiumUi && (showVideo || showPoster) ? (
            <VideoModeToggle
              withVideo={showVideo}
              value={videoMode}
              premiumAvailable={!isVideoUnavailable()}
              easyMode={easyMode}
              onChange={(videoMode) => setDetails({ ...details, videoMode })}
            />
          ) : null}
        />
      )}
      {asksBackground && <BackgroundAskDialog easyMode={easyMode} onAnswer={answerBackground} onClose={() => setAsking(false)} />}
      {step === 2 && (
        <div className="details-step step-panel compact-information">
          <div className="information-photo" aria-busy={uploadPending}>
            <img src={imageUrl} alt={t("선택한 제품 사진")} width="88" height="88" />
            <div>
              <strong>{t("선택한 사진")}</strong>
              <span>{t("다른 사진으로 바꿀 수 있어요.")}</span>
            </div>
            <button
              type="button"
              className="studio-secondary photo-change-button"
              disabled={uploadPending}
              onClick={() => detailsPhotoRef.current?.click()}
            >
              <Icon name="camera" size={18} />
              {t("사진 변경")}
            </button>
            <input
              ref={detailsPhotoRef}
              id="details-photo"
              type="file"
              hidden
              accept="image/*"
              aria-label={t("정보 입력에서 사진 바꾸기")}
              aria-describedby={uploadMessage ? "details-upload-feedback" : undefined}
              onChange={upload}
            />
          </div>
          {uploadMessage && (
            <p
              id="details-upload-feedback"
              className={
                uploadMessage === "사진이 준비됐어요."
                  ? "sr-only"
                  : `upload-feedback ${uploadPending ? "is-pending" : "is-error"}`
              }
              role={uploadPending || uploadMessage === "사진이 준비됐어요." ? "status" : "alert"}
              aria-atomic="true"
            >
              {t(uploadMessage)}
            </p>
          )}
          <p
            id="details-example-note"
            className="description-example-note sr-only"
          >
            {t("제품 이름은 꼭 적고, 나머지는 적지 않아도 돼요.")}
          </p>
          {type !== "all" && (
            <p className="sr-only">
              {uiText("결과 형식", easyMode)}:{" "}
              {type === "copy"
                ? "홍보 글"
                : uiText(creationNames[type], easyMode)}
            </p>
          )}
          <div className="details-fields mt-7 space-y-5">
            {imageUrl && scanImage !== imageUrl && (
              <button type="button" className="photo-scan" onClick={scanPhoto}>
                <Icon name="picture" size={22} />
                <span>{t("자동으로 채워 주기")}</span>
              </button>
            )}
            <div className="ai-fill-live" role="status" aria-live="polite" aria-atomic="true">
              {photoFill !== "idle" && (
                <p className={`ai-fill-status${photoFill === "loading" ? " is-loading" : ""}`}>
                  {photoFill === "loading" && <span className="ai-fill-spinner" aria-hidden="true" />}
                  {t(photoFill === "loading" ? "사진을 보고 내용을 채우고 있어요…" : photoFill === "failed" ? "사진을 읽지 못했어요. 아래 칸에 직접 적어 주세요." : "사진을 보고 채웠어요. 맞지 않으면 고쳐 주세요.")}
                </p>
              )}
            </div>
            <label className="block text-[18px] font-bold">
              제품 이름 <span className="field-tag is-required">{t("필수")}</span>
              <VoiceField voice={voice} field="name" label="제품 이름" inputId="field-product-name" value={details.name ?? ""} maxLength={50} easyMode={easyMode} onVoiceText={(text) => updateDetails({ ...details, name: text })}>
              {(bind) => <input
                {...bind}
                aria-label="제품 이름"
                aria-required="true"
                aria-invalid={nameTouched && missingFields.length > 0 ? true : undefined}
                aria-describedby="product-name-help"
                value={details.name ?? ""}
                maxLength={50}
                placeholder={t("예) 수제 쿠키와 커피")}
                onBlur={() => setNameTouched(true)}
                onChange={(event) => updateDetails({ ...details, name: event.target.value })}
                className="mt-2 w-full rounded-[12px] border-2 border-[#817a74] p-4 text-[18px] font-normal leading-7 outline-none"
              />}
              </VoiceField>
              <span className="field-meta">
                <span id="product-name-help" className={nameTouched && missingFields.length > 0 ? "field-validation is-error" : "sr-only"} role={nameTouched && missingFields.length > 0 ? "alert" : undefined}>
                  {t(nameTouched && missingFields.length > 0 ? "제품 이름을 적어 주세요." : "제품 이름을 적으면 홍보물을 만들 수 있어요.")}
                </span>
                {/* The poster title holds about two lines (≈ 26 characters); say so before it gets cut with … */}
                {(details.name ?? "").trim().length > 26 && <span className="name-length-hint">{t("이름이 길면 포스터에는 앞부분만 들어가요.")}</span>}
                {Boolean(details.name) && <span className="field-count" aria-hidden="true">{(details.name ?? "").length}/50</span>}
              </span>
            </label>
            <label className="block text-[18px] font-bold">
              가게 이름 <span className="field-tag">{t("선택")}</span>
              <VoiceField voice={voice} field="shopName" label="가게 이름" inputId="field-shop-name" value={details.shopName ?? ""} maxLength={30} easyMode={easyMode} onVoiceText={(text) => updateDetails({ ...details, shopName: text })}>
              {(bind) => <input
                {...bind}
                aria-label="가게 이름"
                aria-required="false"
                value={details.shopName ?? ""}
                maxLength={30}
                onChange={(event) => updateDetails({ ...details, shopName: event.target.value })}
                placeholder={t("예) 행복한 카페")}
                className="mt-2 w-full rounded-[12px] border p-4"
              />}
              </VoiceField>
            </label>
            <fieldset className="tone-field">
              <legend>{t("홍보 분위기")} <span className="field-tag">{t("선택")}</span></legend>
              {/* Several moods can be chosen; the first one leads. 자동 clears them and shows as chosen when none is. */}
              <div className="tone-options" role="group" aria-label={t("홍보 분위기 · 여러 개 고를 수 있어요")}>
                {toneOptions.map((option) => {
                  const value = option.value
                  const pressed = value ? tones.includes(value) : tones.length === 0
                  return (
                    <button
                      key={value || "auto"}
                      type="button"
                      aria-pressed={pressed}
                      aria-label={t(option.name)}
                      onClick={() => {
                        const next = !value ? [] : pressed ? tones.filter((tone) => tone !== value) : [...tones, value]
                        const { tone: _legacy, ...rest } = details
                        updateDetails({ ...rest, tones: next })
                      }}
                    >
                      {t(option.label)}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            {/* 고급형 chosen under the photo (with a video): the bold concept film is opt-in here; 기본형 never shows it. */}
            {videoMode === "premium" && showVideo && !isVideoUnavailable() && (
              <SpecialFilmToggle value={Boolean(details.specialFilm)} easyMode={easyMode} onChange={(specialFilm) => updateDetails({ ...details, specialFilm })} />
            )}
            <details className="details-more" open={Boolean(details.description || details.features || details.keywords || details.audience || details.location || details.priceInfo || details.contact) || undefined}>
              <summary>
                <span>{t("더 자세히 알려주기")}</span>
                {(() => {
                  const filled = [details.description, details.features, details.keywords, details.audience, details.location, details.priceInfo, details.contact].filter((value) => value?.trim()).length
                  return <small>{easyMode ? (filled ? `${filled}개 썼어요` : "안 써도 돼요") : `${filled}/7 입력 · 선택`}</small>
                })()}
              </summary>
              <div className="details-more-fields">
                <label className="block text-[18px] font-bold">
                  {t("제품 설명")}
                  <VoiceField voice={voice} field="description" label={t("제품 설명")} inputId="field-description" value={details.description} maxLength={500} easyMode={easyMode} onVoiceText={(text) => updateDetails({ ...details, description: text })}>
                  {(bind) => <AutoSizeTextarea
                    {...bind}
                    aria-label={t("제품 설명")}
                    value={details.description}
                    maxLength={500}
                    placeholder={t("예) 매일 아침 직접 굽는 촉촉한 초코 케이크예요.")}
                    onChange={(event) => updateDetails({ ...details, description: event.target.value })}
                    rows={2}
                    resizeKey={easyMode}
                    className="mt-2 w-full rounded-[12px] border-2 border-[#817a74] p-4 text-[18px] font-normal leading-7 outline-none"
                  />}
                  </VoiceField>
                  <span className="field-meta">{Boolean(details.description) && <span className="field-count" aria-hidden="true">{(details.description ?? "").length}/500</span>}</span>
                </label>
                <label className="block text-[18px] font-bold">
                  {t("어떤 점을 알려주고 싶나요?")}
                  <VoiceField voice={voice} field="features" label={t("알리고 싶은 점")} inputId="field-features" value={details.features} maxLength={1000} easyMode={easyMode} onVoiceText={(text) => updateDetails({ ...details, features: text })}>
                  {(bind) => <AutoSizeTextarea
                    {...bind}
                    aria-label={t("어떤 점을 알려주고 싶나요?")}
                    aria-required="false"
                    value={details.features}
                    maxLength={1000}
                    placeholder={t("예) 신선한 재료, 직접 만든 디저트,\n아늑한 분위기")}
                    onChange={(event) => updateDetails({ ...details, features: event.target.value })}
                    rows={2}
                    resizeKey={easyMode}
                    className="mt-2 w-full rounded-[12px] border-2 border-[#817a74] p-4 text-[18px] font-normal leading-7 outline-none"
                  />}
                  </VoiceField>
                </label>
                <label className="block text-[18px] font-bold">
                  {t("핵심 특징")}
                  <VoiceField voice={voice} field="keywords" label={t("핵심 특징")} inputId="field-keywords" value={details.keywords ?? ""} maxLength={300} easyMode={easyMode} onVoiceText={(text) => updateDetails({ ...details, keywords: text })}>
                  {(bind) => <input
                    {...bind}
                    aria-label={t("핵심 특징")}
                    aria-describedby="keywords-help"
                    value={details.keywords ?? ""}
                    maxLength={300}
                    placeholder={t("예) 수제, 당일 생산, 무료 포장")}
                    onChange={(event) => updateDetails({ ...details, keywords: event.target.value })}
                    className="mt-2 w-full rounded-[12px] border p-4"
                  />}
                  </VoiceField>
                  <span id="keywords-help" className="field-hint">{t("쉼표(,)로 나눠 적으면 해시태그와 홍보 글에 넣어요.")}</span>
                  {Boolean(details.keywords?.trim()) && (
                    <span className="keyword-chips" aria-hidden="true">
                      {(details.keywords ?? "").split(",").map((item) => item.trim()).filter(Boolean).map((item) => <span key={item}>{item}</span>)}
                    </span>
                  )}
                </label>
                <label className="block text-[18px] font-bold">
                  {t("주요 고객층")}
                  <VoiceField voice={voice} field="audience" label={t("주요 고객층")} inputId="field-audience" value={details.audience} maxLength={200} easyMode={easyMode} onVoiceText={(text) => updateDetails({ ...details, audience: text })}>
                  {(bind) => <input
                    {...bind}
                    aria-label={t("주요 고객층")}
                    value={details.audience}
                    maxLength={200}
                    placeholder={t("예) 동네 직장인, 디저트를 좋아하는 20~30대")}
                    onChange={(event) => updateDetails({ ...details, audience: event.target.value })}
                    className="mt-2 w-full rounded-[12px] border p-4"
                  />}
                  </VoiceField>
                </label>
                <label className="block text-[18px] font-bold">
                  {t("가게 위치")}
                  <VoiceField voice={voice} field="location" label={t("가게 위치")} inputId="field-location" value={details.location ?? ""} maxLength={60} easyMode={easyMode} onVoiceText={(text) => updateDetails({ ...details, location: text })}>
                  {(bind) => <input
                    {...bind}
                    aria-label={t("가게 위치")}
                    value={details.location ?? ""}
                    maxLength={60}
                    placeholder={t("예) 성수역 3번 출구 앞")}
                    onChange={(event) => updateDetails({ ...details, location: event.target.value })}
                    className="mt-2 w-full rounded-[12px] border p-4"
                  />}
                  </VoiceField>
                </label>
                <label className="block text-[18px] font-bold">
                  {t("가격")}
                  <VoiceField voice={voice} field="priceInfo" label={t("가격")} inputId="field-priceInfo" value={details.priceInfo ?? ""} maxLength={60} easyMode={easyMode} onVoiceText={(text) => updateDetails({ ...details, priceInfo: text })}>
                  {(bind) => <input
                    {...bind}
                    aria-label={t("가격")}
                    value={details.priceInfo ?? ""}
                    maxLength={60}
                    placeholder={t("예) 아메리카노 3,500원")}
                    onChange={(event) => updateDetails({ ...details, priceInfo: event.target.value })}
                    className="mt-2 w-full rounded-[12px] border p-4"
                  />}
                  </VoiceField>
                </label>
                <label className="block text-[18px] font-bold">
                  {t("주문·연락 방법")}
                  <VoiceField voice={voice} field="contact" label={t("주문·연락 방법")} inputId="field-contact" value={details.contact ?? ""} maxLength={60} easyMode={easyMode} onVoiceText={(text) => updateDetails({ ...details, contact: text })}>
                  {(bind) => <input
                    {...bind}
                    aria-label={t("주문·연락 방법")}
                    value={details.contact ?? ""}
                    maxLength={60}
                    placeholder={t("예) 전화 02-123-4567, 매장 방문")}
                    onChange={(event) => updateDetails({ ...details, contact: event.target.value })}
                    className="mt-2 w-full rounded-[12px] border p-4"
                  />}
                  </VoiceField>
                </label>
              </div>
            </details>
            {false && <details className="information-more-settings">
              <summary>
                <span>추가 설정 · 고객·검색어</span>
                <small className="setting-summary-hint">
                  {details.audience.trim() ? "고객 입력됨" : "고객 선택 안 함"}
                  {" · "}검색어 {hashtags.length}개
                </small>
              </summary>
              <details className="additional-product-info">
                <summary>주요 고객 · 선택</summary>
                <label className="block text-[18px] font-bold">
                  주요 고객 · 선택{" "}
                  <span className="field-hint" id="audience-help">
                    누구에게 추천하나요? 예: 간식을 찾는 동네 손님
                  </span>
                  <textarea
                    aria-label="주요 고객"
                    aria-describedby="audience-help"
                    value={details.audience}
                    onChange={(event) =>
                      updateDetails({
                        ...details,
                        audience: event.target.value,
                      })
                    }
                    rows={2}
                    className="mt-2 w-full rounded-[12px] border-2 border-[#817a74] p-4 text-[18px] font-normal outline-none focus:border-[#c64f12] focus:ring-3 focus:ring-[#c64f12]/15"
                  />
                </label>
              </details>
              <details className="draft-review">
                <summary>선택한 사진·홍보물 확인</summary>
                <div className="draft-context">
                  <img
                    src={imageUrl}
                    alt="선택한 제품 사진"
                    width="88"
                    height="88"
                  />
                  <div>
                    <span>사진과 선택한 내용</span>
                    <strong>
                      {type === "all"
                        ? outputFormatNames[outputFormat] + " · 홍보 글"
                        : creationNames[type]}
                    </strong>
                    <p>{channelNames[channel]}</p>
                  </div>
                  <button
                    className="studio-secondary"
                    onClick={() => setStep(1)}
                  >
                    사진·설정 수정
                  </button>
                </div>
              </details>
              <details className="optional-hashtags rounded-[14px] border border-[#817a74] bg-white p-4">
                <summary>
                  검색어(#) 수정하기 · 선택
                  <span className="current-hashtag-preview">
                    현재: {hashtags.slice(0, 2).join(" ")}
                    {hashtags.length > 2 ? ` 외 ${hashtags.length - 2}개` : ""}
                  </span>
                </summary>
                <p className="optional-hashtag-note">
                  기본 검색어는 설명에 맞춰 갱신해요. 직접 고친 검색어는 그대로
                  유지돼요.
                </p>
                <label className="block text-[18px] font-bold">
                  {uiText("사용할 해시태그 직접 수정", easyMode)}
                  <textarea
                    aria-label={uiText("사용할 해시태그 직접 수정", easyMode)}
                    value={safeUserHashtags[channel]}
                    onChange={(event) => {
                      setUserHashtagsByChannel({
                        ...safeUserHashtags,

                        [channel]: event.target.value,
                      })

                      onDraftTouched()
                    }}
                    rows={3}
                    placeholder="#제품명 #우리동네제품"
                    className="mt-2 w-full rounded-[12px] border-2 border-[#817a74] bg-white p-4 text-[18px] font-normal leading-7 outline-none focus:border-[#c64f12] focus:ring-3 focus:ring-[#c64f12]/15"
                  />
                </label>
                <div className="mt-5 rounded-[12px] bg-[#f6f5f3] p-4">
                  <strong className="text-[16px]">
                    {uiText(channelNames[channel], easyMode)}{" "}
                    {uiText("추천 해시태그 후보", easyMode)}
                  </strong>
                  <p className="mt-1 text-[16px] leading-6 text-[#626262]">
                    제품 정보로 만든 규칙 기반 예시이며, 작성한 태그는 자동으로
                    바뀌지 않습니다.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recommendationTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[#dedbd7] bg-white px-3 py-2 text-[16px] font-bold text-[#2b2b2b]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {needsMoreKeywords && (
                    <p className="mt-3 rounded-[10px] bg-[#fff1e7] px-3 py-2 text-[16px] font-bold text-[#7f340d]">
                      추천할 키워드가 부족해요. 제품명, 실제 지역 또는 강조
                      특징을 더 구체적으로 입력해 주세요.
                    </p>
                  )}
                  <p className="mt-4 text-[16px] text-[#545454]">
                    {uiText(
                      "‘추천으로 교체’를 누르면 위 작성란이 추천 후보로 바뀝니다.",

                      easyMode,
                    )}
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() =>
                        setRecommendedHashtagsByChannel({
                          ...safeRecommendations,

                          [channel]: makeHashtags(channel, details).join(" "),
                        })
                      }
                      className="min-h-12 rounded-[12px] border-2 border-[#817a74] bg-white px-4 text-[16px] font-bold text-[#2b2b2b]"
                    >
                      추천 다시 만들기
                    </button>
                    <button
                      onClick={() => {
                        setUserHashtagsByChannel({
                          ...safeUserHashtags,

                          [channel]: safeRecommendations[channel],
                        })

                        onDraftTouched()
                      }}
                      className="min-h-12 rounded-[12px] border-2 border-[#c64f12] bg-white px-4 text-[16px] font-bold text-[#9f3e0d]"
                    >
                      추천으로 교체
                    </button>
                  </div>
                </div>
              </details>
            </details>}
          </div>
          <div className="details-actions mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">

            <div className="mobile-primary-bar details-primary-bar">
              <p
                id="missing-details"
                role="status"
                className="missing-details-note"
              >
                {missingFields.length > 0 ? t("제품 이름을 적으면 만들 수 있어요.") : ""}
              </p>
              <PrimaryButton
                disabled={missingFields.length > 0 || uploadPending}
                onClick={() => {
                  setSelectedResultTab(resultTabs[0].id)
                  if (showCopy) requestPromoText()
                  // Only 고급형 pays: the new advertising scene first (poster + video), then the AI video made from it.
                  // The AI video on screen belongs to an earlier photo or to 고급형: a new 기본형 creation, or 고급형
                  // with another photo, starts clean (the record that holds it keeps it).
                  if (videoMode !== "premium" || aiVideoForImageRef.current !== imageUrl) aiVideo.reset()
                  if (videoMode === "premium" && (showPoster || showVideo)) startPremium()
                  setGenerating(true)
                  setStep(3)
                }}
              >
                {t({ all: "홍보물 만들기", poster: "이미지 만들기", video: "영상 만들기", copy: "홍보 글 만들기" }[type])} <Icon name="arrow" />
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
      {step === 3 && !generating && (
        <div className={`results-step step-panel${resultTabs.length === 1 ? " is-single" : ""}`}>
          <div className="result-tabs-bar">
            <div
              className="result-tabs"
              role="tablist"
              aria-label={t("홍보물 결과 종류")}
            >
              {resultTabs.map((tab, index) => (
                <button
                  key={tab.id}
                  id={`result-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeResultTab === tab.id}
                  aria-controls={`result-${tab.id}`}
                  tabIndex={activeResultTab === tab.id ? 0 : -1}
                  onClick={() => selectResultTab(tab.id)}
                  onKeyDown={(event) => {
                    let next = index
                    if (event.key === "ArrowRight")
                      next = (index + 1) % resultTabs.length
                    else if (event.key === "ArrowLeft")
                      next = (index - 1 + resultTabs.length) % resultTabs.length
                    else if (event.key === "Home") next = 0
                    else if (event.key === "End") next = resultTabs.length - 1
                    else return
                    event.preventDefault()
                    selectResultTab(resultTabs[next].id, true)
                  }}
                >
                  <Icon
                    name={
                      tab.id === "poster"
                        ? "picture"
                        : tab.id === "video"
                          ? "video"
                          : "copy"
                    }
                    size={22}
                  />
                  <span className="result-tab-label">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div
            className="result-grid result-tab-panels"
            data-result-count={resultTabs.length}
          >
            {showPoster && (
              <article
                id="result-poster"
                role="tabpanel"
                aria-labelledby="result-tab-poster"
                hidden={activeResultTab !== "poster"}
                tabIndex={0}
                className="result-card result-poster"
              >
                <ResultCardHeading
                  easyMode={easyMode}
                  icon="picture"
                  title={easyMode ? "포스터" : "이미지"}
                  // No 크게 보기 (owner, 2026-10-20): the poster is shown full width at its own shape from the start, like the
                  // video; a longer scroll is fine.
                  extra={
                    // The first-line choice lives on the 홍보 글 tab only (owner, 2026-10-19): on the poster it changes one small
                    // line under the product name, too little to see.
                    <PosterStyleControls
                      ratio={posterRatio}
                      easyMode={easyMode}
                      onChange={(next) => updateDetails({ ...details, ...next })}
                    />
                  }
                />
                <ResultPreview>
                  <div
                    ref={posterPreviewRef}
                    id="result-poster-preview"
                    onKeyDown={(event) => {
                      if (event.key !== "Escape" || !posterExpanded) return
                      setPosterExpanded(false)
                      document.querySelector<HTMLElement>('[aria-controls="result-poster-preview"]')?.focus()
                    }}
                    className={`result-main-preview ${posterExpanded ? "is-expanded" : ""}${posterPreviewUrl && posterPreviewStatus === "preparing" ? " is-updating" : ""}`}
                    role="group"
                    aria-label={t(posterExpanded ? "이미지 확대 미리보기" : "이미지 미리보기")}
                    tabIndex={posterExpanded ? 0 : undefined}
                  >
                    {posterPreviewUrl ? (
                      <div className="poster-image-canvas">
                        <img src={posterPreviewUrl} alt={`${details.name?.trim() || "제품"} 홍보 이미지`} aria-describedby={posterVisibleText ? "poster-visible-text" : undefined} />
                      </div>
                    ) : (
                      <div className="result-preparation" aria-busy={posterPreviewStatus === "preparing"}>
                        <p role={posterPreviewStatus === "failed" ? "alert" : "status"}>
                          {t(posterPreviewStatus === "failed"
                            ? "이미지를 준비하지 못했어요. 다시 시도해 주세요."
                            : "이미지를 준비하고 있어요.")}
                        </p>
                        {posterPreviewStatus === "failed" && (
                          <button type="button" className="studio-secondary" onClick={() => setPosterRetry((value) => value + 1)}>
                            {t("이미지 다시 준비")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </ResultPreview>
                {posterVisibleText && <p id="poster-visible-text" className="sr-only">그림에 표시된 문구: {posterVisibleText}</p>}
                <ResultActionBar
                  label={easyMode ? (posterStatus === "preparing" ? "저장 준비 중" : saveLabel) : posterStatus === "preparing" ? "다운로드 준비" : "다운로드"}
                  accessibleLabel={easyMode ? `포스터 ${posterStatus === "preparing" ? "저장 준비 중" : saveLabel}` : "이미지 다운로드"}
                  shareLabel={t("공유하기")}
                  icon="download"
                  onClick={() => createPosterFile(true)}
                  onShare={() => shareResult("poster")}
                  shareMessage={aiNote(t(shareMessages.poster ?? ""))}
                  shareDisabled={!posterPreviewUrl || posterPreviewStatus !== "ready"}
                  disabled={posterStatus === "preparing" || !posterPreviewUrl}
                  busy={posterStatus === "preparing"}
                  error={posterStatus === "failed" || posterPreviewStatus === "failed"}
                  message={t(
                    posterPreviewStatus === "failed"
                      ? showVideo || showCopy
                        ? "이미지 준비에 실패했어요. 다른 결과는 계속 확인할 수 있어요."
                        : "다시 준비하거나 아래에서 내용을 수정해 주세요."
                      : posterStatus === "failed"
                      ? "저장에 실패했어요. 다시 시도해 주세요."
                      : posterStatus === "ready"
                        ? aiNote(isTouchPhone() ? "저장 창을 열었어요. ‘이미지 저장’을 누르면 사진에 들어가요. 없으면 사진을 길게 눌러 저장해 주세요." : "PNG 저장을 요청했어요. 다운로드 목록을 확인하세요.")
                        : posterExpanded
                          ? "이미지를 크게 키웠어요. 안에서 좌우·위아래로 움직여 보세요."
                          : ""
                  )}
                />
                {nextResultButton("poster")}
                {RESULT_SECONDARY_FEATURES_ENABLED && <details className="media-full-copy">
                  <summary>이미지 문구 원문 보기</summary>
                  <p>{details.name}</p>
                  <p>{details.features}</p>
                  <p>{resultCopy[channel]}</p>
                </details>}
              </article>
            )}
            {showVideo && (
              <article
                id="result-video"
                role="tabpanel"
                aria-labelledby="result-tab-video"
                hidden={activeResultTab !== "video"}
                tabIndex={0}
                className="result-card result-video"
              >
                <ResultCardHeading
                  easyMode={easyMode}
                  icon="video"
                  title={easyMode ? "짧은 영상" : "영상"}
                  control={
                      <button
                        type="button"
                        className="result-preview-action"
                        aria-controls="result-video-preview"
                        aria-pressed={playing}
                        onClick={() => setPlaying(!playing)}
                      >
                        <Icon name={playing ? "pause" : "play"} size={34} />
                        <span>{t(playing ? "일시 정지" : "재생하기")}</span>
                      </button>
                  }
                />
                <ResultPreview>
                  <div
                    id="result-video-preview"
                    className="result-main-preview result-motion-preview"
                  >
                    {previewVideoUrl ? (
                      <>
                        <video
                          ref={previewVideoRef}
                          className="motion-preview-video"
                          src={previewVideoUrl}
                          muted
                          loop
                          playsInline
                          preload="auto"
                          // Paused, it shows the moment the headline is up (0 s is the bare photo).
                          onLoadedData={(event) => { if (!playing) event.currentTarget.currentTime = 1.6 }}
                          aria-label={t("저장될 영상 미리보기")}
                        />
                        {showsRealVideo(aiVideo.state) && <span className="ai-badge">{t("AI 생성 영상")}</span>}
                      </>
                    ) : showsRealVideo(aiVideo.state) ? (
                      <>
                        <AiVideoPlayer state={aiVideo.state} easyMode={easyMode} playing={playing} onPlayingChange={setPlaying} onBroken={aiVideo.markBroken} />
                        <span className="ai-badge">{t("AI 생성 영상")}</span>
                      </>
                    ) : (
                    <img
                      src={imageUrl}
                      alt={t("영상에 사용할 제품 사진")}
                      className={playing ? "is-playing" : ""}
                    />
                    )}
                    {/* Caption band in A_손용범's compose-push layout: headline first, then shop · product and the call to action.
                        Hidden once the real file plays: its own caption is drawn in. */}
                    {!previewVideoUrl && <strong className={`video-caption${playing ? " is-playing" : ""}`}>
                      <span className="video-caption-headline">{videoCaption.headline}</span>
                      {videoCaption.brand && <span className="video-caption-brand">{videoCaption.brand}</span>}
                      {videoCaption.cta && <span className="video-caption-cta">{videoCaption.cta}</span>}
                    </strong>}
                  </div>
                </ResultPreview>
                {premiumSteps && <PremiumSteps {...premiumSteps} easyMode={easyMode} />}
                <AiVideoStatus state={aiVideo.state} easyMode={easyMode} onRetry={aiVideo.retry} onResume={aiVideo.resume} />
                <ResultActionBar
                  label={easyMode ? (videoStatus === "preparing" ? "그만하기" : saveLabel) : videoStatus === "preparing" ? "준비 취소" : "다운로드"}
                  accessibleLabel={easyMode ? `영상 ${videoStatus === "preparing" ? "그만하기" : saveLabel}` : videoStatus === "preparing" ? "영상 준비 취소" : "영상 다운로드"}
                  shareLabel={t("공유하기")}
                  icon={videoStatus === "preparing" ? null : "download"}
                  onClick={() => videoStatus === "preparing"
                    ? cancelVideoPreparation()
                    : showsRealVideo(aiVideo.state)
                      ? saveRealVideo(aiVideo.state, details.shopName?.trim() || details.name?.trim() || "", realVideoFile).then(setVideoMessage)
                      : prepareVideoDownload()}
                  busy={videoStatus === "preparing"}
                  onShare={() => showsRealVideo(aiVideo.state)
                    ? shareRealVideo(aiVideo.state, details.shopName?.trim() || details.name?.trim() || "홍보 영상", realVideoFile).then((message) => setShareMessages((current) => ({ ...current, video: message })))
                    : shareResult("video")}
                  shareMessage={aiNote(t(shareMessages.video ?? ""))}
                  error={videoStatus === "failed" || videoStatus === "unsupported"}
                  // The AI clip: after 저장 its own result message; before, whether the captioned file is ready.
                  message={t(showsRealVideo(aiVideo.state) && !/^(AI가 만든 영상을 저장|새 창)/.test(videoMessage)
                    ? realVideoFile ? "AI가 만든 영상에 글자를 넣어 준비했어요. 저장하거나 보낼 수 있어요." : "AI 영상에 글자를 넣고 있어요. 잠시만 기다려 주세요."
                    : videoStatus === "preparing"
                      ? `${videoMessage} 다른 작업으로 이동하면 준비를 취소해요.`
                      : videoMessage)}
                />
                {nextResultButton("video")}
                {RESULT_SECONDARY_FEATURES_ENABLED && <details className="media-full-copy">
                  <summary>영상 문구 원문 보기</summary>
                  <p>{details.features}</p>
                  <p>{resultCopy[channel]}</p>
                </details>}
              </article>
            )}
            {showCopy && (
              <article
                id="result-copy"
                role="tabpanel"
                aria-labelledby="result-tab-copy"
                hidden={activeResultTab !== "copy"}
                tabIndex={0}
                className="result-card result-copy"
              >
                <ResultCardHeading
                  easyMode={easyMode}
                  icon="copy"
                  title="홍보 글"
                  extra={
                    <fieldset className="channel-choice" role="radiogroup">
                      <legend>{t("어디에 올릴까요?")}{promoPending ? <span className="channel-pending"> · {t("글을 맞추는 중")}</span> : null}</legend>
                      <div>
                        {copyChannelOptions.map(([id, label], index) => (
                          <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={channel === id}
                            onClick={() => pickChannel(id)}
                            {...radioNav(index, copyChannelOptions.length, copyChannelOptions.findIndex(([option]) => option === channel), (next) => pickChannel(copyChannelOptions[next][0]))}
                          >
                            {t(label)}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  }
                  // One text per channel, no "다른 말로 바꾸기" (owner, 2026-10-20: it showed on some channels and not on others
                  // and was not worth the extra work); the AI's first line is used.
                />
                <ResultPreview text>
                  <div className="result-main-preview result-text-preview">
                    <div
                      className="copy-result-text"
                      role="region"
                      aria-label={t("홍보 문구 원문")}
                      
                      tabIndex={0}
                    >
                      {/* Same text as finalText; each hashtag is kept whole when the line wraps. */}
                      {copyText.trim()}
                      {hashtags.length > 0 && (copyText.trim() ? "\n\n" : "")}
                      {hashtags.map((tag, index) => (
                        <Fragment key={tag + index}>{index ? " " : ""}<span className="hashtag">{tag}</span></Fragment>
                      ))}
                    </div>
                  </div>
                </ResultPreview>
                <ResultActionBar
                  label={t("복사하기")}
                  accessibleLabel="홍보 글 복사하기"
                  icon="copy"
                  onClick={copyFinalText}
                  onShare={() => shareResult("copy")}
                  shareLabel={t("공유하기")}
                  shareMessage={aiNote(t(shareMessages.copy ?? ""))}
                  message={aiNote(t(copyMessage && !copyMessage.includes("못했어요") ? "문구를 복사했어요." : copyMessage))}
                  error={copyMessage.includes("못했어요")}
                />
              </article>
            )}
          </div>
          {RESULT_SECONDARY_FEATURES_ENABLED && <details className="result-publishing-help">
            <summary>게시 방법과 문구 확인</summary>
            <p>
              현재 결과는 사진과 입력한 내용으로 만든 예시예요. 게시 전에 내용을
              확인해 주세요.
            </p>
            <PublishingGuide channel={channel} hasVideo={showVideo} />
          </details>}
          <div className="result-followup-actions">
            <button className="studio-secondary" onClick={onDashboard}><Icon name="home" size={22} />{t("홈으로")}</button>
          </div>
        </div>
      )}
    </section>
  )
}

const recordsViewKey = "hongboitda-records-view"
type RecordsView = "list" | "grid"
function readRecordsView(): RecordsView | null {
  try {
    const value = localStorage.getItem(recordsViewKey)
    return value === "list" || value === "grid" ? value : null
  } catch {
    return null
  }
}

function Records({
  easyMode,
  stored,
  records,
  onOpen,
  onDelete,
  onCreate,
  onStartNew,
}: {
  easyMode: boolean
  /** True when the list is kept on this device (IndexedDB); false = this window only. */
  stored: boolean
  records: GeneratedRecord[]
  onOpen: (record: GeneratedRecord, kind: "poster" | "video" | "copy") => void
  onDelete: (record: GeneratedRecord) => void
  onCreate: () => void
  onStartNew: () => void
}) {
  // 목록/격자: the viewer's own choice wins; without one, 쉬운 화면 starts with big thumbnails.
  const [chosenView, setChosenView] = useState<RecordsView | null>(readRecordsView)
  const view: RecordsView = chosenView ?? (easyMode ? "grid" : "list")
  const chooseView = (value: RecordsView) => {
    setChosenView(value)
    try {
      localStorage.setItem(recordsViewKey, value)
    } catch {
      // storage blocked: the choice still holds for this visit
    }
  }
  // One card per creation (owner, 2026-10-20): one 홍보물 made the poster, the video and the text together, and the
  // list used to show them as three separate cards (and a 4-button filter), as if made three times.
  const visible = records.flatMap((record) => {
    const kinds: ("poster" | "video" | "copy")[] =
      record.type === "all"
        ? [
            ...(record.outputFormat !== "video" ? ["poster" as const] : []),
            ...(record.outputFormat !== "poster" ? ["video" as const] : []),
            "copy",
          ]
        : [record.type]
    const kept = kinds.filter((kind) => !record.removed?.includes(kind))
    return kept.length ? [{ record, kinds: kept, kind: kept[0] }] : []
  })
  const labels = easyMode
    ? { all: "전체", poster: "포스터", video: "영상", copy: "홍보 글" }
    : { all: "전체", poster: "이미지", video: "영상", copy: "홍보 글" }
  const t = (text: string) => uiText(text, easyMode)
  return (
    <section className={`records-screen is-${view}`}>
      <h2 data-screen-heading tabIndex={-1}>
        내 홍보물
      </h2>
      <p className="records-retention-note">
        {t(stored ? "이 기기에 저장된 홍보물이에요. 다른 기기에서는 보이지 않아요." : "이 창에서 만든 홍보물을 확인할 수 있어요.")}
      </p>
      <div className="records-toolbar">
        <p className="records-count" role="status">
          {t("모두")} {visible.length}{t("개")}
        </p>
        {visible.length > 0 && (
          <div className="records-view-toggle" role="group" aria-label={t("보기 방식")}>
            {(["list", "grid"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => chooseView(value)}
              >
                {t(value === "list" ? "목록 보기" : "격자 보기")}
              </button>
            ))}
          </div>
        )}
      </div>
      {visible.length ? (
        <div className={view === "grid" ? "records-grid" : "records-list"}>
          {visible.map(({ record, kinds, kind }) => (
            <div className="record-entry" key={record.id}>
            <button
              className={view === "grid" ? "record-card" : "record-item"}
              onClick={() => onOpen(record, kind)}
            >
              <span className="record-thumbnail" data-kind={kind}>
                {kind === "copy" ? (
                  <>
                    <Icon name="copy" size={view === "grid" ? 44 : 30} />
                    <span className="record-copy-mark">{labels.copy}</span>
                  </>
                ) : (
                  <>
                    <img src={record.imageUrl} alt="" />
                    {kind === "video" && (
                      <span className="record-video-mark">
                        <Icon name={easyMode || view === "grid" ? "play" : "video"} size={view === "grid" ? 36 : 24} />
                      </span>
                    )}
                  </>
                )}
              </span>
              <span className="record-item-copy">
                <strong>
                  {record.details.name?.trim() || record.details.description}
                </strong>
                <small>
                  {kinds.map((value) => labels[value]).join("·")} · {record.createdAt}
                </small>
                <span className="sr-only">{t("결과 다시 보기")}</span>
              </span>
              {view === "list" && <Icon name="arrow" size={20} />}
            </button>
            <button
              type="button"
              className="record-delete"
              aria-label={`${record.details.name?.trim() || labels[kind]} ${t("지우기")}`}
              onClick={() => {
                if (window.confirm(t("이 홍보물을 지울까요? 포스터·영상·글이 함께 지워지고 되돌릴 수 없어요."))) onDelete(record)
              }}
            >
              {t("지우기")}
            </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-results">
          <span className="empty-results-icon" aria-hidden="true"><Icon name="folder" size={34} /></span>
          <h3>
            {t(records.length
              ? "이 종류의 결과는 아직 없어요"
              : "아직 만든 결과가 없어요")}
          </h3>
          <p>{t("만들기에서 사진 한 장으로 시작해 보세요.")}</p>
          <button className="studio-primary" onClick={records.length ? onStartNew : onCreate}>
            {records.length ? t("새 홍보물 만들기") : "홍보물 만들기"}
          </button>
        </div>
      )}
    </section>
  )
}
function Plan({ easyMode }: { easyMode: boolean }) {
  const [selected, setSelected] = useState<"subscription" | "single">(
    "subscription",
  )

  return (
    <section className="plan-screen">
      <h2 data-screen-heading tabIndex={-1}>
        {uiText("내게 맞는 이용 방식을 골라 보세요", easyMode)}
      </h2>
      <p className="plan-note">
        {uiText(
          "가격은 아직 정하는 중이에요. 지금은 무료로 쓸 수 있어요.",

          easyMode,
        )}
      </p>
      <div className="plan-options">
        {[
          [
            "subscription",
            "매달 이용하는 구독 플랜",
            "꾸준히 홍보물을 만드는 사장님께",
          ],

          [
            "single",
            "한 번씩 이용하는 건당 플랜",
            "필요할 때 한 번씩 만드는 사장님께",
          ],
        ].map(([value, title, note]) => (
          <button
            key={value}
            onClick={() => setSelected(value as "subscription" | "single")}
            aria-pressed={selected === value}
            className="plan-option"
          >
            <span className="plan-radio" aria-hidden="true" />
            <strong>
              {uiText(title, easyMode)}
            </strong>
            <span className="plan-option-note">{uiText(note, easyMode)}</span>
            <span className="plan-status">
              {uiText("세부 조건은 준비 중", easyMode)}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>("home")

  const [creationType, setCreationType] = useState<CreationType>("all")

  const [allOutputFormat, setAllOutputFormat] = useState<OutputFormat>("both")

  const [step, setStep] = useState<Step>(1)

  const [channel, setChannel] = useState<Channel>("instagram")

  const [imageUrl, setImageUrl] = useState("")
  const [sceneImage, setSceneImage] = useState<{ forImage: string; url: string } | null>(null)

  const [mobileOpen, setMobileOpen] = useState(false)
  // A result opened from 내 홍보물 goes back to that list, not to the 정보 입력 step.
  const [openedFromRecords, setOpenedFromRecords] = useState(false)

  const [details, setDetails] =
    useState<GeneratedRecord["details"]>(initialDetails)
  const [preferredResultTab, setPreferredResultTab] =
    useState<"poster" | "video" | "copy">("poster")

  const [recommendedHashtagsByChannel, setRecommendedHashtagsByChannel] =
    useState<Record<Channel, string> | undefined>(initialHashtagValues)

  const [userHashtagsByChannel, setUserHashtagsByChannel] =
    useState<Record<Channel, string> | undefined>(initialHashtagValues)

  const [userTouched, setUserTouched] = useState(false)

  const [aiPromo, setAiPromo] = useState<AiPromo | null>(null)

  // Real video: when a job learns its request id or URL later, update the saved record too. A job started by
  // 다시 만들기 after the record was saved (its first try failed, so the record has no video) belongs to the
  // record on screen.
  const aiVideo = useAiVideo((jobId, video) =>
    setRecords((current) => current.some((record) => record.video?.jobId === jobId)
      ? current.map((record) => (record.video?.jobId === jobId ? { ...record, video: { ...record.video, ...video } } : record))
      : current.map((record) => (record.id === currentRecordId && !record.video ? { ...record, video } : record))),
    (jobId) => Boolean(jobId) && recordsRef.current.some((record) => record.video?.jobId === jobId))

  const [continuationNotice, setContinuationNotice] = useState(false)

  const [records, setRecords] = useState<GeneratedRecord[]>([])
  const recordsRef = useRef(records)
  recordsRef.current = records
  // 내 홍보물 on this device: read once, then saved whenever the list changes.
  const [recordsStored, setRecordsStored] = useState(false)
  const recordsLoadedRef = useRef(false)
  useEffect(() => {
    void loadRecords<GeneratedRecord>().then((saved) => {
      if (saved) {
        setRecords((current) => [...current, ...saved.filter((record) => !current.some((item) => item.id === record.id))])
        setRecordsStored(true)
      }
      recordsLoadedRef.current = true
    })
  }, [])
  useEffect(() => {
    if (!recordsLoadedRef.current) return
    void saveRecords(records).then(setRecordsStored)
  }, [records])

  // 회원가입·로그인 (Supabase): a signed-in owner's records are mirrored on the server (src/cloudRecords.ts).
  // Signing in reads them; signing out takes them off this device (they stay on the server).
  const auth = useAuth()
  const userId = auth.user?.id ?? ""
  const syncedRef = useRef(new Map<string, string>())
  const pendingFilesRef = useRef(new Map<string, Map<"poster" | "video", Blob>>())
  const previousUserRef = useRef("")
  const recordData = (record: GeneratedRecord) => {
    const { imageUrl: _image, sceneUrl: _scene, owner: _owner, cloud: _cloud, cloudFiles: _files, ...rest } = record
    return JSON.stringify(rest)
  }
  useEffect(() => {
    if (!auth.ready) return
    const previous = previousUserRef.current
    previousUserRef.current = userId
    if (previous && previous !== userId) {
      syncedRef.current.clear()
      pendingFilesRef.current.clear()
      setRecords((current) => current.filter((record) => record.owner !== previous))
    }
    if (!userId) return
    void loadCloudRecords<GeneratedRecord>(userId).then((cloud) => {
      if (!cloud.length || previousUserRef.current !== userId) return
      for (const record of cloud) syncedRef.current.set(record.id, recordData(record))
      setRecords((current) => {
        const ids = new Set(current.map((record) => record.id))
        const updated = current.map((record) => {
          const remote = cloud.find((item) => item.id === record.id)
          return remote ? { ...record, owner: userId, cloudFiles: remote.cloudFiles } : record
        })
        const added = cloud.filter((record) => !ids.has(record.id)).map((record) => ({ ...record, cloud: { photo: "server", scene: record.sceneUrl ? "server" : undefined } }))
        return [...updated, ...added]
      })
    })
  }, [userId, auth.ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const flushFiles = (recordId: string) => {
    const files = pendingFilesRef.current.get(recordId)
    if (!files || !userId) return
    pendingFilesRef.current.delete(recordId)
    for (const [kind, blob] of files) void saveCloudFile(userId, recordId, kind, blob).catch(() => undefined)
  }
  useEffect(() => {
    if (!userId) return
    // Shortly after the list settles: new or changed records go up, records deleted here go from the server.
    const timer = window.setTimeout(() => {
      const current = recordsRef.current
      const ids = new Set(current.map((record) => record.id))
      for (const id of [...syncedRef.current.keys()]) {
        if (ids.has(id)) continue
        syncedRef.current.delete(id)
        void deleteCloudRecord(userId, id).catch(() => undefined)
      }
      for (const record of current) {
        if (record.owner && record.owner !== userId) continue
        const data = recordData(record)
        const photoKey = pictureKey(record.imageUrl)
        const sceneKey = pictureKey(record.sceneUrl)
        const uploadPhoto = !record.cloud?.photo
        const uploadScene = Boolean(record.sceneUrl) && record.cloud?.scene !== sceneKey && record.cloud?.scene !== "server"
        if (record.owner === userId && !uploadPhoto && !uploadScene && syncedRef.current.get(record.id) === data) continue
        syncedRef.current.set(record.id, data)
        void saveCloudRecord(userId, record, { uploadPhoto, uploadScene })
          .then(() => {
            setRecords((list) => list.map((item) => item.id === record.id
              ? { ...item, owner: userId, cloud: { photo: item.cloud?.photo ?? photoKey, scene: uploadScene ? sceneKey : item.cloud?.scene } }
              : item))
            flushFiles(record.id)
          })
          .catch(() => syncedRef.current.delete(record.id))
      }
    }, 800)
    return () => window.clearTimeout(timer)
  }, [records, userId]) // eslint-disable-line react-hooks/exhaustive-deps
  /** The record shown on the result screen; poster shape and first-line choices made there are saved into it. */
  const [currentRecordId, setCurrentRecordId] = useState("")
  /** The poster or video for the record on screen: uploaded now if its row is on the server, else right after. */
  const saveResultFile = (kind: "poster" | "video", file: Blob) => {
    if (!userId || !currentRecordId) return
    const files = pendingFilesRef.current.get(currentRecordId) ?? new Map<"poster" | "video", Blob>()
    files.set(kind, file)
    pendingFilesRef.current.set(currentRecordId, files)
    const record = recordsRef.current.find((item) => item.id === currentRecordId)
    if (record?.owner === userId && syncedRef.current.has(record.id)) flushFiles(record.id)
  }

  // Remembered on this device so an older user does not have to find the switch again after a reload.
  const [easyMode, setEasyModeState] = useState(() => {
    try {
      return localStorage.getItem("hongboitda-easy-mode") === "1"
    } catch {
      return false
    }
  })
  const [generatingView, setGeneratingView] = useState(false)
  const [editedHashtags, setEditedHashtags] =
    useState<Record<Channel, boolean>>(() => mapChannels(() => false))

  const [speaking, setSpeaking] = useState(false)

  const [speechPreparing, setSpeechPreparing] = useState(false)

  const [speechMessage, setSpeechMessage] = useState("")

  const speechRequestRef = useRef(0)

  const outputFormat: OutputFormat =
    creationType === "all"
      ? allOutputFormat
      : creationType === "video"
        ? "video"
        : "poster"

  const safeRecommendedHashtags = normalizeHashtagValues(
    recommendedHashtagsByChannel,

    details,
  )

  const safeUserHashtags = normalizeHashtagValues(
    userHashtagsByChannel,

    details,
  )

  useEffect(() => {
    setRecommendedHashtagsByChannel((current) =>
      normalizeHashtagValues(current, initialDetails),
    )

    setUserHashtagsByChannel((current) =>
      normalizeHashtagValues(current, initialDetails),
    )
  }, [])

  useEffect(
    () => () => {
      if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl)
    },

    [imageUrl],
  )

  useEffect(() => {
    speechRequestRef.current += 1

    if ("speechSynthesis" in window) {
      const synthesis = window.speechSynthesis

      if (synthesis.speaking || synthesis.pending || synthesis.paused) {
        synthesis.cancel()
      }
    }

    setSpeaking(false)

    setSpeechPreparing(false)

    setSpeechMessage("")

    {
      const scrollingElement = document.scrollingElement

      if (scrollingElement) scrollingElement.scrollTop = 0

      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
      const previewFrame = document.querySelector<HTMLElement>(".studio-shell")
      if (previewFrame) previewFrame.scrollTop = 0

      const appMain = document.querySelector<HTMLElement>(
        "[data-app-scroll-container]",
      )

      if (appMain) appMain.scrollTop = 0

      if (page === "create" && step === 3) {
        // Preserve the introduction above, but begin the result at its tabs.
        const frame = window.requestAnimationFrame(() => {
          const activeTab = document.querySelector<HTMLElement>(
            '.result-tabs [aria-selected="true"]',
          )
          const results = activeTab?.closest<HTMLElement>(".results-step")
          results?.scrollIntoView({ block: "start", behavior: "instant" })
          activeTab?.focus({ preventScroll: true })
        })
        return () => window.cancelAnimationFrame(frame)
      }

      document
        .querySelector<HTMLElement>("[data-screen-heading]")
        ?.focus({ preventScroll: true })
    }
  }, [page, step, creationType])

  const setEasyMode = (enabled: boolean) => {
    setEasyModeState(enabled)
    try {
      localStorage.setItem("hongboitda-easy-mode", enabled ? "1" : "0")
    } catch {
      // Storage can be off (private mode); the choice still applies to this visit.
    }

    if (!enabled) {
      speechRequestRef.current += 1

      if ("speechSynthesis" in window) {
        const synthesis = window.speechSynthesis

        if (synthesis.speaking || synthesis.pending || synthesis.paused) {
          synthesis.cancel()
        }
      }

      setSpeaking(false)

      setSpeechPreparing(false)

      setSpeechMessage("")
    }
  }

  const saveLabel = isMobileDevice() ? "폰에 저장" : "컴퓨터에 저장"
  const easySpeechText = (() => {
    const shopOrName = details.shopName?.trim() || details.name?.trim() || details.description.trim()
    const createLabel = uiText({ all: "홍보물 만들기", poster: "이미지 만들기", video: "영상 만들기", copy: "홍보 글 만들기" }[creationType], true)
    if (page === "login") return "로그인 화면이에요. 아래 바로 시작하기를 누르면 가입 없이 쓸 수 있어요."
    if (page === "home") return "첫 화면이에요. 사진 한 장이면 홍보물이 돼요. 홍보물 만들기를 누르세요. 다음 화면에서 사진을 넣어요."
    if (page === "records") return "내 홍보물 화면이에요. 만든 것을 누르면 다시 볼 수 있어요."
    if (page === "plan") return "이용 요금 화면이에요. 가격은 아직 안 정했어요."
    if (step === 1) {
      return imageUrl
        ? "사진을 넣었어요. 다음으로를 누르세요. 다른 사진은 사진 바꾸기를 누르세요."
        : "사진을 넣는 화면이에요. 사진 넣기를 누르세요. 휴대폰 사진이면 돼요."
    }
    if (step === 2) {
      return (
        "제품 이름을 쓰는 화면이에요. 제품 이름만 꼭 써 주세요. " +
        (recognitionConstructor() ? "말로 하기를 누르면 말로 쓸 수 있어요. " : "") +
        (details.name?.trim() ? "지금 제품 이름은 " + details.name.trim() + "이에요. " : "") +
        "다 썼으면 아래 " + createLabel + "를 누르세요."
      )
    }
    if (generatingView) return "만들고 있어요. 조금만 기다려 주세요. 다 되면 바로 보여 드려요."
    return `다 만들었어요. ${shopOrName}. ${saveLabel}을 누르면 저장돼요. 보내기를 누르면 바로 보낼 수 있어요.`
  })()
  const speechText = easyMode ? easySpeechText : (() => {
    const speakUi = (text: string) => uiText(text, easyMode)
    if (page === "login") {
      return "이메일과 비밀번호를 입력하고 로그인하거나, 바로 시작하기 버튼을 누르세요."
    }

    if (page === "home") {
      return "첫 화면입니다. 홍보물 만들기 버튼을 누르면 바로 사진을 올릴 수 있어요. 사진을 올리고 어떤 제품인지 적으면 포스터, 짧은 영상, 홍보 글을 만들어 드려요. 회원가입 없이 바로 시작할 수 있어요."
    }

    if (page === "records") {
      return "내 홍보물 화면입니다. 이 창에서 만든 결과를 다시 열 수 있어요. "
    }

    if (page === "plan") {
      return easyMode
        ? "이용 방법 화면입니다. 매달 이용하거나 필요할 때 이용하는 방법을 고를 수 있으며, 가격과 만들 수 있는 수량은 아직 정해지지 않았습니다."
        : "이용권 화면입니다. 구독으로 이용하거나 건당 이용하는 구조를 선택할 수 있으며, 가격과 수량은 아직 정해지지 않았습니다."
    }

    if (step === 1) {
      const format =
        creationType === "all"
          ? [allOutputFormat !== "video" && "이미지", allOutputFormat !== "poster" && "영상", "홍보 글"].filter(Boolean).join(", ")
          : creationType === "poster" ? "이미지" : creationType === "video" ? "영상" : "홍보 글"

      return `${speakUi(creationNames[creationType])} 1단계, 사진 올리기입니다. 만들 결과는 ${format}입니다. ${
        imageUrl
          ? "사진이 준비됐어요. 사진 변경 버튼으로 다시 고르거나 다음으로 버튼을 누르세요."
          : "카메라 버튼이나 사진 선택하기 버튼으로 사진 한 장을 선택해 주세요."
      }`
    }

    if (step === 2) {
      return (
        "제품 이름을 적어 주세요. 가게 이름과 홍보 분위기는 골라도 되고 비워 둬도 돼요. 더 자세히 알려주기를 누르면 제품 설명, 알리고 싶은 점, 핵심 특징, 주요 고객층을 더 적을 수 있어요. " +
        (details.name?.trim()
          ? "상품 이름은 " + details.name + ". "
          : "") +
        "적은 제품 이름과 알리고 싶은 점은 " +
        ([details.description, details.features].filter(Boolean).join(". ") || "비워 두었어요") +
        ". " +
        "사진 변경 버튼으로 사진을 바꿀 수 있어요. 다 적었으면 " + { all: "홍보물 만들기", poster: "이미지 만들기", video: "영상 만들기", copy: "홍보 글 만들기" }[creationType] + " 버튼을 누르세요."
      )
    }

    if (generatingView) {
      return "만드는 중입니다. 잠시만 기다려 주세요. 다 만들어지면 결과 화면으로 넘어가요. 멈추려면 취소 버튼을 누르세요."
    }

    return `결과 보기 화면입니다. ${details.shopName?.trim() || details.name?.trim() || details.description.trim()}. 이미지와 영상은 다운로드 버튼으로 저장하고, 홍보 글은 복사하기 버튼으로 가져가세요. 공유하기 버튼으로 바로 보낼 수도 있어요. 홈으로 버튼을 누르면 첫 화면으로 돌아가요.`
  })()

  const stopSpeech = () => {
    speechRequestRef.current += 1
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
    setSpeaking(false)
    setSpeechPreparing(false)
    setSpeechMessage("")
  }

  const toggleSpeech = async () => {
    if (
      !("speechSynthesis" in window) ||
      typeof window.SpeechSynthesisUtterance === "undefined"
    ) {
      setSpeaking(false)

      setSpeechPreparing(false)

      setSpeechMessage(
        uiText("현재 브라우저에서 읽어주기를 사용할 수 없어요.", easyMode),
      )

      return
    }

    const synthesis = window.speechSynthesis

    if (speaking || speechPreparing) {
      speechRequestRef.current += 1

      if (synthesis.speaking || synthesis.pending || synthesis.paused) {
        synthesis.cancel()
      }

      setSpeaking(false)

      setSpeechPreparing(false)

      setSpeechMessage("")

      return
    }

    const requestId = speechRequestRef.current + 1

    speechRequestRef.current = requestId

    setSpeechPreparing(true)
    setSpeechMessage(uiText("읽어주기를 준비하고 있어요.", easyMode))

    let voices = synthesis.getVoices()

    if (voices.length === 0) {
      voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
        let settled = false

        const finish = () => {
          if (settled) return

          settled = true

          synthesis.removeEventListener("voiceschanged", finish)

          window.clearTimeout(timeoutId)

          resolve(synthesis.getVoices())
        }

        const timeoutId = window.setTimeout(finish, 1500)

        synthesis.addEventListener("voiceschanged", finish, { once: true })
      })
    }

    if (speechRequestRef.current !== requestId) return

    if (synthesis.speaking || synthesis.pending || synthesis.paused) {
      synthesis.cancel()
    }

    const visibleCopy = document.querySelector<HTMLElement>(
      "#result-copy:not([hidden]) .copy-result-text",
    )?.textContent
    const visiblePoster = document.querySelector<HTMLElement>(
      "#result-poster:not([hidden]) #poster-visible-text",
    )?.textContent
    const visibleVideo = document.querySelector("#result-video:not([hidden])")
    const videoControl = visibleVideo?.querySelector(".result-preview-action")?.textContent?.trim()
    const videoAction = visibleVideo?.querySelector(".result-primary-action")?.textContent?.trim()
    const videoState = visibleVideo?.querySelector(".result-inline-status")?.textContent?.trim()
    const videoSpeech = `영상 결과입니다. ${details.shopName?.trim() || details.name?.trim() || details.description.trim()}. ${videoControl === "일시 정지"
      ? "일시 정지 버튼으로 사진 움직임을 멈출 수 있어요."
      : "재생하기 버튼으로 사진 움직임을 확인하세요."} ${videoAction === "준비 취소"
      ? "준비 취소 버튼으로 영상 파일 준비를 취소할 수 있어요."
      : "다운로드 버튼으로 파일을 가져오거나 공유하기 버튼을 누르세요."}${videoState ? " " + videoState : ""}`
    const name = details.shopName?.trim() || details.name?.trim() || details.description.trim()
    const easyResultSpeech = visibleCopy
      ? "홍보 글이에요. " + visibleCopy + " 글 복사하기를 누르면 복사돼요. 그다음 원하는 곳에 붙여 넣으세요."
      : visiblePoster
        ? "포스터예요. " + visiblePoster + " " + saveLabel + "을 누르면 저장돼요. 보내기를 누르면 바로 보낼 수 있어요."
        : visibleVideo
          ? `짧은 영상이에요. ${name}. 틀어 보기를 누르면 사진이 움직여요. ${saveLabel}을 누르면 저장돼요.`
          : ""
    const utterance = new SpeechSynthesisUtterance(
      easyMode ? easyResultSpeech || speechText
      : visibleCopy ? "홍보 글 결과입니다. " + visibleCopy + " 복사하기 버튼으로 글을 가져가거나 공유하기 버튼을 누르세요."
        : visiblePoster ? "이미지 결과입니다. " + visiblePoster + " 다운로드 버튼으로 저장하거나 공유하기 버튼을 누르세요."
          : visibleVideo ? videoSpeech
            : speechText,
    )

    utterance.lang = "ko-KR"

    utterance.rate = 0.9

    utterance.pitch = 1

    utterance.volume = 1

    const koreanVoice = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith("ko"),
    )

    if (koreanVoice) {
      utterance.voice = koreanVoice
    }

    let startTimeoutId = window.setTimeout(() => {
      if (speechRequestRef.current === requestId) {
        speechRequestRef.current += 1
        synthesis.cancel()
        setSpeaking(false)

        setSpeechPreparing(false)

        setSpeechMessage(
          uiText("일시적으로 읽어주기를 시작하지 못했어요. 다시 눌러 시도해 주세요.", easyMode),
        )
      }
    }, 8000)

    utterance.onstart = () => {
      if (speechRequestRef.current !== requestId) return

      window.clearTimeout(startTimeoutId)

      setSpeechPreparing(false)

      setSpeaking(true)

      setSpeechMessage("")
    }

    utterance.onend = () => {
      if (speechRequestRef.current !== requestId) return

      window.clearTimeout(startTimeoutId)

      setSpeaking(false)

      setSpeechPreparing(false)

      setSpeechMessage("")
    }

    utterance.onerror = (event) => {
      if (speechRequestRef.current !== requestId) return

      window.clearTimeout(startTimeoutId)

      setSpeaking(false)

      setSpeechPreparing(false)

      if (event.error === "canceled" || event.error === "interrupted") {
        setSpeechMessage("")
        return
      }

      setSpeechMessage(
        uiText("일시적으로 읽어주기를 시작하지 못했어요. 화면을 한 번 누른 뒤 다시 시도해 주세요.", easyMode),
      )
    }

    try {
      synthesis.speak(utterance)
    } catch {
      window.clearTimeout(startTimeoutId)

      setSpeaking(false)

      setSpeechPreparing(false)

      setSpeechMessage(
        uiText("일시적으로 읽어주기를 시작하지 못했어요. 다시 눌러 시도해 주세요.", easyMode),
      )
    }
  }

  // The tab title follows the screen heading, so screen-reader and tab users know where they are.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector("[data-screen-heading]")?.textContent?.trim()
      document.title = heading && page !== "home" ? `${heading} — 홍보잇다` : "홍보잇다 — 사진 한 장으로 시작하는 우리 가게 홍보"
    })
    return () => window.cancelAnimationFrame(frame)
  }, [page, step, generatingView, easyMode])

  // Warn before a reload or tab close would throw work away: results when they could not be stored on this
  // device, a photo that has not become a result yet, the 만드는 중 screen (nothing saved yet), and a paid video
  // whose request id has not come back (closing then would leave a charged job nobody can find).
  const hasWorkToLose = (records.length > 0 && !recordsStored) || (Boolean(imageUrl) && page === "create" && step < 3) ||
    generatingView || aiVideo.state.phase === "starting"
  useEffect(() => {
    if (!hasWorkToLose) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [hasWorkToLose])

  // The 고급형 scene arrives about a minute after the result was saved: put it into that record too.
  useEffect(() => {
    if (!sceneImage) return
    setRecords((current) => current.map((record) => record.id === currentRecordId && record.imageUrl === sceneImage.forImage && record.sceneUrl !== sceneImage.url ? { ...record, sceneUrl: sceneImage.url } : record))
  }, [sceneImage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Changes made on the result screen (poster shape, chosen first line) are saved into the record shown.
  // Not while 만드는 중: a new AI answer then belongs to the record about to be created, not the old one.
  useEffect(() => {
    if (!currentRecordId || page !== "create" || step !== 3 || generatingView) return
    // Only what can be changed on the result screen, so other edits never leak into an older record.
    const { posterRatio, posterLayout, posterTheme } = details
    setRecords((current) => current.map((record) => record.id === currentRecordId
      ? {
          ...record,
          details: { ...record.details, posterRatio, posterLayout, posterTheme },
          ...(record.promo && aiPromo && record.promo.signature === aiPromo.signature ? { promo: { ...record.promo, chosen: aiPromo.chosen } } : {}),
        }
      : record))
  }, [details, aiPromo]) // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (nextPage: Page, type?: CreationType) => {
    setOpenedFromRecords(false)
    // Leaving the 만드는 중 screen: no record holds the paid video job yet, so refund it instead of orphaning it.
    if (generatingView) aiVideo.cancel()
    if (nextPage === "create" && type) {
      setCreationType(type)
      setAllOutputFormat("both")
      setPreferredResultTab(type === "video" ? "video" : type === "copy" ? "copy" : "poster")
      setImageUrl("")
      setDetails({ ...initialDetails })
      setEditedHashtags(mapChannels(() => false))
      setRecommendedHashtagsByChannel(initialHashtagValues())
      setUserHashtagsByChannel(initialHashtagValues())
      setUserTouched(false)
      setContinuationNotice(false)
      setAiPromo(null)
      aiVideo.reset()
      setStep(1)
    }
    setPage(nextPage)
    setMobileOpen(false)
  }

  /** ← in the header and the phone's back button. Returns false at home, where back should leave the app. */
  const goBack = () => {
    if (mobileOpen) {
      setMobileOpen(false)
      return true
    }
    if (page === "home" || page === "login") return false
    // ← while 만드는 중 works like its 취소 button: the paid video job is refunded, not left without a record.
    if (generatingView) aiVideo.cancel()
    if (page === "create" && step === 3 && openedFromRecords && !generatingView) navigate("records")
    else if (page === "create" && step > 1) setStep((step - 1) as Step)
    else navigate("home")
    return true
  }
  const goBackRef = useRef(goBack)
  goBackRef.current = goBack
  // The app changes screens without changing the address, so the phone's back button used to leave the app
  // (older users press it most). One extra history entry catches it and runs goBack instead; at home it is
  // let through, so back still leaves the app from there.
  useEffect(() => {
    window.history.pushState({ hongboitda: true }, "")
    const onPop = () => {
      if (goBackRef.current()) window.history.pushState({ hongboitda: true }, "")
      else window.history.back()
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const startNew = () => {
    setAllOutputFormat("both")
    setPreferredResultTab(creationType === "video" ? "video" : creationType === "copy" ? "copy" : "poster")
    setEditedHashtags(mapChannels(() => false))
    setImageUrl("")

    setDetails({ ...initialDetails })

    setRecommendedHashtagsByChannel(initialHashtagValues())

    setUserHashtagsByChannel(initialHashtagValues())

    setUserTouched(false)

    setContinuationNotice(false)

    setAiPromo(null)

    aiVideo.reset()

    setStep(1)

    setPage("create")
  }

  const saveCurrentResult = () => {
    const record: GeneratedRecord = {
      editedHashtags: { ...editedHashtags },
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,

      createdAt: new Intl.DateTimeFormat("ko-KR", {
        month: "long",

        day: "numeric",

        hour: "2-digit",

        minute: "2-digit",
      }).format(new Date()),

      type: creationType,

      outputFormat,

      channel,

      imageUrl,

      ...(sceneImage?.forImage === imageUrl ? { sceneUrl: sceneImage.url } : {}),

      details: { ...details, tones: normalizeTones(details) },

      userHashtags: { ...safeUserHashtags },

      ...(aiPromo && aiPromo.signature === promoSignature(details, channel) ? { promo: aiPromo } : {}),

      ...(aiVideo.saved() ? { video: aiVideo.saved() } : {}),
    }

    setRecords((current) => [record, ...current])
    setCurrentRecordId(record.id)
  }


  const openRecord = (
    record: GeneratedRecord,
    resultType: "poster" | "video" | "copy",
  ) => {
    setOpenedFromRecords(true)
    setPreferredResultTab(resultType)
    setEditedHashtags(mapChannels((id) => record.editedHashtags?.[id] ?? true))
    setCreationType(record.type)

    if (record.type === "all") setAllOutputFormat(record.outputFormat)

    setChannel(record.channel)

    setImageUrl(record.imageUrl)
    setSceneImage(record.sceneUrl ? { forImage: record.imageUrl, url: record.sceneUrl } : null)

    // Older records stored a single `tone`; normalizeTones() migrates it to `tones`.
    const { tone: _legacyTone, ...recordDetails } = record.details
    setDetails({ ...recordDetails, tones: normalizeTones(record.details) })

    setAiPromo(record.promo ?? null)
    setCurrentRecordId(record.id)

    aiVideo.restore(record.video)

    setUserHashtagsByChannel(
      normalizeHashtagValues(record.userHashtags, record.details),
    )

    setRecommendedHashtagsByChannel(initialHashtagValues(record.details))

    setUserTouched(true)

    setContinuationNotice(false)

    setStep(3)

    setPage("create")
  }

  if (page === "login") {
    return (
      <Login
        onEnter={() => setPage("home")}
        auth={{
          configured: authConfigured,
          onEmail: async (mode, email, password) => {
            if (mode === "signup") return signUpWithEmail(email, password)
            await signInWithEmail(email, password)
            return "signed-in"
          },
          onSocial: signInWithProvider,
          errorText: authErrorMessage,
        }}
        easyMode={easyMode}
        speaking={speaking}
        speechPreparing={speechPreparing}
        onSpeak={toggleSpeech}
        speechMessage={speechMessage}
      />
    )
  }

  const titles: Record<Exclude<Page, "login">, string> = {
    home: "메인 대시보드",

    create: creationNames[creationType],

    records: "내 홍보물",

    plan: "이용권",
  }

  return (
    <Shell
      page={page}
      title={uiText(titles[page], easyMode)}
      creationType={creationType}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
      resultView={page === "create" && step === 3}
      generating={page === "create" && step === 3 && generatingView}
      creationView={page === "create"}
      navigate={navigate}
      onBack={goBack}
      easyMode={easyMode}
      setEasyMode={setEasyMode}
      speaking={speaking}
      speechPreparing={speechPreparing}
      onSpeak={toggleSpeech}
      speechMessage={speechMessage}
      onLogout={() => {
        setMobileOpen(false)

        setPage("login")
      }}
      account={auth.user ? {
        email: auth.user.email ?? uiText("로그인한 계정", easyMode),
        onSignOut: () => {
          setMobileOpen(false)
          void signOut()
        },
        onDelete: () => {
          if (!window.confirm("회원 탈퇴하면 계정과 서버에 저장한 홍보물이 모두 지워져요. 탈퇴할까요?")) return
          setMobileOpen(false)
          void deleteAccount().then(() => window.alert("탈퇴했어요. 그동안 이용해 주셔서 감사해요.")).catch(() => window.alert("탈퇴하지 못했어요. 잠시 뒤에 다시 해 주세요."))
        },
      } : null}
    >
      {page === "home" && (
        <Home
          navigate={navigate}
          easyMode={easyMode}
          hasDraft={userTouched}
          onChooseCreation={() => navigate("create", "all")}
        />
      )}
      {page === "create" && (
        <CreateFlow
          initialResultTab={preferredResultTab}
          type={creationType}
          channel={channel}
          setChannel={setChannel}
          step={step}
          setStep={setStep}
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
          details={details}
          setDetails={(next) => {
            setDetails(next)
            const recommendations = initialHashtagValues(next)
            setRecommendedHashtagsByChannel(recommendations)
            setUserHashtagsByChannel((current) => {
              const existing = normalizeHashtagValues(current, next)
              return mapChannels((id) =>
                editedHashtags[id] ? existing[id] : recommendations[id],
              )
            })
          }}
          recommendedHashtagsByChannel={safeRecommendedHashtags}
          setRecommendedHashtagsByChannel={setRecommendedHashtagsByChannel}
          userHashtagsByChannel={safeUserHashtags}
          setUserHashtagsByChannel={(next) => {
            setUserHashtagsByChannel(next)
            setEditedHashtags((current) => ({ ...current, [channel]: true }))
          }}
          outputFormat={outputFormat}
          onOutputFormatChange={(format) => {
            setAllOutputFormat(format)
            setUserTouched(true)
          }}
          continuationNotice={continuationNotice}
          onDraftTouched={() => {
            setUserTouched(true)
          }}
          easyMode={easyMode}
          onResultCreated={saveCurrentResult}
          onResultFile={saveResultFile}
          onDashboard={() => navigate("home")}
          onStartNew={startNew}
          onResultTabChange={stopSpeech}
          onStopSpeech={stopSpeech}
          onGeneratingChange={setGeneratingView}
          aiPromo={aiPromo}
          setAiPromo={setAiPromo}
          aiVideo={aiVideo}
          sceneImage={sceneImage}
          setSceneImage={setSceneImage}
        />
      )}
      {page === "records" && (
        <Records
          easyMode={easyMode}
          stored={recordsStored}
          records={records}
          onOpen={(record, kind) => {
            // A record read from the server has links; it opens like a local one once its pictures are data URLs.
            if (!/^https?:/.test(record.imageUrl)) return openRecord(record, kind)
            void Promise.all([toDataUrl(record.imageUrl), record.sceneUrl ? toDataUrl(record.sceneUrl) : Promise.resolve(undefined)])
              .then(([imageUrl, sceneUrl]) => openRecord({ ...record, imageUrl, sceneUrl }, kind))
              .catch(() => window.alert("사진을 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요."))
          }}
          onDelete={(record) => setRecords((current) => current.filter((item) => item.id !== record.id))}
          onCreate={() => navigate("create", "all")}
          onStartNew={startNew}
        />
      )}
      {page === "plan" && <Plan easyMode={easyMode} />}
    </Shell>
  )
}
