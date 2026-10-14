// ============================================================
// B_이창훈: 자동 테스트 — API 키와 인터넷 없이 실행된다 (node --test)
// 실제 Claude 대신 가짜 응답을 돌려주어 검증·품질 점검·재작성 흐름을 확인한다.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePromo, normalizeProduct, parsePromoResponse, reviewPromo, PromoFormatError, MOCK_PROMO,
} from './promo.mjs';

const product = { productName: '우리동네 참기름', productDescription: '국산 참깨를 저온에서 직접 짜낸 참기름' };
const good = JSON.stringify({
  copyCandidates: ['뚜껑 여는 순간 고소함이 먼저', '나물 한 접시가 달라지는 한 방울', '참기름, 어디서 사세요?'],
  copy: '뚜껑 여는 순간 고소함이 먼저, 우리동네 참기름',
  sns: '비빔밥에 한 방울 두르면 고소한 향이 확 올라와요. 국산 참깨를 낮은 온도에서 짜서 향이 진해요. 이번 주말 장 보러 오실 때 들러 보세요.',
  intro: '나물 무침이나 비빔밥에 마지막으로 두르기 좋은 참기름입니다. 낮은 온도로 짜 고소한 향이 오래 남습니다.',
  hashtags: ['#참기름', '국산 참깨', '참기름', '방앗간', '고소함', '집밥', '나물', '추가'],
});
// 설명 되풀이 + 상투어가 들어간 나쁜 응답
const bad = JSON.stringify({
  copy: '정성 가득 프리미엄 참기름',
  sns: '좋아요. 들러 주세요.',
  intro: '우리동네 참기름은 국산 참깨를 저온에서 직접 짜낸 참기름입니다.',
  hashtags: ['참기름', '국산참기름', '저온압착', '고소함'],
});

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

test('mock 모드는 키 없이 고정 결과를 돌려주고, 기본 모양은 4개 항목', async () => {
  const r = await generatePromo(product, { mode: 'mock' });
  assert.deepEqual(Object.keys(r), ['copy', 'sns', 'intro', 'hashtags']);
  assert.equal(r.copy, MOCK_PROMO.copy);
});

test('필수값·채널·mode가 틀리면 TypeError', async () => {
  await assert.rejects(generatePromo({ productName: '참기름' }, { mode: 'mock' }), TypeError);
  await assert.rejects(generatePromo({ ...product, channel: 'facebook' }, { mode: 'mock' }), TypeError);
  await assert.rejects(generatePromo(product, { mode: 'gpt' }), TypeError);
});

test('C 입력폼 형식(keyFeatures 배열, brandTone auto)과 가게 정보·채널을 정리한다', () => {
  const p = normalizeProduct({
    ...product, keyFeatures: [' 국산 참깨 ', '', '저온 압착'], targetAudience: '', brandTone: 'auto',
    shopName: ' 대전 방앗간 ', channel: 'instagram',
  });
  assert.equal(p.keyFeatures, '국산 참깨, 저온 압착');
  assert.equal(p.targetAudience, undefined);
  assert.equal(p.brandTone, undefined);
  assert.equal(p.shopName, '대전 방앗간');
  assert.equal(p.channel, 'instagram');
});

test('응답 해석: 코드블록·앞 설명이 있어도 JSON만 읽고 해시태그·후보를 정리한다', () => {
  for (const text of [good, '```json\n' + good + '\n```', '네, 작성했습니다:\n' + good]) {
    const r = parsePromoResponse(text);
    assert.deepEqual(r.hashtags, ['참기름', '국산참깨', '방앗간', '고소함', '집밥', '나물']);
    assert.equal(r.copyCandidates.length, 3);
  }
});

test('응답 해석: 형식이 틀리면 PromoFormatError', () => {
  for (const text of ['작성할 수 없습니다', '{"copy":"a","sns":', '{"copy":"a","sns":"b","hashtags":["a","b","c","d"]}',
    '{"copy":"a","sns":"b","intro":"c","hashtags":["a","#a","b"]}']) {
    assert.throws(() => parsePromoResponse(text), PromoFormatError);
  }
});

