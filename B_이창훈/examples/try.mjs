// ============================================================
// B_이창훈: 내 제품 정보를 직접 입력해 홍보문구를 시험하는 대화형 스크립트
//   node --env-file=.env.local examples/try.mjs     ← Claude API
//   node examples/try.mjs --mock                    ← 키 없이 고정 결과
// 선택 항목은 Enter만 누르면 건너뛴다. 끝내려면 Ctrl + C.
// ============================================================
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { generatePromo } from '../promo.mjs';
import { CHANNEL_STYLES } from '../prompt.mjs';

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

/** 채널: 번호나 이름으로 고른다. Enter면 지정 안 함 */
async function askChannel() {
  const keys = Object.keys(CHANNEL_STYLES);
  const list = keys.map((k, i) => `${i + 1}) ${k}`).join('  ');
  for (;;) {
    const answer = (await rl.question(`홍보할 곳 (선택, Enter=지정 안 함)\n  ${list}\n  번호 또는 이름: `)).trim();
    if (!answer) return '';
    const byNumber = keys[Number(answer) - 1];
    if (byNumber) return byNumber;
    if (keys.includes(answer)) return answer;
    console.log('  → 목록에 있는 번호나 이름을 입력하세요.');
  }
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
    shopName: await askOptional('가게 이름', '골목빵집'),
    location: await askOptional('위치', '대전 유성구 봉명동'),
    priceInfo: await askOptional('가격·이벤트', '6개입 9,000원'),
    contact: await askOptional('주문·문의 방법', '인스타그램 DM으로 예약'),
    channel: await askChannel(),
  };

  console.log('\n생성 중... (품질 점검 후 다시 쓰는 경우 10초 이상 걸릴 수 있어요)');
  const started = Date.now();
  try {
    const r = await generatePromo(product, { mode, includeCandidates: true });
    console.log(`\n■ ${product.productName}  (${((Date.now() - started) / 1000).toFixed(1)}초)`);
    if (r.copyCandidates.length > 1) {
      console.log(`  카피 후보 : ${r.copyCandidates.map((c, i) => `${i + 1}) ${c}`).join('  ')}`);
    }
    console.log(`  광고 카피 : ${r.copy}`);
    console.log(`  SNS 문구  : ${r.sns.replace(/\n/g, '\n              ')}`);
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
