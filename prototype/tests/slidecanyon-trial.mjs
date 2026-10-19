import assert from 'node:assert/strict';
import { THREE, PhysicsWorld, Player, S, run } from './harness.mjs';
import { buildSlideCanyonTrial } from '../src/levels/slidecanyon-trial.js';

function fresh() {
  const world = new PhysicsWorld();
  return { world, level: buildSlideCanyonTrial(new THREE.Scene(), world) };
}
function bot(m, start) {
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(...start));
  return p;
}
function step(m, p, move = { x: 0, y: 0 }, count = 1, dt = S) {
  for (let i = 0; i < count; i++) {
    m.level.update(i * dt, dt, p);
    p.step(dt, move, 0, m.world, m.level.windAt, m.level.gravityAt);
    assert.ok(Number.isFinite(p.pos.x + p.pos.y + p.pos.z));
  }
}
// 동일한 실제 입력으로 평지에서 달린 뒤 놓는다. 속도 직접 주입 없음.
const stops = [];
for (const x of [-24, -14, -4]) {
  const m = fresh(), p = bot(m, [x, 0, 65]);
  // 같은 약 6m/s를 실제 입력으로 만든다. 속도 변수에 정답을 직접 넣지 않는다.
  for (let i = 0; i < 10000 && -p.vel.z < 6; i++) step(m, p, { x: 0, y: 1 }, 1, 1 / 1200);
  const initialSpeed = -p.vel.z;
  assert.ok(initialSpeed >= 6 && initialSpeed < 6.05, '같은 진입 속도로 표면 비교');
  const start = p.pos.z;
  step(m, p, undefined, 9 / S);
  stops.push({ x, initialSpeed, distance: start - p.pos.z, speed: Math.hypot(p.vel.x, p.vel.z) });
  assert.ok(p.grounded && Math.abs(p.pos.y) < 0.02, '정지 거리는 평지 위에서 측정');
}
console.log('정지 거리', stops);
assert.ok(stops[0].distance > stops[1].distance + 2, '미끄럼과 거친 바닥의 정지 거리 차이');
assert.ok(stops.every(s => s.speed < 0.1), '입력을 놓으면 평지에서 정지');
for (const x of [-24, -14, -4]) {
  const m = fresh(), p = bot(m, [x, 0, 15]);
  step(m, p, undefined, 2 / S);
  assert.ok(p.pos.distanceTo(new THREE.Vector3(x, 0, 15)) < 0.02, '평지 자동 추진 없음');
}
for (const [name, start, route] of [
  ['보통 우회길 완주', [10, 0, 4], [[10, -5], [10, -28], [19, -31], [19, -55], [19, -65]]],
  ['감속 굽이', [-14, 0, -12], [[-14, -30], [-14, -39], [0, -41], [0, -56]]],
]) {
  const m = fresh();
  const result = run(m, start, route, { nojump: true, maxT: 60 });
  console.log(name, result);
  assert.ok(result.ok, `${name}: ${result.why}`);
  if (name === '보통 우회길 완주') assert.ok(m.level.finished, '실제 결승 판정');
}
// 같은 실제 출발에서 언덕 진입 시의 감속 여부만 달리한다.
function hill(brake, inputAfter = 0, dt = S) {
  const m = fresh(), p = bot(m, [10, 0, 4]);
  let reached = false, entry = null, minZ = p.pos.z;
  for (let i = 0; i < 12 / dt; i++) {
    let move = { x: 0, y: 1 };
    if (p.pos.z < -26 && p.pos.z > -35 && brake) move = { x: 0, y: -1 };
    if (p.pos.z <= -35 || entry !== null) {
      if (entry === null) entry = -p.vel.z;
      move = { x: 0, y: inputAfter };
    }
    step(m, p, move, 1, dt);
    minZ = Math.min(minZ, p.pos.z);
    if (p.pos.z < -44 && p.pos.y > -3.20 && p.grounded) { reached = true; break; }
    // 되밀려 내려온 뒤 다시 가속한 두 번째 시도와 첫 진입 결과를 섞지 않는다.
    if (entry !== null && p.pos.z < -36 && p.vel.z > 0.1) break;
  }
  const end = p.pos.toArray();
  // 언덕에서 멈춘 바로 그 플레이어를 옆길로 이동시킨다. 순간이동·부활로 대신하지 않는다.
  let recovered = !brake;
  if (brake) {
    const targets = [[19, -31], [19, -55], [19, -65]];
    let target = 0;
    for (let i = 0; i < 25 / dt && target < targets.length; i++) {
      const [x, z] = targets[target], dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { target++; continue; }
      step(m, p, { x: dx / d, y: -dz / d }, 1, dt);
      assert.ok(p.pos.y > -6, '실패 복귀 중 낙하 없음');
    }
    recovered = target === targets.length && m.level.finished;
  }
  return { reached, entry, minZ, end, recovered };
}
for (const dt of [1 / 120, 1 / 60]) for (const input of [0, 1]) {
  const fast = hill(false, input, dt), slow = hill(true, input, dt);
  console.log('언덕', { input, dt }, { fast, slow });
  assert.ok(fast.reached, '내리막에서 얻은 속도로 언덕 통과');
  assert.ok(!slow.reached && fast.minZ < slow.minZ - 0.5, '같은 입력에서도 진입 속도에 따라 통과 여부와 도달 위치 차이');
  assert.ok(slow.recovered, '언덕 실패 뒤 같은 플레이어로 안전 길 완주');
}
for (const dt of [1 / 120, 1 / 60]) {
  const m = fresh(), p = bot(m, [10, 0, 4]);
  while (p.pos.z > -28) step(m, p, { x: 0, y: 1 }, 1, dt);
  const initial = p.vel.length();
  assert.ok(initial > 10, '내리막에서 실제로 고속 진입');
  step(m, p, { x: 1, y: 0 }, 6 / dt, dt);
  assert.ok(p.pos.x < 24 && p.pos.y > -6, '고속 횡방향 이동에서 경계 관통·낙하 없음');
  p.respawn(m.level.spawn);
  step(m, p, undefined, 2 / dt, dt);
  assert.ok(p.vel.length() < 0.1 && p.pos.distanceTo(m.level.spawn) < 0.02, '고속 이동 뒤 부활 초기화');
}
for (const cp of fresh().level.checkpoints) {
  const m = fresh(), p = bot(m, cp.respawn.toArray());
  step(m, p, undefined, 2 / S);
  assert.ok(p.pos.distanceTo(cp.respawn) < 0.02, `안전 부활 ${cp.name}`);
}
for (const action of ['jump', 'dive']) {
  const m = fresh(), p = bot(m, [-24, 0, 65]);
  step(m, p, { x: 0, y: 1 }, 2 / S);
  if (action === 'jump') p.requestJump(); else p.requestDive();
  step(m, p, { x: 0, y: 1 }, 3 / S);
  assert.ok(p.grounded && p.state === 'normal' && Math.abs(p.pos.y) < 0.02, `${action} 뒤 착지·조작 복귀`);
  // 기존 보통 바닥으로 갈아탄 같은 플레이어에 새 표면 상태가 남지 않는다.
  const normal = fresh();
  p.respawn(new THREE.Vector3(-4, 0, 65));
  step(normal, p, { x: 0, y: 1 }, 1 / S);
  step(normal, p, undefined, 1 / S);
  assert.ok(p.ground?.slideSurface === null && p.vel.length() < 0.1, '다른 표면·부활에 효과 누출 없음');
}
console.log('미끄럼 협곡 시험 구간: 통과');
