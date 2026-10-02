import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { config, higgsfield } from '@higgsfield/client/v2';

const credentials = process.env.HF_CREDENTIALS;
if (!credentials) {
  console.error('.env.local에 HF_CREDENTIALS=KEY_ID:KEY_SECRET 형식으로 설정하세요.');
  process.exit(1);
}

config({ credentials });

const imagePath = new URL('../../2115123_20240830152650.jpg', import.meta.url);
const outputPath = new URL('../../춸이셀_올인원_샴푸_Seedance2.5_5초_광고.mp4', import.meta.url);
const image = await readFile(imagePath);

console.log('1/3 제품 이미지를 Higgsfield에 업로드하는 중...');
const uploadRequest = await fetch('https://api.higgsfield.ai/files/generate-upload-url', {
  method: 'POST',
  headers: {
    Authorization: `Key ${credentials}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ content_type: 'image/jpeg' }),
});

if (!uploadRequest.ok) {
  const reason = uploadRequest.status === 401
    ? '인증 실패: API Key ID와 Secret을 다시 확인하세요.'
    : `업로드 URL 발급 실패 (${uploadRequest.status})`;
  throw new Error(reason);
}

const upload = await uploadRequest.json() as {
  upload_url?: string;
  public_url?: string;
  upload_headers?: Record<string, string> | Array<{ name?: string; key?: string; value: string }>;
};

if (!upload.upload_url || !upload.public_url) {
  throw new Error('업로드 응답에 필요한 URL이 없습니다.');
}

const uploadHeaders = new Headers();
if (Array.isArray(upload.upload_headers)) {
  for (const header of upload.upload_headers) {
    const name = header.name ?? header.key;
    if (name) uploadHeaders.set(name, header.value);
  }
} else {
  for (const [name, value] of Object.entries(upload.upload_headers ?? {})) {
    uploadHeaders.set(name, value);
  }
}
if (!uploadHeaders.has('Content-Type')) uploadHeaders.set('Content-Type', 'image/jpeg');

const imageUpload = await fetch(upload.upload_url, {
  method: 'PUT',
  headers: uploadHeaders,
  body: image,
});
if (!imageUpload.ok) {
  throw new Error(`제품 이미지 업로드 실패 (${imageUpload.status})`);
}

console.log('2/3 Seedance 2.5로 5초 세로형 제품 광고를 생성하는 중...');
const result = await higgsfield.subscribe(
  'bytedance/seedance-2.5/reference-to-video',
  {
    input: {
      prompt: [
        'Create a premium five-second vertical Korean beauty product commercial for the ChoiCell brand.',
        'The exact product is the 500 ml Choi-Cell All in One Shampoo shown in the reference image.',
        'Preserve the exact transparent green bottle, black pump, gold collar, existing label, logo,',
        'colors, spelling, and proportions without morphing or duplication.',
        'Open on a clean bright white studio hero shot. Add a soft botanical green light sweep,',
        'subtle water droplets and a fresh moisture glow. Use a slow controlled camera push-in with',
        'very gentle turntable motion, then finish with the bottle centered and fully visible.',
        'High-end realistic commercial lighting, stable camera, crisp product focus.',
        'Do not add people, hands, extra bottles, new text, medical claims, or altered labels.',
        'Audio: subtle clean water ambience and a refined short instrumental brand sting, no speech.',
      ].join(' '),
      duration: 5,
      image_urls: [upload.public_url],
      resolution: '720p',
      aspect_ratio: '9:16',
      output_format: 'mp4',
      generate_audio: true,
    },
    withPolling: true,
  },
);

if (result.status !== 'completed' || !result.video?.url) {
  const status = String(result.status ?? 'unknown');
  const moderated = status === 'nsfw' || status === 'moderated';
  throw new Error(
    moderated
      ? `콘텐츠 정책으로 생성이 중단됨: ${status}`
      : `영상 생성이 완료되지 않음: ${status}`,
  );
}

console.log('3/3 완성 영상을 파이널 폴더에 저장하는 중...');
const videoResponse = await fetch(result.video.url);
if (!videoResponse.ok) {
  throw new Error(`영상 다운로드 실패 (${videoResponse.status})`);
}

const video = Buffer.from(await videoResponse.arrayBuffer());
await writeFile(outputPath, video);
console.log(`완료: ${fileURLToPath(outputPath)} (${video.length} bytes)`);
