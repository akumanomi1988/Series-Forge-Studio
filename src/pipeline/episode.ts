/** Episode production pipeline: compile (TTS + timing + lip-sync) -> shot render with dependency-hash cache ->
 * audio master -> mux MP4 (H.264/AAC + mov_text) + SRT + metadata + storyboard -> validation report.
 * Long episodes are processed per scene/shot chunk so memory stays bounded and interrupted runs resume. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, openSync, writeSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile, rename, rm, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import * as THREE from 'three';
import { loadProject, assetLibrary, REPO_ROOT } from './project.ts';
import type { LoadedProject } from './project.ts';
import { compileScene, resolveEmotion } from '../engine/director.ts';
import type { SpeechInfo } from '../engine/director.ts';
import type { ResolvedScene, AudioCue, AssetLibrary } from '../engine/timeline.ts';
import { SceneEvaluator } from '../engine/pose.ts';
import { evaluateShots } from '../engine/camera.ts';
import { synthesize, resolveVoice } from '../audio/tts.ts';
import { racord } from './continuity.ts';
import { estimateSpeech } from '../audio/phonetics-es.ts';
import { mixSegment, blockPowers, loudnessFromPowers, limit } from '../audio/mixer.ts';
import type { MixContext } from '../audio/mixer.ts';
import { readWav, writeWavAtomic, dbToGain } from '../audio/wav.ts';
import { SR } from '../audio/synth.ts';
import { openRenderHost } from './chrome.ts';
import type { RenderHost } from './chrome.ts';
import { runProcess } from '../audio/tts.ts';
import { buildBrowser } from '../../scripts/build.ts';
import type { SoundEvent } from '../engine/schema.ts';

async function renameRetry(a: string, b: string) { for (let i = 0; ; i++) { try { await rename(a, b); return; } catch (e) { if (i >= 5 || !['EPERM', 'EBUSY'].includes((e as NodeJS.ErrnoException).code ?? '')) throw e; await new Promise(r => setTimeout(r, 400)); } } }
export type Progress = (ev: Record<string, unknown>) => void;
const sha = (x: unknown) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
export interface RenderSettings { width: number; height: number; fps: number; maxSeconds?: number; crf?: number; preset?: string; scenes?: string[]; speech?: 'tts' | 'estimate'; voiceProvider?: string }
export interface PlanShot { id: string; scene: string; sceneIndex: number; start: number; end: number; frame0: number; frame1: number; localFrame0: number; hash: string; chunks: { f0: number; f1: number; hash: string }[] }
export interface EpisodePlan {
  schemaVersion: 2; project: string; episode: string; name: string; settings: RenderSettings; durationSec: number; frames: number;
  scenes: { id: string; name: string; start: number; duration: number; frame0: number; frames: number; resolvedFile: string; hash: string; warnings: string[] }[];
  shots: PlanShot[]; audio: AudioCue[]; subtitles: { start: number; end: number; actor: string; text: string; lineId: string; voiceOver?: boolean }[];
  speech: Record<string, { file: string; duration: number; cached: boolean; provider: string; method: string; key: string }>;
  rendererHash: string; generatedAt: string;
}

/** Hash of everything in the repo that affects pixels (engine + renderer source). */
export async function rendererHash(): Promise<string> {
  const files: string[] = [];
  for (const dir of ['src/engine', 'src/render']) for (const f of (await readdir(join(REPO_ROOT, dir))).sort()) if (f.endsWith('.ts')) files.push(await readFile(join(REPO_ROOT, dir, f), 'utf8'));
  files.push(JSON.parse(await readFile(join(REPO_ROOT, 'node_modules', 'three', 'package.json'), 'utf8')).version);
  return sha(files).slice(0, 16);
}
/** Per-frame state fingerprint (poses, face, props, camera). Shots whose fingerprints are unchanged keep their cache. */
function frameFingerprint(ev: SceneEvaluator, sc: ResolvedScene, t: number, aspect: number): string {
  const shot = evaluateShots(ev, sc, t, aspect);
  ev.cameraPos.copy(shot.camera.position);
  ev.evaluate(t);
  const parts: number[] = [shot.index, shot.transition?.progress ?? -1, ...shot.camera.position.toArray(), ...shot.camera.target.toArray(), shot.camera.fov];
  for (const [id, rig] of ev.rigs) {
    parts.push(...rig.group.position.toArray(), rig.group.rotation.y);
    for (const b of rig.bones.values()) parts.push(...b.quaternion.toArray(), ...b.position.toArray());
    const p = ev.poses.get(id)!;
    parts.push(...Object.values(p.face), p.eyeYaw, p.eyePitch, p.grip.left, p.grip.right);
  }
  for (const p of sc.props) { const w = ev.propWorld(p.id, t); if (w) parts.push(...w.matrix.elements, ...Object.values(w.joints)); }
  return parts.map(v => Math.round(v * 1e4)).join(',');
}
function assetsHash(p: LoadedProject, sc: ResolvedScene): string {
  const files = Object.entries(p.fileHashes).filter(([k]) => sc.actors.some(a => k.startsWith(`characters/${a.characterId}/`) && /geometry|rig/.test(k)) || sc.props.some(pr => k.startsWith(`props/${pr.propId}/geometry`)) || (sc.environmentId && k.startsWith(`environments/${sc.environmentId}/`)));
  return sha(files.sort()).slice(0, 16);
}

