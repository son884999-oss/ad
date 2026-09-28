import { generateVideo } from './video.mjs';

const [imageUrl, prompt] = process.argv.slice(2);
if (!imageUrl || !prompt) {
  console.error('사용법: pnpm generate "https://example.com/product.jpg" "영상 연출 프롬프트"');
  process.exitCode = 1;
} else {
  try {
    const result = await generateVideo({ imageUrl, prompt });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
