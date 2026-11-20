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
    case 'voicedStop': return Math.abs(e - 0.4) * 3 + z + 0.15;
    case 'stop': return e * 2.5 + 0.3;
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
  const pw = textToPhonemeWords(text);
  let lastVoiced = 0; for (let i = 0; i < f.frames; i++) if (f.e[i] > 0.18) lastVoiced = i;
  const voicedEnd = Math.min(samples.length / sr, (lastVoiced + 3) * HOP);
  // soft anchors from the engine word cues (mapped proportionally when the counts differ)
  let anchors: (number | null)[] = pw.map(() => null);
  if (words.length === pw.length) anchors = words.map(w => w.start);
  else if (words.length) anchors = pw.map((_, i) => { const target = i / pw.length * words.length; const wi = Math.min(words.length - 1, Math.floor(target)); const s0 = words[wi].start, s1 = words[wi + 1]?.start ?? voicedEnd; return s0 + (s1 - s0) * (target - wi); });
  const method = words.length === pw.length ? 'utterance-viterbi+engine-anchors' : words.length ? 'utterance-viterbi+proportional-anchors' : 'utterance-viterbi';
  // state graph: [lead sil] (w0 phonemes) [sil1] (w1 phonemes) ... [tail sil]
  interface St { kind: 'sil' | 'ph'; word: number; ph: number; first: boolean; last: boolean; cls: PhClass }
  const states: St[] = [{ kind: 'sil', word: -1, ph: -1, first: false, last: true, cls: 'sil' }];
  const wordFirst: number[] = [], wordLast: number[] = [], silBefore: number[] = [];
  pw.forEach((w, wi) => {
    if (wi > 0) { silBefore[wi] = states.length; states.push({ kind: 'sil', word: wi, ph: -1, first: false, last: true, cls: 'sil' }); }
    w.phonemes.forEach((ph, k) => { const cls = PHONEME_CLASS[ph] ?? 'vowel'; const n = cls === 'vowel' ? 3 : 2; for (let j = 0; j < n; j++) { if (k === 0 && j === 0) wordFirst[wi] = states.length; states.push({ kind: 'ph', word: wi, ph: k, first: j === 0, last: j === n - 1, cls }); } });
    wordLast[wi] = states.length - 1;
  });
  const tailSil = states.length; states.push({ kind: 'sil', word: pw.length, ph: -1, first: false, last: true, cls: 'sil' });
  const S = states.length, T = f.frames, INF = 1e18;
  if (T < S) return proportional();
  // predecessors
  const preds: number[][] = states.map(() => []);
  for (let s = 1; s < S; s++) {
    const st = states[s];
    if (st.kind === 'ph' && !(st.first && st.ph === 0)) preds[s].push(s - 1);
    else if (st.kind === 'ph') { // first state of a word: from previous word end, or from the pause before it, or the lead silence
      if (st.word === 0) preds[s].push(0);
      else { preds[s].push(wordLast[st.word - 1]); preds[s].push(silBefore[st.word]); }
    } else if (s === tailSil) preds[s].push(wordLast[pw.length - 1]);
    else preds[s].push(wordLast[st.word - 1]); // pause state after previous word
  }
  const anchorCost = (s: number, t: number) => { const st = states[s]; if (st.kind !== 'ph' || st.ph !== 0 || !st.first) return 0; const a = anchors[st.word]; if (a === null) return 0; return 2 * Math.min(14, Math.abs(t * HOP - a) / 0.04); };
  const em = (s: number, t: number) => emission(states[s].cls, f, t) + (states[s].kind === 'sil' && s !== 0 && s !== tailSil ? 0.08 : 0);
  let prev = new Float64Array(S).fill(INF), cur = new Float64Array(S);
  const back: Int16Array[] = [];
  prev[0] = em(0, 0);
  if (wordFirst[0] !== undefined) prev[wordFirst[0]] = em(wordFirst[0], 0) + anchorCost(wordFirst[0], 0);
  back.push(new Int16Array(S).fill(-1));
  for (let t = 1; t < T; t++) {
    const bp = new Int16Array(S).fill(-1);
    for (let s = 0; s < S; s++) {
      let best = INF, arg = -1;
      if (states[s].last && prev[s] < best) { best = prev[s] + (states[s].kind === 'sil' ? 0 : 0.05); arg = s; }
      for (const q of preds[s]) if (prev[q] < best) { best = prev[q]; arg = q; }
      cur[s] = arg < 0 ? INF : best + em(s, t) + (arg !== s ? anchorCost(s, t) : 0); bp[s] = arg;
    }
    back.push(bp); [prev, cur] = [cur, prev];
  }
  let end = prev[tailSil] <= prev[wordLast[pw.length - 1]] ? tailSil : wordLast[pw.length - 1];
  if (prev[end] >= INF) return proportional();
  const path = new Int32Array(T);
  for (let t = T - 1; t >= 0; t--) { path[t] = end; end = back[t][end]; if (end < 0 && t > 0) return proportional(); }
  const phonemes: PhonemeTiming[] = [];
  let prevKey = '';
  for (let t = 0; t < T; t++) {
    const st = states[path[t]];
    if (st.kind !== 'ph') { prevKey = ''; continue; }
    const key = st.word + ':' + st.ph;
    if (key === prevKey) phonemes[phonemes.length - 1].end = (t + 1) * HOP;
    else phonemes.push({ ph: pw[st.word].phonemes[st.ph], start: t * HOP, end: (t + 1) * HOP, word: st.word });
    prevKey = key;
  }
  return finish(phonemes, method);

  function proportional(): Alignment {
    let firstVoiced = 0; for (let i = 0; i < f.frames; i++) if (f.e[i] > 0.18) { firstVoiced = i; break; }
    const total = pw.reduce((s, w) => s + w.phonemes.reduce((a, p) => a + PH_DURATION[PHONEME_CLASS[p] ?? 'vowel'], 0), 0);
    let t = firstVoiced * HOP; const k = (voicedEnd - t) / Math.max(0.05, total);
    const phs: PhonemeTiming[] = [];
    pw.forEach((w, wi) => w.phonemes.forEach(ph => { const d = PH_DURATION[PHONEME_CLASS[ph] ?? 'vowel'] * k; phs.push({ ph, start: t, end: t + d, word: wi }); t += d; }));
    return finish(phs, 'proportional');
  }
  function finish(phonemes: PhonemeTiming[], m: string): Alignment {
    const outWords = pw.map((w, i) => { const ps = phonemes.filter(p => p.word === i); return { text: w.word, start: ps[0]?.start ?? 0, end: ps[ps.length - 1]?.end ?? 0, phonemes: w.phonemes }; });
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
    return { words: outWords, phonemes, visemes, voicedEnd, method: m };
  }
}


