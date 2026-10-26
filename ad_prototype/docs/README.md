# 홍보잇다 — 여기부터 읽기

사람도 클로드 코드도 이 문서부터 읽는다. 문서는 아래 5개뿐이다.
마지막 갱신: 2026-10-22 · 작업 브랜치 `feature/UI-Screen` · 앱 `ad_prototype/`(Vite + React, Vercel 함수 `api/`)

| 문서 | 무엇 |
|---|---|
| **이 문서** | 지금 상태, 규칙, 설치, 점검 명령, 배포·회원가입 설정 |
| [결정과_이력.md](결정과_이력.md) | 10-13~10-22에 무엇을 왜 정했고 무엇을 시도했다 버렸는지 |
| [나중에_할일.md](나중에_할일.md) | 아직 안 한 일, 폐기한 기능, 발표 뒤 할 일 |
| [비용_품질_출처.md](비용_품질_출처.md) | **유료 호출 장부**(쓰기 전에 먼저 적는 곳), 단가, 품질 기준, 음원 출처 |
| [발표준비/홍보잇다_PC이어가기_1022.md](발표준비/홍보잇다_PC이어가기_1022.md) | 발표 준비 상황과 발표 자료 제작 지시서, 통계 출처 |

문서가 아닌 자료: [기술문서/](기술문서/)(팀 공유 2장) · [기술설계서_통합본/](기술설계서_통합본/)(교수님 제출 6장) · [변경요약/](변경요약/)(10-22 팀 공유 PDF) · [서비스흐름도/](서비스흐름도/) · [기준문구/](기준문구/)(테스트용 홍보 문구) · [기준그림/](기준그림/) · [supabase/](supabase/)(DB SQL) · [발표준비/development_purpose.pdf](발표준비/development_purpose.pdf). 옛 문서 원본은 [archive/옛문서_1022/](archive/옛문서_1022/)에 그대로 있다(읽을 필요 없음).

---

## 1. 지금 상태 (2026-10-22)

**기능 고정:** 담당 교수 지시로 발표까지 새 기능·기능 변경 없음. 자잘한 버그와 화면 가림만 고친다.

소상공인이 **상품 사진 한 장**으로 포스터 · 10초 영상 · 홍보 글을 만드는 모바일 웹앱. PC에서는 휴대폰 틀 안에 모바일 화면이 나온다. 배포: Vercel 프로젝트 `son884999-oss-projects/ad`, 주소 `https://ad-prototype-codyssey.vercel.app`.

```
홈(예시 카드 9장) → ① 사진 넣기 → [다음으로]
  → 팝업 "배경을 광고 사진처럼 바꿀까요?" → 바꾸기면 "원하는 사진을 선택해 주세요"(원본 / 보정)
→ ② 정보 입력 ([자동으로 채워 주기]를 누를 때만 AI가 사진을 읽음, 기본·쉬운 화면 전환)
→ ③ 결과: 사진(보정을 골랐을 때만) · 포스터 · 영상 · 홍보 글 탭
→ 저장·공유·복사, 로그인했으면 내 홍보물에 서버 저장
```

| 부분 | 어떻게 | 비용 |
|---|---|---|
| 사진 읽기·홍보 글 | AI 순서: 기관 Claude(COPA) → Gemini 무료 → Gemini 유료(하루 상한) → 앱 기본 문구. 실패하면 무엇이든 다음으로 넘어감 | 0원 또는 약 3원/건(유료로 넘어갔을 때, 10-22 실측) |
| 배경 바꾸기 | Gemini `gemini-3.1-flash-lite-image`, 프롬프트 `api/_lib/background.js`(그릇·받침은 제품의 일부, 업종별 10종). 실패·상한이면 원래 사진 | 장당 약 50원 |
| 포스터 | `src/poster/` 브라우저 Canvas. 4:5, 스타일 1·2·3, 색은 사진에서 | 0원 |
| 영상 | `src/motionVideo.ts` 10초(전체 컷 → 전환 → 상품 클로즈업 → 마지막 화면). WebCodecs 빠른 MP4(`src/fastVideo.ts`), 안 되면 실시간 녹화 + `src/mp4Flatten.ts`. 소리 `src/videoSound.ts` | 0원 |
| 회원가입 | Supabase Auth — 카카오·Google·이메일 모두 동작. 가입 없이 "바로 시작하기"도 됨 | 무료 플랜 |

