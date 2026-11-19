const labels={characters:'Personajes',environments:'Entornos',objects:'Objetos',scenes:'Escenas',series:'Series'};
const glyph={characters:'♙',environments:'◈',objects:'⬡',scenes:'▣',series:'✳'};
const sequence=['characters','environments','objects','scenes','series'];
let state={characters:[],environments:[],objects:[],scenes:[],series:[],events:[],metadata:{}},selected=null,category='characters',tab='chat',busy=false;
const $=(s)=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));
const photo=(type,id)=>`/api/preview/${type}/${encodeURIComponent(id)}.svg?rev=${state[type]?.find(x=>x.id===id)?.revision||0}`;
const titleCase=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1);
async function api(path,data){const res=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const json=await res.json();if(!res.ok)throw new Error(json.error||`HTTP ${res.status}`);return json.result??json;}
function toast(m,error=false){const el=$('#toast');el.textContent=m;el.style.borderColor=error?'#a65155':'#3c756d';el.style.background=error?'#3a1e2b':'#193b3a';el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),4000);}
async function refresh(){state=await api('state');if(selected&&!state[selected.type]?.some(x=>x.id===selected.id))selected=null;renderAll();}
function find(){return selected?state[selected.type]?.find(x=>x.id===selected.id):null;}
function focusAsset(type,id){category=type;selected={type,id};renderAll();}
function renderAll(){renderCategories();renderLibrary();renderWorkspace();renderOverview();renderInspector();renderStory();}
function renderCategories(){$('#categories').innerHTML=sequence.map(type=>`<button class="nav-item ${category===type?'active':''}" data-category="${type}"><span class="nav-icon">${glyph[type]}</span>${labels[type]}<span class="count">${state[type].length}</span></button>`).join('');}
function renderLibrary(){const q=($('#search').value||'').toLowerCase();let items=state[category].filter(e=>e.name.toLowerCase().includes(q));$('#library').innerHTML=`<div class="library-head"><span>${labels[category].toUpperCase()}</span><button class="plus" data-create="${category}" title="Nuevo asset">+</button></div>`+(items.length?items.map(e=>`<button class="asset-item ${selected?.id===e.id&&selected?.type===category?'active':''}" data-select="${category}|${esc(e.id)}"><span class="asset-thumb"><img src="${photo(category,e.id)}" alt=""/></span><span><span class="asset-name">${esc(e.name)}</span><span class="asset-sub">v${e.revision} · ${category==='characters'?esc(e.kind):category==='objects'?esc(e.kind):category==='environments'?esc(e.theme):'editable'}</span></span></button>`).join(''):`<div class="empty-library">Todavía no hay ${labels[category].toLowerCase()}. Usa el chat o pulsa + para crear uno.</div>`);}
async function renderWorkspace(){const current=find();$('#workspace-title').textContent=current?.name||'Estudio';$('#asset-title').textContent=current?.name||'Tu estudio de creación';$('#revision').textContent=current?`revisión ${current.revision}`:'';$('#download-svg').disabled=!current;$('#play-scene').classList.toggle('hidden',selected?.type!=='scenes');
 $('#stage-info').textContent=current?`${labels[selected.type]} · ${current.id}`:'Sin asset seleccionado';
 if(!current){$('#stage').innerHTML=`<div class="empty-state"><div class="empty-symbol">✦</div><h2>Un universo desde cero</h2><p>Crea un personaje, escenario u objeto por chat y observa cómo cambia al instante.</p><div class="prompt-tags"><button class="suggest">Crea un hombre llamado Alex</button><button class="suggest">Crea un laboratorio futurista</button><button class="suggest">Crea una llave dorada</button></div></div>`;return;}
 const original=selected.id;const originalType=selected.type;
 try{const r=await fetch(photo(originalType,original));const svg=await r.text();if(selected?.id===original&&selected?.type===originalType)$('#stage').innerHTML=svg;}catch(e){toast('Vista previa: '+e.message,true);}
}
function renderOverview(){const items=[['Personajes',state.characters.length],['Escenarios',state.environments.length],['Objetos',state.objects.length],['Escenas',state.scenes.length]];$('#overview').innerHTML=items.map(([name,n])=>`<div class="stat"><div class="value">${n}</div><div class="label">${name}</div></div>`).join('');$('#scene-list').innerHTML=state.scenes.length?state.scenes.map(s=>`<div class="scene-card" data-select="scenes|${esc(s.id)}"><div class="scene-preview">▣</div><div><strong>${esc(s.name)}</strong><span class="scene-caption">${s.actors.length} actores · ${s.props.length} objetos · ${s.dialogues.length} líneas</span></div><span class="arrow">↗</span></div>`).join(''):`<div class="no-scenes">Crea una escena para combinar personajes, entornos y objetos. Las escenas referencian los mismos assets en vez de duplicarlos.</div>`;}
function field(name,path,value,kind='text',options=[],extra=''){
 let input;
 const common=`data-path="${esc(path)}" data-input="${kind}"`;
 if(kind==='select')input=`<select ${common}>${options.map(v=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(titleCase(v))}</option>`).join('')}</select>`;
 else if(kind==='textarea')input=`<textarea ${common} rows="3">${esc(value||'')}</textarea>`;
 else if(kind==='checkbox')input=`<input type="checkbox" ${common} ${value?'checked':''}/>`;
 else if(kind==='color')input=`<input type="color" ${common} value="${esc(value||'#6688aa')}"/>`;
 else if(kind==='range')input=`<input type="range" ${common} min="${extra.includes('pitch')?'0.5':'0.6'}" max="1.7" step="0.05" value="${Number(value)||1}"/>`;
 else input=`<input type="text" ${common} value="${esc(value||'')}"/>`;
 return `<div class="field"><label>${esc(name)}</label>${input}</div>`;
}
function section(title,content){return `<section class="inspector-section"><h4>${title.toUpperCase()}</h4>${content}</section>`;}
function renderInspector(){const e=find();if(!e){$('#inspector').innerHTML='<div class="empty-inspector">Selecciona un asset. Aquí podrás configurar su geometría, color, comportamiento, historia y relaciones.</div>';return;}
 let html=`<div class="inspector-heading"><h3>${esc(e.name)}</h3><p>${labels[selected.type]} · ID estable ${esc(e.id)} · versión ${e.revision}</p></div>`;
 html+=section('Identidad',field('Nombre','name',e.name));
 if(selected.type==='characters'){
  const a=e.appearance,v=e.voice,st=e.story;
  html+=section('Apariencia y rig',`<div class="fields-two">${field('Piel','appearance.skinTone',a.skinTone,'color')}${field('Pelo','appearance.hairColor',a.hairColor,'color')}${field('Chaqueta','appearance.shirtColor',a.shirtColor,'color')}${field('Pantalón','appearance.pantsColor',a.pantsColor,'color')}${field('Ojos','appearance.eyeColor',a.eyeColor,'color')}</div>${field('Estatura','appearance.height',a.height,'range')}${field('Constitución','appearance.build',a.build,'range')}${field('Cabello','appearance.hairStyle',a.hairStyle,'select',['corto','largo','calvo'])}<div class="fields-two">${field('Gafas','appearance.glasses',a.glasses,'checkbox')}${field('Barba','appearance.beard',a.beard,'checkbox')}${field('Cicatriz','appearance.scar',a.scar,'checkbox')}${field('Sombrero','appearance.hat',a.hat,'checkbox')}</div>`);
  html+=section('Actuación',`${field('Pose','performance.pose',e.performance.pose,'select',['idle','caminar','saludar','señalar','sentado'])}${field('Emoción','performance.expression',e.performance.expression,'select',['neutral','feliz','triste','enfadado','asustado','sorprendido','pensativo'])}<button class="outline small" data-speak="${esc(e.id)}">▶ Probar voz</button>`);
  html+=section('Voz asignada',`${field('Identificador de voz del sistema','voice.voiceName',v.voiceName)}${field('Velocidad','voice.rate',v.rate,'range')}${field('Tono','voice.pitch',v.pitch,'range')}<p class="field-note">Vista previa con voces del navegador. La voz exportable/TTS local todavía no está implementada.</p>`);
  html+=section('Ficha narrativa',`${field('Biografía','story.biography',st.biography,'textarea')}${field('Personalidad','story.personality',st.personality,'textarea')}${field('Objetivo','story.goal',st.goal,'textarea')}${field('Miedo','story.fear',st.fear,'textarea')}${field('Secreto','story.secret',st.secret,'textarea')}${field('Sentimientos','story.feelings',st.feelings,'textarea')}`);
  const others=state.characters.filter(c=>c.id!==e.id);
  html+=section('Relaciones',others.length?`<div class="field"><label>Con quién</label><select id="relation-target">${others.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Tipo de relación</label><input id="relation-text" placeholder="amistad, rivalidad, familia..."/></div><div class="field"><label>Sentimiento</label><input id="relation-feeling" placeholder="confianza, resentimiento..."/></div><button class="primary" id="save-relation">Guardar relación</button>`:'<p class="field-note">Crea un segundo personaje para establecer relaciones.</p>');
  html+=section('Historial',`<div class="field-note">${e.history?.length?e.history.slice(-5).reverse().map(h=>`<p>${esc(h.label)} — ${esc(h.at.slice(0,10))}</p>`).join(''):'Todavía no hay cambios.'}</div>`);
 }else if(selected.type==='environments'){
  const a=e.params;html+=section('Generación de entorno',`${field('Tipo','theme',e.theme,'select',['interior','laboratorio','bosque','ciudad','castillo','espacio'])}<div class="fields-two">${field('Color de cielo','params.skyColor',a.skyColor,'color')}${field('Paredes','params.wallColor',a.wallColor,'color')}${field('Suelo','params.floorColor',a.floorColor,'color')}</div>${field('Momento','params.timeOfDay',a.timeOfDay,'select',['dia','noche'])}${field('Clima','params.weather',a.weather,'select',['despejado','lluvia'])}${field('Descripción del lugar','story.description',e.story.description,'textarea')}${field('Historia del lugar','story.lore',e.story.lore,'textarea')}`);
 }else if(selected.type==='objects'){
  const a=e.params;html+=section('Objeto procedural',`${field('Clase','kind',e.kind,'select',['llave','mesa','silla','espada','libro','lampara','puerta','caja','taza','objeto'])}${field('Color','params.color',a.color,'color')}${field('Escala','params.scale',a.scale,'range')}${field('Se puede recoger','interaction.pickupable',e.interaction.pickupable,'checkbox')}${field('Estado','interaction.state',e.interaction.state)}${field('Descripción','story.description',e.story.description,'textarea')}`);
 }else if(selected.type==='series'){
  const b=e.bible;html+=section('Biblia de serie',`${field('Premisa','bible.premise',b.premise,'textarea')}${field('Género','bible.genre',b.genre)}${field('Tono','bible.tone',b.tone)}${field('Reglas del universo','bible.rules',b.rules,'textarea')}`);
 }else if(selected.type==='scenes')html+=renderSceneInspector(e);
 if(selected.type!=='scenes')html+=section('Actions',`<button class="outline small" id="select-in-chat">Editar este asset en el chat ↗</button>`);
 $('#inspector').innerHTML=html;
}
function selectOpts(list,id,empty='Selecciona'){return `<option value="">${empty}</option>`+list.map(x=>`<option value="${esc(x.id)}" ${id===x.id?'selected':''}>${esc(x.name)}</option>`).join('');}
function renderSceneInspector(e){let content='';
 content+=section('Localización',`<div class="field"><label>Escenario de fondo</label><select data-path="environmentId" data-input="select">${selectOpts(state.environments,e.environmentId)}</select></div><div class="field"><label>Serie</label><select data-path="seriesId" data-input="select">${selectOpts(state.series,e.seriesId)}</select></div>${field('Descripción','description',e.description,'textarea')}`);
 content+=section('Añadir actores',`<div class="field"><select id="new-actor">${selectOpts(state.characters,'','Personaje de biblioteca')}</select></div><button class="outline small" id="add-actor">+ Colocar personaje</button>`);
 if(e.actors.length)content+=section('Actores en escena',e.actors.map(a=>{const c=state.characters.find(x=>x.id===a.characterId);return `<div class="scene-dialogue"><strong>${esc(c?.name||a.characterId)}</strong><div class="fields-two"><div class="field"><label>Pose</label><select data-actor="${esc(a.characterId)}" data-actor-field="pose">${['idle','saludar','caminar','señalar','sentado'].map(o=>`<option ${a.pose===o?'selected':''}>${o}</option>`).join('')}</select></div><div class="field"><label>Expresión</label><select data-actor="${esc(a.characterId)}" data-actor-field="expression">${['neutral','feliz','triste','enfadado','asustado','sorprendido','pensativo'].map(o=>`<option ${a.expression===o?'selected':''}>${o}</option>`).join('')}</select></div></div><div class="field"><label>Sujeta un objeto</label><select data-actor="${esc(a.characterId)}" data-actor-field="heldObjectId"><option value="">Ninguno</option>${state.objects.filter(o=>o.interaction.pickupable).map(o=>`<option value="${esc(o.id)}" ${a.heldObjectId===o.id?'selected':''}>${esc(o.name)}</option>`).join('')}</select></div></div>`;}).join(''));
 content+=section('Objetos de escena',`<div class="field"><select id="new-prop">${selectOpts(state.objects,'','Objeto de biblioteca')}</select></div><button class="outline small" id="add-prop">+ Colocar objeto</button>${e.props.map(p=>`<p class="field-note">⬡ ${esc(state.objects.find(x=>x.id===p.objectId)?.name||p.objectId)} · x${p.x}/y${p.y}</p>`).join('')}`);
 content+=section('Diálogo y prueba de voz',`<div class="field"><label>Habla</label><select id="talk-actor">${selectOpts(e.actors.map(a=>state.characters.find(c=>c.id===a.characterId)).filter(Boolean),'','Actor en escena')}</select></div><div class="field"><label>Texto</label><textarea id="dialogue-text" rows="3" placeholder="Escribe el diálogo del personaje..."></textarea></div><button class="primary" id="add-dialogue">+ Añadir diálogo</button>${e.dialogues.slice(-8).map(d=>`<div class="scene-dialogue"><b>${esc(state.characters.find(c=>c.id===d.characterId)?.name||'?')}</b>: ${esc(d.text)}<button class="ghost small" data-speak="${esc(d.characterId)}" data-speak-text="${esc(d.text)}">▶</button></div>`).join('')}`);
 content+=section('Producción',`<p class="field-note warn">La composición de escenas se previsualiza. Exportación de vídeo, TTS offline y montaje completo aún no están disponibles en esta versión.</p>`);
 return content;
}
function renderStory(){let html='';const e=find();if(selected?.type==='characters'&&e){
 const rel=Object.entries(e.story.relationships||{});html+=`<div class="story-section"><h4>${esc(e.name)} — Identidad</h4><p>${esc(e.story.biography||'Biografía por definir.')}</p><p style="margin-top:8px"><b>Personalidad:</b> ${esc(e.story.personality||'Sin definir')}<br><b>Objetivo:</b> ${esc(e.story.goal||'Sin definir')}<br><b>Miedo:</b> ${esc(e.story.fear||'Sin definir')}</p></div>`;
 html+=`<div class="story-section"><h4>Relaciones (${rel.length})</h4>${rel.length?rel.map(([id,r])=>`<div class="story-event"><strong>${esc(state.characters.find(c=>c.id===id)?.name||id)}</strong>: ${esc(r.relation)}<br><span>${esc(r.feeling)}</span></div>`).join(''):'<p>Aún no hay vínculos.</p>'}</div>`;
 html+=`<div class="story-section"><h4>Recuerdos (${e.story.memories.length})</h4>${e.story.memories.length?e.story.memories.slice().reverse().map(m=>`<div class="story-event">${esc(m.summary)}</div>`).join(''):'<p>Sin recuerdos narrativos.</p>'}</div>`;
 }else if(selected?.type==='series'&&e){html+=`<div class="story-section"><h4>Canon: ${esc(e.name)}</h4><p>${esc(e.bible.premise)}</p><p>${esc(e.bible.rules||'Reglas de universo sin definir.')}</p></div>`;}
 html+=`<div class="story-section"><h4>Acontecimientos globales (${state.events.length})</h4>${state.events.length?state.events.slice().reverse().slice(0,30).map(x=>`<div class="story-event">${esc(x.summary)}<time>${esc(x.at.slice(0,16).replace('T',' '))}</time></div>`).join(''):'<p>No hay eventos todavía.</p>'}</div>`;
 html+=`<div class="story-section"><h4>Añadir un hecho al canon</h4><div class="field"><textarea rows="3" id="event-text" placeholder="Qué ocurrió, quién lo recuerda y qué cambió..."></textarea></div><button class="primary" id="add-event">Guardar acontecimiento</button></div>`;
 $('#story-content').innerHTML=html;}
function switchTab(n){tab=n;['chat','inspector','story'].forEach(t=>{$(`#${t==='chat'?'chat-panel':t+'-panel'}`).classList.toggle('hidden',t!==tab);$(`#tab-${t}`).classList.toggle('active',t===tab);});}
function bubble(text,isUser=false,isError=false){const node=document.createElement('div');node.className='bubble '+(isUser?'user':'assistant')+(isError?' error':'');node.textContent=text;$('#chat-messages').appendChild(node);$('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;}
async function sendChat(text){if(busy||!text.trim())return;busy=true;$('#send').disabled=true;switchTab('chat');bubble(text,true);$('#chat-input').value='';try{const out=await api('chat',{message:text,selected});bubble(out.message||'Cambio guardado');if(out.selection)selected=out.selection;category=selected?.type||category;await refresh();}catch(e){bubble(e.message,false,true);}finally{busy=false;$('#send').disabled=false;$('#chat-input').focus();}}
async function newAsset(type){const examples={characters:'Crea un hombre llamado Bruno, pelo negro y chaqueta roja',environments:'Crea un laboratorio futurista',objects:'Crea una llave dorada',scenes:'Escena nueva',series:'Una serie de aventura con dos protagonistas'};
 const prompt=window.prompt(`Describe el nuevo elemento (${labels[type]}):`,examples[type]);if(prompt===null||!prompt.trim())return;
 try{let a;if(type==='scenes'){a={name:prompt,environmentId:state.environments.at(-1)?.id||null,seriesId:state.series.at(-1)?.id||null};}else a={prompt};const e=await api('create',{type,...a});selected={type,id:e.id};category=type;await refresh();toast(`${e.name} creado`);}catch(err){toast(err.message,true);}}
function speak(characterId,text){const c=state.characters.find(x=>x.id===characterId);if(!c)return;if(!('speechSynthesis' in window)){toast('Este navegador no admite síntesis de voz',true);return;}
 window.speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(text||`Hola, soy ${c.name}. Estoy preparado para actuar en esta serie.`);
 utter.lang=c.voice.locale||'es-ES';utter.rate=Number(c.voice.rate)||1;utter.pitch=Number(c.voice.pitch)||1;
 const voices=window.speechSynthesis.getVoices();utter.voice=voices.find(v=>v.name===c.voice.voiceName)||voices.find(v=>v.lang.toLowerCase()==='es-es')||voices.find(v=>v.lang.toLowerCase().startsWith('es'))||null;
 const groups=[...$('#stage').querySelectorAll('.character')].filter(g=>g.getAttribute('data-entity')===characterId);
 if(selected?.type==='characters'&&selected.id===characterId)groups.push(...$('#stage').querySelectorAll('.character'));
 const stop=()=>groups.forEach(g=>g.classList.remove('talking'));
 utter.onstart=()=>groups.forEach(g=>g.classList.add('talking'));
 utter.onend=stop;utter.onerror=stop;window.speechSynthesis.speak(utter);
}

let playback=false;
async function previewScene(){
 if(playback||selected?.type!=='scenes')return;
 const scene=find();if(!scene?.dialogues?.length){toast('Añade diálogos a la escena para escucharla');return;}
 if(!('speechSynthesis' in window)){toast('Navegador sin síntesis de voz',true);return;}
 playback=true;$('#play-scene').disabled=true;$('#play-scene').textContent='● Reproduciendo';
 const AudioCtx=window.AudioContext||window.webkitAudioContext;
 const ctx=AudioCtx?new AudioCtx():null;
 const sfx=(freq=550)=>{if(!ctx)return;const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(freq,ctx.currentTime);oscillator.frequency.exponentialRampToValueAtTime(freq*.7,ctx.currentTime+.22);gain.gain.setValueAtTime(.13,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.25);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.25);};
 try{
  sfx(600);
  for(const d of scene.dialogues){
   if(selected?.id!==scene.id)break;
   const c=state.characters.find(x=>x.id===d.characterId);if(!c)continue;
   await new Promise(resolve=>{
    window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(d.text);u.lang=c.voice.locale||'es-ES';u.rate=c.voice.rate||1;u.pitch=c.voice.pitch||1;
    const vs=window.speechSynthesis.getVoices();u.voice=vs.find(v=>v.name===c.voice.voiceName)||vs.find(v=>v.lang?.startsWith('es'))||null;
    const groups=[...$('#stage').querySelectorAll('.character')].filter(el=>el.getAttribute('data-entity')===c.id);
    const stop=()=>{groups.forEach(el=>el.classList.remove('talking'));resolve();};
    u.onstart=()=>groups.forEach(el=>el.classList.add('talking'));u.onend=stop;u.onerror=stop;
    window.speechSynthesis.speak(u);
   });
   if(/llave|metal|robot/i.test(d.text))sfx(820);
  }
 }finally{playback=false;$('#play-scene').disabled=false;$('#play-scene').textContent='▶ Escuchar escena';if(ctx)await ctx.close();}
}
async function onClick(event){const btn=event.target.closest('button,[data-select],.scene-card');if(!btn)return;
 const cat=btn.closest('[data-category]');if(cat){category=cat.dataset.category;renderCategories();renderLibrary();return;}
 const select=btn.closest('[data-select]');if(select){const [t,id]=select.dataset.select.split('|');focusAsset(t,id);return;}
 if(btn.classList.contains('suggest')){const t=btn.textContent.trim();$('#chat-input').value=t;switchTab('chat');$('#chat-input').focus();return;}
 try{
 if(btn.dataset.create){await newAsset(btn.dataset.create);return;}
 if(btn.id==='demo'){const r=await api('demo',{});selected={type:'scenes',id:r.sceneId};category='scenes';await refresh();toast('Universo de ejemplo creado');return;}
 if(btn.id==='export'){location.href='/api/export';return;}
 if(btn.id==='download-svg'&&selected){const a=document.createElement('a');a.href=photo(selected.type,selected.id);a.download=`${selected.id}.svg`;document.body.appendChild(a);a.click();a.remove();return;}
 if(btn.id==='new-scene'){await newAsset('scenes');return;}
 if(btn.id==='select-in-chat'){switchTab('chat');$('#chat-input').focus();return;}
 if(btn.dataset.speak){speak(btn.dataset.speak,btn.dataset.speakText);return;}
 if(btn.id==='play-scene'){await previewScene();return;}
 if(btn.id==='save-relation'&&selected){const toId=$('#relation-target')?.value,relation=$('#relation-text')?.value,feeling=$('#relation-feeling')?.value||'neutral';if(!toId||!relation)throw new Error('Indica el segundo personaje y el vínculo');await api('relationship',{fromId:selected.id,toId,relation,feeling});await refresh();toast('Relación guardada');return;}
 if(btn.id==='add-event'){const summary=$('#event-text').value;if(!summary.trim())throw new Error('Escribe el acontecimiento');await api('event',{summary,characterId:selected?.type==='characters'?selected.id:null,seriesId:state.series.at(-1)?.id||null,emotion:find()?.performance?.expression||'neutral'});await refresh();toast('Acontecimiento añadido');return;}
 if(btn.id==='add-actor'){const id=$('#new-actor').value;if(!id)throw new Error('Elige un personaje');await api('place-actor',{sceneId:selected.id,characterId:id});await refresh();toast('Personaje colocado');return;}
 if(btn.id==='add-prop'){const id=$('#new-prop').value;if(!id)throw new Error('Elige un objeto');await api('place-object',{sceneId:selected.id,objectId:id});await refresh();toast('Objeto colocado');return;}
 if(btn.id==='add-dialogue'){const id=$('#talk-actor').value,text=$('#dialogue-text').value;if(!id||!text.trim())throw new Error('Elige actor y escribe diálogo');await api('dialogue',{sceneId:selected.id,characterId:id,text});await refresh();toast('Diálogo añadido');return;}
 }catch(e){toast(e.message,true);}
}
async function onChange(event){const el=event.target;if(el.matches('[data-path]')&&selected){const path=el.dataset.path;let value=el.dataset.input==='checkbox'?el.checked:el.dataset.input==='range'?Number(el.value):el.value;try{await api('patch',{type:selected.type,id:selected.id,patch:{[path]:value}});await refresh();toast('Cambio guardado');}catch(e){toast(e.message,true);await refresh();}return;}
 if(el.matches('[data-actor-field]')&&selected?.type==='scenes'){try{await api('scene-actor',{sceneId:selected.id,characterId:el.dataset.actor,patch:{[el.dataset.actorField]:el.value||null}});await refresh();toast('Actuación actualizada');}catch(e){toast(e.message,true);}}
}
async function init(){document.addEventListener('click',onClick);document.addEventListener('change',onChange);$('#chat-form').addEventListener('submit',ev=>{ev.preventDefault();sendChat($('#chat-input').value);});$('#chat-input').addEventListener('keydown',ev=>{if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();sendChat($('#chat-input').value);}});$('#search').addEventListener('input',renderLibrary);for(const n of ['chat','inspector','story'])$(`#tab-${n}`).addEventListener('click',()=>switchTab(n));try{await refresh();const status=await api('status');$('#model-status').textContent='Chat local · IA opcional';}catch(e){toast('No se pudo cargar la biblioteca: '+e.message,true);}}
init();
