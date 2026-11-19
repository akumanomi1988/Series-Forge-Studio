// Vector-only procedural master assets. No external images, network calls or raster source art.
export const xml = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex=(v,d='#6b7893')=>/^#[\da-f]{6}$/i.test(String(v))?v:d;
const seeded=seed=>{let v=Number(seed)||12345;return ()=>((v=(v*1664525+1013904223)>>>0)/4294967296);};
const adjust=(h,factor)=>{const c=hex(h).slice(1);const rgb=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16));return '#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v*factor))).toString(16).padStart(2,'0')).join('');};
const svgCss=`<style>
 .arm-left,.arm-right,.leg-left,.leg-right,.head,.torso{transform-box:fill-box}
 .motion-idle .torso{animation:breathe 2.8s ease-in-out infinite;transform-origin:center 80%}
 .motion-saludar .arm-right{animation:wave 1.05s ease-in-out infinite alternate;transform-origin:center 10%}
 .motion-caminar .leg-right{animation:stride .65s ease-in-out infinite alternate;transform-origin:center 7%}
 .motion-caminar .leg-left{animation:stride .65s ease-in-out infinite alternate-reverse;transform-origin:center 7%}
 .motion-senalar .arm-right{transform:rotate(-57deg);transform-origin:center 10%}
 .talking .mouth{animation:mouth .2s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center center}
 @keyframes breathe{50%{transform:scale(1.025,.985)}}
 @keyframes wave{from{transform:rotate(-24deg)}to{transform:rotate(-88deg)}}
 @keyframes stride{from{transform:rotate(-18deg)}to{transform:rotate(18deg)}}
 @keyframes mouth{from{transform:scaleY(.25)}to{transform:scaleY(1.55)}}
 </style>`;
