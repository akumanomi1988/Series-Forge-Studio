/** Story Studio: persistent canon, per-character knowledge, relationships, timeline and episode proposals.
 *  story/canon.json      confirmed facts (status canon), character knowledge/emotional state/goals, relationships
 *  story/timeline.json   confirmed events (chronology)
 *  story/history/*.json  snapshots before every explicit canon operation (confirm / amend) -> revert
 *  episodes/<id>/story.json  proposals of the episode (draft until `studio story confirm`)
 * Rules: a character cannot use knowledge it has not received; confirmed canon cannot change retroactively
 * except through `studio story amend` (recorded) or `studio story revert`. */
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { loadProject } from './project.ts';
import type { LoadedProject, Issue } from './project.ts';

const Fact = z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/), text: z.string().min(1).max(600), since: z.string().max(40).default('canon'), status: z.enum(['canon', 'proposed']).default('canon'), amended: z.array(z.object({ at: z.string(), reason: z.string(), previous: z.string() })).default([]) }).strict();
export const CanonSchema = z.object({
  schemaVersion: z.literal(1),
  facts: z.array(Fact).default([]),
  characters: z.record(z.string(), z.object({ knows: z.array(z.string()).default([]), emotionalState: z.string().max(200).optional(), goals: z.array(z.string().max(300)).default([]), arc: z.array(z.object({ episode: z.string(), note: z.string() })).default([]) }).strict()).default({}),
  relationships: z.array(z.object({ a: z.string(), b: z.string(), type: z.string().max(80), trust: z.number().min(-1).max(1), history: z.array(z.object({ episode: z.string(), note: z.string(), trustDelta: z.number().default(0) })).default([]) }).strict()).default([]),
  confirmedEpisodes: z.array(z.string()).default([]),
  integrity: z.string().optional()
}).strict();
export const EpisodeStorySchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(['draft', 'approved', 'confirmed']).default('draft'),
  facts: z.array(Fact.extend({ status: z.literal('proposed').default('proposed') })).default([]),
  knowledge: z.array(z.object({ character: z.string(), fact: z.string(), how: z.string().max(300).optional() }).strict()).default([]),
  relationships: z.array(z.object({ a: z.string(), b: z.string(), trustDelta: z.number().min(-1).max(1), note: z.string().max(400) }).strict()).default([]),
  emotionalStates: z.record(z.string(), z.string().max(200)).default({}),
  events: z.array(z.object({ id: z.string(), text: z.string().max(600), scene: z.string().optional() }).strict()).default([])
}).strict();
export type Canon = z.infer<typeof CanonSchema>;
const factIntegrity = (c: Canon) => createHash('sha256').update(JSON.stringify(c.facts.filter(f => f.status === 'canon').map(f => [f.id, f.text]))).digest('hex').slice(0, 16);

async function readJson<T>(path: string, schema: z.ZodType<T>, fallback: T): Promise<T> { if (!existsSync(path)) return fallback; return schema.parse(JSON.parse((await readFile(path, 'utf8')).replace(/^﻿/, ''))); }
async function writeAtomic(path: string, data: unknown) { await mkdir(join(path, '..'), { recursive: true }); const tmp = `${path}.${process.pid}.tmp`; await writeFile(tmp, JSON.stringify(data, null, 2) + '\n'); await rename(tmp, path); }

export async function loadStory(p: LoadedProject) {
  const canon = await readJson(join(p.root, 'story', 'canon.json'), CanonSchema, CanonSchema.parse({ schemaVersion: 1 }));
  const timeline = existsSync(join(p.root, 'story', 'timeline.json')) ? JSON.parse(await readFile(join(p.root, 'story', 'timeline.json'), 'utf8')) as { schemaVersion: 1; events: { id: string; episode: string; text: string }[] } : { schemaVersion: 1 as const, events: [] };
  const episodes: Record<string, z.infer<typeof EpisodeStorySchema>> = {};
  for (const id of Object.keys(p.episodes)) { const f = join(p.root, p.episodes[id].dir, 'story.json'); if (existsSync(f)) episodes[id] = await readJson(f, EpisodeStorySchema, EpisodeStorySchema.parse({ schemaVersion: 1 })); }
  return { canon, timeline, episodes };
}

