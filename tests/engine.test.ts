import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadLibrary } from '../src/pipeline/project.ts';
import { CharacterGeometrySchema, PropGeometrySchema, SceneSchemaV2 } from '../src/engine/schema.ts';
import { compileScene } from '../src/engine/director.ts';
import { SceneEvaluator, solveTwoBone, RigInstance, jointLimitViolations, footAt } from '../src/engine/pose.ts';
import { sampleKeys } from '../src/engine/clip.ts';
import { blinkAmount, visemeAt } from '../src/engine/face.ts';
import type { AssetLibrary } from '../src/engine/timeline.ts';

async function lib(): Promise<AssetLibrary> {
  const L = await loadLibrary();
  const geo = CharacterGeometrySchema.parse({ schemaVersion: 2 });
  const tall = CharacterGeometrySchema.parse({ schemaVersion: 2, body: { height: 1.9, legScale: 1.1 } });
  const ch = (g: typeof geo) => ({ geometry: g, rigOffsets: {}, clips: L.clips, locomotion: L.loco, expressions: L.expressions });
  return {
    characters: { bruno: ch(geo), lara: ch(tall) },
    props: { pieza: PropGeometrySchema.parse({ schemaVersion: 2, generator: 'component', anchors: { grip: { position: [0, 0.03, 0] } }, restHeight: 0.025 }),
      silla: PropGeometrySchema.parse({ schemaVersion: 2, generator: 'chair', anchors: { seat: { position: [0, 0.46, 0] } } }) },
    environments: {}
  };
}
const baseScene = (extra: Record<string, unknown>) => SceneSchemaV2.parse({ schemaVersion: 2, id: 'sc-001', name: 'Test', environmentId: null, shots: [{ id: 'a', camera: { type: 'static', position: [0, 1.6, 6], target: [0, 1, 0] } }], ...extra });

test('interpolación spline/ease es determinista y pasa por las claves', () => {
  const keys = [{ t: 0, v: [0, 0, 0] }, { t: 1, v: [10, 0, 0] }, { t: 2, v: [0, 5, 0] }];
  assert.deepEqual(sampleKeys(keys, 1), [10, 0, 0]);
  assert.equal(sampleKeys(keys, 0.5)[0], sampleKeys(keys, 0.5)[0]);
  assert.ok(sampleKeys([{ t: 0, v: 0 }, { t: 1, v: 1, ease: 'step' }], 0.99)[0] === 0);
});

test('IK de dos huesos alcanza el objetivo dentro de 1 mm', () => {
  const rig = new RigInstance(CharacterGeometrySchema.parse({ schemaVersion: 2 }));
  rig.group.updateMatrixWorld(true);
  const target = new THREE.Vector3(-0.3, 1.0, 0.35);
  solveTwoBone(rig.bone('rightUpperArm'), rig.bone('rightLowerArm'), rig.bone('rightHand'), target, new THREE.Vector3(-1, 0.5, -1), -1);
  rig.group.updateMatrixWorld(true);
  assert.ok(rig.worldPos('rightHand').distanceTo(target) < 0.001, `distancia ${rig.worldPos('rightHand').distanceTo(target)}`);
  const knee = new THREE.Vector3(0.1, 0.3, 0.3);
  solveTwoBone(rig.bone('leftThigh'), rig.bone('leftShin'), rig.bone('leftFoot'), knee, new THREE.Vector3(0.1, 0.6, 2), 1);
  rig.group.updateMatrixWorld(true);
  assert.ok(rig.worldPos('leftFoot').distanceTo(knee) < 0.001);
  assert.ok(rig.worldPos('leftShin').z > 0.1, 'la rodilla se dobla hacia delante');
});

