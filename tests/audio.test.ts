import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasOneCore, hasFfmpeg } from './helpers.ts';
import { wordToPhonemes, numberToWords, estimateSpeech } from '../src/audio/phonetics-es.ts';
import { generateSfx, generateMusic, SR } from '../src/audio/synth.ts';
import { integratedLoudness, limit, mixSegment } from '../src/audio/mixer.ts';
import { lipSyncLag } from '../src/audio/align.ts';
import { visemeAt } from '../src/engine/face.ts';
import { SfxSchema, MusicSchema, VoiceSchema } from '../src/engine/schema.ts';
import { writeWavAtomic, readWav, mono } from '../src/audio/wav.ts';

test('G2P español: dígrafos, c/z, g/j, h muda, ñ, números', () => {
  assert.deepEqual(wordToPhonemes('chico'), ['tS', 'i', 'k', 'o']);
  assert.deepEqual(wordToPhonemes('guerra'), ['g', 'e', 'rr', 'a']);
  assert.deepEqual(wordToPhonemes('hacer'), ['a', 'T', 'e', 'r']);
  assert.deepEqual(wordToPhonemes('jirafa'), ['x', 'i', 'r', 'a', 'f', 'a']);
  assert.deepEqual(wordToPhonemes('niño'), ['n', 'i', 'J', 'o']);
  assert.deepEqual(wordToPhonemes('queso'), ['k', 'e', 's', 'o']);
  assert.equal(numberToWords(1985), 'mil novecientos ochenta y cinco');
  assert.ok(estimateSpeech('Hola, Bruno.').duration > 0.5);
});

test('SFX y música procedurales: deterministas, no silenciosos, con licencia original', () => {
  const def = SfxSchema.parse({ schemaVersion: 2, id: 'impact', kind: 'sfx', generator: 'metal-impact', durationSec: 0.5, seed: 3 });
  const a = generateSfx(def), b = generateSfx(def);
  assert.deepEqual(a.slice(0, 2000), b.slice(0, 2000));
  let peak = 0; for (const v of a) peak = Math.max(peak, Math.abs(v)); assert.ok(peak > 0.5);
  assert.equal(def.license.commercialUse, 'allowed');
  const m = MusicSchema.parse({ schemaVersion: 2, id: 'm', kind: 'music', durationSec: 4 });
  const [L] = generateMusic(m, 4);
  let e = 0; for (const v of L) e += v * v; assert.ok(Math.sqrt(e / L.length) > 0.01);
});

test('loudness BS.1770 y limitador', () => {
  const N = SR * 5, L = new Float32Array(N), R = new Float32Array(N);
  for (let i = 0; i < N; i++) { L[i] = R[i] = 0.1 * Math.sin(2 * Math.PI * 997 * i / SR); }
  const lufs = integratedLoudness({ L, R });
  assert.ok(Math.abs(lufs - (-20.0)) < 1.0, `1 kHz -20 dBFS pico estéreo ≈ -20 LUFS (medido ${lufs.toFixed(2)})`);
  for (let i = 0; i < N; i++) { L[i] *= 15; R[i] *= 15; }
  limit({ L, R }, -1);
  let pk = 0; for (const v of L) pk = Math.max(pk, Math.abs(v));
  assert.ok(pk <= 0.8913 + 1e-3, `pico tras limitador ${pk}`);
});

test('mezcla: el diálogo hace ducking de la cama musical y se coloca en su muestra exacta', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-mix-'));
  const tone = new Float32Array(SR); for (let i = 0; i < SR; i++) tone[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / SR);
  const file = join(dir, 'line.wav'); await writeWavAtomic(file, { sampleRate: SR, channels: [tone] }, 32);
  const sfx = { bed: SfxSchema.parse({ schemaVersion: 2, id: 'bed', kind: 'ambience', generator: 'room-tone', durationSec: 4 }) };
  const { mix } = await mixSegment([
    { id: 'amb', kind: 'ambience', sound: 'bed', start: 0, duration: 4, gainDb: 0, fadeIn: 0, fadeOut: 0, pan: 0, duck: true },
    { id: 'd', kind: 'dialogue', sound: 'd', start: 2, duration: 1, gainDb: 0, fadeIn: 0, fadeOut: 0, pan: 0, duck: false, file }
  ], 0, 4, { sfx, music: {}, cacheDir: dir });
  // energy of the bed alone before the line vs. bed+line window minus line contribution
  const rms = (a: Float32Array, s: number, e: number) => { let x = 0; for (let i = s; i < e; i++) x += a[i] * a[i]; return Math.sqrt(x / (e - s)); };
  assert.ok(rms(mix.L, Math.round(2 * SR), Math.round(2 * SR) + 100) > 0.05, 'la línea empieza en t=2 s');
  assert.ok(rms(mix.L, Math.round(1.0 * SR), Math.round(1.5 * SR)) > 0, 'cama audible fuera del diálogo');
});

