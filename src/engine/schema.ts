/** Versioned, strict asset schemas (zod). Every file written by agents or the editor is validated here.
 * Version 1 files from v0.2-v0.4 are migrated in memory (see migrate*), never destroyed on disk. */
import { z } from 'zod';

const num = (lo: number, hi: number) => z.number().finite().min(lo).max(hi);
export const vec3 = z.tuple([num(-1e4, 1e4), num(-1e4, 1e4), num(-1e4, 1e4)]);
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color hex #rrggbb');
export const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/, 'id slug [a-z0-9_-]');
const pct = num(-3, 3);

// ---------------------------------------------------------------- characters
export const BodySchema = z.object({
  height: num(0.4, 3.5).default(1.75),
  headScale: num(0.5, 2.2).default(1),
  headWidth: num(0.6, 1.5).default(1),
  jaw: num(0, 1).default(0.5),
  shoulderWidth: num(0.2, 0.9).default(0.44),
  hipWidth: num(0.15, 0.7).default(0.3),
  torsoScale: num(0.6, 1.5).default(1),
  legScale: num(0.5, 1.6).default(1),
  armScale: num(0.5, 1.6).default(1),
  armThickness: num(0.02, 0.2).default(0.055),
  legThickness: num(0.03, 0.25).default(0.075),
  chestDepth: num(0.1, 0.6).default(0.24),
  belly: num(0, 1).default(0),
  chest: num(0, 1).default(0.3),
  neckLength: num(0.01, 0.25).default(0.07),
  footSize: num(0.5, 2).default(1),
  handSize: num(0.5, 2).default(1),
  skinColor: color.default('#e0ac85')
}).strict();
export const FaceSchema = z.object({
  eyeSize: num(0.4, 2.5).default(1),
  eyeSpacing: num(0.5, 1.6).default(1),
  eyeHeight: num(-0.5, 0.5).default(0),
  irisColor: color.default('#4a6b8a'),
  eyeShape: z.enum(['round', 'almond', 'narrow']).default('round'),
  browThickness: num(0.3, 3).default(1),
  browColor: color.optional(),
  noseShape: z.enum(['button', 'round', 'pointy', 'long', 'wide']).default('button'),
  noseSize: num(0.3, 2.5).default(1),
  mouthWidth: num(0.5, 1.8).default(1),
  lipColor: color.default('#7a2f3a'),
  earSize: num(0, 2).default(1),
  freckles: z.boolean().default(false),
  blush: num(0, 1).default(0)
}).strict();
export const HairSchema = z.object({
  style: z.enum(['short', 'spiky', 'bob', 'ponytail', 'bun', 'long', 'curly', 'mohawk', 'bald', 'buzz', 'sidepart']).default('short'),
  color: color.default('#2b2118'),
  volume: num(0.5, 2).default(1)
}).strict();
export const BeardSchema = z.object({
  style: z.enum(['none', 'stubble', 'full', 'goatee', 'mustache', 'chinstrap']).default('none'),
  color: color.optional()
}).strict();
export const OutfitSchema = z.object({
  top: z.object({ type: z.enum(['tshirt', 'longsleeve', 'jacket', 'hoodie', 'vest', 'overalls', 'labcoat', 'tanktop', 'dress']).default('tshirt'), color: color.default('#d9534f'), secondaryColor: color.optional() }).strict().default({ type: 'tshirt', color: '#d9534f' }),
  bottom: z.object({ type: z.enum(['pants', 'shorts', 'skirt']).default('pants'), color: color.default('#34495e') }).strict().default({ type: 'pants', color: '#34495e' }),
  shoes: z.object({ type: z.enum(['sneakers', 'boots', 'shoes', 'sandals']).default('sneakers'), color: color.default('#2c2c2c'), soleColor: color.optional() }).strict().default({ type: 'sneakers', color: '#2c2c2c' }),
  gloves: z.object({ color: color }).strict().optional()
}).strict();
export const AccessorySchema = z.object({
  type: z.enum(['goggles', 'glasses', 'toolbelt', 'cap', 'beanie', 'headset', 'scarf', 'badge', 'apron', 'watch', 'earrings', 'bandana', 'backpack']),
  color: color.default('#888888'),
  secondaryColor: color.optional(),
  position: z.enum(['head', 'forehead', 'eyes', 'neck', 'waist', 'chest', 'wrist', 'back']).optional()
}).strict();
export const PartSchema = z.object({
  id: z.string().min(1).max(60),
  bone: z.string().max(60).optional(),
  primitive: z.enum(['box', 'sphere', 'capsule', 'cylinder', 'cone', 'torus', 'roundedBox']),
  size: vec3,
  position: vec3.default([0, 0, 0]),
  rotationDeg: vec3.default([0, 0, 0]),
  color: color,
  emissive: color.optional(),
  emissiveIntensity: num(0, 20).optional(),
  outline: z.boolean().default(true),
  pivot: z.string().max(60).optional()
}).strict();
export const CharacterGeometrySchema = z.object({
  schemaVersion: z.literal(2),
  generator: z.literal('humanoid-toon').default('humanoid-toon'),
  body: BodySchema.default(BodySchema.parse({})),
  face: FaceSchema.default(FaceSchema.parse({})),
  hair: HairSchema.default(HairSchema.parse({})),
  beard: BeardSchema.default(BeardSchema.parse({})),
  outfit: OutfitSchema.default(OutfitSchema.parse({})),
  accessories: z.array(AccessorySchema).max(24).default([]),
  parts: z.array(PartSchema).max(200).default([]),
  outlineWidth: num(0, 0.05).default(0.012)
}).strict();
export type CharacterGeometry = z.infer<typeof CharacterGeometrySchema>;
export type BodyParams = z.infer<typeof BodySchema>;

