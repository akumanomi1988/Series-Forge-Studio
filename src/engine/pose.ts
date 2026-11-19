/** Deterministic pose & scene evaluation: state(t) is a pure function of the resolved timeline and t.
 * Shared verbatim by the browser editor, the headless exporter and Node tests. */
import * as THREE from 'three';
import { DEG, clamp, lerp, ease, intervalWeight, rotateY, smoothstep, angleDiff, noise1, hash01 } from './math.ts';
import type { Vec3 } from './math.ts';
import { humanoidSkeleton, HUMANOID_BONES, LAYER_MASKS, JOINT_LIMITS } from './humanoid.ts';
import type { HumanoidDims } from './humanoid.ts';
import { sampleClip, sampleWeightKeys } from './clip.ts';
import { evaluateFace } from './face.ts';
import type { FaceState } from './face.ts';
import type { ActorTimeline, ResolvedScene, TargetRef, PropTimeline, Step, RootSegment, AssetLibrary, PropSegment } from './timeline.ts';
import type { CharacterGeometry, Locomotion, ClipV2 } from './schema.ts';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'XYZ'), _m = new THREE.Matrix4();
const qFromDeg = (x: number, y: number, z: number, out = new THREE.Quaternion()) => out.setFromEuler(_e.set(x * DEG, y * DEG, z * DEG, 'XYZ'));
export const DEFAULT_WALK: Locomotion = { schemaVersion: 2, id: 'walk', kind: 'locomotion', rigType: 'humanoid', gait: 'walk', speed: 1.25, strideScale: 1, stepHeight: 0.11, bob: 0.025, sway: 0.02, hipYawDeg: 6, armSwingDeg: 24, elbowBendDeg: 18, leanDeg: 3, crouch: 0, flight: 0 };

export class RigInstance {
  readonly group = new THREE.Group();
  readonly bones = new Map<string, THREE.Bone>();
  readonly rest = new Map<string, THREE.Vector3>();
  readonly dims: HumanoidDims;
  constructor(readonlyGeometry: CharacterGeometry, offsets: Record<string, Vec3> = {}) {
    const { bones, dims } = humanoidSkeleton(readonlyGeometry.body, offsets);
    this.dims = dims;
    for (const b of bones) { const bone = new THREE.Bone(); bone.name = b.id; bone.position.set(...b.position); this.bones.set(b.id, bone); this.rest.set(b.id, new THREE.Vector3(...b.position)); }
    for (const b of bones) (b.parent ? this.bones.get(b.parent)! : this.group).add(this.bones.get(b.id)!);
  }
  bone(id: string): THREE.Bone { return this.bones.get(id)!; }
  resetToRest(): void { for (const [id, b] of this.bones) { b.position.copy(this.rest.get(id)!); b.quaternion.identity(); } }
  /** Euler offsets (deg) of every bone, for QA. */
  localEulers(): Record<string, Vec3> { const out: Record<string, Vec3> = {}; for (const [id, b] of this.bones) { const e = new THREE.Euler().setFromQuaternion(b.quaternion, 'XYZ'); out[id] = [e.x / DEG, e.y / DEG, e.z / DEG]; } return out; }
  worldPos(id: string, out = new THREE.Vector3()): THREE.Vector3 { return this.bones.get(id)!.getWorldPosition(out); }
}

export interface ActorPose { face: FaceState; eyeYaw: number; eyePitch: number; grip: { left: number; right: number }; speaking: number; mouthEnergy: number; rootPos: Vec3; yaw: number; contacts: { left: boolean; right: boolean } }
export interface SceneContext {
  targetWorld(target: TargetRef, t: number, self: string): THREE.Vector3 | null;
  cameraPos: THREE.Vector3;
}

