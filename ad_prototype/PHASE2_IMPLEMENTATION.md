# 홍보잇다 Phase 2 구현 결과

완료일: 2026-10-09. `AGENTS.md`, `DESIGN_MASTER.md`, `PHASE1_PRODUCT_AUDIT.md` 전체를 읽고 이번 Phase 2 요청의 실제 구현 범위를 적용했다. 기존 사용자 수정 문서는 변경하지 않았다.

## 구현한 내용
- ‘홍보잇다’를 홈페이지·내비게이션·로그인 화면·푸터·브라우저 제목·주요 metadata에 유지.
- 첫 진입을 홈페이지로 변경. 대표 행동을 사용 안내보다 앞에 배치하고 로그인 체험은 메뉴에서 접근 가능하게 유지.
- 민트·피치·하늘색 배경, 남색 글자, 짙은 세이지 버튼의 디자인 토큰과 반응형 컴포넌트 적용.
- 기본 추천 3개: 네이버 스마트플레이스 → 카카오톡 채널 → 인스타그램. 실제 초기 선택은 ‘파일만 저장하기’.
- 사진 중심·설명 중심·동네 서비스 업종별 추천 순서 전환. 네이버 블로그·당근·유튜브·기존 엑스·쓰레드는 추가 선택지.
- 채널별 문구와 수동 업로드 안내. 유튜브를 골랐지만 영상 결과가 없을 때 필요한 다음 행동 안내.
- native radio·키보드 방향키·큰 label 선택 영역. 추천 변경이 사용자 선택을 덮어쓰지 않음.
- 모든 채널의 수동 검색어·기록·초안 복원 보존.
- 공식 imagegen 내장 도구로 원본 4종 제작, 홈페이지/안내/빈 기록/결과에 React 통합.
- 결과 미리보기·PNG 저장·MP4/WebM 생성·복사·영상 재생/정지·취소·오류 복구·음성 상태 기능 유지.
- 빈 기록에 ‘첫 홍보물 만들기’ 행동 추가.

## 주요 산출물
| 내용 | 파일 |
|---|---|
| 채널 비교·순위·비용/API 제약·Phase 3 | [PHASE2_PLATFORM_STRATEGY.md](PHASE2_PLATFORM_STRATEGY.md) |
| 브랜드·토큰·컴포넌트·반응형 명세 | [PHASE2_DESIGN_SYSTEM.md](PHASE2_DESIGN_SYSTEM.md) |
| 제작 전 자산 계획 | [PHASE2_ASSET_PLAN.md](PHASE2_ASSET_PLAN.md) |
| 최종 생성 프롬프트 | [prompts.json](design-assets/illustrations/prompts.json) |
| 원본 PNG 4종 | `design-assets/illustrations/` |
| 배포 WebP 5개(모바일 hero 포함) | `public/assets/illustrations/` |
| 크기·용량 기록 | [asset-manifest.json](public/assets/illustrations/asset-manifest.json) |
| 채널 설정·추천 데이터 | [channels.ts](src/channels.ts) |
| 채널 선택·결과 다음 단계 | [ChannelPicker.tsx](src/ChannelPicker.tsx), [PublishingGuide.tsx](src/PublishingGuide.tsx) |
| 공통 토큰 | [design-tokens.css](src/design-tokens.css) |

원본 스타일은 동일한 성인 사장님과 제품을 사용하는 Corporate Flat Vector Illustration이다. 결과물은 투명 배경 raster이며 SVG 원본으로 표시하지 않는다. 모바일 hero 59,646 bytes, 기본 hero 100,670 bytes, 단계 이미지는 각각 24,032–32,646 bytes다. 배포 시 원본 PNG를 다운로드하지 않는다.

## 실행 검증
Windows의 Playwright + headless Edge(Chromium)에서 확인했다.

