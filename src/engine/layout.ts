/** Set layout shared by the director (navigation, collision QA) and the renderer (wall holes, what lies beyond a door).
 * Pure math on environment.json + prop geometry: walls with their openings (declared ones plus a hole for every door
 * prop standing in a wall), the walkable areas (room interior, the space beyond each door) and the footprint of
 * every piece of furniture. Navigation is A* on a 10 cm grid, simplified by line of sight and with rounded corners. */
import type { EnvironmentV2, PropGeometry } from './schema.ts';
import type { Vec3 } from './math.ts';
import { num } from './props.ts';

export type Wall = 'back' | 'left' | 'right';
export type Opening = EnvironmentV2['openings'][number];
export interface Beyond { kind: 'corridor' | 'street' | 'room' | 'dark'; depth: number; width: number; wallColor?: string; floorColor?: string; lightColor?: string; lightIntensity?: number }
/** Oriented rectangle on the floor (metres, yaw in radians) with the height of the object. */
export interface Rect { id: string; cx: number; cz: number; hx: number; hz: number; yaw: number; top: number; seat?: boolean }
export const WALL_T = 0.12;

/** Point on a wall at offset `o` along it (the convention environment.json has always used: the right wall runs
 * towards -z). Returns the floor point at the wall's centre line and the inward normal. */
export function wallPoint(env: EnvironmentV2, wall: Wall, o: number): { x: number; z: number; nx: number; nz: number } {
  const [W, , D] = env.size;
  if (wall === 'back') return { x: o, z: -D / 2, nx: 0, nz: 1 };
  if (wall === 'left') return { x: -W / 2, z: o, nx: 1, nz: 0 };
  return { x: W / 2, z: -o, nx: -1, nz: 0 };
}
/** Offset along a wall of a floor point (inverse of wallPoint). */
export function wallOffset(wall: Wall, x: number, z: number): number { return wall === 'back' ? x : wall === 'left' ? z : -z; }

export interface PlacedProp { id: string; geo: PropGeometry; position: Vec3; yawDeg: number; scale: number }

/** Declared openings plus a door-sized hole for every door prop that stands in a wall without one. */
export function wallOpenings(env: EnvironmentV2, props: PlacedProp[]): (Opening & { auto?: boolean })[] {
  const out: (Opening & { auto?: boolean })[] = env.openings.map(o => ({ ...o }));
  if (env.kind !== 'room') return out;
  const [W, , D] = env.size;
  for (const p of props) {
    if (p.geo.generator !== 'door') continue;
    const [x, , z] = p.position;
    const wall: Wall | null = Math.abs(z + D / 2) < 0.4 && env.walls.sides.includes('back') ? 'back' : Math.abs(x + W / 2) < 0.4 && env.walls.sides.includes('left') ? 'left' : Math.abs(x - W / 2) < 0.4 && env.walls.sides.includes('right') ? 'right' : null;
    if (!wall) continue;
    const w = num(p.geo, 'width', 0.95) * p.scale, h = num(p.geo, 'height', 2.1) * p.scale, o = wallOffset(wall, x, z);
    const hit = out.find(q => q.wall === wall && q.type === 'door' && Math.abs(q.offset - o) < (q.width + w) / 2 - 0.05);
    if (hit) { hit.offset = o; hit.width = Math.max(hit.width, w + 0.02); continue; }
    out.push({ id: `auto-${p.id}`, type: 'door', wall, offset: o, width: w + 0.02, height: h + 0.02, sill: 0, auto: true });
  }
  return out;
}
/** Door openings whose declared hole has no door prop in it (a hole in the wall that nobody can close). */
export function doorsWithoutLeaf(env: EnvironmentV2, props: PlacedProp[]): string[] {
  const holes = env.openings.filter(o => o.type === 'door');
  return holes.filter(o => !props.some(p => { if (p.geo.generator !== 'door') return false; const wp = wallPoint(env, o.wall, o.offset); return Math.hypot(p.position[0] - wp.x, p.position[2] - wp.z) < Math.max(0.4, o.width / 2); })).map(o => o.id);
}
export function beyondOf(o: Opening): Beyond | null {
  if (o.type !== 'door' && !o.beyond) return null;
  const b = o.beyond, kind = b?.kind ?? 'corridor';
  const depth = b?.depth ?? (kind === 'street' ? 7 : kind === 'room' ? 3.2 : kind === 'dark' ? 1.2 : 2.4);
  const width = b?.width ?? (kind === 'street' ? 16 : kind === 'room' ? 3.6 : kind === 'dark' ? o.width + 0.6 : o.width + 4.2);
  return { kind, depth, width, wallColor: b?.wallColor, floorColor: b?.floorColor, lightColor: b?.lightColor, lightIntensity: b?.lightIntensity };
}
/** Axis-aligned floor area behind an opening (x0, x1, z0, z1). */
export function beyondArea(env: EnvironmentV2, o: Opening, b: Beyond): [number, number, number, number] {
  const p = wallPoint(env, o.wall, o.offset), t = WALL_T / 2, [W, , D] = env.size;
  // never wider than the wall it is behind: anything sticking out past the set would be seen from the cameras
  const span = (c: number, half: number): [number, number] => { const a = Math.max(-half, c - b.width / 2), z = Math.min(half, c + b.width / 2); return [a, Math.max(z, a + 0.5)]; };
  if (o.wall === 'back') { const [a, z] = span(p.x, W / 2); return [a, z, p.z - t - b.depth, p.z - t]; }
  const [a, z] = span(p.z, D / 2);
  if (o.wall === 'left') return [p.x - t - b.depth, p.x - t, a, z];
  return [p.x + t, p.x + t + b.depth, a, z];
}

