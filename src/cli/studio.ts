#!/usr/bin/env node
/** Series Forge Studio CLI — the contract for external coding agents (Claude Code, Codex, OpenCode).
 *  npm run studio -- <command> ...   (run `npm run studio -- help`) */
import { cp, mkdir, readdir, writeFile, readFile, rename, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadProject, WORKSPACE_ROOT, REPO_ROOT, SAFE_ID, loadLibrary } from '../pipeline/project.ts';
import type { Issue } from '../pipeline/project.ts';
import { compileEpisode, renderEpisode } from '../pipeline/episode.ts';
import type { RenderSettings } from '../pipeline/episode.ts';
import { validateEpisode } from '../pipeline/validate.ts';
import { validateStory, confirmEpisode, amendFact, revertStory, loadStory } from '../pipeline/story.ts';
import { renderStills, turnaroundScene, expressionScene } from '../pipeline/preview.ts';
import { contactSheet } from '../pipeline/media.ts';
import { listOneCoreVoices, synthesize } from '../audio/tts.ts';
import { compileScene } from '../engine/director.ts';
import { assetLibrary } from '../pipeline/project.ts';
import { scaffold } from '../pipeline/scaffold.ts';
import { migrateProject } from '../pipeline/migrate.ts';
import { exportGlb } from '../pipeline/gltf.ts';
import { listVersions, revertTo, recordVersion } from '../pipeline/history.ts';

const HELP = `Series Forge Studio — CLI para agentes y personas (sin LLM integrado).

  studio projects                                   Lista proyectos de workspace/
  studio init pilot                                 Copia el piloto «El último turno» a workspace/el-ultimo-turno
  studio new project <id> "<Nombre>"                Crea un proyecto vacío file-first
  studio new character|prop|environment|episode <project> <id> "<Nombre>" [--from <id>]
  studio new scene <project> <episode> <sc-NNN> "<Nombre>"
  studio list characters|props|environments|episodes|animations|expressions|sounds|music <project>
  studio validate <project>                         Esquemas, referencias, continuidad narrativa
  studio preview character <project> <id>          Hoja de giro 0/35/90/180/270 y de expresiones (PNG)
  studio preview scene <project> <episode> <scene> [--times 1,2.5] [--width 1280 --height 720]
  studio compile episode <project> <episode>        TTS + lip-sync + timeline resuelto (generated/episode-plan.json)
  studio render episode <project> <episode> [--width 1920 --height 1080 --fps 24 --max-seconds N --scenes sc-001,sc-002 --crf 18 --preset medium --draft]
  studio validate episode <project> <episode>       QA audiovisual del MP4 exportado (validation-report.json)
  studio produce <project> <episode> [render opts]  validate + render + validate episode (código de salida != 0 si falla)
  studio story status|confirm|amend|revert <project> [<episode>|<fact> --text ".." --reason ".."]
  studio migrate <project>                          Reescribe assets v1 (v0.2–v0.4) en v2 (copias .v1.json)
  studio history <project> <ruta>                   Versiones guardadas de un archivo (editor y cambios detectados)
  studio revert <project> <ruta> <versión>          Restaura una versión (queda registrada como nueva versión)
  studio export character|prop <project> <id>       Geometría compilada a GLB (characters/<id>/compiled/<id>.glb)
  studio voices                                     Voces TTS locales disponibles
  studio say <project> <character> "<texto>" [--emotion angry]   Prueba de voz (WAV en generated/)
`;
const args = process.argv.slice(2);
const flag = (name: string, def?: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const has = (name: string) => args.includes(`--${name}`);
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--draft', '--json'].includes(args[i - 1])));
const out = (x: unknown) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));
function printIssues(issues: Issue[]) { for (const i of issues) console.log(`${i.level === 'error' ? 'ERROR' : 'aviso'}  ${i.path}: ${i.message}`); }

