/** Offline TTS with persistent per-character voices, cache by (text, voice, prosody), retries and post-processing.
 * Providers: windows-onecore (WinRT voices, word timings), windows-sapi (System.Speech), piper (local binary + model),
 * silent (test-only placeholder that is flagged in reports). No cloud, no API keys. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rm, stat, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import type { VoiceProfile } from '../engine/schema.ts';
import { readWav, writeWavAtomic, mono } from './wav.ts';
import { alignSpeech } from './align.ts';
import type { Alignment, WordTiming } from './align.ts';
import { estimateSpeech } from './phonetics-es.ts';
import { REPO_ROOT } from '../pipeline/project.ts';

export const TTS_VERSION = 8;
export interface SpeechRequest { text: string; voice: VoiceProfile; emotion?: string; intensity?: number; direction?: string; rate?: number; pitchSemitones?: number }
export interface SpeechResult { file: string; duration: number; alignment: Alignment; cached: boolean; provider: string; key: string; trimmedLead: number }

export function runProcess(cmd: string, args: string[], opts: { timeoutMs?: number; input?: Buffer | string; cwd?: string } = {}): Promise<{ stdout: string; stderr: string; stdoutBuf: Buffer }> {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { windowsHide: true, cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '', done = false; const bufs: Buffer[] = [];
    const timer = setTimeout(() => { if (done) return; done = true; p.kill('SIGKILL'); fail(new Error(`${cmd}: tiempo agotado`)); }, opts.timeoutMs ?? 120_000);
    p.stdout.on('data', (d: Buffer) => { bufs.push(d); out = (out + d.toString('utf8')).slice(-400_000); }); p.stderr.on('data', d => { err = (err + d).slice(-100_000); });
    p.on('error', e => { if (done) return; done = true; clearTimeout(timer); fail(e); });
    p.on('close', code => { if (done) return; done = true; clearTimeout(timer); code === 0 ? ok({ stdout: out, stderr: err, stdoutBuf: Buffer.concat(bufs) }) : fail(new Error(`${cmd} salió con ${code}: ${err.slice(-2000)}`)); });
    if (opts.input !== undefined) p.stdin.end(opts.input); else p.stdin.end();
  });
}
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Emotion -> prosody (rate multiplier, pitch %, volume). Conservative so voices stay recognisable. */
export function prosodyFor(emotion?: string, intensity = 1): { rate: number; pitch: number; volume: string } {
  const k = Math.max(0, Math.min(1.5, intensity));
  const table: Record<string, [number, number, string]> = {
    angry: [1.08, 4, 'loud'], fear: [1.12, 8, 'medium'], surprise: [1.05, 10, 'loud'], joy: [1.06, 6, 'loud'], laugh: [1.04, 8, 'loud'],
    sad: [0.88, -6, 'soft'], nervous: [1.1, 3, 'medium'], thinking: [0.92, -2, 'medium'], smirk: [0.95, -1, 'medium'], worried: [0.97, 2, 'medium'], determined: [1.0, -2, 'loud']
  };
  const v = emotion ? table[emotion] : undefined;
  if (!v) return { rate: 1, pitch: 0, volume: 'medium' };
  return { rate: 1 + (v[0] - 1) * k, pitch: v[1] * k, volume: v[2] };
}
/** Builds SSML: pauses from "..." / "—" / "[pausa 0.6]", whisper direction lowers volume. */
export function buildSsml(req: SpeechRequest, emotionId?: string): string {
  const pr = prosodyFor(emotionId, req.intensity);
  const rate = (req.rate ?? req.voice.rate) * pr.rate;
  const whisper = /susurr|en voz baja|whisper/i.test(req.direction ?? '');
  const shout = /grit|shout/i.test(req.direction ?? '');
  let body = xml(req.text)
    .replace(/\[pausa\s+([0-9.]+)\]/gi, (_, s) => `<break time="${Math.round(Number(s) * 1000)}ms"/>`)
    .replace(/\.\.\.|…/g, '…<break time="350ms"/>')
    .replace(/\s—\s/g, ' <break time="250ms"/> ');
  const vol = whisper ? 'x-soft' : shout ? 'x-loud' : pr.volume;
  // rate as a plain multiplier: Windows engines read "96%" as +96 % (double speed), "0.96" correctly
  body = `<prosody rate="${Math.max(0.5, Math.min(2, rate)).toFixed(2)}" pitch="${pr.pitch >= 0 ? '+' : ''}${pr.pitch.toFixed(0)}%" volume="${vol}">${body}</prosody>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${req.voice.language}">${body}</speak>`;
}

