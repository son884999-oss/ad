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
import { PROMO_SYSTEM_PROMPT, buildPromoUserPrompt, buildRetryNote } from './prompt.mjs';

/** 기본 모델 — 환경변수 PROMO_MODEL로 바꿀 수 있다 */
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS = 1024;
const HASHTAG_MIN = 4;
const HASHTAG_MAX = 6;

/** mock 모드에서 돌려주는 고정 결과 (화면·통합 연결 확인용) */
export const MOCK_PROMO = Object.freeze({
  copy: '자연이 담긴 프리미엄 케어, 초이셀코리아 샴푸',
  sns: '두피는 더 가볍게, 모발은 더 건강하게. 자연 유래 성분으로 매일이 다른 변화를 느껴보세요.',
  intro: '초이셀코리아 샴푸는 자연 유래 성분으로 두피를 부드럽게 진정시키는 프리미엄 샴푸입니다.',
  hashtags: Object.freeze(['초이셀코리아', '두피케어', '프리미엄샴푸', '건강한모발']),
});

/** Claude 응답 형식이 약속과 다를 때 쓰는 오류 — 이 오류일 때만 재시도한다 */
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
 * 입력값 확인·정리. 필수값이 없으면 TypeError.
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
  const keyFeatures = toText(productData.keyFeatures, 'keyFeatures');
  const targetAudience = toText(productData.targetAudience, 'targetAudience');
  const brandTone = toText(productData.brandTone, 'brandTone');
  if (keyFeatures) product.keyFeatures = keyFeatures;
  if (targetAudience) product.targetAudience = targetAudience;
  if (brandTone && brandTone.toLowerCase() !== 'auto') product.brandTone = brandTone;
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
 * Claude 응답 텍스트를 { copy, sns, intro, hashtags }로 변환한다.
 * JSON이 아니거나 항목이 빠지면 PromoFormatError를 던진다.
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

  return {
    copy: data.copy.trim(),
    sns: data.sns.trim(),
    intro: data.intro.trim(),
    hashtags,
  };
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

/**
 * 제품 정보로 홍보문구 4종을 만든다.
 * @param {object} productData { productName, productDescription, keyFeatures?, targetAudience?, brandTone? }
 * @param {{mode?: 'claude' | 'mock'}} [options] 기본 'claude'
 * @returns {Promise<{copy: string, sns: string, intro: string, hashtags: string[]}>}
 */
export async function generatePromo(productData, { mode = 'claude' } = {}) {
  if (!['claude', 'mock'].includes(mode)) throw new TypeError("mode는 'claude' 또는 'mock'이어야 합니다.");
  const product = normalizeProduct(productData);

  if (mode === 'mock') {
    return { ...MOCK_PROMO, hashtags: [...MOCK_PROMO.hashtags] };
  }

  // 형식 오류일 때만 1회 재시도 (네트워크·일시 장애 재시도는 SDK가 자동 처리)
  let retryNote;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let text;
    try {
      text = await requestPromoText(product, retryNote);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`홍보문구 생성 중 Claude API 호출에 실패했습니다: ${reason}`, { cause: err });
    }

    try {
      return parsePromoResponse(text);
    } catch (err) {
      if (!(err instanceof PromoFormatError)) throw err;
      if (attempt === 2) {
        throw new Error(`홍보문구 응답 형식이 올바르지 않습니다(2회 시도): ${err.message}`, { cause: err });
      }
      retryNote = buildRetryNote(err.message);
    }
  }
  throw new Error('홍보문구 생성에 실패했습니다.');
}
