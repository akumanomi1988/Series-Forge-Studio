/** Headless Chromium/Chrome/Edge render host over the DevTools protocol (no Playwright, no cloud).
 * A per-job loopback HTTP server (random token) serves the capture page, the job JSON and receives frames.
 * Frames are delivered to a sink (FFmpeg stdin or PNG files). Processes are always cleaned up. */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { REPO_ROOT } from './project.ts';

export function findBrowser(): string {
  const explicit = process.env.SERIES_FORGE_CHROMIUM;
  if (explicit) { if (!existsSync(explicit)) throw new Error('SERIES_FORGE_CHROMIUM no apunta a un ejecutable'); return explicit; }
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean) as string[];
  const cands = roots.flatMap(r => [join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'), join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), join(r, 'Chromium', 'Application', 'chrome.exe')]);
  cands.push('/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser');
  const found = cands.find(existsSync);
  if (!found) throw new Error('No se encontró Chrome/Edge/Chromium. Define SERIES_FORGE_CHROMIUM.');
  return found;
}

class Cdp {
  private pending = new Map<number, { ok: (v: unknown) => void; fail: (e: Error) => void }>();
  private id = 0;
  private ws: WebSocket;
  onEvent: (method: string, params: Record<string, unknown>) => void = () => {};
  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id === undefined) { this.onEvent(msg.method, msg.params); return; }
      const p = this.pending.get(msg.id); if (!p) return; this.pending.delete(msg.id);
      msg.error ? p.fail(new Error(msg.error.message)) : p.ok(msg.result);
    });
    ws.addEventListener('close', () => { for (const p of this.pending.values()) p.fail(new Error('Chromium desconectado')); this.pending.clear(); });
  }
  send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, timeoutMs = 60_000): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((ok, fail) => {
      const timer = setTimeout(() => { this.pending.delete(id); fail(new Error(`Timeout CDP: ${method}`)); }, timeoutMs);
      this.pending.set(id, { ok: v => { clearTimeout(timer); ok(v as T); }, fail: e => { clearTimeout(timer); fail(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval<T>(expression: string, timeoutMs = 60_000): Promise<T> {
    const r = await this.send<{ result?: { value?: T }; exceptionDetails?: { text?: string; exception?: { description?: string } } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? 'Error en página');
    return r.result?.value as T;
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

export type FrameSink = (index: number, data: Buffer, label: string) => Promise<void> | void;
export interface RenderHost { capture(scene: number, times: number[], format: 'raw' | 'png', sink: FrameSink, labels?: string[]): Promise<{ frames: number; ms: number }>; info: { renderer: string; webgl2: boolean }; metrics(): Promise<Record<string, number>>; close(): Promise<void> }

/** Start a capture host for a job (job JSON must be serialisable: resolved scenes + asset library). */
export async function openRenderHost(job: unknown, opts: { width: number; height: number; timeoutMs?: number } ): Promise<RenderHost> {
  const bundle = join(REPO_ROOT, 'public', 'build', 'capture.js');
  if (!existsSync(bundle)) throw new Error('Falta public/build/capture.js: ejecuta `npm run build`');
  const token = randomBytes(18).toString('hex');
  const jobJson = Buffer.from(JSON.stringify(job));
  let sink: FrameSink | null = null;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000;overflow:hidden}</style></head><body><script type="module" src="/capture.js?token=${token}"></script></body></html>`;
  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const send = (code: number, body: string | Buffer, type = 'text/plain') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
    if (url.searchParams.get('token') !== token) return send(403, 'forbidden');
    try {
      if (req.method === 'GET' && url.pathname === '/') return send(200, html, 'text/html; charset=utf-8');
      if (req.method === 'GET' && url.pathname === '/capture.js') return send(200, await readFile(bundle), 'text/javascript; charset=utf-8');
      if (req.method === 'GET' && url.pathname === '/job') return send(200, jobJson, 'application/json');
      if (req.method === 'POST' && url.pathname === '/frame') {
        const chunks: Buffer[] = []; let size = 0;
        for await (const c of req) { size += (c as Buffer).length; if (size > 64 * 1024 * 1024) return send(413, 'too large'); chunks.push(c as Buffer); }
        if (!sink) return send(409, 'no sink');
        await sink(Number(url.searchParams.get('i')), Buffer.concat(chunks), url.searchParams.get('label') ?? '');
        return send(200, 'ok');
      }
      return send(404, 'not found');
    } catch (e) { return send(500, (e as Error).message); }
  });
  server.keepAliveTimeout = 60_000;
  await new Promise<void>((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', () => ok()); });
  const port = (server.address() as { port: number }).port;
  const userDir = await mkdtemp(join(tmpdir(), 'sf-chrome-'));
  const args = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-webgl', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${userDir}`, `--window-size=${opts.width},${opts.height}`, 'about:blank'];
  if (process.env.SERIES_FORGE_SWIFTSHADER === '1') args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox');
  const child: ChildProcess = spawn(findBrowser(), args, { stdio: 'ignore', windowsHide: true });
  let exited = false; child.once('exit', () => { exited = true; }); child.once('error', () => { exited = true; });
  let cdp: Cdp | null = null;
  const close = async () => {
    cdp?.close();
    if (!exited) { child.kill(); for (let i = 0; i < 30 && !exited; i++) await delay(100); if (!exited && process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); }
    await new Promise<void>(ok => server.close(() => ok()));
    server.closeAllConnections?.();
    await rm(userDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 }).catch(() => {});
  };
  try {
    let debugPort = 0;
    for (let i = 0; i < 150 && !debugPort; i++) { if (exited) throw new Error('El navegador terminó al arrancar'); try { debugPort = Number((await readFile(join(userDir, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { await delay(100); } }
    if (!debugPort) throw new Error('El navegador no abrió el puerto de depuración');
    let wsUrl = '';
    for (let i = 0; i < 100 && !wsUrl; i++) { const tabs = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json() as Promise<{ type: string; webSocketDebuggerUrl?: string }[]>).catch(() => []); wsUrl = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; if (!wsUrl) await delay(100); }
    if (!wsUrl) throw new Error('Sin página de render');
    const ws = new WebSocket(wsUrl);
    await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
    cdp = new Cdp(ws);
    const consoleErrors: string[] = [];
    cdp.onEvent = (method, params) => { if (method === 'Runtime.exceptionThrown') consoleErrors.push(JSON.stringify(params).slice(0, 800)); if (method === 'Log.entryAdded') { const e = (params as { entry: { level: string; text: string } }).entry; if (e.level === 'error') consoleErrors.push(e.text); } };
    await cdp.send('Runtime.enable'); await cdp.send('Log.enable').catch(() => {}); await cdp.send('Page.enable'); await cdp.send('Performance.enable').catch(() => {});
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: opts.width, height: opts.height, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/?token=${token}` });
    const deadline = Date.now() + (opts.timeoutMs ?? 60_000);
    for (;;) {
      const st = await cdp.eval<{ ready: boolean; error: string | null; href: string }>('({ready: !!window.__SF_READY__, error: window.__SF_ERROR__ || null, href: location.href})').catch(() => null);
      if (st?.error) throw new Error('Página de render: ' + st.error);
      if (st?.href.startsWith('chrome-error:')) throw new Error('El navegador bloqueó el servidor local de render (política del sistema)');
      if (st?.ready) break;
      if (Date.now() > deadline) throw new Error('Timeout cargando la escena en el navegador: ' + consoleErrors.join(' | '));
      await delay(80);
    }
    const info = await cdp.eval<{ renderer: string; webgl2: boolean }>('window.__SF_INFO__');
    return {
      info,
      async metrics() { const r = await cdp!.send<{ metrics: { name: string; value: number }[] }>('Performance.getMetrics'); return Object.fromEntries(r.metrics.map(m => [m.name, m.value])); },
      async capture(scene, times, format, s, labels) {
        if (exited) throw new Error('El navegador se cerró inesperadamente');
        sink = s;
        try { return await cdp!.eval<{ frames: number; ms: number }>(`window.__SF_CAPTURE__(${JSON.stringify({ scene, times, format, label: labels })})`, Math.max(45_000, times.length * 1_500)); }
        catch (e) { throw new Error(`${(e as Error).message}${consoleErrors.length ? ' | consola: ' + consoleErrors.slice(-3).join(' | ') : ''}`); }
        finally { sink = null; }
      },
      close
    };
  } catch (e) { await close(); throw e; }
}

/** Generic headless page driver (UI end-to-end tests and screenshots of the editor). */
export async function openPage(url: string, width = 1600, height = 900): Promise<{ eval<T>(expr: string): Promise<T>; screenshot(file: string): Promise<void>; consoleErrors: string[]; close(): Promise<void> }> {
  const userDir = await mkdtemp(join(tmpdir(), 'sf-ui-'));
  const child = spawn(findBrowser(), ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--ignore-gpu-blocklist', '--enable-webgl', '--remote-debugging-port=0', `--user-data-dir=${userDir}`, `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let exited = false; child.once('exit', () => { exited = true; });
  let cdp: Cdp | null = null;
  const close = async () => { cdp?.close(); if (!exited) { child.kill(); for (let i = 0; i < 30 && !exited; i++) await delay(100); } await rm(userDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 }).catch(() => {}); };
  try {
    let port = 0; for (let i = 0; i < 150 && !port; i++) { try { port = Number((await readFile(join(userDir, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { await delay(100); } }
    let ws = ''; for (let i = 0; i < 100 && !ws; i++) { const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json() as Promise<{ type: string; webSocketDebuggerUrl?: string }[]>).catch(() => []); ws = tabs.find(t => t.type === 'page')?.webSocketDebuggerUrl ?? ''; if (!ws) await delay(100); }
    const sock = new WebSocket(ws); await new Promise((ok, fail) => { sock.addEventListener('open', ok, { once: true }); sock.addEventListener('error', fail, { once: true }); });
    cdp = new Cdp(sock);
    const consoleErrors: string[] = [];
    cdp.onEvent = (m, p) => { if (m === 'Runtime.exceptionThrown') consoleErrors.push(JSON.stringify(p).slice(0, 600)); if (m === 'Runtime.consoleAPICalled' && (p as { type: string }).type === 'error') consoleErrors.push(JSON.stringify((p as { args: unknown[] }).args).slice(0, 600)); };
    await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url });
    const c = cdp;
    return { eval: <T>(e: string) => c.eval<T>(e), consoleErrors, close, screenshot: async (file: string) => { const r = await c.send<{ data: string }>('Page.captureScreenshot', { format: 'png' }); const { writeFile } = await import('node:fs/promises'); await writeFile(file, Buffer.from(r.data, 'base64')); } };
  } catch (e) { await close(); throw e; }
}