// ---------------------------------------------------------------- root & feet
export function walkProfile(u: number): number {
  // trapezoidal velocity profile, 20% accel / 20% decel, normalised distance.
  const a = 0.2, vmax = 1 / (1 - a);
  if (u <= 0) return 0; if (u >= 1) return 1;
  if (u < a) return 0.5 * vmax * u * u / a;
  if (u > 1 - a) { const r = 1 - u; return 1 - 0.5 * vmax * r * r / a; }
  return 0.5 * vmax * a + vmax * (u - a);
}
export function rootAt(tl: ActorTimeline, t: number): { position: Vec3; yaw: number; seg: RootSegment; u: number } {
  const segs = tl.root;
  let seg = segs[0];
  for (const s of segs) { if (s.start <= t) seg = s; else break; }
  const u = seg.end > seg.start ? clamp((t - seg.start) / (seg.end - seg.start), 0, 1) : 1;
  if (seg.kind === 'walk') {
    const p = walkProfile(u);
    return { position: [lerp(seg.from[0], seg.to[0], p), lerp(seg.from[1], seg.to[1], p), lerp(seg.from[2], seg.to[2], p)], yaw: seg.yawTo, seg, u };
  }
  if (seg.kind === 'turn') return { position: [...seg.from] as Vec3, yaw: seg.yawFrom + angleDiff(seg.yawFrom, seg.yawTo) * ease(seg.ease ?? 'easeInOut', u), seg, u };
  return { position: [...seg.from] as Vec3, yaw: seg.yawFrom, seg, u };
}
export interface FootState { pos: Vec3; yaw: number; lift: number; swing: number /* 0..1 or -1 if planted */; pitch: number }
export function footAt(tl: ActorTimeline, foot: 'left' | 'right', t: number, dims: HumanoidDims): FootState {
  let last: Step | null = null;
  for (const s of tl.steps) if (s.foot === foot && s.start <= t) last = s;
  if (!last) {
    const r = tl.root[0];
    const side = foot === 'left' ? 1 : -1;
    const off = rotateY([side * dims.hipHalf, 0, 0], r.yawFrom);
    return { pos: [r.from[0] + off[0], 0, r.from[2] + off[2]], yaw: r.yawFrom, lift: 0, swing: -1, pitch: 0 };
  }
  if (t >= last.end) return { pos: [...last.to] as Vec3, yaw: last.yawTo, lift: 0, swing: -1, pitch: 0 };
  const s = (t - last.start) / Math.max(1e-6, last.end - last.start);
  const h = smoothstep(s);
  const lift = last.lift * Math.sin(Math.PI * clamp(s * 1.05, 0, 1));
  // toe-off early in the swing (heel up => foot pitched down), heel strike at the end (toes up)
  const pitch = s < 0.35 ? -28 * Math.sin(Math.PI * s / 0.35) : s > 0.75 ? 14 * Math.sin(Math.PI * (s - 0.75) / 0.25) : 0;
  return { pos: [lerp(last.from[0], last.to[0], h), 0, lerp(last.from[2], last.to[2], h)], yaw: last.yawFrom + angleDiff(last.yawFrom, last.yawTo) * h, lift, swing: s, pitch: last.lift > 0.02 ? pitch : 0 };
}

// ---------------------------------------------------------------- IK
/** Analytic two-bone IK with an explicit hinge axis (local space of the upper bone). */
export function solveTwoBone(upper: THREE.Bone, lower: THREE.Bone, end: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3, hingeSign: 1 | -1, weight = 1): void {
  if (weight <= 0) return;
  const root = upper.getWorldPosition(new THREE.Vector3());
  const l1 = lower.position.length(), l2 = end.position.length();
  const toT = target.clone().sub(root);
  let d = toT.length();
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.9995);
  const dir = toT.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const poleDir = pole.clone().sub(root); poleDir.sub(dir.clone().multiplyScalar(poleDir.dot(dir)));
  if (poleDir.lengthSq() < 1e-8) poleDir.set(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z));
  poleDir.normalize();
  const mid = root.clone().addScaledVector(dir, a).addScaledVector(poleDir, h);
  const tgt = root.clone().addScaledVector(dir, d);
  const d1 = mid.clone().sub(root).normalize(), d2 = tgt.clone().sub(mid).normalize();
  let n = new THREE.Vector3().crossVectors(d1, d2);
  if (n.lengthSq() < 1e-10) { n = new THREE.Vector3().crossVectors(d1, poleDir).multiplyScalar(-1); }
  n.normalize();
  const setWorldFrame = (bone: THREE.Bone, restDir: THREE.Vector3, desired: THREE.Vector3) => {
    const hingeLocal = new THREE.Vector3(hingeSign, 0, 0);
    const a0 = restDir.clone().normalize();
    const b0 = hingeLocal.sub(a0.clone().multiplyScalar(hingeLocal.dot(a0))).normalize();
    const c0 = new THREE.Vector3().crossVectors(a0, b0);
    const b1 = n.clone().sub(desired.clone().multiplyScalar(n.dot(desired))).normalize();
    const c1 = new THREE.Vector3().crossVectors(desired, b1);
    const mRest = new THREE.Matrix4().makeBasis(a0, b0, c0);
    const mDes = new THREE.Matrix4().makeBasis(desired, b1, c1);
    const worldQ = new THREE.Quaternion().setFromRotationMatrix(mDes.multiply(mRest.transpose()));
    const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
    const local = parentQ.invert().multiply(worldQ);
    bone.quaternion.slerp(local, weight);
    bone.updateMatrixWorld(true);
  };
  setWorldFrame(upper, lower.position, d1);
  // recompute desired for the lower bone from the actual (possibly weighted) upper result
  const midNow = lower.getWorldPosition(new THREE.Vector3());
  const d2b = tgt.clone().sub(midNow).normalize();
  setWorldFrame(lower, end.position, weight >= 1 ? d2 : d2b);
}
/** Clamp a bone's local Euler rotation to its anatomical limits. */
export function clampToLimits(bone: THREE.Bone): void {
  const lim = JOINT_LIMITS[bone.name]; if (!lim) return;
  const e = new THREE.Euler().setFromQuaternion(bone.quaternion, 'XYZ');
  const c = [e.x, e.y, e.z].map((v, i) => clamp(v, lim.min[i] * DEG, lim.max[i] * DEG));
  if (c[0] !== e.x || c[1] !== e.y || c[2] !== e.z) bone.quaternion.setFromEuler(e.set(c[0], c[1], c[2], 'XYZ'));
}
function setWorldQuaternion(bone: THREE.Object3D, worldQ: THREE.Quaternion, weight = 1) {
  const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  const local = parentQ.invert().multiply(worldQ);
  bone.quaternion.slerp(local, weight);
}

