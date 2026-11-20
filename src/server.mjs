import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioStore } from './core.mjs';
import { renderSvg } from './render.mjs';
import { invoke } from './operations.mjs';
const store=await new StudioStore().init();
const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const host=process.env.STUDIO_HOST||'127.0.0.1', port=Number(process.env.PORT||4317);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml; charset=utf-8','.json':'application/json; charset=utf-8'};
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req){const len=Number(req.headers['content-length']||0);if(len>100_000)throw new Error('Petición demasiado grande');if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Se requiere application/json');let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>100_000)throw new Error('Petición demasiado grande');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
async function request(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'");
 try{
  const url=new URL(req.url,`http://${req.headers.host||'127.0.0.1'}`);
  if(req.method==='POST'){
   const origin=req.headers.origin;
   if(origin&&origin!==`http://${req.headers.host}`)return json(res,403,{error:'Origen externo bloqueado'});
   const a=await body(req);
   if(url.pathname==='/api/compile')return json(res,201,{ok:true,result:await invoke(store,'episode_compile_plan',{plan:a.plan})});
   if(url.pathname==='/api/chat')return json(res,200,{ok:true,result:await invoke(store,'studio_chat',{message:a.message,selectedType:a.selected?.type,selectedId:a.selected?.id})});
   if(url.pathname==='/api/create')return json(res,201,{ok:true,result:await store.create(a.type,a)});
   if(url.pathname==='/api/patch')return json(res,200,{ok:true,result:await store.patch(a.type,a.id,a.patch)});
   if(url.pathname==='/api/remove')return json(res,200,{ok:true,result:await store.remove(a.type,a.id)});
   if(url.pathname==='/api/relationship')return json(res,200,{ok:true,result:await store.relationship(a.fromId,a.toId,a.relation,a.feeling)});
   if(url.pathname==='/api/event')return json(res,200,{ok:true,result:await store.addEvent(a)});
   if(url.pathname==='/api/place-actor')return json(res,200,{ok:true,result:await store.placeActor(a.sceneId,a.characterId,a)});
   if(url.pathname==='/api/place-object')return json(res,200,{ok:true,result:await store.placeObject(a.sceneId,a.objectId,a)});
   if(url.pathname==='/api/scene-actor')return json(res,200,{ok:true,result:await store.updateSceneActor(a.sceneId,a.characterId,a.patch)});
   if(url.pathname==='/api/dialogue')return json(res,200,{ok:true,result:await store.addDialogue(a.sceneId,a.characterId,a.text)});
   if(url.pathname==='/api/demo'){
    if(store.snapshot().characters.length||store.snapshot().scenes.length)return json(res,409,{error:'El ejemplo solo se añade sobre una biblioteca vacía'});
    const series=await store.create('series',{name:'Archivo Boreal',prompt:'Una inventora y un robot intentan reparar una estación orbital averiada.'});
    const env=await store.create('environments',{name:'Laboratorio orbital',prompt:'crea un laboratorio nocturno azul'});
    const lead=await store.create('characters',{name:'Susana',prompt:'crea una mujer de pelo largo con chaqueta roja y gafas, feliz'});
    const robot=await store.create('characters',{name:'Nox',prompt:'crea un robot con ojos azules y camisa verde'});
    const key=await store.create('objects',{name:'Llave de servicio',prompt:'crea una llave dorada'});
    const scene=await store.create('scenes',{name:'La última llave',environmentId:env.id,seriesId:series.id});
    await store.placeActor(scene.id,lead.id,{x:270,y:467});await store.placeActor(scene.id,robot.id,{x:675,y:467});await store.placeObject(scene.id,key.id,{x:492,y:467});
    await store.addDialogue(scene.id,lead.id,'Nox, sin esa llave no podremos salir.');
    await store.relationship(lead.id,robot.id,'compañero de aventuras','confianza');
    await store.addEvent({characterId:lead.id,seriesId:series.id,summary:'Susana encontró la llave de servicio en la estación.',emotion:'feliz'});
    return json(res,201,{ok:true,sceneId:scene.id});
   }
   return json(res,404,{error:'Endpoint no encontrado'});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Método no admitido'});
  if(url.pathname==='/api/state'){await store.reload();return json(res,200,store.snapshot());}
  if(url.pathname==='/api/status')return json(res,200,await invoke(store,'studio_status',{}));
  if(url.pathname==='/api/export'){await store.reload();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="series-forge-universe.json"','Cache-Control':'no-store'});return res.end(JSON.stringify(store.snapshot(),null,2));}
  const m=url.pathname.match(/^\/api\/preview\/(characters|environments|objects|scenes|series)\/([\w-]+)\.svg$/);
  if(m){await store.reload();const svg=renderSvg(store.snapshot(),m[1],m[2]);res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(svg);}
  const asset=url.pathname==='/'?'/index.html':url.pathname;
  if(!['/index.html','/app.js','/style.css'].includes(asset))return json(res,404,{error:'No encontrado'});
  const bytes=await readFile(join(root,asset));res.writeHead(200,{'Content-Type':mime[extname(asset)],'Cache-Control':'no-store'});res.end(bytes);
 }catch(e){if(e.code==='ENOENT')return json(res,404,{error:'Recurso inexistente'});json(res,400,{error:e.message||'Error'});}
}
const srv=createServer(request);srv.listen(port,host,()=>console.log(`Series Forge Studio: http://${host}:${port}`));
