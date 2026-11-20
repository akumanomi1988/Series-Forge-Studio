/** YouTube publishing: OAuth 2.0 for installed apps (loopback redirect + PKCE) and resumable uploads through the
 * YouTube Data API v3. The user brings their own OAuth client ("Desktop app" in Google Cloud Console); credentials
 * and tokens live outside the repository (SERIES_FORGE_SECRETS_DIR, default ~/.series-forge/youtube) and are never
 * logged. Uploads are private unless the user explicitly asks otherwise. No SDK: plain HTTPS with fetch. */
import { createHash, randomBytes } from 'node:crypto';
import { open, readFile, writeFile, mkdir, rm, stat, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];
/** Endpoints are overridable only for the protocol tests (local fake server). */
export interface Endpoints { auth: string; token: string; revoke: string; api: string; upload: string }
export const GOOGLE: Endpoints = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', revoke: 'https://oauth2.googleapis.com/revoke',
  api: 'https://www.googleapis.com/youtube/v3', upload: 'https://www.googleapis.com/upload/youtube/v3'
};
export function secretsDir(): string { return process.env.SERIES_FORGE_SECRETS_DIR ?? join(homedir(), '.series-forge', 'youtube'); }
interface ClientCreds { client_id: string; client_secret: string }
interface Token { access_token: string; refresh_token: string; expires_at: number; scope?: string; channel?: { id: string; title: string } }

async function writeSecret(name: string, data: unknown) {
  const dir = secretsDir(); await mkdir(dir, { recursive: true });
  const tmp = join(dir, `${name}.${randomBytes(4).toString('hex')}.tmp`);
  await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 }); await rename(tmp, join(dir, name));
}
async function readSecret<T>(name: string): Promise<T | null> { try { return JSON.parse(await readFile(join(secretsDir(), name), 'utf8')) as T; } catch { return null; } }

/** Accepts the JSON downloaded from Google Cloud ({"installed": {...}}) or a plain {client_id, client_secret}. */
export async function saveClient(input: unknown): Promise<{ clientId: string }> {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const c = (o.installed ?? o.web ?? o) as Record<string, unknown>;
  const client_id = String(c.client_id ?? '').trim(), client_secret = String(c.client_secret ?? '').trim();
  if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(client_id)) throw new Error('client_id no válido (debe terminar en .apps.googleusercontent.com)');
  if (!client_secret || client_secret.length > 200) throw new Error('Falta client_secret');
  await writeSecret('client.json', { client_id, client_secret });
  return { clientId: client_id };
}

