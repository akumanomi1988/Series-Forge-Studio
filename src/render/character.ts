/** Procedural humanoid toon character: skinned body tubes (clothing as colour regions), rigid hands/shoes,
 * head with facial rig (eyes, lids, brows, dynamic mouth), hair, beard and accessories.
 * Built from geometry.json (parameters only) on top of the engine RigInstance bones. */
import * as THREE from 'three';
import type { CharacterGeometry } from '../engine/schema.ts';
import type { RigInstance, ActorPose } from '../engine/pose.ts';
import type { FaceState } from '../engine/face.ts';
import { toon, flat, withOutline, shade, mix } from './toon.ts';
import type { NecklineSpec } from './toon.ts';
import { clamp, lerp, DEG, smoothstep } from '../engine/math.ts';

type W = [string, number][];
/** Box with rounded edges (superellipsoid): no hard corners on soles and small clothing parts. */
function roundedBox(w: number, h: number, d: number, r = 0.3): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 24, 16); const pa = g.attributes.position as THREE.BufferAttribute;
  const k = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), r);
  for (let i = 0; i < pa.count; i++) pa.setXYZ(i, k(pa.getX(i)) * w / 2, k(pa.getY(i)) * h / 2, k(pa.getZ(i)) * d / 2);
  g.computeVertexNormals(); return g;
}
interface Ring {
  y: number; rx: number; rz: number; x: number; z: number; color: string; w: W; gloss?: number;
  /** depth below the neck base (torso only: per-pixel neckline) */ neck?: number;
  /** back half depth (defaults to rz): a flatter back, a rounder seat */ rzb?: number;
  /** radial volume of the two bust lobes (front, ±0.6 rad) and of the two glute lobes (back), metres */ bust?: number; glute?: number;
  /** angular width of the bust lobes (narrow = breasts, wide = pectorals) */ bw?: number;
  /** radial cloth folds: amplitude (m) and count around the ring */ fold?: number; folds?: number;
  /** skirt cloth: share of each vertex skinned to the thigh on its side (0 = follows the hips) */ legBlend?: number;
}
/** Specular strength of each fabric. Characters are matte now (toon shadows only); kept for the schema. */
export const FABRIC_GLOSS: Record<string, number> = { matte: 0, satin: 0.55, silk: 0.75, leather: 0.45, sequin: 0.95 };

const RING_KEYS = ['rx', 'rz', 'x', 'z', 'rzb', 'bust', 'glute', 'fold'] as const;
const ringVal = (r: Ring, k: typeof RING_KEYS[number]) => k === 'rzb' ? (r.rzb ?? r.rz) : (r[k] ?? 0);
/** Inserts Catmull-Rom midpoints between rings of the same colour so profiles read as curves, not polygons. */
function smoothRings(input: Ring[], passes = 1): Ring[] {
  let rs = input;
  for (let p = 0; p < passes; p++) {
    const out: Ring[] = [];
    for (let j = 0; j < rs.length; j++) {
      const r = rs[j], n = rs[j + 1];
      out.push(r);
      if (!n || n.color !== r.color || Math.abs(n.y - r.y) < 0.006) continue;
      const a = rs[j - 1] ?? r, b = rs[j + 2] ?? n;
      const cr = (k: typeof RING_KEYS[number]) => (-ringVal(a, k) + 9 * ringVal(r, k) + 9 * ringVal(n, k) - ringVal(b, k)) / 16;
      const wm = new Map<string, number>(); for (const [bn, v] of [...r.w, ...n.w]) wm.set(bn, (wm.get(bn) ?? 0) + v / 2);
      const m: Ring = { y: (r.y + n.y) / 2, rx: Math.max(cr('rx'), Math.min(r.rx, n.rx) * 0.9), rz: Math.max(cr('rz'), Math.min(r.rz, n.rz) * 0.9), x: cr('x'), z: cr('z'), color: r.color, w: [...wm], gloss: ((r.gloss ?? 0) + (n.gloss ?? 0)) / 2, neck: r.neck !== undefined && n.neck !== undefined ? (r.neck + n.neck) / 2 : r.neck };
      if (r.rzb !== undefined || n.rzb !== undefined) m.rzb = Math.max(cr('rzb'), Math.min(ringVal(r, 'rzb'), ringVal(n, 'rzb')) * 0.9);
      if (r.bust || n.bust) m.bust = Math.max(0, cr('bust'));
      if (r.glute || n.glute) m.glute = Math.max(0, cr('glute'));
      if (r.fold || n.fold) { m.fold = Math.max(0, cr('fold')); m.folds = r.folds ?? n.folds; }
      if (r.bw || n.bw) m.bw = r.bw ?? n.bw;
      if (r.legBlend !== undefined || n.legBlend !== undefined) m.legBlend = ((r.legBlend ?? 0) + (n.legBlend ?? 0)) / 2;
      out.push(m);
    }
    rs = out;
  }
  return rs;
}
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const lobe = (a: number, c: number, sg: number) => Math.exp(-((wrapA(a - c) / sg) ** 2));
/** Surface point of a ring at angle a (a = 0 is the front, +x is the character's left). */
function ringPoint(r: Ring, a: number): [number, number] {
  const sa = Math.sin(a), ca = Math.cos(a);
  let px = sa * r.rx, pz = ca * (ca >= 0 ? r.rz : (r.rzb ?? r.rz));
  const bw = r.bw ?? 0.36;
  const bump = (r.bust ?? 0) * (lobe(a, 0.6, bw) + lobe(a, -0.6, bw)) + (r.glute ?? 0) * (lobe(a, Math.PI - 0.5, 0.45) + lobe(a, Math.PI + 0.5, 0.45)) + (r.fold ?? 0) * Math.sin((r.folds ?? 9) * a);
  px += sa * bump; pz += ca * bump;
  return [r.x + px, r.z + pz];
}
interface TubeOpts { seg?: number; capTop?: boolean; capBottom?: boolean; arc?: [number, number]; passes?: number }
function tubeGeometry(raw: Ring[], boneIndex: Map<string, number>, seg = 18, capTop = true, capBottom = true, opts: TubeOpts = {}): THREE.BufferGeometry {
  const input = smoothRings(raw, opts.passes ?? 2);
  const [a0, a1] = opts.arc ?? [0, Math.PI * 2];
  const closed = !opts.arc;
  const rings: Ring[] = [];
  for (let j = 0; j < input.length; j++) {
    const r = input[j], n = input[j + 1];
    rings.push(r);
    if (n && n.color !== r.color && Math.abs(n.y - r.y) > 0.004) {
      const m = (k: number): Ring => ({ ...(k > 0 ? r : n), y: lerp(r.y, n.y, 0.5) + k, rx: lerp(r.rx, n.rx, 0.5), rz: lerp(r.rz, n.rz, 0.5), rzb: lerp(ringVal(r, 'rzb'), ringVal(n, 'rzb'), 0.5), bust: lerp(r.bust ?? 0, n.bust ?? 0, 0.5), glute: lerp(r.glute ?? 0, n.glute ?? 0, 0.5), x: lerp(r.x, n.x, 0.5), z: lerp(r.z, n.z, 0.5), color: k > 0 ? r.color : n.color, w: k > 0 ? r.w : n.w });
      rings.push(m(0.0008), m(-0.0008));
    }
  }
  const pos: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [], idx: number[] = [], gl: number[] = [], nk: number[] = [];
  const hasNeck = input.some(r => r.neck !== undefined);
  const c = new THREE.Color();
  const pushV = (x: number, y: number, z: number, color: string, w: W, gloss = 0) => {
    pos.push(x, y, z); c.set(color); col.push(c.r, c.g, c.b); gl.push(gloss);
    const ws = [...w].sort((a, b) => b[1] - a[1]).slice(0, 4); const tot = ws.reduce((s, x) => s + x[1], 0) || 1;
    for (let k = 0; k < 4; k++) { si.push(ws[k] ? boneIndex.get(ws[k][0]) ?? 0 : 0); sw.push(ws[k] ? ws[k][1] / tot : 0); }
  };
  /** cloth that follows the thighs: blend the ring weights with the thigh on the vertex's side (more at the front) */
  const vw = (r: Ring, a: number): W => {
    if (!r.legBlend) return r.w;
    const k = r.legBlend * (0.55 + 0.45 * Math.cos(a)), sa = Math.sin(a);
    return [...r.w.map(([b, v]) => [b, v * (1 - k)] as [string, number]), ['leftThigh', k * (0.5 + 0.5 * sa)], ['rightThigh', k * (0.5 - 0.5 * sa)]];
  };
  for (const r of rings) for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * (i / seg); const [x, z] = ringPoint(r, a); pushV(x, r.y, z, r.color, vw(r, a), r.gloss ?? 0); if (hasNeck) nk.push(Math.sin(a), Math.cos(a), r.neck ?? -1); }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + seg + 1;
    // rings ordered top->bottom: wind so normals face outward
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const cap = (r: Ring, top: boolean) => {
    const center = pos.length / 3; pushV(r.x, r.y + (top ? r.rx * 0.35 : -r.rx * 0.35), r.z, r.color, r.w, r.gloss ?? 0); if (hasNeck) nk.push(0, -1, -1);
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * (i / seg); const [x, z] = ringPoint(r, a); pushV(x, r.y, z, r.color, vw(r, a), r.gloss ?? 0); if (hasNeck) nk.push(0, -1, -1); }
    for (let i = 0; i < seg; i++) top ? idx.push(center, base + i, base + i + 1) : idx.push(center, base + i + 1, base + i);
  };
  if (capTop && closed) cap(rings[0], true);
  if (capBottom && closed) cap(rings[rings.length - 1], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  if (gl.some(v => v > 0) || hasNeck) { g.setAttribute('gloss', new THREE.Float32BufferAttribute(gl, 1)); g.userData.gloss = true; }
  if (hasNeck) g.setAttribute('neck', new THREE.Float32BufferAttribute(nk, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the first and last column of a closed tube are the same points: share their normals (no seam line)
  if (closed) { const nr = g.attributes.normal as THREE.BufferAttribute; for (let j = 0; j < rings.length; j++) { const i0 = j * (seg + 1), i1 = i0 + seg; const v = new THREE.Vector3(nr.getX(i0) + nr.getX(i1), nr.getY(i0) + nr.getY(i1), nr.getZ(i0) + nr.getZ(i1)).normalize(); nr.setXYZ(i0, v.x, v.y, v.z); nr.setXYZ(i1, v.x, v.y, v.z); } }
  return g;
}
/** Monotone cubic interpolation (Fritsch–Carlson) through (xs ascending, ys). */
function pchip(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length, dx: number[] = [], m: number[] = [], t: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i]); m.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i])); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  return (x: number) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = dx[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * t[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * t[i + 1];
  };
}
/** Closed "slab" of hair: an outer and an inner surface along rings of arcs, joined at the sides, top and hem.
 * Lock grooves come from a radial ripple; the hem is cut into pointed locks. Vertex colours darken the inside. */
