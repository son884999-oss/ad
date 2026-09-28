# A: 광고영상 생성

Higgsfield의 Kling 2.5 Turbo Standard Image-to-Video 모델로 제품 사진 한 장을 영상으로 변환하는 **서버용 모듈**입니다. 화면이나 사진 업로드 기능은 포함하지 않습니다.

## 준비

1. Node.js와 pnpm을 설치하고 이 폴더에서 `pnpm install`을 실행합니다.
2. Higgsfield API의 Key ID와 Key Secret을 발급받습니다.
3. 서버 환경변수 `HF_CREDENTIALS`를 `KEY_ID:KEY_SECRET` 형식으로 설정합니다. `.env.example`은 형식 참고용입니다. 실제 키나 `.env` 파일은 GitHub에 올리지 마세요.
4. 제품 사진을 외부에서 접근 가능한 **HTTPS URL**로 준비합니다. 컴퓨터 안의 파일 경로나 브라우저의 임시 미리보기 URL은 사용할 수 없습니다.

PowerShell에서 한 번 실행할 때의 예시:

```powershell
$env:HF_CREDENTIALS = 'KEY_ID:KEY_SECRET'
pnpm generate "https://example.com/product.jpg" "A slow camera push toward the product, soft studio lighting, keep the product shape and label unchanged"
```

위 명령은 실제 유료 영상 생성을 요청합니다. 처음에는 5초 영상으로 확인하세요.

## 다른 코드에서 호출

```js
import { generateVideo } from './A_손용범/video.mjs';

const result = await generateVideo({
  imageUrl: 'https://example.com/product.jpg',
  prompt: 'A slow camera push toward the product, soft studio lighting',
  duration: 5,
});

console.log(result.videoUrl);
```

입력: `imageUrl`, `prompt`, 선택값 `duration`(5 또는 10), `cfgScale`(0~1), `negativePrompt`.

출력: `{ videoUrl, requestId, status }`. 결과 화면에서는 `videoUrl`을 재생하거나 다운로드 링크에 사용할 수 있습니다. SDK가 생성 완료까지 상태를 확인하므로 호출이 바로 끝나지 않을 수 있습니다. 오류는 예외로 전달됩니다.

기획안의 약 8초 영상은 이 모델에서 직접 지정할 수 없습니다. 5초 또는 10초를 사용해야 합니다. 이 API 요청에는 화면 비율 설정값도 없으므로, 세로형 영상이 필요하면 입력 이미지와 실제 생성 결과의 비율을 확인하세요.

모델 설명: https://open.higgsfield.ai/models/kling-video/v2.5-turbo/standard/image-to-video/playground
