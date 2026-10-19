import assert from 'node:assert/strict';
import { THREE, PhysicsWorld, Player, S, run } from './harness.mjs';
import { buildSlideCanyon } from '../src/levels/slidecanyon.js';

const fresh = seed => { const world = new PhysicsWorld(); return { world, level: buildSlideCanyon(new THREE.Scene(), world, { seed }) }; };
function walk(m, start, targets, { limit = 150, before = () => {} } = {}) {
  const p = new Player(new THREE.Scene()); p.respawn(new THREE.Vector3(...start));
  let target = 0, distance = 0, time = 0, fall = false;
  const previous = p.pos.clone();
  for (; time < limit && target < targets.length; time += S) {
    const [x, z] = targets[target], dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { target++; continue; }
    before(p, time);
    m.level.update(time, S, p);
    p.step(S, { x: dx / d, y: -dz / d }, 0, m.world, m.level.windAt, m.level.gravityAt);
    distance += p.pos.distanceTo(previous); previous.copy(p.pos);
    if (p.pos.y < -13) { fall = true; break; }
  }
  return { ok: target === targets.length && !fall, distance, time, target, pos: p.pos.toArray(), p };
}
for (const seed of [0, 1, 2, 3, 71, 72]) {
  const m = fresh(seed);
  const r = walk(m, m.level.spawn.toArray(), m.level.routes.basic);
  console.log('기본 길', seed, { ok: r.ok, length: r.distance, time: r.time, target: r.target, pos: r.pos, stars: m.level.stars.filter(s => s.got).length });
  assert.ok(r.ok && m.level.finished, `기본 완주 ${seed}`);
  assert.equal(m.level.stars.filter(s => s.got).length, 0, '별 없이 기본 완주');
  assert.ok(r.distance >= 150 && r.distance <= 250, '실제 걸은 기본 길이 150~250m');
}
for (const seed of [0, 1]) {
  const m = fresh(seed);
  const route = [...m.level.routes.outside, ...m.level.routes.basic.slice(8)];
  const r = walk(m, m.level.spawn.toArray(), route);
  console.log('바깥길', seed, { ok: r.ok, length: r.distance, pos: r.pos });
  assert.ok(r.ok && m.level.finished, '감속을 놓친 바깥길도 점프 없이 완주');
  assert.ok(r.distance >= 150 && r.distance <= 250, '바깥 기본 갈래도 실제 150~250m');
  assert.ok(m.level.stars[1].got, '바깥 굽이 별 도달');
}
const choices = [];
for (const seed of [0, 1]) {
  const m = fresh(seed), r = walk(m, [5, -5, -58], [[5, -75]]);
  assert.ok(r.ok, '같은 굽이 접근 입력 통과');
  choices.push({ speed: r.p.vel.length(), time: r.time });
}
console.log('시드별 굽이 진입', choices);
assert.ok(Math.abs(choices[0].speed - choices[1].speed) > 1, '배치가 달라지면 같은 접근의 속도 결과가 달라짐');

