# A: 광고영상 생성

> 현재 인계 상태와 문서 대비 미완료 사항은 [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)를 먼저 확인하세요. 실제 영상 생성은 검증했지만 전체 웹앱·모듈 통합·배포는 미완료이며, 광고 디자인 시안은 아직 승인되지 않았습니다.

Higgsfield의 Kling 2.5 Turbo Standard Image-to-Video 모델로 제품 사진 한 장을 영상으로 변환하는 **서버용 모듈**입니다. 화면이나 사진 업로드 기능은 포함하지 않습니다.

## 준비

1. Node.js와 pnpm을 설치하고 이 폴더에서 `pnpm install`을 실행합니다.
2. Higgsfield API에서 API 키를 발급받습니다.
3. 이 폴더의 `.env.local` 파일에 `HF_CREDENTIALS=발급받은_전체_키`를 입력합니다. Key ID와 Key Secret이 따로 표시되면 `KEY_ID:KEY_SECRET` 형식으로 입력합니다. 이 파일은 Git에서 제외됩니다.
4. 제품 사진을 외부에서 접근 가능한 **HTTPS URL**로 준비합니다. 컴퓨터 안의 파일 경로나 브라우저의 임시 미리보기 URL은 사용할 수 없습니다.

`.env.local` 입력 예시:

```dotenv
HF_CREDENTIALS=KEY_ID:KEY_SECRET
```

저장한 다음 PowerShell에서 실행합니다.

```powershell
pnpm generate "https://example.com/product.jpg" "A slow camera push toward the product, soft studio lighting, keep the product shape and label unchanged" 5
```

위 명령은 실제 유료 영상 생성을 요청합니다. 마지막 인자는 5초 또는 10초이며, 생략하면 기본값은 10초입니다. 첫 실제 시험은 비용을 줄이기 위해 5초를 권장합니다. API 키를 받기 전에는 실행할 수 없으며, 실제 생성 전에 Higgsfield의 현재 요금을 확인하세요.

## 다른 코드에서 호출

```js
import { generateVideo } from './A_손용범/video.mjs';

const result = await generateVideo({
  imageUrl: 'https://example.com/product.jpg',
  videoPrompt: 'A slow camera push toward the product, soft studio lighting',
  duration: 10,
});

if (result.status === 'completed') {
  console.log(result.videoUrl);
} else {
  console.error(result.errorMessage);
  // 화면에서 이 항목만 다시 생성할 수 있게 표시합니다.
}
```

입력: `imageUrl`, `videoPrompt`, 선택값 `duration`(기본 10초, 5 또는 10), `cfgScale`(0~1), `negativePrompt`.

기존 `prompt`도 하위 호환을 위해 지원하지만, 새 코드는 공통 데이터 규격인 `videoPrompt`를 사용하세요. 두 값을 함께 보내면 같은 문자열이어야 합니다.

성공 출력: `{ videoUrl, requestId, status: "completed", providerStatus, errorMessage: null }`.

실패 출력: `{ videoUrl: null, requestId, status: "failed", providerStatus, errorMessage }`. 외부 API 실패는 결과로 반환되므로 호출자가 성공한 다른 결과를 유지하고 영상만 수동 재시도할 수 있습니다. 잘못된 입력과 환경변수 누락은 개발 설정 문제이므로 예외를 발생시킵니다.

SDK가 생성 완료까지 상태를 확인하므로 호출이 바로 끝나지 않을 수 있습니다.

## 테스트

```powershell
pnpm check
pnpm test
```

테스트는 모의 Higgsfield 클라이언트를 사용하므로 API 키나 비용이 필요하지 않습니다.

## Seedance 2.5 공식 SDK 예제

`index.ts`는 공식 TypeScript SDK와 `subscribe`를 사용해 5초, 720p, 16:9 영상을 생성합니다. 아래 명령은 실제 API 잔액을 사용합니다.

```powershell
pnpm seedance
```

완료 시 영상 URL만 출력하며, 실패·취소·콘텐츠 정책 차단 상태는 실패로 종료합니다.

## 제품 광고 자동 완성 (기본: Kling 2.5 Turbo Standard)

### 숲속 접근 연출 버전

### 브랜드컷 편집 템플릿 (별도 선택)

`node compose-editorial.mjs`는 기존 숲속 접근 원본을 사용해 `쵸이셀_브랜드컷_광고.mp4`를 만듭니다. 유료 API를 호출하지 않습니다. 도입 0.7초를 덜어내고 마지막 0.7초를 정지 연장해 총 5초로 구성합니다. 처음에는 2행 감성 카피, 2.5초부터 아이보리색 브랜드 영역과 제품 화면을 나눠 보여줍니다. 원본과 이전 결과는 덮어쓰지 않습니다. 별도 입력/출력 경로는 명령 인자로 지정할 수 있습니다.

