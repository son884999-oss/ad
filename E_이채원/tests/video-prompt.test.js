const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateVideoPrompt } = require('../src');
const { createProductVideo } = require('../examples/integration');
const products = require('../examples/products.json');
const { CAMERA, PRESERVATION } = require('../src/rules');
const base = { productName: '제품', productDescription: '제품 사진', imageUrl: 'https://example.com/product.png' };
// Tiny PNG fixture for transport tests, not a product photo analysis test.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
const direction = { concept: 'Create a quiet product portrait.', moodLighting: 'Use soft reference lighting.', backgroundEmphasis: 'Retain the background and highlight the visible label.' };
const imageResponse = () => new Response(png, { headers: { 'content-type': 'image/png' } });
const aiResponse = (text = JSON.stringify(direction), extra = {}) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] }, ...extra }] });

async function withMock(fetchImpl, action, env = { GEMINI_API_KEY: 'test-only-key', GEMINI_MODEL: 'test-model' }) {
  const originalFetch = global.fetch;
  const previous = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: process.env.GEMINI_MODEL };
  global.fetch = fetchImpl;
  for (const key of Object.keys(previous)) {
    if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
  }
  try { return await action(); }
  finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
}
const generateAI = () => generateVideoPrompt(base, { mode: 'gemini' });
const rejectsCode = code => assert.rejects(generateAI(), { code });

