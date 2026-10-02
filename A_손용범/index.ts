import { config, higgsfield } from '@higgsfield/client/v2';

const credentials = process.env.HF_CREDENTIALS;
if (!credentials) {
  console.error('.env.local에 HF_CREDENTIALS=KEY_ID:KEY_SECRET 형식으로 설정하세요.');
  process.exitCode = 1;
} else {
  config({ credentials });

  try {
    const result = await higgsfield.subscribe(
      'bytedance/seedance-2.5/text-to-video',
      {
        input: {
          prompt: 'A cinematic scene at sunset',
          duration: 5,
          resolution: '720p',
          aspect_ratio: '16:9',
          output_format: 'mp4',
          generate_audio: true,
        },
        withPolling: true,
      },
    );

    if (result.status === 'completed' && result.video?.url) {
      console.log(result.video.url);
    } else {
      const status = String(result.status ?? 'unknown');
      const moderated = status === 'nsfw' || status === 'moderated';
      console.error(
        moderated
          ? `영상 생성이 콘텐츠 정책에 의해 중단되었습니다: ${status}`
          : `영상 생성이 완료되지 않았습니다: ${status}`,
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? `Seedance 2.5 요청 실패: ${error.message}`
        : 'Seedance 2.5 요청에서 알 수 없는 오류가 발생했습니다.',
    );
    process.exitCode = 1;
  }
}
