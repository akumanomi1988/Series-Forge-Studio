// Automatic direction: dialogue coverage (180-degree rule, no jump cuts, no flash shots), automatic acting,
// effects that last "until" a cue, the procedural arranger and the music-aware pacing check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLibrary } from '../src/pipeline/project.ts';
import { CharacterGeometrySchema, SceneSchemaV2, MusicSchema } from '../src/engine/schema.ts';
import { compileScene } from '../src/engine/director.ts';
import { generateMusic, SR } from '../src/audio/synth.ts';
import { pacingReport } from '../src/pipeline/validate.ts';
import type { AssetLibrary, AudioCue } from '../src/engine/timeline.ts';

async function lib(): Promise<AssetLibrary> {
  const L = await loadLibrary();
  const ch = () => ({ geometry: CharacterGeometrySchema.parse({ schemaVersion: 2 }), rigOffsets: {}, clips: L.clips, locomotion: L.loco, expressions: L.expressions });
  return { characters: { vera: ch(), dani: ch() }, props: {}, environments: {} };
}
const speech = (ids: string[], d = 2.4) => Object.fromEntries(ids.map(id => [id, { duration: d, visemes: [] as [number, string][] }]));
const lines = [
  { id: 'l1', actor: 'vera', text: 'Las doce menos cinco. Llegas puntual otra vez, como cada noche.', emotion: 'smirk' },
  { id: 'l2', actor: 'dani', text: '¿Te has fijado en eso?', emotion: 'surprise' },
  { id: 'l3', actor: 'vera', text: 'Me fijo en todo lo que pasa en esta barra.', emotion: 'smirk' },
  { id: 'l4', actor: 'dani', text: 'No, no es lo que parece, vengo por la iluminación.', emotion: 'nervous' },
  { id: 'l5', actor: 'vera', text: 'Claro. ¿Y qué tal la iluminación esta noche?' },
  { id: 'l6', actor: 'dani', text: 'Sí, muy bien, perfecta.', emotion: 'joy' },
  { id: 'l7', actor: 'vera', text: 'Mira, te he preparado algo nuevo para que lo pruebes.', emotion: 'joy' }
];
const scene = (extra: Record<string, unknown> = {}) => SceneSchemaV2.parse({
  schemaVersion: 2, id: 'sc-001', name: 'T', environmentId: null, coverage: 'auto',
  actors: [{ id: 'vera', characterId: 'vera', position: [-0.8, 0, 0], yawDeg: 90 }, { id: 'dani', characterId: 'dani', position: [0.6, 0, 0.1], yawDeg: -90 }],
  dialogue: lines, ...extra
});

test('cobertura automática: plano desde t=0, sin destellos, sin saltos de eje ni jump cuts', async () => {
  const r = compileScene(scene(), await lib(), { speech: speech(lines.map(l => l.id)) });
  assert.ok(r.shots.length >= 5, `planos: ${r.shots.length}`);
  assert.equal(r.shots[0].start, 0);
  for (const s of r.shots.slice(0, -1)) assert.ok(s.end - s.start >= 0.7, `plano ${s.id} dura ${(s.end - s.start).toFixed(2)} s`);
  for (let i = 1; i < r.shots.length; i++) {
    const a = r.shots[i - 1].camera, b = r.shots[i].camera;
    assert.ok(!(a.subject && a.subject === b.subject && a.framing === b.framing && !a.over && !b.over), `jump cut entre ${r.shots[i - 1].id} y ${r.shots[i].id}`);
  }
  // 180-degree rule: every over-the-shoulder camera sits on the same side of the vera-dani line (+z, the audience side)
  const ots = r.shots.filter(s => s.camera.framing === 'over-shoulder');
  assert.ok(ots.length >= 1, 'hay contraplanos');
  for (const s of ots) {
    const over = s.camera.over === 'vera' ? [-0.8, 0] : [0.6, 0.1], subj = s.camera.subject === 'vera' ? [-0.8, 0] : [0.6, 0.1];
    const ax = subj[0] - over[0], az = subj[1] - over[1], len = Math.hypot(ax, az);
    const rz = (-ax / len) * (s.camera.side === 'left' ? -1 : 1); // z of camera.ts "right" vector
    assert.ok(rz > 0, `${s.id} cruza el eje`);
  }
  // cuts lead the voice slightly (J-cut) and never come after it
  const l3 = r.actors.find(a => a.id === 'vera')!.speech.find(x => x.lineId === 'l3')!;
  const cut = r.shots.find(s => s.id === 'auto-l3');
  if (cut) assert.ok(cut.start <= l3.start && l3.start - cut.start < 0.3);
});

test('cobertura automática: los planos escritos son insertos y la cobertura se reanuda después', async () => {
  const sc = scene({ shots: [{ id: 'inserto', with: 'l3', offset: 0.5, durationSec: 1.5, camera: { type: 'static', position: [0, 1.5, 3], target: [0, 1, 0] } }] });
  const r = compileScene(sc, await lib(), { speech: speech(lines.map(l => l.id)) });
  const ins = r.shots.find(s => s.id === 'inserto')!;
  assert.ok(ins, 'el inserto existe');
  assert.ok(ins.end - ins.start >= 1.5 - 1e-6 && ins.end - ins.start < 2.2, 'dura lo pedido (o absorbe un resto de menos de 0,7 s)');
  const after = r.shots[r.shots.indexOf(ins) + 1];
  assert.ok(after && after.camera.type === 'framing', 'tras el inserto vuelve la cobertura');
  assert.throws(() => SceneSchemaV2.parse({ ...sc, coverage: 'manual', shots: [] }), /al menos un plano/);
});

