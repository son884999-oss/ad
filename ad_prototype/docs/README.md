# 홍보잇다 개발 문서

실행·설정·점검·배포 방법과 문서 안내입니다. 문서는 아래 4개입니다.
마지막 갱신: 2026-11-04 · 기본 작업 브랜치 `feature/UI-Screen` · 앱 `ad_prototype/`(Vite + React, Vercel 함수 `api/`)

| 문서 | 무엇 |
|---|---|
| **이 문서** | 지금 상태, 규칙, 설치, 점검 명령, 배포·회원가입 설정 |
| [결정과_이력.md](결정과_이력.md) | 무엇을 왜 정했고 무엇을 시도했다 버렸는지(10-13~11-01) |
| [나중에_할일.md](나중에_할일.md) | 아직 안 한 일, 폐기한 기능, 발표 뒤 할 일 |
| [비용_품질_출처.md](비용_품질_출처.md) | **유료 호출 장부**(쓰기 전에 먼저 적는 곳), 단가, 품질 기준, 음원 출처 |

링크: 앱 https://ad-prototype-codyssey.vercel.app · 발표 자료(웹 슬라이드) https://codyseeypresentation.vercel.app (원본 저장소 `son884999-oss/CODYSEEY-presentation`(비공개), main에 푸시하면 Vercel이 자동 배포) · 브랜드 자료 `/brand-library/`

문서가 아닌 자료: [기술문서/](기술문서/)(팀 공유 2장) · [기술설계서_통합본/](기술설계서_통합본/)(제출용 6장) · [변경요약/](변경요약/)(10-22 팀 공유 PDF) · [서비스흐름도/](서비스흐름도/) · [기준문구/](기준문구/)(테스트용 홍보 문구) · [기준그림/](기준그림/) · [supabase/](supabase/)(DB SQL) · [발표준비/development_purpose.pdf](발표준비/development_purpose.pdf).

---

## 1. 지금 상태

**기능 고정:** 담당 교수 지시로 발표(2026-11-13)까지 새 기능을 넣지 않고 버그와 화면 가림만 고친다. 사진 위험 항목 경고는 시범 구현만 하고 발표 버전에는 적용하지 않았다(발표 부록 A19).

소상공인이 **상품 사진 한 장**으로 포스터 · 10초 영상 · 홍보 글을 만드는 모바일 웹앱. PC에서는 휴대폰 틀 안에 모바일 화면이 나온다. 배포: Vercel 프로젝트 `son884999-oss-projects/ad`, 주소 `https://ad-prototype-codyssey.vercel.app`.

```
홈(예시 카드 9장) → ① 사진 넣기 → [다음으로]
  → 팝업 "배경을 광고 사진처럼 바꿀까요?" → 바꾸기면 "원하는 사진을 선택해 주세요"(원본 / 보정)
→ ② 정보 입력 ([자동으로 채워 주기]를 눌러야 AI 분석, 기본·쉬운 화면 전환)
→ ③ 결과: 사진(보정을 골랐을 때만) · 포스터 · 영상 · 홍보 글 탭
→ 저장·공유·복사, 로그인했으면 내 홍보물에 서버 저장
```

| 부분 | 어떻게 | 비용 |
|---|---|---|
| 사진 읽기·홍보 글 | AI 순서: 코디세이 COPA(Claude) → Gemini 무료 → Gemini 유료(하루 상한) → 앱 기본 문구. 실패하면 무엇이든 다음으로 넘어감 | 0원 또는 1건 약 7~10원(유료로 넘어갔을 때, 공식 단가 추정) |
| 배경 바꾸기 | Gemini `gemini-3.1-flash-lite-image`, 프롬프트 `api/_lib/background.js`(그릇·받침은 제품의 일부, 업종별 10종). 실패·상한이면 원래 사진 | 장당 약 50~53원 |
| 포스터 | `src/poster/` 브라우저 Canvas. 4:5, 스타일 1·2·3, 색은 사진에서 | 0원 |
| 영상 | `src/motionVideo.ts` 10초(전체 컷 → 전환 → 상품 클로즈업 → 마지막 화면). WebCodecs 빠른 MP4(`src/fastVideo.ts`), 안 되면 실시간 녹화 + `src/mp4Flatten.ts`. 소리 `src/videoSound.ts` | 0원 |
| 회원가입 | Supabase Auth — 카카오·이메일·Google(Google은 테스트 계정만, 6절). 가입 없이 "바로 시작하기"도 됨 | 무료 플랜 |

