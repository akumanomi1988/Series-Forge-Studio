/** Series Forge file-first workspace. No model/API credentials required. */
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, rename, lstat, stat, rm, watch as watchFs } from 'node:fs/promises';
import { resolve, relative, join, dirname, sep } from 'node:path';

export const KINDS = Object.freeze(['characters','environments','props','episodes']);
const assetCategories = new Set(KINDS);
const ENCODING = 'utf8';
const MAX_FILE = 500_000;
const MAX_NAME = 120;
const safeSegment = s => typeof s === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(s);
const slugify = s => String(s||'asset').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45) || 'asset';
const json = o => JSON.stringify(o,null,2)+'\n';
const uid = () => randomUUID();
const now = () => new Date().toISOString();
const ensureString = (s,name) => { if(typeof s!=='string'||!s.trim()||s.length>MAX_NAME)throw new Error(`${name} inválido`);return s.trim(); };
const allowedPath = rel => typeof rel==='string' && rel.split('/').every(s=>safeSegment(s)||/^[a-z0-9][a-z0-9_-]*\.(json|md)$/.test(s)) && /^(characters|environments|props|episodes)\//.test(rel);
export const hash = s => createHash('sha256').update(s).digest('hex');

export function humanoidTemplates(name='Personaje',id=uid()) {
 const bones=[
  ['root',null,[0,1.12,0]], ['spine','root',[0,.28,0]], ['head','spine',[0,.63,0]],
  ['leftUpperArm','spine',[-.43,.47,0]], ['leftLowerArm','leftUpperArm',[0,-.45,0]], ['leftHand','leftLowerArm',[0,-.38,0]],
  ['rightUpperArm','spine',[.43,.47,0]], ['rightLowerArm','rightUpperArm',[0,-.45,0]], ['rightHand','rightLowerArm',[0,-.38,0]],
  ['leftThigh','root',[-.20,-.10,0]], ['leftShin','leftThigh',[0,-.51,0]], ['leftFoot','leftShin',[0,-.48,.11]],
  ['rightThigh','root',[.20,-.10,0]], ['rightShin','rightThigh',[0,-.51,0]], ['rightFoot','rightShin',[0,-.48,.11]]
 ].map(([id,parent,position])=>({id,parent,position,rotationDeg:[0,0,0]}));
 const part=(id,bone,primitive,size,position,color)=>({id,bone,primitive,size,position,color});
 const geometry={schemaVersion:1,coordinateSystem:'Y-up, +Z forward, metres',parts:[
  part('body','spine','box',[.69,.78,.35],[0,.12,0],'#d94c57'),
  part('face','head','sphere',[.35,.38,.32],[0,.06,0],'#d5a378'),
  part('hair','head','sphere',[.36,.16,.31],[0,.34,-.03],'#252d39'),
  part('eyeL','head','sphere',[.055,.065,.03],[-.13,.10,.3],'#101c2c'),
  part('eyeR','head','sphere',[.055,.065,.03],[.13,.10,.3],'#101c2c'),
  part('mouth','head','sphere',[.12,.023,.028],[0,-.13,.32],'#682f37'),
  part('armL','leftUpperArm','capsule',[.12,.48,.12],[0,-.23,0],'#d94c57'),
  part('armR','rightUpperArm','capsule',[.12,.48,.12],[0,-.23,0],'#d94c57'),
  part('forearmL','leftLowerArm','capsule',[.115,.39,.115],[0,-.2,0],'#d5a378'),
  part('forearmR','rightLowerArm','capsule',[.115,.39,.115],[0,-.2,0],'#d5a378'),
  part('handL','leftHand','sphere',[.105,.12,.08],[0,-.06,0],'#d5a378'),
  part('handR','rightHand','sphere',[.105,.12,.08],[0,-.06,0],'#d5a378'),
  part('legL','leftThigh','capsule',[.19,.56,.19],[0,-.24,0],'#30455f'),
  part('legR','rightThigh','capsule',[.19,.56,.19],[0,-.24,0],'#30455f'),
  part('shinL','leftShin','capsule',[.16,.50,.16],[0,-.25,0],'#30455f'),
  part('shinR','rightShin','capsule',[.16,.50,.16],[0,-.25,0],'#30455f'),
  part('shoeL','leftFoot','box',[.28,.16,.42],[0,-.03,.09],'#202835'),
  part('shoeR','rightFoot','box',[.28,.16,.42],[0,-.03,.09],'#202835')
 ]};
 const walk={schemaVersion:1,id:'walk',duration:1.0,loop:true,tracks:[
  {target:'leftThigh.rotation.x',keys:[[0,25],[.5,-25],[1,25]]},
  {target:'rightThigh.rotation.x',keys:[[0,-25],[.5,25],[1,-25]]},
  {target:'leftShin.rotation.x',keys:[[0,3],[.35,40],[.75,3],[1,3]]},
  {target:'rightShin.rotation.x',keys:[[0,40],[.35,3],[.75,25],[1,40]]},
  {target:'leftUpperArm.rotation.x',keys:[[0,-18],[.5,18],[1,-18]]},
  {target:'rightUpperArm.rotation.x',keys:[[0,18],[.5,-18],[1,18]]}
 ]};
 const idle={schemaVersion:1,id:'idle',duration:2,loop:true,tracks:[{target:'spine.rotation.z',keys:[[0,-1],[1,1],[2,-1]]}]};
 const surprised={schemaVersion:1,id:'surprised',mouthScaleY:2.3,eyeScaleY:1.4,browAngleDeg:-12};
 const neutral={schemaVersion:1,id:'neutral',mouthScaleY:1,eyeScaleY:1,browAngleDeg:0};
 const manifest={schemaVersion:1,id,type:'character',name,renderer:'procedural-three',rig:'rig.json',geometry:'geometry.json',voice:'voice.json',defaultAnimation:'idle',defaultExpression:'neutral',createdAt:now(),updatedAt:now()};
 return {manifest,rig:{schemaVersion:1,type:'humanoid',bones},geometry,animations:{idle,walk},expressions:{neutral,surprised}};
}

