// Installs Kokoro-82M TTS inside the project (tools/kokoro): a Python venv with pinned packages from PyPI and the
// ONNX model files from the official kokoro-onnx GitHub release, verified by SHA-256. Nothing global is modified.
// Usage: npm run setup:kokoro   (needs Python 3.10+ on PATH or SERIES_FORGE_PYTHON)
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIR = process.env.SERIES_FORGE_KOKORO_DIR ?? join(ROOT, 'tools', 'kokoro');
const VENV = join(DIR, '.venv');
const PY = join(VENV, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const RELEASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0';
const FILES = {
  'kokoro-v1.0.onnx': '7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5',
  'voices-v1.0.bin': 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d'
};
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit' }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} falló`); };
const sha256 = f => new Promise((ok, fail) => { const h = createHash('sha256'); createReadStream(f).on('data', d => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', fail); });

mkdirSync(DIR, { recursive: true });
if (!existsSync(PY)) { console.log('Creando entorno Python local en', VENV); run(process.env.SERIES_FORGE_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3'), ['-m', 'venv', VENV]); }
run(PY, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', join(ROOT, 'scripts', 'kokoro-requirements.txt')]);
for (const [name, hash] of Object.entries(FILES)) {
  const dest = join(DIR, name);
  if (existsSync(dest) && await sha256(dest) === hash) { console.log('OK', name); continue; }
  console.log('Descargando', name);
  const res = await fetch(`${RELEASE}/${name}`);
  if (!res.ok) throw new Error(`Descarga fallida ${name}: HTTP ${res.status}`);
  const tmp = dest + '.part';
  const { writeFile } = await import('node:fs/promises');
  await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
  const got = await sha256(tmp);
  if (got !== hash) { rmSync(tmp); throw new Error(`SHA-256 inesperado para ${name}: ${got}`); }
  renameSync(tmp, dest); console.log('OK', name);
}
console.log('Kokoro listo. Prueba: npm run studio -- voices kokoro');