/** Lip-sync QA: cross-correlate mouth opening (from visemes) with the audio envelope; returns lag in seconds. */
/** Speech activity vs. mouth activity curves (10 ms frames) for one clip. */
export function activityCurves(samples: Float32Array, sr: number, mouthOpen: (t: number) => number): { act: Float32Array; mouth: Float32Array } {
  const f = features(samples, sr), n = f.frames;
  // activity-based comparison: mouth moving (any non-rest shape) vs. speech present; robust to /u/ (loud but small opening)
  const mouth = new Float32Array(n); for (let i = 0; i < n; i++) { const o = mouthOpen(i * HOP + WIN / 2); mouth[i] = o > 0.06 ? 0.6 + 0.4 * Math.min(1, o) : 0; }
  return { act: Float32Array.from(f.e, v => Math.min(1, v * 1.6)), mouth };
}
/** Lag (s) that best aligns mouth activity with speech activity (positive = mouth late). `prominence` is how much
 * better the best lag correlates than lag 0: with short lines the curve is often flat and the lag is not meaningful. */
export function curvesLag(act: Float32Array, mouth: Float32Array, maxLag = 0.25): { lagSec: number; correlation: number; atZero: number; prominence: number } {
  const n = Math.min(act.length, mouth.length);
  const norm = (x: Float32Array) => { let mu = 0; for (let i = 0; i < n; i++) mu += x[i]; mu /= n; let sd = 0; for (let i = 0; i < n; i++) sd += (x[i] - mu) ** 2; sd = Math.sqrt(sd / n) || 1; return Float32Array.from(x.subarray(0, n), v => (v - mu) / sd); };
  const A = norm(act), B = norm(mouth);
  let best = -Infinity, bestLag = 0, atZero = 0;
  const L = Math.round(maxLag / HOP);
  for (let lag = -L; lag <= L; lag++) { let s = 0, c = 0; for (let i = 0; i < n; i++) { const j = i + lag; if (j < 0 || j >= n) continue; s += A[i] * B[j]; c++; } const r = s / Math.max(1, c); if (lag === 0) atZero = r; if (r > best) { best = r; bestLag = lag; } }
  return { lagSec: bestLag * HOP, correlation: best, atZero, prominence: best - atZero };
}
/** Perceptual lip-sync at speech boundaries: for every speech onset/offset (around silences >= 120 ms and the clip
 * edges; gaps < 200 ms are not pauses) the nearest mouth open/close transition of the same kind; error = mouth time - sound time (s).
 * Positive onset error = mouth opens late. Also returns how much of the long silences (>= 200 ms) has the mouth open. */
