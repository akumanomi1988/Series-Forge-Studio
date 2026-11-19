/** FFmpeg/FFprobe helpers: contact sheets, frame extraction, probing. Child processes with argument arrays only. */
import { runProcess } from '../audio/tts.ts';

export async function contactSheet(files: string[], out: string, cols = 4, tileW = 480): Promise<string> {
  if (!files.length) throw new Error('Sin imágenes');
  const tileH = Math.round(tileW * 9 / 16);
  const rows = Math.ceil(files.length / cols);
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y'];
  for (const f of files) args.push('-i', f);
  let filter = files.map((_, i) => `[${i}:v]scale=${tileW}:${tileH},drawtext=text='${i + 1}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5[v${i}];`).join('');
  if (files.length === 1) filter += `[v0]null[out]`;
  else filter += files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:fill=black:layout=` + files.map((_, i) => `${(i % cols) * tileW}_${Math.floor(i / cols) * tileH}`).join('|') + '[out]';
  args.push('-filter_complex', filter, '-map', '[out]', '-frames:v', '1', out);
  try { await runProcess('ffmpeg', args, { timeoutMs: 120_000 }); }
  catch { // drawtext may be unavailable: retry without labels
    const plain = files.map((_, i) => `[${i}:v]scale=${tileW}:${tileH}[v${i}];`).join('') + (files.length === 1 ? '[v0]null[out]' : files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:fill=black:layout=` + files.map((_, i) => `${(i % cols) * tileW}_${Math.floor(i / cols) * tileH}`).join('|') + '[out]');
    args.splice(args.indexOf('-filter_complex') + 1, 1, plain);
    await runProcess('ffmpeg', args, { timeoutMs: 120_000 });
  }
  void rows;
  return out;
}
export async function extractFrames(video: string, times: number[], outPattern: (i: number) => string, width?: number): Promise<string[]> {
  const files: string[] = [];
  for (let i = 0; i < times.length; i++) {
    const f = outPattern(i);
    await runProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-ss', times[i].toFixed(4), '-i', video, '-frames:v', '1', ...(width ? ['-vf', `scale=${width}:-2`] : []), f], { timeoutMs: 60_000 });
    files.push(f);
  }
  return files;
}
export interface Probe { format: { duration: string; size: string; bit_rate?: string }; streams: { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string; avg_frame_rate?: string; nb_frames?: string; duration?: string; sample_rate?: string; channels?: number; tags?: Record<string, string> }[] }
export async function ffprobe(file: string): Promise<Probe> {
  const { stdout } = await runProcess('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-count_frames', '-of', 'json', file], { timeoutMs: 600_000 });
  return JSON.parse(stdout);
}