| 명령 | 확인한 범위 | 결과 |
|---|---|---|
| `npm run build` | Vite 8 production build | 통과 |
| `node node_modules/typescript/bin/tsc --noEmit` | TypeScript 타입·구문 | 통과 |
| `node scripts/verify-phase2.mjs` | 320/390/768/1024/1280/1440px × 일반/간편, 9개 채널, 업종 추천, native radio, 복사, 검색어 보존, 초안 복원, alpha, 대비 | 통과 |
| `node scripts/verify-ui.mjs` | 결과 화면 10개 설정, 3가지 형식, 입력 검증, 포커스, 복사, 실제 PNG·영상 파일 다운로드 | 통과 |
| `node scripts/verify-studio.mjs` | 320/390/1440px 홈·메뉴·키보드·로그인/회원가입 체험·비밀번호 표시·요금제 | 통과 |
| `node scripts/verify-readability.mjs` | 좁은 화면 3종, 긴 한글·이모지, Canvas 줄바꿈, 입력 중 하단 메뉴, 낮은 화면 | 통과 |
| `node scripts/verify-native-zoom.mjs` | 실제 브라우저 100%/200% 확대, PNG 저장, 수동 검색어, 재생, 되돌리기·기록 복원 | 통과 |
| `node scripts/verify-recovery.mjs` | 손상/초과/잘못된 파일, 비동기 선택 경합, 음성 상태 mock | 통과 |
| `oxfmt --check` | 변경 TS/TSX와 신규 자산·Phase 2 검증 스크립트 | 통과 |

초기 회귀 실행에서 결과 전환 직후 검사 타이밍 문제가 나타나 `.result-grid`를 기다린 뒤 검사하도록 보완했다. 프로젝트의 기존 formatter가 inline type 구분자를 잘못 출력한 부분은 이름 있는 type으로 분리한 뒤 타입 검사와 build를 다시 통과했다.

실제 캡처를 열어 홈 390/1440px, 모바일 채널 선택, 1440px 결과 카드 화면을 검토했다. 이미지·시각 검토 자료와 JSON은 Git에서 제외되는 `ui-review/`에 저장된다. 새 검증 상세는 `ui-review/phase2/verification.json`에 있다.

주요 텍스트 대비:
| 조합 | 계산 대비 |
|---|---:|
| 본문/바탕 | 12.33:1 |
| 보조 글자/흰 바탕 | 6.31:1 |
| 세이지/민트 | 6.57:1 |
| 남색/하늘색 | 10.46:1 |
| 흰 글자/주요 버튼 | 7.99:1 |
| 오류 글자/오류 배경 | 6.15:1 |

## 검증과 기능의 경계
모바일 폭의 브라우저 검증과 실제 휴대전화 검증은 다르다. iOS Safari·Android 실기기, 실제 스크린리더 사용, 사람의 음성 청취, 외부 서비스 계정에서 게시 성공 여부는 확인하지 않았다. 음성 검증 일부는 상태 mock이다. 대비 검사는 주요 토큰 조합이며 전체 WCAG 인증이 아니다.

외부 계정 연결·자동 게시·결제·실제 AI 생성·영구 기록 저장은 새로 구현하지 않았다. 현재 영상은 약 3초의 사진 기반 예시다. 새 채널 선택은 규칙 기반 문구와 안내를 제공하며 각 플랫폼의 업로드 규격을 자동으로 검증하거나 모든 플랫폼에서 파일 수용을 보장하지 않는다.

런타임 의존성·Vite 설정·pnpm lockfile을 변경하지 않았다. 자산 최적화도 기존 Playwright를 사용한다. 기존 서버가 없음을 확인한 뒤 단일 Vite 서버를 5173에서 실행했다. 외부 배포나 자동 게시를 수행하지 않았다.

## Phase 3의 구체적인 완료 조건
1. **출력 품질 통합**: HTML 미리보기와 Canvas 출력의 템플릿 일치, 제품별 실제 정보 입력, 채널별 파일 비율·길이·포맷 검증을 fixture로 확인.
2. **데이터 안정성**: 새로고침 후 작업 복구, 이미지 용량 제한과 저장 실패/삭제/만료 처리, 계정 연결 여부에 따른 기록 안내.
3. **시니어 실사용**: 실제 휴대전화로 사진 선택→설명→저장→수동 게시까지 관찰하고 첫 행동 이해·완료·도움 요청을 기록.
4. **선택적 연동**: 인증·권한·API 지원이 확인된 플랫폼만 서버 측 token 관리, 취소, 게시 전 확인을 갖춰 도입. 사용자 동의 없이 계정·게시·메시지 작업을 실행하지 않음.

