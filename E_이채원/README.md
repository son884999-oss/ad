# E_이채원 — 제품 사진 기반 프로모션 영상 연출·프롬프트 생성

이 파트의 역할은 **전달받은 제품 사진과 제품 정보를 바탕으로 프로모션 광고영상의 연출과 영상 생성용 프롬프트를 만드는 것**이다. 사진에 맞는 콘셉트·분위기·조명·카메라 움직임·제품 강조점을 정하고 `{ videoPrompt }`를 팀장 모듈에 전달한다. 실제 영상 생성 API 호출과 웹사이트 통합은 팀장 담당이다.

작업 흐름은 **제품 사진·정보 입력 → 광고영상 연출·프롬프트 생성(E) → 영상 생성·통합(팀장)**이다. 사진을 분석하는 `gemini` 방식이 사진 기반 작업을 수행하며, 기본 `rules` 방식은 키 없이 실행·연결을 확인하기 위한 초안이다. `rules`는 사진을 분석하지 않고 제품명·설명으로 연출을 구성한다.

아래 테스트 사진 3장은 제품 사진을 전달받는 상황을 재현하기 위한 합성 자료다. 이 파트의 실행·연결·테스트 사진 안내는 이 README에 모았다. `계획서/README.md`는 기존 팀 안내 문서다.

## 실행

Node.js 22 이상, CommonJS. 설치할 외부 패키지는 없다. 이 폴더에서 실행한다.

```powershell
node examples/run.js
node --test
```

`npm run examples`, `npm test`도 같은 작업을 수행한다. 사진·입력·실제 프롬프트 반환값을 함께 보려면 [examples/RESULTS.md](examples/RESULTS.md)를 열면 된다. 쿠키·화장품 용기·머그컵 입력은 [examples/products.json](examples/products.json), 생성 결과 JSON은 [examples/rules-output.json](examples/rules-output.json)에 있다. `node examples/run.js --save`로 JSON과 결과 문서를 함께 갱신할 수 있다. 예시 URL은 자리표시자이며 실제 사진 파일이 아니다. 규칙 방식에서는 URL에 접근하지 않는다.

## 공개 함수와 연결

```javascript
const { generateVideoPrompt } = require('./src');

const productData = {
  productName: '데일리 머그컵',
  productDescription: '손잡이가 있는 머그컵 제품 사진',
  imageUrl: 'https://example.com/products/mug.jpg',
  brandTone: '따뜻한'
};

// 서버의 async 함수 안에서 호출한다. 두 방식 모두 await가 필요하다.
const { videoPrompt } = await generateVideoPrompt(productData, { mode: 'rules' });
const result = await generateVideo({ imageUrl: productData.imageUrl, prompt: videoPrompt });
```

팀장 코드에서 이 폴더의 `src`를 import/require하면 된다. CommonJS 전체 폴더를 유지한다. ES module에서는 `import promptModule from './E_이채원/src/index.js'` 후 `promptModule.generateVideoPrompt(...)`를 사용한다. 실행 가능한 연결 함수는 [examples/integration.js](examples/integration.js)에 있으며 `generateVideo`를 인자로 받는다. 실제 팀장 API와의 연결 실행은 아직 검증하지 않았다.

| 입력 | 필수 | 설명 |
| --- | --- | --- |
| productName | 예 | 비어 있지 않은 제품명 문자열 |
| productDescription | 예 | 비어 있지 않은 제품 설명 문자열 |
| imageUrl | 예 | 인증 정보가 URL에 포함되지 않은 HTTP(S) 사진 URL |
| keySellingPoint | 아니오 | 제품 강조점 문자열 |
| targetAudience | 아니오 | 대상 고객 문자열 |
| brandTone | 아니오 | 분위기 문자열 |

선택값은 생략·null·빈 문자열이면 없는 것으로 처리한다. 필수값 누락·잘못된 타입·URL·mode는 `TypeError`다. 반환값은 항상 키 하나를 가진 `{ videoPrompt: '영어 프롬프트 문자열' }`이며 추가 설명이나 Markdown은 넣지 않는다.

## 두 방식의 차이

| 방식 | 사진 분석 | 선택 입력 | 실패 시 |
| --- | --- | --- | --- |
| rules (기본) | 없음. 이름·설명 키워드 분류 | brandTone의 알려진 톤만 사용 | 입력 오류 전달 |
| gemini | 다운로드한 이미지 바이트와 제품 정보를 Gemini에 전송 | 강조점은 사진에서 확인될 때만, 대상은 분위기에만 사용하도록 요청 | 오류 전달, 자동 대체 없음 |

두 방식 모두 콘셉트 → 분위기·조명 → 느린 카메라 → 배경·제품 강조 → 보존 규칙 순서다. 자세한 분류와 공통 규칙은 [DIRECTION_RULES.md](DIRECTION_RULES.md)에 있다.

## Gemini 실행

