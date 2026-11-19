import { FileWorkspace } from '../src/workspace.mjs';
const ws=await new FileWorkspace().init();let slug;
try{slug=(await ws.createProject('Demo de Producción')).project;}catch(e){if(!e.message.includes('Ya existe'))throw e;slug='demo-de-produccion';}
const asset=async(kind,name)=>{try{return await ws.createAsset(slug,kind,name);}catch(e){if(!e.message.includes('Ya existe'))throw e;return {id:name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-'),name};}};
const bruno=await asset('characters','Bruno'),lara=await asset('characters','Lara');
await ws.put(slug,`characters/${bruno.id}/personalidad.md`,'# Bruno\n\nMecánico ingenioso, sarcástico, reservado. Le preocupa fallar a Lara.\n');
await ws.put(slug,`characters/${lara.id}/personalidad.md`,'# Lara\n\nIngeniera impulsiva, muy observadora. Confía en Bruno, pero odia las evasivas.\n');
await ws.put(slug,`characters/${bruno.id}/relaciones.json`,JSON.stringify({schemaVersion:1,relations:[{characterId:lara.id,type:'amistad',feeling:'confianza',history:['Repararon juntos un reactor.']}]},null,2)+'\n');
const taller=await asset('environments','Taller'),silla=await asset('props','Silla'),episode=await asset('episodes','Piloto');
let sc;try{sc=await ws.createScene(slug,episode.id,'La avería');}catch(e){throw e;}
const path=`episodes/${episode.id}/scenes/${sc.id}/scene.json`,s=JSON.parse((await ws.read(slug,path)).content);
s.environmentId=taller.id;s.durationSec=45;s.actors=[{characterId:bruno.id,position:[-1,0,0],yawDeg:35,headYawDeg:20,animation:'idle',expression:'neutral'},{characterId:lara.id,position:[1.4,0,0],yawDeg:-35,headYawDeg:-20,animation:'idle',expression:'neutral'}];
s.props=[{propId:silla.id,position:[-2.4,0,.3],yawDeg:0}];
s.beats=[
 {id:'start',type:'camera',startSec:0,endSec:5,fromPosition:[0,2.4,8],position:[0,2.1,7]},
 {id:'lara-approaches',type:'action',actorId:lara.id,startSec:2,endSec:7,fromPosition:[1.4,0,0],toPosition:[.75,0,0],animation:'walk'},
 {id:'lara-says',type:'dialogue',actorId:lara.id,text:'Bruno, ¿qué ha ocurrido en el taller?',startSec:8,endSec:11,emotion:'surprised'},
 {id:'bruno-turns',type:'action',actorId:bruno.id,startSec:11,endSec:13,fromYawDeg:35,yawDeg:70,expression:'surprised'},
 {id:'bruno-says',type:'dialogue',actorId:bruno.id,text:'Creo que tenemos un problema bastante serio.',startSec:14,endSec:18,emotion:'worried'}
];await ws.put(slug,path,JSON.stringify(s,null,2)+'\n');console.log(`Demo creada en workspace/${slug}. Abre http://127.0.0.1:4317`);