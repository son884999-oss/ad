# 모바일·시니어 UI 개선 기록

2026-10-09 기준. GitHub main `b3dbe2f`를 로컬에 받아 `feature/mobile-senior-ui`에서 작업한다. 이 기록은 UI 프로토타입 개선이며 실제 AI 모듈 연결이나 서비스 배포 완료를 뜻하지 않는다.

## 수정 전 레퍼런스 확인

| 외부 자료 | 적용한 디자인 판단 |
| --- | --- |
| [GOV.UK 버튼](https://design-system.service.gov.uk/components/button/) | 저장·복사처럼 행동을 정확히 쓰고 주요/보조 행동을 구분 |
| [USWDS 카드](https://designsystem.digital.gov/components/card/) | 결과 하나마다 제목·설명·미디어·행동의 동일한 구조 |
| [Adobe Express AI 템플릿](https://www.adobe.com/express/create/ai/template-generator) | 만들기→확인→수정/저장 흐름 |
| [Headspace](https://www.headspace.com/meditation) | 친근한 설명과 여유 있는 묶음; 따뜻한 파스텔 표면은 디자인 해석 |
| [Apple 접근성](https://www.apple.com/accessibility/) | 글씨 확대·읽기 기능을 쉽게 찾도록 표시 |
| [W3C 터치 영역](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 최소 기준보다 여유 있는 48px/큰 글씨60px 행동 영역 |

## 검토·검색·수정 순환

1. 사용자 관점 검토에서 결과 2+1, 혼동되는 처음으로/로그아웃, 과밀한 5개 하단 메뉴 확인. 레퍼런스 5건 확인 후 첫 수정: 결과 모바일1열/PC3열, 카드 제목·행동 통일, 하단3메뉴, 파스텔 배경.
2. 수정 뒤 [W3C 글자 확대](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)를 다시 검색. 독립 검토에서 영상 비율/카드 폭/큰 글씨 누락 발견. 두 번째 수정: 영상9:16 유지, 미디어 최대 너비 제한, 3열 시작1440px, 큰 글씨 카드 제목·설명 확대, 하단바 높이 여유.
3. 수정 뒤 [GOV.UK 질문 페이지](https://design-system.service.gov.uk/patterns/question-pages/), [접힌 도움말](https://design-system.service.gov.uk/components/details/), [W3C 입력 설명](https://www.w3.org/WAI/tutorials/forms/instructions/), [제목 구조](https://www.w3.org/WAI/tutorials/page-structure/headings/) 재검색. 세 번째 수정: 결과 이동 시 제목에 초점, 사진 오류/크기 안내, 공백 입력 검증과 부족한 항목 안내, 임시 기록 안내, 홈 이동을 보조 버튼으로 변경.

## 확인 방법

```powershell
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 5173
# 별도 터미널에서
pnpm build
pnpm exec tsc --noEmit
pnpm verify:ui
```

자동 UI 검수는 Playwright와 로컬 Edge를 사용한다. 다른 환경은 `UI_BROWSER_CHANNEL=chrome` 또는 설치된 Playwright 브라우저에 맞춰 스크립트 설정을 조정한다. 포스터 테스트 사진은 저장소의 `D_고혜숙/public/sample-product.png`를 사용한다. API 키와 유료 요청은 필요 없다.

- 320/390/768/1280/1440px, 기본 및 큰 글씨 10조합 검사.
- 3개 결과: 1440px 이상 3열, 나머지1열. 2+1 배열 없음.
- 가로 넘침, 결과 카드 개수·배치, 행동 영역48px 이상 검사.
- 포스터+글 / 영상+글 / 포스터+영상+글 3조합, 사진형식 검증, 공백입력 검증, 결과 초점 이동, 복사 안내, PNG와 영상 다운로드 검사.
- 캡처와 기계적 검수 결과는 로컬 `ui-review/`에 저장하며 Git 제외.

## 계속 확인할 항목

자동검수와 디자이너의 시니어 관점 검토는 실제 시니어 사용자 테스트를 대체하지 않는다. 200% 브라우저 확대·스크린리더·실제 Android/iOS·가상키보드·긴 사용자 입력 검수는 추가로 진행해야 한다. 모든 접근성 기준 충족을 선언하지 않는다.

시안은 따뜻한 표면색과 진한 글자/버튼을 사용한다. 현재 메뉴의 일부 전문 용어, 브라우저 뒤로가기와 앱 단계 동기화, 임시 기록의 영구 저장은 후속 검토 대상이다. 사용자 요구의 반복 개선은 레퍼런스 재검색과 발견된 문제에 근거해 계속한다.