- 유료 하루 상한: 10-22까지 1,000원, 10-23부터 500원(`api/_lib/gemini.js` `RAISED_UNTIL_DAY`·`RAISED_DAILY_LIMIT_KRW`). 배경 그림과 글이 같은 장부를 쓴다. **발표 당일 2026-11-13 15:30~17:00(한국 시간)에만** 하루 상한 5,000원, 접속 주소당 1분 한도 10배(`api/_lib/event.js`, 시간이 지나면 저절로 원래대로).
- 배포 서버의 하루 장부는 메모리에 있어 서버가 여러 개 뜨면 덜 막을 수 있다 → Google Cloud 결제에 예산 알림을 건다.
- 홍보물 1건: 배경을 그대로 두면 0~10원, 바꾸면 약 57~63원(발표 부록 A3과 같은 값).
- 마지막 점검(11-04): tsc·build, verify:auth·records·easy·cloud-sync·guard·background·ai 통과. `audit:screens`에 남는 8건은 의도한 홈 예시 카드 가로 넘침. `verify:photo`는 적용 보류한 사진 경고 흐름을 기대하는 검사라 실패(정리는 [나중에_할일.md](나중에_할일.md)).
- 기종 11종 점검(10-22): iPhone SE(320×568)만 저장 버튼이 한 번 스크롤해야 보이고, 나머지는 통과.

## 2. 규칙 (전체는 저장소 맨 위 `CLAUDE.md`)

- 응답은 한국어.
- `.env.local`을 읽거나 출력하지 않는다. 키 값은 절대 출력하지 않는다.
- 푸시는 `feature/UI-Screen`만. `main` 병합과 Vercel 설정은 사용자가 직접. 팀 폴더 `A_*`~`F_*`는 읽기만.
- **유료 호출**은 사용자가 정한 예산 안에서만. **쓰기 전에** [비용_품질_출처.md](비용_품질_출처.md) "호출 장부"에 적고 커밋한다. 실패해도 자동으로 다시 시도하지 않는다.
- 테스트에 홍보 문구가 필요하면 AI를 부르지 말고 `기준문구/홍보글_채널별_{케이크,라테}.json`을 쓴다.
- 결과는 실제 출력으로만 판단한다. 공유하지 않기로 한 문서는 `outputs/내부문서_로컬/`(git 제외)에 둔다. 공유 문서에는 검토가 끝난 내용만 넣는다.

## 3. 설치와 `.env.local`

```powershell
git clone https://github.com/son884999-oss/ad
cd ad; git checkout feature/UI-Screen; cd ad_prototype
npx -y pnpm@9.15.9 install      # pnpm 버전을 맞춰야 함
npm run dev                     # http://localhost:5173 (실제 AI)
npm run dev:mock                # http://127.0.0.1:5174 (가짜 AI 답, 키·비용 안 씀)
```

- Node 22 이상. 자동 점검은 Playwright + Microsoft Edge 기준이다(Edge가 없는 환경은 6절 아래 "Linux에서 점검할 때").
- `.env.example`을 복사해 `ad_prototype/.env.local`을 만든다. 키는 서버에서만 읽는다(`VITE_`를 붙이면 브라우저로 새어 나간다. Supabase 공개값만 예외). 바꾼 뒤에는 개발 서버를 다시 켠다.

| 이름 | 무엇 | 없으면 |
|---|---|---|
| `COPA_API_KEY`, `COPA_MODEL` | 코디세이 COPA(Claude), 사진 읽기·글 1순위. 모델 비우면 `claude-haiku-4` | Gemini로 |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini 무료(글). 무료 등급은 하루 20번 | 앱 기본 문구 |
| `GEMINI_API_KEY_2`, `GEMINI_MODEL_2` | Gemini 유료(글 마지막 대체 + 배경). 모델 `gemini-3.5-flash-lite` | 배경 바꾸기 꺼짐 |
| `GEMINI_IMAGE_MODEL` | 비우면 `gemini-3.1-flash-lite-image` | 기본값 |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 회원가입·서버 저장(관리자 키에는 `VITE_` 금지) | 로그인 "준비 중" |
| `ALLOWED_ORIGINS` | 직접 연결한 도메인이 있을 때만 | — |

- 유료 키는 첫 Gemini 키가 **실패할 때만** 쓰인다. 첫 키를 비우면 유료 키도 안 쓴다.
- 새 컴퓨터로 넘어가지 않는 것: `.env.local`, `outputs/` 전체(`outputs/.gemini-key2-usage.json` = 유료 키 하루 장부, `outputs/내부문서_로컬/`). 표에 없는 옛 변수는 넣지 않는다.

