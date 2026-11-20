// Authoring helper for the pilot episode «El último turno» (ep-001). The JSON/Markdown files it writes are the
// source of truth; this script only documents how they were built. Re-running it overwrites ep-001.
//   node scripts/author-pilot-episode.mjs
import fs from 'node:fs'; import path from 'node:path';
const P = 'examples/projects/el-ultimo-turno/episodes/ep-001';
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(P, f)), { recursive: true }); fs.writeFileSync(path.join(P, f), typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n'); };
for (const d of fs.existsSync(path.join(P, 'scenes')) ? fs.readdirSync(path.join(P, 'scenes')) : []) if (!['sc-001', 'sc-002', 'sc-003', 'sc-004'].includes(d)) fs.rmSync(path.join(P, 'scenes', d), { recursive: true, force: true });

// ------------------------------------------------------------------ helpers
const ROBOT = { id: 'robot', propId: 'robot-r7', position: [0.25, 0, -0.85], yawDeg: -35 };
const robotRest = (tilt = 22) => [
  { id: 'panel', type: 'propJoint', prop: 'robot', joint: 'panel', at: 0, fromDeg: 95, toDeg: 95, durationSec: 0.05 },
  { id: 'cabeza-baja', type: 'propJoint', prop: 'robot', joint: 'headTilt', at: 0, fromDeg: tilt, toDeg: tilt, durationSec: 0.05 }
];
const AMB = { id: 'ambiente', kind: 'ambience', sound: 'workshop-ambience', at: 0, gainDb: -23, fadeIn: 0.3, fadeOut: 0.3 };
// static cameras reused across scenes
const CAM = {
  establishing: { type: 'static', position: [1.6, 2.2, 5.6], target: [-0.6, 1, -1.1], fov: 38 },
  robotFace: { type: 'static', position: [0.45, 1.12, 0.95], target: [0.1, 0.88, -0.7], fov: 30 },
  panelInsert: { type: 'static', position: [1.15, 1.05, 0.55], target: [0.2, 0.62, -0.85], fov: 40 },
  door: { type: 'static', position: [2.6, 1.75, 3.4], target: [-2.4, 1.15, 0.2], fov: 40 },
  floorLow: { type: 'static', position: [0.9, 0.55, 1.6], target: [-0.6, 0.35, -0.3], fov: 42 },
  consoleInsert: { type: 'static', position: [2.0, 1.35, -0.45], target: [3.7, 0.95, -1.3], fov: 34 },
  consoleSide: { type: 'static', position: [3.85, 1.5, 0.45], target: [3.4, 1.0, -1.2], fov: 36 },
  robotBoot: { type: 'static', position: [1.3, 1.45, 1.1], target: [0.1, 0.85, -0.7], fov: 32 },
  finale: { type: 'static', position: [2.6, 1.9, 3.6], target: [0, 0.95, -0.6], fov: 34 }
};
const fc = (framing, subject, extra = {}) => ({ framing, subject, fov: framing === 'close' ? 30 : 32, ...extra });

// ------------------------------------------------------------------ episode
w('episode.json', {
  schemaVersion: 2, id: 'ep-001', type: 'episode', name: 'El último turno', number: 1,
  scenes: ['sc-001', 'sc-002', 'sc-003', 'sc-004'], targetDurationSec: 150,
  music: [{ id: 'tema', kind: 'music', sound: 'ultimo-turno-tema', at: 0, gainDb: -21, fadeIn: 2, fadeOut: 4 }],
  render: { width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }, status: 'draft'
});

// ------------------------------------------------------------------ writing documents
w('sinopsis.md', `# El último turno — sinopsis

**Logline.** La noche antes de la inspección que decidirá si cierran el Taller 7, Bruno quema el núcleo del robot R-7 intentando prepararle una sorpresa a su socia Lara… y, en vez de contárselo, lo esconde.

**Tema.** Esconder un problema siempre lo hace más grande.

**Personajes y lo que está en juego**
- **Bruno (46)**: inventor sentimental y desastre organizado. *Quiere* que el R-7 pase la inspección y sorprender a Lara por el sexto aniversario del taller. *Teme* decepcionarla otra vez (el año pasado le ocultó una deuda).
- **Lara (33)**: su socia, práctica y con la lengua afilada. *Quiere* aprobar la inspección. *Teme* que Bruno le vuelva a mentir.
- **R-7**: el robot del taller. No habla: pita, gira la cabeza y levanta los brazos. Es el corazón cómico del episodio.

**Sinopsis.** Bruno le promete al R-7 que mañana dará «diez pasitos» ante la inspectora y el taller seguirá abierto; además, esta noche le está preparando una sorpresa a Lara. Al tocar el panel, el núcleo revienta en chispas y humo. Lara entra justo entonces y huele a quemado; Bruno esconde el fusible a la espalda y se inventa excusas, mientras el robot le delata con un pitido triste.

Lara no se lo traga. Cada «nada grave» de Bruno le recuerda la deuda de doce mil euros. Cuando el fusible se le cae al suelo, Lara descubre la verdad: es el fusible del núcleo, ya no se fabrica y mañana les cierran. Hundido, Bruno confiesa por qué: le estaba poniendo al R-7 un módulo para que le hiciera el café a Lara por los seis años del taller. Lara se ablanda… y decide que no van a cerrar por un fusible: la vieja consola lleva uno igual, aunque eso suponga apagar «toda la contabilidad».

Cambian el fusible, el R-7 arranca… y vuelve a echar chispas. Lara encuentra la causa real: un tornillo suelto tocando el núcleo. Bruno, al final, sí estaba «ajustando unos tornillos». Lo aprieta, el R-7 vuelve a la vida y Bruno lo celebra. Ya animado, propone instalar el módulo del café, y Lara le corta en seco: «Ni se te ocurra».

**Estructura**
1. **Planteamiento** (esc. 1): el taller, Bruno, el R-7, la inspección de mañana y la sorpresa secreta. **Detonante**: el núcleo se quema y Bruno lo esconde.
2. **Nudo** (esc. 2–3): Lara sospecha → el fusible cae → no hay repuesto (peor momento) → confesión del regalo (giro emocional) → plan de la consola.
3. **Desenlace** (esc. 4): el cambio de fusible falla (clímax) → el tornillo suelto (pago del chiste) → el R-7 vive (resolución) → el módulo del café (*tag*).
`);

w('guion.md', `# El último turno — guion

Episodio 1 · comedia de situación · ~2,5 min · un único decorado (Taller 7).

## Logline

La noche antes de la inspección que decidirá si cierran el Taller 7, Bruno quema el núcleo del robot R-7 intentando prepararle una sorpresa a su socia Lara… y, en vez de contárselo, lo esconde.

## Premisa y tema

Bruno y Lara son socios desde hace seis años; el año pasado él le ocultó una deuda y ella todavía no se lo ha perdonado del todo. El episodio enfrenta el impulso de Bruno de esconder los problemas con la necesidad de Lara de que le digan la verdad. **Esconder un problema siempre lo hace más grande.**

## Estructura en tres actos

| Acto | Escena | Qué pasa | Qué cambia |
|---|---|---|---|
| **Planteamiento** | 1. Diez pasitos | Bruno anima al R-7 para la inspección y prepara una sorpresa secreta. El núcleo revienta. Lara entra; Bruno esconde el fusible y miente. | Hay un problema grave y un secreto. |
| **Nudo** | 2. Señor Nada Grave | Lara sospecha y le recuerda la deuda. El fusible cae al suelo. No hay repuesto: mañana les cierran. | El secreto se descubre. Peor momento. |
| **Nudo (giro)** | 3. Doble y sin azúcar | Bruno confiesa: el regalo era un módulo de café por el aniversario. Lara se ablanda y propone sacrificar la consola. | Pasan de enfrentados a equipo. |
| **Desenlace** | 4. Tornillos | Cambian el fusible, el robot vuelve a fallar; la causa real era un tornillo suelto. El R-7 vive. *Tag*: el módulo del café. | El taller se salva y la confianza se repara. |

**Setups y payoffs**
- «Diez pasitos» (esc. 1) → Bruno lo grita cuando el R-7 arranca (esc. 4).
- «Estás… descansando» (esc. 1) → «Que descanse en paz» (esc. 3).
- «Nada grave» (esc. 1–2) → la deuda de doce mil euros → «¿La de los doce mil euros?» (esc. 3).
- «Ajustando tornillos», la excusa del piloto, se vuelve la solución real (esc. 4).
- «Doble y sin azúcar» → el módulo del café → «Ni se te ocurra» (*tag*).

---

## ESC. 1 — INT. TALLER 7 — NOCHE · «Diez pasitos»

El R-7 tiene el panel abierto. BRUNO (46) sostiene el fusible del núcleo y le habla como a un hijo.

**BRUNO** *(animándole)*: Mañana viene la inspectora, Erre Siete. Das diez pasitos, ella firma y seguimos abiertos.

El R-7 levanta el brazo, como un saludo militar. Pitido alegre.

**BRUNO** *(cómplice, en voz baja)*: Y esta noche, la sorpresa para Lara. Tú, ni una palabra.

Bruno mete la mano en el panel. CHISPAS. Humo. Los ojos del robot parpadean y su cabeza cae con un pitido triste.

**BRUNO** *(aterrado)*: No, no, no. Tú no te has quemado. Tú estás... descansando.

Se abre la puerta. LARA (33) entra ya hablando.

**LARA** *(extrañada)*: Bruno, ¿por qué huele a cable quemado?

Bruno se gira y esconde el fusible a la espalda.

**BRUNO** *(sonrisa forzada)*: ¿Quemado? Será la cena de alguien. De fuera.

El R-7 suelta un pitido triste. Lara mira al robot. Luego a Bruno.

**LARA** *(seca)*: Ya. La cena.

CORTE A:

## ESC. 2 — INT. TALLER 7 — CONTINUO · «Señor Nada Grave»

Lara va hacia el robot sin dejar de hablar.

**LARA**: ¿Y por qué tiene el panel abierto?

**BRUNO**: Mantenimiento rutinario. Nada grave.

Lara se para en seco y se gira.

**LARA** *(señalándole)*: La última vez que dijiste «nada grave», acabamos debiendo doce mil euros.

**BRUNO**: Aquello fue una inversión... con mala suerte.

Lara se inclina sobre el panel. Se le cambia la cara.

**LARA** *(preocupada)*: Bruno... el núcleo está muerto.

**BRUNO**: Muerto es una palabra muy fuerte.

El fusible se le escurre de la mano y rebota en el suelo con estrépito. Los dos lo miran.

**BRUNO** *(rápido)*: Eso no es mío.

Lara lo recoge y se lo pone delante de la cara.

**LARA**: Es el fusible del núcleo, Bruno. Ya no los fabrica nadie.

**BRUNO** *(con un hilo de voz)*: ¿Nadie, nadie?

**LARA**: Nadie. Y mañana a las ocho nos cierran.

Bruno se tapa la cara con la mano.

CORTE A:

## ESC. 3 — INT. TALLER 7 — CONTINUO · «Doble y sin azúcar»

Bruno, derrotado, va hasta el taburete.

**BRUNO**: Voy a sentarme. Para morirme más cómodo.

Se deja caer en el taburete.

**LARA** *(dolida)*: ¿Por qué no me lo has dicho? Otra vez, Bruno.

**BRUNO**: Porque era una sorpresa. Le estaba poniendo un módulo para que te hiciera el café.

**LARA** *(desarmada)*: ¿Un robot... que me hace el café?

**BRUNO**: Mañana hace seis años que abrimos el taller. Doble y sin azúcar, ¿no?

Lara se acerca. No quiere sonreír, pero sonríe.

**LARA**: Eres un desastre, ¿lo sabes?

**BRUNO** *(encogiéndose de hombros)*: Un desastre con buena memoria.

Lara mira alrededor, pensando. Se detiene en la vieja consola y la señala.

**LARA** *(decidida)*: La consola. Lleva un fusible igual, del mismo siglo que tu robot.

**BRUNO** *(levantándose de golpe)*: ¡Ahí está toda la contabilidad!

**LARA**: ¿La de los doce mil euros? Que descanse en paz.

CORTE A:

## ESC. 4 — INT. TALLER 7 — CONTINUO · «Tornillos»

Lara va hacia la consola. Bruno la sigue con la mirada, sufriendo.

**BRUNO**: Con cuidado, que esa consola es más vieja que tú.

**LARA**: Y tiene mejor carácter.

Lara deja el fusible quemado sobre la consola y coge el bueno. La pantalla se apaga con un clic.

**BRUNO** *(de luto)*: Adiós, contabilidad.

Lara vuelve hacia el robot con el fusible.

**BRUNO**: ¿Y si no es el mismo modelo?

**LARA**: Entonces mañana vendemos el robot por piezas.

Le pone el fusible en la mano.

**LARA**: Toma. Y esta vez, sin sorpresas.

Bruno lo coloca en el panel. El R-7 levanta la cabeza, se le encienden los ojos.

**BRUNO** *(eufórico)*: ¡Eso es, campeón!

CHISPAS otra vez. La cabeza del robot vuelve a caer.

**BRUNO** *(al borde del llanto)*: ¡No, no, no! ¡Otra vez no!

Lara se inclina sobre el panel. Entorna los ojos.

**LARA**: Espera. Aquí hay un tornillo suelto tocando el núcleo.

Se gira muy despacio hacia Bruno.

**LARA**: Un tornillo, Bruno. Un tornillo.

**BRUNO** *(sonrisa pícara)*: Te dije que estaba ajustando tornillos.

Lara se ríe sin poder evitarlo.

**LARA**: Anda, apriétalo, genio.

Bruno aprieta el tornillo. Clic. El R-7 se ilumina, levanta la cabeza, mira a uno y a otro y alza los dos brazos con un pitido de alegría.

**BRUNO** *(gritando de alegría)*: ¡Diez pasitos, campeón! ¡Mañana, diez pasitos!

El R-7 gira la cabeza hacia Lara y pita, encantado.

**BRUNO** *(ilusionado)*: Y ahora... el módulo del café.

**LARA** *(señalándole, sin pestañear)*: Ni se te ocurra.

El R-7 baja la cabeza con un pitido triste. Bruno y Lara se echan a reír.

FUNDIDO A NEGRO.
`);

// ------------------------------------------------------------------ story (proposal for the canon)
w('story.json', {
  schemaVersion: 1, status: 'draft',
  facts: [
    { id: 'nucleo-quemado', text: 'El núcleo del robot R-7 se quemó la víspera de la inspección.', since: 'ep-001' },
    { id: 'fusible-oculto', text: 'Bruno intentó ocultar a Lara el fusible quemado del R-7.', since: 'ep-001' },
    { id: 'sin-repuesto', text: 'El fusible del núcleo del R-7 ya no se fabrica.', since: 'ep-001' },
    { id: 'modulo-cafe', text: 'Bruno quería instalar en el R-7 un módulo para preparar el café de Lara, como regalo por el sexto aniversario del taller.', since: 'ep-001' },
    { id: 'consola-sin-fusible', text: 'La consola del taller quedó apagada: su fusible se usó para el R-7.', since: 'ep-001' },
    { id: 'tornillo-suelto', text: 'La avería del R-7 la causaba un tornillo suelto que tocaba el núcleo.', since: 'ep-001' }
  ],
  knowledge: [],
  relationships: [
    { a: 'lara', b: 'bruno', trustDelta: 0.05, note: 'Lara descubre que Bruno volvió a ocultarle algo, pero también que era un regalo para ella.' },
    { a: 'bruno', b: 'lara', trustDelta: 0.1, note: 'Lara le ayuda a salvar al R-7 en lugar de rendirse.' }
  ],
  emotionalStates: { bruno: 'aliviado e ilusionado', lara: 'exasperada, pero conmovida' },
  events: [
    { id: 'r7-averia', text: 'El núcleo del R-7 se quema mientras Bruno prepara una sorpresa.', scene: 'sc-001' },
    { id: 'fusible-descubierto', text: 'Lara descubre el fusible quemado que Bruno escondía.', scene: 'sc-002' },
    { id: 'confesion', text: 'Bruno confiesa que el R-7 iba a ser un regalo de aniversario para Lara.', scene: 'sc-003' },
    { id: 'r7-salvado', text: 'Con el fusible de la consola y un tornillo apretado, el R-7 vuelve a funcionar.', scene: 'sc-004' }
  ]
});

// ------------------------------------------------------------------ ESC. 1
w('scenes/sc-001/scene.json', {
  schemaVersion: 2, id: 'sc-001', name: 'Diez pasitos', environmentId: 'taller', durationSec: 'auto', tailSec: 0.4, autoLook: true,
  synopsis: 'Planteamiento. Bruno anima al R-7 para la inspección de mañana y prepara una sorpresa secreta para Lara. El núcleo revienta; Lara entra y Bruno esconde el fusible.',
  actors: [
    { id: 'bruno', characterId: 'bruno', position: [-0.55, 0, -0.5], yawDeg: 72, expression: 'smile', idle: 'idle' },
    { id: 'lara', characterId: 'lara', position: [-5.4, 0, 0.62], yawDeg: 90, expression: 'neutral', idle: 'idle' }
  ],
  props: [ROBOT, { id: 'fusible', propId: 'fusible-nucleo', heldBy: { actor: 'bruno', hand: 'right' } }],
  actions: [
    ...robotRest(0),
    { id: 'sujeta', type: 'hold', actor: 'bruno', at: 0, hand: 'right', pose: 'side', durationSec: 0.05 },
    { id: 'mira-robot', type: 'lookAt', actor: 'bruno', at: 0, target: { prop: 'robot', anchor: 'eye' }, durationSec: 9 },
    { id: 'robot-saluda', type: 'propJoint', prop: 'robot', joint: 'armR', with: 'b1', offset: 3.1, toDeg: -125, durationSec: 0.45, sound: 'servo' },
    { id: 'robot-luz', type: 'effect', effect: 'glow', prop: 'robot', part: 'antennaTip', with: 'robot-saluda', offset: 0.2, durationSec: 0.7, intensity: 2 },
    { id: 'robot-baja-brazo', type: 'propJoint', prop: 'robot', joint: 'armR', after: 'robot-saluda', offset: 0.7, toDeg: 0, durationSec: 0.5 },
    { id: 'bruno-complice', type: 'expression', actor: 'bruno', with: 'b2', expression: 'smirk', intensity: 0.8 },
    { id: 'trabaja', type: 'play', actor: 'bruno', with: 'b2', offset: 1.6, clip: 'point', target: { prop: 'robot', anchor: 'panel' }, durationSec: 1.3 },
    { id: 'chispas', type: 'effect', effect: 'sparks', prop: 'robot', part: 'cavity', after: 'b2', offset: 0.1, durationSec: 1, intensity: 1.4, sound: 'sparks' },
    { id: 'ojo-l', type: 'effect', effect: 'flicker', prop: 'robot', part: 'eyeL', with: 'chispas', durationSec: 2 },
    { id: 'ojo-r', type: 'effect', effect: 'flicker', prop: 'robot', part: 'eyeR', with: 'chispas', durationSec: 2 },
    { id: 'humo', type: 'effect', effect: 'smoke', prop: 'robot', part: 'cavity', with: 'chispas', offset: 0.3, durationSec: 2.6, intensity: 0.9 },
    { id: 'susto', type: 'expression', actor: 'bruno', with: 'chispas', offset: 0.05, expression: 'fear', durationSec: 1.4 },
    { id: 'retrocede', type: 'play', actor: 'bruno', with: 'chispas', offset: 0.05, clip: 'shrug', speed: 1.4 },
    { id: 'robot-cae', type: 'propJoint', prop: 'robot', joint: 'headTilt', with: 'chispas', offset: 0.5, toDeg: 22, durationSec: 0.8, sound: 'servo' },
    { id: 'bruno-nervioso', type: 'play', actor: 'bruno', with: 'b3', offset: 0.2, clip: 'nervous', durationSec: 2.2 },
    { id: 'puerta-abre', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'b3', offset: -0.9, toDeg: -100, durationSec: 1, sound: 'door-creak' },
    { id: 'lara-entra', type: 'walk', actor: 'lara', with: 'puerta-abre', offset: 0.35, to: [-2.15, 0, 0.45], gait: 'walk-brisk', faceTo: 'bruno' },
    { id: 'bruno-gira', type: 'turn', actor: 'bruno', with: 'l1', offset: 0.2, towards: 'lara' },
    { id: 'esconde', type: 'hold', actor: 'bruno', with: 'l1', offset: 0.35, hand: 'right', pose: 'behind', durationSec: 0.6 },
    { id: 'nervios', type: 'expression', actor: 'bruno', with: 'esconde', expression: 'nervous' },
    { id: 'robot-delata', type: 'effect', effect: 'glow', prop: 'robot', part: 'antennaTip', after: 'b4', offset: 0.05, durationSec: 0.7, intensity: 2 },
    { id: 'robot-delata-cabeza', type: 'propJoint', prop: 'robot', joint: 'head', with: 'robot-delata', toDeg: -18, durationSec: 0.4, sound: 'servo' },
    { id: 'lara-mira-robot', type: 'lookAt', actor: 'lara', with: 'robot-delata', offset: 0.15, target: { prop: 'robot', anchor: 'eye' }, durationSec: 0.8 },
    { id: 'lara-ironia', type: 'expression', actor: 'lara', with: 'l2', expression: 'smirk' },
    { id: 'puerta-cierra', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'lara-entra', offset: -0.4, toDeg: 0, durationSec: 1, sound: 'click' }
  ],
  dialogue: [
    { id: 'b1', actor: 'bruno', text: 'Mañana viene la inspectora, Erre Siete. Das diez pasitos, ella firma y seguimos abiertos.', emotion: 'determined', intensity: 0.7, knowledge: ['inspeccion-manana'], gesture: 'explain', at: 0.5, pauseAfter: 0.5 },
    { id: 'b2', actor: 'bruno', text: 'Y esta noche, la sorpresa para Lara. Tú, ni una palabra.', emotion: 'smirk', direction: 'en voz baja, cómplice' },
    { id: 'b3', actor: 'bruno', text: 'No, no, no. Tú no te has quemado. Tú estás... descansando.', emotion: 'fear', intensity: 0.8, after: 'chispas', offset: 0.2 },
    { id: 'l1', actor: 'lara', text: 'Bruno, ¿por qué huele a cable quemado?', to: 'bruno', emotion: 'surprise', intensity: 0.6, with: 'lara-entra', offset: 0.4 },
    { id: 'b4', actor: 'bruno', text: '¿Quemado? Será la cena de alguien. De fuera.', to: 'lara', emotion: 'nervous', pauseAfter: 0.9 },
    { id: 'l2', actor: 'lara', text: 'Ya. La cena.', to: 'bruno', emotion: 'smirk' }
  ],
  shots: [
    { id: 'sh-01', at: 0, camera: { ...CAM.establishing, move: { type: 'push-in', amount: 0.12 } }, transitionIn: { type: 'fade', durationSec: 0.8 }, notes: 'Plano de situación: Bruno habla con el R-7.' },
    { id: 'sh-02', with: 'robot-saluda', offset: -0.3, camera: CAM.robotFace, notes: 'El R-7 saluda.' },
    { id: 'sh-03', with: 'b2', offset: -0.1, camera: fc('medium', 'bruno', { azimuthDeg: -35, elevationDeg: -4 }) },
    { id: 'sh-04', with: 'chispas', offset: -0.15, camera: { ...CAM.panelInsert, handheld: 0.6 }, notes: 'Inserto: el núcleo revienta.' },
    { id: 'sh-05', with: 'b3', offset: -0.1, camera: fc('close', 'bruno', { azimuthDeg: -15, move: { type: 'push-in', amount: 0.1 } }) },
    { id: 'sh-06', with: 'puerta-abre', offset: -0.1, camera: CAM.door, notes: 'Lara entra.' },
    { id: 'sh-07', with: 'b4', offset: -0.1, camera: fc('medium-close', 'bruno', { azimuthDeg: 10, handheld: 0.3 }) },
    { id: 'sh-08', with: 'robot-delata', offset: -0.1, camera: CAM.robotFace, notes: 'El robot le delata.' },
    { id: 'sh-09', with: 'l2', offset: -0.15, camera: fc('medium-close', 'lara', { azimuthDeg: 15 }) }
  ],
  sound: [
    AMB,
    { id: 'pitido-saludo', kind: 'sfx', sound: 'robot-beep', with: 'robot-luz', gainDb: -9 },
    { id: 'pitido-triste', kind: 'sfx', sound: 'robot-sad', with: 'robot-cae', offset: 0.3, gainDb: -6 },
    { id: 'pitido-delator', kind: 'sfx', sound: 'robot-sad', with: 'robot-delata', gainDb: -5 }
  ],
  transitionOut: { type: 'cut', durationSec: 0 }
});

// ------------------------------------------------------------------ ESC. 2
w('scenes/sc-002/scene.json', {
  schemaVersion: 2, id: 'sc-002', name: 'Señor Nada Grave', environmentId: 'taller', durationSec: 'auto', tailSec: 0.5, autoLook: true,
  synopsis: 'Nudo. Lara sospecha y le recuerda la deuda; el fusible cae; no hay repuesto y mañana les cierran.',
  actors: [
    { id: 'bruno', characterId: 'bruno', position: [-0.55, 0, -0.5], yawDeg: -76, expression: 'nervous', idle: 'idle' },
    { id: 'lara', characterId: 'lara', position: [-2.15, 0, 0.45], yawDeg: 123, expression: 'smirk', idle: 'idle' }
  ],
  props: [ROBOT, { id: 'fusible', propId: 'fusible-nucleo', heldBy: { actor: 'bruno', hand: 'right' } }],
  actions: [
    ...robotRest(22),
    { id: 'oculta', type: 'hold', actor: 'bruno', at: 0, hand: 'right', pose: 'behind', durationSec: 0.05 },
    { id: 'lara-al-robot', type: 'walk', actor: 'lara', at: 0.25, to: [0.95, 0, -0.05], faceTo: { prop: 'robot', anchor: 'panel' } },
    { id: 'bruno-sigue', type: 'turn', actor: 'bruno', with: 'l3', offset: 0.8, towards: [0.95, 0, -0.05], durationSec: 0.9 },
    { id: 'lara-encara', type: 'turn', actor: 'lara', with: 'l4', offset: -0.35, towards: 'bruno', durationSec: 0.6 },
    { id: 'lara-seria', type: 'expression', actor: 'lara', with: 'l4', expression: 'angry', intensity: 0.6 },
    { id: 'lara-al-panel', type: 'turn', actor: 'lara', after: 'b6', offset: -0.3, towards: { prop: 'robot', anchor: 'panel' }, durationSec: 0.6 },
    { id: 'lara-mira-panel', type: 'lookAt', actor: 'lara', after: 'b6', offset: -0.2, target: { prop: 'robot', anchor: 'panel' }, mode: 'chest', durationSec: 2.2 },
    { id: 'lara-preocupada', type: 'expression', actor: 'lara', with: 'l5', expression: 'worried' },
    { id: 'cae', type: 'drop', actor: 'bruno', after: 'b7', offset: 0.1, prop: 'fusible' },
    { id: 'bruno-susto', type: 'expression', actor: 'bruno', with: 'cae', offset: 0.2, expression: 'fear', durationSec: 1.4 },
    { id: 'bruno-mira-pieza', type: 'lookAt', actor: 'bruno', with: 'cae', offset: 0.2, target: 'fusible', durationSec: 1.1 },
    { id: 'lara-mira-pieza', type: 'lookAt', actor: 'lara', with: 'cae', offset: 0.15, target: 'fusible', durationSec: 1.5 },
    { id: 'lara-va', type: 'walk', actor: 'lara', after: 'cae', offset: 0.45, to: [-0.08, 0, -0.3], faceTo: 'fusible' },
    { id: 'lara-recoge', type: 'pickUp', actor: 'lara', after: 'lara-va', prop: 'fusible', hand: 'right', durationSec: 1.4 },
    { id: 'lara-ensena', type: 'hold', actor: 'lara', after: 'lara-recoge', hand: 'right', pose: 'show', durationSec: 0.6 },
    { id: 'lara-a-bruno', type: 'turn', actor: 'lara', after: 'lara-recoge', towards: 'bruno', durationSec: 0.5 },
    { id: 'lara-enfado', type: 'expression', actor: 'lara', with: 'l6', expression: 'angry', intensity: 0.5 },
    { id: 'bruno-hundido', type: 'expression', actor: 'bruno', with: 'l7', offset: 1, expression: 'sad' },
    { id: 'bruno-cara', type: 'play', actor: 'bruno', after: 'l7', offset: -0.3, clip: 'facepalm' }
  ],
  dialogue: [
    { id: 'l3', actor: 'lara', text: '¿Y por qué tiene el panel abierto?', to: 'bruno', emotion: 'smirk', intensity: 0.6, with: 'lara-al-robot', offset: 0.2 },
    { id: 'b5', actor: 'bruno', text: 'Mantenimiento rutinario. Nada grave.', to: 'lara', emotion: 'nervous', gesture: 'nod' },
    { id: 'l4', actor: 'lara', text: 'La última vez que dijiste «nada grave», acabamos debiendo doce mil euros.', to: 'bruno', emotion: 'angry', intensity: 0.6, knowledge: ['deuda-pasada'], gesture: 'point', pauseAfter: 0.35 },
    { id: 'b6', actor: 'bruno', text: 'Aquello fue una inversión... con mala suerte.', to: 'lara', emotion: 'nervous', intensity: 0.8 },
    { id: 'l5', actor: 'lara', text: 'Bruno... el núcleo está muerto.', to: 'bruno', emotion: 'worried', reveals: ['nucleo-quemado'], after: 'lara-al-panel', offset: 0.3 },
    { id: 'b7', actor: 'bruno', text: 'Muerto es una palabra muy fuerte.', to: 'lara', emotion: 'nervous', intensity: 0.8 },
    { id: 'b8', actor: 'bruno', text: 'Eso no es mío.', to: 'lara', emotion: 'nervous', intensity: 1.1, with: 'cae', offset: 0.75 },
    { id: 'l6', actor: 'lara', text: 'Es el fusible del núcleo, Bruno. Ya no los fabrica nadie.', to: 'bruno', emotion: 'angry', intensity: 0.5, reveals: ['fusible-oculto', 'sin-repuesto'], with: 'lara-recoge', offset: 0.45 },
    { id: 'b9', actor: 'bruno', text: '¿Nadie, nadie?', to: 'lara', emotion: 'worried', intensity: 1.1 },
    { id: 'l7', actor: 'lara', text: 'Nadie. Y mañana a las ocho nos cierran.', to: 'bruno', emotion: 'worried', knowledge: ['inspeccion-manana'], gesture: 'headshake' }
  ],
  shots: [
    { id: 'sh-01', at: 0, camera: { framing: 'two-shot', subjects: ['lara', 'bruno'], fov: 34, track: true, elevationDeg: 6 } },
    { id: 'sh-02', with: 'b5', offset: -0.1, camera: fc('medium-close', 'bruno', { azimuthDeg: 10 }) },
    { id: 'sh-03', with: 'l4', offset: -0.2, camera: { framing: 'over-shoulder', over: 'bruno', subject: 'lara', side: 'left', fov: 32 } },
    { id: 'sh-04', with: 'b6', offset: -0.1, camera: fc('close', 'bruno', { azimuthDeg: -10, handheld: 0.2 }) },
    { id: 'sh-05', with: 'l5', offset: -0.2, camera: fc('medium', 'lara', { azimuthDeg: 30 }) },
    { id: 'sh-06', with: 'b7', offset: -0.1, camera: fc('medium', 'bruno', { azimuthDeg: 0, move: { type: 'push-in', amount: 0.12 } }) },
    { id: 'sh-07', with: 'cae', offset: -0.2, camera: CAM.floorLow, notes: 'Plano bajo: el fusible cae.' },
    { id: 'sh-08', with: 'lara-va', offset: 0.15, camera: fc('full', 'lara', { azimuthDeg: 30, fov: 34, track: true }) },
    { id: 'sh-09', with: 'l6', offset: -0.2, camera: fc('medium-close', 'lara', { azimuthDeg: 20 }) },
    { id: 'sh-10', with: 'b9', offset: -0.1, camera: fc('close', 'bruno', { azimuthDeg: -10 }) },
    { id: 'sh-11', with: 'l7', offset: -0.1, camera: { framing: 'two-shot', subjects: ['lara', 'bruno'], fov: 34 } }
  ],
  sound: [AMB],
  transitionOut: { type: 'cut', durationSec: 0 }
});

// ------------------------------------------------------------------ ESC. 3 (positions continue from sc-002)
const S3 = JSON.parse(fs.readFileSync(new URL('./pilot-continuity.json', import.meta.url), 'utf8'));
w('scenes/sc-003/scene.json', {
  schemaVersion: 2, id: 'sc-003', name: 'Doble y sin azúcar', environmentId: 'taller', durationSec: 'auto', tailSec: 0.5, autoLook: true,
  synopsis: 'Giro. Bruno confiesa que el R-7 iba a ser un regalo de aniversario para Lara; ella se ablanda y propone sacrificar la consola.',
  actors: [
    { id: 'bruno', characterId: 'bruno', ...S3['sc-003'].bruno, expression: 'sad', idle: 'idle' },
    { id: 'lara', characterId: 'lara', ...S3['sc-003'].lara, expression: 'sad', idle: 'idle' }
  ],
  props: [ROBOT, { id: 'fusible', propId: 'fusible-nucleo', heldBy: { actor: 'lara', hand: 'right' } }, { id: 'fusible-consola', propId: 'fusible-nucleo', on: { prop: 'consola', anchor: 'top' } }],
  actions: [
    ...robotRest(22),
    { id: 'lara-sujeta', type: 'hold', actor: 'lara', at: 0, hand: 'right', pose: 'show', durationSec: 0.05 },
    { id: 'lara-baja', type: 'hold', actor: 'lara', at: 0.6, hand: 'right', pose: 'side', durationSec: 0.6 },
    { id: 'bruno-se-sienta', type: 'sit', actor: 'bruno', at: 0.2, prop: 'taburete', durationSec: 1 },
    { id: 'lara-gira', type: 'turn', actor: 'lara', with: 'b10', offset: -0.4, towards: 'bruno', durationSec: 0.6 },
    { id: 'lara-acerca', type: 'walk', actor: 'lara', with: 'b10', offset: 0.6, to: { actor: 'bruno', distance: 1.05 }, faceTo: 'bruno' },
    { id: 'lara-sorpresa', type: 'expression', actor: 'lara', with: 'l9', expression: 'surprise', intensity: 0.7 },
    { id: 'lara-sonrie', type: 'expression', actor: 'lara', after: 'b10', expression: 'smile', intensity: 0.85 },
    { id: 'bruno-sonrie', type: 'expression', actor: 'bruno', with: 'l10', offset: 0.8, expression: 'smile', intensity: 0.7 },
    { id: 'lara-piensa', type: 'play', actor: 'lara', after: 'b11', offset: 0.05, clip: 'look-around', speed: 1.4 },
    { id: 'lara-decidida', type: 'expression', actor: 'lara', with: 'l11', expression: 'determined' },
    { id: 'lara-senala', type: 'play', actor: 'lara', with: 'l11', offset: 0.1, clip: 'point', target: 'consola', durationSec: 1.6 },
    { id: 'bruno-mira-consola', type: 'lookAt', actor: 'bruno', with: 'l11', offset: 0.4, target: 'consola', durationSec: 1.6 },
    { id: 'bruno-susto', type: 'expression', actor: 'bruno', with: 'b12', expression: 'fear', intensity: 0.8, durationSec: 1.8 },
    { id: 'bruno-se-levanta', type: 'stand', actor: 'bruno', with: 'b12', offset: 0.05, durationSec: 0.8 },
    { id: 'lara-ironia', type: 'expression', actor: 'lara', with: 'l12', expression: 'smirk' }
  ],
  dialogue: [
    { id: 'b8b', actor: 'bruno', text: 'Voy a sentarme. Para morirme más cómodo.', emotion: 'sad', intensity: 0.8, at: 0.45, pauseAfter: 0.4 },
    { id: 'l8', actor: 'lara', text: '¿Por qué no me lo has dicho? Otra vez, Bruno.', to: 'bruno', emotion: 'sad', intensity: 0.7 },
    { id: 'b9', actor: 'bruno', text: 'Porque era una sorpresa. Le estaba poniendo un módulo para que te hiciera el café.', to: 'lara', emotion: 'sad', intensity: 0.6, reveals: ['modulo-cafe'], gesture: 'explain', after: 'bruno-se-sienta', offset: -1.6 },
    { id: 'l9', actor: 'lara', text: '¿Un robot... que me hace el café?', to: 'bruno', emotion: 'surprise', intensity: 0.7 },
    { id: 'b10', actor: 'bruno', text: 'Mañana hace seis años que abrimos el taller. Doble y sin azúcar, ¿no?', to: 'lara', emotion: 'smile', intensity: 0.6, knowledge: ['taller-7'], pauseAfter: 0.6 },
    { id: 'l10', actor: 'lara', text: 'Eres un desastre, ¿lo sabes?', to: 'bruno', emotion: 'smile' },
    { id: 'b11', actor: 'bruno', text: 'Un desastre con buena memoria.', to: 'lara', emotion: 'smile', gesture: 'shrug', pauseAfter: 0.9 },
    { id: 'l11', actor: 'lara', text: 'La consola. Lleva un fusible igual, del mismo siglo que tu robot.', to: 'bruno', emotion: 'determined', intensity: 0.8 },
    { id: 'b12', actor: 'bruno', text: '¡Ahí está toda la contabilidad!', to: 'lara', emotion: 'fear', intensity: 0.9 },
    { id: 'l12', actor: 'lara', text: '¿La de los doce mil euros? Que descanse en paz.', to: 'bruno', emotion: 'smirk', knowledge: ['deuda-pasada'], gesture: 'dismiss' }
  ],
  shots: [
    { id: 'sh-01', at: 0, camera: fc('full', 'bruno', { azimuthDeg: 25, fov: 36, track: true }), notes: 'Bruno, derrotado, va al taburete.' },
    { id: 'sh-02', with: 'b9', offset: -0.2, camera: fc('medium', 'bruno', { azimuthDeg: 0 }) },
    { id: 'sh-03', with: 'l9', offset: -0.1, camera: fc('medium-close', 'lara', { azimuthDeg: 15 }) },
    { id: 'sh-04', with: 'b10', offset: -0.1, camera: fc('close', 'bruno', { azimuthDeg: 5, move: { type: 'push-in', amount: 0.1 } }) },
    { id: 'sh-05', with: 'l10', offset: -0.2, camera: { framing: 'two-shot', subjects: ['lara', 'bruno'], fov: 34 } },
    { id: 'sh-06', with: 'b11', offset: -0.1, camera: fc('medium-close', 'bruno', { azimuthDeg: 10 }) },
    { id: 'sh-07', with: 'lara-piensa', offset: -0.1, camera: fc('medium-close', 'lara', { azimuthDeg: -40 }) },
    { id: 'sh-08', with: 'l11', offset: 1.2, camera: CAM.consoleInsert, notes: 'La consola, condenada.' },
    { id: 'sh-09', with: 'b12', offset: -0.1, camera: fc('medium', 'bruno', { azimuthDeg: 10 }) },
    { id: 'sh-10', with: 'l12', offset: -0.1, camera: fc('medium-close', 'lara', { azimuthDeg: 20 }) }
  ],
  sound: [AMB],
  transitionOut: { type: 'cut', durationSec: 0 }
});

// ------------------------------------------------------------------ ESC. 4
w('scenes/sc-004/scene.json', {
  schemaVersion: 2, id: 'sc-004', name: 'Tornillos', environmentId: 'taller', durationSec: 'auto', tailSec: 0.9, autoLook: true,
  synopsis: 'Desenlace. Cambian el fusible por el de la consola; el R-7 vuelve a fallar; la causa era un tornillo suelto. El R-7 vive. Tag: el módulo del café.',
  actors: [
    { id: 'bruno', characterId: 'bruno', ...S3['sc-004'].bruno, expression: 'worried', idle: 'idle' },
    { id: 'lara', characterId: 'lara', ...S3['sc-004'].lara, expression: 'determined', idle: 'idle' }
  ],
  props: [ROBOT, { id: 'fusible', propId: 'fusible-nucleo', heldBy: { actor: 'lara', hand: 'right' } }, { id: 'fusible-consola', propId: 'fusible-nucleo', on: { prop: 'consola', anchor: 'top' } }],
  actions: [
    ...robotRest(22),
    { id: 'lara-sujeta', type: 'hold', actor: 'lara', at: 0, hand: 'right', pose: 'side', durationSec: 0.05 },
    { id: 'lara-a-consola', type: 'walk', actor: 'lara', at: 0.2, to: { prop: 'consola', anchor: 'top', distance: 0.55 }, faceTo: { prop: 'consola', anchor: 'top' } },
    { id: 'bruno-al-robot', type: 'walk', actor: 'bruno', with: 'b13', offset: 1.2, to: [-0.45, 0, -0.42], faceTo: { prop: 'robot', anchor: 'panel' } },
    { id: 'lara-deja', type: 'place', actor: 'lara', after: 'lara-a-consola', prop: 'fusible', on: [3.42, 1.13, -1.12], durationSec: 1.1 },
    { id: 'lara-coge', type: 'pickUp', actor: 'lara', after: 'lara-deja', prop: 'fusible-consola', hand: 'right', durationSec: 1.3 },
    { id: 'consola-off', type: 'effect', effect: 'off', prop: 'consola', part: 'screen', with: 'lara-coge', offset: 0.6, durationSec: 600, sound: 'click' },
    { id: 'consola-off-2', type: 'effect', effect: 'off', prop: 'consola', part: 'display', with: 'consola-off', durationSec: 600 },
    { id: 'bruno-luto', type: 'expression', actor: 'bruno', with: 'b14', expression: 'sad', intensity: 0.8 },
    { id: 'lara-vuelve', type: 'walk', actor: 'lara', after: 'lara-coge', offset: 0.05, to: [-0.85, 0, 0.25], gait: 'walk-brisk', faceTo: 'bruno' },
    { id: 'lara-da', type: 'give', actor: 'lara', after: 'lara-vuelve', prop: 'fusible-consola', to: 'bruno', durationSec: 1.3 },
    { id: 'bruno-al-panel', type: 'turn', actor: 'bruno', after: 'lara-da', towards: { prop: 'robot', anchor: 'panel' }, durationSec: 0.5 },
    { id: 'bruno-pone', type: 'place', actor: 'bruno', after: 'bruno-al-panel', prop: 'fusible-consola', on: { prop: 'robot', anchor: 'panel' }, durationSec: 1.3 },
    { id: 'arranque', type: 'effect', effect: 'glow', prop: 'robot', part: 'antennaTip', after: 'bruno-pone', offset: 0.1, durationSec: 1.2, intensity: 2.2 },
    { id: 'ojos-1', type: 'effect', effect: 'glow', prop: 'robot', part: 'eyeL', with: 'arranque', durationSec: 1.4, intensity: 1.5 },
    { id: 'ojos-2', type: 'effect', effect: 'glow', prop: 'robot', part: 'eyeR', with: 'arranque', durationSec: 1.4, intensity: 1.5 },
    { id: 'robot-levanta', type: 'propJoint', prop: 'robot', joint: 'headTilt', with: 'arranque', offset: 0.1, toDeg: 0, durationSec: 0.6, sound: 'servo' },
    { id: 'bruno-ilusion', type: 'expression', actor: 'bruno', with: 'arranque', expression: 'joy' },
    { id: 'chispas-2', type: 'effect', effect: 'sparks', prop: 'robot', part: 'cavity', after: 'b15', offset: 0.05, durationSec: 0.8, intensity: 1.1, sound: 'sparks' },
    { id: 'robot-recae', type: 'propJoint', prop: 'robot', joint: 'headTilt', with: 'chispas-2', offset: 0.3, toDeg: 22, durationSec: 0.6, sound: 'servo' },
    { id: 'bruno-miedo', type: 'expression', actor: 'bruno', with: 'chispas-2', expression: 'fear' },
    { id: 'bruno-retrocede', type: 'play', actor: 'bruno', with: 'chispas-2', clip: 'shrug', speed: 1.4 },
    { id: 'lara-se-acerca', type: 'walk', actor: 'lara', with: 'b16', offset: 0.2, to: [-0.18, 0, 0.08], faceTo: { prop: 'robot', anchor: 'panel' } },
    { id: 'lara-mira-dentro', type: 'lookAt', actor: 'lara', after: 'b16', offset: -0.3, target: { prop: 'robot', anchor: 'panel' }, mode: 'chest', durationSec: 2.8 },
    { id: 'lara-piensa', type: 'expression', actor: 'lara', with: 'lara-mira-dentro', expression: 'thinking' },
    { id: 'lara-gira-lenta', type: 'turn', actor: 'lara', after: 'l16', offset: 0.1, towards: 'bruno', durationSec: 1.1 },
    { id: 'lara-ironia', type: 'expression', actor: 'lara', with: 'l17', expression: 'smirk', intensity: 1 },
    { id: 'lara-rie', type: 'expression', actor: 'lara', after: 'b17', offset: 0.1, expression: 'laugh', durationSec: 1.6 },
    { id: 'bruno-aprieta', type: 'play', actor: 'bruno', after: 'l18', offset: 0.05, clip: 'point', target: { prop: 'robot', anchor: 'panel' }, durationSec: 1.1 },
    { id: 'bruno-mira-panel', type: 'lookAt', actor: 'bruno', with: 'bruno-aprieta', target: { prop: 'robot', anchor: 'panel' }, durationSec: 1.2 },
    { id: 'arranque-2', type: 'effect', effect: 'glow', prop: 'robot', part: 'antennaTip', after: 'bruno-aprieta', offset: -0.1, durationSec: 3, intensity: 2.6 },
    { id: 'ojos-3', type: 'effect', effect: 'glow', prop: 'robot', part: 'eyeL', with: 'arranque-2', durationSec: 3.5, intensity: 1.8 },
    { id: 'ojos-4', type: 'effect', effect: 'glow', prop: 'robot', part: 'eyeR', with: 'arranque-2', durationSec: 3.5, intensity: 1.8 },
    { id: 'robot-vive', type: 'propJoint', prop: 'robot', joint: 'headTilt', with: 'arranque-2', toDeg: -6, durationSec: 0.5, sound: 'servo' },
    { id: 'robot-mira-1', type: 'propJoint', prop: 'robot', joint: 'head', with: 'arranque-2', offset: 0.6, toDeg: -25, durationSec: 0.4 },
    { id: 'robot-mira-2', type: 'propJoint', prop: 'robot', joint: 'head', with: 'arranque-2', offset: 1.2, toDeg: 22, durationSec: 0.45 },
    { id: 'robot-brazo-l', type: 'propJoint', prop: 'robot', joint: 'armL', with: 'arranque-2', offset: 1.0, toDeg: -150, durationSec: 0.5, sound: 'servo' },
    { id: 'robot-brazo-r', type: 'propJoint', prop: 'robot', joint: 'armR', with: 'arranque-2', offset: 1.0, toDeg: -150, durationSec: 0.5 },
    { id: 'bruno-euforia', type: 'expression', actor: 'bruno', with: 'arranque-2', offset: 0.3, expression: 'joy' },
    { id: 'lara-alegria', type: 'expression', actor: 'lara', with: 'arranque-2', offset: 0.5, expression: 'joy', intensity: 0.8 },
    { id: 'bruno-salta', type: 'play', actor: 'bruno', with: 'b18', offset: 0.2, clip: 'laugh-body', durationSec: 2.2 },
    { id: 'robot-a-lara', type: 'propJoint', prop: 'robot', joint: 'head', after: 'b18', offset: -0.2, toDeg: 32, durationSec: 0.45, sound: 'servo' },
    { id: 'robot-baja-l', type: 'propJoint', prop: 'robot', joint: 'armL', after: 'b18', offset: -0.4, toDeg: 0, durationSec: 0.6 },
    { id: 'robot-baja-r', type: 'propJoint', prop: 'robot', joint: 'armR', after: 'b18', offset: -0.4, toDeg: 0, durationSec: 0.6 },
    { id: 'robot-pena', type: 'propJoint', prop: 'robot', joint: 'headTilt', after: 'l19', offset: 0.1, toDeg: 18, durationSec: 0.6, sound: 'servo' },
    { id: 'bruno-rie', type: 'expression', actor: 'bruno', after: 'robot-pena', offset: 0.1, expression: 'laugh', durationSec: 2.2 },
    { id: 'lara-rie-2', type: 'expression', actor: 'lara', after: 'robot-pena', offset: 0.2, expression: 'laugh', durationSec: 2.1 },
    { id: 'bruno-risa', type: 'play', actor: 'bruno', after: 'robot-pena', offset: 0.1, clip: 'laugh-body', durationSec: 1.8 }
  ],
  dialogue: [
    { id: 'b13', actor: 'bruno', text: 'Con cuidado, que esa consola es más vieja que tú.', to: 'lara', emotion: 'worried', with: 'lara-a-consola', offset: 0.3 },
    { id: 'l13', actor: 'lara', text: 'Y tiene mejor carácter.', emotion: 'smirk' },
    { id: 'b14', actor: 'bruno', text: 'Adiós, contabilidad.', emotion: 'sad', intensity: 0.7, with: 'consola-off', offset: 0.35 },
    { id: 'b14b', actor: 'bruno', text: '¿Y si no es el mismo modelo?', to: 'lara', emotion: 'worried', with: 'lara-vuelve', offset: 0.5 },
    { id: 'l14a', actor: 'lara', text: 'Entonces mañana vendemos el robot por piezas.', to: 'bruno', emotion: 'smirk', intensity: 0.7 },
    { id: 'l14', actor: 'lara', text: 'Toma. Y esta vez, sin sorpresas.', to: 'bruno', emotion: 'determined', intensity: 0.6, with: 'lara-da', offset: -0.3 },
    { id: 'b15', actor: 'bruno', text: '¡Eso es, campeón!', emotion: 'joy', with: 'arranque', offset: 0.35 },
    { id: 'b16', actor: 'bruno', text: '¡No, no, no! ¡Otra vez no!', emotion: 'fear', intensity: 0.9, after: 'chispas-2', offset: -0.2 },
    { id: 'l16', actor: 'lara', text: 'Espera. Aquí hay un tornillo suelto tocando el núcleo.', emotion: 'thinking', reveals: ['tornillo-suelto'] },
    { id: 'l17', actor: 'lara', text: 'Un tornillo, Bruno. Un tornillo.', to: 'bruno', emotion: 'smirk', after: 'lara-gira-lenta', offset: -0.2 },
    { id: 'b17', actor: 'bruno', text: 'Te dije que estaba ajustando tornillos.', to: 'lara', emotion: 'smirk', gesture: 'shrug', pauseAfter: 0.5 },
    { id: 'l18', actor: 'lara', text: 'Anda, apriétalo, genio.', to: 'bruno', emotion: 'laugh', intensity: 0.7 },
    { id: 'b18', actor: 'bruno', text: '¡Diez pasitos, campeón! ¡Mañana, diez pasitos!', emotion: 'joy', intensity: 1.1, with: 'arranque-2', offset: 1.3 },
    { id: 'b19', actor: 'bruno', text: 'Y ahora... el módulo del café.', to: 'lara', emotion: 'smile', gesture: 'explain', after: 'robot-a-lara', offset: 0.35 },
    { id: 'l19', actor: 'lara', text: 'Ni se te ocurra.', to: 'bruno', emotion: 'smirk', intensity: 1, gesture: 'point' }
  ],
  shots: [
    { id: 'sh-01', at: 0, camera: { type: 'static', position: [-0.6, 1.7, 3.3], target: [2.6, 1, -1.4], fov: 42 }, notes: 'Lara va hacia la consola.' },
    { id: 'sh-02', with: 'l13', offset: -0.1, camera: fc('medium', 'lara', { azimuthDeg: 35 }) },
    { id: 'sh-03', with: 'lara-coge', offset: -0.1, camera: CAM.consoleSide, notes: 'La consola se apaga.' },
    { id: 'sh-04', with: 'b14', offset: -0.1, camera: fc('medium', 'bruno', { azimuthDeg: -10, track: true }) },
    { id: 'sh-05', with: 'l14', offset: -0.2, camera: { framing: 'over-shoulder', over: 'bruno', subject: 'lara', side: 'left', fov: 32 } },
    { id: 'sh-06', with: 'bruno-pone', offset: -0.1, camera: { ...CAM.panelInsert, handheld: 0.3 }, notes: 'Fusible nuevo.' },
    { id: 'sh-07', with: 'arranque', offset: 0.1, camera: CAM.robotBoot },
    { id: 'sh-08', with: 'b16', offset: -0.1, camera: fc('close', 'bruno', { azimuthDeg: -10, handheld: 0.4 }) },
    { id: 'sh-09', with: 'l16', offset: -0.2, camera: fc('medium', 'lara', { azimuthDeg: 30 }) },
    { id: 'sh-10', with: 'l17', offset: -0.1, camera: fc('medium-close', 'lara', { azimuthDeg: 15 }) },
    { id: 'sh-11', with: 'b17', offset: -0.1, camera: fc('medium-close', 'bruno', { azimuthDeg: 10 }) },
    { id: 'sh-12', with: 'l18', offset: -0.1, camera: fc('medium-close', 'lara', { azimuthDeg: 20 }) },
    { id: 'sh-13', with: 'arranque-2', offset: -0.2, camera: CAM.finale, notes: 'El R-7 vuelve a la vida.' },
    { id: 'sh-14', with: 'b19', offset: -0.1, camera: fc('medium-close', 'bruno', { azimuthDeg: 10 }) },
    { id: 'sh-15', with: 'l19', offset: -0.1, camera: fc('close', 'lara', { azimuthDeg: 15 }) },
    { id: 'sh-16', with: 'robot-pena', offset: -0.1, camera: { ...CAM.finale, move: { type: 'pull-out', amount: 0.35 } }, transitionIn: { type: 'dissolve', durationSec: 0.4 } }
  ],
  sound: [
    AMB,
    { id: 'pitido-arranque', kind: 'sfx', sound: 'robot-beep', with: 'arranque', gainDb: -8 },
    { id: 'pitido-fallo', kind: 'sfx', sound: 'robot-sad', with: 'robot-recae', gainDb: -6 },
    { id: 'clic-tornillo', kind: 'sfx', sound: 'click', with: 'bruno-aprieta', offset: 0.6, gainDb: -6 },
    { id: 'pitido-vida', kind: 'sfx', sound: 'robot-beep', with: 'arranque-2', offset: 0.2, gainDb: -6 },
    { id: 'pitido-vida-2', kind: 'sfx', sound: 'robot-beep', with: 'robot-brazo-l', gainDb: -7 },
    { id: 'pitido-lara', kind: 'sfx', sound: 'robot-beep', with: 'robot-a-lara', gainDb: -8 },
    { id: 'pitido-pena', kind: 'sfx', sound: 'robot-sad', with: 'robot-pena', gainDb: -5 },
    { id: 'musica-alegre', kind: 'music', sound: 'alegre', with: 'arranque-2', offset: 0.4, gainDb: -18, fadeIn: 0.6, fadeOut: 2 }
  ],
  transitionOut: { type: 'fade', durationSec: 1.2 }
});
console.log('ep-001 escrito');