export const RigSchema = z.object({
  schemaVersion: z.literal(2),
  type: z.literal('humanoid'),
  template: z.literal('humanoid-v2').default('humanoid-v2'),
  /** Optional per-bone rest offsets (metres) and joint-limit overrides (degrees). */
  boneOffsets: z.record(z.string(), vec3).default({}),
  jointLimits: z.record(z.string(), z.object({ min: vec3, max: vec3 })).default({})
}).strict();

export const VoiceSchema = z.object({
  schemaVersion: z.literal(2),
  provider: z.enum(['windows-onecore', 'windows-sapi', 'piper', 'silent']),
  voice: z.string().min(1).max(160),
  language: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).default('es-ES'),
  rate: num(0.5, 2).default(1),
  pitchSemitones: num(-12, 12).default(0),
  formantPreserve: z.boolean().default(true),
  gainDb: num(-24, 12).default(0),
  eq: z.object({ lowDb: num(-12, 12).default(0), midDb: num(-12, 12).default(0), highDb: num(-12, 12).default(0) }).strict().default({ lowDb: 0, midDb: 0, highDb: 0 }),
  emotionProsody: z.boolean().default(true),
  license: z.object({ id: z.string(), commercialUse: z.enum(['allowed', 'restricted', 'unknown']), notes: z.string().optional() }).strict()
}).strict();
export type VoiceProfile = z.infer<typeof VoiceSchema>;

