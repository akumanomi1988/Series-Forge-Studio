import { applyPromptToCharacter, touch, normalize } from './core.mjs';

const clean = s => String(s||'').trim().slice(0,1500);
const has = (n,words)=>words.some(w=>n.includes(w));
const creation = n => /\b(crea|crear|genera|generar|dibuja|disena|diseña|construye|inventa)\b/.test(n);
function guessType(n){
 if(has(n,['escenario','entorno','laboratorio','bosque','castillo','ciudad','habitacion','fabrica','taberna','paisaje','planeta','espacio exterior']))return 'environments';
 if(has(n,['objeto','llave','mesa','silla','espada','libro','lampara','puerta','taza','caja','mueble']))return 'objects';
 if(has(n,['episodio','escena','plano','secuencia']))return 'scenes';
 if(has(n,['serie','universo','historia de serie']))return 'series';
 return 'characters';
}
function chosen(state, selected) {
 if(selected?.type && selected?.id){const e=state[selected.type]?.find(x=>x.id===selected.id);if(e)return {type:selected.type,entity:e};}
 return null;
}
function locateByName(state,text){const n=normalize(text);let match=null;for(const t of ['characters','environments','objects','scenes','series'])for(const e of state[t])if(e.name.length>=3&&n.includes(normalize(e.name)))match={type:t,entity:e};return match;}
function renamed(msg){const m=msg.match(/(?:se llama|llamalo|ll[aá]mala|renombra(?:lo|la)?\s+(?:a)?|ponle de nombre|cambia el nombre a)\s*[:]?\s*([\p{L}\d\s-]{2,60})/iu);return m?.[1]?.trim().replace(/[.?!]+$/,'');}
function freeText(msg,heads){const n=normalize(msg);for(const h of heads){const idx=n.indexOf(h);if(idx>=0)return msg.slice(idx+h.length).trim().replace(/^[:\s]+/,'');}return msg;}
export async function interpretChat(store,message,selection=null,options={}){
 const msg=clean(message), n=normalize(msg);if(!msg)throw new Error('Escribe una instrucción');
 const state=store.snapshot(), target=chosen(state,selection)||locateByName(state,msg);
 if(creation(n)&&!has(n,['modifica','cambia'])){
  const type=guessType(n), ent=await store.create(type,{prompt:msg});
  if(type==='scenes'){
   const latestEnv=state.environments.at(-1), latestSeries=state.series.at(-1);
   if(latestEnv||latestSeries)await store.patch('scenes',ent.id,{...(latestEnv?{environmentId:latestEnv.id}:{}),...(latestSeries?{seriesId:latestSeries.id}:{})});
  }
  return {mode:'local',message:`He creado ${ent.name} en ${({characters:'Personajes',environments:'Entornos',objects:'Objetos',scenes:'Escenas',series:'Series'})[type]}. El asset es editable, reutilizable y conserva revisiones.`,selection:{type,id:ent.id},entity:store.get(type,ent.id)};
 }
 if(has(n,['es amigo de','es amiga de','odia a ','se lleva bien con','es rival de','se enamoro de'])){
  const chars=state.characters.filter(c=>n.includes(normalize(c.name)));
  if(chars.length>=2){const relation=has(n,['amigo','amiga'])?'amistad':n.includes('odia')?'rivalidad':'relacion';const entity=await store.relationship(chars[0].id,chars[1].id,relation,msg);return {mode:'local',message:`Relación guardada: ${chars[0].name} → ${chars[1].name}.`,selection:{type:'characters',id:entity.id},entity};}
  throw new Error('Nombra los dos personajes existentes para crear su relación');
 }
 if(has(n,['recuerda que','acontecimiento','sucedio que','ocurrio que','pasado de'])){
  const actor=target?.type==='characters'?target.entity:null;
  const ev=await store.addEvent({characterId:actor?.id||null,seriesId:state.series.at(-1)?.id||null,summary:msg,emotion:actor?.performance.expression||'neutral'});
  return {mode:'local',message:'Acontecimiento incorporado al historial narrativo. No modifico automáticamente hechos previos.',selection:target?{type:target.type,id:target.entity.id}:null,event:ev};
 }
 if(!target)throw new Error('Selecciona un asset para modificarlo o escribe «crea un hombre», «crea un bosque», «crea una llave» o «crea una escena».');
 const type=target.type,id=target.entity.id;
 const newName=renamed(msg);
 if(newName){const updated=await store.patch(type,id,{name:newName});return {mode:'local',message:`Ahora se llama ${updated.name}. Conserva su identidad y su historial.`,selection:{type,id},entity:updated};}
 if(type==='characters'){
  const mod=await store.change(s=>{const e=s.characters.find(c=>c.id===id);applyPromptToCharacter(e,msg);return e;});
  if(has(n,['voz grave','voz mas grave'])){await store.patch(type,id,{'voice.pitch':0.8});}
  if(has(n,['voz aguda','voz mas aguda'])){await store.patch(type,id,{'voice.pitch':1.4});}
  const bio=msg.match(/(?:biografia|biografía|su pasado es)\s*[:=]?\s+(.+)/i);
  if(bio)await store.patch(type,id,{'story.biography':bio[1]});
  const fear=msg.match(/(?:tiene miedo a|teme)\s+(.+)/i);
  if(fear)await store.patch(type,id,{'story.fear':fear[1]});
  const goals=msg.match(/(?:su objetivo es|quiere conseguir|quiere lograr)\s+(.+)/i);
  if(goals)await store.patch(type,id,{'story.goal':goals[1]});
  return {mode:'local',message:`He actualizado a ${mod.name}. Los cambios se guardan en la ficha y el preview, sin crear un personaje nuevo.`,selection:{type,id},entity:store.get(type,id)};
 }
 if(type==='objects'){
  const patch={};const c=extractColor(n);
  if(c)patch['params.color']=c;
  if(has(n,['mas grande','agrand','aumenta']))patch['params.scale']=Math.min(1.7,target.entity.params.scale+0.2);
  if(has(n,['mas pequeno','mas pequeña','reduce']))patch['params.scale']=Math.max(0.5,target.entity.params.scale-0.2);
  if(/(?:es|esta|queda)\s+(abierta|abierto|cerrada|cerrado|rota|roto)/.test(n))patch['interaction.state']=n.includes('abiert')?'abierto':n.includes('cerrad')?'cerrado':'roto';
  if(Object.keys(patch).length===0)patch['story.description']=msg;
  const e=await store.patch(type,id,patch);return {mode:'local',message:`Objeto «${e.name}» modificado y versionado.`,selection:{type,id},entity:e};
 }
 if(type==='environments'){
  const patch={};const c=extractColor(n);
  if(c)patch[/suelo|piso/.test(n)?'params.floorColor':/pared/.test(n)?'params.wallColor':'params.skyColor']=c;
  if(n.includes('noche'))patch['params.timeOfDay']='noche';else if(n.includes('dia'))patch['params.timeOfDay']='dia';
  if(n.includes('lluvia'))patch['params.weather']='lluvia';
  if(!Object.keys(patch).length)patch['story.description']=msg;
  const e=await store.patch(type,id,patch);return {mode:'local',message:`He modificado el entorno «${e.name}». Todas las escenas que lo reutilicen conservarán su referencia.`,selection:{type,id},entity:e};
 }
 if(type==='series'){
  const e=await store.patch(type,id,{'bible.premise':msg});return {mode:'local',message:`Biblia narrativa de «${e.name}» actualizada.`,selection:{type,id},entity:e};
 }
 if(type==='scenes'){
  const e=await store.patch(type,id,{description:msg});return {mode:'local',message:`Descripción de la escena «${e.name}» actualizada.`,selection:{type,id},entity:e};
 }
 throw new Error('No puedo interpretar esta modificación');
}
function extractColor(n){const colorMap={rojo:'#d94c57',roja:'#d94c57',azul:'#477ed3',verde:'#49a47e',negro:'#262b39',blanco:'#e8eaf2',amarillo:'#e8be55',morado:'#a27bc5',rosa:'#d482a1',gris:'#8c93a3',marron:'#805740',naranja:'#e18b55',dorado:'#d7ac50',plateado:'#c1c5d3',turquesa:'#4cbeb5'}; const m=n.match(/#[a-f0-9]{6}/);if(m)return m[0];const k=Object.keys(colorMap).find(k=>new RegExp(`\\b${k}\\b`).test(n));return k?colorMap[k]:null;}

// Optional bridge: OpenAI-compatible endpoint. It must return one JSON action; unknown tools and properties are rejected.
// Only enabled if STUDIO_LLM_URL and STUDIO_LLM_MODEL have been deliberately supplied.
export async function aiChat(store,message,selection){
 const endpoint=process.env.STUDIO_LLM_URL,model=process.env.STUDIO_LLM_MODEL;
 if(!endpoint||!model)return interpretChat(store,message,selection);
 const url=new URL(endpoint);if(!['http:','https:'].includes(url.protocol))throw new Error('URL LLM inválida');
 const state=store.snapshot();const summary=Object.fromEntries(['characters','environments','objects','scenes','series'].map(t=>[t,state[t].map(({id,name})=>({id,name}))]));
 const instructions=`Eres un editor de una aplicación audiovisual. Responde SOLO en JSON con {"action":"create|patch|relationship|event|place_actor|place_object|dialogue|clarify","type":"characters|objects|environments|scenes|series","id":"...","args":{...},"message":"..."}. Para patch usa claves de rutas aplanadas permitidas: appearance.hairColor,appearance.shirtColor,appearance.pantsColor,appearance.height,appearance.build,appearance.glasses,appearance.hat,appearance.beard,appearance.scar,performance.pose,performance.expression,story.biography,story.personality,story.goal,story.fear,voice.pitch,voice.rate,name,params.color,params.skyColor,params.wallColor,params.floorColor,params.scale,params.timeOfDay,story.description,bible.premise. NO inventes IDs. Para crear args={prompt:"texto",name:"opcional"}. Para place_actor/place_object args={sceneId,characterId|objectId,x,y}. Para relationship args={fromId,toId,relation,feeling}. Para event args={summary,characterId,seriesId,emotion}. Para dialogue args={sceneId,characterId,text}. Si no es posible devuelve clarify. Solo responde a la petición del usuario.`;
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
 let res;
 try{res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.STUDIO_LLM_API_KEY?{Authorization:`Bearer ${process.env.STUDIO_LLM_API_KEY}`}:{})},body:JSON.stringify({model,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify({assets:summary,selection,request:clean(message)})}],temperature:0.15,response_format:{type:'json_object'}}),signal:controller.signal});}finally{clearTimeout(timeout);}
 if(!res.ok)throw new Error(`Proveedor IA respondió ${res.status}`);
 const output=await res.json();const content=output.choices?.[0]?.message?.content;if(typeof content!=='string')throw new Error('Respuesta IA vacía');
 let action;try{action=JSON.parse(content);}catch{throw new Error('La IA no devolvió JSON válido');}
 const a=action.args||{};
 let e;
 switch(action.action){
  case 'create':e=await store.create(action.type,a);break;
  case 'patch':e=await store.patch(action.type,action.id,a);break;
  case 'relationship':e=await store.relationship(a.fromId,a.toId,a.relation,a.feeling);break;
  case 'event':e=await store.addEvent(a);break;
  case 'place_actor':e=await store.placeActor(a.sceneId,a.characterId,a);break;
  case 'place_object':e=await store.placeObject(a.sceneId,a.objectId,a);break;
  case 'dialogue':e=await store.addDialogue(a.sceneId,a.characterId,a.text);break;
  case 'clarify':return {mode:'llm',message:clean(action.message)||'Necesito más detalles',selection};
  default:throw new Error(`Acción de IA no admitida: ${action.action}`);
 }
 const type=action.action==='create'||action.action==='patch'?action.type:selection?.type;
 const entityId=action.action==='create'||action.action==='patch'?e.id:selection?.id;
 return {mode:'llm',message:clean(action.message)||'Cambio aplicado.',selection:type&&entityId?{type,id:entityId}:selection,entity:e};
}
