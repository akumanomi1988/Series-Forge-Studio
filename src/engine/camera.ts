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
function facingOf(ev: SceneEvaluator, id: string, t: number): number {
  const a = ev.scene.actors.find(x => x.id === id);
  if (!a) return 0;
  let seg = a.root[0]; for (const s of a.root) if (s.start <= t) seg = s;
  return seg.kind === 'turn' ? seg.yawTo : seg.yawFrom;
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
    const facing = ids.reduce((s, id) => s + Math.sin(facingOf(ev, id, tt) * DEG) * normal.x + Math.cos(facingOf(ev, id, tt) * DEG) * normal.z, 0);
    if ((c.side === 'right') !== (facing < 0)) normal.multiplyScalar(-1);
    const az = (c.azimuthDeg ?? 0) * DEG;
    const dir = normal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), az);
    const extent = Math.max(EXTENT[c.framing ?? 'two-shot'] ?? 1.5, span * 0.85 + 0.6);
    const d = dist(extent * 0.75);
    const el = (c.elevationDeg ?? 4) * DEG;
    position = mid.clone().addScaledVector(dir, d * Math.cos(el)).add(new THREE.Vector3(0, d * Math.sin(el), 0));
    target = mid.clone().add(new THREE.Vector3(0, -0.12, 0));
  } else if (c.framing === 'over-shoulder' && c.over && c.subject) {
    const over = subjectPoint(ev, c.over, tt, 'close'), subj = subjectPoint(ev, c.subject, tt, 'close');
    const axis = subj.clone().sub(over).setY(0).normalize();
    const right = new THREE.Vector3(axis.z, 0, -axis.x).multiplyScalar(c.side === 'left' ? -1 : 1);
    position = over.clone().addScaledVector(axis, -0.75).addScaledVector(right, 0.38).add(new THREE.Vector3(0, 0.08, 0));
    target = subj.clone().addScaledVector(right, -0.05).add(new THREE.Vector3(0, -0.05, 0));
  } else {
    const id = c.subject ?? ev.scene.actors[0]?.id ?? '';
    const p = subjectPoint(ev, id, tt, c.framing);
    const yaw = (ev.scene.actors.some(a => a.id === id) ? facingOf(ev, id, tt) : 0) + (c.azimuthDeg ?? (c.framing === 'establishing' || c.framing === 'wide' ? 0 : 22) * (c.side === 'left' ? -1 : 1));
    const el = (c.elevationDeg ?? (c.framing === 'establishing' ? 16 : c.framing === 'wide' ? 9 : 3)) * DEG;
    const d = dist(EXTENT[c.framing] ?? 1.2);
    const dir = new THREE.Vector3(Math.sin(yaw * DEG) * Math.cos(el), Math.sin(el), Math.cos(yaw * DEG) * Math.cos(el));
    position = p.clone().addScaledVector(dir, d);
    target = p.clone();
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
