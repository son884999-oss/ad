import {
  ChangeEvent,
  type ComponentPropsWithoutRef,
  FormEvent,
  ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { wrapCanvasText } from "./canvasText"
import PhotoStep from "./PhotoStep"
import StepProgress from "./StepProgress"
import Icon from "./Icon"
import { useFeedback } from "./FeedbackProvider"
import PublishingGuide from "./PublishingGuide"
import ServiceArt from "./ServiceArt"
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

type Page = "login" | "home" | "create" | "records" | "plan"

type CreationType = "all" | "poster" | "video" | "copy"

type Step = 1 | 2 | 3

type OutputFormat = "poster" | "video" | "both"

type FileStatus = "idle" | "preparing" | "ready" | "cancelled" | "failed" | "unsupported"

type GeneratedRecord = {
  editedHashtags?: Record<Channel, boolean>
  id: string

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
  }

  userHashtags: Record<Channel, string>
}


const creationNames: Record<CreationType, string> = {
  all: "한 번에 만들기",

  poster: "이미지 만들기",

  video: "영상 만들기",

  copy: "문구 만들기",
}

// Restore the result help menus by enabling this flag.
const RESULT_SECONDARY_FEATURES_ENABLED = false

const initialDetails = {
  shopName: "",
  name: "",
  description: "",

  features: "",

  audience: "",
}

const outputFormatNames: Record<OutputFormat, string> = {
  poster: "포스터",

  video: "영상",

  both: "포스터와 영상 둘 다",
}

const easyUiDictionary: Record<string, string> = {
  "메인 대시보드": "첫 화면",

  "대시보드로 돌아가기": "첫 화면으로 돌아가기",

  이용권: "이용 방법",

  "구독으로 이용": "매달 이용",

  "건당 이용": "필요할 때 이용",

  "쓰레드(Threads)": "쓰레드",

  "엑스(X)": "엑스",

  Threads: "쓰레드",

  X: "엑스",

  "결과 형식": "만들 종류",

  "선택한 결과 형식": "고른 만들 종류",

  "선택된 결과 형식": "고른 만들 종류",

  "결과 형식을 선택해 주세요": "만들 종류를 골라 주세요",

  "홍보 채널": "홍보할 곳",

  채널: "홍보할 곳",

  "현재 결과 형식": "현재 만들 종류",

  "홍보 채널을 선택해 주세요": "홍보할 곳을 골라 주세요",

  "JPG, PNG 등 이미지 파일을 선택해 주세요": "사진 파일을 골라 주세요",

  "설명·해시태그 확인": "설명·검색어(#) 확인",

  "정리된 설명과 추천 해시태그를 확인하고 고쳐 주세요.":
    "정리된 설명과 추천 검색어(#)를 확인하고 고쳐 주세요.",

  "형식·채널·사진 선택": "만들 종류·홍보할 곳·사진 고르기",

  "결과 형식과 채널을 고르고 제품 사진 한 장을 올려 주세요.":
    "만들 종류와 홍보할 곳을 고르고 제품 사진 한 장을 넣어 주세요.",

  "제품 정보와 해시태그 확인하기": "제품 설명과 검색어(#) 확인하기",

  "예시 초안을 제품에 맞게 수정하고, 추천 해시태그도 결과를 만들기 전에 직접 고쳐 주세요.":
    "처음 작성한 설명을 제품에 맞게 고치고, 추천 검색어(#)도 직접 고쳐 주세요.",

  "아래 내용은 실제 AI 분석이 아닌 예시 초안입니다. 제품에 맞게 자유롭게 고쳐 주세요.":
    "아래 내용은 자동 분석이 아닌 처음 작성한 설명입니다. 제품에 맞게 고쳐 주세요.",

  "사용할 해시태그 직접 수정": "사용할 검색어(#) 직접 수정",

  "추천 해시태그 후보": "추천 검색어(#)",

  "‘추천으로 교체’를 누르면 위 작성란이 추천 후보로 바뀝니다.":
    "‘추천으로 바꾸기’를 누르면 위 작성란이 추천 검색어(#)로 바뀝니다.",

  "포스터 미리보기": "포스터 확인 화면",

  "영상 다운로드": "영상 저장",

  해시태그: "검색어(#)",

  "확정 해시태그": "확정 검색어(#)",

  "채널에 맞는 홍보 문구": "홍보할 곳에 맞는 글",

  "문구와 확정 해시태그를 복사했어요.": "글과 확정 검색어(#)를 복사했어요.",

  "2단계 제품 정보와 해시태그 확인 화면입니다.":
    "2단계 제품 설명과 검색어(#) 확인 화면입니다.",

  "사용자가 입력한 확정 해시태그": "사용자가 입력한 검색어(#)",

  "현재 브라우저에서는 예시 영상을 만들 수 없어요.":
    "이 기기에서는 예시 영상을 만들 수 없어요.",

  "이 브라우저에서 저장할 수 있는 영상 형식을 찾지 못했어요.":
    "이 기기에서 저장할 수 있는 영상 종류를 찾지 못했어요.",

  "현재 브라우저에서 읽어주기를 사용할 수 없어요.":
    "이 기기에서는 화면 읽어주기를 사용할 수 없어요.",

  "단독 제작 바로가기": "원하는 것 바로 만들기",

  "내게 맞는 이용 방식을 골라 보세요": "내게 맞는 이용 방법을 골라 보세요",

  "현재는 구조를 확인하는 프로토타입이며, 가격과 제공 수량은 아직 정해지지 않았습니다.":
    "지금은 화면을 확인하는 시험용이며, 가격과 만들 수 있는 수량은 아직 정해지지 않았습니다.",
}

