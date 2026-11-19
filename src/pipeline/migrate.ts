/** `studio migrate <project>`: rewrites v1 (v0.2–v0.4) assets as v2 files. Every original is kept as <file>.v1.json.
 * v1 scenes (beats) are converted to v2 actions/dialogue/shots on a best-effort basis and flagged for review. */
import { readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, loadProject, SAFE_ID } from './project.ts';
import { CharacterGeometrySchema, migrateClipV1, migrateExpressionV1, ClipSchemaV1, EnvironmentSchemaV2 } from '../engine/schema.ts';

async function backupAndWrite(file: string, data: unknown, report: string[]) {
  const bak = file.replace(/\.json$/, '.v1.json');
  if (!existsSync(bak)) await copyFile(file, bak);
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
  report.push(file);
}
const readJ = async (f: string) => JSON.parse((await readFile(f, 'utf8')).replace(/^﻿/, ''));
const dirs = async (p: string) => existsSync(p) ? (await readdir(p, { withFileTypes: true })).filter(d => d.isDirectory() && SAFE_ID.test(d.name)).map(d => d.name) : [];

export async function migrateProject(project: string): Promise<{ written: string[]; review: string[] }> {
  const root = projectDir(project), written: string[] = [], review: string[] = [];
  const loaded = await loadProject(project); // migrated in memory with the same rules used by the engine
  for (const id of await dirs(join(root, 'characters'))) {
    const base = join(root, 'characters', id);
    const geo = join(base, 'geometry.json');
    if (existsSync(geo) && (await readJ(geo)).schemaVersion === 1 && loaded.characters[id]) await backupAndWrite(geo, CharacterGeometrySchema.parse(loaded.characters[id].geometry), written);
    const rig = join(base, 'rig.json');
    if (existsSync(rig) && (await readJ(rig)).schemaVersion === 1) await backupAndWrite(rig, { schemaVersion: 2, type: 'humanoid', template: 'humanoid-v2', boneOffsets: {}, jointLimits: {} }, written);
    const voice = join(base, 'voice.json');
    if (existsSync(voice) && (await readJ(voice)).schemaVersion === 1) { const v = await readJ(voice); await backupAndWrite(voice, { schemaVersion: 2, provider: 'windows-onecore', voice: v.voiceId || 'Microsoft Helena', language: v.language || 'es-ES', rate: v.rate ?? 1, pitchSemitones: v.pitch ?? 0, formantPreserve: true, gainDb: 0, eq: { lowDb: 0, midDb: 0, highDb: 0 }, emotionProsody: true, license: { id: 'windows-onecore-voices', commercialUse: 'unknown' } }, written); review.push(`${voice}: revisa la voz asignada`); }
    for (const [sub, fn] of [['animations', (raw: unknown, n: string) => migrateClipV1(ClipSchemaV1.parse(raw), n)], ['expressions', (raw: unknown, n: string) => migrateExpressionV1(raw as never, n)]] as const) {
      const d = join(base, sub);
      if (!existsSync(d)) continue;
      for (const f of (await readdir(d)).filter(x => x.endsWith('.json') && !x.endsWith('.v1.json'))) { const p = join(d, f); const raw = await readJ(p); if (raw.schemaVersion === 1) await backupAndWrite(p, fn(raw, f.slice(0, -5)), written); }
    }
  }
  for (const id of await dirs(join(root, 'props'))) { const g = join(root, 'props', id, 'geometry.json'); if (existsSync(g) && (await readJ(g)).schemaVersion === 1) await backupAndWrite(g, loaded.props[id]?.geometry ?? { schemaVersion: 2, generator: 'parts', parts: (await readJ(g)).parts ?? [] }, written); }
  for (const id of await dirs(join(root, 'environments'))) { const e = join(root, 'environments', id, 'environment.json'); if (existsSync(e) && (await readJ(e)).schemaVersion === 1) await backupAndWrite(e, EnvironmentSchemaV2.parse(loaded.environments[id]?.env ?? { schemaVersion: 2 }), written); }
  // v1 episodes: manifest.json + scenes with beats -> episode.json + v2 scenes
  for (const id of await dirs(join(root, 'episodes'))) {
    const epDir = join(root, 'episodes', id);
    if (existsSync(join(epDir, 'episode.json')) || !existsSync(join(epDir, 'manifest.json'))) continue;
    const m = await readJ(join(epDir, 'manifest.json'));
    const scenes: string[] = [];
    for (const sid of (await dirs(join(epDir, 'scenes'))).filter(s => /^sc-\d+$/.test(s))) {
      const f = join(epDir, 'scenes', sid, 'scene.json'); const s = await readJ(f);
      if (s.schemaVersion !== 1) { scenes.push(sid); continue; }
      const actors = (s.actors ?? []).map((a: { characterId: string; position: number[]; yawDeg?: number }) => ({ id: a.characterId, characterId: a.characterId, position: a.position, yawDeg: a.yawDeg ?? 0, expression: 'neutral' }));
      const actions: unknown[] = [], dialogue: unknown[] = [];
      for (const [i, b] of (s.beats ?? []).entries()) {
        if (b.type === 'dialogue' && b.text) dialogue.push({ id: b.id ?? `d${i + 1}`, actor: b.actorId, text: b.text, at: b.startSec, emotion: b.emotion });
        else if (b.type === 'action' && b.actorId) {
          if (b.toPosition) actions.push({ id: `${b.id ?? 'a' + i}-walk`, type: 'walk', actor: b.actorId, at: b.startSec, to: b.toPosition });
          if (Number.isFinite(b.yawDeg)) actions.push({ id: `${b.id ?? 'a' + i}-turn`, type: 'turn', actor: b.actorId, at: b.startSec, yawDeg: b.yawDeg, durationSec: Math.max(0.3, b.endSec - b.startSec) });
          if (b.expression) actions.push({ id: `${b.id ?? 'a' + i}-expr`, type: 'expression', actor: b.actorId, at: b.startSec, expression: b.expression === 'surprised' ? 'surprise' : b.expression });
        }
      }
      const cam = s.camera ?? { position: [0, 2.4, 8], target: [0, 1, 0] };
      await backupAndWrite(f, { schemaVersion: 2, id: sid, name: s.name ?? sid, environmentId: s.environmentId ?? null, durationSec: s.durationSec, actors, props: (s.props ?? []).map((p: { propId: string; position: number[]; yawDeg?: number }, k: number) => ({ id: `${p.propId}-${k + 1}`, propId: p.propId, position: p.position, yawDeg: p.yawDeg ?? 0 })), actions, dialogue, shots: [{ id: 'sh-01', at: 0, camera: { type: 'static', position: cam.position, target: cam.target, fov: 35 } }], sound: [] }, written);
      review.push(`${f}: escena convertida desde beats v1; revisa planos y tiempos`);
      scenes.push(sid);
    }
    await writeFile(join(epDir, 'episode.json'), JSON.stringify({ schemaVersion: 2, id, type: 'episode', name: m.name ?? id, scenes, music: [], render: { width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }, status: 'draft' }, null, 2) + '\n');
    written.push(join(epDir, 'episode.json'));
  }
  return { written, review };
}
