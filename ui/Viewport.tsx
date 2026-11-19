import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Stage } from '../src/render/stage.ts';
import type { ResolvedScene, AssetLibrary } from '../src/engine/timeline.ts';

export interface ViewportProps {
  resolved: ResolvedScene | null; lib: AssetLibrary | null; time: number; playing: boolean;
  onTime: (t: number) => void; cameraMode: 'shot' | 'free'; selectedActor?: string | null;
  onActorMoved?: (actor: string, position: [number, number, number], yawDeg: number) => void; gizmo?: 'translate' | 'rotate' | null;
}
export function Viewport(props: ViewportProps) {
  const host = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const gizmoRef = useRef<TransformControls | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const [info, setInfo] = useState('');
  useEffect(() => {
    const el = host.current!; const canvas = document.createElement('canvas'); el.appendChild(canvas);
    const w = Math.max(320, el.clientWidth), h = Math.max(180, el.clientHeight);
    const stage = new Stage(canvas, { width: w, height: h, pixelRatio: Math.min(2, devicePixelRatio || 1) });
    stageRef.current = stage; (window as unknown as { __SF_STAGE__: Stage }).__SF_STAGE__ = stage;
    const cam = new THREE.PerspectiveCamera(35, w / h, 0.05, 200); cam.position.set(3, 2, 5);
    const orbit = new OrbitControls(cam, canvas); orbit.target.set(0, 1, 0); orbit.enableDamping = true; orbitRef.current = orbit;
    const gizmo = new TransformControls(stage.camera, canvas); gizmo.showY = false; gizmoRef.current = gizmo;
    stage.scene.add(gizmo.getHelper());
    gizmo.addEventListener('dragging-changed', (e: { value: unknown }) => {
      orbit.enabled = !e.value;
      const p = propsRef.current; const obj = gizmo.object;
      if (!e.value && obj && p.selectedActor) p.onActorMoved?.(p.selectedActor, [+obj.position.x.toFixed(3), 0, +obj.position.z.toFixed(3)], +(obj.rotation.y * 180 / Math.PI).toFixed(1));
    });
    const ro = new ResizeObserver(() => { const W = Math.max(320, el.clientWidth), H = Math.max(180, el.clientHeight); stage.resize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); });
    ro.observe(el);
    let last = performance.now(), raf = 0;
    const loop = (now: number) => {
      const p = propsRef.current; const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (p.playing && stage.resolved) { const t = p.time + dt; p.onTime(t >= stage.resolved.durationSec ? 0 : t); }
      orbit.update();
      stage.freeCamera = p.cameraMode === 'free' ? { position: cam.position.clone(), target: orbit.target.clone(), fov: cam.fov } : null;
      if (stage.resolved && !gizmo.dragging) stage.setTime(p.time);
      if (gizmo.dragging && stage.resolved) stage.setTime(p.time);
      stage.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    setInfo(String(stage.info().renderer));
    return () => { cancelAnimationFrame(raf); ro.disconnect(); gizmo.dispose(); orbit.dispose(); stage.dispose(); el.replaceChildren(); };
  }, []);
  useEffect(() => {
    const stage = stageRef.current; if (!stage || !props.resolved || !props.lib) return;
    try { stage.load(props.resolved, props.lib); stage.setTime(props.time); } catch (e) { console.error(e); setInfo('Error: ' + (e as Error).message); }
  }, [props.resolved, props.lib]);
  useEffect(() => {
    const gizmo = gizmoRef.current, stage = stageRef.current; if (!gizmo || !stage) return;
    gizmo.detach();
    if (props.gizmo && props.selectedActor && stage.actors.get(props.selectedActor) && props.time < 0.05) { gizmo.setMode(props.gizmo); gizmo.showX = props.gizmo === 'translate'; gizmo.showZ = props.gizmo === 'translate'; gizmo.showY = props.gizmo === 'rotate'; gizmo.attach(stage.actors.get(props.selectedActor)!.root); }
    (gizmo as unknown as { camera: THREE.Camera }).camera = stage.camera;
  }, [props.gizmo, props.selectedActor, props.resolved, props.time < 0.05]);
  const shot = stageRef.current?.lastShot;
  return <div className="viewport">
    <div className="viewport-canvas" ref={host} />
    <div className="viewport-hud">{props.cameraMode === 'shot' && shot ? `plano ${shot.shot.id}` : 'cámara libre'} · {info}</div>
  </div>;
}
