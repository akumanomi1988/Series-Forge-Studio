/** Bundles browser code (shared TS engine + renderer + editor UI) with esbuild into public/build/. */
import { build } from 'esbuild';
import { join } from 'node:path';
const root = join(import.meta.dirname, '..');
export async function buildBrowser(minify = false) {
  await build({
    entryPoints: { capture: join(root, 'src/render/entry-capture.ts'), studio: join(root, 'ui/main.tsx') },
    outdir: join(root, 'public/build'), bundle: true, format: 'esm', target: 'es2022', sourcemap: true, minify, logLevel: 'warning',
    jsx: 'automatic', define: { 'process.env.NODE_ENV': minify ? '"production"' : '"development"' }, loader: { '.css': 'css' }
  });
}
if (import.meta.main) { const t = Date.now(); await buildBrowser(process.argv.includes('--minify')); console.log(`build ok (${Date.now() - t} ms)`); }