test('품질 점검: 상투어·설명 되풀이·의학 표현·긴 해시태그를 찾는다', () => {
  const p = normalizeProduct(product);
  const problems = reviewPromo(parsePromoResponse(bad), p);
  assert.ok(problems.some((m) => m.includes('상투어') && m.includes('정성') && m.includes('프리미엄')));
  assert.ok(problems.some((m) => m.includes('intro') && m.includes('되풀이')));

  const medical = reviewPromo({ ...parsePromoResponse(good), sns: '혈압에 좋아요.', hashtags: ['아주아주긴해시태그입니다요'] }, p);
  assert.ok(medical.some((m) => m.includes('의학') && m.includes('혈압')));
  assert.ok(medical.some((m) => m.includes('해시태그가 너무 김')));

  assert.deepEqual(reviewPromo(parsePromoResponse(good), p), []);
});

test('품질 점검: 입력에 있던 말은 상투어로 보지 않는다', () => {
  const p = normalizeProduct({ productName: '프리미엄 참기름', productDescription: '국산 참깨로 짠 참기름' });
  const r = { ...parsePromoResponse(good), copy: '고소함이 다른 프리미엄 참기름' };
  assert.ok(!reviewPromo(r, p).some((m) => m.includes('상투어')));
});

test('Claude 호출: 좋은 응답이면 1번만 호출하고, 선택값·가게 정보·채널은 있을 때만 보낸다', async () => {
  replies = [good]; sentBodies.length = 0;
  const r = await generatePromo({ ...product, keyFeatures: ['저온 압착'], shopName: '대전 방앗간', channel: 'kakao' });
  assert.equal(sentBodies.length, 1);
  assert.equal(r.copy, '뚜껑 여는 순간 고소함이 먼저, 우리동네 참기름');
  assert.equal(r.copyCandidates, undefined);
  const prompt = sentBodies[0].messages[0].content;
  assert.match(prompt, /제품 특징: 저온 압착/);
  assert.match(prompt, /가게 이름: 대전 방앗간/);
  assert.match(prompt, /카카오톡 채널/);
  assert.doesNotMatch(prompt, /타깃 고객/);
});

test('Claude 호출: 가게 정보가 없으면 지어내지 말라고 알린다', async () => {
  replies = [good]; sentBodies.length = 0;
  await generatePromo(product);
  assert.match(sentBodies[0].messages[0].content, /가게 정보 없음/);
});

test('Claude 호출: includeCandidates면 카피 후보 3개도 돌려준다', async () => {
  replies = [good];
  const r = await generatePromo(product, { includeCandidates: true });
  assert.equal(r.copyCandidates.length, 3);
});

test('Claude 호출: 품질 문제가 있으면 문제를 짚어 1회 다시 쓰게 하고, 좋은 결과를 돌려준다', async () => {
  replies = [bad, good]; sentBodies.length = 0;
  const r = await generatePromo(product);
  assert.equal(sentBodies.length, 2);
  const retry = sentBodies[1].messages[0].content;
  assert.match(retry, /상투어/);
  assert.match(retry, /되풀이/);
  assert.equal(r.copy, '뚜껑 여는 순간 고소함이 먼저, 우리동네 참기름');
});

test('Claude 호출: 다시 써도 문제가 남으면 서비스를 멈추지 않고 문제가 더 적은 결과를 돌려준다', async () => {
  replies = [bad, bad]; sentBodies.length = 0;
  const r = await generatePromo(product);
  assert.equal(sentBodies.length, 2);
  assert.equal(r.copy, '정성 가득 프리미엄 참기름');
});

test('Claude 호출: 다시 쓴 응답이 형식 오류면 첫 결과를 돌려준다', async () => {
  replies = [bad, '형식 안 맞는 답']; sentBodies.length = 0;
  const r = await generatePromo(product);
  assert.equal(r.copy, '정성 가득 프리미엄 참기름');
});

test('Claude 호출: 첫 응답 형식 오류 → 1회 재시도, 2회 모두 형식 오류면 한국어 오류', async () => {
  replies = ['형식 안 맞는 답', good]; sentBodies.length = 0;
  await generatePromo(product);
  assert.equal(sentBodies.length, 2);
  assert.match(sentBodies[1].messages[0].content, /응답 형식 오류/);

  replies = ['틀림', '또 틀림'];
  await assert.rejects(generatePromo(product), /홍보문구 응답 형식이 올바르지 않습니다\(2회 시도\)/);
});
