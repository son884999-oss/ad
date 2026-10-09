/** 홍보할 곳 안내용 설정. 외부 계정 연결·자동 게시 기능은 포함하지 않는다. */
export const channels = {
  download: {
    name: "파일만 저장하기",
    description: "홍보할 곳은 나중에 정해도 괜찮아요.",
    guide:
      "사진과 글을 만든 뒤 파일을 저장해요. 홍보할 곳은 나중에 골라도 돼요.",
    heading: "우리 가게의 추천",
    rgb: "32, 50, 74",
    accent: "#DCEDE3",
    tagLimit: 4,
    minimum: 0,
    next: "포스터와 영상을 저장하고, 필요한 홍보 글을 복사하세요. 저장한 파일은 원하는 곳에 직접 올릴 수 있어요.",
    url: "",
  },
  naver_place: {
    name: "네이버 스마트플레이스",
    description: "가게를 검색하는 손님에게 소식을 알려요.",
    guide: "메뉴·제품의 특징과 방문에 필요한 정보를 또렷하게 전해요.",
    heading: "우리 가게 새 소식",
    rgb: "40, 89, 78",
    accent: "#DCEDE3",
    tagLimit: 3,
    minimum: 0,
    next: "네이버 스마트플레이스에서 내 업체를 선택한 뒤, 소식에 저장한 사진과 복사한 글을 넣으세요. 업체 등록과 관리 권한이 필요해요.",
    url: "https://smartplace.naver.com/",
  },
  kakao: {
    name: "카카오톡 채널",
    description: "단골손님에게 새 소식을 보여줘요.",
    guide: "단골손님에게 전하듯 쉽고 친근한 안내문을 만들어요.",
    heading: "사장님이 전하는 소식",
    rgb: "62, 58, 37",
    accent: "#F3E9BF",
    tagLimit: 3,
    minimum: 0,
    next: "카카오톡 채널 관리자센터의 소식에 사진과 글을 직접 올리세요. 채널 개설이 필요해요. 친구에게 보내는 메시지는 별도 유료 기능이에요.",
    url: "https://center-pf.kakao.com/",
  },
  instagram: {
    name: "인스타그램",
    description: "제품 사진과 짧은 영상을 보여줘요.",
    guide: "인스타그램은 사진을 돋보이게, 짧고 감성적인 말투로 보여줘요.",
    heading: "오늘의 추천",
    rgb: "42, 59, 45",
    accent: "#f1d598",
    tagLimit: 8,
    minimum: 5,
    next: "인스타그램 앱에서 새 게시물을 만들고 저장한 사진을 선택하세요. 홍보 글은 설명에 붙여 넣으세요. 영상은 릴스에서 확인한 뒤 올릴 수 있어요.",
    url: "https://www.instagram.com/",
  },
  naver_blog: {
    name: "네이버 블로그",
    description: "제품과 서비스 이야기를 자세히 전해요.",
    guide: "제품의 특징과 추천 대상을 차근차근 소개해요.",
    heading: "우리 가게 이야기",
    rgb: "40, 89, 78",
    accent: "#DCEDE3",
    tagLimit: 5,
    minimum: 0,
    next: "네이버 블로그에서 글쓰기를 열어 저장한 사진과 복사한 글을 넣으세요. 제목과 가게 위치를 확인한 뒤 직접 발행하세요.",
    url: "https://section.blog.naver.com/",
  },
  daangn: {
    name: "당근 비즈프로필",
    description: "가까운 동네 손님에게 가게를 소개해요.",
    guide: "동네 손님에게 도움이 되는 가게 소식을 간단하게 전해요.",
    heading: "우리 동네 가게 소식",
    rgb: "74, 47, 38",
    accent: "#F4D8C6",
    tagLimit: 3,
    minimum: 0,
    next: "당근의 내 비즈프로필에서 소식 쓰기를 열어 사진과 글을 직접 올리세요. 비즈프로필 이용과 유료 광고는 별도예요.",
    url: "https://business.daangn.com/",
  },
  youtube: {
    name: "유튜브 쇼츠",
    description: "제품을 짧은 세로 영상으로 소개해요.",
    guide: "영상의 핵심 내용을 짧게 소개하는 글을 만들어요.",
    heading: "영상으로 만나보세요",
    rgb: "32, 50, 74",
    accent: "#DCE8F5",
    tagLimit: 3,
    minimum: 0,
    next: "영상을 저장한 뒤 유튜브 앱이나 스튜디오에서 직접 올리세요. 현재 영상은 사진으로 만든 3초 예시예요. 게시 전 길이·내용·파일 지원 여부를 확인하세요.",
    url: "https://studio.youtube.com/",
  },
  x: {
    name: "엑스(X)",
    description: "이미 사용 중인 계정에 짧게 소식을 전해요.",
    guide: "엑스는 핵심 특징과 행동을 짧고 또렷하게 전달해요.",
    heading: "한눈에 보는 핵심",
    rgb: "38, 45, 69",
    accent: "#d7dcf1",
    tagLimit: 3,
    minimum: 1,
    next: "엑스에서 새 게시물을 열어 사진과 복사한 글을 넣으세요. 계정에 적용되는 글자 수를 확인하고 직접 게시하세요.",
    url: "https://x.com/",
  },
  threads: {
    name: "쓰레드(Threads)",
    description: "이미 사용 중인 계정에서 이야기를 나눠요.",
    guide: "쓰레드는 손님에게 이야기하듯 편안하고 친근한 말투를 사용해요.",
    heading: "우리 가게 이야기",
    rgb: "74, 47, 38",
    accent: "#f4d1bf",
    tagLimit: 4,
    minimum: 2,
    next: "쓰레드에서 새 게시물을 열어 사진과 복사한 글을 넣으세요. 내용과 길이를 확인한 뒤 직접 게시하세요.",
    url: "https://www.threads.com/",
  },
} as const

export type Channel = keyof typeof channels
export const channelIds = Object.keys(channels) as Channel[]
export function mapChannels<T>(
  create: (channel: Channel) => T,
): Record<Channel, T> {
  return Object.fromEntries(
    channelIds.map((id) => [id, create(id)]),
  ) as Record<Channel, T>
}
export const channelNames = mapChannels((id) => channels[id].name)
type Recommendation = {
  label: string
  ids: Channel[]
}
export const recommendations = {
  general: { label: "전체 업종", ids: ["naver_place", "kakao", "instagram"] },
  visual: {
    label: "카페·꽃집·소품 등 사진이 중요한 가게",
    ids: ["instagram", "naver_place", "kakao"],
  },
  service: {
    label: "교육·수리 등 설명이 중요한 서비스",
    ids: ["naver_place", "naver_blog", "kakao"],
  },
  local: {
    label: "동네 생활·방문 서비스",
    ids: ["naver_place", "daangn", "kakao"],
  },
} satisfies Record<string, Recommendation>