## 4. 점검 명령 (바꾼 뒤에는 꼭)

개발 서버(5173)를 켠 상태에서 `ad_prototype/`에서 돌린다. 모두 가짜 AI 응답이라 비용이 들지 않는다.

```powershell
npx tsc --noEmit -p .
npm run build
npm run verify:ai; npm run verify:easy; npm run verify:records; npm run verify:photo-review
npm run verify:promo; npm run verify:guard; npm run verify:background; npm run verify:auth; npm run verify:cloud-sync
npm run verify:video-preview   # dev:mock 서버(5174)에서
$env:REFERENCE_REBUILD_OUTPUT="$env:TEMP\rebuild"; node scripts/verify-reference-rebuild.mjs
npm run audit:screens -- --shots "$env:TEMP\audit"
npm run eval:poster -- http://127.0.0.1:5173/ --layout vertical --out "$env:TEMP\poster-v"
npm run eval:video -- http://127.0.0.1:5173/ --out "$env:TEMP\video"
npm run eval:promo; npm run eval:promo -- --local
```

품질 기준: `.claude/skills/hongboitda-quality/SKILL.md`, [비용_품질_출처.md](비용_품질_출처.md) 3절.

## 5. 배포 (Vercel)

1. 프로젝트 루트 디렉터리 `ad_prototype`. 환경 변수는 3절 표와 같은 이름으로 **Production과 Preview 둘 다**. `VITE_` 값은 빌드 때 들어가므로 바꾸면 Redeploy.
2. 순서: `feature/UI-Screen` 미리보기 배포 → 폰으로 확인 → PR로 `main` 병합(사용자) → 운영 배포.
3. 보호 장치(코드에 있음): 같은 접속 주소(IP)에서 1분에 글 20번·배경 바꾸기 3번(발표 시간대는 10배), 유료 하루 상한. 서버 인스턴스마다 따로 세는 느슨한 상한이라, 공개 전에는 Vercel Firewall에 `/api/*` 속도 제한을 추가하고 Google Cloud 결제 예산 알림을 건다(알림만 하고 막지는 않음).
4. 발표·시연 당일: 상한은 15:30~17:00에 저절로 올라간다. 미리 한 번 만들어 보고 와이파이를 확인한다. 실패하면 원래 사진과 기본 문구로 결과가 나온다(화면이 멈추지 않음).

## 6. 회원가입 설정 (끝남, 다시 할 때만)

**상태(10-21):** 이메일·카카오·Google 모두 켜짐, 실제 로그인 확인. Google은 OAuth 앱이 '테스트' 게시 상태라 **테스트 사용자로 넣은 계정(최대 100개)만** 로그인된다. 모두에게 열려면 '앱 게시' 후 브랜드 확인을 받아야 하고, 그러려면 직접 소유를 증명한 도메인의 홈페이지·처리방침 주소가 필요하다(무료 `vercel.app` 주소로는 어려움) → 정식 도메인을 붙일 때 함께 한다(발표 부록 A9). 코드: `src/auth.ts`, `src/cloudRecords.ts`, `api/account-delete.js`, 점검 `npm run verify:auth`.

1. **Supabase**(Region Seoul, Free): Project URL → `VITE_SUPABASE_URL`, Publishable key → `VITE_SUPABASE_ANON_KEY`, Secret key → `SUPABASE_SERVICE_ROLE_KEY`(절대 공개 금지). SQL Editor에 `docs/supabase/schema.sql` 실행(실행 때 뜨는 "destructive" 경고는 `drop policy if exists` 때문). Email 켜기(이메일 인증 확인은 현재 끔). URL Configuration: Site URL = 운영 주소, Redirect URLs = `http://localhost:5173/**`, `https://*.vercel.app/**`.
2. **카카오**(2025 콘솔): 앱 → 플랫폼 키 → **REST API 키** 화면 안에 리다이렉트 URI `https://<프로젝트>.supabase.co/auth/v1/callback`과 클라이언트 시크릿이 있다. 카카오 로그인 ON. 동의항목 닉네임·사진·**이메일**(없으면 KOE205 오류). 이메일은 비즈 앱만 되므로 "개인 개발자 비즈 앱 전환" 뒤 선택 동의로. Supabase Kakao에 키·시크릿, "Allow users without an email" 켬. 사이트 도메인에 localhost와 Vercel 주소.
3. **Google**: OAuth consent(External, Test users에 QA 계정) → OAuth client(Web): JavaScript origins = localhost·Vercel 주소, redirect = Supabase callback → Supabase Google에 입력.
4. 확인: 이메일 가입 → 메뉴에 이메일이 보임 → 홍보물을 만들면 Table Editor `records`와 Storage `records`에 생김 → 다른 브라우저에서도 보임 → 회원 탈퇴하면 지워짐.

