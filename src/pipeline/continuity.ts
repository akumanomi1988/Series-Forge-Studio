/** Racord between continuous scenes: where a scene ends (positions, facing, who is seated, what each hand holds)
 * must be where the next one starts when the next one is marked `continuous`. Pure; works on resolved scenes. */
import type { ResolvedScene } from '../engine/timeline.ts';
import type { SceneV2 } from '../engine/schema.ts';

export interface ActorState { position: [number, number, number]; yawDeg: number; seated: boolean; holding: string[] }
const angle = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

/** Final state of every actor of a resolved scene. Props are identified by their propId (scene prop ids may differ). */
export function endState(r: ResolvedScene): Record<string, ActorState> {
  const out: Record<string, ActorState> = {};
  const D = r.durationSec;
  for (const a of r.actors) {
    const s = a.root[a.root.length - 1];
    const seated = a.sits.some(x => x.start < D && x.end > D - 0.05);
    const holding = r.props.filter(p => p.segments.some(g => g.kind === 'held' && g.actor === a.id && g.start < D && g.end > D - 0.05)).map(p => p.propId).sort();
    out[a.id] = { position: [...s.to] as [number, number, number], yawDeg: s.yawTo, seated, holding };
  }
  return out;
}
/** Initial state written in a scene.json (a sit action in the first half second counts as starting seated). */
export function startState(sc: SceneV2): Record<string, ActorState> {
  const out: Record<string, ActorState> = {};
  for (const a of sc.actors) {
    const seated = sc.actions.some(x => x.type === 'sit' && x.actor === a.id && (x.at ?? 99) <= 0.5);
    const holding = sc.props.filter(p => p.heldBy?.actor === a.id).map(p => p.propId).sort();
    out[a.id] = { position: [...a.position] as [number, number, number], yawDeg: a.yawDeg, seated, holding };
  }
  return out;
}
/** Human-readable racord errors between the end of `prev` and the start of `next`. Actors off the set (outside the
 * room) in either scene are ignored: they come and go between scenes. */
export function racord(prev: ResolvedScene, next: SceneV2, room?: [number, number, number]): string[] {
  const a = endState(prev), b = startState(next), errs: string[] = [];
  const onSet = (p: number[]) => !room || (Math.abs(p[0]) < room[0] / 2 && p[2] > -room[2] / 2 && p[2] < room[2] / 2 + 1);
  for (const id of Object.keys(b)) {
    const e = a[id], s = b[id];
    if (!e || !onSet(e.position) || !onSet(s.position)) continue;
    if (e.seated !== s.seated) errs.push(`racord ${id}: termina ${e.seated ? 'sentado' : 'de pie'} y empieza ${s.seated ? 'sentado' : 'de pie'}`);
    const d = Math.hypot(e.position[0] - s.position[0], e.position[2] - s.position[2]);
    if (!e.seated && d > 0.2) errs.push(`racord ${id}: termina en [${e.position.map(v => v.toFixed(2))}] y empieza en [${s.position.map(v => v.toFixed(2))}] (${d.toFixed(2)} m)`);
    if (!e.seated && angle(e.yawDeg, s.yawDeg) > 30) errs.push(`racord ${id}: termina mirando a ${e.yawDeg.toFixed(0)}° y empieza a ${s.yawDeg.toFixed(0)}°`);
    if (e.holding.join() !== s.holding.join()) errs.push(`racord ${id}: termina con [${e.holding.join(', ')}] en la mano y empieza con [${s.holding.join(', ')}]`);
  }
  for (const id of Object.keys(a)) if (!b[id] && onSet(a[id].position)) errs.push(`racord ${id}: estaba en escena al cortar y desaparece en la siguiente`);
  return errs;
}
