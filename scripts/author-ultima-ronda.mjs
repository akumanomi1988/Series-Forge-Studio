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
- **Vera Montero (34)**, dueña y coctelera del Sirena. Segura, irónica, magnética; lleva el ritmo de cualquier conversación. Viste de rojo satinado. *Quiere* que alguien se atreva con ella sin teatro. *Teme* aburrirse.
- **Dani Ferrer (37)**, arquitecto, reformó el bar hace tres meses y desde entonces viene cada noche a las 23:55. Ingenioso por escrito, torpe en voz alta. *Quiere* invitar a Vera a cenar. *Teme* hacer el ridículo delante de ella.

**Reglas de la serie.** Cada episodio cubre la última hora del bar. Las ideas de Dani se apuntan en servilletas. Vera inventa un cóctel nuevo por episodio.
`);
w('story/canon.json', {
  schemaVersion: 1,
  facts: [
    { id: 'sirena', text: 'Vera Montero es la dueña del bar de cócteles Sirena, que cierra a las dos.', since: 'canon', status: 'canon', amended: [] },
    { id: 'reforma', text: 'Dani Ferrer, arquitecto, reformó el Sirena hace tres meses.', since: 'canon', status: 'canon', amended: [] },
    { id: 'doce-menos-cinco', text: 'Desde la reforma, Dani llega al Sirena cada noche a las doce menos cinco.', since: 'canon', status: 'canon', amended: [] }
  ],
  characters: {
    vera: { knows: ['sirena', 'reforma', 'doce-menos-cinco'], emotionalState: 'curiosa', goals: ['Que Dani se atreva de una vez'], arc: [] },
    dani: { knows: ['sirena', 'reforma', 'doce-menos-cinco'], emotionalState: 'nervioso', goals: ['Invitar a Vera a cenar'], arc: [] }
  },
  relationships: [
    { a: 'vera', b: 'dani', type: 'clienta y cliente que se gustan', trust: 0.55, history: [] },
    { a: 'dani', b: 'vera', type: 'cliente enamorado', trust: 0.6, history: [] }
  ],
  confirmedEpisodes: []
});
w('story/timeline.json', { schemaVersion: 1, events: [{ id: 'reforma-sirena', episode: 'canon', text: 'Dani termina la reforma del Sirena.' }] });

// ------------------------------------------------------------------ characters
const rig = { schemaVersion: 2, type: 'humanoid', template: 'humanoid-v2', boneOffsets: {}, jointLimits: {} };
const KOKORO_LIC = { id: 'Apache-2.0', commercialUse: 'allowed', notes: 'Kokoro-82M (hexgrad/Kokoro-82M, Apache-2.0) vía kokoro-onnx (MIT). Mezcla de estilos de voz incluida en el modelo.' };
const VB_LIC = { id: 'depende-del-motor', commercialUse: 'unknown', notes: 'Voicebox (MIT): la licencia depende del motor y de la muestra de voz. Usa solo muestras propias o con permiso.' };
const ONECORE_LIC = { id: 'windows-onecore-voices', commercialUse: 'unknown', notes: 'Voz del sistema Windows: revisar términos antes de uso comercial.' };

w('characters/vera/manifest.json', { schemaVersion: 2, id: 'vera', type: 'character', name: 'Vera Montero', rigType: 'humanoid', age: 34, tags: ['protagonista', 'coctelera', 'dueña del Sirena'] });
w('characters/vera/rig.json', rig);
w('characters/vera/geometry.json', {
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
w('characters/vera/voice.json', {
  schemaVersion: 2, provider: 'kokoro', voice: 'ef_dora:0.8+af_nicole:0.2', language: 'es-ES', rate: 0.95, pitchSemitones: -0.8, formantPreserve: true, gainDb: 0,
  eq: { lowDb: 1.5, midDb: 0, highDb: -1 }, emotionProsody: true,
  instruct: 'Warm, low, slightly husky female voice; confident, amused and teasing',
  alternatives: {
    voicebox: { voice: 'Vera', engine: 'qwen', instruct: 'Warm, low, slightly husky female voice; confident, amused and teasing', license: VB_LIC },
    'windows-onecore': { voice: 'Microsoft Laura', rate: 0.98, pitchSemitones: -1, license: ONECORE_LIC }
  },
  emotions: {
    smirk: { voice: 'ef_dora:0.72+af_nicole:0.28', rate: 0.9, instruct: 'teasing, half-smiling, unhurried, a little breathy' },
    joy: { rate: 1.0, pitchSemitones: 0.6 },
    surprise: { rate: 1.02, pitchSemitones: 1 }
  },
  license: KOKORO_LIC
});
w('characters/vera/personalidad.md', '# Vera — personalidad\n\nSegura, irónica y paciente. Nunca levanta la voz: baja el volumen y se acerca. Disfruta poniendo nerviosa a la gente que le gusta. Detesta las frases ensayadas.\n');
w('characters/vera/biografia.md', '# Vera — biografía\n\nTrabajó diez años en hoteles de lujo antes de abrir el Sirena con todos sus ahorros. Inventa un cóctel nuevo cada semana y no le pone nombre hasta que encuentra la historia adecuada.\n');
w('characters/vera/aspecto.md', '# Vera — aspecto\n\nAlta, figura marcada, melena larga castaña rojiza con brillo. Vestido rojo de satén con escote pronunciado, pendientes dorados, labios rojos. La piel recoge los reflejos de las luces del bar (brillo especular suave).\n');
w('characters/vera/relaciones.json', { schemaVersion: 2, relations: [{ characterId: 'dani', type: 'cliente habitual', feeling: 'curiosidad y ganas', trust: 0.55, history: ['Dani reformó el Sirena.', 'Lleva tres meses viniendo a las doce menos cinco.'] }] });

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
w('characters/dani/relaciones.json', { schemaVersion: 2, relations: [{ characterId: 'vera', type: 'la dueña del bar', feeling: 'enamorado en silencio', trust: 0.6, history: ['Reformó el Sirena para ella.'] }] });

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
  anchors: { top: { position: [0.05, 1.06, 0] }, cliente: { position: [0.12, 1.06, 0.55] }, vera: { position: [-0.14, 1.06, 0.62] } }
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
console.log('ok');