export function boundarySync(samples: Float32Array, sr: number, mouthOpen: (t: number) => number): { boundaries: { kind: 'onset' | 'offset'; at: number; errSec: number | null }[]; mouthInSilence: number; silenceSec: number } {
  const hop = Math.round(sr * 0.01), n = Math.floor(samples.length / hop);
  const db = new Float32Array(n); for (let f = 0; f < n; f++) { let e = 0; for (let i = f * hop; i < (f + 1) * hop; i++) e += samples[i] * samples[i]; db[f] = 10 * Math.log10(e / hop + 1e-12); }
  const peak = Math.max(...db), thr = Math.max(-45, peak - 35);
  const sound = Array.from(db, v => v > thr), mouth = Array.from({ length: n }, (_, f) => mouthOpen(f * 0.01 + 0.005) > 0.06);
  // close short gaps (< 200 ms) in the sound mask: stop closures and quiet fricatives are not pauses
  for (let f = 0; f < n;) { if (sound[f]) { f++; continue; } let g = f; while (g < n && !sound[g]) g++; if (f > 0 && g < n && g - f < 20) for (let k = f; k < g; k++) sound[k] = true; f = g; }
  const trans = (m: boolean[]) => { const on: number[] = [], off: number[] = []; if (m[0]) on.push(0); for (let f = 1; f < n; f++) { if (m[f] && !m[f - 1]) on.push(f * 0.01); if (!m[f] && m[f - 1]) off.push(f * 0.01); } if (m[n - 1]) off.push(n * 0.01); return { on, off }; };
  const S = trans(sound), M = trans(mouth);
  const near = (list: number[], t: number) => { let best: number | null = null; for (const x of list) if (Math.abs(x - t) <= 0.3 && (best === null || Math.abs(x - t) < Math.abs(best - t))) best = x; return best; };
  const boundaries = [...S.on.map(t => ({ kind: 'onset' as const, at: t, m: near(M.on, t) })), ...S.off.map(t => ({ kind: 'offset' as const, at: t, m: near(M.off, t) }))]
    .map(b => ({ kind: b.kind, at: +b.at.toFixed(2), errSec: b.m === null ? null : +(b.m - b.at).toFixed(3) })).sort((a, b) => a.at - b.at);
  let sil = 0, open = 0;
  for (let f = 0; f < n;) { if (sound[f]) { f++; continue; } let g = f; while (g < n && !sound[g]) g++; if (g - f >= 20) for (let k = f + 4; k < g - 4; k++) { sil++; if (mouth[k]) open++; } f = g; }
  return { boundaries, mouthInSilence: sil ? open / sil : 0, silenceSec: sil * 0.01 };
}
export function lipSyncLag(samples: Float32Array, sr: number, mouthOpen: (t: number) => number, maxLag = 0.25): { lagSec: number; correlation: number; prominence: number } {
  const { act, mouth } = activityCurves(samples, sr, mouthOpen);
  const r = curvesLag(act, mouth, maxLag);
  return { lagSec: r.lagSec, correlation: r.correlation, prominence: r.prominence };
}