export async function compileEpisode(project: string, episode: string, settings: RenderSettings, progress: Progress = () => {}): Promise<{ plan: EpisodePlan; project: LoadedProject; resolved: ResolvedScene[]; lib: AssetLibrary }> {
  const p = await loadProject(project);
  const errors = p.issues.filter(i => i.level === 'error');
  if (errors.length) throw new Error('El proyecto tiene errores de validación:\n' + errors.map(e => `  ${e.path}: ${e.message}`).join('\n'));
  const ep = p.episodes[episode];
  if (!ep) throw new Error(`Episodio inexistente: ${episode}`);
  if (ep.legacy) throw new Error('Episodio v1: usa `npm run render:legacy` o conviértelo a episode.json v2');
  const lib = assetLibrary(p);
  const gen = join(p.root, ep.dir, 'generated');
  await mkdir(join(gen, 'scenes'), { recursive: true });
  const voiceCache = join(p.root, 'generated', 'audio', 'voices');
  const fps = settings.fps;
  const sceneIds = settings.scenes?.length ? ep.episode.scenes.filter(s => settings.scenes!.includes(s)) : ep.episode.scenes;
  const plan: EpisodePlan = { schemaVersion: 2, project, episode, name: ep.name, settings, durationSec: 0, frames: 0, scenes: [], shots: [], audio: [], subtitles: [], speech: {}, rendererHash: await rendererHash(), generatedAt: new Date().toISOString() };
  const resolvedAll: ResolvedScene[] = [];
  let frame = 0;
  const maxFrames = settings.maxSeconds ? Math.round(settings.maxSeconds * fps) : Infinity;
  // voice engine: --voice-provider > episode.json voiceProvider > project.json voiceProvider > each voice.json
  const voiceProvider = settings.voiceProvider ?? ep.episode.voiceProvider ?? (p.meta.voiceProvider as string | undefined) ?? 'auto';
  for (const sid of sceneIds) {
    if (frame >= maxFrames) break;
    const scene0 = ep.scenes[sid];
    if (!scene0) throw new Error(`Escena inválida o inexistente: ${sid}`);
    // slow fades between scenes (not into a continuous scene: that is the same action going on)
    const fadeSpec = ep.episode.score?.sceneFade, idx = sceneIds.indexOf(sid), nextScene = ep.scenes[sceneIds[idx + 1]];
    const fadeOut = !!fadeSpec && idx < sceneIds.length - 1 && !nextScene?.continuous && !scene0.transitionOut;
    const scene = fadeOut ? { ...scene0, transitionOut: { type: 'fade' as const, durationSec: fadeSpec!.durationSec }, tailSec: Math.max(scene0.tailSec, fadeSpec!.holdSec + fadeSpec!.durationSec) } : scene0;
    // speech
    const speech: Record<string, SpeechInfo> = {};
    for (const line of scene.dialogue) {
      const actor = scene.actors.find(a => a.id === line.actor);
      const ch = p.characters[actor?.characterId ?? line.actor]; // a narrator off the set is named by character id
      if (settings.speech === 'estimate' || !ch.voice) { const e = estimateSpeech(line.text, ch.voice?.rate ?? 1); speech[line.id] = { ...e, estimated: true }; continue; }
      const emo = resolveEmotion(line.emotion);
      progress({ stage: 'tts', scene: sid, line: line.id });
      const voice = resolveVoice(ch.voice, voiceProvider);
      const r = await synthesize({ text: line.text, voice, emotion: emo, intensity: line.intensity, direction: line.direction, rate: line.rate, pitchSemitones: line.pitchSemitones }, voiceCache, emo);
      speech[line.id] = { duration: r.duration, visemes: r.alignment.visemes, file: r.file };
      plan.speech[line.id] = { file: r.file, duration: r.duration, cached: r.cached, provider: r.provider, method: r.alignment.method, key: r.key };
    }
    const resolved = compileScene(scene, lib, { speech });
    if (fadeSpec && idx > 0 && !scene.continuous && resolved.shots[0] && !resolved.shots[0].transitionIn) resolved.shots[0].transitionIn = { type: 'fade', durationSec: fadeSpec.durationSec };
    if (scene.continuous && resolvedAll.length) {
      const env = scene.environmentId ? p.environments[scene.environmentId] : null;
      for (const e of racord(resolvedAll[resolvedAll.length - 1], scene, env && env.env.kind === 'room' ? env.env.size : undefined)) resolved.warnings.push(e);
    }
    // snap scene to whole frames so global time never drifts
    let frames = Math.max(1, Math.round(resolved.durationSec * fps));
    if (frame + frames > maxFrames) frames = maxFrames - frame;
    resolved.durationSec = frames / fps;
    for (const sh of resolved.shots) sh.end = Math.min(sh.end, resolved.durationSec);
    resolved.shots = resolved.shots.filter(sh => sh.start < resolved.durationSec - 1e-6);
    resolved.shots[resolved.shots.length - 1].end = resolved.durationSec;
    const start = frame / fps;
    const resolvedFile = join(gen, 'scenes', `${sid}.resolved.json`);
    await writeFile(resolvedFile, JSON.stringify(resolved));
    // shot hashes from per-frame state fingerprints
    const ev = new SceneEvaluator(resolved, lib);
    const aHash = assetsHash(p, resolved);
    const sceneIndex = resolvedAll.length;
    for (const sh of resolved.shots) {
      const lf0 = Math.round(sh.start * fps), lf1 = Math.round(sh.end * fps);
      if (lf1 <= lf0) continue;
      const chunks: PlanShot['chunks'] = [];
      const CH = 240;
      const fps_: string[] = [];
      for (let c0 = lf0; c0 < lf1; c0 += CH) {
        const c1 = Math.min(lf1, c0 + CH);
        const fp: string[] = [];
        for (let f = c0; f < c1; f++) fp.push(frameFingerprint(ev, resolved, f / fps, settings.width / settings.height));
        const effects = resolved.effects.filter(e => e.start < c1 / fps && e.end > c0 / fps);
        const h = sha({ fp, effects, aHash, env: resolved.environmentId, r: plan.rendererHash, w: settings.width, h: settings.height, fps, crf: settings.crf ?? 18, transitionOut: resolved.transitionOut, dur: resolved.durationSec, c0, c1 }).slice(0, 24);
        chunks.push({ f0: frame + c0, f1: frame + c1, hash: h }); fps_.push(h);
      }
      plan.shots.push({ id: sh.id, scene: sid, sceneIndex, start: start + sh.start, end: start + sh.end, frame0: frame + lf0, frame1: frame + lf1, localFrame0: lf0, hash: sha(fps_).slice(0, 24), chunks });
    }
    for (const c of resolved.audio) plan.audio.push({ ...c, id: `${sid}/${c.id}`, start: c.start + start, duration: c.duration < 0 ? c.duration : Math.min(c.duration, resolved.durationSec - c.start) });
    for (const s of resolved.subtitles) if (s.start < resolved.durationSec) plan.subtitles.push({ ...s, start: s.start + start, end: Math.min(s.end, resolved.durationSec) + start });
    plan.scenes.push({ id: sid, name: scene.name, start, duration: resolved.durationSec, frame0: frame, frames, resolvedFile, hash: sha(resolved).slice(0, 16), warnings: resolved.warnings });
    resolvedAll.push(resolved);
    frame += frames;
    progress({ stage: 'compiled', scene: sid, duration: resolved.durationSec, shots: resolved.shots.length, warnings: resolved.warnings.length });
  }
  plan.frames = frame; plan.durationSec = frame / fps;
  // episode-level music / ambience spanning scenes
  for (const [i, m] of ep.episode.music.entries()) {
    const s = m as SoundEvent;
    const at = s.at ?? (s.with ? plan.scenes.find(x => x.id === s.with)?.start : s.after ? (() => { const sc = plan.scenes.find(x => x.id === s.after); return sc ? sc.start + sc.duration : undefined; })() : 0);
    if (at === undefined || at >= plan.durationSec) continue;
    const start = at + (s.offset ?? 0);
    plan.audio.push({ id: `episode/${s.id ?? 'music-' + (i + 1)}`, kind: s.kind, sound: s.sound, start, duration: Math.min(s.durationSec ?? plan.durationSec - start, plan.durationSec - start), gainDb: s.gainDb, fadeIn: s.fadeIn, fadeOut: s.fadeOut, pan: s.pan, duck: true });
  }
  // automatic score
  const sc = ep.episode.score, D = plan.durationSec;
  const cue = (id: string, sound: string, start: number, duration: number, gainDb: number, fadeIn: number, fadeOut: number, feature: boolean) => {
    if (!p.music[sound]) throw new Error(`score: música desconocida ${sound}`);
    const s = Math.max(0, start), d = Math.min(duration, D - s);
    if (d > 0.2) plan.audio.push({ id: `episode/score/${id}`, kind: 'music', sound, start: s, duration: d, gainDb, fadeIn, fadeOut, pan: 0, duck: true, feature });
  };
  if (sc?.theme) cue('theme', sc.theme.music, 0, sc.theme.durationSec, sc.theme.gainDb, 0.05, sc.theme.fadeOut, true);
  const endStart = sc?.ending ? Math.max(0, D - sc.ending.durationSec) : D;
  if (sc?.underscore) { const s0 = sc.theme ? Math.max(0, sc.theme.durationSec - sc.theme.fadeOut) : 0; cue('underscore', sc.underscore.music, s0, endStart + 1 - s0, sc.underscore.gainDb, sc.underscore.fadeIn, sc.underscore.fadeOut, false); }
  if (sc?.bumpers) for (const s of plan.scenes.slice(1)) {
    if (sc.bumpers.scenes && !sc.bumpers.scenes.includes(s.id)) continue;
    cue(`bumper-${s.id}`, sc.bumpers.music, s.start - sc.bumpers.leadSec, sc.bumpers.durationSec ?? p.music[sc.bumpers.music]?.durationSec ?? 3, sc.bumpers.gainDb, 0.02, 0.4, true);
  }
  if (sc?.ending) cue('ending', sc.ending.music, endStart, sc.ending.durationSec, sc.ending.gainDb, 0.8, sc.ending.fadeOut, true);
  plan.audio.sort((a, b) => a.start - b.start);
  await writeFile(join(gen, 'episode-plan.json'), JSON.stringify(plan, null, 1));
  return { plan, project: p, resolved: resolvedAll, lib };
}

