/** Per-file version history for project sources (JSON/Markdown). Snapshots are content-addressed and deduplicated:
 *   <project>/generated/history/<rel path>/<ISO timestamp>__<hash12>.<ext>
 * Every editor save and every valid agent write detected by the server is recorded; revert writes the old content back
 * (which itself becomes a new version, so nothing is ever lost). */
import { mkdir, readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { projectDir, safeJoin } from './project.ts';

const h12 = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);
function histDir(project: string, rel: string) { if (rel.includes('..')) throw new Error('Ruta no permitida'); return join(projectDir(project), 'generated', 'history', ...rel.split('/')); }
export async function recordVersion(project: string, rel: string, content: string, source: 'editor' | 'disk' | 'revert'): Promise<string | null> {
  const dir = histDir(project, rel);
  await mkdir(dir, { recursive: true });
  const hash = h12(content);
  const existing = (await readdir(dir)).sort();
  if (existing.length && existing[existing.length - 1].includes(`__${hash}`)) return null; // unchanged since last version
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}__${hash}__${source}${extname(rel)}`;
  const tmp = join(dir, name + '.tmp'); await writeFile(tmp, content); await rename(tmp, join(dir, name));
  return name;
}
export async function listVersions(project: string, rel: string): Promise<{ id: string; at: string; hash: string; source: string }[]> {
  const dir = histDir(project, rel);
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter(f => !f.endsWith('.tmp')).sort().reverse().map(f => { const [at, hash, source] = f.replace(extname(f), '').split('__'); return { id: f, at, hash, source }; });
}
export async function revertTo(project: string, rel: string, id: string): Promise<string> {
  if (!/^[\w.-]+$/.test(id)) throw new Error('Versión inválida');
  const src = join(histDir(project, rel), id);
  if (!existsSync(src)) throw new Error('Versión inexistente');
  const content = await readFile(src, 'utf8');
  const dest = await safeJoin(projectDir(project), rel);
  const tmp = `${dest}.${process.pid}.tmp`; await writeFile(tmp, content); await rename(tmp, dest);
  await recordVersion(project, rel, content, 'revert');
  return content;
}
