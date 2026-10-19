// Registration compatibility: reconstruct the current index with only marketfire's two additions removed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THREE, PhysicsWorld } from './harness.mjs';
import { MAPS } from '../src/levels/index.js';
const indexUrl = new URL('../src/levels/index.js', import.meta.url);
const source = readFileSync(indexUrl, 'utf8').split('\n').filter((line) => !line.includes("from './marketfire.js'") && !line.includes("id: 'marketfire'")).join('\n');
const resolved = source.replace(/from '(\.\.?\/[^']+)'/g, (_, path) => `from '${new URL(path, indexUrl).href}'`);
const before = (await import(`data:text/javascript,${encodeURIComponent(resolved)}`)).MAPS;
function snapshot(m, seed) {
  const world = new PhysicsWorld(), level = m.build(new THREE.Scene(), world, { seed });
  const out = { spawn: level.spawn.toArray(), checkpoints: level.checkpoints.map((c) => [c.name, c.respawn.toArray()]), stars: level.stars.map((s) => s.mesh.position.toArray()), colliders: world.colliders.map((c) => [c.half.toArray(), c.matrix.elements.slice(), c.enabled, c.kind]) };
  level.dispose(); return out;
}
assert.equal(MAPS.length, before.length + 1);
let count = 0;
for (const m of before) for (const seed of [3, 17]) {
  const baseline = snapshot(m, seed);
  assert.deepEqual(snapshot(m, seed), baseline, `${m.id}: baseline reproducibility`);
  const actual = snapshot(MAPS.find((n) => n.id === m.id), seed);
  assert.deepEqual(actual, baseline, `${m.id}: registration changed an existing map`);
  const mutant = structuredClone(actual); mutant.spawn[0] += 0.1;
  assert.notDeepEqual(mutant, baseline, 'comparison must detect intentional position changes');
  count++;
}
console.log(`시장 마을 등록 호환: 기존 ${before.length}항목 × 2시드 = ${count} 배치 동일, 기준선 재현·변경 감지 확인`);
