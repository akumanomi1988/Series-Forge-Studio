/** File-first Series Forge editor. All AI interaction happens outside the application. */
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileWorkspace } from './workspace.mjs';
import { exportEpisode } from './export-episode.mjs';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';

const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const workspace=await new FileWorkspace().init();
const host='127.0.0.1',port=Number(process.env.PORT||4317);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml; charset=utf-8'};
const renderJobs=new Map();
function startRender(options){
 if([...renderJobs.values()].some(j=>j.state==='running'))throw new Error('Ya hay un render en proceso');
 const id=randomUUID(),job={id,state:'running',progress:{status:'queued'},result:null,error:null,createdAt:Date.now()};renderJobs.set(id,job);
 for(const [key,item] of renderJobs)if(Date.now()-item.createdAt>24*3600_000)renderJobs.delete(key);
 exportEpisode({...options,workspace,progress:x=>{job.progress=x;}}).then(result=>{job.state='done';job.result=result;}).catch(e=>{job.state='error';job.error=e.message;});return {id,state:job.state};
}
const files=new Map([['/','studio.html'],['/studio.html','studio.html'],['/studio.js','studio.js'],['/studio.css','studio.css'],['/viewport.js','viewport.js'],['/scene-runtime.js','scene-runtime.js']]);
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function requestBody(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new Error('Se requiere application/json');const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>750_000)throw new Error('Petición demasiado grande');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
async function bundle(project,kind,id){
 const base=`${kind}/${id}/`,list=kind==='characters'?['manifest.json','geometry.json','rig.json','voice.json','animations/idle.json','animations/walk.json','expressions/neutral.json','expressions/surprised.json','aspecto.md','personalidad.md','biografia.md','gustos.md','relaciones.json']:kind==='environments'?['manifest.json','environment.json','descripcion.md']:kind==='props'?['manifest.json','geometry.json','descripcion.md']:['manifest.json','sinopsis.md','guion.md'];
 const dynamic=new Set(list);const root=await workspace.securePath(project,base);
 for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isFile()&&/^[a-z0-9][a-z0-9_-]*\.md$/.test(entry.name))dynamic.add(entry.name);
 if(kind==='characters')for(const category of ['animations','expressions']){
  try{const dir=await workspace.securePath(project,base+category),entries=await readdir(dir,{withFileTypes:true});if(entries.length>200)throw new Error('Demasiados recursos en '+category);
   for(const entry of entries)if(entry.isFile()&&/^[a-z0-9][a-z0-9_-]*\.json$/.test(entry.name))dynamic.add(category+'/'+entry.name);
  }catch(e){if(e.code!=='ENOENT')throw e;}}
 const result={kind,id,files:{},errors:[]};for(const file of [...dynamic].sort()){try{const obj=await workspace.read(project,base+file);result.files[file]={...obj,parsed:file.endsWith('.json')?JSON.parse(obj.content):null};}catch(e){if(e.code!=='ENOENT')result.errors.push({file,error:e.message});}}return result;
}
async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 try{
  const url=new URL(req.url,`http://${host}:${port}`),path=url.pathname,project=url.searchParams.get('project');
  // Bind only to loopback. Validate Host and Origin for state-changing requests.
  if(req.headers.host&&!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host))return json(res,403,{error:'Host no permitido'});
  if(req.method==='POST'){
   if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return json(res,403,{error:'Origen no permitido'});
   const body=await requestBody(req);
   if(path==='/api/projects')return json(res,201,await workspace.createProject(body.name));
   if(path==='/api/render')return json(res,202,startRender({project:body.project,episode:body.episode,width:body.full?1920:640,height:body.full?1080:360,fps:body.full?24:12,maxSeconds:body.full?null:8,speech:body.speech==='sapi'?'sapi':'none',renderer:body.renderer==='svg'?'svg':'three'}));
   if(path==='/api/assets')return json(res,201,await workspace.createAsset(body.project,body.kind,body.name));
   if(path==='/api/scenes')return json(res,201,await workspace.createScene(body.project,body.episode,body.name));
   if(path==='/api/file')return json(res,200,await workspace.put(body.project,body.path,body.content,body.expectedHash??null));
   if(path==='/api/import-legacy'){const legacy=JSON.parse(await readFile(join(cwd,'data','studio.json'),'utf8'));return json(res,201,await workspace.importLegacy(legacy,body.name||'Importación v0.1'));}
   return json(res,404,{error:'Endpoint no encontrado'});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Método no permitido'});
  if(path==='/api/projects')return json(res,200,await workspace.projects());
  if(path==='/api/render-status'){const job=renderJobs.get(url.searchParams.get('id'));return job?json(res,200,{id:job.id,state:job.state,progress:job.progress,error:job.error,result:job.result}):json(res,404,{error:'Render no encontrado'});}
  if(path==='/api/render-file'){const job=renderJobs.get(url.searchParams.get('id'));if(!job||job.state!=='done')return json(res,404,{error:'Render no disponible'});const type=url.searchParams.get('type'),file=type==='video'?job.result.video:type==='subtitles'?job.result.srt:null;if(!file)return json(res,400,{error:'Tipo no permitido'});res.writeHead(200,{'Content-Type':type==='video'?'video/mp4':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="${type==='video'?'episodio.mp4':'subtitulos.srt'}"`,'Cache-Control':'no-store'});return createReadStream(file).pipe(res);}
  if(path==='/api/catalog')return json(res,200,await workspace.catalog(project));
  if(path==='/api/asset')return json(res,200,await bundle(project,url.searchParams.get('kind'),url.searchParams.get('id')));
  if(path==='/api/file')return json(res,200,await workspace.read(project,url.searchParams.get('path')));
  if(path==='/api/scenes')return json(res,200,await workspace.listScenes(project,url.searchParams.get('episode')));
  if(path==='/api/changes'){
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');
   let pending=null;const stop=await workspace.watch(project,ev=>{clearTimeout(pending);pending=setTimeout(()=>{if(!res.destroyed)res.write(`event: change\ndata: ${JSON.stringify(ev)}\n\n`);},180);});
   const timer=setInterval(()=>{if(!res.destroyed)res.write(': keepalive\n\n');},20000);
   res.on('close',()=>{clearInterval(timer);clearTimeout(pending);stop();});return;
  }
  if(path==='/vendor/three.module.js'||path==='/vendor/three.core.js'){
   try{const data=await readFile(join(cwd,'node_modules','three','build',path.endsWith('three.core.js')?'three.core.js':'three.module.js'));res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'public, max-age=3600'});res.end(data);}catch{json(res,404,{error:'Three.js no instalado. Ejecuta npm install.'});}return;
  }
  if(path==='/legacy')return res.writeHead(302,{Location:'http://127.0.0.1:4318'}).end();
  if(files.has(path)){
   const filename=files.get(path),data=await readFile(join(cwd,'public',filename));res.writeHead(200,{'Content-Type':MIME[extname(filename)],'Cache-Control':'no-cache'});return res.end(data);
  }
  return json(res,404,{error:'No encontrado'});
 }catch(e){const status=e.code==='ENOENT'?404:400;return json(res,status,{error:e.message||'Error'});}
}
const server=createServer(handler);server.listen(port,host,()=>console.log(`Series Forge Studio · http://${host}:${port}\nWorkspace: ${workspace.root}\nAgentes: edita los archivos directamente con Claude/Codex/OpenCode.`));
