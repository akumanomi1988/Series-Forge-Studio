/** Stage: the single Three.js renderer shared by the web editor and the headless exporter.
 * stage.setTime(t) + stage.render() is a pure function of (resolved scene, assets, t). */
import * as THREE from 'three';
import type { ResolvedScene, AssetLibrary, EffectInstance } from '../engine/timeline.ts';
import { SceneEvaluator } from '../engine/pose.ts';
import { evaluateShots } from '../engine/camera.ts';
import type { ShotEval, CameraState } from '../engine/camera.ts';
import { CharacterVisual } from './character.ts';
import { buildProp, applyJoints } from './props.ts';
import type { PropVisual } from './props.ts';
import { buildEnvironment, updateEnvironmentLights } from './environment.ts';
import type { EnvVisual } from './environment.ts';
import { hash01, clamp, intervalWeight, smoothstep } from '../engine/math.ts';
import { setRenderStyle } from './toon.ts';

const COMPOSITE_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const COMPOSITE_FS = `
uniform sampler2D tA; uniform sampler2D tB; uniform float mode; uniform float progress; uniform float fade; uniform float aspect; uniform float vignette;
uniform sampler2D tN; uniform sampler2D tD; uniform float ink; uniform vec2 texel; uniform float cNear; uniform float cFar;
uniform float ao; uniform float focal; uniform float tone; uniform float exposure; uniform float sat;
varying vec2 vUv;
float linZ(vec2 uv) { float d = texture2D(tD, uv).x; return cNear * cFar / (cFar - d * (cFar - cNear)); }
/** Fine toon ink: contours where depth jumps (silhouettes, an arm over the body) or the surface turns sharply
 * (the curve of a breast or a glute, folds, edges of furniture). Soft 1-2 px lines, thinner with distance. */
float inkAt(vec2 uv) {
  float zc = linZ(uv); vec3 nc = texture2D(tN, uv).xyz * 2.0 - 1.0;
  if (zc > cFar * 0.9) return 0.0;
  float e = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 o = vec2(cos(a), sin(a)) * texel;
    float zn = linZ(uv + o); vec3 nn = texture2D(tN, uv + o).xyz * 2.0 - 1.0;
    float dz = (zn - zc) / zc; // positive: the neighbour is behind (we are the near side of a silhouette)
    e = max(e, smoothstep(0.012, 0.035, dz));
    e = max(e, smoothstep(0.9, 0.62, dot(nc, nn)) * 0.9);
  }
  return e;
}
/** Screen-space ambient occlusion from the depth of the same frame: 16 samples on a spiral of 0.3 m (projected),
 * occluders closer than the centre and within range darken it. Soft contact shadows under chins, arms, furniture. */
float aoAt(vec2 uv) {
  float zc = linZ(uv); if (zc > cFar * 0.9) return 1.0;
  float rUv = 0.3 * focal / zc; float occ = 0.0;
  for (int i = 0; i < 16; i++) {
    float f = (float(i) + 0.5) / 16.0, a = float(i) * 2.39996;
    vec2 o = vec2(cos(a) / aspect, sin(a)) * rUv * sqrt(f);
    float zs = linZ(uv + o), d = zc - zs;
    occ += smoothstep(0.02, 0.12, d) * (1.0 - smoothstep(0.35, 0.8, d));
  }
  return 1.0 - occ / 16.0;
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec4 b = texture2D(tB, vUv);
  if (ao > 0.0) b.rgb *= mix(1.0, aoAt(vUv), ao);
  if (tone > 0.5) b.rgb = aces(b.rgb * exposure);
  if (sat < 1.0) { float l = dot(b.rgb, vec3(0.299, 0.587, 0.114)); b.rgb = mix(vec3(l), b.rgb, sat) * (0.9 + 0.1 * sat); }
  if (ink > 0.0) b.rgb = mix(b.rgb, b.rgb * 0.12 + vec3(0.02, 0.02, 0.035), inkAt(vUv) * ink);
  vec4 c = b;
  if (mode > 0.5 && mode < 1.5) { c = mix(texture2D(tA, vUv), b, smoothstep(0.0, 1.0, progress)); }
  else if (mode > 1.5 && mode < 2.5) { c = b * smoothstep(0.0, 1.0, progress); }
  else if (mode > 2.5 && mode < 3.5) { vec2 p = (vUv - 0.5) * vec2(aspect, 1.0); float r = progress * 1.25 * length(vec2(aspect, 1.0)) * 0.5; float e = 1.0 - smoothstep(r - 0.01, r + 0.01, length(p)); c = b * e; }
  else if (mode > 3.5) { float edge = smoothstep(progress - 0.04, progress + 0.04, vUv.x); c = mix(b, texture2D(tA, vUv), edge); }
  c.rgb *= fade;
  float v = 1.0 - vignette * smoothstep(0.45, 0.95, length((vUv - 0.5) * vec2(aspect * 0.8, 1.0)));
  c.rgb *= v;
  gl_FragColor = linearToOutputTexel(vec4(c.rgb, 1.0));
}`;

