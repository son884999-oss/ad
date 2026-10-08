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

## 출력 규격과 현재 범위

생성 콜백은 입력 필드와 함께 `posterUrl`, `status: 'sample'`, `format: 'image/png'`를 반환합니다. `posterUrl`은 현재 브라우저에서 만든 PNG data URL입니다. 같은 화면의 미리보기·다운로드와 F 모듈 연결에는 사용할 수 있지만, 영구 저장되거나 외부에서 접근할 수 있는 공개 URL은 아닙니다. 실제 통합에서는 ImageKit 또는 확정된 공용 저장소에 업로드한 뒤 반환 URL로 교체해야 합니다.

현재 포스터는 HTML Canvas 시안입니다. Gemini 등 이미지 생성 API와 스토리지 업로드는 연결하지 않았으며, API 키나 환경변수는 필요하지 않습니다. 화면에는 실제 AI 결과라고 표시하지 않습니다.

제품 사진은 PNG, JPG, WebP 형식의 10MB 이하 파일을 선택할 수 있습니다. 외부 이미지 URL을 전달하는 경우 해당 서버가 브라우저 Canvas 내보내기를 허용해야 합니다.
