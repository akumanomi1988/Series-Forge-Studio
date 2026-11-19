/** Humanoid-v2 skeleton derived from body parameters.
 * Conventions: Y up, character faces +Z, metres. Character LEFT is +X.
 * Rest pose: every bone has identity rotation, arms hang down, so clip rotations are offsets from rest.
 *  - Legs/arms point down (-Y): rotation.x NEGATIVE swings the limb FORWARD.
 *  - Knee bends with POSITIVE x, elbow bends with NEGATIVE x.
 */
import type { BodyParams } from './schema.ts';
import type { Vec3 } from './math.ts';

export interface BoneDef { id: string; parent: string | null; position: Vec3 /* local to parent */; world: Vec3 }
export interface HumanoidDims {
  height: number; scale: number; headRy: number; headRx: number; headRz: number; headCenter: number /* above head bone */;
  neckLen: number; ankleH: number; thighLen: number; shinLen: number; upperArmLen: number; lowerArmLen: number; handLen: number;
  footLen: number; hipHalf: number; shoulderX: number; chestRx: number; chestRz: number; waistRx: number; hipRx: number; armR: number; legR: number;
  hipsY: number; legLen: number; armLen: number;
}
export const HUMANOID_BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftThigh', 'leftShin', 'leftFoot', 'leftToe', 'rightThigh', 'rightShin', 'rightFoot', 'rightToe'] as const;
export type HumanoidBone = typeof HUMANOID_BONES[number];

export function humanoidDims(b: BodyParams): HumanoidDims {
  const s = b.height / 1.75;
  const headRy = 0.155 * s * b.headScale;
  const headRx = headRy * 0.86 * b.headWidth;
  const headRz = headRy * 0.92;
  const neckLen = b.neckLength * s;
  const ankleH = 0.075 * s;
  const legLen = 0.80 * s * b.legScale;
  const thighLen = legLen * 0.51, shinLen = legLen * 0.49;
  const torsoLen = Math.max(0.2 * s, b.height - ankleH - legLen - neckLen - headRy * 2 * 0.97);
  const hipsY = ankleH + legLen + 0.035 * s;
  const chestRx = (0.15 + 0.05 * b.chest) * s * (b.shoulderWidth / 0.44) ** 0.6;
  const armR = b.armThickness * s;
  const shoulderX = Math.max(b.shoulderWidth * s / 2, chestRx + armR * 0.55);
  const upperArmLen = 0.29 * s * b.armScale, lowerArmLen = 0.26 * s * b.armScale, handLen = 0.17 * s * b.handSize;
  return {
    height: b.height, scale: s, headRy, headRx, headRz, headCenter: headRy * 0.95, neckLen, ankleH, thighLen, shinLen,
    upperArmLen, lowerArmLen, handLen, footLen: 0.27 * s * b.footSize, hipHalf: b.hipWidth * s / 2 * 0.62, shoulderX,
    chestRx, chestRz: b.chestDepth * s / 2, waistRx: chestRx * (0.82 + 0.25 * b.belly), hipRx: Math.max(b.hipWidth * s / 2, chestRx * 0.85),
    armR, legR: b.legThickness * s, hipsY, legLen, armLen: upperArmLen + lowerArmLen,
    // torsoLen is implied by bone heights below
  } as HumanoidDims & { torsoLen?: number };
}

