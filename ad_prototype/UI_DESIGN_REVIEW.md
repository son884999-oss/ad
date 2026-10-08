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

## 전면 재설계와 로그인 이후 안내

사용자가 기존 화면을 참고로만 삼아 재창조할 것을 요청하여 `StudioScreens.tsx`와 `studio.css`에서 로그인·홈·메뉴 구조를 새로 작성했다. 이후 사용자 지정에 따라 컴퓨터는 왼쪽 퀵바, 모바일은 하단 퀵바로 구성했다. 로그인 직후 첫 화면은 사진→설명→저장 3단계를 바로 보여 주고, 안내 아래 `만들러 가기`로 첫 단계에 연결한다. 1단계의 실제 사진 입력도 설정 선택보다 앞으로 이동했다.

간편모드는 기본 켜짐이며 토글로 변경할 수 있다. 한국어 중심 안내, 큰 글씨, 화면 읽어주기/중지/준비 취소를 유지한다. 로그인·가입 화면 전환, 비밀번호 보기, 이미지/동영상/홍보 글 단독 메뉴, 구독/건당 플랜 선택, 세션 기록, PNG·영상 저장과 복사는 보존한다. 로그인 인증·결제·AI 분석/생성 서버는 기존대로 미연결인 프로토타입이다.

채널 선택은 문구뿐 아니라 예시 이미지·영상의 배경 오버레이, 강조색, 소개 제목에도 반영한다. 실제 생성형 AI 제공자에 채널별 연출을 전달하는 단계는 별도 통합 작업이다.

### 주 디자인 근거: 2000~2020 보존 홈페이지 10건

당시 날짜가 명시된 Web Design Museum의 보존 페이지를 사용했다. 현재 홈페이지를 과거 디자인으로 잘못 표기하지 않는다. 역사 사이트의 메뉴 경계·일관된 탐색 위치·핵심 작업 우선 배치를 주근거로 두며, 파스텔 팔레트는 사용자 요구를 반영한 해석이다. 현대 자료는 접근성·입력 동작의 보조 근거다.

| 역사 자료 | 적용한 해석 |
| --- | --- |
| [네이버 2000](https://www.webdesignmuseum.org/gallery/naver-2000) | 메뉴와 작업 영역의 분명한 구분 |
| [Yahoo 2010](https://www.webdesignmuseum.org/gallery/yahoo-2010) | 고정된 빠른 탐색 영역, 결과의 동등한 열 구조 |
| [PayPal 2000](https://www.webdesignmuseum.org/gallery/paypal-2000) | 로그인·회원가입 행동의 구분 |
| [Skype 2004](https://www.webdesignmuseum.org/gallery/skype-2004) | 처음 시작하는 사용자의 단계 안내 |
| [Google 2002](https://www.webdesignmuseum.org/gallery/google-2002) | 첫 화면에 핵심 행동 집중 |
| [Dropbox 2009](https://www.webdesignmuseum.org/gallery/dropbox-in-2009) | 처음 방문하는 사람에게 서비스 사용 흐름 안내 |
| [MailChimp 2010](https://www.webdesignmuseum.org/gallery/mailchimp-2010) | 소상공인 홍보 작업과 연결된 메뉴·설명 |
| [Canva 2013](https://www.webdesignmuseum.org/gallery/canva-in-2013) | 만들기 목적을 명확하게 제시 |
| [Pinterest 2010](https://www.webdesignmuseum.org/gallery/pinterest-in-2010) | 시각 결과를 독립된 단위로 구분 |
| [Canva 2020](https://www.webdesignmuseum.org/gallery/canva-in-2020) | 작업 종류 선택과 시각적 안내의 결합 |

디자인 해석은 사이트가 동일한 사용자층/기능을 제공한다는 주장이 아니다. 당시의 작은 글씨나 낮은 대비는 복제하지 않는다.

### 추가 검수

로그인 첫 화면은 사용자 추가 요청에 따라 왼쪽 소개·콜라주를 제거하고 메인 로고 아래 로그인 창 한 개로 정리했다. 로그인은 주요 버튼, 회원가입·체험 시작·읽어주기는 보조 행동으로 유지했다. 390/1440px에서 로그인 창 1개, 소개 영역 0개, 로고가 창 위에 위치함, 가로 넘침 없음 및 로그인/가입 전환 검수를 확인했다. 캡처: `ui-review/clean-login-390.png`, `clean-login-1440.png`.

후속 심층 검수에서 아주 긴 특징 문구의 영상 미리보기 오버레이가 재생 버튼을 가리는 문제를 발견했다. 기존 긴 입력 검수는 전체 페이지 넘침을 확인했지만 이 내부 가림까지 확인하지 못했다. 이 항목은 미완료이며 미디어 밖 재생 조작·별도 전체 내용 표시로 개선할 예정이다.

`pnpm verify:readability`: 320/390/768px 긴 무공백 한글·이모지 줄바꿈, 전체 홍보 글 보존, 고객 여러 줄 입력, 입력 포커스 중 하단 메뉴, 420px 낮은 화면을 확인한다. Canvas는 실제 글꼴 폭을 측정해 줄바꿈/마지막 줄 말줄임을 검증한다.

`pnpm verify:studio`: 320/390/1440px에서 로그인/가입 전환, 비밀번호 보기, 로그인 뒤 3단계 안내와 하단 버튼 위치, 간편모드 기본값, 왼쪽/하단 메뉴 전환, 메뉴 키보드 초점·Escape 닫기, 구독/건당 플랜 선택을 확인한다. 읽어주기 버튼 표시를 검사하지만 실제 음성 출력 품질은 기기별 추가 검수 대상이다.

추가 브라우저 검수에서 인스타그램·엑스·쓰레드 선택마다 홍보 글, 이미지 배경 그라데이션, 영상 배경 오버레이가 서로 다른 예시로 구성되는 것을 확인했다. 세 채널의 스타일이 모두 동일한 결과로 고정되지 않는다.

로컬에서 CSS가 깨지는 문제는 [LOCAL_PREVIEW.md](./LOCAL_PREVIEW.md)의 실행 방식으로 확인한다. `start-preview.cmd`가 올바른 Vite 주소를 열며, 기존 서버 연결과 새 서버 시작(별도 5181 포트)을 모두 시험했다.

## 남은 검수

자동검수와 디자이너의 시니어 관점 검토는 실제 시니어 사용자 테스트를 대체하지 않는다. 200% 브라우저 확대·스크린리더·실제 Android/iOS·가상키보드 검수는 추가로 진행해야 한다. 긴 한글/이모지 입력은 위 추가 검수로 확인했다. 모든 접근성 기준 충족을 선언하지 않는다.

시안은 따뜻한 표면색과 진한 글자/버튼을 사용한다. 현재 메뉴의 일부 전문 용어, 브라우저 뒤로가기와 앱 단계 동기화, 임시 기록의 영구 저장은 후속 검토 대상이다. 사용자 요구의 반복 개선은 레퍼런스 재검색과 발견된 문제에 근거해 계속한다.
