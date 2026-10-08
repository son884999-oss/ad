import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

type Page = "login" | "home" | "create" | "records" | "plan"

type CreationType = "all" | "poster" | "video" | "copy"

type Channel = "instagram" | "x" | "threads"

type Step = 1 | 2 | 3

type OutputFormat = "poster" | "video" | "both"

type FileStatus = "idle" | "preparing" | "ready" | "cancelled" | "failed" | "unsupported"

type GeneratedRecord = {
  id: string

  createdAt: string

  type: CreationType

  outputFormat: OutputFormat

  channel: Channel

  imageUrl: string

  details: {
    description: string

    features: string

    audience: string
  }

  userHashtags: Record<Channel, string>
}

const creationNames: Record<CreationType, string> = {
  all: "한 번에 완성",

  poster: "포스터 만들기",

  video: "영상 만들기",

  copy: "문구 만들기",
}

const channelNames: Record<Channel, string> = {
  instagram: "인스타그램",

  x: "엑스(X)",

  threads: "쓰레드(Threads)",
}

const channelIcons: Record<Channel, string> = {
  instagram: "📸",

  x: "✕",

  threads: "💬",
}

const initialDetails = {
  description: "정성을 담아 만든 우리 가게의 대표 제품입니다.",

  features: "좋은 재료와 꼼꼼한 손길로 완성한 특별한 맛",

  audience: "좋은 품질과 따뜻한 이야기를 중요하게 생각하는 고객",
}

const outputFormatNames: Record<OutputFormat, string> = {
  poster: "포스터",

  video: "영상",

  both: "포스터와 영상 둘 다",
}

const outputFormatIcons: Record<OutputFormat, string> = {
  poster: "🖼️",

  video: "🎬",

  both: "✨",
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

  const limits: Record<Channel, number> = {
    instagram: 8,

    x: 3,

    threads: 4,
  }

  return [...new Set(keywords)]

    .slice(0, limits[channel])

    .map((tag) => `#${tag}`)
}

function initialHashtagValues(
  details: {
    description: string

    features: string

    audience: string
  } = initialDetails,
) {
  return {
    instagram: makeHashtags("instagram", details).join(" "),

    x: makeHashtags("x", details).join(" "),

    threads: makeHashtags("threads", details).join(" "),
  }
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

  return {
    instagram:
      typeof candidate.instagram === "string"
        ? candidate.instagram
        : fallback.instagram,

    x: typeof candidate.x === "string" ? candidate.x : fallback.x,

    threads:
      typeof candidate.threads === "string"
        ? candidate.threads
        : fallback.threads,
  }
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
  const words = text.split(/\s+/).filter(Boolean)

  const lines: string[] = []

  let line = ""

  for (const word of words) {
    const next = line ? `${line} ${word}` : word

    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line)

      line = word

      if (lines.length === maxLines - 1) break
    } else {
      line = next
    }
  }

  if (line && lines.length < maxLines) lines.push(line)

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

const menuItems: Array<{
  label: string

  page?: Page

  type?: CreationType

  symbol: string

  tone?: string
}> = [
  { label: "홈", page: "home", symbol: "⌂" },

  { label: "한 번에 완성", type: "all", symbol: "＋", tone: "bg-[#ffffff]" },

  {
    label: "포스터 만들기",

    type: "poster",

    symbol: "＋",

    tone: "bg-[#ffffff]",
  },

  { label: "영상 만들기", type: "video", symbol: "＋", tone: "bg-[#ffffff]" },

  { label: "문구 만들기", type: "copy", symbol: "＋", tone: "bg-[#ffffff]" },

  { label: "최근 생성 기록", page: "records", symbol: "▣" },

  { label: "이용권", page: "plan", symbol: "◇" },
]

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/assets/8a210.svg"
        alt=""
        className={compact ? "h-8 w-8" : "h-10 w-10"}
      />
      <strong className="text-[18px] font-bold text-[#c9541a]">홍보잇다</strong>
    </div>
  )
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
      className={`min-h-13 w-full rounded-[14px] bg-[#c64f12] px-7 py-3 text-[16px] font-bold text-white shadow-sm transition hover:bg-[#a63f0b] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2b2b2b] disabled:cursor-not-allowed disabled:bg-[#aaa49e] sm:w-auto ${className}`}
    >
      {children}
    </button>
  )
}

function SpeakerButton({
  speaking,

  preparing,

  onClick,
}: {
  speaking: boolean

  preparing: boolean

  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={speaking || preparing}
      className={`min-h-12 rounded-[12px] border-2 px-4 text-[18px] font-bold transition ${
        speaking || preparing
          ? "border-[#817a74] bg-[#f6f5f3] text-[#2b2b2b]"
          : "border-[#817a74] bg-white text-[#2b2b2b]"
      }`}
    >
      {speaking ? "⏹ 읽기 중지" : preparing ? "🔊 준비 중" : "🔊 화면 읽어주기"}
    </button>
  )
}

