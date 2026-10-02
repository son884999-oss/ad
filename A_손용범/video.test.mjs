import assert from 'node:assert/strict';
import test from 'node:test';

import { generateVideo } from './video.mjs';

const validInput = {
  imageUrl: 'https://example.com/product.jpg',
  videoPrompt: 'A slow camera push toward the product',
};

test('videoPrompt를 Higgsfield 입력으로 전달하고 완료 결과를 반환한다', async () => {
  let request;
  const client = {
    async subscribe(model, options) {
      request = { model, options };
      return {
        status: 'completed',
        request_id: 'request-1',
        video: { url: 'https://example.com/result.mp4' },
      };
    },
  };

  const result = await generateVideo(validInput, { client });

  assert.equal(request.model, 'kling-video/v2.5-turbo/standard/image-to-video');
  assert.deepEqual(request.options, {
    input: {
      image_url: validInput.imageUrl,
      prompt: validInput.videoPrompt,
      duration: 10,
      cfg_scale: 0.5,
      negative_prompt: '',
    },
    withPolling: true,
  });
  assert.deepEqual(result, {
    videoUrl: 'https://example.com/result.mp4',
    requestId: 'request-1',
    status: 'completed',
    providerStatus: 'completed',
    errorMessage: null,
  });
});

test('기존 prompt 입력도 하위 호환으로 지원한다', async () => {
  let receivedPrompt;
  const client = {
    async subscribe(_model, options) {
      receivedPrompt = options.input.prompt;
      return {
        status: 'completed',
        request_id: 'request-2',
        video: { url: 'https://example.com/legacy.mp4' },
      };
    },
  };

  const result = await generateVideo({
    imageUrl: validInput.imageUrl,
    prompt: 'legacy prompt',
  }, { client });

  assert.equal(receivedPrompt, 'legacy prompt');
  assert.equal(result.status, 'completed');
});

test('제공자 실패 상태를 수동 재시도 가능한 공통 오류 결과로 변환한다', async () => {
  const client = {
    async subscribe() {
      return { status: 'nsfw', request_id: 'request-3' };
    },
  };

  const result = await generateVideo(validInput, { client });

  assert.deepEqual(result, {
    videoUrl: null,
    requestId: 'request-3',
    status: 'failed',
    providerStatus: 'nsfw',
    errorMessage: '영상 생성 실패: nsfw',
  });
});

test('SDK 예외를 공통 오류 결과로 변환한다', async () => {
  const client = {
    async subscribe() {
      const error = new Error('temporary provider error');
      error.request_id = 'request-4';
      throw error;
    },
  };

  const result = await generateVideo(validInput, { client });

  assert.deepEqual(result, {
    videoUrl: null,
    requestId: 'request-4',
    status: 'failed',
    providerStatus: null,
    errorMessage: 'temporary provider error',
  });
});

test('잘못된 호출 입력은 API 호출 전에 거부한다', async () => {
  const client = { subscribe: async () => assert.fail('API를 호출하면 안 됩니다.') };

  await assert.rejects(
    generateVideo({ ...validInput, imageUrl: 'http://example.com/product.jpg' }, { client }),
    /https:\/\//,
  );
  await assert.rejects(
    generateVideo({ imageUrl: validInput.imageUrl, videoPrompt: '   ' }, { client }),
    /videoPrompt/,
  );
  await assert.rejects(
    generateVideo({ ...validInput, duration: 7 }, { client }),
    /5초 또는 10초/,
  );
  await assert.rejects(
    generateVideo({ ...validInput, cfgScale: 2 }, { client }),
    /0부터 1 사이/,
  );
  await assert.rejects(
    generateVideo({ ...validInput, negativePrompt: null }, { client }),
    /문자열/,
  );
});

test('videoPrompt와 prompt가 충돌하면 거부한다', async () => {
  await assert.rejects(
    generateVideo({ ...validInput, prompt: 'different prompt' }, {
      client: { subscribe: async () => assert.fail('API를 호출하면 안 됩니다.') },
    }),
    /같은 값/,
  );
});