function uiText(text: string, easyMode: boolean) {
  if (!easyMode) return text

  return easyUiDictionary[text] ?? text
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
  },
) {
  const keywords = [
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

function drawWrappedText(
  context: CanvasRenderingContext2D,

  text: string,

  x: number,

  y: number,

  maxWidth: number,

  lineHeight: number,

  maxLines: number,
) {
  const lines = wrapCanvasText(context, text, maxWidth, maxLines)

  lines.forEach((value, index) =>
    context.fillText(value, x, y + index * lineHeight),
  )
}

function triggerFileDownload(file: File) {
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
}: {
  icon: "picture" | "video" | "copy"
  title: string
  control?: ReactNode
}) {
  return (
    <div className="result-card-heading">
      <span aria-hidden="true"><Icon name={icon} size={22} /></span>
      <div className="result-card-title">
        <h3>{title}</h3>
        <small>확인용 예시</small>
      </div>
      {control && <div className="result-preview-controls">{control}</div>}
    </div>
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
}: {
  label: string
  accessibleLabel: string
  icon: "download" | "copy" | null
  onClick: () => unknown
  disabled?: boolean
  busy?: boolean
  message?: string
  error?: boolean
}) {
  const statusId = useId()
  return (
    <div className="result-card-actions" aria-busy={busy}>
      <button
        type="button"
        className="result-primary-action"
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
      title: "상품 이름을 적어 주세요",

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
      <StepProgress step={step} onBack={onBack} />
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

  onDashboard,

  onStartNew,
  onResultTabChange,
  initialResultTab,
}: {
  type: CreationType

  step: Step

  setStep: (step: Step) => void

  channel: Channel


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

  onDashboard: () => void

  onStartNew: () => void
  onResultTabChange: () => void
  initialResultTab: "poster" | "video" | "copy"
}) {
  const { notify } = useFeedback()
  const [playing, setPlaying] = useState(false)
  const [selectedResultTab, setSelectedResultTab] =
    useState<"poster" | "video" | "copy">(initialResultTab)

  const [copyMessage, setCopyMessage] = useState("")

  const [posterStatus, setPosterStatus] = useState<FileStatus>("idle")
  const [posterPreviewStatus, setPosterPreviewStatus] = useState<FileStatus>("idle")
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
    !details.name?.trim() && "상품 이름",
  ].filter(Boolean)

  const videoRecorderRef = useRef<MediaRecorder | null>(null)

  const videoFrameRef = useRef<number | null>(null)

  const videoCancelledRef = useRef(false)
  const videoTaskRef = useRef<Promise<File | null> | null>(null)
  const videoContextRef = useRef(0)

  useEffect(() => {
    videoContextRef.current += 1
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
  ])

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    const request = ++uploadRequestRef.current
    event.currentTarget.value = ""
    const keepNotice = imageUrl ? " 기존 사진은 그대로예요." : ""

    const fail = () => {
      if (request === uploadRequestRef.current) {
        setUploadPending(false)
        setUploadMessage(
          "새 사진을 읽지 못했어요." +
            keepNotice +
            " JPG 또는 PNG 사진을 다시 선택해 주세요.",
        )
      }
    }

    if (!file.type.startsWith("image/")) {
      setUploadPending(false)
      setUploadMessage("사진 파일을 선택해 주세요." + keepNotice)
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadPending(false)
      setUploadMessage("20MB 이하의 사진 파일을 선택해 주세요." + keepNotice)
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

  const productSummary = [
    details.name?.trim(),
    details.shopName?.trim(),
    details.description,
  ].filter(Boolean).join("\n")
  const audienceRecommendation = details.audience.trim()
    ? `\n\n${details.audience}께 추천해요.`
    : ""
  const audienceLabel = details.audience.trim()
    ? `\n\n추천 대상: ${details.audience}`
    : ""
  const resultCopy: Record<Channel, string> = {
    ...mapChannels(
      () => `${productSummary}\n\n${details.features}${audienceRecommendation}`,
    ),
    naver_place: `${productSummary}\n\n${details.features}${audienceLabel}`,
    kakao: `우리 가게 소식을 전해요.\n\n${productSummary}\n${details.features}\n\n궁금한 점은 편하게 문의해 주세요.`,
    naver_blog: `${productSummary}\n\n이런 특징이 있어요\n${details.features}${audienceLabel}`,
    daangn: `이웃 여러분께 우리 가게를 소개해요.\n\n${productSummary}\n${details.features}\n\n궁금한 점은 문의해 주세요.`,
    youtube: `${details.features}\n\n${productSummary}${audienceLabel}`,
    instagram: `오늘을 더 특별하게 만드는 ${productSummary}\n\n${details.features}\n지금 사진으로 만나보세요.`,

    x: `${details.features} — 필요한 분은 바로 확인해 보세요.${audienceRecommendation}`,

    threads: `요즘 손님들이 자주 찾는 이유가 있더라고요.\n${productSummary}\n특히 ${details.features} 이 부분이 참 좋아요. 궁금한 점은 편하게 물어보세요.`,
  }
  const channelTheme = channelThemes[channel]

  const safeRecommendations = normalizeHashtagValues(
    recommendedHashtagsByChannel,

    details,
  )

  const safeUserHashtags = normalizeHashtagValues(
    userHashtagsByChannel,

    details,
  )

  const hashtags = parseHashtags(safeUserHashtags[channel])

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
    { id: "poster" as const, label: "이미지", available: showPoster },
    { id: "video" as const, label: "영상", available: showVideo },
    { id: "copy" as const, label: "문구", available: showCopy },
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

  const finalText = `${resultCopy[channel]}\n\n${hashtags.join(" ")}`.trim()
  const mediaText =
    details.name?.trim() &&
    resultCopy[channel].startsWith(details.name.trim() + "\n")
      ? resultCopy[channel].slice(details.name.trim().length).trimStart()
      : resultCopy[channel]

  const updateDetails = (nextDetails: GeneratedRecord["details"]) => {
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

  const createPosterFile = async (download: boolean) => {
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
      const image = await loadCanvasImage(imageUrl)
      await document.fonts.ready

      const canvas = document.createElement("canvas")

      canvas.width = 1080

      canvas.height = 1350

      const context = canvas.getContext("2d")

      if (!context) throw new Error("canvas-unavailable")

      drawImageCover(context, image, canvas.width, canvas.height)

      const gradient = context.createLinearGradient(0, 620, 0, 1350)

      gradient.addColorStop(0, "rgba(0,0,0,0)")

      gradient.addColorStop(0.35, `rgba(${channelTheme.rgb},0.6)`)

      gradient.addColorStop(1, `rgba(${channelTheme.rgb},0.92)`)

      context.fillStyle = gradient

      context.fillRect(0, 0, canvas.width, canvas.height)

      context.fillStyle = "#ffffff"

      context.font = '700 72px "Noto Sans KR", sans-serif'

      drawWrappedText(
        context,
        details.name?.trim() || details.features,
        76,
        960,
        928,
        84,
        3,
      )

      context.font = '500 48px "Noto Sans KR", sans-serif'

      drawWrappedText(context, mediaText, 76, 1180, 928, 62, 3)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      )

      if (!blob || blob.size === 0) throw new Error("empty-png")

      const file = new File([blob], `hongboitda-poster-${Date.now()}.png`, {
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

  useEffect(() => {
    if (step !== 3 || !showPoster || !imageUrl) return
    let cancelled = false
    let previewUrl = ""
    posterPreviewFileRef.current = null
    setPosterPreviewUrl("")
    setPosterVisibleText("")
    setPosterPreviewStatus("preparing")
    // The preview and download use the same Canvas renderer and copy.
    void createPosterFile(false).then((file) => {
      if (cancelled) return
      if (!file) throw new Error("poster-preview-failed")
      posterPreviewFileRef.current = file
      previewUrl = URL.createObjectURL(file)
      setPosterPreviewUrl(previewUrl)
      setPosterPreviewStatus("ready")
      notify("result")
      const context = document.createElement("canvas").getContext("2d")
      if (context) {
        context.font = '700 72px "Noto Sans KR", sans-serif'
        const title = wrapCanvasText(context, details.name?.trim() || details.features, 928, 3).join(" ")
        context.font = '500 48px "Noto Sans KR", sans-serif'
        const copy = wrapCanvasText(context, mediaText, 928, 3).join(" ")
        setPosterVisibleText([title, copy].filter(Boolean).join(". "))
      }
    }).catch(() => {
      if (!cancelled) setPosterPreviewStatus("failed")
    })
    return () => {
      cancelled = true
      posterPreviewFileRef.current = null
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [
    step,
    showPoster,
    imageUrl,
    details.name,
    details.features,
    resultCopy[channel],
    channel,
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

    const mimeCandidates = [
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
      const image = await loadCanvasImage(imageUrl)

      if (videoCancelledRef.current) {
        setVideoStatus("cancelled")

        setVideoMessage(uiText("영상 준비를 취소했어요.", easyMode))

        return null
      }

      canvas.width = 720

      canvas.height = 1280

      const context = canvas.getContext("2d")

      if (!context) throw new Error("canvas-unavailable")

      const stream = canvas.captureStream(30)

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

          resolve(
            new File([blob], `hongboitda-preview-${Date.now()}.${extension}`, {
              type: actualType,
            }),
          )
        }

        const startedAt = performance.now()

        const duration = 3000

        const drawFrame = (now: number) => {
          if (videoCancelledRef.current) return

          const progress = Math.min((now - startedAt) / duration, 1)

          context.save()

          context.clearRect(0, 0, canvas.width, canvas.height)

          const zoom = 1 + progress * 0.06

          context.translate(canvas.width / 2, canvas.height / 2)

          context.scale(zoom, zoom)

          context.translate(-canvas.width / 2, -canvas.height / 2)

          drawImageCover(context, image, canvas.width, canvas.height)

          context.restore()

          context.fillStyle = `rgba(${channelTheme.rgb},0.68)`

          context.fillRect(0, 780, canvas.width, 500)

          context.fillStyle = "#ffffff"

          context.font = '700 44px "Noto Sans KR", sans-serif'

          drawWrappedText(
            context,
            details.name?.trim() || details.features,
            48,
            900,
            624,
            60,
            3,
          )

          context.font = '400 26px "Noto Sans KR", sans-serif'

          drawWrappedText(context, mediaText, 48, 1110, 624, 38, 3)

          if (progress < 1) {
            videoFrameRef.current = window.requestAnimationFrame(drawFrame)
          } else if (recorder.state === "recording") {
            recorder.stop()
          }
        }

        recorder.start(250)

        videoFrameRef.current = window.requestAnimationFrame(drawFrame)
      })

      if (!result) return null

      setVideoStatus("ready")

      const extension = result.name.endsWith(".mp4") ? "MP4" : "WebM"

      setVideoMessage(
        easyMode
          ? "확인용 예시 영상 파일이 준비됐어요."
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
  const prepareVideoDownload = async () => {
    const context = videoContextRef.current
    const previous = videoTaskRef.current
    if (previous) {
      if (!videoCancelledRef.current) return previous
      await previous
      if (context !== videoContextRef.current) return null
    }
    if (context !== videoContextRef.current || step !== 3) return null
    if (videoTaskRef.current && !videoCancelledRef.current) return videoTaskRef.current
    const task = createVideoFile(true)
    videoTaskRef.current = task
    try {
      return await task
    } finally {
      if (videoTaskRef.current === task) videoTaskRef.current = null
    }
  }

  const pendingFiles = (showPoster && posterStatus !== "ready") || (showVideo && videoStatus !== "ready")
  const pendingCopy = showCopy && (!copyMessage || copyMessage.includes("못했어요"))
  const retentionNotice = pendingFiles && pendingCopy
    ? "새로고침하거나 창을 닫기 전에 필요한 이미지·영상은 저장하고 문구는 복사해 주세요."
    : pendingFiles
      ? "새로고침하거나 창을 닫기 전에 필요한 파일을 저장해 주세요."
      : pendingCopy
        ? "새로고침하거나 창을 닫기 전에 필요한 문구를 복사해 주세요."
        : ""

  return (
    <section
      className={`creation-flow mx-auto ${
        step === 3 ? "results-flow" : "max-w-[920px]"
      }`}
    >
      {step === 3 ? (
        <div className="result-screen-heading">
          <StepProgress step={step} onBack={setStep} />
          <div className="sr-only">
            <h2 data-screen-heading tabIndex={-1}>
              결과 보기
            </h2>
            <p>사진과 입력한 내용으로 만든 체험 결과예요. 새로고침 전에 저장하거나 복사하세요.</p>
          </div>
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
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <div className="details-step step-panel compact-information">
          <div className="information-photo" aria-busy={uploadPending}>
            <img src={imageUrl} alt="선택한 제품 사진" width="88" height="88" />
            <div>
              <strong>선택한 사진</strong>
              <span>설명은 그대로 두고 사진만 바꿀 수 있어요.</span>
            </div>
            <button
              type="button"
              className="studio-secondary photo-change-button"
              disabled={uploadPending}
              onClick={() => detailsPhotoRef.current?.click()}
            >
              사진 바꾸기
            </button>
            <input
              ref={detailsPhotoRef}
              id="details-photo"
              type="file"
              hidden
              accept="image/*"
              aria-label="정보 입력에서 사진 바꾸기"
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
              {uploadMessage}
            </p>
          )}
          <p
            id="details-example-note"
            className="description-example-note sr-only"
          >
            상품 이름만 필수예요.
          </p>
          {type !== "all" && (
            <p className="sr-only">
              {uiText("결과 형식", easyMode)}:{" "}
              {type === "copy"
                ? "문구"
                : uiText(creationNames[type], easyMode)}
            </p>
          )}
          <div className="details-fields mt-7 space-y-5">
            <label className="block text-[18px] font-bold">
              <span className="field-label-line">
                <span>상품 이름 <span className="field-requirement">필수</span></span>
                {nameTouched && missingFields.length > 0 && (
                  <span className="field-inline-error" aria-hidden="true">입력해 주세요.</span>
                )}
              </span>
              <span className="field-hint">예: 카페라떼</span>
              <input
                aria-label="상품 이름"
                aria-required="true"
                aria-invalid={nameTouched && missingFields.length > 0 ? true : undefined}
                aria-describedby="product-name-help details-example-note"
                value={details.name ?? ""}
                maxLength={60}
                onBlur={() => setNameTouched(true)}
                onChange={(event) =>
                  updateDetails({ ...details, name: event.target.value })
                }
                placeholder="예: 카페라떼"
                className="mt-2 w-full rounded-[12px] border p-4"
              />
              <span
                id="product-name-help"
                className="sr-only"
                role={nameTouched && missingFields.length > 0 ? "alert" : undefined}
              >
                {nameTouched && missingFields.length > 0
                  ? "상품 이름을 입력해 주세요."
                  : "홍보물에 표시할 상품 이름을 적어 주세요."}
              </span>
            </label>
            <label className="block text-[18px] font-bold">
              가게 이름
              <input
                aria-label="가게 이름"
                aria-required="false"
                aria-describedby="details-example-note"
                value={details.shopName ?? ""}
                maxLength={60}
                onChange={(event) => updateDetails({ ...details, shopName: event.target.value })}
                placeholder="예: 행복한 카페"
                className="mt-2 w-full rounded-[12px] border p-4"
              />
            </label>
            <label className="block text-[18px] font-bold">
              소개 및 알리고 싶은 점
              <span className="field-hint" id="description-help">
                예: 신선한 우유로 만든 고소한 라떼
              </span>
              <AutoSizeTextarea
                aria-label="소개 및 알리고 싶은 점"
                aria-required="false"
                aria-describedby="description-help details-example-note"
                value={[details.description, details.features].filter(Boolean).join("\n")}
                placeholder="예: 신선하고 고소해요"
                onChange={(event) =>
                  updateDetails({ ...details, description: event.target.value, features: "" })
                }
                rows={1}
                resizeKey={easyMode}
                className="mt-2 w-full rounded-[12px] border-2 border-[#817a74] p-4 text-[18px] font-normal leading-7 outline-none focus:border-[#c64f12] focus:ring-3 focus:ring-[#c64f12]/15"
              />
            </label>
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
            <button
              onClick={() => setStep(1)}
              className="studio-secondary"
            >
              이전으로
            </button>
            <div className="mobile-primary-bar details-primary-bar">
              {missingFields.length > 0 && (
                <p
                  id="missing-details"
                  role="status"
                  className="missing-details-note"
                >
                  {missingFields.join(", ")}을 입력하면 다음으로 갈 수 있어요.
                </p>
              )}
              <PrimaryButton
                disabled={missingFields.length > 0 || uploadPending}
                onClick={() => {
                  setSelectedResultTab(resultTabs[0].id)
                  onResultCreated()
                  if (!showPoster) notify("result")

                  setStep(3)
                }}
              >
                결과 보기
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="results-step step-panel">
          <div className="result-tabs-bar">
            <div
              className="result-tabs"
              role="tablist"
              aria-label="홍보물 결과 종류"
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
                  {tab.label}
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
                  icon="picture"
                  title="이미지"
                  control={
                      <button
                        type="button"
                        className="result-preview-action"
                        aria-controls="result-poster-preview"
                        aria-pressed={posterExpanded}
                        disabled={!posterPreviewUrl}
                        onClick={() => {
                          const expanded = !posterExpanded
                          setPosterExpanded(expanded)
                          if (expanded) window.requestAnimationFrame(() => {
                            const preview = posterPreviewRef.current
                            if (preview?.classList.contains("is-expanded")) preview.focus({ preventScroll: true })
                          })
                        }}
                      >
                        <Icon name={posterExpanded ? "zoom-out" : "zoom-in"} size={34} />
                        <span>{posterExpanded ? "작게 보기" : "크게 보기"}</span>
                      </button>
                  }
                />
                <ResultPreview>
                  <div
                    ref={posterPreviewRef}
                    id="result-poster-preview"
                    className={`result-main-preview ${posterExpanded ? "is-expanded" : ""}`}
                    role="group"
                    aria-label={posterExpanded ? "이미지 확대 미리보기" : "이미지 미리보기"}
                    tabIndex={posterExpanded ? 0 : undefined}
                  >
                    {posterPreviewUrl ? (
                      <div className="poster-image-canvas">
                        <img src={posterPreviewUrl} alt={`${details.name?.trim() || "제품"} 홍보 이미지`} aria-describedby={posterVisibleText ? "poster-visible-text" : undefined} />
                      </div>
                    ) : (
                      <div className="result-preparation" aria-busy={posterPreviewStatus === "preparing"}>
                        <p role={posterPreviewStatus === "failed" ? "alert" : "status"}>
                          {posterPreviewStatus === "failed"
                            ? "이미지를 준비하지 못했어요. 다시 시도해 주세요."
                            : "이미지를 준비하고 있어요."}
                        </p>
                        {posterPreviewStatus === "failed" && (
                          <button type="button" className="studio-secondary" onClick={() => setPosterRetry((value) => value + 1)}>
                            이미지 다시 준비
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </ResultPreview>
                {posterVisibleText && <p id="poster-visible-text" className="sr-only">그림에 표시된 문구: {posterVisibleText}</p>}
                <ResultActionBar
                  label={posterStatus === "preparing" ? "저장 준비 중" : "저장하기"}
                  accessibleLabel="이미지 저장하기"
                  icon="download"
                  onClick={() => createPosterFile(true)}
                  disabled={posterStatus === "preparing" || !posterPreviewUrl}
                  busy={posterStatus === "preparing"}
                  error={posterStatus === "failed" || posterPreviewStatus === "failed"}
                  message={
                    posterPreviewStatus === "failed"
                      ? showVideo || showCopy
                        ? "이미지 준비에 실패했어요. 다른 결과는 계속 확인할 수 있어요."
                        : "다시 준비하거나 아래에서 내용을 수정해 주세요."
                      : posterStatus === "failed"
                      ? "저장에 실패했어요. 다시 시도해 주세요."
                      : posterStatus === "ready"
                        ? "PNG 저장을 요청했어요. 다운로드 목록을 확인하세요."
                        : posterExpanded
                          ? "이미지를 크게 키웠어요. 안에서 좌우·위아래로 움직여 보세요."
                          : ""
                  }
                />
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
                  icon="video"
                  title="영상"
                  control={
                      <button
                        type="button"
                        className="result-preview-action"
                        aria-controls="result-video-preview"
                        aria-pressed={playing}
                        onClick={() => setPlaying(!playing)}
                      >
                        <Icon name={playing ? "pause" : "play"} size={34} />
                        <span>{playing ? "일시 정지" : "재생하기"}</span>
                      </button>
                  }
                />
                <ResultPreview>
                  <div
                    id="result-video-preview"
                    className="result-main-preview result-motion-preview"
                  >
                    <img
                      src={imageUrl}
                      alt="영상에 사용할 제품 사진"
                      className={playing ? "is-playing" : ""}
                    />
                    <strong><span>{details.name?.trim() || details.features}</span></strong>
                  </div>
                </ResultPreview>
                <ResultActionBar
                  label={videoStatus === "preparing" ? "준비 취소" : "저장하기"}
                  accessibleLabel={videoStatus === "preparing" ? "영상 준비 취소" : "영상 저장하기"}
                  icon={videoStatus === "preparing" ? null : "download"}
                  onClick={() => videoStatus === "preparing"
                    ? cancelVideoPreparation()
                    : prepareVideoDownload()}
                  busy={videoStatus === "preparing"}
                  error={videoStatus === "failed" || videoStatus === "unsupported"}
                  message={videoStatus === "preparing"
                    ? `${videoMessage} 다른 작업으로 이동하면 준비를 취소해요.`
                    : videoMessage}
                />
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
                <ResultCardHeading icon="copy" title="홍보 문구" />
                <ResultPreview text>
                  <div className="result-main-preview result-text-preview">
                    <div
                      className="copy-result-text"
                      role="region"
                      aria-label="홍보 문구 원문"
                      aria-describedby="copy-edit-help"
                      tabIndex={0}
                    >
                      {finalText}
                    </div>
                  </div>
                </ResultPreview>
                <ResultActionBar
                  label="복사하기"
                  accessibleLabel="문구 전체 복사하기"
                  icon="copy"
                  onClick={copyFinalText}
                  message={copyMessage && !copyMessage.includes("못했어요") ? "문구를 복사했어요." : copyMessage}
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
          <p id="copy-edit-help" className="result-edit-help">
            고치려면 아래의 ‘내용 다시 수정하기’를 눌러 주세요.
          </p>
          {retentionNotice && <p className="result-retention-note">{retentionNotice}</p>}
          <div className="result-followup-actions">
            <button className="studio-secondary" onClick={() => setStep(2)}>
              내용 다시 수정하기
            </button>
            <button className="studio-secondary" onClick={onStartNew}>
              새 홍보물 만들기
            </button>
            <button className="studio-text-button" onClick={onDashboard}>
              홈으로 돌아가기
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Records({
  records,
  onOpen,
  onCreate,
  onStartNew,
}: {
  easyMode: boolean
  records: GeneratedRecord[]
  onOpen: (record: GeneratedRecord, kind: "poster" | "video" | "copy") => void
  onCreate: () => void
  onStartNew: () => void
}) {
  const [filter, setFilter] = useState<"all" | "poster" | "video" | "copy">(
    "all",
  )
  const entries = records.flatMap((record) => {
    const kinds: ("poster" | "video" | "copy")[] =
      record.type === "all"
        ? [
            ...(record.outputFormat !== "video" ? ["poster" as const] : []),
            ...(record.outputFormat !== "poster" ? ["video" as const] : []),
            "copy",
          ]
        : [record.type]
    return kinds.map((kind) => ({ record, kind }))
  })
  const visible = entries.filter(
    (entry) => filter === "all" || entry.kind === filter,
  )
  const labels = { all: "전체", poster: "이미지", video: "영상", copy: "문구" }
  return (
    <section className="records-screen">
      <h2 data-screen-heading tabIndex={-1}>
        내 홍보물
      </h2>
      <p className="records-retention-note">
        이 창에서 만든 결과예요. 새로고침하거나 창을 닫기 전에 이미지·영상은 저장하고 문구는 복사해 주세요.
      </p>
      <div
        className="records-filters"
        role="group"
        aria-label="홍보물 종류 필터"
      >
        {(["all", "poster", "video", "copy"] as const).map((kind) => (
          <button
            key={kind}
            aria-pressed={filter === kind}
            onClick={() => setFilter(kind)}
          >
            {labels[kind]}
          </button>
        ))}
      </div>
      <p className="records-count" role="status">
        {labels[filter]} · {visible.length}개
      </p>
      {visible.length ? (
        <div className="records-list">
          {visible.map(({ record, kind }) => (
            <button
              key={`${record.id}-${kind}`}
              className="record-item"
              onClick={() => onOpen(record, kind)}
            >
              <span className="record-thumbnail">
                {kind === "copy" ? (
                  <Icon name="copy" size={30} />
                ) : (
                  <>
                    <img src={record.imageUrl} alt="" />
                    {kind === "video" && (
                      <span className="record-video-mark">
                        <Icon name="video" size={24} />
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
                  {labels[kind]} · {record.createdAt}
                </small>
                <span>결과 다시 보기</span>
              </span>
              <Icon name="arrow" size={20} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-results">
          <ServiceArt name="records-empty" />
          <h3>
            {records.length
              ? "이 종류의 결과는 아직 없어요"
              : "아직 만든 결과가 없어요"}
          </h3>
          <p>만들기에서 사진 한 장으로 시작해 보세요.</p>
          <button className="studio-primary" onClick={records.length ? onStartNew : onCreate}>
            {records.length ? "새 홍보물 만들기" : "홍보물 만들기"}
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
    <section className="mx-auto max-w-[900px]">
      <h2 data-screen-heading tabIndex={-1} className="text-[26px] font-bold">
        {uiText("내게 맞는 이용 방식을 골라 보세요", easyMode)}
      </h2>
      <p className="mt-2 text-[16px] leading-7 text-[#545454]">
        {uiText(
          "현재는 구조를 확인하는 프로토타입이며, 가격과 제공 수량은 아직 정해지지 않았습니다.",

          easyMode,
        )}
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
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
            className={`rounded-[22px] border-2 p-7 text-left transition ${
              selected === value
                ? "border-[#c64f12] bg-[#fff8f3]"
                : "border-[#dedbd7] bg-white"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                selected === value ? "border-[#c64f12]" : "border-[#77706a]"
              }`}
            >
              {selected === value && (
                <span className="h-3 w-3 rounded-full bg-[#c64f12]" />
              )}
            </span>
            <strong className="mt-6 block text-[22px]">
              {uiText(title, easyMode)}
            </strong>
            <p className="mt-2 text-[18px] leading-6 text-[#545454]">{note}</p>
            <span className="mt-6 block font-bold text-[#9f3e0d]">
              세부 조건은 준비 중
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

  const [channel, setChannel] = useState<Channel>("download")

  const [imageUrl, setImageUrl] = useState("")

  const [mobileOpen, setMobileOpen] = useState(false)

  const [details, setDetails] =
    useState<GeneratedRecord["details"]>(initialDetails)
  const [preferredResultTab, setPreferredResultTab] =
    useState<"poster" | "video" | "copy">("poster")

  const [recommendedHashtagsByChannel, setRecommendedHashtagsByChannel] =
    useState<Record<Channel, string> | undefined>(initialHashtagValues)

  const [userHashtagsByChannel, setUserHashtagsByChannel] =
    useState<Record<Channel, string> | undefined>(initialHashtagValues)

  const [userTouched, setUserTouched] = useState(false)

  const [continuationNotice, setContinuationNotice] = useState(false)

  const [records, setRecords] = useState<GeneratedRecord[]>([])

  const [easyMode, setEasyModeState] = useState(true)
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

  const speechText = (() => {
    const speakUi = (text: string) => uiText(text, easyMode)

    if (page === "login") {
      return "이메일과 비밀번호를 입력하고 로그인하거나, 바로 시작하기 버튼을 누르세요."
    }

    if (page === "home") {
      return `첫 화면입니다. ${userTouched ? "홍보물 이어 만들기를 누르면 현재 작업으로 돌아갑니다." : "홍보물 만들기를 누르면 사진 올리기로 이동합니다."} 가입 없이 체험할 수 있어요. 사진을 넣고 상품 이름을 적으면 이미지, 영상, 문구를 확인할 수 있어요. 결과를 저장하거나 복사하세요. 개별 제작과 사용 방법은 메뉴에서 볼 수 있어요.`
    }

    if (page === "records") {
      return "내 홍보물 화면입니다. 이 창에서 만든 결과를 다시 열 수 있어요. 새로고침하거나 창을 닫기 전에 이미지·영상은 저장하고 문구는 복사해 주세요."
    }

    if (page === "plan") {
      return easyMode
        ? "이용 방법 화면입니다. 매달 이용하거나 필요할 때 이용하는 방법을 고를 수 있으며, 가격과 만들 수 있는 수량은 아직 정해지지 않았습니다."
        : "이용권 화면입니다. 구독으로 이용하거나 건당 이용하는 구조를 선택할 수 있으며, 가격과 수량은 아직 정해지지 않았습니다."
    }

    if (step === 1) {
      const format =
        creationType === "all"
          ? [allOutputFormat !== "video" && "이미지", allOutputFormat !== "poster" && "영상", "문구"].filter(Boolean).join(", ")
          : creationType === "poster" ? "이미지" : creationType === "video" ? "영상" : "문구"

      return `${speakUi(creationNames[creationType])} 1단계, 사진 올리기입니다. 만들 결과는 ${format}입니다. ${
        imageUrl
          ? "사진이 준비됐어요. 사진 바꾸기로 다시 고르거나 다음으로 버튼을 누르세요."
          : "카메라 버튼이나 제품 사진 올리기 버튼으로 사진 한 장을 선택해 주세요."
      }`
    }

    if (step === 2) {
      return (
        "상품 이름은 필수이고, 가게 이름과 소개 및 알리고 싶은 점은 비워 두어도 됩니다. " +
        (details.name?.trim()
          ? "상품 이름은 " + details.name + ". "
          : "") +
        "소개 및 알리고 싶은 점은 " +
        ([details.description, details.features].filter(Boolean).join(". ") || "비워 두었어요") +
        ". " +
        "사진 바꾸기 버튼으로 사진을 바꿀 수 있어요. 내용을 확인한 뒤 결과 보기 버튼을 누르세요."
      )
    }

    return `결과 보기 화면입니다. 상품명은 ${details.name?.trim() || "입력하지 않았어요"}. 파일은 저장하기, 문구는 복사하기로 가져오세요. 내용을 고치려면 내용 다시 수정하기를 누르세요.`
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

    setSpeechMessage("읽어주기를 준비하고 있어요.")

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
    const videoSpeech = `영상 결과입니다. 상품명은 ${details.name?.trim()}. ${videoControl === "일시 정지"
      ? "일시 정지 버튼으로 사진 움직임을 멈출 수 있어요."
      : "재생하기 버튼으로 사진 움직임을 확인하세요."} ${videoAction === "준비 취소"
      ? "준비 취소 버튼으로 영상 파일 준비를 취소할 수 있어요."
      : "저장하기 버튼으로 파일을 가져오세요."}${videoState ? " " + videoState : ""}`
    const utterance = new SpeechSynthesisUtterance(
      visibleCopy ? "홍보 문구 결과입니다. " + visibleCopy
        : visiblePoster ? "이미지 결과입니다. " + visiblePoster
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
          "일시적으로 읽어주기를 시작하지 못했어요. 다시 눌러 시도해 주세요.",
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
        "일시적으로 읽어주기를 시작하지 못했어요. 화면을 한 번 누른 뒤 다시 시도해 주세요.",
      )
    }

    try {
      synthesis.speak(utterance)
    } catch {
      window.clearTimeout(startTimeoutId)

      setSpeaking(false)

      setSpeechPreparing(false)

      setSpeechMessage(
        "일시적으로 읽어주기를 시작하지 못했어요. 다시 눌러 시도해 주세요.",
      )
    }
  }

  const navigate = (nextPage: Page, type?: CreationType) => {
    if (type) {
      const resumeDraft = userTouched && type === creationType
      if (!resumeDraft) {
        if (type === "all") setAllOutputFormat("both")
        setPreferredResultTab(
          type === "video" ? "video" : type === "copy" ? "copy" : "poster",
        )
        setCreationType(type)

        setStep(1)
      }

      setContinuationNotice(userTouched)
    }

    setPage(nextPage)

    setMobileOpen(false)
  }

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

      details: { ...details },

      userHashtags: { ...safeUserHashtags },
    }

    setRecords((current) => [record, ...current])
  }


  const openRecord = (
    record: GeneratedRecord,
    resultType: "poster" | "video" | "copy",
  ) => {
    setPreferredResultTab(resultType)
    setEditedHashtags(mapChannels((id) => record.editedHashtags?.[id] ?? true))
    setCreationType(record.type)

    if (record.type === "all") setAllOutputFormat(record.outputFormat)

    setChannel(record.channel)

    setImageUrl(record.imageUrl)

    setDetails({ ...record.details })

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
      creationView={page === "create"}
      navigate={navigate}
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
    >
      {page === "home" && (
        <Home
          navigate={navigate}
          easyMode={easyMode}
          hasDraft={userTouched}
          onChooseCreation={() => navigate("create")}
        />
      )}
      {page === "create" && (
        <CreateFlow
          initialResultTab={preferredResultTab}
          type={creationType}
          channel={channel}
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
          onDashboard={() => navigate("home")}
          onStartNew={startNew}
          onResultTabChange={stopSpeech}
        />
      )}
      {page === "records" && (
        <Records
          easyMode={easyMode}
          records={records}
          onOpen={openRecord}
          onCreate={() => navigate("create")}
          onStartNew={startNew}
        />
      )}
      {page === "plan" && <Plan easyMode={easyMode} />}
    </Shell>
  )
}