const wrap=(w=960,h=540,body)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".21"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="8"/></filter></defs>${svgCss}${body}</svg>`;
export function characterGroup(c,{x=0,y=0,scale=1,pose=null,expression=null}={}){
 const a=c.appearance||{},p=pose||c.performance?.pose||'idle',m=expression||c.performance?.expression||'neutral';
 const skin=hex(a.skinTone,'#d99d72'),shirt=hex(a.shirtColor,'#4e82c9'),pants=hex(a.pantsColor,'#3e4f75'),hair=hex(a.hairColor,'#332b38'),eye=hex(a.eyeColor,'#344d68');
 const height=Number(a.height)||1, build=Number(a.build)||1, robot=c.kind==='robot';
 const bodyTop=-200*height, hipY=-105*height, headY=-242*height, headRx=49*build, torsoHalf=50*build;
 const cy=(v)=>v*height;
 const legLength=84*height;
 const mouth=m==='feliz'?`<path d="M -18 ${headY+24} Q 0 ${headY+44} 18 ${headY+24}" fill="none" stroke="#612f3b" stroke-width="5" stroke-linecap="round" class="mouth"/>`:
 m==='triste'?`<path d="M -17 ${headY+34} Q 0 ${headY+18} 17 ${headY+34}" fill="none" stroke="#612f3b" stroke-width="4" class="mouth"/>`:
 m==='asustado'||m==='sorprendido'?`<ellipse cx="0" cy="${headY+29}" rx="9" ry="13" fill="#662d38" class="mouth"/>`:
 `<ellipse cx="0" cy="${headY+29}" rx="14" ry="3.8" fill="#74424c" class="mouth"/>`;
 const brow=m==='enfadado'?-7:m==='triste'?6:0;
 const eyes=`<g><ellipse cx="-20" cy="${headY-8}" rx="8" ry="9" fill="#fff"/><ellipse cx="20" cy="${headY-8}" rx="8" ry="9" fill="#fff"/><circle cx="-20" cy="${headY-8}" r="4.8" fill="${eye}"/><circle cx="20" cy="${headY-8}" r="4.8" fill="${eye}"/><path d="M -32 ${headY-24+brow} l 23 ${m==='enfadado'?12:0} M 8 ${headY-24+(m==='enfadado'?12:0)} l 24 ${m==='enfadado'?-12:0}" stroke="${robot?'#c4d8e4':hair}" stroke-width="5" stroke-linecap="round"/></g>`;
 let hairShape='';if(a.hairStyle!=='calvo'&&!robot){hairShape=`<path d="M ${-headRx-4} ${headY-16} Q ${-headRx-12} ${headY-93} 3 ${headY-97} Q ${headRx+23} ${headY-90} ${headRx+5} ${headY-18} Q 34 ${headY-61} 7 ${headY-57} Q -16 ${headY-66} -36 ${headY-16} Z" fill="${hair}" stroke="${adjust(hair,.8)}" stroke-width="2"/>`;
 if(a.hairStyle==='largo')hairShape+=`<path d="M ${-headRx+5} ${headY-40} Q -80 ${headY+50} -54 ${bodyTop+36} L -42 ${headY+24} Z M ${headRx-3} ${headY-36} Q 74 ${headY+51} 53 ${bodyTop+36} L 42 ${headY+23} Z" fill="${hair}"/>`;
 }
 const glasses=a.glasses?`<g fill="none" stroke="#17212e" stroke-width="4"><rect x="-38" y="${headY-23}" width="33" height="26" rx="9"/><rect x="5" y="${headY-23}" width="33" height="26" rx="9"/><path d="M -5 ${headY-13}H5 M-38 ${headY-13}l-12 -4 M38 ${headY-13}l12 -4"/></g>`:'';
 const beard=a.beard?`<path d="M -33 ${headY+26} Q -27 ${headY+74} 0 ${headY+65} Q 29 ${headY+73} 33 ${headY+26} Q 5 ${headY+53} -33 ${headY+26}" fill="${hair}"/>`:'';
 const hat=a.hat?`<path d="M -59 ${headY-55} H 59 L 40 ${headY-98}H -40 Z" fill="${adjust(shirt,.85)}" stroke="#172232" stroke-width="3"/><rect x="-67" y="${headY-56}" width="134" height="11" rx="6" fill="${shirt}"/>`:'';
 const torso=`<g class="torso"><path d="M ${-torsoHalf} ${bodyTop} Q 0 ${bodyTop-17} ${torsoHalf} ${bodyTop} L ${torsoHalf*.83} ${hipY} Q 0 ${hipY+14} ${-torsoHalf*.83} ${hipY} Z" fill="${shirt}" stroke="${adjust(shirt,.69)}" stroke-width="4"/><path d="M ${-torsoHalf+8} ${bodyTop+12} Q 0 ${bodyTop+5} ${torsoHalf-8} ${bodyTop+12}" stroke="${adjust(shirt,1.18)}" stroke-width="4" fill="none"/><path d="M -15 ${bodyTop+6} L 0 ${bodyTop+23} L 15 ${bodyTop+6}" fill="none" stroke="${adjust(shirt,.7)}" stroke-width="3"/></g>`;
 const limb=(side,which)=>{const sign=side==='left'?-1:1;const px=sign*(torsoHalf-6);const cls=which==='arm'?`arm-${side}`:`leg-${side}`;if(which==='arm')return `<g class="${cls}"><path d="M ${px} ${bodyTop+12} Q ${px+sign*22} ${bodyTop+52} ${px+sign*22} ${hipY-5}" stroke="${shirt}" stroke-width="24" fill="none" stroke-linecap="round"/><ellipse cx="${px+sign*22}" cy="${hipY-5}" rx="12" ry="15" fill="${robot?'#839fa8':skin}"/></g>`;
 return `<g class="${cls}"><path d="M ${sign*23} ${hipY-4} L ${sign*26} ${cy(-23)}" stroke="${pants}" stroke-width="28" stroke-linecap="round"/><rect x="${sign*26-21}" y="${cy(-27)}" width="42" height="20" rx="8" fill="#202938"/></g>`;};
 const faceColor=robot?'#a8c7d8':skin;
 const head=`<g class="head"><rect x="-12" y="${headY+40}" width="24" height="21" rx="9" fill="${adjust(faceColor,.83)}"/><ellipse cx="0" cy="${headY-10}" rx="${headRx}" ry="67" fill="${faceColor}" stroke="${adjust(faceColor,.8)}" stroke-width="3"/>${robot?`<path d="M -35 ${headY-54}h70v30h-70z" fill="#425a76" opacity=".4"/><circle cx="0" cy="${headY-83}" r="7" fill="#6be4ce"/>`:hairShape}${eyes}${beard}${mouth}${glasses}${hat}${a.scar?`<path d="M 30 ${headY+6}l-9 18 9 -4" stroke="#a06564" stroke-width="3" fill="none"/>`:''}</g>`;
 const classPose='motion-'+(p==='señalar'?'senalar':p==='caminar'?'caminar':p==='saludar'?'saludar':'idle');
 return `<g data-entity="${xml(c.id)}" class="character ${classPose}" transform="translate(${Number(x)} ${Number(y)}) scale(${Number(scale)*build} ${Number(scale)})"><ellipse cx="0" cy="0" rx="54" ry="12" fill="#152332" opacity=".23"/>${limb('left','leg')}${limb('right','leg')}${limb('left','arm')}${torso}${limb('right','arm')}${head}</g>`;
}
export function objectGroup(o,{x=0,y=0,scale=1}={}){
 const k=o.kind,c=hex(o.params?.color,'#d4aa62'),s=(Number(o.params?.scale)||1)*scale;
 let figure='';
 switch(k){
 case 'llave':figure=`<circle cx="0" cy="-47" r="17" stroke="${c}" stroke-width="11" fill="none"/><path d="M 0 -29V 15h20V3h-9" fill="none" stroke="${c}" stroke-width="11" stroke-linejoin="round"/>`;break;
 case 'mesa':figure=`<rect x="-85" y="-72" width="170" height="22" rx="5" fill="${c}"/><path d="M -64 -50V10 M 64 -50V10" stroke="${adjust(c,.65)}" stroke-width="17"/>`;break;
 case 'silla':figure=`<rect x="-34" y="-100" width="68" height="76" rx="7" fill="${c}"/><rect x="-47" y="-29" width="94" height="18" rx="5" fill="${adjust(c,1.1)}"/><path d="M-32 -11V19 M32 -11V19" stroke="${adjust(c,.65)}" stroke-width="11"/>`;break;
 case 'espada':figure=`<path d="M0 -126L16 -103 9 -24 -9 -24 -16 -103Z" fill="#dce4e9"/><path d="M-35 -22H35" stroke="${c}" stroke-width="12"/><path d="M0 -17V39" stroke="${adjust(c,.6)}" stroke-width="13"/><circle cx="0" cy="42" r="10" fill="${c}"/>`;break;
 case 'libro':figure=`<path d="M-57 -68Q-20 -79 0 -61Q20 -80 57 -68V3Q26 -6 0 13Q-28 -8 -57 3Z" fill="${c}" stroke="#283241" stroke-width="4"/><path d="M0 -61V13" stroke="#283241" stroke-width="4"/>`;break;
 case 'lampara':figure=`<path d="M-38 -96H38L26 -46H-26Z" fill="${c}"/><path d="M0 -46V6" stroke="#66788a" stroke-width="8"/><rect x="-30" y="2" width="60" height="10" rx="5" fill="#66788a"/><ellipse cx="0" cy="-45" rx="24" ry="9" fill="#ffebb1" opacity=".7"/>`;break;
 case 'puerta':figure=`<rect x="-57" y="-183" width="114" height="191" rx="7" fill="${adjust(c,.68)}" stroke="${adjust(c,.45)}" stroke-width="8"/><path d="M-39 -162H40V-7H-39Z" fill="${c}"/><circle cx="27" cy="-75" r="7" fill="#f6d38c"/>`;break;
 case 'taza':figure=`<path d="M-35 -48H31L27 7H-25Z" fill="${c}"/><path d="M30 -35C69 -43 67 -3 30 -7" fill="none" stroke="${c}" stroke-width="10"/><path d="M-10 -61Q-22 -76 -9 -85 M9 -61Q-1 -77 12 -90" stroke="#dbe2f2" fill="none" stroke-width="3" opacity=".6"/>`;break;
 case 'caja':figure=`<rect x="-48" y="-90" width="96" height="95" rx="4" fill="${c}" stroke="${adjust(c,.65)}" stroke-width="5"/><path d="M-48 -60H48M0 -90V5" fill="none" stroke="${adjust(c,.8)}" stroke-width="5"/>`;break;
 default:figure=`<rect x="-42" y="-85" width="84" height="85" rx="17" fill="${c}" stroke="${adjust(c,.8)}" stroke-width="5"/><circle cx="0" cy="-42" r="15" fill="#fff" opacity=".23"/>`;
 }
 return `<g data-entity="${xml(o.id)}" transform="translate(${Number(x)} ${Number(y)}) scale(${Number(s)})"><ellipse cx="0" cy="5" rx="43" ry="9" fill="#081420" opacity=".18"/>${figure}</g>`;
}
export function environmentGroup(env,w=960,h=540){
 const t=env.theme,p=env.params||{},sky=hex(p.skyColor,'#536f99'),wall=hex(p.wallColor,'#3d526a'),floor=hex(p.floorColor,'#3a475b'),night=p.timeOfDay==='noche',rand=seeded(p.seed);
 let out=`<rect width="${w}" height="${h}" fill="${night?adjust(sky,.46):sky}"/><circle cx="${w*.78}" cy="${h*.15}" r="37" fill="${night?'#dfe9fc':'#f0cf83'}" opacity=".88"/>`;
 if(t==='bosque'){
  out+=`<path d="M0 310Q100 245 200 315Q350 215 530 300Q700 220 960 298V540H0" fill="${adjust(sky,.8)}"/><path d="M0 390Q250 322 455 396Q710 320 960 390V540H0" fill="#426a60"/>`;
  for(let i=0;i<24;i++){const x=rand()*w,y=345+rand()*125,s=.65+rand()*1.3;out+=`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"><path d="M-8 0V-123H8V0" fill="#4f4237"/><path d="M0 -208L-55 -96H55Z M0 -176L-48 -67H48Z" fill="${i%3===0?'#386f68':'#2b645d'}"/></g>`;}
 }else if(t==='ciudad'){
  out+=`<rect y="350" width="960" height="190" fill="${floor}"/>`;
  for(let i=0;i<18;i++){const x=i*60-10,bh=120+rand()*190;out+=`<rect x="${x}" y="${350-bh}" width="${48+rand()*20}" height="${bh}" fill="${adjust(wall,.72+rand()*.4)}"/><g fill="${night?'#ffdca2':'#9eb5cf'}" opacity=".62">${[0,1,2].map(j=>`<rect x="${x+10+j*12}" y="${370-bh}" width="6" height="9"/>`).join('')}</g>`;}
  out+=`<path d="M0 424H960" stroke="#b5bac4" stroke-width="5"/>`;
 }else if(t==='castillo'){
  out+=`<path d="M0 365Q250 305 510 366Q700 302 960 360V540H0" fill="${adjust(floor,1.2)}"/>`;
  for(const x of [90,690]){out+=`<rect x="${x}" y="150" width="190" height="300" fill="#7c7f8b"/><rect x="${x-15}" y="137" width="220" height="31" fill="#9a9eaa"/><path d="M ${x+75} 450V345a30 30 0 0 1 60 0v105" fill="#373e4f"/>`;}
  out+=`<rect y="360" width="960" height="180" fill="${floor}"/>`;
 }else if(t==='espacio'){
  out=`<rect width="960" height="540" fill="#11172d"/>`;
  for(let i=0;i<110;i++)out+=`<circle cx="${Math.floor(rand()*960)}" cy="${Math.floor(rand()*410)}" r="${(rand()*1.6+.5).toFixed(1)}" fill="#e4f0ff" opacity="${(.4+rand()*.6).toFixed(2)}"/>`;
  out+=`<ellipse cx="760" cy="160" rx="120" ry="87" fill="#517dd2"/><path d="M0 420L210 325H800L960 420V540H0Z" fill="${floor}"/><path d="M0 420H960" stroke="#7b99d4" stroke-width="7"/>`;
 }else{
  out+=`<rect y="140" width="960" height="310" fill="${wall}"/><rect y="420" width="960" height="120" fill="${floor}"/>`;
  if(t==='laboratorio'){
   for(let i=0;i<4;i++){const x=75+i*230;out+=`<rect x="${x}" y="190" width="145" height="130" rx="9" fill="#1c2d40" stroke="#6ba4bd" stroke-width="5"/><path d="M${x+15} 272L${x+47} 242  ${x+75} 266  ${x+115} 217" stroke="#53d9b3" stroke-width="4" fill="none"/><rect x="${x+32}" y="335" width="88" height="60" rx="6" fill="#2d5364"/>`;}
  }else{
   out+=`<rect x="87" y="188" width="250" height="164" rx="9" fill="${adjust(sky,.75)}" stroke="#9bb2cb" stroke-width="12"/><path d="M212 188V352 M87 270H337" stroke="#9bb2cb" stroke-width="9"/><rect x="610" y="247" width="195" height="160" rx="12" fill="${adjust(floor,1.45)}"/><rect x="630" y="230" width="145" height="35" rx="7" fill="${adjust(floor,1.65)}"/>`;
  }
 }
 if(p.weather==='lluvia')for(let i=0;i<65;i++){const x=rand()*w,y=rand()*h;out+=`<path d="M${x.toFixed()} ${y.toFixed()}l-10 22" stroke="#c5e5ff" stroke-width="2" opacity=".35"/>`;}
 return out;
}
function sceneSvg(state,scene){const env=state.environments.find(x=>x.id===scene.environmentId)||{theme:'interior',params:{}};let out=environmentGroup(env);const drawable=[];
 const held = new Set((scene.actors||[]).map(a=>a.heldObjectId).filter(Boolean));
 for(const p of scene.props||[]){const o=state.objects.find(x=>x.id===p.objectId);if(o&&!held.has(o.id))drawable.push({y:p.y,svg:objectGroup(o,{x:p.x,y:p.y,scale:1})});}
 for(const a of scene.actors||[]){const c=state.characters.find(x=>x.id===a.characterId);if(c){let svg=characterGroup(c,{x:a.x,y:a.y,scale:.87,pose:a.pose,expression:a.expression});if(a.heldObjectId){const heldObj=state.objects.find(o=>o.id===a.heldObjectId);if(heldObj&&heldObj.interaction?.pickupable)svg+=objectGroup(heldObj,{x:a.x+48,y:a.y-104,scale:.55});}drawable.push({y:a.y,svg});}}
 drawable.sort((a,b)=>a.y-b.y);out+=drawable.map(x=>x.svg).join('');
 if(scene.dialogues?.length){const d=scene.dialogues.at(-1),actor=scene.actors.find(a=>a.characterId===d.characterId),c=state.characters.find(x=>x.id===d.characterId);if(actor&&c){out+=`<rect x="18" y="16" width="550" height="72" rx="14" fill="#152336" opacity=".93"/><text x="35" y="40" fill="#80d4c8" font-size="18" font-weight="bold">${xml(c.name)}</text><text x="35" y="66" fill="#f1f4fc" font-size="16">${xml(d.text.slice(0,70))}</text>`;}}
 return wrap(960,540,out);
}
export function renderSvg(state,type,id){const e=state[type]?.find(x=>x.id===id);if(!e)throw new Error('Asset no encontrado');if(type==='characters')return wrap(420,440,`<rect width="420" height="440" fill="#172333"/><circle cx="210" cy="180" r="140" fill="#243952" opacity=".6"/>${characterGroup(e,{x:210,y:403,scale:1.06})}<text x="18" y="28" fill="#c9d8ee" font-size="16">${xml(e.name)}</text>`);
 if(type==='objects')return wrap(420,440,`<rect width="420" height="440" fill="#1a2b3b"/><circle cx="210" cy="235" r="144" fill="#24445b" opacity=".46"/>${objectGroup(e,{x:210,y:320,scale:1.9})}<text x="18" y="28" fill="#c9d8ee" font-size="16">${xml(e.name)}</text>`);
 if(type==='environments')return wrap(960,540,environmentGroup(e));
 if(type==='scenes')return sceneSvg(state,e);
 if(type==='series')return wrap(960,540,`<rect width="960" height="540" fill="#202943"/><circle cx="780" cy="120" r="190" fill="#38678b" opacity=".3"/><text x="70" y="230" fill="white" font-size="70" font-weight="bold">${xml(e.name.slice(0,22))}</text><text x="72" y="285" fill="#91d8cb" font-size="24">Biblia narrativa</text>`);
 throw new Error('Vista previa desconocida');
}
