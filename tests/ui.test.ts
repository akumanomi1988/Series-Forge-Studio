/** End-to-end: the web editor (real Chromium) shows agent-made file changes live via SSE, keeps the last valid
 * state on invalid writes, and editor saves land in the same files with conflict detection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { tempWorkspace, hasBrowser } from './helpers.ts';

const ws = tempWorkspace();
const { startServer } = await import('../src/server/studio-server.ts');
const { openPage } = await import('../src/pipeline/chrome.ts');

test('la web refleja automáticamente los cambios de un agente y conserva el último estado válido', { timeout: 180_000 }, async t => {
  if (!hasBrowser()) { t.skip('requiere Chrome/Edge'); return; }
  const port = 4600 + Math.floor(Math.random() * 300);
  const server = await startServer(port);
  const page = await openPage(`http://127.0.0.1:${port}/`, 1400, 860);
  const until = async (expr: string, ms = 20_000) => { const t0 = Date.now(); for (;;) { const v = await page.eval<unknown>(expr).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout: ' + expr); await delay(250); } };
  try {
    await delay(1200);
    await page.eval(`localStorage.setItem('sf.project','el-ultimo-turno'); localStorage.setItem('sf.sel', JSON.stringify({kind:'character',id:'lara'})); location.reload(); 1`);
    await until(`window.__SF_STAGE__?.evaluator?.lib.characters.lara.geometry.hair.style === 'ponytail'`);
    // 1) an external agent edits Lara's geometry on disk
    const geoPath = join(ws, 'el-ultimo-turno/characters/lara/geometry.json');
    const geo = JSON.parse(readFileSync(geoPath, 'utf8'));
    geo.hair.style = 'bob'; geo.outfit.top.color = '#2266cc';
    writeFileSync(geoPath, JSON.stringify(geo, null, 2));
    await until(`window.__SF_STAGE__?.evaluator?.lib.characters.lara.geometry.hair.style === 'bob'`);
    assert.equal(await page.eval(`window.__SF_STAGE__.evaluator.lib.characters.lara.geometry.outfit.top.color`), '#2266cc');
    // 2) an incomplete/invalid write: the viewport keeps the last valid character and the UI reports it
    writeFileSync(geoPath, '{ "schemaVersion": 2, "hair": { "style": "flequillo-imposible" ');
    await until(`[...document.querySelectorAll('.toasts div')].some(d => d.textContent.includes('geometry.json'))`);
    assert.equal(await page.eval(`window.__SF_STAGE__.evaluator.lib.characters.lara.geometry.hair.style`), 'bob');
    writeFileSync(geoPath, JSON.stringify(geo, null, 2));
    // 3) a new character written by an agent appears in the explorer without reloading
    const { scaffold } = await import('../src/pipeline/scaffold.ts');
    await scaffold('character', ['el-ultimo-turno', 'zoe', 'Zoe Agente'], 'bruno');
    await until(`[...document.querySelectorAll('.explorer a')].some(a => a.textContent.includes('Zoe Agente'))`);
    // 4) editor save goes to the same file; stale hash => 409 conflict
    const r = await page.eval<{ ok: number; conflict: number }>(`(async () => {
      const f = await (await fetch('/api/project/el-ultimo-turno/file?path=characters/zoe/aspecto.md')).json();
      const ok = (await fetch('/api/project/el-ultimo-turno/file', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: f.path, content: '# Zoe editada en la web\\n', expectedHash: f.hash }) })).status;
      const conflict = (await fetch('/api/project/el-ultimo-turno/file', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: f.path, content: '# pisada\\n', expectedHash: f.hash }) })).status;
      return { ok, conflict }; })()`);
    assert.deepEqual(r, { ok: 200, conflict: 409 });
    assert.equal(readFileSync(join(ws, 'el-ultimo-turno/characters/zoe/aspecto.md'), 'utf8'), '# Zoe editada en la web\n');
    assert.deepEqual(page.consoleErrors, []);
  } finally { await page.close(); await new Promise(ok => server.close(() => ok(null))); server.closeAllConnections?.(); }
});
