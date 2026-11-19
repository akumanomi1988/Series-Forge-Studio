/** Small deterministic math helpers shared by Node and the browser. */
export type Vec3 = [number, number, number];
export const DEG = Math.PI / 180;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const addV = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subV = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scaleV = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const lenV = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const dist2D = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const smoothstep = (t: number): number => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
export const smootherstep = (t: number): number => { const x = clamp(t, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
/** Shortest signed angle difference in degrees. */
export const angleDiff = (from: number, to: number): number => { let d = (to - from) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
/** Yaw (deg) that makes an actor facing +Z look from `from` towards `to` (XZ plane). */
export const yawTowards = (from: Vec3, to: Vec3): number => Math.atan2(to[0] - from[0], to[2] - from[2]) / DEG;
export const rotateY = (v: Vec3, yawDeg: number): Vec3 => { const a = yawDeg * DEG, c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };

export type EaseName = 'linear' | 'step' | 'smooth' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spline' | 'back' | 'bounce';
export function ease(name: string | undefined, t: number): number {
  const x = clamp(t, 0, 1);
  switch (name) {
    case 'linear': return x;
    case 'step': return x < 1 ? 0 : 1;
    case 'easeIn': return x * x * x;
    case 'easeOut': return 1 - Math.pow(1 - x, 3);
    case 'easeInOut': return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'back': { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
    case 'bounce': { const n = 7.5625, d = 2.75; let y = x; if (y < 1 / d) return n * y * y; if (y < 2 / d) return n * (y -= 1.5 / d) * y + .75; if (y < 2.5 / d) return n * (y -= 2.25 / d) * y + .9375; return n * (y -= 2.625 / d) * y + .984375; }
    default: return smoothstep(x);
  }
}
/** Catmull-Rom interpolation for scalar keys. */
export function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
/** Deterministic hash -> [0,1). Same input always produces the same value on every machine. */
export function hash01(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Smooth 1D value noise, deterministic, for handheld camera or idle fidgets. */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash01(seed, i) * 2 - 1, hash01(seed, i + 1) * 2 - 1, u);
}
/** Weight of an interval with fade in/out at time t. */
export function intervalWeight(t: number, start: number, end: number, fadeIn = 0, fadeOut = 0): number {
  if (t < start || t > end) return 0;
  let w = 1;
  if (fadeIn > 0 && t < start + fadeIn) w = Math.min(w, smoothstep((t - start) / fadeIn));
  if (fadeOut > 0 && t > end - fadeOut) w = Math.min(w, smoothstep((end - t) / fadeOut));
  return w;
}
