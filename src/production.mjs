/** Deterministic episode production manifest, not a pretend video renderer. */
import { createHash } from 'node:crypto';
import { FileWorkspace,validateScene } from './workspace.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function compileRenderPlan(ws,project,episode){
 const ep=JSON.parse((await ws.read(project,`episodes/${episode}/manifest.json`)).content),scenes=await ws.listScenes(project,episode);
 const errors=[],plans=[];let cursor=0;
 for(const item of scenes){try{
  const scene=JSON.parse((await ws.read(project,item.path)).content);validateScene(scene);
  if(scene.environmentId)await ws.read(project,`environments/${scene.environmentId}/manifest.json`);
  const actors=[];for(const a of scene.actors){const base=`characters/${a.characterId}/`;const files=await Promise.all(['manifest.json','rig.json','geometry.json'].map(f=>ws.read(project,base+f)));actors.push({characterId:a.characterId,hash:digest(files.map(x=>x.hash)),yawDeg:a.yawDeg});}
  for(const prop of scene.props)await ws.read(project,`props/${prop.propId}/geometry.json`);
  const renderHash=digest({scene,actors,renderer:'three-toon-v1',fps:ep.fps||24});
  plans.push({id:scene.id,name:scene.name,startSec:cursor,durationSec:scene.durationSec,frames:Math.ceil(scene.durationSec*(ep.fps||24)),renderHash,source:item.path,actors});cursor+=scene.durationSec;
 }catch(e){errors.push({scene:item.id,error:e.message});}}
 return {schemaVersion:1,project,episode,fps:ep.fps||24,requestedDurationSec:ep.durationSec||1200,plannedDurationSec:cursor,estimatedFrames:Math.ceil(cursor*(ep.fps||24)),scenes:plans,errors,readyForVideoRender:false,note:'Plano de producción verificado. La exportación MP4, TTS y lip-sync aún requieren el motor audiovisual.'};
}
if(process.argv[1]?.endsWith('production.mjs')){
 const [project,episode]=process.argv.slice(2);if(!project||!episode){console.error('Uso: npm run plan -- <universo> <episodio>');process.exitCode=1;}else{try{const result=await compileRenderPlan(await new FileWorkspace().init(),project,episode);console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
}