async function main() {
  const [cmd, sub, a1, a2, a3] = positional;
  switch (cmd) {
    case undefined: case 'help': case '--help': return out(HELP);
    case 'projects': { await mkdir(WORKSPACE_ROOT, { recursive: true }); const dirs = (await readdir(WORKSPACE_ROOT, { withFileTypes: true })).filter(d => d.isDirectory() && SAFE_ID.test(d.name)); return out(dirs.map(d => d.name)); }
    case 'init': {
      if (sub !== 'pilot') throw new Error('Uso: studio init pilot');
      const dest = join(WORKSPACE_ROOT, 'el-ultimo-turno');
      if (existsSync(dest) && !has('force')) throw new Error(`Ya existe ${dest} (usa --force para sobrescribir los archivos fuente; generated/ y output/ se conservan)`);
      await cp(join(REPO_ROOT, 'examples', 'projects', 'el-ultimo-turno'), dest, { recursive: true, force: true });
      return out(`Piloto copiado a ${dest}\nSiguiente: npm run studio -- produce el-ultimo-turno ep-001`);
    }
    case 'new': return out(await scaffold(sub, positional.slice(2), flag('from')));
    case 'list': {
      const p = await loadProject(a1);
      const lib = await loadLibrary();
      const map: Record<string, () => unknown> = {
        characters: () => Object.values(p.characters).map(c => ({ id: c.id, name: c.name, voice: c.voice ? `${c.voice.provider}:${c.voice.voice}` : null, hair: c.geometry.hair.style, top: c.geometry.outfit.top.type })),
        props: () => Object.values(p.props).map(x => ({ id: x.id, name: x.name, generator: x.geometry.generator, anchors: Object.keys(x.geometry.anchors), joints: Object.keys(x.geometry.joints) })),
        environments: () => Object.values(p.environments).map(x => ({ id: x.id, name: x.name, kind: x.env.kind, props: x.env.props.map(pp => pp.id) })),
        episodes: () => Object.values(p.episodes).map(e => ({ id: e.id, name: e.name, scenes: e.episode.scenes, status: e.episode.status, legacy: !!e.legacy })),
        animations: () => ({ clips: Object.keys(lib.clips), locomotion: Object.keys(lib.loco), note: 'Más los de animations/humanoid/ del proyecto y characters/<id>/animations/' }),
        expressions: () => Object.keys(lib.expressions),
        sounds: () => Object.values(p.sfx).map(s => ({ id: s.id, kind: s.kind, generator: s.generator, license: s.license.id })),
        music: () => Object.values(p.music).map(m => ({ id: m.id, tempo: m.tempo, key: `${m.key} ${m.mode}`, mood: m.mood }))
      };
      if (!map[sub]) throw new Error('Tipo de lista desconocido');
      return out(map[sub]());
    }
    case 'validate': {
      if (sub === 'episode') { const r = await validateEpisode(a1, a2); for (const c of r.checks) console.log(`${c.ok ? 'OK  ' : c.severity === 'warning' ? 'WARN' : 'FAIL'} ${c.id} ${JSON.stringify(c.detail).slice(0, 200)}`); console.log(r.report); if (!r.ok) process.exitCode = 1; return; }
      const p = await loadProject(sub);
      const issues = [...p.issues, ...await validateStory(p)];
      // compile every scene with estimated speech to catch timing/reference errors early
      const lib = assetLibrary(p);
      for (const ep of Object.values(p.episodes)) for (const [sid, sc] of Object.entries(ep.scenes)) { try { const r = compileScene(sc, lib); for (const w of r.warnings.filter(w => !w.startsWith('Duración estimada'))) issues.push({ level: 'warning', path: `${ep.dir}/scenes/${sid}/scene.json`, message: w }); } catch (e) { issues.push({ level: 'error', path: `${ep.dir}/scenes/${sid}/scene.json`, message: (e as Error).message }); } }
      printIssues(issues);
      const errors = issues.filter(i => i.level === 'error').length;
      console.log(`${Object.keys(p.characters).length} personajes, ${Object.keys(p.props).length} objetos, ${Object.keys(p.environments).length} escenarios, ${Object.keys(p.episodes).length} episodios — ${errors} errores, ${issues.length - errors} avisos`);
      if (errors) process.exitCode = 1;
      return;
    }
    case 'preview': {
      const p = await loadProject(a1);
      const outDir = join(p.root, 'generated', 'preview');
      const w = Number(flag('width', '1600')), h = Number(flag('height', '900'));
      if (sub === 'character') {
        const files = await renderStills(p, [
          { resolved: turnaroundScene(p, a2), times: [1], labels: [`${a2}-turnaround`] },
          { resolved: expressionScene(p, a2, ['neutral', 'joy', 'smile', 'laugh', 'sad', 'angry']), times: [1.2], labels: [`${a2}-expresiones-1`] },
          { resolved: expressionScene(p, a2, ['fear', 'surprise', 'nervous', 'thinking', 'smirk', 'worried']), times: [1.2], labels: [`${a2}-expresiones-2`] }
        ], outDir, w, h);
        return out(files);
      }
      if (sub === 'scene') {
        const ep = p.episodes[a2]; const sc = ep?.scenes[a3];
        if (!sc) throw new Error('Escena no encontrada');
        const plan = await compileEpisode(a1, a2, { width: w, height: h, fps: 24, scenes: [a3], speech: has('tts') ? 'tts' : 'estimate' });
        const resolved = plan.resolved[0];
        const times = (flag('times') ?? resolved.shots.map(s => ((s.start + s.end) / 2).toFixed(2)).join(',')).split(',').map(Number);
        const files = await renderStills(p, [{ resolved, times, labels: times.map(t => `${a2}-${a3}-t${t.toFixed(2)}`) }], outDir, w, h);
        const sheet = await contactSheet(files, join(outDir, `${a2}-${a3}-contacto.png`), 4, 480);
        return out({ files, sheet });
      }
      throw new Error('Uso: studio preview character|scene ...');
    }
    case 'compile': { const settings = renderSettings(); const r = await compileEpisode(a1, a2, settings, e => console.log(JSON.stringify(e))); return out({ durationSec: r.plan.durationSec, frames: r.plan.frames, scenes: r.plan.scenes.map(s => ({ id: s.id, duration: +s.duration.toFixed(2), warnings: s.warnings })), shots: r.plan.shots.length, plan: join(r.project.root, r.project.episodes[a2].dir, 'generated', 'episode-plan.json') }); }
    case 'render': { const r = await renderEpisode(a1, a2, renderSettings(), e => console.log(JSON.stringify(e))); return out({ video: r.video, audio: r.audio, srt: r.srt, metadata: r.metadata, storyboard: r.storyboard.length, stats: r.stats }); }
    case 'produce': {
      const p = await loadProject(sub);
      const issues = [...p.issues, ...await validateStory(p)].filter(i => i.level === 'error');
      if (issues.length) { printIssues(issues); process.exitCode = 1; return; }
      const r = await renderEpisode(sub, a1, renderSettings(), e => console.log(JSON.stringify(e)));
      const v = await validateEpisode(sub, a1);
      for (const c of v.checks) console.log(`${c.ok ? 'OK  ' : c.severity === 'warning' ? 'WARN' : 'FAIL'} ${c.id}`);
      out({ video: r.video, report: v.report, ok: v.ok });
      if (!v.ok) process.exitCode = 1;
      return;
    }
    case 'story': {
      if (sub === 'status') { const p = await loadProject(a1); const s = await loadStory(p); printIssues(await validateStory(p)); return out({ facts: s.canon.facts.map(f => `${f.id} [${f.status}/${f.since}] ${f.text}`), confirmed: s.canon.confirmedEpisodes, relationships: s.canon.relationships.map(r => `${r.a}→${r.b} ${r.type} confianza ${r.trust.toFixed(2)}`), knowledge: Object.fromEntries(Object.entries(s.canon.characters).map(([k, v]) => [k, v.knows])), drafts: Object.entries(s.episodes).filter(([, e]) => e.status !== 'confirmed').map(([k]) => k) }); }
      if (sub === 'confirm') return out(await confirmEpisode(a1, a2));
      if (sub === 'amend') return out(await amendFact(a1, a2, flag('text') ?? '', flag('reason') ?? ''));
      if (sub === 'revert') return out(await revertStory(a1));
      throw new Error('Uso: studio story status|confirm|amend|revert');
    }
    case 'migrate': return out(await migrateProject(sub));
    case 'export': { if (sub !== 'character' && sub !== 'prop') throw new Error('Uso: studio export character|prop <project> <id>'); return out(await exportGlb(a1, sub, a2)); }
    case 'history': { const p = await loadProject(sub); const f = await readFile(join(p.root, a1), 'utf8').catch(() => null); if (f !== null) await recordVersion(sub, a1, f, 'disk'); return out(await listVersions(sub, a1)); }
    case 'revert': return out({ reverted: a1, to: a2, bytes: (await revertTo(sub, a1, a2)).length });
    case 'voices': return out(await listOneCoreVoices());
    case 'say': {
      const p = await loadProject(sub); const c = p.characters[a1];
      if (!c?.voice) throw new Error('Personaje sin voice.json v2');
      const r = await synthesize({ text: a2, voice: c.voice, emotion: flag('emotion') }, join(p.root, 'generated', 'audio', 'voices'), flag('emotion'));
      const dest = join(p.root, 'generated', `say-${a1}.wav`); await copyFile(r.file, dest);
      return out({ file: dest, duration: r.duration, alignment: r.alignment.method, words: r.alignment.words.map(w => `${w.text}@${w.start.toFixed(2)}`).join(' ') });
    }
    default: throw new Error(`Comando desconocido: ${cmd}\n${HELP}`);
  }
}
function renderSettings(): RenderSettings {
  const draft = has('draft');
  return { width: Number(flag('width', draft ? '640' : '1920')), height: Number(flag('height', draft ? '360' : '1080')), fps: Number(flag('fps', '24')), maxSeconds: flag('max-seconds') ? Number(flag('max-seconds')) : undefined, crf: Number(flag('crf', draft ? '23' : '18')), preset: flag('preset', draft ? 'veryfast' : 'medium'), scenes: flag('scenes')?.split(','), speech: has('estimate-speech') ? 'estimate' : 'tts' };
}
main().catch(e => { console.error(`Error: ${(e as Error).message}`); process.exitCode = 1; });
void readFile; void writeFile; void rename;
