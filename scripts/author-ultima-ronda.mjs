// Authoring helper for the project «Última ronda» (adult romantic sitcom set in a cocktail bar). The JSON/Markdown
// files it writes under examples/projects/ultima-ronda are the source of truth; this script documents how they were
// built. It writes the series bible and assets; the episode itself is written by scripts/author-ultima-ronda-ep1.mjs.
//   node scripts/author-ultima-ronda.mjs
import fs from 'node:fs'; import path from 'node:path';
const P = 'examples/projects/ultima-ronda';
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(P, f)), { recursive: true }); fs.writeFileSync(path.join(P, f), typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n'); };

w('project.json', {
  schemaVersion: 2, id: 'ultima-ronda', name: 'Última ronda', genre: 'comedia romántica para adultos', language: 'es-ES', fps: 24,
  voiceProvider: 'kokoro',
  description: 'Serie de animación para público adulto: un bar de cócteles que cierra a las dos, su dueña y el cliente que siempre llega a las doce menos cinco. Coqueteo, dobles sentidos y nada explícito.'
});

// ------------------------------------------------------------------ series bible
w('story/canon.md', `# Última ronda — biblia de la serie

**Tono.** Comedia romántica para adultos (no infantil): tensión, coqueteo y dobles sentidos con elegancia. Nada explícito: la sensualidad está en la luz, la ropa, las miradas y lo que no se dice.

**Lugar.** El *Sirena*, un bar de cócteles pequeño, con barra de madera oscura, botellas retroiluminadas y un neón rosa con forma de copa. Cierra a las dos.

**Personajes**
- **Susana Montero (34)**, dueña y coctelera del Sirena. Segura, irónica, magnética; lleva el ritmo de cualquier conversación. Viste de rojo satinado. *Quiere* que alguien se atreva con ella sin teatro. *Teme* aburrirse.
- **Dani Ferrer (37)**, arquitecto, reformó el bar hace tres meses y desde entonces viene cada noche a las 23:55. Ingenioso por escrito, torpe en voz alta. *Quiere* invitar a Susana a cenar. *Teme* hacer el ridículo delante de ella.

**Reglas de la serie.** Cada episodio cubre la última hora del bar. Las ideas de Dani se apuntan en servilletas. Susana inventa un cóctel nuevo por episodio.
`);
w('story/canon.json', {
  schemaVersion: 1,
  facts: [
    { id: 'sirena', text: 'Susana Montero es la dueña del bar de cócteles Sirena, que cierra a las dos.', since: 'canon', status: 'canon', amended: [] },
    { id: 'reforma', text: 'Dani Ferrer, arquitecto, reformó el Sirena hace tres meses.', since: 'canon', status: 'canon', amended: [] },
    { id: 'doce-menos-cinco', text: 'Desde la reforma, Dani llega al Sirena cada noche a las doce menos cinco.', since: 'canon', status: 'canon', amended: [] }
  ],
  characters: {
    susana: { knows: ['sirena', 'reforma', 'doce-menos-cinco'], emotionalState: 'curiosa', goals: ['Que Dani se atreva de una vez'], arc: [] },
    dani: { knows: ['sirena', 'reforma', 'doce-menos-cinco'], emotionalState: 'nervioso', goals: ['Invitar a Susana a cenar'], arc: [] }
  },
  relationships: [
    { a: 'susana', b: 'dani', type: 'clienta y cliente que se gustan', trust: 0.55, history: [] },
    { a: 'dani', b: 'susana', type: 'cliente enamorado', trust: 0.6, history: [] }
  ],
  confirmedEpisodes: []
});
w('story/timeline.json', { schemaVersion: 1, events: [{ id: 'reforma-sirena', episode: 'canon', text: 'Dani termina la reforma del Sirena.' }] });

// ------------------------------------------------------------------ characters
const rig = { schemaVersion: 2, type: 'humanoid', template: 'humanoid-v2', boneOffsets: {}, jointLimits: {} };
const KOKORO_LIC = { id: 'Apache-2.0', commercialUse: 'allowed', notes: 'Kokoro-82M (hexgrad/Kokoro-82M, Apache-2.0) vía kokoro-onnx (MIT). Mezcla de estilos de voz incluida en el modelo.' };
const VB_LIC = { id: 'depende-del-motor', commercialUse: 'unknown', notes: 'Voicebox (MIT): la licencia depende del motor y de la muestra de voz. Usa solo muestras propias o con permiso.' };
const ONECORE_LIC = { id: 'windows-onecore-voices', commercialUse: 'unknown', notes: 'Voz del sistema Windows: revisar términos antes de uso comercial.' };

w('characters/susana/manifest.json', { schemaVersion: 2, id: 'susana', type: 'character', name: 'Susana Montero', rigType: 'humanoid', age: 34, tags: ['protagonista', 'coctelera', 'dueña del Sirena'] });
w('characters/susana/rig.json', rig);
w('characters/susana/geometry.json', {
  schemaVersion: 2, generator: 'humanoid-toon',
  body: { height: 1.72, headScale: 0.96, headWidth: 0.92, jaw: 0.25, shoulderWidth: 0.37, hipWidth: 0.37, torsoScale: 1, legScale: 1.06, armScale: 1, armThickness: 0.044, legThickness: 0.07, chestDepth: 0.23, belly: 0, chest: 0.62, neckLength: 0.085, handSize: 0.9, footSize: 0.88, skinColor: '#c99272', skinGloss: 0.4 },
  face: { eyeSize: 1.12, eyeSpacing: 1, eyeHeight: 0.04, irisColor: '#7a4a22', eyeShape: 'almond', browThickness: 0.85, browColor: '#2a1712', noseShape: 'button', noseSize: 0.8, mouthWidth: 1.02, lipColor: '#b3123a', earSize: 0.85, freckles: false, blush: 0.3 },
  hair: { style: 'long', color: '#3b1a12', volume: 1.25, shine: 0.75 },
  beard: { style: 'none' },
  outfit: {
    top: { type: 'dress', color: '#a8102c', neckline: 'plunge', fabric: 'satin' },
    bottom: { type: 'skirt', color: '#a8102c', fabric: 'satin' },
    shoes: { type: 'shoes', color: '#141014' }
  },
  accessories: [{ type: 'earrings', color: '#e8c25a' }],
  parts: [], outlineWidth: 0.01
});
w('characters/susana/voice.json', {
  schemaVersion: 2, provider: 'kokoro', voice: 'ef_dora:0.8+af_nicole:0.2', language: 'es-ES', rate: 0.95, pitchSemitones: -0.8, formantPreserve: true, gainDb: 0,
  eq: { lowDb: 1.5, midDb: 0, highDb: -1 }, emotionProsody: true,
  instruct: 'Warm, low, slightly husky female voice; confident, amused and teasing',
  alternatives: {
    voicebox: { voice: 'Susana', engine: 'qwen', instruct: 'Warm, low, slightly husky female voice; confident, amused and teasing', license: VB_LIC },
    'windows-onecore': { voice: 'Microsoft Laura', rate: 0.98, pitchSemitones: -1, license: ONECORE_LIC }
  },
  emotions: {
    smirk: { voice: 'ef_dora:0.72+af_nicole:0.28', rate: 0.9, instruct: 'teasing, half-smiling, unhurried, a little breathy' },
    joy: { rate: 1.0, pitchSemitones: 0.6 },
    surprise: { rate: 1.02, pitchSemitones: 1 }
  },
  license: KOKORO_LIC
});
w('characters/susana/personalidad.md', '# Susana — personalidad\n\nSegura, irónica y paciente. Nunca levanta la voz: baja el volumen y se acerca. Disfruta poniendo nerviosa a la gente que le gusta. Detesta las frases ensayadas.\n');
w('characters/susana/biografia.md', '# Susana — biografía\n\nTrabajó diez años en hoteles de lujo antes de abrir el Sirena con todos sus ahorros. Inventa un cóctel nuevo cada semana y no le pone nombre hasta que encuentra la historia adecuada.\n');
w('characters/susana/aspecto.md', '# Susana — aspecto\n\nAlta, figura marcada, melena larga castaña rojiza con brillo. Vestido rojo de satén con escote pronunciado, pendientes dorados, labios rojos. La piel recoge los reflejos de las luces del bar (brillo especular suave).\n');
w('characters/susana/relaciones.json', { schemaVersion: 2, relations: [{ characterId: 'dani', type: 'cliente habitual', feeling: 'curiosidad y ganas', trust: 0.55, history: ['Dani reformó el Sirena.', 'Lleva tres meses viniendo a las doce menos cinco.'] }] });

w('characters/dani/manifest.json', { schemaVersion: 2, id: 'dani', type: 'character', name: 'Dani Ferrer', rigType: 'humanoid', age: 37, tags: ['protagonista', 'arquitecto', 'cliente habitual'] });
w('characters/dani/rig.json', rig);
w('characters/dani/geometry.json', {
  schemaVersion: 2, generator: 'humanoid-toon',
  body: { height: 1.81, headScale: 1, headWidth: 0.98, jaw: 0.6, shoulderWidth: 0.44, hipWidth: 0.31, torsoScale: 1.02, legScale: 1, armScale: 1, armThickness: 0.051, legThickness: 0.074, chestDepth: 0.25, belly: 0, chest: 0.2, neckLength: 0.08, handSize: 1, footSize: 1.02, skinColor: '#e0b08c', skinGloss: 0.18 },
  face: { eyeSize: 1, eyeSpacing: 1, eyeHeight: 0.02, irisColor: '#3d6b8f', eyeShape: 'round', browThickness: 1.2, browColor: '#2a2018', noseShape: 'long', noseSize: 0.9, mouthWidth: 1, lipColor: '#9a4a4a', earSize: 1, freckles: false, blush: 0.15 },
  hair: { style: 'sidepart', color: '#2b2018', volume: 1.05, shine: 0.45 },
  beard: { style: 'stubble', color: '#2b2018' },
  outfit: {
    top: { type: 'longsleeve', color: '#25415e', neckline: 'v', fabric: 'matte' },
    bottom: { type: 'pants', color: '#26262e', fabric: 'matte' },
    shoes: { type: 'shoes', color: '#5a3a22' }
  },
  accessories: [{ type: 'glasses', color: '#1c1c22' }, { type: 'watch', color: '#c9c9c9' }],
  parts: [], outlineWidth: 0.011
});
w('characters/dani/voice.json', {
  schemaVersion: 2, provider: 'kokoro', voice: 'em_santa', language: 'es-ES', rate: 1.0, pitchSemitones: 0, formantPreserve: true, gainDb: 0,
  eq: { lowDb: 1, midDb: 0, highDb: 0 }, emotionProsody: true,
  instruct: 'Friendly male voice, a bit shy and self-deprecating',
  alternatives: {
    voicebox: { voice: 'Dani', engine: 'qwen', instruct: 'Friendly male voice, a bit shy and self-deprecating', license: VB_LIC },
    'windows-onecore': { voice: 'Microsoft Pablo', rate: 1.0, pitchSemitones: -1, license: ONECORE_LIC }
  },
  emotions: { nervous: { rate: 1.08, instruct: 'nervous, rushing the words' } },
  license: KOKORO_LIC
});
w('characters/dani/personalidad.md', '# Dani — personalidad\n\nIngenioso por escrito y torpe en voz alta. Planifica todo en listas. Cuando se pone nervioso habla del tiempo. Es generoso, educado y más valiente de lo que cree.\n');
w('characters/dani/biografia.md', '# Dani — biografía\n\nArquitecto de reformas pequeñas. Le encargaron la del Sirena y se enamoró del bar… y de su dueña. Desde entonces vuelve cada noche con la excusa de «comprobar la iluminación».\n');
w('characters/dani/aspecto.md', '# Dani — aspecto\n\nAlto, hombros anchos, barba de tres días, gafas de pasta, camisa azul con el cuello abierto en uve. Reloj plateado.\n');
w('characters/dani/relaciones.json', { schemaVersion: 2, relations: [{ characterId: 'susana', type: 'la dueña del bar', feeling: 'enamorado en silencio', trust: 0.6, history: ['Reformó el Sirena para ella.'] }] });

// ------------------------------------------------------------------ props
const prop = (id, name, geometry, desc) => { w(`props/${id}/manifest.json`, { schemaVersion: 2, id, type: 'prop', name }); w(`props/${id}/geometry.json`, { schemaVersion: 2, ...geometry }); if (desc) w(`props/${id}/descripcion.md`, `# ${name}\n\n${desc}\n`); };
const part = (id, primitive, size, position, color, extra = {}) => ({ id, primitive, size, position, color, ...extra });
// bar counter running along z (customers on +x, bartender on -x); top at 1.06 m
prop('barra', 'Barra del Sirena', {
  generator: 'parts', material: 'wood',
  parts: [
    part('cuerpo', 'box', [0.5, 1.0, 2.8], [0, 0.5, 0], '#3a1d14'),
    part('frente', 'box', [0.02, 0.86, 2.7], [0.26, 0.5, 0], '#5a2c1e'),
    part('encimera', 'roundedBox', [0.62, 0.06, 2.92], [0.03, 1.03, 0], '#1f0f0b'),
    part('led', 'box', [0.01, 0.025, 2.8], [0.335, 0.97, 0], '#ffb36b', { emissive: '#ffb36b', emissiveIntensity: 1.6, outline: false }),
    part('reposapies', 'cylinder', [0.022, 2.7, 0.022], [0.42, 0.22, 0], '#c9a24a', { rotationDeg: [90, 0, 0] }),
    part('fregadero', 'box', [0.3, 0.02, 0.45], [-0.08, 1.065, -0.9], '#8a9096', { outline: false })
  ],
  anchors: { top: { position: [0.05, 1.06, 0] }, cliente: { position: [0.12, 1.06, 0.55] }, susana: { position: [-0.14, 1.06, 0.62] } }
}, 'Barra de madera oscura con encimera brillante, tira de luz ámbar y reposapiés de latón.');
// back bar against the left wall: glowing shelves with bottles
const bottles = [];
const bc = ['#3f7a4a', '#c9a24a', '#7a1f2b', '#e8e3d8', '#2c5d8a', '#b36b2a', '#5a2a6b', '#d9c47a'];
for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
  const z = -1.3 + i * 0.32 + (row % 2) * 0.08, y = 1.02 + row * 0.42, h = 0.24 + ((i * 7 + row * 3) % 5) * 0.025;
  bottles.push(part(`botella${row}-${i}`, 'cylinder', [0.042, h, 0.042], [0.02, y + h / 2, z], bc[(i + row * 3) % bc.length], { outline: false }));
  bottles.push(part(`cuello${row}-${i}`, 'cylinder', [0.014, 0.07, 0.014], [0.02, y + h + 0.035, z], bc[(i + row * 3) % bc.length], { outline: false }));
}
prop('botellero', 'Botellero retroiluminado', {
  generator: 'parts', material: 'wood',
  parts: [
    part('mueble', 'box', [0.36, 0.95, 3.0], [0, 0.475, 0], '#2a140e'),
    part('fondo', 'box', [0.03, 1.4, 2.9], [-0.15, 1.65, 0], '#7a2a8a', { emissive: '#b04ac8', emissiveIntensity: 0.9, outline: false }),
    ...[0, 1, 2].map(r => part(`balda${r}`, 'box', [0.3, 0.03, 2.9], [0, 1.0 + r * 0.42, 0], '#1d0e0a')),
    ...bottles
  ],
  anchors: { top: { position: [0, 0.95, 0] } }
}, 'Mueble bajo y tres baldas de botellas delante de un panel morado retroiluminado.');
prop('neon-copa', 'Neón de la copa', {
  generator: 'parts', material: 'glass',
  parts: [
    part('borde', 'torus', [0.32, 0.018, 0], [0, 0.55, 0], '#ff4fa8', { rotationDeg: [90, 0, 0], emissive: '#ff4fa8', emissiveIntensity: 3, outline: false }),
    part('caliz-l', 'cylinder', [0.018, 0.5, 0.018], [-0.15, 0.33, 0], '#ff4fa8', { rotationDeg: [0, 0, -34], emissive: '#ff4fa8', emissiveIntensity: 3, outline: false }),
    part('caliz-r', 'cylinder', [0.018, 0.5, 0.018], [0.15, 0.33, 0], '#ff4fa8', { rotationDeg: [0, 0, 34], emissive: '#ff4fa8', emissiveIntensity: 3, outline: false }),
    part('tallo', 'cylinder', [0.018, 0.34, 0.018], [0, -0.04, 0], '#ff4fa8', { emissive: '#ff4fa8', emissiveIntensity: 3, outline: false }),
    part('pie', 'cylinder', [0.018, 0.34, 0.018], [0, -0.21, 0], '#ff4fa8', { rotationDeg: [0, 0, 90], emissive: '#ff4fa8', emissiveIntensity: 3, outline: false }),
    part('aceituna', 'sphere', [0.06, 0.06, 0.06], [0.08, 0.5, 0], '#7dff8a', { emissive: '#7dff8a', emissiveIntensity: 2.5, outline: false })
  ]
}, 'Rótulo de neón rosa con forma de copa de cóctel y una aceituna verde.');
prop('lampara-barra', 'Lámpara colgante', { generator: 'lamp', params: { height: 2.15, color: '#1d1410', lightColor: '#ffb874', intensity: 2.6, distance: 4.5 }, material: 'metal' }, 'Lámpara de pantalla negra sobre la barra, luz cálida.');
prop('taburete-alto', 'Taburete alto', { generator: 'stool', params: { seatHeight: 0.76, color: '#8a1c2b' }, material: 'cloth' }, 'Taburete de barra tapizado en terciopelo granate.');
prop('copa', 'Copa de cóctel', {
  generator: 'parts', material: 'glass', restHeight: 0,
  parts: [
    part('caliz', 'cone', [0.055, 0.075, 0], [0, 0.135, 0], '#ffd2e6', { rotationDeg: [180, 0, 0] }),
    part('bebida', 'cone', [0.047, 0.055, 0], [0, 0.128, 0], '#ff3f7f', { rotationDeg: [180, 0, 0], emissive: '#ff3f7f', emissiveIntensity: 0.35, outline: false }),
    part('tallo', 'cylinder', [0.006, 0.09, 0.006], [0, 0.05, 0], '#ffe6f0', { outline: false }),
    part('pie', 'cylinder', [0.035, 0.008, 0.035], [0, 0.004, 0], '#ffe6f0', { outline: false }),
    part('guinda', 'sphere', [0.012, 0.012, 0.012], [0.025, 0.178, 0], '#c4122e', { outline: false })
  ],
  anchors: { grip: { position: [0, 0.05, 0] } }
}, 'Copa de cóctel con un combinado rosa y una guinda.');
prop('servilleta', 'Servilleta con la lista', {
  generator: 'parts', material: 'cloth', restHeight: 0.002,
  parts: [part('papel', 'box', [0.13, 0.003, 0.13], [0, 0.0015, 0], '#f4efe6'), part('tinta', 'box', [0.08, 0.001, 0.05], [0, 0.0035, 0.01], '#2b3a6b', { outline: false })],
  anchors: { grip: { position: [0, 0.002, 0] } }
}, 'Servilleta de papel con una lista escrita a bolígrafo.');
prop('coctelera', 'Coctelera', {
  generator: 'parts', material: 'metal', restHeight: 0,
  parts: [part('vaso', 'cylinder', [0.042, 0.16, 0.036], [0, 0.08, 0], '#d6dbe0'), part('tapa', 'cone', [0.042, 0.06, 0], [0, 0.19, 0], '#d6dbe0'), part('tapon', 'cylinder', [0.014, 0.025, 0.014], [0, 0.23, 0], '#b8bec4')],
  anchors: { grip: { position: [0, 0.1, 0] } }
}, 'Coctelera de acero.');
prop('vela', 'Vela de mesa', {
  generator: 'parts', material: 'glass', restHeight: 0, params: { lightIntensity: 0.9, lightColor: '#ffb347', lightY: 0.14, lightDistance: 2.4 },
  parts: [part('vaso', 'cylinder', [0.04, 0.08, 0.04], [0, 0.04, 0], '#c96a3a'), part('llama', 'sphere', [0.012, 0.026, 0.012], [0, 0.1, 0], '#ffd27a', { emissive: '#ffb347', emissiveIntensity: 4, outline: false })]
}, 'Vela en vaso de cristal ámbar.');
prop('puerta-bar', 'Puerta del Sirena', { generator: 'door', params: { width: 0.95, height: 2.1, color: '#2a140e' }, material: 'wood' }, 'Puerta de madera oscura.');
prop('sofa-rincon', 'Sofá del rincón', { generator: 'sofa', params: { color: '#5a1626' }, material: 'cloth' }, 'Sofá de terciopelo granate.');
prop('mesa-baja', 'Mesa baja', { generator: 'table', params: { width: 0.9, depth: 0.55, height: 0.45, topColor: '#1f0f0b', legColor: '#c9a24a' }, material: 'wood' });
prop('planta-bar', 'Planta', { generator: 'plant', params: {}, material: 'cloth' });

