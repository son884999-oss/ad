import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHiggsfieldClient } from '@higgsfield/client/v2';
import { generateVideo } from './video.mjs';
import { composePremium as composeAd } from './compose-premium.mjs';
import { composePush } from './compose-push.mjs';

async function main() {
  const push = process.argv.includes('--push');
  const compose = push ? composePush : composeAd;
  const sample = JSON.parse(await readFile(new URL(push ? './sample-push.json' : './sample-ad.json', import.meta.url), 'utf8'));
  const output = new URL(push ? '../../쵸이셀_숲속접근_문구X.mp4' : '../../쵸이셀_Kling_숲속광고_원본.mp4', import.meta.url);
  const finalOutput = new URL(push ? '../../쵸이셀_숲속접근_광고.mp4' : '../../쵸이셀_광고_리디자인.mp4', import.meta.url);
  // Resume composition without another billable generation if raw video was saved.
  let rawExists = false;
  try { await access(output); rawExists = true; } catch (error) { if(error.code !== 'ENOENT') throw error; }
  if (rawExists) {
    console.log(await compose({inputPath:fileURLToPath(output),outputPath:fileURLToPath(finalOutput),sample}));
    return;
  }
  try { await access(output); throw new Error('OUTPUT_EXISTS'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const photo = await readFile(new URL('../../2115123_20240830152650.jpg', import.meta.url));
  if (!process.env.HF_CREDENTIALS) throw new Error('MISSING_CREDENTIALS');
  console.log('제품 사진 업로드 중');
  const response = await fetch('https://api.higgsfield.ai/files/generate-upload-url', {
    method: 'POST', headers: { Authorization: `Key ${process.env.HF_CREDENTIALS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({content_type: 'image/jpeg'}),
  });
  if (!response.ok) throw new Error(`UPLOAD_AUTH_HTTP_${response.status}`);
  const upload = await response.json();
  if (!upload.upload_url || !upload.public_url) throw new Error('INVALID_UPLOAD_RESPONSE');
  const headers = new Headers();
  if (Array.isArray(upload.upload_headers)) {
    for (const h of upload.upload_headers) headers.set(h.name ?? h.key, h.value);
  } else {
    for (const [k,v] of Object.entries(upload.upload_headers ?? {})) headers.set(k,v);
  }
  if (!headers.has('Content-Type')) headers.set('Content-Type','image/jpeg');
  const put = await fetch(upload.upload_url, {method:'PUT', headers, body:photo});
  if (!put.ok) throw new Error(`UPLOAD_HTTP_${put.status}`);
  const client = createHiggsfieldClient({credentials:process.env.HF_CREDENTIALS, maxRetries:0, maxPollTime:900000});
  console.log('Kling 2.5 Turbo Standard 5초 생성 1회 요청 → 한글 광고문구 자동 합성');
  const result = await generateVideo({imageUrl:upload.public_url, videoPrompt:sample.videoPrompt, duration:5,
    negativePrompt:'deformed bottle, duplicated product, new text, captions, titles, people, hands, shaky camera',
  }, {client});
  if (result.status !== 'completed') {
    console.error('영상 생성 미완료. 자동 재생성하지 않습니다. 상태:', result.providerStatus ?? 'error');
    process.exitCode=1; return;
  }
  await writeFile(new URL(push ? '../../쵸이셀_숲속접근_生成記録.json' : '../../쵸이셀_Kling_숲속광고_생성기록.json', import.meta.url), JSON.stringify({requestId:result.requestId,videoUrl:result.videoUrl,model:'kling-video/v2.5-turbo/standard/image-to-video',sample},null,2));
  const video = await fetch(result.videoUrl);
  if (!video.ok) throw new Error(`DOWNLOAD_HTTP_${video.status}`);
  await writeFile(output, Buffer.from(await video.arrayBuffer()));
  console.log('저장 완료:',fileURLToPath(output));
  console.log(await compose({inputPath:fileURLToPath(output),outputPath:fileURLToPath(finalOutput),sample}));
}
main().catch(error => {
  const code = String(error?.message ?? 'UNKNOWN_ERROR');
  console.error(/^(OUTPUT_EXISTS|MISSING_CREDENTIALS|UPLOAD_AUTH_HTTP_\d+|INVALID_UPLOAD_RESPONSE|UPLOAD_HTTP_\d+|DOWNLOAD_HTTP_\d+)$/.test(code) ? code : '실행 오류. 비밀정보 보호를 위해 원문 오류는 출력하지 않습니다.');
  process.exitCode=1;
});
