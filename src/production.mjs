/** Deterministic dependency-aware episode manifest. Not yet a video renderer. */
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { FileWorkspace,validateScene } from './workspace.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function optional(ws,project,path){try{return (await ws.read(project,path)).hash;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function assetHashes(ws,project,base,required=[],optionalFiles=[]){const data={};for(const file of required)data[file]=(await ws.read(project,`${base}/${file}`)).hash;for(const file of optionalFiles)data[file]=await optional(ws,project,`${base}/${file}`);return data;}
async function characterHashes(ws,project,id){const base=`characters/${id}`;const files=await assetHashes(ws,project,base,['manifest.json','rig.json','geometry.json'],['voice.json']);
 for(const category of ['animations','expressions']){const directory=await ws.securePath(project,`${base}/${category}`);let names=[];try{names=await readdir(directory);}catch(e){if(e.code!=='ENOENT')throw e;}if(names.length>150)throw new Error('Demasiados clips/expresiones en '+id);for(const name of names.filter(n=>/^[a-z0-9][a-z0-9_-]*\.json$/.test(n)).sort())files[category+'/'+name]=(await ws.read(project,`${base}/${category}/${name}`)).hash;}
 return files;
}
export async function compileRenderPlan(ws,project,episode){
 const ep=JSON.parse((await ws.read(project,`episodes/${episode}/manifest.json`)).content),scenes=await ws.listScenes(project,episode);
 const errors=[],plans=[];let cursor=0;
 for(const item of scenes){try{
  const scene=JSON.parse((await ws.read(project,item.path)).content);validateScene(scene);
  const dependencies={characters:{},props:{},environment:null};
  if(scene.environmentId)dependencies.environment=await assetHashes(ws,project,`environments/${scene.environmentId}`,['manifest.json','environment.json']);
  for(const actor of scene.actors)dependencies.characters[actor.characterId]=await characterHashes(ws,project,actor.characterId);
  for(const prop of scene.props)dependencies.props[prop.propId]=await assetHashes(ws,project,`props/${prop.propId}`,['manifest.json','geometry.json']);
  const dialoguePath=item.path.replace(/scene\.json$/,'dialogue.json');dependencies.dialogue=await optional(ws,project,dialoguePath);
  const renderHash=digest({scene,dependencies,renderer:'three-toon-v1',fps:ep.fps||24});
  plans.push({id:scene.id,name:scene.name,startSec:cursor,durationSec:scene.durationSec,frames:Math.ceil(scene.durationSec*(ep.fps||24)),renderHash,source:item.path,dependencies});cursor+=scene.durationSec;
 }catch(e){errors.push({scene:item.id,error:e.message});}}
 return {schemaVersion:1,project,episode,fps:ep.fps||24,requestedDurationSec:ep.durationSec||1200,plannedDurationSec:cursor,estimatedFrames:Math.ceil(cursor*(ep.fps||24)),scenes:plans,errors,readyForVideoRender:false,note:'Plan de producción verificado. Exportación MP4, TTS y lip-sync aún no implementados.'};
}
if(process.argv[1]?.endsWith('production.mjs')){
 const [project,episode]=process.argv.slice(2);if(!project||!episode){console.error('Uso: npm run plan -- <universo> <episodio>');process.exitCode=1;}else{try{const result=await compileRenderPlan(await new FileWorkspace().init(),project,episode);console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
}