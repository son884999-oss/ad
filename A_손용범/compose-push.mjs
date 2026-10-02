import { spawn } from 'node:child_process';
import { writeFile, mkdtemp, unlink, rmdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export async function composePush({inputPath, outputPath, sample, textStyle = 'nature-beauty'}) {
  if (!['nature-beauty', 'basic'].includes(textStyle)) throw new Error('UNKNOWN_TEXT_STYLE');
  const beauty = textStyle === 'nature-beauty';
  for (const key of ['headline','brand','productLine']) {
    if (typeof sample?.[key] !== 'string' || !sample[key].trim() || [...sample[key]].length > 24) throw new Error('INVALID_COPY');
  }
  const clean=s=>String(s).replace(/[{}\\\r\n]/g,' ');
  const temp=await mkdtemp(join(tmpdir(),'choicell-push-'));
  const event=(start,end,x,y,size,text,accent=false)=>{
    const motion=`\\move(${x},${y+12},${x},${y},0,220)\\fs${size}\\fad(100,0)`;
    const face=accent?'&HADE4DE&':'&HEBF8FA&';
    const layers=beauty ? [
      `Dialogue: 0,${start},${end},Main,,0,0,0,,{${motion}\\1c&H142B1B&\\bord3\\blur5\\shad5\\alpha&H50&}${text}`,
      `Dialogue: 1,${start},${end},Main,,0,0,0,,{${motion}\\1c&H36533A&\\bord1.8\\shad3}${text}`,
      `Dialogue: 2,${start},${end},Main,,0,0,0,,{${motion}\\1c${face}\\3c${face}\\bord0.55\\shad0}${text}`
    ]:[`Dialogue: 0,${start},${end},Main,,0,0,0,,{${motion}}${text}`];
    return layers.join('\n');
  };
  const ass=`[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1080
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,${beauty?'Gowun Dodum':'Malgun Gothic'},82,&H00FFFFFF,&H00FFFFFF,&H80101C12,&HA0101C12,-1,0,0,0,100,100,0,0,1,1,2,7,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${event('0:00:00.35','0:00:02.65',64,785,76,clean(sample.headline))}
${event('0:00:02.80','0:00:05.00',64,710,112,clean(sample.brand),true)}
${event('0:00:02.80','0:00:05.00',68,858,72,clean(sample.productLine))}
`;
  const filters=['scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2','setsar=1'];
  for(let y=560;y<1080;y+=8) filters.push(`drawbox=x=0:y=${y}:w=1080:h=8:color=0x03150C@${(0.84*Math.pow((y-560)/520,0.65)).toFixed(3)}:t=fill`);
  filters.push('ass=captions.ass:fontsdir=.');
  try {
    if(beauty) await copyFile(new URL('./assets/fonts/GowunDodum-Regular.ttf',import.meta.url),join(temp,'GowunDodum-Regular.ttf'));
    await writeFile(join(temp,'captions.ass'),ass);
    await new Promise((ok,fail)=>{
      const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-n','-i',resolve(inputPath),'-vf',filters.join(','),'-t','5','-r','24','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(outputPath)],{cwd:temp,windowsHide:true});
      child.on('error',fail); child.on('close',code=>code===0?ok():fail(new Error('COMPOSITION_FAILED')));
    });
    return {status:'completed',videoPath:resolve(outputPath)};
  } finally {await unlink(join(temp,'captions.ass')).catch(()=>{}); await unlink(join(temp,'GowunDodum-Regular.ttf')).catch(()=>{}); await rmdir(temp).catch(()=>{});}
}
