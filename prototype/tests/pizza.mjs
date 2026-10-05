// 실제 발판 진입·오답 복구·문 통과·새 경기 초기화를 검증한다.
import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { courseRoute, runRetry } from './course-helpers.mjs';
import { buildPizza, orderLabel, pieceCounts, bonusCount } from '../src/levels/pizza.js';
import { rngFor } from '../src/levels/variants.js';
const T = tally('분수 피자 공장');
// 기존 시험은 주문량이 1/2, 3/4, 한 판일 때를 기준으로 쓰였으므로 주문량을 고정해서 만든다 (매 판 달라지는 주문량은 아래에서 따로 시험)
const make = () => {
  const world = new PhysicsWorld();
  const level = buildPizza(new THREE.Scene(), world, { seed: 3 });
  [4, 6, 8].forEach((t, i) => level.orders[i].setTarget(t));
  return { world, level };
};
function tap(m, order, index) {
  const pad = order.pads[index];
  m.level.update(0, 1 / 120, { pos: new THREE.Vector3(pad.x, 1.15, pad.z) });
  m.level.update(0, 1 / 120, { pos: new THREE.Vector3(0, 1, order.z + 18) });
}
const m = make();
const first = m.level.orders[0];
tap(m, first, 1);
m.level.update(0, 1 / 120, { pos: new THREE.Vector3(first.pads[1].x, 1.15, first.pads[1].z) });
for (let i = 0; i < 120; i++) m.level.update(i / 120, 1 / 120, { pos: new THREE.Vector3(first.pads[1].x, 1.15, first.pads[1].z) });
T.check('서 있는 동안 한 번만 추가', { ok: first.total === 4 && first.solved });
const blocked = make();
T.check('조합 전 문은 막힘', { ok: !run(blocked, [0, 1, -33], [[0, -41]], { maxT: 3 }).ok });
const over = make();
const second = over.level.orders[1];
tap(over, second, 0); tap(over, second, 0);
T.check('과량은 문을 열지 않음', { ok: second.total === 8 && !second.solved });
tap(over, second, 3); // 한 조각 취소
T.check('마지막 조각 취소', { ok: second.total === 4 });
tap(over, second, 4); // 처음부터
T.check('처음부터', { ok: second.total === 0 && second.pieces.length === 0 });
tap(over, second, 0); tap(over, second, 1);
T.check('1/2 + 1/4 = 3/4', { ok: second.solved && second.total === 6 });
for (const [count, index] of [[1, 0], [2, 1], [4, 2]]) {
  const eq = make();
  for (let i = 0; i < count; i++) tap(eq, eq.level.orders[0], index);
  T.check(`반 판 동치 조합 ${count}`, { ok: eq.level.orders[0].solved });
}
for (const seed of [1, 5, 99]) {
  const path = make();
  path.level.setSeed(seed);
  for (const order of path.level.orders) {
    const unit = order.units.at(-1);
    for (let i = 0; i < order.target / unit; i++) tap(path, order, order.units.length - 1);
  }
  path.level.update(1, 1, null); // 문이 열린 뒤 경로 확인
  T.check(`전체 경로 ${seed}`, runRetry(path, [0, 0, 5], courseRoute(path.level)));
  T.check(`결승 이벤트 ${seed}`, { ok: path.level.finished });
  path.level.resetProgress();
  T.check(`초기화 ${seed}`, { ok: !path.level.finished && path.level.orders.every((o) => !o.solved && o.total === 0) });
}
// 이미 완성한 주문은 낙하·다른 발판 조작으로 닫히지 않는다. 완성 뒤에도 조각을 바꿔 다른 조합을 해 볼 수 있다(보너스).
tap(over, second, 4);
T.check('완성 주문 유지: 처음부터로 다시 해도 완성(문 열림) 그대로', { ok: second.solved && second.total === 0, why: `${second.solved} ${second.total}` });
// 위치를 직접 지정하는 조합 시험과 별도로 실제 걷기로 각 주문 해결.
const walking = make();
for (const order of walking.level.orders) {
  const index = order.units.indexOf(2);
  const pad = order.pads[index];
  const targets = [];
  for (let i = 0; i < order.target / 2; i++) targets.push([pad.x, pad.z], [pad.x, pad.z + 4]);
  targets.push([0, order.z + 2], [0, order.z - 8]);
  T.check(`직접 걸어 주문 ${order.target}/8`, run(walking, [0, 1, order.z + 17], targets));
  T.check(`걸어서 주문 완성 ${order.target}/8`, { ok: order.solved });
}

