/** Scaffolding of valid v2 files (projects, characters, props, environments, episodes, scenes).
 * Agents may also write these files directly; this is a convenience that never overwrites existing data. */
import { mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { WORKSPACE_ROOT, SAFE_ID, projectDir } from './project.ts';
import { CharacterGeometrySchema, PropGeometrySchema, EnvironmentSchemaV2 } from '../engine/schema.ts';

async function writeNew(path: string, data: unknown) { if (existsSync(path)) throw new Error(`Ya existe: ${path}`); await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); }
const need = (id: string | undefined, what: string) => { if (!id || !SAFE_ID.test(id)) throw new Error(`${what} inválido (usa minúsculas, números, - o _)`); return id; };

export async function scaffold(kind: string, rest: string[], from?: string): Promise<string> {
  if (kind === 'project') {
    const id = need(rest[0], 'ID de proyecto'), name = rest[1] ?? id;
    const root = join(WORKSPACE_ROOT, id);
    await writeNew(join(root, 'project.json'), { schemaVersion: 2, id, name, language: 'es-ES', fps: 24 });
    for (const d of ['characters', 'props', 'environments', 'episodes', 'animations/humanoid', 'expressions/humanoid', 'audio/sfx', 'audio/music', 'story']) await mkdir(join(root, d), { recursive: true });
    await writeNew(join(root, 'story', 'canon.json'), { schemaVersion: 1, facts: [], characters: {}, relationships: [], confirmedEpisodes: [] });
    await writeNew(join(root, 'story', 'canon.md'), `# ${name} — canon\n\nHechos confirmados del universo. Se actualiza con \`studio story confirm\`.\n`);
    return `Proyecto creado en ${root}`;
  }
  const project = need(rest[0], 'Proyecto'); const root = projectDir(project);
  if (!existsSync(root)) throw new Error(`No existe el proyecto ${project}`);
  if (kind === 'scene') {
    const ep = need(rest[1], 'Episodio'), sid = rest[2]; if (!/^sc-\d{3,4}$/.test(sid ?? '')) throw new Error('ID de escena: sc-NNN');
    const epFile = join(root, 'episodes', ep, 'episode.json');
    const epData = JSON.parse(await readFile(epFile, 'utf8'));
    await writeNew(join(root, 'episodes', ep, 'scenes', sid, 'scene.json'), { schemaVersion: 2, id: sid, name: rest[3] ?? sid, environmentId: null, durationSec: 'auto', actors: [], props: [], actions: [], dialogue: [], shots: [{ id: 'sh-01', at: 0, camera: { type: 'static', position: [0, 1.6, 6], target: [0, 1.1, 0], fov: 35 } }], sound: [] });
    if (!epData.scenes.includes(sid)) { epData.scenes.push(sid); await writeFile(epFile, JSON.stringify(epData, null, 2) + '\n'); }
    return `Escena ${sid} creada y añadida a ${ep}`;
  }
  const id = need(rest[1], 'ID'), name = rest[2] ?? id;
  const dirName = { character: 'characters', prop: 'props', environment: 'environments', episode: 'episodes' }[kind];
  if (!dirName) throw new Error('Tipo: project|character|prop|environment|episode|scene');
  const dir = join(root, dirName, id);
  if (from) { const src = join(root, dirName, need(from, 'Origen')); if (!existsSync(src)) throw new Error(`No existe ${src}`); if (existsSync(dir)) throw new Error(`Ya existe ${dir}`); await cp(src, dir, { recursive: true, filter: s => !/[\\/](generated|output|compiled)([\\/]|$)/.test(s) }); const m = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')); await writeFile(join(dir, 'manifest.json'), JSON.stringify({ ...m, id, name }, null, 2) + '\n'); return `${kind} ${id} creado a partir de ${from}`; }
  switch (kind) {
    case 'character':
      await writeNew(join(dir, 'manifest.json'), { schemaVersion: 2, id, type: 'character', name, rigType: 'humanoid' });
      await writeNew(join(dir, 'geometry.json'), CharacterGeometrySchema.parse({ schemaVersion: 2 }));
      await writeNew(join(dir, 'rig.json'), { schemaVersion: 2, type: 'humanoid', template: 'humanoid-v2', boneOffsets: {}, jointLimits: {} });
      await writeNew(join(dir, 'voice.json'), { schemaVersion: 2, provider: 'windows-onecore', voice: 'Microsoft Helena', language: 'es-ES', rate: 1, pitchSemitones: 0, formantPreserve: true, gainDb: 0, eq: { lowDb: 0, midDb: 0, highDb: 0 }, emotionProsody: true, license: { id: 'windows-onecore-voices', commercialUse: 'unknown', notes: 'Revisar licencia antes de uso comercial.' } });
      await writeNew(join(dir, 'relaciones.json'), { schemaVersion: 2, relations: [] });
      for (const [f, t] of [['aspecto.md', 'Aspecto'], ['personalidad.md', 'Personalidad'], ['biografia.md', 'Biografía'], ['gustos.md', 'Gustos']]) await writeNew(join(dir, f), `# ${name} — ${t}\n\nPendiente.\n`);
      await mkdir(join(dir, 'animations'), { recursive: true }); await mkdir(join(dir, 'expressions'), { recursive: true });
      break;
    case 'prop':
      await writeNew(join(dir, 'manifest.json'), { schemaVersion: 2, id, type: 'prop', name });
      await writeNew(join(dir, 'geometry.json'), PropGeometrySchema.parse({ schemaVersion: 2, generator: 'parts', parts: [{ id: 'body', primitive: 'roundedBox', size: [0.4, 0.4, 0.4], position: [0, 0.2, 0], color: '#9aa3ad' }], anchors: { grip: { position: [0, 0.4, 0] }, top: { position: [0, 0.4, 0] } } }));
      await writeNew(join(dir, 'descripcion.md'), `# ${name}\n`);
      break;
    case 'environment':
      await writeNew(join(dir, 'manifest.json'), { schemaVersion: 2, id, type: 'environment', name });
      await writeNew(join(dir, 'environment.json'), EnvironmentSchemaV2.parse({ schemaVersion: 2 }));
      await writeNew(join(dir, 'descripcion.md'), `# ${name}\n`);
      break;
    case 'episode':
      await writeNew(join(dir, 'episode.json'), { schemaVersion: 2, id, type: 'episode', name, scenes: ['sc-001'], music: [], render: { width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }, status: 'draft' });
      await writeNew(join(dir, 'sinopsis.md'), `# ${name}\n\nSinopsis.\n`); await writeNew(join(dir, 'guion.md'), `# ${name} — guion\n`);
      await writeNew(join(dir, 'story.json'), { schemaVersion: 1, status: 'draft', facts: [], knowledge: [], relationships: [], emotionalStates: {}, events: [] });
      await writeNew(join(dir, 'scenes', 'sc-001', 'scene.json'), { schemaVersion: 2, id: 'sc-001', name: 'Escena 1', environmentId: null, durationSec: 'auto', actors: [], props: [], actions: [], dialogue: [], shots: [{ id: 'sh-01', at: 0, camera: { type: 'static', position: [0, 1.6, 6], target: [0, 1.1, 0], fov: 35 } }], sound: [] });
      break;
  }
  return `${kind} ${id} creado en ${dir}`;
}
