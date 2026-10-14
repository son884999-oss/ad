const { rulesPrompt } = require('./rules');
const { geminiPrompt } = require('./gemini');

/** Generate a video direction prompt. Both modes return Promise<{videoPrompt: string}>. */
async function generateVideoPrompt(productData, { mode = 'rules' } = {}) {
  if (!productData || typeof productData !== 'object' || Array.isArray(productData)) {
    throw new TypeError('productData must be an object.');
  }
  const product = {};
  for (const field of ['productName', 'productDescription', 'imageUrl']) {
    if (typeof productData[field] !== 'string' || !productData[field].trim()) {
      throw new TypeError(`${field} must be a nonempty string.`);
    }
    product[field] = productData[field].trim();
  }
  let url;
  try { url = new URL(product.imageUrl); } catch { throw new TypeError('imageUrl must be an HTTP(S) URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError('imageUrl must be an HTTP(S) URL without embedded credentials.');
  }
  for (const field of ['keySellingPoint', 'targetAudience', 'brandTone']) {
    const value = productData[field];
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') throw new TypeError(`${field} must be a string when provided.`);
      if (value.trim()) product[field] = value.trim();
    }
  }
  if (!['rules', 'gemini'].includes(mode)) throw new TypeError('mode must be rules or gemini.');
  const videoPrompt = mode === 'rules' ? rulesPrompt(product) : await geminiPrompt(product);
  return { videoPrompt };
}

module.exports = { generateVideoPrompt };
