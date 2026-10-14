// ============================================================
// B_이창훈: AI 홍보문구 생성 — 서버용 모듈 (담당: 이창훈)
// 광고 카피 · SNS 홍보문구 · 제품 소개 문장 · 해시태그 4종을 만든다.
//
//   import { generatePromo } from './B_이창훈/promo.mjs';
//   const promoText = await generatePromo(productData);              // Claude API
//   const sample    = await generatePromo(productData, { mode: 'mock' }); // 키 없이 고정 결과
//
// API 키(ANTHROPIC_API_KEY)는 서버 환경변수로만 읽는다. 브라우저 코드에서 import하지 않는다.
// ============================================================
import Anthropic from '@anthropic-ai/sdk';
import {
  PROMO_SYSTEM_PROMPT, CLICHE_WORDS, MEDICAL_WORDS, CHANNEL_STYLES,
  buildPromoUserPrompt, buildRetryNote,
} from './prompt.mjs';

/** 기본 모델 — 환경변수 PROMO_MODEL로 바꿀 수 있다 */
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS = 2048;
const HASHTAG_MIN = 4;
const HASHTAG_MAX = 6;
const HASHTAG_MAX_LENGTH = 10;
/** 제품 설명과 이 글자 수 이상 똑같이 이어지면 "되풀이"로 본다 (띄어쓰기·문장부호 제외) */
const REPEAT_LIMIT = 12;

/** mock 모드에서 돌려주는 고정 결과 (화면·통합 연결 확인용) */
export const MOCK_PROMO = Object.freeze({
  copy: '자연이 담긴 프리미엄 케어, 초이셀코리아 샴푸',
  sns: '두피는 더 가볍게, 모발은 더 건강하게. 자연 유래 성분으로 매일이 다른 변화를 느껴보세요.',
  intro: '초이셀코리아 샴푸는 자연 유래 성분으로 두피를 부드럽게 진정시키는 프리미엄 샴푸입니다.',
  hashtags: Object.freeze(['초이셀코리아', '두피케어', '프리미엄샴푸', '건강한모발']),
});

/** Claude 응답 형식이 약속과 다를 때 쓰는 오류 */
export class PromoFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PromoFormatError';
  }
}

let client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다. 이 폴더의 .env.local을 확인하세요.');
  }
  // 키는 SDK가 환경변수에서 직접 읽는다 — 코드나 로그에 키를 남기지 않는다
  client ??= new Anthropic();
  return client;
}

/** 문자열 또는 문자열 배열을 한 줄 문자열로 정리 (C 입력폼의 keyFeatures는 배열) */
function toText(value, field) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) {
    if (!value.every((v) => typeof v === 'string')) {
      throw new TypeError(`${field}는 문자열 또는 문자열 배열이어야 합니다.`);
    }
    return value.map((v) => v.trim()).filter(Boolean).join(', ');
  }
  if (typeof value !== 'string') throw new TypeError(`${field}는 문자열이어야 합니다.`);
  return value.trim();
}

/**
 * 입력값 확인·정리. 필수값이 없거나 형식이 틀리면 TypeError.
 * C 입력폼의 brandTone 기본값 "auto"는 "지정 안 함"으로 본다.
 */
export function normalizeProduct(productData) {
  if (!productData || typeof productData !== 'object' || Array.isArray(productData)) {
    throw new TypeError('productData는 객체여야 합니다.');
  }
  const product = {};
  for (const [field, label] of [['productName', '제품명'], ['productDescription', '제품 설명']]) {
    const value = productData[field];
    if (typeof value !== 'string' || !value.trim()) {
      throw new TypeError(`${label}(${field})이 비어 있습니다.`);
    }
    product[field] = value.trim();
  }
  // 선택 항목: 제품 정보 + 가게 정보 (값이 있을 때만 프롬프트에 들어감)
  for (const field of ['keyFeatures', 'targetAudience', 'brandTone', 'shopName', 'location', 'priceInfo', 'contact']) {
    const text = toText(productData[field], field);
    if (text) product[field] = text;
  }
  if (product.brandTone?.toLowerCase() === 'auto') delete product.brandTone;

  // 선택 항목: 홍보할 곳(채널) — 통합 화면의 채널 이름과 같다
  const channel = toText(productData.channel, 'channel');
  if (channel) {
    if (!Object.hasOwn(CHANNEL_STYLES, channel)) {
      throw new TypeError(`channel은 ${Object.keys(CHANNEL_STYLES).join(', ')} 중 하나여야 합니다.`);
    }
    product.channel = channel;
  }
  return product;
}

