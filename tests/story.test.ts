import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tempWorkspace } from './helpers.ts';

const ws = tempWorkspace();
const { loadProject } = await import('../src/pipeline/project.ts');
const { validateStory, confirmEpisode, amendFact, revertStory, loadStory } = await import('../src/pipeline/story.ts');
const scenePath = join(ws, 'el-ultimo-turno/episodes/ep-001/scenes/sc-001/scene.json');

test('un personaje no puede usar información que todavía no ha recibido', async () => {
  const sc = JSON.parse(readFileSync(scenePath, 'utf8'));
  sc.dialogue[0].knowledge = ['fusible-oculto']; // revealed only later, in sc-002
  writeFileSync(scenePath, JSON.stringify(sc));
  const issues = await validateStory(await loadProject('el-ultimo-turno'));
  assert.ok(issues.some(i => i.level === 'error' && /bruno usa "fusible-oculto"/.test(i.message)), JSON.stringify(issues));
  sc.dialogue[0].knowledge = ['inspeccion-manana']; writeFileSync(scenePath, JSON.stringify(sc));
  assert.deepEqual((await validateStory(await loadProject('el-ultimo-turno'))).filter(i => i.level === 'error'), []);
});

test('confirmar un episodio actualiza canon, conocimiento y relaciones; persisten para los siguientes', async () => {
  const r = await confirmEpisode('el-ultimo-turno', 'ep-001');
  assert.ok(r.confirmed.includes('ep-001'));
  const { canon } = await loadStory(await loadProject('el-ultimo-turno'));
  assert.ok(canon.facts.some(f => f.id === 'fusible-oculto' && f.status === 'canon' && f.since === 'ep-001'));
  assert.ok(canon.characters.lara.knows.includes('nucleo-quemado'));
  const rel = canon.relationships.find(x => x.a === 'lara' && x.b === 'bruno')!;
  assert.ok(Math.abs(rel.trust - 0.5) < 1e-9 && rel.history.length === 1);
  await assert.rejects(confirmEpisode('el-ultimo-turno', 'ep-001'), /ya está confirmado/);
});

test('el canon no se modifica retroactivamente sin operación explícita; amend y revert quedan registrados', async () => {
  const canonPath = join(ws, 'el-ultimo-turno/story/canon.json');
  const canon = JSON.parse(readFileSync(canonPath, 'utf8'));
  const original = readFileSync(canonPath, 'utf8');
  canon.facts[0].text = 'Lara fundó el taller ella sola.';
  writeFileSync(canonPath, JSON.stringify(canon));
  assert.ok((await validateStory(await loadProject('el-ultimo-turno'))).some(i => /sin operación explícita/.test(i.message)));
  writeFileSync(canonPath, original);
  await amendFact('el-ultimo-turno', 'taller-7', 'Bruno y Lara fundaron el Taller 7 hace siete años.', 'Corrección de continuidad');
  let st = await loadStory(await loadProject('el-ultimo-turno'));
  assert.equal(st.canon.facts.find(f => f.id === 'taller-7')!.amended.length, 1);
  assert.deepEqual((await validateStory(await loadProject('el-ultimo-turno'))).filter(i => i.level === 'error'), []);
  await revertStory('el-ultimo-turno'); // undo the amendment
  st = await loadStory(await loadProject('el-ultimo-turno'));
  assert.match(st.canon.facts.find(f => f.id === 'taller-7')!.text, /seis años/);
});
