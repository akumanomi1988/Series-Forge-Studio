import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileWorkspace } from '../src/workspace.mjs';
import { renderSvgFrame } from '../src/frame-renderer.mjs';
import { subtitleTime, subtitlesForScenes, exportEpisode, ensureFfmpeg, runTool, loadSceneAssets } from '../src/export-episode.mjs';

test('SRT multiescena: offsets y formato estable',()=>{
 assert.equal(subtitleTime(3723.142),'01:02:03,142');
 const s=subtitlesForScenes([{durationSec:5,beats:[{type:'dialogue',actorId:'bruno',text:'Hola.',startSec:1,endSec:3}]},{durationSec:6,beats:[{type:'dialogue',actorId:'lara',text:'¿Cómo estás?',startSec:0,endSec:2}]}]);
 assert.match(s,/00:00:01,000 --> 00:00:03,000/);assert.match(s,/00:00:05,000 --> 00:00:07,000/);
});

test('SVG determinista con rotación, animación y diálogo sin ejecutar código de agente',async t=>{
 const root=await mkdtemp(join(tmpdir(),'sf-render-test-'));t.after(()=>rm(root,{force:true,recursive:true}));const ws=await new FileWorkspace(root).init(),{project}=await ws.createProject('Prueba');
 const c=await ws.createAsset(project,'characters','Bruno'),ep=await ws.createAsset(project,'episodes','Primero'),sc=await ws.createScene(project,ep.id);
 const path=`episodes/${ep.id}/scenes/${sc.id}/scene.json`,scene=JSON.parse((await ws.read(project,path)).content);scene.actors.push({characterId:c.id,position:[0,0,0],yawDeg:35});scene.beats.push({id:'d',type:'dialogue',actorId:c.id,text:'Texto <seguro> & comillas',startSec:0,endSec:2});await ws.put(project,path,JSON.stringify(scene));
 const assets=await loadSceneAssets(ws,project,scene),a=renderSvgFrame(scene,1===1?assets:{},.25,{width:320,height:180}),b=renderSvgFrame(scene,assets,.25,{width:320,height:180});assert.equal(a,b);assert.match(a,/&lt;seguro&gt; &amp;/);assert.match(a,/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);assert.notEqual(a,renderSvgFrame(scene,assets,1,{width:320,height:180}));
});

test('MP4 real y caché incremental por escena si FFmpeg incluye librsvg', {timeout:120000},async t=>{
 try{await ensureFfmpeg();}catch{t.skip('Se requiere FFmpeg con librsvg para la integración');return;}
 const root=await mkdtemp(join(tmpdir(),'sf-video-test-'));t.after(()=>rm(root,{recursive:true,force:true}));const ws=await new FileWorkspace(root).init(),{project}=await ws.createProject('Vídeo');
 const c=await ws.createAsset(project,'characters','Bruno'),ep=await ws.createAsset(project,'episodes','Episodio');const sc=await ws.createScene(project,ep.id),path=`episodes/${ep.id}/scenes/${sc.id}/scene.json`;const scene=JSON.parse((await ws.read(project,path)).content);scene.durationSec=1.5;scene.actors=[{characterId:c.id,position:[0,0,0],yawDeg:35}];scene.beats=[{id:'say',type:'dialogue',actorId:c.id,text:'Hola mundo.',startSec:0,endSec:1}];await ws.put(project,path,JSON.stringify(scene));
 const args={workspace:ws,project,episode:ep.id,width:320,height:180,fps:4,speech:'none',renderer:'svg'};const first=await exportEpisode(args),second=await exportEpisode(args);assert.equal(first.video,second.video);const info=JSON.parse((await runTool('ffprobe',['-v','error','-show_entries','stream=codec_name,codec_type','-of','json',first.video],{stdout:true})));assert.ok(info.streams.some(s=>s.codec_name==='h264'));assert.ok(info.streams.some(s=>s.codec_type==='audio'));assert.match(await readFile(first.srt,'utf8'),/Hola mundo/);
});