// ------------------------------------------------------------------ environment
w('environments/sirena/manifest.json', { schemaVersion: 2, id: 'sirena', type: 'environment', name: 'Bar Sirena' });
w('environments/sirena/descripcion.md', '# Bar Sirena\n\nBar de cócteles nocturno: suelo de tarima oscura, paredes granate, barra a lo largo de la sala, botellero retroiluminado en morado, neón rosa en forma de copa y lámparas colgantes cálidas. Luz de clave cálida, contraluces magenta y relleno azul frío para que la piel y el satén brillen.\n');
w('environments/sirena/environment.json', {
  schemaVersion: 2, kind: 'room', size: [8, 3.3, 6.4],
  floor: { color: '#3a2219', pattern: 'planks', secondaryColor: '#321c14' },
  walls: { color: '#4a1a26', trimColor: '#24100f', sides: ['back', 'left', 'right'], panel: true },
  openings: [
    { id: 'ventana', type: 'window', wall: 'back', offset: 1.9, width: 2.0, height: 1.3, sill: 1.0, glow: '#4a3a9a' },
    { id: 'entrada', type: 'door', wall: 'right', offset: -1.2, width: 1, height: 2.15, sill: 0 }
  ],
  sky: { top: '#0d0a1c', bottom: '#1c1236' },
  lights: [
    { type: 'key', position: [1.8, 3.6, 2.6], target: [-0.3, 1.2, 0], color: '#ffc49a', intensity: 1.7, castShadow: true },
    { type: 'fill', position: [3.5, 2.4, 4], target: [0, 1.2, 0], color: '#7f9cff', intensity: 0.45 },
    { type: 'rim', position: [-3.2, 2.6, -2.4], target: [0, 1.3, 0.2], color: '#ff4fa8', intensity: 1.5 },
    { type: 'rim', position: [3, 2.2, -2.8], target: [-0.5, 1.3, 0.3], color: '#b04ac8', intensity: 0.9 },
    { type: 'point', position: [-3.5, 1.7, -0.2], color: '#c060ff', intensity: 1.4, distance: 3.5 }
  ],
  ambient: { sky: '#d7c6ff', ground: '#3a1c22', intensity: 0.95 },
  props: [
    { id: 'barra', propId: 'barra', position: [-1.2, 0, -0.4], yawDeg: 0, scale: 1 },
    { id: 'botellero', propId: 'botellero', position: [-3.75, 0, -0.4], yawDeg: 0, scale: 1 },
    { id: 'neon', propId: 'neon-copa', position: [0.6, 2.05, -3.12], yawDeg: 0, scale: 1 },
    { id: 'lampara-1', propId: 'lampara-barra', position: [-1.15, 0, -1.2], yawDeg: 0, scale: 1 },
    { id: 'lampara-2', propId: 'lampara-barra', position: [-1.15, 0, 0.5], yawDeg: 0, scale: 1 },
    { id: 'taburete-1', propId: 'taburete-alto', position: [-0.42, 0, 0.25], yawDeg: -90, scale: 1 },
    { id: 'taburete-2', propId: 'taburete-alto', position: [-0.42, 0, -0.75], yawDeg: -90, scale: 1 },
    { id: 'taburete-3', propId: 'taburete-alto', position: [-0.42, 0, -1.6], yawDeg: -90, scale: 1 },
    { id: 'sofa', propId: 'sofa-rincon', position: [2.6, 0, -2.5], yawDeg: -20, scale: 1 },
    { id: 'mesa', propId: 'mesa-baja', position: [2.4, 0, -1.6], yawDeg: -20, scale: 1 },
    { id: 'vela-mesa', propId: 'vela', position: [2.4, 0.45, -1.6], yawDeg: 0, scale: 1 },
    { id: 'planta', propId: 'planta-bar', position: [3.6, 0, -2.9], yawDeg: 0, scale: 1.2 },
    { id: 'puerta', propId: 'puerta-bar', position: [3.97, 0, -1.2], yawDeg: -90, scale: 1 }
  ],
  decor: [
    { type: 'poster', wall: 'back', offset: -1.6, height: 1.7, color: '#c9a24a', width: 0.7 },
    { type: 'clock', wall: 'back', offset: -0.4, height: 2.5, color: '#c9a24a', width: 0.35 },
    { type: 'sign', wall: 'right', offset: 1.4, height: 2.2, color: '#ff4fa8', width: 1.0 }
  ],
  walkable: { min: [-3.4, -2.9], max: [3.6, 2.6] }
});

