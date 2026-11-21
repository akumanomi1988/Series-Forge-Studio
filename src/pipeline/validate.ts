/** Automated audiovisual QA of an exported episode. Produces output/validation-report.json.
 * Checks: container/codecs/resolution/fps/durations (ffprobe), black frames outside declared fades (blackdetect),
 * audio presence and loudness (ebur128 + volumedetect), dialogue placement in the master, per-line lip-sync lag,
 * subtitles, and editor-vs-export parity (Stage still vs decoded MP4 frame, PSNR). */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadProject } from './project.ts';
import { ffprobe, extractFrames } from './media.ts';
import { runProcess } from '../audio/tts.ts';
import { readWav, mono } from '../audio/wav.ts';
import { blockPowers, loudnessFromPowers } from '../audio/mixer.ts';
import { activityCurves, curvesLag, boundarySync } from '../audio/align.ts';
import { visemeAt } from '../engine/face.ts';
import type { EpisodePlan } from './episode.ts';

export interface Check { id: string; ok: boolean; detail: unknown; severity?: 'error' | 'warning' }
async function ffmpegLog(args: string[]): Promise<string> { try { const { stderr } = await runProcess('ffmpeg', ['-nostdin', '-hide_banner', ...args, '-f', 'null', '-'], { timeoutMs: 1_800_000 }); return stderr; } catch (e) { return String((e as Error).message); } }
function psnr(a: Buffer, b: Buffer): number { let mse = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) { const d = a[i] - b[i]; mse += d * d; } mse /= n; return mse === 0 ? 99 : 10 * Math.log10(255 * 255 / mse); }
async function rawGray(png: string, w: number, h: number): Promise<Buffer> {
  const { stdoutBuf } = await runProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', png, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { timeoutMs: 60_000 });
  return stdoutBuf;
}

/** Silences between dialogue lines (whole episode, across scene cuts). A gap longer than `maxGapSec` is "dead air":
 * characters standing and staring. Intentional silent beats are fine but should be rare and short. */
export function pacingReport(plan: Pick<EpisodePlan, 'audio' | 'durationSec' | 'scenes'>, maxGapSec = 2.5): { maxGapSec: number; longestGapSec: number; meanGapSec: number; deadAir: { from: number; to: number; gapSec: number; scene: string }[]; dialogueShare: number } {
  const lines = plan.audio.filter(c => c.kind === 'dialogue').map(c => [c.start, c.start + c.duration] as const).sort((a, b) => a[0] - b[0]);
  const gaps: { from: number; to: number; gapSec: number; scene: string }[] = [];
  let cursor = 0, spoken = 0;
  const sceneAt = (t: number) => plan.scenes.find(s => t >= s.start && t < s.start + s.duration)?.id ?? '';
  for (const [a, b] of lines) { if (a > cursor) gaps.push({ from: +cursor.toFixed(2), to: +a.toFixed(2), gapSec: +(a - cursor).toFixed(2), scene: sceneAt(cursor) }); spoken += Math.max(0, b - Math.max(a, cursor)); cursor = Math.max(cursor, b); }
  if (plan.durationSec > cursor) gaps.push({ from: +cursor.toFixed(2), to: +plan.durationSec.toFixed(2), gapSec: +(plan.durationSec - cursor).toFixed(2), scene: 'final' });
  const inner = gaps.filter(g => g.from > 0 && g.scene !== 'final');
  const musical = (g: { from: number; to: number }) => plan.audio.some(c => c.kind === 'music' && (c.feature || (!c.duck && c.gainDb >= -18)) && Math.min(c.start + c.duration, g.to) - Math.max(c.start, g.from) >= 0.6 * (g.to - g.from));
  return {
    maxGapSec,
    longestGapSec: Math.max(0, ...inner.map(g => g.gapSec)),
    meanGapSec: inner.length ? +(inner.reduce((s, g) => s + g.gapSec, 0) / inner.length).toFixed(2) : 0,
    // a gap filled by a foreground musical moment (theme, scene bumper, sting) is a beat, not dead air (up to 6 s)
    deadAir: gaps.filter(g => g.gapSec > (g.scene === 'final' ? maxGapSec + 1.5 : musical(g) ? Math.max(maxGapSec, 6) : maxGapSec)),
    dialogueShare: +(spoken / Math.max(1e-6, plan.durationSec)).toFixed(2)
  };
}

