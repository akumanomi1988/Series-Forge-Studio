// MCP over standard newline-delimited JSON-RPC 2.0 on stdio.
// No dependencies so it is runnable offline. For production upgrade to official TypeScript SDK v2.
import { createInterface } from 'node:readline';
import { StudioStore } from './core.mjs';
import { tools, invoke } from './operations.mjs';
const store=await new StudioStore().init();
const supportedProtocols=['2026-07-28','2025-11-25','2025-06-18','2025-03-26'];
function send(v){process.stdout.write(JSON.stringify(v)+'\n');}
function error(id,message,code=-32603){return {jsonrpc:'2.0',id,error:{code,message}};}
async function handle(r){
 if(!r||r.jsonrpc!=='2.0'||typeof r.method!=='string')return typeof r?.id==='undefined'?null:error(r.id,'Solicitud no válida',-32600);
 const id=r.id;if(typeof id==='undefined')return null;
 try{
  let result;
  switch(r.method){
   case 'initialize':result={protocolVersion:supportedProtocols.includes(r.params?.protocolVersion)?r.params.protocolVersion:'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name:'series-forge-studio',version:'0.1.0'}};break;
   case 'ping':result={};break;
   case 'tools/list':result={tools};break;
   case 'tools/call':{
    const n=r.params?.name;if(!tools.some(t=>t.name===n))throw new Error(`Herramienta desconocida: ${n}`);
    try{const output=await invoke(store,n,r.params?.arguments||{});result={content:[{type:'text',text:JSON.stringify(output)}]};}
    catch(e){result={isError:true,content:[{type:'text',text:e.message}]};}
    break;
   }
   default:return error(id,`Método no reconocido: ${r.method}`,-32601);
  }
  return {jsonrpc:'2.0',id,result};
 }catch(e){return error(id,e.message);}
}
// Serialize MCP requests to avoid races; the store serializes mutations independently.
let pending=Promise.resolve();
createInterface({input:process.stdin,crlfDelay:Infinity}).on('line',line=>{pending=pending.then(async()=>{
 let r;try{r=JSON.parse(line);}catch{send(error(null,'JSON inválido',-32700));return;}
 if(Array.isArray(r)){send(error(null,'Batch no soportado',-32600));return;}
 const response=await handle(r);if(response)send(response);
 }).catch(e=>{process.stderr.write('MCP error: '+e.message+'\n');});});