// ------------------------------------------------------------------ music (procedural, original)
const mus = (id, o) => w(`audio/music/${id}.json`, { schemaVersion: 2, id, kind: 'music', generator: 'procedural', license: { id: 'procedural-original', source: 'Series Forge procedural composer', commercialUse: 'allowed' }, ...o });
mus('sirena-tema', { style: 'lounge', tempo: 96, key: 'F', mode: 'dorian', sevenths: true, swing: 0.33, progression: ['i', 'iv', 'VII', 'III', 'VI', 'ii', 'v', 'i'], instruments: ['keys', 'bass', 'brushes', 'snaps', 'lead'], seed: 21, durationSec: 40, mood: 'lounge nocturno, coqueto' });
mus('sirena-cama', { style: 'bossa', tempo: 118, key: 'F', mode: 'dorian', sevenths: true, progression: ['i', 'iv', 'VII', 'III'], instruments: ['guitar', 'bass', 'brushes', 'pad'], seed: 5, durationSec: 60, mood: 'bossa suave bajo los diálogos' });
mus('sirena-cortinilla', { style: 'lounge', form: 'sting', tempo: 112, key: 'F', mode: 'dorian', sevenths: true, swing: 0.3, progression: ['iv', 'v'], instruments: ['keys', 'bass', 'brushes', 'lead', 'strings'], seed: 9, durationSec: 4.2, mood: 'cortinilla entre escenas' });
mus('sirena-remate', { style: 'sitcom', form: 'button', tempo: 120, key: 'F', mode: 'major', instruments: ['keys', 'bass', 'drums', 'lead'], seed: 3, durationSec: 1.8, mood: 'remate cómico' });
mus('sirena-romance', { style: 'lounge', tempo: 76, key: 'A#', mode: 'major', sevenths: true, swing: 0.2, progression: ['I', 'vi', 'ii', 'V'], instruments: ['keys', 'strings', 'bass', 'lead'], seed: 33, durationSec: 30, mood: 'momento romántico' });
// ep. 2
mus('pasion-vol3', { style: 'lounge', tempo: 68, key: 'D#', mode: 'major', sevenths: true, swing: 0.15, progression: ['I', 'vi', 'IV', 'V'], instruments: ['keys', 'bass', 'strings', 'lead', 'snaps'], seed: 69, durationSec: 40, mood: '«Noches de pasión vol. 3»: balada hortera de la lista de Óscar (diegética)' });
mus('sirena-alarma', { style: 'sitcom', form: 'sting', tempo: 132, key: 'C', mode: 'minor', progression: ['iv', 'V'], instruments: ['keys', 'bass', 'drums', 'strings'], seed: 13, durationSec: 2.6, mood: 'cortinilla de tensión: llega la ex' });

