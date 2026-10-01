// 바람 계산 시험: 고기압 → 저기압, 압력 차가 클수록 세다, 해풍·육풍 반전, 상한, 범위, 실제 플레이어가 바람에 밀리는지
import { THREE, PhysicsWorld, Player, tally, S } from './harness.mjs';
import { BoxCollider } from '../src/physics.js';
import { addWindFromPressure, makeWindAt, pressureAt, seaLandBreeze, isDay } from '../src/wind.js';

const T = tally('바람 계산');
const wind = (src, x, z, t = 0, opts) => {
  const o = { x: 0, z: 0 };
  addWindFromPressure(src, x, z, t, o, opts);
  return o;
};
const ok = (cond, why) => ({ ok: !!cond, why });

// 고기압 H(-10, 0)와 저기압 L(10, 0)
const HL = [{ x: -10, z: 0, sigma: 8, a: 1 }, { x: 10, z: 0, sigma: 8, a: -1 }];
for (const x of [-6, -3, 0, 3, 6]) {
  const w = wind(HL, x, 0, 0, { k: 20, maxSpeed: 99 });
  T.check(`H→L 사이 x=${x}: 바람이 고기압에서 저기압 쪽(+x)`, ok(w.x > 0 && Math.abs(w.z) < 1e-9, `바람 (${w.x}, ${w.z})`));
}
{
  const w = wind(HL, 0, 6, 0, { k: 20, maxSpeed: 99 }); // 옆으로 비껴 있어도 저기압 쪽 성분이 있다
  T.check('옆으로 비껴도 L 쪽 성분', ok(w.x > 0, `바람 (${w.x}, ${w.z})`));
}
T.check('고기압 중심에서는 바람이 약함', ok(Math.hypot(wind(HL, -10, 0, 0, { k: 20, maxSpeed: 99 }).x, 0) < wind(HL, -3, 0, 0, { k: 20, maxSpeed: 99 }).x * 0.2, '중심 바람이 약하지 않음'));
T.check('압력은 고기압 쪽이 더 큼', ok(pressureAt(HL, -10, 0) > pressureAt(HL, 0, 0) && pressureAt(HL, 0, 0) > pressureAt(HL, 10, 0), '압력 순서'));

// 압력 차가 클수록 (H·L이 가까울수록, 세기가 클수록) 바람이 세다
const pair = (d, a, sigma = 4) => [{ x: -d / 2, z: 0, sigma, a }, { x: d / 2, z: 0, sigma, a: -a }];
const spd = (src) => wind(src, 0, 0, 0, { k: 20, maxSpeed: 99 }).x;
// 가우스 압력은 중심에서 sigma 쯤 떨어진 곳이 가장 가파르다: H·L 간격이 2 sigma 이상이면 가까울수록 센 바람
T.check('H·L이 가까울수록(간격 ≥ 2σ) 센 바람', ok(spd(pair(8, 1)) > spd(pair(20, 1)), `${spd(pair(8, 1))} vs ${spd(pair(20, 1))}`));
T.check('압력이 가장 가파른 곳(≈σ)에서 가장 센 바람', ok(Math.abs(wind(HL, -10 + 8, 0, 0, { k: 20, maxSpeed: 99 }).x) > Math.abs(wind(HL, -10 + 1, 0, 0, { k: 20, maxSpeed: 99 }).x) && Math.abs(wind(HL, -10 + 8, 0, 0, { k: 20, maxSpeed: 99 }).x) > Math.abs(wind([HL[0]], -10 + 30, 0, 0, { k: 20, maxSpeed: 99 }).x), '가파른 곳'));
T.check('압력 차(세기)가 클수록 센 바람', ok(spd(pair(16, 2)) > spd(pair(16, 1)), `${spd(pair(16, 2))} vs ${spd(pair(16, 1))}`));
T.check('압력 차가 같으면 바람도 같음(좌우 대칭)', ok(Math.abs(wind(HL, -4, 0, 0, { k: 20, maxSpeed: 99 }).x - wind(HL, 4, 0, 0, { k: 20, maxSpeed: 99 }).x) < 1e-9, '대칭 아님'));

