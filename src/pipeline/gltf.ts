/** Exports the compiled procedural geometry of a character or prop as GLB (skinned meshes + skeleton for characters).
 * Uses the same builders as the renderer, in Node. The source of truth stays geometry.json; GLB is a regenerable cache:
 *   <project>/characters/<id>/compiled/<id>.glb   |   <project>/props/<id>/compiled/<id>.glb */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as THREE from 'three';
import { loadProject } from './project.ts';
import { RigInstance } from '../engine/pose.ts';
import { CharacterVisual } from '../render/character.ts';
import { buildProp } from '../render/props.ts';

/** Minimal FileReader for GLTFExporter in Node (Blob is native). */
function ensureFileReader() {
  const g = globalThis as unknown as { FileReader?: unknown };
  if (g.FileReader) return;
  g.FileReader = class {
    result: ArrayBuffer | string | null = null; onloadend: (() => void) | null = null; onload: (() => void) | null = null;
    readAsArrayBuffer(b: Blob) { b.arrayBuffer().then(r => { this.result = r; this.onload?.(); this.onloadend?.(); }); }
    readAsDataURL(b: Blob) { b.arrayBuffer().then(r => { this.result = `data:${b.type || 'application/octet-stream'};base64,${Buffer.from(r).toString('base64')}`; this.onload?.(); this.onloadend?.(); }); }
  };
}
function stripForExport(root: THREE.Object3D) {
  const remove: THREE.Object3D[] = [];
  root.traverse(o => { if (o.userData.outline) remove.push(o); const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).type === 'MeshToonMaterial') { const t = m.material as THREE.MeshToonMaterial; m.material = new THREE.MeshStandardMaterial({ color: t.color, vertexColors: t.vertexColors, emissive: t.emissive, emissiveIntensity: t.emissiveIntensity, roughness: 0.8, metalness: 0 }); } });
  for (const o of remove) o.parent?.remove(o);
}
export async function exportGlb(project: string, kind: 'character' | 'prop', id: string): Promise<{ file: string; bytes: number }> {
  ensureFileReader();
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const p = await loadProject(project);
  const scene = new THREE.Scene();
  let dir: string;
  if (kind === 'character') {
    const c = p.characters[id]; if (!c) throw new Error(`Personaje inexistente: ${id}`);
    const rig = new RigInstance(c.geometry, c.rigOffsets);
    const vis = new CharacterVisual(rig, c.geometry);
    vis.root.name = id; scene.add(vis.root);
    dir = join(p.root, 'characters', id, 'compiled');
  } else {
    const pr = p.props[id]; if (!pr) throw new Error(`Objeto inexistente: ${id}`);
    const v = buildProp(pr.geometry); v.group.name = id; scene.add(v.group);
    dir = join(p.root, 'props', id, 'compiled');
  }
  stripForExport(scene);
  scene.updateMatrixWorld(true);
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true }) as ArrayBuffer;
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${id}.glb`);
  await writeFile(file, Buffer.from(glb));
  return { file, bytes: glb.byteLength };
}