// ------------------------------------------------------------------ ep. 2 cast
w('characters/marga/manifest.json', { schemaVersion: 2, id: 'marga', type: 'character', name: 'Marga Ruiz', rigType: 'humanoid', age: 41, tags: ['secundaria', 'camarera del Sirena', 'amiga de Susana'] });
w('characters/marga/rig.json', rig);
w('characters/marga/geometry.json', {
  schemaVersion: 2, generator: 'humanoid-toon',
  body: { height: 1.63, headScale: 1.02, headWidth: 1.02, jaw: 0.4, shoulderWidth: 0.4, hipWidth: 0.4, torsoScale: 1, legScale: 0.96, armScale: 1, armThickness: 0.05, legThickness: 0.078, chestDepth: 0.25, belly: 0.12, chest: 0.6, neckLength: 0.07, handSize: 0.95, footSize: 0.92, skinColor: '#efc2a2', skinGloss: 0.3 },
  face: { eyeSize: 1.05, eyeSpacing: 1.02, eyeHeight: 0.03, irisColor: '#4a7a3a', eyeShape: 'almond', browThickness: 1.1, browColor: '#7a2a18', noseShape: 'round', noseSize: 0.95, mouthWidth: 1.08, lipColor: '#9c2f3c', earSize: 0.9, freckles: true, blush: 0.35 },
  hair: { style: 'bob', color: '#b8361e', volume: 1.15, shine: 0.5 },
  beard: { style: 'none' },
  outfit: {
    top: { type: 'vest', color: '#17171c', secondaryColor: '#f2efe8', neckline: 'scoop', fabric: 'satin' },
    bottom: { type: 'pants', color: '#17171c', fabric: 'matte' },
    shoes: { type: 'shoes', color: '#2a1a12' }
  },
  accessories: [{ type: 'earrings', color: '#c0c6cc' }, { type: 'apron', color: '#2a2a30' }],
  parts: [], outlineWidth: 0.011
});
w('characters/marga/voice.json', {
  schemaVersion: 2, provider: 'kokoro', voice: 'ef_dora:0.65+af_sarah:0.35', language: 'es-ES', rate: 1.06, pitchSemitones: 1.2, formantPreserve: true, gainDb: 0,
  eq: { lowDb: 0, midDb: 1, highDb: 0 }, emotionProsody: true,
  instruct: 'Sharp, quick, sarcastic female voice, a little raspy',
  alternatives: { voicebox: { voice: 'Marga', engine: 'qwen', license: VB_LIC }, 'windows-onecore': { voice: 'Microsoft Helena', rate: 1.05, license: ONECORE_LIC } },
  emotions: { angry: { rate: 1.1, gainDb: 1 }, smirk: { rate: 1.0 } },
  license: KOKORO_LIC
});
w('characters/marga/personalidad.md', '# Marga — personalidad\n\nLengua rápida, corazón blando. Dice en voz alta lo que Susana piensa. Apuesta por todo. Desconfía del amor desde que se divorció, aunque sigue llevando el anillo en el bolsillo del delantal.\n');
w('characters/marga/biografia.md', '# Marga — biografía\n\nCamarera del Sirena desde que abrió. Estuvo casada cinco años con un fisioterapeuta «que sabía dónde tocar pero nunca cuándo callarse». Lleva tres años divorciada.\n');
w('characters/marga/aspecto.md', '# Marga — aspecto\n\nPelirroja con melena corta, pecas, chaleco negro de satén sobre camisa blanca con escote redondo, delantal, pendientes plateados.\n');
w('characters/marga/relaciones.json', { schemaVersion: 2, relations: [{ characterId: 'susana', type: 'mejor amiga y compañera', feeling: 'protectora', trust: 0.85, history: ['Trabaja en el Sirena desde el primer día.'] }, { characterId: 'oscar', type: 'exmarido', feeling: 'rencor con nostalgia', trust: 0.2, history: ['Estuvieron casados cinco años.'] }] });

