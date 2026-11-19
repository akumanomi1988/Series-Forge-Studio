/** Procedural toon environments (rooms and exteriors) from environment.json v2. */
import * as THREE from 'three';
import type { EnvironmentV2 } from '../engine/schema.ts';
import { toon, withOutline, shade } from './toon.ts';
import { noise1 } from '../engine/math.ts';

export interface EnvVisual { group: THREE.Group; lights: { light: THREE.Light; base: number; flicker: number; seed: number }[]; background: THREE.Color }

function floorTexture(env: EnvironmentV2): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const base = env.floor.color, alt = env.floor.secondaryColor ?? shade(base, 0.88);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  switch (env.floor.pattern) {
    case 'tiles': g.fillStyle = alt; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64); g.strokeStyle = shade(base, 0.7); g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); } break;
    case 'planks': g.strokeStyle = shade(base, 0.72); g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? alt : base; g.fillRect(0, i * 32, 256, 32); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke(); const off = (i * 97) % 256; g.beginPath(); g.moveTo(off, i * 32); g.lineTo(off, i * 32 + 32); g.stroke(); } break;
    case 'concrete': for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + ((i * 13) % 7) * 0.006})`; const x = (i * 73) % 256, y = (i * 151) % 256; g.fillRect(x, y, 3 + (i % 5), 3 + (i % 3)); } g.strokeStyle = shade(base, 0.75); g.lineWidth = 3; g.strokeRect(0, 0, 256, 256); break;
    case 'grass': for (let i = 0; i < 600; i++) { g.fillStyle = i % 2 ? alt : shade(base, 1.08); g.fillRect((i * 37) % 256, (i * 91) % 256, 2, 6); } break;
    case 'asphalt': for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + (i % 4) * 0.01})`; g.fillRect((i * 53) % 256, (i * 29) % 256, 2, 2); } break;
    default: break;
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function buildEnvironment(env: EnvironmentV2): EnvVisual {
  const group = new THREE.Group();
  const [W, H, D] = env.size;
  const lights: EnvVisual['lights'] = [];
  // floor
  const tex = floorTexture(env);
  if (tex) tex.repeat.set(W / 1.2, D / 1.2);
  const floorMat = new THREE.MeshToonMaterial({ color: tex ? '#ffffff' : env.floor.color, map: tex ?? null, gradientMap: (toon('#fff') as THREE.MeshToonMaterial).gradientMap });
  const extent = env.kind === 'exterior' ? 4 : 1;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * extent, D * extent), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor';
  if (tex && extent > 1) tex.repeat.set(W * extent / 1.2, D * extent / 1.2);
  group.add(floor);
  if (env.kind === 'room') {
    const wallMat = toon(env.walls.color), trim = toon(env.walls.trimColor);
    const T = 0.12;
    const wallSpec = { back: { len: W, pos: (o: number, y: number) => new THREE.Vector3(o, y, -D / 2), rotY: 0 }, left: { len: D, pos: (o: number, y: number) => new THREE.Vector3(-W / 2, y, o), rotY: Math.PI / 2 }, right: { len: D, pos: (o: number, y: number) => new THREE.Vector3(W / 2, y, -o), rotY: -Math.PI / 2 } } as const;
    for (const side of env.walls.sides) {
      const spec = wallSpec[side];
      const holes = env.openings.filter(o => o.wall === side).sort((a, b) => a.offset - b.offset);
      // build wall from slabs around openings
      let cursor = -spec.len / 2;
      const slab = (x0: number, x1: number, y0: number, y1: number) => { if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return; const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, T), wallMat); m.position.copy(spec.pos((x0 + x1) / 2, (y0 + y1) / 2)); m.rotation.y = spec.rotY; m.receiveShadow = true; group.add(m); };
      for (const o of holes) {
        const a = o.offset - o.width / 2, b = o.offset + o.width / 2;
        slab(cursor, a, 0, H);
        slab(a, b, o.sill + o.height, H);
        if (o.sill > 0) slab(a, b, 0, o.sill);
        // frame + glow
        const frame = new THREE.Mesh(new THREE.BoxGeometry(o.width + 0.1, o.height + 0.1, T * 0.6), trim); frame.position.copy(spec.pos(o.offset, o.sill + o.height / 2)); frame.rotation.y = spec.rotY; frame.scale.z = 1.2;
        const inner = new THREE.Mesh(new THREE.BoxGeometry(o.width, o.height, T * 0.7), toon('#000000')); inner.position.copy(frame.position); inner.rotation.y = spec.rotY;
        if (o.type === 'window') {
          const glass = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.height), new THREE.MeshBasicMaterial({ color: o.glow ?? '#8fc6ff' }));
          glass.position.copy(spec.pos(o.offset, o.sill + o.height / 2)); glass.rotation.y = spec.rotY; group.add(glass);
          const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, o.height, 0.06), trim); mullion.position.copy(glass.position); mullion.rotation.y = spec.rotY; group.add(mullion);
          const mull2 = new THREE.Mesh(new THREE.BoxGeometry(o.width, 0.05, 0.06), trim); mull2.position.copy(glass.position); mull2.rotation.y = spec.rotY; group.add(mull2);
        } else {
          const dark = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.height), new THREE.MeshBasicMaterial({ color: o.glow ?? '#11161d' }));
          dark.position.copy(spec.pos(o.offset, o.sill + o.height / 2)); dark.position.add(new THREE.Vector3(0, 0, 0)); dark.rotation.y = spec.rotY;
          const back = dark.position.clone().add(new THREE.Vector3(0, 0, -0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotY)); dark.position.copy(back); group.add(dark);
        }
        // frame as 3 thin bars (not a full box covering the hole)
        for (const [w, h, dx, dy] of [[0.08, o.height + 0.08, -o.width / 2 - 0.04, 0], [0.08, o.height + 0.08, o.width / 2 + 0.04, 0], [o.width + 0.16, 0.08, 0, o.height / 2 + 0.04]] as const) { const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, T * 1.3), trim); bar.position.copy(spec.pos(o.offset + dx, o.sill + o.height / 2 + dy)); bar.rotation.y = spec.rotY; group.add(withOutline(bar, 0.006)); }
        cursor = b;
      }
      slab(cursor, spec.len / 2, 0, H);
      // baseboard and panel line
      const base = new THREE.Mesh(new THREE.BoxGeometry(spec.len, 0.14, T * 1.4), trim); base.position.copy(spec.pos(0, 0.07)); base.rotation.y = spec.rotY; group.add(base);
      if (env.walls.panel) { const band = new THREE.Mesh(new THREE.BoxGeometry(spec.len, 0.06, T * 1.3), trim); band.position.copy(spec.pos(0, 1.15)); band.rotation.y = spec.rotY; group.add(band); const lower = new THREE.Mesh(new THREE.BoxGeometry(spec.len, 1.12, T * 1.05), toon(shade(env.walls.color, 0.85))); lower.position.copy(spec.pos(0, 0.58)); lower.rotation.y = spec.rotY; lower.receiveShadow = true; group.add(lower); }
    }
    // decor
    for (const dcor of env.decor) {
      const spec = wallSpec[dcor.wall];
      const inward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotY);
      const at = (dz: number) => spec.pos(dcor.offset, dcor.height).add(inward.clone().multiplyScalar(T / 2 + dz));
      let m: THREE.Object3D;
      switch (dcor.type) {
        case 'poster': { m = new THREE.Mesh(new THREE.BoxGeometry(dcor.width, dcor.width * 1.35, 0.01), toon(dcor.color)); const stripe = new THREE.Mesh(new THREE.BoxGeometry(dcor.width * 0.8, dcor.width * 0.15, 0.012), toon('#f4eee0')); stripe.position.y = dcor.width * 0.4; m.add(stripe); m.position.copy(at(0.01)); break; }
        case 'sign': { m = new THREE.Mesh(new THREE.BoxGeometry(dcor.width, dcor.width * 0.3, 0.03), toon(dcor.color, { emissive: dcor.color, emissiveIntensity: 0.6 })); m.position.copy(at(0.02)); break; }
        case 'clock': { m = new THREE.Mesh(new THREE.CylinderGeometry(dcor.width / 2, dcor.width / 2, 0.04, 24), toon('#f4eee0')); m.rotation.x = Math.PI / 2; const hand = new THREE.Mesh(new THREE.BoxGeometry(0.01, dcor.width * 0.35, 0.01), toon('#222')); hand.position.set(0, 0.03, -dcor.width * 0.12); hand.rotation.x = -Math.PI / 2; m.add(hand); m.position.copy(at(0.02)); break; }
        case 'pipe': { m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, dcor.width, 12), toon(dcor.color)); m.rotation.z = Math.PI / 2; m.position.copy(at(0.08)); break; }
        case 'vent': { m = new THREE.Mesh(new THREE.BoxGeometry(dcor.width, dcor.width * 0.5, 0.05), toon(shade(env.walls.color, 0.7))); for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(dcor.width * 0.9, 0.015, 0.06), toon('#20262d')); s.position.y = -dcor.width * 0.18 + i * dcor.width * 0.12; m.add(s); } m.position.copy(at(0.03)); break; }
        case 'pegboard': { m = new THREE.Mesh(new THREE.BoxGeometry(dcor.width, dcor.width * 0.6, 0.02), toon(dcor.color)); const tools = ['#a7b0ba', '#c0392b', '#e8a33d', '#a7b0ba']; tools.forEach((c, i) => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, dcor.width * 0.3, 0.02), toon(c)); t.position.set(-dcor.width * 0.35 + i * dcor.width * 0.23, 0, 0.02); t.rotation.z = (i % 2 ? 0.3 : -0.2); m.add(t); }); m.position.copy(at(0.02)); break; }
        case 'shelf-boxes': { m = new THREE.Group(); const board = new THREE.Mesh(new THREE.BoxGeometry(dcor.width, 0.04, 0.3), toon('#6d5640')); m.add(board); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18 + i * 0.03, 0.22), toon(['#c0392b', '#2980b9', '#d4a056'][i])); b.position.set(-dcor.width / 3 + i * dcor.width / 3, 0.11 + i * 0.015, 0); m.add(withOutline(b, 0.006)); } m.position.copy(at(0.15)); break; }
        default: { m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, dcor.width, 8), toon(dcor.color)); m.rotation.z = Math.PI / 2; m.position.copy(at(0.04)); }
      }
      m.rotation.y += spec.rotY; group.add(m);
    }
  } else {
    // exterior: distant ground fades into fog / sky gradient handles the horizon
  }
  // lights
  const hemi = new THREE.HemisphereLight(new THREE.Color(env.ambient.sky), new THREE.Color(env.ambient.ground), env.ambient.intensity); group.add(hemi);
  const lightList = env.lights.length ? env.lights : [{ type: 'key' as const, position: [-3, 6, 5] as [number, number, number], color: '#fff3e0', intensity: 2.2, castShadow: true, flicker: 0 }, { type: 'fill' as const, position: [4, 3, 4] as [number, number, number], color: '#bcd4ff', intensity: 0.6, castShadow: false, flicker: 0 }];
  lightList.forEach((l, i) => {
    let light: THREE.Light;
    if (l.type === 'point') { const p = new THREE.PointLight(new THREE.Color(l.color), l.intensity, ('distance' in l && l.distance) || 10, 1.5); p.position.set(...l.position); light = p; }
    else if (l.type === 'spot') { const s = new THREE.SpotLight(new THREE.Color(l.color), l.intensity, ('distance' in l && l.distance) || 15, Math.PI / 5, 0.4, 1.2); s.position.set(...l.position); s.target.position.set(...(('target' in l && l.target) || [0, 0, 0])); group.add(s.target); light = s; }
    else { const d = new THREE.DirectionalLight(new THREE.Color(l.color), l.intensity); d.position.set(...l.position); d.target.position.set(...(('target' in l && l.target) || [0, 0.8, 0])); group.add(d.target); light = d; }
    if (l.castShadow && (light as THREE.DirectionalLight).shadow) {
      light.castShadow = true; const sh = (light as THREE.DirectionalLight).shadow; sh.mapSize.set(2048, 2048); sh.bias = -0.0004; sh.normalBias = 0.02;
      const cam = sh.camera as THREE.OrthographicCamera; if (cam.isOrthographicCamera) { const r = Math.max(W, D) * 0.65; cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 0.5; cam.far = 40; }
    }
    group.add(light); lights.push({ light, base: l.intensity, flicker: l.flicker ?? 0, seed: i * 101 + 7 });
  });
  if (env.fog) group.userData.fog = new THREE.Fog(new THREE.Color(env.fog.color), env.fog.near, env.fog.far);
  return { group, lights, background: new THREE.Color(env.sky.bottom) };
}
export function updateEnvironmentLights(v: EnvVisual, t: number): void {
  for (const l of v.lights) if (l.flicker > 0) { const n = noise1(l.seed, t * 9) * 0.5 + noise1(l.seed + 1, t * 31) * 0.5; const drop = n < -0.55 ? 0.25 : 1; l.light.intensity = l.base * (1 - l.flicker * 0.25 * (1 - n)) * (l.flicker > 0.5 ? drop : 1); }
}
