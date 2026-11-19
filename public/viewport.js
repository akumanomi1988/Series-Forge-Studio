// Three.js rendering from declarative, re-usable assets. No agent, no generated JS execution.
import * as THREE from '/vendor/three.module.js';

const RAD=Math.PI/180;
const vec=(v,d=[0,0,0])=>Array.isArray(v)&&v.length===3?v:d;
const validHex=c=>/^#[0-9a-fA-F]{6}$/.test(c||'')?c:'#8997a8';
function geometry(p){const [x,y,z]=vec(p.size,[.3,.3,.3]).map(n=>Math.max(.005,Math.min(20,Number(n)||.1)));
 switch(p.primitive){case 'box':return new THREE.BoxGeometry(x,y,z);case 'capsule':return new THREE.CapsuleGeometry(x,Math.max(.01,y-2*x),6,10);case 'cylinder':return new THREE.CylinderGeometry(x,x,y,12);default:{const g=new THREE.SphereGeometry(1,20,14);g.scale(x,y,z);return g;}}
}
function mesher(p){const shape=geometry(p),mat=new THREE.MeshToonMaterial({color:validHex(p.color)});const mesh=new THREE.Mesh(shape,mat);mesh.position.fromArray(vec(p.position));mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.part=p.id;
 // Toon silhouette via inverse hull, stable under arbitrary yaw.
 const outline=new THREE.Mesh(shape,new THREE.MeshBasicMaterial({color:0x18212e,side:THREE.BackSide}));outline.scale.setScalar(1.045);mesh.add(outline);return mesh;
}
function sample(track,t,duration,loop){const keys=track.keys||[];if(!keys.length)return 0;const time=loop?t%duration:Math.min(duration,t);if(time<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(time<=keys[i][0]){const k0=keys[i-1],k1=keys[i],a=(time-k0[0])/Math.max(.00001,k1[0]-k0[0]);const smooth=a*a*(3-2*a);return k0[1]+(k1[1]-k0[1])*smooth;}return keys.at(-1)[1];}
export class Viewport {
 constructor(host){this.host=host;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#1b2737');this.camera=new THREE.OrthographicCamera(-4.5,4.5,3,-3,.1,100);this.camera.position.set(4,2.8,7);this.camera.lookAt(0,1,0);this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.replaceChildren(this.renderer.domElement);this.root=new THREE.Group();this.scene.add(this.root);this.actors=[];this.elapsed=0;this.playing=false;this.mode='character';this.defaultYaw=0;this.background='#1b2737';
  this.scene.add(new THREE.HemisphereLight(0xe3edff,0x46536b,2.0));const lamp=new THREE.DirectionalLight(0xffffff,2.2);lamp.position.set(-3,7,5);lamp.castShadow=true;lamp.shadow.mapSize.set(1024,1024);this.scene.add(lamp);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshToonMaterial({color:'#34465a'}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.015;this.scene.add(floor);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  let drag=null;this.renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};this.renderer.domElement.setPointerCapture(e.pointerId);});this.renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;drag={x:e.clientX,y:e.clientY};this.camera.position.applyAxisAngle(new THREE.Vector3(0,1,0),-dx*.008);this.camera.lookAt(0,1,0);});this.renderer.domElement.addEventListener('pointerup',()=>drag=null);
  this.last=performance.now();this.frame=this.frame.bind(this);this.req=requestAnimationFrame(this.frame);
 }
 resize(){const w=Math.max(100,this.host.clientWidth),h=Math.max(100,this.host.clientHeight),size=3.5;this.camera.left=-size*w/h;this.camera.right=size*w/h;this.camera.top=size;this.camera.bottom=-size;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
 clear(){for(const child of [...this.root.children]){this.root.remove(child);child.traverse(n=>{if(n.isMesh){n.geometry?.dispose();if(Array.isArray(n.material))n.material.forEach(m=>m.dispose());else n.material?.dispose();}});}this.actors=[];}
 buildActor(bundle,position=[0,0,0],yawDeg=0,headYawDeg=0,animation='idle',expression='neutral'){
  const files=bundle.files||{},rig=files['rig.json']?.parsed,geo=files['geometry.json']?.parsed;if(!rig?.bones||!geo?.parts)throw new Error('Faltan rig.json o geometry.json');
  const body=new THREE.Group();body.position.fromArray(vec(position));body.rotation.y=yawDeg*RAD;this.root.add(body);
  const bones=new Map();for(const definition of rig.bones){const bone=new THREE.Group();bone.name=definition.id;bone.position.fromArray(vec(definition.position));bone.rotation.set(...vec(definition.rotationDeg).map(n=>n*RAD));bones.set(definition.id,bone);}
  for(const definition of rig.bones){const bone=bones.get(definition.id);(bones.get(definition.parent)||body).add(bone);}
  const parts=new Map();for(const p of geo.parts){const bone=bones.get(p.bone);if(!bone)continue;const m=mesher(p);bone.add(m);parts.set(p.id,m);}
  const actor={body,bones,parts,bundle,position:[...position],yawDeg,headYawDeg,animation,expression};this.actors.push(actor);return actor;
 }
 applyActor(actor,t){const files=actor.bundle.files;const clip=files[`animations/${actor.animation}.json`]?.parsed||files['animations/idle.json']?.parsed;for(const bone of actor.bones.values())bone.rotation.set(0,0,0);
  if(clip){for(const track of clip.tracks||[]){const [name,,axis]=track.target.split('.'),bone=actor.bones.get(name);if(bone&&['x','y','z'].includes(axis))bone.rotation[axis]=sample(track,t,clip.duration,clip.loop)*RAD;}}
  const head=actor.bones.get('head');if(head)head.rotation.y+=actor.headYawDeg*RAD;
  const exp=files[`expressions/${actor.expression}.json`]?.parsed||files['expressions/neutral.json']?.parsed||{};
  const mouth=actor.parts.get('mouth');if(mouth)mouth.scale.y=exp.mouthScaleY||1;
  for(const eye of ['eyeL','eyeR']){const m=actor.parts.get(eye);if(m)m.scale.y=exp.eyeScaleY||1;}
 }
 setYaw(deg){this.defaultYaw=deg;for(const a of this.actors)a.body.rotation.y=deg*RAD;}
 setPerformance(animation,expression){for(const a of this.actors){if(animation)a.animation=animation;if(expression)a.expression=expression;}}
 setTime(t){this.elapsed=Math.max(0,Number(t)||0);this.onFrame?.(this.elapsed);this.draw();}
 loadCharacter(bundle){this.clear();this.mode='character';this.buildActor(bundle,[0,0,0],this.defaultYaw);this.camera.position.set(3.2,2.6,6.3);this.camera.lookAt(0,1,0);this.draw();}
 loadProp(bundle){this.clear();this.mode='prop';const parts=bundle.files?.['geometry.json']?.parsed?.parts||[];const g=new THREE.Group();this.root.add(g);for(const p of parts)g.add(mesher(p));this.camera.position.set(3,2.4,5);this.camera.lookAt(0,.65,0);this.draw();}
 addEnvironment(bundle){const env=bundle.files?.['environment.json']?.parsed||{};const [w,h,d]=vec(env.size,[12,8,9]);const mat=new THREE.MeshToonMaterial({color:validHex(env.backdropColor)});const rear=new THREE.Mesh(new THREE.BoxGeometry(w,h,.1),mat);rear.position.set(0,h/2,-d/2);this.root.add(rear);const l=new THREE.Mesh(new THREE.BoxGeometry(.1,h,d),mat);l.position.set(-w/2,h/2,0);this.root.add(l);this.draw();}
 loadEnvironment(bundle){this.clear();this.mode='environment';this.addEnvironment(bundle);this.camera.position.set(5,3,8);this.camera.lookAt(0,2,-2);this.draw();}
 async loadScene(scene,getBundle){this.clear();this.mode='scene';for(const a of scene.actors){try{const data=await getBundle('characters',a.characterId);this.buildActor(data,a.position,a.yawDeg,a.headYawDeg,a.animation,a.expression);}catch(e){console.warn('Actor inválido',a.characterId,e);}}for(const p of scene.props||[]){try{const b=await getBundle('props',p.propId);const g=new THREE.Group();g.position.fromArray(vec(p.position));g.rotation.y=(p.yawDeg||0)*RAD;this.root.add(g);for(const part of b.files?.['geometry.json']?.parsed?.parts||[])g.add(mesher(part));}catch(e){console.warn('Prop inválido',e);}}
  this.camera.position.fromArray(vec(scene.camera?.position,[0,2.4,8]));this.camera.lookAt(...vec(scene.camera?.target,[0,1,0]));this.draw();}
 draw(){for(const a of this.actors)this.applyActor(a,this.elapsed);this.renderer.render(this.scene,this.camera);}
 frame(now){const dt=Math.min(.1,(now-this.last)/1000);this.last=now;if(this.playing){this.elapsed+=dt;this.onFrame?.(this.elapsed);}this.draw();this.req=requestAnimationFrame(this.frame);}
 dispose(){cancelAnimationFrame(this.req);this.resizeObserver.disconnect();this.clear();this.renderer.dispose();this.host.replaceChildren();}
}