/** File-first project loader. Reads workspace/<project>/ (JSON + Markdown), validates every file with the
 * versioned schemas, migrates v1 assets in memory and resolves inheritance:
 *   clips/expressions: library/humanoid  <  project animations|expressions/humanoid  <  characters/<id>/...
 * Nothing here writes to disk. */
import { readFile, readdir, lstat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import {
  CharacterGeometrySchema, RigSchema, VoiceSchema, ClipSchemaV2, ClipSchemaV1, LocomotionSchema, ExpressionSchemaV2, PropGeometrySchema, EnvironmentSchemaV2,
  SceneSchemaV2, EpisodeSchema, SfxSchema, MusicSchema, migrateClipV1, migrateExpressionV1, formatZodError
} from '../engine/schema.ts';
import type { CharacterGeometry, ClipV2, Locomotion, ExpressionV2, PropGeometry, EnvironmentV2, SceneV2, Episode, VoiceProfile, SfxDef, MusicDef } from '../engine/schema.ts';
import type { AssetLibrary } from '../engine/timeline.ts';
import { withDefaults } from '../engine/props.ts';
import type { Vec3 } from '../engine/math.ts';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const LIBRARY_ROOT = join(REPO_ROOT, 'library');
export const WORKSPACE_ROOT = resolve(process.env.SERIES_FORGE_WORKSPACE ?? join(REPO_ROOT, 'workspace'));
export const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const MAX_FILE = 2_000_000;

export interface Issue { level: 'error' | 'warning'; path: string; message: string }
export interface CharacterData { id: string; name: string; manifest: Record<string, unknown>; geometry: CharacterGeometry; rigOffsets: Record<string, Vec3>; voice: VoiceProfile | null; clips: Record<string, ClipV2>; locomotion: Record<string, Locomotion>; expressions: Record<string, ExpressionV2>; docs: Record<string, string>; relations: unknown; files: string[] }
export interface LoadedProject {
  id: string; root: string; meta: Record<string, unknown>;
  characters: Record<string, CharacterData>; props: Record<string, { id: string; name: string; geometry: PropGeometry }>; environments: Record<string, { id: string; name: string; env: EnvironmentV2 }>;
  episodes: Record<string, { id: string; name: string; episode: Episode; scenes: Record<string, SceneV2>; dir: string; legacy?: boolean }>;
  sfx: Record<string, SfxDef>; music: Record<string, MusicDef>;
  issues: Issue[]; fileHashes: Record<string, string>;
}

export function projectDir(project: string): string {
  if (!SAFE_ID.test(project)) throw new Error(`ID de proyecto no válido: ${project}`);
  return join(WORKSPACE_ROOT, project);
}
/** Resolve a path inside a project, rejecting traversal and symbolic links. */
export async function safeJoin(root: string, rel: string): Promise<string> {
  const abs = resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + sep)) throw new Error('Ruta fuera del proyecto');
  let cur = root;
  for (const seg of abs.slice(root.length).split(sep).filter(Boolean)) {
    cur = join(cur, seg);
    try { if ((await lstat(cur)).isSymbolicLink()) throw new Error('Enlaces simbólicos no permitidos'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
  return abs;
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
async function dirs(path: string): Promise<string[]> { try { return (await readdir(path, { withFileTypes: true })).filter(d => d.isDirectory() && SAFE_ID.test(d.name)).map(d => d.name).sort(); } catch { return []; } }
async function files(path: string, ext = '.json'): Promise<string[]> { try { return (await readdir(path, { withFileTypes: true })).filter(d => d.isFile() && d.name.endsWith(ext) && SAFE_ID.test(d.name.slice(0, -ext.length))).map(d => d.name).sort(); } catch { return []; } }

export class Reader {
  readonly root: string;
  readonly issues: Issue[] = [];
  readonly hashes: Record<string, string> = {};
  constructor(root: string) { this.root = root; }
  async text(rel: string): Promise<string | null> {
    try {
      const abs = await safeJoin(this.root, rel);
      const buf = await readFile(abs);
      if (buf.length > MAX_FILE) { this.issues.push({ level: 'error', path: rel, message: 'Archivo demasiado grande' }); return null; }
      const s = buf.toString('utf8').replace(/^﻿/, '');
      this.hashes[rel] = sha(s);
      return s;
    } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; this.issues.push({ level: 'error', path: rel, message: (e as Error).message }); return null; }
  }
  async json(rel: string, required = false): Promise<unknown | null> {
    const s = await this.text(rel);
    if (s === null) { if (required) this.issues.push({ level: 'error', path: rel, message: 'Falta el archivo' }); return null; }
    try { return JSON.parse(s); } catch (e) { this.issues.push({ level: 'error', path: rel, message: `JSON inválido: ${(e as Error).message}` }); return null; }
  }
  parse<T>(rel: string, raw: unknown, schema: { parse(x: unknown): T }): T | null {
    try { return schema.parse(raw); } catch (e) { this.issues.push({ level: 'error', path: rel, message: formatZodError(e) }); return null; }
  }
  warn(path: string, message: string) { this.issues.push({ level: 'warning', path, message }); }
}

/** Load clips/locomotion/expressions from a directory into the given maps (later calls override earlier). */
async function loadAnimDir(r: Reader, rel: string, clips: Record<string, ClipV2>, loco: Record<string, Locomotion>) {
  for (const f of await files(join(r.root, rel))) {
    const path = `${rel}/${f}`, id = f.slice(0, -5);
    const raw = await r.json(path) as { schemaVersion?: number; kind?: string } | null;
    if (!raw) continue;
    if (raw.schemaVersion === 1) { const v1 = r.parse(path, raw, ClipSchemaV1); if (v1) { clips[id] = migrateClipV1(v1, id); r.warn(path, 'Animación v1 migrada en memoria (usa `studio migrate` para guardarla en v2)'); } continue; }
    if (raw.kind === 'locomotion') { const l = r.parse(path, raw, LocomotionSchema); if (l) loco[id] = { ...l, id }; continue; }
    const c = r.parse(path, raw, ClipSchemaV2); if (c) clips[id] = { ...c, id };
  }
}
async function loadExprDir(r: Reader, rel: string, out: Record<string, ExpressionV2>) {
  for (const f of await files(join(r.root, rel))) {
    const path = `${rel}/${f}`, id = f.slice(0, -5);
    const raw = await r.json(path) as { schemaVersion?: number } | null;
    if (!raw) continue;
    if (raw.schemaVersion === 1) { out[id] = migrateExpressionV1(raw as never, id); r.warn(path, 'Expresión v1 migrada en memoria'); continue; }
    const e = r.parse(path, raw, ExpressionSchemaV2); if (e) out[id] = { ...e, id };
  }
}
let libraryCache: { clips: Record<string, ClipV2>; loco: Record<string, Locomotion>; expressions: Record<string, ExpressionV2>; sfx: Record<string, SfxDef>; music: Record<string, MusicDef>; hash: string } | null = null;
export async function loadLibrary(force = false) {
  if (libraryCache && !force) return libraryCache;
  const r = new Reader(LIBRARY_ROOT);
  const clips: Record<string, ClipV2> = {}, loco: Record<string, Locomotion> = {}, expressions: Record<string, ExpressionV2> = {}, sfx: Record<string, SfxDef> = {}, music: Record<string, MusicDef> = {};
  await loadAnimDir(r, 'humanoid/animations', clips, loco);
  await loadExprDir(r, 'humanoid/expressions', expressions);
  for (const f of await files(join(LIBRARY_ROOT, 'audio', 'sfx'))) { const s = r.parse(`audio/sfx/${f}`, await r.json(`audio/sfx/${f}`), SfxSchema); if (s) sfx[s.id] = s; }
  for (const f of await files(join(LIBRARY_ROOT, 'audio', 'music'))) { const s = r.parse(`audio/music/${f}`, await r.json(`audio/music/${f}`), MusicSchema); if (s) music[s.id] = s; }
  if (r.issues.some(i => i.level === 'error')) throw new Error('Biblioteca inválida: ' + JSON.stringify(r.issues));
  libraryCache = { clips, loco, expressions, sfx, music, hash: sha(JSON.stringify(r.hashes)) };
  return libraryCache;
}

/** v1 geometry (primitive parts per v0.2 bone) -> v2 parametric description keeping its palette. */
function migrateGeometryV1(raw: { parts?: { id: string; color?: string }[] }): CharacterGeometry {
  const col = (id: string, d: string) => raw.parts?.find(p => p.id === id)?.color ?? d;
  return CharacterGeometrySchema.parse({ schemaVersion: 2, body: { skinColor: col('face', '#e0ac85') }, hair: { style: 'short', color: col('hair', '#252d39') }, outfit: { top: { type: 'tshirt', color: col('body', '#d94c57') }, bottom: { type: 'pants', color: col('legL', '#30455f') }, shoes: { type: 'sneakers', color: col('shoeL', '#202835') } } });
}
function migrateEnvV1(raw: { size?: number[]; floorColor?: string; backdropColor?: string }): EnvironmentV2 {
  const size = (raw.size?.length === 3 ? raw.size : [12, 8, 9]) as Vec3;
  return EnvironmentSchemaV2.parse({ schemaVersion: 2, size: [size[0], Math.min(size[1], 6), size[2]], floor: { color: raw.floorColor ?? '#596472', pattern: 'tiles' }, walls: { color: raw.backdropColor ?? '#243344' } });
}

export async function loadProject(project: string): Promise<LoadedProject> {
  const root = projectDir(project);
  try { const st = await lstat(root); if (!st.isDirectory() || st.isSymbolicLink()) throw new Error(); } catch { throw new Error(`No existe el proyecto workspace/${project}`); }
  const r = new Reader(root);
  const lib = await loadLibrary();
  const meta = ((await r.json('project.json')) ?? (await r.json('universe.json')) ?? {}) as Record<string, unknown>;
  const out: LoadedProject = { id: project, root, meta, characters: {}, props: {}, environments: {}, episodes: {}, sfx: { ...lib.sfx }, music: { ...lib.music }, issues: r.issues, fileHashes: r.hashes };
  const projClips = { ...lib.clips }, projLoco = { ...lib.loco }, projExpr = { ...lib.expressions };
  await loadAnimDir(r, 'animations/humanoid', projClips, projLoco);
  await loadExprDir(r, 'expressions/humanoid', projExpr);
  for (const f of await files(join(root, 'audio', 'sfx'))) { const s = r.parse(`audio/sfx/${f}`, await r.json(`audio/sfx/${f}`), SfxSchema); if (s) out.sfx[s.id] = s; }
  for (const f of await files(join(root, 'audio', 'music'))) { const s = r.parse(`audio/music/${f}`, await r.json(`audio/music/${f}`), MusicSchema); if (s) out.music[s.id] = s; }
  // characters
  for (const id of await dirs(join(root, 'characters'))) {
    const base = `characters/${id}`;
    const manifest = await r.json(`${base}/manifest.json`, true) as Record<string, unknown> | null;
    if (!manifest) continue;
    if (manifest.id !== id) r.warn(`${base}/manifest.json`, `El id del manifest (${String(manifest.id)}) no coincide con la carpeta; se usa "${id}"`);
    const rawGeo = await r.json(`${base}/geometry.json`, true) as { schemaVersion?: number } | null;
    let geometry: CharacterGeometry | null = null;
    if (rawGeo?.schemaVersion === 1) { geometry = migrateGeometryV1(rawGeo as never); r.warn(`${base}/geometry.json`, 'Geometría v1 migrada en memoria a humanoid-toon v2'); }
    else if (rawGeo) geometry = r.parse(`${base}/geometry.json`, rawGeo, CharacterGeometrySchema);
    if (!geometry) continue;
    const rawRig = await r.json(`${base}/rig.json`) as { schemaVersion?: number } | null;
    const rig = rawRig && rawRig.schemaVersion === 2 ? r.parse(`${base}/rig.json`, rawRig, RigSchema) : null;
    const rawVoice = await r.json(`${base}/voice.json`) as { schemaVersion?: number } | null;
    const voice = rawVoice && rawVoice.schemaVersion === 2 ? r.parse(`${base}/voice.json`, rawVoice, VoiceSchema) : null;
    if (!voice) r.warn(`${base}/voice.json`, 'Sin perfil de voz v2: los diálogos de este personaje no se pueden sintetizar');
    const clips = { ...projClips }, loco = { ...projLoco }, expressions = { ...projExpr };
    await loadAnimDir(r, `${base}/animations`, clips, loco);
    await loadExprDir(r, `${base}/expressions`, expressions);
    const docs: Record<string, string> = {};
    for (const f of await files(join(root, base), '.md')) docs[f] = (await r.text(`${base}/${f}`)) ?? '';
    const relations = await r.json(`${base}/relaciones.json`);
    out.characters[id] = { id, name: String(manifest.name ?? id), manifest, geometry, rigOffsets: (rig?.boneOffsets ?? {}) as Record<string, Vec3>, voice, clips, locomotion: loco, expressions, docs, relations, files: Object.keys(r.hashes).filter(k => k.startsWith(base + '/')) };
  }
  // props
  for (const id of await dirs(join(root, 'props'))) {
    const base = `props/${id}`;
    const manifest = await r.json(`${base}/manifest.json`, true) as Record<string, unknown> | null;
    const raw = await r.json(`${base}/geometry.json`, true) as { schemaVersion?: number; parts?: unknown[] } | null;
    if (!manifest || !raw) continue;
    let geometry: PropGeometry | null;
    if (raw.schemaVersion === 1) { geometry = r.parse(`${base}/geometry.json`, { schemaVersion: 2, generator: 'parts', parts: raw.parts ?? [] }, PropGeometrySchema); r.warn(`${base}/geometry.json`, 'Objeto v1 migrado en memoria'); }
    else geometry = r.parse(`${base}/geometry.json`, raw, PropGeometrySchema);
    if (geometry) out.props[id] = { id, name: String(manifest.name ?? id), geometry: withDefaults(geometry) };
  }
  // environments
  for (const id of await dirs(join(root, 'environments'))) {
    const base = `environments/${id}`;
    const manifest = await r.json(`${base}/manifest.json`, true) as Record<string, unknown> | null;
    const raw = await r.json(`${base}/environment.json`, true) as { schemaVersion?: number } | null;
    if (!manifest || !raw) continue;
    let env: EnvironmentV2 | null;
    if (raw.schemaVersion === 1) { env = migrateEnvV1(raw as never); r.warn(`${base}/environment.json`, 'Escenario v1 migrado en memoria'); }
    else env = r.parse(`${base}/environment.json`, raw, EnvironmentSchemaV2);
    if (env) { for (const p of env.props) if (!out.props[p.propId]) r.issues.push({ level: 'error', path: `${base}/environment.json`, message: `Objeto inexistente: ${p.propId}` }); out.environments[id] = { id, name: String(manifest.name ?? id), env }; }
  }
  // episodes
  for (const id of await dirs(join(root, 'episodes'))) {
    const base = `episodes/${id}`;
    const raw = await r.json(`${base}/episode.json`) as Record<string, unknown> | null;
    const scenes: Record<string, SceneV2> = {};
    if (!raw) { const m = await r.json(`${base}/manifest.json`) as Record<string, unknown> | null; if (m) { r.warn(`${base}/manifest.json`, 'Episodio v1 (sin episode.json): solo exportable con el renderer legado `npm run render:legacy`'); out.episodes[id] = { id, name: String(m.name ?? id), episode: { schemaVersion: 2, id, type: 'episode', name: String(m.name ?? id), scenes: ['sc-001'], music: [], render: { width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }, status: 'draft' }, scenes, dir: base, legacy: true }; } continue; }
    const episode = r.parse(`${base}/episode.json`, raw, EpisodeSchema);
    if (!episode) continue;
    for (const sid of episode.scenes) {
      const path = `${base}/scenes/${sid}/scene.json`;
      const sraw = await r.json(path, true);
      if (!sraw) continue;
      if ((sraw as { schemaVersion?: number }).schemaVersion === 1) { r.issues.push({ level: 'error', path, message: 'Escena v1: usa `npm run studio -- migrate` o reescríbela en formato v2' }); continue; }
      const sc = r.parse(path, sraw, SceneSchemaV2);
      if (sc) { if (sc.id !== sid) r.issues.push({ level: 'error', path, message: `id ${sc.id} no coincide con la carpeta ${sid}` }); scenes[sid] = sc; }
    }
    out.episodes[id] = { id, name: episode.name, episode, scenes, dir: base };
  }
  checkReferences(out);
  return out;
}

export function checkReferences(p: LoadedProject): void {
  const err = (path: string, message: string) => p.issues.push({ level: 'error', path, message });
  for (const ep of Object.values(p.episodes)) for (const [sid, sc] of Object.entries(ep.scenes)) {
    const path = `${ep.dir}/scenes/${sid}/scene.json`;
    if (sc.environmentId && !p.environments[sc.environmentId]) err(path, `Escenario inexistente: ${sc.environmentId}`);
    const actorIds = new Set(sc.actors.map(a => a.id));
    for (const a of sc.actors) {
      const c = p.characters[a.characterId];
      if (!c) { err(path, `Personaje inexistente: ${a.characterId}`); continue; }
      if (!c.expressions[a.expression]) err(path, `Expresión desconocida ${a.expression} para ${a.id}`);
    }
    const envProps = sc.environmentId ? p.environments[sc.environmentId]?.env.props.map(x => x.id) ?? [] : [];
    const propIds = new Set([...sc.props.map(x => x.id), ...envProps]);
    for (const pr of sc.props) if (!p.props[pr.propId]) err(path, `Objeto inexistente: ${pr.propId}`);
    for (const act of sc.actions) {
      if ('actor' in act && !actorIds.has(act.actor)) err(path, `Acción ${act.type}: actor desconocido ${act.actor}`);
      if ('prop' in act && typeof act.prop === 'string' && !propIds.has(act.prop)) err(path, `Acción ${act.type}: objeto desconocido ${act.prop}`);
      if (act.type === 'play') { const a = sc.actors.find(x => x.id === act.actor); if (a && p.characters[a.characterId] && !p.characters[a.characterId].clips[act.clip]) err(path, `Animación desconocida ${act.clip}`); }
    }
    for (const l of sc.dialogue) {
      if (l.voiceOver) { const ch = p.characters[sc.actors.find(x => x.id === l.actor)?.characterId ?? l.actor]; if (!ch) err(path, `Narración ${l.id}: personaje desconocido ${l.actor}`); else if (!ch.voice) err(path, `Narración ${l.id}: ${l.actor} no tiene voice.json v2`); continue; }
      if (!actorIds.has(l.actor)) err(path, `Diálogo ${l.id}: actor desconocido ${l.actor}`);
      const a = sc.actors.find(x => x.id === l.actor);
      if (a && p.characters[a.characterId] && !p.characters[a.characterId].voice) err(path, `Diálogo ${l.id}: ${a.characterId} no tiene voice.json v2`);
    }
    for (const s of sc.sound) if (s.kind === 'music' ? !p.music[s.sound] : !p.sfx[s.sound]) err(path, `Sonido inexistente: ${s.sound}`);
  }
}

/** AssetLibrary view for the engine (only what scenes need). */
export function assetLibrary(p: LoadedProject): AssetLibrary {
  const characters: AssetLibrary['characters'] = {};
  for (const [id, c] of Object.entries(p.characters)) characters[id] = { geometry: c.geometry, rigOffsets: c.rigOffsets, clips: c.clips, locomotion: c.locomotion, expressions: c.expressions };
  return { characters, props: Object.fromEntries(Object.entries(p.props).map(([k, v]) => [k, v.geometry])), environments: Object.fromEntries(Object.entries(p.environments).map(([k, v]) => [k, v.env])), style: (p.meta as { renderStyle?: string }).renderStyle === 'soft' ? 'soft' : 'toon' };
}
export const hashText = sha;
