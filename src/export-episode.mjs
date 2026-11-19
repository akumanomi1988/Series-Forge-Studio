/** Real, resumable local MP4 animatic export. No LLM, API URL or Docker. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, rm, stat, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FileWorkspace, validateScene } from './workspace.mjs';
import { compileRenderPlan } from './production.mjs';
import { renderSvgFrame } from './frame-renderer.mjs';
import { openThreeCapture } from './browser-render.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const txt=x=>JSON.stringify(x,null,2)+'\n';
const validNumber=(x,low,high)=>Number.isFinite(x)&&x>=low&&x<=high;
async function exists(path){try{await stat(path);return true;}catch{return false;}}
export function subtitleTime(seconds){const ms=Math.max(0,Math.round(seconds*1000)),milli=ms%1000,sec=Math.floor(ms/1000)%60,min=Math.floor(ms/60000)%60,hour=Math.floor(ms/3600000);return `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(milli).padStart(3,'0')}`;}
export function subtitlesForScenes(scenes){const captions=[];let cursor=0;for(const scene of scenes){for(const beat of scene.beats||[])if(beat.type==='dialogue'&&beat.text?.trim()){const start=cursor+beat.startSec,end=cursor+Math.min(scene.durationSec,beat.endSec);if(start<cursor+scene.durationSec&&end>start)captions.push({start,end,text:beat.text.replace(/[\r\n]+/g,' ').trim(),actor:beat.actorId||''});}cursor+=scene.durationSec;}return captions.sort((a,b)=>a.start-b.start||a.end-b.end).map((c,i)=>`${i+1}\n${subtitleTime(c.start)} --> ${subtitleTime(c.end)}\n${c.actor?`${c.actor}: `:''}${c.text}\n`).join('\n');}
export async function runTool(program,args,{cwd,timeout=600_000,stdout=false}={}){return await new Promise((ok,fail)=>{const p=spawn(program,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='',done=false;const timer=setTimeout(()=>{p.kill('SIGKILL');reject(new Error(`${program}: excedido el tiempo máximo`));},timeout);const reject=e=>{if(done)return;done=true;clearTimeout(timer);fail(e);};p.on('error',reject);p.stdout.on('data',c=>{out=(out+c).slice(-220000);});p.stderr.on('data',c=>{err=(err+c).slice(-220000);});p.on('close',code=>{if(done)return;done=true;clearTimeout(timer);code===0?ok(stdout?out:{stdout:out,stderr:err}):fail(new Error(`${program} terminó con ${code}: ${err.slice(-3500)}`));});});}
export async function ensureFfmpeg(ffmpeg='ffmpeg',{requireSvg=true}={}){const {stdout}=await runTool(ffmpeg,['-hide_banner','-decoders'],{timeout:20000});if(requireSvg&&!/\blibrsvg\b/.test(stdout))throw new Error('Tu FFmpeg no incluye decodificador librsvg para SVG. Usa --renderer three o instala FFmpeg con librsvg.');}
async function readJSON(ws,project,path){return JSON.parse((await ws.read(project,path)).content);}
async function optionalJSON(ws,project,path){try{return await readJSON(ws,project,path);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function loadSceneAssets(ws,project,scene){const assets={characters:{},environments:{},props:{}};if(scene.environmentId)assets.environments[scene.environmentId]={'environment.json':await readJSON(ws,project,`environments/${scene.environmentId}/environment.json`)};
 for(const actor of scene.actors){const id=actor.characterId,base=`characters/${id}/`,files={};for(const name of ['manifest.json','rig.json','geometry.json','voice.json'])files[name]=await readJSON(ws,project,base+name);for(const category of ['animations','expressions']){const path=await ws.securePath(project,base+category);for(const file of (await readdir(path)).filter(x=>/^[a-z0-9][a-z0-9_-]*\.json$/.test(x))){files[category+'/'+file]=await readJSON(ws,project,base+category+'/'+file);}}assets.characters[id]=files;}
 for(const p of scene.props){assets.props[p.propId]={'geometry.json':await readJSON(ws,project,`props/${p.propId}/geometry.json`)};}
 return assets;}
async function synthSapi(text,voice,output){if(process.platform!=='win32')throw new Error('SAPI solo está disponible en Windows; usa --speech none en otros sistemas.');
 const payload=Buffer.from(JSON.stringify({text,voiceId:voice.voiceId||null,output,language:voice.language||'es-ES'}),'utf8').toString('base64');
 const script=`Add-Type -AssemblyName System.Speech;$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json;$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;try{if($p.voiceId){$s.SelectVoice($p.voiceId)}else{$s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet,[System.Speech.Synthesis.VoiceAge]::NotSet,0,[Globalization.CultureInfo]::GetCultureInfo($p.language))};$s.SetOutputToWaveFile($p.output);$s.Speak($p.text)}finally{$s.Dispose()}`;
 await runTool('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{timeout:120_000});}
async function speechFiles(ws,project,scene,assets,dir,speech){const files=[];if(speech==='none')return files;for(const b of scene.beats.filter(b=>b.type==='dialogue'&&b.text?.trim())){const voice=assets.characters[b.actorId]?.['voice.json'];if(!voice)throw new Error(`Falta voice.json para ${b.actorId}`);if(b.text.length>3000)throw new Error('Diálogo demasiado largo para SAPI');const key=digest({text:b.text,voice,speech,version:1}),path=join(dir,`voice-${key}.wav`);if(!await exists(path))await synthSapi(b.text,voice,path);files.push({...b,path});}return files;}
async function mixScene(ffmpeg,video,duration,speech,path){const args=['-y','-nostdin','-hide_banner','-loglevel','error','-i',video,'-f','lavfi','-i','anullsrc=r=48000:cl=stereo'];for(const clip of speech)args.push('-i',clip.path);let filter='';const taps=['[1:a]'];for(let i=0;i<speech.length;i++){const b=speech[i],target=Math.max(.05,b.endSec-b.startSec),delay=Math.max(0,Math.round(b.startSec*1000)),ix=i+2;filter+=`[${ix}:a]aresample=48000,atempo=1,atrim=duration=${target.toFixed(3)},adelay=${delay}|${delay}[v${i}];`;taps.push(`[v${i}]`);}filter+=`${taps.join('')}amix=inputs=${taps.length}:duration=first:normalize=0,atrim=duration=${duration.toFixed(3)}[mix]`;args.push('-filter_complex',filter,'-map','0:v:0','-map','[mix]','-c:v','copy','-c:a','aac','-b:a','160k','-t',String(duration),'-movflags','+faststart',path);await runTool(ffmpeg,args,{timeout:180000});}
export async function exportEpisode({workspace=new FileWorkspace(),project,episode,width=960,height=540,fps=24,maxSeconds=null,speech='none',renderer='three',ffmpeg='ffmpeg',outputDir=null,progress=()=>{}}={}){
 if(!/^[a-z0-9][a-z0-9_-]*$/.test(project||'')||!/^[a-z0-9][a-z0-9_-]*$/.test(episode||''))throw new Error('Proyecto/episodio inválido');
 if(!validNumber(width,160,3840)||!validNumber(height,90,2160)||width%2||height%2||!validNumber(fps,1,60)||!Number.isInteger(fps))throw new Error('Resolución o FPS inválidos');
 if(maxSeconds!==null&&!validNumber(maxSeconds,.1,3600))throw new Error('maxSeconds inválido');
 if(!['none','sapi'].includes(speech))throw new Error('Proveedor de voz inválido');
 if(!['three','svg'].includes(renderer))throw new Error('Renderizador inválido: usa three o svg');
 await ensureFfmpeg(ffmpeg,{requireSvg:renderer==='svg'});await workspace.init();const plan=await compileRenderPlan(workspace,project,episode);if(plan.errors.length)throw new Error('Plan inválido: '+JSON.stringify(plan.errors));if(!plan.scenes.length)throw new Error('El episodio no contiene escenas');
 const root=outputDir?resolve(outputDir):await workspace.securePath(project,`episodes/${episode}/output`);
 await mkdir(root,{recursive:true});const cache=join(root,'.render-cache');await mkdir(cache,{recursive:true});
 const sourceFiles=renderer==='three'?['./browser-render.mjs','../public/viewport.js','../public/scene-runtime.js','../public/render.js','../package.json']:['./frame-renderer.mjs','../public/scene-runtime.js'];
 const sourceHash=digest(await Promise.all(sourceFiles.map(file=>readFile(new URL(file,import.meta.url),'utf8'))));
 const segments=[],usedScenes=[];let remaining=maxSeconds??Infinity, capture=null;
 try {
  for(const item of plan.scenes){
   if(remaining<=0)break;
   const sec=Math.min(item.durationSec,remaining);remaining-=sec;
   const scene=await readJSON(workspace,project,item.source);validateScene(scene);
   const frames=Math.max(1,Math.ceil(sec*fps)),actualDuration=frames/fps;
   const assets=renderer==='svg'?await loadSceneAssets(workspace,project,scene):null;
   const key=digest({renderHash:item.renderHash,sourceHash,width,height,fps,frames,speech,renderer,version:3});
   const dir=join(cache,key),final=join(dir,'clip.mp4');await mkdir(dir,{recursive:true});
   progress({scene:item.id,status:'prepare',frames,renderer});
   const reused=await exists(final);
   if(!reused){
    const framesDir=join(dir,'frames');await mkdir(framesDir,{recursive:true});
    if(renderer==='three'&&!capture)capture=await openThreeCapture({workspace,project,episode,width,height});
    for(let f=0;f<frames;f++){
     const framePath=join(framesDir,`frame-${String(f).padStart(7,'0')}.${renderer==='three'?'png':'svg'}`);
     if(!await exists(framePath)){
      if(renderer==='three')await writeFile(framePath,await capture.renderFrame(item.id,f/fps));
      else await writeFile(framePath,renderSvgFrame(scene,assets,f/fps,{width,height}),'utf8');
     }
     if(f%Math.max(1,Math.ceil(fps*2))===0)progress({scene:item.id,status:'frames',current:f,total:frames});
    }
    const silent=join(dir,'video.mp4');
    await runTool(ffmpeg,['-y','-nostdin','-hide_banner','-loglevel','error','-framerate',String(fps),'-start_number','0','-i',join(framesDir,`frame-%07d.${renderer==='three'?'png':'svg'}`),'-frames:v',String(frames),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',silent],{timeout:Math.max(120000,frames*4000)});
    const voices=await speechFiles(workspace,project,scene,assets??await loadSceneAssets(workspace,project,scene),dir,speech);
    const temporary=join(dir,`clip-${process.pid}.mp4`);
    try{await mixScene(ffmpeg,silent,actualDuration,voices,temporary);await rename(temporary,final);}
    finally{await rm(temporary,{force:true});}
    await rm(framesDir,{recursive:true,force:true});await rm(silent,{force:true});
   }
   segments.push(final);usedScenes.push({...scene,durationSec:actualDuration});progress({scene:item.id,status:'ready',cached:reused});
  }
 } finally { await capture?.close(); }
 const concat=join(root,'.concat.txt');
 await writeFile(concat,segments.map(x=>`file '${x.replace(/'/g,"'\\''")}'`).join('\n')+'\n');
 const video=join(root,`episode-${width}x${height}-${fps}fps.mp4`);
 await runTool(ffmpeg,['-y','-nostdin','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',concat,'-c','copy','-movflags','+faststart',video],{timeout:600000});
 const srt=join(root,'subtitulos.srt');await writeFile(srt,subtitlesForScenes(usedScenes));
 const metadata=join(root,'production.json');
 await writeFile(metadata,txt({schemaVersion:1,project,episode,width,height,fps,speech,segments:segments.length,durationSec:usedScenes.reduce((s,x)=>s+x.durationSec,0),renderMode:renderer==='three'?'three-toon-webgl':'svg-animatic',quality:renderer==='three'?'procedural-toon-prototype':'animatic-not-final-character-render',video,srt,generatedAt:new Date().toISOString()}));
 progress({status:'done',video,srt});return {video,srt,metadata,segments:segments.length};
}
const direct=process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(direct){const [project,episode,...flags]=process.argv.slice(2),value=(key,def)=>{const i=flags.indexOf(`--${key}`);return i<0?def:Number(flags[i+1]);};const opts={project,episode,width:value('width',960),height:value('height',540),fps:value('fps',24),maxSeconds:value('max-seconds',null),speech:flags.includes('--sapi')?'sapi':'none',renderer:flags.includes('--renderer')?flags[flags.indexOf('--renderer')+1]:'three',progress:x=>console.log(JSON.stringify(x))};exportEpisode(opts).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});}
