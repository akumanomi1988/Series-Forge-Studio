// Voice engines: selection (alternatives), per-emotion delivery, Voicebox protocol against a local server that
// implements its documented API, and a real Kokoro synthesis when the project-local model is installed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VoiceSchema } from '../src/engine/schema.ts';
import { resolveVoice, deliveryFor, synthesize } from '../src/audio/tts.ts';
import { synthVoicebox, kokoroAvailable, stopKokoro, voiceboxUrl } from '../src/audio/providers.ts';
import { writeWavAtomic, readWav } from '../src/audio/wav.ts';
import { execFileSync } from 'node:child_process';

const base = VoiceSchema.parse({
  schemaVersion: 2, provider: 'kokoro', voice: 'ef_dora', rate: 1, license: { id: 'Apache-2.0', commercialUse: 'allowed' },
  alternatives: { voicebox: { voice: 'Susana', engine: 'qwen', instruct: 'sultry, low and warm' }, 'windows-onecore': { voice: 'Microsoft Laura', rate: 1.04 } },
  emotions: { smirk: { voice: 'ef_dora:0.8+af_bella:0.2', rate: 0.94, instruct: 'teasing, half-smiling' } }
});

test('voices: alternatives switch engine, unknown ones keep the main voice', () => {
  assert.equal(resolveVoice(base, 'auto').provider, 'kokoro');
  const vb = resolveVoice(base, 'voicebox');
  assert.equal(vb.provider, 'voicebox'); assert.equal(vb.voice, 'Susana'); assert.equal(vb.engine, 'qwen');
  assert.equal(resolveVoice(base, 'windows-onecore').rate, 1.04);
  assert.equal(resolveVoice(base, 'piper').provider, 'kokoro');
});

test('voices: per-emotion delivery (blend, rate, instruct) on top of the emotion prosody', () => {
  const d = deliveryFor({ text: 'x', voice: base }, 'smirk');
  assert.equal(d.voice, 'ef_dora:0.8+af_bella:0.2');
  assert.ok(Math.abs(d.rate - 0.94 * 0.95) < 1e-9, 'rate = voice delivery × emotion prosody');
  assert.match(d.instruct, /teasing/);
  const angry = deliveryFor({ text: 'x', voice: resolveVoice(base, 'voicebox'), direction: 'gritando' }, 'angry');
  assert.match(angry.instruct, /^sultry, low and warm\. irritated/); assert.match(angry.instruct, /shouting/);
  assert.ok(angry.rate > 1 && angry.semitones > 0 && angry.gainDb > 0);
});

test('voicebox: only loopback, profile by name, instruct sent, WAV stored', async () => {
  process.env.SERIES_FORGE_VOICEBOX_URL = 'http://192.168.1.5:17493';
  assert.throws(() => voiceboxUrl(), /local/);
  const dir = await mkdtemp(join(tmpdir(), 'sf-vb-'));
  const wav = join(dir, 'ref.wav');
  await writeWavAtomic(wav, { sampleRate: 24000, channels: [Float32Array.from({ length: 24000 }, (_, i) => Math.sin(i / 10) * 0.3)] }, 16);
  const { readFile } = await import('node:fs/promises');
  const wavBytes = await readFile(wav);
  let got: Record<string, unknown> = {};
  const srv = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
    if (req.url === '/profiles') { res.end(JSON.stringify([{ id: 'p-77', name: 'Susana' }])); return; }
    if (req.url === '/generate/stream' && req.method === 'POST') { got = JSON.parse(Buffer.concat(chunks).toString()); res.writeHead(200, { 'content-type': 'audio/wav' }).end(wavBytes); return; }
    res.writeHead(404).end();
  });
  await new Promise<void>(ok => srv.listen(0, '127.0.0.1', ok));
  process.env.SERIES_FORGE_VOICEBOX_URL = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  try {
    const out = join(dir, 'out.wav');
    await synthVoicebox('Hola [pausa 0.5] guapo.', { voice: 'susana', language: 'es-ES', engine: 'qwen', instruct: 'teasing' }, out);
    assert.deepEqual(got, { profile_id: 'p-77', text: 'Hola … guapo.', language: 'es', normalize: true, engine: 'qwen', instruct: 'teasing' });
    assert.equal((await readWav(out)).sampleRate, 24000);
  } finally { srv.close(); delete process.env.SERIES_FORGE_VOICEBOX_URL; await rm(dir, { recursive: true, force: true }); }
});

let ffmpeg = true; try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { ffmpeg = false; }
test('kokoro: real local synthesis in Spanish (skipped when tools/kokoro is not installed)', { skip: !kokoroAvailable().ok || !ffmpeg ? 'Kokoro o FFmpeg no instalados (npm run setup:kokoro)' : false }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sf-kok-'));
  try {
    const r = await synthesize({ text: '¿Otra vez tú por aquí?', voice: base }, dir, 'smirk');
    assert.equal(r.provider, 'kokoro');
    assert.ok(r.duration > 0.8 && r.duration < 4, `duración razonable (${r.duration.toFixed(2)} s)`);
    assert.ok(r.alignment.visemes.length > 4);
    // speaking rate stays conversational (not the old 2× bug): 9 syllables
    assert.ok(9 / r.duration < 8.5, `${(9 / r.duration).toFixed(1)} sílabas/s`);
  } finally { stopKokoro(); await rm(dir, { recursive: true, force: true }); }
});
