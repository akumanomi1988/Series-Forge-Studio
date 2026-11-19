/** Offscreen Chromium entrypoint. Uses exactly the interactive Viewport implementation. */
window.__SF_READY__ = false;
window.__SF_RENDER_ERROR__ = null;
try {
  const query = new URLSearchParams(location.search);
  const token = query.get('token');
  const sceneId = query.get('scene');
  if (!token || !/^sc-[0-9]+$/.test(sceneId || '')) throw new Error('Solicitud de render inválida');
  const request = async (pathname, params = {}) => {
    const url = pathname + '?' + new URLSearchParams({ ...params, token });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error ${response.status}: ${url}`);
    return response.json();
  };
  const [{ Viewport }, scene] = await Promise.all([
    import('./viewport.js'),
    request('/api/scene', { scene: sceneId })
  ]);
  const viewport = new Viewport(document.getElementById('viewport'));
  await viewport.loadScene(scene, (kind, id) => request('/api/asset', { kind, id }));
  if (scene.environmentId) viewport.addEnvironment(await request('/api/asset', { kind: 'environments', id: scene.environmentId }));
  viewport.playing = false;
  viewport.setTime(0);
  window.__SF_RENDER_FRAME__ = time => {
    if (!Number.isFinite(time) || time < 0 || time > scene.durationSec) throw new Error('Tiempo fuera de escena');
    viewport.setTime(time);
    return { time, actors: viewport.actors.length, width: viewport.renderer.domElement.width, height: viewport.renderer.domElement.height };
  };
  window.__SF_READY__ = true;
} catch (error) {
  window.__SF_RENDER_ERROR__ = String(error?.stack || error);
  console.error(error);
}