export interface StageOptions { width: number; height: number; pixelRatio?: number; antialias?: boolean; shadows?: boolean }
interface EffectVisual { def: EffectInstance; obj: THREE.Object3D; update(t: number): void }

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 200);
  private prevCamera = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 200);
  private rtA: THREE.WebGLRenderTarget; private rtB: THREE.WebGLRenderTarget; private rtN: THREE.WebGLRenderTarget;
  private normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  /** strength of the fine ink lines (0 = off) */
  ink = 0.9;
  private quadScene = new THREE.Scene(); private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); private composite: THREE.ShaderMaterial;
  evaluator: SceneEvaluator | null = null;
  resolved: ResolvedScene | null = null;
  readonly actors = new Map<string, CharacterVisual>();
  readonly props = new Map<string, PropVisual>();
  private effects: EffectVisual[] = [];
  private env: EnvVisual | null = null;
  private world = new THREE.Group();
  width: number; height: number;
  /** Editor-only: overrides the shot camera (null = final camera). */
  freeCamera: CameraState | null = null;
  vignette = 0.22;
  lastShot: ShotEval | null = null;
  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, opts: StageOptions) {
    this.width = opts.width; this.height = opts.height;
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas as HTMLCanvasElement, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(opts.pixelRatio ?? 1);
    this.renderer.setSize(opts.width, opts.height, false);
    this.renderer.shadowMap.enabled = opts.shadows ?? true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const samples = opts.antialias === false ? 0 : 4;
    this.rtA = new THREE.WebGLRenderTarget(opts.width, opts.height, { samples, type: THREE.HalfFloatType });
    this.rtB = new THREE.WebGLRenderTarget(opts.width, opts.height, { samples, type: THREE.HalfFloatType });
    this.rtN = new THREE.WebGLRenderTarget(opts.width, opts.height, { samples: 0 });
    this.rtN.depthTexture = new THREE.DepthTexture(opts.width, opts.height);
    const px = Math.max(1, opts.height / 1080 * 1.4);
    this.composite = new THREE.ShaderMaterial({ vertexShader: COMPOSITE_VS, fragmentShader: COMPOSITE_FS, uniforms: { tA: { value: this.rtA.texture }, tB: { value: this.rtB.texture }, mode: { value: 0 }, progress: { value: 1 }, fade: { value: 1 }, aspect: { value: opts.width / opts.height }, vignette: { value: this.vignette }, tN: { value: this.rtN.texture }, tD: { value: this.rtN.depthTexture }, ink: { value: this.ink }, ao: { value: 0 }, focal: { value: 1 }, tone: { value: 0 }, exposure: { value: 1 }, sat: { value: 1 }, texel: { value: new THREE.Vector2(px / opts.width, px / opts.height) }, cNear: { value: 0.05 }, cFar: { value: 200 } }, depthTest: false, depthWrite: false });
    this.renderer.shadowMap.autoUpdate = false;
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.composite));
    this.scene.add(this.world);
  }
  resize(width: number, height: number) {
    this.width = width; this.height = height;
    this.renderer.setSize(width, height, false); this.rtA.setSize(width, height); this.rtB.setSize(width, height); this.rtN.setSize(width, height);
    this.composite.uniforms.aspect.value = width / height;
    const px = Math.max(1, height / 1080 * 1.4); (this.composite.uniforms.texel.value as THREE.Vector2).set(px / width, px / height);
  }
  clear() {
    this.world.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry?.dispose(); });
    this.scene.remove(this.world); this.world = new THREE.Group(); this.scene.add(this.world);
    this.actors.clear(); this.props.clear(); this.effects = []; this.env = null; this.evaluator = null; this.resolved = null; this.scene.fog = null;
  }
  /** 'soft': stylised 3D (no ink, ambient occlusion, filmic tone mapping, soft shadows); 'toon': cel + ink */
  style: 'toon' | 'soft' = 'toon';
  load(resolved: ResolvedScene, lib: AssetLibrary) {
    this.clear();
    this.style = lib.style ?? 'toon';
    setRenderStyle(this.style);
    const soft = this.style === 'soft';
    this.ink = soft ? 0 : 0.9;
    this.renderer.shadowMap.type = soft ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
    this.composite.uniforms.ao.value = soft ? 0.85 : 0; this.composite.uniforms.tone.value = soft ? 1 : 0; this.composite.uniforms.exposure.value = soft ? 1.25 : 1;
    this.resolved = resolved;
    this.evaluator = new SceneEvaluator(resolved, lib);
    const envDef = resolved.environmentId ? lib.environments[resolved.environmentId] : null;
    if (envDef) {
      const placed = resolved.props.flatMap(p => { const g = p.segments[0]; return g.kind === 'static' && lib.props[p.propId] ? [{ id: p.id, geo: lib.props[p.propId], position: g.position, yawDeg: g.yawDeg, scale: p.scale }] : []; });
      this.env = buildEnvironment(envDef, placed); this.world.add(this.env.group);
      if (soft) this.env.group.traverse(o => { const l = o as THREE.DirectionalLight; if (l.isLight && l.castShadow && l.shadow) { l.shadow.radius = 3; l.shadow.blurSamples = 12; l.shadow.bias = -0.0006; } });
      this.scene.background = this.env.background; this.scene.fog = (this.env.group.userData.fog as THREE.Fog) ?? null;
    } else { this.scene.background = new THREE.Color('#2a3442'); const env = buildEnvironment({ schemaVersion: 2, kind: 'exterior', size: [12, 4, 12], floor: { color: '#4b5866', pattern: 'tiles' }, walls: { color: '#3d5266', trimColor: '#2a3a48', sides: [], panel: false }, openings: [], sky: { top: '#1d2b3c', bottom: '#2a3442' }, lights: [], ambient: { sky: '#dfe9ff', ground: '#3a4250', intensity: 1.4 }, props: [], decor: [] }); this.env = env; this.world.add(env.group); }
    for (const a of resolved.actors) {
      const rig = this.evaluator.rigs.get(a.id)!;
      const vis = new CharacterVisual(rig, lib.characters[a.characterId].geometry);
      this.world.add(vis.root); this.actors.set(a.id, vis);
    }
    for (const p of resolved.props) {
      const v = buildProp(lib.props[p.propId]);
      v.group.matrixAutoUpdate = false;
      this.world.add(v.group); this.props.set(p.id, v);
    }
    for (const e of resolved.effects) this.effects.push(this.buildEffect(e));
  }
  private buildEffect(def: EffectInstance): EffectVisual {
    const origin = () => {
      if (def.position) return new THREE.Vector3(...def.position);
      const pv = def.prop ? this.props.get(def.prop) : null;
      if (pv) { const part = def.part ? pv.parts.get(def.part) : null; return (part ?? pv.group).getWorldPosition(new THREE.Vector3()); }
      return new THREE.Vector3(0, 1, 0);
    };
    if (def.effect === 'sparks') {
      const N = Math.round(36 * def.intensity);
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; this.world.add(pts);
      const c = new THREE.Color();
      return { def, obj: pts, update: t => {
        const o = origin();
        let alive = 0;
        for (let i = 0; i < N; i++) {
          const birth = def.start + hash01(def.seed, i, 'b') * Math.max(0.05, def.end - def.start - 0.2) * (i % 3 === 0 ? 0.3 : 1);
          const life = 0.25 + hash01(def.seed, i, 'l') * 0.5, tau = t - birth;
          if (tau < 0 || tau > life) { pos.set([0, -100, 0], i * 3); continue; }
          alive++;
          const a = hash01(def.seed, i, 'a') * Math.PI * 2, up = 0.6 + hash01(def.seed, i, 'u') * 1.4, sp = 0.6 + hash01(def.seed, i, 's') * 1.8;
          pos.set([o.x + Math.cos(a) * sp * tau, o.y + up * tau - 4.9 * tau * tau, o.z + Math.sin(a) * sp * tau + 0.25 * tau], i * 3);
          const k = tau / life; c.setRGB(1, 0.9 - 0.6 * k, 0.4 - 0.4 * k).multiplyScalar(2.2 * (1 - k)); col.set([c.r, c.g, c.b], i * 3);
        }
        pts.visible = alive > 0; geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      } };
    }
    if (def.effect === 'smoke') {
      const grp = new THREE.Group(); this.world.add(grp);
      const puffs = Array.from({ length: Math.round(8 * def.intensity) }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshToonMaterial({ color: '#7d8590', transparent: true, opacity: 0.5, depthWrite: false })); grp.add(m); return { m, i }; });
      return { def, obj: grp, update: t => {
        const o = origin();
        for (const { m, i } of puffs) { const birth = def.start + (i / puffs.length) * (def.end - def.start) * 0.8, tau = t - birth, life = 1.6; m.visible = tau > 0 && tau < life; if (!m.visible) continue; const k = tau / life; m.position.set(o.x + Math.sin(i * 2.1) * 0.1 * k, o.y + 0.6 * k, o.z + Math.cos(i * 1.7) * 0.1 * k); m.scale.setScalar(0.05 + 0.18 * k); (m.material as THREE.MeshToonMaterial).opacity = 0.45 * (1 - k); }
      } };
    }
    // flicker / glow on a prop part (material cloned so other instances are unaffected)
    const pv = def.prop ? this.props.get(def.prop) : null;
    const part = pv && def.part ? pv.parts.get(def.part) : null;
    let mat: THREE.MeshToonMaterial | THREE.MeshBasicMaterial | null = null;
    if (part) { mat = (part.material as THREE.Material).clone() as THREE.MeshToonMaterial; part.material = mat; }
    const baseColor = mat ? mat.color.clone() : null;
    const baseEm = mat && 'emissiveIntensity' in mat ? mat.emissiveIntensity : 0;
    if (def.effect === 'off') {
      // switch a device off: its lights go dark and the given part (screen, bulb…) loses its glow
      // no prop and no part: a blackout of the set (environment lights and ambient), practical lights stay on
      const blackout = !def.prop && !def.part;
      const envLights = blackout && this.env ? [...this.env.lights.map(x => x.light), ...this.env.group.children.filter(c => (c as THREE.HemisphereLight).isHemisphereLight) as THREE.Light[]] : [];
      const lights = [...(pv?.lights ?? []), ...envLights].map(l => ({ l, base: l.intensity, keep: (l as THREE.HemisphereLight).isHemisphereLight ? 0.4 : 0.12 }));
      return { def, obj: new THREE.Group(), update: t => {
        const w = intervalWeight(t, def.start, def.end, 0.04, 0.08) * Math.min(1, def.intensity);
        for (const { l, base, keep } of lights) l.intensity = base * (1 - w * (blackout ? 1 - keep : 1));
        if (mat && baseColor) { mat.color.copy(baseColor).multiplyScalar(1 - 0.85 * w); if ('emissiveIntensity' in mat) mat.emissiveIntensity = baseEm * (1 - w); }
      } };
    }
    return { def, obj: new THREE.Group(), update: t => {
      if (!mat || !baseColor) return;
      const w = intervalWeight(t, def.start, def.end, 0.05, 0.1);
      if (def.effect === 'flicker') { const on = hash01(def.seed, Math.floor(t * 18)) > 0.45 * w; mat.color.copy(baseColor).multiplyScalar(on ? 1 : 0.25); if ('emissiveIntensity' in mat) mat.emissiveIntensity = on ? baseEm : 0; }
      else { const k = 1 + w * def.intensity * (0.6 + 0.4 * Math.sin(t * 8)); mat.color.copy(baseColor).multiplyScalar(k); }
    } };
  }
  /** Pose everything for absolute time t. Returns the active shot. */
  setTime(t: number): ShotEval | null {
    const ev = this.evaluator, sc = this.resolved;
    if (!ev || !sc) return null;
    const real = clamp(t, 0, sc.durationSec);
    // freeze frame: picture (poses, props, camera) held at the start of the effect while the sound goes on
    const frz = sc.effects.find(e => e.effect === 'freeze' && real >= e.start && real < e.end);
    const time = frz ? frz.start : real;
    this.composite.uniforms.sat.value = frz ? 1 - 0.45 * clamp((real - frz.start) / 0.25, 0, 1) : 1;
    // camera first so look-at "camera" targets are exact
    const shot = evaluateShots(ev, sc, time, this.width / this.height);
    ev.cameraPos.copy((this.freeCamera ?? shot.camera).position);
    ev.evaluate(time);
    for (const [id, vis] of this.actors) vis.update(ev.poses.get(id)!);
    for (const [id, pv] of this.props) {
      const w = ev.propWorld(id, time);
      if (!w) continue;
      pv.group.matrix.copy(w.matrix); pv.group.matrixWorldNeedsUpdate = true;
      applyJoints(pv, w.joints);
    }
    for (const e of this.effects) e.update(time);
    if (this.env) updateEnvironmentLights(this.env, time);
    this.lastShot = shot;
    const cam = this.freeCamera ?? shot.camera;
    this.applyCamera(this.camera, cam);
    // transitions & fades
    let mode = 0, progress = 1, fade = 1;
    if (!this.freeCamera && shot.transition) {
      progress = shot.transition.progress;
      mode = { dissolve: 1, fade: 2, iris: 3, wipe: 4 }[shot.transition.type];
      if ((mode === 1 || mode === 4) && shot.transition.previous) this.applyCamera(this.prevCamera, shot.transition.previous); else if (mode === 1 || mode === 4) mode = 0;
    }
    if (!this.freeCamera && sc.transitionOut?.type === 'fade') fade = smoothstep((sc.durationSec - real) / Math.max(0.01, sc.transitionOut.durationSec));
    this.composite.uniforms.mode.value = mode; this.composite.uniforms.progress.value = progress; this.composite.uniforms.fade.value = fade; this.composite.uniforms.vignette.value = this.vignette;
    return shot;
  }
  private applyCamera(cam: THREE.PerspectiveCamera, s: CameraState) {
    cam.fov = s.fov; cam.aspect = this.width / this.height; cam.position.copy(s.position); cam.lookAt(s.target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  render() {
    const r = this.renderer;
    const mode = this.composite.uniforms.mode.value as number;
    r.shadowMap.needsUpdate = true;
    if (mode === 1 || mode === 4) { r.setRenderTarget(this.rtA); r.render(this.scene, this.prevCamera); }
    r.setRenderTarget(this.rtB); r.render(this.scene, this.camera);
    if (this.ink > 0 || this.style === 'soft') this.renderNormals();
    this.composite.uniforms.ink.value = this.ink;
    r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
  }
  /** View-space normals + depth of the same frame (shadows reused), for the ink lines. Outline hulls, particles and
   * transparent things are hidden: they would draw lines of their own. */
  private renderNormals() {
    const r = this.renderer, hidden: THREE.Object3D[] = [];
    this.scene.traverse(o => { if (!o.visible) return; const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (o.userData.outline || o.userData.noInk || (o as THREE.Points).isPoints || (m && (m as THREE.Material).transparent)) { o.visible = false; hidden.push(o); } });
    const bg = this.scene.background, fog = this.scene.fog;
    this.scene.background = null; this.scene.fog = null; this.scene.overrideMaterial = this.normalMat;
    const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    r.setClearColor(0x8080ff, 1);
    r.setRenderTarget(this.rtN); r.clear(); r.render(this.scene, this.camera);
    r.setClearColor(cc, ca);
    this.scene.overrideMaterial = null; this.scene.background = bg; this.scene.fog = fog;
    for (const o of hidden) o.visible = true;
    this.composite.uniforms.cNear.value = this.camera.near; this.composite.uniforms.cFar.value = this.camera.far;
    this.composite.uniforms.focal.value = 0.5 / Math.tan((this.camera.fov * Math.PI) / 360);
  }
  /** Debug/QA info for the current frame. */
  info() { return { renderer: this.renderer.getContext().getParameter(this.renderer.getContext().RENDERER), calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
  dispose() { this.clear(); this.rtA.dispose(); this.rtB.dispose(); this.rtN.dispose(); this.renderer.dispose(); }
}
