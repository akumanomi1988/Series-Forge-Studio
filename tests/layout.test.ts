// Set layout: door holes from door props, what lies beyond a door, navigation around furniture and through doors,
// approach to a seat with a table in front of it, and the collision QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLibrary } from '../src/pipeline/project.ts';
import { CharacterGeometrySchema, SceneSchemaV2, EnvironmentSchemaV2, PropGeometrySchema } from '../src/engine/schema.ts';
import { compileScene } from '../src/engine/director.ts';
import { rootAt } from '../src/engine/pose.ts';
import { wallOpenings, walkableAreas, buildNav, findPath, footprint, rectDistance, beyondOf, beyondArea, doorsWithoutLeaf } from '../src/engine/layout.ts';
import type { AssetLibrary } from '../src/engine/timeline.ts';
import { withDefaults } from '../src/engine/props.ts';

const env = (props: unknown[] = [], openings: unknown[] = []) => EnvironmentSchemaV2.parse({ schemaVersion: 2, kind: 'room', size: [7, 3, 6], walls: { sides: ['back', 'left', 'right'] }, openings, props });
const door = PropGeometrySchema.parse({ schemaVersion: 2, generator: 'door', params: { width: 0.95, height: 2.1 } });
const table = PropGeometrySchema.parse({ schemaVersion: 2, generator: 'table', params: { width: 1.3, depth: 0.85, height: 0.76 } });
const chair = PropGeometrySchema.parse({ schemaVersion: 2, generator: 'chair', params: { seatHeight: 0.47 } });

test('una puerta en una pared abre su propio hueco, con pasillo detrás; un hueco sin hoja se detecta', () => {
  const e = env();
  const placed = [{ id: 'puerta', geo: door, position: [3.47, 0, 1.2] as [number, number, number], yawDeg: -90, scale: 1 }];
  const ops = wallOpenings(e, placed);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].wall, 'right');
  // the right wall runs towards -z: a door at z = 1.2 is at offset -1.2
  assert.ok(Math.abs(ops[0].offset + 1.2) < 1e-9);
  const b = beyondOf(ops[0])!; assert.equal(b.kind, 'corridor');
  const [x0, , z0, z1] = beyondArea(e, ops[0], b);
  assert.ok(x0 > 3.5 && z0 >= -3 && z1 <= 3, 'el pasillo queda detrás de la pared y no sobresale del decorado');
  // a declared door hole on the wrong side (the old sign mistake) has no leaf in it
  const wrong = env([], [{ id: 'entrada', type: 'door', wall: 'right', offset: 1.2, width: 1, height: 2.1 }]);
  assert.deepEqual(doorsWithoutLeaf(wrong, placed), ['entrada']);
});

test('la ruta rodea una mesa y cruza la pared solo por la puerta', () => {
  const e = env();
  const placed = [{ id: 'puerta', geo: door, position: [3.47, 0, 1.2] as [number, number, number], yawDeg: -90, scale: 1 }, { id: 'mesa', geo: table, position: [0, 0, 0] as [number, number, number], yawDeg: 0, scale: 1 }];
  const rect = footprint(placed[1])!;
  const nav = buildNav(walkableAreas(e, wallOpenings(e, placed)), [rect], [], 0.2);
  const around = findPath(nav, [-1.6, 0], [1.6, 0])!;
  assert.ok(around.length > 2, 'no atraviesa la mesa en línea recta');
  for (let i = 1; i < around.length; i++) for (let k = 0; k <= 10; k++) { const x = around[i - 1][0] + (around[i][0] - around[i - 1][0]) * k / 10, z = around[i - 1][1] + (around[i][1] - around[i - 1][1]) * k / 10; assert.ok(rectDistance(rect, x, z) > 0.1, `pasa por dentro de la mesa en [${x.toFixed(2)}, ${z.toFixed(2)}]`); }
  const inside = findPath(nav, [4.6, 1.2], [0, 2])!;
  assert.ok(inside, 'hay ruta desde el pasillo');
  // wherever the route crosses the right wall (x = 3.5) it does so inside the door gap
  for (let i = 1; i < inside.length; i++) { const [a, b] = [inside[i - 1], inside[i]]; if ((a[0] - 3.5) * (b[0] - 3.5) < 0) { const u = (3.5 - a[0]) / (b[0] - a[0]), z = a[1] + (b[1] - a[1]) * u; assert.ok(Math.abs(z - 1.2) < 0.48, `cruza la pared fuera de la puerta (z = ${z.toFixed(2)})`); } }
});

test('sentarse a una mesa: se acerca por el lado libre de la silla y nadie atraviesa los muebles', async () => {
  const L = await loadLibrary();
  const ch = () => ({ geometry: CharacterGeometrySchema.parse({ schemaVersion: 2 }), rigOffsets: {}, clips: L.clips, locomotion: L.loco, expressions: L.expressions });
  const e = env([{ id: 'mesa', propId: 'mesa', position: [0, 0, 0], yawDeg: 0, scale: 1 }, { id: 'silla', propId: 'silla', position: [-0.62, 0, 0], yawDeg: 90, scale: 1 }]);
  const lib: AssetLibrary = { characters: { ana: ch() }, props: { mesa: withDefaults(table), silla: withDefaults(chair) }, environments: { casa: e } };
  const sc = SceneSchemaV2.parse({ schemaVersion: 2, id: 'sc-001', name: 'T', environmentId: 'casa', coverage: 'auto', actors: [{ id: 'ana', characterId: 'ana', position: [1.6, 0, 1.6], yawDeg: 0 }], actions: [{ type: 'sit', actor: 'ana', at: 0.5, prop: 'silla' }], dialogue: [] });
  const r = compileScene(sc, lib, {});
  assert.deepEqual(r.warnings.filter(w => w.startsWith('colision')), []);
  const a = r.actors[0], sit = a.sits[0];
  const stand = rootAt(a, sit.start).position;
  assert.ok(rectDistance(footprint({ id: 'mesa', geo: table, position: [0, 0, 0], yawDeg: 0, scale: 1 })!, stand[0], stand[2]) > 0.05, 'se coloca fuera de la mesa para sentarse');
  // the old layout (chair glued to the table) is reported by the collision QA, not silently accepted
  const tight = env([{ id: 'mesa', propId: 'mesa', position: [0, 0, 0], yawDeg: 0, scale: 1 }]);
  const lib2: AssetLibrary = { ...lib, environments: { casa: tight } };
  const sc2 = SceneSchemaV2.parse({ ...sc, actors: [{ id: 'ana', characterId: 'ana', position: [0.1, 0, 0.1], yawDeg: 0 }], actions: [] });
  assert.ok(compileScene(sc2, lib2, {}).warnings.some(w => w.startsWith('colision ana: atraviesa mesa')));
});