// 해풍·육풍: 바다(x=-12), 육지(x=12). 낮에는 바다 → 육지(+x), 밤에는 반대
const P = 24;
const breeze = seaLandBreeze({ sea: { x: -12, z: 0 }, land: { x: 12, z: 0 }, sigma: 9, strength: 1, period: P });
T.check('낮(해풍): 바다에서 육지로', ok(wind(breeze, 0, 0, P / 4, { k: 20, maxSpeed: 99 }).x > 0 && isDay(P / 4, P), '낮 바람 방향'));
T.check('밤(육풍): 육지에서 바다로', ok(wind(breeze, 0, 0, (3 * P) / 4, { k: 20, maxSpeed: 99 }).x < 0 && !isDay((3 * P) / 4, P), '밤 바람 방향'));
T.check('낮과 밤의 바람 크기는 같고 방향만 반대', ok(Math.abs(wind(breeze, 0, 0, P / 4, { k: 20, maxSpeed: 99 }).x + wind(breeze, 0, 0, (3 * P) / 4, { k: 20, maxSpeed: 99 }).x) < 1e-9, '대칭 아님'));
T.check('낮밤이 바뀌는 순간에는 바람이 거의 없음', ok(Math.abs(wind(breeze, 0, 0, P / 2, { k: 20, maxSpeed: 99 }).x) < 1e-6, '전환 순간 바람'));
T.check('주기가 지나면 같은 바람', ok(Math.abs(wind(breeze, 0, 0, 5, { k: 20 }).x - wind(breeze, 0, 0, 5 + P, { k: 20 }).x) < 1e-9, '주기 반복'));

// 상한: 아무리 강해도 조작 가능한 속도(maxSpeed)를 넘지 않고, 방향은 유지
for (const a of [1, 10, 1000]) {
  const w = wind(pair(6, a), 0, 0, 0, { k: 50, maxSpeed: 4 });
  T.check(`세기 ${a}: 상한 4 m/s 이하, +x 방향`, ok(Math.hypot(w.x, w.z) <= 4 && w.x > 0 && Number.isFinite(w.x), `속도 ${Math.hypot(w.x, w.z)}`));
}

// 범위: 바람 구역 밖과 높이 밖에서는 바람이 없다
{
  const at = makeWindAt(HL, { region: { xMin: -20, xMax: 20, zMin: -5, zMax: 5, yMin: 0, yMax: 8 }, k: 20 });
  const w = (x, y, z) => { const o = new THREE.Vector3(); at(new THREE.Vector3(x, y, z), o); return o; };
  T.check('구역 안', ok(w(0, 2, 0).x > 0, '구역 안 바람 없음'));
  T.check('구역 밖(z)', ok(w(0, 2, 9).x === 0, '구역 밖 바람'));
  T.check('구역 밖(높이)', ok(w(0, 20, 0).x === 0, '높이 밖 바람'));
}

// 실제 플레이어: 평평한 바닥에서 가만히 서 있어도 바람 방향으로 밀려 간다 (바람 속도에 가깝게)
{
  const world = new PhysicsWorld();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 40));
  floor.position.set(0, -0.5, 0);
  world.add(new BoxCollider(floor, new THREE.Vector3(40, 0.5, 20)));
  floor.updateMatrixWorld(true);
  for (const c of world.colliders) c.sync(true);
  const at = makeWindAt(HL, { k: 20, maxSpeed: 3 });
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(-4, 0, 0), 0);
  for (let t = 0; t < 1; t += S) p.step(S, { x: 0, y: 0 }, 0, world, at, null);
  const dx = p.pos.x + 4;
  T.check('서 있어도 1초 동안 +x 로 밀림', ok(dx > 0.5 && dx <= 3.2 && Math.abs(p.pos.z) < 0.05, `이동 ${dx.toFixed(2)}m, z=${p.pos.z.toFixed(3)}`));
  // 역풍(저기압 → 고기압 방향으로 걷기)은 느려진다
  const run = (dirX) => {
    const q = new Player(new THREE.Scene());
    q.respawn(new THREE.Vector3(0, 0, 0), 0);
    for (let t = 0; t < 1; t += S) q.step(S, { x: dirX, y: 0 }, 0, world, at, null);
    return Math.abs(q.pos.x);
  };
  T.check('순풍으로 걸으면 역풍보다 멀리 감', ok(run(1) > run(-1) + 1, `순풍 ${run(1).toFixed(2)} vs 역풍 ${run(-1).toFixed(2)}`));
}
T.report();
