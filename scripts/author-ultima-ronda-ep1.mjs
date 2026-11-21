// Authoring helper for «Última ronda» ep-001 «Punto dos». The JSON/Markdown it writes under
// examples/projects/ultima-ronda/episodes/ep-001 is the source of truth; this script documents how it was built.
// Story first (logline -> synopsis -> three acts -> beats), then staging. Coverage is automatic (coverage: "auto"):
// the director cuts singles / over-the-shoulders / two-shots; the shots listed here are only inserts.
//   node scripts/author-ultima-ronda-ep1.mjs
import fs from 'node:fs'; import path from 'node:path';
const P = 'examples/projects/ultima-ronda/episodes/ep-001';
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(P, f)), { recursive: true }); fs.writeFileSync(path.join(P, f), typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n'); };

// ------------------------------------------------------------------ staging constants
// Bar counter runs along z at x = -1.2; Susana works behind it (x ~ -1.8, facing +x), Dani sits on stool 1 (x -0.42, z 0.25).
const SUSANA_POS = [-1.78, 0, 0.32], DANI_SEAT = 'taburete-1';
const ON_BAR = (x, z) => [x, 1.06, z];
const CAM = {
  wide: { type: 'static', position: [2.7, 1.95, 3.5], target: [-1.0, 1.1, -0.3], fov: 40 },
  door: { type: 'static', position: [-0.6, 1.62, 1.4], target: [3.9, 1.25, -1.2], fov: 38 },
  barLow: { type: 'static', position: [0.55, 1.5, 1.9], target: [-1.45, 1.32, 0.15], fov: 34 },
  read: { type: 'static', position: [-0.75, 1.55, 1.15], target: [-1.55, 1.32, 0.42], fov: 28 },
  napkin: { type: 'static', position: [-0.55, 1.48, 1.3], target: [-0.5, 1.18, 0.3], fov: 30 },
  neon: { type: 'static', position: [1.2, 1.55, 0.6], target: [0.6, 2.0, -3.1], fov: 30 },
  candle: { type: 'static', position: [-0.95, 1.42, 2.1], target: [-1.05, 1.28, 0.15], fov: 36 },
  front: { type: 'static', position: [-0.9, 1.5, 2.9], target: [-1.0, 1.22, 0.2], fov: 38 }
};
const AMB = { id: 'ambiente', kind: 'ambience', sound: 'room-tone', at: 0, gainDb: -27, fadeIn: 0.3, fadeOut: 0.3 };
const L = (id, actor, text, emotion, extra = {}) => ({ id, actor, text, ...(emotion ? { emotion } : {}), to: actor === 'susana' ? 'dani' : 'susana', ...extra });
// the whole blackout: every practical light and glowing part of the set, plus the set itself
const blackout = (id, timing) => [
  { id: `${id}-sala`, type: 'effect', effect: 'off', ...timing },
  ...['lampara-1', 'lampara-2'].map(p => ({ id: `${id}-${p}`, type: 'effect', effect: 'off', prop: p, ...timing })),
  ...['borde', 'caliz-l', 'caliz-r', 'tallo', 'pie', 'aceituna'].map(part => ({ id: `${id}-neon-${part}`, type: 'effect', effect: 'off', prop: 'neon', part, ...timing })),
  { id: `${id}-led`, type: 'effect', effect: 'off', prop: 'barra', part: 'led', ...timing },
  { id: `${id}-botellero`, type: 'effect', effect: 'off', prop: 'botellero', part: 'fondo', ...timing }
];

// ------------------------------------------------------------------ episode
w('episode.json', {
  schemaVersion: 2, id: 'ep-001', type: 'episode', name: 'Punto dos', number: 1,
  scenes: ['sc-001', 'sc-002', 'sc-003'], targetDurationSec: 150,
  score: {
    theme: { music: 'sirena-tema', gainDb: -4, durationSec: 8, fadeOut: 3 },
    underscore: { music: 'sirena-cama', gainDb: -14 },
    bumpers: { music: 'sirena-cortinilla', gainDb: -4, durationSec: 4.2, leadSec: 1.1 }, sceneFade: { durationSec: 1.3, holdSec: 0.9 },
    ending: { music: 'sirena-tema', gainDb: -4, durationSec: 7, fadeOut: 2 }
  },
  render: { width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }, status: 'draft'
});

// ------------------------------------------------------------------ writing: synopsis first
w('sinopsis.md', `# Última ronda — «Punto dos» (ep. 1)

**Logline.** Dani lleva tres meses yendo al bar de Susana a las doce menos cinco con la excusa de «revisar la iluminación»; esta noche trae en una servilleta la lista para invitarla a cenar… y la luz decide irse justo cuando le toca el punto dos.

**Tema.** Lo que no te atreves a decir no se arregla con un plan: se dice.

**Personajes y lo que está en juego**
- **Susana (34)**: dueña del Sirena. *Quiere* que Dani se atreva de una vez. *No soporta* las frases ensayadas. Se divierte poniéndole nervioso.
- **Dani (37)**: el arquitecto que reformó el bar. *Quiere* invitarla a cenar. *Teme* hacer el ridículo. Cuando se pone nervioso, habla del tiempo.

**Sinopsis.** A las doce menos seis, Susana apuesta consigo misma a que Dani llegará puntual; llega a las doce menos cinco con su excusa de siempre: comprobar la iluminación. Susana le sirve un cóctel nuevo que «todavía no tiene nombre, porque le falta algo». En cuanto ella se gira, Dani repasa en voz baja su lista: elogiar el cóctel, preguntar, no hablar del tiempo.

El punto uno sale regular: el elogio acaba en «hace buena noche, ¿eh?». Susana ve la servilleta, la lee en voz alta y le pilla incumpliendo el punto tres en cuatro segundos. Cuando le pide el punto dos, salta el automático y el bar se queda a oscuras, solo con la vela de la barra. A oscuras, Dani se atreve a empezar… y se acobarda en el último segundo: le ofrece cambiarle una lámpara que zumba.

Dani se levanta para irse. Susana le para con tres palabras: «La lista. Punto dos». Él vuelve y la invita a cenar. Ella confiesa que lleva tres meses poniéndole poco hielo para que se quede más rato, y que el cóctel no tenía nombre porque le faltaba alguien que se atreviera a pedirlo. Vuelve la luz. El cóctel se llama «Punto dos». Y el punto tres, el del tiempo, Susana lo rompe ella: «Mañana va a hacer mucho calor».

**Estructura**
1. **Planteamiento** (esc. 1): el bar al cierre, la rutina de las doce menos cinco, el cóctel sin nombre y la lista secreta. **Detonante**: Dani decide cumplir la lista esta noche.
2. **Nudo** (esc. 2): el elogio fallido → la lista descubierta (humillación) → el apagón (giro) → la confesión a medias y la retirada con la lámpara (peor momento).
3. **Desenlace** (esc. 3): Dani se va → «punto dos» (clímax) → la confesión de Susana y el nombre del cóctel (resolución) → vuelve la luz → remate del tiempo (*tag*).
`);

w('guion.md', `# «Punto dos» — guion

**Logline.** Dani trae una lista en una servilleta para invitar a Susana a cenar; el apagón le deja sin excusas.

| Acto | Escena | Qué cambia |
|---|---|---|
| Planteamiento | 1. Las doce menos cinco | Susana espera a Dani; el cóctel sin nombre; la lista: elogiar, preguntar, no hablar del tiempo. |
| Nudo | 2. La lista | Elogio fallido, Susana lee la servilleta, salta la luz, Dani casi lo dice… y sale por la lámpara. |
| Desenlace | 3. Punto dos | Dani se va, Susana le frena, la invitación, la confesión de Susana, vuelve la luz, el nombre del cóctel. |

**Siembras y pagos**
- «Las doce menos cinco» y la apuesta de Susana → demuestra que ella también le espera.
- El cóctel «sin nombre, le falta algo» → se llama «Punto dos» cuando él se atreve.
- La lista (punto 3: no hablar del tiempo) → Dani la incumple al instante; Susana la rompe al final a su favor.
- «Revisar la iluminación» → el apagón; la lámpara que «zumba» es la excusa de su retirada.
- El poco hielo → la confesión de Susana.

---

## ESC. 1 — INT. BAR SIRENA — NOCHE (las doce menos seis)
Barra de madera oscura, botellero morado, neón rosa. SUSANA agita la coctelera mirando el reloj.

**SUSANA** *(a la coctelera)*: Las doce menos seis. Si llega puntual, me debo diez euros a mí misma.
*Se abre la puerta. Entra DANI, gafas, camisa azul abierta.*
**SUSANA**: Doce menos cinco. Pago yo.
**DANI**: ¿Perdón?
**SUSANA**: Nada, hablaba con la coctelera. ¿Vienes otra vez a revisar la iluminación?
**DANI** *(acercándose)*: Sí. Bueno… con la reforma, la luz cálida a estas horas hay que vigilarla.
**SUSANA**: Y la vigilas muy de cerca. Siempre desde el mismo taburete.
**DANI** *(se sienta)*: Es el que tiene mejor ángulo.
**SUSANA**: ¿De la lámpara… o de la camarera?
**DANI**: De la… de la lámpara. Clarísimamente de la lámpara.
*Susana sirve una copa rosa y se la deja delante.*
**SUSANA**: Cóctel nuevo. Todavía no tiene nombre.
**DANI**: ¿Por qué no?
**SUSANA**: Porque le falta algo. Ya lo descubrirás.
*Susana se gira hacia el botellero. Dani saca una servilleta escrita.*
**DANI** *(en voz baja)*: Punto uno, elogiar el cóctel. Punto dos, preguntar. Punto tres, no hablar del tiempo.

## ESC. 2 — INT. BAR SIRENA — NOCHE (continuación)
**DANI** *(tras probarlo)*: Esto es increíble. Es dulce y luego te da una bofetada.
**SUSANA**: Como yo.
**DANI**: ¡Ja! Sí. No. Quiero decir… Hace buena noche, ¿eh? Fresquita.
**SUSANA** *(mira la servilleta)*: ¿Eso es una lista?
**DANI**: No. Es una servilleta.
*Susana la coge y la lee.*
**SUSANA**: «Punto tres: no hablar del tiempo». Llevas cuatro segundos incumpliéndolo.
**DANI**: Que me trague el suelo. El suelo que yo mismo diseñé.
**SUSANA**: Lo diseñaste muy bien. ¿Y el punto dos?
*Clic. Se va la luz. Solo queda la vela de la barra.*
**DANI**: ¿Eso… lo he hecho yo?
**SUSANA** *(en voz baja)*: Salta el automático cada vez que alguien tarda demasiado en decir algo.
**DANI** *(en voz baja)*: A oscuras es más fácil. No te veo la cara de saber lo que voy a decir.
**SUSANA** *(susurrando)*: Entonces dilo antes de que vuelva la luz.
**DANI**: Vale. Susana. Hace tres meses que vengo a revisar la iluminación porque…
**DANI**: …porque la lámpara de la izquierda zumba. Mañana te la cambio.
**SUSANA** *(decepcionada)*: La lámpara. Claro.

## ESC. 3 — INT. BAR SIRENA — NOCHE (continuación, a oscuras)
**DANI** *(se levanta)*: Debería irme. Es tarde.
*Camina hacia la puerta.*
**SUSANA**: Dani. La lista. Punto dos.
*Dani se para. Vuelve a la barra.*
**DANI**: ¿Cenarías conmigo? Mañana. Sin lámparas.
**SUSANA** *(sonríe)*: Llevo tres meses poniéndote poco hielo para que te quedes más rato.
**DANI**: ¿Y por qué no me lo preguntaste tú?
**SUSANA**: Porque el cóctel no tenía nombre. Le faltaba alguien que se atreviera a pedirlo.
*Vuelve la luz: lámparas, botellero, el neón de la copa.*
**DANI**: ¿Y cómo se llama?
**SUSANA**: Punto dos.
**DANI** *(riendo)*: ¿Y el punto tres? No hablar del tiempo.
**SUSANA**: Pues mañana… va a hacer mucho calor.
*Remate musical. FIN.*
`);

w('story.json', {
  schemaVersion: 1, status: 'draft',
  facts: [
    { id: 'lista-servilleta', text: 'Dani apuntó en una servilleta su plan para invitar a Susana a cenar.', since: 'ep-001' },
    { id: 'poco-hielo', text: 'Susana le ponía poco hielo a Dani para que se quedara más rato.', since: 'ep-001' },
    { id: 'coctel-punto-dos', text: 'El cóctel nuevo de Susana se llama «Punto dos».', since: 'ep-001' },
    { id: 'primera-cita', text: 'Dani invitó a Susana a cenar y ella aceptó.', since: 'ep-001' }
  ],
  knowledge: [],
  relationships: [
    { a: 'susana', b: 'dani', trustDelta: 0.15, note: 'Dani se atreve a pedirle una cita.' },
    { a: 'dani', b: 'susana', trustDelta: 0.15, note: 'Susana le confiesa que también le esperaba.' }
  ],
  emotionalStates: { susana: 'ilusionada y divertida', dani: 'eufórico' },
  events: [
    { id: 'llegada', text: 'Dani llega a las doce menos cinco con su lista.', scene: 'sc-001' },
    { id: 'apagon', text: 'Se va la luz mientras Susana le pide el punto dos.', scene: 'sc-002' },
    { id: 'cita', text: 'Dani invita a Susana a cenar; el cóctel se llama «Punto dos».', scene: 'sc-003' }
  ]
});

// ------------------------------------------------------------------ scenes
const baseScene = (id, name, synopsis) => ({ schemaVersion: 2, id, name, synopsis, environmentId: 'sirena', durationSec: 'auto', tailSec: 0.6, autoLook: true, autoActing: 1, coverage: 'auto' });
const shake = (start) => [ // a cocktail shake: the held shaker goes up and down three times
  { id: 'agita-1', type: 'hold', actor: 'susana', ...start, hand: 'right', pose: 'raised', durationSec: 0.28 },
  { id: 'agita-2', type: 'hold', actor: 'susana', after: 'agita-1', hand: 'right', pose: 'front', durationSec: 0.24 },
  { id: 'agita-3', type: 'hold', actor: 'susana', after: 'agita-2', hand: 'right', pose: 'raised', durationSec: 0.24 },
  { id: 'agita-4', type: 'hold', actor: 'susana', after: 'agita-3', hand: 'right', pose: 'front', durationSec: 0.24 },
  { id: 'agita-5', type: 'hold', actor: 'susana', after: 'agita-4', hand: 'right', pose: 'raised', durationSec: 0.24 },
  { id: 'agita-6', type: 'hold', actor: 'susana', after: 'agita-5', hand: 'right', pose: 'front', durationSec: 0.3 }
];

// ---- ESC. 1
w('scenes/sc-001/scene.json', {
  ...baseScene('sc-001', 'Las doce menos cinco', 'Susana espera a Dani; el cóctel sin nombre; la lista secreta.'),
  actors: [
    { id: 'susana', characterId: 'susana', position: SUSANA_POS, yawDeg: 70, expression: 'smirk', idle: 'idle-relaxed' },
    { id: 'dani', characterId: 'dani', position: [5.0, 0, -1.2], yawDeg: -90, expression: 'nervous', idle: 'idle' }
  ],
  props: [
    { id: 'coctelera', propId: 'coctelera', heldBy: { actor: 'susana', hand: 'right' } },
    { id: 'copa', propId: 'copa', position: ON_BAR(-1.32, 0.62) },
    { id: 'servilleta', propId: 'servilleta', heldBy: { actor: 'dani', hand: 'left' } },
    { id: 'vela-barra', propId: 'vela', position: ON_BAR(-1.2, -0.12) }
  ],
  shots: [
    { id: 'i-apertura', at: 0, durationSec: 3.2, camera: { ...CAM.barLow, move: { type: 'push-in', amount: 0.1 } }, transitionIn: { type: 'fade', durationSec: 0.8 }, notes: 'Susana agita la coctelera mirando el reloj.' },
    { id: 'i-puerta', with: 'puerta-abre', offset: -0.2, durationSec: 2.6, camera: CAM.door, notes: 'Entra Dani.' },
    { id: 'i-copa', with: 'v-copa', offset: 0.3, durationSec: 2.2, camera: CAM.candle, notes: 'La copa rosa a la luz de la vela.' },
    { id: 'i-servilleta', with: 'd-lista', offset: 0.1, durationSec: 3.0, camera: CAM.napkin, notes: 'La lista, en secreto.' }
  ],
  actions: [
    ...shake({ at: 0.3 }),
    { id: 'mira-reloj', type: 'lookAt', actor: 'susana', at: 0.2, target: [-0.4, 2.5, -3.2], durationSec: 2.6 },
    { id: 'puerta-abre', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'v1', offset: 0.15, toDeg: 95, durationSec: 0.9, sound: 'door-creak' },
    { id: 'dani-entra', type: 'walk', actor: 'dani', with: 'puerta-abre', offset: 0.35, to: [0.2, 0, 0.35], faceTo: 'susana' },
    { id: 'puerta-cierra', type: 'propJoint', prop: 'puerta', joint: 'leaf', with: 'dani-entra', offset: 2.2, toDeg: 0, durationSec: 0.8, sound: 'click' },
    { id: 'susana-mira-dani', type: 'lookAt', actor: 'susana', with: 'puerta-abre', offset: 0.4, target: 'dani', durationSec: 2 },
    { id: 'dani-se-sienta', type: 'sit', actor: 'dani', after: 'dani-entra', prop: DANI_SEAT, durationSec: 1.0 },
    { id: 'deja-coctelera', type: 'place', actor: 'susana', with: 'v6', offset: 0.3, prop: 'coctelera', on: ON_BAR(-1.36, 1.0), durationSec: 1.0 },
    { id: 'coge-copa', type: 'pickUp', actor: 'susana', after: 'deja-coctelera', prop: 'copa', hand: 'right', durationSec: 1.0 },
    { id: 'v-copa', type: 'place', actor: 'susana', after: 'coge-copa', prop: 'copa', on: { prop: 'barra', anchor: 'cliente' }, durationSec: 1.1 },
    { id: 'susana-se-gira', type: 'turn', actor: 'susana', after: 'v8', offset: 0.2, yawDeg: -90, durationSec: 0.9 },
    { id: 'dani-saca-lista', type: 'hold', actor: 'dani', with: 'susana-se-gira', offset: 0.3, hand: 'left', pose: 'show', durationSec: 0.8 },
    { id: 'dani-mira-lista', type: 'lookAt', actor: 'dani', with: 'dani-saca-lista', offset: 0.3, target: { actor: 'dani', bone: 'leftHand' }, mode: 'head', durationSec: 4.5 },
    { id: 'deja-lista', type: 'place', actor: 'dani', after: 'd-lista', offset: 0.2, prop: 'servilleta', on: ON_BAR(-0.92, 0.0), durationSec: 0.9 }
  ],
  dialogue: [
    L('v1', 'susana', 'Las doce menos seis. Si llega puntual, me debo diez euros a mí misma.', 'smirk', { at: 1.6, to: undefined, direction: 'para sí misma' }),
    L('v2', 'susana', 'Doce menos cinco. Pago yo.', 'smile', { with: 'dani-entra', offset: 0.6 }),
    L('d1', 'dani', '¿Perdón?', 'surprise'),
    L('v3', 'susana', 'Nada, hablaba con la coctelera. ¿Vienes otra vez a revisar la iluminación?', 'smirk'),
    L('d2', 'dani', 'Sí. Bueno... con la reforma, la luz cálida a estas horas hay que vigilarla.', 'nervous'),
    L('v4', 'susana', 'Y la vigilas muy de cerca. Siempre desde el mismo taburete.', 'smirk', { after: 'dani-se-sienta', offset: -0.4 }),
    L('d3', 'dani', 'Es el que tiene mejor ángulo.', 'smile'),
    L('v5', 'susana', '¿De la lámpara... o de la camarera?', 'smirk', { intensity: 1.2 }),
    L('d4', 'dani', 'De la... de la lámpara. Clarísimamente de la lámpara.', 'nervous', { intensity: 1.2 }),
    L('v6', 'susana', 'Cóctel nuevo. Todavía no tiene nombre.', 'joy', { after: 'd4', offset: 0.1 }),
    L('d5', 'dani', '¿Por qué no?', 'thinking', { after: 'v-copa', offset: -0.3 }),
    L('v8', 'susana', 'Porque le falta algo. Ya lo descubrirás.', 'smirk'),
    L('d-lista', 'dani', 'Punto uno, elogiar el cóctel. Punto dos, preguntar. Punto tres, no hablar del tiempo.', 'nervous', { after: 'dani-saca-lista', offset: 0.1, to: undefined, direction: 'en voz baja' })
  ],
  sound: [AMB]
});

// ---- ESC. 2
w('scenes/sc-002/scene.json', {
  continuous: true,
  ...baseScene('sc-002', 'La lista', 'El elogio fallido, la servilleta leída en voz alta, el apagón y la retirada por la lámpara.'),
  actors: [
    { id: 'susana', characterId: 'susana', position: SUSANA_POS, yawDeg: -90, expression: 'smirk', idle: 'idle-relaxed' },
    { id: 'dani', characterId: 'dani', position: [0.2, 0, 0.35], yawDeg: -90, expression: 'nervous', idle: 'idle' }
  ],
  props: [
    { id: 'copa', propId: 'copa', on: { prop: 'barra', anchor: 'cliente' } },
    { id: 'coctelera', propId: 'coctelera', position: ON_BAR(-1.36, 1.0) },
    { id: 'servilleta', propId: 'servilleta', position: ON_BAR(-0.92, 0.0) },
    { id: 'vela-barra', propId: 'vela', position: ON_BAR(-1.2, -0.12) }
  ],
  shots: [
    { id: 'i-situacion', at: 0, durationSec: 2.2, camera: CAM.wide },
    { id: 'i-lee', with: 'v10', offset: -0.1, durationSec: 2.6, camera: CAM.read, notes: 'Susana lee la servilleta.' },
    { id: 'i-apagon', with: 'apagon-sala', offset: -0.05, durationSec: 2.4, camera: CAM.wide, notes: 'El bar se queda a oscuras.' },
    { id: 'i-vela', with: 'v13', offset: -0.1, durationSec: 3.2, camera: { ...CAM.candle, move: { type: 'push-in', amount: 0.12 } }, notes: 'Los dos a la luz de la vela.' }
  ],
  actions: [
    { id: 'sentado', type: 'sit', actor: 'dani', at: 0, prop: DANI_SEAT, durationSec: 0.3 },
    { id: 'susana-se-vuelve', type: 'turn', actor: 'susana', at: 0.2, towards: 'dani', durationSec: 0.9 },
    { id: 'dani-coge', type: 'pickUp', actor: 'dani', at: 0.4, prop: 'copa', hand: 'right', durationSec: 1.0 },
    { id: 'bebe', type: 'hold', actor: 'dani', after: 'dani-coge', hand: 'right', pose: 'raised', durationSec: 0.6 },
    { id: 'baja-copa', type: 'hold', actor: 'dani', after: 'bebe', offset: 0.6, hand: 'right', pose: 'front', durationSec: 0.6 },
    { id: 'susana-coge-lista', type: 'pickUp', actor: 'susana', after: 'v9', offset: 0.1, prop: 'servilleta', hand: 'left', durationSec: 1.0 },
    { id: 'susana-lee', type: 'hold', actor: 'susana', after: 'susana-coge-lista', hand: 'left', pose: 'show', durationSec: 0.6 },
    { id: 'susana-mira-lista', type: 'lookAt', actor: 'susana', with: 'susana-lee', target: { actor: 'susana', bone: 'leftHand' }, mode: 'head', durationSec: 2.6 },
    { id: 'dani-tapa', type: 'play', actor: 'dani', with: 'd10', clip: 'facepalm', durationSec: 1.6 },
    { id: 'click-apagon', type: 'effect', effect: 'flicker', prop: 'lampara-1', after: 'v11', offset: 0.15, durationSec: 0.35 },
    ...blackout('apagon', { after: 'v11', offset: 0.5, durationSec: 600 }),
    { id: 'susana-se-acerca', type: 'walk', actor: 'susana', after: 'd11', offset: 0.1, to: [-1.62, 0, 0.2], faceTo: 'dani', gait: 'walk' },
    { id: 'susana-suelta-lista', type: 'place', actor: 'susana', with: 'susana-se-acerca', prop: 'servilleta', on: ON_BAR(-1.25, 0.2), durationSec: 0.8 },
    { id: 'susana-decepcion', type: 'expression', actor: 'susana', with: 'v14', expression: 'sad', intensity: 0.7, durationSec: 1.4 }
  ],
  dialogue: [
    L('d7', 'dani', 'Esto es increíble. Es dulce y luego te da una bofetada.', 'joy', { after: 'bebe', offset: 0.3 }),
    L('v7', 'susana', 'Como yo.', 'smirk', { intensity: 1.3 }),
    L('d8', 'dani', '¡Ja! Sí. No. Quiero decir... Hace buena noche, ¿eh? Fresquita.', 'nervous', { intensity: 1.2 }),
    L('v9', 'susana', '¿Eso es una lista?', 'surprise', { intensity: 0.6 }),
    L('d9', 'dani', 'No. Es una servilleta.', 'fear'),
    L('v10', 'susana', 'Punto tres: no hablar del tiempo. Llevas cuatro segundos incumpliéndolo.', 'smirk', { after: 'susana-lee', offset: -0.2 }),
    L('d10', 'dani', 'Que me trague el suelo. El suelo que yo mismo diseñé.', 'sad'),
    L('v11', 'susana', 'Lo diseñaste muy bien. ¿Y el punto dos?', 'smirk', { intensity: 1.2 }),
    L('d11', 'dani', '¿Eso... lo he hecho yo?', 'surprise', { with: 'apagon-sala', offset: 0.7 }),
    L('v12', 'susana', 'Salta el automático cada vez que alguien tarda demasiado en decir algo.', 'smirk', { direction: 'en voz baja' }),
    L('d12', 'dani', 'A oscuras es más fácil. No te veo la cara de saber lo que voy a decir.', 'thinking', { direction: 'en voz baja' }),
    L('v13', 'susana', 'Entonces dilo antes de que vuelva la luz.', 'smirk', { direction: 'susurrando', intensity: 1.3 }),
    L('d13', 'dani', 'Vale. Susana. Hace tres meses que vengo a revisar la iluminación porque...', 'nervous'),
    L('d14', 'dani', '...porque la lámpara de la izquierda zumba. Mañana te la cambio.', 'nervous', { pauseAfter: 0.5 }),
    L('v14', 'susana', 'La lámpara. Claro.', 'sad', { intensity: 0.8 })
  ],
  sound: [AMB,
    { id: 'clic', kind: 'sfx', sound: 'click', with: 'apagon-sala', gainDb: -4 },
    { id: 'zumbido-muere', kind: 'sfx', sound: 'whoosh', with: 'apagon-sala', gainDb: -16 }]
});

// ---- ESC. 3
w('scenes/sc-003/scene.json', {
  continuous: true,
  ...baseScene('sc-003', 'Punto dos', 'Dani se va, Susana le frena; la invitación, la confesión, vuelve la luz y el nombre del cóctel.'),
  actors: [
    { id: 'susana', characterId: 'susana', position: [-1.62, 0, 0.2], yawDeg: 80, expression: 'sad', idle: 'idle-relaxed' },
    { id: 'dani', characterId: 'dani', position: [0.2, 0, 0.35], yawDeg: -90, expression: 'nervous', idle: 'idle' }
  ],
  props: [
    { id: 'copa', propId: 'copa', heldBy: { actor: 'dani', hand: 'right' } },
    { id: 'coctelera', propId: 'coctelera', position: ON_BAR(-1.36, 1.0) },
    { id: 'servilleta', propId: 'servilleta', position: ON_BAR(-1.25, 0.2) },
    { id: 'vela-barra', propId: 'vela', position: ON_BAR(-1.2, -0.12) }
  ],
  shots: [
    { id: 'i-oscuro', at: 0, durationSec: 2.2, camera: CAM.candle },
    { id: 'i-se-va', with: 'dani-se-va', offset: 0.3, durationSec: 2.4, camera: CAM.wide, notes: 'Dani camina hacia la puerta.' },
    { id: 'i-luz', with: 'luz-vuelve', offset: -0.05, durationSec: 2.0, camera: CAM.neon, notes: 'Vuelve el neón.' },
    { id: 'i-final', with: 'v19', offset: -0.2, durationSec: 6, camera: { ...CAM.front, move: { type: 'pull-out', amount: 0.25 } }, notes: 'Remate.' }
  ],
  actions: [
    { id: 'sentado', type: 'sit', actor: 'dani', at: 0, prop: DANI_SEAT, durationSec: 0.3 },
    ...blackout('oscuro', { at: 0, until: 'luz-vuelve' }),
    { id: 'dani-deja-copa', type: 'place', actor: 'dani', at: 0.15, prop: 'copa', on: { prop: 'barra', anchor: 'cliente' }, durationSec: 0.9 },
    { id: 'dani-se-levanta', type: 'stand', actor: 'dani', with: 'd15', offset: 0.1, durationSec: 0.9 },
    { id: 'dani-se-va', type: 'walk', actor: 'dani', after: 'dani-se-levanta', to: [1.15, 0, 0.0] },
    { id: 'dani-se-para', type: 'turn', actor: 'dani', after: 'v15', offset: -0.4, towards: 'susana', durationSec: 0.8 },
    { id: 'dani-vuelve', type: 'walk', actor: 'dani', after: 'dani-se-para', offset: 0.2, to: [-0.15, 0, 0.45], faceTo: 'susana' },
    { id: 'susana-sonrie', type: 'expression', actor: 'susana', with: 'd16', offset: 0.8, expression: 'smile', intensity: 1 },
    { id: 'luz-vuelve', type: 'effect', effect: 'flicker', prop: 'lampara-2', after: 'v17', offset: 0.3, durationSec: 0.4 },
    { id: 'dani-rie', type: 'expression', actor: 'dani', with: 'd19', expression: 'laugh', intensity: 0.8, durationSec: 2.5 },
    { id: 'susana-guino', type: 'expression', actor: 'susana', with: 'v19', offset: 0.6, expression: 'smirk', intensity: 1.2 }
  ],
  dialogue: [
    L('d15', 'dani', 'Debería irme. Es tarde.', 'sad', { at: 0.5 }),
    L('v15', 'susana', 'Dani. La lista. Punto dos.', 'determined', { after: 'dani-se-va', offset: -0.9, intensity: 1.1 }),
    L('d16', 'dani', '¿Cenarías conmigo? Mañana. Sin lámparas.', 'determined', { after: 'dani-vuelve', offset: -0.3 }),
    L('v16', 'susana', 'Llevo tres meses poniéndote poco hielo para que te quedes más rato.', 'smirk', { intensity: 1.2 }),
    L('d17', 'dani', '¿Y por qué no me lo preguntaste tú?', 'surprise'),
    L('v17', 'susana', 'Porque el cóctel no tenía nombre. Le faltaba alguien que se atreviera a pedirlo.', 'smirk', { direction: 'en voz baja' }),
    L('d18', 'dani', '¿Y cómo se llama?', 'joy', { after: 'luz-vuelve', offset: 0.5 }),
    L('v18', 'susana', 'Punto dos.', 'smirk', { intensity: 1.3 }),
    L('d19', 'dani', '¿Y el punto tres? No hablar del tiempo.', 'laugh'),
    L('v19', 'susana', 'Pues mañana... va a hacer mucho calor.', 'smirk', { intensity: 1.4, pauseAfter: 0.2 })
  ],
  sound: [AMB,
    { id: 'romance', kind: 'music', sound: 'sirena-romance', with: 'd16', offset: -0.3, durationSec: 14, gainDb: -10, fadeIn: 1.5, fadeOut: 2.5, duck: true },
    { id: 'clic-luz', kind: 'sfx', sound: 'click', with: 'luz-vuelve', gainDb: -5 },
    { id: 'remate', kind: 'music', sound: 'sirena-remate', after: 'v19', offset: 0.05, durationSec: 1.8, gainDb: -2, duck: false }]
});
console.log('ok');
