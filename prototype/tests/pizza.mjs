// 실제 발판 진입·오답 복구·문 통과·새 경기 초기화를 검증한다.
import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { buildPizza } from '../src/levels/pizza.js';
const T = tally('분수 피자 공장');
const make = () => {
  const world = new PhysicsWorld();
  return { world, level: buildPizza(new THREE.Scene(), world, { seed: 3 }) };
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
  T.check(`전체 경로 ${seed}`, run(path, [0, 0, 5], [[0, -13], [0, -21], [0, -34], [0, -47], [0, -67], [0, -80], [0, -100], [0, -113], [0, -124]]));
  T.check(`결승 이벤트 ${seed}`, { ok: path.level.finished });
  path.level.resetProgress();
  T.check(`초기화 ${seed}`, { ok: !path.level.finished && path.level.orders.every((o) => !o.solved && o.total === 0) });
}
// 이미 완성한 주문은 낙하·다른 발판 조작으로 닫히지 않는다.
tap(over, second, 4);
T.check('완성 주문 유지', { ok: second.solved && second.total === 6 });
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
T.report();
