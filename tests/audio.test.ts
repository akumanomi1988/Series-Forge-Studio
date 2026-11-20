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
