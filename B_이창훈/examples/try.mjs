// ============================================================
// B_이창훈: 내 제품 정보를 직접 입력해 홍보문구를 시험하는 대화형 스크립트
//   node --env-file=.env.local examples/try.mjs     ← Claude API
//   node examples/try.mjs --mock                    ← 키 없이 고정 결과
// 선택 항목은 Enter만 누르면 건너뛴다. 끝내려면 Ctrl + C.
// ============================================================
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { generatePromo } from '../promo.mjs';

const mode = process.argv.includes('--mock') ? 'mock' : 'claude';
const rl = createInterface({ input: stdin, output: stdout });

/** 필수 항목: 비어 있으면 다시 묻는다 */
async function askRequired(label) {
  for (;;) {
    const answer = (await rl.question(`${label} (필수): `)).trim();
    if (answer) return answer;
    console.log('  → 꼭 입력해야 하는 항목입니다.');
  }
}

/** 선택 항목: Enter만 누르면 빈 값 (프롬프트에서 제외됨) */
async function askOptional(label, example) {
  return (await rl.question(`${label} (선택, 예: ${example}): `)).trim();
}

console.log(`\n=== B_이창훈 홍보문구 직접 테스트 (${mode === 'mock' ? 'mock 모드 — 항상 같은 샴푸 문구' : 'Claude API'}) ===`);
console.log('선택 항목은 Enter만 누르면 건너뜁니다. 끝내려면 Ctrl + C\n');

for (;;) {
  const product = {
    productName: await askRequired('제품명'),
    productDescription: await askRequired('제품 설명'),
    keyFeatures: await askOptional('제품 특징', '국산 원료, 무첨가, 당일 배송'),
    targetAudience: await askOptional('타깃 고객', '30대 직장인'),
    brandTone: await askOptional('브랜드 분위기', '따뜻하고 정겨운'),
  };

  console.log('\n생성 중...');
  const started = Date.now();
  try {
    const r = await generatePromo(product, { mode });
    console.log(`\n■ ${product.productName}  (${((Date.now() - started) / 1000).toFixed(1)}초)`);
    console.log(`  광고 카피 : ${r.copy}`);
    console.log(`  SNS 문구  : ${r.sns}`);
    console.log(`  소개 문장 : ${r.intro}`);
    console.log(`  해시태그  : ${r.hashtags.map((t) => `#${t}`).join(' ')}`);
  } catch (err) {
    console.log(`\n❌ 오류: ${err.message}`);
  }

  const again = (await rl.question('\n다른 제품도 해 볼까요? (y/n): ')).trim().toLowerCase();
  if (again !== 'y') break;
  console.log('');
}
rl.close();
