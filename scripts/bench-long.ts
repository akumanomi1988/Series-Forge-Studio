/** Writes a technical long-form episode (default 20 scenes x 60 s = 20 min) into an existing project, reusing its
 * characters/environment/props. It is a STABILITY/SCALE test, not a narrative-quality episode.
 *   node scripts/bench-long.ts <project> [minutes=20] [episodeId=ep-larga] */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectDir } from '../src/pipeline/project.ts';
import { mulberry32 } from '../src/engine/math.ts';

const [project = 'el-ultimo-turno', minutesArg = '20', episode = 'ep-larga'] = process.argv.slice(2);
const minutes = Number(minutesArg), sceneSec = 60, nScenes = Math.round(minutes * 60 / sceneSec);
const root = join(projectDir(project), 'episodes', episode);
const rnd = mulberry32(2026);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const SUJ = ['El robot', 'El cliente', 'La inspectora', 'El generador', 'Este fusible', 'La consola', 'El turno de noche', 'Tu idea', 'El presupuesto', 'La puerta del almacén'];
const VERB = ['no aguanta más', 'vuelve a fallar', 'necesita una revisión completa', 'llegará antes de lo previsto', 'está mejor de lo que parece', 'nos va a dar problemas', 'funciona solo cuando nadie mira', 'hace un ruido extraño', 'tiene arreglo', 'no es asunto tuyo'];
const COLA = ['otra vez.', 'esta noche.', 'antes de las ocho.', 'te lo aseguro.', 'y lo sabes.', 'si tenemos suerte.', 'según el manual.', 'como siempre.', 'aunque no lo creas.', 'de momento.'];
const REPL = ['¿Estás seguro?', 'Eso ya lo veremos.', 'No me lo creo.', 'Vale, vale. Tranquila.', 'Déjame comprobarlo.', 'Tenemos que hablar de eso.', '¿Y ahora qué?', 'Lo arreglaré, ya verás.', 'Siempre igual contigo.', 'Por fin una buena noticia.'];
const EMO = ['neutral', 'worried', 'angry', 'nervous', 'smile', 'thinking', 'surprise', 'sad', 'joy', 'smirk', 'determined'];
const GEST = ['explain', 'point', 'shrug', 'dismiss', 'present', 'nod', 'headshake', 'think', undefined, undefined];
const SPOTS: [number, number][] = [[-2.2, 0.6], [-1.2, 1.4], [0.9, 0.9], [1.6, -0.4], [-0.6, -0.4], [2.4, 1.6], [-2.8, -1.0], [0.2, 1.8]];
const FRAMING = [{ framing: 'two-shot' }, { framing: 'medium-close', subject: 'bruno' }, { framing: 'medium-close', subject: 'lara' }, { framing: 'close', subject: 'lara' }, { framing: 'close', subject: 'bruno' }, { framing: 'over-shoulder', over: 'lara', subject: 'bruno' }, { framing: 'over-shoulder', over: 'bruno', subject: 'lara' }, { framing: 'full', subject: 'lara', track: true }, { framing: 'wide', subject: 'bruno' }];

