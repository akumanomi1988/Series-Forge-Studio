/** Procedural prop meshes. Joints become pivot groups named after the joint id; anchors come from engine/props.ts. */
import * as THREE from 'three';
import type { PropGeometry } from '../engine/schema.ts';
import { num, str, bool, withDefaults } from '../engine/props.ts';
import { toon, flat, withOutline, shade } from './toon.ts';
import { primitiveMesh } from './character.ts';
import { DEG } from '../engine/math.ts';

export interface PropVisual { group: THREE.Group; joints: Map<string, { pivot: THREE.Group; axis: 'x' | 'y' | 'z' }>; parts: Map<string, THREE.Mesh>; lights: THREE.Light[] }

export function buildProp(raw: PropGeometry): PropVisual {
  const geo = withDefaults(raw);
  const group = new THREE.Group();
  const joints = new Map<string, { pivot: THREE.Group; axis: 'x' | 'y' | 'z' }>();
  const parts = new Map<string, THREE.Mesh>();
  const lights: THREE.Light[] = [];
  const ow = geo.outlineWidth;
  for (const [id, j] of Object.entries(geo.joints)) { const p = new THREE.Group(); p.name = 'joint:' + id; p.position.set(...j.position); group.add(p); joints.set(id, { pivot: p, axis: j.axis }); }
  const parentFor = (pivot?: string) => (pivot && joints.get(pivot)?.pivot) || group;
  /** add a mesh at prop-space position (converted into the pivot's local space) */
  const add = (name: string, g: THREE.BufferGeometry, color: string, pos: [number, number, number], opts: { pivot?: string; rot?: [number, number, number]; emissive?: string; ei?: number; outline?: boolean; mat?: THREE.Material } = {}) => {
    const m = new THREE.Mesh(g, opts.mat ?? toon(color, opts.emissive ? { emissive: opts.emissive, emissiveIntensity: opts.ei ?? 1 } : {}));
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    const parent = parentFor(opts.pivot);
    m.position.set(...pos); if (parent !== group) m.position.sub(parent.position);
    if (opts.rot) m.rotation.set(opts.rot[0] * DEG, opts.rot[1] * DEG, opts.rot[2] * DEG);
    parent.add(opts.outline === false ? m : withOutline(m, ow));
    parts.set(name, m);
    return m;
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const rbox = (w: number, h: number, d: number, r = 0.35) => { const g = new THREE.SphereGeometry(1, 20, 14); const pa = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pa.count; i++) { const k = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), r); pa.setXYZ(i, k(pa.getX(i)) * w / 2, k(pa.getY(i)) * h / 2, k(pa.getZ(i)) * d / 2); } g.computeVertexNormals(); return g; };
  const cyl = (r: number, h: number, seg = 20, r2 = r) => new THREE.CylinderGeometry(r, r2, h, seg);
  const color = str(geo, 'color', '#9aa3ad'), accent = str(geo, 'accent', '#e8a33d');
  switch (geo.generator) {
    case 'workbench': case 'table': {
      const w = num(geo, 'width', 1.8), d = num(geo, 'depth', 0.8), h = num(geo, 'height', geo.generator === 'workbench' ? 0.92 : 0.76);
      const top = str(geo, 'topColor', geo.generator === 'workbench' ? '#9b7552' : color), legs = str(geo, 'legColor', '#4a5560');
      add('top', box(w, 0.06, d), top, [0, h - 0.03, 0]);
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) add(`leg${x}${z}`, box(0.06, h - 0.06, 0.06), legs, [x * (w / 2 - 0.06), (h - 0.06) / 2, z * (d / 2 - 0.06)]);
      if (geo.generator === 'workbench') {
        add('shelf', box(w - 0.12, 0.03, d - 0.12), shade(top, 0.8), [0, 0.18, 0]);
        add('drawer', box(0.5, 0.16, 0.04), shade(top, 0.9), [w / 2 - 0.4, h - 0.16, d / 2 - 0.01]);
        add('knob', new THREE.SphereGeometry(0.02, 8, 6), '#c9a640', [w / 2 - 0.4, h - 0.16, d / 2 + 0.02], { outline: false });
        add('vice', box(0.14, 0.1, 0.12), '#5b6b7b', [-w / 2 + 0.15, h + 0.05, d / 2 - 0.1]);
        add('clutter1', cyl(0.035, 0.12), '#c0392b', [w / 2 - 0.25, h + 0.06, -d / 4]);
        add('clutter2', box(0.22, 0.05, 0.14), '#34495e', [w / 2 - 0.55, h + 0.025, -d / 5], { rot: [0, 18, 0] });
      }
      break;
    }
    case 'robot': {
      const h = num(geo, 'height', 1.1), dmg = bool(geo, 'damaged', false), eye = str(geo, 'eyeColor', '#5ff0ff');
      add('base', cyl(h * 0.24, h * 0.12, 24, h * 0.27), shade(color, 0.6), [0, h * 0.06, 0]);
      for (const sx of [1, -1]) add(`tread${sx}`, rbox(h * 0.12, h * 0.14, h * 0.42, 0.3), '#2d3238', [sx * h * 0.22, h * 0.08, 0]);
      add('body', rbox(h * 0.44, h * 0.42, h * 0.38), color, [0, h * 0.38, 0]);
      add('belly', rbox(h * 0.36, h * 0.12, h * 0.32), shade(color, 0.85), [0, h * 0.17, 0]);
      add('panelFrame', box(h * 0.24, h * 0.16, h * 0.02), shade(color, 0.7), [0, h * 0.4, h * 0.19]);
      add('panel', box(h * 0.22, h * 0.15, h * 0.02), accent, [0, h * 0.42 + h * 0.075, h * 0.2], { pivot: 'panel' });
      if (dmg) {
        add('cavity', box(h * 0.2, h * 0.13, h * 0.01), '#14171c', [0, h * 0.4, h * 0.195], { outline: false });
        for (let i = 0; i < 3; i++) add(`wire${i}`, new THREE.TorusGeometry(h * 0.04, h * 0.007, 6, 12, Math.PI), ['#e74c3c', '#f1c40f', '#3498db'][i], [-h * 0.05 + i * h * 0.05, h * 0.38, h * 0.2], { rot: [0, 0, 180], outline: false });
        add('dent', new THREE.SphereGeometry(h * 0.05, 10, 8), shade(color, 0.7), [h * 0.18, h * 0.5, h * 0.12], { outline: false });
        add('scorch', new THREE.CircleGeometry(h * 0.07, 14), '#2a2a2a', [-h * 0.12, h * 0.52, h * 0.193], { outline: false, mat: flat('#30302e', { polygonOffset: 2 }) });
      }
      add('neck', cyl(h * 0.05, h * 0.08), '#4b525a', [0, h * 0.63, 0], { pivot: 'head' });
      add('head', rbox(h * 0.36, h * 0.24, h * 0.3), color, [0, h * 0.78, 0], { pivot: 'head' });
      add('visor', rbox(h * 0.3, h * 0.12, h * 0.04), '#1a2028', [0, h * 0.8, h * 0.145], { pivot: 'head' });
      for (const sx of [1, -1]) add(`eye${sx > 0 ? 'L' : 'R'}`, new THREE.CircleGeometry(h * 0.035, 16), eye, [sx * h * 0.07, h * 0.8, h * 0.168], { pivot: 'head', outline: false, mat: new THREE.MeshBasicMaterial({ color: dmg && sx < 0 ? '#3a4a50' : eye }) });
      add('antenna', cyl(h * 0.008, h * 0.14), '#4b525a', [h * 0.1, h * 0.96, -h * 0.05], { pivot: 'head', outline: false });
      add('antennaTip', new THREE.SphereGeometry(h * 0.02, 8, 6), accent, [h * 0.1, h * 1.03, -h * 0.05], { pivot: 'head', emissive: accent, ei: 0.6 });
      for (const [sx, j] of [[1, 'armL'], [-1, 'armR']] as const) {
        add(`shoulder${j}`, new THREE.SphereGeometry(h * 0.06, 12, 10), shade(color, 0.8), [sx * h * 0.27, h * 0.62, 0], { pivot: j });
        add(`upper${j}`, rbox(h * 0.07, h * 0.22, h * 0.07), color, [sx * h * 0.28, h * 0.5, 0], { pivot: j });
        add(`claw${j}`, new THREE.TorusGeometry(h * 0.035, h * 0.012, 6, 10, Math.PI * 1.4), '#4b525a', [sx * h * 0.28, h * 0.36, 0], { pivot: j, rot: [90, 0, 0] });
      }
      break;
    }
    case 'chair': case 'stool': case 'bench': case 'sofa': {
      const sh = num(geo, 'seatHeight', geo.generator === 'stool' ? 0.66 : 0.46), w = num(geo, 'width', geo.generator === 'bench' ? 1.4 : geo.generator === 'sofa' ? 1.8 : 0.48);
      if (geo.generator === 'stool') { add('seat', cyl(0.18, 0.05, 24), color, [0, sh - 0.025, 0]); for (let i = 0; i < 3; i++) { const a = i * 2.094; add(`leg${i}`, cyl(0.018, sh - 0.05, 8), '#4a5560', [Math.sin(a) * 0.12, (sh - 0.05) / 2, Math.cos(a) * 0.12], { rot: [Math.cos(a) * 6, 0, -Math.sin(a) * 6] }); } add('ring', new THREE.TorusGeometry(0.13, 0.01, 6, 20), '#4a5560', [0, 0.22, 0], { rot: [90, 0, 0], outline: false }); }
      else { const d = geo.generator === 'sofa' ? 0.8 : 0.45; add('seat', rbox(w, 0.07, d, 0.25), color, [0, sh - 0.035, 0]); add('back', rbox(w, 0.42, 0.06, 0.25), color, [0, sh + 0.2, -d / 2 + 0.03], { rot: [-8, 0, 0] }); if (geo.generator === 'sofa') for (const sx of [1, -1]) add(`arm${sx}`, rbox(0.15, 0.3, d, 0.3), shade(color, 0.9), [sx * (w / 2 - 0.07), sh + 0.05, 0]); else for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) add(`leg${x}${z}`, cyl(0.02, sh - 0.07, 8), '#4a5560', [x * (w / 2 - 0.04), (sh - 0.07) / 2, z * (d / 2 - 0.04)]); }
      break;
    }
    case 'door': {
      const w = num(geo, 'width', 0.95), h = num(geo, 'height', 2.1), frame = str(geo, 'frameColor', '#3b4652');
      add('frameL', box(0.08, h + 0.08, 0.14), frame, [-w / 2 - 0.04, (h + 0.08) / 2, 0]);
      add('frameR', box(0.08, h + 0.08, 0.14), frame, [w / 2 + 0.04, (h + 0.08) / 2, 0]);
      add('frameT', box(w + 0.16, 0.08, 0.14), frame, [0, h + 0.04, 0]);
      add('leaf', box(w, h, 0.05), color, [0, h / 2, 0], { pivot: 'leaf' });
      add('window', box(w * 0.5, h * 0.18, 0.055), '#9ad4f5', [0, h * 0.78, 0], { pivot: 'leaf', emissive: '#9ad4f5', ei: 0.4 });
      add('panelLow', box(w * 0.7, h * 0.3, 0.056), shade(color, 0.85), [0, h * 0.25, 0], { pivot: 'leaf' });
      add('handle', cyl(0.018, 0.12, 10), '#d0d4d8', [w * 0.85 - w / 2, h * 0.47, 0.05], { pivot: 'leaf', rot: [0, 0, 90] });
      add('sign', box(w * 0.4, 0.08, 0.052), accent, [0, h * 0.62, 0], { pivot: 'leaf', emissive: accent, ei: 0.3 });
      break;
    }
    case 'shelf': {
      const w = num(geo, 'width', 1.2), h = num(geo, 'height', 1.9), d = num(geo, 'depth', 0.4);
      for (const sx of [1, -1]) add(`side${sx}`, box(0.04, h, d), color, [sx * (w / 2 - 0.02), h / 2, 0]);
      const n = 4;
      for (let i = 0; i < n; i++) {
        const y = 0.1 + i * (h - 0.15) / (n - 1);
        add(`board${i}`, box(w, 0.03, d), shade(color, 0.92), [0, y, 0]);
        for (let k = 0; k < 3; k++) { const bw = 0.15 + ((i * 7 + k * 3) % 5) * 0.03, bh = 0.12 + ((i + k) % 3) * 0.06; if (i === n - 1) continue; add(`item${i}${k}`, box(bw, bh, d * 0.7), ['#c0392b', '#2980b9', '#e8a33d', '#27ae60', '#7f8c8d'][(i * 3 + k) % 5], [-w / 2 + 0.2 + k * w * 0.3, y + bh / 2 + 0.015, 0]); }
      }
      break;
    }
    case 'toolbox': {
      const h = num(geo, 'height', 0.22);
      add('box', box(0.5, h, 0.24), color === '#9aa3ad' ? '#c0392b' : color, [0, h / 2, 0]);
      add('lid', box(0.52, 0.04, 0.26), shade(color === '#9aa3ad' ? '#c0392b' : color, 0.85), [0, h + 0.02, 0], { pivot: 'lid' });
      add('handle', new THREE.TorusGeometry(0.08, 0.012, 6, 16, Math.PI), '#2c2c2c', [0, h + 0.04, 0], { pivot: 'lid', outline: false });
      break;
    }
    case 'crate': { const s = num(geo, 'size', 0.5); add('crate', box(s, s, s), color === '#9aa3ad' ? '#a07a4f' : color, [0, s / 2, 0]); for (const y of [0.15, 0.85]) add(`slat${y}`, box(s * 1.02, s * 0.08, s * 1.02), '#7d5c3a', [0, s * y, 0], { outline: false }); break; }
    case 'barrel': { const h = num(geo, 'height', 0.9); add('barrel', cyl(0.3, h, 24), color === '#9aa3ad' ? '#2e6e8e' : color, [0, h / 2, 0]); for (const y of [0.2, 0.8]) add(`hoop${y}`, new THREE.TorusGeometry(0.305, 0.015, 6, 24), '#3a3f45', [0, h * y, 0], { rot: [90, 0, 0], outline: false }); break; }
    case 'mug': { add('cup', cyl(0.04, 0.1, 18, 0.037), color === '#9aa3ad' ? '#e8e3d8' : color, [0, 0.05, 0]); add('handle', new THREE.TorusGeometry(0.025, 0.008, 6, 12), color === '#9aa3ad' ? '#e8e3d8' : color, [0.045, 0.05, 0], { outline: false }); add('coffee', new THREE.CircleGeometry(0.036, 16), '#4a2c1a', [0, 0.098, 0], { rot: [-90, 0, 0], outline: false }); break; }
    case 'wrench': { add('handle', box(0.025, 0.2, 0.012), '#a7b0ba', [0, 0, 0]); add('jaw', new THREE.TorusGeometry(0.025, 0.012, 6, 12, Math.PI * 1.5), '#a7b0ba', [0, 0.11, 0], { rot: [0, 0, 45] }); break; }
    case 'component': {
      const r = num(geo, 'radius', 0.035), len = num(geo, 'length', 0.13), glow = str(geo, 'glow', '#ff5a3c');
      add('body', cyl(r, len, 16), color === '#9aa3ad' ? '#cfd6dc' : color, [0, 0, 0], { rot: [0, 0, 90] });
      add('core', cyl(r * 1.08, len * 0.3, 16), glow, [0, 0, 0], { rot: [0, 0, 90], emissive: glow, ei: 1.2 });
      for (const sx of [1, -1]) add(`cap${sx}`, cyl(r * 0.7, len * 0.12, 12), '#7b8590', [sx * len * 0.56, 0, 0], { rot: [0, 0, 90] });
      add('burn', new THREE.SphereGeometry(r * 0.5, 8, 6), '#1d1b1a', [len * 0.2, r * 0.7, r * 0.5], { outline: false });
      break;
    }
    case 'monitor': case 'console': {
      const h = num(geo, 'height', 1.1), sc = str(geo, 'screenColor', '#39d0ff');
      add('stand', box(0.7, h * 0.6, 0.45), color, [0, h * 0.3, 0]);
      add('screen', box(0.8, 0.5, 0.06), '#1d232b', [0, h * 0.75, 0.05], { rot: [-12, 0, 0] });
      add('display', new THREE.PlaneGeometry(0.72, 0.42), sc, [0, h * 0.75, 0.085], { rot: [-12, 0, 0], outline: false, mat: new THREE.MeshBasicMaterial({ color: sc }) });
      for (let i = 0; i < 4; i++) add(`btn${i}`, cyl(0.025, 0.02, 10), ['#e74c3c', '#2ecc71', '#f1c40f', '#3498db'][i], [-0.2 + i * 0.13, h * 0.6 + 0.01, 0.15], { outline: false, emissive: ['#e74c3c', '#2ecc71', '#f1c40f', '#3498db'][i], ei: 0.6 });
      break;
    }
    case 'lamp': {
      const y = num(geo, 'height', 2.6), lc = str(geo, 'lightColor', '#ffd9a0');
      add('cord', cyl(0.006, 0.6, 6), '#222', [0, y + 0.3, 0], { outline: false });
      add('shade', new THREE.ConeGeometry(0.22, 0.2, 20, 1, true), color === '#9aa3ad' ? '#2f3b46' : color, [0, y, 0], { mat: toon(color === '#9aa3ad' ? '#2f3b46' : color, { side: THREE.DoubleSide }) });
      add('bulb', new THREE.SphereGeometry(0.06, 12, 8), lc, [0, y - 0.08, 0], { outline: false, mat: new THREE.MeshBasicMaterial({ color: lc }) });
      const light = new THREE.PointLight(new THREE.Color(lc), num(geo, 'intensity', 3), num(geo, 'distance', 7), 1.6); light.position.set(0, y - 0.15, 0); group.add(light); lights.push(light);
      break;
    }
    case 'plant': { add('pot', cyl(0.16, 0.28, 16, 0.12), '#b5653a', [0, 0.14, 0]); for (let i = 0; i < 7; i++) { const a = i * 0.9; add(`leaf${i}`, new THREE.SphereGeometry(1, 10, 8), '#3f8f4f', [Math.sin(a) * 0.1, 0.45 + (i % 3) * 0.1, Math.cos(a) * 0.1], { rot: [Math.cos(a) * 30, 0, -Math.sin(a) * 30] }).scale.set(0.06, 0.18, 0.03); } break; }
    case 'pipe': { const l = num(geo, 'length', 3); add('pipe', cyl(0.06, l, 14), color, [0, 0, 0], { rot: [0, 0, 90] }); for (const x of [-l / 2 + 0.2, l / 2 - 0.2]) add(`flange${x}`, cyl(0.085, 0.05, 14), shade(color, 0.8), [x, 0, 0], { rot: [0, 0, 90] }); break; }
    case 'tree': { const h = num(geo, 'height', 4); add('trunk', cyl(0.12, h * 0.45, 10, 0.18), '#6b4a2f', [0, h * 0.22, 0]); for (let i = 0; i < 3; i++) add(`crown${i}`, new THREE.ConeGeometry(h * (0.32 - i * 0.07), h * 0.38, 12), '#3f7f4a', [0, h * (0.5 + i * 0.17), 0]); break; }
    case 'building': { const w = num(geo, 'width', 6), h = num(geo, 'height', 9), d = num(geo, 'depth', 5); add('mass', box(w, h, d), color, [0, h / 2, 0]); for (let fy = 1; fy < h / 2.2; fy++) for (let fx = 0; fx < Math.floor(w / 1.4); fx++) add(`win${fx}_${fy}`, box(0.7, 0.9, 0.05), (fx + fy) % 3 ? '#2b3a4a' : '#ffd98a', [-w / 2 + 0.9 + fx * 1.4, fy * 2.2, d / 2 + 0.01], { outline: false, emissive: (fx + fy) % 3 ? undefined : '#ffd98a', ei: 0.7 }); break; }
    case 'streetlamp': { const h = num(geo, 'height', 4); add('pole', cyl(0.06, h, 10), '#2c3440', [0, h / 2, 0]); add('head', box(0.5, 0.1, 0.25), '#2c3440', [0.2, h, 0]); const l = new THREE.PointLight('#ffdca0', 4, 10); l.position.set(0.3, h - 0.15, 0); group.add(l); lights.push(l); add('bulb', box(0.3, 0.04, 0.18), '#ffdca0', [0.25, h - 0.06, 0], { outline: false, mat: new THREE.MeshBasicMaterial({ color: '#ffdca0' }) }); break; }
    case 'fence': { const l = num(geo, 'length', 4); for (let x = -l / 2; x <= l / 2; x += 0.5) add(`post${x}`, box(0.08, 1, 0.08), color, [x, 0.5, 0]); add('rail', box(l, 0.08, 0.05), color, [0, 0.8, 0]); break; }
    case 'car': { add('body', rbox(1.8, 0.6, 4, 0.3), color, [0, 0.55, 0]); add('cabin', rbox(1.6, 0.55, 2, 0.35), '#9ad4f5', [0, 1.05, -0.2]); for (const [x, z] of [[1, 1.3], [-1, 1.3], [1, -1.3], [-1, -1.3]]) add(`wheel${x}${z}`, cyl(0.34, 0.25, 16), '#1d1d1d', [x * 0.85, 0.34, z], { rot: [0, 0, 90] }); break; }
    case 'bed': { add('frame', rbox(1.5, 0.45, 2.1, 0.3), color, [0, 0.22, 0]); add('pillow', rbox(0.6, 0.15, 0.4, 0.4), '#f2f2f2', [0, 0.5, -0.75]); add('blanket', rbox(1.45, 0.08, 1.3, 0.3), accent, [0, 0.48, 0.3]); break; }
    default: break;
  }
  for (const p of geo.parts) { const m = primitiveMesh(p); const parent = parentFor(p.pivot); if (parent !== group) m.position.sub(parent.position); parent.add(m); parts.set(p.id, m); }
  // any prop can emit light (candles, neon, practical lamps): params.lightIntensity / lightColor / lightY / lightDistance
  if (num(geo, 'lightIntensity', 0) > 0 && geo.generator !== 'lamp' && geo.generator !== 'streetlamp') {
    const l = new THREE.PointLight(new THREE.Color(str(geo, 'lightColor', '#ffcf8a')), num(geo, 'lightIntensity', 1), num(geo, 'lightDistance', 3), 1.8);
    l.position.set(0, num(geo, 'lightY', 0.2), 0); group.add(l); lights.push(l);
  }
  return { group, joints, parts, lights };
}
export function applyJoints(v: PropVisual, values: Record<string, number>): void {
  for (const [id, deg] of Object.entries(values)) { const j = v.joints.get(id); if (j) { j.pivot.rotation.set(0, 0, 0); j.pivot.rotation[j.axis] = deg * DEG; } }
}
