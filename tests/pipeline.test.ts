/** Integration: real browser render + FFmpeg export of a short episode, QA, and incremental invalidation.
 * Requires Chrome/Edge + FFmpeg (skipped otherwise). Uses estimated speech so it does not depend on TTS voices. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tempWorkspace, hasBrowser, hasFfmpeg } from './helpers.ts';

const ws = tempWorkspace();
const { renderEpisode, compileEpisode } = await import('../src/pipeline/episode.ts');
const { ffprobe } = await import('../src/pipeline/media.ts');
const settings = { width: 320, height: 180, fps: 12, maxSeconds: 12, crf: 28, preset: 'ultrafast', speech: 'estimate' as const };

test('render real (Chromium/WebGL + FFmpeg): MP4 H.264/AAC/mov_text, WAV, SRT, metadata y storyboard', { timeout: 600_000 }, async t => {
  if (!hasBrowser() || !hasFfmpeg()) { t.skip('requiere Chrome/Edge y FFmpeg'); return; }
  const r = await renderEpisode('el-ultimo-turno', 'ep-001', settings);
  const pr = await ffprobe(r.video);
  const v = pr.streams.find(s => s.codec_type === 'video')!, a = pr.streams.find(s => s.codec_type === 'audio')!;
  assert.equal(v.codec_name, 'h264'); assert.equal(v.width, 320); assert.equal(Number(v.nb_frames), 144);
  assert.equal(a.codec_name, 'aac'); assert.ok(pr.streams.some(s => s.codec_name === 'mov_text'));
  for (const f of [r.audio, r.srt, r.metadata]) assert.ok(existsSync(f), f);
  assert.ok(r.storyboard.length >= 2);
  assert.ok(r.stats.chunksRendered as number > 0);
});

test('caché incremental: re-render sin cambios reutiliza todo; cambiar una animación invalida solo los planos afectados', { timeout: 600_000 }, async t => {
  if (!hasBrowser() || !hasFfmpeg()) { t.skip('requiere Chrome/Edge y FFmpeg'); return; }
  const again = await renderEpisode('el-ultimo-turno', 'ep-001', settings);
  assert.equal(again.stats.chunksRendered, 0, 'nada cambia => 0 planos renderizados');
  const before = (await compileEpisode('el-ultimo-turno', 'ep-001', settings)).plan.shots.map(s => s.hash);
  // change the sparks (only inside the robot insert shot) => the other shots keep their hash
  const scene = join(ws, 'el-ultimo-turno/episodes/ep-001/scenes/sc-001/scene.json');
  const sc = JSON.parse(readFileSync(scene, 'utf8'));
  sc.actions.find((x: { id: string }) => x.id === 'chispas').intensity = 2.5;
  writeFileSync(scene, JSON.stringify(sc));
  const after = (await compileEpisode('el-ultimo-turno', 'ep-001', settings)).plan.shots.map(s => s.hash);
  const changed = after.filter((h, i) => h !== before[i]).length;
  assert.ok(changed >= 1 && changed < after.length, `planos invalidados: ${changed}/${after.length}`);
  const r = await renderEpisode('el-ultimo-turno', 'ep-001', settings);
  assert.equal(r.stats.chunksRendered, changed);
});