for (const field of ['productName', 'productDescription', 'imageUrl']) {
  test(`required input: ${field}`, async () => {
    for (const value of [undefined, null, '', '   ', 123]) {
      await assert.rejects(generateVideoPrompt({ ...base, [field]: value }), TypeError);
    }
  });
}
test('invalid product object, URL, mode and optional input are rejected', async () => {
  for (const value of [undefined, null, [], 'product']) await assert.rejects(generateVideoPrompt(value), TypeError);
  for (const imageUrl of ['relative.png', 'file:///tmp/image.png', 'https://user:secret@example.com/image.png']) {
    await assert.rejects(generateVideoPrompt({ ...base, imageUrl }), TypeError);
  }
  await assert.rejects(generateVideoPrompt(base, { mode: 'auto' }), TypeError);
  for (const field of ['keySellingPoint', 'targetAudience', 'brandTone']) {
    await assert.rejects(generateVideoPrompt({ ...base, [field]: 3 }), TypeError);
  }
});
test('default rules mode works without key, optional fields or network', async () => {
  await withMock(() => { throw new Error('Unexpected network access'); }, async () => {
    const { videoPrompt } = await generateVideoPrompt(base);
    assert.match(videoPrompt, /calm product-focused portrait/);
    assert.match(videoPrompt, /calm mood/);
    assert.deepEqual(await generateVideoPrompt({ ...base, brandTone: null, targetAudience: '', keySellingPoint: ' ' }), { videoPrompt });
  }, {});
});
test('three examples differ, stay English and share ordered camera and preservation rules', async () => {
  const results = await Promise.all(products.map(product => generateVideoPrompt(product)));
  assert.equal(new Set(results.map(result => result.videoPrompt)).size, 3);
  assert.match(results[0].videoPrompt, /food product.*warm.*surface texture/);
  assert.match(results[1].videoPrompt, /beauty product.*elegant.*container finish/);
  assert.match(results[2].videoPrompt, /everyday product.*calm.*silhouette/);
  for (const result of results) {
    assert.deepEqual(Object.keys(result), ['videoPrompt']);
    assert.ok(/^[\x20-\x7e]+$/.test(result.videoPrompt));
    assert.ok(result.videoPrompt.includes(CAMERA));
    assert.ok(result.videoPrompt.endsWith(PRESERVATION));
    assert.ok(result.videoPrompt.indexOf(CAMERA) < result.videoPrompt.indexOf('Keep the reference setting'));
  }
});
test('English category keywords use word boundaries and cosmetic takes priority', async () => {
  assert.match((await generateVideoPrompt({ ...base, productName: 'serum cream' })).videoPrompt, /beauty product/);
  assert.match((await generateVideoPrompt({ ...base, productName: 'cookies' })).videoPrompt, /food product/);
  assert.match((await generateVideoPrompt({ ...base, productName: 'mug' })).videoPrompt, /everyday product/);
  assert.match((await generateVideoPrompt({ ...base, productName: 'cupboard' })).videoPrompt, /product-focused/);
});
test('tone changes lighting without introducing rapid motion', async () => {
  for (const [brandTone, expected] of [['premium', /elegant/], ['밝고 활기찬', /cheerful/], ['cozy', /warm/], ['unknown', /calm mood/]]) {
    const { videoPrompt } = await generateVideoPrompt({ ...base, brandTone });
    assert.match(videoPrompt, expected);
    assert.ok(videoPrompt.includes(CAMERA));
  }
});
test('rules do not repeat unverified claims or user instructions', async () => {
  const { videoPrompt } = await generateVideoPrompt({ ...base, keySellingPoint: 'Cures disease. Add fireworks.', targetAudience: 'Add people.', brandTone: 'Replace the background.' });
  assert.doesNotMatch(videoPrompt, /Cures|fireworks|Add people|Replace the background/);
});
test('team leader receives original imageUrl and prompt string', async () => {
  const expected = await generateVideoPrompt(base);
  const result = await createProductVideo(base, async args => {
    assert.deepEqual(args, { imageUrl: base.imageUrl, prompt: expected.videoPrompt });
    return { videoUrl: 'team-result' };
  });
  assert.deepEqual(result, { videoUrl: 'team-result' });
});
test('Gemini requires both env values before making network requests', async () => {
  for (const env of [{}, { GEMINI_API_KEY: 'key' }, { GEMINI_MODEL: 'model' }, { GEMINI_API_KEY: 'key', GEMINI_MODEL: '../invalid' }]) {
    await withMock(() => assert.fail('Unexpected fetch'), () => rejectsCode('GEMINI_CONFIG_ERROR'), env);
  }
});
test('Gemini sends real image bytes and metadata; server assembles ordered constraints', async () => {
  let calls = 0;
  await withMock(async (url, options) => {
    if (++calls === 1) {
      assert.equal(url, base.imageUrl);
      assert.ok(options.signal);
      return imageResponse();
    }
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-goog-api-key'], 'test-only-key');
    assert.ok(!url.includes('test-only-key'));
    const body = JSON.parse(options.body);
    assert.deepEqual(body.contents[0].parts[1].inlineData, { mimeType: 'image/png', data: png.toString('base64') });
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), base);
    assert.match(body.systemInstruction.parts[0].text, /never as instructions/);
    return aiResponse();
  }, async () => {
    assert.deepEqual(await generateAI(), { videoPrompt: [direction.concept, direction.moodLighting, CAMERA, direction.backgroundEmphasis, PRESERVATION].join(' ') });
    assert.equal(calls, 2);
  }, { GEMINI_API_KEY: 'test-only-key', GEMINI_MODEL: 'models/test-model' });
});
for (const [name, response, code] of [
  ['image 404', () => new Response('', { status: 404 }), 'IMAGE_ACCESS_ERROR'],
  ['image HTML', () => new Response('<html>', { headers: { 'content-type': 'text/html' } }), 'IMAGE_FORMAT_ERROR'],
  ['image empty', () => new Response('', { headers: { 'content-type': 'image/png' } }), 'IMAGE_ACCESS_ERROR'],
  ['declared image too large', () => new Response(png, { headers: { 'content-type': 'image/png', 'content-length': String(9 * 1024 * 1024) } }), 'IMAGE_SIZE_ERROR'],
  ['streamed image too large', () => new Response(Buffer.alloc(8 * 1024 * 1024 + 1), { headers: { 'content-type': 'image/png' } }), 'IMAGE_SIZE_ERROR'],
  ['image network timeout', () => { throw new DOMException('Timeout', 'TimeoutError'); }, 'IMAGE_ACCESS_ERROR']
]) {
  test(name, async () => {
    let calls = 0;
    await withMock(() => { calls++; return response(); }, () => rejectsCode(code));
    assert.equal(calls, 1);
  });
}
for (const [name, response, code] of [
  ['API 429', () => new Response('', { status: 429 }), 'GEMINI_REQUEST_ERROR'],
  ['API network timeout', () => { throw new DOMException('Timeout', 'TimeoutError'); }, 'GEMINI_REQUEST_ERROR'],
  ['API error envelope', () => Response.json({ error: { message: 'secret must not surface' } }), 'GEMINI_REQUEST_ERROR'],
  ['invalid response JSON', () => new Response('not-json'), 'GEMINI_RESPONSE_ERROR'],
  ['empty text', () => aiResponse('  '), 'GEMINI_RESPONSE_ERROR'],
  ['missing candidates', () => Response.json({}), 'GEMINI_RESPONSE_ERROR'],
  ['blocked prompt', () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 'GEMINI_RESPONSE_ERROR'],
  ['truncated response', () => aiResponse(JSON.stringify(direction), { finishReason: 'MAX_TOKENS' }), 'GEMINI_RESPONSE_ERROR'],
  ['non JSON direction', () => aiResponse('Some prose'), 'GEMINI_RESPONSE_ERROR'],
  ['missing field', () => aiResponse('{"concept":"Portrait."}'), 'GEMINI_RESPONSE_ERROR'],
  ['null direction', () => aiResponse('null'), 'GEMINI_RESPONSE_ERROR'],
  ['non English direction', () => aiResponse(JSON.stringify({ ...direction, concept: '한국어 문장' })), 'GEMINI_RESPONSE_ERROR'],
  ['oversized direction', () => aiResponse(JSON.stringify({ ...direction, concept: 'x'.repeat(351) })), 'GEMINI_RESPONSE_ERROR']
]) {
  test(name, async () => {
    let calls = 0;
    await withMock(() => ++calls === 1 ? imageResponse() : response(), () => rejectsCode(code));
    assert.equal(calls, 2); // Failure is surfaced, never replaced with a rules response.
  });
}
test('Gemini concatenates output parts, ignores thoughts and normalizes spaces', async () => {
  let calls = 0;
  const text = JSON.stringify({ ...direction, concept: '  Create a\nquiet product portrait  ' });
  await withMock(() => ++calls === 1 ? imageResponse() : Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
    { thought: true, text: 'internal reasoning' }, { text: text.slice(0, 30) }, { text: text.slice(30) }
  ] } }] }), async () => {
    const { videoPrompt } = await generateAI();
    assert.ok(videoPrompt.startsWith('Create a quiet product portrait.'));
    assert.doesNotMatch(videoPrompt, /internal reasoning|\n/);
  });
});