/** World rest positions -> parent-local bone definitions. */
export function humanoidSkeleton(b: BodyParams, offsets: Record<string, Vec3> = {}): { bones: BoneDef[]; dims: HumanoidDims } {
  const d = humanoidDims(b);
  const s = d.scale;
  const neckBase = b.height - d.headRy * 2 * 0.97 - d.neckLen;
  const torso = neckBase - d.hipsY;
  const shoulderY = neckBase - 0.055 * s;
  const W: Record<string, [string | null, Vec3]> = {
    root: [null, [0, 0, 0]],
    hips: ['root', [0, d.hipsY, 0]],
    spine: ['hips', [0, d.hipsY + torso * 0.22, 0]],
    chest: ['spine', [0, d.hipsY + torso * 0.58, 0]],
    neck: ['chest', [0, neckBase, -0.01 * s]],
    head: ['neck', [0, neckBase + d.neckLen, 0]],
  };
  for (const [side, sx] of [['left', 1], ['right', -1]] as const) {
    W[`${side}Shoulder`] = ['chest', [sx * d.shoulderX * 0.42, shoulderY, -0.01 * s]];
    W[`${side}UpperArm`] = [`${side}Shoulder`, [sx * d.shoulderX, shoulderY - 0.02 * s, -0.01 * s]];
    W[`${side}LowerArm`] = [`${side}UpperArm`, [sx * d.shoulderX, shoulderY - 0.02 * s - d.upperArmLen, -0.01 * s]];
    W[`${side}Hand`] = [`${side}LowerArm`, [sx * d.shoulderX, shoulderY - 0.02 * s - d.upperArmLen - d.lowerArmLen, -0.01 * s]];
    W[`${side}Thigh`] = ['hips', [sx * d.hipHalf, d.ankleH + d.legLen, 0]];
    W[`${side}Shin`] = [`${side}Thigh`, [sx * d.hipHalf, d.ankleH + d.shinLen, 0]];
    W[`${side}Foot`] = [`${side}Shin`, [sx * d.hipHalf, d.ankleH, 0]];
    W[`${side}Toe`] = [`${side}Foot`, [sx * d.hipHalf, 0.02 * s, d.footLen * 0.62]];
  }
  const world: Record<string, Vec3> = {};
  for (const id of HUMANOID_BONES) { const o = offsets[id]; const p = W[id][1]; world[id] = o ? [p[0] + o[0], p[1] + o[1], p[2] + o[2]] : p; }
  const bones = HUMANOID_BONES.map(id => {
    const parent = W[id][0];
    const w = world[id], pw = parent ? world[parent] : [0, 0, 0] as Vec3;
    return { id, parent, world: w, position: [w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]] as Vec3 };
  });
  return { bones, dims: d };
}

/** Anatomical joint limits (degrees, local Euler XYZ offsets from rest). Used for clamping and QA tests. */
export const JOINT_LIMITS: Record<string, { min: Vec3; max: Vec3 }> = {
  hips: { min: [-60, -180, -40], max: [60, 180, 40] },
  spine: { min: [-35, -40, -30], max: [55, 40, 30] },
  chest: { min: [-30, -40, -25], max: [45, 40, 25] },
  neck: { min: [-40, -50, -30], max: [45, 50, 30] },
  head: { min: [-45, -75, -35], max: [45, 75, 35] },
  leftShoulder: { min: [-30, -30, -10], max: [30, 30, 40] }, rightShoulder: { min: [-30, -30, -40], max: [30, 30, 10] },
  leftUpperArm: { min: [-185, -100, -20], max: [70, 100, 180] }, rightUpperArm: { min: [-185, -100, -180], max: [70, 100, 20] },
  leftLowerArm: { min: [-155, -95, -20], max: [3, 95, 20] }, rightLowerArm: { min: [-155, -95, -20], max: [3, 95, 20] },
  leftHand: { min: [-80, -60, -60], max: [80, 60, 60] }, rightHand: { min: [-80, -60, -60], max: [80, 60, 60] },
  leftThigh: { min: [-130, -50, -50], max: [40, 50, 50] }, rightThigh: { min: [-130, -50, -50], max: [40, 50, 50] },
  leftShin: { min: [-3, -20, -15], max: [160, 20, 15] }, rightShin: { min: [-3, -20, -15], max: [160, 20, 15] },
  leftFoot: { min: [-60, -40, -35], max: [60, 40, 35] }, rightFoot: { min: [-60, -40, -35], max: [60, 40, 35] },
  leftToe: { min: [-60, -5, -5], max: [60, 5, 5] }, rightToe: { min: [-60, -5, -5], max: [60, 5, 5] }
};

export const LAYER_MASKS: Record<string, string[] | null> = {
  full: null,
  additive: null,
  upper: ['spine', 'chest', 'neck', 'head', 'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand'],
  arms: ['leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand'],
  lower: ['hips', 'leftThigh', 'leftShin', 'leftFoot', 'leftToe', 'rightThigh', 'rightShin', 'rightFoot', 'rightToe'],
  head: ['neck', 'head']
};