w('characters/oscar/manifest.json', { schemaVersion: 2, id: 'oscar', type: 'character', name: 'Óscar Benítez', rigType: 'humanoid', age: 39, tags: ['secundario', 'fisioterapeuta', 'mejor amigo de Dani'] });
w('characters/oscar/rig.json', rig);
w('characters/oscar/geometry.json', {
  schemaVersion: 2, generator: 'humanoid-toon',
  body: { height: 1.76, headScale: 1.04, headWidth: 1.05, jaw: 0.75, shoulderWidth: 0.5, hipWidth: 0.33, torsoScale: 1.04, legScale: 0.95, armScale: 1, armThickness: 0.062, legThickness: 0.08, chestDepth: 0.28, belly: 0.05, chest: 0.35, neckLength: 0.06, handSize: 1.05, footSize: 1.05, skinColor: '#a86b4a', skinGloss: 0.3 },
  face: { eyeSize: 0.95, eyeSpacing: 1.05, eyeHeight: 0, irisColor: '#3a2a1a', eyeShape: 'narrow', browThickness: 1.5, browColor: '#141414', noseShape: 'wide', noseSize: 1.05, mouthWidth: 1.12, lipColor: '#7a3a32', earSize: 1, freckles: false, blush: 0 },
  hair: { style: 'spiky', color: '#141414', volume: 0.9, shine: 0.6 },
  beard: { style: 'goatee', color: '#141414' },
  outfit: {
    top: { type: 'tshirt', color: '#d35400', neckline: 'v', fabric: 'matte' },
    bottom: { type: 'pants', color: '#2c4a6e', fabric: 'matte' },
    shoes: { type: 'sneakers', color: '#f2f2f2', soleColor: '#d35400' }
  },
  accessories: [{ type: 'watch', color: '#c9a24a' }],
  parts: [], outlineWidth: 0.011
});
w('characters/oscar/voice.json', {
  schemaVersion: 2, provider: 'kokoro', voice: 'em_alex', language: 'es-ES', rate: 1.05, pitchSemitones: -0.6, formantPreserve: true, gainDb: 0.5,
  eq: { lowDb: 2, midDb: 0, highDb: 0 }, emotionProsody: true,
  instruct: 'Loud, confident, cheerful male voice, a bit of a show-off',
  alternatives: { voicebox: { voice: 'Óscar', engine: 'qwen', license: VB_LIC }, 'windows-onecore': { voice: 'Microsoft Pablo', rate: 1.06, license: ONECORE_LIC } },
  emotions: { fear: { rate: 1.12, pitchSemitones: 1.5 } },
  license: KOKORO_LIC
});
w('characters/oscar/personalidad.md', '# Óscar — personalidad\n\nSeguro de sí mismo sin motivo. Da consejos de seducción que nunca le han funcionado. Leal hasta lo ridículo. No sabe guardar un secreto más de un minuto.\n');
w('characters/oscar/biografia.md', '# Óscar — biografía\n\nFisioterapeuta, mejor amigo de Dani desde el instituto. Divorciado de una camarera pelirroja de la que nunca habla… hasta que la ve.\n');
w('characters/oscar/aspecto.md', '# Óscar — aspecto\n\nHombros anchos, perilla, pelo de punta, camiseta naranja ajustada, vaqueros y zapatillas blancas, reloj dorado. Huele a colonia desde el rellano.\n');
w('characters/oscar/relaciones.json', { schemaVersion: 2, relations: [{ characterId: 'dani', type: 'mejor amigo', feeling: 'lealtad absoluta', trust: 0.9, history: ['Amigos desde el instituto.'] }, { characterId: 'marga', type: 'exmujer', feeling: 'la sigue queriendo', trust: 0.3, history: ['Cinco años casados.'] }] });

