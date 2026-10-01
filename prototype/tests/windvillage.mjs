import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { buildWindVillage, BREEZE_PERIOD } from '../src/levels/windvillage.js';
const T = tally('바람마을');
function build(seed = 1) { const world = new PhysicsWorld(); return { world, level: buildWindVillage(new THREE.Scene(), world, { seed }) }; }
const m = build();
const v = new THREE.Vector3();
function wind(x, y, z, t) { m.level.update(t, 1 / 120, null); v.set(0, 0, 0); m.level.windAt(new THREE.Vector3(x, y, z), v); return v.clone(); }
T.check('왼쪽 길은 진행 방향 순풍', { ok: wind(-7, 0, -49, 0).z < -1, why: '' });
T.check('오른쪽 길은 진행 방향 역풍', { ok: wind(7, 0, -49, 0).z > 1, why: '' });
T.check('낮 해풍: 바다에서 육지로', { ok: wind(0, 2, -123, BREEZE_PERIOD / 4).x > 1, why: '' });
T.check('밤 육풍: 육지에서 바다로', { ok: wind(0, 2, -123, BREEZE_PERIOD * 3 / 4).x < -1, why: '' });
T.check('반전 시 바람은 부드럽게 약해짐', { ok: wind(0, 2, -123, BREEZE_PERIOD / 2).length() < 1e-8, why: '' });
T.check('안전 계단은 바람 구역 밖', { ok: wind(0, 2, -99, 8).length() === 0, why: '' });
T.check('갈림길 중앙은 바람 없음', { ok: wind(0, 0, -49, 8).length() === 0, why: '' });
T.check('구역 위는 바람 없음', { ok: wind(-7, 10, -49, 8).length() === 0, why: '' });
for (const t of [8, 24, 72]) {
  m.level.update(t, 1 / 120, null);
  for (const g of m.level.windGauges) {
    const actual = new THREE.Vector3(); m.level.windAt(g.pos, actual);
    const displayed = new THREE.Vector3(0, 1, 0).applyQuaternion(g.arrow.quaternion);
    const flag = new THREE.Vector3(0, 0, -1).applyQuaternion(g.flag.quaternion);
    T.check(`표시 방향 ${t} ${g.pos.x},${g.pos.z}`, { ok: actual.length() > 0.03 && displayed.dot(actual.clone().normalize()) * (g.vane ? -1 : 1) > 0.999 && flag.dot(actual.normalize()) > 0.999, why: '' });
  }
}
T.check('과학 오답 낙하를 요구하는 문 없음', { ok: m.level.gates.length === 0, why: '' });
T.check('도움 점프 허용', { ok: m.level.checkpoints.every((cp) => !cp.noHelp), why: '' });
for (const seed of [1, 7, 99]) for (const t0 of [0, 8, 16, 24]) for (const side of [-7, 7]) {
  const route = [[0, -29], [side, -33], [side, -49], [side, -66], [0, -70], [0, -90], [0, -96], [0, -103], [-8, -108], [9, -110], [9, -120], [-9, -126], [-9, -138], [0, -148], [0, -160]];
  T.check(`전 구간 ${side < 0 ? '순풍' : '역풍'} seed=${seed} t=${t0}`, run(build(seed), [0, 0, 2], route, { t0, maxT: 120 }));
}
T.report();