`composeEditorial({inputPath, outputPath, sample})`은 headline/brand/productLine을 받습니다. 현재 우측 제품 배치에 맞춘 템플릿으로, 임의 상품에 대한 자동 위치 검출은 없습니다. 글자 수 제한(각 20/5/12자)을 넘어가면 렌더링 전에 실패합니다. 기존 기본 파이프라인은 변경하지 않았습니다. 음원은 외부 광고에서 가져오지 않고 FFmpeg 수식으로 짧은 톤과 전환음을 직접 합성합니다. 상용 음악이나 실제 자연 녹음은 아닙니다.

연출 참고: Aveda 공식 Botanical Repair 광고 https://www.youtube.com/watch?v=qdAWoKewTHM — 제품 클로즈업과 간결한 타이포의 배치 참고. 참고 광고의 영상·음원·효능 문구는 재사용하지 않았습니다.

`composePush({inputPath, outputPath, sample, textStyle})`의 기본 `textStyle`은 `nature-beauty`입니다. 기존 스타일은 `basic`으로 선택할 수 있습니다. 자연·뷰티 스타일은 동봉한 고운돋움 글꼴에 굵기 합성, 아이보리/연한 골드 색상, 얕은 입체 그림자와 짧은 상승 효과를 적용합니다. 진짜 3D 렌더링은 아닙니다. 문구는 `headline`, `brand`, `productLine`에서 받아 사용하며 각 값은 비어 있지 않은 24자 이하 문자열이어야 합니다. 긴 문구의 자동 줄바꿈은 아직 지원하지 않으므로 영상용 짧은 카피를 전달하세요.

글꼴 출처: https://github.com/yangheeryu/Gowun-Dodum (SIL OFL). 배포용 파일은 Google Fonts 저장소에서 받아 `assets/fonts/`에 라이선스와 함께 보관합니다. 시스템 전체에 설치하지 않고 합성 시에만 읽습니다. 검수 출력 `쵸이셀_뷰티타이포_광고.mp4`는 기존 원본으로 합성했으며 추가 영상 API 호출은 없습니다.

`node --env-file=.env.local kling-ad.mjs --push`는 `sample-push.json`의 카메라 접근 연출로 5초 영상을 1회 유료 생성한 뒤 `compose-push.mjs`로 한글을 합성합니다. 출력은 `쵸이셀_숲속접근_문구X.mp4`와 `쵸이셀_숲속접근_광고.mp4`입니다. 원본이 있으면 재생성 없이 합성만 실행하며 기존 완성본은 덮어쓰지 않습니다. 문구는 “일상에 싱그러움을”과 “쵸이셀 / 올인원 샴푸”만 사용합니다. 기존 영상은 보존합니다.

`sample-ad.json`은 C/B/E 모듈 대신 사용하는 제품 정보·홍보 카피·영상 프롬프트 샘플입니다. 카피는 공식 브랜드 문구가 아닌 테스트용 창작 문구입니다. `kling-ad.mjs`가 사진 업로드 → Kling 5초 생성 → 원본 다운로드 → `compose-premium.mjs`의 한글 자동 합성을 이어서 수행합니다. 완성 파일은 파이널 폴더의 `쵸이셀_광고_리디자인.mp4`입니다. 문구 없는 원본의 별도 보존본은 `문구X_예시 영상.mp4`입니다.

원본 영상은 별도로 보존합니다. 원본이 이미 존재하면 유료 생성을 건너뛰고 합성만 재시도합니다. 완성 파일은 덮어쓰지 않습니다. 생성 결과 URL과 요청 ID는 `쵸이셀_Kling_숲속광고_생성기록.json`에 저장됩니다. 자동 유료 재생성은 없습니다.

```powershell
pnpm product-ad
```

합성만 실행할 때는 API 키 없이 아래 명령을 사용합니다. 출력은 사용하지 않은 새 파일명을 지정하세요.

```powershell
pnpm compose-ad "원본영상의 절대경로.mp4" "새완성영상의 절대경로.mp4"
```

합성 실행 환경: Node.js, PATH의 FFmpeg(libass/libx264 포함), 맑은 고딕·바탕 글꼴. 현재 Windows 로컬에서 검증합니다. 다른 서버에는 같은 글꼴과 FFmpeg를 준비해야 합니다. 합성은 1080×1080 정사각 캔버스로 출력하며 정사각 원본의 장면 전체를 살립니다. 하단의 은은한 명도 조절 위에 짧은 헤드라인이 등장하고 상품명으로 전환되며, CTA는 3.15초부터 표시합니다. 큰 패널과 버튼형 박스는 사용하지 않습니다. 출력 해상도 확대가 원본의 세부 정보를 새로 생성하는 것은 아닙니다. 기존 세로형 합성기 `compose-ad.mjs`는 보존하되 기본 명령은 새 합성기를 사용합니다. 현재 카피는 샘플이고 실제 AI 문구 생성 모듈 및 웹 결과 화면 연결은 별도입니다.

이 모델은 5초 또는 10초를 생성합니다. 이 API 요청에는 화면 비율 설정값이 없으므로, 세로형 영상이 필요하면 입력 이미지와 실제 생성 결과의 비율을 확인하세요.

모델 설명: https://open.higgsfield.ai/models/kling-video/v2.5-turbo/standard/image-to-video/playground
