// 명령 택배 로봇 도시: 실제로 걸어서 세 정류장 배송과 문 통과 (2026-10-02 Claude 검토: 이전 시험은 계산 함수만 확인해서
// 좌표 불일치로 배송이 한 번도 성공하지 못하고 문이 열리지 않는 문제를 놓쳤다). 규칙·이동 검증이다.
import { THREE, PhysicsWorld, Player, S, tally } from './harness.mjs';
import { buildRobotCity, ROBOT_STOPS, STATION_Z } from '../src/levels/robotcity.js';
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
const zs = STATION_Z;
ROBOT_STOPS.forEach((stop, i) => {
  const z = zs[i];
  const d = level.deliveries[i];
  T.check(`${stop.name}: 앞으로·왼쪽·오른쪽 고정 팔레트`, { ok: ['forward', 'left', 'right'].every((command) => d.grid.some((g) => g.command === command)), why: d.grid.map((g) => g.command).join() });
  const nearestPadGap = Math.min(...d.grid.flatMap((a, ai) => d.grid.slice(ai + 1).map((b) => Math.hypot(a.x - b.x, a.z - b.z))));
  T.check(`${stop.name}: 서로 분리된 입력 발판`, { ok: nearestPadGap > 2.1, why: `nearest ${nearestPadGap.toFixed(1)}m` });
  let commandsWalked = true;
  for (const command of stop.required) {
    const tile = d.grid.find((g) => g.command === command);
    commandsWalked = commandsWalked && walk(tile.x, tile.z + 3) && walk(tile.x, tile.z) && walk(tile.x, tile.z + 3);
  }
  T.check(`${stop.name}: 고정 팔레트에서 명령을 순서대로 고르기`, { ok: commandsWalked, why: `${p.pos.x.toFixed(1)},${p.pos.z.toFixed(1)}` });
  T.check(`${stop.name}: 명령 ${stop.required.length}개`, { ok: d.commands.length === stop.required.length && d.commands.every((c, k) => c === stop.required[k]), why: d.commands.join() });
  T.check(`${stop.name}: 화면에 보여 줄 명령 목록이 선택 순서와 일치`, { ok: d.commandLabels.length === d.commands.length && d.commands.every((c, k) => d.commandLabels[k].includes(c === 'forward' ? '앞으로' : c === 'left' ? '왼쪽' : c === 'x3' ? '반복' : '오른쪽')), why: d.commandLabels.join(' | ') });
  T.check(`${stop.name}: 실행 발판`, { ok: walk(0, z + 19), why: `${p.pos.x.toFixed(1)},${p.pos.z.toFixed(1)}` });
  wait(4);
  T.check(`${stop.name}: 실행 강조 순서도 입력 순서와 일치`, { ok: d.trace.every((step, k) => step.command === stop.required[k]), why: d.trace.map((step) => step.command).join() });
  T.check(`${stop.name}: 배송 성공`, { ok: d.solved && d.targetReached, why: `${d.message} target=${JSON.stringify(d.path.at(-1))}` });
  T.check(`${stop.name}: 문이 열림`, { ok: !d.door.userData.collider.enabled, why: `door y ${d.door.position.y}` });
  if (stop.shortStar) {
    T.check('도시 광장: 다섯 개 이하 명령으로 배송하면 별이 나타남', { ok: d.star.mesh.visible && d.commands.length <= stop.shortStar, why: `visible=${d.star.mesh.visible}` });
    T.check('도시 광장: 나타난 별을 걸어서 획득', { ok: walk(-9, z + 9, 20) && d.star.got, why: `got=${d.star.got} at ${p.pos.x.toFixed(1)},${p.pos.z.toFixed(1)}` });
  }
  if (i === 0) {
    walk(7, z + 19);
    T.check('배송 후 초기화 발판으로 안전하게 재시도', { ok: !d.solved && d.door.userData.collider.enabled, why: `solved=${d.solved}` });
    for (const command of stop.required) {
      const tile = d.grid.find((g) => g.command === command);
      walk(tile.x, tile.z + 3); walk(tile.x, tile.z); walk(tile.x, tile.z + 3);
    }
    walk(0, z + 19); wait(4);
    T.check('재시도 뒤 배송을 다시 완료', { ok: d.solved && !d.door.userData.collider.enabled, why: d.message });
  }
  const gate = i < zs.length - 1 ? zs[i + 1] + 17 : -199; // 다음 정류장 앞, 마지막은 결승
  T.check(`${stop.name}: 문을 지나 다음으로`, { ok: walk(-4.5, z - 5) && walk(-4.5, z - 20) && walk(0, gate, 25), why: `${p.pos.x.toFixed(1)},${p.pos.y.toFixed(1)},${p.pos.z.toFixed(1)}` });
});
T.check('결승 도착', { ok: walk(0, -203, 25) && level.finished, why: `finished=${level.finished} z=${p.pos.z.toFixed(1)}` });
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
{
  const w3 = new PhysicsWorld(); const l3 = buildRobotCity(new THREE.Scene(), w3, { seed: 1 });
  const d = l3.deliveries[0]; d.commands = ['left', 'right', 'forward', 'forward', 'forward']; d.run();
  for (let i = 0; i < 500; i++) l3.update(i * S, S, null);
  T.check('다른 성공 명령 조합도 같은 목적지에 배송', { ok: d.solved && d.targetReached && d.commands.length !== ROBOT_STOPS[0].required.length, why: `${JSON.stringify(d.commands)} -> ${JSON.stringify(d.path.at(-1))}` });
}

// 반복 배송: 반복 없이 앞으로만 여섯 번은 실패, 도시 광장: 6개 기본 배송은 성공하지만 별은 없다
{
  const w4 = new PhysicsWorld(); const l4 = buildRobotCity(new THREE.Scene(), w4, { seed: 1 });
  const d4 = l4.deliveries[3];
  d4.commands = Array(6).fill('forward'); d4.run();
  for (let i = 0; i < 600; i++) l4.update(i * S, S, null);
  T.check('반복 배송: 반복 없이 앞으로만 여섯 번은 배송 실패·문 닫힘', { ok: !d4.solved && d4.door.userData.collider.enabled, why: d4.message });
  const d5 = l4.deliveries[4];
  d5.commands = ['forward', 'forward', 'right', 'forward', 'forward', 'forward']; d5.run();
  for (let i = 0; i < 600; i++) l4.update(i * S, S, null);
  T.check('도시 광장: 반복 없이 명령 6개로도 배송(기본), 별은 나타나지 않음', { ok: d5.solved && !d5.star.mesh.visible, why: d5.message });
  l4.resetProgress();
  T.check('초기화하면 별이 다시 숨겨지고 명령이 지워짐', { ok: !d5.solved && d5.commands.length === 0 && !d5.star.mesh.visible && !d5.star.got, why: '' });
}
// 길이 200m 이상, 체크포인트 간격 45m 이하
{
  const w5 = new PhysicsWorld(); const l5 = buildRobotCity(new THREE.Scene(), w5, { seed: 1 });
  const zsCp = l5.checkpoints.map((c) => c.respawn.z).sort((a, b) => b - a);
  const gaps = zsCp.slice(1).map((v, i) => zsCp[i] - v);
  T.check('길이 200m 이상(출발 z 5 → 결승 z -201), 체크포인트 간격 45m 이하', { ok: 5 - -201 >= 200 && Math.max(...gaps) <= 45 && zsCp.length >= 6, why: zsCp.map((v) => v.toFixed(0)).join() });
}
T.report();