w('characters/lucia/manifest.json', { schemaVersion: 2, id: 'lucia', type: 'character', name: 'Lucía Vidal', rigType: 'humanoid', age: 31, tags: ['secundaria', 'influencer', 'ex de Dani'] });
w('characters/lucia/rig.json', rig);
w('characters/lucia/geometry.json', {
  schemaVersion: 2, generator: 'humanoid-toon',
  body: { height: 1.75, headScale: 0.95, headWidth: 0.9, jaw: 0.2, shoulderWidth: 0.36, hipWidth: 0.34, torsoScale: 0.98, legScale: 1.1, armScale: 1, armThickness: 0.042, legThickness: 0.066, chestDepth: 0.22, belly: 0, chest: 0.5, neckLength: 0.09, handSize: 0.88, footSize: 0.86, skinColor: '#e6b48f', skinGloss: 0.55 },
  face: { eyeSize: 1.15, eyeSpacing: 0.98, eyeHeight: 0.05, irisColor: '#3d6fa8', eyeShape: 'almond', browThickness: 0.75, browColor: '#8a6a3a', noseShape: 'button', noseSize: 0.75, mouthWidth: 1.0, lipColor: '#d4507a', earSize: 0.8, freckles: false, blush: 0.4 },
  hair: { style: 'ponytail', color: '#e2bd72', volume: 1.2, shine: 0.85 },
  beard: { style: 'none' },
  outfit: {
    top: { type: 'dress', color: '#14141c', neckline: 'off-shoulder', fabric: 'sequin' },
    bottom: { type: 'skirt', color: '#14141c', fabric: 'sequin' },
    shoes: { type: 'shoes', color: '#c9a24a' }
  },
  accessories: [{ type: 'earrings', color: '#e8c25a' }, { type: 'glasses', color: '#2a1a14' }],
  parts: [], outlineWidth: 0.01
});
w('characters/lucia/voice.json', {
  schemaVersion: 2, provider: 'kokoro', voice: 'ef_dora:0.6+af_heart:0.4', language: 'es-ES', rate: 1.0, pitchSemitones: 2.0, formantPreserve: true, gainDb: 0,
  eq: { lowDb: -1, midDb: 0, highDb: 1 }, emotionProsody: true,
  instruct: 'Bright, sugary, slightly theatrical female voice',
  alternatives: { voicebox: { voice: 'Lucía', engine: 'qwen', license: VB_LIC }, 'windows-onecore': { voice: 'Microsoft Helena', rate: 1.02, pitchSemitones: 1.5, license: ONECORE_LIC } },
  emotions: { smirk: { voice: 'ef_dora:0.5+af_heart:0.5', rate: 0.96 } },
  license: KOKORO_LIC
});
w('characters/lucia/personalidad.md', '# Lucía — personalidad\n\nEncantadora, teatral y acostumbrada a conseguir lo que quiere. Habla de sí misma en tercera persona cuando graba vídeos. No es mala: simplemente nunca ha oído un «no».\n');
w('characters/lucia/biografia.md', '# Lucía — biografía\n\nInfluencer de moda con medio millón de seguidores. Dejó a Dani hace dos años por un DJ de Ibiza al que conoció en un yate. Ha vuelto a la ciudad para abrir una tienda.\n');
w('characters/lucia/aspecto.md', '# Lucía — aspecto\n\nAlta, rubia con coleta brillante, gafas de sol en la cabeza, vestido negro de lentejuelas con los hombros al aire, labios fucsia.\n');
w('characters/lucia/relaciones.json', { schemaVersion: 2, relations: [{ characterId: 'dani', type: 'exnovio', feeling: 'nostalgia interesada', trust: 0.4, history: ['Lo dejó por un DJ de Ibiza.'] }] });

