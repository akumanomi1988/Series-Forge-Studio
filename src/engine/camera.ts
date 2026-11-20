/** Deterministic shot camera evaluation from cinematic framings. Pure (uses SceneEvaluator queries only). */
import * as THREE from 'three';
import { DEG, clamp, ease, noise1, hash01 } from './math.ts';
import type { ResolvedScene, ResolvedShot } from './timeline.ts';
import type { SceneEvaluator } from './pose.ts';

export interface CameraState { position: THREE.Vector3; target: THREE.Vector3; fov: number }
export interface ShotEval { shot: ResolvedShot; index: number; camera: CameraState; transition: { type: 'dissolve' | 'fade' | 'iris' | 'wipe'; progress: number; previous: CameraState | null } | null }

const EXTENT: Record<string, number> = { establishing: 6.5, wide: 4.2, full: 2.3, medium: 1.25, 'medium-close': 0.85, close: 0.52, 'extreme-close': 0.3, 'two-shot': 1.5, 'over-shoulder': 1.0, insert: 0.45 };

function subjectPoint(ev: SceneEvaluator, id: string, t: number, framing: string): THREE.Vector3 {
  const actor = ev.scene.actors.find(a => a.id === id);
  if (actor) {
    const head = ev.headWorld(id, t);
    const drop = framing === 'full' || framing === 'wide' ? 0.75 : framing === 'medium' ? 0.32 : framing === 'medium-close' ? 0.16 : 0.03;
    return head.clone().add(new THREE.Vector3(0, -drop * (head.y / 1.6), 0));
  }
  const p = ev.propWorld(id, t);
  if (p) { const v = new THREE.Vector3().setFromMatrixPosition(p.matrix); v.y += 0.1; return v; }
  return new THREE.Vector3(0, 1.2, 0);
}
/** Direction the face points (head bone forward, including look-at), evaluated deterministically at t. */
function facingOf(ev: SceneEvaluator, id: string, t: number, t1 = t): number {
  const a = ev.scene.actors.find(x => x.id === id);
  if (!a) return 0;
  // average face direction over the shot so a head turn right after the cut does not leave us behind the head
  const acc = new THREE.Vector3();
  const n = t1 > t + 0.05 ? 5 : 1;
  for (let i = 0; i < n; i++) acc.add(ev.faceForward(id, n === 1 ? t : t + (t1 - t) * (i / (n - 1)) * 0.85));
  return Math.atan2(acc.x, acc.z) / DEG;
}
/** Rotate the camera around the subject until no other actor blocks the view (vertical capsules r=0.32 m). */
function unoccluded(ev: SceneEvaluator, subjects: string[], t: number, target: THREE.Vector3, position: THREE.Vector3): THREE.Vector3 {
  const blockers: { x: number; z: number; top: number; r: number }[] = ev.scene.actors.filter(a => !subjects.includes(a.id)).map(a => { const h = ev.headWorld(a.id, t); return { x: h.x, z: h.z, top: h.y + 0.25, r: 0.42 }; });
  for (const pr of ev.scene.props) { if (subjects.includes(pr.id)) continue; const g = ev.lib.props[pr.propId]; const r = g?.generator === 'robot' ? 0.4 : g?.generator === 'shelf' || g?.generator === 'workbench' ? 0.7 : 0; if (!r) continue; const w = ev.propWorld(pr.id, t); if (!w) continue; const c = new THREE.Vector3().setFromMatrixPosition(w.matrix); blockers.push({ x: c.x, z: c.z, top: c.y + (g?.generator === 'robot' ? Number(g.params.height ?? 1.1) + 0.05 : 2.0), r }); }
  const blocked = (cam: THREE.Vector3) => blockers.some(h => {
    const seg = target.clone().sub(cam); const L = seg.length(); seg.normalize();
    for (let k = 0; k < 0.97; k += 0.03) { const p = cam.clone().addScaledVector(seg, L * k); if (p.y > h.top || p.y < 0) continue; if (Math.hypot(p.x - h.x, p.z - h.z) < h.r) return true; }
    return false;
  });
  if (!blocked(position)) return position;
  const rel = position.clone().sub(target);
  for (let k = 1; k <= 12; k++) {
    const ang = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 15 * DEG;
    const cand = target.clone().add(rel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang));
    if (!blocked(cand)) return cand;
  }
  return position;
}

