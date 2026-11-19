/** Declarative keyframe clip sampling. Pure: sample(clip, t) depends only on its arguments. */
import { catmull, ease, clamp } from './math.ts';
import type { ClipV2 } from './schema.ts';

export interface Key { t: number; v: number[] | number; ease?: string }
/** Sample a key list at time t. Keys must be sorted by t. 'spline' (default) = Catmull-Rom. */
export function sampleKeys(keys: Key[], t: number, loopDuration = 0): number[] {
  const n = keys.length;
  const vec = (k: Key) => (Array.isArray(k.v) ? k.v : [k.v]);
  if (n === 1 || t <= keys[0].t) return [...vec(keys[0])];
  if (t >= keys[n - 1].t) return [...vec(keys[n - 1])];
  let i = 1; while (i < n && keys[i].t < t) i++;
  const k0 = keys[i - 1], k1 = keys[i];
  const span = Math.max(1e-6, k1.t - k0.t);
  const a = (t - k0.t) / span;
  const mode = k1.ease ?? k0.ease ?? 'spline';
  const v0 = vec(k0), v1 = vec(k1);
  if (mode === 'spline') {
    const prev = i >= 2 ? vec(keys[i - 2]) : (loopDuration && n > 2 ? vec(keys[n - 2]) : v0);
    const next = i + 1 < n ? vec(keys[i + 1]) : (loopDuration && n > 2 ? vec(keys[1]) : v1);
    return v0.map((x, j) => catmull(prev[j] ?? x, x, v1[j] ?? x, next[j] ?? v1[j] ?? x, a));
  }
  const e = ease(mode, a);
  return v0.map((x, j) => x + ((v1[j] ?? x) - x) * e);
}
export function clipLocalTime(clip: { duration: number; loop: boolean }, t: number): number {
  if (clip.loop) { const d = clip.duration; return ((t % d) + d) % d; }
  return clamp(t, 0, clip.duration);
}
export interface ClipSample { rotations: Map<string, [number, number, number]>; positions: Map<string, [number, number, number]>; face: Map<string, number>; }
export function sampleClip(clip: ClipV2, t: number): ClipSample {
  const lt = clipLocalTime(clip, t);
  const out: ClipSample = { rotations: new Map(), positions: new Map(), face: new Map() };
  for (const track of clip.tracks) {
    const v = sampleKeys(track.keys as Key[], lt, clip.loop ? clip.duration : 0);
    const vec: [number, number, number] = [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
    (track.property === 'rotation' ? out.rotations : out.positions).set(track.bone, vec);
  }
  for (const f of clip.face ?? []) out.face.set(f.param, sampleKeys(f.keys as Key[], lt, clip.loop ? clip.duration : 0)[0]);
  return out;
}
export function sampleWeightKeys(keys: [number, number][], t: number): number {
  if (!keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = (t - keys[i - 1][0]) / Math.max(1e-6, keys[i][0] - keys[i - 1][0]); return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * ease('smooth', a); }
  return keys[keys.length - 1][1];
}
