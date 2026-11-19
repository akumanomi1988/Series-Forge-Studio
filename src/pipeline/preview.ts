/** Visual QA renders through the real browser Stage: character turnarounds, expression sheets, scene stills. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SceneSchemaV2 } from '../engine/schema.ts';
import type { SceneV2 } from '../engine/schema.ts';
import { compileScene } from '../engine/director.ts';
import type { SpeechInfo } from '../engine/director.ts';
import type { ResolvedScene } from '../engine/timeline.ts';
import { assetLibrary, loadProject } from './project.ts';
import type { LoadedProject } from './project.ts';
import { openRenderHost } from './chrome.ts';

export interface StillRequest { resolved: ResolvedScene; times: number[]; labels: string[] }
export async function renderStills(p: LoadedProject, requests: StillRequest[], outDir: string, width = 1280, height = 720): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const host = await openRenderHost({ width, height, scenes: requests.map(r => ({ resolved: r.resolved })), lib: assetLibrary(p) }, { width, height });
  const files: string[] = [];
  try {
    for (let s = 0; s < requests.length; s++) {
      await host.capture(s, requests[s].times, 'png', async (_i, data, label) => { const f = join(outDir, `${label}.png`); await writeFile(f, data); files.push(f); }, requests[s].labels);
    }
  } finally { await host.close(); }
  return files;
}

function scene(extra: Record<string, unknown>): SceneV2 { return SceneSchemaV2.parse({ schemaVersion: 2, id: 'sc-900', name: 'preview', environmentId: null, durationSec: 4, ...extra }); }

export function turnaroundScene(p: LoadedProject, characterId: string, yaws = [0, 35, 90, 180, 270]): ResolvedScene {
  const spacing = 1.05;
  const actors = yaws.map((y, i) => ({ id: `${characterId}-${i}`, characterId, position: [(i - (yaws.length - 1) / 2) * spacing, 0, 0] as [number, number, number], yawDeg: y, expression: 'neutral', idle: 'idle' }));
  const h = p.characters[characterId].geometry.body.height;
  const sc = scene({ actors, autoLook: false, shots: [{ id: 'turn', camera: { type: 'static', position: [0, h * 0.62, 9.5], target: [0, h * 0.5, 0], fov: 22 } }] });
  return compileScene(sc, assetLibrary(p));
}
export function expressionScene(p: LoadedProject, characterId: string, expressions: string[]): ResolvedScene {
  const h = p.characters[characterId].geometry.body.height;
  const actors = expressions.map((e, i) => ({ id: `${characterId}-${e}`, characterId, position: [(i - (expressions.length - 1) / 2) * 0.7, 0, 0] as [number, number, number], yawDeg: 0, expression: e, idle: 'idle' }));
  const sc = scene({ actors, autoLook: false, shots: [{ id: 'expr', camera: { type: 'static', position: [0, h * 0.9, 7.2], target: [0, h * 0.84, 0], fov: 17 } }] });
  return compileScene(sc, assetLibrary(p));
}
export function sceneStills(p: LoadedProject, sc: SceneV2, speech?: Record<string, SpeechInfo>): ResolvedScene { return compileScene(sc, assetLibrary(p), { speech }); }

if (import.meta.main) {
  const [project, kind, id, ...rest] = process.argv.slice(2);
  const p = await loadProject(project);
  const out = join(p.root, 'generated', 'preview');
  const reqs: StillRequest[] = [];
  if (kind === 'character') {
    reqs.push({ resolved: turnaroundScene(p, id), times: [1.0], labels: [`${id}-turnaround`] });
    reqs.push({ resolved: expressionScene(p, id, ['neutral', 'joy', 'smile', 'laugh', 'sad', 'angry']), times: [1.2], labels: [`${id}-expr-1`] });
    reqs.push({ resolved: expressionScene(p, id, ['fear', 'surprise', 'nervous', 'thinking', 'smirk', 'worried']), times: [1.2], labels: [`${id}-expr-2`] });
  }
  console.log(await renderStills(p, reqs, out, Number(rest[0] ?? 1600), Number(rest[1] ?? 900)));
}
