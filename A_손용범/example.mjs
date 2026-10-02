import { generateVideo } from './video.mjs';

const [imageUrl, videoPrompt, durationArgument] = process.argv.slice(2);
if (!imageUrl || !videoPrompt) {
  console.error('사용법: pnpm generate "https://example.com/product.jpg" "영상 연출 프롬프트"');
  process.exitCode = 1;
} else {
  try {
    const duration = durationArgument === undefined ? undefined : Number(durationArgument);
    const result = await generateVideo({ imageUrl, videoPrompt, duration });
    const output = JSON.stringify(result, null, 2);
    if (result.status === 'completed') {
      console.log(output);
    } else {
      console.error(output);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