export function validateAnimation(data){
 if(!data||data.schemaVersion!==1||!Number.isFinite(data.duration)||data.duration<=0||data.duration>600||!Array.isArray(data.tracks))throw new Error('Animación inválida');
 for(const track of data.tracks){if(!/^[a-zA-Z0-9]+\.rotation\.[xyz]$/.test(track.target)||!Array.isArray(track.keys)||track.keys.length>1000)throw new Error('Pista de animación inválida');let previous=-1;for(const key of track.keys){if(!Array.isArray(key)||key.length!==2||!Number.isFinite(key[0])||!Number.isFinite(key[1])||key[0]<previous||key[0]>data.duration||Math.abs(key[1])>360)throw new Error('Keyframe inválido');previous=key[0];}}
 return data;
}
export function validateScene(s){
 if(!s||s.schemaVersion!==1||!Array.isArray(s.actors)||!Array.isArray(s.props)||!Array.isArray(s.beats)||!Number.isFinite(s.durationSec)||s.durationSec<=0||s.durationSec>3600)throw new Error('Escena inválida');
 for(const a of s.actors){if(!safeSegment(a.characterId)||!Array.isArray(a.position)||a.position.length!==3||!a.position.every(n=>Number.isFinite(n)&&Math.abs(n)<10000)||!Number.isFinite(a.yawDeg))throw new Error('Actor inválido');}
 for(const b of s.beats){if(!Number.isFinite(b.startSec)||!Number.isFinite(b.endSec)||b.startSec<0||b.endSec<b.startSec||b.endSec>s.durationSec||!['dialogue','action','camera','effect'].includes(b.type))throw new Error('Beat inválido');}
 return s;
}
export function evaluateScene(scene,timeSec){
 validateScene(scene);const t=Math.min(scene.durationSec,Math.max(0,Number(timeSec)||0));
 const actors=scene.actors.map(a=>({...a,position:[...a.position],headYawDeg:a.headYawDeg||0,expression:a.expression||'neutral',animation:a.animation||'idle'}));
 const camera=structuredClone(scene.camera);
 for(const b of scene.beats.filter(b=>b.startSec<=t).sort((a,b)=>a.startSec-b.startSec)){
  const alpha=b.endSec===b.startSec?1:Math.min(1,(t-b.startSec)/(b.endSec-b.startSec));
  if(b.type==='action'){
   const actor=actors.find(a=>a.characterId===b.actorId);if(!actor)continue;
   if(b.toPosition&&Array.isArray(b.fromPosition)&&b.fromPosition.length===3){actor.position=b.fromPosition.map((x,i)=>x+(b.toPosition[i]-x)*alpha);}
   if(Number.isFinite(b.yawDeg))actor.yawDeg=(b.fromYawDeg??actor.yawDeg)+(b.yawDeg-(b.fromYawDeg??actor.yawDeg))*alpha;
   if(b.animation)actor.animation=b.animation;
   if(b.expression)actor.expression=b.expression;
  }
  if(b.type==='camera'&&b.position&&Array.isArray(b.fromPosition))camera.position=b.fromPosition.map((x,i)=>x+(b.position[i]-x)*alpha);
 }
 return {timeSec:t,actors,camera,activeDialogues:scene.beats.filter(b=>b.type==='dialogue'&&b.startSec<=t&&b.endSec>=t)};
}