test('actuación automática: gestos según texto y emoción, nunca encima de un gesto escrito; 0 la apaga', async () => {
  const L = await lib();
  const withGesture = lines.map(l => l.id === 'l7' ? { ...l, gesture: 'wave' } : l);
  const r = compileScene(scene({ dialogue: withGesture }), L, { speech: speech(lines.map(l => l.id)) });
  const auto = r.actors.flatMap(a => a.clips.filter(c => c.source?.startsWith('auto:')).map(c => ({ actor: a.id, ...c })));
  const has = (actor: string, clip: string) => auto.some(c => c.actor === actor && c.clip === clip);
  assert.ok(has('dani', 'headshake'), 'un «No, no…» niega con la cabeza');
  assert.ok(has('dani', 'nod'), 'un «Sí…» asiente');
  assert.ok(auto.every(c => c.weight > 0 && c.weight <= 1));
  const vera = r.actors.find(a => a.id === 'vera')!, l7 = vera.speech.find(s => s.lineId === 'l7')!;
  assert.ok(!auto.some(c => c.actor === 'vera' && c.start < l7.end && c.end > l7.start + 0.2), 'no tapa el gesto escrito');
  const off = compileScene(scene({ autoActing: 0 }), L, { speech: speech(lines.map(l => l.id)) });
  assert.equal(off.actors.flatMap(a => a.clips).filter(c => c.source?.startsWith('auto:')).length, 0);
});

test('efecto con until: el apagón dura hasta la acción indicada', async () => {
  const sc = scene({ actions: [
    { id: 'apagon', type: 'effect', effect: 'off', at: 1, until: 'vuelve' },
    { id: 'vuelve', type: 'effect', effect: 'flicker', after: 'l4', offset: 0.5, durationSec: 0.3, prop: undefined }
  ] });
  const r = compileScene(sc, await lib(), { speech: speech(lines.map(l => l.id)) });
  const ap = r.effects.find(e => e.effect === 'off')!, fl = r.effects.find(e => e.effect === 'flicker')!;
  assert.equal(ap.start, 1);
  assert.ok(Math.abs(ap.end - fl.start) < 1e-9, `${ap.end} vs ${fl.start}`);
  assert.ok(r.durationSec < 60, 'un apagón largo no estira la escena');
});

test('arreglista: estilos deterministas, sin NaN, cortinilla y remate con su duración', () => {
  const base = { schemaVersion: 2, id: 'x', kind: 'music' };
  const lounge = MusicSchema.parse({ ...base, style: 'lounge', tempo: 96, key: 'F', mode: 'dorian', sevenths: true, swing: 0.3, instruments: ['keys', 'bass', 'brushes', 'snaps', 'lead'] });
  const [a] = generateMusic(lounge, 6), [b] = generateMusic(lounge, 6);
  assert.deepEqual(a.slice(0, 5000), b.slice(0, 5000));
  let e = 0, bad = 0; for (const v of a) { if (!Number.isFinite(v)) bad++; e += v * v; }
  assert.equal(bad, 0); assert.ok(e / a.length > 1e-4, 'suena');
  for (const form of ['sting', 'button'] as const) {
    const d = MusicSchema.parse({ ...base, style: 'sitcom', form, durationSec: 2, tempo: 120, instruments: ['keys', 'bass', 'drums', 'lead'] });
    const [x] = generateMusic(d);
    assert.equal(x.length, 2 * SR);
    let tail = 0; for (let i = x.length - 200; i < x.length; i++) tail = Math.max(tail, Math.abs(x[i]));
    assert.ok(tail < 0.02, `${form}: termina en silencio (${tail.toFixed(3)})`);
  }
  // the legacy ambient arrangement is untouched
  const legacy = MusicSchema.parse({ ...base, instruments: ['pad', 'bass', 'arp', 'bell'] });
  assert.equal(legacy.style, 'ambient');
});

test('ritmo: un hueco cubierto por música en primer plano (cortinilla) no es tiempo muerto', () => {
  const cue = (start: number, duration: number, extra: Partial<AudioCue> = {}): AudioCue => ({ id: `c${start}`, kind: 'dialogue', sound: 'x', start, duration, gainDb: 0, fadeIn: 0, fadeOut: 0, pan: 0, duck: false, ...extra });
  const scenes = [{ id: 'sc-001', name: '', start: 0, duration: 30, frame0: 0, frames: 720, resolvedFile: '', hash: '', warnings: [] }];
  const plan = { durationSec: 25, scenes, audio: [cue(0, 5), cue(9, 5), cue(18, 5)] };
  assert.equal(pacingReport(plan).deadAir.length, 2);
  plan.audio.push(cue(4.8, 4.4, { kind: 'music', feature: true, duck: true }));
  const r = pacingReport(plan);
  assert.equal(r.deadAir.length, 1, 'el primer hueco tiene cortinilla');
  assert.equal(r.deadAir[0].from, 14);
});