// ---------------------------------------------------------------- animation
const keyV2 = z.object({ t: num(0, 600), v: z.union([vec3, num(-1e4, 1e4)]), ease: z.string().max(20).optional() }).strict();
export const ClipSchemaV2 = z.object({
  schemaVersion: z.literal(2),
  id: slug,
  rigType: z.literal('humanoid').default('humanoid'),
  kind: z.literal('keyframes').default('keyframes'),
  description: z.string().max(400).optional(),
  duration: num(0.01, 600),
  loop: z.boolean().default(false),
  layer: z.enum(['full', 'upper', 'lower', 'arms', 'head', 'additive']).default('full'),
  mask: z.array(z.string()).optional(),
  tracks: z.array(z.object({ bone: z.string().min(1).max(60), property: z.enum(['rotation', 'position']), keys: z.array(keyV2).min(1).max(2000) }).strict()).max(200),
  face: z.array(z.object({ param: z.string().max(40), keys: z.array(keyV2).min(1).max(2000) }).strict()).default([]),
  ik: z.array(z.object({
    chain: z.enum(['leftArm', 'rightArm', 'leftLeg', 'rightLeg']),
    target: z.object({ bone: z.string().optional(), offset: vec3.default([0, 0, 0]), space: z.enum(['bone', 'actor']).default('bone') }).strict(),
    weight: z.array(z.tuple([num(0, 600), num(0, 1)])).min(1)
  }).strict()).default([]),
  contacts: z.array(z.object({ foot: z.enum(['left', 'right', 'both']), from: num(0, 600), to: num(0, 600) }).strict()).optional(),
  grip: z.object({ left: num(0, 1).optional(), right: num(0, 1).optional() }).strict().optional()
}).strict();
export const LocomotionSchema = z.object({
  schemaVersion: z.literal(2),
  id: slug,
  kind: z.literal('locomotion'),
  rigType: z.literal('humanoid').default('humanoid'),
  description: z.string().max(400).optional(),
  gait: z.enum(['walk', 'run', 'sneak', 'limp']).default('walk'),
  speed: num(0.2, 8).default(1.25),
  strideScale: num(0.3, 2.5).default(1),
  stepHeight: num(0, 0.6).default(0.11),
  bob: num(0, 0.2).default(0.025),
  sway: num(0, 0.15).default(0.02),
  hipYawDeg: num(0, 30).default(6),
  armSwingDeg: num(0, 80).default(24),
  elbowBendDeg: num(0, 120).default(18),
  leanDeg: num(-30, 45).default(3),
  crouch: num(0, 0.5).default(0),
  flight: num(0, 0.6).default(0)
}).strict();
export type ClipV2 = z.infer<typeof ClipSchemaV2>;
export type Locomotion = z.infer<typeof LocomotionSchema>;
export const ClipSchemaV1 = z.object({
  schemaVersion: z.literal(1), id: z.string().optional(), duration: num(0.01, 600), loop: z.boolean().optional(),
  tracks: z.array(z.object({ target: z.string().regex(/^[a-zA-Z0-9]+\.rotation\.[xyz]$/), keys: z.array(z.tuple([num(0, 600), num(-360, 360)])) }))
});
/** v1 clip (per-axis tracks) -> v2 representation. Pure, used at load time only. */
export function migrateClipV1(raw: z.infer<typeof ClipSchemaV1>, id: string): ClipV2 {
  const byBone = new Map<string, { t: number; v: [number, number, number] }[]>();
  const axes = ['x', 'y', 'z'];
  const times = new Map<string, Set<number>>();
  for (const tr of raw.tracks) { const [bone] = tr.target.split('.'); if (!times.has(bone)) times.set(bone, new Set()); for (const [t] of tr.keys) times.get(bone)!.add(t); }
  const sample = (keys: [number, number][], t: number) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = (t - keys[i - 1][0]) / Math.max(1e-6, keys[i][0] - keys[i - 1][0]); return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * a; } return keys[keys.length - 1][1]; };
  for (const [bone, ts] of times) {
    const keys = [...ts].sort((a, b) => a - b).map(t => { const v: [number, number, number] = [0, 0, 0]; for (const tr of raw.tracks) { const [b, , ax] = tr.target.split('.'); if (b === bone) v[axes.indexOf(ax)] = sample(tr.keys, t); } return { t, v }; });
    byBone.set(bone, keys);
  }
  return ClipSchemaV2.parse({ schemaVersion: 2, id, duration: raw.duration, loop: raw.loop ?? false, tracks: [...byBone].map(([bone, keys]) => ({ bone: V1_BONE_ALIASES[bone] ?? bone, property: 'rotation', keys })) });
}
/** v0.2 rig names -> humanoid-v2 names. */
export const V1_BONE_ALIASES: Record<string, string> = { root: 'hips' };

