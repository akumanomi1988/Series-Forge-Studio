import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tempWorkspace } from './helpers.ts';

const ws = tempWorkspace();
const { loadProject, safeJoin, assetLibrary } = await import('../src/pipeline/project.ts');
const { editablePath, schemaFor } = await import('../src/server/studio-server.ts');
const { scaffold } = await import('../src/pipeline/scaffold.ts');
const { compileScene } = await import('../src/engine/director.ts');

test('el piloto carga sin errores y hereda la biblioteca de animaciones/expresiones', async () => {
  const p = await loadProject('el-ultimo-turno');
  assert.deepEqual(p.issues.filter(i => i.level === 'error'), []);
  assert.ok(p.characters.bruno.clips.walk === undefined && p.characters.bruno.locomotion.walk, 'walk es locomoción paramétrica');
  for (const c of ['idle', 'point', 'pick-up', 'hold-object', 'jump', 'crouch', 'wave']) assert.ok(p.characters.lara.clips[c], c);
  for (const e of ['neutral', 'joy', 'smile', 'laugh', 'sad', 'angry', 'fear', 'surprise', 'nervous', 'thinking']) assert.ok(p.characters.bruno.expressions[e], e);
  assert.ok(p.props['robot-r7'].geometry.joints.head && p.props['fusible-nucleo'].geometry.anchors.grip, 'anclajes/articulaciones por defecto del generador');
});

test('un agente crea un personaje escribiendo solo archivos y una animación propia hereda/sobrescribe', async () => {
  await scaffold('character', ['el-ultimo-turno', 'nico', 'Nico'], 'lara');
  const geo = JSON.parse(readFileSync(join(ws, 'el-ultimo-turno/characters/nico/geometry.json'), 'utf8'));
  geo.hair.style = 'curly'; geo.body.height = 1.5; geo.outfit.top.type = 'hoodie';
  writeFileSync(join(ws, 'el-ultimo-turno/characters/nico/geometry.json'), JSON.stringify(geo));
  mkdirSync(join(ws, 'el-ultimo-turno/characters/nico/animations'), { recursive: true });
  writeFileSync(join(ws, 'el-ultimo-turno/characters/nico/animations/wave.json'), JSON.stringify({ schemaVersion: 2, id: 'wave', duration: 1, layer: 'arms', tracks: [{ bone: 'leftUpperArm', property: 'rotation', keys: [{ t: 0, v: [0, 0, 0] }, { t: 1, v: [0, 0, 150] }] }] }));
  writeFileSync(join(ws, 'el-ultimo-turno/characters/nico/animations/baile.json'), JSON.stringify({ schemaVersion: 2, id: 'baile', duration: 2, loop: true, tracks: [{ bone: 'hips', property: 'position', keys: [{ t: 0, v: [0, 0, 0] }, { t: 1, v: [0, -0.1, 0] }, { t: 2, v: [0, 0, 0] }] }] }));
  const p = await loadProject('el-ultimo-turno');
  assert.equal(p.characters.nico.name, 'Nico');
  assert.equal(p.characters.nico.geometry.hair.style, 'curly');
  assert.equal(p.characters.nico.clips.wave.tracks[0].bone, 'leftUpperArm', 'override por personaje');
  assert.ok(p.characters.nico.clips.baile, 'animación nueva sin tocar el motor');
  assert.equal(p.characters.lara.clips.wave.tracks[0].bone, 'rightUpperArm', 'los demás conservan la de biblioteca');
});

test('validación estricta con mensajes claros y rutas no permitidas', async () => {
  const planta = readFileSync(join(ws, 'el-ultimo-turno/props/planta/geometry.json'), 'utf8'), barril = readFileSync(join(ws, 'el-ultimo-turno/props/barril/geometry.json'), 'utf8');
  writeFileSync(join(ws, 'el-ultimo-turno/props/planta/geometry.json'), JSON.stringify({ schemaVersion: 2, generator: 'plant', colour: 'verde' }));
  writeFileSync(join(ws, 'el-ultimo-turno/props/barril/geometry.json'), '{ "schemaVersion": 2, ');
  const p = await loadProject('el-ultimo-turno');
  assert.ok(p.issues.some(i => i.path === 'props/planta/geometry.json' && /colour/.test(i.message)));
  assert.ok(p.issues.some(i => i.path === 'props/barril/geometry.json' && /JSON inválido/.test(i.message)));
  await assert.rejects(safeJoin(join(ws, 'el-ultimo-turno'), '../../etc/passwd'), /fuera del proyecto/);
  assert.equal(editablePath('../package.json'), false);
  assert.equal(editablePath('characters/bruno/../../x.json'), false);
  assert.equal(editablePath('episodes/ep-001/output/episodio.mp4'), false);
  assert.equal(editablePath('characters/bruno/geometry.json'), true);
  assert.throws(() => schemaFor('characters/bruno/geometry.json')!.parse({ schemaVersion: 2, body: { height: 99 } }));
  writeFileSync(join(ws, 'el-ultimo-turno/props/planta/geometry.json'), planta); writeFileSync(join(ws, 'el-ultimo-turno/props/barril/geometry.json'), barril);
});

