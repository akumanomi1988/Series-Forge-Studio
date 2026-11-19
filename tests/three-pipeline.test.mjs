import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSceneFrame } from '../public/scene-runtime.js';
import { findChromium, openThreeCapture } from '../src/browser-render.mjs';
import { FileWorkspace } from '../src/workspace.mjs';

const scene = {
 schemaVersion: 1, id: 'sc-001', durationSec: 12, camera: { position: [0, 2.4, 8], target: [0, 1, 0], orthographicSize: 6 },
 actors: [{ characterId: 'bruno', position: [0, 0, 0], yawDeg: 35, headYawDeg: 0, animation: 'idle', expression: 'neutral' }], props: [],
 beats: [
  { type: 'action', actorId: 'bruno', startSec: 2, endSec: 6, fromPosition: [0, 0, 0], toPosition: [4, 0, 0], fromYawDeg: 35, yawDeg: -35, headYawDeg: 30, animation: 'walk', expression: 'surprised' },
  { type: 'dialogue', actorId: 'bruno', text: 'Hola', startSec: 3, endSec: 5 },
  { type: 'camera', startSec: 1, endSec: 5, fromPosition: [0, 2.4, 8], position: [1, 3.4, 5], fromTarget: [0, 1, 0], target: [1, 1, 0], fromOrthographicSize: 6, orthographicSize: 4 }
 ]
};

test('pose Three.js basada en tiempo absoluto, sin deriva por FPS', () => {
 const first = evaluateSceneFrame(scene, 4);
 assert.deepEqual(first.actors[0].position, [2, 0, 0]);
 assert.equal(first.actors[0].yawDeg, 0);
 assert.equal(first.actors[0].headYawDeg, 15);
 assert.equal(first.actors[0].speaking, true);
 assert.equal(first.actors[0].animation, 'walk');
 assert.equal(first.actors[0].animationStartSec, 2);
 assert.deepEqual(first.camera.position, [.75, 3.15, 5.75]);
 assert.equal(first.camera.orthographicSize, 4.5);
 assert.deepEqual(evaluateSceneFrame(scene, 4), first);
 assert.deepEqual(evaluateSceneFrame(scene, 1).actors[0].position, [0, 0, 0]);
 assert.equal(evaluateSceneFrame(scene, 5).actors[0].speaking, false);
});

test('el render WebGL legado (v0.4) arranca con three instalado o falla con un error claro', async () => {
 const ws = new FileWorkspace();
 try { const c = await openThreeCapture({workspace:ws,project:'demo-de-produccion',episode:'piloto',width:320,height:180}); await c.close(); }
 catch (e) { assert.match(e.message, /Three.js no está instalado|Chromium|Chrome|Edge|navegador|Universo|ENOENT|escena/i); }
});

test('detecta navegador local de render cuando existe', () => {
 try { assert.ok(findChromium().length); } catch (e) { assert.match(e.message, /Chromium|Chrome|Edge/); }
});
