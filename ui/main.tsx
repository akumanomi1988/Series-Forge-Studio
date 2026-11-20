import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import { api, subscribe, updateJson, getFile } from './api.ts';
import { Viewport } from './Viewport.tsx';
import { FileEditor, CharacterInspector, Timeline, ScriptEditor, YouTubePanel } from './panels.tsx';
import { compileScene } from '../src/engine/director.ts';
import { SceneSchemaV2 } from '../src/engine/schema.ts';
import type { ResolvedScene, AssetLibrary } from '../src/engine/timeline.ts';

interface Summary {
  id: string; issues: { level: string; path: string; message: string }[];
  characters: { id: string; name: string; files: string[]; voice: { voice: string } | null }[]; props: { id: string; name: string; generator: string }[]; environments: { id: string; name: string }[];
  episodes: { id: string; name: string; dir: string; legacy: boolean; status: string; scenes: { id: string; name: string; ok: boolean }[] }[];
  sfx: { id: string; kind: string; generator: string }[]; music: { id: string; mood?: string }[];
  story: { facts: { id: string; text: string; status: string; since: string }[]; relationships: { a: string; b: string; type: string; trust: number; history: { episode: string; note: string }[] }[]; characters: Record<string, { knows: string[]; emotionalState?: string; goals: string[] }>; confirmed: string[]; drafts: Record<string, { status: string; facts: { id: string; text: string }[] }> };
  library: { clips: string[]; locomotion: string[]; expressions: string[] };
}
type Sel = { kind: 'character' | 'prop' | 'environment' | 'scene' | 'episode' | 'file'; id: string; episode?: string };
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

