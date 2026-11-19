/** Regenerates library/humanoid/{animations,expressions}/*.json — the shared, inheritable humanoid library.
 * These files are DATA: agents may edit them or override them per project/character without touching engine code.
 * Run: node scripts/generate-library.ts */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClipSchemaV2, LocomotionSchema, ExpressionSchemaV2 } from '../src/engine/schema.ts';

const root = join(import.meta.dirname, '..', 'library', 'humanoid');
type K = [number, [number, number, number]] | [number, [number, number, number], string];
const rot = (bone: string, keys: K[]) => ({ bone, property: 'rotation' as const, keys: keys.map(([t, v, e]) => (e ? { t, v, ease: e } : { t, v })) });
const pos = (bone: string, keys: K[]) => ({ bone, property: 'position' as const, keys: keys.map(([t, v, e]) => (e ? { t, v, ease: e } : { t, v })) });
const clip = (id: string, description: string, duration: number, extra: Record<string, unknown>) => ClipSchemaV2.parse({ schemaVersion: 2, id, description, duration, ...extra });

const clips = [
  clip('idle', 'Respiración y cambio de peso sutil, bucle.', 4, { loop: true, layer: 'full', tracks: [
    rot('chest', [[0, [1, 0, 0]], [1.6, [-1.2, 0.5, 0]], [3.2, [1, 0, 0]], [4, [1, 0, 0]]]),
    rot('spine', [[0, [0, 0, -1]], [2, [0, 0, 1]], [4, [0, 0, -1]]]),
    pos('hips', [[0, [0.006, 0, 0]], [2, [-0.006, -0.004, 0]], [4, [0.006, 0, 0]]]),
    rot('leftUpperArm', [[0, [2, 0, 6]], [2, [-1, 0, 7]], [4, [2, 0, 6]]]),
    rot('rightUpperArm', [[0, [-1, 0, -6]], [2, [2, 0, -7]], [4, [-1, 0, -6]]]),
    rot('leftLowerArm', [[0, [-10, 0, 0]], [4, [-10, 0, 0]]]), rot('rightLowerArm', [[0, [-10, 0, 0]], [4, [-10, 0, 0]]]),
    rot('neck', [[0, [0, 0, 0]], [2.2, [1.5, 2, 0]], [4, [0, 0, 0]]])
  ] }),
  clip('idle-relaxed', 'Reposo con peso en una pierna y brazos sueltos.', 5, { loop: true, layer: 'full', tracks: [
    pos('hips', [[0, [0.02, -0.01, 0]], [2.5, [0.025, -0.012, 0]], [5, [0.02, -0.01, 0]]]),
    rot('hips', [[0, [0, 0, 3]], [5, [0, 0, 3]]]), rot('chest', [[0, [1, 0, -3]], [2.5, [-1, 0, -3.5]], [5, [1, 0, -3]]]),
    rot('leftUpperArm', [[0, [0, 0, 5]], [5, [0, 0, 5]]]), rot('rightUpperArm', [[0, [3, 0, -8]], [5, [3, 0, -8]]]),
    rot('leftLowerArm', [[0, [-6, 0, 0]], [5, [-6, 0, 0]]]), rot('rightLowerArm', [[0, [-14, 0, 0]], [5, [-14, 0, 0]]])
  ] }),
  clip('point', 'Señala con el brazo derecho; apunta a target si la acción lo define.', 1.8, { layer: 'arms', tracks: [
    rot('rightUpperArm', [[0, [0, 0, -6]], [0.35, [-82, 0, -14]], [1.4, [-82, 0, -14]], [1.8, [0, 0, -6]]]),
    rot('rightLowerArm', [[0, [-10, 0, 0]], [0.35, [-6, 0, 0]], [1.4, [-6, 0, 0]], [1.8, [-10, 0, 0]]])
  ], ik: [{ chain: 'rightArm', target: { space: 'actor', offset: [0, 0, 0] }, weight: [[0, 0], [0.35, 1], [1.4, 1], [1.8, 0]] }], grip: { right: 0.35 } }),
  clip('wave', 'Saludo con la mano derecha.', 1.8, { layer: 'arms', tracks: [
    rot('rightUpperArm', [[0, [0, 0, -6]], [0.3, [-20, 0, -135]], [1.5, [-20, 0, -135]], [1.8, [0, 0, -6]]]),
    rot('rightLowerArm', [[0, [-10, 0, 0]], [0.3, [-30, 0, 20]], [0.55, [-30, 0, -20]], [0.8, [-30, 0, 20]], [1.05, [-30, 0, -20]], [1.3, [-30, 0, 20]], [1.8, [-10, 0, 0]]])
  ] }),
  clip('shrug', 'Encoge los hombros con palmas arriba.', 1.3, { layer: 'upper', tracks: [
    rot('leftShoulder', [[0, [0, 0, 0]], [0.35, [0, 0, 14]], [0.9, [0, 0, 14]], [1.3, [0, 0, 0]]]),
    rot('rightShoulder', [[0, [0, 0, 0]], [0.35, [0, 0, -14]], [0.9, [0, 0, -14]], [1.3, [0, 0, 0]]]),
    rot('leftUpperArm', [[0, [0, 0, 6]], [0.35, [-10, 0, 22]], [0.9, [-10, 0, 22]], [1.3, [0, 0, 6]]]),
    rot('rightUpperArm', [[0, [0, 0, -6]], [0.35, [-10, 0, -22]], [0.9, [-10, 0, -22]], [1.3, [0, 0, -6]]]),
    rot('leftLowerArm', [[0, [-10, 0, 0]], [0.35, [-75, -40, 0]], [0.9, [-75, -40, 0]], [1.3, [-10, 0, 0]]]),
    rot('rightLowerArm', [[0, [-10, 0, 0]], [0.35, [-75, 40, 0]], [0.9, [-75, 40, 0]], [1.3, [-10, 0, 0]]]),
    rot('head', [[0, [0, 0, 0]], [0.35, [-4, 0, 8]], [0.9, [-4, 0, 8]], [1.3, [0, 0, 0]]])
  ] }),
  clip('cross-arms', 'Brazos cruzados (IK hacia el pecho).', 1.2, { layer: 'arms', loop: false, tracks: [], ik: [
    { chain: 'leftArm', target: { bone: 'chest', offset: [-0.1, -0.06, 0.2], space: 'bone' }, weight: [[0, 0], [0.5, 1]] },
    { chain: 'rightArm', target: { bone: 'chest', offset: [0.1, -0.02, 0.22], space: 'bone' }, weight: [[0, 0], [0.55, 1]] }
  ], grip: { left: 0.6, right: 0.6 } }),
  clip('hands-on-hips', 'Manos en la cintura.', 1, { layer: 'arms', tracks: [], ik: [
    { chain: 'leftArm', target: { bone: 'hips', offset: [0.19, 0.08, 0.0], space: 'bone' }, weight: [[0, 0], [0.45, 1]] },
    { chain: 'rightArm', target: { bone: 'hips', offset: [-0.19, 0.08, 0.0], space: 'bone' }, weight: [[0, 0], [0.45, 1]] }
  ], grip: { left: 0.7, right: 0.7 } }),
  clip('think', 'Mano a la barbilla, pensativo.', 1.2, { layer: 'upper', tracks: [rot('head', [[0, [0, 0, 0]], [0.6, [6, 0, 7]], [1.2, [6, 0, 7]]])], ik: [
    { chain: 'rightArm', target: { bone: 'head', offset: [0.0, 0.02, 0.16], space: 'bone' }, weight: [[0, 0], [0.55, 1]] },
    { chain: 'leftArm', target: { bone: 'chest', offset: [-0.02, -0.16, 0.2], space: 'bone' }, weight: [[0, 0], [0.6, 1]] }
  ], grip: { right: 0.7, left: 0.5 } }),
  clip('facepalm', 'Se lleva la mano a la cara.', 1.6, { layer: 'upper', tracks: [rot('head', [[0, [0, 0, 0]], [0.5, [16, 0, 0]], [1.3, [16, 0, 0]], [1.6, [0, 0, 0]]])], ik: [
    { chain: 'rightArm', target: { bone: 'head', offset: [0.0, 0.14, 0.16], space: 'bone' }, weight: [[0, 0], [0.45, 1], [1.3, 1], [1.6, 0]] }
  ], grip: { right: 0.1 } }),
  clip('nervous', 'Inquieto: frota las manos, hombros tensos. Bucle.', 1.6, { layer: 'upper', loop: true, tracks: [
    rot('leftShoulder', [[0, [0, 0, 6]], [1.6, [0, 0, 6]]]), rot('rightShoulder', [[0, [0, 0, -6]], [1.6, [0, 0, -6]]]),
    rot('head', [[0, [3, -6, 0]], [0.8, [3, 6, 0]], [1.6, [3, -6, 0]]])
  ], ik: [
    { chain: 'leftArm', target: { bone: 'hips', offset: [0.03, 0.2, 0.24], space: 'bone' }, weight: [[0, 1], [1.6, 1]] },
    { chain: 'rightArm', target: { bone: 'hips', offset: [-0.03, 0.22, 0.25], space: 'bone' }, weight: [[0, 1], [1.6, 1]] }
  ], grip: { left: 0.5, right: 0.5 } }),
  clip('laugh-body', 'Sacudidas de risa (aditivo).', 0.5, { layer: 'additive', loop: true, tracks: [
    rot('chest', [[0, [0, 0, 0]], [0.12, [5, 0, 0]], [0.25, [0, 0, 0]], [0.37, [5, 0, 0]], [0.5, [0, 0, 0]]]),
    rot('head', [[0, [-6, 0, 0]], [0.12, [-2, 0, 0]], [0.25, [-6, 0, 0]], [0.37, [-2, 0, 0]], [0.5, [-6, 0, 0]]]),
    rot('leftShoulder', [[0, [0, 0, 0]], [0.12, [0, 0, 5]], [0.25, [0, 0, 0]], [0.37, [0, 0, 5]], [0.5, [0, 0, 0]]]),
    rot('rightShoulder', [[0, [0, 0, 0]], [0.12, [0, 0, -5]], [0.25, [0, 0, 0]], [0.37, [0, 0, -5]], [0.5, [0, 0, 0]]])
  ] }),
  clip('angry-gesture', 'Gesto de enfado con el puño derecho.', 1.4, { layer: 'arms', tracks: [
    rot('rightUpperArm', [[0, [0, 0, -6]], [0.3, [-40, 0, -18]], [0.55, [-35, 0, -18]], [0.75, [-45, 0, -18]], [1.1, [-40, 0, -18]], [1.4, [0, 0, -6]]]),
    rot('rightLowerArm', [[0, [-10, 0, 0]], [0.3, [-100, 0, 0]], [0.55, [-85, 0, 0]], [0.75, [-105, 0, 0]], [1.1, [-100, 0, 0]], [1.4, [-10, 0, 0]]])
  ], grip: { right: 1 } }),
  clip('explain', 'Gesticula al hablar con ambas manos abiertas.', 2.4, { layer: 'arms', loop: true, tracks: [
    rot('leftUpperArm', [[0, [-18, 0, 12]], [0.6, [-26, 0, 16]], [1.2, [-16, 0, 12]], [1.8, [-24, 0, 15]], [2.4, [-18, 0, 12]]]),
    rot('rightUpperArm', [[0, [-22, 0, -14]], [0.6, [-14, 0, -12]], [1.2, [-28, 0, -16]], [1.8, [-16, 0, -12]], [2.4, [-22, 0, -14]]]),
    rot('leftLowerArm', [[0, [-62, -25, 0]], [1.2, [-70, -35, 0]], [2.4, [-62, -25, 0]]]),
    rot('rightLowerArm', [[0, [-68, 30, 0]], [1.2, [-58, 22, 0]], [2.4, [-68, 30, 0]]])
  ], grip: { left: 0.1, right: 0.1 } }),
  clip('dismiss', 'Gesto de quitar importancia con la mano.', 1.1, { layer: 'arms', tracks: [
    rot('rightUpperArm', [[0, [0, 0, -6]], [0.25, [-30, 0, -10]], [0.55, [-25, 0, -35]], [1.1, [0, 0, -6]]]),
    rot('rightLowerArm', [[0, [-10, 0, 0]], [0.25, [-80, 30, 0]], [0.55, [-55, 60, 0]], [1.1, [-10, 0, 0]]])
  ] }),
  clip('present', 'Presenta algo con la palma abierta.', 1.5, { layer: 'arms', tracks: [
    rot('leftUpperArm', [[0, [0, 0, 6]], [0.35, [-35, 0, 25]], [1.1, [-35, 0, 25]], [1.5, [0, 0, 6]]]),
    rot('leftLowerArm', [[0, [-10, 0, 0]], [0.35, [-45, -60, 0]], [1.1, [-45, -60, 0]], [1.5, [-10, 0, 0]]])
  ] }),
  clip('crouch', 'Agacharse manteniendo los pies (IK).', 0.7, { layer: 'full', tracks: [
    pos('hips', [[0, [0, 0, 0]], [0.7, [0, -0.42, 0.06]]]), rot('spine', [[0, [0, 0, 0]], [0.7, [22, 0, 0]]]), rot('chest', [[0, [0, 0, 0]], [0.7, [12, 0, 0]]]), rot('head', [[0, [0, 0, 0]], [0.7, [-18, 0, 0]]])
  ] }),
  clip('jump', 'Salto en el sitio con anticipación y recepción.', 1.3, { layer: 'full', tracks: [
    pos('hips', [[0, [0, 0, 0]], [0.28, [0, -0.2, 0.03]], [0.55, [0, 0.38, 0], 'easeOut'], [0.82, [0, 0, 0], 'easeIn'], [0.95, [0, -0.14, 0.02]], [1.3, [0, 0, 0]]]),
    rot('spine', [[0, [0, 0, 0]], [0.28, [16, 0, 0]], [0.55, [-4, 0, 0]], [0.95, [12, 0, 0]], [1.3, [0, 0, 0]]]),
    rot('leftUpperArm', [[0, [0, 0, 6]], [0.28, [40, 0, 8]], [0.55, [-150, 0, 10]], [0.95, [-30, 0, 15]], [1.3, [0, 0, 6]]]),
    rot('rightUpperArm', [[0, [0, 0, -6]], [0.28, [40, 0, -8]], [0.55, [-150, 0, -10]], [0.95, [-30, 0, -15]], [1.3, [0, 0, -6]]]),
    rot('leftThigh', [[0.3, [0, 0, 0]], [0.55, [-20, 0, 0]], [0.82, [-10, 0, 0]]]), rot('rightThigh', [[0.3, [0, 0, 0]], [0.55, [-20, 0, 0]], [0.82, [-10, 0, 0]]]),
    rot('leftShin', [[0.3, [0, 0, 0]], [0.55, [35, 0, 0]], [0.82, [10, 0, 0]]]), rot('rightShin', [[0.3, [0, 0, 0]], [0.55, [35, 0, 0]], [0.82, [10, 0, 0]]])
  ], contacts: [{ foot: 'both', from: 0, to: 0.36 }, { foot: 'both', from: 0.8, to: 1.3 }] }),
  clip('hold-object', 'Sujeta un objeto con ambas manos delante del pecho.', 0.6, { layer: 'arms', tracks: [], ik: [
    { chain: 'leftArm', target: { bone: 'chest', offset: [0.1, -0.12, 0.3], space: 'bone' }, weight: [[0, 0], [0.6, 1]] },
    { chain: 'rightArm', target: { bone: 'chest', offset: [-0.1, -0.12, 0.3], space: 'bone' }, weight: [[0, 0], [0.6, 1]] }
  ], grip: { left: 0.8, right: 0.8 } }),
  clip('pick-up', 'Postura corporal de recoger del suelo (la mano usa IK desde la acción pickUp).', 1.2, { layer: 'full', tracks: [
    pos('hips', [[0, [0, 0, 0]], [0.5, [0, -0.38, 0.08]], [0.7, [0, -0.38, 0.08]], [1.2, [0, 0, 0]]]),
    rot('spine', [[0, [0, 0, 0]], [0.5, [30, 0, 0]], [0.7, [30, 0, 0]], [1.2, [0, 0, 0]]]),
    rot('chest', [[0, [0, 0, 0]], [0.5, [18, 0, 0]], [0.7, [18, 0, 0]], [1.2, [0, 0, 0]]])
  ] }),
  clip('sit-idle', 'Sentado: respiración con manos en los muslos.', 4, { layer: 'upper', loop: true, tracks: [
    rot('chest', [[0, [1, 0, 0]], [2, [-1, 0, 0]], [4, [1, 0, 0]]])
  ] }),
  clip('nod', 'Asiente con la cabeza (aditivo).', 0.9, { layer: 'additive', tracks: [rot('head', [[0, [0, 0, 0]], [0.22, [14, 0, 0]], [0.45, [-3, 0, 0]], [0.65, [10, 0, 0]], [0.9, [0, 0, 0]]])] }),
  clip('headshake', 'Niega con la cabeza (aditivo).', 1, { layer: 'additive', tracks: [rot('head', [[0, [0, 0, 0]], [0.2, [0, 18, 0]], [0.45, [0, -18, 0]], [0.7, [0, 14, 0]], [1, [0, 0, 0]]])] }),
  clip('look-around', 'Mira alrededor (cabeza y pecho).', 3, { layer: 'head', tracks: [
    rot('neck', [[0, [0, 0, 0]], [0.8, [0, 35, 0]], [1.6, [5, -30, 0]], [2.4, [0, 10, 0]], [3, [0, 0, 0]]]),
    rot('head', [[0, [0, 0, 0]], [0.8, [-5, 20, 0]], [1.6, [0, -25, 0]], [3, [0, 0, 0]]])
  ] }),
  clip('hide-behind', 'Esconde la mano derecha tras la espalda.', 0.8, { layer: 'arms', tracks: [], ik: [
    { chain: 'rightArm', target: { bone: 'hips', offset: [-0.08, 0.1, -0.24], space: 'bone' }, weight: [[0, 0], [0.8, 1]] }
  ] })
];
const loco = [
  { id: 'walk', description: 'Caminar paramétrico con apoyos de pies (IK).', gait: 'walk', speed: 1.25 },
  { id: 'run', description: 'Correr: zancada larga, inclinación y brazos flexionados.', gait: 'run', speed: 3.2, strideScale: 1.65, stepHeight: 0.22, bob: 0.045, sway: 0.01, hipYawDeg: 9, armSwingDeg: 48, elbowBendDeg: 85, leanDeg: 12, flight: 0.3 },
  { id: 'sneak', description: 'Andar sigiloso agachado.', gait: 'sneak', speed: 0.6, strideScale: 0.75, stepHeight: 0.08, bob: 0.01, crouch: 0.12, leanDeg: 16, armSwingDeg: 10, elbowBendDeg: 40 },
  { id: 'walk-tired', description: 'Caminar cansado/pesado.', gait: 'walk', speed: 0.85, strideScale: 0.8, stepHeight: 0.06, bob: 0.035, sway: 0.03, leanDeg: 8, armSwingDeg: 12 },
  { id: 'walk-brisk', description: 'Caminar decidido y rápido.', gait: 'walk', speed: 1.6, strideScale: 1.15, stepHeight: 0.12, bob: 0.03, armSwingDeg: 30, elbowBendDeg: 25, leanDeg: 5 }
].map(x => LocomotionSchema.parse({ schemaVersion: 2, kind: 'locomotion', ...x }));
const expr = (id: string, description: string, face: Record<string, number>, extra: Record<string, unknown> = {}) => ExpressionSchemaV2.parse({ schemaVersion: 2, id, description, face, ...extra });
const expressions = [
  expr('neutral', 'Neutral.', {}),
  expr('joy', 'Alegría abierta.', { browRaiseL: 0.35, browRaiseR: 0.35, lidUpperL: 0.05, lidUpperR: 0.05, lidLowerL: 0.3, lidLowerR: 0.3, mouthSmile: 0.85, mouthOpen: 0.28, teethShow: 0.7, cheekRaise: 0.6 }),
  expr('smile', 'Sonrisa suave.', { browRaiseL: 0.1, browRaiseR: 0.1, lidLowerL: 0.18, lidLowerR: 0.18, mouthSmile: 0.6, cheekRaise: 0.3 }),
  expr('laugh', 'Carcajada (con sacudidas de cuerpo).', { browRaiseL: 0.4, browRaiseR: 0.4, lidUpperL: 0.45, lidUpperR: 0.45, lidLowerL: 0.6, lidLowerR: 0.6, mouthSmile: 1, mouthOpen: 0.8, teethShow: 1, cheekRaise: 1, headNodDeg: -10 }, { clip: 'laugh-body' }),
  expr('sad', 'Tristeza.', { browAngleL: 0.85, browAngleR: 0.85, browRaiseL: 0.1, browRaiseR: 0.1, lidUpperL: 0.38, lidUpperR: 0.38, mouthSmile: -0.65, mouthPress: 0.2, headNodDeg: 9 }, { posture: { chest: [6, 0, 0], leftShoulder: [0, 0, -5], rightShoulder: [0, 0, 5] }, blinkRate: 0.7 }),
  expr('angry', 'Enfado.', { browAngleL: -0.95, browAngleR: -0.95, browRaiseL: -0.45, browRaiseR: -0.45, lidUpperL: 0.3, lidUpperR: 0.3, lidLowerL: 0.3, lidLowerR: 0.3, mouthSmile: -0.55, mouthWide: 0.35, teethShow: 0.5, mouthOpen: 0.06, pupilScale: 0.85, headNodDeg: 6 }, { posture: { chest: [3, 0, 0], leftShoulder: [0, 0, 4], rightShoulder: [0, 0, -4] } }),
  expr('fear', 'Miedo.', { browAngleL: 0.75, browAngleR: 0.75, browRaiseL: 0.85, browRaiseR: 0.85, lidUpperL: 0, lidUpperR: 0, eyeScale: 1.2, pupilScale: 0.65, mouthOpen: 0.35, mouthWide: 0.45, mouthSmile: -0.45, teethShow: 0.6, headNodDeg: -4 }, { posture: { leftShoulder: [0, 0, 9], rightShoulder: [0, 0, -9], chest: [-3, 0, 0] }, blinkRate: 1.8 }),
  expr('surprise', 'Sorpresa.', { browRaiseL: 1, browRaiseR: 1, lidUpperL: 0, lidUpperR: 0, eyeScale: 1.25, pupilScale: 0.85, mouthOpen: 0.6, mouthRound: 0.6, headNodDeg: -6 }, { posture: { chest: [-4, 0, 0] }, blinkRate: 0.4 }),
  expr('nervous', 'Nerviosismo: sonrisa forzada y parpadeo rápido.', { browAngleL: 0.5, browAngleR: 0.5, browRaiseL: 0.3, browRaiseR: 0.3, lidUpperL: 0.12, lidUpperR: 0.12, mouthSmile: 0.2, mouthAsym: 0.45, mouthPress: 0.45, mouthWide: 0.3 }, { posture: { leftShoulder: [0, 0, 6], rightShoulder: [0, 0, -6] }, blinkRate: 2.4 }),
  expr('thinking', 'Pensativo.', { browRaiseL: 0.45, browRaiseR: -0.2, browAngleR: -0.2, lidUpperL: 0.25, lidUpperR: 0.32, mouthAsym: 0.5, mouthSmile: -0.1, mouthPress: 0.5, headTiltDeg: 8 }, { blinkRate: 0.6 }),
  expr('smirk', 'Sonrisa irónica.', { mouthSmile: 0.42, mouthAsym: 0.75, browRaiseL: 0.5, browRaiseR: -0.1, lidUpperL: 0.3, lidUpperR: 0.36, headTiltDeg: -6 }),
  expr('worried', 'Preocupación.', { browAngleL: 0.65, browAngleR: 0.65, browRaiseL: 0.2, browRaiseR: 0.2, mouthSmile: -0.3, mouthPress: 0.35, lidUpperL: 0.18, lidUpperR: 0.18 }, { blinkRate: 1.5 }),
  expr('disgust', 'Asco/desdén.', { browAngleL: -0.4, browAngleR: -0.4, lidLowerL: 0.5, lidLowerR: 0.5, mouthSmile: -0.45, mouthAsym: -0.55, headNodDeg: -3 }),
  expr('determined', 'Decidido.', { browAngleL: -0.45, browAngleR: -0.45, browRaiseL: -0.15, browRaiseR: -0.15, lidUpperL: 0.22, lidUpperR: 0.22, mouthPress: 0.4, mouthSmile: 0.05 })
];
for (const [dir, list] of [['animations', [...clips, ...loco]], ['expressions', expressions]] as const) {
  await mkdir(join(root, dir), { recursive: true });
  for (const item of list) await writeFile(join(root, dir, `${item.id}.json`), JSON.stringify(item, null, 2) + '\n');
}
console.log(`library: ${clips.length} clips, ${loco.length} locomotion, ${expressions.length} expressions`);