/** Local footprint of a prop generator (x0, x1, z0, z1, top) or null when it does not block anybody. */
export function localFootprint(geo: PropGeometry): [number, number, number, number, number] | null {
  const P = (k: string, d: number) => num(geo, k, d);
  const box = (w: number, d: number, top: number): [number, number, number, number, number] => [-w / 2, w / 2, -d / 2, d / 2, top];
  switch (geo.generator) {
    case 'table': return box(P('width', 1.8), P('depth', 0.8), P('height', 0.76));
    case 'workbench': return box(P('width', 1.8), P('depth', 0.8), P('height', 0.92));
    case 'chair': return box(P('width', 0.48), 0.45, 0.9);
    case 'stool': return box(0.4, 0.4, P('seatHeight', 0.66));
    case 'bench': return box(P('width', 1.4), 0.45, 0.9);
    case 'sofa': return box(P('width', 1.8), 0.8, 0.9);
    case 'shelf': return box(P('width', 1.2), P('depth', 0.4), P('height', 1.9));
    case 'robot': { const h = P('height', 1.1); return box(h * 0.55, h * 0.5, h); }
    case 'crate': { const s = P('size', 0.5); return box(s, s, s); }
    case 'barrel': return box(0.6, 0.6, P('height', 0.9));
    case 'console': case 'monitor': return box(P('width', 0.7), 0.5, P('height', 1.1));
    case 'plant': return box(0.36, 0.36, 0.9);
    case 'car': return box(1.8, 4, 1.4);
    case 'bed': return box(1.5, 2.1, 0.6);
    case 'building': return box(P('width', 6), P('depth', 5), P('height', 9));
    case 'tree': return box(0.4, 0.4, P('height', 4));
    case 'streetlamp': return box(0.16, 0.16, P('height', 4));
    case 'fence': return box(P('length', 4), 0.12, 1);
    case 'parts': {
      if (!geo.parts.length) return null;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const q of geo.parts) {
        const [sx, sy, sz] = q.primitive === 'box' || q.primitive === 'roundedBox' ? q.size : q.primitive === 'torus' ? [(q.size[0] + q.size[1]) * 2, q.size[1] * 2, (q.size[0] + q.size[1]) * 2] : q.primitive === 'sphere' ? q.size : [q.size[0] * 2, q.size[1], (q.size[2] || q.size[0]) * 2];
        const ry = ((q.rotationDeg?.[1] ?? 0) * Math.PI) / 180, c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
        const ex = (sx * c + sz * s) / 2, ez = (sx * s + sz * c) / 2;
        x0 = Math.min(x0, q.position[0] - ex); x1 = Math.max(x1, q.position[0] + ex); z0 = Math.min(z0, q.position[2] - ez); z1 = Math.max(z1, q.position[2] + ez);
        y0 = Math.min(y0, q.position[1] - sy / 2); y1 = Math.max(y1, q.position[1] + sy / 2);
      }
      // small objects (a glass, a phone) and things mounted high on a wall never block a walk
      if ((x1 - x0 < 0.3 && z1 - z0 < 0.3) || y0 > 1.0) return null;
      return [x0, x1, z0, z1, y1];
    }
    default: return null;
  }
}
export function footprint(p: PlacedProp): Rect | null {
  if (p.position[1] > 0.3) return null; // resting on something else (a speaker on a table)
  const f = localFootprint(p.geo); if (!f) return null;
  const s = p.scale, yaw = (p.yawDeg * Math.PI) / 180;
  const lx = (f[0] + f[1]) / 2 * s, lz = (f[2] + f[3]) / 2 * s;
  // local centre offset rotated into the world
  const cx = p.position[0] + lx * Math.cos(yaw) + lz * Math.sin(yaw), cz = p.position[2] - lx * Math.sin(yaw) + lz * Math.cos(yaw);
  return { id: p.id, cx, cz, hx: (f[1] - f[0]) / 2 * s, hz: (f[3] - f[2]) / 2 * s, yaw, top: f[4] * s, seat: ['chair', 'stool', 'bench', 'sofa'].includes(p.geo.generator) };
}
/** Signed distance from a point to an oriented rectangle (negative inside). */
export function rectDistance(r: Rect, x: number, z: number): number {
  const dx = x - r.cx, dz = z - r.cz, c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  const lx = dx * c - dz * s, lz = dx * s + dz * c; // world -> local (inverse of the yaw rotation)
  const qx = Math.abs(lx) - r.hx, qz = Math.abs(lz) - r.hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

// ---------------------------------------------------------------- walkable space and navigation grid
export interface Area { x0: number; x1: number; z0: number; z1: number; /** door gap through a wall: margin only along its width */ gap?: 'x' | 'z' }
/** Floor areas where a body centre may be: the room interior (open towards the camera), the gaps through doors and
 * the space beyond each door. Exteriors are open ground. */
export function walkableAreas(env: EnvironmentV2 | null, openings: Opening[]): Area[] {
  if (!env) return [{ x0: -30, x1: 30, z0: -30, z1: 30 }];
  const [W, , D] = env.size, t = WALL_T / 2;
  if (env.kind !== 'room') return [{ x0: -W * 1.5, x1: W * 1.5, z0: -D * 1.5, z1: D * 1.5 }];
  const s = env.walls.sides;
  const areas: Area[] = [{ x0: s.includes('left') ? -W / 2 + t : -W / 2 - 3, x1: s.includes('right') ? W / 2 - t : W / 2 + 3, z0: s.includes('back') ? -D / 2 + t : -D / 2 - 3, z1: D / 2 + 1.6 }];
  for (const o of openings) {
    if (o.type !== 'door' || o.sill > 0.05 || !s.includes(o.wall)) continue;
    const p = wallPoint(env, o.wall, o.offset), hw = o.width / 2 - 0.04;
    const k = t + 0.4; // through the wall and a body radius into both sides
    areas.push(o.wall === 'back' ? { x0: p.x - hw, x1: p.x + hw, z0: p.z - k, z1: p.z + k, gap: 'x' } : { x0: p.x - k, x1: p.x + k, z0: p.z - hw, z1: p.z + hw, gap: 'z' });
    const b = beyondOf(o); if (b && b.kind !== 'dark') { const [x0, x1, z0, z1] = beyondArea(env, o, b); areas.push({ x0, x1, z0, z1 }); }
  }
  return areas;
}
export interface NavMap { x0: number; z0: number; res: number; nx: number; nz: number; free: Uint8Array }
export interface Disc { x: number; z: number; r: number }
export function buildNav(areas: Area[], rects: Rect[], discs: Disc[], radius: number, res = 0.1): NavMap {
  const x0 = Math.min(...areas.map(a => a.x0)) - 0.5, x1 = Math.max(...areas.map(a => a.x1)) + 0.5;
  const z0 = Math.min(...areas.map(a => a.z0)) - 0.5, z1 = Math.max(...areas.map(a => a.z1)) + 0.5;
  const nx = Math.ceil((x1 - x0) / res), nz = Math.ceil((z1 - z0) / res);
  const free = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * res, z = z0 + (j + 0.5) * res;
    // inside some area by at least the body radius (a door gap only needs that margin along its width)
    let ok = areas.some(a => a.gap === 'x' ? x > a.x0 + radius * 0.6 && x < a.x1 - radius * 0.6 && z > a.z0 && z < a.z1
      : a.gap === 'z' ? z > a.z0 + radius * 0.6 && z < a.z1 - radius * 0.6 && x > a.x0 && x < a.x1
      : x > a.x0 + radius && x < a.x1 - radius && z > a.z0 + radius && z < a.z1 - radius);
    if (ok) for (const r of rects) if (rectDistance(r, x, z) < radius) { ok = false; break; }
    if (ok) for (const d of discs) if (Math.hypot(x - d.x, z - d.z) < d.r + radius) { ok = false; break; }
    free[j * nx + i] = ok ? 1 : 0;
  }
  return { x0, z0, res, nx, nz, free };
}
const cellOf = (m: NavMap, x: number, z: number): [number, number] => [Math.floor((x - m.x0) / m.res), Math.floor((z - m.z0) / m.res)];
const isFree = (m: NavMap, i: number, j: number) => i >= 0 && j >= 0 && i < m.nx && j < m.nz && m.free[j * m.nx + i] === 1;
export function freeAt(m: NavMap, x: number, z: number): boolean { const [i, j] = cellOf(m, x, z); return isFree(m, i, j); }
function nearestFree(m: NavMap, x: number, z: number, maxR = 1.6): [number, number] | null {
  const [ci, cj] = cellOf(m, x, z);
  if (isFree(m, ci, cj)) return [ci, cj];
  const R = Math.ceil(maxR / m.res);
  let best: [number, number] | null = null, bd = Infinity;
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) { const d = di * di + dj * dj; if (d < bd && isFree(m, ci + di, cj + dj)) { bd = d; best = [ci + di, cj + dj]; } }
  return best;
}
/** Straight segment clear of obstacles (samples every half cell). `skip` metres at each end are not tested, so a
 * walk can start or end touching furniture (a stool at the bar, the chair someone is about to sit on). */