// ---------------------------------------------------------------- actor evaluation
export interface CharacterAssets { geometry: CharacterGeometry; clips: Record<string, ClipV2>; locomotion: Record<string, Locomotion>; expressions: AssetLibrary['characters'][string]['expressions'] }

function applyEulerOverride(bone: THREE.Bone | undefined, deg: Vec3, w: number) { if (!bone || w <= 0) return; qFromDeg(deg[0], deg[1], deg[2], _q); bone.quaternion.slerp(_q, w); }
function applyEulerAdd(bone: THREE.Bone | undefined, deg: Vec3, w: number) { if (!bone || w <= 0) return; qFromDeg(deg[0] * w, deg[1] * w, deg[2] * w, _q); bone.quaternion.multiply(_q); }

export function evaluateActor(rig: RigInstance, tl: ActorTimeline, assets: CharacterAssets, t: number, ctx: SceneContext | null): ActorPose {
  const dims = rig.dims;
  rig.resetToRest();
  const root = rootAt(tl, t);
  rig.group.position.set(root.position[0], 0, root.position[2]);
  rig.group.rotation.set(0, root.yaw * DEG, 0);
  const hips = rig.bone('hips');
  const clipFace = new Map<string, number>();
  const gripW = { left: 0, right: 0 };
  const ikReq: { chain: 'leftArm' | 'rightArm'; target: THREE.Vector3; w: number; grip: number }[] = [];
  const contacts = { left: 1, right: 1 };

  // 1) idle base layer, desynchronised per actor
  const idle = assets.clips[tl.idleClip] ?? assets.clips.idle;
  if (idle) {
    const sample = sampleClip(idle, t + hash01(tl.id, 'idle') * idle.duration);
    for (const [b, r] of sample.rotations) applyEulerOverride(rig.bones.get(b), r as Vec3, 1);
    for (const [b, p] of sample.positions) rig.bones.get(b)?.position.add(_v.set(...(p as Vec3)));
  }
  // 2) procedural locomotion (walk / turn steps)
  const loco = locomotionLayer(rig, tl, assets, t, root);
  // 3) clip instances
  for (const inst of tl.clips) {
    if (t < inst.start || t > inst.end) continue;
    const clip = assets.clips[inst.clip];
    if (!clip) continue;
    const w = intervalWeight(t, inst.start, inst.end, inst.fadeIn, inst.fadeOut) * inst.weight;
    if (w <= 0) continue;
    const lt = (t - inst.start) * inst.speed;
    const sample = sampleClip(inst.loop ? { ...clip, loop: true } : clip, lt);
    const mask = clip.mask ?? LAYER_MASKS[clip.layer] ?? null;
    const additive = clip.layer === 'additive';
    // while walking, full-body clips only drive the upper body
    const effMask = loco > 0.01 && !mask ? LAYER_MASKS.upper : mask;
    for (const [b, r] of sample.rotations) { if (effMask && !effMask.includes(b)) continue; (additive ? applyEulerAdd : applyEulerOverride)(rig.bones.get(b), r as Vec3, w); }
    for (const [b, p] of sample.positions) { if (effMask && !effMask.includes(b)) continue; rig.bones.get(b)?.position.addScaledVector(_v.set(...(p as Vec3)), w); }
    for (const [k, v] of sample.face) clipFace.set(k, (clipFace.get(k) ?? 0) + v * w);
    if (clip.grip) { if (clip.grip.left !== undefined) gripW.left = Math.max(gripW.left, clip.grip.left * w); if (clip.grip.right !== undefined) gripW.right = Math.max(gripW.right, clip.grip.right * w); }
    if (clip.contacts) { for (const foot of ['left', 'right'] as const) { const inContact = clip.contacts.some(c => (c.foot === foot || c.foot === 'both') && lt >= c.from && lt <= c.to); contacts[foot] = Math.min(contacts[foot], lerp(1, inContact ? 1 : 0, w)); } }
    if (ctx) for (const ik of clip.ik) {
      if (ik.chain !== 'leftArm' && ik.chain !== 'rightArm') continue;
      const iw = sampleWeightKeys(ik.weight as [number, number][], lt) * w;
      if (iw <= 0) continue;
      let target: THREE.Vector3 | null = null;
      if (inst.target && ik.target.space === 'actor' && ik.target.bone === undefined) {
        // aim gesture (pointing) at the instance target
        const tw = ctx.targetWorld(inst.target, t, tl.id);
        if (tw) { rig.group.updateMatrixWorld(true); const sh = rig.worldPos(ik.chain === 'leftArm' ? 'leftUpperArm' : 'rightUpperArm'); target = sh.clone().add(tw.clone().sub(sh).normalize().multiplyScalar(dims.armLen * 0.97)); }
      } else {
        rig.group.updateMatrixWorld(true);
        const bone = rig.bones.get(ik.target.bone ?? 'chest');
        if (bone) target = bone.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...ik.target.offset).multiplyScalar(dims.scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), root.yaw * DEG));
      }
      if (target) ikReq.push({ chain: ik.chain, target, w: iw, grip: 0.4 });
    }
  }
  // 4) expression posture (additive) and face
  const faceRes = evaluateFace(tl, assets.expressions, t, clipFace);
  for (const inst of tl.expressions) {
    const w = intervalWeight(t, inst.start, inst.end, inst.fade, inst.fade) * inst.intensity;
    if (w <= 0) continue;
    const e = assets.expressions[inst.expression];
    if (!e) continue;
    for (const [b, r] of Object.entries(e.posture)) applyEulerAdd(rig.bones.get(b), r as Vec3, w);
    if (e.clip && assets.clips[e.clip]) { const c = assets.clips[e.clip]; const s = sampleClip({ ...c, loop: true }, t - inst.start); for (const [b, r] of s.rotations) applyEulerAdd(rig.bones.get(b), r as Vec3, w); }
  }
  // head tilt/nod from the face (expressive accents) + speech head motion
  const head = rig.bone('head');
  applyEulerAdd(head, [faceRes.face.headNodDeg ?? 0, 0, faceRes.face.headTiltDeg ?? 0], 1);
  if (faceRes.speaking > 0) {
    const nod = noise1(hash01(tl.id) * 1000, t * 2.2) * 4 + faceRes.mouthEnergy * 3;
    applyEulerAdd(head, [nod, noise1(hash01(tl.id, 'y') * 1000, t * 1.3) * 3, noise1(hash01(tl.id, 'z') * 1000, t * 1.1) * 2], faceRes.speaking);
    applyEulerAdd(rig.bone('chest'), [noise1(hash01(tl.id, 'c') * 1000, t * 1.7) * 1.5, 0, 0], faceRes.speaking);
  }
  // 5) hips offsets: crouch / sit
  let hipsOffset = new THREE.Vector3(), spinePitch = 0;
  for (const h of tl.hips) { const w = intervalWeight(t, h.start, h.end, h.fadeIn, h.fadeOut); if (w <= 0) continue; hipsOffset.addScaledVector(_v.set(...h.offset), w); spinePitch += h.spinePitch * w; }
  for (const s of tl.sits) {
    const w = intervalWeight(t, s.start, s.end, s.fadeIn, s.fadeOut);
    if (w <= 0) continue;
    // move hips over the seat (actor-local) and lean back slightly
    const local = rotateY([s.seat[0] - root.position[0], 0, s.seat[2] - root.position[2]], -root.yaw);
    const target = new THREE.Vector3(local[0], s.seat[1] + 0.06 * dims.scale - rig.rest.get('hips')!.y, local[2]);
    hipsOffset.lerp(target, w);
    spinePitch += -6 * w;
    applyEulerAdd(rig.bone('leftUpperArm'), [-18, 0, 4], w); applyEulerAdd(rig.bone('rightUpperArm'), [-18, 0, -4], w);
    applyEulerAdd(rig.bone('leftLowerArm'), [-35, 0, 0], w); applyEulerAdd(rig.bone('rightLowerArm'), [-35, 0, 0], w);
  }
  hips.position.add(hipsOffset);
  // crouch keeps the reach: bend spine forward proportionally to the drop
  // hip hinge: pelvis tilt + spine + chest (legs are re-solved by IK afterwards)
  applyEulerAdd(hips, [spinePitch * 0.3, 0, 0], 1);
  applyEulerAdd(rig.bone('spine'), [spinePitch * 0.4, 0, 0], 1);
  applyEulerAdd(rig.bone('chest'), [spinePitch * 0.3, 0, 0], 1);
  applyEulerAdd(rig.bone('neck'), [-spinePitch * 0.25, 0, 0], 1);
  // 6) look-at (spine/neck/head distribution) and eye gaze
  rig.group.updateMatrixWorld(true);
  let eyeYaw = noise1(hash01(tl.id, 'sacc') * 999, t * 0.7) * 4, eyePitch = noise1(hash01(tl.id, 'saccp') * 999, t * 0.6) * 2;
  let gazePoint: THREE.Vector3 | null = null;
  if (ctx) {
    for (const look of tl.looks) {
      const w = intervalWeight(t, look.start, look.end, look.fade, look.fade);
      if (w <= 0) continue;
      const p = ctx.targetWorld(look.target, t, tl.id);
      if (!p) continue;
      const headPos = rig.worldPos('head').add(_v2.set(0, dims.headCenter, 0));
      const local = p.clone().sub(headPos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -root.yaw * DEG);
      const yaw = clamp(Math.atan2(local.x, local.z) / DEG, -115, 115);
      const pitch = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)) / DEG, -40, 40);
      const share = look.mode === 'eyes' ? [0, 0, 0.15] : look.mode === 'chest' ? [0.35, 0.25, 0.4] : [0.15, 0.3, 0.55];
      // remove the yaw already applied by the base pose so the head really reaches the target
      applyEulerAdd(rig.bone('chest'), [pitch * share[0] * 0.3, yaw * share[0], 0], w);
      applyEulerAdd(rig.bone('neck'), [pitch * share[1], yaw * share[1], 0], w);
      applyEulerAdd(head, [pitch * share[2], yaw * share[2], 0], w);
      gazePoint = w > 0.5 ? p : gazePoint;
    }
  }
  rig.group.updateMatrixWorld(true);
  if (gazePoint) {
    const headQ = head.getWorldQuaternion(new THREE.Quaternion()).invert();
    const headPos = rig.worldPos('head').add(_v2.set(0, dims.headCenter, 0).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())));
    const dir = gazePoint.clone().sub(headPos).applyQuaternion(headQ);
    eyeYaw = clamp(Math.atan2(dir.x, dir.z) / DEG, -32, 32);
    eyePitch = clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) / DEG, -22, 22);
  }
  // 7) legs IK to planted / swinging feet. First lower the pelvis just enough for both feet to be reachable
  //    (keeps a natural knee bend at double support instead of over-stretched, sliding legs).
  const feet = { left: footAt(tl, 'left', t, dims), right: footAt(tl, 'right', t, dims) };
  {
    const Lmax = (dims.thighLen + dims.shinLen) * 0.975;
    let drop = 0;
    for (const side of ['left', 'right'] as const) {
      if (contacts[side] < 0.5) continue;
      const f = feet[side];
      const hip = rig.worldPos(`${side}Thigh`);
      const dx = hip.x - f.pos[0], dz = hip.z - f.pos[2], dy = hip.y - (dims.ankleH + f.lift);
      const horiz2 = dx * dx + dz * dz;
      const need = horiz2 < Lmax * Lmax ? dy - Math.sqrt(Lmax * Lmax - horiz2) : dy - Lmax * 0.3;
      drop = Math.max(drop, need);
    }
    if (drop > 0) { hips.position.y -= drop; rig.group.updateMatrixWorld(true); }
  }
  for (const side of ['left', 'right'] as const) {
    const f = feet[side];
    const thigh = rig.bone(`${side}Thigh`), shin = rig.bone(`${side}Shin`), foot = rig.bone(`${side}Foot`);
    const w = contacts[side];
    const ankle = new THREE.Vector3(f.pos[0], dims.ankleH + f.lift, f.pos[2]);
    const fwd = new THREE.Vector3(Math.sin(f.yaw * DEG), 0, Math.cos(f.yaw * DEG));
    const hipW = thigh.getWorldPosition(new THREE.Vector3());
    const pole = hipW.clone().lerp(ankle, 0.5).addScaledVector(fwd, 0.6).add(new THREE.Vector3(Math.cos(root.yaw * DEG), 0, -Math.sin(root.yaw * DEG)).multiplyScalar((side === 'left' ? 1 : -1) * 0.08));
    solveTwoBone(thigh, shin, foot, ankle, pole, 1, w);
    const footQ = new THREE.Quaternion().setFromEuler(_e.set(f.pitch * DEG, f.yaw * DEG, 0, 'YXZ'));
    setWorldQuaternion(foot, footQ, w);
    clampToLimits(foot);
    if (f.swing >= 0 && f.swing < 0.35) applyEulerAdd(rig.bone(`${side}Toe`), [28 * Math.sin(Math.PI * f.swing / 0.35), 0, 0], 1);
    foot.updateMatrixWorld(true);
  }
  // 8) hand IK (reach, hold, gestures)
  if (ctx) {
    for (const h of tl.hands) {
      const w = intervalWeight(t, h.start, h.end, h.fadeIn, h.fadeOut);
      if (w <= 0) continue;
      const resolve = (tr: TargetRef): THREE.Vector3 | null => {
        if (tr.kind === 'bone') { const b = rig.bones.get(tr.bone); return b ? b.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...tr.offset).multiplyScalar(dims.scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), root.yaw * DEG)) : null; }
        if (tr.kind === 'blend') { const a = resolve(tr.from), b = resolve(tr.to); if (!a || !b) return a ?? b; return a.lerp(b, ease(tr.ease ?? 'easeInOut', (t - tr.start) / Math.max(1e-6, tr.end - tr.start))); }
        return ctx.targetWorld(tr, t, tl.id);
      };
      const target = resolve(h.target);
      if (!target) continue;
      ikReq.push({ chain: h.hand === 'left' ? 'leftArm' : 'rightArm', target, w, grip: h.grip });
    }
  }
  for (const r of ikReq) {
    const side = r.chain === 'leftArm' ? 'left' : 'right', sx = side === 'left' ? 1 : -1;
    const upper = rig.bone(`${side}UpperArm`), lower = rig.bone(`${side}LowerArm`), hand = rig.bone(`${side}Hand`);
    const sh = upper.getWorldPosition(new THREE.Vector3());
    // wrist sits a palm-length before the grip point
    const dir = r.target.clone().sub(sh); const dl = dir.length(); dir.normalize();
    const wrist = sh.clone().addScaledVector(dir, Math.max(0.05, dl - dims.handLen * 0.45));
    const back = new THREE.Vector3(sx * 0.55, -0.45, -0.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), root.yaw * DEG);
    const behind = r.target.clone().sub(rig.worldPos('chest')).applyAxisAngle(new THREE.Vector3(0, 1, 0), -root.yaw * DEG).z < -0.05;
    if (behind) back.copy(new THREE.Vector3(sx * 0.8, -0.1, 0.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), root.yaw * DEG));
    solveTwoBone(upper, lower, hand, wrist, sh.clone().add(back), -1, r.w);
    // hand continues the forearm, slight wrist flex
    const fq = lower.getWorldQuaternion(new THREE.Quaternion());
    setWorldQuaternion(hand, fq.multiply(qFromDeg(-10, 0, 0)), r.w);
    hand.updateMatrixWorld(true);
    gripW[side] = Math.max(gripW[side], r.grip * r.w);
  }
  rig.group.updateMatrixWorld(true);
  return { face: faceRes.face, eyeYaw, eyePitch, grip: gripW, speaking: faceRes.speaking, mouthEnergy: faceRes.mouthEnergy, rootPos: root.position, yaw: root.yaw, contacts: { left: contacts.left > 0.5, right: contacts.right > 0.5 } };
}

