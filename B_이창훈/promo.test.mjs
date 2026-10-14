// ============================================================
// B_이창훈: 자동 테스트 — API 키와 인터넷 없이 실행된다 (node --test)
// 실제 Claude 대신 가짜 응답을 돌려주어 검증·재시도 흐름을 확인한다.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePromo, normalizeProduct, parsePromoResponse, PromoFormatError, MOCK_PROMO } from './promo.mjs';

const product = { productName: '우리동네 참기름', productDescription: '국산 참깨로 직접 짠 참기름' };
const good = '{"copy":"고소함 한 방울","sns":"오늘 짰어요. 놀러오세요!","intro":"참기름입니다.","hashtags":["#참기름","국산 참깨","참기름","방앗간","고소함","집밥","선물","추가"]}';

// ---- 가짜 Claude 서버: replies를 순서대로 돌려준다 ----
let replies = [];
const sentBodies = [];
globalThis.fetch = async (_url, init) => {
  sentBodies.push(JSON.parse(init.body));
  const text = replies.shift() ?? good;
  const body = {
    id: 'msg_test', type: 'message', role: 'assistant', model: 'test', stop_reason: 'end_turn',
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text }],
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
process.env.ANTHROPIC_API_KEY = 'test-key';

test('mock 모드는 키 없이 고정 결과를 돌려준다', async () => {
  const r = await generatePromo(product, { mode: 'mock' });
  assert.equal(r.copy, MOCK_PROMO.copy);
  assert.equal(r.hashtags.length, 4);
});

test('필수값이 없으면 TypeError', async () => {
  await assert.rejects(generatePromo({ productName: '참기름' }, { mode: 'mock' }), TypeError);
  await assert.rejects(generatePromo({ productName: ' ', productDescription: 'x' }, { mode: 'mock' }), TypeError);
  await assert.rejects(generatePromo(product, { mode: 'gpt' }), TypeError);
});

test('C 입력폼 형식(keyFeatures 배열, brandTone auto)을 정리한다', () => {
  const p = normalizeProduct({ ...product, keyFeatures: [' 국산 참깨 ', '', '저온 압착'], targetAudience: '', brandTone: 'auto' });
  assert.equal(p.keyFeatures, '국산 참깨, 저온 압착');
  assert.equal(p.targetAudience, undefined);
  assert.equal(p.brandTone, undefined);
});

test('응답 해석: 코드블록·앞 설명이 있어도 JSON만 읽고 해시태그를 정리한다', () => {
  for (const text of [good, '```json\n' + good + '\n```', '네, 작성했습니다:\n' + good]) {
    const r = parsePromoResponse(text);
    assert.deepEqual(r.hashtags, ['참기름', '국산참깨', '방앗간', '고소함', '집밥', '선물']);
  }
});

test('응답 해석: 형식이 틀리면 PromoFormatError', () => {
  for (const text of ['작성할 수 없습니다', '{"copy":"a","sns":', '{"copy":"a","sns":"b","hashtags":["a","b","c","d"]}',
    '{"copy":"a","sns":"b","intro":"c","hashtags":["a","#a","b"]}']) {
    assert.throws(() => parsePromoResponse(text), PromoFormatError);
  }
});

test('Claude 호출: 정상 응답이면 1번만 호출하고, 선택값은 있을 때만 보낸다', async () => {
  replies = [good]; sentBodies.length = 0;
  const r = await generatePromo({ ...product, keyFeatures: ['저온 압착'] });
  assert.equal(sentBodies.length, 1);
  assert.equal(r.copy, '고소함 한 방울');
  const prompt = sentBodies[0].messages[0].content;
  assert.match(prompt, /제품 특징: 저온 압착/);
  assert.doesNotMatch(prompt, /타깃 고객/);
});

test('Claude 호출: 첫 응답 형식 오류 → 안내를 붙여 1회 재시도', async () => {
  replies = ['형식 안 맞는 답', good]; sentBodies.length = 0;
  const r = await generatePromo(product);
  assert.equal(sentBodies.length, 2);
  assert.match(sentBodies[1].messages[0].content, /직전 응답이 형식에 맞지 않았습니다/);
  assert.equal(r.hashtags.length, 6);
});

test('Claude 호출: 2회 모두 형식 오류면 한국어 오류', async () => {
  replies = ['틀림', '또 틀림']; sentBodies.length = 0;
  await assert.rejects(generatePromo(product), /홍보문구 응답 형식이 올바르지 않습니다\(2회 시도\)/);
  assert.equal(sentBodies.length, 2);
});
