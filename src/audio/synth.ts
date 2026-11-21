/** Procedural, original sound design and music (deterministic from seed). 48 kHz mono/stereo Float32.
 * Every generated sound is original synthesis => licence "procedural-original" (commercial use allowed). */
import type { SfxDef, MusicDef } from '../engine/schema.ts';
import { mulberry32 } from '../engine/math.ts';

export const SR = 48000;
const TAU = Math.PI * 2;
type P = SfxDef['params'];
const n = (p: P, k: string, d: number) => (typeof p[k] === 'number' ? p[k] as number : d);

class Biquad { // RBJ cookbook filters
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0; private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(type: 'lp' | 'hp' | 'bp', f: number, q = 0.707) { this.set(type, f, q); }
  set(type: 'lp' | 'hp' | 'bp', f: number, q = 0.707) {
    const w = TAU * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2; const a0 = 1 + al;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; } else { b0 = al; b1 = 0; b2 = -al; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));
function normalize(x: Float32Array, peakTarget = 0.89): Float32Array { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); if (p > 0) for (let i = 0; i < x.length; i++) x[i] *= peakTarget / p; return x; }

export function generateSfx(def: SfxDef): Float32Array {
  const rnd = mulberry32(def.seed * 7919 + 13);
  const dur = def.durationSec, N = Math.max(1, Math.round(dur * SR)), x = new Float32Array(N), p = def.params;
  switch (def.generator) {
    case 'metal-impact': { // modal synthesis: inharmonic partials with fast decay + click
      const f0 = n(p, 'freq', 820), decay = n(p, 'decay', 0.35), bright = n(p, 'brightness', 1);
      const ratios = [1, 2.32, 4.25, 6.63, 9.38, 12.8];
      for (let k = 0; k < ratios.length; k++) { const f = f0 * ratios[k] * (1 + (rnd() - 0.5) * 0.02), amp = Math.pow(0.62, k) * (k ? bright : 1), dk = decay / (1 + k * 0.6), ph = rnd() * TAU; for (let i = 0; i < N; i++) { const t = i / SR; x[i] += amp * Math.sin(TAU * f * t + ph) * Math.exp(-t / dk); } }
      const hp = new Biquad('hp', 2500); for (let i = 0; i < Math.min(N, SR * 0.008); i++) x[i] += hp.run(rnd() * 2 - 1) * (1 - i / (SR * 0.008)) * 0.8;
      break;
    }
    case 'thud': { const f0 = n(p, 'freq', 90); const lp = new Biquad('lp', 600); for (let i = 0; i < N; i++) { const t = i / SR; x[i] = Math.sin(TAU * f0 * t * (1 - 0.3 * t)) * Math.exp(-t / 0.09) + lp.run(rnd() * 2 - 1) * Math.exp(-t / 0.03) * 0.6; } break; }
    case 'footstep': { // heel + toe noise bursts through a low resonance
      const surface = String(p.surface ?? 'concrete'); const fc = surface === 'wood' ? 900 : surface === 'metal' ? 2400 : 1500;
      const lp = new Biquad('bp', fc, 1.2), lp2 = new Biquad('lp', 280);
      for (let i = 0; i < N; i++) { const t = i / SR; const e = env(t, 0.002, 0.025) + 0.55 * (t > 0.045 ? env(t - 0.045, 0.002, 0.02) : 0); const noise = rnd() * 2 - 1; x[i] = (lp.run(noise) * 0.9 + lp2.run(noise) * 1.6) * e; }
      break;
    }
    case 'door-creak': { // stick-slip friction: resonant filter excited by an irregular pulse train with gliding pitch
      const bp = new Biquad('bp', 700, 8), bp2 = new Biquad('bp', 1700, 10); let phase = 0;
      for (let i = 0; i < N; i++) { const t = i / SR, u = t / dur; const f = 18 + 40 * Math.sin(Math.PI * u) + 12 * Math.sin(TAU * 1.3 * t); phase += f / SR; let pulse = 0; if (phase >= 1) { phase -= 1; pulse = 1 + rnd() * 0.5; } const s = pulse + (rnd() - 0.5) * 0.02; x[i] = (bp.run(s) + 0.6 * bp2.run(s)) * Math.sin(Math.PI * Math.min(1, u * 1.05)); }
      // latch click at end
      const L = Math.round(0.012 * SR), at = Math.max(0, N - Math.round(0.08 * SR)); const hp = new Biquad('hp', 3000); for (let i = 0; i < L && at + i < N; i++) x[at + i] += hp.run(rnd() * 2 - 1) * (1 - i / L) * 3;
      break;
    }
    case 'robot-beep': { const notes = String(p.notes ?? '1320,990,1480').split(',').map(Number); const nd = dur / notes.length; for (let i = 0; i < N; i++) { const t = i / SR, k = Math.min(notes.length - 1, Math.floor(t / nd)), lt = t - k * nd; const sq = Math.sign(Math.sin(TAU * notes[k] * t)) * 0.4 + Math.sin(TAU * notes[k] * t) * 0.6; x[i] = sq * Math.min(1, lt / 0.004) * Math.min(1, (nd - lt) / 0.01) * 0.6; } const lp = new Biquad('lp', 5000); for (let i = 0; i < N; i++) x[i] = lp.run(x[i]); break; }
    case 'doorbell': { // two-tone chime ("din-don"): struck bars with inharmonic partials, soft attack, long decay
      const notes = String(p.notes ?? '659,523').split(',').map(Number), gap = n(p, 'gap', 0.62), tau = n(p, 'decay', 0.85);
      const partials: [number, number, number][] = [[1, 1, 1], [2.76, 0.32, 0.45], [5.4, 0.12, 0.25], [0.5, 0.18, 1.4]]; // ratio, gain, decay factor
      notes.forEach((f, k) => { const t0 = k * gap; for (let i = Math.floor(t0 * SR); i < N; i++) { const t = i / SR - t0; const env = Math.min(1, t / 0.006); let v = 0; for (const [r, g, d] of partials) v += g * Math.sin(TAU * f * r * t) * Math.exp(-t / (tau * d)); x[i] += v * env * 0.55 * (k ? 0.92 : 1); } });
      const lp = new Biquad('lp', 4200); for (let i = 0; i < N; i++) x[i] = Math.tanh(lp.run(x[i]) * 1.2); break;
    }
    case 'servo': { const f0 = n(p, 'freq', 180); let ph = 0; const bp = new Biquad('bp', 1200, 2); for (let i = 0; i < N; i++) { const t = i / SR, u = t / dur; const f = f0 * (1 + 0.6 * Math.sin(Math.PI * u)); ph += f / SR; const saw = 2 * (ph % 1) - 1; x[i] = (bp.run(saw) * 2 + saw * 0.15) * Math.sin(Math.PI * u) * (0.8 + 0.2 * Math.sin(TAU * 31 * t)); } break; }
    case 'sparks': { const hp = new Biquad('hp', 1800); for (let i = 0; i < N; i++) { const t = i / SR; const crackle = rnd() < 0.004 * (1 - t / dur) * 3 ? 1 : 0; x[i] = hp.run((rnd() * 2 - 1) * (0.08 + crackle * 6)) * Math.exp(-t / (dur * 0.5)); } const zapF = 260; for (let i = 0; i < Math.min(N, SR * 0.25); i++) { const t = i / SR; x[i] += Math.sign(Math.sin(TAU * zapF * t * (1 + 3 * t))) * 0.25 * Math.exp(-t / 0.08); } break; }
    case 'whoosh': { const bp = new Biquad('bp', 400, 1.5); for (let i = 0; i < N; i++) { const t = i / SR, u = t / dur; bp.set('bp', 300 + 2500 * Math.sin(Math.PI * u), 1.5); x[i] = bp.run(rnd() * 2 - 1) * Math.sin(Math.PI * u) ** 2; } break; }
    case 'click': { const hp = new Biquad('hp', 2000); for (let i = 0; i < N; i++) { const t = i / SR; x[i] = hp.run(rnd() * 2 - 1) * Math.exp(-t / 0.004) + Math.sin(TAU * 1800 * t) * Math.exp(-t / 0.01) * 0.4; } break; }
    case 'room-tone': case 'workshop-hum': case 'wind': case 'rain': case 'traffic': case 'birds': {
      // loopable beds: filtered noise + mains hum + sparse deterministic events
      const lp = new Biquad('lp', def.generator === 'wind' ? 500 : 900), lp2 = new Biquad('lp', 120), hp = new Biquad('hp', 3000);
      const hum = def.generator === 'workshop-hum' ? n(p, 'hum', 1) : 0;
      for (let i = 0; i < N; i++) {
        const t = i / SR, noise = rnd() * 2 - 1;
        let v = lp.run(noise) * 0.35 + lp2.run(noise) * 0.9;
        if (hum) v += hum * (0.25 * Math.sin(TAU * 50 * t) + 0.12 * Math.sin(TAU * 100 * t) + 0.06 * Math.sin(TAU * 150 * t)) * (0.9 + 0.1 * Math.sin(TAU * 0.3 * t));
        if (def.generator === 'rain') v += hp.run(noise) * 0.6;
        if (def.generator === 'wind') v *= 0.6 + 0.4 * Math.sin(TAU * 0.13 * t) * Math.sin(TAU * 0.07 * t + 1);
        x[i] = v;
      }
      if (def.generator === 'workshop-hum') { // distant machinery ticks and a far clank every few seconds
        const ev = mulberry32(def.seed);
        for (let t = 0.7; t < dur - 0.5; t += 1.6 + ev() * 3.5) { const s = Math.round(t * SR), f0 = 400 + ev() * 900; for (let i = 0; i < SR * 0.4 && s + i < N; i++) { const tt = i / SR; x[s + i] += 0.05 * (Math.sin(TAU * f0 * tt) + 0.5 * Math.sin(TAU * f0 * 2.7 * tt)) * Math.exp(-tt / 0.12); } }
      }
      if (def.generator === 'birds') { const ev = mulberry32(def.seed); for (let t = 0.3; t < dur - 0.3; t += 0.8 + ev() * 2) { const s = Math.round(t * SR), f0 = 2500 + ev() * 2000; for (let i = 0; i < SR * 0.12 && s + i < N; i++) { const tt = i / SR; x[s + i] += 0.2 * Math.sin(TAU * f0 * tt * (1 + 2 * tt)) * Math.sin(Math.PI * tt / 0.12); } } }
      // loop-safe edges
      const F = Math.min(N / 4, SR * 0.05); for (let i = 0; i < F; i++) { x[i] *= i / F; x[N - 1 - i] *= i / F; }
      break;
    }
    default: break;
  }
  return normalize(x, n(p, 'peak', 0.89));
}