/** Keep the camera inside the room (walls are solid) by sliding it along the view ray towards the target. */
function insideRoom(ev: SceneEvaluator, target: THREE.Vector3, position: THREE.Vector3): THREE.Vector3 {
  const envId = ev.scene.environmentId; const env = envId ? ev.lib.environments[envId] : null;
  if (!env || env.kind !== 'room') return position;
  const [W, H, D] = env.size, m = 0.25;
  const sides = env.walls.sides;
  const inside = (p: THREE.Vector3) => (!sides.includes('left') || p.x > -W / 2 + m) && (!sides.includes('right') || p.x < W / 2 - m) && (!sides.includes('back') || p.z > -D / 2 + m) && p.y < H - m && p.y > 0.1;
  const propHit = (p: THREE.Vector3) => ev.scene.props.some(pr => { const w = ev.propWorld(pr.id, 0); if (!w) return false; const c = new THREE.Vector3().setFromMatrixPosition(w.matrix); const g = ev.lib.props[pr.propId]; const gen = g?.generator; const r = gen === 'shelf' || gen === 'workbench' || gen === 'table' ? 0.75 : gen === 'robot' || gen === 'barrel' || gen === 'console' || gen === 'monitor' || gen === 'door' ? 0.45 : 0; const top = c.y + (gen === 'robot' ? Number(g?.params.height ?? 1.1) + 0.05 : gen === 'workbench' || gen === 'table' ? 1.0 : gen === 'barrel' ? 0.95 : gen === 'console' || gen === 'monitor' ? 1.3 : 2.2); return r > 0 && Math.hypot(p.x - c.x, p.z - c.z) < r && p.y < top; });
  if (inside(position) && !propHit(position)) return position;
  for (let k = 1; k <= 40; k++) { const p = position.clone().lerp(target, k / 44); if (inside(p) && !propHit(p)) return p; }
  return position;
}
export function shotCamera(ev: SceneEvaluator, shot: ResolvedShot, t: number, aspect: number): CameraState {
  const c = shot.camera;
  const tt = c.track ? t : shot.start + 0.001;
  const u = clamp((t - shot.start) / Math.max(1e-3, shot.end - shot.start), 0, 1);
  let position: THREE.Vector3, target: THREE.Vector3;
  const fov = c.fov;
  const dist = (extent: number) => (extent / 2) / Math.tan((fov * DEG) / 2) / Math.min(1, aspect / 1.2);
  if (c.type === 'static' || !c.framing) {
    position = new THREE.Vector3(...(c.position ?? [0, 1.6, 6])); target = new THREE.Vector3(...(c.target ?? [0, 1.1, 0]));
  } else if (c.framing === 'two-shot' || (c.subjects && c.subjects.length > 1 && c.framing !== 'over-shoulder')) {
    const ids = c.subjects ?? (c.subject ? [c.subject] : ev.scene.actors.map(a => a.id));
    const pts = ids.map(id => subjectPoint(ev, id, tt, 'medium'));
    const mid = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const span = pts.length > 1 ? pts[0].distanceTo(pts[pts.length - 1]) : 1;
    const axis = pts.length > 1 ? new THREE.Vector3().subVectors(pts[pts.length - 1], pts[0]).setY(0).normalize() : new THREE.Vector3(1, 0, 0);
    const normal = new THREE.Vector3(-axis.z, 0, axis.x);
    // choose the side the characters are (on average) facing
    const facing = ids.reduce((s, id) => s + Math.sin(facingOf(ev, id, tt, c.track ? tt : shot.end) * DEG) * normal.x + Math.cos(facingOf(ev, id, tt, c.track ? tt : shot.end) * DEG) * normal.z, 0);
    if ((c.side === 'right') !== (facing < 0)) normal.multiplyScalar(-1);
    const az = (c.azimuthDeg ?? 0) * DEG;
    const dir = normal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), az);
    const extent = Math.max(EXTENT[c.framing ?? 'two-shot'] ?? 1.5, span * 1.15 + 0.9);
    const d = dist(extent);
    const el = (c.elevationDeg ?? 4) * DEG;
    position = mid.clone().addScaledVector(dir, d * Math.cos(el)).add(new THREE.Vector3(0, d * Math.sin(el), 0));
    target = mid.clone().add(new THREE.Vector3(0, -0.22, 0));
    position = unoccluded(ev, ids, tt, target, position);
  } else if (c.framing === 'over-shoulder' && c.over && c.subject) {
    const over = subjectPoint(ev, c.over, tt, 'close'), subj = subjectPoint(ev, c.subject, tt, 'close');
    const axis = subj.clone().sub(over).setY(0).normalize();
    const right = new THREE.Vector3(axis.z, 0, -axis.x).multiplyScalar(c.side === 'left' ? -1 : 1);
    // far enough behind and beside the near shoulder that hair or head take at most a third of the frame
    position = over.clone().addScaledVector(axis, -0.85).addScaledVector(right, 0.5).add(new THREE.Vector3(0, 0.12, 0));
    target = subj.clone().addScaledVector(right, -0.05).add(new THREE.Vector3(0, -0.05, 0));
  } else {
    const id = c.subject ?? ev.scene.actors[0]?.id ?? '';
    const p = subjectPoint(ev, id, tt, c.framing);
    const yaw = (ev.scene.actors.some(a => a.id === id) ? facingOf(ev, id, tt, c.track ? tt : shot.end) : 0) + (c.azimuthDeg ?? (c.framing === 'establishing' || c.framing === 'wide' ? 0 : 22) * (c.side === 'left' ? -1 : 1));
    const el = (c.elevationDeg ?? (c.framing === 'establishing' ? 16 : c.framing === 'wide' ? 9 : 3)) * DEG;
    const d = dist(EXTENT[c.framing] ?? 1.2);
    const dir = new THREE.Vector3(Math.sin(yaw * DEG) * Math.cos(el), Math.sin(el), Math.cos(yaw * DEG) * Math.cos(el));
    position = p.clone().addScaledVector(dir, d);
    target = p.clone();
    // rule of thirds with looking room: aim beside the subject, towards where it looks, so it sits on the far third
    if (c.compose !== 'center' && ['full', 'medium', 'medium-close', 'close'].includes(c.framing) && ev.scene.actors.some(a => a.id === id)) {
      const fwd = target.clone().sub(position).setY(0).normalize(), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const fy = facingOf(ev, id, tt, c.track ? tt : shot.end) * DEG, gaze = Math.sin(fy) * right.x + Math.cos(fy) * right.z;
      const hw = d * Math.tan((fov * DEG) / 2) * Math.max(1, aspect);
      target.addScaledVector(right, clamp(gaze * 2.2, -1, 1) * hw * 0.3);
    }
    position = unoccluded(ev, [id], tt, target, position);
  }
  // camera moves
  if (c.move && c.move.type !== 'none') {
    const k = ease(c.move.ease ?? 'easeInOut', u), a = c.move.amount;
    const fwd = target.clone().sub(position);
    switch (c.move.type) {
      case 'push-in': position.addScaledVector(fwd, a * k); break;
      case 'pull-out': position.addScaledVector(fwd, -a * k); break;
      case 'dolly': position.addScaledVector(fwd.normalize(), a * k); target.addScaledVector(fwd.normalize(), a * k); break;
      case 'truck': { const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(); position.addScaledVector(right, a * k); target.addScaledVector(right, a * k); break; }
      case 'crane': position.y += a * k; break;
      case 'orbit': { const rel = position.clone().sub(target).applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 60 * DEG * k); position.copy(target).add(rel); break; }
    }
  }
  if (c.type !== 'static') position = insideRoom(ev, target, position);
  if (c.handheld > 0) {
    const seed = Math.floor(hash01(shot.id) * 1000);
    position.add(new THREE.Vector3(noise1(seed, t * 0.9), noise1(seed + 1, t * 0.8), noise1(seed + 2, t * 0.7)).multiplyScalar(0.025 * c.handheld));
    target.add(new THREE.Vector3(noise1(seed + 3, t * 1.1), noise1(seed + 4, t * 1.3), 0).multiplyScalar(0.018 * c.handheld));
  }
  return { position, target, fov };
}

export function evaluateShots(ev: SceneEvaluator, scene: ResolvedScene, t: number, aspect: number): ShotEval {
  let index = 0;
  for (let i = 0; i < scene.shots.length; i++) if (scene.shots[i].start <= t + 1e-9) index = i;
  const shot = scene.shots[index];
  const camera = shotCamera(ev, shot, t, aspect);
  let transition: ShotEval['transition'] = null;
  const tr = shot.transitionIn;
  if (tr && tr.type !== 'cut' && tr.durationSec > 0 && t < shot.start + tr.durationSec) {
    const progress = clamp((t - shot.start) / tr.durationSec, 0, 1);
    const prev = index > 0 ? shotCamera(ev, scene.shots[index - 1], t, aspect) : null;
    transition = { type: tr.type, progress, previous: tr.type === 'dissolve' || tr.type === 'wipe' ? prev : null };
  }
  return { shot, index, camera, transition };
}