export const FACE_PARAMS = ['browRaiseL', 'browRaiseR', 'browAngleL', 'browAngleR', 'lidUpperL', 'lidUpperR', 'lidLowerL', 'lidLowerR', 'eyeScale', 'pupilScale', 'mouthOpen', 'mouthWide', 'mouthSmile', 'mouthRound', 'mouthAsym', 'teethShow', 'mouthPress', 'cheekRaise', 'headTiltDeg', 'headNodDeg'] as const;
export type FaceParam = typeof FACE_PARAMS[number];
const faceShape = Object.fromEntries(FACE_PARAMS.map(p => [p, num(-90, 90).optional()])) as Record<FaceParam, z.ZodOptional<z.ZodNumber>>;
export const ExpressionSchemaV2 = z.object({
  schemaVersion: z.literal(2),
  id: slug,
  description: z.string().max(300).optional(),
  face: z.object(faceShape).strict(),
  /** Additive body posture while the expression is active (degrees). */
  posture: z.record(z.string(), vec3).default({}),
  /** Optional looping body clip while active (e.g. laugh shoulders). */
  clip: slug.optional(),
  blinkRate: num(0, 3).optional()
}).strict();
export type ExpressionV2 = z.infer<typeof ExpressionSchemaV2>;
export function migrateExpressionV1(raw: { mouthScaleY?: number; eyeScaleY?: number; browAngleDeg?: number }, id: string): ExpressionV2 {
  const open = Math.max(0, Math.min(1, ((raw.mouthScaleY ?? 1) - 1) / 1.5));
  return ExpressionSchemaV2.parse({ schemaVersion: 2, id, face: { mouthOpen: open, eyeScale: raw.eyeScaleY ?? 1, browRaiseL: -(raw.browAngleDeg ?? 0) / 20, browRaiseR: -(raw.browAngleDeg ?? 0) / 20 } });
}

// ---------------------------------------------------------------- props & environments
export const AnchorSchema = z.object({ position: vec3, rotationDeg: vec3.default([0, 0, 0]) }).strict();
export const PropGeometrySchema = z.object({
  schemaVersion: z.literal(2),
  generator: z.enum(['parts', 'robot', 'workbench', 'chair', 'stool', 'door', 'shelf', 'toolbox', 'crate', 'lamp', 'mug', 'wrench', 'component', 'monitor', 'barrel', 'plant', 'table', 'sofa', 'bed', 'pipe', 'console', 'tree', 'building', 'streetlamp', 'bench', 'fence', 'car']).default('parts'),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  parts: z.array(PartSchema).max(400).default([]),
  /** Joint pivots for articulated props (robot head, door leaf...). Parts with `pivot` rotate around it. */
  joints: z.record(z.string(), z.object({ position: vec3, axis: z.enum(['x', 'y', 'z']).default('y'), minDeg: num(-360, 360).default(-180), maxDeg: num(-360, 360).default(180) }).strict()).default({}),
  anchors: z.record(z.string(), AnchorSchema).default({}),
  /** Height offset so that the prop rests on the floor when dropped. */
  restHeight: num(0, 10).optional(),
  mass: num(0, 10000).default(1),
  material: z.enum(['metal', 'wood', 'plastic', 'glass', 'cloth', 'stone']).default('metal'),
  outlineWidth: num(0, 0.05).default(0.01)
}).strict();
export type PropGeometry = z.infer<typeof PropGeometrySchema>;

export const EnvironmentSchemaV2 = z.object({
  schemaVersion: z.literal(2),
  kind: z.enum(['room', 'exterior']).default('room'),
  size: vec3.default([10, 4, 8]),
  floor: z.object({ color: color.default('#5b6470'), pattern: z.enum(['tiles', 'planks', 'concrete', 'grass', 'asphalt', 'plain']).default('tiles'), secondaryColor: color.optional() }).strict().default({ color: '#5b6470', pattern: 'tiles' }),
  walls: z.object({ color: color.default('#3d5266'), trimColor: color.default('#2a3a48'), sides: z.array(z.enum(['back', 'left', 'right'])).default(['back', 'left', 'right']), panel: z.boolean().default(true) }).strict().default({ color: '#3d5266', trimColor: '#2a3a48', sides: ['back', 'left', 'right'], panel: true }),
  openings: z.array(z.object({ id: z.string().max(40), type: z.enum(['window', 'door']), wall: z.enum(['back', 'left', 'right']), offset: num(-50, 50), width: num(0.2, 20), height: num(0.2, 20), sill: num(0, 20).default(0), glow: color.optional() }).strict()).default([]),
  sky: z.object({ top: color.default('#1d2b3c'), bottom: color.default('#41566e') }).strict().default({ top: '#1d2b3c', bottom: '#41566e' }),
  lights: z.array(z.object({ type: z.enum(['key', 'fill', 'rim', 'point', 'spot']), position: vec3, target: vec3.optional(), color: color.default('#ffffff'), intensity: num(0, 100).default(1), distance: num(0, 200).optional(), castShadow: z.boolean().default(false), flicker: num(0, 1).default(0) }).strict()).max(16).default([]),
  ambient: z.object({ sky: color.default('#dfe9ff'), ground: color.default('#3a4250'), intensity: num(0, 10).default(1.4) }).strict().default({ sky: '#dfe9ff', ground: '#3a4250', intensity: 1.4 }),
  fog: z.object({ color: color, near: num(0, 1000), far: num(0, 2000) }).strict().optional(),
  props: z.array(z.object({ id: slug, propId: slug, position: vec3, yawDeg: num(-3600, 3600).default(0), scale: num(0.05, 20).default(1) }).strict()).max(300).default([]),
  decor: z.array(z.object({ type: z.enum(['poster', 'pipe', 'shelf-boxes', 'cable', 'vent', 'sign', 'clock', 'pegboard']), wall: z.enum(['back', 'left', 'right']), offset: num(-50, 50), height: num(0, 30), color: color.default('#c0392b'), width: num(0.05, 20).default(1) }).strict()).max(100).default([]),
  walkable: z.object({ min: z.tuple([num(-1e3, 1e3), num(-1e3, 1e3)]), max: z.tuple([num(-1e3, 1e3), num(-1e3, 1e3)]) }).strict().optional()
}).strict();
export type EnvironmentV2 = z.infer<typeof EnvironmentSchemaV2>;