// ---------------------------------------------------------------- music
const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const MODES: Record<string, number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
function chordDegrees(sym: string): number { const d = ROMAN.indexOf(sym.toLowerCase().replace(/[^iv]/g, '')); return d < 0 ? 0 : d; }
/** Simple Schroeder/Freeverb-style stereo reverb. */
function reverb(L: Float32Array, R: Float32Array, wet = 0.25, room = 0.82) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(d => Math.round(d * SR / 44100));
  const aps = [556, 441, 341, 225].map(d => Math.round(d * SR / 44100));
  for (const [ch, spread] of [[L, 0], [R, 23]] as const) {
    const input = Float32Array.from(ch); const out = new Float32Array(ch.length);
    for (const d0 of combs) { const d = d0 + spread; const buf = new Float32Array(d); let idx = 0, lp = 0; for (let i = 0; i < ch.length; i++) { const y = buf[idx]; lp = y * 0.8 + lp * 0.2; buf[idx] = input[i] * 0.015 + lp * room; out[i] += y; idx = (idx + 1) % d; } }
    for (const d0 of aps) { const d = d0 + spread; const buf = new Float32Array(d); let idx = 0; for (let i = 0; i < ch.length; i++) { const b = buf[idx]; const y = -out[i] + b; buf[idx] = out[i] + b * 0.5; out[i] = y; idx = (idx + 1) % d; } }
    for (let i = 0; i < ch.length; i++) ch[i] = ch[i] * (1 - wet) + out[i] * wet;
  }
}
export function generateMusic(def: MusicDef, durationSec = def.durationSec): [Float32Array, Float32Array] {
  if (def.style !== 'ambient' || def.form !== 'loop' || def.sevenths || def.instruments.some(i => ['keys', 'guitar', 'strings', 'brushes', 'snaps', 'sub', 'lead'].includes(i))) return arrange(def, durationSec);
  const N = Math.round(durationSec * SR), L = new Float32Array(N), R = new Float32Array(N);
  const rnd = mulberry32(def.seed);
  const beat = 60 / def.tempo, bar = beat * 4;
  const scale = MODES[def.mode], root = 48 + NOTE[def.key];
  const degreeNote = (deg: number, oct = 0) => root + scale[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct);
  const add = (buf: Float32Array, start: number, samples: Float32Array, gain: number) => { const s = Math.round(start * SR); for (let i = 0; i < samples.length && s + i < N; i++) if (s + i >= 0) buf[s + i] += samples[i] * gain; };
  const tone = (hz: number, len: number, kind: 'pad' | 'bass' | 'pluck' | 'bell' | 'lead') => {
    const M = Math.round(len * SR), y = new Float32Array(M); const lp = new Biquad('lp', kind === 'pad' ? 1400 : kind === 'bass' ? 500 : 3200, 0.8);
    for (let i = 0; i < M; i++) {
      const t = i / SR; let v = 0;
      if (kind === 'pad') { for (const det of [-0.006, 0, 0.007]) { const ph = (hz * (1 + det) * t) % 1; v += (2 * ph - 1) * 0.33; } v *= Math.min(1, t / 0.6) * Math.min(1, (len - t) / 0.8); }
      else if (kind === 'bass') { v = Math.sin(TAU * hz * t) + 0.35 * Math.sin(TAU * hz * 2 * t); v *= Math.min(1, t / 0.01) * Math.exp(-t / (len * 0.8)) * Math.min(1, (len - t) / 0.05); }
      else if (kind === 'pluck') { v = (Math.sin(TAU * hz * t) + 0.5 * Math.sin(TAU * hz * 2 * t) + 0.2 * Math.sin(TAU * hz * 3 * t)) * Math.exp(-t / 0.28); }
      else if (kind === 'bell') { v = (Math.sin(TAU * hz * t) + 0.4 * Math.sin(TAU * hz * 2.76 * t) + 0.2 * Math.sin(TAU * hz * 5.4 * t)) * Math.exp(-t / 0.9); }
      else { v = Math.sin(TAU * hz * t + 0.8 * Math.sin(TAU * hz * 2 * t)) * Math.min(1, t / 0.05) * Math.min(1, (len - t) / 0.1); }
      y[i] = lp.run(v);
    }
    return y;
  };
  const prog = def.progression.map(chordDegrees);
  const bars = Math.ceil(durationSec / bar);
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, deg = prog[b % prog.length];
    const section = Math.floor(b / 4) % 3; // light arrangement variation
    const chord = [deg, deg + 2, deg + 4];
    if (def.instruments.includes('pad')) for (const [k, d] of chord.entries()) { const y = tone(midiHz(degreeNote(d, 1)), bar + 0.4, 'pad'); add(L, t0, y, 0.09 * (k === 1 ? 0.8 : 1)); add(R, t0, y, 0.09 * (k === 2 ? 0.8 : 1)); }
    if (def.instruments.includes('bass')) for (let q = 0; q < 4; q++) { if (q === 3 && rnd() < 0.5) continue; const y = tone(midiHz(degreeNote(deg, q === 2 ? 0 : -1)), beat * 0.9, 'bass'); add(L, t0 + q * beat, y, 0.22); add(R, t0 + q * beat, y, 0.22); }
    if (def.instruments.includes('arp') || def.instruments.includes('pluck')) for (let s = 0; s < 8; s++) { if (section === 0 && s % 2) continue; const d = chord[[0, 1, 2, 1, 0, 2, 1, 2][s]] + (s > 5 ? 7 : 0); const y = tone(midiHz(degreeNote(d, 1)), beat * 0.6, 'pluck'); const pan = (s % 2 ? 0.7 : 1); add(L, t0 + s * beat / 2, y, 0.07 * pan); add(R, t0 + s * beat / 2, y, 0.07 * (1.7 - pan)); }
    if (def.instruments.includes('bell') && b % 2 === 0) { const y = tone(midiHz(degreeNote(chord[2], 2)), 2, 'bell'); add(L, t0 + beat * 2.5, y, 0.05); add(R, t0 + beat * 2.5, y, 0.06); }
    if (def.instruments.includes('drums') && section > 0) for (let q = 0; q < 4; q++) { const kick = new Float32Array(Math.round(0.25 * SR)); for (let i = 0; i < kick.length; i++) { const t = i / SR; kick[i] = Math.sin(TAU * 55 * t * (1 + 2 * Math.exp(-t / 0.03))) * Math.exp(-t / 0.12); } if (q % 2 === 0) { add(L, t0 + q * beat, kick, 0.25); add(R, t0 + q * beat, kick, 0.25); } const hat = new Float32Array(Math.round(0.05 * SR)); const hp = new Biquad('hp', 7000); for (let i = 0; i < hat.length; i++) hat[i] = hp.run(rnd() * 2 - 1) * Math.exp(-i / SR / 0.012); add(L, t0 + q * beat + beat / 2, hat, 0.05); add(R, t0 + q * beat + beat / 2, hat, 0.06); }
  }
  reverb(L, R, 0.28);
  const F = Math.min(N, SR * 2); for (let i = 0; i < F; i++) { const g = i / F; L[N - 1 - i] *= g; R[N - 1 - i] *= g; }
  let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  if (pk > 0) for (let i = 0; i < N; i++) { L[i] *= 0.7 / pk; R[i] *= 0.7 / pk; }
  return [L, R];
}