test('caminar: los pies apoyados no deslizan y nunca atraviesan el suelo', async () => {
  const L = await lib();
  const sc = compileScene(baseScene({ actors: [{ id: 'bruno', characterId: 'bruno', position: [-2, 0, 0], yawDeg: 90 }], actions: [{ type: 'walk', actor: 'bruno', at: 0.5, to: [2, 0, 0.5] }] }), L);
  const ev = new SceneEvaluator(sc, L);
  const rig = ev.rigs.get('bruno')!;
  let prev: Record<string, THREE.Vector3> = {};
  let maxSlide = 0, minY = Infinity;
  for (let f = 0; f <= sc.durationSec * 60; f++) {
    const t = f / 60; ev.evaluate(t);
    for (const side of ['left', 'right'] as const) {
      const p = rig.worldPos(`${side}Foot`);
      minY = Math.min(minY, p.y);
      const st = footAt(sc.actors[0], side, t, rig.dims);
      if (st.swing < 0 && prev[side]) maxSlide = Math.max(maxSlide, Math.hypot(p.x - prev[side].x, p.z - prev[side].z));
      prev[side] = p;
    }
    assert.deepEqual(jointLimitViolations(rig, 6), [], `límites articulares en t=${t}`);
  }
  assert.ok(maxSlide < 0.004, `deslizamiento de pie apoyado ${maxSlide}`);
  assert.ok(minY > rig.dims.ankleH - 0.01, `tobillo bajo el suelo ${minY}`);
  ev.evaluate(sc.durationSec);
  assert.ok(Math.abs(rig.group.position.x - 2) < 1e-6 && Math.abs(rig.group.position.z - 0.5) < 1e-6);
});

test('estado en t es independiente del orden de evaluación (determinismo absoluto)', async () => {
  const L = await lib();
  const sc = compileScene(baseScene({ actors: [{ id: 'bruno', characterId: 'bruno', position: [0, 0, 0] }, { id: 'lara', characterId: 'lara', position: [1.5, 0, 0], yawDeg: -90 }], actions: [{ type: 'turn', actor: 'bruno', at: 0.2, yawDeg: 35 }, { type: 'lookAt', actor: 'bruno', at: 0.5, target: 'lara' }, { type: 'play', actor: 'lara', at: 1, clip: 'shrug' }] }), L);
  const snap = (ev: SceneEvaluator) => JSON.stringify([...ev.rigs.values()].map(r => [...r.bones.values()].map(b => b.quaternion.toArray().map(x => x.toFixed(6)))));
  const a = new SceneEvaluator(sc, L); a.evaluate(2.25); const s1 = snap(a);
  const b = new SceneEvaluator(sc, L); for (const t of [3, 0.1, 1.7, 2.9]) b.evaluate(t); b.evaluate(2.25);
  assert.equal(snap(b), s1);
});

test('giro de 35° con cabeza +20° y mirada hacia otro personaje', async () => {
  const L = await lib();
  const sc = compileScene(baseScene({ actors: [{ id: 'bruno', characterId: 'bruno', position: [0, 0, 0] }, { id: 'lara', characterId: 'lara', position: [2, 0, 2], yawDeg: -135 }], actions: [{ type: 'turn', actor: 'bruno', at: 0, yawDeg: 35 }, { type: 'lookAt', actor: 'bruno', at: 1.5, target: 'lara' }] }), L);
  const ev = new SceneEvaluator(sc, L); ev.evaluate(3);
  const rig = ev.rigs.get('bruno')!;
  assert.ok(Math.abs(rig.group.rotation.y * 180 / Math.PI - 35) < 0.01);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.bone('head').getWorldQuaternion(new THREE.Quaternion()));
  const yaw = Math.atan2(fwd.x, fwd.z) * 180 / Math.PI;
  assert.ok(yaw > 38 && yaw < 52, `la cabeza mira a Lara (45°): ${yaw}`);
});