// 실제 이동으로 감속한 첫 언덕 시도와 실패 뒤 같은 플레이어의 복귀.
{
  const m = fresh(0), p = new Player(new THREE.Scene()); p.respawn(new THREE.Vector3(24, -5, -105));
  let entered = false, crest = false;
  for (let t = 0; t < 14; t += S) {
    const y = p.pos.z < -126 && p.pos.z > -135 ? -1 : 1;
    if (p.pos.z <= -135) entered = true;
    m.level.update(t, S, p);
    p.step(S, { x: 0, y: entered ? 0 : y }, 0, m.world);
    if (p.pos.z < -144 && p.pos.y > -8.2) { crest = true; break; }
    if (entered && p.pos.z < -136 && p.vel.z > 0.1) break;
  }
  assert.ok(entered && !crest, '감속한 진입은 언덕을 못 넘음');
  const path = [[34, -131], [34, -156], [34, -165], [34, -181], [34, -194], [29, -199]];
  let target = 0;
  for (let t = 0; t < 70 && target < path.length; t += S) {
    const [x, z] = path[target], dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { target++; continue; }
    m.level.update(t, S, p); p.step(S, { x: dx / d, y: -dz / d }, 0, m.world);
    assert.ok(p.pos.y > -13, '실패 뒤 복귀 중 낙하 없음');
  }
  assert.ok(target === path.length && m.level.finished, '실패한 플레이어 그대로 우회 완주');
}
for (const seed of [0, 1]) {
  const m = fresh(seed);
  const r = walk(m, [29, -5, -105], m.level.routes.hill);
  console.log('관성 연결', seed, { ok: r.ok, pos: r.pos, target: r.target });
  assert.ok(r.ok, '실제 내리막 진입으로 관성 연결 통과');
  const full = fresh(seed);
  const connected = walk(full, full.level.spawn.toArray(), [...full.level.routes.basic.slice(0, 8), ...full.level.routes.hill, ...full.level.routes.basic.slice(12)]);
  console.log('관성 지름길 전체', seed, { ok: connected.ok, length: connected.distance, time: connected.time });
  assert.ok(connected.ok && full.level.finished && connected.distance >= 150 && connected.distance <= 250, '관성 지름길도 출발~결승 150~250m');
  assert.equal(full.level.stars.filter(s => s.got).length, 0, '지름길만 이용해도 별 자동 획득 없음');
}
for (const [name, start, route, starIndex] of [
  ['감속 전망대', [0, 0, 4], [[5, -12], [14, -15], [15, -18], [5, -24]], 0],
  ['언덕 전망대', [29, -5, -105], [[24, -105], [24, -127], [24, -135], [24, -147], [17, -150], [24, -151]], 2],
]) {
  const m = fresh(0), r = run(m, start, route, { nojump: true, maxT: 70 });
  console.log(name, r, m.level.stars[starIndex].got);
  assert.ok(r.ok && m.level.stars[starIndex].got, `${name} 걷기 도달·복귀`);
}
for (const checkpoint of fresh(0).level.checkpoints) {
  const m = fresh(0), p = new Player(new THREE.Scene()); p.respawn(checkpoint.respawn);
  for (let t = 0; t < 2; t += S) { m.level.update(t, S, p); p.step(S, { x: 0, y: 0 }, 0, m.world); }
  assert.ok(p.pos.distanceTo(checkpoint.respawn) < 0.03, `${checkpoint.name} 안전 정지`);
}
for (const [start, target] of [
  [[34, -10, -130], [37, -133]], [[17, -8.15, -150], [12, -151]],
]) {
  const m = fresh(0), p = new Player(new THREE.Scene()); p.respawn(new THREE.Vector3(...start));
  let messages = 0; m.level.onMessage = () => messages++;
  let distance = 0; const previous = p.pos.clone();
  for (let t = 0; t < 10 && !messages; t += S) {
    const dx = target[0] - p.pos.x, dz = target[1] - p.pos.z, d = Math.hypot(dx, dz);
    m.level.update(t, S, p); p.step(S, { x: dx / d, y: -dz / d }, 0, m.world);
    if (!messages) distance += p.pos.distanceTo(previous);
    previous.copy(p.pos);
  }
  assert.equal(messages, 1, '선택 재도전 발판은 올라설 때 한 번 반응');
  assert.ok(distance < 20, '전망대·안전 길에서 재도전 발판까지 실제 이동 20m 이내');
  for (let t = 0; t < 2; t += S) { m.level.update(t, S, p); p.step(S, { x: 0, y: 0 }, 0, m.world); }
  assert.ok(p.pos.distanceTo(new THREE.Vector3(24, -5, -105)) < 0.03, '재도전은 가속 전 평지에서 안전 정지');
  assert.equal(messages, 1, '복귀 뒤 자동 반복 반응 없음');
}
{
  const m = fresh(0);
  const first = m.world.colliders.filter(c => c.slideSurface).map(c => c.slideSurface.drag);
  m.level.setSeed(1);
  assert.notDeepEqual(m.world.colliders.filter(c => c.slideSurface).map(c => c.slideSurface.drag), first, '시드 변경 시 표면 배치 갱신');
  m.level.setSeed(0); m.level.resetProgress();
  assert.deepEqual(m.world.colliders.filter(c => c.slideSurface).map(c => c.slideSurface.drag), first, '원래 시드 복원');
  assert.equal(m.level.stars.filter(s => s.got).length, 0, '새 라운드 별 초기화');
}
console.log('미끄럼 협곡 정식 코스: 통과');