// ------------------------------------------------------------------ OAuth (loopback + PKCE)
const flows = new Map<string, { verifier: string; redirectUri: string; created: number }>();
export async function authUrl(redirectUri: string, ep: Endpoints = GOOGLE): Promise<string> {
  const c = await readSecret<ClientCreds>('client.json');
  if (!c) throw new Error('Primero guarda el cliente OAuth de Google (studio youtube client <archivo.json>)');
  if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+\//.test(redirectUri)) throw new Error('La redirección OAuth debe ser local (127.0.0.1)');
  const verifier = randomBytes(48).toString('base64url'), state = randomBytes(24).toString('base64url');
  for (const [k, f] of flows) if (Date.now() - f.created > 15 * 60_000) flows.delete(k);
  flows.set(state, { verifier, redirectUri, created: Date.now() });
  const u = new URL(ep.auth);
  u.search = new URLSearchParams({ client_id: c.client_id, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
  return u.toString();
}
async function tokenRequest(params: Record<string, string>, ep: Endpoints): Promise<Record<string, unknown>> {
  const r = await fetch(ep.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) throw new Error(`OAuth: ${String(j.error ?? r.status)} ${String(j.error_description ?? '')}`.trim());
  return j;
}
/** Handles the redirect: verifies state, exchanges the code (with the PKCE verifier) and stores the refresh token. */
export async function completeAuth(query: URLSearchParams, ep: Endpoints = GOOGLE): Promise<{ channel: Token['channel'] }> {
  if (query.get('error')) throw new Error(`Google rechazó la autorización: ${query.get('error')}`);
  const state = query.get('state') ?? '', code = query.get('code') ?? '';
  const flow = flows.get(state); flows.delete(state);
  if (!flow || !code) throw new Error('Respuesta OAuth inválida o caducada (state). Vuelve a conectar.');
  const c = (await readSecret<ClientCreds>('client.json'))!;
  const j = await tokenRequest({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: flow.redirectUri, grant_type: 'authorization_code', code_verifier: flow.verifier }, ep);
  if (!j.refresh_token) throw new Error('Google no devolvió refresh_token. Revoca el acceso en myaccount.google.com/permissions y vuelve a conectar.');
  const token: Token = { access_token: String(j.access_token), refresh_token: String(j.refresh_token), expires_at: Date.now() + Number(j.expires_in ?? 3600) * 1000, scope: String(j.scope ?? '') };
  token.channel = await myChannel(token.access_token, ep).catch(() => undefined);
  await writeSecret('token.json', token);
  return { channel: token.channel };
}
async function accessToken(ep: Endpoints): Promise<string> {
  const t = await readSecret<Token>('token.json');
  if (!t) throw new Error('YouTube no está conectado (studio youtube connect)');
  if (t.expires_at - 60_000 > Date.now()) return t.access_token;
  const c = await readSecret<ClientCreds>('client.json');
  if (!c) throw new Error('Falta el cliente OAuth');
  const j = await tokenRequest({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }, ep);
  const next = { ...t, access_token: String(j.access_token), expires_at: Date.now() + Number(j.expires_in ?? 3600) * 1000 };
  await writeSecret('token.json', next);
  return next.access_token;
}
async function myChannel(access: string, ep: Endpoints): Promise<{ id: string; title: string } | undefined> {
  const r = await fetch(`${ep.api}/channels?part=snippet&mine=true`, { headers: { authorization: `Bearer ${access}` } });
  if (!r.ok) return undefined;
  const j = await r.json() as { items?: { id: string; snippet: { title: string } }[] };
  const it = j.items?.[0]; return it ? { id: it.id, title: it.snippet.title } : undefined;
}
export async function status(): Promise<{ client: boolean; connected: boolean; channel?: { id: string; title: string }; secretsDir: string }> {
  const c = await readSecret<ClientCreds>('client.json'), t = await readSecret<Token>('token.json');
  return { client: !!c, connected: !!t, channel: t?.channel, secretsDir: secretsDir() };
}
export async function disconnect(ep: Endpoints = GOOGLE): Promise<{ revoked: boolean }> {
  const t = await readSecret<Token>('token.json'); let revoked = false;
  if (t) { try { const r = await fetch(`${ep.revoke}?token=${encodeURIComponent(t.refresh_token)}`, { method: 'POST' }); revoked = r.ok; } catch { /* offline: still forget locally */ } }
  await rm(join(secretsDir(), 'token.json'), { force: true });
  return { revoked };
}

// ------------------------------------------------------------------ upload
export interface UploadMeta {
  title: string; description: string; tags?: string[]; categoryId?: string; privacy: 'private' | 'unlisted' | 'public';
  madeForKids: boolean; containsSyntheticMedia: boolean; language?: string; publishAt?: string
}
export function validateMeta(m: UploadMeta): UploadMeta {
  const title = m.title.replace(/[<>]/g, '').trim().slice(0, 100);
  if (!title) throw new Error('El título es obligatorio');
  if (!['private', 'unlisted', 'public'].includes(m.privacy)) throw new Error('privacy debe ser private, unlisted o public');
  const tags = (m.tags ?? []).map(t => t.replace(/[<>,]/g, '').trim()).filter(Boolean);
  while (tags.join(',').length > 480) tags.pop();
  return { ...m, title, description: m.description.replace(/[<>]/g, '').slice(0, 4900), tags };
}
export type UploadProgress = (e: { stage: 'upload'; sent: number; total: number } | { stage: 'thumbnail' } | { stage: 'done'; videoId: string }) => void;
const CHUNK = 8 * 1024 * 1024; // multiple of 256 KiB as the API requires

/** Resumable upload (videos.insert). Survives transient network errors by asking the server how much it has. */
export async function uploadVideo(file: string, metaIn: UploadMeta, progress: UploadProgress = () => {}, ep: Endpoints = GOOGLE, opts: { thumbnail?: string } = {}): Promise<{ videoId: string; url: string; privacy: string }> {
  const meta = validateMeta(metaIn);
  const size = (await stat(file)).size;
  const body = {
    snippet: { title: meta.title, description: meta.description, tags: meta.tags, categoryId: meta.categoryId ?? '1', defaultLanguage: meta.language, defaultAudioLanguage: meta.language },
    status: { privacyStatus: meta.privacy, selfDeclaredMadeForKids: meta.madeForKids, containsSyntheticMedia: meta.containsSyntheticMedia, ...(meta.publishAt && meta.privacy === 'private' ? { publishAt: meta.publishAt } : {}) }
  };
  const init = await fetch(`${ep.upload}/videos?uploadType=resumable&part=snippet,status`, {
    method: 'POST', headers: { authorization: `Bearer ${await accessToken(ep)}`, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'video/mp4', 'x-upload-content-length': String(size) }, body: JSON.stringify(body)
  });
  if (!init.ok) throw new Error(`YouTube rechazó la subida: HTTP ${init.status} ${(await init.text()).slice(0, 400)}`);
  const session = init.headers.get('location');
  if (!session || !session.startsWith(ep.upload.replace(/\/youtube\/v3$/, ''))) throw new Error('YouTube no devolvió una sesión de subida válida');
  const fh = await open(file, 'r');
  try {
    let offset = 0, failures = 0;
    while (true) {
      const n = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(n); await fh.read(buf, 0, n, offset);
      let r: Response;
      try {
        r = await fetch(session, { method: 'PUT', headers: { authorization: `Bearer ${await accessToken(ep)}`, 'content-length': String(n), 'content-range': `bytes ${offset}-${offset + n - 1}/${size}` }, body: buf });
      } catch (e) {
        if (++failures > 6) throw e;
        await new Promise(ok => setTimeout(ok, 1000 * 2 ** failures));
        r = await fetch(session, { method: 'PUT', headers: { authorization: `Bearer ${await accessToken(ep)}`, 'content-range': `bytes */${size}` } }).catch(() => new Response(null, { status: 599 }));
        if (r.status === 599) continue;
      }
      if (r.status === 200 || r.status === 201) {
        const v = await r.json() as { id: string; status?: { privacyStatus?: string } };
        progress({ stage: 'upload', sent: size, total: size });
        if (opts.thumbnail && existsSync(opts.thumbnail)) {
          progress({ stage: 'thumbnail' });
          await fetch(`${ep.upload}/thumbnails/set?videoId=${encodeURIComponent(v.id)}`, { method: 'POST', headers: { authorization: `Bearer ${await accessToken(ep)}`, 'content-type': 'image/png' }, body: await readFile(opts.thumbnail) }).catch(() => null);
        }
        progress({ stage: 'done', videoId: v.id });
        return { videoId: v.id, url: `https://youtu.be/${v.id}`, privacy: v.status?.privacyStatus ?? meta.privacy };
      }
      if (r.status === 308) { const range = r.headers.get('range'); offset = range ? Number(/bytes=0-(\d+)/.exec(range)?.[1] ?? -1) + 1 : 0; failures = 0; progress({ stage: 'upload', sent: offset, total: size }); continue; }
      if ([500, 502, 503, 504].includes(r.status) && ++failures <= 6) { await new Promise(ok => setTimeout(ok, 1000 * 2 ** failures)); const q = await fetch(session, { method: 'PUT', headers: { authorization: `Bearer ${await accessToken(ep)}`, 'content-range': `bytes */${size}` } }); if (q.status === 308) { const range = q.headers.get('range'); offset = range ? Number(/bytes=0-(\d+)/.exec(range)?.[1] ?? -1) + 1 : 0; } continue; }
      throw new Error(`Subida interrumpida: HTTP ${r.status} ${(await r.text()).slice(0, 400)}`);
    }
  } finally { await fh.close(); }
}

// ------------------------------------------------------------------ episode -> YouTube
/** Default title/description/tags for an episode: logline from sinopsis.md, credits and licences from metadata. */
export async function episodeUploadDefaults(projectRoot: string, meta: Record<string, unknown>, episode: { id: string; name: string; dir: string }): Promise<{ file: string; meta: UploadMeta; thumbnail?: string }> {
  const out = join(projectRoot, episode.dir, 'output');
  const md = JSON.parse(await readFile(join(out, 'metadata.json'), 'utf8').catch(() => 'null')) as { video?: string; licenses?: { voices?: { character: string; provider: string; voice: string; license: { id: string } }[]; music?: { id: string; license: { id: string } }[] } } | null;
  if (!md?.video || !existsSync(join(out, md.video))) throw new Error(`No hay vídeo renderizado en ${out}. Ejecuta produce primero.`);
  const report = JSON.parse(await readFile(join(out, 'validation-report.json'), 'utf8').catch(() => 'null')) as { ok?: boolean } | null;
  if (report?.ok === false) throw new Error('El último render no superó la QA (validation-report.json). Corrígelo antes de publicar.');
  const sinopsis = await readFile(join(projectRoot, episode.dir, 'sinopsis.md'), 'utf8').catch(() => '');
  const logline = /\*\*Logline\.?\*\*\s*([^\n]+)/i.exec(sinopsis)?.[1]?.trim() ?? '';
  const series = String(meta.name ?? '');
  const voices = [...new Set((md.licenses?.voices ?? []).map(v => `${v.provider} (${v.license.id})`))].join(', ');
  const description = [logline, '', `${series} — ${episode.name}.`, 'Animación generada localmente con Series Forge Studio: personajes y escenarios procedurales, música procedural original.', voices ? `Voces sintéticas: ${voices}.` : ''].filter(s => s !== undefined).join('\n').trim();
  const lang = String(meta.language ?? 'es-ES').slice(0, 2);
  const tags = [series, String(meta.genre ?? ''), 'animación', 'serie animada', 'comedia'].filter(Boolean);
  const thumb = join(out, 'thumbnail.png');
  return { file: join(out, md.video), meta: { title: `${series} — ${episode.name}`.slice(0, 100), description, tags, categoryId: '1', privacy: 'private', madeForKids: false, containsSyntheticMedia: true, language: lang }, thumbnail: existsSync(thumb) ? thumb : undefined };
}
export async function recordUpload(projectRoot: string, episodeDir: string, r: { videoId: string; url: string; privacy: string }, meta: UploadMeta) {
  const f = join(projectRoot, episodeDir, 'output', 'youtube.json');
  const prev = JSON.parse(await readFile(f, 'utf8').catch(() => '[]')) as unknown[];
  await writeFile(f, JSON.stringify([...(Array.isArray(prev) ? prev : []), { ...r, title: meta.title, uploadedAt: new Date().toISOString() }], null, 2));
}
