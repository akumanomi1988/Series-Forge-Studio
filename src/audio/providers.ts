/** Local neural TTS providers.
 *  - kokoro: Kokoro-82M through a persistent Python worker (project-local venv in tools/kokoro, CPU, no network).
 *  - voicebox: the user's Voicebox app (https://github.com/jamiepine/voicebox) through its local REST API.
 *    Only loopback addresses are accepted: text is never sent off the machine. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REPO_ROOT } from '../pipeline/project.ts';

// ------------------------------------------------------------------ Kokoro
export const KOKORO_DIR = process.env.SERIES_FORGE_KOKORO_DIR ?? join(REPO_ROOT, 'tools', 'kokoro');
export function kokoroPython(): string {
  return process.env.SERIES_FORGE_KOKORO_PYTHON ?? join(KOKORO_DIR, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
}
export function kokoroAvailable(): { ok: boolean; reason?: string } {
  if (!existsSync(kokoroPython())) return { ok: false, reason: `Falta el entorno Python de Kokoro (${kokoroPython()}). Ejecuta: npm run setup:kokoro` };
  for (const f of ['kokoro-v1.0.onnx', 'voices-v1.0.bin']) if (!existsSync(join(KOKORO_DIR, f))) return { ok: false, reason: `Falta el modelo ${join(KOKORO_DIR, f)}. Ejecuta: npm run setup:kokoro` };
  return { ok: true };
}

interface Pending { ok: (v: Record<string, unknown>) => void; fail: (e: Error) => void; timer: NodeJS.Timeout }
class KokoroWorker {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private ready: Promise<string[]> | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private buf = '';
  private stderr = '';

  private start(): Promise<string[]> {
    const avail = kokoroAvailable();
    if (!avail.ok) return Promise.reject(new Error(avail.reason));
    const p = spawn(kokoroPython(), ['-I', join(REPO_ROOT, 'src', 'audio', 'kokoro-worker.py'), KOKORO_DIR], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    this.proc = p;
    return new Promise((ok, fail) => {
      let started = false;
      const boot = setTimeout(() => { if (!started) { p.kill(); fail(new Error('Kokoro no arrancó en 120 s')); } }, 120_000);
      p.stderr.on('data', d => { this.stderr = (this.stderr + d).slice(-4000); });
      p.stdout.on('data', (d: Buffer) => {
        this.buf += d.toString('utf8');
        let nl: number;
        while ((nl = this.buf.indexOf('\n')) >= 0) {
          const line = this.buf.slice(0, nl).trim(); this.buf = this.buf.slice(nl + 1);
          if (!line) continue;
          let msg: Record<string, unknown>;
          try { msg = JSON.parse(line); } catch { continue; }
          if (msg.ready && !started) { started = true; clearTimeout(boot); this.idle(); ok(msg.voices as string[]); continue; }
          const pend = this.pending.get(String(msg.id));
          if (!pend) continue;
          this.pending.delete(String(msg.id)); clearTimeout(pend.timer);
          msg.ok ? pend.ok(msg) : pend.fail(new Error(`Kokoro: ${String(msg.error)}`));
          this.idle();
        }
      });
      const died = (why: string) => {
        clearTimeout(boot);
        const err = new Error(`Kokoro terminó (${why}): ${this.stderr.slice(-800)}`);
        if (!started) fail(err);
        for (const pd of this.pending.values()) { clearTimeout(pd.timer); pd.fail(err); }
        this.pending.clear(); this.proc = null; this.ready = null;
      };
      p.on('error', e => died(e.message));
      p.on('close', code => died(`código ${code}`));
    });
  }
  /** Lets Node exit while the worker idles; the worker dies with stdin closed. */
  private idle() {
    const p = this.proc; if (!p) return;
    const op = this.pending.size ? 'ref' : 'unref';
    p[op](); (p.stdin as unknown as { [k: string]: () => void })[op]?.(); (p.stdout as unknown as { [k: string]: () => void })[op]?.(); (p.stderr as unknown as { [k: string]: () => void })[op]?.();
  }
  async request(body: Record<string, unknown>, timeoutMs = 180_000): Promise<Record<string, unknown>> {
    this.ready ??= this.start();
    await this.ready;
    const id = String(++this.seq);
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => { this.pending.delete(id); fail(new Error('Kokoro: tiempo agotado')); }, timeoutMs);
      this.pending.set(id, { ok, fail, timer });
      this.idle();
      this.proc!.stdin.write(JSON.stringify({ ...body, id }) + '\n', 'utf8');
    });
  }
  async voices(): Promise<string[]> { this.ready ??= this.start(); return this.ready; }
  stop() { this.proc?.stdin.end(); this.proc?.kill(); this.proc = null; this.ready = null; }
}
const kokoro = new KokoroWorker();
process.once('exit', () => kokoro.stop());