test('recoger un objeto: la mano llega al agarre y luego lo sostiene; soltarlo cae al suelo', async () => {
  const L = await lib();
  const sc = compileScene(baseScene({ actors: [{ id: 'bruno', characterId: 'bruno', position: [0, 0, 0] }], props: [{ id: 'pieza', propId: 'pieza', position: [0.15, 0, 0.45] }], actions: [{ id: 'coge', type: 'pickUp', actor: 'bruno', at: 0.5, prop: 'pieza' }, { id: 'esconde', type: 'hold', actor: 'bruno', after: 'coge', pose: 'behind' }, { id: 'suelta', type: 'drop', actor: 'bruno', after: 'esconde', offset: 0.3, prop: 'pieza' }] }), L);
  const ev = new SceneEvaluator(sc, L);
  const grabT = 0.5 + 0.45 * 1.6;
  ev.evaluate(grabT);
  const palm = ev.rigs.get('bruno')!.worldPos('rightHand');
  const grip = new THREE.Vector3(0.15, 0.03, 0.45);
  assert.ok(palm.distanceTo(grip) < 0.13, `mano a ${palm.distanceTo(grip).toFixed(3)} m del agarre`);
  ev.evaluate(2.6);
  const held = new THREE.Vector3().setFromMatrixPosition(ev.propWorld('pieza')!.matrix);
  assert.ok(held.distanceTo(ev.rigs.get('bruno')!.worldPos('rightHand')) < 0.15, 'el objeto sigue a la mano');
  ev.evaluate(sc.durationSec);
  const rest = new THREE.Vector3().setFromMatrixPosition(ev.propWorld('pieza')!.matrix);
  assert.ok(Math.abs(rest.y - 0.025) < 1e-6, 'reposa en el suelo');
  assert.ok(sc.audio.some(a => a.sound === 'impact-metal'), 'genera foley de impacto');
});

test('lip-sync: visemas con coarticulación y parpadeo determinista', () => {
  const v = [[0, 'MBP'], [0.1, 'A'], [0.25, 'S'], [0.4, 'sil']] as [number, string][];
  assert.ok(visemeAt(v, 0.17).open > 0.7);
  assert.ok(visemeAt(v, 0.02).press > 0.5);
  assert.equal(blinkAmount('x', 12.34), blinkAmount('x', 12.34));
  let blinks = 0; for (let t = 0; t < 60; t += 0.02) if (blinkAmount('bruno', t) > 0.9) blinks++;
  assert.ok(blinks > 10 && blinks < 200, `parpadeos ${blinks}`);
});

test('timing relativo after/with y escena de duración automática', async () => {
  const L = await lib();
  const sc = compileScene(baseScene({ actors: [{ id: 'bruno', characterId: 'bruno', position: [0, 0, 0] }, { id: 'lara', characterId: 'lara', position: [3, 0, 0] }],
    dialogue: [{ id: 'd1', actor: 'bruno', text: 'Hola Lara.' }, { id: 'd2', actor: 'lara', text: '¿Qué has roto esta vez?', emotion: 'enfado' }],
    actions: [{ id: 'w', type: 'walk', actor: 'lara', after: 'd1', to: { actor: 'bruno', distance: 1 } }] }), L, { speech: { d1: { duration: 1.2, visemes: [] }, d2: { duration: 2, visemes: [] } } });
  const d1 = sc.audio.find(a => a.id === 'd1')!, d2 = sc.audio.find(a => a.id === 'd2')!;
  assert.equal(d1.start, 0.6); assert.ok(Math.abs(d2.start - (0.6 + 1.2 + 0.34)) < 1e-9, 'pausa de turno: 0,34 s cuando contesta otro personaje');
  const lara = sc.actors.find(a => a.id === 'lara')!;
  assert.ok(lara.root.some(s => (s.kind === 'walk' || s.kind === 'turn') && Math.abs(s.start - 1.8) < 0.01));
  assert.ok(lara.root.some(s => s.kind === 'walk'));
  assert.ok(lara.expressions.some(e => e.expression === 'angry'));
  assert.ok(sc.actors[0].looks.some(l => l.source === 'auto'), 'mirada automática entre personajes');
});
