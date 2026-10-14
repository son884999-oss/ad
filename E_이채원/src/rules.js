const PRESERVATION = 'Preserve the reference composition and background, product shape, proportions, colors, label text and logo. Keep the product stationary; avoid rapid motion, cuts, morphing, new objects, added text, invented effects and unsupported product benefits.';
const CAMERA = 'Use one continuous 10-second shot with a slow, subtle camera push-in, keeping the entire product and label readable.';

const categories = [
  { pattern: /화장품|세럼|로션|크림|스킨케어|립스틱|\b(cosmetic|cosmetics|serum|lotion|skincare|lipstick|moisturizer)\b/i,
    concept: 'Create a restrained beauty product portrait.',
    emphasis: 'Keep the reference setting and emphasize only the visible container finish and label details.' },
  { pattern: /쿠키|과자|식품|음료|커피|초콜릿|빵|\b(cookie|cookies|food|snack|coffee|chocolate|bread|drink)\b/i,
    concept: 'Create an inviting food product portrait.',
    emphasis: 'Keep the reference setting and emphasize only the visible surface texture and packaging details.' },
  { pattern: /머그|컵|생활용품|텀블러|수건|주방|\b(mug|cup|tumbler|towel|household|kitchen)\b/i,
    concept: 'Create a calm everyday product portrait.',
    emphasis: 'Keep the reference setting and emphasize only the visible silhouette and surface finish.' }
];
const general = {
  concept: 'Create a calm product-focused portrait.',
  emphasis: 'Keep the reference setting and emphasize only the visible product contours and details.'
};

function moodFor(tone = '') {
  if (/고급|우아|럭셔리|\b(luxury|premium|elegant)\b/i.test(tone)) {
    return 'Use an elegant, restrained mood with soft directional lighting consistent with the reference.';
  }
  if (/밝|활기|경쾌|발랄|\b(bright|playful|cheerful|energetic)\b/i.test(tone)) {
    return 'Use a cheerful mood with gentle bright lighting consistent with the reference.';
  }
  if (/따뜻|포근|\b(warm|cozy)\b/i.test(tone)) {
    return 'Use a warm, welcoming mood with soft lighting consistent with the reference.';
  }
  return 'Use a calm mood with soft balanced lighting consistent with the reference.';
}

function rulesPrompt(product) {
  const text = `${product.productName} ${product.productDescription}`;
  const rule = categories.find(({ pattern }) => pattern.test(text)) ?? general;
  return [rule.concept, moodFor(product.brandTone), CAMERA, rule.emphasis, PRESERVATION].join(' ');
}

module.exports = { rulesPrompt, CAMERA, PRESERVATION };