function srt(subs: EpisodePlan['subtitles']): string {
  const ts = (s: number) => { const ms = Math.max(0, Math.round(s * 1000)); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  const sorted = [...subs].sort((a, b) => a.start - b.start);
  for (let i = 0; i + 1 < sorted.length; i++) if (sorted[i].end > sorted[i + 1].start) sorted[i].end = Math.max(sorted[i].start + 0.3, sorted[i + 1].start - 0.02);
  // narration (voice-over) is set in italics
  return sorted.map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.voiceOver ? `<i>${s.text.replace(/\n/g, '</i>\n<i>')}</i>` : s.text}\n`).join('\n');
}
function ffmpegSink(out: string, w: number, h: number, fps: number, crf: number, preset: string) {
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-', '-vf', 'vflip,format=yuv420p', '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-g', String(fps * 2), '-bf', '2', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-r', String(fps), out];
  const p = spawn('ffmpeg', args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', d => { err = (err + d).slice(-4000); });
  p.stdin.on('error', () => { /* EPIPE when ffmpeg dies: surfaced through done */ });
  const done = new Promise<void>((ok, fail) => { p.on('error', fail); p.on('close', code => code === 0 ? ok() : fail(new Error(`ffmpeg salió con ${code}: ${err}`))); });
  done.catch(() => {}); // observed via end(); avoids an unhandled rejection when the sink is killed on retry
  return {
    write: (buf: Buffer) => new Promise<void>((ok, fail) => { p.stdin.write(buf, e => (e ? fail(e) : ok())); }),
    end: async () => { p.stdin.end(); await done; },
    kill: async () => { try { p.kill('SIGKILL'); } catch { /* */ } await Promise.race([done.catch(() => {}), new Promise(ok => setTimeout(ok, 5000))]); }
  };
}

export interface RenderResult { output: string; video: string; audio: string; srt: string; metadata: string; storyboard: string[]; plan: EpisodePlan; stats: Record<string, unknown> }
export async function renderEpisode(project: string, episode: string, settings: RenderSettings, progress: Progress = () => {}): Promise<RenderResult> {
  const t0 = Date.now();
  await buildBrowser();
  const { plan, project: p, resolved, lib } = await compileEpisode(project, episode, settings, progress);
  const ep = p.episodes[episode];
  const outDir = join(p.root, ep.dir, 'output');
  const cacheDir = join(p.root, 'generated', 'cache', 'shots');
  await mkdir(outDir, { recursive: true }); await mkdir(cacheDir, { recursive: true }); await rm(join(outDir, 'storyboard'), { recursive: true, force: true });
  // partial chunks left by an interrupted run are discarded (complete chunks are kept and reused)
  for (const f of await readdir(cacheDir)) if (f.includes('.part.')) await rm(join(cacheDir, f), { force: true }).catch(() => {}); await mkdir(join(outDir, 'storyboard'), { recursive: true });
  const { width, height, fps } = settings;
  const crf = settings.crf ?? 18, preset = settings.preset ?? 'medium';
  // ------------------------------------------------ video chunks
  let host: RenderHost | null = null;
  const openHost = async () => { host = await openRenderHost({ width, height, scenes: resolved.map(r => ({ resolved: r })), lib }, { width, height, timeoutMs: 120_000 }); framesOnHost = 0; progress({ stage: 'gpu', renderer: host.info.renderer, webgl2: host.info.webgl2 }); return host; };
  let rendered = 0, reused = 0, renderMs = 0, retries = 0, recycles = 0;
  // Chromium degrades after long runs of large raw-frame transfers: recycle the host every N frames (scaled by resolution)
  const RECYCLE = Math.min(6000, Math.round(720 * (1920 * 1080) / (width * height)));
  let framesOnHost = 0;
  const chunkFiles: string[] = [];
  const memPeak = { rss: 0 };
  try {
    for (const shot of plan.shots) for (const ch of shot.chunks) {
      const file = join(cacheDir, `${ch.hash}.mp4`);
      chunkFiles.push(file);
      if (existsSync(file)) { reused++; progress({ stage: 'shot', shot: shot.id, scene: shot.scene, cached: true, frames: ch.f1 - ch.f0 }); continue; }
      const sceneStartFrame = plan.scenes[shot.sceneIndex].frame0;
      const times: number[] = []; for (let f = ch.f0; f < ch.f1; f++) times.push((f - sceneStartFrame) / fps);
      if (host && framesOnHost + times.length > RECYCLE) { await (host as RenderHost).close().catch(() => {}); host = null; recycles++; progress({ stage: 'recycle', afterFrames: framesOnHost }); }
      for (let attempt = 1; ; attempt++) {
        const tmp = `${file}.${process.pid}.part.mp4`;
        const sink = ffmpegSink(tmp, width, height, fps, crf, preset);
        const tc = Date.now();
        try {
          const h: RenderHost = host ?? await openHost();
          const BATCH = 24;
          for (let i = 0; i < times.length; i += BATCH) {
            const part = times.slice(i, i + BATCH);
            await h.capture(shot.sceneIndex, part, 'raw', async (_i, data) => { if (data.length !== width * height * 4) throw new Error(`frame de tamaño inesperado ${data.length}`); await sink.write(data); });
            memPeak.rss = Math.max(memPeak.rss, process.memoryUsage().rss);
            framesOnHost += part.length;
          }
          await sink.end();
          await rename(tmp, file);
          rendered++; renderMs += Date.now() - tc;
          const mem = rendered % 10 === 1 ? await h.metrics().catch(() => null) : null;
          progress({ stage: 'shot', shot: shot.id, scene: shot.scene, cached: false, frames: times.length, ms: Date.now() - tc, fpsRender: +(times.length / ((Date.now() - tc) / 1000)).toFixed(2), rssMB: Math.round(process.memoryUsage().rss / 1048576), ...(mem ? { browserHeapMB: Math.round((mem.JSHeapUsedSize ?? 0) / 1048576), domNodes: mem.Nodes } : {}) });
          break;
        } catch (e) {
          progress({ stage: 'retry', shot: shot.id, scene: shot.scene, attempt, error: (e as Error).message });
          await sink.kill();
          await rm(tmp, { force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {});
          if (host) { await (host as RenderHost).close().catch(() => {}); host = null; }
          retries++;
          if (attempt >= 3) throw new Error(`Fallo renderizando ${shot.scene}/${shot.id} tras ${attempt} intentos: ${(e as Error).message}`);
        }
      }
    }
    // storyboard: one still per shot (middle frame) through the same Stage => also used for editor/export parity
    const h: RenderHost = host ?? await openHost();
    const story: string[] = [];
    for (const [si] of plan.scenes.entries()) {
      const shots = plan.shots.filter(s => s.sceneIndex === si);
      const times = shots.map(s => ((Math.floor((s.frame0 + s.frame1) / 2)) - plan.scenes[si].frame0) / fps);
      await h.capture(si, times, 'png', async (_i, data, label) => { const f = join(outDir, 'storyboard', `${label}.png`); await writeFile(f, data); story.push(f); }, shots.map(s => `${s.scene}-${s.id}-f${Math.floor((s.frame0 + s.frame1) / 2)}`));
    }
    progress({ stage: 'storyboard', stills: story.length });
    // ------------------------------------------------ concat video
    const list = join(outDir, '.chunks.txt');
    await writeFile(list, chunkFiles.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    const videoOnly = join(outDir, '.video.mp4');
    await runProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', videoOnly], { timeoutMs: 600_000 });
    // ------------------------------------------------ audio master (per scene mix, episode loudness, limiter)
    const mixCtx: MixContext = { sfx: p.sfx, music: p.music, cacheDir: join(p.root, 'generated', 'cache', 'audio') };
    const stems: string[] = []; const powers: number[] = []; const dialoguePowers: number[] = [];
    const dialogueSpans = plan.audio.filter(c => c.kind === 'dialogue').map(c => [c.start, c.start + c.duration] as [number, number]);
    const mixReport: unknown[] = [];
    const audioDir = join(p.root, ep.dir, 'generated', 'audio'); await mkdir(audioDir, { recursive: true });
    for (const sc of plan.scenes) {
      const cues = plan.audio.filter(c => c.start < sc.start + sc.duration && (c.duration < 0 ? c.start + 3 : c.start + c.duration) > sc.start);
      const key = sha({ cues, sc: [sc.start, sc.duration], files: cues.filter(c => c.file).map(c => c.file), v: 5 }).slice(0, 20);
      const stem = join(audioDir, `${sc.id}-${key}.wav`);
      if (!existsSync(stem)) { const { mix, report } = await mixSegment(cues, sc.start, sc.duration, mixCtx); await writeWavAtomic(stem, { sampleRate: SR, channels: [mix.L, mix.R] }, 32); mixReport.push({ scene: sc.id, cues: report }); }
      const a = await readWav(stem);
      const bp = blockPowers({ L: a.channels[0], R: a.channels[1] });
      powers.push(...bp);
      // dialogue-gated blocks (block centre inside a dialogue line) for dialogue-anchored normalisation
      bp.forEach((p, i) => { const c = sc.start + i * 0.1 + 0.2; if (dialogueSpans.some(([a0, a1]) => c >= a0 && c <= a1)) dialoguePowers.push(p); });
      stems.push(stem);
    }
    const before = loudnessFromPowers(powers);
    const target = p.episodes[episode].episode.render.loudnessLufs;
    // Dialogue-anchored loudness (as in broadcast dialogue gating): speech sits at the target even in sparse episodes,
    // the full mix may be quieter but never louder than target + 1 LU.
    const dialogueLufs = dialoguePowers.length > 20 ? loudnessFromPowers(dialoguePowers) : before;
    const gainDb = Math.max(-30, Math.min(24, target - dialogueLufs, target + 1 - before));
    const audioMaster = join(outDir, 'audio-master.wav');
    const totalSamples = Math.round(plan.durationSec * SR);
    const fd = openSync(audioMaster + '.part', 'w');
    const header = Buffer.alloc(44); header.write('RIFF', 0); header.writeUInt32LE(36 + totalSamples * 4, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(totalSamples * 4, 40);
    writeSync(fd, header);
    let written = 0, limited = 0, peakIn = 0;
    for (const stem of stems) {
      const a = await readWav(stem);
      const L = a.channels[0], R = a.channels[1]; const g = dbToGain(gainDb);
      for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
      const lim = limit({ L, R }, -1.0); limited += lim.reduced; peakIn = Math.max(peakIn, lim.peakIn);
      const n = Math.min(L.length, totalSamples - written);
      const buf = Buffer.alloc(n * 4);
      for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), i * 4 + 2); }
      writeSync(fd, buf); written += n;
    }
    if (written < totalSamples) writeSync(fd, Buffer.alloc((totalSamples - written) * 4));
    closeSync(fd); await rename(audioMaster + '.part', audioMaster);
    progress({ stage: 'audio', lufsBefore: +before.toFixed(2), dialogueLufsBefore: +dialogueLufs.toFixed(2), gainDb: +gainDb.toFixed(2), limitedSamples: limited });
    // ------------------------------------------------ subtitles + mux
    const srtFile = join(outDir, 'subtitulos.srt');
    await writeFile(srtFile, srt(plan.subtitles), 'utf8');
    let finalMp4 = join(outDir, 'episodio.mp4');
    await runProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', videoOnly, '-i', audioMaster, '-i', srtFile, '-map', '0:v:0', '-map', '1:a:0', '-map', '2:s:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=spa', '-metadata:s:a:0', 'language=spa', '-metadata', `title=${plan.name}`, '-movflags', '+faststart', finalMp4 + '.part.mp4'], { timeoutMs: 1_200_000 });
    const part = finalMp4 + '.part.mp4';
    try { await renameRetry(part, finalMp4); }
    catch (e) {
      // the previous episodio.mp4 is open in a player (Windows locks it): keep both, never lose the new render
      if (!['EPERM', 'EBUSY', 'EACCES'].includes((e as NodeJS.ErrnoException).code ?? '')) throw e;
      finalMp4 = join(outDir, `episodio-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.mp4`);
      await rename(part, finalMp4);
      progress({ stage: 'warning', message: 'episodio.mp4 está abierto en otro programa; el nuevo vídeo se guardó como ' + finalMp4 });
    }
    await rm(videoOnly, { force: true }); await rm(list, { force: true });
    const stats = { totalMs: Date.now() - t0, chunksRendered: rendered, chunksReused: reused, renderMs, retries, hostRecycles: recycles, framesTotal: plan.frames, peakRssMB: Math.round(memPeak.rss / 1048576), gpu: host ? (host as RenderHost).info.renderer : null, lufsBeforeNorm: before, normGainDb: gainDb, limiterPeakIn: peakIn };
    const metadata = join(outDir, 'metadata.json');
    await writeFile(metadata, JSON.stringify({ schemaVersion: 2, project, episode, name: plan.name, video: finalMp4.split(/[\\/]/).pop(), settings, durationSec: plan.durationSec, frames: plan.frames, scenes: plan.scenes.map(s => ({ id: s.id, name: s.name, start: s.start, duration: s.duration, warnings: s.warnings })), shots: plan.shots.map(s => ({ id: s.id, scene: s.scene, start: s.start, end: s.end, hash: s.hash })), speech: plan.speech, audioCues: plan.audio.length, mix: mixReport, stats, licenses: licenseReport(p, settings.voiceProvider ?? p.episodes[episode]?.episode.voiceProvider), generatedAt: new Date().toISOString() }, null, 2));
    progress({ stage: 'done', output: finalMp4, ...stats });
    return { output: outDir, video: finalMp4, audio: audioMaster, srt: srtFile, metadata, storyboard: story, plan, stats };
  } finally { if (host) await (host as RenderHost).close().catch(() => {}); }
}
export function licenseReport(p: LoadedProject, voiceProvider?: string) {
  return {
    voices: Object.values(p.characters).filter(c => c.voice).map(c => { const v = resolveVoice(c.voice!, voiceProvider ?? (p.meta.voiceProvider as string | undefined)); return { character: c.id, provider: v.provider, voice: v.voice, license: v.license }; }),
    sfx: Object.values(p.sfx).map(s => ({ id: s.id, license: s.license })), music: Object.values(p.music).map(m => ({ id: m.id, license: m.license })),
    visuals: 'Todos los personajes, escenarios y objetos son geometría procedural generada por Series Forge (sin assets externos).'
  };
}
void THREE; void dirname; void stat;
