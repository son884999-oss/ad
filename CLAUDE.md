# 홍보잇다 — Claude 작업 안내

소상공인이 사진 한 장으로 포스터·짧은 영상·홍보 글을 만드는 모바일 웹앱. 앱은 `ad_prototype/`(Vite + React, Vercel 함수 `api/`).
팀원 폴더 `A_*`~`F_*`는 **읽기만** 한다.

## 먼저 볼 문서
- 지금 방향과 결정: `ad_prototype/docs/진척사항_2026-10-18.md` **6-00절(C안)** · 흐름도 `ad_prototype/docs/서비스흐름도/서비스흐름도.png`
- **보류 목록: `ad_prototype/docs/나중에_할일.md`** — 사용자가 "[특급] 넣어 줘", "[회원가입] 하자", "나중에 할 일 ○○"라고 하면 이 문서의 해당 항목을 따른다.
- 인수인계: `ad_prototype/인수인계서.md` 맨 위 절 · 미룬 일: `ad_prototype/docs/품질개선_로드맵.md` · 배포: `ad_prototype/docs/배포_체크리스트.md`
- 결과물 품질 기준과 점검 명령: `.claude/skills/hongboitda-quality/SKILL.md`

## 규칙 (사용자 지시)
- 응답은 한국어.
- `.env.local`을 읽거나 출력하지 않는다. 키 값은 절대 출력하지 않는다(키 확인은 상태·한도만 출력하는 스크립트로).
- 푸시는 `feature/UI-Screen`만. `main` 병합과 Vercel 설정은 사용자가 직접.
- **유료 호출**(Gemini 그림, Higgsfield 영상·장면)은 사용자가 정한 예산·횟수 안에서만. **쓰기 전에** `ad_prototype/docs/디자인개선_루프.md` "호출 사용량"에 먼저 적고 커밋한다. 실패해도 자동으로 다시 시도하지 않는다.
- 내부 테스트에 홍보 문구가 필요하면 AI를 다시 부르지 말고 `ad_prototype/outputs/시연_최고결과물_2026-10-18/{케이크,라테}/홍보글_채널별.json`을 쓴다.
- 결과는 실제 출력으로만 판단한다. 바꾼 뒤에는 tsc·build·`verify:*`(현재 유효한 것)·`audit:screens`·`eval:*`를 돌린다(SKILL.md 5절).

## 현재 방향 (2026-10-19, 구현됨 — `ad_prototype/docs/진척사항_2026-10-19.md`)
- 사진 단계의 [다음으로]에서 팝업 "배경을 광고 사진처럼 바꿀까요?" → 바꾸기면 Gemini(`gemini-3.1-flash-image`) 광고 배경을 입력하는 동안 미리 만듦, 실패·하루 상한이면 원래 사진. 결과에서 "바뀐 사진 / 원래 사진" 고르기.
- 정보 입력 화면은 그대로. 영상은 기본형 모션 영상(`src/motionVideo.ts`), 녹화 뒤 보통 MP4로(`src/mp4Flatten.ts`, 카톡 3초 잘림 방지). 소리는 업종별 클래식 배경음 + 장면 전환 효과음(`src/videoSound.ts`, 출처 `docs/라이선스/음원.md`).
- npm 패키지·플러그인·스킬은 필요하면 추가해도 된다(사용자 방침). 라이선스(AGPL 피함)와 크기만 확인.
- 글 AI 순서: 기관 Claude(COPA) → Gemini 무료 → Gemini 유료(하루 500원) → 앱 기본 문구.
- **보류:** [특급](결과 화면 특급 버튼·시연 코드), [회원가입](Supabase Auth) 등 — `docs/나중에_할일.md`.
