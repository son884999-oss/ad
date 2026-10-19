# 홍보잇다 문서 — 여기부터 읽기

사람도 클로드 코드도 **이 문서부터** 읽는다. 나머지 문서는 아래 "문서 지도"에서 필요할 때만 연다.
마지막 갱신: 2026-10-20 · 브랜치 `feature/UI-Screen` · 앱은 `ad_prototype/`(Vite + React, Vercel 함수 `api/`)

## 1. 지금 상태

- 소상공인이 **사진 한 장**으로 포스터·6초 영상·홍보 글을 만드는 모바일 웹앱. PC에서도 휴대폰 틀 안에 모바일 화면이 나온다.
- 흐름(C안): 사진 → "배경을 광고 사진처럼 바꿀까요?" 팝업(Gemini `gemini-3.1-flash-lite-image`, 장당 약 50원, 실패·상한이면 원래 사진) → 정보 입력 → 결과(포스터·영상·홍보 글).
- 글 AI 순서: 기관 Claude(COPA) → Gemini 무료 → Gemini 유료(하루 500원) → 앱 기본 문구.
- 영상: 기본형 모션 영상(MP4로 변환, 업종별 클래식 배경음). 회원가입: 카카오·Google·이메일(Supabase), 로그인하면 내 홍보물을 서버에 저장.
- 2026-10-20: 결과 화면 재설계 끝남(영상 즉시 생성, 큰 포스터, 채널별 글, 탭 위 "3가지를 만들었어요 n/3" + [다음 ▶]). UX 점검(하위 모델) 반영: 크기 고른 뒤 버튼 유지·✓ 표시, 로딩 안내 15초, 내 홍보물은 한 번 만든 것을 **카드 1장**으로(필터 없앰), 쉬운 화면 [화면 설명 듣기] → 머리줄 [듣기]. 자세히: [진척사항/진척사항_2026-10-20.md](진척사항/진척사항_2026-10-20.md)
- 2026-10-20 밤: [UX-후속-1021] 처리 — 화면 설명 듣기는 원래 긴 막대로 유지, [스토리·쇼츠] 포스터 미리보기 높이 상한, [다른 말로 바꾸기] 없앰(채널마다 문구 1개, 서버 AI 예산 11→20초), 고르기 칩·버튼 일관성 반영, 사진 입력 화면은 조사만 하고 논의 대기. 이메일 가입·로그인은 Supabase 연동 완료(카카오·Google 등록만 남음). `feature/UI-Screen`을 `main`에 병합함.
- 마지막 점검(10-20): tsc · build · verify 10종 · 화면 35개 재현 · audit:screens 문제 0 (마지막 수정 뒤 직접 흐름 확인: 결과까지 약 14초, 오류 없음). `verify:records`도 카드 1장 구조로 수정해 통과(5개).

## 2. 다음 할 일

- **내일(10-21):** 사용자 — 카카오·Google 로그인 등록이면 회원가입 끝. 클로드 — 남은 일관성 항목, 사진 입력 화면(논의 후). 자세히: [나중에_할일.md](나중에_할일.md)의 [UX-후속-1021].
- **사용자(계정 필요):** 카카오·Google 로그인 등록 → Vercel 환경 변수 → 미리보기 배포 → 배포 주소를 Supabase·카카오·Google에 등록 → 휴대폰 확인 → QA 전달. [회원가입_설정안내.md](회원가입_설정안내.md) · [배포_체크리스트.md](배포_체크리스트.md)
- **결과화면 후속:** 휴대폰 음성 인식 확인, 숨긴 고급형·특급 화면 PC 복원 논의(제안: PC에선 결과 3개를 탭 없이 나란히), 탭 2안 여부 — [나중에_할일.md](나중에_할일.md)의 [결과화면-재설계].
- **UX 점검 남은 것(사용자 결정: 유지):** 결정당 선택지 3개 기준은 지금 충족, 메뉴·하단 탭 이중 유지, 기본·쉬운 용어 다름 유지, 분위기 5개 유지. 하위 모델에 맡길 것: 16px 미만 글씨·작은 터치 영역 손보기.
- **작업 방식:** 간단한 작업(검색·점검 스크립트 수정·문서 정리)은 하위 모델(Sonnet)에게, 설계 판단과 검토는 메인 모델이.
- **클로드가 이어서:** 배포 미리보기에서 처음부터 끝까지 확인 · 업종별 배경 시험(샴푸·화장품·떡·안경·이어폰, 장당 약 50원, **쓰기 전 [디자인개선_루프.md](디자인개선_루프.md) "호출 사용량"에 먼저 기록**).
- **보류:** [특급], [결제] (테스트 모드까지), [제품합성], [인공지능표시] 등 — 사용자가 이름표로 부르면 [나중에_할일.md](나중에_할일.md)의 그 항목대로.

