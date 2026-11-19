/** Phoneme alignment for Spanish speech.
 * Anchors: word start times reported by the TTS engine itself. Inside each word, phonemes are aligned to the
 * real waveform with a left-to-right Viterbi over acoustic features (energy, zero-crossing rate, high-band ratio)
 * with minimum durations per phoneme class. Output timings drive the visemes (lip-sync). */
import { PHONEME_CLASS, PHONEME_VISEME, PH_DURATION, textToPhonemeWords } from './phonetics-es.ts';
import type { PhClass } from './phonetics-es.ts';

export interface WordTiming { text: string; start: number; end?: number }
export interface PhonemeTiming { ph: string; start: number; end: number; word: number }
export interface Alignment { words: { text: string; start: number; end: number; phonemes: string[] }[]; phonemes: PhonemeTiming[]; visemes: [number, string][]; voicedEnd: number; method: string }

const HOP = 0.01, WIN = 0.025;
export interface Features { e: Float32Array; z: Float32Array; hf: Float32Array; frames: number }
export function features(x: Float32Array, sr: number): Features {
  const hop = Math.round(HOP * sr), win = Math.round(WIN * sr);
  const frames = Math.max(1, Math.floor((x.length - win) / hop) + 1);
  const e = new Float32Array(frames), z = new Float32Array(frames), hf = new Float32Array(frames);
  const db = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const s = f * hop; let en = 0, zc = 0, d = 0;
    for (let i = s; i < s + win && i < x.length; i++) { en += x[i] * x[i]; if (i > s) { if ((x[i] >= 0) !== (x[i - 1] >= 0)) zc++; const dd = x[i] - x[i - 1]; d += dd * dd; } }
    db[f] = 10 * Math.log10(en / win + 1e-10); z[f] = zc / win; hf[f] = d / (en + 1e-9);
  }
  const sorted = [...db].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.08)], top = sorted[Math.floor(sorted.length * 0.97)];
  for (let f = 0; f < frames; f++) e[f] = Math.min(1, Math.max(0, (db[f] - floor) / Math.max(6, top - floor)));
  return { e, z, hf, frames };
}
function emission(cls: PhClass, f: Features, i: number): number {
  const e = f.e[i], z = f.z[i] * 8, hf = Math.min(1, f.hf[i] / 1.6);
  switch (cls) {
    case 'sil': return e * 7;
    case 'vowel': return (1 - e) * 4 + Math.max(0, z - 0.6) * 3 + hf * 1.2;
    case 'semivowel': return Math.abs(e - 0.75) * 3 + z;
    case 'nasal': case 'liquid': return Math.abs(e - 0.55) * 3 + z * 1.5;
    case 'voicedStop': return Math.abs(e - 0.4) * 3 + z;
    case 'stop': return e * 2.5;
    case 'fricative': case 'affricate': return (1 - hf) * 2.5 + Math.abs(e - 0.35) * 1.5;
  }
}
/** Viterbi alignment of a phoneme sequence to frames [a, b). Returns phoneme start frames. */
function viterbi(phs: string[], f: Features, a: number, b: number): number[] | null {
  const minF = phs.map(p => (PHONEME_CLASS[p] === 'vowel' ? 3 : 2));
  // expanded states: phoneme k has minF[k] chained states; last one may loop
  const states: { ph: number; last: boolean }[] = [];
  phs.forEach((_, k) => { for (let j = 0; j < minF[k]; j++) states.push({ ph: k, last: j === minF[k] - 1 }); });
  // trailing silence state
  states.push({ ph: phs.length, last: true });
  const S = states.length, T = b - a;
  if (T < S - 1) return null;
  const INF = 1e18;
  let prev = new Float64Array(S).fill(INF), cur = new Float64Array(S);
  const back: Int32Array[] = [];
  const em = (s: number, t: number) => { const st = states[s]; const cls = st.ph < phs.length ? PHONEME_CLASS[phs[st.ph]] ?? 'vowel' : 'sil'; return emission(cls, f, a + t) + (st.ph === phs.length ? 0.8 : 0); };
  prev[0] = em(0, 0);
  back.push(new Int32Array(S).fill(-1));
  for (let t = 1; t < T; t++) {
    const bp = new Int32Array(S).fill(-1);
    for (let s = 0; s < S; s++) {
      let best = INF, arg = -1;
      if (states[s].last && prev[s] < best) { best = prev[s] + 0.05; arg = s; }
      if (s > 0 && prev[s - 1] < best) { best = prev[s - 1]; arg = s - 1; }
      cur[s] = arg < 0 ? INF : best + em(s, t); bp[s] = arg;
    }
    back.push(bp); [prev, cur] = [cur, prev];
  }
  // end in the last phoneme or in trailing silence
  let endS = prev[S - 1] <= prev[S - 2] ? S - 1 : S - 2;
  if (prev[endS] >= INF) return null;
  const path = new Int32Array(T);
  for (let t = T - 1; t >= 0; t--) { path[t] = endS; endS = back[t][endS]; if (endS < 0 && t > 0) return null; }
  const starts = phs.map(() => -1);
  for (let t = 0; t < T; t++) { const k = states[path[t]].ph; if (k < phs.length && starts[k] < 0) starts[k] = t; }
  let silStart = T; for (let t = 0; t < T; t++) if (states[path[t]].ph === phs.length) { silStart = t; break; }
  return [...starts.map(s => a + s), a + silStart];
}