/** Continuity validation: knowledge ordering, unknown facts/characters, retroactive canon edits. */
export async function validateStory(p: LoadedProject): Promise<Issue[]> {
  const issues: Issue[] = [];
  const { canon, episodes } = await loadStory(p);
  if (canon.integrity && canon.integrity !== factIntegrity(canon)) issues.push({ level: 'error', path: 'story/canon.json', message: 'El canon confirmado se ha modificado sin operación explícita (usa `studio story amend` o `studio story revert`)' });
  const facts = new Map(canon.facts.map(f => [f.id, f]));
  for (const c of Object.keys(canon.characters)) if (!p.characters[c]) issues.push({ level: 'error', path: 'story/canon.json', message: `Personaje desconocido en el canon: ${c}` });
  const order = Object.values(p.episodes).sort((a, b) => (a.episode.number ?? 0) - (b.episode.number ?? 0) || a.id.localeCompare(b.id));
  // knowledge state evolves across episodes in order (confirmed ones from canon, drafts simulated)
  const knows = new Map<string, Set<string>>(Object.entries(canon.characters).map(([c, v]) => [c, new Set(v.knows)]));
  const know = (c: string) => { if (!knows.has(c)) knows.set(c, new Set()); return knows.get(c)!; };
  for (const ep of order) {
    const st = episodes[ep.id];
    for (const f of st?.facts ?? []) facts.set(f.id, { ...f, status: 'proposed' } as never);
    if (st?.status === 'confirmed' && !canon.confirmedEpisodes.includes(ep.id)) issues.push({ level: 'warning', path: `${ep.dir}/story.json`, message: 'Marcado como confirmado pero no aplicado al canon' });
    for (const sid of ep.episode.scenes) {
      const sc = ep.scenes[sid]; if (!sc) continue;
      const present = sc.actors.map(a => a.characterId);
      for (const line of sc.dialogue) {
        const actor = sc.actors.find(a => a.id === line.actor); if (!actor) continue;
        for (const f of line.knowledge) {
          if (!facts.has(f)) issues.push({ level: 'error', path: `${ep.dir}/scenes/${sid}/scene.json`, message: `Diálogo ${line.id}: hecho desconocido "${f}"` });
          else if (!know(actor.characterId).has(f) && !canon.confirmedEpisodes.includes(ep.id)) issues.push({ level: 'error', path: `${ep.dir}/scenes/${sid}/scene.json`, message: `Continuidad: ${actor.characterId} usa "${f}" en ${line.id} sin conocerlo todavía` });
        }
        for (const f of line.reveals) { if (!facts.has(f)) issues.push({ level: 'error', path: `${ep.dir}/scenes/${sid}/scene.json`, message: `Diálogo ${line.id}: revela un hecho no declarado "${f}" (añádelo a story.json)` }); for (const c of present) know(c).add(f); }
      }
    }
    for (const k of st?.knowledge ?? []) { if (!facts.has(k.fact)) issues.push({ level: 'error', path: `${ep.dir}/story.json`, message: `Conocimiento de hecho inexistente: ${k.fact}` }); know(k.character).add(k.fact); }
    for (const r of st?.relationships ?? []) for (const c of [r.a, r.b]) if (!p.characters[c]) issues.push({ level: 'error', path: `${ep.dir}/story.json`, message: `Relación con personaje inexistente: ${c}` });
  }
  return issues;
}

