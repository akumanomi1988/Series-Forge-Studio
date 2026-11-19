/** Scene/episode audio mixer: dialogue, SFX, ambience beds, music; per-track gain, pan, fades, dialogue ducking,
 * BS.1770 loudness normalisation and a look-ahead peak limiter. Deterministic. */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { AudioCue } from '../engine/timeline.ts';
import type { SfxDef, MusicDef } from '../engine/schema.ts';
import { generateSfx, generateMusic, SR } from './synth.ts';
import { readWav, writeWavAtomic, mono, dbToGain } from './wav.ts';
import { hash01 } from '../engine/math.ts';

export interface MixContext { sfx: Record<string, SfxDef>; music: Record<string, MusicDef>; cacheDir: string }
export interface Stereo { L: Float32Array; R: Float32Array }
const memo = new Map<string, Float32Array | [Float32Array, Float32Array]>();

export async function sfxSamples(def: SfxDef, variant: number, ctx: MixContext): Promise<Float32Array> {
  const key = createHash('sha1').update(JSON.stringify({ def, variant, v: 2 })).digest('hex').slice(0, 20);
  const hit = memo.get(key); if (hit) return hit as Float32Array;
  let x: Float32Array;
  if (def.generator === 'file' && def.file) x = mono(await readWav(def.file));
  else {
    const file = join(ctx.cacheDir, 'sfx', `${def.id}-${key}.wav`);
    if (existsSync(file)) x = mono(await readWav(file));
    else { x = generateSfx({ ...def, seed: def.seed + variant * 101 }); await mkdir(join(ctx.cacheDir, 'sfx'), { recursive: true }); await writeWavAtomic(file, { sampleRate: SR, channels: [x] }, 32); }
  }
  memo.set(key, x); return x;
}
export async function musicSamples(def: MusicDef, duration: number, ctx: MixContext): Promise<[Float32Array, Float32Array]> {
  const key = createHash('sha1').update(JSON.stringify({ def, duration: Math.ceil(duration), v: 2 })).digest('hex').slice(0, 20);
  const hit = memo.get(key); if (hit) return hit as [Float32Array, Float32Array];
  const file = join(ctx.cacheDir, 'music', `${def.id}-${key}.wav`);
  let out: [Float32Array, Float32Array];
  if (existsSync(file)) { const a = await readWav(file); out = [a.channels[0], a.channels[1] ?? a.channels[0]]; }
  else { out = def.generator === 'file' && def.file ? await (async () => { const a = await readWav(def.file!); return [a.channels[0], a.channels[1] ?? a.channels[0]] as [Float32Array, Float32Array]; })() : generateMusic(def, Math.ceil(duration)); await mkdir(join(ctx.cacheDir, 'music'), { recursive: true }); await writeWavAtomic(file, { sampleRate: SR, channels: out }, 32); }
  memo.set(key, out); return out;
}
const panGains = (pan: number) => { const a = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4; return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2]; };
function fadeGain(i: number, len: number, fi: number, fo: number) { let g = 1; if (fi > 0 && i < fi) g *= i / fi; if (fo > 0 && i > len - fo) g *= Math.max(0, (len - i) / fo); return g; }

