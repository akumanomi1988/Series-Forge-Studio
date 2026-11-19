/** Director: compiles a declarative scene (scene.json v2) into a deterministic ResolvedScene.
 * Resolves relative timing (at / after / with), plans footsteps, interactions, gaze, foley and subtitles.
 * Pure given its inputs (scene, assets, measured speech), so the same files always produce the same timeline. */
import { angleDiff, clamp, dist2D, hash01, rotateY, yawTowards, lerp } from './math.ts';
import type { Vec3 } from './math.ts';
import { humanoidDims } from './humanoid.ts';
import { SceneEvaluator, DEFAULT_WALK, walkProfile } from './pose.ts';
import type { Action, DialogueLine, SceneV2, Locomotion, PropGeometry, Shot, SoundEvent } from './schema.ts';
import type { ActorTimeline, AssetLibrary, AudioCue, EffectInstance, HandInstance, PropTimeline, ResolvedScene, ResolvedShot, TargetRef, Step } from './timeline.ts';

export interface SpeechInfo { duration: number; visemes: [number, string][]; file?: string; estimated?: boolean }
export interface DirectorOptions { speech?: Record<string, SpeechInfo>; autoFoley?: boolean; estimateSpeech?: (text: string) => SpeechInfo }

export const EMOTION_ALIASES: Record<string, string> = {
  neutral: 'neutral', neutro: 'neutral', calma: 'neutral', joy: 'joy', alegria: 'joy', alegría: 'joy', feliz: 'joy', happy: 'joy',
  smile: 'smile', sonrisa: 'smile', laugh: 'laugh', risa: 'laugh', carcajada: 'laugh', sad: 'sad', triste: 'sad', tristeza: 'sad',
  angry: 'angry', enfado: 'angry', enfadado: 'angry', enfadada: 'angry', ira: 'angry', furioso: 'angry', fear: 'fear', miedo: 'fear', asustado: 'fear',
  surprise: 'surprise', surprised: 'surprise', sorpresa: 'surprise', sorprendido: 'surprise', sorprendida: 'surprise', nervous: 'nervous', nervioso: 'nervous', nerviosa: 'nervous', nerviosismo: 'nervous',
  thinking: 'thinking', pensativo: 'thinking', pensativa: 'thinking', pensamiento: 'thinking', smirk: 'smirk', ironia: 'smirk', ironía: 'smirk', ironico: 'smirk', irónica: 'smirk', irónico: 'smirk', ironica: 'smirk',
  worried: 'worried', preocupado: 'worried', preocupada: 'worried', disgust: 'disgust', asco: 'disgust', determined: 'determined', decidido: 'determined', decidida: 'determined'
};
export const resolveEmotion = (e?: string): string | undefined => (e ? EMOTION_ALIASES[e.toLowerCase()] ?? e.toLowerCase() : undefined);
const INF = 1e9;

interface Item { id: string; kind: 'action' | 'line' | 'shot' | 'sound'; at?: number; after?: string; with?: string; offset: number; data: Action | DialogueLine | Shot | SoundEvent; actor?: string; order: number; start?: number; end?: number }