/** 해시태그 정리: '#'·공백 제거, 중복 제거, 최대 6개 */
function normalizeHashtags(raw) {
  const tags = raw
    .filter((t) => typeof t === 'string')
    .map((t) => t.replace(/#/g, '').replace(/\s+/g, '').trim())
    .filter((t) => t.length > 0);
  return [...new Set(tags)].slice(0, HASHTAG_MAX);
}

/**
 * Claude 응답 텍스트를 { copy, sns, intro, hashtags, copyCandidates }로 변환한다.
 * JSON이 아니거나 필수 항목이 빠지면 PromoFormatError를 던진다.
 */
export function parsePromoResponse(text) {
  // 코드 블록이나 앞뒤 설명이 섞여 와도 첫 '{'부터 마지막 '}'까지만 사용
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new PromoFormatError('JSON 객체를 찾지 못함');

  let data;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new PromoFormatError('JSON 해석 실패');
  }

  const missing = ['copy', 'sns', 'intro'].filter(
    (key) => typeof data[key] !== 'string' || !data[key].trim(),
  );
  if (missing.length > 0) throw new PromoFormatError(`항목 누락: ${missing.join(', ')}`);
  if (!Array.isArray(data.hashtags)) throw new PromoFormatError('항목 누락: hashtags');

  const hashtags = normalizeHashtags(data.hashtags);
  if (hashtags.length < HASHTAG_MIN) {
    throw new PromoFormatError(`해시태그 부족: ${hashtags.length}개 (최소 ${HASHTAG_MIN}개)`);
  }

  const copyCandidates = Array.isArray(data.copyCandidates)
    ? data.copyCandidates.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim())
    : [];

  return {
    copy: data.copy.trim(),
    sns: data.sns.trim(),
    intro: data.intro.trim(),
    hashtags,
    copyCandidates,
  };
}