async function synthOneCore(ssml: string, voice: string, wav: string): Promise<WordTiming[]> {
  const dir = join(tmpdir(), 'sf-tts'); await mkdir(dir, { recursive: true });
  const id = createHash('sha1').update(ssml + voice + Math.random()).digest('hex').slice(0, 12);
  const reqPath = join(dir, `${id}.req.json`), meta = join(dir, `${id}.meta.json`);
  await writeFile(reqPath, JSON.stringify({ ssml, voice, output: wav, metaOutput: meta }), 'utf8');
  try {
    await runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(REPO_ROOT, 'src', 'audio', 'onecore-tts.ps1'), reqPath], { timeoutMs: 90_000 });
    const m = JSON.parse((await readFile(meta, 'utf8')).replace(/^﻿/, '')) as { words?: { text: string; start: number }[] | { text: string; start: number } };
    const words = Array.isArray(m.words) ? m.words : m.words ? [m.words] : [];
    return words.map(w => ({ text: w.text, start: w.start }));
  } finally { await rm(reqPath, { force: true }); await rm(meta, { force: true }); }
}
async function synthSapi(ssml: string, voice: string, wav: string): Promise<WordTiming[]> {
  const payload = Buffer.from(JSON.stringify({ ssml, voice, wav }), 'utf8').toString('base64');
  const script = `Add-Type -AssemblyName System.Speech;$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json;$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;$w=New-Object System.Collections.ArrayList;try{$s.SelectVoice($p.voice);$s.add_SpeakProgress({param($o,$e) [void]$w.Add(@{text=$e.Text;start=$e.AudioPosition.TotalSeconds})});$s.SetOutputToWaveFile($p.wav);$s.SpeakSsml($p.ssml)}finally{$s.Dispose()};$w|ConvertTo-Json -Compress`;
  const { stdout } = await runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { timeoutMs: 90_000 });
  try { const arr = JSON.parse(stdout.trim() || '[]'); return (Array.isArray(arr) ? arr : [arr]).map((w: { text: string; start: number }) => ({ text: w.text, start: w.start })); } catch { return []; }
}
async function synthPiper(text: string, voice: VoiceProfile, wav: string, rate: number): Promise<WordTiming[]> {
  const exe = process.env.SERIES_FORGE_PIPER ?? join(REPO_ROOT, 'tools', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
  const model = existsSync(voice.voice) ? voice.voice : join(REPO_ROOT, 'tools', 'piper', 'voices', `${voice.voice}.onnx`);
  if (!existsSync(exe)) throw new Error(`Piper no instalado (${exe}). Define SERIES_FORGE_PIPER o instala en tools/piper.`);
  if (!existsSync(model)) throw new Error(`Modelo Piper no encontrado: ${model}`);
  await runProcess(exe, ['--model', model, '--output_file', wav, '--length_scale', String((1 / rate).toFixed(3))], { input: text, timeoutMs: 120_000 });
  return [];
}

/** Post-process: pitch (formant-preserving), EQ, gain, resample to 48 kHz mono float. */
async function postProcess(src: string, dst: string, v: VoiceProfile, extraSemitones: number): Promise<void> {
  const st = v.pitchSemitones + extraSemitones;
  const filters: string[] = [];
  if (Math.abs(st) > 0.01) filters.push(`rubberband=pitch=${Math.pow(2, st / 12).toFixed(5)}:formant=${v.formantPreserve ? 'preserved' : 'shifted'}`);
  filters.push('aresample=48000:resampler=soxr');
  if (v.eq.lowDb) filters.push(`lowshelf=f=220:g=${v.eq.lowDb}`);
  if (v.eq.midDb) filters.push(`equalizer=f=1800:t=q:w=1:g=${v.eq.midDb}`);
  if (v.eq.highDb) filters.push(`highshelf=f=6000:g=${v.eq.highDb}`);
  filters.push('highpass=f=70');
  if (v.gainDb) filters.push(`volume=${v.gainDb}dB`);
  await runProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', filters.join(','), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', dst], { timeoutMs: 120_000 });
}

export function speechKey(req: SpeechRequest, emotionId?: string): string {
  return createHash('sha256').update(JSON.stringify({ v: TTS_VERSION, text: req.text, voice: req.voice, emotion: emotionId ?? null, intensity: req.intensity ?? 1, direction: req.direction ?? '', rate: req.rate ?? null, pitch: req.pitchSemitones ?? 0 })).digest('hex').slice(0, 32);
}