function App() {
  const [projects, setProjects] = useState<string[]>([]);
  const [project, setProject] = useState<string>(store.get('sf.project') ?? '');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lib, setLib] = useState<AssetLibrary | null>(null);
  const [version, setVersion] = useState(0);
  const [sel, setSel] = useState<Sel | null>(() => { try { return JSON.parse(store.get('sf.sel') ?? 'null'); } catch { return null; } });
  const [filePath, setFilePath] = useState<string>('');
  const [resolved, setResolved] = useState<ResolvedScene | null>(null);
  const [sceneJson, setSceneJson] = useState<Record<string, unknown> | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cameraMode, setCameraMode] = useState<'shot' | 'free'>('shot');
  const [tab, setTab] = useState('timeline');
  const [toasts, setToasts] = useState<string[]>([]);
  const [preview, setPreview] = useState({ yaw: 0, headYaw: 0, clip: 'idle', expression: 'neutral' });
  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const [gizmo, setGizmo] = useState<'translate' | 'rotate' | null>(null);
  const [jobLog, setJobLog] = useState<string[]>([]);
  const [voiceProvider, setVoiceProvider] = useState(store.get('sf.voiceProvider') ?? 'auto');
  const [outputs, setOutputs] = useState<{ base: string; files: string[]; storyboard: string[]; latest?: string; report: { ok: boolean; checks: { id: string; ok: boolean; severity?: string }[] } | null } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toast = (m: string) => { setToasts(t => [...t.slice(-3), m]); setTimeout(() => setToasts(t => t.slice(1)), 6000); };

  useEffect(() => { api<string[]>('/api/projects').then(p => { setProjects(p); if (!project && p[0]) setProject(p[0]); }); }, []);
  useEffect(() => { if (!project) return; store.set('sf.project', project); return subscribe(project, (ev, data) => {
    if (ev === 'change') { const d = data as { paths: string[]; invalid: { path: string; error: string }[] }; for (const i of d.invalid) toast(`⚠ ${i.path}: ${i.error} — se mantiene el último estado válido`); setVersion(v => v + 1); }
    if (ev === 'job') { const d = data as { event?: Record<string, unknown>; status?: string; error?: string }; setJobLog(l => [...l.slice(-200), d.event ? JSON.stringify(d.event) : `${d.status} ${d.error ?? ''}`]); if (d.status) setVersion(v => v + 1); }
  }); }, [project]);
  useEffect(() => { if (!project) return; api<Summary>(`/api/project/${project}`).then(setSummary).catch(e => toast(e.message)); api<AssetLibrary>(`/api/project/${project}/assets`).then(setLib).catch(e => toast(e.message)); }, [project, version]);
  useEffect(() => { store.set('sf.sel', JSON.stringify(sel)); }, [sel]);

  // resolve what the viewport shows
  useEffect(() => {
    if (!sel || !project || !lib) { setResolved(null); return; }
    if (sel.kind === 'scene' && sel.episode) {
      api<ResolvedScene>(`/api/project/${project}/scene?episode=${sel.episode}&scene=${sel.id}`).then(r => { setResolved(r); }).catch(e => toast('Escena: ' + e.message));
      getFile(project, `episodes/${sel.episode}/scenes/${sel.id}/scene.json`).then(f => setSceneJson(JSON.parse(f.content))).catch(() => setSceneJson(null));
      return;
    }
    setSceneJson(null);
    try {
      const base = { schemaVersion: 2, id: 'sc-999', name: 'preview', durationSec: 12, autoLook: false, shots: [{ id: 'p', at: 0, camera: { type: 'static', position: [0, 1.5, 5], target: [0, 1, 0], fov: 35 } }] };
      let sc;
      if (sel.kind === 'character' && lib.characters[sel.id]) {
        const hy = (preview.yaw + preview.headYaw) * Math.PI / 180;
        sc = SceneSchemaV2.parse({ ...base, environmentId: null, actors: [{ id: 'actor', characterId: sel.id, position: [0, 0, 0], yawDeg: preview.yaw, expression: preview.expression, idle: 'idle' }],
          actions: [...(preview.clip !== 'idle' ? [{ type: 'play', actor: 'actor', at: 0.2, clip: preview.clip, durationSec: 11, loop: true }] : []), ...(preview.headYaw ? [{ type: 'lookAt', actor: 'actor', at: 0, target: [Math.sin(hy) * 3, 1.5, Math.cos(hy) * 3], durationSec: 12 }] : [])] });
      } else if (sel.kind === 'prop') sc = SceneSchemaV2.parse({ ...base, environmentId: null, actors: [], props: [{ id: 'p', propId: sel.id, position: [0, 0, 0] }] });
      else if (sel.kind === 'environment') sc = SceneSchemaV2.parse({ ...base, environmentId: sel.id, actors: [], shots: [{ id: 'p', at: 0, camera: { type: 'static', position: [0, 2.2, 7], target: [0, 1, -1], fov: 45 } }] });
      if (sc) { setResolved(compileScene(sc, lib)); if (sel.kind !== 'scene') setCameraMode('free'); }
    } catch (e) { toast((e as Error).message); }
  }, [sel?.kind, sel?.id, sel?.episode, project, lib, version, preview]);
  // newest render (metadata.json names it: episodio-<timestamp>.mp4 when episodio.mp4 was locked by a player)
  const latestVideo = outputs?.latest && outputs.files.includes(outputs.latest) ? outputs.latest : outputs?.files.includes('episodio.mp4') ? 'episodio.mp4' : undefined;
  useEffect(() => { if (tab === 'render' && sel?.episode) api<typeof outputs>(`/api/project/${project}/outputs?episode=${sel.episode}`).then(setOutputs); }, [tab, sel?.episode, version]);

  const episode = sel?.episode ?? (sel?.kind === 'episode' ? sel.id : undefined);
  const assetFiles = useMemo(() => {
    if (!summary || !sel) return [] as string[];
    if (sel.kind === 'character') return summary.characters.find(c => c.id === sel.id)?.files ?? [];
    if (sel.kind === 'prop') return [`props/${sel.id}/manifest.json`, `props/${sel.id}/geometry.json`, `props/${sel.id}/descripcion.md`];
    if (sel.kind === 'environment') return [`environments/${sel.id}/manifest.json`, `environments/${sel.id}/environment.json`, `environments/${sel.id}/descripcion.md`];
    if (sel.kind === 'scene' && sel.episode) return [`episodes/${sel.episode}/scenes/${sel.id}/scene.json`, `episodes/${sel.episode}/episode.json`, `episodes/${sel.episode}/guion.md`, `episodes/${sel.episode}/sinopsis.md`, `episodes/${sel.episode}/story.json`];
    if (sel.kind === 'episode') return [`episodes/${sel.id}/episode.json`, `episodes/${sel.id}/sinopsis.md`, `episodes/${sel.id}/guion.md`, `episodes/${sel.id}/story.json`];
    return [];
  }, [summary, sel]);
  useEffect(() => { if (assetFiles.length && !assetFiles.includes(filePath)) setFilePath(assetFiles.find(f => /scene\.json|geometry\.json|environment\.json|episode\.json/.test(f)) ?? assetFiles[0]); }, [assetFiles]);

  const scenePath = sel?.kind === 'scene' && sel.episode ? `episodes/${sel.episode}/scenes/${sel.id}/scene.json` : '';
  const onRetime = (kind: string, id: string, at: number) => updateJson<Record<string, { id?: string; at?: number; after?: string; with?: string; offset?: number }[]>>(project, scenePath, s => {
    const list = kind === 'shot' ? s.shots : kind === 'line' ? s.dialogue : s.actions;
    const it = list?.find(x => x.id === id); if (!it) return;
    delete it.after; delete it.with; it.offset = 0; it.at = at;
  }).then(() => toast(`${id} → ${at}s (tiempo absoluto)`)).catch(e => toast(e.message));
  const onActorMoved = (actor: string, position: [number, number, number], yawDeg: number) => updateJson<{ actors: { id: string; position: number[]; yawDeg: number }[] }>(project, scenePath, s => { const a = s.actors.find(x => x.id === actor); if (a) { if (gizmo === 'translate') a.position = position; else a.yawDeg = yawDeg; } }).then(() => toast(`${actor} actualizado en scene.json`)).catch(e => toast(e.message));
  const errors = summary?.issues.filter(i => i.level === 'error') ?? [];

  return <div className="app">
    <header>
      <b>Series Forge Studio</b><span className="ver">v0.5</span>
      <select value={project} onChange={e => { setProject(e.target.value); setSel(null); }}>{projects.map(p => <option key={p}>{p}</option>)}</select>
      <span className={`badge ${errors.length ? 'bad' : 'good'}`} onClick={() => setTab('issues')}>{errors.length ? `${errors.length} errores` : 'proyecto válido'}</span>
      <span className="grow" />
      <span className="hint">Los agentes editan <code>workspace/{project}</code>; la web se actualiza sola.</span>
    </header>
    <nav className="explorer">
      {summary && <>
        <h5>Personajes</h5>{summary.characters.map(c => <a key={c.id} className={sel?.kind === 'character' && sel.id === c.id ? 'on' : ''} onClick={() => setSel({ kind: 'character', id: c.id })}>{c.name}</a>)}
        <h5>Escenarios</h5>{summary.environments.map(c => <a key={c.id} className={sel?.kind === 'environment' && sel.id === c.id ? 'on' : ''} onClick={() => setSel({ kind: 'environment', id: c.id })}>{c.name}</a>)}
        <h5>Objetos</h5>{summary.props.map(c => <a key={c.id} className={sel?.kind === 'prop' && sel.id === c.id ? 'on' : ''} onClick={() => setSel({ kind: 'prop', id: c.id })}>{c.name} <small>{c.generator}</small></a>)}
        <h5>Episodios</h5>{summary.episodes.map(e => <div key={e.id}><a className={sel?.kind === 'episode' && sel.id === e.id ? 'on' : ''} onClick={() => setSel({ kind: 'episode', id: e.id, episode: e.id })}>{e.name} <small>{e.status}</small></a>
          {e.scenes.map(s => <a key={s.id} className={`sub ${sel?.kind === 'scene' && sel.id === s.id && sel.episode === e.id ? 'on' : ''} ${s.ok ? '' : 'err'}`} onClick={() => { setSel({ kind: 'scene', id: s.id, episode: e.id }); setCameraMode('shot'); setTime(0); }}>{s.id} · {s.name}</a>)}</div>)}
        <h5>Animaciones (biblioteca)</h5><div className="chips">{summary.library.clips.concat(summary.library.locomotion).map(c => <span key={c} className="chip">{c}</span>)}</div>
        <h5>Sonidos</h5><div className="chips">{summary.sfx.map(s => <span key={s.id} className="chip" title={s.generator}>{s.id}</span>)}{summary.music.map(s => <span key={s.id} className="chip music" title={s.mood}>♪ {s.id}</span>)}</div>
      </>}
    </nav>
    <main>
      <Viewport resolved={resolved} lib={lib} time={time} playing={playing} onTime={setTime} cameraMode={cameraMode} selectedActor={selectedActor} gizmo={gizmo} onActorMoved={onActorMoved} />
      <div className="transport">
        <button onClick={() => setPlaying(p => !p)}>{playing ? '❚❚' : '▶'}</button>
        <button onClick={() => { setTime(0); setPlaying(false); }}>⏮</button>
        <input type="range" min={0} max={resolved?.durationSec ?? 1} step={1 / 24} value={time} onChange={e => { setTime(Number(e.target.value)); setPlaying(false); }} />
        <code>{time.toFixed(2)} / {(resolved?.durationSec ?? 0).toFixed(2)} s · f{Math.round(time * 24)}</code>
        <select value={cameraMode} onChange={e => setCameraMode(e.target.value as 'shot' | 'free')}><option value="shot">Cámara final</option><option value="free">Cámara libre</option></select>
        {sel?.kind === 'scene' && <>
          <select value={selectedActor ?? ''} onChange={e => setSelectedActor(e.target.value || null)}><option value="">(actor)</option>{resolved?.actors.map(a => <option key={a.id}>{a.id}</option>)}</select>
          <button className={gizmo === 'translate' ? 'on' : ''} title="Mover posición inicial (t=0)" onClick={() => { setGizmo(g => g === 'translate' ? null : 'translate'); setTime(0); setPlaying(false); }}>✥</button>
          <button className={gizmo === 'rotate' ? 'on' : ''} title="Girar orientación inicial (t=0)" onClick={() => { setGizmo(g => g === 'rotate' ? null : 'rotate'); setTime(0); setPlaying(false); }}>⟲</button>
        </>}
        {sel?.kind === 'character' && <>
          <label>cuerpo <input type="range" min={-180} max={180} value={preview.yaw} onChange={e => setPreview({ ...preview, yaw: Number(e.target.value) })} /> {preview.yaw}°</label>
          <label>cabeza <input type="range" min={-80} max={80} value={preview.headYaw} onChange={e => setPreview({ ...preview, headYaw: Number(e.target.value) })} /> {preview.headYaw}°</label>
          <select value={preview.clip} onChange={e => { setPreview({ ...preview, clip: e.target.value }); setTime(0); setPlaying(true); }}>{summary?.library.clips.map(c => <option key={c}>{c}</option>)}</select>
          <select value={preview.expression} onChange={e => setPreview({ ...preview, expression: e.target.value })}>{summary?.library.expressions.map(c => <option key={c}>{c}</option>)}</select>
        </>}
      </div>
      <div className="tabs">{[['timeline', 'Timeline'], ['script', 'Guion'], ['story', 'Historia'], ['render', 'Render'], ['issues', `Avisos (${summary?.issues.length ?? 0})`]].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <section className="bottom">
        {tab === 'timeline' && <Timeline resolved={sel?.kind === 'scene' ? resolved : null} scene={sceneJson} time={time} onSeek={t => { setTime(t); setPlaying(false); }} onRetime={onRetime} onSelect={() => setFilePath(scenePath)} />}
        {tab === 'script' && (sel?.kind === 'scene' && sel.episode ? <ScriptEditor project={project} episode={sel.episode} sceneId={sel.id} version={version} onPlay={u => { if (audioRef.current) { audioRef.current.src = u; audioRef.current.play(); } }} /> : <div className="msg">Selecciona una escena.</div>)}
        {tab === 'story' && summary && <div className="story">
          <h4>Canon ({summary.story.confirmed.length ? 'confirmado: ' + summary.story.confirmed.join(', ') : 'sin episodios confirmados'})</h4>
          <ul>{summary.story.facts.map(f => <li key={f.id}><code>{f.id}</code> {f.text} <small>[{f.status}·{f.since}]</small></li>)}</ul>
          <h4>Propuestas de episodios (no canónicas)</h4>
          {Object.entries(summary.story.drafts).map(([ep, d]) => <div key={ep}><b>{ep}</b> <small>{d.status}</small> {d.status !== 'confirmed' && <button onClick={() => api(`/api/project/${project}/story/confirm`, { method: 'POST', body: JSON.stringify({ episode: ep }) }).then(() => { toast(`${ep} confirmado en el canon`); setVersion(v => v + 1); }).catch(e => toast(e.message))}>Confirmar en el canon</button>}<ul>{d.facts.map(f => <li key={f.id}><code>{f.id}</code> {f.text}</li>)}</ul></div>)}
          <h4>Relaciones</h4><ul>{summary.story.relationships.map((r, i) => <li key={i}>{r.a} → {r.b}: {r.type}, confianza {r.trust.toFixed(2)} {r.history.map(h => <small key={h.episode}> · {h.episode}: {h.note}</small>)}</li>)}</ul>
          <h4>Conocimiento y estado</h4><ul>{Object.entries(summary.story.characters).map(([c, v]) => <li key={c}><b>{c}</b> ({v.emotionalState ?? '—'}): {v.knows.join(', ')}</li>)}</ul>
        </div>}
        {tab === 'render' && <div className="render">
          {episode ? <>
            <div className="row">
              <button onClick={() => api(`/api/project/${project}/render`, { method: 'POST', body: JSON.stringify({ episode, settings: { width: 640, height: 360, fps: 24, crf: 23, preset: 'veryfast', voiceProvider: voiceProvider === 'auto' ? undefined : voiceProvider } }) }).then(() => setJobLog([])).catch(e => toast(e.message))}>Previsualización 360p</button>
              <button onClick={() => api(`/api/project/${project}/render`, { method: 'POST', body: JSON.stringify({ episode, settings: { width: 1920, height: 1080, fps: 24, crf: 18, preset: 'medium', voiceProvider: voiceProvider === 'auto' ? undefined : voiceProvider } }) }).then(() => setJobLog([])).catch(e => toast(e.message))}>Render final 1080p</button>
              <label title="Motor de voz para este render (usa las alternativas de cada voice.json)">Voces <select value={voiceProvider} onChange={e => { setVoiceProvider(e.target.value); store.set('sf.voiceProvider', e.target.value); }}>
                <option value="auto">Según cada personaje</option><option value="kokoro">Kokoro (local)</option><option value="voicebox">Voicebox (app local)</option><option value="windows-onecore">Windows OneCore</option></select></label>
              {outputs?.report && <span className={`badge ${outputs.report.ok ? 'good' : 'bad'}`}>QA {outputs.report.ok ? 'superada' : 'fallida'}</span>}
            </div>
            {latestVideo && <video controls src={`/api/project/${project}/media?path=${outputs!.base}/${latestVideo}&v=${version}`} />}
            <YouTubePanel project={project} episode={episode} version={version} toast={toast} />
            <div className="storyboard">{outputs?.storyboard.map(f => <img key={f} title={f} src={`/api/project/${project}/media?path=${outputs.base}/${f}&v=${version}`} />)}</div>
            {outputs?.report && <ul className="checks">{outputs.report.checks.map(c => <li key={c.id} className={c.ok ? 'ok' : c.severity === 'warning' ? 'warn' : 'fail'}>{c.ok ? '✓' : '✗'} {c.id}</li>)}</ul>}
            <pre className="log">{jobLog.slice(-30).join('\n')}</pre>
          </> : <div className="msg">Selecciona un episodio o escena.</div>}
        </div>}
        {tab === 'issues' && <ul className="issues">{summary?.issues.map((i, k) => <li key={k} className={i.level}><b>{i.level}</b> <code>{i.path}</code> {i.message}</li>)}</ul>}
      </section>
    </main>
    <aside className="inspector">
      {sel?.kind === 'character' && <details open><summary>Parámetros del personaje</summary><CharacterInspector project={project} id={sel.id} version={version} /></details>}
      {assetFiles.length > 0 && <>
        <div className="file-tabs">{assetFiles.map(f => <button key={f} className={f === filePath ? 'on' : ''} onClick={() => setFilePath(f)}>{f.split('/').slice(-1)[0]}</button>)}</div>
        {filePath && <FileEditor project={project} path={filePath} version={version} />}
      </>}
      {!sel && <div className="msg">Selecciona un recurso en el explorador.</div>}
    </aside>
    <div className="toasts">{toasts.map((t, i) => <div key={i}>{t}</div>)}</div>
    <audio ref={audioRef} />
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