export class FileWorkspace {
 constructor(root=process.env.SERIES_FORGE_WORKSPACE || join(process.cwd(),'workspace')) {this.root=resolve(root);}
 async init(){await mkdir(this.root,{recursive:true});return this;}
 projectPath(project){if(!safeSegment(project))throw new Error('ID de proyecto no válido');return join(this.root,project);}
 async securePath(project,rel=''){
  const root=this.projectPath(project);const abs=resolve(root,rel);if(abs!==root&&!abs.startsWith(root+sep))throw new Error('Ruta fuera del proyecto');
  let next=root;for(const s of relative(root,abs).split(sep).filter(Boolean)){next=join(next,s);try{if((await lstat(next)).isSymbolicLink())throw new Error('Enlaces simbólicos no permitidos');}catch(e){if(e.code!=='ENOENT')throw e;}}
  return abs;
 }
 async put(project,path,content,expectedHash=null){
  if(!allowedPath(path))throw new Error('Ruta de asset no permitida');
  if(typeof content!=='string'||Buffer.byteLength(content,'utf8')>MAX_FILE)throw new Error('Contenido demasiado grande');
  if(path.endsWith('.json')){const obj=JSON.parse(content);if(path.endsWith('/scene.json'))validateScene(obj);if(path.includes('/animations/'))validateAnimation(obj);if(path.endsWith('/manifest.json')&&(!obj.id||!obj.name||obj.schemaVersion!==1))throw new Error('Manifest inválido');}
  const dest=await this.securePath(project,path);let previous=null;try{previous=await readFile(dest,ENCODING);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(expectedHash!==null&&hash(previous??'')!==expectedHash)throw new Error('Conflicto de revisión: recarga el archivo antes de guardar');
  await mkdir(dirname(dest),{recursive:true});const tmp=dest+'.'+uid()+'.tmp';try{await writeFile(tmp,content,{encoding:'utf8',flag:'wx'});await rename(tmp,dest);}finally{await rm(tmp,{force:true}).catch(()=>{});}return {path,hash:hash(content)};
 }
 async read(project,path){if(!allowedPath(path))throw new Error('Ruta no permitida');const src=await this.securePath(project,path);const text=await readFile(src,'utf8');if(Buffer.byteLength(text)>MAX_FILE)throw new Error('Archivo demasiado grande');return {path,content:text,hash:hash(text)};}
 async createProject(name){const project=slugify(ensureString(name,'Nombre'));const dir=this.projectPath(project);try{await lstat(dir);throw new Error('Ya existe ese universo');}catch(e){if(e.code!=='ENOENT')throw e;}await mkdir(dir,{recursive:true});await writeFile(join(dir,'universe.json'),json({schemaVersion:1,id:uid(),slug:project,name,createdAt:now(),fps:24}),{flag:'wx'});return {project,name};}
 async projects(){await this.init();const dirs=await readdir(this.root,{withFileTypes:true});const results=[];for(const d of dirs){if(d.isDirectory()&&safeSegment(d.name)){try{const u=JSON.parse(await readFile(join(this.root,d.name,'universe.json'),'utf8'));results.push({slug:d.name,name:u.name});}catch{results.push({slug:d.name,name:d.name,warning:'Falta universe.json'});}}}return results.sort((a,b)=>a.name.localeCompare(b.name));}
 async createAsset(project,kind,name){
  if(!assetCategories.has(kind))throw new Error('Tipo inválido');const human=ensureString(name,'Nombre');const id=slugify(human);const base=`${kind}/${id}`;const path=`${base}/manifest.json`;
  try{await this.read(project,path);throw new Error('Ya existe un asset con ese nombre');}catch(e){if(e.code!=='ENOENT')throw e;}
  const createdAt=now();let files={};
  if(kind==='characters'){
   const t=humanoidTemplates(human);t.manifest.id=id;
   files={'manifest.json':t.manifest,'rig.json':t.rig,'geometry.json':t.geometry,'voice.json':{schemaVersion:1,provider:null,voiceId:null,language:'es-ES',pitch:0,rate:1},'relaciones.json':{schemaVersion:1,relations:[]},'animations/idle.json':t.animations.idle,'animations/walk.json':t.animations.walk,'expressions/neutral.json':t.expressions.neutral,'expressions/surprised.json':t.expressions.surprised,'aspecto.md':`# ${human}\n\nPersonaje humanoide procedural. Modifica geometry.json y rig.json para variar su aspecto.\n`,'personalidad.md':`# Personalidad de ${human}\n\nPendiente de definir.\n`,'biografia.md':`# Biografía de ${human}\n\nPendiente de definir.\n`,'gustos.md':`# Gustos de ${human}\n\nPendiente de definir.\n`};
  }else if(kind==='environments')files={'manifest.json':{schemaVersion:1,id,type:'environment',name:human,createdAt},'environment.json':{schemaVersion:1,size:[12,8,9],floorColor:'#596472',backdropColor:'#243344',ambientIntensity:.85,lights:[{position:[-3,6,4],intensity:2.0}]},'descripcion.md':`# ${human}\n`};
  else if(kind==='props')files={'manifest.json':{schemaVersion:1,id,type:'prop',name:human,createdAt},'geometry.json':{schemaVersion:1,parts:[{id:'body',primitive:'box',size:[.6,.8,.6],position:[0,.4,0],color:'#bc925b'}]},'descripcion.md':`# ${human}\n`};
  else files={'manifest.json':{schemaVersion:1,id,type:'episode',name:human,createdAt,durationSec:1200,fps:24},'sinopsis.md':`# ${human}\n\nEscribe la sinopsis del capítulo.\n`,'guion.md':`# Guion · ${human}\n\n`};
  for(const [file,data] of Object.entries(files))await this.put(project,`${base}/${file}`,typeof data==='string'?data:json(data));
  return {id,kind,name:human,path:base};
 }
 async createScene(project,episode,name='Escena 01'){
  if(!safeSegment(episode))throw new Error('Episodio inválido');await this.read(project,`episodes/${episode}/manifest.json`);
  const dir=join(this.projectPath(project),'episodes',episode,'scenes');await mkdir(dir,{recursive:true});
  const ids=(await readdir(dir,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^sc-\d+$/.test(e.name)).map(e=>Number(e.name.slice(3)));
  const id='sc-'+String(Math.max(0,...ids)+1).padStart(3,'0');
  const scene={schemaVersion:1,id,name,durationSec:60,environmentId:null,actors:[],props:[],beats:[],camera:{position:[0,2.4,8],target:[0,1,0],orthographicSize:6.5}};
  await this.put(project,`episodes/${episode}/scenes/${id}/scene.json`,json(scene));
  await this.put(project,`episodes/${episode}/scenes/${id}/dialogue.json`,json({schemaVersion:1,cues:[]}));return {id,scene};
 }
 async catalog(project){
  const base=this.projectPath(project);await lstat(base);
  const result={project,assets:{characters:[],environments:[],props:[],episodes:[]},errors:[]};
  for(const kind of KINDS){const dir=join(base,kind);let entries=[];try{entries=await readdir(dir,{withFileTypes:true});}catch(e){if(e.code!=='ENOENT')throw e;}
   for(const ent of entries.filter(e=>e.isDirectory()&&safeSegment(e.name))){const path=`${kind}/${ent.name}/manifest.json`;try{const m=JSON.parse((await this.read(project,path)).content);if(m.schemaVersion!==1||typeof m.name!=='string')throw new Error('Manifest inválido');result.assets[kind].push({id:ent.name,name:m.name,path:`${kind}/${ent.name}`,type:m.type});}catch(e){result.errors.push({path,error:e.message});}}
  }return result;
 }
 async listScenes(project,episode){if(!safeSegment(episode))throw new Error('Episodio inválido');const path=await this.securePath(project,`episodes/${episode}/scenes`);let dirs=[];try{dirs=await readdir(path,{withFileTypes:true});}catch(e){if(e.code!=='ENOENT')throw e;}
  const scenes=[];for(const x of dirs.filter(e=>e.isDirectory()&&safeSegment(e.name))){const file=`episodes/${episode}/scenes/${x.name}/scene.json`;try{const s=JSON.parse((await this.read(project,file)).content);validateScene(s);scenes.push({id:x.name,name:s.name,durationSec:s.durationSec,path:file});}catch(e){scenes.push({id:x.name,path:file,error:e.message});}}return scenes.sort((a,b)=>a.id.localeCompare(b.id));
 }
 async importLegacy(legacy,projectName='Importación v0.1'){
  if(!legacy||legacy.schemaVersion!==1)throw new Error('Formato legado no admitido');const project=(await this.createProject(projectName)).project;const maps={characters:{},environments:{},objects:{},series:{}};
  for(const [legacyKind,kind] of [['characters','characters'],['environments','environments'],['objects','props'],['series','episodes']]){
   for(const obj of legacy[legacyKind]||[]){const a=await this.createAsset(project,kind,obj.name);maps[legacyKind][obj.id]=a.id;
    await this.put(project,`${kind}/${a.id}/legacy.json`,json(obj));
    if(kind==='characters'){await this.put(project,`characters/${a.id}/biografia.md`,obj.story?.biography||obj.story?.backstory||'Biografía sin definir.');await this.put(project,`characters/${a.id}/relaciones.json`,json({schemaVersion:1,relations:Object.entries(obj.story?.relationships||{}).map(([id,r])=>({...r,characterId:maps.characters[id]||id}))}));}
   }
  }
  return {project,maps,legacyScenes:(legacy.scenes||[]).length,warning:'Escenas legadas conservadas en data/studio.json; migración de timeline requiere revisión manual'};
 }
 async watch(project,onChange){const dir=await this.securePath(project);let closed=false, handle=null;try{handle=watchFs(dir,{recursive:true});}catch{}if(!handle){return ()=>{};}
  (async()=>{try{for await(const event of handle){if(closed)break;onChange({event:event.eventType,path:String(event.filename||'')});}}catch{}})();return ()=>{closed=true;handle.return?.().catch(()=>{});};
 }
}