- 유료 하루 상한: 10-22까지 1,000원, 10-23부터 500원(`api/_lib/gemini.js` `RAISED_UNTIL_DAY`·`RAISED_DAILY_LIMIT_KRW`). 배경 그림과 글이 같은 장부를 쓴다. **발표 날만 2,000~3,000원으로 올린다**(QR 체험).
- 배포 서버의 하루 장부는 메모리에 있어 서버가 여러 개 뜨면 덜 막을 수 있다 → Google Cloud 결제에 예산 알림을 건다.
- main 병합: PR #22~#31 병합됨. 10-22 커밋(기종 점검 버그 2개 등)은 **PR #32**로 올림.
- 마지막 점검(10-22): tsc·build, verify:easy·photo·background·guard 통과. `verify:records`는 배경 팝업 흐름을 못 따라가 시간 초과(스크립트 문제, 발표 뒤 수정). `audit:screens` 762개는 대부분 헤드리스의 "초점 테두리 없음"과 의도한 홈 예시 가로 넘침.
- 기종 11종 점검: iPhone SE(320×568)만 저장 버튼이 한 번 스크롤해야 보이고, 나머지는 통과.

## 2. 규칙 (전체는 저장소 맨 위 `CLAUDE.md`)

- 응답은 한국어. 간단한 작업은 하위 모델(Sonnet)에게 맡겨도 된다.
- `.env.local`을 읽거나 출력하지 않는다. 키 값은 절대 출력하지 않는다.
- 푸시는 `feature/UI-Screen`만. `main` 병합과 Vercel 설정은 사용자가 직접. 팀 폴더 `A_*`~`F_*`는 읽기만.
- **유료 호출**은 사용자가 정한 예산 안에서만. **쓰기 전에** [비용_품질_출처.md](비용_품질_출처.md) "호출 장부"에 적고 커밋한다. 실패해도 자동으로 다시 시도하지 않는다.
- 테스트에 홍보 문구가 필요하면 AI를 부르지 말고 `기준문구/홍보글_채널별_{케이크,라테}.json`을 쓴다.
- 결과는 실제 출력으로만 판단한다. 공유하지 않기로 한 문서는 `outputs/내부문서_로컬/`(git 제외)에 둔다. 공유 문서에 검토 안 된 과제(특급 영상·결제)를 넣지 않는다.

## 3. 설치와 `.env.local`

```powershell
git clone https://github.com/son884999-oss/ad
cd ad; git checkout feature/UI-Screen; cd ad_prototype
npx -y pnpm@9.15.9 install      # pnpm 버전을 맞춰야 함
npm run dev                     # http://localhost:5173 (실제 AI)
npm run dev:mock                # http://127.0.0.1:5174 (가짜 AI 답, 키·비용 안 씀)
```

- Node 22 이상. 자동 점검의 Playwright는 Windows의 Microsoft Edge를 쓴다.
- `.env.example`을 복사해 `ad_prototype/.env.local`을 만든다. 키는 서버에서만 읽는다(`VITE_`를 붙이면 브라우저로 새어 나간다. Supabase 공개값만 예외). 바꾼 뒤에는 개발 서버를 다시 켠다.

| 이름 | 무엇 | 없으면 |
|---|---|---|
| `COPA_API_KEY`, `COPA_MODEL` | 기관 Claude(글 1순위). 모델 비우면 `claude-haiku-4` | Gemini로 |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini 무료(글). 무료 등급은 하루 20번 | 앱 기본 문구 |
| `GEMINI_API_KEY_2`, `GEMINI_MODEL_2` | Gemini 유료(글 마지막 대체 + 배경). 모델 `gemini-3.5-flash-lite` | 배경 바꾸기 꺼짐 |
| `GEMINI_IMAGE_MODEL` | 비우면 `gemini-3.1-flash-lite-image` | 기본값 |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 회원가입·서버 저장(관리자 키에는 `VITE_` 금지) | 로그인 "준비 중" |
| `HF_CREDENTIALS`, `VIDEO_ENABLED`, `PREMIUM_ACCESS_CODE`, `DAILY_PAID_LIMIT` | 폐기한 특급 영상용 — **비워 둔다** | — |
| `ALLOWED_ORIGINS` | 직접 연결한 도메인이 있을 때만 | — |

- 유료 키는 첫 Gemini 키가 **실패할 때만** 쓰인다. 첫 키를 비우면 유료 키도 안 쓴다.
- 새 컴퓨터로 넘어가지 않는 것: `.env.local`, `outputs/` 전체(`outputs/.gemini-key2-usage.json` = 유료 키 하루 장부, `outputs/내부문서_로컬/`), 클로드 개인 메모리.

