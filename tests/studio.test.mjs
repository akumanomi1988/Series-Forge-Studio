import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { StudioStore, createCharacter } from '../src/core.mjs';
import { interpretChat } from '../src/chat.mjs';
import { renderSvg } from '../src/render.mjs';
import { invoke } from '../src/operations.mjs';
const makeStore=async()=>new StudioStore(await mkdtemp(join(tmpdir(),'series-forge-test-'))).init();

test('creación de personaje procedural y modificación por chat sin perder ID',async()=>{
 const store=await makeStore();const create=await interpretChat(store,'Crea un hombre llamado Bruno, con chaqueta roja y pelo negro');
 assert.equal(create.selection.type,'characters');const before=store.get('characters',create.selection.id);
 assert.equal(before.name,'Bruno');assert.equal(before.appearance.shirtColor,'#d94c57');
 const next=await interpretChat(store,'Ponle gafas, hazlo más alto y feliz',create.selection);
 assert.equal(next.selection.id,before.id);const after=store.get('characters',before.id);
 assert.equal(after.appearance.glasses,true);assert.ok(after.appearance.height>before.appearance.height);
 assert.equal(after.performance.expression,'feliz');assert.ok(after.revision>before.revision);
 const stored=JSON.parse(await readFile(store.file,'utf8'));assert.equal(stored.characters[0].id,before.id);
});

test('entornos, objetos, escena y diálogo generan SVG sin depender de imágenes externas',async()=>{
 const store=await makeStore();
 const c=await store.create('characters',{prompt:'crea una mujer llamada Susana'});
 const o=await store.create('objects',{prompt:'crea una llave dorada'});
 const e=await store.create('environments',{prompt:'crea un laboratorio nocturno'});
 const scene=await store.create('scenes',{name:'Prueba',environmentId:e.id});
 await store.placeActor(scene.id,c.id,{x:270,y:460});await store.placeObject(scene.id,o.id,{x:500,y:460});
 await store.addDialogue(scene.id,c.id,'Abre esa puerta, por favor.');
 const svg=renderSvg(store.snapshot(),'scenes',scene.id);
 assert.match(svg,/<svg/);assert.match(svg,/Abre esa puerta/);assert.match(svg,/data-entity=/);assert.doesNotMatch(svg,/<image\b|xlink:href|<script\b/);
});

test('relaciones y memoria sobreviven a la reapertura del almacén',async()=>{
 const s=await makeStore();const a=await s.create('characters',{prompt:'crea un hombre llamado Mateo'});const b=await s.create('characters',{prompt:'crea una mujer llamada Luz'});
 await s.relationship(a.id,b.id,'amistad','lealtad');await s.addEvent({characterId:a.id,summary:'Mateo perdió su brújula',emotion:'triste'});
 const reload=await new StudioStore(s.root).init();const c=reload.get('characters',a.id);
 assert.equal(c.story.relationships[b.id].feeling,'lealtad');assert.equal(c.story.memories.length,1);
});

test('restringe propiedades para evitar objetos arbitrarios y campos peligrosos',async()=>{
 const s=await makeStore();const c=await s.create('characters',{prompt:'crea un robot'});
 await assert.rejects(s.patch('characters',c.id,{'__proto__.polluted':'yes'}),/Campo no editable/);
 await assert.rejects(s.patch('characters',c.id,{'appearance.hairColor':'url(javascript:alert(1))'}),/Color inválido/);
 assert.equal(s.get('characters',c.id).revision,1);
});

test('MCP descubre herramientas y exporta un asset SVG',async()=>{
 const s=await makeStore();const c=await invoke(s,'character_create',{prompt:'crea un hombre llamado Leo'});
 const status=await invoke(s,'studio_status',{});assert.ok(status.features.includes('MCP stdio'));
 const out=await invoke(s,'asset_render_svg',{type:'characters',id:c.id});assert.ok(out.path.endsWith('.svg'));
 assert.match(await readFile(out.path,'utf8'),/<svg/);
});

test('el servidor MCP stdio responde al handshake de protocolo y tools/list', async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sf-mcp-'));
 const proc=spawn(process.execPath,['src/mcp.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,STUDIO_DATA_DIR:dir},stdio:['pipe','pipe','pipe']});
 try{
  const lines=[];let buf='';proc.stdout.on('data',chunk=>{buf+=chunk.toString();let idx;while((idx=buf.indexOf('\n'))>=0){lines.push(JSON.parse(buf.slice(0,idx)));buf=buf.slice(idx+1);}});
  proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',clientInfo:{name:'test',version:'1.0'},capabilities:{}}})+'\n');
  proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})+'\n');
  for(let i=0;i<200&&!lines.some(x=>x.id===2);i++)await new Promise(r=>setTimeout(r,15));
  assert.equal(lines.find(x=>x.id===1)?.result?.serverInfo?.name,'series-forge-studio');
  assert.ok(lines.find(x=>x.id===2)?.result?.tools.some(x=>x.name==='studio_chat'));
 }finally{proc.kill();}
});

test('un agente compila un plan integral y se revierte todo si falla una referencia',async()=>{
 const s=await makeStore();const good={title:'Laboratorio Aurora',synopsis:'Dos exploradores hallan una llave',characters:[{ref:'hero',name:'Ada',prompt:'crea una mujer llamada Ada con pelo largo',goal:'abrir la puerta'}],environments:[{ref:'lab',name:'Estación',prompt:'crea un laboratorio azul'}],objects:[{ref:'key',name:'La llave',prompt:'crea una llave dorada'}],scenes:[{ref:'scene1',name:'Hallazgo',environmentRef:'lab',actors:[{ref:'hero',x:240,y:450}],props:[{ref:'key',x:520,y:460}],dialogues:[{characterRef:'hero',text:'Aquí está la llave.'}]}],events:[{characterRef:'hero',summary:'Encontró la llave'}]};
 const built=await invoke(s,'episode_compile_plan',{plan:good});
 assert.equal(built.created.scenes,1);assert.equal(s.snapshot().characters.length,1);assert.equal(s.snapshot().events.length,1);
 const snapshot=JSON.stringify(s.snapshot());
 await assert.rejects(invoke(s,'episode_compile_plan',{plan:{...good,title:'Fallido',scenes:[{ref:'bad',environmentRef:'missing'}]}}),/Escenario inexistente/);
 assert.equal(JSON.stringify(s.snapshot()),snapshot);
});

test('dos procesos/almacenes no pisan escrituras simultáneas',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sf-shared-'));const a=await new StudioStore(dir).init();const b=await new StudioStore(dir).init();
 await Promise.all([a.create('characters',{prompt:'hombre llamado Luis'}),b.create('objects',{prompt:'llave dorada'})]);
 await a.reload();assert.equal(a.state.characters.length,1);assert.equal(a.state.objects.length,1);
});
