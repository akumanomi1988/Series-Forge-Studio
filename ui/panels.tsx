import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResolvedScene } from '../src/engine/timeline.ts';
import { api, getFile, putFile, updateJson } from './api.ts';
import type { FileDoc } from './api.ts';

// ------------------------------------------------------------------ raw file editor (JSON / Markdown)
export function FileEditor({ project, path, version }: { project: string; path: string; version: number }) {
  const [doc, setDoc] = useState<FileDoc | null>(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const dirty = doc !== null && text !== doc.content;
  useEffect(() => { let alive = true; getFile(project, path).then(d => { if (!alive) return; setDoc(prev => { if (prev && text !== prev.content && prev.path === path) { setMsg('El archivo cambió fuera del editor; tus cambios locales se conservan (guardar dará conflicto).'); return { ...d, content: prev.content, hash: prev.hash }; } setText(d.content); return d; }); }).catch(e => setMsg(e.message)); return () => { alive = false; }; }, [project, path, version]);
  const save = async () => {
    try { if (path.endsWith('.json')) JSON.parse(text); const r = await putFile(project, path, text, doc?.hash ?? null); setDoc({ path, content: text, hash: r.hash }); setMsg('Guardado ✓'); }
    catch (e) { setMsg((e as Error).message); }
  };
  return <div className="file-editor">
    <div className="row"><code>{path}</code><span className="grow" /><button disabled={!dirty} onClick={save}>Guardar</button><button disabled={!dirty} onClick={() => doc && setText(doc.content)}>Descartar</button></div>
    <textarea spellCheck={false} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } }} />
    {msg && <div className="msg">{msg}</div>}
  </div>;
}

// ------------------------------------------------------------------ parametric character inspector
const SELECTS: Record<string, string[]> = {
  'hair.style': ['short', 'spiky', 'bob', 'ponytail', 'bun', 'long', 'curly', 'mohawk', 'bald', 'buzz', 'sidepart'], 'beard.style': ['none', 'stubble', 'full', 'goatee', 'mustache', 'chinstrap'],
  'outfit.top.type': ['tshirt', 'longsleeve', 'jacket', 'hoodie', 'vest', 'overalls', 'labcoat', 'tanktop', 'dress'], 'outfit.bottom.type': ['pants', 'shorts', 'skirt'], 'outfit.shoes.type': ['sneakers', 'boots', 'shoes', 'sandals'],
  'face.noseShape': ['button', 'round', 'pointy', 'long', 'wide'], 'face.eyeShape': ['round', 'almond', 'narrow']
};
const SLIDERS: [string, number, number, number][] = [['body.height', 0.8, 2.3, 0.01], ['body.headScale', 0.6, 1.8, 0.01], ['body.headWidth', 0.7, 1.4, 0.01], ['body.jaw', 0, 1, 0.01], ['body.shoulderWidth', 0.25, 0.8, 0.01], ['body.hipWidth', 0.2, 0.6, 0.01], ['body.belly', 0, 1, 0.01], ['body.chest', 0, 1, 0.01], ['body.legScale', 0.6, 1.4, 0.01], ['body.armScale', 0.6, 1.4, 0.01], ['body.armThickness', 0.03, 0.12, 0.001], ['body.legThickness', 0.04, 0.16, 0.001], ['face.eyeSize', 0.5, 2, 0.01], ['face.eyeSpacing', 0.6, 1.4, 0.01], ['face.noseSize', 0.4, 2.2, 0.01], ['face.mouthWidth', 0.6, 1.6, 0.01], ['face.earSize', 0, 1.8, 0.01], ['face.blush', 0, 1, 0.01], ['hair.volume', 0.6, 1.8, 0.01]];
const COLORS = ['body.skinColor', 'hair.color', 'beard.color', 'face.irisColor', 'face.lipColor', 'outfit.top.color', 'outfit.top.secondaryColor', 'outfit.bottom.color', 'outfit.shoes.color'];
const getPath = (o: Record<string, unknown>, p: string) => p.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);
const setPath = (o: Record<string, unknown>, p: string, v: unknown) => { const ks = p.split('.'); let cur = o; for (const k of ks.slice(0, -1)) { cur[k] = (cur[k] as Record<string, unknown>) ?? {}; cur = cur[k] as Record<string, unknown>; } cur[ks[ks.length - 1]] = v; };
export function CharacterInspector({ project, id, version }: { project: string; id: string; version: number }) {
  const path = `characters/${id}/geometry.json`;
  const [geo, setGeo] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState('');
  const timer = useRef<number>(0);
  useEffect(() => { getFile(project, path).then(d => setGeo(JSON.parse(d.content))).catch(e => setErr(e.message)); }, [project, id, version]);
  if (!geo) return <div className="msg">{err || 'Cargando…'}</div>;
  if ((geo as { schemaVersion?: number }).schemaVersion !== 2) return <div className="msg">Geometría v1: edítala como archivo o migra con `studio migrate`.</div>;
  const change = (p: string, v: unknown) => {
    const next = structuredClone(geo); setPath(next, p, v); setGeo(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => updateJson<Record<string, unknown>>(project, path, obj => { setPath(obj, p, v); }).catch(e => setErr(e.message)), 250);
  };
  return <div className="inspector-form">
    {err && <div className="msg">{err}</div>}
    <h4>Cuerpo y rostro</h4>
    {SLIDERS.map(([p, lo, hi, st]) => <label key={p}><span>{p}</span><input type="range" min={lo} max={hi} step={st} value={Number(getPath(geo, p) ?? lo)} onChange={e => change(p, Number(e.target.value))} /><em>{Number(getPath(geo, p) ?? 0).toFixed(2)}</em></label>)}
    <h4>Estilo</h4>
    {Object.entries(SELECTS).map(([p, opts]) => <label key={p}><span>{p}</span><select value={String(getPath(geo, p) ?? '')} onChange={e => change(p, e.target.value)}>{opts.map(o => <option key={o}>{o}</option>)}</select></label>)}
    <h4>Colores</h4>
    {COLORS.map(p => <label key={p}><span>{p}</span><input type="color" value={String(getPath(geo, p) ?? '#888888')} onChange={e => change(p, e.target.value)} /></label>)}
  </div>;
}