export function alignSpeech(text: string, samples: Float32Array, sr: number, words: WordTiming[]): Alignment {
  const f = features(samples, sr);
  const dur = samples.length / sr;
  const toF = (t: number) => Math.max(0, Math.min(f.frames, Math.round(t / HOP)));
  const pw = textToPhonemeWords(text);
  // voiced activity
  let lastVoiced = 0; for (let i = 0; i < f.frames; i++) if (f.e[i] > 0.18) lastVoiced = i;
  const voicedEnd = Math.min(dur, (lastVoiced + 3) * HOP);
  // match engine word cues to our phoneme words (engine words may merge/split numbers or clitics)
  let anchors: { start: number }[] = [];
  if (words.length === pw.length) anchors = words.map(w => ({ start: w.start }));
  else if (words.length) {
    // proportional mapping by character position when counts differ
    let wi = 0; anchors = pw.map((_, i) => { const target = i / pw.length * words.length; wi = Math.min(words.length - 1, Math.floor(target)); const frac = target - wi; const s0 = words[wi].start, s1 = words[wi + 1]?.start ?? voicedEnd; return { start: s0 + (s1 - s0) * frac }; });
  } else {
    // no engine timing: distribute by phoneme duration priors over the voiced region
    let firstVoiced = 0; for (let i = 0; i < f.frames; i++) if (f.e[i] > 0.18) { firstVoiced = i; break; }
    const total = pw.reduce((s, w) => s + w.phonemes.reduce((a, p) => a + PH_DURATION[PHONEME_CLASS[p] ?? 'vowel'], 0), 0);
    let t = firstVoiced * HOP; const k = (voicedEnd - t) / Math.max(0.05, total);
    anchors = pw.map(w => { const s = t; t += w.phonemes.reduce((a, p) => a + PH_DURATION[PHONEME_CLASS[p] ?? 'vowel'], 0) * k; return { start: s }; });
  }
  const outWords: Alignment['words'] = [];
  const phonemes: PhonemeTiming[] = [];
  let method = words.length === pw.length ? 'engine-words+viterbi' : words.length ? 'engine-words(proportional)+viterbi' : 'energy+viterbi';
  for (let i = 0; i < pw.length; i++) {
    const a = toF(anchors[i].start), bNext = i + 1 < pw.length ? toF(anchors[i + 1].start) : toF(voicedEnd) + 4;
    const b = Math.max(a + 1, Math.min(f.frames, bNext));
    const phs = pw[i].phonemes;
    let st = viterbi(phs, f, a, b);
    if (!st) { // too short: proportional fallback
      method += '*';
      const tot = phs.reduce((s, p) => s + PH_DURATION[PHONEME_CLASS[p] ?? 'vowel'], 0);
      let acc = a; st = phs.map(p => { const s0 = acc; acc += (b - a) * PH_DURATION[PHONEME_CLASS[p] ?? 'vowel'] / tot; return Math.round(s0); }); st.push(b);
    }
    const wordEnd = st[phs.length] * HOP;
    phs.forEach((ph, k) => phonemes.push({ ph, start: st![k] * HOP, end: (k + 1 < phs.length ? st![k + 1] : st![phs.length]) * HOP, word: i }));
    outWords.push({ text: pw[i].word, start: st[0] * HOP, end: wordEnd, phonemes: phs });
  }
  // visemes: phoneme targets placed slightly before the acoustic onset (lips anticipate sound ~40 ms)
  const visemes: [number, string][] = [];
  const LEAD = 0.04;
  let lastEnd = 0;
  for (const p of phonemes) {
    if (p.start - lastEnd > 0.09 && visemes.length) visemes.push([lastEnd + 0.02, 'sil']);
    const v = PHONEME_VISEME[p.ph] ?? 'sil';
    const t = Math.max(0, p.start - LEAD);
    if (!visemes.length || visemes[visemes.length - 1][1] !== v) visemes.push([t, v]);
    lastEnd = p.end;
  }
  visemes.push([lastEnd, 'sil']);
  for (let i = 1; i < visemes.length; i++) if (visemes[i][0] <= visemes[i - 1][0]) visemes[i][0] = visemes[i - 1][0] + 0.005;
  return { words: outWords, phonemes, visemes, voicedEnd, method };
}

/** Lip-sync QA: cross-correlate mouth opening (from visemes) with the audio envelope; returns lag in seconds. */
export function lipSyncLag(samples: Float32Array, sr: number, mouthOpen: (t: number) => number, maxLag = 0.25): { lagSec: number; correlation: number } {
  const f = features(samples, sr);
  const n = f.frames;
  const m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = mouthOpen(i * HOP + WIN / 2);
  const norm = (x: Float32Array) => { let mu = 0; for (const v of x) mu += v; mu /= x.length; let sd = 0; for (const v of x) sd += (v - mu) ** 2; sd = Math.sqrt(sd / x.length) || 1; return Float32Array.from(x, v => (v - mu) / sd); };
  const A = norm(f.e), B = norm(m);
  let best = -Infinity, bestLag = 0;
  const L = Math.round(maxLag / HOP);
  for (let lag = -L; lag <= L; lag++) { let s = 0, c = 0; for (let i = 0; i < n; i++) { const j = i + lag; if (j < 0 || j >= n) continue; s += A[i] * B[j]; c++; } const r = s / Math.max(1, c); if (r > best) { best = r; bestLag = lag; } }
  return { lagSec: bestLag * HOP, correlation: best };
}
