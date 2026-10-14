const { generateVideoPrompt } = require('../src');
const products = require('./products.json');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

async function main() {
  const mode = process.argv.includes('--gemini') ? 'gemini' : 'rules';
  const results = [];
  for (const product of products) {
    const result = await generateVideoPrompt(product, { mode });
    const output = { productName: product.productName, ...result };
    results.push(output);
    console.log(JSON.stringify(output, null, 2));
  }
  if (process.argv.includes('--save') && mode === 'rules') {
    writeFileSync(join(__dirname, 'rules-output.json'), `${JSON.stringify(results, null, 2)}\n`);
    const photoFiles = ['cookie.png', 'cosmetic.png', 'mug.png'];
    const sections = results.map((result, index) => [
      `## ${index + 1}. ${result.productName}`,
      '',
      `![${result.productName} 테스트 사진](images/${photoFiles[index]})`,
      '',
      '### 입력',
      '',
      '```json',
      JSON.stringify(products[index], null, 2),
      '```',
      '',
      '### 실제 반환값',
      '',
      '```json',
      JSON.stringify({ videoPrompt: result.videoPrompt }, null, 2),
      '```',
      '',
      '위 `videoPrompt` 문자열을 팀장 모듈의 `prompt`에 그대로 전달한다.',
      ''
    ].join('\n'));
    const preview = [
      '# 제품 3종 프롬프트 실행 결과',
      '',
      '`node examples/run.js --save`로 실제 생성한 `rules` 방식 결과다. 이 명령을 다시 실행하면 JSON과 이 문서가 함께 갱신된다.',
      '',
      '사진은 입력 상황을 보여주는 합성 테스트 자료다. `rules` 방식은 제품명·설명·분위기 값을 사용하며 사진을 분석하지 않는다. 아래 imageUrl은 업로드 후 바꿔 넣을 자리표시자다. Gemini 사진 분석 결과는 아직 검증하지 않았다.',
      '',
      '쿠키는 따뜻한 분위기와 표면·포장, 화장품은 우아한 분위기와 용기·라벨, 머그컵은 차분한 분위기와 윤곽·표면을 강조한다. 모두 10초 연속 장면과 느린 카메라 움직임, 제품·배경 보존 규칙을 포함한다.',
      '',
      ...sections
    ].join('\n');
    writeFileSync(join(__dirname, 'RESULTS.md'), preview);
  }
}

main().catch(error => {
  console.error(`${error.code ?? error.name}: ${error.message}`);
  process.exitCode = 1;
});
