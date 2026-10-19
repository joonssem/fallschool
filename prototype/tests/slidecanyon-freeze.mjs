// 본체의 실제 simulate 함수를 호출해 새 맵의 교사 정지 분기를 확인한다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THREE, PhysicsWorld, Player, S } from './harness.mjs';
import { buildSlideCanyon } from '../src/levels/slidecanyon.js';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = source.indexOf('function simulate(dt) {');
const end = source.indexOf('\nfunction frame(', start);
assert.ok(start > 0 && end > start, '본체 simulate 함수 확인');
const makeSimulation = new Function('net', 'level', 'player', 'world', 'game', 'input', 'cam', 'STEP', 'sharedTime',
  `let simTime = 0, acc = 0; ${source.slice(start, end)}; return simulate;`);
const world = new PhysicsWorld(), level = buildSlideCanyon(new THREE.Scene(), world);
const player = new Player(new THREE.Scene()); player.respawn(new THREE.Vector3(24, -5, -105));
for (let t = 0; t < 8 && player.pos.z > -127; t += S) {
  level.update(t, S, player); player.step(S, { x: 0, y: 1 }, 0, world);
}
assert.ok(player.vel.length() > 9, '정지 전 실제 내리막에서 속도 획득');
const net = { mode: 'student', room: { meta: { frozen: true } } };
let targetTime = 0;
const simulate = makeSimulation(net, level, player, world, { respawning: 0 }, { move: { x: 0, y: 0 } }, { yaw: 0 }, S, () => targetTime);
const position = player.pos.toArray(), velocity = player.vel.toArray();
for (let i = 0; i < 60; i++) { targetTime += 1 / 60; simulate(1 / 60); }
assert.deepEqual(player.pos.toArray(), position, '교사 정지 중 위치 고정');
assert.deepEqual(player.vel.toArray(), velocity, '교사 정지 중 속도 보존');
net.room.meta.frozen = false;
targetTime += 1 / 30;
simulate(1 / 30);
assert.notDeepEqual(player.pos.toArray(), position, '정지 해제 뒤 기존 속도로 이어감');
// 기존 맵은 새 옵션을 켜지 않았을 때 이전 물리 호출 흐름을 유지한다.
level.pauseOnFreeze = false; net.room.meta.frozen = true;
const before = player.pos.toArray(); targetTime += 1 / 30; simulate(1 / 30);
assert.notDeepEqual(player.pos.toArray(), before, '기존 옵션 없는 맵의 호출 흐름 유지');
console.log('미끄럼 협곡 본체 교사 정지·재개: 통과');