// ---------------------------------------------------------------- arranger (styles, melody, stings)
/** Styled arrangement: sevenths, swing, a composed lead melody (motif A A' B A), and instruments with
 * physical/FM models: keys (electric piano), guitar (Karplus-Strong nylon), strings, brushes, snaps, sub.
 * form 'sting' = a short cadence that rings out; 'button' = two comedic stabs (V then I). Deterministic by seed. */
function arrange(def: MusicDef, durationSec: number): [Float32Array, Float32Array] {
  const N = Math.round(durationSec * SR), L = new Float32Array(N), R = new Float32Array(N);
  const rnd = mulberry32(def.seed * 7919 + 13);
  const beat = 60 / def.tempo, bar = beat * 4, swing = def.swing;
  const scale = MODES[def.mode], root = 48 + NOTE[def.key];
  const note = (deg: number, oct = 0) => root + scale[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct);
  const has = (i: string) => (def.instruments as string[]).includes(i);
  const add = (start: number, y: Float32Array, gain: number, pan = 0) => {
    const s = Math.round(start * SR), gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
    for (let i = 0; i < y.length && s + i < N; i++) if (s + i >= 0) { L[s + i] += y[i] * gl; R[s + i] += y[i] * gr; }
  };
  // swung position inside a bar: offbeat eighths are delayed by `swing`
  const at = (barT: number, beatIdx: number, sub = 0) => barT + beatIdx * beat + (sub === 0.5 ? beat * 0.5 * (1 + swing) : sub * beat);
  const keys = (hz: number, len: number) => { const M = Math.round((len + 0.6) * SR), y = new Float32Array(M); for (let i = 0; i < M; i++) { const t = i / SR, I = 0.2 + 1.6 * Math.exp(-t / 0.25); y[i] = (Math.sin(TAU * hz * t + I * Math.sin(TAU * hz * t)) + 0.08 * Math.sin(TAU * hz * 14 * t) * Math.exp(-t / 0.03)) * Math.min(1, t / 0.004) * Math.exp(-t / 1.3) * (t < len ? 1 : Math.exp(-(t - len) / 0.12)); } return y; };
  const guitar = (hz: number, len: number) => { const M = Math.round((len + 0.3) * SR), y = new Float32Array(M), P = Math.max(2, Math.round(SR / hz)), buf = new Float32Array(P); const lp = new Biquad('lp', 2600); for (let i = 0; i < P; i++) buf[i] = lp.run(rnd() * 2 - 1); let idx = 0, prev = 0; for (let i = 0; i < M; i++) { const v = buf[idx]; buf[idx] = 0.5 * (v + prev) * 0.9965; prev = v; idx = (idx + 1) % P; y[i] = v * (i / SR < len ? 1 : Math.exp(-(i / SR - len) / 0.06)); } return y; };
  const strings = (hz: number, len: number) => { const M = Math.round((len + 0.8) * SR), y = new Float32Array(M), lp = new Biquad('lp', 1900, 0.7); for (let i = 0; i < M; i++) { const t = i / SR, vib = 1 + 0.003 * Math.sin(TAU * 5.2 * t); let v = 0; for (const d of [-0.004, 0.0, 0.005]) v += 2 * ((hz * vib * (1 + d) * t) % 1) - 1; y[i] = lp.run(v / 3) * Math.min(1, t / 0.35) * (t < len ? 1 : Math.exp(-(t - len) / 0.35)); } return y; };
  const lead = (hz: number, len: number) => { const M = Math.round((len + 0.15) * SR), y = new Float32Array(M), lp = new Biquad('lp', 3800); for (let i = 0; i < M; i++) { const t = i / SR, vib = 1 + 0.006 * Math.sin(TAU * 5.5 * t) * Math.min(1, t / 0.25); const ph = TAU * hz * vib * t; y[i] = lp.run(Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph) + (rnd() * 2 - 1) * 0.015) * Math.min(1, t / 0.03) * (t < len ? 1 : Math.exp(-(t - len) / 0.05)); } return y; };
  const bassT = (hz: number, len: number) => { const M = Math.round((len + 0.08) * SR), y = new Float32Array(M), lp = new Biquad('lp', 700); for (let i = 0; i < M; i++) { const t = i / SR; y[i] = lp.run(Math.sin(TAU * hz * t) + 0.4 * Math.sin(TAU * hz * 2 * t) + 0.15 * Math.sin(TAU * hz * 3 * t)) * Math.min(1, t / 0.006) * Math.exp(-t / (len * 1.2)) * (t < len ? 1 : Math.exp(-(t - len) / 0.03)); } return y; };
  const noiseHit = (f: number, q: number, a: number, d: number, len = 0.25) => { const M = Math.round(len * SR), y = new Float32Array(M), bp = new Biquad('bp', f, q); for (let i = 0; i < M; i++) y[i] = bp.run(rnd() * 2 - 1) * env(i / SR, a, d); return y; };
  const kick = () => { const M = Math.round(0.3 * SR), y = new Float32Array(M); for (let i = 0; i < M; i++) { const t = i / SR; y[i] = Math.sin(TAU * 52 * t * (1 + 1.6 * Math.exp(-t / 0.025))) * Math.exp(-t / 0.14); } return y; };
  const snap = () => { const y = noiseHit(2300, 3, 0.0008, 0.018, 0.12); for (let i = 0; i < 200; i++) y[i] += Math.sin(TAU * 1700 * i / SR) * Math.exp(-i / 60) * 0.6; return y; };
  const chordOf = (deg: number) => def.sevenths ? [deg, deg + 2, deg + 4, deg + 6] : [deg, deg + 2, deg + 4];
  const prog = def.progression.map(chordDegrees);
  // ----- melody: a 2-bar motif from the seed; phrase plan A A' B A over 8 bars, phrase ends on the tonic
  const rhythms = [[0, 1, 1.5, 2, 3], [0, 0.5, 1, 2, 2.5, 3], [0, 1.5, 2, 3.5], [0.5, 1, 1.5, 2.5, 3], [0, 2, 2.5, 3, 3.5]];
  const motif = [0, 1].map(() => rhythms[Math.floor(rnd() * rhythms.length)]);
  const contour = Array.from({ length: 12 }, () => Math.floor(rnd() * 5) - 2);
  const melodyBar = (b: number, chord: number[]) => {
    const phrase = Math.floor(b / 2) % 4, inBar = b % 2;
    const r = phrase === 2 ? rhythms[(Math.floor(b / 2) + 2) % rhythms.length] : motif[inBar];
    return r.map((pos, k) => {
      const strong = pos === 0 || pos === 2;
      let d = chord[2] + 7 + contour[(k + inBar * 5 + (phrase === 1 ? 2 : 0)) % contour.length];
      if (strong) { const ct = chord.map(c => c + 7); d = ct.reduce((a, c) => Math.abs(c - d) < Math.abs(a - d) ? c : a, ct[0]); }
      if (phrase === 3 && inBar === 1 && k === r.length - 1) d = chord[0] + 7;
      return { pos, deg: d, len: Math.min((r[k + 1] ?? 4) - pos, 1.5) * beat * 0.92 };
    });
  };
  const sting = def.form !== 'loop';
  if (def.form === 'button') { // dominant stab, tonic stab: the classic sitcom button
    const stab = (d: number, t: number, len: number) => {
      for (const c of chordOf(d)) { if (has('keys')) add(t, keys(midiHz(note(c, 1)), len), 0.12); if (has('guitar') || has('pluck') || has('arp')) add(t, guitar(midiHz(note(c, 1)), len), 0.16); if (has('strings') || has('pad')) add(t, strings(midiHz(note(c, 1)), len), 0.06); }
      add(t, bassT(midiHz(note(d, -1)), len), 0.35); add(t, kick(), 0.3);
    };
    stab(4, 0, beat * 0.4); stab(0, beat, Math.max(0.4, durationSec - beat * 1.2));
    if (has('brushes') || has('drums')) add(beat, noiseHit(5000, 0.7, 0.002, 0.25, 0.6), 0.25);
    if (has('lead')) { add(0, lead(midiHz(note(4 + 7, 0)), beat * 0.35), 0.1); add(beat, lead(midiHz(note(7, 0)), beat * 1.2), 0.1); }
  }
  const bars = def.form === 'button' ? 0 : sting ? Math.max(1, Math.round(durationSec / bar)) : Math.ceil(durationSec / bar);
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, lastBar = b === bars - 1, ringOut = sting && lastBar;
    const deg = ringOut ? 0 : prog[b % prog.length];
    const ch = chordOf(deg);
    const section = Math.floor(b / 8) % 2; // B section every other 8 bars: a little more energy
    if (has('pad')) for (const c of ch) add(t0, strings(midiHz(note(c, 1)), bar), 0.035, (c - deg - 2) * 0.15);
    if (has('strings') && (section === 1 || sting)) for (const c of ch.slice(0, 3)) add(t0, strings(midiHz(note(c, 1)), bar * (ringOut ? 1.6 : 1)), 0.05, (c - deg - 2) * 0.2);
    if (has('keys')) {
      const hits = ringOut ? [[0, 0, 3.5]] : def.style === 'lounge' ? [[0, 0, 1.4], [1, 0.5, 0.6], [2, 0.5, 1.2]] : def.style === 'sitcom' ? [[0, 0.5, 0.3], [1, 0.5, 0.3], [2, 0.5, 0.3], [3, 0.5, 0.3]] : [[0, 0, 1.8], [2, 0, 1.8]];
      for (const [bi, sub, len] of hits) for (const [k, c] of ch.entries()) add(at(t0, bi, sub) + k * 0.006, keys(midiHz(note(c, k === 0 ? 0 : 1)), len * beat), 0.07, k % 2 ? 0.25 : -0.2);
    }
    if (has('guitar')) {
      // bossa comp on sixteenths (3+3+2 feel) over the upper chord tones
      const pat = def.style === 'bossa' ? [0, 0.75, 1.5, 2.5, 3.25] : [0, 1, 2, 3];
      if (ringOut) for (const [k, c] of ch.entries()) add(t0 + k * 0.035, guitar(midiHz(note(c, 1)), bar * 1.5), 0.13, 0.15);
      else for (const p of pat) for (const [k, c] of ch.slice(1).entries()) add(t0 + p * beat + k * 0.008, guitar(midiHz(note(c, 1)), beat * 0.7), 0.1, 0.2);
    }
    if (has('arp') || has('pluck')) for (let s = 0; s < 8; s++) { if (ringOut && s > 0) break; const d = ch[[0, 1, 2, 1, 0, 2, 1, 2][s] % ch.length] + (s > 5 ? 7 : 0); add(at(t0, Math.floor(s / 2), s % 2 ? 0.5 : 0), guitar(midiHz(note(d, 1)), beat * 0.45), 0.07, s % 2 ? 0.35 : -0.35); }
    if (has('bell') && (b % 2 === 0 || sting)) add(t0 + (ringOut ? 0 : beat * 2.5), keys(midiHz(note(ch[2], 2)), 1.6), 0.04, 0.3);
    if (has('bass') || has('sub')) {
      const line: [number, number, number][] = ringOut ? [[0, deg, 3.5]]
        : def.style === 'bossa' ? [[0, deg, 1.4], [1.5, deg + 4, 0.45], [2, deg + 4, 1.4], [3.5, deg, 0.45]]
          : def.style === 'lounge' ? [[0, deg, 0.9], [1, deg + 2, 0.9], [2, deg + 4, 0.9], [3, deg + 5, 0.9]]
            : def.style === 'sitcom' ? [[0, deg, 0.4], [0.5 + swing * 0.5, deg + 7, 0.25], [1.5, deg + 4, 0.4], [2, deg, 0.4], [3, deg + 4, 0.3], [3.5, deg + 6, 0.3]]
              : [[0, deg, 0.9], [1, deg, 0.9], [2, deg + 7, 0.9], [3, deg, 0.9]];
      for (const [pos, d, len] of line) add(t0 + pos * beat, bassT(midiHz(note(d, -1)), len * beat), has('sub') ? 0.3 : 0.24);
    }
    if (has('lead')) {
      if (ringOut) add(t0, lead(midiHz(note(ch[0] + 7, 0)), bar * 0.9), 0.08, 0.1);
      else for (const m of melodyBar(b, ch)) add(t0 + m.pos * beat + (m.pos % 1 === 0.5 ? beat * 0.5 * swing : 0), lead(midiHz(note(m.deg, 0)), m.len), section ? 0.09 : 0.075, 0.1);
    }
    if (!ringOut) {
      if (has('brushes')) for (let q = 0; q < 4; q++) { add(at(t0, q, 0), noiseHit(4200, 0.6, 0.03, 0.09, 0.3), q % 2 ? 0.07 : 0.04); add(at(t0, q, 0.5), noiseHit(6000, 0.8, 0.002, 0.03, 0.1), 0.03); }
      if (has('snaps')) for (const q of [1, 3]) add(at(t0, q, 0), snap(), 0.16, q === 1 ? -0.3 : 0.3);
      if (has('drums')) for (let q = 0; q < 4; q++) { if (q % 2 === 0 || (def.style === 'sitcom' && q === 3 && rnd() < 0.4)) add(at(t0, q, 0), kick(), 0.24); if (q % 2 === 1) add(at(t0, q, 0), noiseHit(1900, 0.9, 0.001, 0.07, 0.25), 0.16); add(at(t0, q, 0.5), noiseHit(8000, 1, 0.001, 0.012, 0.06), 0.05); }
      if (def.style === 'bossa' && (has('brushes') || has('drums'))) for (const p of [0, 0.75, 1.5, 2.5, 3]) add(t0 + p * beat, noiseHit(1800, 6, 0.0005, 0.015, 0.06), 0.06, -0.2); // rim clave
    } else if (has('drums') || has('brushes')) add(t0, noiseHit(5500, 0.6, 0.002, 0.5, 1.2), 0.12); // cymbal swell under the last chord
  }
  reverb(L, R, def.style === 'lounge' || def.style === 'bossa' ? 0.24 : 0.2);
  const fadeOut = Math.min(N, Math.round(SR * (sting ? 0.6 : 2)));
  for (let i = 0; i < fadeOut; i++) { const g = i / fadeOut; L[N - 1 - i] *= g; R[N - 1 - i] *= g; }
  let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  if (pk > 0) for (let i = 0; i < N; i++) { L[i] *= 0.7 / pk; R[i] *= 0.7 / pk; }
  return [L, R];
}
