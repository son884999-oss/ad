# 홍보잇다 프로토타입 (ad_prototype)

사진 한 장으로 포스터·짧은 영상·홍보 글을 만드는 웹앱입니다. React 19 + Vite + TypeScript로 만들었고 Vercel에 배포합니다.
`쉬운 화면`(쉬운 모드)이 핵심 기능입니다. ATM의 "쉬운 거래"처럼 쉬운 말, 큰 글씨, 음성 입력, 미리 채운 답을 제공합니다.

> 현재 상태: **1차 MVP**. 아래 [MVP 결정 사항](#mvp-결정-사항-2026-10-15)과 [향후 개선](#향후-개선)을 먼저 읽어 주세요.
> 작업 이력과 디자인 기준은 [인수인계서.md](인수인계서.md)에 있습니다.

## 실행

```powershell
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # dist/
```

- 개발 서버가 `/api/*`를 Vercel 함수와 같은 코드로 처리합니다(`vite.config.ts`의 개발용 플러그인).
- 개발 모드나 주소 뒤에 `?dev`를 붙이면 오른쪽 아래에 화면 전환 툴바(자동 / 모바일 / PC)가 나옵니다.

## AI 키 설정

`.env.example`을 `.env.local`로 복사해서 값을 채웁니다. `.env.local`은 Git에 올라가지 않습니다.
키는 **서버에서만** 읽습니다. `VITE_` 접두사를 붙이지 마세요. 접두사가 붙으면 브라우저로 노출됩니다.
값을 바꾼 뒤에는 개발 서버를 다시 시작해야 합니다.

| 변수 | 용도 | 비워 두면 |
|---|---|---|
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 사진 분석(자동 채우기·사진 검사), 홍보 글, 영상 연출 문장 | 템플릿 결과로 동작 |
| `HF_CREDENTIALS` | Higgsfield 실제 영상 생성 (`KEY_ID:KEY_SECRET`) | 브라우저에서 만든 예시 영상 |
| `HF_VIDEO_MODEL`, `HF_VIDEO_DURATION`, `HF_VIDEO_RESOLUTION` | 영상 모델·길이·해상도 (선택) | MVP 기본값 사용 |

Vercel에서는 **Project → Settings → Environment Variables**에 같은 이름으로 넣습니다.
**주의:** 아래 [공개 배포 전 필수](#공개-배포-전-필수)를 끝내기 전에는 공개 주소에 키를 넣지 마세요.

## MVP 결정 사항 (2026-10-15)

| 항목 | 결정 | 비용(정가) |
|---|---|---|
| 글·사진 분석 | Gemini `gemini-2.5-flash-lite` 무료 키 | 무료 등급. 유료 전환 시 호출 1회당 1원 미만 |
| 포스터 | D_고혜숙 렌더러를 브라우저 Canvas에서 실행(AI 그림 생성 없음) | 무료 |
| 영상 | Higgsfield **Kling 2.5 Turbo Standard**, **720p, 5초, 소리 없음** | 약 $0.21/편(약 290원) |
| 영상 소리·배경음 | 이번에는 넣지 않음 → FFmpeg로 나중에 합성 | — |

- 영상 모델은 720p 이상 기준으로 한 편당 가장 싸고, A_손용범이 실제 유료 생성으로 검증한 모델이라 골랐습니다.
- Higgsfield는 해상도별 가격을 공개하지 않습니다. 위 단가는 제작사·다른 판매처의 공개 가격입니다. 첫 영상을 만든 뒤 Higgsfield 콘솔의 사용 내역으로 실제 청구액을 확인하세요.
- 대안 모델: `HF_VIDEO_MODEL=alibaba/wan-3.0/image-to-video`. 2~30초를 고를 수 있고 소리가 같은 가격에 포함됩니다. 720p 기준 약 $0.10/초입니다. 코드가 Wan 입력 형식을 지원하고 테스트도 있지만, 실제 생성은 아직 해 보지 않았습니다.
- 가격은 자주 바뀝니다. 할인가 변동을 Higgsfield가 알려 주지 않으므로 [가격표](https://open.higgsfield.ai/pricing)를 주기적으로 확인합니다.

## 팀 모듈 통합 현황

| 팀 폴더 | 내용 | 프로토타입 위치 |
|---|---|---|
| A_손용범 | Higgsfield 영상 생성 | `api/_lib/higgsfield.js`, `api/video-*.js` |
| B_이창훈 | 홍보 글 규칙(Claude → Gemini로 이식) | `api/_lib/promo-prompt.js`, `api/_lib/promo.js` |
| C_김만복 | 제품 정보 입력 항목 | 정보 입력 화면(`src/App.tsx`) |
| D_고혜숙 | 포스터 렌더러 | `src/poster/` |
| E_이채원 | 영상 연출 규칙·프롬프트 | `api/_lib/video-prompt.js` |
| F_육성준 | (작업물 없음) | — |

팀 폴더의 원본은 수정하지 않았습니다. 옮겨 온 파일에는 원본 경로를 주석으로 남겼습니다.

## 검증

```powershell
npx tsc --noEmit -p .
$env:REFERENCE_REBUILD_OUTPUT="$env:TEMP\rebuild"; node scripts/verify-reference-rebuild.mjs   # 7개 화면 크기 배치
pnpm verify:ai       # 사진 분석·홍보 글 API (가짜 Gemini 응답)
pnpm verify:video    # 영상 API (가짜 Higgsfield 응답)
pnpm verify:easy     # 쉬운 모드 문구·음성 입력·결과 탭
```

- 검증 스크립트는 `/api/*`를 가짜 응답으로 처리합니다. 그래서 **키가 있어도 실제 비용이나 무료 한도를 쓰지 않습니다.**
- 실제 영상 한 편을 직접 확인하려면 `node scripts/live-video-test.mjs --yes-spend`를 실행합니다. 이때만 유료 요청을 1회 보냅니다. `--yes-spend`를 빼면 요청 없이 연습만 합니다.
- `verify:screen-fit`, `verify:readability`, `verify:mobile-flow`, `verify:ui`는 예전 화면 구조 기준이라 현재 화면에서는 실패합니다. 정리 대상입니다.

## 공개 배포 전 필수

- [ ] `/api/*`에 호출 횟수 제한 추가(IP나 사용자별 하루 N회). 지금은 주소를 아는 누구나 유료 영상을 만들고 Gemini 한도를 쓸 수 있습니다.
- [ ] Higgsfield 콘솔에서 지출 한도 설정
- [ ] Vercel 함수 실행 시간 확인. 영상 시작 요청은 최대 약 35초까지 걸릴 수 있습니다.

## 향후 개선

**영상**
- **소리·배경음 합성(FFmpeg).** A_손용범의 `compose-*.mjs`에 FFmpeg로 한글 문구·효과음을 합성한 시안이 있습니다. Vercel 서버리스 함수에는 FFmpeg가 기본으로 없으므로, 아래 셋 중 하나를 정해야 합니다.
  1. 브라우저에서 `ffmpeg.wasm`으로 합성 (서버 비용 없음, 휴대폰에서는 느림)
  2. 별도 작업 서버나 큐에서 FFmpeg 실행
  3. 소리가 포함된 모델(Wan 3.0 등)로 바꾸기
- **영상 보관.** Higgsfield 결과 주소는 최소 7일만 보장됩니다. 오래 보관하려면 자체 저장소로 복사해야 합니다.
- Wan 3.0 실제 생성 1회로 품질과 청구액 비교
- Higgsfield 가격 변동 확인 자동화

**AI**
- `gemini-3.x` 모델을 쓰려면 thinking 설정이 필요합니다. 지금은 시간 초과나 잘린 응답이 납니다.
- 포스터 배경을 AI로 생성. D 렌더러의 `generatedBackgroundUrl` 자리를 쓰면 되고, Gemini 이미지 모델은 유료입니다(장당 약 $0.034).
- 홍보 글의 상투적 표현 검사 보강("정성껏", "특별한" 등)

**쉬운 모드 (ATM 방식, 제안만 된 것)**
- 화면에 들어가면 자동으로 읽어 주기(첫 동의 후)
- 쉬운 모드 머리말에 `처음으로` 고정
- "이대로 만들까요?" 확인 화면, 저장 후 "카카오톡에 보내 볼까요?" 마무리 화면
- 자동 채우기 결과를 소리로 읽어 주기
- PC 정보 입력 화면의 만들기 버튼 고정

**정리**
- 쓰지 않는 `src/*.css`와 예전 검증 스크립트 정리
- 내 홍보물이 메모리에만 저장됨(새로고침하면 사라짐) → 저장소 연결
