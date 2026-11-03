// 발표 당일 한도 풀기(사용자, 2026-11-04): 발표는 2026-11-13(목) 16:00. 그 앞뒤 15:30~17:00(한국 시간) 동안
// 심사위원·청중이 QR로 함께 써도 막히지 않게, 유료 키 하루 상한과 접속 주소(IP)당 1분 한도를 넉넉히 올린다.
// 같은 와이파이는 접속 주소 하나로 묶이므로 1분 한도가 특히 중요하다. 깃허브 수정 마감(11-08 18:00) 뒤에는
// 커밋할 수 없어 미리 넣어 두고, 시간이 지나면 배포 없이 원래 한도로 돌아간다.
export const EVENT_FROM = Date.parse("2026-11-13T15:30:00+09:00")
export const EVENT_TO = Date.parse("2026-11-13T17:00:00+09:00")
/** 이 시간 동안 유료 키 하루 상한(원). 배경 바꾸기 한 장 약 50원 → 약 100장. */
export const EVENT_DAILY_LIMIT_KRW = 5000
/** 이 시간 동안 접속 주소당 1분 한도에 곱하는 수(배경 3 → 30, 글 20 → 200). */
export const EVENT_RATE_MULTIPLIER = 10

export function inEventWindow(now = Date.now()) {
  return now >= EVENT_FROM && now < EVENT_TO
}
