/** Pure scene evaluator shared by the editor, browser renderer and Node planners.
 * All state comes from the scene and absolute time (no accumulated frame delta).
 * Y is up, positions in metres, angles in degrees.
 */
const isVec3 = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpVec3 = (from, to, t) => from.map((value, i) => lerp(value, to[i], t));
const phase = (beat, timeSec) => beat.endSec === beat.startSec ? 1 : Math.min(1, Math.max(0, (timeSec - beat.startSec) / (beat.endSec - beat.startSec)));

export function evaluateSceneFrame(scene, timeSec) {
  const time = Math.min(scene.durationSec, Math.max(0, Number.isFinite(timeSec) ? timeSec : 0));
  const actors = (scene.actors ?? []).map(actor => ({
    ...actor,
    position: [...actor.position],
    yawDeg: actor.yawDeg ?? 0,
    headYawDeg: actor.headYawDeg ?? 0,
    animation: actor.animation || 'idle',
    animationStartSec: 0,
    expression: actor.expression || 'neutral',
    speaking: false
  }));
  const camera = structuredClone(scene.camera ?? { position: [0, 2.4, 8], target: [0, 1, 0], orthographicSize: 6.5 });
  const beats = [...(scene.beats ?? [])].filter(b => b.startSec <= time).sort((a, b) => a.startSec - b.startSec);
  for (const beat of beats) {
    const fraction = phase(beat, time);
    if (beat.type === 'action') {
      const actor = actors.find(a => a.characterId === beat.actorId);
      if (!actor) continue;
      if (isVec3(beat.fromPosition) && isVec3(beat.toPosition)) actor.position = lerpVec3(beat.fromPosition, beat.toPosition, fraction);
      if (Number.isFinite(beat.yawDeg)) actor.yawDeg = lerp(beat.fromYawDeg ?? actor.yawDeg, beat.yawDeg, fraction);
      if (Number.isFinite(beat.headYawDeg)) actor.headYawDeg = lerp(beat.fromHeadYawDeg ?? actor.headYawDeg, beat.headYawDeg, fraction);
      if (beat.animation) { actor.animation = beat.animation; actor.animationStartSec = beat.startSec; }
      if (beat.expression) actor.expression = beat.expression;
    }
    if (beat.type === 'camera') {
      if (isVec3(beat.fromPosition) && isVec3(beat.position)) camera.position = lerpVec3(beat.fromPosition, beat.position, fraction);
      if (isVec3(beat.fromTarget) && isVec3(beat.target)) camera.target = lerpVec3(beat.fromTarget, beat.target, fraction);
      if (Number.isFinite(beat.orthographicSize) && Number.isFinite(beat.fromOrthographicSize)) camera.orthographicSize = lerp(beat.fromOrthographicSize, beat.orthographicSize, fraction);
    }
  }
  const activeDialogues = (scene.beats ?? []).filter(b => b.type === 'dialogue' && b.startSec <= time && time < b.endSec);
  for (const actor of actors) actor.speaking = activeDialogues.some(beat => beat.actorId === actor.characterId);
  return { timeSec: time, actors, camera, activeDialogues };
}
