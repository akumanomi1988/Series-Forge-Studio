// Writes the "muestrario" episode (action showcase / visual regression scene) into the example project.
import fs from 'node:fs'; import path from 'node:path';
const P = process.argv[2] ?? 'examples/projects/el-ultimo-turno';
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(P, f)), { recursive: true }); fs.writeFileSync(path.join(P, f), JSON.stringify(o, null, 2) + '\n'); };
w('props/taza/manifest.json', { schemaVersion: 2, id: 'taza', type: 'prop', name: 'Taza de café' });
w('props/taza/geometry.json', { schemaVersion: 2, generator: 'mug', params: { color: '#e8e3d8' }, material: 'glass', restHeight: 0.05, params2: undefined });
const g = JSON.parse(fs.readFileSync(path.join(P, 'props/taza/geometry.json'), 'utf8')); delete g.params2; fs.writeFileSync(path.join(P, 'props/taza/geometry.json'), JSON.stringify(g, null, 2) + '\n');
w('episodes/muestrario/episode.json', { schemaVersion: 2, id: 'muestrario', type: 'episode', name: 'Muestrario de acciones', number: 0, scenes: ['sc-001'], music: [], render: { width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }, status: 'draft' });
w('episodes/muestrario/story.json', { schemaVersion: 1, status: 'draft', facts: [], knowledge: [], relationships: [], emotionalStates: {}, events: [] });
w('episodes/muestrario/scenes/sc-001/scene.json', {
  schemaVersion: 2, id: 'sc-001', name: 'Acciones', environmentId: 'taller', durationSec: 'auto', tailSec: 1, autoLook: true,
  actors: [{ id: 'bruno', characterId: 'bruno', position: [1.0, 0, 0.6], yawDeg: -90, expression: 'smile' }, { id: 'lara', characterId: 'lara', position: [-2.4, 0, 1.2], yawDeg: 90, expression: 'neutral' }],
  props: [{ id: 'taza', propId: 'taza', heldBy: { actor: 'bruno', hand: 'right' } }],
  actions: [
    { id: 'ofrece', type: 'hold', actor: 'bruno', at: 0, hand: 'right', pose: 'front', durationSec: 0.5 },
    { id: 'saluda', type: 'play', actor: 'lara', at: 0.3, clip: 'wave' },
    { id: 'corre', type: 'walk', actor: 'lara', after: 'saluda', to: [-0.2, 0, 1.0], gait: 'run' },
    { id: 'da', type: 'give', actor: 'bruno', after: 'corre', offset: 0.2, prop: 'taza', to: 'lara' },
    { id: 'salta', type: 'play', actor: 'bruno', after: 'da', offset: 0.2, clip: 'jump' },
    { id: 'senala', type: 'play', actor: 'lara', after: 'da', offset: 0.4, clip: 'point', target: 'consola', durationSec: 1.8 },
    { id: 'va-taburete', type: 'walk', actor: 'bruno', after: 'salta', to: [2.6, 0, -1.25] },
    { id: 'sienta', type: 'sit', actor: 'bruno', after: 'va-taburete', prop: 'taburete' },
    { id: 'piensa', type: 'play', actor: 'lara', after: 'senala', clip: 'think', durationSec: 2 },
    { id: 'levanta', type: 'stand', actor: 'bruno', after: 'sienta', offset: 1.5 }
  ],
  dialogue: [],
  shots: [{ id: 'sh-01', at: 0, camera: { type: 'static', position: [0.6, 2.4, 6.2], target: [0.2, 0.9, -0.2], fov: 46 } }],
  sound: [{ id: 'amb', kind: 'ambience', sound: 'workshop-ambience', at: 0, gainDb: -24 }]
});
console.log('showcase ok');
