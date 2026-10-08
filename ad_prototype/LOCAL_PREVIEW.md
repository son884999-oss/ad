# 로컬 화면 열기

이 프로젝트의 CSS는 `src/index.css`와 `src/studio.css`에 포함되어 있습니다. CSS용 그래픽 프로그램을 따로 설치할 필요는 없습니다. React·TypeScript·Tailwind를 브라우저가 읽을 수 있는 형태로 변환하는 Vite 실행 과정이 필요합니다.

## Windows에서 가장 간단한 방법

`start-preview.cmd`를 더블클릭하세요. Node.js와 pnpm을 확인하고, 의존성이 없으면 설치합니다. Vite 서버를 시작한 뒤 브라우저를 엽니다. 기존 서버가 있으면 그 서버를 사용합니다. 보통 주소는 `http://127.0.0.1:5173/`입니다. 사용 중인 다른 포트가 있으면 5183까지 빈 포트를 찾습니다.

`index.html`을 더블클릭해 `file:///...` 주소로 열면 모듈과 스타일을 제대로 읽을 수 없습니다. GitHub의 HTML 파일 미리보기 또한 실행 화면이 아닙니다.

## 직접 실행

```powershell
cd "프로젝트 경로\ad_prototype"
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 5173
```

주소를 브라우저로 열고 터미널은 켜 둡니다. 직접 실행한 서버는 Ctrl+C로 종료할 수 있습니다. 시작 파일로 실행한 서버의 로그는 `.preview/`에 저장됩니다. 서버는 해당 컴퓨터의 localhost에서만 접근합니다.

## 배포 파일 확인

```powershell
pnpm build
pnpm preview --host 127.0.0.1
```

출력된 HTTP 주소로 접속하세요. `dist/index.html`도 파일로 직접 열지 않습니다.

## 이번 확인 결과

2026-10-09 개발 서버, `src/studio.css`, `src/StudioScreens.tsx` 응답이 정상(200)이며, 390px 모바일·1440px 데스크톱 실제 렌더링에서 배경색·글꼴·카드·버튼 스타일 적용을 확인했습니다. 캡처는 로컬 `ui-review/studio-home-390.png`, `studio-home-1440.png`에 있습니다.
