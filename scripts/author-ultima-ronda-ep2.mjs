// Authoring helper for «Última ronda» ep-002 «Tormenta salvaje» (full-length episode, five characters, two sets).
// The JSON/Markdown it writes under examples/projects/ultima-ronda/episodes/ep-002 is the source of truth.
// Writing order: logline -> synopsis -> A/B plots -> acts -> scenes; guion.md is generated from the scene data so the
// script and what is rendered can never drift apart. Coverage and acting are automatic; listed shots are inserts.
//   node scripts/author-ultima-ronda-ep2.mjs
import fs from 'node:fs'; import path from 'node:path';
const P = 'examples/projects/ultima-ronda/episodes/ep-002';
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(P, f)), { recursive: true }); fs.writeFileSync(path.join(P, f), typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n'); };
fs.rmSync(path.join(P, 'scenes'), { recursive: true, force: true });

const NAMES = { susana: 'SUSANA', dani: 'DANI', marga: 'MARGA', oscar: 'ÓSCAR', lucia: 'LUCÍA' };
const L = (id, actor, to, text, emotion, extra = {}) => ({ id, actor, ...(to ? { to } : {}), text, ...(emotion ? { emotion } : {}), ...extra });
// Dani tells the story looking back (voice-over, past tense): the series' narrative signature
const VO = (id, text, extra = {}) => ({ id, actor: 'dani', voiceOver: true, text, emotion: 'smile', intensity: 0.7, direction: 'narrador, en pasado, tono íntimo y con humor', ...extra });
const AMB_BAR = { id: 'ambiente', kind: 'ambience', sound: 'room-tone', at: 0, gainDb: -27, fadeIn: 0.3, fadeOut: 0.3 };
const AMB_PISO = { id: 'ambiente', kind: 'ambience', sound: 'room-tone', at: 0, gainDb: -29, fadeIn: 0.3, fadeOut: 0.3 };
const BUTTON = (after) => ({ id: 'remate', kind: 'music', sound: 'sirena-remate', after, offset: 0.05, durationSec: 1.8, gainDb: -2, duck: false });
const STING = (w) => ({ id: 'tension', kind: 'music', sound: 'sirena-alarma', ...w, durationSec: 2.6, gainDb: -4, duck: false });
const ON_BAR = (x, z) => [x, 1.06, z];
const ON_ISLA = (x, z) => [x, 0.91, z];
const ON_MESA = (x, z) => [x, 0.76, z];

// ------------------------------------------------------------------ cameras for inserts
const BAR = {
  wide: { type: 'static', position: [2.7, 1.95, 3.5], target: [-1.0, 1.1, -0.3], fov: 40 },
  door: { type: 'static', position: [-0.6, 1.62, 1.4], target: [3.9, 1.25, -1.2], fov: 38 },
  front: { type: 'static', position: [-0.9, 1.5, 2.9], target: [-1.0, 1.22, -0.2], fov: 38 }
};
const PISO = {
  wide: { type: 'static', position: [0.2, 1.95, 5.0], target: [-0.2, 1.05, -0.6], fov: 46 },
  kitchen: { type: 'static', position: [-0.9, 1.55, 0.5], target: [-1.8, 1.0, -1.7], fov: 34 },
  pot: { type: 'static', position: [-1.6, 1.45, -0.5], target: [-2.25, 0.98, -1.6], fov: 28 },
  door: { type: 'static', position: [1.0, 1.6, 2.9], target: [3.7, 1.25, 1.2], fov: 40 },
  table: { type: 'static', position: [1.0, 1.32, 2.5], target: [1.0, 0.98, 0.2], fov: 38 },
  speaker: { type: 'static', position: [1.5, 0.95, -0.5], target: [2.3, 0.55, -1.4], fov: 30 },
  bedroom: { type: 'static', position: [-1.4, 1.55, 2.3], target: [-3.7, 1.2, 0.6], fov: 40 },
  group: { type: 'static', position: [0.9, 1.75, 4.2], target: [1.2, 1.15, 0.6], fov: 44 }
};

// ------------------------------------------------------------------ episode
w('episode.json', {
  schemaVersion: 2, id: 'ep-002', type: 'episode', name: 'Tormenta salvaje', number: 2,
  scenes: ['sc-000', 'sc-001', 'sc-002', 'sc-003', 'sc-004', 'sc-005', 'sc-006', 'sc-007', 'sc-008'], targetDurationSec: 960,
  score: {
    underscore: { music: 'sirena-cama', gainDb: -14 },
    bumpers: { music: 'sirena-cortinilla', gainDb: -4, durationSec: 4.2, leadSec: 1.1 }, sceneFade: { durationSec: 1.3, holdSec: 0.9 },
    ending: { music: 'sirena-tema', gainDb: -4, durationSec: 8, fadeOut: 2.5 }
  },
  render: { width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }, status: 'draft'
});

w('sinopsis.md', `# Última ronda — «Tormenta salvaje» (ep. 2)

**Logline.** Dani se empeña en cocinar el risotto de su abuela para su primera cita con Susana; entre su mejor amigo escondido en el dormitorio, una colonia de gasolinera y la ex que aparece con champán, la cena se quema… y es lo mejor que les podía pasar.

**Tema.** Impresionar a alguien es agotador; gustarle siendo tú mismo es mucho más barato.

**Personajes y lo que está en juego**
- **Susana (34)**: va a su primera cita en años. *Quiere* que Dani sea el de siempre. *Teme* que todo sea un número ensayado.
- **Dani (37)**: *quiere* demostrar que no es «solo el de la lámpara». *Teme* que su ex vuelva a desordenarle la vida.
- **Marga (41)**, camarera del Sirena y mejor amiga de Susana: apuesta veinte euros a que la cita será un desastre. Lleva tres años divorciada y jura que ni se acuerda de su ex.
- **Óscar (39)**, mejor amigo de Dani, fisioterapeuta, experto autoproclamado en seducción. Su exmujer, de la que «nunca habla», resulta ser Marga.
- **Lucía (31)**, ex de Dani, influencer. Dejó a Dani por un DJ de Ibiza y ha vuelto «a por el arquitecto».

**Tramas**
- **A (Susana y Dani)**: la primera cita. Dani se esfuerza tanto por impresionar que lo estropea todo; cuando deja de intentarlo, funciona.
- **B (Marga y Óscar)**: dos ex que dicen haberse olvidado y que se descubren en la misma cocina.
- **C (Lucía)**: la ex que quiere recuperar lo que tiró; obliga a Dani a elegir en voz alta.

**Sinopsis.** En el Sirena, antes de abrir, Marga apuesta con Susana veinte euros a que a las diez estará de vuelta comiendo cacahuetes; Susana apuesta otros veinte a que Marga no aguanta la noche sin hablar de su ex. En su piso, Dani prepara el risotto de su abuela («el risotto no se abandona nunca») cuando irrumpe Óscar con una colonia llamada *Tormenta salvaje*, una lista de reproducción («Noches de pasión, volumen tres») y la técnica del espejo.

Mientras Susana se despide de Marga, entra Lucía buscando a Dani: ha vuelto, quiere un arquitecto para su tienda… y recuperar al arquitecto. Susana no le dice dónde vive, pero Lucía tiene su número. En el piso, Lucía llama; contesta Óscar y, con su incapacidad para guardar secretos, le da la dirección. El risotto se quema y salta la alarma.

Llega Susana. Óscar se esconde en el dormitorio. La cena es un desastre encantador: risotto «crujiente, tendencia en Milán», un estornudo desde el dormitorio, la lista de Óscar sonando por error. Dani confiesa que quería demostrar que no era solo el de la lámpara; Susana le dice que le gustaba el de la lámpara. Suena el timbre: es Lucía, con champán y planos. Óscar sale del dormitorio rindiéndose, y entra Marga con la tarta… y se encuentra a su exmarido. Todos los ex en la misma habitación.

Lucía obliga a Dani a elegir. Dani, por fin sin lista: le hará la tienda, con factura, pero esta noche cena con Susana, «aunque sea carbón». Lucía se va; Óscar intenta llevarla y Marga le frena: la colonia se la regaló ella. Solos en la cocina, con la tarta de Marga, Susana y Dani hablan de verdad: el risotto nunca le salió a la abuela, pero era lo único suyo que se podía invitar a cenar. Susana escribe el punto tres de la lista: «Repetir». Etiqueta: a las dos menos cinco, Óscar vuelve al Sirena con el frasco vacío de colonia para Marga; Susana paga la apuesta porque ha sido «el mejor desastre de su vida».

**Estructura**
- **Teaser** (esc. 1): las apuestas. Siembra: el risotto, la tarta, el ex de Marga y Benidorm.
- **Acto 1 — Planteamiento** (esc. 2–3): la colonia y la técnica del espejo; **detonante**: Lucía llega al Sirena decidida a recuperar a Dani.
- **Acto 2 — Nudo** (esc. 4–5): la llamada, la dirección, el risotto quemado; la cita con el amigo escondido; la confesión («quería no ser solo el de la lámpara»); **punto de giro**: suena el timbre.
- **Acto 3 — Desenlace** (esc. 6–7): todos los ex en la misma habitación (**clímax**); Dani elige sin lista; Marga y Óscar; la conversación de verdad y el punto tres.
- **Etiqueta** (esc. 8): la colonia vacía y la apuesta pagada.
`);

// ------------------------------------------------------------------ scenes
const scenes = {};
const scene = (id, name, synopsis, envId, data) => { scenes[id] = { schemaVersion: 2, id, name, synopsis, environmentId: envId, durationSec: 'auto', tailSec: 0.6, autoLook: true, autoActing: 1, coverage: 'auto', ...data }; };

// ---- APERTURA (flash-forward): the disaster at its peak, frozen; Dani tells us how he got there
scene('sc-000', 'Tres horas después', 'El desastre en su punto álgido: la ex con champán, el amigo escondido, la exmujer con la tarta. Imagen congelada; Dani lo cuenta.', 'piso-dani', {
  actors: [
    { id: 'dani', characterId: 'dani', position: [2.35, 0, 0.85], yawDeg: 60, expression: 'fear', idle: 'idle' },
    { id: 'susana', characterId: 'susana', position: [1.25, 0, 0.95], yawDeg: 80, expression: 'surprise', idle: 'idle-relaxed' },
    { id: 'lucia', characterId: 'lucia', position: [2.25, 0, 1.75], yawDeg: -150, expression: 'joy', idle: 'idle-relaxed' },
    { id: 'marga', characterId: 'marga', position: [3.1, 0, 0.55], yawDeg: -95, expression: 'surprise', idle: 'idle' },
    { id: 'oscar', characterId: 'oscar', position: [-0.2, 0, 1.25], yawDeg: 85, expression: 'fear', idle: 'idle-relaxed' }
  ],
  props: [
    { id: 'champan', propId: 'botella-vino', heldBy: { actor: 'lucia', hand: 'right' } },
    { id: 'tarta', propId: 'caja-tarta', heldBy: { actor: 'marga', hand: 'left' } },
    { id: 'olla', propId: 'olla', position: ON_ISLA(-2.25, -1.6) }
  ],
  shots: [
    { id: 'i-caos', at: 0, durationSec: 2.2, camera: { ...PISO.group, move: { type: 'push-in', amount: 0.1 } } },
    { id: 'i-congelado', after: 's0', offset: 0.15, durationSec: 40, camera: PISO.group }
  ],
  actions: [
    { id: 'humo', type: 'effect', effect: 'smoke', prop: 'olla', at: 0, durationSec: 30, intensity: 1.2 },
    { id: 'lucia-brinda', type: 'hold', actor: 'lucia', at: 0.4, hand: 'right', pose: 'raised', durationSec: 0.8 },
    { id: 'oscar-rinde', type: 'play', actor: 'oscar', with: 'o0', clip: 'shrug', durationSec: 1.3 },
    { id: 'dani-cara', type: 'play', actor: 'dani', with: 'v0', offset: 0.4, clip: 'facepalm', durationSec: 1.6 },
    { id: 'congela', type: 'effect', effect: 'freeze', after: 's0', offset: 0.35, durationSec: 1, until: 'fin-vo' },
    { id: 'fin-vo', type: 'lookAt', actor: 'dani', after: 'n5', offset: 0.6, target: 'susana', durationSec: 0.4 }
  ],
  dialogue: [
    L('l0', 'lucia', 'dani', '¡Sorpresa! He traído champán.', 'joy', { at: 0.5 }),
    L('m0', 'marga', 'oscar', '¿Óscar? ¿Qué haces tú aquí?', 'surprise'),
    L('o0', 'oscar', 'marga', 'Yo... pasaba por el dormitorio.', 'fear'),
    L('v0', 'susana', 'dani', 'Dani... ¿esta era la cena tranquila?', 'surprise', { intensity: 0.8 }),
    L('s0', 'dani', 'susana', 'Puedo explicarlo.', 'fear'),
    VO('n1', 'Ese de ahí soy yo. El que suda.'),
    VO('n2', 'La primera vez que invité a Susana a cenar, pensé que lo difícil iba a ser cocinar.'),
    VO('n3', 'A las diez de la noche tenía el arroz carbonizado, a mi mejor amigo saliendo de mi dormitorio, a mi exnovia con champán... y a la exmujer de mi mejor amigo con una tarta.'),
    VO('n4', 'Mi abuela tenía razón: el risotto no se abandona nunca. Lo que no me explicó es qué se hace con los ex.'),
    VO('n5', 'Para entenderlo, hay que volver tres horas atrás.', { pauseAfter: 0.4 })
  ],
  sound: [AMB_PISO, STING({ with: 'congela', offset: 0.05 })]
});

// ---- ESC. 1 — TEASER: Apuestas (bar, antes de abrir)
scene('sc-001', 'Apuestas', 'El Sirena antes de abrir: Marga y Susana apuestan sobre la cita y sobre el ex de Marga.', 'sirena', {
  actors: [
    { id: 'susana', characterId: 'susana', position: [-1.8, 0, 0.35], yawDeg: 140, expression: 'smile', idle: 'idle-relaxed' },
    { id: 'marga', characterId: 'marga', position: [-1.85, 0, -0.85], yawDeg: 45, expression: 'smirk', idle: 'idle' }
  ],
  props: [
    { id: 'copa', propId: 'copa', heldBy: { actor: 'marga', hand: 'right' } },
    { id: 'coctelera', propId: 'coctelera', position: ON_BAR(-1.36, 1.0) },
    { id: 'vela-barra', propId: 'vela', position: ON_BAR(-1.2, -0.12) }
  ],
  shots: [{ id: 'i-apertura', at: 0, durationSec: 3.4, camera: { ...BAR.wide, move: { type: 'push-in', amount: 0.12 } }, transitionIn: { type: 'fade', durationSec: 0.8 } }],
  actions: [
    { id: 'seca', type: 'hold', actor: 'marga', at: 0.2, hand: 'right', pose: 'show', durationSec: 0.8 },
    { id: 'deja-copa', type: 'place', actor: 'marga', after: 'm4', offset: 0.1, prop: 'copa', on: ON_BAR(-1.32, -0.6), durationSec: 1.0 },
    { id: 'marga-cruza', type: 'play', actor: 'marga', with: 'm6', clip: 'cross-arms', durationSec: 2.5 }
  ],
  dialogue: [
    L('m1', 'marga', 'susana', 'Así que el de las doce menos cinco por fin se atrevió.', 'smirk', { at: 1.4 }),
    L('v1', 'susana', 'marga', 'Me ha invitado a cenar. Solo es una cena.', 'smile'),
    L('m2', 'marga', 'susana', '«Solo es una cena». Eso mismo dijo el Titanic del iceberg: «solo es un cubito».', 'smirk', { intensity: 1.2 }),
    L('v2', 'susana', 'marga', 'Cocina él. En su casa.', 'joy'),
    L('m3', 'marga', 'susana', '¿Un arquitecto cocinando? Eso es como un cirujano haciendo malabares. Puede salir bien, pero yo no miraría.', 'surprise'),
    L('v3', 'susana', 'marga', 'Dice que es el risotto de su abuela.', 'smirk'),
    L('m4', 'marga', 'susana', 'Las recetas de abuela son como los fantasmas: todo el mundo dice que tiene una y nadie las ha visto funcionar.', 'smirk'),
    L('v4', 'susana', 'marga', 'Marga, por una vez, alégrate por mí.', 'sad', { intensity: 0.6 }),
    L('m5', 'marga', 'susana', 'Me alegro. Y te apuesto veinte euros a que a las diez estás aquí comiendo cacahuetes.', 'smile'),
    L('v5', 'susana', 'marga', 'Hecho. ¿Y tú? ¿Vas a aguantar toda la noche sin nombrar a tu ex?', 'smile'),
    L('m6', 'marga', 'susana', '¿De quién? ¿Del fisioterapeuta que me dejó por un congreso en Benidorm? Ni me acuerdo de él.', 'angry'),
    L('v6', 'susana', 'marga', 'Acabas de decir dónde era el congreso.', 'smirk'),
    L('m7', 'marga', 'susana', 'Benidorm es... cultura general.', 'nervous'),
    L('s7', 'susana', 'marga', 'Veinte euros, Marga.', 'smile', { pauseAfter: 0.6 })
  ],
  sound: [AMB_BAR, { id: 'tema', kind: 'music', sound: 'sirena-tema', at: 0, durationSec: 9, gainDb: -4, fadeIn: 0.05, fadeOut: 3, duck: true }, BUTTON('s7')]
});

// ---- ESC. 2 — La técnica del espejo (piso, 20:00)
scene('sc-002', 'La técnica del espejo', 'Dani cocina el risotto de su abuela; Óscar llega con colonia, una lista de reproducción y malos consejos.', 'piso-dani', {
  actors: [
    { id: 'dani', characterId: 'dani', position: [-1.6, 0, -2.25], yawDeg: 0, expression: 'nervous', idle: 'idle' },
    { id: 'oscar', characterId: 'oscar', position: [4.6, 0, 1.2], yawDeg: -90, expression: 'joy', idle: 'idle-relaxed' }
  ],
  props: [
    { id: 'olla', propId: 'olla', position: ON_ISLA(-2.25, -1.6) },
    { id: 'colonia', propId: 'colonia', heldBy: { actor: 'oscar', hand: 'right' } },
    { id: 'movil', propId: 'movil', position: ON_ISLA(-0.85, -1.45) }
  ],
  shots: [
    { id: 'i-cocina', at: 0, durationSec: 3.0, camera: { ...PISO.kitchen, move: { type: 'push-in', amount: 0.1 } } },
    { id: 'i-puerta', with: 'abre', offset: -0.1, durationSec: 2.6, camera: PISO.door },
    { id: 'i-olla', with: 'd4', offset: 0.2, durationSec: 2.4, camera: PISO.pot }
  ],
  actions: [
    { id: 'remueve-1', type: 'play', actor: 'dani', at: 0.3, clip: 'point', target: 'olla', durationSec: 1.6 },
    { id: 'mira-olla', type: 'lookAt', actor: 'dani', at: 0.2, target: 'olla', durationSec: 2.6 },
    { id: 'abre', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'n2', offset: -0.6, toDeg: 95, durationSec: 0.8, sound: 'door-creak' },
    { id: 'oscar-entra', type: 'walk', actor: 'oscar', with: 'abre', offset: 0.3, to: [-0.45, 0, -2.2], faceTo: 'dani' },
    { id: 'cierra', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'oscar-entra', offset: 1.8, toDeg: 0, durationSec: 0.8, sound: 'click' },
    { id: 'da-colonia', type: 'give', actor: 'oscar', after: 'o3', offset: -1.6, prop: 'colonia', to: 'dani', durationSec: 1.4 },
    { id: 'dani-lee', type: 'hold', actor: 'dani', after: 'da-colonia', hand: 'right', pose: 'show', durationSec: 0.6 },
    { id: 'rociada', type: 'effect', effect: 'smoke', prop: 'colonia', after: 'dani-lee', offset: 0.1, durationSec: 1.6, intensity: 0.7, sound: 'whoosh' },
    { id: 'dani-tose', type: 'play', actor: 'dani', with: 'rociada', offset: 0.25, clip: 'facepalm', durationSec: 1.6 },
    { id: 'dani-aparta', type: 'play', actor: 'dani', with: 'rociada', offset: 1.2, clip: 'headshake', durationSec: 1.0 },
    { id: 'dani-mira-frasco', type: 'lookAt', actor: 'dani', with: 'dani-lee', target: 'colonia', mode: 'head', durationSec: 2.2 },
    { id: 'deja-colonia', type: 'place', actor: 'dani', after: 'd3', offset: 0.1, prop: 'colonia', on: ON_ISLA(-1.2, -1.5), hand: 'right', durationSec: 0.9 },
    { id: 'remueve-2', type: 'play', actor: 'dani', with: 'd4', offset: 0.6, clip: 'point', target: 'olla', durationSec: 1.4 },
    { id: 'oscar-espejo', type: 'play', actor: 'oscar', with: 'o8', offset: 0.5, clip: 'present', durationSec: 1.5 },
    { id: 'dani-tapa', type: 'play', actor: 'dani', with: 'd9', clip: 'facepalm', durationSec: 1.6 },
    { id: 'dani-senala', type: 'play', actor: 'dani', with: 'd14', clip: 'point', target: 'puerta', durationSec: 1.5 }
  ],
  dialogue: [
    VO('n1', 'Tres horas antes, todo estaba bajo control. Tenía una lista, un sofrito y la receta de mi abuela.', { at: 0.4 }),
    VO('n2', 'Y entonces llegó Óscar. Casi todas las malas ideas de mi vida han llegado por esa puerta.'),
    L('o1', 'oscar', 'dani', '¡Ha llegado la caballería! ¿Dónde está el enfermo de amor?', 'joy', { with: 'abre', offset: 0.5 }),
    L('d1', 'dani', 'oscar', 'Óscar, te di la llave para emergencias.', 'nervous'),
    L('o2', 'oscar', 'dani', 'Esto es una emergencia. Tienes una cita a las nueve y hueles a cebolla.', 'smirk'),
    L('d2', 'dani', 'oscar', 'Es un sofrito. Es la base del risotto.', 'thinking'),
    L('o3', 'oscar', 'dani', 'La base de una cita es el olor. Toma. «Tormenta salvaje». Dos gotas y te tienen que sujetar.', 'smirk', { after: 'oscar-entra', offset: -0.3 }),
    L('d3', 'dani', 'oscar', 'Aquí pone «no aplicar cerca de una llama».', 'thinking', { after: 'dani-lee' }),
    L('o4', 'oscar', 'dani', 'Por eso funciona. Es peligrosa.', 'smirk'),
    L('d4', 'dani', 'oscar', 'No necesito colonia. Necesito que no se pegue el arroz. Mi abuela decía: el risotto no se abandona nunca.', 'nervous'),
    L('o5', 'oscar', 'dani', 'Tu abuela era una sabia. Como yo. Por eso te he preparado una lista de reproducción.', 'joy'),
    L('d5', 'dani', 'oscar', '¿Qué lista?', 'worried'),
    L('o6', 'oscar', 'dani', '«Noches de pasión, volumen tres». La uno y la dos las quemé con Marga.', 'smirk'),
    L('d6', 'dani', 'oscar', '¿Quién es Marga?', 'surprise'),
    L('o7', 'oscar', 'dani', 'Nadie. Una exmujer. Cultura general.', 'sad', { intensity: 0.7 }),
    L('d7', 'dani', 'oscar', 'Tampoco necesito música. Susana tiene un bar: escucha música doce horas al día.', 'thinking'),
    L('o8', 'oscar', 'dani', 'Precisamente. Hay que sorprenderla. Atiende: la técnica del espejo. Tú haces lo que hace ella. Ella bebe, tú bebes. Ella se ríe, tú te ríes.', 'smirk'),
    L('d8', 'dani', 'oscar', '¿Y si ella se va?', 'worried'),
    L('o9', 'oscar', 'dani', 'Tú también te vas. Pero detrás.', 'thinking'),
    L('d9', 'dani', 'oscar', 'Eso no es una técnica, Óscar. Eso es una orden de alejamiento.', 'angry', { intensity: 0.7 }),
    L('o10', 'oscar', 'dani', '¡Ja! ¿Ves? Ya estás gracioso. Eso es la colonia.', 'laugh'),
    L('d10', 'dani', 'oscar', 'No me he puesto colonia.', 'thinking'),
    L('o11', 'oscar', 'dani', 'Te la he echado yo al entrar. Cuando te has dado la vuelta.', 'smirk'),
    L('d11', 'dani', 'oscar', 'Por eso me pican los ojos.', 'disgust'),
    L('o12', 'oscar', 'dani', 'Eso es la pasión.', 'joy'),
    L('d12', 'dani', 'oscar', 'Vale. Escúchame. Esta noche, nada de técnicas. Hago la cena, hablamos y soy yo mismo.', 'determined'),
    L('o13', 'oscar', 'dani', '¿Tú mismo? ¿El de la lámpara?', 'worried'),
    L('d13', 'dani', 'oscar', 'Al de la lámpara le ha dicho que sí.', 'determined'),
    L('o14', 'oscar', 'dani', 'Ya. Al de la lámpara le dijo que sí a una cena. A ver qué le dice al del risotto.', 'smirk'),
    L('d14', 'dani', 'oscar', 'Fuera de mi cocina.', 'angry', { pauseAfter: 0.3 })
  ],
  sound: [AMB_PISO, BUTTON('d14')]
});

// ---- ESC. 3 — La de las lentejuelas (bar, 20:40)
scene('sc-003', 'La de las lentejuelas', 'Susana se despide de Marga para ir a la cita; entra Lucía, la ex de Dani, decidida a recuperarlo.', 'sirena', {
  actors: [
    { id: 'susana', characterId: 'susana', position: [0.25, 0, 0.75], yawDeg: -110, expression: 'joy', idle: 'idle-relaxed' },
    { id: 'marga', characterId: 'marga', position: [-1.8, 0, -0.35], yawDeg: 80, expression: 'smile', idle: 'idle' },
    { id: 'lucia', characterId: 'lucia', position: [5.0, 0, -1.2], yawDeg: -90, expression: 'joy', idle: 'idle-relaxed' }
  ],
  props: [{ id: 'vela-barra', propId: 'vela', position: ON_BAR(-1.2, -0.12) }],
  shots: [
    { id: 'i-situacion', at: 0, durationSec: 2.4, camera: BAR.wide },
    { id: 'i-puerta', with: 'abre', offset: -0.1, durationSec: 2.8, camera: BAR.door },
    { id: 'i-sale', with: 'lucia-sale', offset: 0.6, durationSec: 2.4, camera: BAR.wide }
  ],
  actions: [
    { id: 'abre', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'v0', offset: 0.1, toDeg: 95, durationSec: 0.8, sound: 'door-creak' },
    { id: 'lucia-entra', type: 'walk', actor: 'lucia', with: 'abre', offset: 0.3, to: [0.75, 0, -0.55], faceTo: 'marga' },
    { id: 'cierra', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'lucia-entra', offset: 2.2, toDeg: 0, durationSec: 0.8, sound: 'click' },
    { id: 'susana-gira', type: 'turn', actor: 'susana', with: 'l1', offset: 0.2, towards: 'lucia', durationSec: 0.8 },
    { id: 'susana-frena', type: 'play', actor: 'susana', with: 'v3', clip: 'dismiss', durationSec: 1.1 },
    { id: 'marga-brazos', type: 'play', actor: 'marga', with: 'm4', clip: 'hands-on-hips', durationSec: 2.2 },
    { id: 'lucia-sale', type: 'walk', actor: 'lucia', after: 'l8', offset: 0.1, to: [5.0, 0, -1.2] },
    { id: 'abre-2', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'lucia-sale', offset: 1.4, toDeg: 95, durationSec: 0.6, sound: 'door-creak' },
    { id: 'cierra-2', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'lucia-sale', offset: 3.4, toDeg: 0, durationSec: 0.6, sound: 'click' },
    { id: 'susana-vuelve', type: 'turn', actor: 'susana', after: 'l8', offset: 1.0, towards: 'marga', durationSec: 0.8 }
  ],
  dialogue: [
    L('v0', 'susana', 'marga', '¿Qué tal estoy?', 'smile', { at: 1.2 }),
    L('m0', 'marga', 'susana', 'Para una cena con risotto, demasiado guapa. Para un incendio, perfecta.', 'smirk'),
    L('l1', 'lucia', 'marga', '¡Hola! Qué sitio tan... íntimo. ¿Hacéis cócteles sin azúcar, sin alcohol y sin gluten?', 'joy', { with: 'lucia-entra', offset: 1.4 }),
    L('m1', 'marga', 'lucia', 'Eso se llama agua. Son tres euros.', 'smirk'),
    L('l2', 'lucia', 'marga', '¡Me encanta! Busco a alguien: Dani Ferrer. Arquitecto, gafas, habla del tiempo cuando se pone nervioso.', 'laugh'),
    L('v1', 'susana', 'lucia', '¿Y tú eres...?', 'surprise', { intensity: 0.7 }),
    L('l3', 'lucia', 'susana', 'Lucía. Su ex. Bueno, su ex de momento.', 'smirk'),
    L('m2', 'marga', 'susana', 'La del DJ de Ibiza.', 'disgust', { direction: 'en voz baja' }),
    L('l4', 'lucia', 'susana', 'Lo del DJ duró lo que dura una canción de DJ: cuatro minutos, y luego todo el rato lo mismo.', 'smirk'),
    L('v2', 'susana', 'lucia', '¿Y qué quieres de Dani?', 'determined'),
    L('l5', 'lucia', 'susana', 'Voy a abrir una tienda aquí al lado y necesito un arquitecto. Y ya que estoy, recuperar al arquitecto.', 'joy'),
    L('m3', 'marga', 'lucia', 'Mira, guapa...', 'angry', { pauseAfter: 0.05 }),
    L('v3', 'susana', 'marga', 'Marga.', 'determined'),
    L('v3b', 'susana', 'lucia', 'Dani tiene planes esta noche.', 'smirk'),
    L('l6', 'lucia', 'susana', '¿Dani? ¿Planes? Dani escribe los planes en una servilleta y luego no los hace.', 'laugh'),
    L('v4', 'susana', 'lucia', 'Esta vez los ha hecho.', 'smirk', { intensity: 1.2 }),
    L('l7', 'lucia', 'susana', 'Pues habrá que cambiárselos. ¿Sabéis dónde vive ahora?', 'smirk'),
    L('v5', 'susana', 'lucia', 'Ni idea.', 'smirk'),
    L('m4', 'marga', 'lucia', 'En la otra punta. En otra ciudad. En otro planeta.', 'angry'),
    L('l8', 'lucia', 'marga', '¡Qué graciosa! Da igual, tengo su número. Las ex somos como los impuestos: siempre volvemos.', 'laugh'),
    L('m5', 'marga', 'susana', 'Vete ya a esa cena. Y si aparece esa, la tarta que te llevo luego va directa a su cara.', 'angry', { with: 'lucia-sale', offset: 1.0 }),
    L('v6', 'susana', 'marga', '¿Qué tarta?', 'surprise'),
    L('m6', 'marga', 'susana', 'La del postre. Una primera cita necesita una tarta y una testigo.', 'smile'),
    L('v7', 'susana', 'marga', 'Tú lo que quieres es cotillear.', 'smirk'),
    L('m7', 'marga', 'susana', 'Yo lo que quiero es ganar veinte euros. Que no es lo mismo.', 'smirk', { pauseAfter: 0.3 })
  ],
  sound: [AMB_BAR, STING({ with: 'l3', offset: 1.2 })]
});

// ---- ESC. 4 — Llamada perdida (piso, 20:55)
scene('sc-004', 'Llamada perdida', 'Óscar contesta el móvil de Dani: es Lucía, y le da la dirección. El risotto se quema.', 'piso-dani', {
  actors: [
    { id: 'dani', characterId: 'dani', position: [-1.6, 0, -2.25], yawDeg: 0, expression: 'nervous', idle: 'idle' },
    { id: 'oscar', characterId: 'oscar', position: [-0.2, 0, -0.9], yawDeg: -120, expression: 'smile', idle: 'idle-relaxed' }
  ],
  props: [
    { id: 'olla', propId: 'olla', position: ON_ISLA(-2.25, -1.6) },
    { id: 'colonia', propId: 'colonia', position: ON_ISLA(-1.2, -1.5) },
    { id: 'movil', propId: 'movil', position: ON_ISLA(-0.85, -1.45) }
  ],
  shots: [
    { id: 'i-situacion', at: 0, durationSec: 2.4, camera: PISO.wide },
    { id: 'i-movil', with: 'oscar-coge', offset: 0.1, durationSec: 2.0, camera: PISO.kitchen },
    { id: 'i-humo', with: 'humo', offset: 0.3, durationSec: 2.6, camera: { ...PISO.pot, handheld: 0.5 } }
  ],
  actions: [
    { id: 'remueve', type: 'play', actor: 'dani', at: 0.3, clip: 'point', target: 'olla', durationSec: 1.4 },
    { id: 'vibra', type: 'effect', effect: 'glow', prop: 'movil', part: 'pantalla', after: 'o2', offset: 0.1, durationSec: 2.0, intensity: 2 },
    { id: 'oscar-va', type: 'walk', actor: 'oscar', after: 'd3', offset: -1.2, to: [-0.35, 0, -1.45], faceTo: { prop: 'movil' } },
    { id: 'oscar-coge', type: 'pickUp', actor: 'oscar', after: 'oscar-va', prop: 'movil', hand: 'right', durationSec: 1.0 },
    { id: 'oscar-oreja', type: 'hold', actor: 'oscar', after: 'oscar-coge', hand: 'right', pose: 'raised', durationSec: 0.5 },
    { id: 'oscar-gira', type: 'turn', actor: 'oscar', with: 'o4', yawDeg: 160, durationSec: 0.9 },
    { id: 'dani-panico', type: 'play', actor: 'dani', with: 'd5', clip: 'nervous', durationSec: 2.4 },
    { id: 'cuelga', type: 'place', actor: 'oscar', after: 'o6', offset: 0.1, prop: 'movil', on: ON_ISLA(-0.85, -1.45), durationSec: 0.9 },
    { id: 'oscar-vuelve', type: 'turn', actor: 'oscar', after: 'cuelga', towards: 'dani', durationSec: 0.6 },
    { id: 'humo', type: 'effect', effect: 'smoke', prop: 'olla', after: 'd9', offset: 0.1, durationSec: 4, intensity: 1.4 },
    { id: 'dani-olla', type: 'play', actor: 'dani', with: 'd10', clip: 'point', target: 'olla', durationSec: 1.3 },
    { id: 'dani-susto', type: 'expression', actor: 'dani', with: 'd10', expression: 'fear', durationSec: 2 }
  ],
  dialogue: [
    L('d1', 'dani', 'oscar', '¿Por qué sigues aquí?', 'angry', { at: 1.0, intensity: 0.6 }),
    L('o1', 'oscar', 'dani', 'Superviso. Como un socorrista: no hago nada, pero si te ahogas, salto.', 'smile'),
    L('d2', 'dani', 'oscar', 'Son las nueve menos cinco. Susana llega a las nueve.', 'nervous'),
    L('o2', 'oscar', 'dani', 'Ella llega a las nueve y tú a las doce menos cinco. Sois un reloj estropeado.', 'smirk'),
    L('d3', 'dani', 'oscar', 'Contesta tú, que tengo las manos en el arroz.', 'nervous', { after: 'vibra', offset: -1.2 }),
    L('o3', 'oscar', undefined, '¡Consultorio sentimental de Daniel Ferrer, dígame!', 'joy', { after: 'oscar-oreja' }),
    L('o3b', 'oscar', undefined, '¿Lucía? ¡Lucía Vidal! ¡Cuánto tiempo!', 'surprise'),
    L('d4', 'dani', 'oscar', 'No. No, no, no.', 'fear', { direction: 'en voz baja' }),
    L('o4', 'oscar', undefined, 'Sí, aquí está, cocinando. Un risotto. Es una cena para una chica que... que no existe.', 'nervous'),
    L('d5', 'dani', 'oscar', 'Cuelga.', 'fear', { direction: 'susurrando', intensity: 1.2 }),
    L('o5', 'oscar', undefined, '¿La dirección? Claro: calle del Olmo, catorce, tercero...', 'smile'),
    L('d6', 'dani', 'oscar', '¡Óscar!', 'angry', { intensity: 1.3, direction: 'gritando' }),
    L('o6', 'oscar', undefined, '...es lo que le diría a cualquiera, pero tú no eres cualquiera. Venga, un beso.', 'nervous'),
    L('d7', 'dani', 'oscar', '¡Le has dado mi dirección a mi ex!', 'angry', { after: 'cuelga', offset: 0.1, intensity: 1.2 }),
    L('o7', 'oscar', 'dani', 'Me ha dicho «hola, Óscar». Con ese tono. Tú no sabes lo que es ese tono.', 'worried'),
    L('d8', 'dani', 'oscar', 'Lo sé perfectamente. Es el tono con el que me dejó por un DJ.', 'sad'),
    L('o8', 'oscar', 'dani', 'Tranquilo, que no va a venir. ¿Qué va a hacer, plantarse en tu casa un sábado por la noche?', 'smile'),
    L('d9', 'dani', 'oscar', 'Es exactamente lo que va a hacer.', 'sad'),
    L('o9', 'oscar', 'dani', '¿Huele a quemado o es la Tormenta salvaje?', 'surprise', { with: 'humo', offset: 1.0 }),
    L('d10', 'dani', 'oscar', '¡El risotto! ¡El risotto no se abandona nunca!', 'fear', { intensity: 1.3, direction: 'gritando' }),
    L('o10', 'oscar', 'dani', 'Bueno... se ha abandonado un poquito.', 'nervous', { pauseAfter: 0.3 })
  ],
  sound: [AMB_PISO,
    { id: 'tono', kind: 'sfx', sound: 'robot-beep', with: 'vibra', gainDb: -16 },
    { id: 'alarma', kind: 'sfx', sound: 'robot-alarm', with: 'd10', offset: -0.3, durationSec: 2.5, gainDb: -14 },
    BUTTON('o10')]
});

// ---- ESC. 5 — Crujiente (piso, 21:00): la cita
scene('sc-005', 'Crujiente', 'Óscar se esconde en el dormitorio; llega Susana; la cena quemada, el estornudo, la lista de Óscar suena sola; Dani se sincera; suena el timbre.', 'piso-dani', {
  actors: [
    { id: 'dani', characterId: 'dani', position: [-0.9, 0, -0.6], yawDeg: 120, expression: 'nervous', idle: 'idle' },
    { id: 'oscar', characterId: 'oscar', position: [-0.2, 0, -0.1], yawDeg: -100, expression: 'worried', idle: 'idle-relaxed' },
    { id: 'susana', characterId: 'susana', position: [4.6, 0, 1.2], yawDeg: -90, expression: 'smile', idle: 'idle-relaxed' }
  ],
  props: [
    { id: 'olla', propId: 'olla', position: ON_ISLA(-2.25, -1.6) },
    { id: 'colonia', propId: 'colonia', position: ON_ISLA(-1.2, -1.5) },
    { id: 'plato-1', propId: 'plato', position: ON_MESA(0.62, 0.2) },
    { id: 'plato-2', propId: 'plato', position: ON_MESA(1.38, 0.2) },
    { id: 'copa-1', propId: 'copa-vino', position: ON_MESA(0.7, 0.48) },
    { id: 'copa-2', propId: 'copa-vino', position: ON_MESA(1.3, 0.48) },
    { id: 'botella', propId: 'botella-vino', position: ON_MESA(1.0, -0.12) },
    { id: 'vela-mesa', propId: 'vela', position: ON_MESA(1.0, 0.32) }
  ],
  shots: [
    { id: 'i-esconde', with: 'oscar-huye', offset: 0.6, durationSec: 2.4, camera: PISO.bedroom },
    { id: 'i-puerta', with: 'abre', offset: -0.1, durationSec: 2.6, camera: PISO.door },
    { id: 'i-mesa', with: 'v7', offset: -0.2, durationSec: 3.0, camera: PISO.table },
    { id: 'i-estornudo', with: 'o1', offset: -0.1, durationSec: 1.8, camera: PISO.bedroom },
    { id: 'i-altavoz', with: 'pasion', offset: 0.1, durationSec: 2.2, camera: PISO.speaker },
    { id: 'i-timbre', with: 'timbre', offset: 0.2, durationSec: 2.4, camera: { ...PISO.group, move: { type: 'push-in', amount: 0.15 } } }
  ],
  actions: [
    { id: 'humea', type: 'effect', effect: 'smoke', prop: 'olla', at: 0, durationSec: 40, intensity: 0.5 },
    { id: 'empuja', type: 'play', actor: 'dani', with: 'd0', clip: 'point', target: 'puerta-cuarto', durationSec: 1.5 },
    { id: 'oscar-huye', type: 'walk', actor: 'oscar', with: 'o0', offset: 0.8, to: [-4.6, 0, 0.6], gait: 'walk-brisk' },
    { id: 'dani-a-puerta', type: 'walk', actor: 'dani', after: 'oscar-huye', offset: -1.6, to: [2.9, 0, 1.0], faceTo: 'puerta' },
    { id: 'abre', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'dani-a-puerta', offset: 0.1, toDeg: 95, durationSec: 0.8, sound: 'door-creak' },
    { id: 'susana-entra', type: 'walk', actor: 'susana', with: 'abre', offset: 0.3, to: [2.35, 0, 1.35], faceTo: 'dani' },
    { id: 'cierra', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'susana-entra', offset: 1.8, toDeg: 0, durationSec: 0.8, sound: 'click' },
    { id: 'susana-mira-olla', type: 'lookAt', actor: 'susana', with: 'v5', target: 'olla', durationSec: 1.6 },
    { id: 'susana-se-sienta', type: 'sit', actor: 'susana', after: 'd6', offset: -0.6, prop: 'silla-2', durationSec: 1.2 },
    { id: 'dani-rodea', type: 'walk', actor: 'dani', with: 'susana-se-sienta', offset: 0.2, to: [0.6, 0, 1.15] },
    { id: 'dani-se-sienta', type: 'sit', actor: 'dani', after: 'dani-rodea', prop: 'silla-1', durationSec: 1.1 },
    { id: 'susana-copa', type: 'pickUp', actor: 'susana', after: 'susana-se-sienta', offset: 0.6, prop: 'copa-2', hand: 'right', durationSec: 1.0 },
    { id: 'susana-bebe', type: 'hold', actor: 'susana', after: 'susana-copa', hand: 'right', pose: 'raised', durationSec: 0.6 },
    { id: 'susana-baja', type: 'hold', actor: 'susana', after: 'susana-bebe', offset: 0.8, hand: 'right', pose: 'front', durationSec: 0.6 },
    { id: 'pasion', type: 'effect', effect: 'glow', prop: 'altavoz', part: 'anillo', with: 'o2', offset: -0.6, until: 'd14', intensity: 1.5 },
    { id: 'dani-tapa', type: 'play', actor: 'dani', with: 'd12', clip: 'facepalm', durationSec: 1.6 },
    { id: 'timbre', type: 'effect', effect: 'flicker', prop: 'lampara', after: 'd13', offset: 0.2, durationSec: 0.15 },
    { id: 'miran-puerta-v', type: 'lookAt', actor: 'susana', with: 'timbre', offset: 0.2, target: 'puerta', durationSec: 3.2 },
    { id: 'miran-puerta-d', type: 'lookAt', actor: 'dani', with: 'timbre', offset: 0.3, target: 'puerta', durationSec: 3.2 }
  ],
  dialogue: [
    L('d0', 'dani', 'oscar', '¡Ya está aquí! ¡Al dormitorio!', 'fear', { at: 0.6, intensity: 1.2 }),
    L('o0', 'oscar', 'dani', 'Vale, vale. Pero deja la puerta entornada, que tengo que supervisar.', 'worried'),
    L('d0b', 'dani', 'oscar', '¡Y no toques nada!', 'angry', { with: 'dani-a-puerta', offset: 0.5 }),
    L('o0b', 'oscar', undefined, '¡Si aquí solo hay una cama y un flexo!', 'worried', { direction: 'desde el dormitorio' }),
    L('d0c', 'dani', undefined, 'Pues no toques el flexo.', 'nervous', { direction: 'en voz baja' }),
    L('v1', 'susana', 'dani', 'Huele a... ¿Qué es eso? ¿Incendio o perfume?', 'surprise', { with: 'susana-entra', offset: 1.2, gesture: 'dismiss' }),
    L('d1', 'dani', 'susana', 'Las dos cosas. Es una colonia que se llama Tormenta salvaje.', 'nervous'),
    L('v2', 'susana', 'dani', '¿Te la has puesto tú?', 'laugh'),
    L('d2', 'dani', 'susana', 'Me la han puesto. Es una historia larga.', 'nervous'),
    L('v3', 'susana', 'dani', 'Me gustan las historias largas.', 'smile'),
    L('d3', 'dani', 'susana', 'Hoy no hablo del tiempo. Tengo una lista nueva.', 'joy'),
    L('v4', 'susana', 'dani', 'Cómo no.', 'smirk'),
    L('d4', 'dani', 'susana', 'Punto uno: cocinar algo de mi abuela. Punto dos: no quemarlo.', 'determined'),
    L('v5', 'susana', 'dani', '¿Y qué tal va el punto dos?', 'smirk'),
    L('d5', 'dani', 'susana', 'Está... caramelizado. Es una técnica italiana. Muy antigua.', 'nervous'),
    L('v6', 'susana', 'dani', 'Como tu abuela.', 'smirk'),
    L('d6', 'dani', 'susana', 'Exacto. Siéntate, por favor.', 'joy'),
    L('s6b', 'susana', 'dani', '¿Y tú dónde te sientas?', 'smirk', { with: 'dani-rodea', offset: 0.3 }),
    L('d6b', 'dani', 'susana', 'Enfrente. Lo he medido: un metro cuarenta. Ni muy cerca ni muy lejos.', 'nervous'),
    L('s6c', 'susana', 'dani', '¿Has medido la mesa?', 'surprise', { intensity: 0.7 }),
    L('v7', 'susana', 'dani', 'Pues... está crujiente.', 'thinking', { after: 'dani-se-sienta', offset: 0.6 }),
    L('d7', 'dani', 'susana', 'El risotto crujiente es tendencia en Milán.', 'nervous'),
    L('v8', 'susana', 'dani', 'Dani. Está quemado.', 'laugh'),
    L('d8', 'dani', 'susana', 'Está muy quemado. Lo siento. Quería demostrarte que no soy solo el de la lámpara.', 'sad'),
    L('v9', 'susana', 'dani', 'A mí me gustaba el de la lámpara.', 'smile', { direction: 'en voz baja' }),
    L('d9', 'dani', 'susana', '¿En serio?', 'surprise'),
    L('v10', 'susana', 'dani', 'El de la lámpara me hacía reír. Este... me tiene un poco nerviosa. Y yo no me pongo nerviosa.', 'worried', { intensity: 0.8 }),
    L('o1', 'oscar', undefined, '¡Achís!', 'surprise', { direction: 'gritando' }),
    L('v11', 'susana', 'dani', '¿Hay alguien en tu dormitorio?', 'surprise'),
    L('d10', 'dani', 'susana', 'No. Es el vecino. Las paredes son muy finas.', 'fear'),
    L('v12', 'susana', 'dani', 'Tú eres arquitecto.', 'smirk'),
    L('d11', 'dani', 'susana', 'Por eso lo sé.', 'nervous'),
    L('o2', 'oscar', undefined, '¡Perdón, perdón! ¡Que era el botón del volumen!', 'fear', { direction: 'susurrando', offset: 0.4 }),
    L('v13', 'susana', 'dani', '¿Y esto qué es?', 'laugh', { with: 'pasion', offset: 1.8 }),
    L('d12', 'dani', 'susana', '«Noches de pasión, volumen tres».', 'sad'),
    L('v14', 'susana', 'dani', '¿Y el uno y el dos?', 'smirk', { intensity: 1.2 }),
    L('d13', 'dani', 'susana', 'Se quemaron. Como el risotto.', 'nervous'),
    L('v15', 'susana', 'dani', '¿Esperas a alguien más?', 'surprise', { after: 'timbre', offset: 2.0 }),
    L('d14', 'dani', 'susana', 'Espero que no.', 'fear', { pauseAfter: 0.3 })
  ],
  sound: [AMB_PISO,
    { id: 'balada', kind: 'music', sound: 'pasion-vol3', with: 'pasion', durationSec: 11, gainDb: -8, fadeIn: 0.3, fadeOut: 1.5, duck: true },
    { id: 'ding', kind: 'sfx', sound: 'doorbell', with: 'timbre', gainDb: -6 },
    STING({ with: 'timbre', offset: 0.6 })]
});

// ---- ESC. 6 — Todos los ex (piso): clímax
scene('sc-006', 'Todos los ex', 'Lucía irrumpe con champán; Óscar sale del dormitorio; Marga llega con la tarta y descubre a su exmarido; Dani elige.', 'piso-dani', {
  continuous: true,
  actors: [
    { id: 'dani', characterId: 'dani', position: [0.3, 0, 0.2], yawDeg: 90, expression: 'fear', idle: 'idle' },
    { id: 'susana', characterId: 'susana', position: [1.7, 0, 0.2], yawDeg: -90, expression: 'smirk', idle: 'idle-relaxed' },
    { id: 'lucia', characterId: 'lucia', position: [4.6, 0, 1.2], yawDeg: -90, expression: 'joy', idle: 'idle-relaxed' },
    { id: 'oscar', characterId: 'oscar', position: [-4.6, 0, 0.6], yawDeg: 90, expression: 'worried', idle: 'idle-relaxed' },
    { id: 'marga', characterId: 'marga', position: [5.4, 0, 1.2], yawDeg: -90, expression: 'joy', idle: 'idle' }
  ],
  props: [
    { id: 'olla', propId: 'olla', position: ON_ISLA(-2.25, -1.6) },
    { id: 'plato-1', propId: 'plato', position: ON_MESA(0.62, 0.2) },
    { id: 'plato-2', propId: 'plato', position: ON_MESA(1.38, 0.2) },
    { id: 'copa-1', propId: 'copa-vino', position: ON_MESA(0.7, 0.48) },
    { id: 'copa-2', propId: 'copa-vino', heldBy: { actor: 'susana', hand: 'right' } },
    { id: 'botella', propId: 'botella-vino', position: ON_MESA(1.0, -0.12) },
    { id: 'vela-mesa', propId: 'vela', position: ON_MESA(1.0, 0.32) },
    { id: 'tarta', propId: 'caja-tarta', heldBy: { actor: 'marga', hand: 'right' } }
  ],
  shots: [
    { id: 'i-puerta', with: 'abre', offset: -0.1, durationSec: 2.8, camera: PISO.door },
    { id: 'i-oscar', with: 'oscar-sale', offset: 0.2, durationSec: 2.4, camera: PISO.bedroom },
    { id: 'i-marga', with: 'marga-entra', offset: 0.6, durationSec: 2.2, camera: PISO.door },
    { id: 'i-grupo', with: 'l8', offset: -0.2, durationSec: 3.4, camera: { ...PISO.group, move: { type: 'push-in', amount: 0.2 } }, notes: 'Todos miran a Dani.' },
    { id: 'i-salen', with: 'salen-lucia', offset: 0.4, durationSec: 2.6, camera: PISO.wide },
    { id: 'i-salen-2', with: 'oscar-tras', offset: 0.1, durationSec: 4.5, camera: PISO.group, notes: 'Óscar y Marga se van discutiendo.' }
  ],
  actions: [
    { id: 'sentado-d', type: 'sit', actor: 'dani', at: 0, prop: 'silla-1', durationSec: 0.3 },
    { id: 'sentada-s', type: 'sit', actor: 'susana', at: 0, prop: 'silla-2', durationSec: 0.3 },
    { id: 'dani-se-levanta', type: 'stand', actor: 'dani', at: 0.4, durationSec: 0.9 },
    { id: 'dani-a-puerta', type: 'walk', actor: 'dani', after: 'dani-se-levanta', to: [2.9, 0, 1.05], faceTo: 'puerta' },
    { id: 'susana-deja-copa', type: 'place', actor: 'susana', at: 0.6, prop: 'copa-2', on: ON_MESA(1.3, 0.48), durationSec: 1.0 },
    { id: 'abre', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'dani-a-puerta', offset: 0.1, toDeg: 95, durationSec: 0.8, sound: 'door-creak' },
    { id: 'lucia-entra', type: 'walk', actor: 'lucia', with: 'abre', offset: 0.3, to: [2.2, 0, 1.55], faceTo: 'dani' },
    { id: 'cierra-1', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'lucia-entra', offset: 2.0, toDeg: 0, durationSec: 0.7, sound: 'click' },
    { id: 'dani-retrocede', type: 'walk', actor: 'dani', after: 'l1', offset: -0.5, to: [2.0, 0, 0.75], faceTo: 'lucia' },
    { id: 'susana-se-levanta', type: 'stand', actor: 'susana', with: 'v1', offset: -0.3, durationSec: 0.9 },
    { id: 'susana-se-acerca', type: 'walk', actor: 'susana', after: 'susana-se-levanta', to: [1.25, 0, 0.95], faceTo: 'lucia' },
    { id: 'oscar-sale', type: 'walk', actor: 'oscar', after: 'l5', offset: 0.2, to: [-0.2, 0, 1.2], faceTo: 'lucia' },
    { id: 'abre-cuarto', type: 'propJoint', prop: 'puerta-cuarto', joint: 'leaf', with: 'oscar-sale', toDeg: 95, durationSec: 0.6, sound: 'door-creak' },
    { id: 'marga-entra', type: 'walk', actor: 'marga', after: 'o2', offset: 0.1, to: [3.15, 0, 0.55], faceTo: 'susana' },
    { id: 'abre-2', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'marga-entra', offset: -0.3, toDeg: 95, durationSec: 0.6, sound: 'door-creak' },
    { id: 'cierra-2', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'marga-entra', offset: 2.2, toDeg: 0, durationSec: 0.7, sound: 'click' },
    { id: 'marga-ve', type: 'lookAt', actor: 'marga', with: 'm1', offset: 1.4, target: 'oscar', durationSec: 3 },
    { id: 'marga-deja', type: 'place', actor: 'marga', after: 'm3', offset: 0.1, prop: 'tarta', on: ON_MESA(1.55, -0.12), durationSec: 1.0 },
    { id: 'lucia-graba', type: 'play', actor: 'lucia', with: 'l7', clip: 'present', durationSec: 1.4 },
    { id: 'susana-no', type: 'play', actor: 'susana', with: 'v5', clip: 'dismiss', durationSec: 1.1 },
    { id: 'todos-dani-v', type: 'lookAt', actor: 'susana', with: 'l8', offset: 1.5, target: 'dani', durationSec: 3 },
    { id: 'todos-dani-m', type: 'lookAt', actor: 'marga', with: 'l8', offset: 1.6, target: 'dani', durationSec: 3 },
    { id: 'todos-dani-o', type: 'lookAt', actor: 'oscar', with: 'l8', offset: 1.7, target: 'dani', durationSec: 3 },
    { id: 'salen-lucia', type: 'walk', actor: 'lucia', after: 'l10c', offset: 1.6, to: [4.8, 0, 1.2] },
    { id: 'abre-3', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'salen-lucia', offset: 0.8, toDeg: 95, durationSec: 0.6, sound: 'door-creak' },
    { id: 'cierra-3', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'salen-lucia', offset: 2.8, toDeg: 0, durationSec: 0.6, sound: 'click' },
    { id: 'abre-4', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'oscar-tras', offset: 0.9, toDeg: 95, durationSec: 0.6, sound: 'door-creak' },
    { id: 'oscar-tras', type: 'walk', actor: 'oscar', after: 'm7', offset: 0.1, to: [4.9, 0, 1.5] },
    { id: 'marga-tras', type: 'walk', actor: 'marga', after: 'oscar-tras', offset: -1.6, to: [5.3, 0, 1.2] },
    { id: 'cierra', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'marga-tras', offset: -0.2, toDeg: 0, durationSec: 0.8, sound: 'click' }
  ],
  dialogue: [
    L('d0', 'dani', 'susana', 'Será el vecino. El de verdad.', 'nervous', { at: 0.5 }),
    L('s0', 'susana', 'dani', '¿El de las paredes finas? Dile que pase, que ya nos conocemos.', 'smirk'),
    L('l1', 'lucia', 'dani', '¡Dani! ¡Sorpresa! Pasaba por aquí con unos planos y una botella de champán.', 'joy', { with: 'lucia-entra', offset: 0.9 }),
    L('d1', 'dani', 'lucia', 'Lucía. Estoy... cenando.', 'fear'),
    L('l2', 'lucia', 'susana', 'Ah, hola. ¿Tú no eres la del bar?', 'smirk'),
    L('v1', 'susana', 'lucia', 'Hola, Lucía.', 'neutral'),
    L('l3', 'lucia', 'dani', '¡Me encanta! Dani, cariño, he venido por trabajo. Mi tienda. Tú y yo. Como en los viejos tiempos.', 'laugh'),
    L('d2', 'dani', 'lucia', 'En los viejos tiempos me dejaste por un DJ.', 'sad'),
    L('l4', 'lucia', 'dani', 'Y he aprendido mucho. Por ejemplo, que la música electrónica no se baila agarrados.', 'thinking'),
    L('v2', 'susana', 'lucia', 'Vale.', 'thinking'),
    L('l5', 'lucia', 'susana', 'Lo sé. Tengo medio millón de seguidores que lo confirman.', 'smirk'),
    L('o1', 'oscar', undefined, '¡Achís! Vale, vale, me rindo. Hola a todos. Soy el vecino.', 'nervous', { with: 'oscar-sale', offset: 0.4 }),
    L('v3', 'susana', 'oscar', 'El de las paredes finas.', 'smirk'),
    L('l6', 'lucia', 'oscar', '¡Óscar! ¡El de «hola, Lucía»!', 'joy'),
    L('o2', 'oscar', 'lucia', 'Hola, Lucía. Hola, novia de Dani. Hola... risotto.', 'nervous'),
    L('m1', 'marga', 'susana', '¡Traigo la tarta y la testigo! ¿Llego tarde al desast...?', 'joy', { with: 'marga-entra', offset: 1.0 }),
    L('m2', 'marga', 'oscar', '¿Óscar?', 'surprise', { intensity: 1.4 }),
    L('o3', 'oscar', 'marga', '¿Marga?', 'fear', { intensity: 1.3 }),
    L('v4', 'susana', 'marga', '¿Os conocéis?', 'surprise'),
    L('m3', 'marga', 'susana', 'Cinco años casados. Lo justo para saber que esa colonia se llama Tormenta salvaje y que se compra en una gasolinera.', 'angry'),
    L('o4', 'oscar', 'marga', 'En una gasolinera muy buena.', 'sad'),
    L('d3', 'dani', 'oscar', '¿Tu exmujer es Marga? ¿La Marga de la uno y la dos?', 'surprise'),
    L('o5', 'oscar', 'dani', 'Por algo las quemé.', 'nervous'),
    L('l7', 'lucia', 'dani', '¡Esto es mejor que un reality! Lo voy a grabar.', 'joy'),
    L('v5', 'susana', 'lucia', 'Ni se te ocurra.', 'angry', { intensity: 1.1 }),
    L('m4', 'marga', 'susana', 'Me debes veinte euros. Son las diez menos cuarto y esto ya es un desastre.', 'smirk'),
    L('v6', 'susana', 'marga', 'Y tú acabas de hablar de tu ex. Estamos en paz.', 'smirk'),
    L('l8', 'lucia', 'dani', 'Dani, decide. La tienda, el champán y yo... o esa cena carbonizada.', 'smirk', { intensity: 1.2 }),
    L('d4', 'dani', 'lucia', 'Lucía. Tú y yo ya tuvimos nuestra cena. Duró tres años y la pagué yo.', 'thinking', { after: 'l8', offset: 1.2 }),
    L('l9', 'lucia', 'dani', '¿Perdona?', 'surprise'),
    L('d5', 'dani', 'lucia', 'Te diseño la tienda, si quieres. Con factura. Pero esta noche ceno con Susana. Aunque sea carbón.', 'determined'),
    L('v7', 'susana', 'dani', 'Sobre todo si es carbón.', 'smile'),
    L('l10', 'lucia', 'dani', 'Vaya. Al de la lámpara se le ha encendido la bombilla.', 'smirk'),
    L('l10b', 'lucia', 'dani', 'Me alegro por ti, Dani. De verdad. Aunque me fastidie un montón.', 'sad', { intensity: 0.7 }),
    L('l10c', 'lucia', 'oscar', 'Me voy, que tengo un directo a las once. Óscar, ¿me llevas?', 'smile'),
    L('o6', 'oscar', 'lucia', '¡Claro!', 'joy'),
    L('m5', 'marga', 'oscar', '¿Claro?', 'angry', { intensity: 1.2 }),
    L('o7', 'oscar', 'marga', 'Claro... que no. Tengo el coche en el taller. Desde hace un año.', 'fear'),
    L('m6', 'marga', 'oscar', 'Buena respuesta. Y ahora vete tú también, que me tienes que devolver la colonia. Es mía. Te la regalé yo.', 'smirk'),
    L('o8', 'oscar', 'marga', '¿Me la regalaste tú?', 'surprise'),
    L('m7', 'marga', 'oscar', 'En una gasolinera muy buena.', 'smile', { pauseAfter: 0.2 }),
    L('o9', 'oscar', 'marga', 'Te la devuelvo mañana. Palabra.', 'smile', { with: 'oscar-tras', offset: 0.3 }),
    L('m8', 'marga', 'oscar', 'Mañana estará vacía. Te conozco, Óscar.', 'smirk'),
    L('d6', 'dani', 'susana', '¿Y la tarta?', 'surprise', { with: 'marga-tras', offset: 0.9 }),
    L('v8', 'susana', 'dani', 'La tarta se queda, ¿no?', 'smile', { pauseAfter: 0.6 })
  ],
  sound: [AMB_PISO, BUTTON('v8')]
});

// ---- ESC. 7 — Punto tres (piso, 22:00)
scene('sc-007', 'Punto tres', 'Solos en la cocina con la tarta de Marga, Susana y Dani hablan de verdad; Susana escribe el punto tres de la lista.', 'piso-dani', {
  actors: [
    { id: 'susana', characterId: 'susana', position: [-1.25, 0, -2.2], yawDeg: -25, expression: 'smile', idle: 'idle-relaxed' },
    { id: 'dani', characterId: 'dani', position: [-2.0, 0, -2.2], yawDeg: 25, expression: 'smile', idle: 'idle' }
  ],
  props: [
    { id: 'olla', propId: 'olla', position: ON_ISLA(-2.55, -1.75) },
    { id: 'tarta', propId: 'caja-tarta', position: ON_ISLA(-1.62, -1.55) },
    { id: 'vela-isla', propId: 'vela', position: ON_ISLA(-1.1, -1.45) }
  ],
  shots: [
    { id: 'i-cocina', at: 0, durationSec: 3.2, camera: { ...PISO.kitchen, move: { type: 'push-in', amount: 0.12 } } },
    { id: 'i-final', with: 'v11', offset: -0.2, durationSec: 6, camera: { ...PISO.wide, move: { type: 'pull-out', amount: 0.2 } } }
  ],
  actions: [
    { id: 'apaga-luces', type: 'effect', effect: 'off', at: 0, durationSec: 600, intensity: 0.45 },
    { id: 'dani-mira', type: 'lookAt', actor: 'dani', with: 'd3', target: 'susana', durationSec: 4 },
    { id: 'susana-ríe', type: 'expression', actor: 'susana', with: 'v9', expression: 'laugh', intensity: 0.9, durationSec: 2 }
  ],
  dialogue: [
    L('v1', 'susana', 'dani', 'Así que esto era una cena tranquila.', 'smirk', { at: 0.9 }),
    L('d1', 'dani', 'susana', 'Mi abuela decía que las cenas tranquilas no se recuerdan.', 'smile'),
    L('v2', 'susana', 'dani', 'Tu abuela decía muchas cosas.', 'laugh'),
    L('d2', 'dani', 'susana', 'Casi todas mentira. El risotto no le salió nunca.', 'smile'),
    L('v3', 'susana', 'dani', '¿Y entonces por qué lo has hecho?', 'surprise', { intensity: 0.7 }),
    L('d3', 'dani', 'susana', 'Porque es lo único suyo que se puede invitar a cenar.', 'thinking', { direction: 'en voz baja' }),
    L('v4', 'susana', 'dani', 'Eso ha sido bonito. No lo estropees.', 'smile', { direction: 'en voz baja' }),
    L('d4', 'dani', 'susana', 'Vale. Me callo.', 'nervous'),
    L('v5', 'susana', 'dani', 'Tampoco tanto.', 'smirk'),
    L('d5', 'dani', 'susana', 'Tengo una lista para después de la cena.', 'joy'),
    L('v6', 'susana', 'dani', 'Claro que la tienes.', 'smirk'),
    L('d6', 'dani', 'susana', 'Punto uno: pedir perdón por el risotto. Punto dos: pedir perdón por mi ex. Punto tres...', 'nervous'),
    L('v7', 'susana', 'dani', 'El punto tres lo escribo yo.', 'smirk', { intensity: 1.2 }),
    L('d7', 'dani', 'susana', '¿Y qué pone?', 'surprise'),
    L('v8', 'susana', 'dani', 'Repetir.', 'smirk', { direction: 'susurrando', intensity: 1.3 }),
    L('d8', 'dani', 'susana', '¿Repetir la cena?', 'joy'),
    L('v9', 'susana', 'dani', 'Por Dios, no. La cena no.', 'laugh'),
    L('v10', 'susana', 'dani', 'La próxima vez cocino yo.', 'smile'),
    L('d9', 'dani', 'susana', '¿Tú sabes cocinar?', 'surprise'),
    L('v11', 'susana', 'dani', 'No. Pero pido muy bien a domicilio.', 'smile', { pauseAfter: 0.6 })
  ],
  sound: [AMB_PISO, { id: 'romance', kind: 'music', sound: 'sirena-romance', with: 'd3', offset: -0.5, durationSec: 30, gainDb: -10, fadeIn: 2, fadeOut: 3, duck: true }]
});

// ---- ESC. 8 — ETIQUETA: Veinte euros (bar, 01:55)
scene('sc-008', 'Veinte euros', 'A las dos menos cinco, Óscar vuelve al Sirena con la colonia vacía; Susana paga la apuesta.', 'sirena', {
  actors: [
    { id: 'oscar', characterId: 'oscar', position: [0.2, 0, -0.75], yawDeg: -90, expression: 'smile', idle: 'idle' },
    { id: 'marga', characterId: 'marga', position: [-1.8, 0, -0.75], yawDeg: 90, expression: 'smirk', idle: 'idle' },
    { id: 'susana', characterId: 'susana', position: [5.0, 0, -1.2], yawDeg: -90, expression: 'joy', idle: 'idle-relaxed' },
    { id: 'dani', characterId: 'dani', position: [5.6, 0, -1.2], yawDeg: -90, expression: 'joy', idle: 'idle' }
  ],
  props: [
    { id: 'colonia', propId: 'colonia', position: ON_BAR(-1.0, -0.65) },
    { id: 'vela-barra', propId: 'vela', position: ON_BAR(-1.2, -0.12) }
  ],
  shots: [
    { id: 'i-situacion', at: 0, durationSec: 2.6, camera: BAR.wide },
    { id: 'i-puerta', with: 'abre', offset: -0.1, durationSec: 2.6, camera: BAR.door },
    { id: 'i-final', with: 'd2', offset: -0.2, durationSec: 8, camera: { ...BAR.front, move: { type: 'pull-out', amount: 0.3 } } }
  ],
  actions: [
    { id: 'oscar-sienta', type: 'sit', actor: 'oscar', at: 0, prop: 'taburete-2', durationSec: 0.3 },
    { id: 'marga-coge', type: 'pickUp', actor: 'marga', after: 'o1', offset: 0.1, prop: 'colonia', hand: 'right', durationSec: 1.0 },
    { id: 'marga-mira', type: 'hold', actor: 'marga', after: 'marga-coge', hand: 'right', pose: 'show', durationSec: 0.5 },
    { id: 'abre', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'o5', offset: 0.1, toDeg: 95, durationSec: 0.8, sound: 'door-creak' },
    { id: 'susana-entra', type: 'walk', actor: 'susana', with: 'abre', offset: 0.3, to: [0.35, 0, 0.55], faceTo: 'marga' },
    { id: 'dani-entra', type: 'walk', actor: 'dani', with: 'abre', offset: 0.9, to: [1.05, 0, 0.35], faceTo: 'marga' },
    { id: 'cierra', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'dani-entra', offset: 2.6, toDeg: 0, durationSec: 0.8, sound: 'click' }
  ],
  dialogue: [
    L('m1', 'marga', 'oscar', 'Son las dos menos cinco. ¿Tú qué haces aquí?', 'smirk', { at: 1.2 }),
    L('o1', 'oscar', 'marga', 'He venido a devolverte la colonia.', 'smile'),
    L('m2', 'marga', 'oscar', 'Está vacía.', 'angry', { after: 'marga-mira' }),
    L('o2', 'oscar', 'marga', 'Por eso he tardado. Me la he ido echando por el camino.', 'smirk'),
    L('m3', 'marga', 'oscar', 'Eres idiota.', 'laugh'),
    L('o3', 'oscar', 'marga', 'Pero huelo bien.', 'joy'),
    L('m4', 'marga', 'oscar', 'Hueles a gasolinera.', 'smirk'),
    L('o4', 'oscar', 'marga', 'A una muy buena.', 'smile'),
    L('o5', 'oscar', 'marga', '¿Me pones algo?', 'smile'),
    L('m5', 'marga', 'oscar', 'Agua. Son tres euros.', 'smirk'),
    L('v1', 'susana', 'marga', 'Marga. Te debo veinte euros.', 'joy', { with: 'susana-entra', offset: 1.4 }),
    L('m6', 'marga', 'susana', '¿Ha sido un desastre?', 'surprise'),
    L('v2', 'susana', 'marga', 'El mejor desastre de mi vida.', 'smile'),
    L('d1', 'dani', 'marga', 'Y a las diez estaba comiendo tarta, no cacahuetes. Técnicamente has perdido.', 'smirk'),
    L('m7', 'marga', 'dani', 'Técnicamente, la tarta la pagué yo.', 'smirk'),
    L('o6', 'oscar', 'marga', '¿Otra apuesta? A que estos dos llegan al punto cuatro.', 'joy'),
    L('m8', 'marga', 'oscar', 'Cuarenta a que no.', 'smirk'),
    L('v3', 'susana', 'marga', 'Que nadie me pregunte cuál es el punto cuatro.', 'smirk'),
    L('d2', 'dani', 'susana', 'Mañana va a hacer mucho calor.', 'smirk', { intensity: 1.3 }),
    L('v4', 'susana', 'dani', 'Eso no estaba en la lista.', 'laugh', { pauseAfter: 0.3 }),
    VO('n1', 'Nunca supe cuál era el punto cuatro. Pero esa... es otra cena.', { pauseAfter: 0.8 })
  ],
  sound: [AMB_BAR, BUTTON('v4')]
});

for (const [id, sc] of Object.entries(scenes)) w(`scenes/${id}/scene.json`, sc);

// ------------------------------------------------------------------ story + script generated from the scene data
w('story.json', {
  schemaVersion: 1, status: 'draft',
  facts: [
    { id: 'risotto-abuela', text: 'El risotto de la abuela de Dani nunca le salió bien a nadie.', since: 'ep-002' },
    { id: 'lucia-vuelve', text: 'Lucía, la ex de Dani, ha vuelto a la ciudad para abrir una tienda.', since: 'ep-002' },
    { id: 'oscar-marga', text: 'Óscar, el mejor amigo de Dani, es el exmarido de Marga.', since: 'ep-002' },
    { id: 'tormenta-salvaje', text: 'La colonia Tormenta salvaje de Óscar se la regaló Marga.', since: 'ep-002' },
    { id: 'punto-tres', text: 'Susana escribió el punto tres de la lista de Dani: «Repetir».', since: 'ep-002' }
  ],
  knowledge: [],
  relationships: [
    { a: 'susana', b: 'dani', trustDelta: 0.15, note: 'Dani elige a Susana delante de su ex.' },
    { a: 'dani', b: 'susana', trustDelta: 0.1, note: 'A Susana le gusta «el de la lámpara».' },
    { a: 'marga', b: 'oscar', trustDelta: 0.1, note: 'Óscar vuelve con la colonia vacía.' }
  ],
  emotionalStates: { susana: 'enamorándose', dani: 'aliviado y feliz', marga: 'descolocada', oscar: 'esperanzado', lucia: 'ofendida' },
  events: [
    { id: 'apuestas', text: 'Marga y Susana apuestan sobre la cita.', scene: 'sc-001' },
    { id: 'lucia-llega', text: 'Lucía aparece en el Sirena buscando a Dani.', scene: 'sc-003' },
    { id: 'direccion', text: 'Óscar le da a Lucía la dirección de Dani.', scene: 'sc-004' },
    { id: 'cita', text: 'La cena: risotto quemado y Óscar escondido.', scene: 'sc-005' },
    { id: 'todos-los-ex', text: 'Lucía, Óscar y Marga coinciden en el piso; Dani elige a Susana.', scene: 'sc-006' },
    { id: 'punto-tres', text: 'Susana escribe «Repetir».', scene: 'sc-007' }
  ]
});

const ACTS = { 'sc-000': 'APERTURA', 'sc-001': 'TEASER', 'sc-002': 'ACTO 1 — PLANTEAMIENTO', 'sc-004': 'ACTO 2 — NUDO', 'sc-006': 'ACTO 3 — DESENLACE', 'sc-008': 'ETIQUETA' };
const PLACE = { sirena: 'INT. BAR SIRENA', 'piso-dani': 'INT. PISO DE DANI' };
let g = `# «Tormenta salvaje» — guion (ep. 2)\n\n*Generado desde los archivos de escena: lo que se lee es exactamente lo que se rueda.*\n\n**Logline.** Dani se empeña en cocinar el risotto de su abuela para su primera cita con Susana; entre su mejor amigo escondido, una colonia de gasolinera y la ex que aparece con champán, la cena se quema… y es lo mejor que les podía pasar.\n\n**Siembras y pagos**\n- Las apuestas de Marga (cacahuetes a las diez / hablar del ex) → se pagan en la etiqueta; Marga habla de su ex en el teaser y en el clímax.\n- «El risotto no se abandona nunca» → se abandona por la llamada de Lucía y se quema.\n- La colonia *Tormenta salvaje* → hace llorar a Susana «por los ojos»; Marga la reconoce («de gasolinera»); se la regaló ella; vuelve vacía.\n- «Noches de pasión, volumen tres» (la uno y la dos, quemadas con Marga) → suena sola en la cita; «se quemaron, como el risotto».\n- «El de la lámpara» (ep. 1) → «a mí me gustaba el de la lámpara»; «al de la lámpara se le ha encendido la bombilla».\n- Las listas de Dani → Lucía: «escribe los planes y no los hace»; Susana escribe el punto tres: «Repetir».\n- «Mañana va a hacer calor» (ep. 1) → remate final.\n\n---\n`;
for (const [id, sc] of Object.entries(scenes)) {
  if (ACTS[id]) g += `\n## ${ACTS[id]}\n`;
  g += `\n### ${id.toUpperCase()} — ${PLACE[sc.environmentId]} — «${sc.name}»\n\n*${sc.synopsis}*\n\n`;
  for (const l of sc.dialogue) g += `**${NAMES[l.actor]}${l.voiceOver ? ' (V. O.)' : ''}**${l.direction && !l.voiceOver ? ` *(${l.direction})*` : ''}: ${l.voiceOver ? `*${l.text}*` : l.text}\n`;
}
w('guion.md', g);
console.log('ok', Object.values(scenes).reduce((n, s) => n + s.dialogue.length, 0), 'líneas');
