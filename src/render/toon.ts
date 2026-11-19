/** Toon / cel-shading materials shared by characters, props and environments. Browser and Node safe (no DOM). */
import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const tones = [96, 168, 228, 255];
  const data = new Uint8Array(tones.length * 4);
  tones.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  gradient = new THREE.DataTexture(data, tones.length, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter; gradient.magFilter = THREE.NearestFilter; gradient.generateMipmaps = false; gradient.needsUpdate = true;
  return gradient;
}
const cache = new Map<string, THREE.Material>();
export function toon(color: string | number, opts: { vertexColors?: boolean; emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; side?: THREE.Side } = {}): THREE.MeshToonMaterial {
  const key = JSON.stringify([color, opts]);
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshToonMaterial;
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: toonGradient(), vertexColors: !!opts.vertexColors, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide });
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  cache.set(key, m);
  return m;
}
export function flat(color: string | number, opts: { transparent?: boolean; opacity?: number; side?: THREE.Side; depthWrite?: boolean; polygonOffset?: number } = {}): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide, depthWrite: opts.depthWrite ?? true });
  if (opts.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -opts.polygonOffset; m.polygonOffsetUnits = -opts.polygonOffset * 4; }
  return m;
}
const outlineCache = new Map<string, THREE.MeshBasicMaterial>();
/** Inverted-hull outline: back faces pushed along the normal (works for skinned and rigid meshes). */
export function outlineMaterial(width: number, color = '#1a1d26'): THREE.MeshBasicMaterial {
  const key = `${width.toFixed(4)}|${color}`;
  const hit = outlineCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.BackSide });
  m.onBeforeCompile = shader => { shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position) + normalize(normal) * ${width.toFixed(5)};`); };
  m.customProgramCacheKey = () => 'outline' + width.toFixed(5);
  outlineCache.set(key, m);
  return m;
}
/** Adds an outline twin to a mesh (shares geometry; skinned meshes share the skeleton). */
export function withOutline<T extends THREE.Mesh>(mesh: T, width: number, color?: string): T {
  if (width <= 0) return mesh;
  let twin: THREE.Mesh;
  if ((mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) {
    const sm = mesh as unknown as THREE.SkinnedMesh;
    const o = new THREE.SkinnedMesh(sm.geometry, outlineMaterial(width, color));
    o.bind(sm.skeleton, sm.bindMatrix);
    twin = o;
  } else twin = new THREE.Mesh(mesh.geometry, outlineMaterial(width, color));
  twin.name = mesh.name + ':outline';
  twin.userData.outline = true;
  twin.castShadow = false; twin.receiveShadow = false;
  mesh.add(twin);
  // twin uses the parent's transform
  return mesh;
}
export function shade(hex: string, k: number): string { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
export function mix(a: string, b: string, t: number): string { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
