import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

function run(command, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false });
    let output = '';
    child.stderr.on('data', data => { output = (output + data).slice(-6000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveRun() : reject(new Error(`FFmpeg 오류 (${code}): ${output}`)));
  });
}

function caption(value, max) {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max) {
    throw new Error(`광고문구는 비어 있지 않은 ${max}자 이하 문자열이어야 합니다.`);
  }
  // ASS override tags and line-break escapes must never be interpreted as layout commands.
  return value.replace(/[{}\\\r\n]/g, ' ').trim();
}

export async function composeAd({ inputPath, outputPath, sample, ffmpeg = 'ffmpeg' }) {
  const input = resolve(inputPath);
  const output = resolve(outputPath);
  await access(input);
  const brand = caption(sample.brand, 16);
  const headline = caption(sample.headline, 24);
  const product = caption(sample.productName, 24);
  const cta = caption(sample.cta, 24);
  const volume = caption(sample.volume, 12);
  const temp = await mkdtemp(join(tmpdir(), 'choicell-ad-'));
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 2
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Brand,Malgun Gothic,26,&H009BC6DB,&H009BC6DB,&H00FFFFFF,&H00000000,-1,0,0,0,100,100,5,0,1,0,0,8,30,30,0,1
Style: Headline,Malgun Gothic,48,&H00F0F6F5,&H00F0F6F5,&H00FFFFFF,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,30,30,0,1
Style: Product,Malgun Gothic,33,&H00DAE5DD,&H00DAE5DD,&H00FFFFFF,&H00000000,0,0,0,0,100,100,1,0,1,0,0,8,30,30,0,1
Style: Detail,Malgun Gothic,24,&H009BC6DB,&H009BC6DB,&H00FFFFFF,&H00000000,0,0,0,0,100,100,2,0,1,0,0,8,30,30,0,1
Style: CTA,Malgun Gothic,30,&H00273518,&H00273518,&H00385925,&H00000000,-1,0,0,0,100,100,1,0,1,0,0,5,30,30,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Brand,,0,0,0,,{\\pos(360,50)\\fad(120,0)}${brand}
Dialogue: 0,0:00:00.00,0:00:05.00,Headline,,0,0,0,,{\\move(360,135,360,112,0,550)\\fad(400,0)}${headline}
Dialogue: 0,0:00:00.30,0:00:05.00,Product,,0,0,0,,{\\pos(360,187)\\fad(180,0)}${product}
Dialogue: 0,0:00:00.30,0:00:05.00,Detail,,0,0,0,,{\\pos(360,1075)\\fad(180,0)}${volume}  ·  ${brand}
Dialogue: 0,0:00:02.20,0:00:05.00,CTA,,0,0,0,,{\\pos(360,1170)\\fad(200,0)}${cta}
`;
  try {
    await writeFile(join(temp, 'captions.ass'), ass, 'utf8');
    // Reserve dedicated top/bottom bands; product image is fitted without cropping.
    await run(ffmpeg, ['-hide_banner','-loglevel','error','-n','-i',input,
      '-vf', "scale=720:790:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=720:1280:(ow-iw)/2:260:color=0x102A22,setsar=1,drawbox=x=320:y=234:w=80:h=2:color=0xDBC69B:t=fill,drawbox=x=80:y=1126:w=560:h=88:color=0xDBC69B:t=fill:enable='gte(t,2.2)',ass=captions.ass",
      '-t','5','-r','24','-map','0:v:0','-map','0:a?',
      '-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',output], temp);
    return {status:'completed', videoPath:output};
  } finally {
    await unlink(join(temp, 'captions.ass')).catch(() => {});
    await rmdir(temp).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const sample = JSON.parse(await readFile(new URL('./sample-ad.json', import.meta.url), 'utf8'));
    const input = process.argv[2] ?? fileURLToPath(new URL('../../쵸이셀_올인원_샴푸_Seedance2.5_5초_광고.mp4', import.meta.url));
    const output = process.argv[3] ?? fileURLToPath(new URL('../../쵸이셀_한글문구포함_완성광고.mp4', import.meta.url));
    console.log(JSON.stringify(await composeAd({inputPath:input,outputPath:output,sample}),null,2));
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