// ── 매 판 다른 주문 (시드) ──
const POOLS = [[2, 4], [4, 6], [6, 8]];
const seen = new Set();
for (let seed = 1; seed <= 24; seed++) {
  const w = new PhysicsWorld();
  const level = buildPizza(new THREE.Scene(), w, { seed });
  const targets = level.orders.map((o) => o.target);
  seen.add(targets.join());
  T.check(`시드 ${seed}: 주문량이 후보 안`, { ok: targets.every((t, i) => POOLS[i].includes(t)), why: targets.join() });
  T.check(`시드 ${seed}: 제목이 주문량과 일치`, { ok: level.orders.every((o) => o.heading.text.includes(orderLabel(o.target))), why: level.orders.map((o) => o.heading.text).join('/') });
  T.check(`시드 ${seed}: HUD 구간 이름에 주문량`, { ok: level.orders.every((o) => level.sectionAt(o.z - 1).includes(orderLabel(o.target))), why: level.orders.map((o) => level.sectionAt(o.z - 1)).join('/') });
  // 모든 주문량은 조각으로 만들 수 있고 다른 양은 풀리지 않는다
  for (const o of level.orders) {
    const unit = o.units.at(-1);
    const l2 = buildPizza(new THREE.Scene(), new PhysicsWorld(), { seed });
    const o2 = l2.orders[o.index];
    for (let i = 0; i < o2.target - 1; i++) tap({ level: l2 }, o2, o2.units.length - 1);
    if (unit === 1 && o2.target > 1) T.check(`시드 ${seed} 주문 ${o.index + 1}: 한 조각 모자라면 미완성`, { ok: !o2.solved, why: `${o2.total}/${o2.target}` });
    tap({ level: l2 }, o2, o2.units.length - 1);
    T.check(`시드 ${seed} 주문 ${o.index + 1}: 조각을 모아 완성(${o2.target}/8)`, { ok: o2.solved && o2.total === o2.target, why: `${o2.total}/${o2.target}` });
  }
}
T.check('시드에 따라 다른 주문 조합이 나옴', { ok: seen.size >= 4, why: `${seen.size}가지` });
{
  const a = buildPizza(new THREE.Scene(), new PhysicsWorld(), { seed: 5 });
  const same = buildPizza(new THREE.Scene(), new PhysicsWorld(), { seed: 5 });
  T.check('같은 시드는 같은 주문(모든 화면이 같음)', { ok: a.orders.map((o) => o.target).join() === same.orders.map((o) => o.target).join() });
  const before = a.orders.map((o) => o.target).join();
  tap({ level: a }, a.orders[0], 0);
  a.resetProgress();
  T.check('처음부터는 주문량을 유지하고 조각만 비움', { ok: a.orders.map((o) => o.target).join() === before && a.orders[0].total === 0 });
  let changed = false;
  for (let s = 6; s < 30 && !changed; s++) { a.setSeed(s); changed = a.orders.map((o) => o.target).join() !== before; }
  T.check('새 경기(시드)에서 주문량이 바뀌고 조각은 초기화', { ok: changed && a.orders.every((o) => o.total === 0 && !o.solved) });
}
// ── 보너스 요청(선택): 같은 양을 정해진 조각 수로. 가장 적은 개수(큰 조각만)는 요청하지 않는다 ──
T.check('조각 수 계산: 반 판(1/2·1/4·1/8)', { ok: pieceCounts([4, 2, 1], 4).join() === '1,2,3,4', why: pieceCounts([4, 2, 1], 4).join() });
T.check('조각 수 계산: 3/4판(1/4·1/8만)', { ok: pieceCounts([2, 1], 6).join() === '3,4,5,6', why: pieceCounts([2, 1], 6).join() });
for (let seed = 1; seed <= 30; seed++) {
  const w = new PhysicsWorld();
  const level = buildPizza(new THREE.Scene(), w, { seed });
  for (const o of level.orders) {
    const counts = pieceCounts(o.units, o.target, 6);
    T.check(`시드 ${seed} 주문 ${o.index + 1}: 보너스 조각 수는 만들 수 있고 최소 개수가 아님`, { ok: counts.includes(o.bonus) && (counts.length === 1 || o.bonus > counts[0]) && o.bonus <= 6, why: `${o.bonus} in ${counts}` });
  }
}
{
  const seenBonus = new Set();
  for (let seed = 1; seed <= 30; seed++) seenBonus.add(buildPizza(new THREE.Scene(), new PhysicsWorld(), { seed }).orders.map((o) => `${o.target}:${o.bonus}`).join());
  T.check('시드에 따라 보너스 요청이 달라짐', { ok: seenBonus.size >= 6, why: `${seenBonus.size}가지` });
}
// 보너스 만들기: 큰 조각으로 먼저 완성(문 열림, 별 없음) → 처음부터 → 보너스 개수로 다시 → 별이 나타나 얻음
function makeWith(order, n) {
  // order.units로 target을 정확히 n개 조각으로 만드는 조합 하나 찾기
  const res = [];
  const walk = (i, left, pick) => {
    if (res.length) return;
    if (left === 0 && pick.length === n) { res.push([...pick]); return; }
    if (i >= order.units.length || pick.length >= n) return;
    for (let k = Math.floor(left / order.units[i]); k >= 0; k--) walk(i + 1, left - k * order.units[i], [...pick, ...Array(k).fill(i)]);
  };
  walk(0, order.target, []);
  return res[0];
}
for (const seed of [2, 9, 17]) {
  const w = new PhysicsWorld();
  const level = buildPizza(new THREE.Scene(), w, { seed });
  const mm = { level, world: w };
  for (const o of level.orders) {
    const minimal = makeWith(o, pieceCounts(o.units, o.target)[0]);
    for (const i of minimal) tap(mm, o, i);
    T.check(`시드 ${seed} 주문 ${o.index + 1}: 가장 적은 조각으로 완성 → 문 열림, 보너스 아님`, { ok: o.solved && !o.bonusDone && o.star.mesh.position.y < -100, why: `${o.pieces.length}개, 보너스 ${o.bonus}` });
    tap(mm, o, o.pads.findIndex((p) => p.unit === 0));
    for (const i of makeWith(o, o.bonus)) tap(mm, o, i);
    T.check(`시드 ${seed} 주문 ${o.index + 1}: 보너스 개수(${o.bonus})로 다시 만들면 별이 나타남`, { ok: o.solved && o.bonusDone && o.star.mesh.position.y > 0, why: `${o.pieces.length}개 ${o.total}/${o.target}` });
    level.update(1, 1 / 120, { pos: o.star.mesh.position.clone().setY(1) });
    T.check(`시드 ${seed} 주문 ${o.index + 1}: 보너스 별 획득`, { ok: o.star.got, why: '' });
  }
  level.resetProgress();
  T.check(`시드 ${seed}: 초기화하면 보너스·별 처음으로`, { ok: level.orders.every((o) => !o.bonusDone && !o.star.got && o.star.mesh.position.y < -100), why: '' });
}
T.report();