// ------------------------------------------------------------------ ep. 2 set: Dani's flat
prop('isla-cocina', 'Isla de cocina', {
  generator: 'parts', material: 'stone',
  parts: [
    part('cuerpo', 'box', [2.2, 0.86, 0.75], [0, 0.43, 0], '#e8e4dc'),
    part('encimera', 'box', [2.3, 0.05, 0.82], [0, 0.885, 0], '#3a3d42'),
    part('fogon', 'box', [0.6, 0.012, 0.5], [-0.55, 0.915, 0], '#141414', { outline: false }),
    part('fuego-1', 'torus', [0.09, 0.008, 0], [-0.68, 0.923, -0.1], '#ff5a1f', { rotationDeg: [90, 0, 0], emissive: '#ff5a1f', emissiveIntensity: 1.8, outline: false }),
    part('fuego-2', 'torus', [0.07, 0.008, 0], [-0.4, 0.923, 0.12], '#3a3a3a', { rotationDeg: [90, 0, 0], outline: false }),
    part('tabla', 'box', [0.45, 0.02, 0.3], [0.45, 0.92, 0.05], '#b07a4a'),
    part('tomate', 'sphere', [0.04, 0.04, 0.04], [0.4, 0.95, 0.05], '#d9342b', { outline: false }),
    part('libro', 'box', [0.22, 0.03, 0.3], [0.85, 0.925, -0.05], '#2e6f9e', { rotationDeg: [0, 15, 0] })
  ],
  anchors: { top: { position: [0, 0.91, 0] }, fogon: { position: [-0.55, 0.92, 0] } }
}, 'Isla blanca con encimera gris, fogón encendido, tabla con tomates y el libro de recetas de la abuela.');
prop('olla', 'Olla del risotto', {
  generator: 'parts', material: 'metal', restHeight: 0,
  parts: [part('cuerpo', 'cylinder', [0.13, 0.16, 0.13], [0, 0.08, 0], '#b8bec4'), part('arroz', 'cylinder', [0.12, 0.01, 0.12], [0, 0.15, 0], '#e8dcb0', { outline: false }), part('mango', 'box', [0.2, 0.02, 0.03], [0.2, 0.14, 0], '#2a2a2a')],
  anchors: { grip: { position: [0.24, 0.14, 0] } }
}, 'Olla de acero con el risotto de la abuela.');
prop('plato', 'Plato', { generator: 'parts', material: 'glass', restHeight: 0, parts: [part('plato', 'cylinder', [0.13, 0.015, 0.13], [0, 0.008, 0], '#f4f1ea'), part('comida', 'cylinder', [0.07, 0.02, 0.07], [0, 0.02, 0], '#3a2a1a', { outline: false })] }, 'Plato con risotto (quemado).');
prop('botella-vino', 'Botella de vino', { generator: 'parts', material: 'glass', restHeight: 0, parts: [part('cuerpo', 'cylinder', [0.04, 0.22, 0.04], [0, 0.11, 0], '#3a0e18'), part('cuello', 'cylinder', [0.015, 0.09, 0.015], [0, 0.265, 0], '#3a0e18'), part('etiqueta', 'cylinder', [0.041, 0.07, 0.041], [0, 0.1, 0], '#e8dcc0', { outline: false })] }, 'Vino tinto.');
prop('copa-vino', 'Copa de vino', { generator: 'parts', material: 'glass', restHeight: 0, parts: [part('caliz', 'sphere', [0.04, 0.05, 0.04], [0, 0.15, 0], '#f2e6ee'), part('vino', 'sphere', [0.034, 0.025, 0.034], [0, 0.135, 0], '#7a1022', { outline: false }), part('tallo', 'cylinder', [0.005, 0.1, 0.005], [0, 0.05, 0], '#f2e6ee', { outline: false }), part('pie', 'cylinder', [0.03, 0.006, 0.03], [0, 0.003, 0], '#f2e6ee', { outline: false })], anchors: { grip: { position: [0, 0.06, 0] } } }, 'Copa de vino tinto.');
prop('movil', 'Móvil', { generator: 'parts', material: 'plastic', restHeight: 0.004, parts: [part('cuerpo', 'roundedBox', [0.075, 0.008, 0.15], [0, 0.004, 0], '#1a1a1e'), part('pantalla', 'box', [0.066, 0.002, 0.135], [0, 0.009, 0], '#5ab0ff', { emissive: '#5ab0ff', emissiveIntensity: 0.8, outline: false })], anchors: { grip: { position: [0, 0.004, 0] } } }, 'Móvil con la pantalla encendida.');
prop('colonia', 'Colonia de Óscar', { generator: 'parts', material: 'glass', restHeight: 0, parts: [part('frasco', 'roundedBox', [0.07, 0.11, 0.035], [0, 0.055, 0], '#ffb347'), part('tapon', 'cylinder', [0.015, 0.03, 0.015], [0, 0.125, 0], '#c9a24a')], anchors: { grip: { position: [0, 0.05, 0] } } }, 'Frasco de colonia «Tormenta salvaje».');
prop('caja-tarta', 'Caja de tarta', { generator: 'parts', material: 'cloth', restHeight: 0, parts: [part('caja', 'box', [0.26, 0.12, 0.26], [0, 0.06, 0], '#f2d7e4'), part('cinta', 'box', [0.27, 0.125, 0.03], [0, 0.06, 0], '#c4122e', { outline: false })], anchors: { grip: { position: [0, 0.06, 0] } } }, 'Caja de pastelería con lazo.');
prop('altavoz', 'Altavoz', { generator: 'parts', material: 'plastic', restHeight: 0, params: { lightIntensity: 0.35, lightColor: '#ff4fa8', lightY: 0.12, lightDistance: 1.4 }, parts: [part('cuerpo', 'cylinder', [0.07, 0.18, 0.07], [0, 0.09, 0], '#202024'), part('anillo', 'torus', [0.07, 0.008, 0], [0, 0.18, 0], '#ff4fa8', { rotationDeg: [90, 0, 0], emissive: '#ff4fa8', emissiveIntensity: 2, outline: false })] }, 'Altavoz inteligente con anillo de luz.');
prop('mesa-comedor', 'Mesa de comedor', { generator: 'table', params: { width: 1.3, depth: 0.85, height: 0.76, topColor: '#7a5234', legColor: '#2a2a2a' }, material: 'wood' });
prop('silla', 'Silla', { generator: 'chair', params: { color: '#2e4a5e', seatHeight: 0.47 }, material: 'wood' });
prop('sofa-piso', 'Sofá', { generator: 'sofa', params: { color: '#6b7f5a' }, material: 'cloth' });
prop('lampara-comedor', 'Lámpara del comedor', { generator: 'lamp', params: { height: 2.15, color: '#e8e4dc', lightColor: '#ffd9a6', intensity: 2.4, distance: 4.5 }, material: 'metal' });
prop('estanteria-piso', 'Estantería', { generator: 'shelf', params: { color: '#7a5234', height: 1.9 }, material: 'wood' });
prop('maqueta', 'Maqueta de arquitecto', { generator: 'parts', material: 'plastic', restHeight: 0, parts: [part('base', 'box', [0.4, 0.02, 0.3], [0, 0.01, 0], '#e8e4dc'), part('torre', 'box', [0.08, 0.3, 0.08], [-0.08, 0.17, 0], '#f4f1ea'), part('bloque', 'box', [0.16, 0.12, 0.1], [0.08, 0.08, 0.05], '#f4f1ea')] }, 'Maqueta blanca de un edificio.');