function hairShell(rings: { y: number; rx: number; rz: number; z: number; x?: number }[], arc: [number, number], thick: number, locks: number, tip: number, color: string, seg = 56): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const cOut = new THREE.Color(color), cIn = new THREE.Color(color).multiplyScalar(0.62);
  const nR = rings.length, cols = seg + 1;
  const pt = (j: number, i: number, inner: boolean) => {
    const r = rings[j], a = arc[0] + (arc[1] - arc[0]) * (i / seg);
    const ripple = 1 + 0.035 * Math.cos(locks * a) * Math.min(1, j / 2);
    const k = inner ? 1 - thick / Math.max(r.rx, r.rz) : 1;
    // the last ring is cut into pointed locks
    const dy = j === nR - 1 ? -tip * (0.5 + 0.5 * Math.cos(locks * a)) : 0;
    return [(r.x ?? 0) + Math.sin(a) * r.rx * ripple * k, r.y + dy, r.z + Math.cos(a) * r.rz * ripple * k];
  };
  for (const inner of [false, true]) for (let j = 0; j < nR; j++) for (let i = 0; i <= seg; i++) { pos.push(...pt(j, i, inner)); const cc = inner ? cIn : cOut; col.push(cc.r, cc.g, cc.b); }
  const O = (j: number, i: number) => j * cols + i, I = (j: number, i: number) => nR * cols + j * cols + i;
  for (let j = 0; j < nR - 1; j++) for (let i = 0; i < seg; i++) {
    idx.push(O(j, i), O(j + 1, i), O(j, i + 1), O(j, i + 1), O(j + 1, i), O(j + 1, i + 1));
    idx.push(I(j, i), I(j, i + 1), I(j + 1, i), I(j, i + 1), I(j + 1, i + 1), I(j + 1, i));
  }
  // side edges, top and hem: stitch outer to inner
  for (let j = 0; j < nR - 1; j++) { idx.push(O(j, 0), I(j, 0), O(j + 1, 0), O(j + 1, 0), I(j, 0), I(j + 1, 0)); idx.push(O(j, seg), O(j + 1, seg), I(j, seg), I(j, seg), O(j + 1, seg), I(j + 1, seg)); }
  for (let i = 0; i < seg; i++) { idx.push(O(0, i), O(0, i + 1), I(0, i), I(0, i), O(0, i + 1), I(0, i + 1)); const L = nR - 1; idx.push(O(L, i), I(L, i), O(L, i + 1), O(L, i + 1), I(L, i), I(L, i + 1)); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** Blend weights between two bones around a joint height. */
const blendW = (upper: string, lower: string, y: number, jointY: number, width: number): W => { const u = clamp((y - (jointY - width)) / (2 * width), 0, 1); return [[upper, u], [lower, 1 - u]]; };

export interface FaceRig { update(face: FaceState, eyeYaw: number, eyePitch: number): void }

export class CharacterVisual {
  readonly root: THREE.Group;
  private face!: FaceRig;
  private fingers: { left: THREE.Object3D[]; right: THREE.Object3D[] } = { left: [], right: [] };
  readonly rig: RigInstance;
  readonly geo: CharacterGeometry;
  private skeleton!: THREE.Skeleton;
  private boneIndex!: Map<string, number>;
  /** body contour at a height (torso), and the torso skinning weights: clothes wrap the real body */
  private torsoAt!: (y: number) => { rx: number; rz: number; rzb: number; bust: number; glute: number; bw: number };
  private torsoW!: (y: number) => W;
  private skullGeo!: THREE.BufferGeometry;
  constructor(rig: RigInstance, geo: CharacterGeometry) {
    this.rig = rig; this.geo = geo; this.root = rig.group;
    rig.resetToRest(); rig.group.position.set(0, 0, 0); rig.group.rotation.set(0, 0, 0); rig.group.updateMatrixWorld(true);
    this.buildBody(); this.buildHead(); this.buildHandsAndFeet(); this.buildAccessories();
    for (const p of geo.parts) this.addCustomPart(p);
    rig.group.traverse(o => { if ((o as THREE.Mesh).isMesh && !o.userData.outline && !o.userData.noShadow) { o.castShadow = true; } });
  }
  private get d() { return this.rig.dims; }
  private boneWorldY(id: string) { return this.rig.bones.get(id)!.getWorldPosition(new THREE.Vector3()); }

  private buildBody() {
    const g = this.geo, d = this.d, b = g.body, s = d.scale;
    const bones = [...this.rig.bones.values()];
    const boneIndex = new Map(bones.map((x, i) => [x.name, i]));
    const skeleton = new THREE.Skeleton(bones);
    this.skeleton = skeleton; this.boneIndex = boneIndex;
    const skin = b.skinColor, top = g.outfit.top, bottom = g.outfit.bottom;
    const topColor = top.color, under = top.secondaryColor ?? shade(top.color, 0.8);
    const pants = bottom.color;
    const hipsY = this.boneWorldY('hips').y, spineY = this.boneWorldY('spine').y, chestY = this.boneWorldY('chest').y, neckY = this.boneWorldY('neck').y;
    const shoulderY = this.boneWorldY('leftUpperArm').y;
    const waistY = (hipsY + spineY) / 2 + 0.03 * s;
    const coat = ['jacket', 'hoodie', 'labcoat'].includes(top.type) ? 1.07 : 1;
    const belly = b.belly * 0.07 * s;
    const band = bottom.waistband ?? (top.type === 'dress' && bottom.fit === 'skater' ? shade(topColor, 0.72) : undefined);
    const torsoColor = (y: number) => (top.type === 'overalls' ? (y < chestY + 0.02 * s ? pants : under) : top.type === 'dress' ? (band && Math.abs(y - (spineY + 0.025 * s)) < 0.014 * s ? band : topColor) : y < waistY - 0.015 * s ? (top.type === 'labcoat' ? topColor : pants) : top.type === 'vest' ? topColor : topColor);
    const tw = (y: number): W => {
      if (y < spineY - 0.04 * s) return [['hips', 1]];
      if (y < spineY + 0.04 * s) { const u = (y - (spineY - 0.04 * s)) / (0.08 * s); return [['hips', 1 - u], ['spine', u]]; }
      if (y < chestY) { const u = (y - (spineY + 0.04 * s)) / Math.max(1e-3, chestY - spineY - 0.04 * s); return [['spine', 1 - u], ['chest', u]]; }
      if (y < neckY - 0.02 * s) return [['chest', 1]];
      return [['chest', 0.6], ['neck', 0.4]];
    };
    this.torsoW = tw;
    // base silhouette (y, half width, front depth, back depth) through anatomical key heights; volumes (bust, glutes)
    // are added as lobes on top, so clothes (vertex colours on the same surface) follow the body's curves
    const wc = b.waist;
    const keys: [number, number, number, number][] = [
      [neckY + 0.01 * s, d.armR * 1.2, d.armR * 1.1, d.armR * 1.1],
      [neckY - 0.008 * s, d.chestRx * 0.5, d.chestRz * 0.62, d.chestRz * 0.62],
      [neckY - 0.03 * s, d.shoulderX * 0.66, d.chestRz * 0.74, d.chestRz * 0.74],
      [shoulderY + 0.012 * s, d.shoulderX * 0.84, d.chestRz * 0.84, d.chestRz * 0.84],
      [shoulderY - 0.025 * s, d.shoulderX * 0.9, d.chestRz * (0.95 + 0.1 * b.chest), d.chestRz * 0.95],
      [shoulderY - 0.07 * s, d.chestRx * 1.04, d.chestRz * (1.05 + 0.15 * b.chest), d.chestRz * 0.98],
      [chestY, d.chestRx * (1 - 0.05 * wc), d.chestRz * (1.02 + 0.1 * b.chest), d.chestRz * 0.95],
      [(chestY + spineY) / 2, ((d.chestRx + d.waistRx) / 2) * (1 - 0.1 * wc) + belly * 0.5, d.chestRz * 0.95 + belly * 0.7, d.chestRz * 0.9 * (1 - 0.06 * wc)],
      // natural waist (narrowest) a bit above the spine joint, widest hips low (at the hip joints): a long, smooth
      // waist-to-hip curve instead of a step; the waist never goes below ~2/3 of the hips
      [spineY + 0.025 * s, Math.max(d.waistRx * (1 - 0.1 * wc), d.hipRx * 0.66) + belly * 0.4, d.chestRz * 0.9 * (1 - 0.08 * wc) + belly, d.chestRz * 0.88 * (1 - 0.12 * wc)],
      [hipsY + 0.035 * s, lerp(Math.max(d.waistRx, d.hipRx * 0.66), d.hipRx, 0.62) + belly * 0.4, d.chestRz * 0.93 + belly * 0.6, d.chestRz * 0.9],
      [hipsY - 0.035 * s, d.hipRx * (1 + 0.03 * wc), d.chestRz * 0.92 + belly * 0.3, d.chestRz * 0.95],
      [hipsY - 0.08 * s, d.hipRx * 0.92, d.chestRz * 0.84, d.chestRz * 0.88],
      [hipsY - 0.11 * s, d.hipRx * 0.7, d.chestRz * 0.6, d.chestRz * 0.66]
    ];
    const mono = keys.filter((k, i) => i === 0 || k[0] < keys[i - 1][0] - 0.004);
    const asc = [...mono].reverse();
    const fRx = pchip(asc.map(k => k[0]), asc.map(k => k[1])), fRz = pchip(asc.map(k => k[0]), asc.map(k => k[2])), fRzb = pchip(asc.map(k => k[0]), asc.map(k => k[3]));
    // bust (or pectorals) and glutes: teardrop profiles, softer above the peak than below it
    const bustB = b.bust * 0.085 * s + b.pecs * 0.026 * s, bustY = shoulderY - (0.12 + 0.025 * b.bust) * s, bustW = b.bust >= b.pecs ? 0.36 : 0.55;
    const gl = b.glutes * 0.075 * s, gluteY = hipsY - 0.055 * s;
    const bustAt = (y: number) => bustB * Math.exp(-(((y - bustY) / ((y > bustY ? 0.075 : 0.042) * s)) ** 2));
    const gluteAt = (y: number) => gl * Math.exp(-(((y - gluteY) / ((y > gluteY ? 0.075 : 0.05) * s)) ** 2));
    const ys = new Set<number>(mono.map(k => k[0]));
    const yTop = mono[0][0], yBot = mono[mono.length - 1][0];
    for (let y = yTop - 0.02 * s; y > yBot + 0.005; y -= 0.022 * s) ys.add(y);
    for (let y = bustY + 0.09 * s; y > bustY - 0.08 * s; y -= 0.014 * s) if (y < yTop - 0.01 && y > yBot) ys.add(y);
    for (let y = gluteY + 0.07 * s; y > yBot + 0.004; y -= 0.014 * s) if (y < yTop) ys.add(y);
    const torsoProfile = [...ys].sort((p, q) => q - p).filter((y, i, a) => i === 0 || a[i - 1] - y > 0.004);
    this.torsoAt = (y: number) => ({ rx: fRx(y), rz: fRz(y), rzb: fRzb(y), bust: bustAt(y), glute: gluteAt(y), bw: bustW });
    const skinG = 0, topG = 0, botG = 0; // matte: toon shadows only, no specular on people
    const glossOf = (c: string) => c === skin ? skinG : c === pants && top.type !== 'overalls' ? botG : topG;
    // neckline: a skin region on the front of the torso (a = 0 is the front), shaped per type, with a soft cleavage shadow
    const neckBase = neckY - 0.02 * s, NECK: Record<string, number> = { v: 0.13, scoop: 0.1, plunge: 0.21, 'off-shoulder': 0.05 };
    const depth = (NECK[top.neckline] ?? 0) * s;
    const neckSpec: NecklineSpec | undefined = depth > 0 ? { kind: top.neckline as NecklineSpec['kind'], depth, offDepth: neckBase - (shoulderY - 0.045 * s), scale: s, skin, skinGloss: 0, cleavage: b.bust >= 0.3 } : undefined;
    const rings: Ring[] = [];
    for (let i = 0; i < torsoProfile.length; i++) {
      const y = torsoProfile[i];
      const k = y > neckY - 0.02 * s ? 1 : coat;
      const color = y > neckY - 0.005 * s ? (top.type === 'tanktop' || top.type === 'dress' ? skin : topColor) : torsoColor(y);
      // duplicate ring at the shirt/pants boundary for a crisp edge
      if (i > 0 && torsoColor(torsoProfile[i - 1]) !== color && y < neckY - 0.02 * s) {
        const by = waistY - 0.015 * s;
        rings.push({ y: by + 0.001, rx: fRx(by) * k * 1.03, rz: fRz(by) * k * 1.03, rzb: fRzb(by) * k * 1.03, glute: gluteAt(by), x: 0, z: 0, color: torsoColor(torsoProfile[i - 1]), w: tw(by) });
        rings.push({ y: by - 0.001, rx: fRx(by) * k, rz: fRz(by) * k, rzb: fRzb(by) * k, glute: gluteAt(by), x: 0, z: 0, color, w: tw(by) });
      }
      const neckColor = depth > 0 && y > neckY - 0.005 * s ? skin : color;
      rings.push({ y, rx: fRx(y) * k, rz: fRz(y) * k, rzb: fRzb(y) * k, bust: bustAt(y) * k, bw: bustW, glute: gluteAt(y), x: 0, z: 0.0, color: neckColor, w: tw(y), gloss: glossOf(neckColor), neck: depth > 0 ? neckBase - y : undefined });
    }
    this.addSkinned(tubeGeometry(rings, boneIndex, depth > 0 ? 64 : 56, true, true, { passes: 1 }), skeleton, 'torso', neckSpec);
    // neck
    const headY = this.boneWorldY('head').y;
    this.addSkinned(tubeGeometry(([
      { y: headY + d.headRy * 0.4, rx: d.headRx * 0.38, rz: d.headRz * 0.38, x: 0, z: -0.01 * s, color: skin, w: [['head', 1]] },
      { y: headY, rx: d.headRx * 0.36, rz: d.headRz * 0.38, x: 0, z: -0.01 * s, color: skin, w: [['head', 0.5], ['neck', 0.5]] },
      { y: neckY - 0.02 * s, rx: d.headRx * 0.42, rz: d.headRz * 0.42, x: 0, z: -0.01 * s, color: skin, w: [['neck', 0.5], ['chest', 0.5]] }
    ] as Ring[]), boneIndex, 24, false, false), skeleton, 'neck');
    // arms
    const sleeve = top.type === 'tanktop' || top.type === 'dress' ? 0 : top.type === 'tshirt' || top.type === 'vest' || top.type === 'overalls' ? 0.45 : 1.0;
    const sleeveColor = top.type === 'vest' || top.type === 'overalls' ? under : topColor;
    for (const side of ['left', 'right'] as const) {
      const sx = side === 'left' ? 1 : -1;
      const up = this.boneWorldY(`${side}UpperArm`), el = this.boneWorldY(`${side}LowerArm`), wr = this.boneWorldY(`${side}Hand`);
      const len = up.y - wr.y;
      const prof: [number, number][] = [[-0.02, 0.9], [0, 1.22], [0.06, 1.28], [0.14, 1.2], [0.3, 1.08], [0.47, 0.88], [0.53, 0.86], [0.68, 0.96], [0.85, 0.8], [0.95, 0.68], [1, 0.64]];
      const sleeveEnd = sleeve * len;
      const arm: Ring[] = [];
      const wOf = (y: number): W => y > up.y - 0.04 * s ? [[`${side}UpperArm`, 0.6], ['chest', 0.4]] : blendW(`${side}UpperArm`, `${side}LowerArm`, y, el.y, 0.045 * s);
      const pushArm = (u: number, rf: number, color: string, k = 1) => { const y = up.y - u * len; arm.push({ y, rx: d.armR * rf * k, rz: d.armR * rf * k, x: up.x + sx * 0.004, z: up.z, color, w: wOf(y) }); };
      for (let i = 0; i < prof.length; i++) {
        const [u, rf] = prof[i];
        const prevU = i ? prof[i - 1][0] : 0;
        if (sleeve > 0 && sleeve < 1 && prevU < sleeve && u >= sleeve) { const rr = lerp(prof[i - 1][1], rf, (sleeve - prevU) / (u - prevU)); pushArm(sleeve - 0.002, rr, sleeveColor, coat * 1.08); pushArm(sleeve + 0.002, rr, skin); }
        const inSleeve = u <= sleeveEnd / len + 1e-6 && sleeve > 0;
        pushArm(u, rf, inSleeve ? sleeveColor : skin, inSleeve ? coat * (sleeve === 1 ? 1.04 : 1.06) : 1);
      }
      // off-shoulder: the sleeve starts below the shoulder, the shoulder itself is bare
      if (top.neckline === 'off-shoulder') for (const r of arm) if (r.y > up.y - 0.05 * s) r.color = skin;
      for (const r of arm) r.gloss = r.color === skin ? skinG : topG;
      this.addSkinned(tubeGeometry(arm, boneIndex, 28, true, true), skeleton, `${side}Arm`);
      // legs
      const th = this.boneWorldY(`${side}Thigh`), kn = this.boneWorldY(`${side}Shin`), an = this.boneWorldY(`${side}Foot`);
      const legLen = th.y - an.y;
      const shorts = bottom.type === 'shorts' ? 0.42 : bottom.type === 'skirt' ? 0.3 : 1.02;
      const lprof: [number, number][] = [[-0.1, 1.15], [0, 1.25], [0.2, 1.15], [0.45, 0.95], [0.5, 0.9], [0.55, 0.92], [0.7, 0.98], [0.9, 0.72], [1.0, 0.62]];
      const leg: Ring[] = [];
      const lw = (y: number): W => y > th.y - 0.03 * s ? [[`${side}Thigh`, 0.55], ['hips', 0.45]] : blendW(`${side}Thigh`, `${side}Shin`, y, kn.y, 0.05 * s);
      const bootTop = g.outfit.shoes.type === 'boots' ? 0.8 : 2;
      for (let i = 0; i < lprof.length; i++) {
        const [u, rf] = lprof[i];
        const y = th.y - u * legLen;
        if (i > 0 && lprof[i - 1][0] < shorts && u >= shorts && shorts < 1) { const yy = th.y - shorts * legLen; leg.push({ y: yy + 0.001, rx: d.legR * rf * 1.08, rz: d.legR * rf * 1.08, x: th.x, z: 0, color: pants, w: lw(yy) }); leg.push({ y: yy - 0.001, rx: d.legR * rf * 0.92, rz: d.legR * rf * 0.92, x: th.x, z: 0, color: skin, w: lw(yy) }); }
        const inPants = u <= shorts;
        const color = u >= bootTop ? g.outfit.shoes.color : inPants ? pants : skin;
        const fullness = 1 + 0.16 * b.thighs * clamp((0.5 - u) / 0.5, 0, 1);
        const rzl = d.legR * rf * (inPants ? 1.04 : 0.92) * fullness;
        // the seat continues into the back of the upper thigh
        const seat = bottom.type === 'skirt' || top.type === 'dress' ? 1 : 1 + 0.6 * b.glutes * Math.exp(-(((u - 0.02) / 0.07) ** 2));
        leg.push({ y, rx: d.legR * rf * (inPants ? 1.04 : 0.92) * (u < 0 ? 1.2 : 1) * fullness, rz: rzl, rzb: rzl * seat, x: th.x * (u < 0 ? 0.7 : 1), z: 0, color, w: lw(y) });
      }
      for (const r of leg) r.gloss = r.color === skin ? skinG : r.color === pants ? botG : 0;
      this.addSkinned(tubeGeometry(leg, boneIndex, 28, false, true), skeleton, `${side}Leg`);
    }
    // clothing details (rigid on bones)
    const chest = this.rig.bone('chest'), hips = this.rig.bone('hips');
    const toLocal = (bone: THREE.Bone, w: THREE.Vector3) => bone.worldToLocal(w.clone());
    if (['pants', 'shorts'].includes(bottom.type) && !['overalls', 'dress', 'labcoat'].includes(top.type) || top.type === 'labcoat') {
      const belt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 28), toon('#2b2420'));
      belt.rotation.x = Math.PI / 2; belt.scale.set(d.waistRx * 1.08 + belly * 0.4, d.chestRz * 0.98 + belly, d.waistRx * 0.32);
      belt.position.copy(toLocal(hips, new THREE.Vector3(0, waistY - 0.012 * s, 0)));
      if (top.type !== 'labcoat') hips.add(withOutline(belt, 0.004 * s));
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.035 * s, 0.01 * s), toon('#c9a640'));
      buckle.position.copy(toLocal(hips, new THREE.Vector3(0, waistY - 0.012 * s, d.chestRz * 0.98 + belly + 0.012 * s)));
      if (top.type !== 'labcoat') hips.add(buckle);
    }
    if (top.type === 'jacket' || top.type === 'hoodie' || top.type === 'labcoat') {
      const zip = new THREE.Mesh(new THREE.BoxGeometry(0.012 * s, chestY - waistY + 0.18 * s, 0.006 * s), toon(top.type === 'labcoat' ? '#b8c2cc' : shade(topColor, 0.55)));
      zip.position.copy(toLocal(chest, new THREE.Vector3(0, (chestY + waistY) / 2 + 0.04 * s, d.chestRz * 1.1 * coat + 0.002)));
      chest.add(zip);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(1, 0.32, 8, 24), toon(top.type === 'hoodie' ? shade(topColor, 0.9) : shade(topColor, 0.85)));
      collar.rotation.x = Math.PI / 2 - 0.25; collar.scale.set(d.headRx * 0.55, d.headRz * 0.6, d.headRx * 0.5);
      collar.position.copy(toLocal(chest, new THREE.Vector3(0, neckY - 0.005 * s, -0.012 * s)));
      chest.add(withOutline(collar, 0.004 * s));
      if (top.type === 'hoodie') { const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(shade(topColor, 0.92))); hood.scale.set(d.headRx * 1.1, d.headRy * 0.5, d.headRz * 0.6); hood.rotation.x = -1.2; hood.position.copy(toLocal(chest, new THREE.Vector3(0, neckY + 0.01 * s, -d.chestRz * 0.9))); chest.add(withOutline(hood, 0.005 * s)); }
    }
    if (top.type === 'overalls') {
      const bib = new THREE.Mesh(new THREE.BoxGeometry(d.chestRx * 1.2, chestY - waistY + 0.08 * s, 0.02 * s), toon(pants));
      bib.position.copy(toLocal(chest, new THREE.Vector3(0, (chestY + waistY) / 2 + 0.02 * s, d.chestRz * 1.06)));
      chest.add(withOutline(bib, 0.004 * s));
      for (const sx of [1, -1]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.32 * s, 0.015 * s), toon(pants)); strap.position.copy(toLocal(chest, new THREE.Vector3(sx * d.chestRx * 0.45, shoulderY - 0.05 * s, d.chestRz * 0.6))); strap.rotation.x = -0.45; chest.add(strap); const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.01 * s, 10), toon('#d8b84a')); btn.rotation.x = Math.PI / 2; btn.position.copy(toLocal(chest, new THREE.Vector3(sx * d.chestRx * 0.45, chestY + 0.03 * s, d.chestRz * 1.1))); chest.add(btn); }
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(d.chestRx * 0.6, 0.09 * s, 0.01 * s), toon(shade(pants, 0.8))); pocket.position.copy(toLocal(chest, new THREE.Vector3(0, chestY - 0.02 * s, d.chestRz * 1.09))); chest.add(pocket);
    }
    if (top.type === 'labcoat' || top.type === 'dress' || bottom.type === 'skirt') {
      const color = bottom.type === 'skirt' ? pants : topColor;
      const len = top.type === 'labcoat' ? d.legLen * 0.62 : bottom.type === 'skirt' ? d.legLen * 0.42 : d.legLen * 0.5;
      const y0 = waistY - 0.012 * s;
      const fit = bottom.fit;
      // a skater skirt starts at the natural waist (above the hips) and flares as a cone
      const ys = fit === 'skater' ? spineY + 0.012 * s : y0;
      this.clothShell(top.type === 'labcoat' ? 'coat-tails' : 'skirt', ys, y0 - len, color, top.type === 'labcoat' ? { flare: 0.05, arc: [0.3, Math.PI * 2 - 0.3], legBlend: 0.35, foldAmp: 0.004 } : fit === 'skater' ? { cone: 0.42, legBlend: 0.45, foldAmp: 0.01, folds: 13 } : { flare: fit === 'fitted' ? 0.03 : top.type === 'dress' ? 0.14 : 0.1, legBlend: 0.7 });
    }
  }
  /** A cloth surface that wraps the body from `y0` down to `y1` (skirt, dress, coat tails, apron): it starts on the
   * torso's own contour, hangs from the widest point of the hips/glutes, flares, gets folds towards the hem and is
   * skinned to the hips and, progressively, to the thighs, so it moves with the legs instead of floating. */
  private clothShell(name: string, y0: number, y1: number, color: string, o: { flare?: number; arc?: [number, number]; offset?: number; legBlend?: number; folds?: number; foldAmp?: number; /** flare as a cone from the top ring (m per m), never inside the body */ cone?: number }) {
    const d = this.d, s = d.scale, b = this.geo.body;
    const hipsY = this.boneWorldY('hips').y, torsoBottom = hipsY - 0.11 * s;
    const th = this.boneWorldY('leftThigh'), kn = this.boneWorldY('leftShin');
    const len = y0 - y1, off = (o.offset ?? 0.006) * s;
    const N = Math.max(6, Math.round(len / (0.03 * s)));
    const rings: Ring[] = [];
    let rxW = 0, rzW = 0, rzbW = 0, glW = 0;
    for (let i = 0; i <= N; i++) {
      const u = i / N, y = y0 - u * len;
      let rx: number, rz: number, rzb: number, glute: number, bust = 0;
      if (y > torsoBottom) { const t = this.torsoAt(y); rx = t.rx; rz = t.rz; rzb = t.rzb; glute = t.glute; bust = t.bust; }
      else {
        // below the crotch the body is two thighs: the envelope spans both
        const legU = clamp((th.y - y) / Math.max(0.05, th.y - kn.y), 0, 1);
        const lr = d.legR * lerp(1.22, 0.95, legU) * (1 + 0.15 * b.thighs);
        rx = Math.abs(th.x) + lr; rz = lr * 1.05; rzb = lr * 1.05; glute = this.torsoAt(torsoBottom).glute * Math.exp(-(((torsoBottom - y) / (0.06 * s)) ** 2));
      }
      // cloth hangs from the widest point above (it does not cling under the glutes) and flares towards the hem
      const below = y < hipsY;
      rxW = below ? Math.max(rxW * (1 - 0.04 * u), rx) : rx; rzW = below ? Math.max(rzW * (1 - 0.05 * u), rz) : rz; rzbW = below ? Math.max(rzbW * (1 - 0.1 * u), rzb) : rzb; glW = below ? Math.max(glW * 0.72, glute) : glute;
      const fl = (o.flare ?? 0.12) * Math.max(0, hipsY - y);
      const fold = (o.foldAmp ?? 0.007) * s * Math.max(0, (u - 0.25) / 0.75);
      // the cloth covers the glutes with their own shape (never less than the body under it) and partly bridges the cleft
      rings.push({ y, rx: rxW + off + fl, rz: rzW + off + fl * 0.8, rzb: rzbW + glW * 0.4 + off + fl * 0.5, glute: glW * 1.04, bust, bw: this.torsoAt(y).bw, x: 0, z: 0, color, w: y > hipsY - 0.02 * s ? this.torsoW(y) : [['hips', 1]], legBlend: (o.legBlend ?? 0.55) * smoothstep(clamp((hipsY - 0.1 * s - y) / Math.max(0.05, len * 0.7), 0, 1)), fold, folds: o.folds ?? 11 });
      if (o.cone && i > 0) {
        const r0 = rings[0], last = rings[rings.length - 1], dy = y0 - y;
        last.rx = Math.max(rx + off, r0.rx + o.cone * dy); last.rz = Math.max(rz + off, r0.rz + o.cone * 0.8 * dy);
        last.rzb = Math.max(rzb + glute * 1.15 + off, ringVal(r0, 'rzb') + o.cone * 0.9 * dy); last.glute = 0; last.bust = 0;
      }
    }
    // relax the profile along the length (the max() above leaves small kinks that toon shading would show)
    for (let pass = 0; pass < 3; pass++) for (const k of ['rx', 'rz', 'rzb'] as const) { const v = rings.map(r => r[k] ?? r.rz); for (let i = 1; i < rings.length - 1; i++) if (rings[i].y < hipsY) rings[i][k] = 0.25 * v[i - 1] + 0.5 * v[i] + 0.25 * v[i + 1]; }
    const geo = tubeGeometry(rings, this.boneIndex, 72, false, false, { arc: o.arc, passes: 2 });
    const mesh = new THREE.SkinnedMesh(geo, toon('#ffffff', { vertexColors: true, side: THREE.DoubleSide }));
    mesh.name = name; mesh.frustumCulled = false; mesh.castShadow = true;
    mesh.bind(this.skeleton, new THREE.Matrix4());
    this.rig.group.add(mesh);
    return mesh;
  }
  private addSkinned(geo: THREE.BufferGeometry, skeleton: THREE.Skeleton, name: string, neckline?: NecklineSpec) {
    const mesh = new THREE.SkinnedMesh(geo, toon('#ffffff', neckline ? { vertexColors: true, glossAttr: true, shininess: 70, neckline } : { vertexColors: true }));
    mesh.name = name; mesh.frustumCulled = false;
    mesh.bind(skeleton, new THREE.Matrix4());
    this.rig.group.add(mesh);
    withOutline(mesh, this.geo.outlineWidth * this.d.scale);
    if (mesh.children[0]) mesh.children[0].frustumCulled = false;
  }

  private buildHead() {
    const g = this.geo, d = this.d, s = d.scale, f = g.face;
    const head = this.rig.bone('head');
    const H = new THREE.Group(); H.name = 'headGroup'; H.position.set(0, d.headCenter, 0.005 * s); head.add(H);
    const rx = d.headRx, ry = d.headRy, rz = d.headRz;
    // skull with jaw shaping
    const skullGeo = new THREE.SphereGeometry(1, 40, 28);
    const p = skullGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0) { const k = 1 - (1 - g.body.jaw) * 0.35 * Math.pow(-y, 1.5); x *= k; z = z > 0 ? z * (1 + 0.06 * -y) : z * (1 - 0.25 * -y); }
      if (y > 0.2 && z < 0) z *= 1.05;
      p.setXYZ(i, x * rx, y * ry, z * rz);
    }
    skullGeo.computeVertexNormals();
    const skull = new THREE.Mesh(skullGeo, toon(g.body.skinColor)); skull.name = 'skull'; this.skullGeo = skullGeo;
    H.add(withOutline(skull, g.outlineWidth * s));
    const surfZ = (x: number, y: number, k = 1) => rz * k * Math.sqrt(Math.max(0.02, 1 - (x / (rx * k)) ** 2 - (y / (ry * k)) ** 2));
    // ears
    for (const sx of [1, -1]) {
      if (f.earSize <= 0 || ['long', 'bob'].includes(g.hair.style)) break; // covered by the hair
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 18), toon(shade(g.body.skinColor, 0.97)));
      ear.scale.set(0.035 * s * f.earSize, 0.075 * s * f.earSize, 0.05 * s * f.earSize);
      ear.position.set(sx * rx * 0.97, -ry * 0.05, -rz * 0.08); ear.rotation.y = sx * 0.3;
      H.add(withOutline(ear, 0.006 * s));
    }
    // nose
    const nz = surfZ(0, -ry * 0.12);
    const ns = 0.03 * s * f.noseSize;
    let nose: THREE.Mesh;
    switch (f.noseShape) {
      case 'pointy': nose = new THREE.Mesh(new THREE.ConeGeometry(ns * 0.8, ns * 2.4, 12), toon(shade(g.body.skinColor, 0.98))); nose.rotation.x = Math.PI / 2 - 0.25; nose.position.set(0, -ry * 0.14, nz + ns * 0.8); break;
      case 'long': nose = new THREE.Mesh(new THREE.CapsuleGeometry(ns * 0.6, ns * 1.8, 10, 20), toon(shade(g.body.skinColor, 0.98))); nose.rotation.x = 0.55; nose.position.set(0, -ry * 0.15, nz + ns * 0.3); break;
      case 'wide': nose = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), toon(shade(g.body.skinColor, 0.97))); nose.scale.set(ns * 1.5, ns * 0.95, ns * 0.95); nose.position.set(0, -ry * 0.16, nz + ns * 0.2); break;
      case 'round': nose = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), toon(shade(g.body.skinColor, 0.97))); nose.scale.setScalar(ns * 1.25); nose.position.set(0, -ry * 0.15, nz + ns * 0.35); break;
      default: nose = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), toon(shade(g.body.skinColor, 0.97))); nose.scale.set(ns * 0.95, ns * 0.85, ns); nose.position.set(0, -ry * 0.14, nz + ns * 0.25);
    }
    H.add(withOutline(nose, 0.004 * s));
    // eyes
    const re = 0.2 * rx * f.eyeSize;
    const eyeX = rx * 0.36 * f.eyeSpacing, eyeY = ry * (0.08 + f.eyeHeight * 0.3);
    const lidColor = shade(g.body.skinColor, 0.93);
    const eyes: { group: THREE.Group; ball: THREE.Group; upper: THREE.Group; lower: THREE.Group; side: number }[] = [];
    for (const side of [1, -1]) {
      const eg = new THREE.Group(); eg.userData.noInk = true; eg.position.set(side * eyeX, eyeY, surfZ(side * eyeX, eyeY) - re * 0.42); eg.scale.y = f.eyeShape === 'narrow' ? 0.7 : f.eyeShape === 'almond' ? 0.85 : 1.08;
      eg.rotation.y = side * 0.18;
      H.add(eg);
      const ball = new THREE.Group(); eg.add(ball);
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(re, 24, 16), toon('#f7f5f0')); ball.add(sclera);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(re * 0.56, 24), flat(f.irisColor, { polygonOffset: 1 })); iris.position.z = re * 1.0; ball.add(iris);
      const irisRing = new THREE.Mesh(new THREE.RingGeometry(re * 0.5, re * 0.58, 24), flat(shade(f.irisColor, 0.45), { polygonOffset: 2 })); irisRing.position.z = re * 1.002; ball.add(irisRing);
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(re * 0.28, 20), flat('#0b0d12', { polygonOffset: 3 })); pupil.position.z = re * 1.004; pupil.name = 'pupil'; ball.add(pupil);
      const hl = new THREE.Mesh(new THREE.CircleGeometry(re * 0.11, 12), flat('#ffffff', { polygonOffset: 4 })); hl.position.set(re * 0.2, re * 0.22, re * 1.006); ball.add(hl);
      // curved iris: push discs onto the sphere surface
      for (const m of [iris, irisRing, pupil, hl]) { const pa = m.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) + m.position.x, y = pa.getY(i) + m.position.y; pa.setZ(i, Math.sqrt(Math.max(0, (re * 1.004) ** 2 - x * x - y * y)) - m.position.z + (m.position.z - re)); } }
      const upper = new THREE.Group(); eg.add(upper);
      const upLid = new THREE.Mesh(new THREE.SphereGeometry(re * 1.08, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(lidColor)); upper.add(upLid);
      const lash = new THREE.Mesh(new THREE.TorusGeometry(re * 1.08, re * 0.07, 6, 24, Math.PI), flat('#1b1820')); lash.rotation.x = Math.PI / 2; lash.rotation.z = 0; upper.add(lash);
      const lower = new THREE.Group(); eg.add(lower);
      const loLid = new THREE.Mesh(new THREE.SphereGeometry(re * 1.06, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(lidColor)); lower.add(loLid);
      eyes.push({ group: eg, ball, upper, lower, side });
    }
    // brows
    const browColor = f.browColor ?? g.hair.color;
    const brows = [1, -1].map(side => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.011 * s * f.browThickness, rx * 0.34, 8, 16), toon(browColor));
      m.rotation.z = Math.PI / 2; const grp = new THREE.Group(); grp.userData.noInk = true; grp.add(m); H.add(grp); return { grp, side };
    });
    // mouth (dynamic)
    const beardFull = ['full', 'goatee', 'chinstrap'].includes(g.beard.style);
    const mouthK = g.beard.style === 'full' ? 1.1 : g.beard.style === 'stubble' ? 1.012 : 1.0;
    const N = 16;
    const mouthW = rx * 0.5 * f.mouthWidth, mouthY = -ry * 0.43;
    const mk = (n: number) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); return geo; };
    const fillGeo = mk((N + 1) * 2), teethGeo = mk((N + 1) * 2), lineGeo = mk((N + 1) * 4), tongueGeo = mk((N + 1) * 2);
    const stripIdx = (n: number) => { const idx: number[] = []; for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); return idx; };
    fillGeo.setIndex(stripIdx(N)); teethGeo.setIndex(stripIdx(N)); tongueGeo.setIndex(stripIdx(N));
    const lineIdx: number[] = []; for (const off of [0, (N + 1) * 2]) for (let i = 0; i < N; i++) { const a = off + i * 2; lineIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } lineGeo.setIndex(lineIdx);
    const mouthGroup = new THREE.Group(); mouthGroup.userData.noInk = true; H.add(mouthGroup);
    const fill = new THREE.Mesh(fillGeo, flat('#4a1820', { side: THREE.DoubleSide, polygonOffset: 2 }));
    const tongue = new THREE.Mesh(tongueGeo, flat('#c8566a', { side: THREE.DoubleSide, polygonOffset: 3 }));
    const teeth = new THREE.Mesh(teethGeo, flat('#fbfaf5', { side: THREE.DoubleSide, polygonOffset: 4 }));
    const line = new THREE.Mesh(lineGeo, flat(f.lipColor === '#7a2f3a' ? '#3a1a20' : shade(f.lipColor, 0.6), { side: THREE.DoubleSide, polygonOffset: 5 }));
    for (const m of [fill, tongue, teeth, line]) { m.frustumCulled = false; m.userData.noShadow = true; mouthGroup.add(m); }
    const project = (x: number, y: number, lift: number) => [x, y, surfZ(x * 0.98, y, mouthK) + lift];
    const setStrip = (geo: THREE.BufferGeometry, a: (u: number) => [number, number], b: (u: number) => [number, number], lift: number) => {
      const arr = geo.attributes.position.array as Float32Array;
      for (let i = 0; i <= N; i++) { const u = i / N; const p1 = a(u), p2 = b(u); arr.set(project(p1[0], p1[1], lift), i * 6); arr.set(project(p2[0], p2[1], lift), i * 6 + 3); }
      geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
    };
    const cheeks = f.blush > 0 ? [1, -1].map(sx => { const c = new THREE.Mesh(new THREE.CircleGeometry(rx * 0.16, 16), flat('#ff7a8a', { transparent: true, opacity: 0.35 * f.blush, polygonOffset: 1, depthWrite: false })); c.position.set(sx * rx * 0.5, -ry * 0.22, surfZ(sx * rx * 0.5, -ry * 0.22) + 0.002); c.rotation.y = sx * 0.55; H.add(c); return c; }) : [];
    void cheeks;
    this.face = {
      update: (face, eyeYaw, eyePitch) => {
        // eyes
        for (const e of eyes) {
          e.ball.rotation.set(eyePitch * DEG, eyeYaw * DEG - e.side * 0.18, 0);
          const lidU = clamp(e.side > 0 ? face.lidUpperL : face.lidUpperR, 0, 1), lidL = clamp(e.side > 0 ? face.lidLowerL : face.lidLowerR, 0, 1);
          e.upper.rotation.x = lerp(-62, 92, lidU) * DEG + eyePitch * 0.4 * DEG;
          e.lower.rotation.x = lerp(55, -10, lidL) * DEG;
          const sc = clamp(face.eyeScale, 0.7, 1.4); e.group.scale.x = sc; e.group.scale.z = sc;
          const pupil = e.ball.getObjectByName('pupil')!; pupil.scale.setScalar(clamp(face.pupilScale, 0.5, 1.4));
        }
        for (const b of brows) {
          const raise = (b.side > 0 ? face.browRaiseL : face.browRaiseR) * 0.075 * ry, ang = (b.side > 0 ? face.browAngleL : face.browAngleR);
          const x = b.side * eyeX * 0.98, y = eyeY + re * 1.12 + 0.03 * ry + raise;
          b.grp.position.set(x, y, surfZ(x, y) + 0.008 * s);
          b.grp.rotation.set(-0.2, b.side * 0.22, -b.side * ang * 0.42 + b.side * 0.06);
        }
        // mouth contour
        const smile = clamp(face.mouthSmile, -1, 1), open = clamp(face.mouthOpen, 0, 1.2), wide = clamp(face.mouthWide, -1, 1), round = clamp(face.mouthRound, 0, 1), asym = clamp(face.mouthAsym, -1, 1), press = clamp(face.mouthPress, 0, 1);
        const w = mouthW * (1 + 0.32 * wide - 0.42 * round) * (1 - 0.1 * press) * (1 + 0.12 * Math.max(0, smile));
        const openH = open * ry * 0.36 * (1 - press);
        const curve = (u: number) => { const x = (u * 2 - 1); return smile * 0.12 * ry * x * x + asym * 0.05 * ry * x - smile * 0.03 * ry; };
        const shapeExp = 1.4 - round * 0.9;
        const upper = (u: number): [number, number] => { const x = (u * 2 - 1); const bump = Math.pow(Math.max(0, 1 - x * x), shapeExp * 0.5); return [x * w / 2, mouthY + curve(u) + openH * 0.22 * bump]; };
        const lower = (u: number): [number, number] => { const x = (u * 2 - 1); const bump = Math.pow(Math.max(0, 1 - x * x), shapeExp * 0.5); return [x * w / 2, mouthY + curve(u) - openH * 0.78 * bump]; };
        setStrip(fillGeo, upper, lower, 0.002 * s);
        fill.visible = openH > 0.002;
        const teethH = Math.min(openH * 0.4, 0.022 * s) * clamp(face.teethShow, 0, 1);
        setStrip(teethGeo, upper, u => { const p = upper(u); return [p[0] * 0.96, p[1] - teethH]; }, 0.0026 * s);
        teeth.visible = teethH > 0.0015;
        setStrip(tongueGeo, u => { const p = lower(u); const l = lower(0.5)[1]; return [p[0] * 0.8, Math.max(p[1], l) + openH * 0.18]; }, u => { const p = lower(u); return [p[0] * 0.8, p[1]]; }, 0.0024 * s);
        tongue.visible = openH > 0.02;
        // lip line: thickness ribbons along upper and lower contours
        const th = (0.0055 + 0.002 * press) * s;
        const arr = lineGeo.attributes.position.array as Float32Array;
        for (const [k, fn] of [[0, upper], [1, lower]] as const) for (let i = 0; i <= N; i++) { const u = i / N; const [x, y] = fn(u); const taper = 0.45 + 0.55 * Math.sin(Math.PI * u); arr.set(project(x, y + th * taper * 0.5, 0.003 * s), (k * (N + 1) * 2 + i * 2) * 3); arr.set(project(x, y - th * taper * 0.5, 0.003 * s), (k * (N + 1) * 2 + i * 2 + 1) * 3); }
        lineGeo.attributes.position.needsUpdate = true; lineGeo.computeBoundingSphere();
      }
    };
    void beardFull;
    this.buildHair(H, rx, ry, rz);
  }
  private buildHair(H: THREE.Group, rx: number, ry: number, rz: number) {
    const hairGloss = {}; // matte hair: toon shadows only
    const g = this.geo, s = this.d.scale, hc = g.hair.color, v = g.hair.volume;
    const ow = 0.007 * s;
    const add = (m: THREE.Mesh, outline = true) => { H.add(outline ? withOutline(m, ow) : m); return m; };
    const cap = (theta: number, k = 1.07, tilt = -0.48, color = hc) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 44, 26, 0, Math.PI * 2, 0, theta), toon(color, color === hc ? hairGloss : {})); m.scale.set(rx * k * (1 + 0.04 * (v - 1)), ry * k * (1 + 0.08 * (v - 1)), rz * k * (1 + 0.05 * (v - 1))); m.rotation.x = tilt; m.position.y = ry * 0.02; return add(m); };
    // nape: covers the back of the skull below the tilted cap for every style with hair
    if (!['bald', 'mohawk'].includes(g.hair.style)) {
      const nape = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.18, Math.PI * 0.52), toon(g.hair.style === 'buzz' ? mix(hc, g.body.skinColor, 0.35) : hc));
      nape.rotation.y = Math.PI; nape.scale.set(rx * 1.05, ry * 1.05, rz * 1.06); nape.position.y = ry * 0.02;
      H.add(withOutline(nape, ow));
    }
    switch (g.hair.style) {
      case 'bald': break;
      case 'buzz': cap(Math.PI * 0.42, 1.015, -0.48, mix(hc, g.body.skinColor, 0.35)); break;
      case 'short': cap(Math.PI * 0.5); { const fr = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), toon(hc, hairGloss)); fr.scale.set(rx * 0.7, ry * 0.18, rz * 0.35); fr.position.set(rx * 0.12, ry * 0.68, rz * 0.62); fr.rotation.z = -0.25; add(fr); } break;
      case 'sidepart': cap(Math.PI * 0.52); { const sw = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), toon(hc, hairGloss)); sw.scale.set(rx * 0.75, ry * 0.32, rz * 0.62); sw.position.set(rx * 0.32, ry * 0.72, rz * 0.32); sw.rotation.z = -0.35; add(sw); } break;
      case 'spiky': { cap(Math.PI * 0.48); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, el = 0.45 + 0.25 * ((i * 37) % 5) / 5; const c = new THREE.Mesh(new THREE.ConeGeometry(rx * 0.22, ry * 0.55 * v, 8), toon(hc, hairGloss)); const dir = new THREE.Vector3(Math.sin(a) * Math.cos(el) * 0.8, Math.sin(el) + 0.3, Math.cos(a) * Math.cos(el) * 0.6 - 0.25).normalize(); c.position.set(dir.x * rx * 0.85, dir.y * ry * 0.85, dir.z * rz * 0.85); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); add(c); } break; }
      case 'mohawk': { cap(Math.PI * 0.45, 1.01, -0.48, mix(hc, g.body.skinColor, 0.55)); for (let i = 0; i < 6; i++) { const a = -0.4 + i * 0.32; const c = new THREE.Mesh(new THREE.ConeGeometry(rx * 0.12, ry * 0.5 * v, 6), toon(hc, hairGloss)); c.scale.z = 2.2; const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a) * 1.1).normalize(); c.position.set(0, dir.y * ry, dir.z * rz); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); add(c); } break; }
      case 'bob': {
        cap(Math.PI * 0.62, 1.1, -0.78);
        const shell = hairShell([
          { y: ry * 0.42, rx: rx * 1.06, rz: rz * 1.06, z: -rz * 0.02 }, { y: ry * 0.05, rx: rx * 1.12, rz: rz * 1.1, z: -rz * 0.02 },
          { y: -ry * 0.45, rx: rx * 1.13, rz: rz * 1.06, z: -rz * 0.06 }, { y: -ry * 0.85 * v, rx: rx * 1.16, rz: rz * 1.0, z: -rz * 0.1 }
        ], [0.78, Math.PI * 2 - 0.78], 0.035 * s, 18, ry * 0.07, hc);
        add(new THREE.Mesh(shell, toon('#ffffff', { vertexColors: true })));
        const bang = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(hc)); bang.scale.set(rx * 0.95, ry * 0.24, rz * 0.5); bang.position.set(0, ry * 0.7, rz * 0.5); bang.rotation.x = 0.85; add(bang);
        break;
      }
      case 'long': {
        cap(Math.PI * 0.58, 1.08, -0.5);
        // a thick mane: frames the face, falls behind the neck and spreads over the upper back, cut into locks
        const L = Math.max(1, v);
        const shell = hairShell([
          { y: ry * 0.4, rx: rx * 1.06, rz: rz * 1.06, z: -rz * 0.02 }, { y: 0, rx: rx * 1.12, rz: rz * 1.1, z: -rz * 0.03 },
          { y: -ry * 0.5, rx: rx * 1.1, rz: rz * 1.02, z: -rz * 0.1 }, { y: -ry * 0.95, rx: rx * 1.06, rz: rz * 0.86, z: -rz * 0.28 },
          { y: -ry * 1.4, rx: rx * 1.12, rz: rz * 0.66, z: -rz * 0.6 }, { y: -ry * 1.85 * L, rx: rx * 1.22, rz: rz * 0.56, z: -rz * 0.8 },
          { y: -ry * 2.3 * L, rx: rx * 1.18, rz: rz * 0.5, z: -rz * 0.88 }
        ], [1.0, Math.PI * 2 - 1.0], 0.03 * s, 15, ry * 0.3, hc, 64);
        add(new THREE.Mesh(shell, toon('#ffffff', { vertexColors: true })));
        break;
      }
      case 'ponytail': { cap(Math.PI * 0.55, 1.07, -0.58); const tie = new THREE.Mesh(new THREE.SphereGeometry(rx * 0.16, 12, 8), toon(shade(hc, 0.7))); tie.position.set(0, ry * 0.35, -rz * 1.02); add(tie); const Lt = ry * 1.35 * v, prof: THREE.Vector2[] = []; for (let k = 0; k <= 14; k++) { const u = k / 14; prof.push(new THREE.Vector2(rx * (0.13 + 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.35)) * (1 - u * 0.55)) * (u > 0.92 ? (1 - u) / 0.08 : 1) + 0.002, -u * Lt)); }
        prof.reverse(); const tg = new THREE.LatheGeometry(prof, 20); const tp = tg.attributes.position as THREE.BufferAttribute; for (let i = 0; i < tp.count; i++) { const a = Math.atan2(tp.getX(i), tp.getZ(i)), r = 1 + 0.08 * Math.cos(7 * a); tp.setX(i, tp.getX(i) * r); tp.setZ(i, tp.getZ(i) * r); } tg.computeVertexNormals();
        const tail = new THREE.Mesh(tg, toon(hc)); tail.position.set(0, ry * 0.3, -rz * 1.08); tail.rotation.x = 0.38; tail.name = 'ponytail'; add(tail); break; }
      case 'bun': { cap(Math.PI * 0.55, 1.07, -0.58); const bun = new THREE.Mesh(new THREE.SphereGeometry(rx * 0.38 * v, 28, 20), toon(hc, hairGloss)); bun.position.set(0, ry * 0.85, -rz * 0.55); add(bun); break; }
      case 'curly': { for (let i = 0; i < 46; i++) { const u = ((i * 0.618034) % 1), vv = (i / 46); const th = Math.acos(1 - vv * 1.15), ph = u * Math.PI * 2; if (Math.cos(th) < -0.05) continue; const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); if (dir.z > 0.55 && dir.y < 0.55) continue; const b = new THREE.Mesh(new THREE.SphereGeometry(rx * 0.24 * v, 16, 12), toon(hc, hairGloss)); b.position.set(dir.x * rx * 1.02, dir.y * ry * 1.02 + ry * 0.05, dir.z * rz * 1.02); add(b, false); } cap(Math.PI * 0.5, 1.04, -0.48); break; }
    }
    // beard
    const bc = g.beard.color ?? hc;
    const shell = (t0: number, t1: number, k: number, color: string, phiW = 2.5) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, Math.PI / 2 - phiW / 2, phiW, t0, t1 - t0), toon(color)); m.scale.set(rx * k, ry * k, rz * k); return m; };
    switch (g.beard.style) {
      case 'full': { const m = shell(Math.PI * 0.56, Math.PI * 0.97, 1.07, bc); add(m); const mus = new THREE.Mesh(new THREE.CapsuleGeometry(ry * 0.06, rx * 0.42, 8, 16), toon(bc)); mus.rotation.z = Math.PI / 2; mus.position.set(0, -ry * 0.3, rz * 0.98); add(mus); break; }
      case 'stubble': {
        // a shadow of beard painted on a copy of the skull (same jaw shape): it fades into the skin, no edges
        const sg = this.skullGeo.clone(), pa = sg.attributes.position as THREE.BufferAttribute, cols: number[] = [];
        const skinC = new THREE.Color(g.body.skinColor), beardC = new THREE.Color(mix(g.body.skinColor, bc, 0.42)), cc = new THREE.Color();
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i) / rx, y = pa.getY(i) / ry, z = pa.getZ(i) / rz;
          const k = smoothstep(clamp((-y - 0.12) / 0.25, 0, 1)) * smoothstep(clamp((z + 0.25) / 0.35, 0, 1)) * (1 - smoothstep(clamp((y + 0.98) / 0.1 + 1, 0, 1)) * 0);
          cc.copy(skinC).lerp(beardC, k); cols.push(cc.r, cc.g, cc.b);
          pa.setXYZ(i, pa.getX(i) * 1.004, pa.getY(i) * 1.004, pa.getZ(i) * 1.004); void x;
        }
        sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        // keep only the lower face (where any vertex has some beard): the rest of the skull is not duplicated
        const ix = sg.index!.array, keep: number[] = [], tint = (i: number) => Math.abs(cols[i * 3] - skinC.r) + Math.abs(cols[i * 3 + 1] - skinC.g) + Math.abs(cols[i * 3 + 2] - skinC.b) > 0.004;
        for (let f = 0; f < ix.length; f += 3) if (tint(ix[f]) || tint(ix[f + 1]) || tint(ix[f + 2])) keep.push(ix[f], ix[f + 1], ix[f + 2]);
        sg.setIndex(keep);
        const st = new THREE.Mesh(sg, toon('#ffffff', { vertexColors: true })); st.userData.noInk = true; H.add(st);
        break;
      }
      case 'chinstrap': add(shell(Math.PI * 0.72, Math.PI * 0.95, 1.04, bc, 3)); break;
      case 'goatee': { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), toon(bc)); m.scale.set(rx * 0.22, ry * 0.22, rz * 0.2); m.position.set(0, -ry * 0.72, rz * 0.62); add(m); } // falls through to mustache
      // eslint-disable-next-line no-fallthrough
      case 'mustache': { for (const sx of [1, -1]) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(ry * 0.045, rx * 0.2, 8, 16), toon(bc)); m.rotation.z = Math.PI / 2 + sx * 0.3; m.position.set(sx * rx * 0.12, -ry * 0.31, rz * 0.97); add(m); } break; }
    }
    // keep a handle for ear-ring placement
    void s;
  }
  private buildHandsAndFeet() {
    const g = this.geo, d = this.d, s = d.scale;
    const handColor = g.outfit.gloves?.color ?? g.body.skinColor;
    for (const side of ['left', 'right'] as const) {
      const sx = side === 'left' ? 1 : -1;
      const hand = this.rig.bone(`${side}Hand`);
      const L = d.handLen;
      const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), toon(handColor)); palm.scale.set(L * 0.17, L * 0.3, L * 0.27); palm.position.set(0, -L * 0.28, 0.0);
      hand.add(withOutline(palm, 0.005 * s));
      const list: THREE.Object3D[] = [];
      for (let i = 0; i < 4; i++) {
        const piv = new THREE.Group(); piv.position.set(-sx * L * 0.02, -L * 0.5, L * (0.17 - i * 0.11)); hand.add(piv);
        const len = L * (0.36 - Math.abs(i - 1.2) * 0.04);
        const fm = new THREE.Mesh(new THREE.CapsuleGeometry(L * 0.065, len, 8, 16), toon(handColor)); fm.position.y = -len / 2; piv.add(withOutline(fm, 0.004 * s));
        piv.userData.side = sx; list.push(piv);
      }
      const thumb = new THREE.Group(); thumb.position.set(-sx * L * 0.1, -L * 0.18, L * 0.2); thumb.rotation.set(0.5, 0, -sx * 0.6); hand.add(thumb);
      const tm = new THREE.Mesh(new THREE.CapsuleGeometry(L * 0.07, L * 0.24, 8, 16), toon(handColor)); tm.position.y = -L * 0.14; thumb.add(withOutline(tm, 0.004 * s));
      thumb.userData.thumb = true; thumb.userData.side = sx; list.push(thumb);
      this.fingers[side] = list;
      // shoes
      const foot = this.rig.bone(`${side}Foot`), toe = this.rig.bone(`${side}Toe`);
      const sh = g.outfit.shoes, sole = sh.soleColor ?? (sh.type === 'sneakers' ? '#efefea' : shade(sh.color, 0.5));
      const fl = d.footLen, ah = d.ankleH;
      const heel = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 20), toon(sh.color)); heel.scale.set(d.legR * 0.95, ah * 0.85, fl * 0.42); heel.position.set(0, -ah * 0.35, fl * 0.12);
      foot.add(withOutline(heel, 0.006 * s));
      const soleM = new THREE.Mesh(roundedBox(d.legR * 1.75, ah * 0.28, fl * 0.66), toon(sole)); soleM.position.set(0, -ah * 0.86, fl * 0.12); foot.add(withOutline(soleM, 0.005 * s));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), toon(sh.color)); cap.scale.set(d.legR * 0.92, ah * 0.6, fl * 0.24); cap.position.set(0, -ah * 0.42 + (foot.position.y - toe.position.y) * 0 - 0.0, 0.0);
      // toe cap sits on the toe bone so the shoe bends at toe-off
      const tl = toe.position;
      cap.position.set(0, -tl.y - ah * 0.42, 0.02 * s);
      toe.add(withOutline(cap, 0.006 * s));
      const toeSole = new THREE.Mesh(roundedBox(d.legR * 1.6, ah * 0.28, fl * 0.3), toon(sole)); toeSole.position.set(0, -tl.y - ah * 0.86, 0.03 * s); toe.add(toeSole);
      if (sh.type === 'heels') {
        // slim pump: lower, narrower shell, a thin stiletto under the heel and an ankle strap
        heel.scale.set(d.legR * 0.62, ah * 0.4, fl * 0.4); heel.position.set(0, -ah * 0.5, fl * 0.06);
        soleM.scale.set(0.62, 0.4, 0.95); cap.scale.set(d.legR * 0.58, ah * 0.28, fl * 0.3);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.007 * s, 0.011 * s, ah * 0.78, 10), toon(sh.color)); post.position.set(0, -ah * 0.6, -fl * 0.13); foot.add(post);
        const strap = new THREE.Mesh(new THREE.TorusGeometry(d.legR * 0.62, 0.006 * s, 6, 20), toon(sh.color)); strap.rotation.x = Math.PI / 2; strap.position.set(0, ah * 0.05, 0.005 * s); foot.add(strap);
      }
      if (sh.type === 'boots') { const cuff = new THREE.Mesh(new THREE.CylinderGeometry(d.legR * 0.95, d.legR * 0.9, ah * 0.9, 28), toon(sh.color)); cuff.position.y = ah * 0.25; foot.add(withOutline(cuff, 0.005 * s)); }
      if (sh.type === 'sneakers') { const lace = new THREE.Mesh(new THREE.BoxGeometry(d.legR * 0.7, 0.008 * s, fl * 0.25), toon('#f2f2ee')); lace.position.set(0, ah * 0.22, fl * 0.2); lace.rotation.x = 0.35; foot.add(lace); }
    }
  }
  private buildAccessories() {
    const g = this.geo, d = this.d, s = d.scale;
    const H = this.rig.bone('head').getObjectByName('headGroup') as THREE.Group;
    const rx = d.headRx, ry = d.headRy, rz = d.headRz;
    for (const a of g.accessories) {
      const c2 = a.secondaryColor ?? shade(a.color, 0.6);
      switch (a.type) {
        case 'goggles': case 'glasses': {
          const onEyes = a.type === 'glasses' || a.position === 'eyes';
          const y = onEyes ? ry * (0.08 + g.face.eyeHeight * 0.3) : ry * 0.64;
          const ex = rx * 0.36 * g.face.eyeSpacing;
          const grp = new THREE.Group(); H.add(grp);
          for (const sx of [1, -1]) {
            const r = a.type === 'goggles' ? rx * 0.24 : rx * 0.22;
            const z = rz * Math.sqrt(Math.max(0.05, 1 - (ex / rx) ** 2 - (y / ry) ** 2)) + (a.type === 'goggles' ? 0.025 : 0.02) * s;
            const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * (a.type === 'goggles' ? 0.28 : 0.12), 8, 24), toon(a.color)); rim.position.set(sx * ex, y, z); rim.rotation.y = sx * 0.2; grp.add(withOutline(rim, 0.004 * s));
            const lens = new THREE.Mesh(new THREE.CircleGeometry(r, 24), toon(a.type === 'goggles' ? c2 : '#cfe8ff', { transparent: true, opacity: a.type === 'goggles' ? 0.9 : 0.25, emissive: a.type === 'goggles' ? c2 : undefined, emissiveIntensity: 0.25 })); lens.position.set(sx * ex, y, z + 0.002); lens.rotation.y = sx * 0.2; grp.add(lens);
          }
          if (a.type === 'goggles') { const strap = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 32), toon(c2)); strap.rotation.x = Math.PI / 2 + (onEyes ? 0.05 : -0.25); { const k = Math.sqrt(Math.max(0.2, 1 - (y / ry) ** 2)); strap.scale.set(rx * 1.05 * k, rz * 1.07 * k, ry); } strap.position.y = y - 0.01 * s; grp.add(strap); }
          else { const bridge = new THREE.Mesh(new THREE.BoxGeometry(ex * 0.6, 0.008 * s, 0.008 * s), toon(a.color)); bridge.position.set(0, y + 0.01 * s, rz * 0.98 + 0.02 * s); grp.add(bridge); }
          break;
        }
        case 'cap': case 'beanie': case 'bandana': {
          const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, a.type === 'bandana' ? Math.PI * 0.42 : Math.PI * 0.5), toon(a.color)); m.scale.set(rx * 1.12, ry * (a.type === 'beanie' ? 1.25 : 1.1), rz * 1.12); m.rotation.x = -0.2; m.position.y = ry * 0.05; H.add(withOutline(m, 0.006 * s));
          if (a.type === 'cap') { const visor = new THREE.Mesh(new THREE.CylinderGeometry(rx * 0.75, rx * 0.75, 0.012 * s, 20, 1, false, -Math.PI / 2, Math.PI), toon(c2)); visor.scale.z = 1.1; visor.position.set(0, ry * 0.45, rz * 0.7); visor.rotation.x = 0.12; H.add(withOutline(visor, 0.004 * s)); }
          if (a.type === 'beanie') { const fold = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 28), toon(c2)); fold.rotation.x = Math.PI / 2 - 0.2; fold.scale.set(rx * 1.1, rz * 1.1, ry); fold.position.y = ry * 0.32; H.add(fold); }
          break;
        }
        case 'headset': { const band = new THREE.Mesh(new THREE.TorusGeometry(rx * 1.08, 0.012 * s, 6, 24, Math.PI), toon(a.color)); band.position.y = 0; band.scale.y = ry / rx * 1.08; H.add(band); for (const sx of [1, -1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(rx * 0.22, rx * 0.22, 0.04 * s, 16), toon(c2)); cup.rotation.z = Math.PI / 2; cup.position.set(sx * rx * 1.05, -ry * 0.05, 0); H.add(withOutline(cup, 0.004 * s)); } const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.006 * s, rx * 0.7, 10, 20), toon(a.color)); mic.rotation.set(0, 0, Math.PI / 2 - 0.2); mic.position.set(rx * 0.75, -ry * 0.35, rz * 0.65); mic.rotation.y = -0.9; H.add(mic); break; }
        case 'earrings': for (const sx of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 8, 6), toon(a.color)); e.position.set(sx * rx * 0.98, -ry * 0.38, -rz * 0.02); H.add(e); } break;
        case 'scarf': { const chest = this.rig.bone('chest'); const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 8, 24), toon(a.color)); t.rotation.x = Math.PI / 2; t.scale.set(d.headRx * 0.6, d.headRz * 0.6, d.headRx * 0.6); t.position.copy(chest.worldToLocal(this.boneWorldY('neck').clone().add(new THREE.Vector3(0, -0.01 * s, 0)))); chest.add(withOutline(t, 0.004 * s)); break; }
        case 'toolbelt': case 'apron': { const hips = this.rig.bone('hips'); const y = (this.boneWorldY('hips').y + this.boneWorldY('spine').y) / 2 - 0.02 * s; if (a.type === 'toolbelt') { const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 6, 28), toon(a.color)); t.rotation.x = Math.PI / 2; t.scale.set(d.waistRx * 1.12 + g.body.belly * 0.03, d.chestRz * 1.02 + g.body.belly * 0.07, d.waistRx * 0.3); t.position.copy(hips.worldToLocal(new THREE.Vector3(0, y, 0))); hips.add(withOutline(t, 0.004 * s)); for (const [px, pz] of [[0.9, 0.3], [-0.9, 0.3], [0.6, 0.8]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.08 * s, 0.035 * s), toon(c2)); p.position.copy(hips.worldToLocal(new THREE.Vector3(px * d.waistRx * 1.1, y - 0.045 * s, pz * d.chestRz * 1.05))); p.lookAt(hips.localToWorld(new THREE.Vector3(0, p.position.y, 0))); p.rotateY(Math.PI); hips.add(withOutline(p, 0.003 * s)); } const wrench = new THREE.Mesh(new THREE.BoxGeometry(0.012 * s, 0.12 * s, 0.02 * s), toon('#a7b0ba')); wrench.position.copy(hips.worldToLocal(new THREE.Vector3(-0.9 * d.waistRx * 1.1, y - 0.06 * s, 0.32 * d.chestRz + 0.03 * s))); hips.add(wrench); } else {
            // a bib apron that wraps the front of the body from the chest to above the knees, tied at the waist
            const yTop = this.boneWorldY('chest').y + 0.08 * s, yHem = y - 0.42 * s;
            this.clothShell('apron', yTop, yHem, a.color, { arc: [-1.2, 1.2], offset: 0.012, flare: 0.06, legBlend: 0.6, foldAmp: 0.004, folds: 9 });
            const tie = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32), toon(a.color)); tie.rotation.x = Math.PI / 2; const wt = this.torsoAt(y + 0.01 * s); tie.scale.set(wt.rx * 1.06 + 0.012 * s, Math.max(wt.rz, wt.rzb) * 1.06 + 0.012 * s, 0.25 * wt.rx); tie.position.copy(hips.worldToLocal(new THREE.Vector3(0, y + 0.01 * s, 0))); hips.add(tie);
            const strap = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 24), toon(a.color)); strap.rotation.x = Math.PI / 2 - 0.35; strap.scale.set(d.headRx * 0.58, d.headRz * 0.62, d.headRx * 0.5); const chest = this.rig.bone('chest'); strap.position.copy(chest.worldToLocal(this.boneWorldY('neck').clone().add(new THREE.Vector3(0, -0.03 * s, 0.01 * s)))); chest.add(strap);
          } break; }
        case 'badge': { const chest = this.rig.bone('chest'); const b = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.035 * s, 0.006 * s), toon(a.color)); b.position.copy(chest.worldToLocal(new THREE.Vector3(d.chestRx * 0.45, this.boneWorldY('chest').y + 0.05 * s, d.chestRz * 1.12 + 0.006 * s))); chest.add(withOutline(b, 0.002 * s)); break; }
        case 'watch': { const arm = this.rig.bone('leftLowerArm'); const w = new THREE.Mesh(new THREE.TorusGeometry(d.armR * 0.72, d.armR * 0.18, 6, 16), toon(a.color)); w.rotation.x = Math.PI / 2; w.position.set(0, -d.lowerArmLen * 0.88, 0); arm.add(w); break; }
        case 'backpack': { const chest = this.rig.bone('chest'); const b = new THREE.Mesh(new THREE.BoxGeometry(d.chestRx * 1.4, 0.38 * s, 0.16 * s), toon(a.color)); b.position.copy(chest.worldToLocal(new THREE.Vector3(0, this.boneWorldY('chest').y, -d.chestRz * 1.05 - 0.08 * s))); chest.add(withOutline(b, 0.005 * s)); break; }
      }
    }
  }
  private addCustomPart(p: CharacterGeometry['parts'][number]) {
    const bone = p.bone ? this.rig.bones.get(p.bone) : this.rig.bone('chest');
    const parent: THREE.Object3D = p.bone === 'headGroup' ? this.rig.bone('head').getObjectByName('headGroup')! : bone ?? this.rig.bone('chest');
    parent.add(primitiveMesh(p, this.d.scale));
  }
  /** Apply facial state and finger curl. Bones are already posed by the engine. */
  update(pose: ActorPose): void {
    this.face.update(pose.face, pose.eyeYaw, pose.eyePitch);
    for (const side of ['left', 'right'] as const) {
      const curl = clamp(0.15 + pose.grip[side] * 0.95, 0, 1.1);
      for (const f of this.fingers[side]) {
        if (f.userData.thumb) { f.rotation.x = 0.5 + curl * 0.6; continue; }
        f.rotation.z = -f.userData.side * curl * 1.55;
      }
    }
  }
}