## 3. 처음 설치와 `.env.local`

```powershell
git clone <저장소 주소> ad
cd ad
git checkout feature/UI-Screen
cd ad_prototype
npx -y pnpm@9.15.9 install      # pnpm 버전을 맞춰야 함
npm run dev                     # http://localhost:5173
```

- Node 22 이상(24.x로 작업). 자동 점검은 Playwright가 Windows 기본 **Microsoft Edge**를 쓴다. ffmpeg는 앱 실행에 필요 없다(음원 편집용).
- `.env.example`을 복사해 `ad_prototype/.env.local`을 만들고 값을 넣는다. **값은 채팅·문서·커밋에 붙이지 않는다. 클로드는 이 파일을 읽거나 출력하지 않는다.**

| 이름 | 무엇 | 없으면 |
|---|---|---|
| `COPA_API_KEY` | 기관 Claude (글 1순위) | Gemini로 대체 |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini 무료 (글) | 앱 기본 문구 |
| `GEMINI_API_KEY_2`, `GEMINI_MODEL_2` | Gemini 유료 (글 대체 + 배경 바꾸기) | 배경 바꾸기 꺼짐 |
| `GEMINI_IMAGE_MODEL` | (선택) 배경 모델, 비우면 `gemini-3.1-flash-lite-image` | 기본값 |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 회원가입·서버 저장 | 로그인 "준비 중" |
| `HF_CREDENTIALS`, `VIDEO_ENABLED`, `PREMIUM_ACCESS_CODE` | 특급 영상(보류) | 비워 둠 |

**새 컴퓨터로 넘어가지 않는 것:** `.env.local`(위 표대로 다시 만듦) · `outputs/` 전체(git 제외; 특히 `outputs/내부문서_로컬/`은 공유하지 않기로 한 문서, `outputs/.gemini-key2-usage.json`은 유료 키 하루 장부) · 클로드 개인 메모리(중요한 규칙은 `CLAUDE.md`에 있음). 내부 테스트용 홍보 문구는 `기준문구/홍보글_채널별_{케이크,라테}.json`을 쓴다(AI를 다시 부르지 않는다).

## 4. 점검 명령 (바꾼 뒤에는 꼭)

개발 서버(`npm run dev`, 5173)를 켠 상태에서, `ad_prototype/`에서:

```powershell
npx tsc --noEmit -p .
npm run build
npm run verify:ai; npm run verify:video; npm run verify:easy; npm run verify:records; npm run verify:photo
npm run verify:promo; npm run verify:guard; npm run verify:scene; npm run verify:background; npm run verify:auth
$env:REFERENCE_REBUILD_OUTPUT="$env:TEMP\rebuild"; node scripts/verify-reference-rebuild.mjs
npm run audit:screens -- --shots "$env:TEMP\audit"
npm run eval:poster -- http://127.0.0.1:5173/ --layout vertical --out "$env:TEMP\poster-v"
npm run eval:poster -- http://127.0.0.1:5173/ --layout editorial --out "$env:TEMP\poster-e"
npm run eval:video -- http://127.0.0.1:5173/ --out "$env:TEMP\video"
npm run eval:promo; npm run eval:promo -- --local
```

유료 AI는 점검에서 부르지 않는다(가짜 응답). 전부 연달아 돌리면 `verify:video`가 한 번 시간 초과될 수 있다 — 단독으로 다시 돌리면 통과. 품질 기준과 눈으로 볼 것: `.claude/skills/hongboitda-quality/SKILL.md`.

