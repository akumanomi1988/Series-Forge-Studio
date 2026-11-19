/** Deterministic SVG animatic renderer; deliberately independent of GPU/Chromium.
 * This is a production-capable animatic, not a replacement for the Three.js final-quality renderer.
 */
import { evaluateScene, validateAnimation } from './workspace.mjs';
const RAD=Math.PI/180;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(v,s)=>v.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{const k=Math.hypot(...v)||1;return v.map(x=>x/k);};
const rotate=(v,e)=>{let [x,y,z]=v;const [rx,ry,rz]=e.map(a=>a*RAD);let c=Math.cos(rx),s=Math.sin(rx);[y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(ry);s=Math.sin(ry);[x,z]=[x*c+z*s,-x*s+z*c];c=Math.cos(rz);s=Math.sin(rz);[x,y]=[x*c-y*s,x*s+y*c];return [x,y,z];};
const rgba=c=>/^#[0-9a-f]{6}$/i.test(c||'')?c:'#8899aa';
function sample(keys,t,duration,loop){if(!keys?.length)return 0;const at=loop?t%duration:Math.min(t,duration);if(at<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(at<=keys[i][0]){const [a,va]=keys[i-1],[b,vb]=keys[i],n=clamp((at-a)/Math.max(.00001,b-a),0,1),smooth=n*n*(3-2*n);return va+(vb-va)*smooth;}return keys.at(-1)[1];}
function projectSetup(camera,width,height){const eye=camera?.position??[0,2.4,8],target=camera?.target??[0,1,0],forward=norm(sub(target,eye)),right=norm(cross(forward,[0,1,0])),up=norm(cross(right,forward));const pixels=height/(camera?.orthographicSize??6.5);return {pixels,point:p=>{const d=sub(p,target);return [width/2+dot(d,right)*pixels,height/2-dot(d,up)*pixels,dot(sub(p,eye),forward)];}};}
function boneWorld(rig,animation,t,headYaw){const rotations=new Map();for(const b of rig.bones||[])rotations.set(b.id,[...(b.rotationDeg??[0,0,0])]);if(animation){validateAnimation(animation);for(const track of animation.tracks){const [id,prop,axis]=track.target.split('.');if(prop!=='rotation')continue;const r=rotations.get(id);if(r)r[{x:0,y:1,z:2}[axis]]+=sample(track.keys,t,animation.duration,animation.loop);}}const head=rotations.get('head');if(head)head[1]+=headYaw||0;
 const defs=new Map((rig.bones||[]).map(b=>[b.id,b])),resolved=new Map();function at(id,depth=0){if(resolved.has(id))return resolved.get(id);if(depth>40||!defs.has(id))throw new Error('Jerarquía de huesos inválida');const b=defs.get(id),rot=rotations.get(id);let out;if(b.parent){const p=at(b.parent,depth+1);out={pos:add(p.pos,p.apply(b.position)),apply:v=>p.apply(rotate(v,rot))};}else out={pos:[...b.position],apply:v=>rotate(v,rot)};resolved.set(id,out);return out;}for(const b of rig.bones||[])at(b.id);return resolved;
}
function drawActor(actor,bundle,t,projection){const rig=bundle['rig.json'],geo=bundle['geometry.json'];if(!rig?.bones||!geo?.parts)throw new Error(`Personaje ${actor.characterId} sin rig/geometry`);const clip=bundle[`animations/${actor.animation}.json`]??bundle['animations/idle.json'];const bones=boneWorld(rig,clip,t,actor.headYawDeg);
 const actorYaw=actor.yawDeg||0,root=actor.position||[0,0,0];const pieces=[];for(const part of geo.parts){const bone=bones.get(part.bone);if(!bone)continue;const at=add(root,rotate(add(bone.pos,bone.apply(part.position||[0,0,0])),[0,actorYaw,0]));const [sx,sy,depth]=projection.point(at);const sz=part.size||[.2,.3,.2];const radiusX=clamp(sz[0]*projection.pixels*.52,1,600),radiusY=clamp(sz[1]*projection.pixels*.50,1,600);pieces.push({svg:`<ellipse cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" rx="${radiusX.toFixed(2)}" ry="${radiusY.toFixed(2)}" fill="${rgba(part.color)}" stroke="#111d2c" stroke-width="2.3"/>`,depth,part:part.id});}
 // Expressions are deterministic overlays on the existing face, not new asset images.
 const expression=bundle[`expressions/${actor.expression}.json`]??bundle['expressions/neutral.json']??{};
 const active=actor.activeDialogue;const mouth=pieces.find(p=>p.part==='mouth');if(mouth){const morph=active?(Math.sin(t*17)**2*.9+.45):(expression.mouthScaleY??1);mouth.svg=mouth.svg.replace(/ry="([0-9.]+)"/,(_,v)=>`ry="${(Number(v)*morph).toFixed(2)}"`);}
 for(const eye of ['eyeL','eyeR']){const part=pieces.find(p=>p.part===eye);if(part){const morph=expression.eyeScaleY??1;part.svg=part.svg.replace(/ry="([0-9.]+)"/,(_,v)=>`ry="${(Number(v)*morph).toFixed(2)}"`);}}
 return pieces;
}
function drawProp(prop,bundle,projection){const out=[];for(const p of bundle['geometry.json']?.parts||[]){const w=add(prop.position||[0,0,0],rotate(p.position||[0,0,0],[0,prop.yawDeg||0,0])),[x,y,z]=projection.point(w),sz=p.size||[.3,.3,.3];out.push({depth:z,svg:`<rect x="${(x-sz[0]*projection.pixels/2).toFixed(2)}" y="${(y-sz[1]*projection.pixels/2).toFixed(2)}" width="${(sz[0]*projection.pixels).toFixed(2)}" height="${(sz[1]*projection.pixels).toFixed(2)}" rx="4" fill="${rgba(p.color)}" stroke="#111d2c" stroke-width="2"/>`});}return out;}
export function renderSvgFrame(scene,assets,t,{width=960,height=540,caption=true}={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<160||height<90||width>3840||height>2160)throw new Error('Resolución fuera de rango');
 const frame=evaluateScene(scene,t),camera=frame.camera,projection=projectSetup(camera,width,height),env=assets.environments?.[scene.environmentId]?.['environment.json']||{};
 const parts=[];for(const p of frame.actors){const bundle=assets.characters?.[p.characterId];if(!bundle)throw new Error('Falta personaje: '+p.characterId);parts.push(...drawActor({...p,activeDialogue:frame.activeDialogues.some(b=>b.actorId===p.characterId)},bundle,t,projection));}
 for(const p of scene.props||[]){const b=assets.props?.[p.propId];if(b)parts.push(...drawProp(p,b,projection));}
 // A static procedural stage, deterministic and reproducible in FFmpeg builds with librsvg.
 const backdrop=rgba(env.backdropColor||'#263b54'),floor=rgba(env.floorColor||'#52647a');let captionSvg='';if(caption){const active=frame.activeDialogues[0];if(active){const who=assets.characters?.[active.actorId]?.['manifest.json']?.name||active.actorId||'';const sentence=String(active.text||'').slice(0,220);const lines=sentence.match(/.{1,70}(?:\s|$)/gu)||[sentence];captionSvg=`<rect x="${width*.07}" y="${height*.76}" width="${width*.86}" height="${height*.19}" rx="12" fill="#0b1727" opacity=".88"/><text x="${width*.09}" y="${height*.81}" font-family="sans-serif" font-size="${height*.033}" fill="#84c6eb" font-weight="bold">${esc(who)}</text>${lines.slice(0,2).map((line,i)=>`<text x="${width*.09}" y="${height*(.86+i*.045)}" font-family="sans-serif" font-size="${height*.035}" fill="#fff">${esc(line.trim())}</text>`).join('')}`;}}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${backdrop}"/><path d="M0 ${height*.68}H${width}V${height}H0Z" fill="${floor}"/>${parts.sort((a,b)=>b.depth-a.depth).map(p=>p.svg).join('')}${captionSvg}</svg>`;
}