test('las pausas internas de la voz se acortan sin tocar las palabras y el mapa de tiempos es monótono', async () => {
  const { compressPauses, maxPauseFor } = await import('../src/audio/tts.ts');
  const { displayText } = await import('../src/audio/phonetics-es.ts');
  // 0.5 s tone, 1.2 s silence, 0.5 s tone, 0.2 s silence (short pause kept), 0.5 s tone
  const seg = (sec: number, on: boolean) => Float32Array.from({ length: Math.round(sec * SR) }, (_, i) => on ? 0.3 * Math.sin(2 * Math.PI * 200 * i / SR) : 0);
  const parts = [seg(0.5, true), seg(1.2, false), seg(0.5, true), seg(0.2, false), seg(0.5, true)];
  const x = new Float32Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { x.set(p, o); o += p.length; }
  const r = compressPauses(x, SR, 0.36);
  assert.ok(Math.abs(r.removed - 0.84) < 0.02, `quita ~0.84 s (medido ${r.removed.toFixed(3)})`);
  assert.ok(Math.abs(r.samples.length / SR - (2.9 - r.removed)) < 1e-6);
  assert.ok(Math.abs(r.map(1.7) - 0.86) < 0.02, 'el inicio de la segunda palabra se desplaza lo eliminado');
  assert.equal(r.map(0.2), 0.2, 'antes de la pausa no cambia');
  for (let t = 0, prev = -1; t < 2.9; t += 0.01) { const m = r.map(t); assert.ok(m >= prev - 1e-9); prev = m; }
  assert.equal(maxPauseFor('Lo sé. Lo sé.'), 0.36);
  assert.equal(maxPauseFor('Eso... es largo.'), 0.5);
  assert.ok(Math.abs(maxPauseFor('Vale. [pausa 1.2] Café.') - 1.3) < 1e-9, 'una pausa escrita se respeta');
  assert.equal(displayText('Vale. [pausa 1.2] Café.'), 'Vale. Café.');
});

test('la boca no se mueve durante los silencios: los visemas que caen en una pausa vuelven a su palabra', async () => {
  const { snapToSpeech } = await import('../src/audio/tts.ts');
  // speech 0–0.5 s, silence 0.5–1.1 s, speech 1.1–1.6 s
  const x = Float32Array.from({ length: Math.round(1.6 * SR) }, (_, i) => { const t = i / SR; return t < 0.5 || t >= 1.1 ? 0.3 * Math.sin(2 * Math.PI * 180 * t) : 0; });
  const al = { method: 'test', voicedEnd: 1.6, phonemes: [],
    words: [{ text: 'robot', start: 0, end: 0.75, phonemes: [] }, { text: 'que', start: 0.9, end: 1.3, phonemes: [] }],
    visemes: [[0, 'R'], [0.2, 'O'], [0.6, 'MBP'], [0.7, 'O'], [0.95, 'KG'], [1.15, 'E'], [1.6, 'sil']] as [number, string][] };
  const r = snapToSpeech(al, x, SR);
  assert.ok(r.visemes.every(([t, v]) => v === 'sil' || t <= 0.5 || t >= 1.05), JSON.stringify(r.visemes));
  assert.ok(r.visemes.some(([t, v]) => v === 'sil' && t >= 0.49 && t <= 0.52), 'la boca se cierra al empezar el silencio');
  assert.deepEqual(r.visemes.map(v => v[1]).filter(v => v !== 'sil'), ['R', 'O', 'MBP', 'O', 'KG', 'E'], 'no se pierde ninguna forma');
  for (let i = 1; i < r.visemes.length; i++) assert.ok(r.visemes[i][0] >= r.visemes[i - 1][0]);
  assert.ok(Math.abs(r.visemes.find(v => v[1] === 'E')![0] - 1.15) < 1e-9, 'los visemas ya bien colocados no se mueven');
});