/** Procedural gait layer. Returns locomotion weight. */
function locomotionLayer(rig: RigInstance, tl: ActorTimeline, assets: CharacterAssets, t: number, root: ReturnType<typeof rootAt>): number {
  const seg = root.seg;
  if (seg.kind === 'hold') return 0;
  const g = seg.gait ?? assets.locomotion.walk ?? DEFAULT_WALK;
  const w = seg.kind === 'walk' ? intervalWeight(t, seg.start, seg.end, 0.2, 0.25) : intervalWeight(t, seg.start, seg.end, 0.15, 0.15) * 0.35;
  // active step
  let step: Step | null = null;
  for (const s of tl.steps) if (s.start <= t && t < s.end) { step = s; break; }
  const s = step ? (t - step.start) / Math.max(1e-6, step.end - step.start) : 0;
  const dir = step ? (step.foot === 'left' ? 1 : -1) : 0;
  const hips = rig.bone('hips');
  const sc = rig.dims.scale;
  if (step) {
    hips.position.y += (-g.bob * sc * (1 - Math.sin(Math.PI * s)) - g.crouch * sc) * w;
    hips.position.x += -dir * g.sway * sc * Math.sin(Math.PI * s) * w;
    const pelvisYaw = -dir * g.hipYawDeg * (2 * s - 1);
    applyEulerAdd(hips, [0, pelvisYaw, dir * 2.5 * Math.sin(Math.PI * s)], w);
    applyEulerAdd(rig.bone('chest'), [0, -pelvisYaw * 1.6, 0], w);
    applyEulerAdd(rig.bone('head'), [0, pelvisYaw * 0.4, 0], w);
    const A = g.armSwingDeg;
    const same = lerp(-A, A, smoothstep(s)), opp = -same;
    const leftArm = dir > 0 ? same : opp, rightArm = dir > 0 ? opp : same;
    applyEulerOverride(rig.bone('leftUpperArm'), [leftArm, 0, 6], w);
    applyEulerOverride(rig.bone('rightUpperArm'), [rightArm, 0, -6], w);
    applyEulerOverride(rig.bone('leftLowerArm'), [-g.elbowBendDeg - Math.max(0, -leftArm) * 0.6, 0, 0], w);
    applyEulerOverride(rig.bone('rightLowerArm'), [-g.elbowBendDeg - Math.max(0, -rightArm) * 0.6, 0, 0], w);
  }
  applyEulerAdd(rig.bone('spine'), [g.leanDeg, 0, 0], w);
  return w;
}

