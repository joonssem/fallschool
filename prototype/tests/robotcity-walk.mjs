// 명령 택배 로봇 도시: 실제로 걸어서 세 정류장 배송과 문 통과 (2026-10-02 Claude 검토: 이전 시험은 계산 함수만 확인해서
// 좌표 불일치로 배송이 한 번도 성공하지 못하고 문이 열리지 않는 문제를 놓쳤다). 규칙·이동 검증이다.
import { THREE, PhysicsWorld, Player, S, tally } from './harness.mjs';
import { buildRobotCity, ROBOT_STOPS } from '../src/levels/robotcity.js';
const T = tally('로봇 도시 걸어서 배송');
const world = new PhysicsWorld();
const level = buildRobotCity(new THREE.Scene(), world, { seed: 1 });
const p = new Player(new THREE.Scene());
p.respawn(new THREE.Vector3(0, 0, 2), 0);
let t = 0;
function walk(tx, tz, maxT = 12, jump = true) {
  const t1 = t + maxT;
  while (t < t1) {
    const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.5) return true;
    if (jump && p.grounded) {
      const ux = dx / d, uz = dz / d;
      const probe = (px, py, pz, max) => { let best = Infinity; for (const c of world.colliders) { if (!c.enabled) continue; const r = c.raycast(new THREE.Vector3(px, py, pz), new THREE.Vector3(0, -1, 0), max); if (r < best) best = r; } return best; };
      const ahead = probe(p.pos.x + ux * 0.9, p.pos.y + 0.6, p.pos.z + uz * 0.9, 1.2);
      const near = probe(p.pos.x + ux * 1.6, p.pos.y + 0.6, p.pos.z + uz * 1.6, 1.2);
      const wall = probe(p.pos.x + ux * 0.7, p.pos.y + 1.6, p.pos.z + uz * 0.7, 0.4) < 0.4;
      if (ahead > 1.15 || wall || near < 0.3) p.requestJump();
    }
    level.update(t, S, p);
    p.step(S, { x: dx / d, y: -dz / d }, 0, world, level.windAt, level.gravityAt);
    t += S;
    if (p.pos.y < -10) return false;
  }
  return false;
}
function wait(sec) { const t1 = t + sec; while (t < t1) { level.update(t, S, p); p.step(S, { x: 0, y: 0 }, 0, world, null, null); t += S; } }

// 첫 정류장 데크까지 (시작 발판 → 계단 발판)
T.check('첫 정류장 데크로 이동', { ok: walk(0, -14), why: p.pos.toArray().join() });
const zs = [-31, -66, -101];
ROBOT_STOPS.forEach((stop, i) => {
  const z = zs[i];
  const d = level.deliveries[i];
  const tilesX = stop.required.map((_, k) => -6 + k * 4);
  T.check(`${stop.name}: 명령 발판을 차례로 밟기`, { ok: tilesX.every((x) => walk(x, z + 15) && walk(x, z + 12) && walk(x, z + 15)), why: `${p.pos.x.toFixed(1)},${p.pos.z.toFixed(1)}` });
  T.check(`${stop.name}: 명령 ${stop.required.length}개`, { ok: d.commands.length === stop.required.length && d.commands.every((c, k) => c === stop.required[k]), why: d.commands.join() });
  T.check(`${stop.name}: 실행 발판`, { ok: walk(0, z + 19), why: `${p.pos.x.toFixed(1)},${p.pos.z.toFixed(1)}` });
  wait(4);
  T.check(`${stop.name}: 배송 성공`, { ok: d.solved && d.targetReached, why: `${d.message} target=${JSON.stringify(d.path.at(-1))}` });
  T.check(`${stop.name}: 문이 열림`, { ok: !d.door.userData.collider.enabled, why: `door y ${d.door.position.y}` });
  const gate = i < 2 ? zs[i + 1] + 17 : -128; // 다음 정류장 앞, 마지막은 결승
  T.check(`${stop.name}: 문을 지나 다음으로`, { ok: walk(-4.5, z - 5) && walk(-4.5, z - 20) && walk(0, gate, 25), why: `${p.pos.x.toFixed(1)},${p.pos.y.toFixed(1)},${p.pos.z.toFixed(1)}` });
});
T.check('결승 도착', { ok: walk(0, -128, 20) && level.finished, why: `finished=${level.finished} z=${p.pos.z.toFixed(1)}` });
// 잘못된 명령은 문을 열지 않는다
{
  const w2 = new PhysicsWorld(); const l2 = buildRobotCity(new THREE.Scene(), w2, { seed: 1 });
  const d = l2.deliveries[0];
  d.commands = ['forward', 'forward']; d.run();
  for (let i = 0; i < 400; i++) l2.update(i * S, S, null);
  T.check('명령이 모자라면 배송 실패·문 닫힘·다시 시도 가능', { ok: !d.solved && d.door.userData.collider.enabled && !d.running, why: d.message });
  d.reset();
  T.check('명령 지우기로 처음 상태', { ok: d.commands.length === 0 && !d.solved, why: d.message });
}
T.report();