/** Pairs of dialogue lines whose audio overlaps by more than 50 ms (two voices at once). */
export function dialogueOverlaps(plan: Pick<EpisodePlan, 'audio'>): { a: string; b: string; overlapMs: number }[] {
  const d = plan.audio.filter(c => c.kind === 'dialogue').sort((x, y) => x.start - y.start), out: { a: string; b: string; overlapMs: number }[] = [];
  for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length && d[j].start < d[i].start + d[i].duration; j++) {
    const ov = d[i].start + d[i].duration - d[j].start;
    if (ov > 0.05) out.push({ a: d[i].id, b: d[j].id, overlapMs: Math.round(ov * 1000) });
  }
  return out;
}

export async function validateEpisode(project: string, episode: string): Promise<{ ok: boolean; checks: Check[]; report: string }> {
  const p = await loadProject(project);
  const ep = p.episodes[episode];
  const out = join(p.root, ep.dir, 'output');
  const plan = JSON.parse(await readFile(join(p.root, ep.dir, 'generated', 'episode-plan.json'), 'utf8')) as EpisodePlan;
  const meta = existsSync(join(out, 'metadata.json')) ? JSON.parse(await readFile(join(out, 'metadata.json'), 'utf8')) as { video?: string } : {};
  const video = join(out, meta.video && /^episodio[\w-]*\.mp4$/.test(meta.video) ? meta.video : 'episodio.mp4'), master = join(out, 'audio-master.wav'), srtFile = join(out, 'subtitulos.srt');
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: unknown, severity: 'error' | 'warning' = 'error') => checks.push({ id, ok, detail, severity });
  for (const f of [video, master, srtFile, join(out, 'metadata.json')]) add(`exists:${f.split(/[\\/]/).pop()}`, existsSync(f), f);
  if (!existsSync(video)) return finish();
  // ---------------------------------------------------------------- container
  const pr = await ffprobe(video);
  const v = pr.streams.find(s => s.codec_type === 'video'), a = pr.streams.find(s => s.codec_type === 'audio'), s = pr.streams.find(s => s.codec_type === 'subtitle');
  const { width, height, fps } = plan.settings;
  add('video.codec', v?.codec_name === 'h264', v?.codec_name);
  add('video.resolution', v?.width === width && v?.height === height, `${v?.width}x${v?.height}`);
  const [fn, fd] = (v?.avg_frame_rate ?? '0/1').split('/').map(Number);
  add('video.fps', Math.abs(fn / fd - fps) < 0.01, fn / fd);
  add('video.frames', Number(v?.nb_frames) === plan.frames, { frames: Number(v?.nb_frames), expected: plan.frames });
  const vDur = Number(v?.duration ?? pr.format.duration);
  add('video.duration', Math.abs(vDur - plan.durationSec) <= 1 / fps + 1e-3, { duration: vDur, expected: plan.durationSec });
  add('audio.codec', a?.codec_name === 'aac' && Number(a?.sample_rate) === 48000, { codec: a?.codec_name, sampleRate: a?.sample_rate, channels: a?.channels });
  const aDur = Number(a?.duration ?? 0);
  add('audio.duration', Math.abs(aDur - plan.durationSec) < 0.06, { audio: aDur, video: vDur });
  add('subtitles.stream', s?.codec_name === 'mov_text', s?.codec_name ?? null);
  // ---------------------------------------------------------------- black frames outside declared fades
  const blackLog = await ffmpegLog(['-i', video, '-vf', 'blackdetect=d=0.25:pix_th=0.06:pic_th=0.98', '-an']);
  const blacks = [...blackLog.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map(m => ({ start: Number(m[1]), end: Number(m[2]) }));
  const fades: { start: number; end: number }[] = [];
  for (const sc of plan.scenes) { fades.push({ start: sc.start - 0.05, end: sc.start + 1.3 }); fades.push({ start: sc.start + sc.duration - 2, end: sc.start + sc.duration + 0.05 }); }
  const unexpected = blacks.filter(b => !fades.some(f => b.start >= f.start && b.end <= f.end));
  add('video.noUnexpectedBlack', unexpected.length === 0, { blacks, unexpected });
  // frozen/flat frames: sample one frame per shot from the MP4 and require visual detail
  const tmp = join(p.root, ep.dir, 'generated', 'qa'); await mkdir(tmp, { recursive: true });
  const shotTimes = plan.shots.map(sh => Math.max(0, Math.floor((sh.frame0 + sh.frame1) / 2) - 0.3) / fps);
  const decoded = await extractFrames(video, shotTimes, i => join(tmp, `mp4-${plan.shots[i].scene}-${plan.shots[i].id}.png`));
  const flat: string[] = [];
  const parity: { shot: string; psnr: number }[] = [];
  for (let i = 0; i < decoded.length; i++) {
    const g = await rawGray(decoded[i], 160, 90);
    let mu = 0; for (const x of g) mu += x; mu /= g.length; let sd = 0; for (const x of g) sd += (x - mu) ** 2; sd = Math.sqrt(sd / g.length);
    if (sd < 8) flat.push(plan.shots[i].id);
    const sh = plan.shots[i];
    const still = join(out, 'storyboard', `${sh.scene}-${sh.id}-f${Math.floor((sh.frame0 + sh.frame1) / 2)}.png`);
    if (existsSync(still)) parity.push({ shot: `${sh.scene}/${sh.id}`, psnr: +psnr(g, await rawGray(still, 160, 90)).toFixed(2) });
  }
  add('video.shotsHaveDetail', flat.length === 0, { flat });
  add('render.editorExportParity', parity.length > 0 && parity.every(x => x.psnr > 28), { minPsnr: Math.min(...parity.map(x => x.psnr)), shots: parity });
  // ---------------------------------------------------------------- audio
  const vol = await ffmpegLog(['-i', video, '-vn', '-af', 'volumedetect']);
  const maxVol = Number(/max_volume: ([-\d.]+) dB/.exec(vol)?.[1] ?? -99), meanVol = Number(/mean_volume: ([-\d.]+) dB/.exec(vol)?.[1] ?? -99);
  add('audio.notSilent', maxVol > -20 && meanVol > -45, { maxVol, meanVol });
  const r128 = await ffmpegLog(['-i', video, '-vn', '-af', 'ebur128=peak=true']);
  const I = Number(/I:\s+([-\d.]+) LUFS/.exec(r128.slice(r128.lastIndexOf('Summary')))?.[1] ?? NaN), TP = Number(/Peak:\s+([-\d.]+) dBFS/.exec(r128.slice(r128.lastIndexOf('Summary')))?.[1] ?? NaN);
  const target = ep.episode.render.loudnessLufs;
  // dialogue-gated loudness of the master (speech regions only) must match the target; the full mix may be lower
  const mst = await readWav(master);
  const bpw = blockPowers({ L: mst.channels[0], R: mst.channels[1] ?? mst.channels[0] });
  const spans = plan.audio.filter(c => c.kind === 'dialogue').map(c => [c.start, c.start + c.duration]);
  const dlg = bpw.filter((_, i) => { const c = i * 0.1 + 0.2; return spans.some(([a0, a1]) => c >= a0 && c <= a1); });
  const dialogueLufs = dlg.length > 20 ? loudnessFromPowers(dlg) : I;
  add('audio.loudness', Math.abs(dialogueLufs - target) <= 1.5 && I <= target + 1.5, { integratedLufs: I, dialogueGatedLufs: +dialogueLufs.toFixed(1), target });
  add('audio.truePeak', TP <= -0.5, { truePeakDbfs: TP });
  // dialogue presence & placement in the master: each line's source must correlate with the master at its timeline position
  const mm = mono(mst);
  const lines = plan.audio.filter(c => c.kind === 'dialogue' && c.file);
  const placement: { line: string; expected: number; measuredOffsetMs: number; corr: number; rmsDb: number }[] = [];
  const lags: { line: string; lagMs: number; corr: number; worstOnsetMs: number; worstOffsetMs: number; unmatched: number }[] = [];
  const allAct: number[] = [], allMouth: number[] = [];
  let silenceSec = 0, openSec = 0;
  // perceptual tolerance per boundary (ITU-R BT.1359 detectability: sound early 45 ms / late 125 ms) + one 24 fps frame
  const LATE = 0.045 + 1 / 24, EARLY = 0.125 + 1 / 24;
  const okErr = (e: number) => e <= LATE && e >= -EARLY;
  for (const c of lines) {
    const src = mono(await readWav(c.file!));
    const s0 = Math.round(c.start * 48000);
    // waveform cross-correlation (decimated to 8 kHz) of the source line against the master, lags within +-50 ms
    const dec = (x: Float32Array, from: number, len: number) => { const out = new Float32Array(Math.max(0, Math.floor(len / 6))); for (let i = 0; i < out.length; i++) { let s = 0; for (let k = 0; k < 6; k++) { const j = from + i * 6 + k; s += j >= 0 && j < x.length ? x[j] : 0; } out[i] = s / 6; } return out; };
    const srcD = dec(src, 0, src.length), L = 400;
    const masterD = dec(mm, s0 - L * 6, src.length + 2 * L * 6);
    let best = -Infinity, lag = 0;
    let sbb = 0; for (const x of srcD) sbb += x * x;
    for (let k = 0; k <= 2 * L; k++) { let sab = 0, saa = 0; for (let i = 0; i < srcD.length; i++) { const y = masterD[i + k] ?? 0; sab += y * srcD[i]; saa += y * y; } const r = sab / Math.sqrt(saa * sbb + 1e-12); if (r > best) { best = r; lag = k - L; } }
    let e = 0; for (let i = Math.max(0, s0); i < Math.min(mm.length, s0 + src.length); i++) e += mm[i] * mm[i];
    placement.push({ line: c.id, expected: +c.start.toFixed(3), measuredOffsetMs: +(lag / 8).toFixed(2), corr: +best.toFixed(3), rmsDb: +(10 * Math.log10(e / Math.max(1, src.length) + 1e-12)).toFixed(1) });
    // lip-sync: mouth curve (visemes used by the renderer) vs the line audio
    const sid = c.id.split('/')[0];
    const scene = JSON.parse(await readFile(plan.scenes.find(x => x.id === sid)!.resolvedFile, 'utf8'));
    const sp = scene.actors.flatMap((x: { speech: { lineId: string; start: number; visemes: [number, string][] }[] }) => x.speech).find((x: { lineId: string }) => `${sid}/${x.lineId}` === c.id);
    if (sp) {
      const open = (t: number) => visemeAt(sp.visemes, t).open;
      const cur = activityCurves(src, 48000, open), r = curvesLag(cur.act, cur.mouth);
      // a flat correlation curve (short line, one pause) cannot tell lags apart: reported, but not judged per line
      const bs = boundarySync(src, 48000, open);
      const on = bs.boundaries.filter(b => b.kind === 'onset' && b.errSec !== null), off = bs.boundaries.filter(b => b.kind === 'offset' && b.errSec !== null);
      const worst = (l: typeof on) => l.reduce((w, b) => okErr(b.errSec!) && !okErr(w) ? w : (!okErr(b.errSec!) && okErr(w)) || Math.abs(b.errSec!) > Math.abs(w) ? b.errSec! : w, 0);
      lags.push({ line: c.id, lagMs: Math.round(r.lagSec * 1000), corr: +r.correlation.toFixed(2), worstOnsetMs: Math.round(worst(on) * 1000), worstOffsetMs: Math.round(worst(off) * 1000), unmatched: bs.boundaries.filter(b => b.errSec === null).length });
      silenceSec += bs.silenceSec; openSec += bs.mouthInSilence * bs.silenceSec;
      allAct.push(...cur.act, ...new Array(50).fill(0)); allMouth.push(...cur.mouth, ...new Array(50).fill(0));
    }
  }
  add('audio.dialoguePlacement', placement.every(x => Math.abs(x.measuredOffsetMs) <= 2 && x.corr > 0.3 && x.rmsDb > -45), placement);
  // global lag over every line of the episode (many onsets: well conditioned) + every line whose lag is measurable
  const global = curvesLag(Float32Array.from(allAct), Float32Array.from(allMouth));
  // global lag over every line (many onsets: well conditioned) + every speech onset/offset within perceptual tolerance.
  // Per-line correlation lags are informative only: on short lines the correlation curve is flat.
  // onsets (mouth opening for a sound) are what viewers judge; offsets (closing during a decaying vowel) are looser
  const bad = lags.filter(x => !okErr(x.worstOnsetMs / 1000));
  const loose = lags.filter(x => Math.abs(x.worstOffsetMs) > 250);
  add('lipsync.lag', lags.length > 0 && Math.abs(global.lagSec) <= 0.04 && bad.length === 0, { globalLagMs: Math.round(global.lagSec * 1000), globalCorr: +global.correlation.toFixed(2), toleranceMs: { mouthLate: Math.round(LATE * 1000), mouthEarly: Math.round(EARLY * 1000) }, outOfTolerance: bad.map(x => x.line), lines: lags });
  add('lipsync.offsets', loose.length === 0, { maxAbsOffsetMs: Math.max(0, ...lags.map(x => Math.abs(x.worstOffsetMs))), over250ms: loose.map(x => x.line) }, 'warning');
  add('lipsync.mouthInSilence', openSec <= 0.1 * silenceSec, { fraction: +(openSec / Math.max(1e-6, silenceSec)).toFixed(3), silenceSec: +silenceSec.toFixed(1) }, 'warning');
  add('lipsync.correlation', lags.every(x => x.corr > 0.35), { minCorr: Math.min(1, ...lags.map(x => x.corr)) }, 'warning');
  // ---------------------------------------------------------------- subtitles
  const srt = await readFile(srtFile, 'utf8');
  const cues = [...srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)].map(mt => { const t = (h: string, mi: string, se: string, ms: string) => +h * 3600 + +mi * 60 + +se + +ms / 1000; return [t(mt[1], mt[2], mt[3], mt[4]), t(mt[5], mt[6], mt[7], mt[8])]; });
  const mono_ = cues.every((c, i) => c[1] > c[0] && (i === 0 || c[0] >= cues[i - 1][1] - 1e-3));
  add('subtitles.valid', cues.length > 0 && mono_ && cues[cues.length - 1][1] <= plan.durationSec + 0.01, { cues: cues.length, monotonic: mono_ });
  add('subtitles.coverDialogue', lines.every(l => cues.some(c => c[0] <= l.start + 0.2 && c[1] >= l.start)), { lines: lines.length });
  // ---------------------------------------------------------------- pacing (dead air)
  const pace = pacingReport(plan);
  add('pacing.deadAir', pace.deadAir.length === 0, pace, 'warning');
  const overlaps = dialogueOverlaps(plan);
  add('dialogue.noOverlap', overlaps.length === 0, { overlaps: overlaps.slice(0, 20) });
  const rac = plan.scenes.flatMap(s => s.warnings.filter(w => w.startsWith('racord')).map(w => `${s.id}: ${w}`));
  add('continuity.racord', rac.length === 0, { errors: rac });
  const col = plan.scenes.flatMap(s => s.warnings.filter(w => w.startsWith('colision')).map(w => `${s.id}: ${w}`));
  add('blocking.noCollisions', col.length === 0, { errors: col });
  return finish();
  async function finish() {
    const ok = checks.filter(c => c.severity !== 'warning').every(c => c.ok);
    const report = join(out, 'validation-report.json');
    await mkdir(out, { recursive: true });
    await writeFile(report, JSON.stringify({ schemaVersion: 1, project, episode, ok, generatedAt: new Date().toISOString(), checks }, null, 2));
    return { ok, checks, report };
  }
}
if (import.meta.main) { const r = await validateEpisode(process.argv[2], process.argv[3]); for (const c of r.checks) console.log(`${c.ok ? 'OK  ' : c.severity === 'warning' ? 'WARN' : 'FAIL'} ${c.id} ${JSON.stringify(c.detail).slice(0, 220)}`); console.log(r.ok ? 'VALIDACIÓN SUPERADA' : 'VALIDACIÓN FALLIDA', r.report); }