// ---------------------------------------------------------------- props
export interface PropWorld { matrix: THREE.Matrix4; joints: Record<string, number> }
const PALM = (dims: HumanoidDims) => new THREE.Vector3(0, -dims.handLen * 0.5, 0.02 * dims.scale);

export class SceneEvaluator {
  readonly rigs = new Map<string, RigInstance>();
  private probes = new Map<string, RigInstance>();
  private releaseCache = new Map<string, { m: THREE.Matrix4; v: THREE.Vector3 }>();
  readonly poses = new Map<string, ActorPose>();
  cameraPos = new THREE.Vector3(0, 1.6, 6);
  private time = 0;
  readonly scene: ResolvedScene;
  readonly lib: AssetLibrary;
  constructor(scene: ResolvedScene, lib: AssetLibrary) {
    this.scene = scene; this.lib = lib;
    for (const a of scene.actors) {
      const c = lib.characters[a.characterId];
      if (!c) throw new Error(`Personaje no cargado: ${a.characterId}`);
      this.rigs.set(a.id, new RigInstance(c.geometry, c.rigOffsets));
      this.probes.set(a.id, new RigInstance(c.geometry, c.rigOffsets));
    }
  }
  assetsFor(actorId: string): CharacterAssets { const a = this.scene.actors.find(x => x.id === actorId)!; const c = this.lib.characters[a.characterId]; return { geometry: c.geometry, clips: c.clips, locomotion: c.locomotion, expressions: c.expressions }; }
  /** Evaluate every actor at time t (props are derived on demand). */
  evaluate(t: number): void {
    this.time = t;
    for (const a of this.scene.actors) this.poses.set(a.id, evaluateActor(this.rigs.get(a.id)!, a, this.assetsFor(a.id), t, this.ctx(t)));
  }
  private ctx(_t: number): SceneContext {
    return { targetWorld: (target, t, self) => this.targetWorld(target, t, self), cameraPos: this.cameraPos };
  }
  /** Approximate head position of an actor without evaluating its full pose (avoids evaluation cycles). */
  headWorld(actorId: string, t: number): THREE.Vector3 {
    const a = this.scene.actors.find(x => x.id === actorId);
    if (!a) return new THREE.Vector3();
    const rig = this.rigs.get(actorId)!;
    const r = rootAt(a, t);
    let y = rig.rest.get('hips')!.y + (rig.dims.height - rig.dims.headRy * 0.9 - rig.rest.get('hips')!.y);
    for (const s of a.sits) y -= (rig.rest.get('hips')!.y - s.seat[1] - 0.06) * intervalWeight(t, s.start, s.end, s.fadeIn, s.fadeOut);
    for (const h of a.hips) y += h.offset[1] * intervalWeight(t, h.start, h.end, h.fadeIn, h.fadeOut);
    return new THREE.Vector3(r.position[0], y, r.position[2]);
  }
  targetWorld(target: TargetRef, t: number, _self: string): THREE.Vector3 | null {
    switch (target.kind) {
      case 'point': return new THREE.Vector3(...target.position);
      case 'camera': return this.cameraPos.clone();
      case 'actor': return target.bone === 'head' || !target.bone ? this.headWorld(target.actor, t) : (() => { const r = this.rigs.get(target.actor); return r?.bones.get(target.bone!) ? r.worldPos(target.bone!) : this.headWorld(target.actor, t); })();
      case 'prop': {
        const pw = this.propWorld(target.prop, t);
        if (!pw) return null;
        const geo = this.lib.props[this.scene.props.find(p => p.id === target.prop)?.propId ?? ''];
        const anchor = geo?.anchors[target.anchor ?? 'grip'];
        return new THREE.Vector3(...(anchor?.position ?? [0, 0, 0])).applyMatrix4(pw.matrix);
      }
      case 'bone': return null;
      case 'blend': { const a = this.targetWorld(target.from, t, _self), b = this.targetWorld(target.to, t, _self); if (!a || !b) return a ?? b; return a.lerp(b, ease(target.ease ?? 'easeInOut', (t - target.start) / Math.max(1e-6, target.end - target.start))); }
    }
  }
  private segmentAt(p: PropTimeline, t: number): PropSegment | null { let seg: PropSegment | null = null; for (const s of p.segments) if (s.start <= t) seg = s; return seg; }
  /** Hand-held prop transform at time t for actor (uses already-evaluated pose when t is current time). */
  private heldMatrix(actor: string, hand: 'left' | 'right', propId: string, t: number, useProbe: boolean): THREE.Matrix4 {
    let rig = this.rigs.get(actor)!;
    if (useProbe) { rig = this.probes.get(actor)!; const a = this.scene.actors.find(x => x.id === actor)!; evaluateActor(rig, a, this.assetsFor(actor), t, this.ctx(t)); }
    const handBone = rig.bone(`${hand}Hand`);
    const geo = this.lib.props[this.scene.props.find(p => p.id === propId)?.propId ?? ''];
    const grip = geo?.anchors.grip ?? { position: [0, 0, 0] as Vec3, rotationDeg: [0, 0, 0] as Vec3 };
    const gripM = new THREE.Matrix4().compose(new THREE.Vector3(...grip.position), qFromDeg(...grip.rotationDeg as Vec3), new THREE.Vector3(1, 1, 1)).invert();
    const palm = new THREE.Matrix4().makeTranslation(PALM(rig.dims));
    return handBone.matrixWorld.clone().multiply(palm).multiply(gripM);
  }
  propWorld(propId: string, t: number = this.time): PropWorld | null {
    const p = this.scene.props.find(x => x.id === propId);
    if (!p) return null;
    const joints: Record<string, number> = {};
    for (const j of p.joints) { if (t >= j.start) joints[j.joint] = lerp(j.fromDeg, j.toDeg, ease(j.ease ?? 'easeInOut', (t - j.start) / Math.max(1e-6, j.end - j.start))); }
    const seg = this.segmentAt(p, t);
    const scale = new THREE.Vector3(p.scale, p.scale, p.scale);
    if (!seg) return null;
    if (seg.kind === 'static') return { matrix: new THREE.Matrix4().compose(new THREE.Vector3(...seg.position), qFromDeg(...(seg.rotationDeg ?? [0, 0, 0]) as Vec3).premultiply(qFromDeg(0, seg.yawDeg, 0)), scale), joints };
    if (seg.kind === 'on') {
      const parent = this.propWorld(seg.prop, t);
      const pgeo = this.lib.props[this.scene.props.find(x => x.id === seg.prop)?.propId ?? ''];
      const anchor = pgeo?.anchors[seg.anchor]?.position ?? [0, 0, 0];
      const local = new THREE.Matrix4().compose(new THREE.Vector3(anchor[0] + seg.offset[0], anchor[1] + seg.offset[1], anchor[2] + seg.offset[2]), qFromDeg(0, seg.yawDeg, 0), scale);
      return { matrix: (parent?.matrix.clone() ?? new THREE.Matrix4()).multiply(local), joints };
    }
    if (seg.kind === 'held') {
      const current = Math.abs(t - this.time) < 1e-9 && this.poses.has(seg.actor);
      return { matrix: this.heldMatrix(seg.actor, seg.hand, propId, t, !current).scale(scale), joints };
    }
    // fall: analytic ballistic motion with bounces, then rest
    const key = `${propId}@${seg.start}`;
    let rel = this.releaseCache.get(key);
    if (!rel) {
      const m0 = this.heldMatrix(seg.actor, seg.hand, propId, seg.start, true);
      const mPrev = this.heldMatrix(seg.actor, seg.hand, propId, Math.max(0, seg.start - 0.05), true);
      const v = new THREE.Vector3().setFromMatrixPosition(m0).sub(new THREE.Vector3().setFromMatrixPosition(mPrev)).divideScalar(0.05);
      v.clampLength(0, 2.5);
      rel = { m: m0, v }; this.releaseCache.set(key, rel);
    }
    const p0 = new THREE.Vector3().setFromMatrixPosition(rel.m), q0 = new THREE.Quaternion().setFromRotationMatrix(rel.m);
    const restQ = qFromDeg(...seg.restRotationDeg as Vec3).premultiply(qFromDeg(0, seg.restYaw, 0));
    const tau = t - seg.start;
    const pos = fallPosition(p0, rel.v, seg.floorY, tau, seg.impacts.map(x => x - seg.start), new THREE.Vector3(...seg.rest));
    const landT = seg.impacts.length ? seg.impacts[seg.impacts.length - 1] - seg.start : 0.5;
    const spin = smoothstep(tau / Math.max(0.05, landT));
    const q = q0.clone().slerp(restQ, spin);
    if (tau < landT) { const wob = Math.sin(tau * 31) * (1 - spin) * 0.6; q.multiply(qFromDeg(wob * 40, wob * 25, 0)); }
    return { matrix: new THREE.Matrix4().compose(pos, q, scale), joints };
  }
}
/** Ballistic fall with up to 2 damped bounces. impacts[] are relative times computed by the director. */
export function fallPosition(p0: THREE.Vector3, v0: THREE.Vector3, floorY: number, tau: number, impacts: number[], rest: THREE.Vector3): THREE.Vector3 {
  const g = 9.81;
  if (!impacts.length || tau >= impacts[impacts.length - 1]) return rest.clone();
  const first = impacts[0];
  if (tau <= first) {
    const p = new THREE.Vector3(p0.x + v0.x * tau, p0.y + v0.y * tau - 0.5 * g * tau * tau, p0.z + v0.z * tau);
    return p;
  }
  // bounces: interpolate horizontally towards rest, vertical parabolas between impacts
  let i = 0; while (i + 1 < impacts.length && tau > impacts[i + 1]) i++;
  const a = impacts[i], b = impacts[i + 1] ?? a + 0.01;
  const u = (tau - a) / Math.max(1e-6, b - a);
  const hitPos = new THREE.Vector3(p0.x + v0.x * first, floorY, p0.z + v0.z * first);
  const horiz = hitPos.clone().lerp(rest, smoothstep((tau - first) / Math.max(1e-6, impacts[impacts.length - 1] - first)));
  const dur = b - a;
  const h = g * dur * dur / 8;
  return new THREE.Vector3(horiz.x, floorY + 4 * h * u * (1 - u), horiz.z);
}
/** Joint-limit QA: returns violations in degrees for the current rig pose. */
export function jointLimitViolations(rig: RigInstance, tolerance = 2): { bone: string; axis: number; value: number }[] {
  const out: { bone: string; axis: number; value: number }[] = [];
  const e = rig.localEulers();
  for (const [bone, lim] of Object.entries(JOINT_LIMITS)) {
    const v = e[bone]; if (!v || bone === 'hips') continue;
    for (let i = 0; i < 3; i++) if (v[i] < lim.min[i] - tolerance || v[i] > lim.max[i] + tolerance) out.push({ bone, axis: i, value: v[i] });
  }
  return out;
}
export { HUMANOID_BONES };
