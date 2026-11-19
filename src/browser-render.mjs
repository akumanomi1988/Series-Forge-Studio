/** Deterministic Chromium/Three.js frame capture without Playwright or cloud services.
 * Uses the same public/viewport.js as the studio, with a restricted local read-only server.
 * The source workspace is never modified by this renderer.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, readdir, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TOKEN = () => randomBytes(24).toString('hex');
const allowed = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const fixedFiles = new Map([
  ['/render.html', ['public/render.html', 'text/html; charset=utf-8']],
  ['/render.js', ['public/render.js', 'text/javascript; charset=utf-8']],
  ['/viewport.js', ['public/viewport.js', 'text/javascript; charset=utf-8']],
  ['/scene-runtime.js', ['public/scene-runtime.js', 'text/javascript; charset=utf-8']],
  ['/vendor/three.module.js', ['node_modules/three/build/three.module.js', 'text/javascript; charset=utf-8']],
  ['/vendor/three.core.js', ['node_modules/three/build/three.core.js', 'text/javascript; charset=utf-8']]
]);
function executable(name) {
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    const file = join(dir, name);
    if (existsSync(file)) return file;
  }
  return null;
}
export function findChromium() {
  const explicit = process.env.SERIES_FORGE_CHROMIUM;
  if (explicit) {
    if (!existsSync(explicit)) throw new Error('SERIES_FORGE_CHROMIUM no señala a un ejecutable existente');
    return explicit;
  }
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const windows = roots.flatMap(root => [join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'), join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]);
  const candidates = [...windows, ...['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'msedge', 'chrome.exe'].map(executable)].filter(Boolean);
  const found = candidates.find(existsSync);
  if (!found) throw new Error('No se ha encontrado Chromium, Chrome ni Edge. Configura SERIES_FORGE_CHROMIUM con la ruta del navegador.');
  return found;
}

async function readBundle(ws, project, kind, id) {
  if (!['characters', 'props', 'environments'].includes(kind) || !allowed.test(id)) throw new Error('Asset inválido');
  const base = `${kind}/${id}/`;
  const names = kind === 'characters'
    ? ['manifest.json', 'rig.json', 'geometry.json', 'animations/idle.json', 'expressions/neutral.json']
    : kind === 'environments' ? ['manifest.json', 'environment.json'] : ['manifest.json', 'geometry.json'];
  if (kind === 'characters') for (const category of ['animations', 'expressions']) {
    const dir = await ws.securePath(project, base + category);
    let entries = [];
    try { entries = await readdir(dir); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (entries.length > 200) throw new Error('Demasiados clips/expresiones');
    for (const name of entries) if (allowed.test(name.slice(0, -5)) && name.endsWith('.json')) names.push(`${category}/${name}`);
  }
  const files = {};
  for (const name of new Set(names)) {
    try {
      const f = await ws.read(project, base + name);
      files[name] = { ...f, parsed: JSON.parse(f.content) };
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return { kind, id, files };
}
async function listen(ws, project, episode, token) {
  const respond = (res, status, text, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(text);
  };
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') return respond(res, 405, '{}');
      const url = new URL(req.url, 'http://127.0.0.1');
      const path = url.pathname;
      if (fixedFiles.has(path)) {
        const [relative, type] = fixedFiles.get(path);
        const file = join(ROOT, relative);
        return respond(res, 200, await readFile(file), type);
      }
      if (url.searchParams.get('token') !== token) return respond(res, 403, '{"error":"Forbidden"}');
      if (path === '/api/scene') {
        const id = url.searchParams.get('scene');
        if (!/^sc-\d+$/.test(id ?? '')) return respond(res, 400, '{}');
        const file = await ws.read(project, `episodes/${episode}/scenes/${id}/scene.json`);
        return respond(res, 200, file.content);
      }
      if (path === '/api/asset') {
        const object = await readBundle(ws, project, url.searchParams.get('kind'), url.searchParams.get('id'));
        return respond(res, 200, JSON.stringify(object));
      }
      return respond(res, 404, '{}');
    } catch (e) { return respond(res, e.code === 'ENOENT' ? 404 : 400, JSON.stringify({ error: e.message })); }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  return { server, port: server.address().port };
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.pending = new Map(); this.nextId = 0;
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (!msg.id) return;
      const pending = this.pending.get(msg.id); if (!pending) return;
      this.pending.delete(msg.id);
      msg.error ? pending.reject(new Error(msg.error.message)) : pending.resolve(msg.result);
    });
    ws.addEventListener('close', () => { for (const p of this.pending.values()) p.reject(new Error('Chromium desconectado')); this.pending.clear(); });
  }
  command(method, params = {}, timeoutMs = 30_000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`Chrome DevTools timeout: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Error JavaScript en Chromium');
    return result.result?.value;
  }
  close() { this.ws.close(); }
}

export async function openThreeCapture({ workspace, project, episode, width, height, browserPath = findChromium() }) {
  if (!allowed.test(project) || !allowed.test(episode)) throw new Error('Universo/episodio inválido');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 160 || height < 90 || width > 3840 || height > 2160) throw new Error('Resolución inválida');
  if (!['three.module.js','three.core.js'].every(file=>existsSync(join(ROOT,'node_modules','three','build',file)))) throw new Error('Three.js no está instalado o está incompleto. Ejecuta npm install en la carpeta del proyecto. Usa --renderer svg para el animatic sin WebGL.');
  const token = TOKEN(), { server, port } = await listen(workspace, project, episode, token);
  const userDir = await mkdtemp(join(tmpdir(), 'series-forge-chrome-'));
  const args = ['--headless=new', '--disable-extensions', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--enable-webgl', '--ignore-gpu-blocklist', '--remote-debugging-port=0', `--user-data-dir=${userDir}`, `--window-size=${width},${height}`, 'about:blank'];
  if (process.env.SERIES_FORGE_SWIFTSHADER === '1') args.push('--use-angle=swiftshader','--enable-unsafe-swiftshader');
  // Containerized Linux running as root has no usable Chromium sandbox.
  if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox');
  const child = spawn(browserPath, args, { stdio: 'ignore', windowsHide: true });
  let crashed = false; child.once('error', () => { crashed = true; }); child.once('exit', () => { crashed = true; });
  let cdp;
  async function close() {
    cdp?.close();
    if (child.exitCode === null) child.kill();
    await new Promise(resolve => server.close(resolve));
    await rm(userDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
  }
  try {
    let debugPort;
    for (let i = 0; i < 100; i++) {
      if (crashed) throw new Error('Chromium terminó durante su arranque');
      try { debugPort = Number((await readFile(join(userDir, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); }
    }
    if (!debugPort) throw new Error('Chromium no ha habilitado el protocolo de depuración');
    let page;
    for (let i = 0; i < 100; i++) {
      const tabs = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json()).catch(() => []);
      page = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) break;
      await delay(100);
    }
    if (!page) throw new Error('Chromium no ofrece una página de render');
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((ok, fail) => { socket.addEventListener('open', ok, { once: true }); socket.addEventListener('error', fail, { once: true }); });
    cdp = new Cdp(socket);
    await cdp.command('Page.enable'); await cdp.command('Runtime.enable');
    await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    let currentScene = null;
    async function selectScene(sceneId) {
      if (!/^sc-\d+$/.test(sceneId)) throw new Error('ID de escena no válido');
      if (currentScene === sceneId) return;
      const location = `http://127.0.0.1:${port}/render.html?scene=${encodeURIComponent(sceneId)}&token=${token}`;
      await cdp.command('Page.navigate', { url: location });
      for (let i = 0; i < 250; i++) {
        const status = await cdp.eval('({ready:!!window.__SF_READY__,error:window.__SF_RENDER_ERROR__||null})').catch(() => null);
        if (status?.error) throw new Error('Visor Three.js: ' + status.error);
        const loc=await cdp.eval('location.href').catch(()=>null);
        if (typeof loc==='string' && loc.startsWith('chrome-error:')) throw new Error('Chromium ha bloqueado el servidor local de render (política del entorno o navegador). Prueba Chrome/Edge de escritorio con SERIES_FORGE_CHROMIUM.');
        if (status?.ready) { currentScene = sceneId; return; }
        await delay(100);
      }
      const detail=await cdp.eval('({url:location.href,ready:document.readyState,html:document.body?.innerText,err:window.__SF_RENDER_ERROR__})').catch(()=>null);
      throw new Error('El visor Three.js no ha terminado de cargar la escena: '+JSON.stringify(detail));
    }
    return {
      async renderFrame(sceneId, timeSec) {
        await selectScene(sceneId);
        await cdp.eval(`window.__SF_RENDER_FRAME__(${JSON.stringify(timeSec)})`);
        const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, 30_000);
        return Buffer.from(screenshot.data, 'base64');
      },
      close
    };
  } catch (e) { await close(); throw e; }
}