const scenes: string[] = [];
for (let s = 1; s <= nScenes; s++) {
  const id = `sc-${String(s).padStart(3, '0')}`; scenes.push(id);
  const bp = pick(SPOTS), lp = SPOTS.filter(x => x !== bp)[Math.floor(rnd() * (SPOTS.length - 1))];
  const dialogue: Record<string, unknown>[] = []; const actions: Record<string, unknown>[] = []; const shots: Record<string, unknown>[] = [];
  const nLines = 8;
  for (let i = 0; i < nLines; i++) {
    const actor = i % 2 ? 'lara' : 'bruno';
    const text = i % 3 === 2 ? pick(REPL) : `${pick(SUJ)} ${pick(VERB)} ${pick(COLA)}`;
    dialogue.push({ id: `l${i + 1}`, actor, text, emotion: pick(EMO), gesture: pick(GEST), to: actor === 'bruno' ? 'lara' : 'bruno', pauseAfter: +(0.4 + rnd() * 1.2).toFixed(2), ...(i === 0 ? { at: 1.5 } : {}) });
  }
  // movement between lines: one walk per character, a turn, and every 4th scene a pick-up / drop of the fuse
  actions.push({ id: 'w1', type: 'walk', actor: 'lara', after: 'l2', offset: 0.2, to: [lp[0] * 0.6 + 0.4, 0, lp[1] * 0.6], faceTo: 'bruno' });
  actions.push({ id: 'w2', type: 'walk', actor: 'bruno', after: 'l5', offset: 0.1, to: [bp[0] * 0.5 - 0.6, 0, bp[1] * 0.5 + 0.3], faceTo: 'lara', gait: pick(['walk', 'walk-tired', 'walk-brisk']) });
  actions.push({ id: 't1', type: 'turn', actor: 'bruno', after: 'l3', by: pick([35, -35, 60, -90]) });
  actions.push({ id: 't2', type: 'turn', actor: 'bruno', after: 'l4', towards: 'lara' });
  if (s % 4 === 0) {
    actions.push({ id: 'suelta', type: 'drop', actor: 'bruno', after: 'l6', offset: 0.3, prop: 'fusible' });
    actions.push({ id: 'va', type: 'walk', actor: 'lara', after: 'suelta', offset: 0.5, to: { prop: 'fusible', distance: 0.45 } });
    actions.push({ id: 'coge', type: 'pickUp', actor: 'lara', after: 'va', prop: 'fusible' });
  }
  for (let k = 0; k < 9; k++) shots.push({ id: `sh-${String(k + 1).padStart(2, '0')}`, ...(k === 0 ? { at: 0 } : { with: `l${k}`, offset: -0.2 }), camera: { fov: 32, ...FRAMING[(k + s) % FRAMING.length] }, ...(k === 0 ? { transitionIn: { type: s === 1 ? 'fade' : pick(['fade', 'dissolve', 'iris']), durationSec: 0.6 } } : {}) });
  const scene = {
    schemaVersion: 2, id, name: `Escena técnica ${s}`, environmentId: 'taller', durationSec: sceneSec, autoLook: true,
    actors: [{ id: 'bruno', characterId: 'bruno', position: [bp[0], 0, bp[1]], yawDeg: Math.round(rnd() * 360 - 180), expression: 'neutral' }, { id: 'lara', characterId: 'lara', position: [lp[0], 0, lp[1]], yawDeg: Math.round(rnd() * 360 - 180), expression: 'neutral' }],
    props: [{ id: 'robot', propId: 'robot-r7', position: [0.25, 0, -0.85], yawDeg: -35 }, { id: 'fusible', propId: 'fusible-nucleo', heldBy: { actor: 'bruno', hand: 'right' } }],
    actions, dialogue, shots, sound: [{ id: 'amb', kind: 'ambience', sound: 'workshop-ambience', at: 0, gainDb: -24 }], transitionOut: { type: 'fade', durationSec: 0.5 }
  };
  await mkdir(join(root, 'scenes', id), { recursive: true });
  await writeFile(join(root, 'scenes', id, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
}
await writeFile(join(root, 'episode.json'), JSON.stringify({ schemaVersion: 2, id: episode, type: 'episode', name: `Prueba técnica de ${minutes} minutos`, number: 99, scenes, targetDurationSec: minutes * 60, music: [{ id: 'tema', kind: 'music', sound: 'ultimo-turno-tema', at: 0, gainDb: -22, fadeIn: 3, fadeOut: 6 }], render: { width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }, status: 'draft' }, null, 2) + '\n');
await writeFile(join(root, 'sinopsis.md'), `# Prueba técnica de ${minutes} minutos\n\nEpisodio generado para validar estabilidad, memoria, caché, reanudación y sincronía en duración completa. No es una prueba de calidad narrativa.\n`);
console.log(`${scenes.length} escenas escritas en ${root}`);