export const ManifestSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  id: slug,
  type: z.enum(['character', 'environment', 'prop', 'episode', 'sound', 'music']),
  name: z.string().min(1).max(120)
}).passthrough();

// ---------------------------------------------------------------- scenes
const timeRef = { at: num(0, 7200).optional(), after: z.string().max(60).optional(), with: z.string().max(60).optional(), offset: num(-60, 600).default(0) };
const target = z.union([z.string().max(60), vec3, z.object({ prop: z.string().max(60), anchor: z.string().max(40).optional() }).strict(), z.object({ actor: z.string().max(60), bone: z.string().max(40).optional() }).strict()]);
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('walk'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, to: z.union([vec3, z.object({ prop: z.string(), anchor: z.string().optional(), distance: num(0, 10).default(0.55) }).strict(), z.object({ actor: z.string(), distance: num(0, 10).default(0.9) }).strict()]), gait: z.string().max(40).optional(), speed: num(0.1, 10).optional(), faceTo: target.optional() }).strict(),
  z.object({ type: z.literal('turn'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, yawDeg: num(-3600, 3600).optional(), by: num(-3600, 3600).optional(), towards: target.optional(), durationSec: num(0.1, 30).optional() }).strict(),
  z.object({ type: z.literal('lookAt'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, target, durationSec: num(0.05, 3600).optional(), until: z.string().max(60).optional(), mode: z.enum(['eyes', 'head', 'chest']).default('head') }).strict(),
  z.object({ type: z.literal('play'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, clip: slug, durationSec: num(0.05, 3600).optional(), speed: num(0.1, 5).default(1), fadeIn: num(0, 5).default(0.25), fadeOut: num(0, 5).default(0.3), loop: z.boolean().optional(), weight: num(0, 1).default(1), target: target.optional() }).strict(),
  z.object({ type: z.literal('expression'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, expression: slug, durationSec: num(0.05, 3600).optional(), intensity: num(0, 1.5).default(1), fade: num(0, 3).default(0.25) }).strict(),
  z.object({ type: z.literal('pickUp'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, prop: z.string(), hand: z.enum(['left', 'right']).default('right'), durationSec: num(0.5, 10).default(1.6) }).strict(),
  z.object({ type: z.literal('hold'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, prop: z.string().optional(), hand: z.enum(['left', 'right']).default('right'), pose: z.enum(['front', 'behind', 'raised', 'side', 'show']).default('front'), durationSec: num(0.1, 10).default(0.6) }).strict(),
  z.object({ type: z.literal('drop'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, prop: z.string(), sound: z.string().max(60).optional() }).strict(),
  z.object({ type: z.literal('place'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, prop: z.string(), on: z.union([vec3, z.object({ prop: z.string(), anchor: z.string().default('top') }).strict()]), hand: z.enum(['left', 'right']).default('right'), durationSec: num(0.5, 10).default(1.4) }).strict(),
  z.object({ type: z.literal('give'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, prop: z.string(), to: z.string(), durationSec: num(0.5, 10).default(1.6) }).strict(),
  z.object({ type: z.literal('sit'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, prop: z.string(), anchor: z.string().default('seat'), durationSec: num(0.3, 10).default(1.0) }).strict(),
  z.object({ type: z.literal('stand'), id: z.string().max(60).optional(), actor: z.string(), ...timeRef, durationSec: num(0.3, 10).default(1.0) }).strict(),
  z.object({ type: z.literal('propJoint'), id: z.string().max(60).optional(), prop: z.string(), joint: z.string(), ...timeRef, toDeg: num(-360, 360), fromDeg: num(-360, 360).optional(), durationSec: num(0.05, 60).default(0.8), ease: z.string().max(20).optional(), sound: z.string().max(60).optional() }).strict(),
  z.object({ type: z.literal('effect'), id: z.string().max(60).optional(), effect: z.enum(['sparks', 'smoke', 'flicker', 'glow']), ...timeRef, prop: z.string().optional(), part: z.string().optional(), position: vec3.optional(), durationSec: num(0.05, 600).default(1), intensity: num(0, 5).default(1), sound: z.string().max(60).optional() }).strict()
]);
export type Action = z.infer<typeof ActionSchema>;
export const DialogueLineSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
  actor: z.string(),
  text: z.string().min(1).max(600),
  to: z.string().max(60).optional(),
  emotion: z.string().max(40).optional(),
  intensity: num(0, 1.5).default(1),
  direction: z.string().max(200).optional(),
  gesture: slug.optional(),
  knowledge: z.array(z.string().max(80)).default([]),
  reveals: z.array(z.string().max(80)).default([]),
  rate: num(0.5, 2).optional(),
  pitchSemitones: num(-6, 6).optional(),
  pauseAfter: num(0, 10).default(0.35),
  ...timeRef
}).strict();
export type DialogueLine = z.infer<typeof DialogueLineSchema>;
export const CameraSchema = z.object({
  type: z.enum(['static', 'framing']).default('framing'),
  position: vec3.optional(),
  target: vec3.optional(),
  fov: num(8, 100).default(32),
  framing: z.enum(['establishing', 'wide', 'full', 'medium', 'medium-close', 'close', 'extreme-close', 'two-shot', 'over-shoulder', 'insert']).optional(),
  subject: z.string().max(60).optional(),
  subjects: z.array(z.string().max(60)).max(8).optional(),
  over: z.string().max(60).optional(),
  azimuthDeg: num(-360, 360).optional(),
  elevationDeg: num(-80, 80).optional(),
  side: z.enum(['left', 'right']).optional(),
  track: z.boolean().default(false),
  move: z.object({ type: z.enum(['none', 'push-in', 'pull-out', 'orbit', 'truck', 'crane', 'dolly']), amount: num(-50, 50).default(0.15), ease: z.string().max(20).optional() }).strict().optional(),
  handheld: num(0, 1).default(0)
}).strict();
export const ShotSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
  ...timeRef,
  camera: CameraSchema,
  transitionIn: z.object({ type: z.enum(['cut', 'dissolve', 'fade', 'iris', 'wipe']), durationSec: num(0, 5).default(0.6) }).strict().optional(),
  notes: z.string().max(400).optional()
}).strict();
export const SoundEventSchema = z.object({
  id: z.string().max(60).optional(),
  kind: z.enum(['sfx', 'ambience', 'music']),
  sound: slug,
  ...timeRef,
  durationSec: num(0.05, 7200).optional(),
  gainDb: num(-60, 12).default(0),
  fadeIn: num(0, 30).default(0),
  fadeOut: num(0, 30).default(0),
  pan: num(-1, 1).default(0),
  duck: z.boolean().optional()
}).strict();
export const SceneSchemaV2 = z.object({
  schemaVersion: z.literal(2),
  id: z.string().regex(/^sc-\d{3,4}$/),
  name: z.string().min(1).max(160),
  synopsis: z.string().max(4000).optional(),
  environmentId: slug.nullable(),
  durationSec: z.union([num(0.5, 3600), z.literal('auto')]).default('auto'),
  tailSec: num(0, 30).default(1.2),
  autoLook: z.boolean().default(true),
  actors: z.array(z.object({ id: slug, characterId: slug, position: vec3, yawDeg: num(-3600, 3600).default(0), expression: slug.default('neutral'), idle: slug.default('idle') }).strict()).max(20),
  props: z.array(z.object({ id: slug, propId: slug, position: vec3.optional(), yawDeg: num(-3600, 3600).default(0), on: z.object({ prop: z.string(), anchor: z.string().default('top') }).strict().optional(), heldBy: z.object({ actor: z.string(), hand: z.enum(['left', 'right']).default('right') }).strict().optional(), scale: num(0.05, 20).default(1) }).strict()).max(100).default([]),
  shots: z.array(ShotSchema).min(1).max(200),
  actions: z.array(ActionSchema).max(2000).default([]),
  dialogue: z.array(DialogueLineSchema).max(1000).default([]),
  sound: z.array(SoundEventSchema).max(1000).default([]),
  transitionOut: z.object({ type: z.enum(['cut', 'fade']), durationSec: num(0, 5).default(0.8) }).strict().optional()
}).strict();
export type SceneV2 = z.infer<typeof SceneSchemaV2>;
export type Shot = z.infer<typeof ShotSchema>;
export type CameraSpec = z.infer<typeof CameraSchema>;
export type SoundEvent = z.infer<typeof SoundEventSchema>;

export const EpisodeSchema = z.object({
  schemaVersion: z.literal(2),
  id: slug,
  type: z.literal('episode'),
  name: z.string().min(1).max(160),
  number: z.number().int().min(0).max(9999).optional(),
  scenes: z.array(z.string().regex(/^sc-\d{3,4}$/)).min(1).max(500),
  targetDurationSec: num(1, 7200).optional(),
  music: z.array(SoundEventSchema).default([]),
  render: z.object({ width: z.number().int().min(160).max(3840).default(1920), height: z.number().int().min(90).max(2160).default(1080), fps: z.number().int().min(1).max(60).default(24), sampleRate: z.literal(48000).default(48000), loudnessLufs: num(-30, -8).default(-16) }).strict().default({ width: 1920, height: 1080, fps: 24, sampleRate: 48000, loudnessLufs: -16 }),
  status: z.enum(['draft', 'approved', 'published']).default('draft')
}).passthrough();
export type Episode = z.infer<typeof EpisodeSchema>;

// ---------------------------------------------------------------- audio assets
export const SfxSchema = z.object({
  schemaVersion: z.literal(2),
  id: slug,
  kind: z.enum(['sfx', 'ambience']),
  generator: z.enum(['metal-impact', 'footstep', 'door-creak', 'robot-beep', 'servo', 'sparks', 'workshop-hum', 'whoosh', 'click', 'thud', 'room-tone', 'rain', 'wind', 'birds', 'traffic', 'file']),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  durationSec: num(0.02, 600).default(1),
  seed: z.number().int().default(1),
  file: z.string().max(200).optional(),
  license: z.object({ id: z.string(), source: z.string(), commercialUse: z.enum(['allowed', 'restricted', 'unknown']) }).strict().default({ id: 'procedural-original', source: 'Series Forge procedural synthesis', commercialUse: 'allowed' })
}).strict();
export const MusicSchema = z.object({
  schemaVersion: z.literal(2),
  id: slug,
  kind: z.literal('music'),
  generator: z.enum(['procedural', 'file']).default('procedural'),
  tempo: num(40, 220).default(92),
  key: z.enum(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']).default('D'),
  mode: z.enum(['major', 'minor', 'dorian', 'mixolydian']).default('minor'),
  progression: z.array(z.string().max(8)).min(1).max(32).default(['i', 'VI', 'III', 'VII']),
  instruments: z.array(z.enum(['pad', 'bass', 'arp', 'pluck', 'drums', 'bell', 'lead'])).default(['pad', 'bass', 'arp']),
  mood: z.string().max(80).optional(),
  durationSec: num(1, 7200).default(60),
  seed: z.number().int().default(7),
  file: z.string().max(200).optional(),
  license: z.object({ id: z.string(), source: z.string(), commercialUse: z.enum(['allowed', 'restricted', 'unknown']) }).strict().default({ id: 'procedural-original', source: 'Series Forge procedural composer', commercialUse: 'allowed' })
}).strict();
export type SfxDef = z.infer<typeof SfxSchema>;
export type MusicDef = z.infer<typeof MusicSchema>;

export function formatZodError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.slice(0, 8).map(i => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('; ');
  return error instanceof Error ? error.message : String(error);
}