test('los enlaces simbólicos dentro del proyecto se rechazan', async t => {
  try { symlinkSync(ws, join(ws, 'el-ultimo-turno', 'atajo'), 'junction'); } catch { t.skip('sin permisos para crear enlaces'); return; }
  await assert.rejects(safeJoin(join(ws, 'el-ultimo-turno'), 'atajo/el-ultimo-turno/project.json'), /simbólicos/);
});

test('migración en memoria de assets v1 (v0.2–v0.4) sin borrar el original', async () => {
  const dir = join(ws, 'legado/characters/viejo'); mkdirSync(join(dir, 'animations'), { recursive: true });
  writeFileSync(join(ws, 'legado/universe.json'), JSON.stringify({ schemaVersion: 1, name: 'Legado' }));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ schemaVersion: 1, id: 'viejo', name: 'Viejo' }));
  const v1 = { schemaVersion: 1, parts: [{ id: 'body', color: '#112233' }, { id: 'face', color: '#c08060' }] };
  writeFileSync(join(dir, 'geometry.json'), JSON.stringify(v1));
  writeFileSync(join(dir, 'animations/saludo.json'), JSON.stringify({ schemaVersion: 1, duration: 1, tracks: [{ target: 'leftUpperArm.rotation.z', keys: [[0, 0], [1, 90]] }] }));
  const p = await loadProject('legado');
  assert.equal(p.characters.viejo.geometry.outfit.top.color, '#112233');
  assert.equal((p.characters.viejo.clips.saludo.tracks[0].keys[1].v as number[])[2], 90);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'geometry.json'), 'utf8')), v1, 'el archivo v1 no se modifica');
});

test('el piloto compila con duración estimada antes de sintetizar voces', async () => {
  const p = await loadProject('el-ultimo-turno');
  const ep = p.episodes['ep-001'];
  const r = compileScene(ep.scenes['sc-001'], assetLibrary(p));
  assert.ok(r.durationSec > 10 && r.shots.length >= 6 && r.subtitles.length >= 4);
  assert.ok(r.audio.some(a => a.sound === 'door-creak') && r.audio.some(a => a.sound === 'sparks') && r.audio.some(a => a.sound === 'footstep'));
});

test('studio migrate reescribe un proyecto v0.2–v0.4 a v2 conservando copias .v1.json', async () => {
  // @ts-expect-error legacy v0.2 JavaScript module without type declarations
  const { FileWorkspace } = await import('../src/workspace.mjs');
  const fw = await new FileWorkspace(ws).init();
  const { project } = await fw.createProject('Antiguo Demo');
  const c = await fw.createAsset(project, 'characters', 'Bruno');
  const ep = await fw.createAsset(project, 'episodes', 'Piloto');
  const sc = await fw.createScene(project, ep.id, 'Avería');
  const path = `episodes/${ep.id}/scenes/${sc.id}/scene.json`;
  const scene = JSON.parse((await fw.read(project, path)).content);
  scene.actors = [{ characterId: c.id, position: [0, 0, 0], yawDeg: 0 }];
  scene.beats = [{ id: 'hola', type: 'dialogue', actorId: c.id, text: 'Hola.', startSec: 1, endSec: 2 }, { id: 'mov', type: 'action', actorId: c.id, startSec: 2, endSec: 4, fromPosition: [0, 0, 0], toPosition: [1, 0, 1], yawDeg: 45 }];
  await fw.put(project, path, JSON.stringify(scene));
  const { migrateProject } = await import('../src/pipeline/migrate.ts');
  const r = await migrateProject(project);
  assert.ok(r.written.length >= 5);
  const p = await loadProject(project);
  assert.deepEqual(p.issues.filter(i => i.level === 'error'), []);
  assert.equal(p.episodes[ep.id].scenes[sc.id].dialogue[0].text, 'Hola.');
  assert.ok(readFileSync(join(ws, project, 'characters', c.id, 'geometry.v1.json'), 'utf8').includes('"schemaVersion": 1'));
});

test('exporta la geometría compilada a GLB con esqueleto y mallas con skinning', async () => {
  const { exportGlb } = await import('../src/pipeline/gltf.ts');
  const r = await exportGlb('el-ultimo-turno', 'character', 'lara');
  assert.ok(r.bytes > 100_000);
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const b = readFileSync(r.file);
  const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length) as ArrayBuffer, '');
  let skinned = 0; const bones = new Set<string>();
  gltf.scene.traverse(o => { const s = o as unknown as { isSkinnedMesh?: boolean; skeleton: { bones: { name: string }[] } }; if (s.isSkinnedMesh) { skinned++; s.skeleton.bones.forEach(x => bones.add(x.name)); } });
  assert.ok(skinned >= 6 && bones.has('leftUpperArm') && bones.has('head'));
});