async function snapshot(p: LoadedProject, label: string) {
  const dir = join(p.root, 'story', 'history'); await mkdir(dir, { recursive: true });
  const { canon, timeline } = await loadStory(p);
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}.json`);
  await writeAtomic(file, { canon, timeline, label });
  return file;
}
/** Apply a draft episode's proposals to the canon (explicit operation, snapshot first). */
export async function confirmEpisode(project: string, episode: string) {
  const p = await loadProject(project);
  const issues = (await validateStory(p)).filter(i => i.level === 'error');
  if (issues.length) throw new Error('No se puede confirmar con errores de continuidad:\n' + issues.map(i => `  ${i.path}: ${i.message}`).join('\n'));
  const { canon, timeline, episodes } = await loadStory(p);
  if (canon.confirmedEpisodes.includes(episode)) throw new Error(`${episode} ya está confirmado`);
  const st = episodes[episode] ?? EpisodeStorySchema.parse({ schemaVersion: 1 });
  const snap = await snapshot(p, `before-confirm-${episode}`);
  for (const f of st.facts) if (!canon.facts.some(x => x.id === f.id)) canon.facts.push({ ...f, status: 'canon', since: episode, amended: [] });
  const ep = p.episodes[episode];
  const ch = (c: string) => (canon.characters[c] ??= { knows: [], goals: [], arc: [] });
  for (const sid of ep.episode.scenes) { const sc = ep.scenes[sid]; if (!sc) continue; for (const l of sc.dialogue) for (const f of l.reveals) for (const a of sc.actors) if (!ch(a.characterId).knows.includes(f)) ch(a.characterId).knows.push(f); }
  for (const k of st.knowledge) if (!ch(k.character).knows.includes(k.fact)) ch(k.character).knows.push(k.fact);
  for (const [c, e] of Object.entries(st.emotionalStates)) { ch(c).emotionalState = e; ch(c).arc.push({ episode, note: e }); }
  for (const r of st.relationships) {
    let rel = canon.relationships.find(x => (x.a === r.a && x.b === r.b));
    if (!rel) { rel = { a: r.a, b: r.b, type: 'relación', trust: 0, history: [] }; canon.relationships.push(rel); }
    rel.trust = Math.max(-1, Math.min(1, rel.trust + r.trustDelta)); rel.history.push({ episode, note: r.note, trustDelta: r.trustDelta });
  }
  for (const e of st.events) timeline.events.push({ id: e.id, episode, text: e.text });
  canon.confirmedEpisodes.push(episode);
  canon.integrity = factIntegrity(canon);
  await writeAtomic(join(p.root, 'story', 'canon.json'), canon);
  await writeAtomic(join(p.root, 'story', 'timeline.json'), timeline);
  await writeAtomic(join(p.root, ep.dir, 'story.json'), { ...st, status: 'confirmed' });
  return { snapshot: snap, facts: canon.facts.length, confirmed: canon.confirmedEpisodes };
}
export async function amendFact(project: string, factId: string, text: string, reason: string) {
  const p = await loadProject(project);
  const { canon } = await loadStory(p);
  const f = canon.facts.find(x => x.id === factId);
  if (!f) throw new Error(`Hecho inexistente: ${factId}`);
  if (!reason.trim()) throw new Error('Una enmienda del canon necesita un motivo');
  const snap = await snapshot(p, `before-amend-${factId}`);
  f.amended.push({ at: new Date().toISOString(), reason, previous: f.text }); f.text = text;
  canon.integrity = factIntegrity(canon);
  await writeAtomic(join(p.root, 'story', 'canon.json'), canon);
  return { snapshot: snap };
}
export async function revertStory(project: string) {
  const p = await loadProject(project);
  const dir = join(p.root, 'story', 'history');
  const files = existsSync(dir) ? (await readdir(dir)).filter(f => f.endsWith('.json')).sort() : [];
  if (!files.length) throw new Error('No hay instantáneas del canon');
  const last = join(dir, files[files.length - 1]);
  const snap = JSON.parse(await readFile(last, 'utf8')) as { canon: Canon; timeline: unknown; label: string };
  const current = await loadStory(p);
  for (const ep of current.canon.confirmedEpisodes) if (!snap.canon.confirmedEpisodes.includes(ep)) { const f = join(p.root, p.episodes[ep].dir, 'story.json'); if (existsSync(f)) { const st = JSON.parse(await readFile(f, 'utf8')); await writeAtomic(f, { ...st, status: 'draft' }); } }
  await writeAtomic(join(p.root, 'story', 'canon.json'), snap.canon);
  await writeAtomic(join(p.root, 'story', 'timeline.json'), snap.timeline);
  await rename(last, last.replace(/\.json$/, '.reverted'));
  return { restored: snap.label };
}
