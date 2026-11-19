import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, open, unlink, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const CATEGORIES = ['characters', 'environments', 'objects', 'scenes', 'series'];
const MAX_TEXT = 3000;
const VALID_MOODS = ['neutral', 'feliz', 'triste', 'enfadado', 'asustado', 'sorprendido', 'pensativo'];
const VALID_POSES = ['idle', 'saludar', 'caminar', 'señalar', 'sentado'];
const VALID_ENV = ['laboratorio', 'bosque', 'ciudad', 'castillo', 'interior', 'espacio'];
const VALID_OBJ = ['llave', 'mesa', 'silla', 'espada', 'libro', 'lampara', 'puerta', 'caja', 'taza', 'robot', 'objeto'];
const COLOR_WORDS = {
  rojo: '#d94c57', roja: '#d94c57', azul: '#477ed3', azulada: '#477ed3', verde: '#49a47e',
  negro: '#262b39', negra: '#262b39', blanco: '#e8eaf2', blanca: '#e8eaf2',
  amarillo: '#e8be55', amarilla: '#e8be55', morado: '#a27bc5', morada: '#a27bc5',
  rosa: '#d482a1', gris: '#8c93a3', marron: '#805740', marrón: '#805740',
  naranja: '#e18b55', dorado: '#d7ac50', dorada: '#d7ac50', plateado: '#c1c5d3',
  violeta: '#9874bd', turquesa: '#4cbeb5', castaño: '#805740'
};
export const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const short = (v, n = MAX_TEXT) => String(v ?? '').trim().slice(0, n);
const color = (v, fallback) => (/^#[a-f0-9]{6}$/i.test(String(v || '')) ? v : fallback);
const clamp = (v, min, max, def) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : def;
const now = () => new Date().toISOString();
const wordColor = s => { const n=normalize(s); for(const [k,v] of Object.entries(COLOR_WORDS)) if(n.includes(normalize(k))) return v; return null; };
const choice = (s, opts, def) => { const n=normalize(s); return opts.find(x => n.includes(normalize(x))) || def; };
const id = prefix => `${prefix}_${randomUUID().slice(0,8)}`;

export function emptyState() {
 return { schemaVersion:1, metadata:{name:'Series Forge Studio', createdAt:now(), revision:0}, series:[], characters:[], environments:[], objects:[], scenes:[], events:[] };
}
function base(type,name) { return {id:id(type.slice(0,3)),name:short(name || 'Sin nombre',120),revision:1,createdAt:now(),updatedAt:now(),history:[]}; }
const skintones = ['#f0bf96','#bd855f','#7b4d3a','#dca47b'];
function fromName(prompt,type, fallback) {
 const p=short(prompt,350);
 const direct=p.match(/(?:llamad[oa]|nombre|denominad[oa])\s+([\p{L}\d_-]+(?:\s+[\p{L}\d_-]+)?)/iu);
 if(direct) return direct[1];
 const kind=type==='character'?'(?:hombre|mujer|personaje|robot|niñ[oa])':type==='object'?'(?:llave|mesa|silla|espada|libro|l[aá]mpara|puerta|caja|taza|objeto)':'(?:bosque|ciudad|laboratorio|castillo|casa|estaci[oó]n|escenario|entorno)';
 const m=p.match(new RegExp(`(?:crea|crear|genera|haz|diseña|anade|añade)\\s+(?:un|una|el|la)?\\s*(${kind})`, 'iu'));
 return m ? m[1][0].toUpperCase()+m[1].slice(1) : fallback;
}
export function createCharacter(prompt, attrs={}) {
 const n=normalize(prompt);
 const male=/\b(hombre|chico|varon|masculino|padre)\b/.test(n);
 const female=/\b(mujer|chica|femenin|madre)\b/.test(n);
 const robot=/\brobot\b/.test(n);
 const c=base('character',attrs.name || fromName(prompt,'character',robot?'Robot':female?'Mujer':'Hombre'));
 c.kind=robot?'robot':'human';
 c.appearance={ gender: male?'hombre':female?'mujer':'neutro', skinTone:skintones[Number.parseInt(c.id.slice(-1),16)%4], hairColor:'#352b37', hairStyle: /calv[oa]/.test(n)?'calvo': /larg[oa]/.test(n)?'largo':'corto', eyeColor:'#344d68', shirtColor:'#4e82c9', pantsColor:'#353c57', height:1, build:1, glasses:/gafas|lentes/.test(n), beard:/barba/.test(n), scar:/cicatriz/.test(n), hat:/sombrero|gorra/.test(n) };
 c.performance={pose:'idle',expression:choice(n,VALID_MOODS,'neutral'),heldObjectId:null};
 c.voice={locale:'es-ES',voiceName:'',rate:1,pitch:male?0.9:1.1,notes:''};
 c.story={biography:'',personality:'',goal:'',fear:'',secret:'',feelings:'',memories:[],relationships:{}};
 applyPromptToCharacter(c,prompt,{silent:true});
 return c;
}
export function createEnvironment(prompt, attrs={}) {
 const n=normalize(prompt);
 const e=base('environment',attrs.name||fromName(prompt,'environment','Nuevo escenario'));
 const theme = n.includes('taberna')||n.includes('habitacion')||n.includes('casa')||n.includes('salon')?'interior':choice(n,VALID_ENV,'interior');
 e.theme=theme;
 e.params={skyColor:wordColor(n)||'#536f99', floorColor:'#3a475b', wallColor:'#3d526a', timeOfDay:/nocturn|noche|oscuro/.test(n)?'noche':'dia', weather:/lluvia/.test(n)?'lluvia':'despejado', seed:Math.floor(Math.random()*100000)};
 e.story={description:short(prompt,300),lore:''};
 return e;
}
export function createObject(prompt, attrs={}) {
 const n=normalize(prompt);
 const o=base('object',attrs.name||fromName(prompt,'object','Nuevo objeto'));
 o.kind=choice(n,VALID_OBJ,'objeto');
 o.params={color:wordColor(n)||'#d4aa62',scale:1,material:/madera/.test(n)?'madera':/metal/.test(n)?'metal':'generico',seed:Math.floor(Math.random()*100000)};
 o.interaction={pickupable:!['mesa','puerta','silla'].includes(o.kind),state:'libre',heldBy:null,description:''};
 o.story={description:short(prompt,300),ownerId:null};
 return o;
}
export function createSeries(prompt,attrs={}) {
 const s=base('series',attrs.name||'Nueva serie');
 s.bible={premise:short(prompt),genre:'aventura',tone:'cinematografico',rules:'',history:[],relationships:[],canonRevision:0};
 return s;
}
export function createScene({name='Escena nueva',environmentId=null,seriesId=null}={}) {
 return {...base('scene',name),environmentId,seriesId,actors:[],props:[],dialogues:[],description:'',durationSeconds:15};
}
function colorFromSegment(n, role) {
 const rx=role==='hair'?/(?:pelo|cabello)(?:\s+de\s+color)?\s+([a-záéíóú#0-9]+)/:role==='shirt'?/(?:camisa|chaqueta|camiseta|ropa|jersey|abrigo)(?:\s+de\s+color)?\s+([a-záéíóú#0-9]+)/:role==='pants'?/(?:pantalon|pantalones|falda)(?:\s+de\s+color)?\s+([a-záéíóú#0-9]+)/:/(?:ojos)(?:\s+de\s+color)?\s+([a-záéíóú#0-9]+)/;
 const m=n.match(rx);
 return m? wordColor(m[1])||color(m[1],null):null;
}
export function applyPromptToCharacter(c,prompt,{silent=false}={}) {
 const n=normalize(prompt);
 const a=c.appearance;
 const hair=colorFromSegment(n,'hair'); if(hair)a.hairColor=hair;
 const shirt=colorFromSegment(n,'shirt'); if(shirt)a.shirtColor=shirt;
 const pants=colorFromSegment(n,'pants'); if(pants)a.pantsColor=pants;
 const eyes=colorFromSegment(n,'eyes'); if(eyes)a.eyeColor=eyes;
 if(/\bmas alto|mas alta|alto|alta|alargar\b/.test(n)) a.height=clamp(a.height+0.15,0.6,1.6,1);
 if(/\bmas bajo|mas baja|bajito|bajita\b/.test(n)) a.height=clamp(a.height-0.15,0.6,1.6,1);
 if(/\bmas fuerte|musculoso|musculosa|corpulento|corpulenta\b/.test(n)) a.build=clamp(a.build+0.2,0.6,1.7,1);
 if(/\bmas delgado|mas delgada|fino|fina\b/.test(n)) a.build=clamp(a.build-0.15,0.6,1.7,1);
 if(/pelo largo|cabello largo|alarga el pelo/.test(n)) a.hairStyle='largo';
 if(/pelo corto|cabello corto|corta el pelo/.test(n)) a.hairStyle='corto';
 if(/calvo|calva|sin pelo/.test(n)) a.hairStyle='calvo';
 if(/sin gafas|quita.*gafas/.test(n)) a.glasses=false; else if(/gafas|lentes/.test(n))a.glasses=true;
 if(/sin barba|quita.*barba/.test(n))a.beard=false; else if(/barba/.test(n))a.beard=true;
 if(/sin cicatriz|quita.*cicatriz/.test(n))a.scar=false; else if(/cicatriz/.test(n))a.scar=true;
 if(/sin sombrero|quita.*sombrero|quita.*gorra/.test(n))a.hat=false; else if(/sombrero|gorra/.test(n))a.hat=true;
 if(/saluda|saludar/.test(n))c.performance.pose='saludar';
 if(/camina|caminar|andando/.test(n))c.performance.pose='caminar';
 if(/señala|senala|señalar|senalar/.test(n))c.performance.pose='señalar';
 if(/quieto|parado|idle/.test(n))c.performance.pose='idle';
 for(const mood of VALID_MOODS) if(n.includes(normalize(mood))) c.performance.expression=mood;
 const goal=prompt.match(/(?:su objetivo es|quiere conseguir|quiere lograr)\s+(.+)/i); if(goal)c.story.goal=short(goal[1],300);
 const personality=prompt.match(/(?:personalidad|es una persona)\s*[:=]?\s+(.+)/i); if(personality)c.story.personality=short(personality[1],350);
 if(!silent)touch(c,'Cambio por chat',prompt);
 return c;
}
export function touch(e,label,detail='') { e.revision++;e.updatedAt=now();e.history=(e.history||[]).concat([{at:e.updatedAt,label,detail:short(detail,400)}]).slice(-40);return e; }
export function patchEntity(entity,type,patch){
 const stringPaths={characters:['name','story.biography','story.personality','story.goal','story.fear','story.secret','story.feelings','voice.voiceName','voice.locale','voice.notes','performance.pose','performance.expression','appearance.gender','appearance.hairStyle'],environments:['name','theme','story.description','story.lore','params.timeOfDay','params.weather'],objects:['name','kind','story.description','interaction.description','interaction.state'],scenes:['name','description','environmentId','seriesId','durationSeconds'],series:['name','bible.premise','bible.genre','bible.tone','bible.rules']};
 const numericPaths={characters:['appearance.height','appearance.build','voice.rate','voice.pitch'],objects:['params.scale'],scenes:['durationSeconds']};
 const booleanPaths={characters:['appearance.glasses','appearance.beard','appearance.scar','appearance.hat'],objects:['interaction.pickupable']};
 const colorPaths={characters:['appearance.skinTone','appearance.hairColor','appearance.eyeColor','appearance.shirtColor','appearance.pantsColor'],objects:['params.color'],environments:['params.skyColor','params.floorColor','params.wallColor']};
 const allowed=[...(stringPaths[type]||[]),...(numericPaths[type]||[]),...(booleanPaths[type]||[]),...(colorPaths[type]||[])];
 for (const [path,val] of Object.entries(patch||{})) {
  if(!allowed.includes(path))throw new Error(`Campo no editable: ${path}`);
  const keys=path.split('.');let target=entity;for(let i=0;i<keys.length-1;i++)target=target[keys[i]];
  const key=keys.at(-1);
  if(colorPaths[type]?.includes(path)) {if(!/^#[a-f0-9]{6}$/i.test(String(val)))throw new Error(`Color inválido: ${val}`);target[key]=val;}
  else if(numericPaths[type]?.includes(path)) target[key]=clamp(val, path.includes('duration')?1:0.5,path.includes('duration')?120:1.7,target[key]);
  else if(booleanPaths[type]?.includes(path))target[key]=Boolean(val);
  else {const v=short(val,400);if(path==='performance.pose'&&!VALID_POSES.includes(v))throw new Error('Pose no admitida');if(path==='performance.expression'&&!VALID_MOODS.includes(v))throw new Error('Expresión no admitida');target[key]=v;}
 }
 touch(entity,'Edición de propiedades',JSON.stringify(patch).slice(0,400));
 return entity;
}

export class StudioStore {
 constructor(root=process.env.STUDIO_DATA_DIR || join(process.cwd(),'data')) {this.root=resolve(root);this.file=join(this.root,'studio.json');this.state=emptyState();this.queue=Promise.resolve();}
 async init(){await mkdir(this.root,{recursive:true});try {const json=JSON.parse(await readFile(this.file,'utf8'));if(json.schemaVersion!==1)throw new Error('Schema desconocido');this.state=json;}catch(e){if(e.code!=='ENOENT')throw e;await this.flush();}return this;}
 async flush(){const data=JSON.stringify(this.state,null,2);const tmp=this.file+'.'+randomUUID()+'.tmp';await writeFile(tmp,data,'utf8');await rename(tmp,this.file);}
 async reload(){await this.queue;this.state=JSON.parse(await readFile(this.file,'utf8'));return this.state;}
 async withLock(fn){const lock=this.file+'.lock';let fh=null;const start=Date.now();while(!fh){try{fh=await open(lock,'wx');}catch(e){if(e.code!=='EEXIST')throw e;try{const info=await stat(lock);if(Date.now()-info.mtimeMs>20_000)await unlink(lock);}catch(err){if(err.code!=='ENOENT')throw err;}if(Date.now()-start>6000)throw new Error('Bloqueo de almacenamiento agotado');await new Promise(r=>setTimeout(r,25));}}try{return await fn();}finally{await fh.close();await unlink(lock).catch(()=>{});}}
 async change(fn){const run=async()=>this.withLock(async()=>{this.state=JSON.parse(await readFile(this.file,'utf8'));const original=structuredClone(this.state);try{const result=await fn(this.state);this.state.metadata.revision++;await this.flush();return result;}catch(e){this.state=original;throw e;}});const runResult=this.queue.then(run);this.queue=runResult.catch(()=>{});return runResult;}
 list(type){if(!CATEGORIES.includes(type))throw new Error('Colección inválida');return structuredClone(this.state[type]);}
 get(type,id){if(!CATEGORIES.includes(type))throw new Error('Colección inválida');const found=this.state[type].find(e=>e.id===id);if(!found)throw new Error('Asset no encontrado');return structuredClone(found);}
 async create(type,attrs){if(!CATEGORIES.includes(type))throw new Error('Colección inválida');return this.change(s=>{let entity;const prompt=attrs.prompt||attrs.name||'';if(type==='characters')entity=createCharacter(prompt,attrs);else if(type==='objects')entity=createObject(prompt,attrs);else if(type==='environments')entity=createEnvironment(prompt,attrs);else if(type==='scenes')entity=createScene(attrs);else entity=createSeries(prompt,attrs);s[type].push(entity);return entity;});}
 async patch(type,id,patch){return this.change(s=>{const e=s[type]?.find(x=>x.id===id);if(!e)throw new Error('Asset no encontrado');return patchEntity(e,type,patch);});}
 async remove(type,id){return this.change(s=>{if(!CATEGORIES.includes(type))throw new Error('Colección inválida');if(s[type].some(e=>e.id===id)===false)throw new Error('Asset no encontrado');if(type==='characters'&&s.scenes.some(sc=>sc.actors.some(a=>a.characterId===id)))throw new Error('Quita al personaje de las escenas antes de eliminarlo');s[type]=s[type].filter(e=>e.id!==id);return {removed:id};});}
 async placeActor(sceneId,characterId,position={}){return this.change(s=>{const scene=s.scenes.find(x=>x.id===sceneId),character=s.characters.find(x=>x.id===characterId);if(!scene||!character)throw new Error('Escena o personaje inexistente');if(scene.actors.some(x=>x.characterId===characterId))throw new Error('El personaje ya está en escena');scene.actors.push({characterId,x:clamp(position.x,0,950,140+scene.actors.length*220),y:clamp(position.y,120,520,460),pose:'idle',expression:character.performance.expression});touch(scene,'Personaje colocado',character.name);return scene;});}
 async placeObject(sceneId,objectId,position={}){return this.change(s=>{const scene=s.scenes.find(x=>x.id===sceneId),object=s.objects.find(x=>x.id===objectId);if(!scene||!object)throw new Error('Escena u objeto inexistente');if(scene.props.some(x=>x.objectId===objectId))throw new Error('El objeto ya está en escena');scene.props.push({objectId,x:clamp(position.x,0,950,350),y:clamp(position.y,120,520,470)});touch(scene,'Objeto colocado',object.name);return scene;});}
 async relationship(fromId,toId,relation,feeling='neutral'){return this.change(s=>{const a=s.characters.find(x=>x.id===fromId),b=s.characters.find(x=>x.id===toId);if(!a||!b||a===b)throw new Error('Se necesitan dos personajes diferentes');a.story.relationships[toId]={relation:short(relation,140),feeling:short(feeling,140),updatedAt:now()};touch(a,'Relación actualizada',`${b.name}: ${relation}`);return a;});}
 async addEvent({seriesId=null,characterId=null,summary,emotion='neutral',effects=[]}){return this.change(s=>{if(seriesId&&!s.series.some(x=>x.id===seriesId))throw new Error('Serie inexistente');if(characterId&&!s.characters.some(x=>x.id===characterId))throw new Error('Personaje inexistente');const event={id:id('evt'),seriesId,characterId,summary:short(summary,800),emotion:short(emotion,60),effects:Array.isArray(effects)?effects.map(x=>short(x,200)).slice(0,10):[],at:now()};s.events.push(event);if(characterId){const c=s.characters.find(x=>x.id===characterId);c.story.memories.push({eventId:event.id,summary:event.summary,emotion:event.emotion});touch(c,'Recuerdo añadido',event.summary);}return event;});}
 async updateSceneActor(sceneId,characterId,attrs){return this.change(s=>{const scene=s.scenes.find(x=>x.id===sceneId), actor=scene?.actors.find(x=>x.characterId===characterId);if(!actor)throw new Error('Actor no colocado');for(const [k,v] of Object.entries(attrs)){if(['x','y'].includes(k))actor[k]=clamp(v,0,960,actor[k]);else if(k==='pose'&&VALID_POSES.includes(v))actor.pose=v;else if(k==='expression'&&VALID_MOODS.includes(v))actor.expression=v;else if(k==='heldObjectId')actor.heldObjectId=v;}touch(scene,'Actor actualizado',characterId);return scene;});}
 async addDialogue(sceneId,characterId,text){return this.change(s=>{const scene=s.scenes.find(x=>x.id===sceneId);if(!scene||!scene.actors.some(x=>x.characterId===characterId))throw new Error('Personaje fuera de escena');const dialogue={id:id('dlg'),characterId,text:short(text,500)};scene.dialogues.push(dialogue);touch(scene,'Diálogo añadido',text);return dialogue;});}
 snapshot(){return structuredClone(this.state);}
}
