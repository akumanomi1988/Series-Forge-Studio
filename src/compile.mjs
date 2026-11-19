import { randomUUID } from 'node:crypto';
import { createCharacter, createEnvironment, createObject, createSeries, createScene, patchEntity } from './core.mjs';
const MAX={characters:30,environments:30,objects:120,scenes:60};
function cleanRef(ref){if(typeof ref!=='string'||!/^[-_a-zA-Z0-9]{1,60}$/.test(ref))throw new Error('Referencia lógica inválida');return ref;}
function requireArray(x,label,max){if(x==null)return [];if(!Array.isArray(x)||x.length>max)throw new Error(`${label} debe ser un array de máximo ${max}`);return x;}
function number(v,def,min,max){return typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):def;}
export async function compileEpisodePlan(store,plan){
 if(!plan||typeof plan!=='object'||typeof plan.synopsis!=='string'||!plan.synopsis.trim())throw new Error('El plan requiere synopsis');
 const cs=requireArray(plan.characters,'characters',MAX.characters),es=requireArray(plan.environments,'environments',MAX.environments),os=requireArray(plan.objects,'objects',MAX.objects),ss=requireArray(plan.scenes,'scenes',MAX.scenes),rels=requireArray(plan.relationships,'relationships',200),evs=requireArray(plan.events,'events',300);
 if(!ss.length)throw new Error('El plan debe incluir al menos una escena');
 const ids=new Set(),mapping={};
 function register(key,e){const k=cleanRef(key);if(ids.has(k))throw new Error('Referencias lógicas duplicadas: '+k);ids.add(k);mapping[k]=e.id;}
 return store.change(state=>{
  const ser=createSeries(plan.synopsis,{name:plan.title||'Nueva serie'});ser.bible.genre=String(plan.genre||'aventura').slice(0,80);state.series.push(ser);register('series',ser);
  for(const p of cs){const c=createCharacter(p.prompt||`Crea un personaje llamado ${p.name||p.ref}` ,{name:p.name||p.ref});if(p.biography)c.story.biography=String(p.biography).slice(0,1000);if(p.personality)c.story.personality=String(p.personality).slice(0,500);if(p.goal)c.story.goal=String(p.goal).slice(0,500);if(p.voice&&typeof p.voice==='object')patchEntity(c,'characters',Object.fromEntries(Object.entries(p.voice).filter(([k])=>['voice.voiceName','voice.rate','voice.pitch','voice.locale'].includes(k))));if(p.appearance&&typeof p.appearance==='object')patchEntity(c,'characters',Object.fromEntries(Object.entries(p.appearance).filter(([k])=>k.startsWith('appearance.'))));state.characters.push(c);register(p.ref,c);}
  for(const p of es){const e=createEnvironment(p.prompt||p.name||p.ref,{name:p.name||p.ref});state.environments.push(e);register(p.ref,e);}
  for(const p of os){const o=createObject(p.prompt||p.name||p.ref,{name:p.name||p.ref});state.objects.push(o);register(p.ref,o);}
  for(const p of ss){const envId=p.environmentRef?mapping[p.environmentRef]:state.environments.at(-1)?.id||null;if(p.environmentRef&&!envId)throw new Error(`Escenario inexistente: ${p.environmentRef}`);
   const scene=createScene({name:p.name||p.ref||'Escena',seriesId:ser.id,environmentId:envId});scene.description=String(p.description||'').slice(0,1000);scene.durationSeconds=number(p.durationSeconds,15,1,120);scene.actors=[];scene.props=[];scene.dialogues=[];
   for(const a of requireArray(p.actors,'scene.actors',30)){const aid=mapping[a.ref];if(!aid||!state.characters.some(c=>c.id===aid))throw new Error(`Actor inexistente: ${a.ref}`);scene.actors.push({characterId:aid,x:number(a.x,240,0,960),y:number(a.y,470,80,540),pose:['idle','saludar','caminar','señalar','sentado'].includes(a.pose)?a.pose:'idle',expression:['neutral','feliz','triste','enfadado','asustado','sorprendido','pensativo'].includes(a.expression)?a.expression:'neutral',heldObjectId:null});}
   for(const a of requireArray(p.props,'scene.props',60)){const oid=mapping[a.ref];if(!oid||!state.objects.some(o=>o.id===oid))throw new Error(`Objeto inexistente: ${a.ref}`);scene.props.push({objectId:oid,x:number(a.x,490,0,960),y:number(a.y,470,80,540)});}
   for(const d of requireArray(p.dialogues,'scene.dialogues',90)){const cid=mapping[d.characterRef];if(!scene.actors.some(a=>a.characterId===cid))throw new Error(`Diálogo de actor que no está en escena: ${d.characterRef}`);scene.dialogues.push({id:`dlg_${cryptoId()}`,characterId:cid,text:String(d.text||'').slice(0,500)});}
   state.scenes.push(scene);register(p.ref||scene.id,scene);
  }
  for(const rel of rels){const a=state.characters.find(c=>c.id===mapping[rel.fromRef]),b=state.characters.find(c=>c.id===mapping[rel.toRef]);if(!a||!b||a===b)throw new Error('Relación inválida entre '+rel.fromRef+' y '+rel.toRef);a.story.relationships[b.id]={relation:String(rel.relation||'relacion').slice(0,100),feeling:String(rel.feeling||'neutral').slice(0,100),updatedAt:new Date().toISOString()};}
  for(const ev of evs){const charId=ev.characterRef?mapping[ev.characterRef]:null;if(ev.characterRef&&!charId)throw new Error('Recuerdo sin personaje: '+ev.characterRef);const evt={id:`evt_${cryptoId()}`,seriesId:ser.id,characterId:charId,summary:String(ev.summary||'').slice(0,800),emotion:String(ev.emotion||'neutral').slice(0,60),effects:[],at:new Date().toISOString()};state.events.push(evt);if(charId)state.characters.find(c=>c.id===charId).story.memories.push({eventId:evt.id,summary:evt.summary,emotion:evt.emotion});}
  return {seriesId:ser.id,mapping,created:{characters:cs.length,environments:es.length,objects:os.length,scenes:ss.length,relationships:rels.length,events:evs.length},status:'storyboard vectorial editable, no vídeo final'};
 });
}
function cryptoId(){return randomUUID().slice(0,10);}