## 5. 규칙 요약 (전체는 저장소 맨 위 `CLAUDE.md`)

- 응답은 한국어. 간단한 작업은 작은 모델(하위 에이전트)에 맡겨도 된다.
- `.env.local`을 읽거나 출력하지 않는다. 키 값은 절대 출력하지 않는다.
- 푸시는 `feature/UI-Screen`만. `main` 병합과 Vercel 설정은 사용자가 직접. 팀 폴더 `A_*`~`F_*`는 읽기만.
- **유료 호출**(Gemini 그림, Higgsfield)은 사용자가 정한 예산·횟수 안에서만, **쓰기 전에** [디자인개선_루프.md](디자인개선_루프.md) "호출 사용량"에 적고 커밋한다. 실패해도 자동 재시도 금지.
- 결과는 실제 출력으로만 판단한다. 공유하지 않기로 한 문서는 `outputs/내부문서_로컬/`에 둔다.

## 6. 문서 지도

| 문서 | 무엇 | 언제 여나 |
|---|---|---|
| `../../CLAUDE.md` | 클로드용 규칙·현재 방향 | 세션 시작(자동으로 읽힘) |
| [나중에_할일.md](나중에_할일.md) | 보류 목록(이름표 [특급] [결제] 등) | 사용자가 이름표로 부를 때 |
| [진척사항/](진척사항/) | 날짜별 기록 10-15~10-20 (최신: 10-20, C안 결정 배경: 10-18 6-00절) | 결정 이유·지난 흐름이 궁금할 때 |
| [디자인개선_루프.md](디자인개선_루프.md) | 품질 개선 바퀴 기록 + **유료 호출 사용량 장부** | 유료 호출 전 반드시 |
| [배포_체크리스트.md](배포_체크리스트.md) | 배포 절차 | 배포할 때 |
| [회원가입_설정안내.md](회원가입_설정안내.md) | 카카오·Google·Supabase 설정 | 로그인 설정할 때 |
| [supabase/](supabase/) | DB 설정 SQL | 서버 저장 설정할 때 |
| [기술문서/](기술문서/) | 팀 공유 기술문서(2장) | 팀원에게 설명할 때 |
| [기술설계서_통합본/](기술설계서_통합본/) | 교수님 제출본(6장, `통합본_만들기.mjs`로 재생성) | 제출할 때 |
| [서비스흐름도/](서비스흐름도/) | 서비스 흐름도 png/html | 전체 흐름 볼 때 |
| [기준문구/](기준문구/) | 내부 테스트용 홍보 문구 JSON | 테스트에 문구가 필요할 때 |
| [라이선스/음원.md](라이선스/음원.md) | 배경음 출처·라이선스 | 소리를 바꿀 때 |
| [품질개선_로드맵.md](품질개선_로드맵.md) | 미룬 개선 우선순위 | 큰 개선을 계획할 때 |
| `../인수인계서.md` | 맨 위 절(00)이 최신 인수인계, 아래는 10-14~15 옛 기록 | 옛 결정을 찾을 때 |
| `../README.md` | 앱 실행·AI 키 설정·팀 모듈 통합 현황 | 앱 구조를 처음 볼 때 |
| `../../.claude/skills/hongboitda-quality/SKILL.md` | 결과물 품질 기준·점검 명령 | 포스터·영상·글을 고칠 때 |
| [시작안내.md](시작안내.md) | 이 문서로 옮겨진 옛 이름(링크 유지용) | 열 필요 없음 |
| [archive/](archive/) | 끝난 작업 보관(자동작업_프롬프트, 옛 PHASE 문서, PC 스타일) | 옛 맥락이 필요할 때만 |
| [design/pc-redesign-plan.md](design/pc-redesign-plan.md) | 참고(오래됨): PC 재설계 계획, 모바일 전용으로 보류 | 거의 안 열어도 됨 |
| `review/` | 참고(오래됨): 10-13~14 화면 검토 증거·교수 상담 PDF | 거의 안 열어도 됨 |
| `document-moves.json` | 옛 문서 이동 기록(`scripts/document-paths.mjs`가 사용) | 건드리지 않는다 |
