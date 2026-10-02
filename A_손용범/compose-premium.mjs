import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function composePremium({ inputPath, outputPath, sample }) {
  const clean = (s, limit) => {
    if (typeof s !== 'string' || !s.trim() || [...s].length > limit) throw new Error('문구 길이를 확인하세요.');
    return s.replace(/[{}\\\r\n]/g, ' ');
  };
  const brand = clean(sample.brand,16);
  const product = clean(sample.productName,24);
  const headline = clean(sample.headline,24);
  const temp = await mkdtemp(join(tmpdir(),'choicell-premium-'));
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Brand,Malgun Gothic,30,&H00EDF4F6,&H00EDF4F6,&H80233222,&H00000000,0,0,0,0,100,100,5,0,1,0,0,7,0,0,0,1
Style: Headline,Batang,58,&H00EDF4F6,&H00EDF4F6,&H80233222,&H00000000,0,0,0,0,100,100,1,0,1,0,0,7,0,0,0,1
Style: Product,Malgun Gothic,46,&H00EDF4F6,&H00EDF4F6,&H80233222,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Small,Malgun Gothic,22,&H00B3CECE,&H00B3CECE,&H80233222,&H00000000,0,0,0,0,100,100,2,0,1,0,0,7,0,0,0,1
Style: CTA,Malgun Gothic,24,&H00EDF4F6,&H00EDF4F6,&H80233222,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.65,0:00:05.00,Brand,,0,0,0,,{\\pos(70,64)\\fad(300,0)}${brand}
Dialogue: 0,0:00:00.65,0:00:02.55,Small,,0,0,0,,{\\pos(72,806)\\fad(250,220)}CHOICELL  /  DAILY RITUAL
Dialogue: 0,0:00:00.65,0:00:02.55,Headline,,0,0,0,,{\\move(68,863,68,846,0,450)\\fad(300,220)}${headline}
Dialogue: 0,0:00:02.65,0:00:05.00,Small,,0,0,0,,{\\pos(72,790)\\fad(250,0)}ALL IN ONE SHAMPOO  /  ${clean(sample.volume,12)}
Dialogue: 0,0:00:02.65,0:00:05.00,Product,,0,0,0,,{\\move(68,844,68,830,0,400)\\fad(250,0)}${product}
Dialogue: 0,0:00:03.15,0:00:05.00,CTA,,0,0,0,,{\\pos(72,940)\\fad(300,0)}쵸이셀에서 만나보세요  →
`;
  // Smooth tonal scrim rather than a solid panel; no crop of the original square frame.
  const filters=['scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x102A22','setsar=1'];
  for(let y=620;y<1080;y+=10) {
    const opacity=(0.70*Math.pow((y-620)/460,0.8)).toFixed(3);
    filters.push(`drawbox=x=0:y=${y}:w=1080:h=10:color=0x081A12@${opacity}:t=fill:enable='gte(t,0.65)'`);
  }
  for(let y=0;y<180;y+=10) {
    const opacity=(0.35*(1-y/180)).toFixed(3);
    filters.push(`drawbox=x=0:y=${y}:w=1080:h=10:color=0x081A12@${opacity}:t=fill:enable='gte(t,0.65)'`);
  }
  filters.push("drawbox=x=72:y=912:w=64:h=1:color=0xD4C7A3@0.8:t=fill:enable='gte(t,3.15)'",'ass=captions.ass');
  try {
    await writeFile(join(temp,'captions.ass'),ass,'utf8');
    await new Promise((resolveRun,reject)=>{
      const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-n','-i',resolve(inputPath),'-vf',filters.join(','),'-t','5','-r','24','-map','0:v:0','-map','0:a?','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',resolve(outputPath)],{cwd:temp,windowsHide:true,shell:false});
      let error=''; child.stderr.on('data',d=>{error=(error+d).slice(-5000);});
      child.on('error',reject); child.on('close',code=>code===0?resolveRun():reject(new Error(error)));
    });
    return {status:'completed',videoPath:resolve(outputPath)};
  } finally {await unlink(join(temp,'captions.ass')).catch(()=>{}); await rmdir(temp).catch(()=>{});}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {
    const sample=JSON.parse(await readFile(new URL('./sample-ad.json',import.meta.url),'utf8'));
    console.log(await composePremium({sample,inputPath:process.argv[2]??fileURLToPath(new URL('../../쵸이셀_Kling_숲속광고_원본.mp4',import.meta.url)),outputPath:process.argv[3]??fileURLToPath(new URL('../../쵸이셀_광고_리디자인.mp4',import.meta.url))}));
  } catch(error){console.error(error.message); process.exitCode=1;}
}