w('environments/piso-dani/manifest.json', { schemaVersion: 2, id: 'piso-dani', type: 'environment', name: 'Piso de Dani' });
w('environments/piso-dani/descripcion.md', '# Piso de Dani\n\nSalón-cocina de arquitecto: isla blanca con fogón, mesa de comedor para dos bajo una lámpara cálida, sofá verde, estantería con maquetas, ventanal con la ciudad de noche. Puerta de entrada a la derecha y puerta del dormitorio a la izquierda.\n');
w('environments/piso-dani/environment.json', {
  schemaVersion: 2, kind: 'room', size: [7.5, 3.0, 6.5],
  floor: { color: '#8a6a4a', pattern: 'planks', secondaryColor: '#7d5f42' },
  walls: { color: '#d8d0c2', trimColor: '#9a8f80', sides: ['back', 'left', 'right'], panel: false },
  openings: [
    { id: 'ventanal', type: 'window', wall: 'back', offset: 1.3, width: 2.4, height: 1.6, sill: 0.7, glow: '#3a4a8a' },
    { id: 'entrada', type: 'door', wall: 'right', offset: 1.2, width: 1, height: 2.1, sill: 0 },
    { id: 'dormitorio', type: 'door', wall: 'left', offset: 0.6, width: 0.9, height: 2.1, sill: 0 }
  ],
  sky: { top: '#0b1020', bottom: '#1a2240' },
  lights: [
    { type: 'key', position: [2.2, 3.4, 3.2], target: [0, 1.0, -0.4], color: '#ffe0c0', intensity: 1.6, castShadow: true },
    { type: 'fill', position: [-3, 2.2, 3.5], target: [0, 1.1, 0], color: '#a8c0ff', intensity: 0.55 },
    { type: 'rim', position: [0.8, 2.5, -3.0], target: [0, 1.3, 0.2], color: '#7f9cff', intensity: 1.0 }
  ],
  ambient: { sky: '#fff1dc', ground: '#5a4a3a', intensity: 1.15 },
  props: [
    { id: 'isla', propId: 'isla-cocina', position: [-1.7, 0, -1.6], yawDeg: 0, scale: 1 },
    { id: 'mesa-comedor', propId: 'mesa-comedor', position: [1.0, 0, 0.2], yawDeg: 0, scale: 1 },
    { id: 'silla-1', propId: 'silla', position: [0.3, 0, 0.2], yawDeg: 90, scale: 1 },
    { id: 'silla-2', propId: 'silla', position: [1.7, 0, 0.2], yawDeg: -90, scale: 1 },
    { id: 'lampara', propId: 'lampara-comedor', position: [1.0, 0, 0.2], yawDeg: 0, scale: 1 },
    { id: 'sofa', propId: 'sofa-piso', position: [2.6, 0, -2.4], yawDeg: -25, scale: 1 },
    { id: 'mesita', propId: 'mesa-baja', position: [2.3, 0, -1.4], yawDeg: -25, scale: 1 },
    { id: 'altavoz', propId: 'altavoz', position: [2.3, 0.45, -1.4], yawDeg: 0, scale: 1 },
    { id: 'estanteria', propId: 'estanteria-piso', position: [-3.3, 0, -2.4], yawDeg: 90, scale: 1 },
    { id: 'maqueta', propId: 'maqueta', position: [-3.3, 1.02, -2.4], yawDeg: 90, scale: 1 },
    { id: 'planta', propId: 'planta-bar', position: [3.3, 0, -2.9], yawDeg: 0, scale: 1.1 },
    { id: 'puerta', propId: 'puerta-bar', position: [3.72, 0, 1.2], yawDeg: -90, scale: 1 },
    { id: 'puerta-cuarto', propId: 'puerta-bar', position: [-3.72, 0, 0.6], yawDeg: 90, scale: 1 }
  ],
  decor: [
    { type: 'poster', wall: 'back', offset: -1.4, height: 1.6, color: '#2e6f9e', width: 0.9 },
    { type: 'clock', wall: 'right', offset: -1.2, height: 2.2, color: '#2a2a2a', width: 0.3 },
    { type: 'poster', wall: 'left', offset: -1.6, height: 1.7, color: '#c96a3a', width: 0.6 }
  ],
  walkable: { min: [-3.4, -2.9], max: [3.4, 2.8] }
});
console.log('ok');