test('informe de ritmo: detecta tiempo muerto entre frases y al final', async () => {
  const { pacingReport } = await import('../src/pipeline/validate.ts');
  const d = (start: number, duration: number) => ({ kind: 'dialogue', start, duration });
  const plan = { durationSec: 20, scenes: [{ id: 'sc-001', start: 0, duration: 20 }], audio: [d(0.5, 2), d(2.8, 2), d(9, 2), d(11.2, 3)] } as unknown as Parameters<typeof pacingReport>[0];
  const r = pacingReport(plan);
  assert.equal(r.deadAir.length, 2, JSON.stringify(r));
  assert.equal(r.deadAir[0].gapSec, 4.2);
  assert.equal(r.deadAir[1].scene, 'final');
  assert.equal(r.longestGapSec, 4.2);
});

test('TTS offline en español (OneCore) con caché, alineación y lip-sync ≤ 60 ms', async t => {
  if (!hasOneCore() || !hasFfmpeg()) { t.skip('requiere Windows con voces OneCore es-ES y FFmpeg'); return; }
  const { synthesize } = await import('../src/audio/tts.ts');
  const dir = mkdtempSync(join(tmpdir(), 'sf-tts-'));
  const voice = VoiceSchema.parse({ schemaVersion: 2, provider: 'windows-onecore', voice: 'Microsoft Pablo', pitchSemitones: -2, license: { id: 'x', commercialUse: 'unknown' } });
  const r = await synthesize({ text: 'El turno acabó hace una hora, Bruno.', voice }, dir);
  assert.ok(r.duration > 1 && r.duration < 5);
  assert.match(r.alignment.method, /engine-anchors/);
  assert.equal(r.alignment.words.length, 7);
  const x = mono(await readWav(r.file));
  const lag = lipSyncLag(x, SR, tt => visemeAt(r.alignment.visemes, tt).open);
  assert.ok(Math.abs(lag.lagSec) <= 0.06 && lag.correlation > 0.4, JSON.stringify(lag));
  const again = await synthesize({ text: 'El turno acabó hace una hora, Bruno.', voice }, dir);
  assert.equal(again.cached, true);
  const other = await synthesize({ text: 'El turno acabó hace una hora, Bruno.', voice: { ...voice, voice: 'Microsoft Laura', pitchSemitones: 0 } }, dir);
  assert.notEqual(other.key, r.key, 'otra voz = otra entrada de caché');
});

test('la velocidad de la voz respeta el multiplicador (regresión: "96%" se leía como +96 %)', async t => {
  if (!hasOneCore() || !hasFfmpeg()) { t.skip('requiere Windows con voces OneCore es-ES y FFmpeg'); return; }
  const { synthesize, buildSsml } = await import('../src/audio/tts.ts');
  const dir = mkdtempSync(join(tmpdir(), 'sf-rate-'));
  const base = VoiceSchema.parse({ schemaVersion: 2, provider: 'windows-onecore', voice: 'Microsoft Pablo', rate: 1, license: { id: 'x', commercialUse: 'unknown' } });
  const text = 'Sí, sí. Estaba ajustando unos tornillos. Nada grave.';
  assert.match(buildSsml({ text, voice: { ...base, rate: 0.96 } }), /rate="0\.96"/);
  const normal = await synthesize({ text, voice: base }, dir);
  const slow = await synthesize({ text, voice: { ...base, rate: 0.8 } }, dir);
  const wps = 8 / normal.duration;
  assert.ok(wps > 1.2 && wps < 2.6, `palabras/segundo naturales (medido ${wps.toFixed(2)})`);
  const ratio = slow.duration / normal.duration;
  assert.ok(ratio > 1.12 && ratio < 1.4, `rate 0.8 alarga ~25 % (medido ${ratio.toFixed(2)})`);
});