/** 띄어쓰기·문장부호를 빼고 비교용 문자열로 만든다 */
function squeeze(text) {
  return text.replace(/[\s.,!?·~"'“”‘’()[\]…\-]/g, '');
}

/** 두 문자열에서 똑같이 이어지는 가장 긴 부분의 길이 */
function longestCommonRun(a, b) {
  let best = 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/**
 * 결과 품질 자동 점검 — 문제 목록을 돌려준다 (없으면 빈 배열).
 * 상투어(입력에 없는 경우), 의학 표현, 제품 설명 되풀이, 해시태그 길이를 본다.
 */
export function reviewPromo(result, product) {
  const problems = [];
  const output = [result.copy, result.sns, result.intro, ...result.hashtags].join(' ');
  const input = Object.values(product).join(' ');

  const cliches = CLICHE_WORDS.filter((w) => output.includes(w) && !input.includes(w));
  if (cliches.length) problems.push(`뻔한 상투어 사용: ${cliches.join(', ')} — 구체적인 사실이나 감각 표현으로 바꿀 것`);

  const medical = MEDICAL_WORDS.filter((w) => output.includes(w));
  if (medical.length) problems.push(`의학적 효능 표현 사용: ${medical.join(', ')} — 효능을 말하지 말고 사용감·경험으로 바꿀 것`);

  const name = squeeze(product.productName);
  const description = squeeze(product.productDescription).replaceAll(name, '');
  for (const [key, label] of [['intro', '제품 소개'], ['sns', 'SNS 문구']]) {
    const run = longestCommonRun(squeeze(result[key]).replaceAll(name, ''), description);
    if (run >= REPEAT_LIMIT) {
      problems.push(`${label}(${key})가 사장님이 쓴 제품 설명을 거의 그대로 되풀이함 — 손님이 얻는 경험으로 바꿔 쓸 것`);
    }
  }

  const longTags = result.hashtags.filter((t) => t.length > HASHTAG_MAX_LENGTH);
  if (longTags.length) problems.push(`해시태그가 너무 김(${HASHTAG_MAX_LENGTH}자 초과): ${longTags.join(', ')}`);

  return problems;
}

/** Claude API를 한 번 호출해 응답 텍스트를 받는다 */
async function requestPromoText(product, retryNote) {
  const userPrompt = buildPromoUserPrompt(product) + (retryNote ? `\n\n${retryNote}` : '');
  const message = await getClient().messages.create({
    model: process.env.PROMO_MODEL || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: PROMO_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
}

/** 반환할 모양으로 정리 — 기본은 { copy, sns, intro, hashtags } */
function toOutput(result, includeCandidates) {
  const { copy, sns, intro, hashtags, copyCandidates } = result;
  return includeCandidates ? { copy, sns, intro, hashtags, copyCandidates } : { copy, sns, intro, hashtags };
}

/**
 * 제품 정보로 홍보문구 4종을 만든다.
 * @param {object} productData { productName, productDescription, keyFeatures?, targetAudience?, brandTone?,
 *                               shopName?, location?, priceInfo?, contact?, channel? }
 * @param {{mode?: 'claude' | 'mock', includeCandidates?: boolean}} [options]
 *        mode 기본 'claude' / includeCandidates가 true면 광고 카피 후보 3개(copyCandidates)도 함께 돌려준다
 * @returns {Promise<{copy: string, sns: string, intro: string, hashtags: string[], copyCandidates?: string[]}>}
 */
export async function generatePromo(productData, { mode = 'claude', includeCandidates = false } = {}) {
  if (!['claude', 'mock'].includes(mode)) throw new TypeError("mode는 'claude' 또는 'mock'이어야 합니다.");
  const product = normalizeProduct(productData);

  if (mode === 'mock') {
    const mock = { ...MOCK_PROMO, hashtags: [...MOCK_PROMO.hashtags], copyCandidates: [MOCK_PROMO.copy] };
    return toOutput(mock, includeCandidates);
  }

  // 최대 2번 호출: 형식 오류나 품질 문제가 있으면 문제를 짚어서 1회 다시 쓰게 한다.
  // (네트워크·일시 장애 재시도는 SDK가 자동 처리)
  let best = null; // { result, problems }
  let retryNote;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let text;
    try {
      text = await requestPromoText(product, retryNote);
    } catch (err) {
      if (best) break; // 첫 결과가 있으면 그것을 쓴다
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`홍보문구 생성 중 Claude API 호출에 실패했습니다: ${reason}`, { cause: err });
    }

    let result;
    try {
      result = parsePromoResponse(text);
    } catch (err) {
      if (!(err instanceof PromoFormatError)) throw err;
      if (best) break; // 다시 쓴 결과가 형식 오류면 첫 결과를 쓴다
      if (attempt === 2) {
        throw new Error(`홍보문구 응답 형식이 올바르지 않습니다(2회 시도): ${err.message}`, { cause: err });
      }
      retryNote = buildRetryNote([`응답 형식 오류: ${err.message}`]);
      continue;
    }

    const problems = reviewPromo(result, product);
    if (!best || problems.length < best.problems.length) best = { result, problems };
    if (problems.length === 0) break;
    retryNote = buildRetryNote(problems);
  }

  // 품질 문제가 조금 남아도 서비스는 멈추지 않고, 문제가 가장 적은 결과를 돌려준다
  return toOutput(best.result, includeCandidates);
}
