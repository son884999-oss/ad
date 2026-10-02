import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, unlink, rmdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Editorial 5-second template: forest reveal, then a dedicated brand end card.
// No generation API, external music, or extra product claims.
export async function composeEditorial({inputPath,outputPath,sample}) {
  for(const key of ['headline','brand','productLine']) if(typeof sample?.[key]!=='string'||!sample[key].trim()) throw new Error('INVALID_COPY');
  const clean=s=>s.replace(/[{}\\\r\n]/g,' ');
  if([...sample.brand].length>5 || [...sample.productLine].length>12 || [...sample.headline].length>20) throw new Error('COPY_TOO_LONG_FOR_TEMPLATE');
  const title=clean(sample.headline).replace(' ','\\N');
  const temp=await mkdtemp(join(tmpdir(),'choicell-editorial-'));
  const ass=`[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1080
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Copy,Malgun Gothic,88,&H00F5F9F7,&H00F5F9F7,&H80202D20,&H80202D20,-1,0,0,0,100,100,-2,0,1,0,0,7,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.15,0:00:02.35,Copy,,0,0,0,,{\\move(68,144,68,128,0,240)\\fad(100,100)}${title}
Dialogue: 0,0:00:02.60,0:00:05.00,Copy,,0,0,0,,{\\pos(52,398)\\fs98\\fsp0\\1c&H243A23&\\fad(100,0)}${clean(sample.brand)}
Dialogue: 0,0:00:02.70,0:00:05.00,Copy,,0,0,0,,{\\pos(56,552)\\fs45\\b0\\fsp0\\1c&H344735&\\fad(100,0)}${clean(sample.productLine)}
`;
  const video=['trim=start=0.7:end=5','setpts=PTS-STARTPTS','scale=1080:1080','setsar=1','fps=24','tpad=stop_mode=clone:stop_duration=0.7'];
  // Soft left-side scrim for intro only, no bottom subtitle band.
  for(let x=0;x<600;x+=12) video.push(`drawbox=x=${x}:y=0:w=12:h=1080:color=0x061E15@${(0.64*(1-x/600)).toFixed(3)}:t=fill:enable='lt(t,2.5)'`);
  // End card reserves its own quiet area; the bottle remains on the right.
  video.push("drawbox=x=0:y=0:w=426:h=1080:color=0xF0EFE7:t=fill:enable='gte(t,2.5)'",
    "drawbox=x=56:y=522:w=58:h=3:color=0x839276:t=fill:enable='gte(t,2.6)'",'ass=captions.ass');
  const graph=`[0:v]${video.join(',')}[v];`+
    `[1:a]afade=t=in:d=0.25,afade=t=out:st=4.1:d=0.9,volume=0.22[a]`;
  // Original synthesized gentle tonal bed + short airy transition, not a music recording.
  const sound="aevalsrc=0.10*sin(2*PI*261.626*t)*exp(-0.7*t)+0.06*sin(2*PI*391.995*t)*exp(-0.6*t)+0.05*sin(2*PI*523.251*t)*exp(-0.5*t)+0.06*sin(2*PI*(600*t+150*t*t))*exp(-80*(t-2.5)*(t-2.5)):s=48000:d=5";
  try {
    await writeFile(join(temp,'captions.ass'),ass);
    await new Promise((ok,fail)=>{
      const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-n','-i',resolve(inputPath),'-f','lavfi','-i',sound,'-filter_complex',graph,'-map','[v]','-map','[a]','-t','5','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',resolve(outputPath)],{cwd:temp,windowsHide:true});
      let err='';p.stderr.on('data',d=>err=(err+d).slice(-3000));p.on('error',fail);p.on('close',c=>c===0?ok():fail(new Error(err)));
    });
    return {status:'completed',videoPath:resolve(outputPath)};
  }finally{await unlink(join(temp,'captions.ass')).catch(()=>{});await rmdir(temp).catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const sample=JSON.parse(await readFile(new URL('./sample-push.json',import.meta.url),'utf8'));
  console.log(await composeEditorial({sample,inputPath:process.argv[2]??fileURLToPath(new URL('../../쵸이셀_숲속접근_문구X.mp4',import.meta.url)),outputPath:process.argv[3]??fileURLToPath(new URL('../../쵸이셀_브랜드컷_광고.mp4',import.meta.url))}));
}
