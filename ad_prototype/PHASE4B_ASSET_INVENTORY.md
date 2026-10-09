# 홍보잇다 Phase 4-B — 에셋 목록

창작 단위는 **로고 구성 8개 + 목적이 다른 삽화 12개 = 20개**다. PNG→WebP 변환, 640/960px 크기, favicon·터치 PNG를 중복 합산하지 않는다. 승인한 C안 로고의 7개 기존 구성에 세로 조합을 추가해 완성했고, 삽화 12개는 이번 단계에서 새로 생성했다.

## 로고 구성

저장 폴더: `public/assets/branding/selected/`.

| ID | 파일 | 용도·통합 |
|---|---|---|
| B01 | horizontal.svg | 기본 가로 조합, 모든 작업 헤더·메뉴의 `BrandLogo` |
| B02 | primary-stacked.svg | 심볼 위·한글 아래의 세로 기본 조합, 로그인 |
| B03 | wordmark.svg | 정확한 한글 윤곽, 푸터 |
| B04 | symbol.svg | 컬러 심볼, 브랜드 라이브러리·사용 기준 |
| B05 | symbol-mono.svg | 단색 심볼, 단색 매체용 배포본·라이브러리 |
| B06 | symbol-reverse.svg | 어두운 면의 단색 심볼, 배포본·라이브러리 |
| B07 | horizontal-reverse.svg | 어두운 면의 가로 조합, 배포본·라이브러리 |
| B08 | icon.svg | 정사각 아이콘, favicon·180px 터치 아이콘의 원본 |

읽어야 하는 한글은 이미지 생성에 맡기지 않았다. Noto Sans CJK KR Bold의 홍·보·잇·다 윤곽이며 `FONT-LICENSE.txt`에 저작권과 SIL OFL을 보관한다. 브랜드 변형을 모든 제품 화면에 억지로 노출하지 않고 밝은/어두운 매체·아이콘·글자 중심 배치 목적에 맞춰 제공한다.

## 서비스 삽화

배포 폴더: `public/assets/illustrations/phase4b/`. 원본과 실제 프롬프트: `design-assets/illustrations/phase4b/`.

| ID | 배포 파일 | 설명 | 실제 React 적용 |
|---|---|---|---|
| I01 | service-hero.webp | 사진 입력→포스터·영상·글의 큰 결과 창, 매장, 작은 성인 1명 | `StudioHome` 대표 장면 |
| I02 | service-poster.webp | 사진에서 포스터 구성으로 | 홈 ‘이미지 만들기’ |
| I03 | service-video.webp | 제품 영상과 편집 타임라인 | 홈 ‘동영상 만들기’ |
| I04 | service-copy.webp | 사진·제품 정보에서 글 구성으로 | 홈 ‘홍보 글 만들기’ |
| I05 | workflow-photo.webp | 기기의 사진 목록에서 한 장 선택 | 홈 1단계, `PhotoStep` 사진 선택 |
| I06 | workflow-details.webp | 선택 사진 옆에 설명 입력 | 홈 2단계. 입력 화면은 중복 이미지를 생략해 실제 입력란을 우선 |
| I07 | workflow-results.webp | 포스터·영상·글 세 결과 확인 | 홈 3단계 |
| I08 | workflow-channel.webp | 매장 홍보물을 저장한 뒤 목적지에 수동 업로드 | `ChannelPicker` 선택 사항 안내 |
| I09 | records-empty.webp | 비어 있는 홍보물 보관함과 첫 생성 | 내 홍보물 빈 상태 |
| I10 | guide-save.webp | 만든 파일을 기기 폴더에 저장 | `PublishingGuide` 저장 후 안내 |
| I11 | guide-copy.webp | 글·검색어를 클립보드로 복사 | 홍보 글 결과의 복사 안내 |
| I12 | result-complete.webp | 세 홍보물이 준비된 완료 상태 | 결과 요약 |

삽화는 내장 `image_gen`으로 각각 별도 요청했다. 편집 가능한 SVG 원본이라고 표현하지 않는다. 실제 배포 파일은 WebP이고 PNG 원본을 보존한다. 히어로 640px 버전은 응답형 전송용이며 별도 창작물로 세지 않는다.

삽화 속 줄·사각형은 실제 UI 글자를 대신하지 않는 설명용 모양이다. 실제 버튼·단계·다운로드·선택 정보는 React의 읽을 수 있는 한국어로 제공한다. 주변 설명과 내용이 겹치는 작은 삽화의 alt는 비워 반복 읽기를 줄이고, 대표 장면에는 의미를 설명하는 alt를 제공한다.

용량·치수·alpha·원본 SHA-256의 실제 값은 `public/assets/illustrations/phase4b/asset-manifest.json`을 기준으로 한다. 실제 화면에서 12개 삽화가 모두 표시되는지는 `scripts/verify-phase4b.mjs`에서 확인한다. 파일 존재만으로 통합 완료를 판단하지 않는다.
