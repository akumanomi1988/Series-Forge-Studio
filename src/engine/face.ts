/** Facial animation: expression blending, viseme-driven lip-sync and deterministic blinks. */
import { clamp, hash01, intervalWeight, lerp, smoothstep } from './math.ts';
import { FACE_PARAMS } from './schema.ts';
import type { ExpressionV2, FaceParam } from './schema.ts';
import type { ActorTimeline } from './timeline.ts';

export type FaceState = Record<FaceParam, number>;
export const NEUTRAL_FACE: FaceState = Object.fromEntries(FACE_PARAMS.map(p => [p, 0])) as FaceState;
NEUTRAL_FACE.eyeScale = 1; NEUTRAL_FACE.pupilScale = 1; NEUTRAL_FACE.lidUpperL = 0.12; NEUTRAL_FACE.lidUpperR = 0.12;

/** Mouth shapes for Spanish visemes. open: jaw/lip opening 0..1, wide: -1 narrow..1 wide, round: 0..1, teeth: 0..1, press: lips pressed. */
export const VISEMES: Record<string, { open: number; wide: number; round: number; teeth: number; press: number }> = {
  sil: { open: 0, wide: 0, round: 0, teeth: 0, press: 0 },
  A: { open: 0.78, wide: 0.15, round: 0, teeth: 0.35, press: 0 },
  E: { open: 0.46, wide: 0.55, round: 0, teeth: 0.6, press: 0 },
  I: { open: 0.28, wide: 0.85, round: 0, teeth: 0.8, press: 0 },
  O: { open: 0.55, wide: -0.45, round: 0.75, teeth: 0.15, press: 0 },
  U: { open: 0.24, wide: -0.75, round: 1, teeth: 0, press: 0 },
  MBP: { open: 0, wide: 0.05, round: 0, teeth: 0, press: 1 },
  FV: { open: 0.1, wide: 0.25, round: 0, teeth: 1, press: 0.3 },
  TD: { open: 0.22, wide: 0.3, round: 0, teeth: 0.7, press: 0 },
  S: { open: 0.13, wide: 0.5, round: 0, teeth: 1, press: 0 },
  CH: { open: 0.2, wide: -0.2, round: 0.45, teeth: 0.8, press: 0 },
  KG: { open: 0.36, wide: 0.1, round: 0, teeth: 0.3, press: 0 },
  R: { open: 0.3, wide: 0.2, round: 0, teeth: 0.4, press: 0 },
  L: { open: 0.3, wide: 0.25, round: 0, teeth: 0.55, press: 0 }
};

export function expressionFace(e: ExpressionV2 | undefined): FaceState {
  const out = { ...NEUTRAL_FACE };
  if (e) for (const [k, v] of Object.entries(e.face)) if (typeof v === 'number') (out as Record<string, number>)[k] = v;
  return out;
}

/** Deterministic blink schedule. Same seed + time => same lid state on any machine/frame order. */
export function blinkAmount(seed: string, t: number, rate = 1): number {
  if (rate <= 0) return 0;
  const period = 3.6 / rate;
  const slot = Math.floor(t / period);
  for (const k of [slot - 1, slot]) {
    const start = k * period + hash01(seed, 'blink', k) * (period - 0.3);
    const local = t - start;
    if (local >= 0 && local < 0.17) return local < 0.06 ? smoothstep(local / 0.06) : 1 - smoothstep((local - 0.06) / 0.11);
    // occasional double blink
    if (hash01(seed, 'double', k) > 0.82) { const l2 = local - 0.24; if (l2 >= 0 && l2 < 0.17) return l2 < 0.06 ? smoothstep(l2 / 0.06) : 1 - smoothstep((l2 - 0.06) / 0.11); }
  }
  return 0;
}