export function lineClear(m: NavMap, a: [number, number], b: [number, number], skip = 0): boolean {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (m.res * 0.5)));
  for (let k = 0; k <= n; k++) {
    const u = k / n, d = u * L; if (d < skip || L - d < skip) continue;
    if (!freeAt(m, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)) return false;
  }
  return true;
}
/** Shortest walkable path from `from` to `to` (both kept exactly as the ends), or null if there is none.
 * Interior points are corner-rounded so the walker turns while walking. */
export function findPath(m: NavMap, from: [number, number], to: [number, number]): [number, number][] | null {
  if (lineClear(m, from, to, 0.3)) return [from, to];
  const s = nearestFree(m, from[0], from[1]), g = nearestFree(m, to[0], to[1]);
  if (!s || !g) return null;
  const N = m.nx * m.nz, gScore = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const idx = (i: number, j: number) => j * m.nx + i, goal = idx(g[0], g[1]);
  const h = (i: number, j: number) => { const dx = Math.abs(i - g[0]), dz = Math.abs(j - g[1]); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
  // binary heap on f
  const heap: number[] = [], fOf = new Float32Array(N).fill(Infinity);
  const push = (n: number) => { heap.push(n); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (fOf[heap[p]] <= fOf[heap[k]]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let mn = k; if (l < heap.length && fOf[heap[l]] < fOf[heap[mn]]) mn = l; if (r < heap.length && fOf[heap[r]] < fOf[heap[mn]]) mn = r; if (mn === k) break; [heap[mn], heap[k]] = [heap[k], heap[mn]]; k = mn; } } return top; };
  const start = idx(s[0], s[1]); gScore[start] = 0; fOf[start] = h(s[0], s[1]); push(start);
  let found = false;
  while (heap.length) {
    const cur = pop(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === goal) { found = true; break; }
    const ci = cur % m.nx, cj = (cur - ci) / m.nx;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj; if (!isFree(m, ni, nj)) continue;
      if (di && dj && (!isFree(m, ci + di, cj) || !isFree(m, ci, cj + dj))) continue; // no corner cutting
      const n = idx(ni, nj); if (closed[n]) continue;
      const gs = gScore[cur] + (di && dj ? 1.4142 : 1);
      if (gs < gScore[n]) { gScore[n] = gs; came[n] = cur; fOf[n] = gs + h(ni, nj); push(n); }
    }
  }
  if (!found) return null;
  const cells: [number, number][] = [];
  for (let n = goal; n !== -1; n = came[n]) { const i = n % m.nx, j = (n - i) / m.nx; cells.push([m.x0 + (i + 0.5) * m.res, m.z0 + (j + 0.5) * m.res]); }
  cells.reverse();
  const raw: [number, number][] = [from, ...cells, to];
  // line-of-sight simplification (string pulling)
  const out: [number, number][] = [raw[0]];
  let k = 0;
  while (k < raw.length - 1) {
    let best = k + 1;
    for (let q = raw.length - 1; q > k + 1; q--) if (lineClear(m, raw[k], raw[q], k === 0 || q === raw.length - 1 ? 0.3 : 0)) { best = q; break; }
    out.push(raw[best]); k = best;
  }
  return roundCorners(out, 0.35);
}
/** Replaces each interior corner with a short arc (three points) so the heading changes progressively. */
export function roundCorners(p: [number, number][], cut: number): [number, number][] {
  if (p.length < 3) return p;
  const out: [number, number][] = [p[0]];
  for (let k = 1; k < p.length - 1; k++) {
    const a = p[k - 1], b = p[k], c = p[k + 1];
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(cut, la * 0.45, lc * 0.45);
    if (r < 0.05) { out.push(b); continue; }
    const p0: [number, number] = [b[0] + (a[0] - b[0]) * r / la, b[1] + (a[1] - b[1]) * r / la], p2: [number, number] = [b[0] + (c[0] - b[0]) * r / lc, b[1] + (c[1] - b[1]) * r / lc];
    const q = (u: number): [number, number] => [(1 - u) ** 2 * p0[0] + 2 * u * (1 - u) * b[0] + u * u * p2[0], (1 - u) ** 2 * p0[1] + 2 * u * (1 - u) * b[1] + u * u * p2[1]];
    out.push(p0, q(0.25), q(0.5), q(0.75), p2);
  }
  out.push(p[p.length - 1]);
  return out;
}
/** Length-parametrised polyline helpers (positions and headings along a walk path). */
export function polyLength(p: Vec3[]): number { let L = 0; for (let k = 1; k < p.length; k++) L += Math.hypot(p[k][0] - p[k - 1][0], p[k][2] - p[k - 1][2]); return L; }
export function polyAt(p: Vec3[], s: number): { pos: Vec3; dir: [number, number] } {
  let acc = 0;
  for (let k = 1; k < p.length; k++) {
    const a = p[k - 1], b = p[k], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (acc + l >= s || k === p.length - 1) { const u = l > 1e-9 ? Math.min(1, Math.max(0, (s - acc) / l)) : 1; return { pos: [a[0] + (b[0] - a[0]) * u, 0, a[2] + (b[2] - a[2]) * u], dir: l > 1e-9 ? [(b[0] - a[0]) / l, (b[2] - a[2]) / l] : [0, 1] }; }
    acc += l;
  }
  return { pos: [...p[p.length - 1]] as Vec3, dir: [0, 1] };
}