/** Synthesize (or reuse cached) speech for one dialogue line. */
export async function synthesize(req: SpeechRequest, cacheDir: string, emotionId?: string, attempts = 3): Promise<SpeechResult> {
  await mkdir(cacheDir, { recursive: true });
  const key = speechKey(req, emotionId);
  const file = join(cacheDir, `${key}.wav`), metaFile = join(cacheDir, `${key}.json`);
  if (existsSync(file) && existsSync(metaFile)) {
    const meta = JSON.parse(await readFile(metaFile, 'utf8')) as Omit<SpeechResult, 'cached' | 'file'>;
    return { ...meta, file, cached: true };
  }
  if (req.voice.license.commercialUse === 'restricted') throw new Error(`La voz ${req.voice.voice} tiene licencia restringida para uso comercial`);
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const raw = join(cacheDir, `${key}.raw.${process.pid}.wav`);
    const proc = join(cacheDir, `${key}.proc.${process.pid}.wav`);
    try {
      let words: WordTiming[] = [];
      const ssml = buildSsml(req, emotionId);
      switch (req.voice.provider) {
        case 'windows-onecore': words = await synthOneCore(ssml, req.voice.voice, raw); break;
        case 'windows-sapi': words = await synthSapi(ssml, req.voice.voice, raw); break;
        case 'piper': words = await synthPiper(req.text, req.voice, raw, (req.rate ?? req.voice.rate) * prosodyFor(emotionId, req.intensity).rate); break;
        case 'silent': { const est = estimateSpeech(req.text, req.voice.rate); await writeWavAtomic(raw, { sampleRate: 48000, channels: [new Float32Array(Math.round(est.duration * 48000))] }, 16); break; }
      }
      if ((await stat(raw)).size < 100) throw new Error('Audio TTS vacío');
      await postProcess(raw, proc, req.voice, req.pitchSemitones ?? 0);
      const audio = await readWav(proc);
      let x = mono(audio);
      // trim leading silence (keep 30 ms) and trailing silence (keep 120 ms); shift word timings accordingly
      const thr = 0.006; let a = 0; while (a < x.length && Math.abs(x[a]) < thr) a++; let b = x.length - 1; while (b > a && Math.abs(x[b]) < thr) b--;
      const lead = Math.max(0, a - Math.round(0.03 * 48000)), tail = Math.min(x.length, b + Math.round(0.12 * 48000));
      x = x.slice(lead, tail);
      const trimmedLead = lead / 48000;
      words = words.map(w => ({ ...w, start: Math.max(0, w.start - trimmedLead) }));
      const alignment = req.voice.provider === 'silent' ? (() => { const est = estimateSpeech(req.text); return { words: [], phonemes: [], visemes: est.visemes, voicedEnd: est.duration, method: 'estimate(silent)' }; })() : alignSpeech(req.text, x, 48000, words);
      await writeWavAtomic(file + '.tmp.wav', { sampleRate: 48000, channels: [x] }, 32);
      await rename(file + '.tmp.wav', file);
      const result = { key, duration: x.length / 48000, alignment, provider: req.voice.provider, trimmedLead };
      await writeFile(metaFile, JSON.stringify(result));
      return { ...result, file, cached: false };
    } catch (e) { lastErr = e as Error; await new Promise(r => setTimeout(r, 300 * attempt)); }
    finally { await rm(raw, { force: true }); await rm(proc, { force: true }); }
  }
  throw new Error(`TTS falló tras ${attempts} intentos (${req.voice.provider}/${req.voice.voice}): ${lastErr?.message}`);
}
export async function listOneCoreVoices(): Promise<{ id: string; name: string; language: string; gender: string }[]> {
  const dir = join(tmpdir(), 'sf-tts'); await mkdir(dir, { recursive: true });
  const reqPath = join(dir, 'list.req.json'), meta = join(dir, 'list.meta.json');
  await writeFile(reqPath, JSON.stringify({ listVoices: true, metaOutput: meta }));
  await runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(REPO_ROOT, 'src', 'audio', 'onecore-tts.ps1'), reqPath], { timeoutMs: 60_000 });
  const v = JSON.parse((await readFile(meta, 'utf8')).replace(/^﻿/, '')); return Array.isArray(v) ? v : [v];
}
