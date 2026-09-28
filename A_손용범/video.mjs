import { createHiggsfieldClient } from '@higgsfield/client/v2';

const MODEL = 'kling-video/v2.5-turbo/standard/image-to-video';

/**
 * 제품 사진 URL과 영상 연출 프롬프트로 짧은 광고 영상을 생성합니다.
 * 서버에서만 호출하세요. 이 함수는 작업 완료까지 기다린 뒤 영상 URL을 반환합니다.
 */
export async function generateVideo({
  imageUrl,
  prompt,
  duration = 5,
  cfgScale = 0.5,
  negativePrompt = '',
}, { credentials = process.env.HF_CREDENTIALS, client } = {}) {
  if (typeof imageUrl !== 'string' || !/^https:\/\//i.test(imageUrl)) {
    throw new TypeError('imageUrl은 외부에서 접근 가능한 https:// 이미지 URL이어야 합니다.');
  }
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new TypeError('prompt를 입력하세요.');
  }
  if (duration !== 5 && duration !== 10) {
    throw new RangeError('duration은 5초 또는 10초만 가능합니다.');
  }
  if (typeof cfgScale !== 'number' || !Number.isFinite(cfgScale) || cfgScale < 0 || cfgScale > 1) {
    throw new RangeError('cfgScale은 0부터 1 사이의 숫자여야 합니다.');
  }
  if (typeof negativePrompt !== 'string') {
    throw new TypeError('negativePrompt는 문자열이어야 합니다.');
  }
  if (!client && (!credentials || !/^[^:]+:.+/.test(credentials))) {
    throw new Error('서버 환경변수 HF_CREDENTIALS에 KEY_ID:KEY_SECRET을 설정하세요.');
  }

  const api = client ?? createHiggsfieldClient({ credentials });
  const result = await api.subscribe(MODEL, {
    input: {
      image_url: imageUrl,
      prompt: prompt.trim(),
      duration,
      cfg_scale: cfgScale,
      negative_prompt: negativePrompt,
    },
    withPolling: true,
  });

  if (result.status !== 'completed' || !result.video?.url) {
    throw new Error(`영상 생성 실패: ${result.status ?? '알 수 없는 상태'} (request_id: ${result.request_id ?? '없음'})`);
  }

  return {
    videoUrl: result.video.url,
    requestId: result.request_id,
    status: result.status,
  };
}