export interface CueReport { id: string; kind: string; start: number; duration: number; peak: number; missing?: boolean }
/** Mix the segment [segStart, segStart+duration) of a global timeline. `cues` use global seconds. */
export async function mixSegment(cues: AudioCue[], segStart: number, duration: number, ctx: MixContext): Promise<{ mix: Stereo; dialogue: Float32Array; report: CueReport[] }> {
  const N = Math.round(duration * SR);
  const dl = new Float32Array(N), dr = new Float32Array(N), bedL = new Float32Array(N), bedR = new Float32Array(N), fxL = new Float32Array(N), fxR = new Float32Array(N), dialogue = new Float32Array(N);
  const report: CueReport[] = [];
  for (const c of cues) {
    const s0 = Math.round((c.start - segStart) * SR);
    const g = dbToGain(c.gainDb);
    const [pl, pr] = panGains(c.pan);
    if (c.kind === 'dialogue') {
      if (!c.file || !existsSync(c.file)) { report.push({ id: c.id, kind: c.kind, start: c.start, duration: c.duration, peak: 0, missing: true }); continue; }
      const x = mono(await readWav(c.file));
      let pk = 0;
      for (let i = 0; i < x.length; i++) { const j = s0 + i; if (j < 0 || j >= N) continue; const v = x[i] * g; dl[j] += v * pl; dr[j] += v * pr; dialogue[j] += v; pk = Math.max(pk, Math.abs(v)); }
      report.push({ id: c.id, kind: c.kind, start: c.start, duration: x.length / SR, peak: pk });
    } else if (c.kind === 'sfx') {
      const def = ctx.sfx[c.sound];
      if (!def) { report.push({ id: c.id, kind: c.kind, start: c.start, duration: 0, peak: 0, missing: true }); continue; }
      const variants = typeof def.params.variants === 'number' ? def.params.variants as number : 1;
      const x = await sfxSamples(def, Math.floor(hash01(c.id, c.start) * variants), ctx);
      const len = c.duration > 0 ? Math.min(x.length, Math.round(c.duration * SR)) : x.length;
      const fi = Math.round(c.fadeIn * SR), fo = Math.round(Math.max(c.fadeOut, c.duration > 0 && len < x.length ? 0.03 : 0) * SR);
      for (let i = 0; i < len; i++) { const j = s0 + i; if (j < 0 || j >= N) continue; const v = x[i] * g * fadeGain(i, len, fi, fo); fxL[j] += v * pl; fxR[j] += v * pr; }
      report.push({ id: c.id, kind: c.kind, start: c.start, duration: len / SR, peak: g });
    } else {
      // ambience (looped bed) and music (generated to length, sliced by global time)
      const len = Math.round(c.duration * SR);
      let srcL: Float32Array, srcR: Float32Array, loop = false;
      if (c.kind === 'music') { const def = ctx.music[c.sound]; if (!def) { report.push({ id: c.id, kind: c.kind, start: c.start, duration: 0, peak: 0, missing: true }); continue; } [srcL, srcR] = await musicSamples(def, c.duration + 1, ctx); }
      else { const def = ctx.sfx[c.sound]; if (!def) { report.push({ id: c.id, kind: c.kind, start: c.start, duration: 0, peak: 0, missing: true }); continue; } srcL = await sfxSamples(def, 0, ctx); srcR = await sfxSamples(def, 1, ctx); loop = true; }
      const fi = Math.round(c.fadeIn * SR), fo = Math.round(c.fadeOut * SR);
      const xf = Math.round(0.5 * SR);
      for (let j = Math.max(0, s0); j < Math.min(N, s0 + len); j++) {
        const i = j - s0;
        let l: number, r: number;
        if (loop) { const P = srcL.length - xf; const k = i % P; const tail = k < xf && i >= P ? k / xf : 1; l = srcL[k] * tail + (k < xf && i >= P ? srcL[P + k] * (1 - tail) : 0); r = srcR[k] * tail + (k < xf && i >= P ? srcR[P + k] * (1 - tail) : 0); }
        else { l = srcL[i] ?? 0; r = srcR[i] ?? 0; }
        const fg = g * fadeGain(i, len, fi, fo);
        bedL[j] += l * fg * pl; bedR[j] += r * fg * pr;
      }
      report.push({ id: c.id, kind: c.kind, start: c.start, duration: c.duration, peak: g });
    }
  }
  // ducking: beds dip under dialogue (attack 40 ms, release 450 ms, -9 dB)
  const att = Math.exp(-1 / (0.04 * SR)), rel = Math.exp(-1 / (0.45 * SR));
  let envv = 0;
  const duck = dbToGain(-9);
  const L = new Float32Array(N), R = new Float32Array(N);
  // look-ahead so the dip starts slightly before speech
  const ahead = Math.round(0.08 * SR);
  for (let i = 0; i < N; i++) {
    const a = Math.abs(dialogue[Math.min(N - 1, i + ahead)]);
    envv = a > envv ? a + (envv - a) * att : a + (envv - a) * rel;
    const k = Math.min(1, envv / 0.02);
    const gBed = 1 - (1 - duck) * k;
    L[i] = dl[i] + fxL[i] + bedL[i] * gBed; R[i] = dr[i] + fxR[i] + bedR[i] * gBed;
  }
  return { mix: { L, R }, dialogue, report };
}