// ------------------------------------------------------------------ multitrack timeline
interface Item { track: string; id: string; start: number; end: number; label: string; kind: 'shot' | 'action' | 'line' | 'sound' | 'expr' }
export function Timeline({ resolved, scene, time, onSeek, onRetime, onSelect }: { resolved: ResolvedScene | null; scene: Record<string, unknown> | null; time: number; onSeek: (t: number) => void; onRetime: (kind: string, id: string, at: number) => void; onSelect: (kind: string, id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ item: Item; x0: number; dt: number } | null>(null);
  const items = useMemo(() => {
    if (!resolved) return [] as Item[];
    const out: Item[] = resolved.shots.map(s => ({ track: 'Cámara', id: s.id, start: s.start, end: s.end, label: `${s.id} ${s.camera.framing ?? s.camera.type}${s.transitionIn && s.transitionIn.type !== 'cut' ? ' ⟿' + s.transitionIn.type : ''}`, kind: 'shot' as const }));
    for (const a of resolved.actors) {
      for (const sp of a.speech) out.push({ track: `${a.id} · diálogo`, id: sp.lineId, start: sp.start, end: sp.end, label: sp.text, kind: 'line' });
      for (const r of a.root) if (r.kind !== 'hold') out.push({ track: `${a.id} · movimiento`, id: '', start: r.start, end: r.end, label: r.kind === 'walk' ? `camina (${r.gait?.id ?? 'walk'})` : `gira ${Math.round(r.yawTo - r.yawFrom)}°`, kind: 'action' });
      for (const c of a.clips) out.push({ track: `${a.id} · animación`, id: c.source ?? '', start: c.start, end: c.end, label: c.clip, kind: 'action' });
      for (const e of a.expressions) out.push({ track: `${a.id} · expresión`, id: e.source ?? '', start: e.start, end: Math.min(e.end, resolved.durationSec), label: e.expression, kind: 'expr' });
      for (const h of a.hands) if (h.source && h.source !== 'hold') out.push({ track: `${a.id} · manos`, id: h.source, start: h.start, end: h.end, label: `${h.hand} ${h.target.kind}`, kind: 'action' });
    }
    for (const c of resolved.audio) if (c.kind !== 'dialogue') out.push({ track: c.kind === 'music' ? 'Música' : c.kind === 'ambience' ? 'Ambiente' : 'Efectos', id: c.id, start: c.start, end: c.duration > 0 ? c.start + c.duration : c.start + 0.4, label: c.sound + (c.auto ? ' (auto)' : ''), kind: 'sound' });
    for (const e of resolved.effects) out.push({ track: 'Efectos visuales', id: '', start: e.start, end: e.end, label: e.effect, kind: 'action' });
    return out;
  }, [resolved]);
  if (!resolved) return <div className="timeline empty">Selecciona una escena</div>;
  const tracks = [...new Set(items.map(i => i.track))];
  const D = resolved.durationSec, pxPerSec = 60, W = D * pxPerSec;
  const ids = new Set([...(scene?.actions as { id?: string }[] ?? []).map(a => a.id), ...(scene?.dialogue as { id: string }[] ?? []).map(d => d.id), ...(scene?.shots as { id: string }[] ?? []).map(s => s.id)]);
  const tAt = (clientX: number) => { const r = ref.current!.getBoundingClientRect(); return Math.max(0, Math.min(D, (clientX - r.left + ref.current!.scrollLeft - 150) / pxPerSec)); };
  return <div className="timeline" ref={ref} onMouseMove={e => drag && setDrag({ ...drag, dt: (e.clientX - drag.x0) / pxPerSec })} onMouseUp={() => { if (drag && Math.abs(drag.dt) > 0.02) onRetime(drag.item.kind, drag.item.id, +(Math.max(0, drag.item.start + drag.dt)).toFixed(2)); setDrag(null); }}>
    <div className="ruler" style={{ width: W + 150 }} onMouseDown={e => onSeek(tAt(e.clientX))}>{Array.from({ length: Math.ceil(D) + 1 }, (_, s) => <span key={s} style={{ left: 150 + s * pxPerSec }}>{s}s</span>)}</div>
    {tracks.map(tr => <div className="track" key={tr} style={{ width: W + 150 }}>
      <div className="track-name">{tr}</div>
      {items.filter(i => i.track === tr).map((i, k) => { const off = drag?.item === i ? drag.dt : 0; const editable = ids.has(i.id); return <div key={k} title={`${i.label} · ${i.start.toFixed(2)}–${i.end.toFixed(2)} s${editable ? ' (arrastra para retemporizar)' : ''}`} className={`clip ${i.kind} ${editable ? 'editable' : ''}`} style={{ left: 150 + (i.start + off) * pxPerSec, width: Math.max(3, (i.end - i.start) * pxPerSec) }} onMouseDown={e => { e.stopPropagation(); onSelect(i.kind, i.id); if (editable) setDrag({ item: i, x0: e.clientX, dt: 0 }); }}>{i.label}</div>; })}
    </div>)}
    <div className="playhead" style={{ left: 150 + time * pxPerSec }} />
  </div>;
}

// ------------------------------------------------------------------ script (dialogue) editor
interface Line { id: string; actor: string; text: string; emotion?: string; direction?: string; pauseAfter?: number; to?: string; gesture?: string }
export function ScriptEditor({ project, episode, sceneId, version, onPlay }: { project: string; episode: string; sceneId: string; version: number; onPlay: (url: string) => void }) {
  const path = `episodes/${episode}/scenes/${sceneId}/scene.json`;
  const [scene, setScene] = useState<{ dialogue: Line[]; actors: { id: string; characterId: string }[] } | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { getFile(project, path).then(d => setScene(JSON.parse(d.content))).catch(e => setMsg(e.message)); }, [project, path, version]);
  if (!scene) return <div className="msg">{msg || '…'}</div>;
  const save = (fn: (s: { dialogue: Line[] }) => void) => updateJson<{ dialogue: Line[] }>(project, path, fn).then(() => setMsg('Guardado ✓')).catch(e => setMsg(e.message));
  const edit = (i: number, k: keyof Line, v: string) => { const next = structuredClone(scene); (next.dialogue[i] as unknown as Record<string, unknown>)[k] = k === 'pauseAfter' ? Number(v) : v || undefined; setScene(next); };
  const commit = (i: number) => save(s => { s.dialogue[i] = scene.dialogue[i]; });
  return <div className="script">
    {msg && <div className="msg">{msg}</div>}
    <table><thead><tr><th>id</th><th>personaje</th><th>texto</th><th>emoción</th><th>indicación</th><th>pausa</th><th /></tr></thead><tbody>
      {scene.dialogue.map((l, i) => <tr key={l.id}>
        <td><code>{l.id}</code></td>
        <td><select value={l.actor} onChange={e => { edit(i, 'actor', e.target.value); }} onBlur={() => commit(i)}>{scene.actors.map(a => <option key={a.id}>{a.id}</option>)}</select></td>
        <td><textarea value={l.text} onChange={e => edit(i, 'text', e.target.value)} onBlur={() => commit(i)} /></td>
        <td><input value={l.emotion ?? ''} onChange={e => edit(i, 'emotion', e.target.value)} onBlur={() => commit(i)} /></td>
        <td><input value={l.direction ?? ''} onChange={e => edit(i, 'direction', e.target.value)} onBlur={() => commit(i)} /></td>
        <td><input type="number" step="0.1" value={l.pauseAfter ?? 0.35} onChange={e => edit(i, 'pauseAfter', e.target.value)} onBlur={() => commit(i)} /></td>
        <td><button title="Escuchar (TTS local)" onClick={async () => { try { const charId = scene.actors.find(a => a.id === l.actor)?.characterId; const r = await api<{ url: string }>(`/api/project/${project}/say`, { method: 'POST', body: JSON.stringify({ character: charId, text: l.text, emotion: l.emotion }) }); onPlay(r.url); } catch (e) { setMsg((e as Error).message); } }}>▶</button>
          <button title="Eliminar" onClick={() => save(s => { s.dialogue.splice(i, 1); })}>✕</button></td>
      </tr>)}
    </tbody></table>
    <button onClick={() => save(s => { const n = s.dialogue.length + 1; s.dialogue.push({ id: `linea-${Date.now().toString(36)}`, actor: scene.actors[0]?.id ?? '', text: 'Nueva línea.' }); void n; })}>+ Añadir línea</button>
  </div>;
}