export function compileScene(scene: SceneV2, lib: AssetLibrary, opts: DirectorOptions = {}): ResolvedScene {
  const warnings: string[] = [];
  const env = scene.environmentId ? lib.environments[scene.environmentId] : null;
  if (scene.environmentId && !env) warnings.push(`Escenario inexistente: ${scene.environmentId}`);
  // ---------------- actors
  const actors: ActorTimeline[] = [];
  for (const a of scene.actors) {
    if (!lib.characters[a.characterId]) throw new Error(`Personaje inexistente en escena ${scene.id}: ${a.characterId}`);
    const c = lib.characters[a.characterId];
    if (!c.expressions[a.expression]) warnings.push(`Expresión desconocida ${a.expression} (${a.id})`);
    actors.push({ id: a.id, characterId: a.characterId, idleClip: c.clips[a.idle] ? a.idle : 'idle', baseExpression: a.expression, root: [{ start: 0, end: INF, kind: 'hold', from: [...a.position] as Vec3, to: [...a.position] as Vec3, yawFrom: a.yawDeg, yawTo: a.yawDeg }], steps: [], clips: [], looks: [], expressions: [], speech: [], hands: [], hips: [], sits: [] });
  }
  const actor = (id: string): ActorTimeline => { const a = actors.find(x => x.id === id); if (!a) throw new Error(`Actor desconocido en ${scene.id}: ${id}`); return a; };
  const charOf = (id: string) => lib.characters[actor(id).characterId];
  const dimsOf = (id: string) => humanoidDims(charOf(id).geometry.body);
  // ---------------- props (environment props + scene props)
  const props: PropTimeline[] = [];
  for (const p of env?.props ?? []) props.push({ id: p.id, propId: p.propId, scale: p.scale, segments: [{ kind: 'static', start: 0, end: INF, position: [...p.position] as Vec3, yawDeg: p.yawDeg }], joints: [] });
  for (const p of scene.props) {
    if (!lib.props[p.propId]) throw new Error(`Objeto inexistente en ${scene.id}: ${p.propId}`);
    const seg = p.heldBy ? { kind: 'held' as const, start: 0, end: INF, actor: p.heldBy.actor, hand: p.heldBy.hand }
      : p.on ? { kind: 'on' as const, start: 0, end: INF, prop: p.on.prop, anchor: p.on.anchor, offset: [0, 0, 0] as Vec3, yawDeg: p.yawDeg }
      : { kind: 'static' as const, start: 0, end: INF, position: (p.position ?? [0, 0, 0]) as Vec3, yawDeg: p.yawDeg };
    const existing = props.findIndex(x => x.id === p.id);
    const pt = { id: p.id, propId: p.propId, scale: p.scale, segments: [seg], joints: [] };
    if (existing >= 0) props[existing] = pt; else props.push(pt);
  }
  for (const p of props) if (!lib.props[p.propId]) throw new Error(`Objeto inexistente: ${p.propId}`);
  const prop = (id: string): PropTimeline => { const p = props.find(x => x.id === id); if (!p) throw new Error(`Objeto desconocido en ${scene.id}: ${id}`); return p; };
  const geoOf = (id: string): PropGeometry => lib.props[prop(id).propId];
  const effects: EffectInstance[] = [];
  const audio: AudioCue[] = [];
  const resolved: ResolvedScene = { schemaVersion: 2, id: scene.id, name: scene.name, durationSec: 0, environmentId: scene.environmentId, actors, props, effects, shots: [], audio, subtitles: [], transitionOut: scene.transitionOut, warnings };
  const evaluator = new SceneEvaluator(resolved, lib);
  // hand holding state for continuity of IK targets
  const handState = new Map<string, { inst: HandInstance; prop?: string }>();
  const setSegmentEnd = (list: { start: number; end: number }[], t: number) => { const last = list[list.length - 1]; if (last && last.end > t) last.end = t; };
  const pushPropSeg = (p: PropTimeline, seg: PropTimeline['segments'][number]) => { setSegmentEnd(p.segments, seg.start); p.segments.push(seg); };
  const rootState = (id: string) => { const r = actor(id).root; return r[r.length - 1]; };
  const lastPlant = (id: string, foot: 'left' | 'right'): { pos: Vec3; yaw: number } => {
    const st = [...actor(id).steps].reverse().find(s => s.foot === foot);
    if (st) return { pos: st.to, yaw: st.yawTo };
    const r = actor(id).root[0], d = dimsOf(id), off = rotateY([(foot === 'left' ? 1 : -1) * d.hipHalf, 0, 0], r.yawFrom);
    return { pos: [r.from[0] + off[0], 0, r.from[2] + off[2]], yaw: r.yawFrom };
  };
  const targetRef = (x: unknown): TargetRef => {
    if (Array.isArray(x)) return { kind: 'point', position: x as Vec3 };
    if (typeof x === 'string') { if (x === 'camera') return { kind: 'camera' }; if (actors.some(a => a.id === x)) return { kind: 'actor', actor: x, bone: 'head' }; if (props.some(p => p.id === x)) return { kind: 'prop', prop: x, anchor: 'grip' }; throw new Error(`Objetivo desconocido: ${x}`); }
    const o = x as { prop?: string; anchor?: string; actor?: string; bone?: string };
    if (o.prop) { prop(o.prop); return { kind: 'prop', prop: o.prop, anchor: o.anchor ?? 'grip' }; }
    if (o.actor) { actor(o.actor); return { kind: 'actor', actor: o.actor, bone: o.bone ?? 'head' }; }
    throw new Error('Objetivo inválido');
  };
  const pointOf = (tr: TargetRef, t: number): Vec3 => { const v = evaluator.targetWorld(tr, t, ''); return v ? [v.x, v.y, v.z] : [0, 0, 0]; };
  const sfx = (sound: string, start: number, gainDb: number, extra: Partial<AudioCue> = {}) => { if (opts.autoFoley === false) return; audio.push({ id: `auto-${sound}-${audio.length}`, kind: 'sfx', sound, start, duration: -1, gainDb, fadeIn: 0, fadeOut: 0, pan: 0, duck: false, auto: true, ...extra }); };
  const gaitOf = (id: string, name?: string): Locomotion => { const c = charOf(id); const g = c.locomotion[name ?? 'walk'] ?? c.locomotion.walk ?? DEFAULT_WALK; if (name && !c.locomotion[name]) warnings.push(`Locomoción desconocida ${name}; se usa walk`); return g; };

  // ---------------- planners
  function planTurn(id: string, start: number, yawTo: number, duration?: number): number {
    const r = rootState(id);
    const delta = angleDiff(r.yawFrom, yawTo);
    if (Math.abs(delta) < 0.5) return start;
    const d = duration ?? clamp(0.3 + Math.abs(delta) / 240, 0.35, 1.6);
    const end = start + d;
    r.end = start;
    actor(id).root.push({ start, end, kind: 'turn', from: r.from, to: r.from, yawFrom: r.yawFrom, yawTo: r.yawFrom + delta, ease: 'easeInOut' });
    actor(id).root.push({ start: end, end: INF, kind: 'hold', from: r.from, to: r.from, yawFrom: r.yawFrom + delta, yawTo: r.yawFrom + delta });
    if (Math.abs(delta) > 25) {
      const dims = dimsOf(id);
      const order: ('left' | 'right')[] = delta > 0 ? ['left', 'right'] : ['right', 'left'];
      order.forEach((foot, k) => {
        const from = lastPlant(id, foot), off = rotateY([(foot === 'left' ? 1 : -1) * dims.hipHalf, 0, 0], r.yawFrom + delta);
        const st: Step = { foot, start: start + k * d / 2, end: start + (k + 1) * d / 2, from: from.pos, to: [r.from[0] + off[0], 0, r.from[2] + off[2]], yawFrom: from.yaw, yawTo: r.yawFrom + delta, lift: 0.05 * dims.scale };
        actor(id).steps.push(st);
        sfx('footstep', st.end, -24, { actor: id });
      });
    }
    return end;
  }
  function planWalk(id: string, start: number, dest: Vec3, gaitName?: string, speedOverride?: number): number {
    let r = rootState(id);
    const D = dist2D(r.from, dest);
    if (D < 0.05) return start;
    const pathYaw = yawTowards(r.from, dest);
    let t0 = start;
    if (Math.abs(angleDiff(r.yawFrom, pathYaw)) > 30) t0 = planTurn(id, start, pathYaw, clamp(0.25 + Math.abs(angleDiff(r.yawFrom, pathYaw)) / 360, 0.3, 0.9));
    r = rootState(id);
    const g = gaitOf(id, gaitName);
    const speed = speedOverride ?? g.speed;
    const T = D / (speed * 0.8);
    const end = t0 + T;
    const yaw = r.yawFrom + angleDiff(r.yawFrom, pathYaw);
    r.end = t0;
    actor(id).root.push({ start: t0, end, kind: 'walk', from: r.from, to: [dest[0], 0, dest[2]], yawFrom: yaw, yawTo: yaw, gait: g });
    actor(id).root.push({ start: end, end: INF, kind: 'hold', from: [dest[0], 0, dest[2]], to: [dest[0], 0, dest[2]], yawFrom: yaw, yawTo: yaw });
    const dims = dimsOf(id);
    const h = 0.72 * dims.scale * g.strideScale * Math.min(1.25, speed / 1.25) ** 0.35;
    const N = Math.max(2, Math.round(D / h) + 1);
    const dir: Vec3 = [(dest[0] - r.from[0]) / D, 0, (dest[2] - r.from[2]) / D];
    // first foot: the one on the outer side of a previous turn, else left
    let foot: 'left' | 'right' = hash01(id, start) > 0.5 ? 'left' : 'right';
    for (let k = 0; k < N; k++) {
      const ts = t0 + k * T / N, te = t0 + (k + 1) * T / N;
      const off = rotateY([(foot === 'left' ? 1 : -1) * dims.hipHalf, 0, 0], yaw);
      let to: Vec3;
      if (k >= N - 2) to = [dest[0] + off[0], 0, dest[2] + off[2]];
      else { const u = walkProfile((te - t0) / T); const bx = lerp(r.from[0], dest[0], u), bz = lerp(r.from[2], dest[2], u); to = [bx + dir[0] * h * 0.5 + off[0], 0, bz + dir[2] * h * 0.5 + off[2]]; }
      const from = lastPlant(id, foot);
      actor(id).steps.push({ foot, start: ts, end: te, from: from.pos, to, yawFrom: from.yaw, yawTo: yaw, lift: g.stepHeight * dims.scale });
      sfx('footstep', te - 0.02, g.gait === 'run' ? -14 : g.gait === 'sneak' ? -28 : -19, { actor: id, pan: clamp(to[0] / 6, -0.8, 0.8) });
      foot = foot === 'left' ? 'right' : 'left';
    }
    return end;
  }
  /** Other actors' ground positions at time t (planning view). */
  function othersAt(self: string, t: number): Vec3[] { return actors.filter(a => a.id !== self).map(a => { let seg = a.root[0]; for (const s of a.root) if (s.start <= t) seg = s; return seg.kind === 'walk' ? seg.to : seg.from; }); }
  const PERSONAL = 0.62;
  /** Point at distance r from target, as close as possible to the straight approach, away from other actors. */
  function approachPoint(self: string, from: Vec3, target: Vec3, r: number, t: number): Vec3 {
    const others = othersAt(self, t);
    const base = Math.atan2(from[0] - target[0], from[2] - target[2]);
    for (let k = 0; k <= 12; k++) {
      const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
      const p: Vec3 = [target[0] + Math.sin(a) * r, 0, target[2] + Math.cos(a) * r];
      if (others.every(o => dist2D(o, p) >= PERSONAL)) return p;
    }
    return [target[0] + Math.sin(base) * r, 0, target[2] + Math.cos(base) * r];
  }
  function clearDest(self: string, dest: Vec3, t: number): Vec3 {
    let p: Vec3 = [...dest] as Vec3;
    for (let iter = 0; iter < 4; iter++) for (const o of othersAt(self, t)) {
      const d0 = dist2D(o, p);
      if (d0 < PERSONAL) { const k = d0 > 1e-3 ? PERSONAL / d0 : 1; p = d0 > 1e-3 ? [o[0] + (p[0] - o[0]) * k, 0, o[2] + (p[2] - o[2]) * k] : [o[0] + PERSONAL, 0, o[2]]; warnings.push('Destino de ' + self + ' desplazado para no atravesar a otro personaje'); }
    }
    return p;
  }
  /** Straight walk, or two legs around the first actor blocking the path. */
  function walkAround(id: string, start: number, dest: Vec3, gait?: string, speed?: number): number {
    const from = rootState(id).from;
    const dx = dest[0] - from[0], dz = dest[2] - from[2], L2 = dx * dx + dz * dz || 1, L = Math.sqrt(L2);
    const block = othersAt(id, start).map(o => { const u = clamp(((o[0] - from[0]) * dx + (o[2] - from[2]) * dz) / L2, 0, 1); const px = from[0] + dx * u, pz = from[2] + dz * u; return { o, d: Math.hypot(o[0] - px, o[2] - pz), u, side: Math.sign((o[0] - from[0]) * dz - (o[2] - from[2]) * dx) || 1 }; })
      .filter(b => b.d < 0.55 && b.u > 0.05 && b.u < 0.95).sort((a, b) => a.u - b.u)[0];
    if (!block) return planWalk(id, start, dest, gait, speed);
    const nx = -dz / L * block.side, nz = dx / L * block.side;
    const wp: Vec3 = [block.o[0] - nx * 0.8, 0, block.o[2] - nz * 0.8];
    const mid = planWalk(id, start, wp, gait, speed);
    return planWalk(id, mid, dest, gait, speed);
  }
  function holdPose(pose: string, hand: 'left' | 'right'): TargetRef {
    const s = hand === 'left' ? 1 : -1;
    switch (pose) {
      case 'behind': return { kind: 'bone', bone: 'hips', offset: [s * 0.1, 0.12, -0.26] };
      case 'raised': case 'show': return { kind: 'bone', bone: 'chest', offset: [s * 0.16, 0.22, 0.36] };
      case 'side': return { kind: 'bone', bone: 'hips', offset: [s * 0.3, -0.05, 0.08] };
      default: return { kind: 'bone', bone: 'chest', offset: [s * 0.12, -0.12, 0.34] };
    }
  }
  function startHold(id: string, hand: 'left' | 'right', start: number, target: TargetRef, propId?: string, fadeIn = 0) {
    const key = `${id}:${hand}`;
    const prev = handState.get(key);
    if (prev && prev.inst.end > start) prev.inst.end = start;
    const inst: HandInstance = { hand, start, end: INF, target, fadeIn, fadeOut: 0.35, grip: propId ? 0.95 : 0.3, source: 'hold' };
    actor(id).hands.push(inst);
    handState.set(key, { inst, prop: propId });
  }
  function releaseHand(id: string, hand: 'left' | 'right', t: number, fadeOut = 0.45) {
    const key = `${id}:${hand}`; const st = handState.get(key);
    if (st) { st.inst.end = t + fadeOut; st.inst.fadeOut = fadeOut; handState.delete(key); }
  }
  function currentHoldTarget(id: string, hand: 'left' | 'right'): TargetRef | null { return handState.get(`${id}:${hand}`)?.inst.target ?? null; }
  function crouchFor(id: string, gripY: number) {
    const d = dimsOf(id);
    const shoulderY = d.height - d.headRy * 2 - d.neckLen - 0.05 * d.scale;
    const drop = clamp(shoulderY - gripY - d.armLen * 0.95, 0, d.legLen * 0.66);
    return { drop, pitch: clamp(15 + 80 * drop / (d.legLen * 0.66), 0, 95) };
  }

  // ---------------- items & timing resolution
  const items: Item[] = [];
  const lineEnd = new Map<string, number>();
  scene.actions.forEach((a, i) => items.push({ id: a.id ?? `action-${i + 1}`, kind: 'action', at: a.at, after: a.after, with: a.with, offset: a.offset ?? 0, data: a, actor: 'actor' in a ? a.actor : undefined, order: i }));
  scene.dialogue.forEach((l, i) => {
    const untimed = l.at === undefined && !l.after && !l.with;
    // untimed lines follow the previous line after its pauseAfter; the first one starts at 0.6 s
    const at = untimed && i === 0 ? 0.6 : l.at, after = untimed && i > 0 ? scene.dialogue[i - 1].id : l.after;
    const offset = (l.offset ?? 0) + (untimed && i > 0 ? scene.dialogue[i - 1].pauseAfter : 0);
    items.push({ id: l.id, kind: 'line', at, after, with: l.with, offset, data: l, actor: l.actor, order: 10000 + i });
  });
  scene.shots.forEach((s, i) => items.push({ id: s.id, kind: 'shot', at: s.at ?? (i === 0 && !s.after && !s.with ? 0 : undefined), after: s.after, with: s.with, offset: s.offset ?? 0, data: s, order: 20000 + i }));
  scene.sound.forEach((s, i) => items.push({ id: s.id ?? `sound-${i + 1}`, kind: 'sound', at: s.at ?? (!s.after && !s.with ? 0 : undefined), after: s.after, with: s.with, offset: s.offset ?? 0, data: s, order: 30000 + i }));
  const ids = new Set<string>();
  for (const it of items) { if (ids.has(it.id)) throw new Error(`ID duplicado en ${scene.id}: ${it.id}`); ids.add(it.id); }
  // actions without timing follow the previous action of the same actor
  const lastByActor = new Map<string, string>();
  for (const it of items.filter(x => x.kind === 'action')) {
    if (it.at === undefined && !it.after && !it.with) { const prev = it.actor ? lastByActor.get(it.actor) : undefined; if (prev) it.after = prev; else it.at = 0; }
    if (it.actor) lastByActor.set(it.actor, it.id);
  }
  const byId = new Map(items.map(i => [i.id, i]));
  for (const it of items) for (const ref of [it.after, it.with]) if (ref && !byId.has(ref)) throw new Error(`Referencia temporal desconocida en ${scene.id}/${it.id}: ${ref}`);
  const pending = new Set(items);
  const startOf = (it: Item): number | null => {
    if (it.at !== undefined) return it.at + it.offset;
    const ref = byId.get((it.after ?? it.with)!)!;
    if (ref.start === undefined) return null;
    return Math.max(0, (it.after ? ref.end! : ref.start) + it.offset);
  };
  let guard = 0;
  while (pending.size) {
    if (++guard > 100000) throw new Error('Dependencias temporales cíclicas');
    let best: Item | null = null, bestT = Infinity;
    for (const it of pending) { const s = startOf(it); if (s !== null && (s < bestT - 1e-9 || (Math.abs(s - bestT) < 1e-9 && best && it.order < best.order))) { best = it; bestT = s; } }
    if (!best) throw new Error(`Dependencias temporales cíclicas en ${scene.id}: ${[...pending].map(p => p.id).join(', ')}`);
    pending.delete(best);
    best.start = bestT;
    best.end = execute(best, bestT);
  }

  function execute(it: Item, s: number): number {
    if (it.kind === 'shot') return s;
    if (it.kind === 'sound') { const e = it.data as SoundEvent; audio.push({ id: it.id, kind: e.kind, sound: e.sound, start: s, duration: e.durationSec ?? -1, gainDb: e.gainDb, fadeIn: e.fadeIn, fadeOut: e.fadeOut, pan: e.pan, duck: e.duck ?? e.kind !== 'sfx' }); return s + (e.durationSec ?? 0); }
    if (it.kind === 'line') {
      const l = it.data as DialogueLine;
      actor(l.actor);
      const info = opts.speech?.[l.id] ?? opts.estimateSpeech?.(l.text) ?? { duration: Math.max(0.6, l.text.split(/\s+/).length * 0.36 + 0.25), visemes: [], estimated: true };
      if (info.estimated) warnings.push(`Duración estimada (sin audio sintetizado) para ${l.id}`);
      const e = s + info.duration;
      actor(l.actor).speech.push({ lineId: l.id, start: s, end: e, visemes: info.visemes, text: l.text });
      audio.push({ id: l.id, kind: 'dialogue', sound: l.id, start: s, duration: info.duration, gainDb: /susurr|en voz baja|whisper/i.test(l.direction ?? '') ? -3 : /grit|shout/i.test(l.direction ?? '') ? 2 : 0, fadeIn: 0, fadeOut: 0, pan: 0, duck: false, file: info.file, actor: l.actor, text: l.text });
      const emo = resolveEmotion(l.emotion);
      if (emo && emo !== 'neutral') {
        if (!charOf(l.actor).expressions[emo]) warnings.push(`Emoción sin expresión: ${l.emotion} (${l.id})`);
        else actor(l.actor).expressions.push({ start: s - 0.2, end: e + 0.7, expression: emo, intensity: l.intensity, fade: 0.25, source: l.id });
      }
      if (l.gesture) {
        const c = charOf(l.actor).clips[l.gesture];
        if (!c) warnings.push(`Gesto desconocido ${l.gesture} (${l.id})`);
        else actor(l.actor).clips.push({ clip: l.gesture, start: s + 0.1, end: s + 0.1 + (c.loop ? info.duration : c.duration), speed: 1, fadeIn: 0.25, fadeOut: 0.3, loop: c.loop, weight: 1, target: l.to ? targetRef(l.to) : undefined, source: l.id });
      }
      lineEnd.set(l.id, e);
      return e;
    }
    const a = it.data as Action;
    switch (a.type) {
      case 'walk': {
        let dest: Vec3;
        const r = rootState(a.actor);
        if (Array.isArray(a.to)) dest = clearDest(a.actor, a.to as Vec3, s);
        else if ('prop' in a.to) dest = approachPoint(a.actor, r.from, pointOf({ kind: 'prop', prop: a.to.prop, anchor: a.to.anchor ?? 'grip' }, s), a.to.distance, s);
        else dest = approachPoint(a.actor, r.from, rootState(a.to.actor).from, a.to.distance, s);
        let end = walkAround(a.actor, s, dest, a.gait, a.speed);
        if (a.faceTo !== undefined) { const p = pointOf(targetRef(a.faceTo), end); end = planTurn(a.actor, end, yawTowards(rootState(a.actor).from, p)); }
        else if (typeof a.to === 'object' && !Array.isArray(a.to)) { const p = 'prop' in a.to ? pointOf({ kind: 'prop', prop: a.to.prop, anchor: a.to.anchor ?? 'grip' }, end) : rootState(a.to.actor).from; end = planTurn(a.actor, end, yawTowards(rootState(a.actor).from, p)); }
        return end;
      }
      case 'turn': {
        const r = rootState(a.actor);
        const yaw = a.yawDeg ?? (a.by !== undefined ? r.yawFrom + a.by : a.towards !== undefined ? yawTowards(r.from, pointOf(targetRef(a.towards), s)) : r.yawFrom);
        return planTurn(a.actor, s, yaw, a.durationSec);
      }
      case 'lookAt': {
        const tl = actor(a.actor);
        for (const l of tl.looks) if (l.source !== 'auto' && l.end > s && l.start < s) l.end = s + 0.3;
        tl.looks.push({ start: s, end: a.durationSec ? s + a.durationSec : INF, target: targetRef(a.target), mode: a.mode, fade: 0.3, source: it.id });
        return s + (a.durationSec ?? 0.3);
      }
      case 'play': {
        const c = charOf(a.actor).clips[a.clip];
        if (!c) throw new Error(`Animación desconocida ${a.clip} para ${a.actor} (${scene.id}/${it.id})`);
        const dur = a.durationSec ?? (a.loop ?? c.loop ? c.duration * 2 / a.speed : c.duration / a.speed);
        actor(a.actor).clips.push({ clip: a.clip, start: s, end: s + dur, speed: a.speed, fadeIn: a.fadeIn, fadeOut: a.fadeOut, loop: a.loop ?? c.loop, weight: a.weight, target: a.target !== undefined ? targetRef(a.target) : undefined, source: it.id });
        return s + dur;
      }
      case 'expression': {
        const tl = actor(a.actor);
        if (!charOf(a.actor).expressions[a.expression]) throw new Error(`Expresión desconocida ${a.expression} (${scene.id}/${it.id})`);
        for (const e of tl.expressions) if (e.source?.startsWith('expr:') && e.end > s && e.start < s) e.end = s + a.fade;
        tl.expressions.push({ start: s, end: a.durationSec ? s + a.durationSec : INF, expression: a.expression, intensity: a.intensity, fade: a.fade, source: 'expr:' + it.id });
        return s + (a.durationSec ?? a.fade);
      }
      case 'pickUp': {
        const tl = actor(a.actor), d = a.durationSec;
        const grip = pointOf({ kind: 'prop', prop: a.prop, anchor: 'grip' }, s);
        const r = rootState(a.actor);
        if (dist2D(r.from, grip) > dimsOf(a.actor).armLen + 0.45) warnings.push(`${a.actor} está lejos de ${a.prop} para recogerlo (${dist2D(r.from, grip).toFixed(2)} m). Añade un walk antes.`);
        const tg = s + 0.45 * d;
        const { drop, pitch } = crouchFor(a.actor, grip[1]);
        tl.hips.push({ start: s, end: s + d, offset: [0, -drop, -0.06 * dimsOf(a.actor).scale], spinePitch: pitch, fadeIn: 0.45 * d, fadeOut: 0.5 * d, source: it.id });
        tl.hands.push({ hand: a.hand, start: s, end: tg, target: { kind: 'point', position: grip }, fadeIn: 0.42 * d, fadeOut: 0, grip: 0.25, source: it.id });
        tl.looks.push({ start: s - 0.2, end: tg + 0.25, target: { kind: 'point', position: grip }, mode: 'head', fade: 0.25, source: it.id });
        startHold(a.actor, a.hand, tg, { kind: 'blend', from: { kind: 'point', position: grip }, to: holdPose('front', a.hand), start: tg, end: s + d, ease: 'easeInOut' }, a.prop);
        pushPropSeg(prop(a.prop), { kind: 'held', start: tg, end: INF, actor: a.actor, hand: a.hand });
        // the blend target settles into the plain hold pose afterwards
        const st = handState.get(`${a.actor}:${a.hand}`)!; st.inst.end = s + d;
        startHold(a.actor, a.hand, s + d, holdPose('front', a.hand), a.prop);
        sfx('grab', tg, -20, { actor: a.actor });
        return s + d;
      }
      case 'hold': {
        const from = currentHoldTarget(a.actor, a.hand) ?? holdPose('side', a.hand);
        const propId = a.prop ?? handState.get(`${a.actor}:${a.hand}`)?.prop ?? props.find(p => { const s = p.segments[p.segments.length - 1]; return s.kind === 'held' && s.actor === a.actor && s.hand === a.hand; })?.id;
        startHold(a.actor, a.hand, s, { kind: 'blend', from, to: holdPose(a.pose, a.hand), start: s, end: s + a.durationSec, ease: 'easeInOut' }, propId, handState.has(`${a.actor}:${a.hand}`) ? 0 : 0.3);
        const st = handState.get(`${a.actor}:${a.hand}`)!; st.inst.end = s + a.durationSec;
        startHold(a.actor, a.hand, s + a.durationSec, holdPose(a.pose, a.hand), propId);
        return s + a.durationSec;
      }
      case 'drop': {
        const p = prop(a.prop);
        const seg = p.segments[p.segments.length - 1];
        if (seg.kind !== 'held' || seg.actor !== a.actor) throw new Error(`${a.actor} no sostiene ${a.prop} en ${s.toFixed(2)} s (${scene.id}/${it.id})`);
        const geo = geoOf(a.prop);
        // release state from the real pose at t (deterministic)
        const pw = evaluator.propWorld(a.prop, s)!.matrix.elements, pwPrev = evaluator.propWorld(a.prop, Math.max(0, s - 0.05))!.matrix.elements;
        const p0: Vec3 = [pw[12], pw[13], pw[14]];
        const v0: Vec3 = [(pw[12] - pwPrev[12]) / 0.05, (pw[13] - pwPrev[13]) / 0.05, (pw[14] - pwPrev[14]) / 0.05].map(v => clamp(v, -2.5, 2.5)) as Vec3;
        const floorY = geo.restHeight ?? 0.02;
        const g = 9.81;
        const t1 = (v0[1] + Math.sqrt(Math.max(0, v0[1] * v0[1] + 2 * g * Math.max(0, p0[1] - floorY)))) / g;
        const vImpact = Math.abs(v0[1] - g * t1);
        const b1 = vImpact * 0.33, b2 = b1 * 0.3;
        const impacts = [s + t1, s + t1 + 2 * b1 / g, s + t1 + 2 * b1 / g + 2 * b2 / g];
        const hit: Vec3 = [p0[0] + v0[0] * t1, floorY, p0[2] + v0[2] * t1];
        const roll = 0.18 + 0.25 * hash01(a.prop, s);
        const rest: Vec3 = [hit[0] + v0[0] * roll, floorY, hit[2] + v0[2] * roll];
        const lying = (geo.params.lying as boolean | undefined) ?? true;
        pushPropSeg(p, { kind: 'fall', start: s, end: INF, actor: a.actor, hand: seg.hand, floorY, seed: Math.floor(hash01(a.prop, s) * 1e6), impacts, rest, restRotationDeg: lying ? [90, 0, 0] : [0, 0, 0], restYaw: hash01(a.prop, 'yaw', s) * 360 });
        releaseHand(a.actor, seg.hand, s, 0.5);
        const snd = a.sound ?? `impact-${geo.material}`;
        impacts.forEach((ti, k) => sfx(snd, ti, [-2, -11, -18][k], { pan: clamp(rest[0] / 6, -0.8, 0.8) }));
        return impacts[0];
      }
      case 'place': {
        const tl = actor(a.actor), d = a.durationSec;
        const p = prop(a.prop);
        const seg = p.segments[p.segments.length - 1];
        if (seg.kind !== 'held') throw new Error(`${a.prop} no está en la mano de ${a.actor} (${scene.id}/${it.id})`);
        const dest: Vec3 = Array.isArray(a.on) ? a.on as Vec3 : pointOf({ kind: 'prop', prop: a.on.prop, anchor: a.on.anchor }, s);
        const { drop, pitch } = crouchFor(a.actor, dest[1] + 0.05);
        const tr = s + 0.55 * d;
        tl.hips.push({ start: s, end: s + d, offset: [0, -drop, 0.05], spinePitch: pitch, fadeIn: 0.5 * d, fadeOut: 0.45 * d, source: it.id });
        const from = currentHoldTarget(a.actor, seg.hand) ?? holdPose('front', seg.hand);
        startHold(a.actor, seg.hand, s, { kind: 'blend', from, to: { kind: 'point', position: [dest[0], dest[1] + 0.06, dest[2]] }, start: s, end: tr, ease: 'easeInOut' }, a.prop);
        releaseHand(a.actor, seg.hand, tr, 0.45 * d);
        tl.looks.push({ start: s, end: tr + 0.2, target: { kind: 'point', position: dest }, mode: 'head', fade: 0.25, source: it.id });
        if (Array.isArray(a.on)) pushPropSeg(p, { kind: 'static', start: tr, end: INF, position: dest, yawDeg: rootState(a.actor).yawFrom });
        else pushPropSeg(p, { kind: 'on', start: tr, end: INF, prop: a.on.prop, anchor: a.on.anchor, offset: [0, 0, 0], yawDeg: 0 });
        sfx(`impact-${geoOf(a.prop).material}`, tr, -16);
        return s + d;
      }
      case 'give': {
        const d = a.durationSec, p = prop(a.prop);
        const seg = p.segments[p.segments.length - 1];
        if (seg.kind !== 'held' || seg.actor !== a.actor) throw new Error(`${a.actor} no sostiene ${a.prop} (${scene.id}/${it.id})`);
        const ra = rootState(a.actor).from, rb = rootState(a.to).from;
        const mid: Vec3 = [(ra[0] + rb[0]) / 2, Math.min(dimsOf(a.actor).hipsY, dimsOf(a.to).hipsY) + 0.25, (ra[2] + rb[2]) / 2];
        const tx = s + 0.55 * d;
        const from = currentHoldTarget(a.actor, seg.hand) ?? holdPose('front', seg.hand);
        startHold(a.actor, seg.hand, s, { kind: 'blend', from, to: { kind: 'point', position: mid }, start: s, end: tx, ease: 'easeInOut' }, a.prop);
        releaseHand(a.actor, seg.hand, tx, 0.4);
        const hand: 'left' | 'right' = 'right';
        actor(a.to).hands.push({ hand, start: s + 0.15 * d, end: tx, target: { kind: 'point', position: mid }, fadeIn: 0.35 * d, fadeOut: 0, grip: 0.3, source: it.id });
        startHold(a.to, hand, tx, { kind: 'blend', from: { kind: 'point', position: mid }, to: holdPose('front', hand), start: tx, end: s + d }, a.prop);
        const st = handState.get(`${a.to}:${hand}`)!; st.inst.end = s + d;
        startHold(a.to, hand, s + d, holdPose('front', hand), a.prop);
        pushPropSeg(p, { kind: 'held', start: tx, end: INF, actor: a.to, hand });
        for (const [x, y] of [[a.actor, a.to], [a.to, a.actor]]) actor(x).looks.push({ start: s, end: s + d, target: { kind: 'point', position: mid }, mode: 'head', fade: 0.3, source: it.id + y });
        return s + d;
      }
      case 'sit': {
        const tl = actor(a.actor), d = a.durationSec;
        const geo = geoOf(a.prop);
        const anchor = geo.anchors[a.anchor];
        if (!anchor) throw new Error(`${a.prop} no tiene anclaje ${a.anchor}`);
        const seat = pointOf({ kind: 'prop', prop: a.prop, anchor: a.anchor }, s);
        const pw = evaluator.propWorld(a.prop, s)!.matrix.elements;
        const seatYaw = Math.atan2(pw[8], pw[10]) * 180 / Math.PI + (anchor.rotationDeg?.[1] ?? 0);
        const front = rotateY([0, 0, 0.32 * dimsOf(a.actor).scale], seatYaw);
        const standPos: Vec3 = [seat[0] + front[0], 0, seat[2] + front[2]];
        let t = s;
        if (dist2D(rootState(a.actor).from, standPos) > 0.08) t = planWalk(a.actor, t, standPos, undefined, 0.8);
        t = planTurn(a.actor, t, seatYaw);
        tl.sits.push({ start: t, end: INF, seat, yawDeg: seatYaw, fadeIn: d, fadeOut: d });
        sfx('chair-creak', t + d * 0.85, -18);
        return t + d;
      }
      case 'stand': {
        const tl = actor(a.actor);
        const sit = [...tl.sits].reverse().find(x => x.end > s);
        if (!sit) { warnings.push(`${a.actor} no está sentado (${it.id})`); return s; }
        sit.end = s + a.durationSec; sit.fadeOut = a.durationSec;
        return s + a.durationSec;
      }
      case 'propJoint': {
        const p = prop(a.prop), geo = geoOf(a.prop);
        const j = geo.joints[a.joint];
        if (!j) throw new Error(`${a.prop} no tiene articulación ${a.joint}`);
        const prev = [...p.joints].reverse().find(x => x.joint === a.joint);
        p.joints.push({ joint: a.joint, start: s, end: s + a.durationSec, fromDeg: a.fromDeg ?? prev?.toDeg ?? 0, toDeg: clamp(a.toDeg, j.minDeg, j.maxDeg), ease: a.ease });
        if (a.sound) sfx(a.sound, s, -8);
        return s + a.durationSec;
      }
      case 'effect': {
        if (a.prop) prop(a.prop);
        effects.push({ effect: a.effect, start: s, end: s + a.durationSec, prop: a.prop, part: a.part, position: a.position as Vec3 | undefined, intensity: a.intensity, seed: Math.floor(hash01(scene.id, it.id) * 1e6) });
        if (a.sound) sfx(a.sound, s, -6, { duration: a.durationSec });
        return s + a.durationSec;
      }
    }
  }

  // ---------------- scene duration and open intervals
  let end = 0;
  for (const it of items) if (it.kind !== 'sound' || (it.data as SoundEvent).kind === 'sfx') end = Math.max(end, it.end ?? 0);
  for (const a of actors) for (const st of a.steps) end = Math.max(end, st.end);
  for (const c of audio) if (c.kind === 'sfx' && c.auto) end = Math.max(end, c.start + 0.3);
  const duration = scene.durationSec === 'auto' ? Math.ceil((end + scene.tailSec) * 100) / 100 : scene.durationSec;
  if (scene.durationSec !== 'auto' && end > duration + 0.01) warnings.push(`La escena ${scene.id} dura ${duration}s pero hay eventos hasta ${end.toFixed(2)}s`);
  resolved.durationSec = duration;
  const close = (x: { end: number }) => { if (x.end >= INF / 2) x.end = duration + 5; };
  for (const a of actors) { a.root.forEach(close); a.looks.forEach(close); a.expressions.forEach(close); a.hands.forEach(close); a.sits.forEach(close); a.clips.forEach(close); }
  for (const p of props) p.segments.forEach(close);
  for (const c of audio) if (c.duration < 0 && c.kind !== 'sfx') c.duration = Math.max(0.1, duration - c.start);

  // ---------------- automatic gaze between characters during dialogue
  if (scene.autoLook && actors.length > 1) {
    for (const l of scene.dialogue) {
      const sp = actor(l.actor).speech.find(x => x.lineId === l.id)!;
      for (const other of actors) {
        const explicit = (tl: ActorTimeline, a0: number, b0: number) => tl.looks.some(x => x.source !== 'auto' && x.start < b0 && x.end > a0);
        if (other.id === l.actor) {
          const to = l.to && actors.some(a => a.id === l.to) ? l.to : actors.filter(a => a.id !== l.actor).sort((p, q) => dist2D(rootStateAt(p, sp.start), rootStateAt(actor(l.actor), sp.start)) - dist2D(rootStateAt(q, sp.start), rootStateAt(actor(l.actor), sp.start)))[0]?.id;
          if (to && !explicit(other, sp.start, sp.end)) pushAutoLook(other, sp.start - 0.1, sp.end + 0.3, to);
        } else if (!explicit(other, sp.start, sp.end)) pushAutoLook(other, sp.start + 0.18, sp.end + 0.5, l.actor);
      }
    }
  }
  function rootStateAt(tl: ActorTimeline, t: number): Vec3 { let seg = tl.root[0]; for (const s of tl.root) if (s.start <= t) seg = s; return seg.kind === 'walk' ? seg.to : seg.from; }
  function pushAutoLook(tl: ActorTimeline, start: number, endT: number, target: string) {
    const prev = [...tl.looks].reverse().find(x => x.source === 'auto');
    if (prev && prev.target.kind === 'actor' && prev.target.actor === target && start - prev.end < 1.2) { prev.end = Math.max(prev.end, endT); return; }
    tl.looks.push({ start, end: Math.min(endT, duration), target: { kind: 'actor', actor: target, bone: 'head' }, mode: 'head', fade: 0.35, source: 'auto' });
  }
  // explicit looks must win over automatic ones: evaluate auto first
  for (const a of actors) a.looks.sort((x, y) => (x.source === 'auto' ? 0 : 1) - (y.source === 'auto' ? 0 : 1) || x.start - y.start);

  // ---------------- shots
  const shotItems = items.filter(i => i.kind === 'shot').sort((a, b) => a.start! - b.start!);
  resolved.shots = shotItems.map((it, i): ResolvedShot => { const sh = it.data as Shot; return { id: sh.id, start: clamp(it.start!, 0, duration), end: i + 1 < shotItems.length ? clamp(shotItems[i + 1].start!, 0, duration) : duration, camera: sh.camera, transitionIn: sh.transitionIn }; }).filter(s => s.end - s.start > 1e-3);
  if (!resolved.shots.length || resolved.shots[0].start > 0.001) warnings.push(`La escena ${scene.id} no tiene plano en t=0`);
  for (const sh of resolved.shots) for (const ref of [sh.camera.subject, sh.camera.over, ...(sh.camera.subjects ?? [])]) if (ref && !actors.some(a => a.id === ref) && !props.some(p => p.id === ref)) throw new Error(`Plano ${sh.id}: sujeto desconocido ${ref}`);
  // ---------------- subtitles (max 2 lines x 42 chars per cue)
  for (const a of actors) for (const sp of a.speech) {
    const chunks = splitSubtitle(sp.text);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    let t = sp.start;
    for (const c of chunks) { const d = (sp.end - sp.start) * c.length / total; resolved.subtitles.push({ start: t, end: Math.min(duration, t + d + 0.15), actor: a.id, text: c, lineId: sp.lineId }); t += d; }
  }
  resolved.subtitles.sort((a, b) => a.start - b.start);
  audio.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  return resolved;
}

export function splitSubtitle(text: string, maxLine = 42): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxLine && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  const cues: string[] = [];
  for (let i = 0; i < lines.length; i += 2) cues.push(lines.slice(i, i + 2).join('\n'));
  return cues;
}