// ---------------------------------------------------------------- loudness (ITU-R BS.1770-4) and limiting
function kWeight(x: Float32Array): Float32Array {
  // pre-filter (high shelf) + RLB high-pass, coefficients for 48 kHz
  const y = new Float32Array(x.length);
  const run = (b: number[], a: number[], inp: Float32Array, out: Float32Array) => { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < inp.length; i++) { const v = b[0] * inp[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = inp[i]; y2 = y1; y1 = v; out[i] = v; } };
  const tmp = new Float32Array(x.length);
  run([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x, tmp);
  run([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621], tmp, y);
  return y;
}
/** 400 ms gating blocks (75% overlap) of K-weighted power; concatenable across scenes for episode loudness. */
export function blockPowers(s: Stereo): number[] {
  const L = kWeight(s.L), R = kWeight(s.R);
  const block = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  const powers: number[] = [];
  for (let i = 0; i + block <= L.length; i += hop) { let p = 0; for (let j = i; j < i + block; j++) p += L[j] * L[j] + R[j] * R[j]; powers.push(p / block); }
  return powers;
}
export function loudnessFromPowers(powers: number[]): number {
  const lufs = (p: number) => -0.691 + 10 * Math.log10(p + 1e-12);
  const abs = powers.filter(p => lufs(p) > -70);
  if (!abs.length) return -70;
  const rel = lufs(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter(p => lufs(p) > rel);
  return lufs(gated.reduce((a, b) => a + b, 0) / Math.max(1, gated.length));
}
export function integratedLoudness(s: Stereo): number { return loudnessFromPowers(blockPowers(s)); }
export function limit(s: Stereo, ceilingDb = -1): { peakIn: number; reduced: number } {
  const ceil = dbToGain(ceilingDb), look = Math.round(0.005 * SR), rel = Math.exp(-1 / (0.08 * SR));
  const N = s.L.length; let g = 1, peakIn = 0, reduced = 0;
  const need = new Float32Array(N);
  for (let i = 0; i < N; i++) { const p = Math.max(Math.abs(s.L[i]), Math.abs(s.R[i])); peakIn = Math.max(peakIn, p); need[i] = p > ceil ? ceil / p : 1; }
  // running minimum over the look-ahead window
  // sliding-window minimum over [i, i+look] with a monotonic deque: O(N)
  const minAhead = new Float32Array(N);
  const dq = new Int32Array(N); let head = 0, tail = 0;
  for (let j = 0; j < N + look; j++) {
    if (j < N) { while (tail > head && need[dq[tail - 1]] >= need[j]) tail--; dq[tail++] = j; }
    const i = j - look;
    if (i >= 0) { while (dq[head] < i) head++; minAhead[i] = need[dq[head]]; }
  }
  for (let i = 0; i < N; i++) { const target = minAhead[i]; g = target < g ? target : target + (g - target) * rel; s.L[i] *= g; s.R[i] *= g; if (g < 0.999) reduced++; }
  return { peakIn, reduced };
}
export function normalizeLoudness(s: Stereo, targetLufs: number): { before: number; after: number; gainDb: number; limiter: { peakIn: number; reduced: number } } {
  const before = integratedLoudness(s);
  const gainDb = Math.max(-30, Math.min(30, targetLufs - before));
  const g = dbToGain(gainDb);
  for (let i = 0; i < s.L.length; i++) { s.L[i] *= g; s.R[i] *= g; }
  const limiter = limit(s, -1);
  return { before, after: integratedLoudness(s), gainDb, limiter };
}
