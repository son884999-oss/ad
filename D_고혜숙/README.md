# 홍보 잇다 · D 포스터 모듈

제품 정보와 사진을 받아 포스터 시안을 만들고, `posterUrl`을 출력하는 독립 실행형 React 모듈입니다.

## 실행

```bash
npm install
npm run dev
```

개발 서버 주소는 Vite가 터미널에 표시합니다. 프로덕션 빌드는 `npm run build`로 생성합니다.

## 입력 규격

필수 입력:

- `productName`: 제품명
- `productDescription`: 제품 설명
- `imageUrl`: 브라우저가 읽을 수 있는 제품 사진 URL

선택 입력:

- `keySellingPoint`: 강조할 특징
- `targetAudience`: 주요 고객
- `brandTone`: 원하는 분위기
- `generatedBackgroundUrl`: 외부 생성 기능이 준비한 배경 이미지 URL (선택)

기본 화면은 샘플 제품 정보와 `public/sample-product.png`로 독립 실행됩니다. `PosterModule`은 초기 입력값을 props로 받을 수 있고, 생성이 끝나면 `onPosterReady(result)`를 호출합니다.

```jsx
import { PosterModule } from './poster';

<PosterModule
  initialProductData={{
    productName: '수제 과일청',
    productDescription: '제철 과일의 풍미를 담은 수제 과일청입니다.',
    keySellingPoint: '국산 제철 과일 사용',
    targetAudience: '차와 음료를 즐기는 분',
    brandTone: '밝고 경쾌한 분위기',
  }}
  initialImageUrl="/fruit-tea.jpg"
  onPosterReady={({ posterUrl }) => {
    // F 결과 화면에서 사용할 posterUrl
  }}
/>
```

나중에 서버에서 배경 이미지를 생성해 전달할 때는 선택 prop을 사용합니다. 현재처럼 Canvas만 실행하려면 이 prop을 생략하면 됩니다.

```jsx
<PosterModule generatedBackgroundUrl={backgroundImageUrl} />
```

## 출력 규격과 현재 범위

생성 콜백은 입력 필드와 함께 `posterUrl`, `status: 'sample'`, `format: 'image/png'`, `compositionMode`, 전달된 경우 `generatedBackgroundUrl`을 반환합니다. `posterUrl`은 현재 브라우저에서 만든 PNG data URL입니다. `generatedBackgroundUrl`이 없으면 Canvas만 사용하고, 값이 있으면 해당 이미지를 배경으로 깔고 제품 사진과 한글 문구를 Canvas에서 합성합니다. 배경 생성 API 호출은 이 모듈에 포함하지 않았으므로, 상위 모듈이 서버에서 생성한 이미지 URL을 `PosterModule` prop으로 전달하면 됩니다.

현재 기본 화면은 HTML Canvas 시안만 렌더링합니다. 기본 세로 구도는 원본 사진 비율을 유지하고 흐린 배경으로 캔버스를 채워 제품 사진을 크게 보여 줍니다. 상단 정보 패널은 제목과 설명의 가독성을 확보하고, 강조 문구와 추천 대상을 구분해 표시합니다. 나중에 API를 연결할 때는 Gemini 같은 이미지 생성 API를 서버에서 호출하고, 생성된 배경 이미지 URL만 이 모듈에 전달하면 됩니다. API 키는 브라우저나 저장소에 넣지 마세요. 이 모듈 자체는 Gemini API나 스토리지 업로드를 호출하지 않으며, API 키나 환경변수 없이 실행됩니다.

제품 사진은 PNG, JPG, WebP 형식의 10MB 이하 파일을 선택할 수 있습니다. 외부 이미지 URL을 전달하는 경우 해당 서버가 브라우저 Canvas 내보내기를 허용해야 합니다.