function Login({
  onEnter,

  easyMode,

  speaking,

  speechPreparing,

  onSpeak,

  speechMessage,
}: {
  onEnter: () => void

  easyMode: boolean

  speaking: boolean

  speechPreparing: boolean

  onSpeak: () => void

  speechMessage: string
}) {
  const [mode, setMode] = useState<"login" | "signup">("login")

  const submit = (event: FormEvent) => {
    event.preventDefault()

    onEnter()
  }

  return (
    <main
      className={`prototype-app login-screen flex min-h-dvh items-center justify-center bg-[#f6f5f3] px-5 py-10 ${
        easyMode ? "easy-mode" : ""
      }`}
    >
      <section className="w-full max-w-[480px] rounded-[28px] border border-[#dedbd7] bg-white p-7 shadow-[0_18px_55px_rgba(34,34,34,0.10)] sm:p-11">
        <div className="mb-9 flex justify-center">
          <Brand />
        </div>
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-[18px] font-bold text-[#2b2b2b]">
            이메일
            <input
              type="email"
              required
              placeholder="name@example.com"
              className="mt-2 h-14 w-full rounded-[12px] border border-[#817a74] px-4 text-[18px] font-normal outline-none placeholder:text-[#9aa39c] focus:border-[#c64f12] focus:ring-3 focus:ring-[#c64f12]/15"
            />
          </label>
          <label className="block text-[18px] font-bold text-[#2b2b2b]">
            비밀번호
            <input
              type="password"
              required
              minLength={4}
              placeholder="4자 이상 입력"
              className="mt-2 h-14 w-full rounded-[12px] border border-[#817a74] px-4 text-[18px] font-normal outline-none placeholder:text-[#9aa39c] focus:border-[#c64f12] focus:ring-3 focus:ring-[#c64f12]/15"
            />
          </label>
          <PrimaryButton type="submit" className="w-full">
            {mode === "login" ? "로그인" : "가입하고 시작하기"}
          </PrimaryButton>
        </form>
        <button
          onClick={onEnter}
          className="mt-3 min-h-13 w-full rounded-[14px] border-2 border-[#2b2b2b] bg-white px-7 py-3 text-[16px] font-bold text-[#2b2b2b] transition hover:bg-[#fff1e7] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#c64f12]"
        >
          바로 시작하기
        </button>
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mx-auto mt-6 block min-h-11 px-3 text-[18px] font-bold text-[#9f3e0d] underline underline-offset-4"
        >
          {mode === "login"
            ? "처음이신가요? 회원가입"
            : "이미 계정이 있나요? 로그인"}
        </button>
        {easyMode && (
          <div className="mt-5 border-t border-[#dedbd7] pt-5 text-center">
            <SpeakerButton
              speaking={speaking}
              preparing={speechPreparing}
              onClick={onSpeak}
            />
            {speechMessage && (
              <p className="mt-2 text-[16px] text-[#9f3e0d]" role="status">
                {speechMessage}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

function Shell({
  page,

  title,

  creationType,

  mobileOpen,

  setMobileOpen,

  navigate,

  onLogout,

  easyMode,

  setEasyMode,

  speaking,

  speechPreparing,

  onSpeak,

  speechMessage,

  children,
}: {
  page: Page

  title: string

  creationType: CreationType

  mobileOpen: boolean

  setMobileOpen: (open: boolean) => void

  navigate: (page: Page, type?: CreationType) => void

  onLogout: () => void

  easyMode: boolean

  setEasyMode: (enabled: boolean) => void

  speaking: boolean

  speechPreparing: boolean

  onSpeak: () => void

  speechMessage: string

  children: ReactNode
}) {
  return (
    <div
      className={`prototype-app min-h-dvh bg-[#f6f5f3] text-[#222222] ${
        easyMode ? "easy-mode" : ""
      }`}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-[#ebe8e4] bg-white px-5 py-6 transition-transform lg:translate-x-0 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full invisible lg:visible"
        }`}
      >
        <div className="mb-7 flex items-center justify-between">
          <Brand />
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-xl border border-[#dedbd7] text-xl lg:hidden"
            aria-label="메뉴 닫기"
          >
            ×
          </button>
        </div>
        <nav aria-label="주요 메뉴" className="space-y-1.5">
          {menuItems.map((item) => {
            const active =
              item.page === page ||
              (page === "create" && item.type === creationType)

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.page ?? "create", item.type)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-[12px] px-2.5 text-left text-[16px] transition hover:brightness-95 ${
                  active
                    ? "bg-[#fff1e7] font-bold text-[#2b2b2b]"
                    : (item.tone ?? "bg-white")
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[16px] ${
                    active
                      ? "bg-[#fff1e7] text-[#9f3e0d]"
                      : "bg-[#f1efec] text-[#2b2b2b]"
                  }`}
                >
                  {item.symbol}
                </span>
                {uiText(item.label, easyMode)}
              </button>
            )
          })}
        </nav>
      </aside>
      {mobileOpen && (
        <button
          aria-label="메뉴 닫기"
          className="fixed inset-0 z-30 bg-[#222222]/45 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex min-h-[72px] flex-wrap items-center gap-3 border-b border-[#ebe8e4] bg-white px-5 py-2 sm:flex-nowrap sm:px-8 lg:px-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-xl border border-[#dedbd7] text-xl lg:hidden"
            aria-label="메뉴 열기"
          >
            ☰
          </button>
          <h1 className="text-[19px] font-bold tracking-[-0.02em]">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onLogout}
              className="min-h-12 bg-white px-2 text-[16px] font-bold text-[#545454] underline underline-offset-4 transition hover:text-[#9f3e0d] sm:px-3 sm:text-[16px]"
            >
              <span>로그아웃</span>
            </button>
          </div>
          {(page === "home" || page === "create" || easyMode) && (
            <div className="order-3 flex w-full items-center gap-2 border-t border-[#ebe8e4] pt-2 sm:order-none sm:w-auto sm:border-0 sm:pt-0">
              {(page === "home" || page === "create") && (
                <button
                  onClick={() => setEasyMode(!easyMode)}
                  aria-pressed={easyMode}
                  className={`min-h-12 flex-1 rounded-[12px] border px-4 text-[16px] font-bold sm:flex-none ${
                    easyMode
                      ? "border-[#817a74] bg-[#f6f5f3] text-[#2b2b2b]"
                      : "border-[#817a74] bg-white text-[#2b2b2b]"
                  }`}
                >
                  큰 글씨·쉬운 안내 {easyMode ? "켜짐" : "켜기"}
                </button>
              )}
              {easyMode && (
                <SpeakerButton
                  speaking={speaking}
                  preparing={speechPreparing}
                  onClick={onSpeak}
                />
              )}
            </div>
          )}
        </header>
        <main
          data-app-scroll-container
          className="mx-auto w-full max-w-[1240px] p-5 pb-44 sm:p-8 sm:pb-14 lg:p-10"
        >
          {speechMessage && (
            <p
              className="mb-4 rounded-[10px] bg-[#fff1e7] px-4 py-3 text-[16px] text-[#7f340d]"
              role="status"
            >
              {speechMessage}
            </p>
          )}
          {children}
        </main>
      </div>
      <nav
        aria-label="모바일 빠른 메뉴"
        className="mobile-navigation fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-[#d5d0cb] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(34,34,34,0.10)] backdrop-blur lg:hidden"
      >
        {[
          { label: "홈", symbol: "🏠", page: "home" as Page },

          { label: "만들기", symbol: "＋", type: "all" as CreationType },

          { label: "내 홍보물", symbol: "▤", page: "records" as Page },
        ].map((item) => {
          const active =
            item.page === page || (page === "create" && item.type === "all")

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.page ?? "create", item.type)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-0.5 border-t-2 px-0 text-[16px] font-bold ${
                active
                  ? "border-[#c64f12] bg-[#fff8f3] text-[#9f3e0d]"
                  : "border-transparent text-[#505050]"
              }`}
            >
              <span className="text-[21px]" aria-hidden="true">
                {item.symbol}
              </span>
              <span className="whitespace-nowrap">
                {uiText(item.label, easyMode)}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function Home({
  navigate,

  easyMode,
}: {
  navigate: (page: Page, type?: CreationType) => void

  easyMode: boolean
}) {
  const shortcuts: Array<{
    type: CreationType

    note: string

    className: string
  }> = [
    { type: "poster", note: "사진과 글을 한 장에", className: "bg-[#ffffff]" },

    {
      type: "video",

      note: "짧고 눈에 띄는 미리보기",

      className: "bg-[#ffffff]",
    },

    { type: "copy", note: "채널에 맞는 홍보 문구", className: "bg-[#ffffff]" },
  ]

  const guideSteps = [
    {
      number: "①",

      icon: "📷",

      title: "사진 넣기",

      description: "홍보할 제품 사진을 넣어 주세요.",
    },

    {
      number: "②",

      icon: "✍️",

      title: "설명·해시태그 확인",

      description: "정리된 설명과 추천 해시태그를 확인하고 고쳐 주세요.",
    },

    {
      number: "③",

      icon: "✨",

      title: "홍보물 만들기",

      description: "선택한 홍보물을 만들고 결과를 확인해 주세요.",
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-7">
      <section className="welcome-panel rounded-[22px] border border-[#dedbd7] bg-white p-5 shadow-[0_10px_30px_rgba(34,34,34,0.06)] sm:p-7">
        <p className="welcome-eyebrow">우리 가게를 알리는 작은 시작</p>
        <h2 className="text-[25px] font-bold leading-tight tracking-[-0.04em] text-[#2b2b2b] sm:text-[30px]">
          사진 한 장으로 홍보물을 만들어 보세요
        </h2>
        <div className="mt-4 grid divide-y divide-[#dedbd7] sm:mt-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {guideSteps.map((guide) => (
            <div
              key={guide.number}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 sm:px-5 sm:py-0 sm:first:pl-0 sm:last:pr-0"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#fff1e7] text-[20px]"
                aria-hidden="true"
              >
                {guide.icon}
              </span>
              <div>
                <strong className="block text-[18px] leading-6">
                  <span className="mr-1 text-[#c9541a]">{guide.number}</span>
                  {uiText(guide.title, easyMode)}
                </strong>
                <p className="mt-0.5 text-[16px] leading-6 text-[#545454]">
                  {uiText(guide.description, easyMode)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 sm:mt-7">
          <PrimaryButton
            onClick={() => navigate("create", "all")}
            className="bg-[#c64f12] hover:bg-[#a63f0b]"
          >
            홍보물 만들기 시작
          </PrimaryButton>
        </div>
      </section>
      <section>
        <div>
          <button
            onClick={() => navigate("records")}
            className="w-full rounded-[18px] border border-[#dedbd7] bg-white p-5 text-left hover:border-[#c64f12] sm:p-6"
          >
            <strong className="block text-[19px]">최근 생성 기록</strong>
            <p className="mt-1 text-[16px] text-[#545454]">
              이 앱에서 만든 결과 다시 보기
            </p>
          </button>
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-[20px] font-bold">
          {uiText("단독 제작 바로가기", easyMode)}
        </h2>
        <div className="shortcut-grid grid gap-3">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.type}
              onClick={() => navigate("create", shortcut.type)}
              className={`min-h-[150px] rounded-[18px] border border-[#dedbd7] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${shortcut.className}`}
            >
              <span className="text-[16px] font-bold">바로 시작</span>
              <strong className="mt-4 block text-[21px]">
                {uiText(creationNames[shortcut.type], easyMode)}
              </strong>
              <span className="mt-2 flex items-end justify-between gap-2 text-[16px]">
                {uiText(shortcut.note, easyMode)} <b className="text-xl">→</b>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function StepHeader({
  step,

  easyMode,
}: {
  step: Step

  easyMode: boolean
}) {
  const stepGuides: Record<Step, {
    title: string

    description: string
  }> = {
    1: {
      title: "사진을 넣어 주세요",

      description:
        "홍보할 곳과 만들 종류를 고르고 제품 사진 한 장을 넣어 주세요.",
    },

    2: {
      title: "설명을 확인하고 고쳐 주세요",

      description:
        "예시 초안을 제품에 맞게 수정하고, 추천 해시태그도 결과를 만들기 전에 직접 고쳐 주세요.",
    },

    3: {
      title: "홍보물이 준비됐어요",

      description:
        "선택한 결과와 홍보 문구를 확인하고 필요한 파일을 저장해 주세요.",
    },
  }

  const stepLabels: Record<Step, string> = {
    1: "사진",

    2: "설명",

    3: "결과",
  }

  return (
    <div className="mb-7">
      <div
        className="flex items-center justify-center gap-2"
        aria-label={`현재 ${step}단계`}
        role="list"
      >
        {([1, 2, 3] as Step[]).map((number) => (
          <div key={number} className="contents">
            <div
              role="listitem"
              aria-current={number === step ? "step" : undefined}
              className={`rounded-full border py-1.5 font-bold ${
                easyMode ? "px-2 text-[18px]" : "px-3 text-[16px]"
              } ${
                number === step
                  ? "border-[#c64f12] bg-[#fff1e7] text-[#7f340d]"
                  : "border-[#dedbd7] bg-white text-[#626262]"
              }`}
            >
              {number} {stepLabels[number]}
            </div>
            {number < 3 && (
              <span
                className={`${
                  easyMode ? "text-[18px]" : "text-[16px]"
                } text-[#817a74]`}
                aria-hidden="true"
              >
                →
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-5">
        <h2 className="text-[26px] font-bold leading-tight text-[#222222] sm:text-[28px]">
          {step}단계 · {uiText(stepGuides[step].title, easyMode)}
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

  setOutputFormat,

  continuationNotice,

  onDraftTouched,

  easyMode,

  onResultCreated,

  onDashboard,

  onStartNew,
}: {
  type: CreationType

  step: Step

  setStep: (step: Step) => void

  channel: Channel

  setChannel: (channel: Channel) => void

  imageUrl: string

  setImageUrl: (url: string) => void

  details: {
    description: string

    features: string

    audience: string
  }

  setDetails: (details: {
    description: string

    features: string

    audience: string
  }) => void

  recommendedHashtagsByChannel: Record<Channel, string> | undefined

  setRecommendedHashtagsByChannel: (hashtags: Record<Channel, string>) => void

  userHashtagsByChannel: Record<Channel, string> | undefined

  setUserHashtagsByChannel: (hashtags: Record<Channel, string>) => void

  outputFormat: OutputFormat

  setOutputFormat: (format: OutputFormat) => void

  continuationNotice: boolean

  onDraftTouched: () => void

  easyMode: boolean

  onResultCreated: () => void

  onDashboard: () => void

  onStartNew: () => void
}) {
  const [playing, setPlaying] = useState(false)

  const [copyMessage, setCopyMessage] = useState("")

  const [posterStatus, setPosterStatus] = useState<FileStatus>("idle")

  const [videoStatus, setVideoStatus] = useState<FileStatus>("idle")

  const [videoMessage, setVideoMessage] = useState("")

  const [uploadMessage, setUploadMessage] = useState("")

  const uploadRequestRef = useRef(0)

  const missingFields = [
    !details.description.trim() && "제품 설명",

    !details.features.trim() && "강조할 특징",

    !details.audience.trim() && "주요 고객",
  ].filter(Boolean)

  const jumpToResult = (id: string) => {
    const title = document.getElementById(id)

    title?.focus({ preventScroll: true })

    title?.closest("article")?.scrollIntoView({ block: "start" })
  }

  const videoRecorderRef = useRef<MediaRecorder | null>(null)

  const videoFrameRef = useRef<number | null>(null)

  const videoCancelledRef = useRef(false)

  useEffect(() => {
    setPlaying(false)

    setPosterStatus("idle")

    setVideoStatus("idle")

    setVideoMessage("")

    setCopyMessage("")

    videoCancelledRef.current = true

    if (videoFrameRef.current !== null) {
      window.cancelAnimationFrame(videoFrameRef.current)

      videoFrameRef.current = null
    }

    if (videoRecorderRef.current?.state === "recording") {
      videoRecorderRef.current.stop()
    }
  }, [
    type,

    outputFormat,

    channel,

    imageUrl,

    details.description,

    details.features,

    details.audience,
  ])

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    const request = ++uploadRequestRef.current

    setImageUrl("")

    const fail = () => {
      if (request === uploadRequestRef.current)
        setUploadMessage(
          "사진을 읽지 못했어요. JPG 또는 PNG 사진을 다시 선택해 주세요.",
        )
    }

    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      setUploadMessage("20MB 이하의 사진 파일을 선택해 주세요.")

      event.target.value = ""

      return
    }

    setUploadMessage("사진을 확인하고 있어요.")

    const reader = new FileReader()

    reader.onerror = fail

    reader.onload = async () => {
      if (typeof reader.result === "string") {
        try {
          await loadCanvasImage(reader.result)

          if (request !== uploadRequestRef.current) return

          setImageUrl(reader.result)

          setUploadMessage("사진이 준비됐어요.")

          onDraftTouched()
        } catch {
          fail()
        }
      }
    }

    reader.readAsDataURL(file)
  }

  const resultCopy: Record<Channel, string> = {
    instagram: `오늘을 더 특별하게 만드는 ${details.description}\n\n${details.features}\n지금 사진으로 만나보세요.`,

    x: `${details.features} — 필요한 분은 바로 확인해 보세요. ${details.audience}에게 추천합니다.`,

    threads: `요즘 손님들이 자주 찾는 이유가 있더라고요.\n${details.description}\n특히 ${details.features} 이 부분이 참 좋아요. 궁금한 점은 편하게 물어보세요.`,
  }

  const safeRecommendations = normalizeHashtagValues(
    recommendedHashtagsByChannel,

    details,
  )

  const safeUserHashtags = normalizeHashtagValues(
    userHashtagsByChannel,

    details,
  )

  const hashtags = parseHashtags(safeUserHashtags[channel])

  const recommendationMinimum: Record<Channel, number> = {
    instagram: 5,

    x: 1,

    threads: 2,
  }

  const recommendationTags = parseHashtags(safeRecommendations[channel])

  const needsMoreKeywords =
    recommendationTags.length < recommendationMinimum[channel]

  const showPoster =
    type === "poster" ||
    (type === "all" && (outputFormat === "poster" || outputFormat === "both"))

  const showVideo =
    type === "video" ||
    (type === "all" && (outputFormat === "video" || outputFormat === "both"))

  const showCopy = type === "copy" || type === "all"

  const finalText = `${resultCopy[channel]}\n\n${hashtags.join(" ")}`.trim()

  const updateDetails = (nextDetails: {
    description: string

    features: string

    audience: string
  }) => {
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
    } catch {
      setCopyMessage(uiText("복사하지 못했어요. 다시 시도해 주세요.", easyMode))
    }
  }

  const createPosterFile = async (download: boolean) => {
    if (!imageUrl) {
      setPosterStatus("failed")

      return null
    }

    setPosterStatus("preparing")

    try {
      const image = await loadCanvasImage(imageUrl)

      const canvas = document.createElement("canvas")

      canvas.width = 1080

      canvas.height = 1350

      const context = canvas.getContext("2d")

      if (!context) throw new Error("canvas-unavailable")

      drawImageCover(context, image, canvas.width, canvas.height)

      const gradient = context.createLinearGradient(0, 620, 0, 1350)

      gradient.addColorStop(0, "rgba(0,0,0,0)")

      gradient.addColorStop(0.35, "rgba(0,0,0,0.6)")

      gradient.addColorStop(1, "rgba(0,0,0,0.92)")

      context.fillStyle = gradient

      context.fillRect(0, 0, canvas.width, canvas.height)

      context.fillStyle = "#ffffff"

      context.font = '700 64px "Noto Sans KR", sans-serif'

      drawWrappedText(context, details.features, 76, 960, 928, 82, 3)

      context.font = '400 34px "Noto Sans KR", sans-serif'

      drawWrappedText(context, resultCopy[channel], 76, 1180, 928, 48, 3)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      )

      if (!blob || blob.size === 0) throw new Error("empty-png")

      const file = new File([blob], `hongboitda-poster-${Date.now()}.png`, {
        type: "image/png",
      })

      setPosterStatus("ready")

      if (download) triggerFileDownload(file)

      return file
    } catch {
      setPosterStatus("failed")

      return null
    }
  }

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

          context.fillStyle = "rgba(0,0,0,0.48)"

          context.fillRect(0, 780, canvas.width, 500)

          context.fillStyle = "#ffffff"

          context.font = '700 44px "Noto Sans KR", sans-serif'

          drawWrappedText(context, details.features, 48, 900, 624, 60, 3)

          context.font = '400 26px "Noto Sans KR", sans-serif'

          drawWrappedText(context, resultCopy[channel], 48, 1110, 624, 38, 3)

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

      if (download) triggerFileDownload(result)

      return result
    } catch {
      setVideoStatus("failed")

      setVideoMessage(
        uiText("영상 준비에 실패했어요. 다시 시도해 주세요.", easyMode),
      )

      return null
    }
  }

  return (
    <section
      className={`creation-flow mx-auto ${
        step === 3 ? "results-flow" : "max-w-[920px]"
      }`}
    >
      <StepHeader step={step} easyMode={easyMode} />
      {step === 1 && continuationNotice && (
        <p className="mb-6 rounded-[12px] border border-[#dda77f] bg-[#fff8f3] px-4 py-3 text-[18px] font-bold text-[#7f340d]">
          입력한 사진과 설명을 이어서 사용해요.
        </p>
      )}
      {type === "all" && step === 2 && (
        <div className="mb-7">
          <p className="mb-2 text-[16px] font-bold text-[#545454]">
            {uiText("선택한 결과 형식", easyMode)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(outputFormatNames) as OutputFormat[]).map(
              (format) => (
                <span
                  key={format}
                  className={`flex min-h-14 items-center justify-center gap-1 rounded-[12px] border px-2 text-center text-[16px] font-bold ${
                    outputFormat === format
                      ? "border-[#c64f12] bg-[#fff1e7] text-[#9f3e0d]"
                      : "border-[#dedbd7] bg-white text-[#696969]"
                  }`}
                >
                  <span aria-hidden="true">{outputFormatIcons[format]}</span>
                  <span className="sm:hidden">
                    {format === "both"
                      ? "둘 다"
                      : uiText(outputFormatNames[format], easyMode)}
                  </span>
                  <span className="hidden sm:inline">
                    {uiText(outputFormatNames[format], easyMode)}
                  </span>
                </span>
              ),
            )}
          </div>
        </div>
      )}
      {step === 1 && (
        <div>
          {type === "all" ? (
            <div>
              <h3 className="text-[19px] font-bold">
                {uiText("결과 형식을 선택해 주세요", easyMode)}
              </h3>
              <p className="mt-1 text-[16px] text-[#545454]">
                어떤 형식을 골라도 홍보 문구가 함께 만들어집니다.
              </p>
              <div
                className="mt-4 grid grid-cols-3 gap-2 sm:gap-3"
                role="radiogroup"
                aria-label={uiText("결과 형식", easyMode)}
              >
                {(Object.keys(outputFormatNames) as OutputFormat[]).map(
                  (format) => (
                    <button
                      key={format}
                      onClick={() => setOutputFormat(format)}
                      role="radio"
                      aria-checked={outputFormat === format}
                      aria-label={uiText(outputFormatNames[format], easyMode)}
                      className={`relative flex min-h-24 flex-col items-center justify-center gap-1 rounded-[14px] border-2 px-2 text-[16px] font-bold transition sm:px-5 sm:text-[18px] ${
                        outputFormat === format
                          ? "border-[#c64f12] bg-[#fff1e7] text-[#7f340d] shadow-[inset_0_0_0_1px_#c64f12]"
                          : "border-[#aaa39d] bg-white text-[#333333]"
                      }`}
                    >
                      {outputFormat === format && (
                        <span
                          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#c64f12] text-[16px] text-white"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      )}
                      <span className="text-[24px]" aria-hidden="true">
                        {outputFormatIcons[format]}
                      </span>
                      <span className="whitespace-nowrap sm:hidden">
                        {format === "both"
                          ? "둘 다"
                          : uiText(outputFormatNames[format], easyMode)}
                      </span>
                      <span className="hidden sm:inline">
                        {uiText(outputFormatNames[format], easyMode)}
                      </span>
                    </button>
                  ),
                )}
              </div>
              {easyMode && (
                <p className="mt-3 text-[18px] text-[#545454]">
                  포스터는 사진과 글을 한 장에 담은 결과예요.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-7 rounded-[14px] border border-[#aaa39d] bg-white px-5 py-4">
              <span className="text-[16px] text-[#626262]">
                {uiText("선택된 결과 형식", easyMode)}
              </span>
              <strong className="mt-1 block text-[18px]">
                {type === "copy"
                  ? "✍️ 홍보 문구"
                  : `${outputFormatIcons[type]} ${uiText(creationNames[type], easyMode)}`}
              </strong>
            </div>
          )}
          {easyMode && type === "poster" && (
            <p className="mt-3 text-[18px] text-[#545454]">
              포스터는 사진과 글을 한 장에 담은 결과예요.
            </p>
          )}
          <h3 className="mt-8 text-[19px] font-bold">
            {uiText("홍보 채널을 선택해 주세요", easyMode)}
          </h3>
          <div
            className="mt-6 grid gap-3 sm:grid-cols-3"
            role="radiogroup"
            aria-label={uiText("홍보 채널", easyMode)}
          >
            {(Object.keys(channelNames) as Channel[]).map((item) => (
              <button
                key={item}
                onClick={() => setChannel(item)}
                role="radio"
                aria-checked={channel === item}
                className={`relative min-h-16 rounded-[14px] border-2 px-4 text-[18px] font-bold transition ${
                  channel === item
                    ? "border-[#c64f12] bg-[#fff1e7] text-[#7f340d] shadow-[inset_0_0_0_1px_#c64f12]"
                    : "border-[#aaa39d] bg-white text-[#333333] hover:border-[#77706a]"
                }`}
              >
                {channel === item && (
                  <span className="mr-1 text-[#c64f12]" aria-hidden="true">
                    ✓
                  </span>
                )}
                <span className="mr-1" aria-hidden="true">
                  {channelIcons[item]}
                </span>
                {uiText(channelNames[item], easyMode)}
              </button>
            ))}
          </div>
          <h3 className="mt-8 text-[20px] font-bold text-[#222222]">
            제품 사진을 올려 주세요
          </h3>
          <p id="upload-help" className="mt-2 text-[#545454]">
            20MB 이하의 JPG·PNG 등 사진 한 장을 선택하세요.
          </p>
          {uploadMessage && (
            <p role="status" className="mt-2 font-bold text-[#7f340d]">
              {uploadMessage}
            </p>
          )}
          <div className="mt-3 rounded-[22px] border-2 border-dashed border-[#817a74] bg-white p-5 sm:p-7">
            {imageUrl ? (
              <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
                <img
                  src={imageUrl}
                  alt={
                    easyMode
                      ? "넣은 제품 사진 미리보기"
                      : "업로드한 제품 미리보기"
                  }
                  className="aspect-square w-full rounded-[16px] bg-[#f1efec] object-cover"
                />
                <div>
                  <strong className="text-[20px]">사진이 준비됐어요</strong>
                  <p className="mt-2 text-[18px] leading-6 text-[#545454]">
                    제품이 잘 보이는지 확인해 주세요.
                  </p>
                  <label className="mt-5 inline-flex min-h-12 cursor-pointer items-center rounded-[12px] border-2 border-[#2b2b2b] px-5 font-bold text-[#2b2b2b] hover:bg-[#fff1e7]">
                    사진 바꾸기
                    <input
                      type="file"
                      aria-describedby="upload-help"
                      accept="image/*"
                      onChange={upload}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex min-h-[300px] cursor-pointer flex-col items-center justify-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1e7] text-3xl text-[#c9541a]">
                  ＋
                </span>
                <strong className="mt-4 text-[20px]">제품 사진 올리기</strong>
                <span className="mt-2 text-[16px] text-[#626262]">
                  {uiText("JPG, PNG 등 이미지 파일을 선택해 주세요", easyMode)}
                </span>
                <input
                  type="file"
                  aria-describedby="upload-help"
                  accept="image/*"
                  onChange={upload}
                  className="sr-only"
                />
              </label>
            )}
          </div>
          <div className="mobile-primary-bar mt-7 flex justify-end">
            <PrimaryButton disabled={!imageUrl} onClick={() => setStep(2)}>
              사진 확인하고 다음
            </PrimaryButton>
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <p className="rounded-[12px] border border-[#dda77f] bg-[#fff1e7] px-4 py-3 text-[18px] leading-7 text-[#7f340d]">
            {uiText(
              "아래 내용은 실제 AI 분석이 아닌 예시 초안입니다. 제품에 맞게 자유롭게 고쳐 주세요.",

              easyMode,
            )}
          </p>
          {type !== "all" && (
            <p className="mt-3 text-[16px] font-bold text-[#2b2b2b]">
              {uiText("결과 형식", easyMode)}:{" "}
              {type === "copy"
                ? "✍️ 홍보 문구"
                : uiText(creationNames[type], easyMode)}
            </p>
          )}
          <div className="mt-7 space-y-5 rounded-[22px] border border-[#dedbd7] bg-white p-5 sm:p-7">
            <label className="block text-[18px] font-bold">
              제품 설명
              <textarea
                aria-label="제품 설명"
                value={details.description}
                onChange={(event) =>
                  updateDetails({ ...details, description: event.target.value })
                }
                rows={3}
                className="mt-2 w-full rounded-[12px] border-2 border-[#817a74] p-4 text-[18px] font-normal leading-7 outline-none focus:border-[#c64f12] focus:ring-3 focus:ring-[#c64f12]/15"
              />
            </label>
            <label className="block text-[18px] font-bold">
              강조할 특징
              <textarea
                value={details.features}
                onChange={(event) =>
                  updateDetails({ ...details, features: event.target.value })
                }
                rows={3}
                className="mt-2 w-full rounded-[12px] border-2 border-[#817a74] p-4 text-[18px] font-normal leading-7 outline-none focus:border-[#c64f12] focus:ring-3 focus:ring-[#c64f12]/15"
              />
            </label>
            <label className="block text-[18px] font-bold">
              주요 고객
              <input
                value={details.audience}
                onChange={(event) =>
                  updateDetails({ ...details, audience: event.target.value })
                }
                className="mt-2 h-14 w-full rounded-[12px] border-2 border-[#817a74] px-4 text-[18px] font-normal outline-none focus:border-[#c64f12] focus:ring-3 focus:ring-[#c64f12]/15"
              />
            </label>
            <div className="rounded-[14px] border-2 border-[#817a74] bg-white p-4">
              <label className="block text-[18px] font-bold">
                {uiText("사용할 해시태그 직접 수정", easyMode)}
                <textarea
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
                    추천할 키워드가 부족해요. 제품명, 실제 지역 또는 강조 특징을
                    더 구체적으로 입력해 주세요.
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
            </div>
          </div>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              onClick={() => setStep(1)}
              className="min-h-13 rounded-[14px] border-2 border-[#2b2b2b] px-7 font-bold text-[#2b2b2b] hover:bg-[#fff1e7]"
            >
              이전으로
            </button>
            <div className="mobile-primary-bar">
              {missingFields.length > 0 && (
                <p
                  id="missing-details"
                  role="status"
                  className="mb-2 text-[#7f340d]"
                >
                  {missingFields.join(", ")}을 입력하면 다음으로 갈 수 있어요.
                </p>
              )}
              <PrimaryButton
                disabled={missingFields.length > 0}
                onClick={() => {
                  onResultCreated()

                  setStep(3)
                }}
              >
                {uiText("이 내용으로 결과 보기", easyMode)}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
      {step === 3 && (
        <div>
          <div className="result-summary">
            <span className="result-check" aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>
                {[showPoster, showCopy, showVideo].filter(Boolean).length}개의
                홍보물을 확인해 보세요
              </strong>
              <p>
                지금은 사진과 입력한 내용으로 만든 예시예요. 마음에 들면
                아래에서 저장하세요.
              </p>
            </div>
          </div>
          <p className="mt-2 text-[16px] text-[#545454]">
            {uiText(channelNames[channel], easyMode)}에 어울리는 말투로 구성한
            미리보기입니다.
          </p>
          <nav className="result-jump-links" aria-label="결과 종류로 이동">
            {showPoster && (
              <a
                href="#result-poster"
                onClick={(event) => {
                  event.preventDefault()
                  jumpToResult("poster-title")
                }}
              >
                포스터 보기 ↓
              </a>
            )}
            {showCopy && (
              <a
                href="#result-copy"
                onClick={(event) => {
                  event.preventDefault()
                  jumpToResult("copy-title")
                }}
              >
                홍보 글 보기 ↓
              </a>
            )}
            {showVideo && (
              <a
                href="#result-video"
                onClick={(event) => {
                  event.preventDefault()
                  jumpToResult("video-title")
                }}
              >
                영상 보기 ↓
              </a>
            )}
          </nav>
          <div
            className="result-grid mt-7"
            data-result-count={
              [showPoster, showCopy, showVideo].filter(Boolean).length
            }
          >
            {showPoster && (
              <article
                id="result-poster"
                aria-labelledby="poster-title"
                className="result-card result-poster overflow-hidden rounded-[22px] border border-[#dedbd7] bg-white"
              >
                <div className="result-card-heading">
                  <span aria-hidden="true">🖼️</span>
                  <div>
                    <h3 id="poster-title" tabIndex={-1}>
                      포스터
                    </h3>
                    <p>사진과 글을 한 장에 담았어요</p>
                  </div>
                </div>
                <div className="result-media relative aspect-[4/5] bg-[#2b2b2b]">
                  <img
                    src={imageUrl}
                    alt={
                      easyMode
                        ? "제품 포스터 확인 화면"
                        : "제품 포스터 미리보기"
                    }
                    className="h-full w-full object-cover opacity-75"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1d1d1d] via-[#1d1d1d]/85 to-transparent p-6 pt-24 text-white">
                    <span className="text-[16px] font-bold text-[#f5c96b]">
                      오늘의 추천
                    </span>
                    <strong className="mt-2 block text-[25px] leading-tight">
                      {details.features}
                    </strong>
                    <p className="mt-2 text-[16px] text-[#f7f7f7]">
                      {details.description}
                    </p>
                  </div>
                </div>
                <p className="p-4 text-center text-[16px] font-bold text-[#545454]">
                  {uiText("포스터 미리보기", easyMode)}
                </p>
                <div className="result-card-actions border-t border-[#dedbd7] p-4">
                  <button
                    onClick={() => void createPosterFile(true)}
                    disabled={posterStatus === "preparing"}
                    className="min-h-12 w-full rounded-[12px] border-2 border-[#817a74] bg-white px-4 font-bold text-[#2b2b2b]"
                  >
                    {posterStatus === "preparing"
                      ? "사진을 준비하고 있어요"
                      : easyMode
                        ? "포스터 저장"
                        : "포스터 저장하기"}
                  </button>
                  {posterStatus === "ready" && (
                    <p className="mt-2 text-[16px] text-[#545454]">
                      PNG 파일이 준비됐어요.
                    </p>
                  )}
                  {posterStatus === "failed" && (
                    <p className="mt-2 text-[16px] font-bold text-[#9f3e0d]">
                      포스터 저장에 실패했어요. 다시 시도해 주세요.
                    </p>
                  )}
                </div>
              </article>
            )}
            {showCopy && (
              <article
                id="result-copy"
                aria-labelledby="copy-title"
                className="result-card result-copy rounded-[22px] border border-[#dedbd7] bg-white p-6"
              >
                <div className="result-card-heading">
                  <span aria-hidden="true">✍️</span>
                  <div>
                    <h3 id="copy-title" tabIndex={-1}>
                      홍보 글
                    </h3>
                    <p>복사해서 원하는 곳에 붙여 넣으세요</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#fff1e7] px-3 py-1.5 text-[16px] font-bold text-[#2b2b2b]">
                  {uiText(channelNames[channel], easyMode)} 문구
                </span>
                <p className="mt-5 whitespace-pre-line text-[18px] leading-8">
                  {resultCopy[channel]}
                </p>
                <div className="mt-6 border-t border-[#dedbd7] pt-5">
                  <strong className="block text-[18px]">
                    {uiText(channelNames[channel], easyMode)}{" "}
                    {uiText("확정 해시태그", easyMode)}
                  </strong>
                  <p className="mt-1 text-[16px] leading-6 text-[#626262]">
                    아래 검색어도 홍보 글과 함께 복사돼요.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#fff1e7] px-3 py-2 text-[18px] font-bold text-[#9f3e0d]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => void copyFinalText()}
                  className="result-copy-action mt-6 min-h-12 w-full rounded-[12px] border-2 border-[#817a74] bg-white px-4 font-bold text-[#2b2b2b]"
                >
                  홍보 글 전체 복사하기
                </button>
                {copyMessage && (
                  <p
                    className="mt-2 text-[16px] font-bold text-[#545454]"
                    role="status"
                  >
                    {copyMessage}
                  </p>
                )}
              </article>
            )}
            {showVideo && (
              <article
                id="result-video"
                aria-labelledby="video-title"
                className="result-card result-video rounded-[22px] border border-[#dedbd7] bg-white p-5"
              >
                <div className="result-card-heading">
                  <span aria-hidden="true">🎬</span>
                  <div>
                    <h3 id="video-title" tabIndex={-1}>
                      영상
                    </h3>
                    <p>움직이는 예시를 먼저 확인하세요</p>
                  </div>
                </div>
                <div className="result-media relative mx-auto aspect-[9/16] max-h-[520px] overflow-hidden rounded-[18px] bg-[#2b2b2b]">
                  <img
                    src={imageUrl}
                    alt=""
                    className={`h-full w-full object-cover transition duration-[3000ms] ${
                      playing ? "scale-110 opacity-70" : "opacity-55"
                    }`}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
                    <strong className="text-[24px] leading-tight">
                      {details.features}
                    </strong>
                    <span className="mt-3 text-[16px]">
                      {playing
                        ? "예시 장면을 재생 중입니다"
                        : "재생 가능한 영상 미리보기 상태"}
                    </span>
                    <button
                      onClick={() => setPlaying(!playing)}
                      className="mt-6 min-h-12 rounded-full bg-white px-6 font-bold text-[#2b2b2b]"
                    >
                      {playing ? "일시 정지" : "미리보기 재생"}
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-center text-[16px] leading-5 text-[#626262]">
                  AI 없이 사진과 문구로 만든 확인용 예시 영상입니다.
                </p>
                <div className="result-card-actions mt-4">
                  {videoStatus === "preparing" ? (
                    <button
                      onClick={cancelVideoPreparation}
                      className="min-h-12 w-full rounded-[12px] border-2 border-[#817a74] bg-white px-4 font-bold text-[#2b2b2b]"
                    >
                      영상 준비 취소
                    </button>
                  ) : (
                    <button
                      onClick={() => void createVideoFile(true)}
                      className="min-h-12 w-full rounded-[12px] border-2 border-[#817a74] bg-white px-4 font-bold text-[#2b2b2b]"
                    >
                      영상 저장하기
                    </button>
                  )}
                  {videoMessage && (
                    <p
                      className={`mt-2 text-[16px] font-bold ${
                        videoStatus === "failed" ||
                        videoStatus === "unsupported"
                          ? "text-[#9f3e0d]"
                          : "text-[#545454]"
                      }`}
                      role="status"
                    >
                      {videoMessage}
                    </p>
                  )}
                </div>
              </article>
            )}
          </div>
          <div className="mt-7 flex flex-col gap-3 border-t border-[#dedbd7] pt-7 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => setStep(2)}
              className="min-h-13 rounded-[14px] border-2 border-[#2b2b2b] px-7 font-bold text-[#2b2b2b] hover:bg-[#fff1e7]"
            >
              내용 다시 수정하기
            </button>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onStartNew}
                className="min-h-13 rounded-[14px] border-2 border-[#817a74] bg-white px-7 font-bold text-[#2b2b2b]"
              >
                새 홍보물 만들기
              </button>
              <button
                onClick={onDashboard}
                className="min-h-13 rounded-[14px] border border-[#817a74] bg-white px-7 font-bold"
              >
                홈으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Records({
  easyMode,

  records,

  onOpen,
}: {
  easyMode: boolean

  records: GeneratedRecord[]

  onOpen: (record: GeneratedRecord) => void
}) {
  return (
    <section>
      {records.length > 0 && (
        <p className="mb-5 rounded-[14px] border border-[#e3d8ce] bg-[#fff8ed] p-4">
          새로고침하거나 창을 닫으면 기록이 사라져요. 필요한 파일을 먼저 저장해
          주세요.
        </p>
      )}
      {records.length === 0 ? (
        <div className="rounded-[18px] border border-[#dedbd7] bg-white p-7 text-center">
          <strong className="text-[20px]">아직 만든 결과가 없어요</strong>
          <p className="mt-2 text-[16px] text-[#545454]">
            이 창에서 만든 홍보물을 다시 볼 수 있어요. 새로고침하거나 창을
            닫으면 기록이 사라지니 파일을 먼저 저장하세요.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {records.map((record) => (
            <button
              key={record.id}
              onClick={() => onOpen(record)}
              className="rounded-[18px] border border-[#dedbd7] bg-white p-5 text-left hover:border-[#c64f12]"
            >
              <span className="text-[16px] font-bold text-[#9f3e0d]">
                {uiText(creationNames[record.type], easyMode)}
              </span>
              <strong className="mt-2 block text-[19px]">
                {record.details.description}
              </strong>
              <span className="mt-2 block text-[16px] text-[#626262]">
                {uiText(channelNames[record.channel], easyMode)} ·{" "}
                {record.createdAt}
              </span>
              <span className="mt-4 block font-bold text-[#9f3e0d]">
                결과 다시 보기 →
              </span>
            </button>
          ))}
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
      <h2 className="text-[26px] font-bold">
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
          ["subscription", "구독으로 이용", "꾸준히 홍보물을 만드는 사장님께"],

          ["single", "건당 이용", "필요할 때 한 번씩 만드는 사장님께"],
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
  const [page, setPage] = useState<Page>("login")

  const [creationType, setCreationType] = useState<CreationType>("all")

  const [allOutputFormat, setAllOutputFormat] = useState<OutputFormat>("both")

  const [step, setStep] = useState<Step>(1)

  const [channel, setChannel] = useState<Channel>("instagram")

  const [imageUrl, setImageUrl] = useState("")

  const [mobileOpen, setMobileOpen] = useState(false)

  const [details, setDetails] = useState(initialDetails)

  const [recommendedHashtagsByChannel, setRecommendedHashtagsByChannel] =
    useState<Record<Channel, string> | undefined>(initialHashtagValues)

  const [userHashtagsByChannel, setUserHashtagsByChannel] =
    useState<Record<Channel, string> | undefined>(initialHashtagValues)

  const [userTouched, setUserTouched] = useState(false)

  const [continuationNotice, setContinuationNotice] = useState(false)

  const [records, setRecords] = useState<GeneratedRecord[]>([])

  const [easyMode, setEasyModeState] = useState(false)

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

    window.requestAnimationFrame(() => {
      const scrollingElement = document.scrollingElement

      if (scrollingElement) scrollingElement.scrollTop = 0

      window.scrollTo({ top: 0, left: 0, behavior: "auto" })

      const appMain = document.querySelector<HTMLElement>(
        "[data-app-scroll-container]",
      )

      if (appMain) appMain.scrollTop = 0
    })
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
      return easyMode
        ? "첫 화면입니다. 사진 한 장으로 홍보물을 만들어 보세요. 1단계, 사진 넣기. 홍보할 제품 사진을 넣어 주세요. 2단계, 설명과 검색어 확인. 정리된 설명과 추천 검색어를 확인하고 고쳐 주세요. 3단계, 홍보물 만들기. 고른 홍보물을 만들고 결과를 확인해 주세요. 홍보물 만들기 시작 버튼을 누르면 1단계로 이동합니다."
        : "메인 대시보드입니다. 사진 한 장으로 홍보물을 만들어 보세요. 1단계, 사진 넣기. 홍보할 제품 사진을 넣어 주세요. 2단계, 설명과 해시태그 확인. 정리된 설명과 추천 해시태그를 확인하고 고쳐 주세요. 3단계, 홍보물 만들기. 선택한 홍보물을 만들고 결과를 확인해 주세요. 홍보물 만들기 시작 버튼을 누르면 1단계로 이동합니다."
    }

    if (page === "records") {
      return "최근 생성 기록 화면입니다. 이 앱에서 만든 결과의 종류와 날짜를 확인하고 다시 열 수 있습니다."
    }

    if (page === "plan") {
      return easyMode
        ? "이용 방법 화면입니다. 매달 이용하거나 필요할 때 이용하는 방법을 고를 수 있으며, 가격과 만들 수 있는 수량은 아직 정해지지 않았습니다."
        : "이용권 화면입니다. 구독으로 이용하거나 건당 이용하는 구조를 선택할 수 있으며, 가격과 수량은 아직 정해지지 않았습니다."
    }

    if (step === 1) {
      const format =
        creationType === "all"
          ? `${speakUi(outputFormatNames[allOutputFormat])}와 홍보 문구`
          : speakUi(creationNames[creationType])

      return `${speakUi(creationNames[creationType])} 1단계입니다. ${speakUi("현재 결과 형식")}은 ${format}, ${speakUi("채널")}은 ${speakUi(channelNames[channel])}입니다. ${
        imageUrl
          ? "제품 사진이 준비되었습니다. 다음 버튼을 누르세요."
          : "제품 사진을 올려 주세요."
      }`
    }

    if (step === 2) {
      return `${speakUi("2단계 제품 정보와 해시태그 확인 화면입니다.")} 제품 설명은 ${details.description}. 강조할 특징은 ${details.features}. 주요 고객은 ${details.audience}입니다. ${speakUi("사용자가 입력한 확정 해시태그")}는 ${parseHashtags(safeUserHashtags[channel]).join(", ")}입니다. 각 입력값을 직접 고친 뒤 결과 보기 버튼을 누르세요.`
    }

    return `3단계 결과 화면입니다. ${speakUi(channelNames[channel])}용 ${speakUi(creationNames[creationType])} 결과입니다. 제품 설명은 ${details.description}. 강조 특징은 ${details.features}. ${speakUi("확정 해시태그")}는 ${parseHashtags(safeUserHashtags[channel]).join(", ")}입니다.`
  })()

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

    const utterance = new SpeechSynthesisUtterance(speechText)

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
      if (
        speechRequestRef.current === requestId &&
        !synthesis.speaking &&
        !synthesis.pending
      ) {
        setSpeaking(false)

        setSpeechPreparing(false)

        setSpeechMessage(
          "일시적으로 읽어주기를 시작하지 못했어요. 다시 눌러 시도해 주세요.",
        )
      }
    }, 3000)

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

      if (event.error === "canceled" || event.error === "interrupted") return

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
      setCreationType(type)

      setStep(1)

      setContinuationNotice(Boolean(imageUrl) || userTouched)
    }

    setPage(nextPage)

    setMobileOpen(false)
  }

  const startNew = () => {
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

  const openRecord = (record: GeneratedRecord) => {
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

    records: "최근 생성 기록",

    plan: "이용권",
  }

  return (
    <Shell
      page={page}
      title={uiText(titles[page], easyMode)}
      creationType={creationType}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
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
      {page === "home" && <Home navigate={navigate} easyMode={easyMode} />}
      {page === "create" && (
        <CreateFlow
          type={creationType}
          step={step}
          setStep={setStep}
          channel={channel}
          setChannel={setChannel}
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
          details={details}
          setDetails={setDetails}
          recommendedHashtagsByChannel={safeRecommendedHashtags}
          setRecommendedHashtagsByChannel={setRecommendedHashtagsByChannel}
          userHashtagsByChannel={safeUserHashtags}
          setUserHashtagsByChannel={setUserHashtagsByChannel}
          outputFormat={outputFormat}
          setOutputFormat={setAllOutputFormat}
          continuationNotice={continuationNotice}
          onDraftTouched={() => setUserTouched(true)}
          easyMode={easyMode}
          onResultCreated={saveCurrentResult}
          onDashboard={() => navigate("home")}
          onStartNew={startNew}
        />
      )}
      {page === "records" && (
        <Records easyMode={easyMode} records={records} onOpen={openRecord} />
      )}
      {page === "plan" && <Plan easyMode={easyMode} />}
    </Shell>
  )
}