## 4. 점검 명령 (바꾼 뒤에는 꼭)

개발 서버(5173)를 켠 상태에서 `ad_prototype/`에서 돌린다. 모두 가짜 AI 응답이라 비용이 들지 않는다.

```powershell
npx tsc --noEmit -p .
npm run build
npm run verify:ai; npm run verify:video; npm run verify:easy; npm run verify:records; npm run verify:photo
npm run verify:promo; npm run verify:guard; npm run verify:scene; npm run verify:background; npm run verify:auth
$env:REFERENCE_REBUILD_OUTPUT="$env:TEMP\rebuild"; node scripts/verify-reference-rebuild.mjs
npm run audit:screens -- --shots "$env:TEMP\audit"
npm run eval:poster -- http://127.0.0.1:5173/ --layout vertical --out "$env:TEMP\poster-v"
npm run eval:video -- http://127.0.0.1:5173/ --out "$env:TEMP\video"
npm run eval:promo; npm run eval:promo -- --local
```

연달아 돌리면 `verify:video`가 한 번 시간 초과될 수 있다(단독으로 다시 돌리면 통과). 품질 기준: `.claude/skills/hongboitda-quality/SKILL.md`, [비용_품질_출처.md](비용_품질_출처.md) 3절.

## 5. 배포 (Vercel)

1. 프로젝트 루트 디렉터리 `ad_prototype`. 환경 변수는 3절 표와 같은 이름으로 **Production과 Preview 둘 다**. `VITE_` 값은 빌드 때 들어가므로 바꾸면 Redeploy.
2. 순서: `feature/UI-Screen` 미리보기 배포 → 폰으로 확인 → PR로 `main` 병합(사용자) → 운영 배포.
3. 보호 장치(코드에 있음): 주소마다 분당 3번, 유료 하루 상한, `VIDEO_ENABLED=1` 없으면 유료 영상 없음. 서버 인스턴스마다 따로 세는 느슨한 상한이라, 공개 전에는 Vercel Firewall에 `/api/*` 속도 제한을 추가하고 Google Cloud 결제 예산 알림을 건다(알림만 하고 막지는 않음).
4. 발표·시연 당일: 하루 상한을 올리고, 미리 한 번 만들어 보고, 와이파이를 확인한다. 실패하면 원래 사진과 기본 문구로 결과가 나온다(화면이 멈추지 않음).

## 6. 회원가입 설정 (끝남, 다시 할 때만)

**상태(10-21):** 이메일·카카오·Google 모두 켜짐, 실제 로그인 확인. 구글은 앱이 '테스트' 상태라 **테스트 사용자로 넣은 계정만** 로그인된다. 코드: `src/auth.ts`, `src/cloudRecords.ts`, `api/account-delete.js`, 점검 `npm run verify:auth`.

1. **Supabase**(Region Seoul, Free): Project URL → `VITE_SUPABASE_URL`, Publishable key → `VITE_SUPABASE_ANON_KEY`, Secret key → `SUPABASE_SERVICE_ROLE_KEY`(절대 공개 금지). SQL Editor에 `docs/supabase/schema.sql` 실행("destructive" 경고는 `drop policy if exists` 때문이라 괜찮음). Email 켜기(QA 동안 Confirm email 끔). URL Configuration: Site URL = 운영 주소, Redirect URLs = `http://localhost:5173/**`, `https://*.vercel.app/**`.
2. **카카오**(2025 콘솔): 앱 → 플랫폼 키 → **REST API 키** 화면 안에 리다이렉트 URI `https://<프로젝트>.supabase.co/auth/v1/callback`과 클라이언트 시크릿이 있다. 카카오 로그인 ON. 동의항목 닉네임·사진·**이메일**(없으면 KOE205 오류). 이메일은 비즈 앱만 되므로 "개인 개발자 비즈 앱 전환" 뒤 선택 동의로. Supabase Kakao에 키·시크릿, "Allow users without an email" 켬. 사이트 도메인에 localhost와 Vercel 주소.
3. **Google**: OAuth consent(External, Test users에 QA 계정) → OAuth client(Web): JavaScript origins = localhost·Vercel 주소, redirect = Supabase callback → Supabase Google에 입력.
4. 확인: 이메일 가입 → 메뉴에 이메일이 보임 → 홍보물을 만들면 Table Editor `records`와 Storage `records`에 생김 → 다른 브라우저에서도 보임 → 회원 탈퇴하면 지워짐.
