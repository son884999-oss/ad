# Documentation Index

## Current policy

**현재 검증된 구조를 유지하되, 추가 교수님 피드백과 사용자 요청에 따라 변경한다.**

| Document | Purpose |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Environment and task entrypoint |
| [DESIGN_MAINTENANCE.md](../DESIGN_MAINTENANCE.md) | Current maintenance rules and scope |
| [Design principles](design/DESIGN_PRINCIPLES.md) | Concise shared visual and accessibility criteria |
| [Brand guide](../public/assets/branding/selected/BRAND_GUIDE.md) | Selected logo variants, colors, and usage |
| [Local preview](LOCAL_PREVIEW.md) | Running and viewing the app |
| [Project organization](PROJECT_ORGANIZATION.md) | Folder layout and restoration paths |

## Feedback

| Record | Purpose |
| --- | --- |
| [Professor feedback](../feedback/2026-10-12-professor-uiux-feedback.md) | Original feedback analysis and preserved reference images |
| [Mobile implementation](../feedback/2026-10-12-uiux-implementation.md) | Bottom navigation and result-tab implementation and verification |
| [Design maintenance](../feedback/2026-10-12-design-maintenance.md) | Visual refinements and pinned read-aloud/result controls |
| [Mobile reference implementation](../feedback/2026-10-12-mobile-reference.md) | Create/Menu separation, focused results, photo changes, and filtered records |
| [통합 체크리스트](../feedback/2026-10-12-integrated-checklist.md) | 교수·멘토링 요구사항의 실제 판정과 사용자 요금·무료 사용량 가안 |
| [크레딧 정책 조사](../feedback/2026-10-12-credit-policy-research.md) | 타사 공식 정책, 사용자 선택, 원가 확인 전 아이디어 및 향후 점검 순서 |
| [샘플 완성 후 홈 구성 방향](../feedback/2026-10-13-future-home-direction.md) | 만들기·3단계 안내 중심의 전면과 순환 샘플 카드 배경에 대한 사용자 후속 계획 |
| [Google Flow 영상 샘플 방향](../feedback/2026-10-13-video-sample-direction.md) | 샘플 제작 도구 후보와 향후 영상 API 개발 범위의 구분 |
| [Holy Korea 차용 후보](../feedback/2026-10-13-holy-korea-reference-review.md) | 실제 모바일·데스크톱 관찰을 근거로 정리한 교수 상의용 디자인 후보, 미적용 |
| [교수 상담용 한 장 문서](review/professor-consultation-20261013.pdf) | 현재 화면·검증 결과·향후 카드 순환 홈·상담 질문을 담은 출력용 PDF |
| [결과 UI 통합·휴리스틱 검토](../feedback/2026-10-14-result-consistency-heuristic-review.md) | 공통 미리보기·저장/복사 배치, 14개 화면 조합 검증과 남은 문제 |
| [더블다이아몬드 통합 사용성 검토](../feedback/2026-10-14-double-diamond-usability-review.md) | 전체 과업의 일관성·입력 보존·메뉴·재생 동작 개선과 실제 참가자 검증 과업 |
| [최신 교수 체크리스트 검증](review/2026-10-13-professor-review.md) | 원본 86개 식별자의 검증 범위별 판정과 실제 화면·검사 자료 |

New feedback belongs in `feedback/`. Keep the source message analysis and reference images separate from implementation conclusions.

## Historical records

Use the [archive index](archive/README.md) only when historical context is needed. Previous phase instructions are preserved, labeled as historical, and excluded from the default maintenance reading path.

Document moves are recorded in `document-moves.json`. `scripts/document-paths.mjs` at the app root resolves legacy checkpoint paths. The formerly misspelled `HASE4B_MASTER.md` is now archived as `docs/archive/PHASE4B_MASTER.md`.

Local evidence links under `ui-review/` and restoration folders may refer to untracked files. They are not public deployment URLs or proof of current validation.