/** Spanish voices shipped with Kokoro v1.0 (ef = female, em = male). Others can be blended in: "ef_dora:0.8+af_bella:0.2". */
export const KOKORO_SPANISH = ['ef_dora', 'em_alex', 'em_santa'];
const KOKORO_LANG: Record<string, string> = { es: 'es', en: 'en-us', fr: 'fr-fr', it: 'it', pt: 'pt-br', ja: 'ja', zh: 'cmn', hi: 'hi' };

export async function synthKokoro(text: string, voice: string, language: string, speed: number, wav: string): Promise<void> {
  const lang = KOKORO_LANG[language.slice(0, 2)] ?? 'es';
  await kokoro.request({ text, voice, speed: Math.max(0.5, Math.min(2, speed)), lang, out: wav });
}
export async function listKokoroVoices(): Promise<{ id: string; language: string; gender: string }[]> {
  const v = await kokoro.voices();
  const langs: Record<string, string> = { a: 'en-US', b: 'en-GB', e: 'es', f: 'fr', h: 'hi', i: 'it', j: 'ja', p: 'pt-BR', z: 'zh' };
  return v.map(id => ({ id, language: langs[id[0]] ?? '?', gender: id[1] === 'f' ? 'female' : 'male' }));
}
export function stopKokoro() { kokoro.stop(); }

// ------------------------------------------------------------------ Voicebox
export function voiceboxUrl(): URL {
  const u = new URL(process.env.SERIES_FORGE_VOICEBOX_URL ?? 'http://127.0.0.1:17493');
  if (u.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) throw new Error(`Voicebox solo se admite en una dirección local (127.0.0.1/localhost), no ${u.host}`);
  return u;
}
async function vbFetch(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(new URL(path, voiceboxUrl()), { ...init, signal: ctl.signal, redirect: 'error' });
    if (!r.ok) throw new Error(`Voicebox ${path}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`Voicebox ${path}: tiempo agotado`);
    if (/fetch failed|ECONNREFUSED/.test((e as Error).message)) throw new Error(`Voicebox no responde en ${voiceboxUrl().origin}. Abre la app Voicebox (o define SERIES_FORGE_VOICEBOX_URL).`);
    throw e;
  } finally { clearTimeout(timer); }
}
export interface VoiceboxProfile { id: string; name: string; language?: string; default_engine?: string }
export async function listVoiceboxProfiles(): Promise<VoiceboxProfile[]> {
  const r = await vbFetch('/profiles');
  const arr = await r.json() as VoiceboxProfile[];
  return Array.isArray(arr) ? arr.map(p => ({ id: String(p.id), name: String(p.name), language: p.language, default_engine: p.default_engine })) : [];
}
const profileIds = new Map<string, string>();
async function resolveProfile(voice: string): Promise<string> {
  if (profileIds.has(voice)) return profileIds.get(voice)!;
  const list = await listVoiceboxProfiles();
  const hit = list.find(p => p.id === voice) ?? list.find(p => p.name.toLowerCase() === voice.toLowerCase());
  if (!hit) throw new Error(`Perfil de Voicebox no encontrado: "${voice}". Disponibles: ${list.map(p => p.name).join(', ') || '(ninguno)'}`);
  profileIds.set(voice, hit.id); return hit.id;
}
/** Synchronous generation (POST /generate/stream returns the WAV bytes). `instruct` carries the emotion/delivery. */
export async function synthVoicebox(text: string, opts: { voice: string; language: string; engine?: string; instruct?: string; seed?: number }, wav: string): Promise<void> {
  const body: Record<string, unknown> = { profile_id: await resolveProfile(opts.voice), text: text.replace(/\[pausa\s+[0-9.]+\]/gi, '…'), language: opts.language.slice(0, 2), normalize: true };
  if (opts.engine) body.engine = opts.engine;
  if (opts.instruct) body.instruct = opts.instruct.slice(0, 500);
  if (opts.seed !== undefined) body.seed = opts.seed;
  const r = await vbFetch('/generate/stream', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, 600_000);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 100 || buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Voicebox no devolvió un WAV válido');
  await writeFile(wav, buf);
}
export async function voiceboxHealth(): Promise<{ ok: boolean; detail: string }> {
  try { const r = await vbFetch('/health', {}, 4000); return { ok: true, detail: JSON.stringify(await r.json()).slice(0, 300) }; }
  catch (e) { return { ok: false, detail: (e as Error).message }; }
}
