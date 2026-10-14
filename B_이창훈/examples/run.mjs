// ============================================================
// B_이창훈: 샘플 3종(샴푸·쿠키·가죽 지갑)으로 홍보문구를 만들어 출력한다.
//   node --env-file=.env.local examples/run.mjs     ← Claude API (키 필요, 사용량 발생)
//   node examples/run.mjs --mock                    ← 키 없이 고정 결과
// 3종 모두 형식이 맞으면 종료 코드 0, 하나라도 실패하면 1.
// 품질 점검에서 남은 지적은 "참고"로 보여 준다 (실패로 세지 않음).
// ============================================================
import { readFile } from 'node:fs/promises';
import { generatePromo, normalizeProduct, reviewPromo } from '../promo.mjs';
import { CHANNEL_STYLES } from '../prompt.mjs';

const mode = process.argv.includes('--mock') ? 'mock' : 'claude';
const products = JSON.parse(await readFile(new URL('./products.json', import.meta.url), 'utf8'));

/** 결과가 약속(copy·sns·intro·hashtags 4~6개, # 없음)을 지키는지 점검 */
function check(result) {
  const problems = [];
  for (const key of ['copy', 'sns', 'intro']) if (!result[key]) problems.push(`${key} 비어 있음`);
  if (result.hashtags.length < 4 || result.hashtags.length > 6) {
    problems.push(`해시태그 ${result.hashtags.length}개 (4~6개 필요)`);
  }
  if (result.hashtags.some((t) => t.includes('#') || /\s/.test(t))) problems.push('해시태그에 # 또는 공백 포함');
  return problems;
}

console.log(`\n=== B_이창훈 홍보문구 샘플 테스트 (${mode === 'mock' ? 'mock 모드' : 'Claude API'}) ===\n`);
let failed = 0;
for (const product of products) {
  const started = Date.now();
  try {
    const r = await generatePromo(product, { mode, includeCandidates: true });
    const problems = check(r);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const extra = [product.channel && `채널: ${product.channel}`, product.shopName && `가게: ${product.shopName}`]
      .filter(Boolean).join(', ');
    console.log(`■ ${product.productName}  (${seconds}초) ${problems.length ? '❌' : '✅'}${extra ? `  [${extra}]` : ''}`);
    if (r.copyCandidates.length > 1) {
      console.log(`  카피 후보 : ${r.copyCandidates.map((c, i) => `${i + 1}) ${c}`).join('  ')}`);
    }
    console.log(`  광고 카피 : ${r.copy}`);
    console.log(`  SNS 문구  : ${r.sns.replace(/\n/g, '\n              ')}`);
    console.log(`  소개 문장 : ${r.intro}`);
    console.log(`  해시태그  : ${r.hashtags.map((t) => `#${t}`).join(' ')}`);
    if (problems.length) {
      failed++;
      console.log(`  문제      : ${problems.join(' / ')}`);
    }
    if (mode === 'claude') {
      const notes = reviewPromo(r, normalizeProduct(product));
      if (notes.length) console.log(`  참고      : ${notes.join(' / ')}`);
    }
  } catch (err) {
    failed++;
    console.log(`■ ${product.productName}  ❌ 오류: ${err.message}`);
  }
  console.log('');
}
console.log(failed === 0 ? '결과: 3종 모두 통과 ✅' : `결과: ${failed}종 실패 ❌`);
console.log(`(사용할 수 있는 채널: ${Object.keys(CHANNEL_STYLES).join(', ')})`);
process.exitCode = failed === 0 ? 0 : 1;
