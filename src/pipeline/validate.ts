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
import { lipSyncLag, features } from '../audio/align.ts';
import { visemeAt } from '../engine/face.ts';
import type { EpisodePlan } from './episode.ts';

export interface Check { id: string; ok: boolean; detail: unknown; severity?: 'error' | 'warning' }
async function ffmpegLog(args: string[]): Promise<string> { try { const { stderr } = await runProcess('ffmpeg', ['-nostdin', '-hide_banner', ...args, '-f', 'null', '-'], { timeoutMs: 1_800_000 }); return stderr; } catch (e) { return String((e as Error).message); } }
function psnr(a: Buffer, b: Buffer): number { let mse = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) { const d = a[i] - b[i]; mse += d * d; } mse /= n; return mse === 0 ? 99 : 10 * Math.log10(255 * 255 / mse); }
async function rawGray(png: string, w: number, h: number): Promise<Buffer> {
  const { stdoutBuf } = await runProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', png, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { timeoutMs: 60_000 });
  return stdoutBuf;
}

export async function validateEpisode(project: string, episode: string): Promise<{ ok: boolean; checks: Check[]; report: string }> {
  const p = await loadProject(project);
  const ep = p.episodes[episode];
  const out = join(p.root, ep.dir, 'output');
  const plan = JSON.parse(await readFile(join(p.root, ep.dir, 'generated', 'episode-plan.json'), 'utf8')) as EpisodePlan;
  const video = join(out, 'episodio.mp4'), master = join(out, 'audio-master.wav'), srtFile = join(out, 'subtitulos.srt');
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
  add('audio.loudness', Math.abs(I - target) <= 1.5, { integratedLufs: I, target });
  add('audio.truePeak', TP <= -0.5, { truePeakDbfs: TP });
  // dialogue presence & placement in the master: each line's source must correlate with the master at its timeline position
  const m = await readWav(master); const mm = mono(m);
  const lines = plan.audio.filter(c => c.kind === 'dialogue' && c.file);
  const placement: { line: string; expected: number; measuredOffsetMs: number; corr: number; rmsDb: number }[] = [];
  const lags: { line: string; lagMs: number; corr: number }[] = [];
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
    if (sp) { const r = lipSyncLag(src, 48000, t => visemeAt(sp.visemes, t).open); lags.push({ line: c.id, lagMs: Math.round(r.lagSec * 1000), corr: +r.correlation.toFixed(2) }); }
  }
  add('audio.dialoguePlacement', placement.every(x => Math.abs(x.measuredOffsetMs) <= 2 && x.corr > 0.3 && x.rmsDb > -45), placement);
  add('lipsync.lag', lags.length > 0 && lags.every(x => Math.abs(x.lagMs) <= 60), { maxAbsLagMs: Math.max(0, ...lags.map(x => Math.abs(x.lagMs))), lines: lags });
  add('lipsync.correlation', lags.every(x => x.corr > 0.35), { minCorr: Math.min(1, ...lags.map(x => x.corr)) }, 'warning');
  // ---------------------------------------------------------------- subtitles
  const srt = await readFile(srtFile, 'utf8');
  const cues = [...srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)].map(mt => { const t = (h: string, mi: string, se: string, ms: string) => +h * 3600 + +mi * 60 + +se + +ms / 1000; return [t(mt[1], mt[2], mt[3], mt[4]), t(mt[5], mt[6], mt[7], mt[8])]; });
  const mono_ = cues.every((c, i) => c[1] > c[0] && (i === 0 || c[0] >= cues[i - 1][1] - 1e-3));
  add('subtitles.valid', cues.length > 0 && mono_ && cues[cues.length - 1][1] <= plan.durationSec + 0.01, { cues: cues.length, monotonic: mono_ });
  add('subtitles.coverDialogue', lines.every(l => cues.some(c => c[0] <= l.start + 0.2 && c[1] >= l.start)), { lines: lines.length });
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