1. `.env.example`을 `.env`로 복사하고 **서버용** `GEMINI_API_KEY`, `GEMINI_MODEL`을 채운다. 모델명은 기본값 없이 환경변수로 지정한다. 해당 계정에서 이미지 입력과 JSON 출력이 가능한 모델 ID를 사용한다.
2. `examples/products.json`의 자리표시자 URL 3개를 실제 접근 가능한 제품 사진 URL로 바꾼다.
3. 아래 명령을 실행한다. 실제 API 호출은 계정 사용량을 소비한다.

```powershell
node --env-file=.env examples/run.js --gemini
```

`.env`는 Git에서 제외된다. 브라우저에 API 키를 넣지 않는다. 이미지 URL은 서버에서 접근 가능해야 하고 JPEG/PNG/WebP/HEIC/HEIF Content-Type을 제공해야 한다. 이미지 다운로드 제한은 8 MiB, 15초이며 Gemini 요청 제한은 30초다. 큰 이미지는 축소해 사용한다. 이 초안은 inline 이미지 방식만 지원한다.

이미지를 base64 `inlineData`로 보내는 방식은 [Gemini 이미지 입력 공식 문서](https://ai.google.dev/gemini-api/docs/image-understanding), REST 요청·응답은 [generateContent 공식 문서](https://ai.google.dev/api/generate-content)를 따른다. 이 모듈은 서버에서 URL을 가져오므로 웹 통합 시 팀의 업로드 저장소 URL만 허용하는 검증을 호출 경계에 적용해야 한다.

```javascript
try {
  const { videoPrompt } = await generateVideoPrompt(productData, { mode: 'gemini' });
  return await generateVideo({ imageUrl: productData.imageUrl, prompt: videoPrompt });
} catch (error) {
  // 호출자에게 실패 상태를 전달한다. 필요 시 사용자가 rules 모드를 명시적으로 선택한다.
  console.error(error.code ?? error.name, error.message);
  throw error;
}
```

오류 코드는 `GEMINI_CONFIG_ERROR`, `IMAGE_ACCESS_ERROR`, `IMAGE_FORMAT_ERROR`, `IMAGE_SIZE_ERROR`, `GEMINI_REQUEST_ERROR`, `GEMINI_RESPONSE_ERROR`다. API 응답 원문·키는 오류 메시지에 넣지 않는다.

## 테스트 사진

내장 image_gen 도구로 2026-10-11에 생성한 합성 제품 사진이다. 생성 프롬프트 원문은 [examples/images/generation-prompts.json](examples/images/generation-prompts.json)에 보관했다.

| 사진 | 내용 | 확인할 요소 |
| --- | --- | --- |
| [쿠키](examples/images/cookie.png) | 초콜릿 쿠키와 투명 포장, 따뜻한 베이지 배경 | 표면·초콜릿 조각·포장 유지 |
| [화장품 용기](examples/images/cosmetic.png) | 흰색 빈 라벨과 닫힌 스포이드 뚜껑이 있는 갈색 용기 | 용기 형태·색상·라벨 위치 유지 |
| [머그컵](examples/images/mug.png) | 빈 머그컵과 손잡이, 밝은 베이지 배경 | 컵 윤곽·입구·손잡이 유지 |

제품 전체가 보이는 구도와 단순한 배경을 확인했다. 로고·라벨 문자가 없어 문자·로고 보존 검증에는 별도의 제품 사진이 필요하다.

Gemini 테스트에 사용하려면 사진을 팀 업로드 저장소에 올리고 `examples/products.json`의 `imageUrl`을 각 사진의 HTTP(S) URL로 바꾼 뒤 위의 Gemini 명령을 실행한다. 현재 모듈은 로컬 파일 경로나 `file:` URL을 받지 않는다.

결과를 검토할 때 쿠키에 증기나 새 소품을 추가하지 않는지, 화장품의 빈 라벨에 문자를 만들어내지 않는지, 머그컵에 음료나 손을 추가하지 않는지 확인한다. 이후 실제 전달받은 제품 사진으로도 같은 검증을 수행한다.

## 검증과 남은 작업

[TEST_RESULTS.md](TEST_RESULTS.md)에 테스트 범위와 결과를 기록했다. 키 없이 규칙 방식 3종 실행, 공개 함수 계약, 보존 규칙, 이미지 바이트 전달과 AI 실패 처리를 검증한다. AI 테스트는 네트워크 대체 응답과 작은 PNG fixture를 사용한다. 운영 코드에는 모의 응답 모드가 없다.

**실제 Gemini 제품 사진 분석은 미검증이다.** 키와 실제 쿠키·화장품·머그컵 사진이 준비되면 각각 사진 충실도, 톤, 영어 문장, 확인되지 않은 효과·효능 유무를 검토해야 한다. 형식 검사는 AI의 시각 판단·의미를 보장하지 않는다. 팀장 영상 모듈과 연결 후 제품·라벨·로고 유지, 실제 10초 길이, 비율·해상도를 결과 영상에서 확인한다.