### Linux에서 점검할 때

사진 확인·실패 복구는 `verify:photo-review`, 영상 첫 미리보기는 `verify:video-preview`로 모의 응답을 검증한다. 모든 API를 가로채므로 실제 AI 호출이 없다. Linux 등 Edge가 없는 환경에서는 `PLAYWRIGHT_EXECUTABLE_PATH`(사진·AI 점검), `PLAYWRIGHT_CHROMIUM_EXECUTABLE`(영상 점검) 및 필요시 JSON 배열 `PLAYWRIGHT_CHROMIUM_ARGS`를 지정한다. 실제 AI의 탐지 정확도와 실기기 코덱·소리·배포 설정은 이 검사로 보장하지 않는다.

### 사진 경고(시범 구현, 발표 버전 적용 보류, 10-30)
- 담배 사진 제보 후 원본 사진을 보정 전에 확인하는 흐름을 시범 구현했다. 사용자가 추가 대기·복잡성과 실제 탐지 정확도 미검증을 검토하고 현 시연에서는 적용을 보류했다. 현재 [다음으로]·배경 보정·직접 입력에는 사진 확인을 위한 추가 AI 호출이나 대기·확인 게이트가 없다.
- 붉은 삼각형과 “게시 전에 직접 확인해 주세요” 문구를 함께 쓰는 경고창은 시범 코드로 보존한다. 사진·문구의 사용 권한과 내용을 확인하도록 안내하며, AI가 안전이나 광고 가능 여부를 보증하거나 서비스의 법적 책임을 일괄 면제한다는 뜻은 아니다.
- 내부 플래그는 기본 꺼짐. `VITE_PHOTO_REVIEW_EXPERIMENTAL=1`과 **Vite mock 모드 두 조건을 모두** 충족할 때만 시범 경고를 켠다. production 빌드에서는 플래그가 남아 있어도 비활성이다. 사용자 설정이나 시연 화면에 토글을 추가하지 않았다.
- 기본 검증: `npm run verify:photo-review`(분류 파서 계약 + 현재 시연 동작). 시범 검증: 위 플래그를 둔 `npm run dev:mock` 서버에 `npm run verify:photo-review-prototype`을 실행한다(`verify:photo-preflight`는 같은 시범 검사의 기존 별칭). 모의 API만 사용한다.
- 현재 유지되는 인식 실패 안내·[다시 읽기]·[직접 입력하기]와 영상 사진 표지는 별도 기능이다. 자동 채우기는 요청할 때만 실행하고, 실패하면 이미 적은 내용을 보존한다.

### 기기 간 저장·불러오기 (10-30)
- 사용자 승인으로 로그인 기록의 동기화 결함을 보완했다. 기기 로컬 기록과 계정의 서버 목록을 모두 읽은 뒤 업로드를 시작한다. 같은 ID의 동기화된 기록은 서버의 최신 입력·문구·새 사진 주소를 반영하고, 아직 저장되지 않은 기기 수정은 보존한다.
- 내 홍보물에서 서버 불러오기/저장 상태와 실패를 알리고 [서버 연결 다시 시도]를 제공한다. 로컬 저장 성공과 서버 저장 성공을 구분한다. 계정별 미전송 로컬 기록은 해당 계정에 귀속시키고 다른 계정에서는 표시·전송하지 않는다.
- 200개 단위 페이지를 끝까지 읽으며, 서버에서 삭제된 동기화 기록은 재조회 때 목록에서 제거한다. 삭제는 DB 행을 먼저 처리해 사진만 먼저 사라지는 문제를 피한다.
- `npm run verify:cloud-sync`: 두 격리 브라우저와 공유 모의 Supabase로 조회·수정·재접속·실패·계정 전환을 검사한다. 운영 계정·실기기·운영 RLS 적용 여부의 검증을 대신하지 않는다.
- 실시간 공동 편집·충돌 병합은 지원하지 않는다. 로그인/재접속 때 목록을 다시 읽는다. 삭제·포스터/영상 파일의 실패 큐는 현재 창 메모리에 있으므로 창을 닫기 전 재시도해야 한다. 미전송 기록 입력값은 로컬에 보존하지만 파일 큐의 영구 오프라인 보관까지 구현한 것은 아니다.
