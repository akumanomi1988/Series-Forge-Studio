/** Minimal WAV I/O (PCM 16/24/32-bit int and 32-bit float). Pure Node, no dependencies. */
import { readFile, writeFile, rename } from 'node:fs/promises';

export interface Audio { sampleRate: number; channels: Float32Array[] }
export function decodeWav(buf: Buffer): Audio {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('No es un WAV RIFF');
  let pos = 12, fmt: { format: number; channels: number; rate: number; bits: number } | null = null, data: Buffer | null = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4); let size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (size === 0xffffffff || body + size > buf.length) size = buf.length - body;
    if (id === 'fmt ') { let format = buf.readUInt16LE(body); if (format === 0xfffe) format = buf.readUInt16LE(body + 24); fmt = { format, channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) }; }
    else if (id === 'data') data = buf.subarray(body, body + size);
    pos = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('WAV sin fmt/data');
  const bytes = fmt.bits / 8, frames = Math.floor(data.length / (bytes * fmt.channels));
  const channels = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < fmt.channels; c++) {
    const o = (i * fmt.channels + c) * bytes;
    let v: number;
    if (fmt.format === 3) v = bytes === 4 ? data.readFloatLE(o) : data.readDoubleLE(o);
    else if (fmt.bits === 16) v = data.readInt16LE(o) / 32768;
    else if (fmt.bits === 24) v = data.readIntLE(o, 3) / 8388608;
    else if (fmt.bits === 32) v = data.readInt32LE(o) / 2147483648;
    else if (fmt.bits === 8) v = (data.readUInt8(o) - 128) / 128;
    else throw new Error('Profundidad WAV no soportada: ' + fmt.bits);
    channels[c][i] = v;
  }
  return { sampleRate: fmt.rate, channels };
}
export function encodeWav(a: Audio, bits: 16 | 24 | 32 = 24): Buffer {
  const ch = a.channels.length, frames = a.channels[0]?.length ?? 0, bytes = bits / 8;
  const float = bits === 32;
  const buf = Buffer.alloc(44 + frames * ch * bytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * ch * bytes, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(float ? 3 : 1, 20); buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(a.sampleRate, 24);
  buf.writeUInt32LE(a.sampleRate * ch * bytes, 28); buf.writeUInt16LE(ch * bytes, 32); buf.writeUInt16LE(bits, 34); buf.write('data', 36); buf.writeUInt32LE(frames * ch * bytes, 40);
  let o = 44;
  for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, a.channels[c][i]));
    if (float) buf.writeFloatLE(a.channels[c][i], o);
    else if (bits === 16) buf.writeInt16LE(Math.round(v * 32767), o);
    else buf.writeIntLE(Math.round(v * 8388607), o, 3);
    o += bytes;
  }
  return buf;
}
export async function readWav(path: string): Promise<Audio> { return decodeWav(await readFile(path)); }
export async function writeWavAtomic(path: string, a: Audio, bits: 16 | 24 | 32 = 24): Promise<void> { const tmp = `${path}.${process.pid}.tmp`; await writeFile(tmp, encodeWav(a, bits)); await rename(tmp, path); }
export function mono(a: Audio): Float32Array { if (a.channels.length === 1) return a.channels[0]; const out = new Float32Array(a.channels[0].length); for (const c of a.channels) for (let i = 0; i < out.length; i++) out[i] += c[i] / a.channels.length; return out; }
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export function rms(x: Float32Array, start = 0, end = x.length): number { let s = 0; for (let i = start; i < end; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, end - start)); }
export function peak(x: Float32Array): number { let p = 0; for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i])); return p; }
