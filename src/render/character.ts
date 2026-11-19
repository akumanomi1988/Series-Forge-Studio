/** Procedural humanoid toon character: skinned body tubes (clothing as colour regions), rigid hands/shoes,
 * head with facial rig (eyes, lids, brows, dynamic mouth), hair, beard and accessories.
 * Built from geometry.json (parameters only) on top of the engine RigInstance bones. */
import * as THREE from 'three';
import type { CharacterGeometry } from '../engine/schema.ts';
import type { RigInstance, ActorPose } from '../engine/pose.ts';
import type { FaceState } from '../engine/face.ts';
import { toon, flat, withOutline, shade, mix } from './toon.ts';
import { clamp, lerp, DEG } from '../engine/math.ts';

type W = [string, number][];
interface Ring { y: number; rx: number; rz: number; x: number; z: number; color: string; w: W }

function tubeGeometry(input: Ring[], boneIndex: Map<string, number>, seg = 18, capTop = true, capBottom = true): THREE.BufferGeometry {
  const rings: Ring[] = [];
  for (let j = 0; j < input.length; j++) {
    const r = input[j], n = input[j + 1];
    rings.push(r);
    if (n && n.color !== r.color && Math.abs(n.y - r.y) > 0.004) {
      const m = (k: number): Ring => ({ y: lerp(r.y, n.y, 0.5) + k, rx: lerp(r.rx, n.rx, 0.5), rz: lerp(r.rz, n.rz, 0.5), x: lerp(r.x, n.x, 0.5), z: lerp(r.z, n.z, 0.5), color: k > 0 ? r.color : n.color, w: k > 0 ? r.w : n.w });
      rings.push(m(0.0008), m(-0.0008));
    }
  }
  const pos: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [], idx: number[] = [];
  const c = new THREE.Color();
  const pushV = (x: number, y: number, z: number, color: string, w: W) => {
    pos.push(x, y, z); c.set(color); col.push(c.r, c.g, c.b);
    const ws = [...w].sort((a, b) => b[1] - a[1]).slice(0, 4); const tot = ws.reduce((s, x) => s + x[1], 0) || 1;
    for (let k = 0; k < 4; k++) { si.push(ws[k] ? boneIndex.get(ws[k][0]) ?? 0 : 0); sw.push(ws[k] ? ws[k][1] / tot : 0); }
  };
  for (const r of rings) for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pushV(r.x + Math.sin(a) * r.rx, r.y, r.z + Math.cos(a) * r.rz, r.color, r.w); }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + seg + 1;
    // rings ordered top->bottom: wind so normals face outward
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const cap = (r: Ring, top: boolean) => {
    const center = pos.length / 3; pushV(r.x, r.y + (top ? r.rx * 0.35 : -r.rx * 0.35), r.z, r.color, r.w);
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pushV(r.x + Math.sin(a) * r.rx, r.y, r.z + Math.cos(a) * r.rz, r.color, r.w); }
    for (let i = 0; i < seg; i++) top ? idx.push(center, base + i, base + i + 1) : idx.push(center, base + i + 1, base + i);
  };
  if (capTop) cap(rings[0], true);
  if (capBottom) cap(rings[rings.length - 1], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
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
    const skin = b.skinColor, top = g.outfit.top, bottom = g.outfit.bottom;
    const topColor = top.color, under = top.secondaryColor ?? shade(top.color, 0.8);
    const pants = bottom.color;
    const hipsY = this.boneWorldY('hips').y, spineY = this.boneWorldY('spine').y, chestY = this.boneWorldY('chest').y, neckY = this.boneWorldY('neck').y;
    const shoulderY = this.boneWorldY('leftUpperArm').y;
    const waistY = (hipsY + spineY) / 2 + 0.03 * s;
    const coat = ['jacket', 'hoodie', 'labcoat'].includes(top.type) ? 1.07 : 1;
    const belly = b.belly * 0.07 * s;
    const torsoColor = (y: number) => (top.type === 'overalls' ? (y < chestY + 0.02 * s ? pants : under) : top.type === 'dress' ? topColor : y < waistY - 0.015 * s ? (top.type === 'labcoat' ? topColor : pants) : top.type === 'vest' ? topColor : topColor);
    const tw = (y: number): W => {
      if (y < spineY - 0.04 * s) return [['hips', 1]];
      if (y < spineY + 0.04 * s) { const u = (y - (spineY - 0.04 * s)) / (0.08 * s); return [['hips', 1 - u], ['spine', u]]; }
      if (y < chestY) { const u = (y - (spineY + 0.04 * s)) / Math.max(1e-3, chestY - spineY - 0.04 * s); return [['spine', 1 - u], ['chest', u]]; }
      if (y < neckY - 0.02 * s) return [['chest', 1]];
      return [['chest', 0.6], ['neck', 0.4]];
    };
    const torsoProfile: [number, number, number][] = [ // y, rx, rz
      [neckY + 0.01 * s, d.armR * 1.2, d.armR * 1.1],
      [neckY - 0.008 * s, d.chestRx * 0.5, d.chestRz * 0.62],
      [neckY - 0.03 * s, d.shoulderX * 0.66, d.chestRz * 0.74],
      [shoulderY + 0.012 * s, d.shoulderX * 0.84, d.chestRz * 0.84],
      [shoulderY - 0.025 * s, d.shoulderX * 0.9, d.chestRz * (0.95 + 0.1 * b.chest)],
      [shoulderY - 0.07 * s, d.chestRx * 1.04, d.chestRz * (1.05 + 0.15 * b.chest)],
      [chestY, d.chestRx, d.chestRz * (1.02 + 0.1 * b.chest)],
      [(chestY + spineY) / 2, (d.chestRx + d.waistRx) / 2 + belly * 0.5, d.chestRz * 0.95 + belly * 0.7],
      [waistY, d.waistRx + belly * 0.4, d.chestRz * 0.9 + belly],
      [hipsY + 0.01 * s, d.hipRx, d.chestRz * 0.95 + belly * 0.4],
      [hipsY - 0.07 * s, d.hipRx * 0.92, d.chestRz * 0.85],
      [hipsY - 0.11 * s, d.hipRx * 0.55, d.chestRz * 0.55]
    ];
    const rings: Ring[] = [];
    for (let i = 0; i < torsoProfile.length; i++) {
      const [y, rx, rz] = torsoProfile[i];
      const k = y > neckY - 0.02 * s ? 1 : coat;
      const color = y > neckY - 0.005 * s ? (top.type === 'tanktop' || top.type === 'dress' ? skin : topColor) : torsoColor(y);
      // duplicate ring at the shirt/pants boundary for a crisp edge
      if (i > 0 && torsoColor(torsoProfile[i - 1][0]) !== color && y < neckY - 0.02 * s) {
        const by = waistY - 0.015 * s, prev = torsoProfile[i - 1];
        const u = (by - prev[0]) / (y - prev[0]);
        const brx = lerp(prev[1], rx, u) * k, brz = lerp(prev[2], rz, u) * k;
        rings.push({ y: by + 0.001, rx: brx * 1.03, rz: brz * 1.03, x: 0, z: 0, color: torsoColor(prev[0]), w: tw(by) });
        rings.push({ y: by - 0.001, rx: brx, rz: brz, x: 0, z: 0, color, w: tw(by) });
      }
      rings.push({ y, rx: rx * k, rz: rz * k, x: 0, z: 0.0, color, w: tw(y) });
    }
    this.addSkinned(tubeGeometry(rings, boneIndex, 28), skeleton, 'torso');
    // neck
    const headY = this.boneWorldY('head').y;
    this.addSkinned(tubeGeometry([
      { y: headY + d.headRy * 0.4, rx: d.headRx * 0.38, rz: d.headRz * 0.38, x: 0, z: -0.01 * s, color: skin, w: [['head', 1]] },
      { y: headY, rx: d.headRx * 0.36, rz: d.headRz * 0.38, x: 0, z: -0.01 * s, color: skin, w: [['head', 0.5], ['neck', 0.5]] },
      { y: neckY - 0.02 * s, rx: d.headRx * 0.42, rz: d.headRz * 0.42, x: 0, z: -0.01 * s, color: skin, w: [['neck', 0.5], ['chest', 0.5]] }
    ], boneIndex, 14, false, false), skeleton, 'neck');
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
      this.addSkinned(tubeGeometry(arm, boneIndex, 18, true, true), skeleton, `${side}Arm`);
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
        leg.push({ y, rx: d.legR * rf * (inPants ? 1.04 : 0.92) * (u < 0 ? 1.2 : 1), rz: d.legR * rf * (inPants ? 1.04 : 0.92), x: th.x * (u < 0 ? 0.7 : 1), z: 0, color, w: lw(y) });
      }
      this.addSkinned(tubeGeometry(leg, boneIndex, 18, false, true), skeleton, `${side}Leg`);
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
      const open = top.type === 'labcoat' ? 0.5 : 0;
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(d.hipRx * 1.12, d.hipRx * 1.6, len, 24, 1, true, open / 2 + Math.PI, Math.PI * 2 - open), toon(color, { side: THREE.DoubleSide }));
      skirt.scale.z = (d.chestRz * 1.1) / (d.hipRx * 1.12) + 0.2;
      skirt.position.copy(toLocal(hips, new THREE.Vector3(0, waistY - 0.02 * s - len / 2, 0)));
      skirt.rotation.y = Math.PI;
      hips.add(withOutline(skirt, 0.005 * s));
    }
  }
  private addSkinned(geo: THREE.BufferGeometry, skeleton: THREE.Skeleton, name: string) {
    const mesh = new THREE.SkinnedMesh(geo, toon('#ffffff', { vertexColors: true }));
    mesh.name = name; mesh.frustumCulled = false;
    mesh.bind(skeleton, new THREE.Matrix4());
    this.rig.group.add(mesh);
    withOutline(mesh, this.geo.outlineWidth * this.d.scale);
    (mesh.children[0] as THREE.Object3D).frustumCulled = false;
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
    const skull = new THREE.Mesh(skullGeo, toon(g.body.skinColor)); skull.name = 'skull';
    H.add(withOutline(skull, g.outlineWidth * s));
    const surfZ = (x: number, y: number, k = 1) => rz * k * Math.sqrt(Math.max(0.02, 1 - (x / (rx * k)) ** 2 - (y / (ry * k)) ** 2));
    // ears
    for (const sx of [1, -1]) {
      if (f.earSize <= 0) break;
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), toon(shade(g.body.skinColor, 0.97)));
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
      case 'long': nose = new THREE.Mesh(new THREE.CapsuleGeometry(ns * 0.6, ns * 1.8, 6, 12), toon(shade(g.body.skinColor, 0.98))); nose.rotation.x = 0.55; nose.position.set(0, -ry * 0.15, nz + ns * 0.3); break;
      case 'wide': nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), toon(shade(g.body.skinColor, 0.97))); nose.scale.set(ns * 1.5, ns * 0.95, ns * 0.95); nose.position.set(0, -ry * 0.16, nz + ns * 0.2); break;
      case 'round': nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), toon(shade(g.body.skinColor, 0.97))); nose.scale.setScalar(ns * 1.25); nose.position.set(0, -ry * 0.15, nz + ns * 0.35); break;
      default: nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), toon(shade(g.body.skinColor, 0.97))); nose.scale.set(ns * 0.95, ns * 0.85, ns); nose.position.set(0, -ry * 0.14, nz + ns * 0.25);
    }
    H.add(withOutline(nose, 0.004 * s));
    // eyes
    const re = 0.2 * rx * f.eyeSize;
    const eyeX = rx * 0.36 * f.eyeSpacing, eyeY = ry * (0.08 + f.eyeHeight * 0.3);
    const lidColor = shade(g.body.skinColor, 0.93);
    const eyes: { group: THREE.Group; ball: THREE.Group; upper: THREE.Group; lower: THREE.Group; side: number }[] = [];
    for (const side of [1, -1]) {
      const eg = new THREE.Group(); eg.position.set(side * eyeX, eyeY, surfZ(side * eyeX, eyeY) - re * 0.42); eg.scale.y = f.eyeShape === 'narrow' ? 0.7 : f.eyeShape === 'almond' ? 0.85 : 1.08;
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
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.011 * s * f.browThickness, rx * 0.34, 4, 8), toon(browColor));
      m.rotation.z = Math.PI / 2; const grp = new THREE.Group(); grp.add(m); H.add(grp); return { grp, side };
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
    const mouthGroup = new THREE.Group(); H.add(mouthGroup);
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
    const g = this.geo, s = this.d.scale, hc = g.hair.color, v = g.hair.volume;
    const ow = 0.007 * s;
    const add = (m: THREE.Mesh, outline = true) => { H.add(outline ? withOutline(m, ow) : m); return m; };
    const cap = (theta: number, k = 1.07, tilt = -0.48, color = hc) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, theta), toon(color)); m.scale.set(rx * k * (1 + 0.04 * (v - 1)), ry * k * (1 + 0.08 * (v - 1)), rz * k * (1 + 0.05 * (v - 1))); m.rotation.x = tilt; m.position.y = ry * 0.02; return add(m); };
    switch (g.hair.style) {
      case 'bald': break;
      case 'buzz': cap(Math.PI * 0.42, 1.015, -0.48, mix(hc, g.body.skinColor, 0.35)); break;
      case 'short': cap(Math.PI * 0.5); { const fr = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon(hc)); fr.scale.set(rx * 0.7, ry * 0.18, rz * 0.35); fr.position.set(rx * 0.12, ry * 0.68, rz * 0.62); fr.rotation.z = -0.25; add(fr); } break;
      case 'sidepart': cap(Math.PI * 0.52); { const sw = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), toon(hc)); sw.scale.set(rx * 0.75, ry * 0.32, rz * 0.62); sw.position.set(rx * 0.32, ry * 0.72, rz * 0.32); sw.rotation.z = -0.35; add(sw); } break;
      case 'spiky': { cap(Math.PI * 0.48); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, el = 0.45 + 0.25 * ((i * 37) % 5) / 5; const c = new THREE.Mesh(new THREE.ConeGeometry(rx * 0.22, ry * 0.55 * v, 8), toon(hc)); const dir = new THREE.Vector3(Math.sin(a) * Math.cos(el) * 0.8, Math.sin(el) + 0.3, Math.cos(a) * Math.cos(el) * 0.6 - 0.25).normalize(); c.position.set(dir.x * rx * 0.85, dir.y * ry * 0.85, dir.z * rz * 0.85); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); add(c); } break; }
      case 'mohawk': { cap(Math.PI * 0.45, 1.01, -0.48, mix(hc, g.body.skinColor, 0.55)); for (let i = 0; i < 6; i++) { const a = -0.4 + i * 0.32; const c = new THREE.Mesh(new THREE.ConeGeometry(rx * 0.12, ry * 0.5 * v, 6), toon(hc)); c.scale.z = 2.2; const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a) * 1.1).normalize(); c.position.set(0, dir.y * ry, dir.z * rz); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); add(c); } break; }
      case 'bob': { cap(Math.PI * 0.62, 1.1, -0.42); const back = new THREE.Mesh(new THREE.CylinderGeometry(rx * 1.1, rx * 1.18, ry * 1.05, 28, 1, true, Math.PI * 0.62, Math.PI * 1.76), toon(hc, { side: THREE.DoubleSide })); back.scale.z = rz / rx * 1.05; back.position.y = -ry * 0.2; add(back); const bang = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(hc)); bang.scale.set(rx * 0.95, ry * 0.3, rz * 0.5); bang.position.set(0, ry * 0.5, rz * 0.62); bang.rotation.x = 0.5; add(bang); break; }
      case 'long': { cap(Math.PI * 0.58, 1.08, -0.5); const back = new THREE.Mesh(new THREE.CylinderGeometry(rx * 1.05, rx * 1.15, ry * 2.3 * v, 28, 1, true, Math.PI * 0.7, Math.PI * 1.6), toon(hc, { side: THREE.DoubleSide })); back.scale.z = rz / rx; back.position.set(0, -ry * 0.75, -rz * 0.08); add(back); break; }
      case 'ponytail': { cap(Math.PI * 0.55, 1.07, -0.58); const tie = new THREE.Mesh(new THREE.SphereGeometry(rx * 0.16, 12, 8), toon(shade(hc, 0.7))); tie.position.set(0, ry * 0.35, -rz * 1.02); add(tie); const tail = new THREE.Mesh(new THREE.CapsuleGeometry(rx * 0.2, ry * 1.1 * v, 6, 12), toon(hc)); tail.position.set(0, -ry * 0.25, -rz * 1.18); tail.rotation.x = -0.25; tail.name = 'ponytail'; add(tail); break; }
      case 'bun': { cap(Math.PI * 0.55, 1.07, -0.58); const bun = new THREE.Mesh(new THREE.SphereGeometry(rx * 0.38 * v, 16, 12), toon(hc)); bun.position.set(0, ry * 0.85, -rz * 0.55); add(bun); break; }
      case 'curly': { for (let i = 0; i < 46; i++) { const u = ((i * 0.618034) % 1), vv = (i / 46); const th = Math.acos(1 - vv * 1.15), ph = u * Math.PI * 2; if (Math.cos(th) < -0.05) continue; const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); if (dir.z > 0.55 && dir.y < 0.55) continue; const b = new THREE.Mesh(new THREE.SphereGeometry(rx * 0.24 * v, 10, 8), toon(hc)); b.position.set(dir.x * rx * 1.02, dir.y * ry * 1.02 + ry * 0.05, dir.z * rz * 1.02); add(b, false); } cap(Math.PI * 0.5, 1.04, -0.48); break; }
    }
    // beard
    const bc = g.beard.color ?? hc;
    const shell = (t0: number, t1: number, k: number, color: string, phiW = 2.5) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, Math.PI / 2 - phiW / 2, phiW, t0, t1 - t0), toon(color)); m.scale.set(rx * k, ry * k, rz * k); return m; };
    switch (g.beard.style) {
      case 'full': { const m = shell(Math.PI * 0.56, Math.PI * 0.97, 1.07, bc); add(m); const mus = new THREE.Mesh(new THREE.CapsuleGeometry(ry * 0.06, rx * 0.42, 4, 8), toon(bc)); mus.rotation.z = Math.PI / 2; mus.position.set(0, -ry * 0.3, rz * 0.98); add(mus); break; }
      case 'stubble': H.add(shell(Math.PI * 0.58, Math.PI * 0.95, 1.006, mix(g.body.skinColor, bc, 0.35))); break;
      case 'chinstrap': add(shell(Math.PI * 0.72, Math.PI * 0.95, 1.04, bc, 3)); break;
      case 'goatee': { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon(bc)); m.scale.set(rx * 0.22, ry * 0.22, rz * 0.2); m.position.set(0, -ry * 0.72, rz * 0.62); add(m); } // falls through to mustache
      // eslint-disable-next-line no-fallthrough
      case 'mustache': { for (const sx of [1, -1]) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(ry * 0.045, rx * 0.2, 4, 8), toon(bc)); m.rotation.z = Math.PI / 2 + sx * 0.3; m.position.set(sx * rx * 0.12, -ry * 0.31, rz * 0.97); add(m); } break; }
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
      const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), toon(handColor)); palm.scale.set(L * 0.17, L * 0.3, L * 0.27); palm.position.set(0, -L * 0.28, 0.0);
      hand.add(withOutline(palm, 0.005 * s));
      const list: THREE.Object3D[] = [];
      for (let i = 0; i < 4; i++) {
        const piv = new THREE.Group(); piv.position.set(-sx * L * 0.02, -L * 0.5, L * (0.17 - i * 0.11)); hand.add(piv);
        const len = L * (0.36 - Math.abs(i - 1.2) * 0.04);
        const fm = new THREE.Mesh(new THREE.CapsuleGeometry(L * 0.065, len, 4, 8), toon(handColor)); fm.position.y = -len / 2; piv.add(withOutline(fm, 0.004 * s));
        piv.userData.side = sx; list.push(piv);
      }
      const thumb = new THREE.Group(); thumb.position.set(-sx * L * 0.1, -L * 0.18, L * 0.2); thumb.rotation.set(0.5, 0, -sx * 0.6); hand.add(thumb);
      const tm = new THREE.Mesh(new THREE.CapsuleGeometry(L * 0.07, L * 0.24, 4, 8), toon(handColor)); tm.position.y = -L * 0.14; thumb.add(withOutline(tm, 0.004 * s));
      thumb.userData.thumb = true; thumb.userData.side = sx; list.push(thumb);
      this.fingers[side] = list;
      // shoes
      const foot = this.rig.bone(`${side}Foot`), toe = this.rig.bone(`${side}Toe`);
      const sh = g.outfit.shoes, sole = sh.soleColor ?? (sh.type === 'sneakers' ? '#efefea' : shade(sh.color, 0.5));
      const fl = d.footLen, ah = d.ankleH;
      const heel = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), toon(sh.color)); heel.scale.set(d.legR * 0.95, ah * 0.85, fl * 0.42); heel.position.set(0, -ah * 0.35, fl * 0.12);
      foot.add(withOutline(heel, 0.006 * s));
      const soleM = new THREE.Mesh(new THREE.BoxGeometry(d.legR * 1.75, ah * 0.28, fl * 0.66), toon(sole)); soleM.position.set(0, -ah * 0.86, fl * 0.12); foot.add(withOutline(soleM, 0.005 * s));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), toon(sh.color)); cap.scale.set(d.legR * 0.92, ah * 0.6, fl * 0.24); cap.position.set(0, -ah * 0.42 + (foot.position.y - toe.position.y) * 0 - 0.0, 0.0);
      // toe cap sits on the toe bone so the shoe bends at toe-off
      const tl = toe.position;
      cap.position.set(0, -tl.y - ah * 0.42, 0.02 * s);
      toe.add(withOutline(cap, 0.006 * s));
      const toeSole = new THREE.Mesh(new THREE.BoxGeometry(d.legR * 1.6, ah * 0.28, fl * 0.3), toon(sole)); toeSole.position.set(0, -tl.y - ah * 0.86, 0.03 * s); toe.add(toeSole);
      if (sh.type === 'boots') { const cuff = new THREE.Mesh(new THREE.CylinderGeometry(d.legR * 0.95, d.legR * 0.9, ah * 0.9, 14), toon(sh.color)); cuff.position.y = ah * 0.25; foot.add(withOutline(cuff, 0.005 * s)); }
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
        case 'headset': { const band = new THREE.Mesh(new THREE.TorusGeometry(rx * 1.08, 0.012 * s, 6, 24, Math.PI), toon(a.color)); band.position.y = 0; band.scale.y = ry / rx * 1.08; H.add(band); for (const sx of [1, -1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(rx * 0.22, rx * 0.22, 0.04 * s, 16), toon(c2)); cup.rotation.z = Math.PI / 2; cup.position.set(sx * rx * 1.05, -ry * 0.05, 0); H.add(withOutline(cup, 0.004 * s)); } const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.006 * s, rx * 0.7, 4, 6), toon(a.color)); mic.rotation.set(0, 0, Math.PI / 2 - 0.2); mic.position.set(rx * 0.75, -ry * 0.35, rz * 0.65); mic.rotation.y = -0.9; H.add(mic); break; }
        case 'earrings': for (const sx of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 8, 6), toon(a.color)); e.position.set(sx * rx * 0.98, -ry * 0.38, -rz * 0.02); H.add(e); } break;
        case 'scarf': { const chest = this.rig.bone('chest'); const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 8, 24), toon(a.color)); t.rotation.x = Math.PI / 2; t.scale.set(d.headRx * 0.6, d.headRz * 0.6, d.headRx * 0.6); t.position.copy(chest.worldToLocal(this.boneWorldY('neck').clone().add(new THREE.Vector3(0, -0.01 * s, 0)))); chest.add(withOutline(t, 0.004 * s)); break; }
        case 'toolbelt': case 'apron': { const hips = this.rig.bone('hips'); const y = (this.boneWorldY('hips').y + this.boneWorldY('spine').y) / 2 - 0.02 * s; if (a.type === 'toolbelt') { const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 6, 28), toon(a.color)); t.rotation.x = Math.PI / 2; t.scale.set(d.waistRx * 1.12 + g.body.belly * 0.03, d.chestRz * 1.02 + g.body.belly * 0.07, d.waistRx * 0.3); t.position.copy(hips.worldToLocal(new THREE.Vector3(0, y, 0))); hips.add(withOutline(t, 0.004 * s)); for (const [px, pz] of [[0.9, 0.3], [-0.9, 0.3], [0.6, 0.8]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.08 * s, 0.035 * s), toon(c2)); p.position.copy(hips.worldToLocal(new THREE.Vector3(px * d.waistRx * 1.1, y - 0.045 * s, pz * d.chestRz * 1.05))); p.lookAt(hips.localToWorld(new THREE.Vector3(0, p.position.y, 0))); p.rotateY(Math.PI); hips.add(withOutline(p, 0.003 * s)); } const wrench = new THREE.Mesh(new THREE.BoxGeometry(0.012 * s, 0.12 * s, 0.02 * s), toon('#a7b0ba')); wrench.position.copy(hips.worldToLocal(new THREE.Vector3(-0.9 * d.waistRx * 1.1, y - 0.06 * s, 0.32 * d.chestRz + 0.03 * s))); hips.add(wrench); } else { const chest = this.rig.bone('chest'); const bib = new THREE.Mesh(new THREE.BoxGeometry(d.chestRx * 1.25, 0.24 * s, 0.012 * s), toon(a.color)); bib.position.copy(chest.worldToLocal(new THREE.Vector3(0, this.boneWorldY('chest').y + 0.02 * s, d.chestRz * 1.1 + 0.01 * s))); chest.add(withOutline(bib, 0.004 * s)); const skirt = new THREE.Mesh(new THREE.BoxGeometry(d.hipRx * 1.6, 0.42 * s, 0.012 * s), toon(a.color)); skirt.position.copy(hips.worldToLocal(new THREE.Vector3(0, y - 0.2 * s, d.chestRz * 1.05 + 0.02 * s))); hips.add(withOutline(skirt, 0.004 * s)); } break; }
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
    case 'roundedBox': { g = new THREE.SphereGeometry(1, 20, 14); const pa = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pa.count; i++) { const vx = pa.getX(i), vy = pa.getY(i), vz = pa.getZ(i); const k = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 0.35); pa.setXYZ(i, k(vx) * x / 2, k(vy) * y / 2, k(vz) * z / 2); } g.computeVertexNormals(); break; }
    case 'capsule': g = new THREE.CapsuleGeometry(x, Math.max(0.001, y - 2 * x), 6, 14); break;
    case 'cylinder': g = new THREE.CylinderGeometry(x, z || x, y, 20); break;
    case 'cone': g = new THREE.ConeGeometry(x, y, 18); break;
    case 'torus': g = new THREE.TorusGeometry(x, y, 10, 24); break;
    default: { g = new THREE.SphereGeometry(1, 22, 16); g.scale(x, y, z); }
  }
  const m = new THREE.Mesh(g, toon(p.color, p.emissive ? { emissive: p.emissive, emissiveIntensity: p.emissiveIntensity ?? 1 } : {}));
  m.name = p.id; m.position.set(p.position[0], p.position[1], p.position[2]);
  if (p.rotationDeg) m.rotation.set(p.rotationDeg[0] * DEG, p.rotationDeg[1] * DEG, p.rotationDeg[2] * DEG);
  m.castShadow = true; m.receiveShadow = true;
  return p.outline === false ? m : withOutline(m, 0.008 * scale);
}
