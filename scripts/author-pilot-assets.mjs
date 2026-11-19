// One-off authoring helper used to write the pilot asset files (the files themselves are the source of truth).
import fs from 'node:fs'; import path from 'node:path';
const P = 'examples/projects/el-ultimo-turno';
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(P, f)), { recursive: true }); fs.writeFileSync(path.join(P, f), typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n'); };
w('project.json', { schemaVersion: 2, id: 'el-ultimo-turno', name: 'El último turno', genre: 'comedia dramática de ciencia ficción', language: 'es-ES', fps: 24, description: 'Serie piloto de Series Forge Studio: un pequeño taller de reparación de robots en una ciudad futurista.' });
w('characters/bruno/manifest.json', { schemaVersion: 2, id: 'bruno', type: 'character', name: 'Bruno Castell', rigType: 'humanoid', age: 46, tags: ['protagonista', 'mecánico'] });
w('characters/bruno/geometry.json', { schemaVersion: 2, generator: 'humanoid-toon',
  body: { height: 1.74, headScale: 1.06, headWidth: 1.05, jaw: 0.85, shoulderWidth: 0.5, hipWidth: 0.34, armThickness: 0.064, legThickness: 0.084, chestDepth: 0.27, belly: 0.55, chest: 0.4, neckLength: 0.055, handSize: 1.1, footSize: 1.05, skinColor: '#d9a27a' },
  face: { eyeSize: 0.92, eyeSpacing: 1.02, irisColor: '#6b4a2e', eyeShape: 'round', browThickness: 1.7, noseShape: 'round', noseSize: 1.3, mouthWidth: 1.05, lipColor: '#7a2f3a', earSize: 1.1 },
  hair: { style: 'short', color: '#3a2a20', volume: 0.95 }, beard: { style: 'full', color: '#3a2a20' },
  outfit: { top: { type: 'overalls', color: '#3f6e9e', secondaryColor: '#e7e1d3' }, bottom: { type: 'pants', color: '#3f6e9e' }, shoes: { type: 'boots', color: '#5a3b26' } },
  accessories: [{ type: 'goggles', color: '#5c4b36', secondaryColor: '#e8a33d', position: 'forehead' }, { type: 'toolbelt', color: '#6b4a2f', secondaryColor: '#8a6542' }], parts: [], outlineWidth: 0.012 });
w('characters/bruno/rig.json', { schemaVersion: 2, type: 'humanoid', template: 'humanoid-v2', boneOffsets: {}, jointLimits: {} });
w('characters/bruno/voice.json', { schemaVersion: 2, provider: 'windows-onecore', voice: 'Microsoft Pablo', language: 'es-ES', rate: 0.96, pitchSemitones: -2.5, formantPreserve: true, gainDb: 0, eq: { lowDb: 2.5, midDb: 0, highDb: -1.5 }, emotionProsody: true, license: { id: 'windows-onecore-voices', commercialUse: 'unknown', notes: 'Voz del sistema Windows. Revisar los términos de licencia de Windows antes de distribuir comercialmente; alternativa: proveedor piper con un modelo de licencia verificada.' } });
w('characters/bruno/relaciones.json', { schemaVersion: 2, relations: [{ characterId: 'lara', type: 'compañeros de taller', feeling: 'aprecio y miedo a decepcionarla', trust: 0.7, history: ['Fundaron juntos el Taller 7 hace seis años.'] }] });
w('characters/bruno/aspecto.md', '# Bruno — aspecto\n\nMecánico corpulento de 46 años, barba castaña poblada y pelo corto. Peto vaquero azul sobre camiseta crema, botas marrones gastadas, gafas de soldar subidas a la frente y un cinturón de herramientas que nunca se quita.\n');
w('characters/bruno/personalidad.md', '# Bruno — personalidad\n\n- Ingenioso con las manos, torpe con las palabras.\n- Optimista hasta la negación: minimiza los problemas para no preocupar a nadie.\n- Defecto: oculta errores en lugar de admitirlos.\n- Motivación: demostrar que el taller puede sobrevivir sin vender a los grandes consorcios.\n');
w('characters/bruno/biografia.md', '# Bruno — biografía\n\nTrabajó veinte años en la cadena de montaje de Consorcio Helix hasta que la automatizaron. Con su indemnización abrió el Taller 7 junto a Lara. Repara robots domésticos viejos que nadie más quiere arreglar.\n');
w('characters/bruno/gustos.md', '# Bruno — gustos\n\nCafé recalentado, radio de onda corta, piezas antiguas de latón. Odia las actualizaciones automáticas.\n');
w('characters/lara/manifest.json', { schemaVersion: 2, id: 'lara', type: 'character', name: 'Lara Ibarra', rigType: 'humanoid', age: 33, tags: ['protagonista', 'ingeniera'] });
w('characters/lara/geometry.json', { schemaVersion: 2, generator: 'humanoid-toon',
  body: { height: 1.69, headScale: 1.0, headWidth: 0.95, jaw: 0.3, shoulderWidth: 0.4, hipWidth: 0.33, armThickness: 0.048, legThickness: 0.068, chestDepth: 0.22, belly: 0, chest: 0.45, neckLength: 0.075, handSize: 0.95, footSize: 0.92, skinColor: '#b97a55' },
  face: { eyeSize: 1.12, eyeSpacing: 1.0, eyeHeight: 0.05, irisColor: '#2f7d5b', eyeShape: 'almond', browThickness: 1.0, browColor: '#1d1a24', noseShape: 'button', noseSize: 0.85, mouthWidth: 0.95, lipColor: '#a33a4a', earSize: 0.9, blush: 0.25 },
  hair: { style: 'ponytail', color: '#1d1a24', volume: 1.1 }, beard: { style: 'none' },
  outfit: { top: { type: 'jacket', color: '#c0392b', secondaryColor: '#2c3e50' }, bottom: { type: 'pants', color: '#2c3e50' }, shoes: { type: 'sneakers', color: '#ecf0f1', soleColor: '#c0392b' } },
  accessories: [{ type: 'badge', color: '#f1c40f' }, { type: 'watch', color: '#2d2d2d' }, { type: 'earrings', color: '#f1c40f' }], parts: [], outlineWidth: 0.011 });
w('characters/lara/rig.json', { schemaVersion: 2, type: 'humanoid', template: 'humanoid-v2', boneOffsets: {}, jointLimits: {} });
w('characters/lara/voice.json', { schemaVersion: 2, provider: 'windows-onecore', voice: 'Microsoft Laura', language: 'es-ES', rate: 1.04, pitchSemitones: 0.5, formantPreserve: true, gainDb: 0, eq: { lowDb: 0, midDb: 1, highDb: 1 }, emotionProsody: true, license: { id: 'windows-onecore-voices', commercialUse: 'unknown', notes: 'Voz del sistema Windows. Revisar términos antes de distribución comercial.' } });
w('characters/lara/relaciones.json', { schemaVersion: 2, relations: [{ characterId: 'bruno', type: 'compañeros de taller', feeling: 'cariño exasperado', trust: 0.6, history: ['Fundaron juntos el Taller 7 hace seis años.', 'Bruno le ocultó una deuda el año pasado.'] }] });
w('characters/lara/aspecto.md', '# Lara — aspecto\n\nIngeniera de 33 años, delgada, coleta negra alta, ojos verdes almendrados. Chaqueta roja con cremallera, pantalones azul marino, zapatillas blancas, reloj negro y una placa amarilla de inspectora de seguridad.\n');
w('characters/lara/personalidad.md', '# Lara — personalidad\n\n- Observadora y directa; detecta cualquier evasiva.\n- Ironía como defensa.\n- Defecto: impaciencia.\n- Motivación: que el taller sea seguro y legal antes de la inspección.\n');
w('characters/lara/biografia.md', '# Lara — biografía\n\nIngeniera de sistemas expulsada de la academia por auditar sin permiso un proyecto militar. Se ocupa de la parte legal y de seguridad del Taller 7.\n');
w('characters/lara/gustos.md', '# Lara — gustos\n\nTé frío, diagramas limpios, puzles mecánicos. Odia que le mientan.\n');
const prop = (id, name, geo, desc) => { w(`props/${id}/manifest.json`, { schemaVersion: 2, id, type: 'prop', name }); w(`props/${id}/geometry.json`, { schemaVersion: 2, ...geo }); w(`props/${id}/descripcion.md`, `# ${name}\n\n${desc}\n`); };
prop('banco-trabajo', 'Banco de trabajo', { generator: 'workbench', params: { width: 1.8, depth: 0.8, height: 0.92, topColor: '#9b7552', legColor: '#3e4a56' }, material: 'wood' }, 'Banco de madera con tornillo de banco y cajón.');
prop('robot-r7', 'Robot R-7', { generator: 'robot', params: { height: 1.1, color: '#c8ccd2', accent: '#e8a33d', eyeColor: '#5ff0ff', damaged: true }, material: 'metal' }, 'Robot doméstico R-7, modelo antiguo. Panel frontal abierto, cableado expuesto, ojo derecho apagado.');
prop('fusible-nucleo', 'Fusible de núcleo', { generator: 'component', params: { radius: 0.032, length: 0.13, color: '#cfd6dc', glow: '#ff5a3c', lying: true }, material: 'metal', restHeight: 0.032 }, 'Fusible del núcleo del R-7, quemado. La pieza que Bruno intenta esconder.');
prop('puerta-taller', 'Puerta del taller', { generator: 'door', params: { width: 1.0, height: 2.15, color: '#56708a', frameColor: '#2b3947', accent: '#e8a33d' }, material: 'metal' }, 'Puerta metálica con ventanilla y placa naranja.');
prop('estanteria', 'Estantería', { generator: 'shelf', params: { width: 1.3, height: 2.0, depth: 0.42, color: '#6d5640' }, material: 'wood' }, 'Estantería con cajas de piezas.');
prop('lampara-taller', 'Lámpara colgante', { generator: 'lamp', params: { height: 2.55, color: '#2f3b46', lightColor: '#ffcf8a', intensity: 3.2, distance: 6 }, material: 'metal' }, 'Lámpara sobre el banco.');
prop('consola', 'Consola de diagnóstico', { generator: 'console', params: { height: 1.1, color: '#3a4552', screenColor: '#3fd2ff' }, material: 'metal' }, 'Terminal de diagnóstico.');
prop('taburete', 'Taburete', { generator: 'stool', params: { seatHeight: 0.66, color: '#c0392b' }, material: 'metal' }, 'Taburete de metal.');
prop('caja-herramientas', 'Caja de herramientas', { generator: 'toolbox', params: { height: 0.22, color: '#c0392b' }, material: 'metal' }, 'Caja roja de herramientas.');
prop('barril', 'Bidón', { generator: 'barrel', params: { height: 0.9, color: '#2e6e8e' }, material: 'metal' }, 'Bidón de refrigerante.');
prop('planta', 'Planta', { generator: 'plant' }, 'Planta de Lara, sorprendentemente viva.');
w('environments/taller/manifest.json', { schemaVersion: 2, id: 'taller', type: 'environment', name: 'Taller 7' });
w('environments/taller/descripcion.md', '# Taller 7\n\nTaller de reparación en un bajo de la ciudad. Atardecer naranja por el ventanal del fondo, lámpara cálida sobre el banco, pantallas cian de la consola. Puerta metálica a la izquierda.\n');
w('environments/taller/environment.json', { schemaVersion: 2, kind: 'room', size: [9, 3.6, 7],
  floor: { color: '#59636d', pattern: 'concrete', secondaryColor: '#4f5862' },
  walls: { color: '#2f4c5f', trimColor: '#1d2d3a', sides: ['back', 'left', 'right'], panel: true },
  openings: [{ id: 'ventanal', type: 'window', wall: 'back', offset: -1.4, width: 2.6, height: 1.4, sill: 1.1, glow: '#ffab6b' }, { id: 'puerta', type: 'door', wall: 'left', offset: 0.6, width: 1.0, height: 2.15, sill: 0 }],
  sky: { top: '#1b2533', bottom: '#16202b' },
  lights: [{ type: 'key', position: [-2.5, 4.5, -1], target: [0.5, 0.6, 0.5], color: '#ffc9a0', intensity: 2.1, castShadow: true }, { type: 'fill', position: [4, 3, 5], target: [0, 1, 0], color: '#9ec3ff', intensity: 0.75 }, { type: 'rim', position: [2, 3, -3], target: [0, 1.2, 0], color: '#ffb37a', intensity: 0.9 }, { type: 'point', position: [3.4, 1.8, -1.2], color: '#3fd2ff', intensity: 1.2, distance: 4 }],
  ambient: { sky: '#cddcff', ground: '#3a3a44', intensity: 1.25 },
  props: [
    { id: 'banco', propId: 'banco-trabajo', position: [1.7, 0, -2.95], yawDeg: 0, scale: 1 },
    { id: 'lampara', propId: 'lampara-taller', position: [1.7, 0, -2.75], yawDeg: 0, scale: 1 },
    { id: 'estanteria', propId: 'estanteria', position: [-3.6, 0, -3.2], yawDeg: 0, scale: 1 },
    { id: 'consola', propId: 'consola', position: [3.7, 0, -1.3], yawDeg: -65, scale: 1 },
    { id: 'taburete', propId: 'taburete', position: [2.6, 0, -1.8], yawDeg: 0, scale: 1 },
    { id: 'caja', propId: 'caja-herramientas', position: [1.1, 0.92, -2.85], yawDeg: 12, scale: 1 },
    { id: 'barril', propId: 'barril', position: [-3.9, 0, -1.9], yawDeg: 0, scale: 1 },
    { id: 'planta', propId: 'planta', position: [3.9, 0, -3.1], yawDeg: 0, scale: 1 },
    { id: 'puerta', propId: 'puerta-taller', position: [-4.47, 0, 0.6], yawDeg: 90, scale: 1 }],
  decor: [{ type: 'pegboard', wall: 'back', offset: 1.7, height: 1.75, color: '#7b6a55', width: 1.6 }, { type: 'sign', wall: 'back', offset: 3.4, height: 2.7, color: '#e8a33d', width: 1.2 }, { type: 'poster', wall: 'left', offset: -2.2, height: 1.7, color: '#2f8f83', width: 0.6 }, { type: 'pipe', wall: 'back', offset: 0, height: 3.2, color: '#7f8c8d', width: 9 }, { type: 'vent', wall: 'right', offset: -1.5, height: 2.8, color: '#555555', width: 0.8 }, { type: 'clock', wall: 'right', offset: 1.2, height: 2.4, color: '#eeeeee', width: 0.4 }, { type: 'shelf-boxes', wall: 'right', offset: -0.2, height: 1.9, color: '#6d5640', width: 1.4 }] });
console.log('ok');
