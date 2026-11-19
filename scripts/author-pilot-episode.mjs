// Authoring helper for the pilot episode files (the JSON/Markdown files are the source of truth).
import fs from 'node:fs'; import path from 'node:path';
const P = 'examples/projects/el-ultimo-turno/episodes/ep-001';
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(P, f)), { recursive: true }); fs.writeFileSync(path.join(P, f), typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n'); };
w('episode.json', { schemaVersion: 2, id: 'ep-001', type: 'episode', name: 'El último turno', number: 1, scenes: ['sc-001', 'sc-002'], targetDurationSec: 75,
  music: [{ id: 'tema', kind: 'music', sound: 'ultimo-turno-tema', at: 0, gainDb: -19, fadeIn: 3, fadeOut: 5 }],
  render: { width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }, status: 'draft' });
w('sinopsis.md', '# El último turno — sinopsis\n\nBruno y Lara trabajan en un pequeño taller futurista. Bruno intenta reparar un robot averiado. Lara entra y descubre que el robot tiene una avería mucho más grave de lo que Bruno admite. Ambos discuten brevemente. Bruno intenta ocultar una pieza defectuosa, pero se le cae al suelo. Lara la recoge, sonríe irónicamente y le pide explicaciones.\n');
w('guion.md', `# El último turno — guion

## ESC. 1 — INT. TALLER 7 — ANOCHECER

Luz naranja por el ventanal. BRUNO (46), con el fusible quemado en la mano, examina al robot R-7, con el panel abierto.

**BRUNO** *(nervioso)*: Vamos, pequeño. No me hagas esto ahora.

El robot escupe chispas. Bruno se sobresalta. El robot gira la cabeza con un pitido triste.

**BRUNO** *(preocupado)*: Solo es un fusible... creo.

Se abre la puerta. Entra LARA (33). Bruno se gira y esconde el fusible a la espalda.

**LARA** *(sorprendida)*: ¿Todavía aquí, Bruno? El turno acabó hace una hora.

**BRUNO** *(nervioso, sonriendo)*: Sí, sí. Estaba ajustando unos tornillos. Nada grave.

## ESC. 2 — INT. TALLER 7 — CONTINUO

Lara se acerca al robot y mira el panel.

**LARA** *(enfadada)*: ¿Nada grave? Tiene el núcleo quemado y medio circuito fundido.

**BRUNO** *(decidido)*: Puedo arreglarlo. Solo necesito un poco más de tiempo.

**LARA** *(enfadada)*: ¡Siempre dices lo mismo! Si falla en la inspección, nos cierran el taller.

Bruno gira 35 grados, apartando la mirada.

**BRUNO** *(triste)*: Lo sé. Lo sé.

El fusible se le escurre de la mano y cae al suelo con estrépito. Lara lo recoge y lo levanta. Sonrisa irónica.

**LARA** *(irónica)*: Vaya, vaya. ¿Y esto qué es, señor nada grave?

**BRUNO** *(nervioso)*: Eso... es una historia muy larga.

**LARA** *(irónica)*: Tengo toda la noche. Empieza a explicar.

FUNDIDO A NEGRO.
`);
const amb = { id: 'ambiente', kind: 'ambience', sound: 'workshop-ambience', at: 0, gainDb: -23, fadeIn: 1, fadeOut: 0.5 };
w('scenes/sc-001/scene.json', {
  schemaVersion: 2, id: 'sc-001', name: 'El robot averiado', environmentId: 'taller', durationSec: 'auto', tailSec: 1.2, autoLook: true,
  synopsis: 'Bruno intenta reparar el R-7; Lara llega al final de su turno.',
  actors: [
    { id: 'bruno', characterId: 'bruno', position: [-0.55, 0, -0.5], yawDeg: 72, expression: 'worried', idle: 'idle' },
    { id: 'lara', characterId: 'lara', position: [-5.4, 0, 0.62], yawDeg: 90, expression: 'neutral', idle: 'idle' }
  ],
  props: [
    { id: 'robot', propId: 'robot-r7', position: [0.25, 0, -0.85], yawDeg: -35 },
    { id: 'fusible', propId: 'fusible-nucleo', heldBy: { actor: 'bruno', hand: 'right' } }
  ],
  actions: [
    { id: 'panel', type: 'propJoint', prop: 'robot', joint: 'panel', at: 0, fromDeg: 95, toDeg: 95, durationSec: 0.05 },
    { id: 'sujeta', type: 'hold', actor: 'bruno', at: 0, hand: 'right', pose: 'side', durationSec: 0.05 },
    { id: 'mira-robot', type: 'lookAt', actor: 'bruno', at: 0, target: { prop: 'robot', anchor: 'panel' }, durationSec: 7.5 },
    { id: 'piensa', type: 'play', actor: 'bruno', with: 'b0', clip: 'think', durationSec: 3.2 },
    { id: 'pitido-inicio', type: 'effect', effect: 'glow', prop: 'robot', part: 'antennaTip', at: 0.9, durationSec: 0.5, intensity: 2 },
    { id: 'mira-alrededor', type: 'play', actor: 'bruno', after: 'cabeza-robot-2', offset: 0.1, clip: 'look-around', speed: 1.3 },
    { id: 'chispas', type: 'effect', effect: 'sparks', prop: 'robot', part: 'cavity', after: 'b1', offset: 0.25, durationSec: 1.0, intensity: 1.4, sound: 'sparks' },
    { id: 'ojo', type: 'effect', effect: 'flicker', prop: 'robot', part: 'eyeL', with: 'chispas', durationSec: 2.2 },
    { id: 'susto', type: 'expression', actor: 'bruno', with: 'chispas', offset: 0.05, expression: 'fear', durationSec: 1.3 },
    { id: 'retrocede', type: 'play', actor: 'bruno', with: 'chispas', offset: 0.05, clip: 'shrug', speed: 1.4 },
    { id: 'cabeza-robot', type: 'propJoint', prop: 'robot', joint: 'head', after: 'chispas', offset: 0.1, toDeg: -28, durationSec: 0.6, sound: 'servo' },
    { id: 'pitido', type: 'effect', effect: 'glow', prop: 'robot', part: 'antennaTip', with: 'cabeza-robot', offset: 0.4, durationSec: 0.9, intensity: 2 },
    { id: 'cabeza-robot-2', type: 'propJoint', prop: 'robot', joint: 'head', after: 'cabeza-robot', offset: 0.5, toDeg: 12, durationSec: 0.7, sound: 'servo' },
    { id: 'mira-robot-2', type: 'lookAt', actor: 'bruno', with: 'b2', target: { prop: 'robot', anchor: 'eye' }, durationSec: 2.0 },
    { id: 'puerta-abre', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'b2', offset: 0.4, toDeg: -100, durationSec: 1.2, sound: 'door-creak' },
    { id: 'lara-entra', type: 'walk', actor: 'lara', with: 'puerta-abre', offset: 0.5, to: [-2.15, 0, 0.45], gait: 'walk-brisk', faceTo: 'bruno' },
    { id: 'bruno-gira', type: 'turn', actor: 'bruno', with: 'lara-entra', offset: 0.9, towards: 'lara' },
    { id: 'esconde', type: 'hold', actor: 'bruno', with: 'lara-entra', offset: 1.1, hand: 'right', pose: 'behind', durationSec: 0.7 },
    { id: 'nervios', type: 'expression', actor: 'bruno', with: 'esconde', expression: 'nervous' },
    { id: 'puerta-cierra', type: 'propJoint', prop: 'puerta', joint: 'leaf', after: 'lara-entra', offset: -0.4, toDeg: 0, durationSec: 1.0, sound: 'click' }
  ],
  dialogue: [
    { id: 'b0', actor: 'bruno', text: 'A ver, Erre Siete. Respira hondo... si es que respiras.', emotion: 'thinking', at: 1.4, pauseAfter: 0.9 },
    { id: 'b1', actor: 'bruno', text: 'Vamos, pequeño. No me hagas esto ahora.', emotion: 'nervous', intensity: 0.8, pauseAfter: 2.9 },
    { id: 'b2', actor: 'bruno', text: 'Solo es un fusible... creo.', emotion: 'worried', direction: 'en voz baja, para sí mismo', pauseAfter: 0.4 },
    { id: 'l1', actor: 'lara', text: '¿Todavía aquí, Bruno? El turno acabó hace una hora.', to: 'bruno', emotion: 'surprise', intensity: 0.7, after: 'lara-entra', offset: 0.2 },
    { id: 'b3', actor: 'bruno', text: 'Sí, sí. Estaba ajustando unos tornillos. Nada grave.', to: 'lara', emotion: 'nervous', gesture: 'present', pauseAfter: 0.6 },
    { id: 'l1b', actor: 'lara', text: 'Ajustando tornillos. Con el panel abierto y oliendo a quemado.', to: 'bruno', emotion: 'smirk', intensity: 0.7, pauseAfter: 0.5 }
  ],
  shots: [
    { id: 'sh-01', at: 0, camera: { type: 'static', position: [1.6, 2.2, 5.6], target: [-0.6, 1.0, -1.1], fov: 38, move: { type: 'push-in', amount: 0.12 } }, transitionIn: { type: 'fade', durationSec: 1.2 }, notes: 'Plano general de establecimiento.' },
    { id: 'sh-02', with: 'b0', offset: -0.3, camera: { framing: 'medium-close', subject: 'bruno', azimuthDeg: -25, fov: 32 } },
    { id: 'sh-03', with: 'chispas', offset: -0.15, camera: { type: 'static', position: [1.15, 1.05, 0.55], target: [0.2, 0.62, -0.85], fov: 40, handheld: 0.6 }, notes: 'Inserto del panel con chispas.' },
    { id: 'sh-04', with: 'b2', offset: -0.2, camera: { framing: 'close', subject: 'bruno', azimuthDeg: -15, fov: 30, move: { type: 'push-in', amount: 0.1 } } },
    { id: 'sh-05', with: 'puerta-abre', offset: -0.2, camera: { type: 'static', position: [2.6, 1.75, 3.4], target: [-2.4, 1.15, 0.2], fov: 40 }, transitionIn: { type: 'dissolve', durationSec: 0.7 }, notes: 'Transición encadenada: Lara entra.' },
    { id: 'sh-06', with: 'l1', offset: -0.2, camera: { framing: 'over-shoulder', over: 'bruno', subject: 'lara', side: 'right', fov: 32 } },
    { id: 'sh-07', with: 'b3', offset: -0.1, camera: { framing: 'medium-close', subject: 'bruno', azimuthDeg: 10, fov: 32, handheld: 0.35 } },
    { id: 'sh-08', with: 'l1b', offset: -0.15, camera: { framing: 'medium-close', subject: 'lara', azimuthDeg: 15, fov: 32 } }
  ],
  sound: [amb, { id: 'pitido-triste', kind: 'sfx', sound: 'robot-sad', with: 'pitido', gainDb: -6 }, { id: 'pitido-hola', kind: 'sfx', sound: 'robot-beep', with: 'pitido-inicio', gainDb: -9 }],
  transitionOut: { type: 'fade', durationSec: 0.6 }
});
w('scenes/sc-002/scene.json', {
  schemaVersion: 2, id: 'sc-002', name: 'La pieza defectuosa', environmentId: 'taller', durationSec: 'auto', tailSec: 2.2, autoLook: true,
  synopsis: 'Lara descubre la gravedad de la avería; discuten; el fusible cae; Lara lo recoge.',
  actors: [
    { id: 'bruno', characterId: 'bruno', position: [-0.55, 0, -0.5], yawDeg: -57, expression: 'nervous', idle: 'idle' },
    { id: 'lara', characterId: 'lara', position: [-2.15, 0, 0.45], yawDeg: 123, expression: 'neutral', idle: 'idle' }
  ],
  props: [
    { id: 'robot', propId: 'robot-r7', position: [0.25, 0, -0.85], yawDeg: -35 },
    { id: 'fusible', propId: 'fusible-nucleo', heldBy: { actor: 'bruno', hand: 'right' } }
  ],
  actions: [
    { id: 'panel', type: 'propJoint', prop: 'robot', joint: 'panel', at: 0, fromDeg: 95, toDeg: 95, durationSec: 0.05 },
    { id: 'cabeza', type: 'propJoint', prop: 'robot', joint: 'head', at: 0, fromDeg: 12, toDeg: 12, durationSec: 0.05 },
    { id: 'oculta', type: 'hold', actor: 'bruno', at: 0, hand: 'right', pose: 'behind', durationSec: 0.05 },
    { id: 'lara-al-robot', type: 'walk', actor: 'lara', at: 0.5, to: [0.95, 0, -0.05], faceTo: { prop: 'robot', anchor: 'panel' } },
    { id: 'lara-mira-panel', type: 'lookAt', actor: 'lara', with: 'lara-al-robot', offset: 0.8, target: { prop: 'robot', anchor: 'panel' }, durationSec: 2.2 },
    { id: 'lara-enfado', type: 'expression', actor: 'lara', after: 'lara-al-robot', expression: 'angry', intensity: 0.8 },
    { id: 'lara-encara', type: 'turn', actor: 'lara', after: 'lara-al-robot', offset: 0.6, towards: 'bruno' },
    { id: 'bruno-gira-35', type: 'turn', actor: 'bruno', after: 'l3', offset: 0.15, by: -35, durationSec: 0.9 },
    { id: 'bruno-triste', type: 'expression', actor: 'bruno', after: 'l3', expression: 'sad' },
    { id: 'cae', type: 'drop', actor: 'bruno', after: 'b5', offset: 0.45, prop: 'fusible' },
    { id: 'bruno-susto', type: 'expression', actor: 'bruno', with: 'cae', offset: 0.25, expression: 'fear', durationSec: 1.8 },
    { id: 'bruno-mira-pieza', type: 'lookAt', actor: 'bruno', with: 'cae', offset: 0.2, target: 'fusible', durationSec: 1.6 },
    { id: 'lara-mira-pieza', type: 'lookAt', actor: 'lara', with: 'cae', offset: 0.15, target: 'fusible', durationSec: 2.6 },
    { id: 'lara-va', type: 'walk', actor: 'lara', after: 'cae', offset: 0.7, to: { prop: 'fusible', distance: 0.42 } },
    { id: 'lara-recoge', type: 'pickUp', actor: 'lara', after: 'lara-va', prop: 'fusible', hand: 'right', durationSec: 1.7 },
    { id: 'lara-ensena', type: 'hold', actor: 'lara', after: 'lara-recoge', hand: 'right', pose: 'show', durationSec: 0.7 },
    { id: 'lara-mira-mano', type: 'lookAt', actor: 'lara', after: 'lara-recoge', target: 'fusible', mode: 'head', durationSec: 0.9 },
    { id: 'lara-ironia', type: 'expression', actor: 'lara', after: 'lara-recoge', offset: 0.3, expression: 'smirk' },
    { id: 'lara-a-bruno', type: 'turn', actor: 'lara', after: 'lara-recoge', offset: 0.3, towards: 'bruno' },
    { id: 'bruno-vuelve', type: 'turn', actor: 'bruno', with: 'l4', offset: 0.4, towards: 'lara' },
    { id: 'bruno-nervioso', type: 'expression', actor: 'bruno', with: 'b6', expression: 'nervous' },
    { id: 'robot-feliz', type: 'propJoint', prop: 'robot', joint: 'head', after: 'l6', offset: 0.1, toDeg: -15, durationSec: 0.5, sound: 'servo' },
    { id: 'robot-feliz-2', type: 'propJoint', prop: 'robot', joint: 'head', after: 'robot-feliz', toDeg: 10, durationSec: 0.5 },
    { id: 'robot-luz', type: 'effect', effect: 'glow', prop: 'robot', part: 'antennaTip', with: 'robot-feliz', durationSec: 1.2, intensity: 2 },
    { id: 'lara-mira-robot', type: 'lookAt', actor: 'lara', with: 'robot-feliz', offset: 0.2, target: { prop: 'robot', anchor: 'eye' }, durationSec: 1.6 },
    { id: 'bruno-mira-robot', type: 'lookAt', actor: 'bruno', with: 'robot-feliz', offset: 0.3, target: { prop: 'robot', anchor: 'eye' }, durationSec: 1.5 }
  ],
  dialogue: [
    { id: 'l2', actor: 'lara', text: '¿Nada grave? Tiene el núcleo quemado y medio circuito fundido.', to: 'bruno', emotion: 'angry', intensity: 0.8, reveals: ['nucleo-quemado'], after: 'lara-encara', offset: -0.3 },
    { id: 'b4', actor: 'bruno', text: 'Puedo arreglarlo. Solo necesito un poco más de tiempo.', to: 'lara', emotion: 'determined', gesture: 'present', pauseAfter: 0.3 },
    { id: 'l2b', actor: 'lara', text: 'Bruno, la inspección es mañana a las ocho.', to: 'bruno', emotion: 'worried', knowledge: ['inspeccion-manana'], pauseAfter: 0.4 },
    { id: 'b4b', actor: 'bruno', text: 'Para entonces funcionará. Te lo prometo.', to: 'lara', emotion: 'nervous', pauseAfter: 0.4 },
    { id: 'l3', actor: 'lara', text: '¡Siempre dices lo mismo! Si falla en la inspección, nos cierran el taller.', to: 'bruno', emotion: 'angry', intensity: 1.1, gesture: 'angry-gesture', pauseAfter: 1.3 },
    { id: 'b5', actor: 'bruno', text: 'Lo sé. Lo sé.', emotion: 'sad', after: 'bruno-gira-35', offset: 0.2 },
    { id: 'l4', actor: 'lara', text: 'Vaya, vaya. ¿Y esto qué es, señor nada grave?', to: 'bruno', emotion: 'smirk', reveals: ['fusible-oculto'], after: 'lara-ensena', offset: 0.2, pauseAfter: 0.4 },
    { id: 'b6', actor: 'bruno', text: 'Eso... es una historia muy larga.', to: 'lara', emotion: 'nervous', gesture: 'shrug', pauseAfter: 0.5 },
    { id: 'l5', actor: 'lara', text: 'Tengo toda la noche. Empieza a explicar.', to: 'bruno', emotion: 'smirk', gesture: 'hands-on-hips', pauseAfter: 0.9 },
    { id: 'b7', actor: 'bruno', text: 'Vale. Pero primero... café.', to: 'lara', emotion: 'smile', pauseAfter: 0.5 },
    { id: 'l6', actor: 'lara', text: 'Doble. Y sin azúcar.', to: 'bruno', emotion: 'smile', intensity: 0.8 }
  ],
  shots: [
    { id: 'sh-01', at: 0, camera: { framing: 'two-shot', subjects: ['lara', 'bruno'], fov: 34, track: true, elevationDeg: 6 }, transitionIn: { type: 'fade', durationSec: 0.6 } },
    { id: 'sh-02', with: 'l2', offset: -0.2, camera: { framing: 'close', subject: 'lara', azimuthDeg: 18, fov: 30 } },
    { id: 'sh-03', with: 'b4', offset: -0.15, camera: { framing: 'over-shoulder', over: 'lara', subject: 'bruno', side: 'right', fov: 32 } },
    { id: 'sh-03b', with: 'l2b', offset: -0.15, camera: { framing: 'over-shoulder', over: 'bruno', subject: 'lara', side: 'left', fov: 32 } },
    { id: 'sh-03c', with: 'b4b', offset: -0.15, camera: { framing: 'close', subject: 'bruno', azimuthDeg: 12, fov: 30 } },
    { id: 'sh-04', with: 'l3', offset: -0.15, camera: { framing: 'medium-close', subject: 'lara', azimuthDeg: -15, fov: 32, handheld: 0.5 } },
    { id: 'sh-05', with: 'bruno-gira-35', offset: -0.3, camera: { framing: 'medium', subject: 'bruno', azimuthDeg: 0, fov: 32, move: { type: 'push-in', amount: 0.12 } } },
    { id: 'sh-06', with: 'cae', offset: -0.25, camera: { type: 'static', position: [0.9, 0.55, 1.6], target: [-0.6, 0.35, -0.3], fov: 42 }, notes: 'Plano bajo: la pieza cae.' },
    { id: 'sh-07', with: 'lara-va', offset: 0.2, camera: { framing: 'full', subject: 'lara', azimuthDeg: 30, fov: 34, track: true } },
    { id: 'sh-08', with: 'l4', offset: -0.2, camera: { framing: 'medium-close', subject: 'lara', azimuthDeg: 20, fov: 32 } },
    { id: 'sh-09', with: 'b6', offset: -0.15, camera: { framing: 'close', subject: 'bruno', azimuthDeg: -10, fov: 30, handheld: 0.3 } },
    { id: 'sh-10', with: 'l5', offset: -0.15, camera: { framing: 'two-shot', subjects: ['lara', 'bruno'], fov: 34 } },
    { id: 'sh-11', with: 'b7', offset: -0.15, camera: { framing: 'medium-close', subject: 'bruno', azimuthDeg: 15, fov: 32 } },
    { id: 'sh-12', with: 'l6', offset: -0.1, camera: { type: 'static', position: [2.6, 1.9, 3.6], target: [0.0, 0.95, -0.6], fov: 34, move: { type: 'pull-out', amount: 0.35 } }, transitionIn: { type: 'dissolve', durationSec: 0.6 } }
  ],
  sound: [amb, { id: 'robot-contento', kind: 'sfx', sound: 'robot-beep', with: 'robot-feliz', gainDb: -8 }],
  transitionOut: { type: 'fade', durationSec: 1.6 }
});
w('story.json', { schemaVersion: 1, status: 'draft',
  facts: [
    { id: 'nucleo-quemado', text: 'El núcleo del robot R-7 está quemado y medio circuito fundido.', since: 'ep-001' },
    { id: 'fusible-oculto', text: 'Bruno intentó ocultar a Lara el fusible quemado del R-7.', since: 'ep-001' }
  ],
  knowledge: [],
  relationships: [{ a: 'lara', b: 'bruno', trustDelta: -0.1, note: 'Lara descubre que Bruno le ocultaba la gravedad de la avería.' }, { a: 'bruno', b: 'lara', trustDelta: 0.05, note: 'Bruno agradece que Lara se quede a ayudar.' }],
  emotionalStates: { bruno: 'avergonzado pero aliviado', lara: 'irritada, aunque decidida a ayudar' },
  events: [{ id: 'r7-averia', text: 'El R-7 sufre una avería grave la víspera de la inspección.', scene: 'sc-001' }, { id: 'fusible-descubierto', text: 'Lara descubre el fusible quemado que Bruno escondía.', scene: 'sc-002' }]
});
console.log('episode ok');
