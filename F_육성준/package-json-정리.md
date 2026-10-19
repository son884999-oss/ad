# package.json 비교 정리

조사 대상 (node_modules 제외, 총 6개)

| 위치 | name | 용도 |
|---|---|---|
| `ad_prototype/` | figma-make-app | 통합 UI 프로토타입 (React 19 + Vite 8) |
| `ad_prototype/design-assets/branding/tooling/` | (없음) | 브랜딩 폰트 처리 도구 |
| `A_손용범/` | ai-promo-video | AI 홍보 영상 생성 스크립트 (Node) |
| `C_김만복/` | ai-small-business-promo-studio | 홍보 스튜디오 UI (React 18 + Vite 5) |
| `D_고혜숙/` | hongbo-itda-poster-module | 포스터 모듈 UI (React 18 + Vite 6 + Tailwind 3) |
| `E_이채원/` | e-video-prompt | 이미지→영상 프롬프트 모듈 (Node, CommonJS) |

> `B_이창훈/`, `F_육성준/` 에는 package.json 이 없음.

---

## 1. 공통사항

### 1-1. 모든(또는 대부분) 패키지 공통

| 항목 | 값 | 적용 대상 |
|---|---|---|
| `private` | `true` | tooling 제외 전부 |
| `type` | `"module"` (ESM) | ad_prototype, A, C, D (E는 `commonjs`) |
| 런타임 | Node.js | 전부 |

### 1-2. React + Vite 프론트엔드 그룹 (ad_prototype, C, D)

세 패키지는 구조가 같아서 하나로 묶을 수 있음.

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "...",
    "react-dom": "..."
  },
  "devDependencies": {
    "@vitejs/plugin-react": "...",
    "vite": "..."
  }
}
```

### 1-3. Node 스크립트 그룹 (A, E)

- 테스트 러너로 Node 내장 `node --test` 사용
- `.env` 파일을 `node --env-file=...` 로 주입해서 외부 AI API 호출
  - A: `--env-file=.env.local`
  - E: `--env-file=.env`

---

## 2. 버전 충돌 (공통 패키지인데 버전이 다름)

| 패키지 | ad_prototype | A | C | D | 비고 |
|---|---|---|---|---|---|
| react / react-dom | **^19.0.0** | - | ^18.3.1 | ^18.3.1 | 메이저 버전 다름 |
| @types/react(-dom) | ^19.0.0 | - | - | ^18.3.x | |
| vite | **^8.0.5** | - | ^5.4.14 | ^6.0.7 | 3개가 전부 다름 |
| @vitejs/plugin-react | **^6.0.0** | - | ^4.3.4 | ^4.3.4 | |
| tailwindcss | **^4.0.0** (`@tailwindcss/vite`) | - | - | ^3.4.17 (+postcss, autoprefixer) | v3↔v4 설정 방식 완전히 다름 |
| typescript | ^5.7.0 | **^7.0.2** | - | - | |
| @types/node | ^22.0.0 | **^26.6.3** | - | - | |

→ C, D 의 화면을 `ad_prototype` 에 합칠 경우 **React 19 / Vite 8 / Tailwind 4 기준으로 올려야 함**.
특히 D 의 Tailwind 3 설정(`tailwind.config`, `postcss.config`)은 Tailwind 4 방식(`@tailwindcss/vite` 플러그인 + CSS `@import "tailwindcss"`)으로 옮겨야 함.

---

## 3. 패키지별 고유 항목 (따로 뺀 부분)

### ad_prototype (figma-make-app)
- `version`: 1.0.0
- 고유 scripts
  - `verify:*` 15개 (ui, results, usability, cycles, experts, submission, mobile-flow, screen-fit, readability, studio, zoom, recovery, phase2, phase3) → 모두 `node scripts/verify-*.mjs`
  - `assets:optimize`: `node scripts/optimize-illustrations.mjs`
  - `format`: `oxfmt`
- 고유 devDependencies: `@tailwindcss/vite`, `oxfmt ^0.2.0`, `playwright 1.62.1`(고정 버전), `typescript`, `@types/node`

### ad_prototype/design-assets/branding/tooling
- `dependencies` 만 존재: `opentype.js ^2.0.0`
- `name`, `private`, `type` 없음 → 실수로 publish 되지 않게 `"private": true` 추가 권장

### A_손용범 (ai-promo-video)
- `version` 없음
- scripts
  - `check`: `node --check` ×3 + `tsc -p tsconfig.json`
  - `test`: `node --test video.test.mjs`
  - `generate`: `node --env-file=.env.local example.mjs`
  - `seedance`: `tsx --env-file=.env.local index.ts`
  - `product-ad`: `node --env-file=.env.local kling-ad.mjs`
  - `compose-ad`: `node compose-premium.mjs`
- dependencies: `@higgsfield/client 0.2.6` (고정 버전)
- devDependencies: `tsx ^4.23.15`, `typescript ^7.0.2`, `@types/node ^26.6.3`

### C_김만복 (ai-small-business-promo-studio)
- `version`: 0.1.0
- **`vite`, `@vitejs/plugin-react` 가 `dependencies` 에 들어가 있음** → 빌드 도구이므로 `devDependencies` 로 옮기는 것이 맞음
- `devDependencies`: 비어 있음 (`{}`)

### D_고혜숙 (hongbo-itda-poster-module)
- `version`: 1.0.0
- dependencies: `lucide-react ^0.469.0` (아이콘, 다른 패키지에는 없음)
- devDependencies: `tailwindcss ^3`, `postcss`, `autoprefixer`, `@types/react ^18`, `@types/react-dom ^18`

### E_이채원 (e-video-prompt)
- 유일하게 `"type": "commonjs"`, `description`, `main: src/index.js`, `engines: { node: ">=22" }` 지정
- 외부 의존성 없음 (dependencies/devDependencies 없음)
- scripts: `test`(node --test), `examples`, `examples:gemini`(`--env-file=.env --gemini`)

---

## 4. 정리 / 제안

1. **프론트엔드 통일 기준 버전**: ad_prototype 기준 (React 19, Vite 8, plugin-react 6, Tailwind 4, TS 5.7)
2. **C**: `vite`, `@vitejs/plugin-react` → `devDependencies` 로 이동
3. **D**: Tailwind 3 → 4 마이그레이션 필요, `lucide-react` 는 통합 시 ad_prototype 에 추가
4. **A / E**: 독립 Node 모듈이라 그대로 두되, `.env.local` vs `.env` 파일명 규칙 통일 고려
5. **Node 버전**: E 만 `engines` 명시(`>=22`). `--env-file` 옵션은 Node 20.6+ 필요하므로 A 에도 `engines` 추가 권장
6. **TypeScript**: A(^7) 와 ad_prototype(^5.7) 버전이 다름 — 통합 시 한쪽으로 맞추기
7. **tooling**: `"private": true` 추가