export function primitiveMesh(p: { primitive: string; size: number[]; position: number[]; rotationDeg?: number[]; color: string; emissive?: string; emissiveIntensity?: number; outline?: boolean; id: string }, scale = 1): THREE.Mesh {
  const [x, y, z] = p.size.map(n => Math.max(0.002, n));
  let g: THREE.BufferGeometry;
  switch (p.primitive) {
    case 'box': g = new THREE.BoxGeometry(x, y, z); break;
    case 'roundedBox': { g = new THREE.SphereGeometry(1, 32, 22); const pa = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pa.count; i++) { const vx = pa.getX(i), vy = pa.getY(i), vz = pa.getZ(i); const k = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 0.35); pa.setXYZ(i, k(vx) * x / 2, k(vy) * y / 2, k(vz) * z / 2); } g.computeVertexNormals(); break; }
    case 'capsule': g = new THREE.CapsuleGeometry(x, Math.max(0.001, y - 2 * x), 6, 14); break;
    case 'cylinder': g = new THREE.CylinderGeometry(x, z || x, y, 20); break;
    case 'cone': g = new THREE.ConeGeometry(x, y, 18); break;
    case 'torus': g = new THREE.TorusGeometry(x, y, 10, 24); break;
    default: { g = new THREE.SphereGeometry(1, 34, 24); g.scale(x, y, z); }
  }
  const m = new THREE.Mesh(g, toon(p.color, p.emissive ? { emissive: p.emissive, emissiveIntensity: p.emissiveIntensity ?? 1 } : {}));
  m.name = p.id; m.position.set(p.position[0], p.position[1], p.position[2]);
  if (p.rotationDeg) m.rotation.set(p.rotationDeg[0] * DEG, p.rotationDeg[1] * DEG, p.rotationDeg[2] * DEG);
  m.castShadow = true; m.receiveShadow = true;
  return p.outline === false ? m : withOutline(m, 0.008 * scale);
}
