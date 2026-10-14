# C 김만복 — 제품 정보·사진 입력 모듈

## 담당 역할

소상공인이 제품 정보와 관련 사진을 입력할 수 있는 React 기반 입력 화면을 구현했습니다. 입력한 데이터는 이후 AI 홍보문구, 포스터, 광고영상 생성 담당자가 공통으로 사용할 수 있도록 구조화해 전달합니다.

## 현재 샘플 제품

- 제품명: **초이셀 올인원 샴푸**
- 제품 설명: 두피와 모발을 한 번에 관리하는 자연 유래 성분의 프리미엄 올인원 샴푸
- 주요 고객층: 건강한 두피와 모발 관리를 원하는 성인
- 핵심 특징: 올인원 케어, 자연 유래 성분, 프리미엄 향
- 기본 이미지: `public/images/choicell-all-in-one-shampoo.png`

샘플 제품은 기존 제주 청귤 수제청에서 초이셀 올인원 샴푸로 교체했습니다. 첨부된 샴푸 사진을 참고해 휴대폰 재생 UI와 컨트롤을 제거한 세로형 제품 이미지를 제작하고 입력 화면의 기본 미리보기로 연결했습니다.

## 구현 기능

- 제품명, 제품 설명, 주요 고객층, 핵심 특징 입력
- 자연스러운 분위기, 프리미엄, 친근함, 트렌디함 등 홍보 분위기 선택
- JPG·PNG·WebP 제품 사진 업로드
- 클릭 업로드와 드래그앤드롭 지원
- 최대 10MB 파일 용량 및 이미지 형식 검증
- 이미지 미리보기, 삭제, 재선택
- 필수값과 글자 수 검증 및 오류 안내
- 입력 중 버튼 상태와 제출 오류 처리
- 모바일·태블릿·PC 반응형 화면
- 입력 완료 후 제품 정보 결과 화면 표시
- 백엔드 전송을 위한 `FormData` 변환 함수 제공

## 전달 데이터 구조

```js
{
  productName: "초이셀 올인원 샴푸",
  productDescription: "두피와 모발을 한 번에 관리하는 자연 유래 성분의 프리미엄 올인원 샴푸입니다.",
  targetAudience: "건강한 두피와 모발 관리를 원하는 성인",
  keyFeatures: ["올인원 케어", "자연 유래 성분", "프리미엄 향"],
  brandTone: "natural",
  photo: File | null,
  photoUrl: "/images/choicell-all-in-one-shampoo.png",
  status: "INPUT_COMPLETED"
}
```

실제 백엔드 연동 시 브라우저에서 `/api/products`로 `multipart/form-data`를 전송하고, 서버가 업로드한 이미지의 `photoUrl`을 반환하도록 연결할 수 있습니다.

## 주요 파일

```text
C_김만복/
├─ public/
│  └─ images/
│     └─ choicell-all-in-one-shampoo.png
├─ src/
│  ├─ components/
│  │  ├─ ProductInputForm.jsx
│  │  ├─ ProductInputForm.css
│  │  └─ productInputPayload.js
│  ├─ App.jsx
│  ├─ App.css
│  ├─ main.jsx
│  └─ index.css
├─ index.html
├─ package.json
├─ package-lock.json
└─ vite.config.js
```

## 로컬 실행 방법

```bash
cd C_김만복
npm install
npm run dev
```

터미널에 표시되는 주소를 브라우저에서 열어 제품 입력과 결과 화면을 확인합니다.

프로덕션 빌드 확인:

```bash
npm run build
```

## 구현 및 검증 내역

- Vite + React 프로젝트 구성
- 입력 컴포넌트와 결과 화면 연결
- 샴푸 기본 데이터와 제품 이미지 적용
- GitHub Pages 하위 경로 대응
- `npm run build` 정상 통과
- 개인 저장소 `main` 브랜치 반영
- GitHub Actions를 통한 Pages 자동 배포 성공

## 관련 주소

- 개인 소스 저장소: https://github.com/manbok2028/ai-promo-studio
- 실행 결과: https://manbok2028.github.io/ai-promo-studio/

## 팀 연동 시 참고

`ProductInputForm`의 `onSubmit` 속성으로 다음 담당자의 AI 콘텐츠 생성 함수를 연결할 수 있습니다. API 키는 프론트엔드 코드에 저장하지 않고 백엔드 환경변수로 관리해야 합니다.
