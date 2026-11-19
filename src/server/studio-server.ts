/** Series Forge Studio local web server (127.0.0.1 only). Same files as the agents: no parallel state.
 *  - Schema-validated atomic writes with optimistic concurrency (expectedHash).
 *  - SSE live reload on file changes (debounced; invalid/incomplete writes keep the last good state and report errors).
 *  - Scene compilation for the browser Stage, voice preview, render jobs, media streaming with ranges. */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, writeFile, rename, stat, mkdir, readdir, rm } from 'node:fs/promises';
import { createReadStream, existsSync, watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { loadProject, assetLibrary, WORKSPACE_ROOT, REPO_ROOT, SAFE_ID, projectDir, safeJoin, loadLibrary } from '../pipeline/project.ts';
import { compileScene } from '../engine/director.ts';
import type { SpeechInfo } from '../engine/director.ts';
import { renderEpisode } from '../pipeline/episode.ts';
import type { RenderSettings } from '../pipeline/episode.ts';
import { validateEpisode } from '../pipeline/validate.ts';
import { validateStory, loadStory, confirmEpisode } from '../pipeline/story.ts';
import { synthesize, speechKey } from '../audio/tts.ts';
import { resolveEmotion } from '../engine/director.ts';
import { estimateSpeech } from '../audio/phonetics-es.ts';
import { buildBrowser } from '../../scripts/build.ts';
import { scaffold } from '../pipeline/scaffold.ts';
import { recordVersion, listVersions, revertTo } from '../pipeline/history.ts';
import {
  CharacterGeometrySchema, RigSchema, VoiceSchema, ClipSchemaV2, LocomotionSchema, ExpressionSchemaV2, PropGeometrySchema, EnvironmentSchemaV2, SceneSchemaV2, EpisodeSchema, SfxSchema, MusicSchema, ManifestSchema, formatZodError
} from '../engine/schema.ts';
import { CanonSchema, EpisodeStorySchema } from '../pipeline/story.ts';

const PORT = Number(process.env.PORT ?? 4317);
const HOST = '127.0.0.1';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.srt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml' };

/** Which schema validates a file path inside a project (null = Markdown / free JSON with no schema). */
export function schemaFor(rel: string): { parse(x: unknown): unknown } | null {
  const r = rel.replace(/\\/g, '/');
  if (/^characters\/[^/]+\/geometry\.json$/.test(r)) return { parse: (x: unknown) => ((x as { schemaVersion?: number }).schemaVersion === 1 ? x : CharacterGeometrySchema.parse(x)) };
  if (/^characters\/[^/]+\/rig\.json$/.test(r)) return { parse: (x: unknown) => ((x as { schemaVersion?: number }).schemaVersion === 1 ? x : RigSchema.parse(x)) };
  if (/^characters\/[^/]+\/voice\.json$/.test(r)) return { parse: (x: unknown) => ((x as { schemaVersion?: number }).schemaVersion === 1 ? x : VoiceSchema.parse(x)) };
  if (/\/animations(\/humanoid)?\/[^/]+\.json$/.test(r) || /^animations\/humanoid\/[^/]+\.json$/.test(r)) return { parse: (x: unknown) => { const o = x as { schemaVersion?: number; kind?: string }; return o.schemaVersion === 1 ? x : o.kind === 'locomotion' ? LocomotionSchema.parse(x) : ClipSchemaV2.parse(x); } };
  if (/\/expressions(\/humanoid)?\/[^/]+\.json$/.test(r) || /^expressions\/humanoid\/[^/]+\.json$/.test(r)) return { parse: (x: unknown) => ((x as { schemaVersion?: number }).schemaVersion === 1 ? x : ExpressionSchemaV2.parse(x)) };
  if (/^props\/[^/]+\/geometry\.json$/.test(r)) return { parse: (x: unknown) => ((x as { schemaVersion?: number }).schemaVersion === 1 ? x : PropGeometrySchema.parse(x)) };
  if (/^environments\/[^/]+\/environment\.json$/.test(r)) return { parse: (x: unknown) => ((x as { schemaVersion?: number }).schemaVersion === 1 ? x : EnvironmentSchemaV2.parse(x)) };
  if (/^episodes\/[^/]+\/scenes\/[^/]+\/scene\.json$/.test(r)) return { parse: (x: unknown) => ((x as { schemaVersion?: number }).schemaVersion === 1 ? x : SceneSchemaV2.parse(x)) };
  if (/^episodes\/[^/]+\/episode\.json$/.test(r)) return EpisodeSchema;
  if (/^episodes\/[^/]+\/story\.json$/.test(r)) return EpisodeStorySchema;
  if (/^story\/canon\.json$/.test(r)) return CanonSchema;
  if (/^audio\/sfx\/[^/]+\.json$/.test(r)) return SfxSchema;
  if (/^audio\/music\/[^/]+\.json$/.test(r)) return MusicSchema;
  if (/\/manifest\.json$/.test(r)) return ManifestSchema;
  return null;
}
const EDITABLE = /^(project\.json|universe\.json|story\/[a-z0-9_-]+\.(json|md)|(characters|props|environments|episodes)\/[a-z0-9][a-z0-9_-]*\/([a-z0-9_-]+\/){0,3}[a-z0-9][a-z0-9_.-]*\.(json|md)|(animations|expressions)\/humanoid\/[a-z0-9][a-z0-9_-]*\.json|audio\/(sfx|music)\/[a-z0-9][a-z0-9_-]*\.json)$/;
export function editablePath(rel: string): boolean { return EDITABLE.test(rel) && !rel.split('/').some(s => s === '..' || s === 'generated' || s === 'output'); }

async function body(req: IncomingMessage, limit = 2_000_000): Promise<string> { const chunks: Buffer[] = []; let n = 0; for await (const c of req) { n += (c as Buffer).length; if (n > limit) throw Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 }); chunks.push(c as Buffer); } return Buffer.concat(chunks).toString('utf8'); }
function json(res: ServerResponse, status: number, data: unknown) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); }
async function sendFile(req: IncomingMessage, res: ServerResponse, file: string) {
  const st = await stat(file);
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
    createReadStream(file, { start, end }).pipe(res); return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------- live reload (SSE)
type Client = { res: ServerResponse; project: string };
const clients = new Set<Client>();
const watchers = new Map<string, { w: FSWatcher; timer: NodeJS.Timeout | null; pending: Set<string> }>();
function broadcast(project: string | null, event: string, data: unknown) { const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) if (!project || c.project === project) c.res.write(msg); }
function ensureWatcher(project: string) {
  if (watchers.has(project)) return;
  const root = projectDir(project);
  const entry = { w: null as unknown as FSWatcher, timer: null as NodeJS.Timeout | null, pending: new Set<string>() };
  entry.w = watch(root, { recursive: true }, (_ev, filename) => {
    if (!filename) return;
    const rel = String(filename).split(sep).join('/');
    if (/(^|\/)(generated|output|\.render-cache)(\/|$)/.test(rel) || rel.endsWith('.tmp') || rel.includes('.part')) return;
    entry.pending.add(rel);
    if (entry.timer) clearTimeout(entry.timer);
    // debounce: agents often write several files; incomplete JSON is retried on the next tick
    entry.timer = setTimeout(async () => {
      const paths = [...entry.pending]; entry.pending.clear(); entry.timer = null;
      const invalid: { path: string; error: string }[] = [];
      for (const p of paths) if (p.endsWith('.json') && editablePath(p)) {
        try { const s = (await readFile(join(root, p), 'utf8')).replace(/^﻿/, ''); const sc = schemaFor(p); const obj = JSON.parse(s); sc?.parse(obj); await recordVersion(project, p, s, 'disk'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') invalid.push({ path: p, error: formatZodError(e) }); }
      }
      broadcast(project, 'change', { paths, invalid, at: Date.now() });
    }, 180);
  });
  watchers.set(project, entry);
}

// ---------------------------------------------------------------- jobs
interface Job { id: string; project: string; episode: string; status: 'running' | 'done' | 'failed'; events: unknown[]; result?: unknown; error?: string; started: number }
const jobs = new Map<string, Job>();
const lastGood = new Map<string, ReturnType<typeof assetLibrary>>();
let activeJob: Job | null = null;

async function speechFor(project: string, episode: string, sceneId: string, synth: boolean): Promise<Record<string, SpeechInfo>> {
  const p = await loadProject(project);
  const sc = p.episodes[episode]?.scenes[sceneId];
  const out: Record<string, SpeechInfo> = {};
  if (!sc) return out;
  const cache = join(p.root, 'generated', 'audio', 'voices');
  for (const l of sc.dialogue) {
    const a = sc.actors.find(x => x.id === l.actor); const ch = a ? p.characters[a.characterId] : null;
    if (!ch?.voice) { out[l.id] = { ...estimateSpeech(l.text), estimated: true }; continue; }
    const emo = resolveEmotion(l.emotion);
    const req = { text: l.text, voice: ch.voice, emotion: emo, intensity: l.intensity, direction: l.direction, rate: l.rate, pitchSemitones: l.pitchSemitones };
    const key = speechKey(req, emo);
    const meta = join(cache, `${key}.json`);
    if (existsSync(meta)) { const m = JSON.parse(await readFile(meta, 'utf8')); out[l.id] = { duration: m.duration, visemes: m.alignment.visemes, file: join(cache, `${key}.wav`) }; }
    else if (synth) { const r = await synthesize(req, cache, emo); out[l.id] = { duration: r.duration, visemes: r.alignment.visemes, file: r.file }; }
    else out[l.id] = { ...estimateSpeech(l.text, ch.voice.rate), estimated: true };
  }
  return out;
}

const server = createServer(async (req, res) => {
  try {
    // only loopback hosts; state-changing requests must come from our own origin
    const host = (req.headers.host ?? '').split(':')[0];
    if (!['127.0.0.1', 'localhost'].includes(host)) return json(res, 403, { error: 'Host no permitido' });
    if (req.method !== 'GET' && req.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin)) return json(res, 403, { error: 'Origen no permitido' });
    const url = new URL(req.url ?? '/', `http://${HOST}`);
    const path = url.pathname;
    if (req.method === 'GET' && (path === '/' || path === '/index.html')) return sendFile(req, res, join(REPO_ROOT, 'public', 'studio-v5.html'));
    if (req.method === 'GET' && path.startsWith('/build/')) { const f = join(REPO_ROOT, 'public', 'build', path.slice(7)); if (!/^[a-z0-9_.-]+$/.test(path.slice(7)) || !existsSync(f)) return json(res, 404, {}); return sendFile(req, res, f); }
    if (path === '/api/health') return json(res, 200, { ok: true, version: '0.5.0' });
    if (path === '/api/projects') { await mkdir(WORKSPACE_ROOT, { recursive: true }); const d = (await readdir(WORKSPACE_ROOT, { withFileTypes: true })).filter(x => x.isDirectory() && SAFE_ID.test(x.name)).map(x => x.name); return json(res, 200, d); }
    if (path === '/api/events') {
      const project = url.searchParams.get('project') ?? '';
      if (!SAFE_ID.test(project) || !existsSync(projectDir(project))) return json(res, 404, { error: 'Proyecto' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`event: hello\ndata: {}\n\n`);
      const c = { res, project }; clients.add(c); ensureWatcher(project);
      const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
      req.on('close', () => { clearInterval(ping); clients.delete(c); });
      return;
    }
    const m = /^\/api\/project\/([a-z0-9][a-z0-9_-]{0,79})(\/.*)?$/.exec(path);
    if (m) {
      const project = m[1], sub = m[2] ?? '/';
      const root = projectDir(project);
      if (!existsSync(root)) return json(res, 404, { error: 'No existe el proyecto' });
      if (req.method === 'GET' && sub === '/') {
        const p = await loadProject(project);
        const story = await loadStory(p);
        const storyIssues = await validateStory(p);
        return json(res, 200, {
          id: project, meta: p.meta, issues: [...p.issues, ...storyIssues],
          characters: Object.values(p.characters).map(c => ({ id: c.id, name: c.name, files: c.files, voice: c.voice, docs: Object.keys(c.docs) })),
          props: Object.values(p.props).map(x => ({ id: x.id, name: x.name, generator: x.geometry.generator })),
          environments: Object.values(p.environments).map(x => ({ id: x.id, name: x.name })),
          episodes: Object.values(p.episodes).map(e => ({ id: e.id, name: e.name, dir: e.dir, legacy: !!e.legacy, scenes: e.episode.scenes.map(s => ({ id: s, name: e.scenes[s]?.name ?? s, ok: !!e.scenes[s] })), status: e.episode.status })),
          sfx: Object.values(p.sfx).map(s => ({ id: s.id, kind: s.kind, generator: s.generator })), music: Object.values(p.music).map(s => ({ id: s.id, mood: s.mood })),
          story: { facts: story.canon.facts, relationships: story.canon.relationships, characters: story.canon.characters, confirmed: story.canon.confirmedEpisodes, drafts: story.episodes },
          library: { clips: Object.keys((await loadLibrary()).clips), locomotion: Object.keys((await loadLibrary()).loco), expressions: Object.keys((await loadLibrary()).expressions) }
        });
      }
      if (req.method === 'GET' && sub === '/assets') {
        // keep the last valid version of any asset whose files are currently invalid (agent mid-write, typo...)
        const p = await loadProject(project); const lib = assetLibrary(p); const prev = lastGood.get(project);
        if (prev) for (const kind of ['characters', 'props', 'environments'] as const) for (const [id, v] of Object.entries(prev[kind])) { const dir = kind === 'characters' ? `characters/${id}/` : kind === 'props' ? `props/${id}/` : `environments/${id}/`; if (!(id in lib[kind]) && p.issues.some(i => i.level === 'error' && i.path.startsWith(dir))) (lib[kind] as Record<string, unknown>)[id] = v; }
        lastGood.set(project, lib);
        return json(res, 200, lib);
      }
      if (req.method === 'GET' && sub === '/file') {
        const rel = url.searchParams.get('path') ?? '';
        if (!editablePath(rel)) return json(res, 400, { error: 'Ruta no permitida' });
        const abs = await safeJoin(root, rel);
        if (!existsSync(abs)) return json(res, 404, { error: 'No existe' });
        const content = (await readFile(abs, 'utf8')).replace(/^﻿/, '');
        return json(res, 200, { path: rel, content, hash: sha(content) });
      }
      if (req.method === 'PUT' && sub === '/file') {
        const { path: rel, content, expectedHash } = JSON.parse(await body(req)) as { path: string; content: string; expectedHash?: string | null };
        if (!editablePath(rel) || typeof content !== 'string') return json(res, 400, { error: 'Ruta no permitida' });
        const abs = await safeJoin(root, rel);
        if (rel.endsWith('.json')) { try { const obj = JSON.parse(content); schemaFor(rel)?.parse(obj); } catch (e) { return json(res, 422, { error: formatZodError(e) }); } }
        const prev = existsSync(abs) ? (await readFile(abs, 'utf8')).replace(/^﻿/, '') : null;
        if (expectedHash !== undefined && expectedHash !== null && sha(prev ?? '') !== expectedHash) return json(res, 409, { error: 'Conflicto: el archivo cambió (otro agente o pestaña). Recarga antes de guardar.', current: prev, hash: sha(prev ?? '') });
        await mkdir(join(abs, '..'), { recursive: true });
        const tmp = `${abs}.${randomUUID()}.tmp`;
        if (prev !== null) await recordVersion(project, rel, prev, 'disk');
        try { await writeFile(tmp, content, { flag: 'wx' }); await rename(tmp, abs); } finally { await rm(tmp, { force: true }); }
        await recordVersion(project, rel, content, 'editor');
        return json(res, 200, { path: rel, hash: sha(content) });
      }
      if (req.method === 'GET' && sub === '/history') { const rel = url.searchParams.get('path') ?? ''; if (!editablePath(rel)) return json(res, 400, { error: 'Ruta no permitida' }); return json(res, 200, await listVersions(project, rel)); }
      if (req.method === 'POST' && sub === '/revert') { const { path: rel, id } = JSON.parse(await body(req)) as { path: string; id: string }; if (!editablePath(rel)) return json(res, 400, { error: 'Ruta no permitida' }); if (rel.endsWith('.json')) { try { schemaFor(rel)?.parse(JSON.parse(await readFile(join(projectDir(project), 'generated', 'history', ...rel.split('/'), id), 'utf8'))); } catch (e) { return json(res, 422, { error: formatZodError(e) }); } } const content = await revertTo(project, rel, id); return json(res, 200, { path: rel, hash: sha(content) }); }
      if (req.method === 'POST' && sub === '/new') { const { kind, args, from } = JSON.parse(await body(req)) as { kind: string; args: string[]; from?: string }; return json(res, 200, { message: await scaffold(kind, [project, ...args], from) }); }
      if (req.method === 'GET' && sub === '/scene') {
        const episode = url.searchParams.get('episode') ?? '', sceneId = url.searchParams.get('scene') ?? '';
        const p = await loadProject(project);
        const sc = p.episodes[episode]?.scenes[sceneId];
        if (!sc) return json(res, 404, { error: 'Escena no encontrada o inválida', issues: p.issues.filter(i => i.path.includes(`${episode}/scenes/${sceneId}`)) });
        const speech = await speechFor(project, episode, sceneId, url.searchParams.get('synth') === '1');
        try { return json(res, 200, compileScene(sc, assetLibrary(p), { speech })); } catch (e) { return json(res, 422, { error: (e as Error).message }); }
      }
      if (req.method === 'POST' && sub === '/say') {
        const { character, text, emotion } = JSON.parse(await body(req)) as { character: string; text: string; emotion?: string };
        const p = await loadProject(project); const c = p.characters[character];
        if (!c?.voice) return json(res, 422, { error: 'Personaje sin voice.json v2' });
        const r = await synthesize({ text: String(text).slice(0, 600), voice: c.voice, emotion: resolveEmotion(emotion) }, join(p.root, 'generated', 'audio', 'voices'), resolveEmotion(emotion));
        return json(res, 200, { url: `/api/project/${project}/media?path=${encodeURIComponent(relative(root, r.file).split(sep).join('/'))}`, duration: r.duration, words: r.alignment.words, method: r.alignment.method });
      }
      if (req.method === 'GET' && sub === '/media') {
        const rel = url.searchParams.get('path') ?? '';
        if (!/^(generated|episodes\/[a-z0-9_-]+\/(output|generated))\/[A-Za-z0-9_./-]+\.(wav|mp4|png|srt|json)$/.test(rel) || rel.includes('..')) return json(res, 400, { error: 'Ruta no permitida' });
        const abs = await safeJoin(root, rel); if (!existsSync(abs)) return json(res, 404, {});
        return sendFile(req, res, abs);
      }
      if (req.method === 'GET' && sub === '/outputs') {
        const episode = url.searchParams.get('episode') ?? ''; const dir = join(root, 'episodes', episode, 'output');
        if (!SAFE_ID.test(episode) || !existsSync(dir)) return json(res, 200, { files: [] });
        const files = (await readdir(dir)).filter(f => !f.startsWith('.'));
        const story = existsSync(join(dir, 'storyboard')) ? (await readdir(join(dir, 'storyboard'))).map(f => `storyboard/${f}`) : [];
        const report = existsSync(join(dir, 'validation-report.json')) ? JSON.parse(await readFile(join(dir, 'validation-report.json'), 'utf8')) : null;
        return json(res, 200, { base: `episodes/${episode}/output`, files, storyboard: story, report });
      }
      if (req.method === 'POST' && sub === '/render') {
        if (activeJob?.status === 'running') return json(res, 409, { error: 'Ya hay un render en curso', job: activeJob.id });
        const { episode, settings } = JSON.parse(await body(req)) as { episode: string; settings: RenderSettings };
        const job: Job = { id: randomUUID(), project, episode, status: 'running', events: [], started: Date.now() };
        jobs.set(job.id, job); activeJob = job;
        (async () => {
          try { const r = await renderEpisode(project, episode, settings, e => { job.events.push(e); broadcast(project, 'job', { id: job.id, event: e }); }); const v = await validateEpisode(project, episode); job.result = { video: r.video, ok: v.ok, stats: r.stats }; job.status = 'done'; }
          catch (e) { job.error = (e as Error).message; job.status = 'failed'; }
          broadcast(project, 'job', { id: job.id, status: job.status, error: job.error, result: job.result });
        })();
        return json(res, 202, { id: job.id });
      }
      if (req.method === 'POST' && sub === '/story/confirm') { const { episode } = JSON.parse(await body(req)) as { episode: string }; return json(res, 200, await confirmEpisode(project, episode)); }
      return json(res, 404, { error: 'Ruta API desconocida' });
    }
    if (path.startsWith('/api/jobs/')) { const j = jobs.get(path.slice(10)); return j ? json(res, 200, j) : json(res, 404, {}); }
    return json(res, 404, { error: 'No encontrado' });
  } catch (e) { const err = e as Error & { status?: number }; return json(res, err.status ?? 500, { error: err.message }); }
});

server.on('close', () => { for (const w of watchers.values()) { w.w.close(); if (w.timer) clearTimeout(w.timer); } watchers.clear(); for (const c of clients) c.res.end(); clients.clear(); });
export async function startServer(port = PORT) {
  await buildBrowser();
  await new Promise<void>(ok => server.listen(port, HOST, () => ok()));
  return server;
}
export { server };
if (import.meta.main) { await startServer(); console.log(`Series Forge Studio v0.5 en http://${HOST}:${PORT}  (workspace: ${WORKSPACE_ROOT})`); }
