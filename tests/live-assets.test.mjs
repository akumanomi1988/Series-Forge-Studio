import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { FileWorkspace } from '../src/workspace.mjs';

test('el editor carga automáticamente animaciones y expresiones creadas por el agente', {timeout:20000},async t=>{
 const root=await mkdtemp(join(tmpdir(),'sf-live-'));t.after(()=>rm(root,{recursive:true,force:true}));const ws=await new FileWorkspace(root).init(),{project}=await ws.createProject('Agente');const char=await ws.createAsset(project,'characters','Bruno');
 const clip={schemaVersion:1,id:'jump',duration:1,loop:false,tracks:[{target:'root.rotation.z',keys:[[0,0],[.5,10],[1,0]]}]};
 await ws.put(project,`characters/${char.id}/animations/jump.json`,JSON.stringify(clip));await ws.put(project,`characters/${char.id}/expressions/happy.json`,JSON.stringify({schemaVersion:1,id:'happy',mouthScaleY:1.2,eyeScaleY:.8}));await ws.put(project,`characters/${char.id}/secretos.md`,'# Historia añadida por Claude\n');
 const port=43000+Math.floor(Math.random()*12000),proc=spawn(process.execPath,['src/studio-server.mjs'],{cwd:new URL('../',import.meta.url).pathname,env:{...process.env,PORT:String(port),SERIES_FORGE_WORKSPACE:root},stdio:['ignore','pipe','pipe']});t.after(()=>proc.kill());
 let result;for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/asset?project=${project}&kind=characters&id=${char.id}`);if(r.ok){result=await r.json();break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(result,'Servidor HTTP no responde');assert.equal(result.files['animations/jump.json'].parsed.id,'jump');assert.equal(result.files['expressions/happy.json'].parsed.id,'happy');assert.ok(result.files['secretos.md'].content.includes('Claude'));
});