export function visemeAt(visemes: [number, string][], tRel: number): { open: number; wide: number; round: number; teeth: number; press: number } {
  const res = { ...VISEMES.sil };
  if (!visemes.length) return res;
  // Coarticulation: crossfade between consecutive targets over a 70 ms window centred on each boundary.
  const W = 0.07;
  let i = 0; while (i + 1 < visemes.length && visemes[i + 1][0] <= tRel) i++;
  const cur = VISEMES[visemes[i][1]] ?? VISEMES.sil;
  const next = i + 1 < visemes.length ? VISEMES[visemes[i + 1][1]] ?? VISEMES.sil : VISEMES.sil;
  const prev = i > 0 ? VISEMES[visemes[i - 1][1]] ?? VISEMES.sil : VISEMES.sil;
  const tStart = visemes[i][0], tNext = i + 1 < visemes.length ? visemes[i + 1][0] : Infinity;
  let a = cur, b = cur, w = 0;
  if (tRel < tStart + W / 2 && i > 0) { a = prev; b = cur; w = smoothstep((tRel - (tStart - W / 2)) / W); }
  else if (tRel > tNext - W / 2) { a = cur; b = next; w = smoothstep((tRel - (tNext - W / 2)) / W); }
  else { a = cur; b = cur; w = 1; }
  for (const k of Object.keys(res) as (keyof typeof res)[]) res[k] = lerp(a[k], b[k], w);
  return res;
}

export interface FaceResult { face: FaceState; speaking: number; mouthEnergy: number }
export function evaluateFace(tl: ActorTimeline, expressions: Record<string, ExpressionV2>, t: number, clipFace?: Map<string, number>): FaceResult {
  let face = expressionFace(expressions[tl.baseExpression] ?? expressions.neutral);
  const blend = (target: FaceState, w: number) => { const o = { ...face }; for (const k of FACE_PARAMS) o[k] = lerp(face[k], target[k], w); face = o; };
  let blinkRate = expressions[tl.baseExpression]?.blinkRate ?? 1;
  for (const inst of tl.expressions) {
    const w = intervalWeight(t, inst.start, inst.end, inst.fade, inst.fade);
    if (w <= 0) continue;
    const e = expressions[inst.expression];
    if (!e) continue;
    const target = expressionFace(e);
    if (inst.intensity !== 1) for (const k of FACE_PARAMS) target[k] = lerp(NEUTRAL_FACE[k], target[k], inst.intensity);
    blend(target, w);
    if (e.blinkRate !== undefined) blinkRate = lerp(blinkRate, e.blinkRate, w);
  }
  if (clipFace) for (const [k, v] of clipFace) if (k in face) (face as Record<string, number>)[k] += v;
  // Lip-sync on top of the expression: visemes drive opening/shape, expression keeps brows/eyes/smile.
  let speaking = 0, energy = 0;
  for (const sp of tl.speech) {
    if (t < sp.start - 0.1 || t > sp.end + 0.12) continue;
    const s = intervalWeight(t, sp.start - 0.06, sp.end + 0.1, 0.06, 0.1);
    const v = visemeAt(sp.visemes, t - sp.start);
    speaking = Math.max(speaking, s);
    energy = Math.max(energy, v.open * s);
    face.mouthOpen = lerp(face.mouthOpen, v.open * 0.95 + face.mouthOpen * 0.15, s);
    face.mouthWide = lerp(face.mouthWide, clamp(v.wide + face.mouthWide * 0.35, -1, 1), s);
    face.mouthRound = lerp(face.mouthRound, v.round, s);
    face.teethShow = lerp(face.teethShow, Math.max(v.teeth, face.teethShow * 0.5), s);
    face.mouthPress = lerp(face.mouthPress, v.press, s);
    face.mouthSmile = lerp(face.mouthSmile, face.mouthSmile * 0.7, s);
  }
  const blink = blinkAmount(tl.id, t, blinkRate);
  if (blink > 0) { face.lidUpperL = lerp(face.lidUpperL, 1, blink); face.lidUpperR = lerp(face.lidUpperR, 1, blink); }
  return { face, speaking, mouthEnergy: energy };
}
