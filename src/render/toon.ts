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
/** 'toon': cel bands + ink outlines. 'soft': stylised 3D (physically based diffuse, soft shadows, ambient occlusion,
 * no outlines), the look of modern low-poly animation. Set by the stage from the project before building a scene. */
export type RenderStyle = 'toon' | 'soft';
let STYLE: RenderStyle = 'toon';
export function setRenderStyle(s: RenderStyle | undefined): void { STYLE = s ?? 'toon'; }
export function renderStyle(): RenderStyle { return STYLE; }
/** Neckline drawn per pixel on the torso (crisp anti-aliased edge at any distance). The torso carries a "neck"
 * attribute (sin a, cos a, depth below the neck base); the shader paints skin inside the neckline shape. */
export interface NecklineSpec { kind: 'v' | 'scoop' | 'plunge' | 'off-shoulder'; depth: number; offDepth: number; scale: number; skin: string; skinGloss: number; cleavage: boolean }
const NECK_KIND = { v: 1, scoop: 2, plunge: 3, 'off-shoulder': 4 } as const;
/** Cel-shaded specular: a hard-edged highlight (Blinn-Phong thresholded into one band) from every directional, point
 * and spot light, plus a fresnel rim sheen. Strength comes from a uniform or from a per-vertex "gloss" attribute. */
function addGloss(m: THREE.MeshToonMaterial | THREE.MeshStandardMaterial, gloss: number, perVertex: boolean, shininess: number, neck?: NecklineSpec) {
  m.onBeforeCompile = shader => {
    shader.uniforms.sfGloss = { value: gloss }; shader.uniforms.sfShininess = { value: shininess };
    if (neck) Object.assign(shader.uniforms, {
      sfNeckKind: { value: NECK_KIND[neck.kind] }, sfNeckDepth: { value: neck.depth }, sfOffDepth: { value: neck.offDepth }, sfScale: { value: neck.scale },
      sfSkin: { value: new THREE.Color(neck.skin) }, sfSkinGloss: { value: neck.skinGloss }, sfCleave: { value: neck.cleavage ? 1 : 0 }
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${perVertex ? 'attribute float gloss;' : ''}\nvarying float vGloss;\nuniform float sfGloss;${neck ? '\nattribute vec3 neck;\nvarying vec3 vNeck;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvGloss = ${perVertex ? 'gloss' : 'sfGloss'};${neck ? '\nvNeck = neck;' : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vGloss;\nuniform float sfShininess;${neck ? `
varying vec3 vNeck;
uniform int sfNeckKind; uniform float sfNeckDepth, sfOffDepth, sfScale, sfSkinGloss, sfCleave; uniform vec3 sfSkin;
float sfNeckMask(out float shadow) {
  float aa = abs(degrees(atan(vNeck.x, vNeck.y))), db = vNeck.z;
  float wa = fwidth(aa) + 0.01, wd = fwidth(db) + 1e-5;
  shadow = 0.0;
  if (sfNeckKind == 4) return 1.0 - smoothstep(sfOffDepth - wd, sfOffDepth + wd, db);
  float above = (1.0 - smoothstep(-wd, wd, db)) * (1.0 - smoothstep(80.0 - wa, 80.0 + wa, aa));
  float t = clamp(db / sfNeckDepth, 0.0, 1.0);
  float ha = sfNeckKind == 2 ? 62.0 * sqrt(max(0.0, 1.0 - t * t)) : sfNeckKind == 3 ? 44.0 * pow(1.0 - t, 0.8) : 52.0 * (1.0 - t);
  float inside = smoothstep(-wd, wd, db) * (1.0 - smoothstep(ha - wa, ha + wa, aa)) * (1.0 - smoothstep(sfNeckDepth - wd, sfNeckDepth + wd, db));
  shadow = sfCleave * (1.0 - smoothstep(1.5, 4.0, aa)) * smoothstep(sfNeckDepth - 0.055 * sfScale, sfNeckDepth - 0.035 * sfScale, db) * inside;
  return max(above, inside);
}` : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat sfG = vGloss;${neck ? `
{ float sh; float mk = sfNeckMask(sh); diffuseColor.rgb = mix(diffuseColor.rgb, sfSkin * (1.0 - 0.28 * sh), mk); sfG = mix(sfG, sfSkinGloss, mk); }` : ''}`)
      .replace('#include <opaque_fragment>', `
      if (sfG > 0.001) {
        vec3 sfN = normalize(normal), sfV = normalize(vViewPosition), sfSpec = vec3(0.0);
        #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) { vec3 H = normalize(directionalLights[i].direction + sfV); sfSpec += directionalLights[i].color * smoothstep(0.42, 0.48, pow(max(dot(sfN, H), 0.0), sfShininess)); }
        #endif
        #if NUM_POINT_LIGHTS > 0
        for (int i = 0; i < NUM_POINT_LIGHTS; i++) { vec3 lv = pointLights[i].position + vViewPosition; float dl = length(lv); vec3 H = normalize(lv / dl + sfV); sfSpec += pointLights[i].color * getDistanceAttenuation(dl, pointLights[i].distance, pointLights[i].decay) * smoothstep(0.42, 0.48, pow(max(dot(sfN, H), 0.0), sfShininess)); }
        #endif
        #if NUM_SPOT_LIGHTS > 0
        for (int i = 0; i < NUM_SPOT_LIGHTS; i++) { vec3 lv = spotLights[i].position + vViewPosition; float dl = length(lv); vec3 L = lv / dl; float sc = getSpotAttenuation(spotLights[i].coneCos, spotLights[i].penumbraCos, dot(L, spotLights[i].direction)); vec3 H = normalize(L + sfV); sfSpec += spotLights[i].color * sc * getDistanceAttenuation(dl, spotLights[i].distance, spotLights[i].decay) * smoothstep(0.42, 0.48, pow(max(dot(sfN, H), 0.0), sfShininess)); }
        #endif
        float sfRim = smoothstep(0.6, 0.8, 1.0 - max(dot(sfN, sfV), 0.0));
        outgoingLight += sfG * (min(sfSpec, vec3(1.0)) * 0.4 + sfRim * 0.2 * (diffuseColor.rgb + 0.2));
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `sfgloss|${perVertex}|${neck ? 'neck' : ''}`;
}
export function toon(color: string | number, opts: { vertexColors?: boolean; emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; side?: THREE.Side; gloss?: number; glossAttr?: boolean; shininess?: number; neckline?: NecklineSpec } = {}): THREE.MeshToonMaterial {
  const key = JSON.stringify([STYLE, color, opts]);
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshToonMaterial;
  const base = { color: new THREE.Color(color), vertexColors: !!opts.vertexColors, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide };
  // the soft style keeps the same API (callers treat it as a toon material: color, emissive, opacity)
  const m = (STYLE === 'soft' ? new THREE.MeshStandardMaterial({ ...base, roughness: 0.78, metalness: 0 }) : new THREE.MeshToonMaterial({ ...base, gradientMap: toonGradient() })) as unknown as THREE.MeshToonMaterial;
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  if (opts.glossAttr || (opts.gloss ?? 0) > 0 || opts.neckline) addGloss(m, opts.gloss ?? 0, !!opts.glossAttr, opts.shininess ?? 40, opts.neckline);
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
  if (width <= 0 || STYLE === 'soft') return mesh;
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
