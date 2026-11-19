import { aiChat } from './chat.mjs';
import { renderSvg } from './render.mjs';
import { compileEpisodePlan } from './compile.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const string={type:'string'};const number={type:'number'};const obj={type:'object'};
const schema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const listOf=(properties,required=[])=>({type:'array',items:schema(properties,required)});
const actorPlan=schema({ref:string,x:number,y:number,pose:string,expression:string},['ref']);
const propPlan=schema({ref:string,x:number,y:number},['ref']);
const dialoguePlan=schema({characterRef:string,text:string},['characterRef','text']);
const productionPlan=schema({
 title:string,synopsis:string,genre:string,
 characters:listOf({ref:string,name:string,prompt:string,personality:string,biography:string,goal:string,voice:obj,appearance:obj},['ref','name','prompt']),
 environments:listOf({ref:string,name:string,prompt:string},['ref','name','prompt']),
 objects:listOf({ref:string,name:string,prompt:string},['ref','name','prompt']),
 relationships:listOf({fromRef:string,toRef:string,relation:string,feeling:string},['fromRef','toRef','relation']),
 scenes:listOf({ref:string,name:string,environmentRef:string,durationSeconds:number,description:string,actors:{type:'array',items:actorPlan},props:{type:'array',items:propPlan},dialogues:{type:'array',items:dialoguePlan}},['ref','name','actors','dialogues']),
 events:listOf({characterRef:string,summary:string,emotion:string},['summary'])
},['synopsis','scenes']);
export const tools=[
 ['episode_compile_plan','Construye en una operación atómica un universo de serie y storyboard completo a partir de un plan JSON redactado por el agente desde una sinopsis',schema({plan:productionPlan},['plan'])],
 ['studio_status','Consulta versión, capacidades implementadas y pendientes',schema({})],
 ['studio_get_state','Devuelve el universo, biblioteca y narrativa persistidos',schema({})],
 ['studio_chat','Crea o modifica assets mediante instrucciones en lenguaje natural',schema({message:string,selectedType:string,selectedId:string},['message'])],
 ['asset_list','Lista assets por categoría',schema({type:string},['type'])],
 ['asset_get','Consulta la ficha completa y revisiones de un asset',schema({type:string,id:string},['type','id'])],
 ['character_create','Genera un personaje procedural, con ficha narrativa y voz',schema({prompt:string,name:string},['prompt'])],
 ['environment_create','Genera un escenario multicapa reutilizable',schema({prompt:string,name:string},['prompt'])],
 ['object_create','Genera un objeto vectorial con reglas de interacción',schema({prompt:string,name:string},['prompt'])],
 ['series_create','Inicia una biblia de serie',schema({prompt:string,name:string},['prompt'])],
 ['scene_create','Crea una escena que referenciará el entorno, la serie y los assets',schema({name:string,environmentId:string,seriesId:string})],
 ['asset_patch','Edita campos permitidos sin perder identidad ni versión. Patch usa rutas con punto, por ejemplo {"appearance.hairColor":"#223344","performance.expression":"feliz","story.biography":"..."}; admite también name, voice.*, params.*, bible.* según tipo',schema({type:string,id:string,patch:obj},['type','id','patch'])],
 ['character_relationship','Define cómo un personaje ve y siente hacia otro',schema({fromId:string,toId:string,relation:string,feeling:string},['fromId','toId','relation'])],
 ['story_event_add','Guarda acontecimiento en memoria/canon',schema({summary:string,seriesId:string,characterId:string,emotion:string},['summary'])],
 ['scene_add_actor','Coloca personaje de biblioteca en una escena',schema({sceneId:string,characterId:string,x:number,y:number},['sceneId','characterId'])],
 ['scene_add_object','Coloca objeto de biblioteca en una escena',schema({sceneId:string,objectId:string,x:number,y:number},['sceneId','objectId'])],
 ['scene_set_actor','Define pose, expresión, posición y objeto en la mano',schema({sceneId:string,characterId:string,pose:string,expression:string,x:number,y:number,heldObjectId:string},['sceneId','characterId'])],
 ['scene_add_dialogue','Añade texto pronunciable por un actor',schema({sceneId:string,characterId:string,text:string},['sceneId','characterId','text'])],
 ['asset_render_svg','Exporta vista previa vectorial SVG a disco',schema({type:string,id:string},['type','id'])]
].map(([name,description,inputSchema])=>({name,description,inputSchema}));

export async function invoke(store,name,a={}){
 if(['studio_get_state','asset_list','asset_get','asset_render_svg','studio_chat'].includes(name))await store.reload();
 switch(name){
  case 'episode_compile_plan':return compileEpisodePlan(store,a.plan);
  case 'studio_status':return {version:'0.1.0',status:'editor procedural funcional (sin exportación audiovisual automática)',dataDirectory:store.root,features:['chat local','adaptador LLM opcional','personajes SVG','objetos SVG','entornos SVG','fichas','relaciones','recuerdos','escenas','previsualización','MCP stdio'],notImplemented:['rig 2D IK avanzado','TTS offline persistido','alineación fonética real','vídeo MP4','mezcla audiovisual','episodio desde sinopsis sin supervisión']};
  case 'studio_get_state':return store.snapshot();
  case 'studio_chat':return aiChat(store,a.message,a.selectedId&&a.selectedType?{type:a.selectedType,id:a.selectedId}:null);
  case 'asset_list':return store.list(a.type);
  case 'asset_get':return store.get(a.type,a.id);
  case 'character_create':return store.create('characters',a);
  case 'environment_create':return store.create('environments',a);
  case 'object_create':return store.create('objects',a);
  case 'series_create':return store.create('series',a);
  case 'scene_create':return store.create('scenes',a);
  case 'asset_patch':return store.patch(a.type,a.id,a.patch);
  case 'character_relationship':return store.relationship(a.fromId,a.toId,a.relation,a.feeling||'neutral');
  case 'story_event_add':return store.addEvent(a);
  case 'scene_add_actor':return store.placeActor(a.sceneId,a.characterId,a);
  case 'scene_add_object':return store.placeObject(a.sceneId,a.objectId,a);
  case 'scene_set_actor':{const {sceneId,characterId,...params}=a;return store.updateSceneActor(sceneId,characterId,params);}
  case 'scene_add_dialogue':return store.addDialogue(a.sceneId,a.characterId,a.text);
  case 'asset_render_svg':{
   const svg=renderSvg(store.snapshot(),a.type,a.id);
   const p=join(store.root,'previews');await mkdir(p,{recursive:true});
   const path=join(p,`${a.id}.svg`);await writeFile(path,svg,'utf8');return {path,bytes:Buffer.byteLength(svg),reproducible:true};
  }
  default:throw new Error('Operación desconocida');
 }
}
