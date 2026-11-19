/** Headless capture page: loads a render job from the local job server and renders exact frames with the shared Stage. */
import { Stage } from './stage.ts';
import type { ResolvedScene, AssetLibrary } from '../engine/timeline.ts';

declare global { interface Window { __SF_READY__?: boolean; __SF_ERROR__?: string | null; __SF_CAPTURE__?: (spec: CaptureSpec) => Promise<{ frames: number; ms: number }>; __SF_INFO__?: unknown } }
interface CaptureSpec { scene: number; times: number[]; format: 'raw' | 'png'; label?: string[] }
interface Job { width: number; height: number; scenes: { resolved: ResolvedScene }[]; lib: AssetLibrary; vignette?: number }

const q = new URLSearchParams(location.search);
const token = q.get('token') ?? '';
window.__SF_READY__ = false; window.__SF_ERROR__ = null;
(async () => {
  const job = await (await fetch(`/job?token=${token}`)).json() as Job;
  const canvas = document.createElement('canvas'); canvas.width = job.width; canvas.height = job.height; document.body.appendChild(canvas);
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', () => { contextLost = true; window.__SF_ERROR__ = 'WebGL context lost (GPU reiniciada o sin memoria)'; });
  const stage = new Stage(canvas, { width: job.width, height: job.height });
  if (job.vignette !== undefined) stage.vignette = job.vignette;
  const gl = stage.renderer.getContext();
  const buf = new Uint8Array(job.width * job.height * 4);
  let loaded = -1;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.__SF_INFO__ = { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext };
  window.__SF_CAPTURE__ = async (spec: CaptureSpec) => {
    const t0 = performance.now();
    if (loaded !== spec.scene) { stage.load(job.scenes[spec.scene].resolved, job.lib); loaded = spec.scene; }
    for (let i = 0; i < spec.times.length; i++) {
      if (contextLost) throw new Error('WebGL context lost');
      stage.setTime(spec.times[i]); stage.render();
      let body: BodyInit;
      if (spec.format === 'raw') { gl.readPixels(0, 0, job.width, job.height, gl.RGBA, gl.UNSIGNED_BYTE, buf); body = buf; }
      else body = await new Promise<Blob>((ok, fail) => canvas.toBlob(b => b ? ok(b) : fail(new Error('toBlob')), 'image/png'));
      const r = await fetch(`/frame?token=${token}&i=${i}&label=${encodeURIComponent(spec.label?.[i] ?? '')}`, { method: 'POST', body });
      if (!r.ok) throw new Error('frame sink ' + r.status);
    }
    return { frames: spec.times.length, ms: performance.now() - t0 };
  };
  window.__SF_READY__ = true;
})().catch(e => { window.__SF_ERROR__ = String(e?.stack ?? e); console.error(e); });
