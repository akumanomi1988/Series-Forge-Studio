/** Built-in prop generator defaults: interaction anchors, articulation joints and rest height.
 * Pure data used by the director (Node) and the renderer (browser). File values always override these. */
import type { PropGeometry } from './schema.ts';
import type { Vec3 } from './math.ts';

type Anchor = { position: Vec3; rotationDeg: Vec3 };
type Joint = { position: Vec3; axis: 'x' | 'y' | 'z'; minDeg: number; maxDeg: number };
export const num = (geo: PropGeometry, key: string, def: number): number => { const v = geo.params[key]; return typeof v === 'number' && Number.isFinite(v) ? v : def; };
export const str = (geo: PropGeometry, key: string, def: string): string => { const v = geo.params[key]; return typeof v === 'string' ? v : def; };
export const bool = (geo: PropGeometry, key: string, def: boolean): boolean => { const v = geo.params[key]; return typeof v === 'boolean' ? v : def; };
const A = (position: Vec3, rotationDeg: Vec3 = [0, 0, 0]): Anchor => ({ position, rotationDeg });

export function generatorDefaults(geo: PropGeometry): { anchors: Record<string, Anchor>; joints: Record<string, Joint>; restHeight?: number } {
  switch (geo.generator) {
    case 'workbench': case 'table': { const h = num(geo, 'height', geo.generator === 'workbench' ? 0.92 : 0.76); return { anchors: { top: A([0, h, 0]), front: A([0, h, num(geo, 'depth', 0.8) / 2]) }, joints: {} }; }
    case 'chair': return { anchors: { seat: A([0, num(geo, 'seatHeight', 0.46), 0.02]) }, joints: {} };
    case 'stool': return { anchors: { seat: A([0, num(geo, 'seatHeight', 0.66), 0]) }, joints: {} };
    case 'bench': case 'sofa': return { anchors: { seat: A([0, num(geo, 'seatHeight', 0.45), 0.05]) }, joints: {} };
    case 'robot': { const h = num(geo, 'height', 1.1); return { anchors: { panel: A([0, h * 0.55, h * 0.2]), top: A([0, h, 0]), eye: A([0, h * 0.86, h * 0.17]) }, joints: { head: { position: [0, h * 0.74, 0], axis: 'y', minDeg: -120, maxDeg: 120 }, headTilt: { position: [0, h * 0.74, 0], axis: 'x', minDeg: -30, maxDeg: 30 }, armL: { position: [h * 0.27, h * 0.62, 0], axis: 'x', minDeg: -170, maxDeg: 60 }, armR: { position: [-h * 0.27, h * 0.62, 0], axis: 'x', minDeg: -170, maxDeg: 60 }, panel: { position: [0, h * 0.42, h * 0.19], axis: 'x', minDeg: 0, maxDeg: 110 } } }; }
    case 'door': { const w = num(geo, 'width', 0.95), h = num(geo, 'height', 2.1); return { anchors: { handle: A([w * 0.85 - w / 2, h * 0.47, 0.05]) }, joints: { leaf: { position: [-w / 2, 0, 0], axis: 'y', minDeg: -110, maxDeg: 110 } } }; }
    case 'toolbox': return { anchors: { grip: A([0, num(geo, 'height', 0.22) + 0.06, 0]), top: A([0, num(geo, 'height', 0.22), 0]) }, joints: { lid: { position: [0, num(geo, 'height', 0.22), -0.12], axis: 'x', minDeg: -110, maxDeg: 0 } }, restHeight: 0 };
    case 'mug': return { anchors: { grip: A([0.055, 0.05, 0], [0, 0, 0]) }, joints: {}, restHeight: 0.05 };
    case 'wrench': return { anchors: { grip: A([0, 0.06, 0], [0, 0, 0]) }, joints: {}, restHeight: 0.012 };
    case 'component': return { anchors: { grip: A([0, 0, 0], [0, 0, 0]) }, joints: {}, restHeight: num(geo, 'radius', 0.035) };
    case 'crate': return { anchors: { top: A([0, num(geo, 'size', 0.5), 0]), grip: A([0, num(geo, 'size', 0.5) * 0.6, 0]) }, joints: {} };
    case 'monitor': case 'console': return { anchors: { screen: A([0, num(geo, 'height', 1.1) * 0.75, 0.1]), top: A([0, num(geo, 'height', 1.1), 0]) }, joints: {} };
    case 'shelf': return { anchors: { top: A([0, num(geo, 'height', 1.9), 0]) }, joints: {} };
    case 'lamp': return { anchors: {}, joints: {} };
    default: return { anchors: {}, joints: {} };
  }
}
/** Geometry with generator defaults merged under the file's explicit anchors/joints. */
export function withDefaults(geo: PropGeometry): PropGeometry {
  const d = generatorDefaults(geo);
  return { ...geo, anchors: { ...d.anchors, ...geo.anchors }, joints: { ...d.joints, ...geo.joints }, restHeight: geo.restHeight ?? d.restHeight };
}
