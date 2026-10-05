import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { buildMagnetHarbor, HARBOR_ROUTES, CRANE_SLOTS, craneLayout, islandPoles, ferryTarget } from '../src/levels/magnetharbor.js';
import { mapById } from '../src/levels/index.js';

const T = tally('자석 항구');
T.check('맵 선택 목록 등록', { ok: mapById('magnetharbor').build === buildMagnetHarbor, why: '' });
const fresh = () => {
  const world = new PhysicsWorld();
  return { world, level: buildMagnetHarbor(new THREE.Scene(), world, { seed: 7 }) };
};
const { level, world } = fresh();
T.check('시작 때 건널 길은 대기 위치에 있음', {
  ok: level.routeBridges.iron.every((r) => !r.mesh.userData.collider.enabled) && level.routeBridges.boat.every((r) => !r.mesh.userData.collider.enabled), why: '',
});
level.harbor.choose('iron', 'challenge');
level.update(1.5, 1.5, null);
T.check('좁은 철 화물이 실제 다리 위치로 이동', {
  ok: Math.abs(level.routeBridges.iron[0].mesh.position.x + 5) < 0.03 && level.routeBridges.iron[0].mesh.userData.collider.enabled && !level.routeBridges.iron[1].mesh.userData.collider.enabled, why: '',
});
level.harbor.choose('iron', 'steady');
level.update(3, 2, null);
T.check('선택을 바꾸면 넓은 화물만 길이 됨', {
  ok: !level.routeBridges.iron[0].mesh.userData.collider.enabled && level.routeBridges.iron[1].mesh.userData.collider.enabled, why: '',
});
level.harbor.choose('boat', 'repel');
level.update(5, 2, null);
T.check('같은 극 선택은 오른쪽 보트 길을 만듦', {
  ok: level.routeBridges.boat[1].mesh.userData.collider.enabled && !level.routeBridges.boat[0].mesh.userData.collider.enabled, why: '',
});
level.resetProgress();
T.check('새 경기 초기화로 화물과 보트가 원위치', {
  ok: level.harbor.iron === null && level.harbor.boat === null && !level.finished && [...level.routeBridges.iron, ...level.routeBridges.boat].every((r) => !r.mesh.userData.collider.enabled), why: '',
});

for (const iron of HARBOR_ROUTES.iron) for (const boat of HARBOR_ROUTES.boat) {
  const m = fresh();
  const targets = [
    [iron.x, -11], [iron.x, -25], [iron.x, -34], [0, -39],
    [boat.x, -43], [boat.x, -56], [boat.x, -66], [0, -67], [0, -70],
  ];
  const result = run(m, [0, 1, 4], targets, { maxT: 90 });
  T.check(`${iron.label} → ${boat.label}: 걸어서 크레인 부두까지`, {
    ok: result.ok && m.level.harbor.iron === iron.id && m.level.harbor.boat === boat.id && m.level.checkpoints.find((c) => c.name === '철 찾기 크레인').reached,
    why: result.why || `iron=${m.level.harbor.iron}, boat=${m.level.harbor.boat}, finish=${m.level.finished}`,
  });
  T.check(`${iron.label} → ${boat.label}: 선택한 길만 활성`, {
    ok: m.level.routeBridges.iron.filter((r) => r.mesh.userData.collider.enabled).map((r) => r.id).join() === iron.id
      && m.level.routeBridges.boat.filter((r) => r.mesh.userData.collider.enabled).map((r) => r.id).join() === boat.id,
    why: '',
  });
}

// ─── 연장 구간: 철 찾기 크레인 ───
for (let seed = 1; seed <= 20; seed++) {
  const L = craneLayout(seed);
  T.check(`크레인 배치 시드 ${seed}: 철 4개 + 붙지 않는 물건 2개`, { ok: L.length === 6 && L.filter((x) => x.iron).length === 4, why: L.map((x) => x.name).join(',') });
}
T.check('크레인 배치가 시드마다 달라짐', { ok: new Set([1, 2, 3, 4, 5, 6].map((s) => craneLayout(s).map((x) => x.iron ? 1 : 0).join(''))).size >= 3, why: '' });
{
  const m = fresh();
  const c = m.level.crane;
  const wrongI = c.pads.findIndex((p) => !p.spec.iron);
  c.tap(wrongI);
  T.check('크레인: 철이 아닌 물건은 징검다리가 안 됨(떨어지거나 막히지 않음)', { ok: c.placed === 0 && c.wrong === 1 && !c.pads[wrongI].used, why: '' });
}
// 걸어서: 철 발판 4개를 밟고 징검다리로 건너 다음 부두까지
function craneWalk(seed, wrongFirst) {
  const m = { world: new PhysicsWorld() }; m.level = buildMagnetHarbor(new THREE.Scene(), m.world, { seed });
  const c = m.level.crane;
  const order = c.pads.map((p, i) => i).filter((i) => c.pads[i].spec.iron);
  if (wrongFirst) order.unshift(c.pads.findIndex((p) => !p.spec.iron));
  const targets = [[0, -66]];
  for (const i of order) targets.push([c.pads[i].x * 0.6, c.pads[i].z], [c.pads[i].x, c.pads[i].z], [c.pads[i].x * 0.6, c.pads[i].z]);
  targets.push([0, -80], ...CRANE_SLOTS.map((z) => [0, z]), [0, -103], [7, -104]);
  const r = run(m, [0, 1, -66], targets, { maxT: 90 });
  return { r, m };
}
for (const seed of [1, 4, 9]) {
  const { r, m } = craneWalk(seed, false);
  T.check(`크레인 시드 ${seed}: 철 4개로 징검다리를 만들어 건넘 + 실수 없음 별`, { ok: r.ok && m.level.crane.placed === 4 && m.level.crane.star.got, why: r.why || `placed=${m.level.crane.placed}` });
  const w = craneWalk(seed, true);
  T.check(`크레인 시드 ${seed}: 붙지 않는 물건을 한 번 고르면 건너기는 되지만 별은 없음`, { ok: w.r.ok && !w.m.level.crane.star.got && w.m.level.crane.star.mesh.position.y < -100, why: w.r.why });
}
{
  const m = fresh();
  const r = run(m, [0, 1, -78], [[0, -81], [0, -85], [0, -95]], { maxT: 10 });
  T.check('크레인: 징검다리 없이는 건너지 못함(떨어짐)', { ok: !r.ok && /떨어짐/.test(r.why), why: r.why || 'crossed' });
}

// ─── 연장 구간: 자석 나룻배 ───
T.check('나룻배 규칙: 자석이 앞이면 다른 극(끌림)으로 나아감', { ok: ferryTarget('N', 'S', true) === 'far' && ferryTarget('N', 'N', true) === 'home', why: '' });
T.check('나룻배 규칙: 자석이 뒤면 같은 극(밀림)으로 나아감', { ok: ferryTarget('N', 'N', false) === 'far' && ferryTarget('S', 'N', false) === 'home', why: '' });
T.check('나룻배 규칙: 극을 안 고르면 출발 부두', { ok: ferryTarget(null, 'N', true) === 'home', why: '' });
{
  const seen = new Set();
  for (let s = 1; s <= 20; s++) { const p = islandPoles(s); seen.add(p.front + p.back); }
  T.check('섬 자석의 극이 시드마다 달라짐(네 조합)', { ok: seen.size === 4, why: [...seen].join(',') });
}
// 배 타기 봇: 출발 부두에서 배 위 극 발판으로 걸어가 서 있다가, 도착하면 내린다.
function ride(m, fi, pole, startZ, offZ, maxT = 25) {
  const f = m.level.ferries[fi];
  const pad = f.pads.find((p) => p.pole === pole);
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(0, 1, startZ), 0);
  let t = 0, phase = 'board', arrived = false;
  for (; t < maxT; t += S) {
    let mx = 0, mz = 0;
    const bz = f.boat.position.z;
    if (phase === 'board') {
      const tx = pad.x, tz = bz + pad.dz, dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.25) phase = 'ride'; else { mx = dx / Math.max(d, 1); mz = dz / Math.max(d, 1); }
    }
    if (phase === 'ride' && Math.abs(bz - f.farZ) < 0.05) { phase = 'off'; arrived = true; }
    if (phase === 'off') { const dz = offZ - p.pos.z; if (Math.abs(dz) < 0.4) break; mx = -p.pos.x * 0.5; mz = Math.sign(dz); }
    m.level.update(t, S, p);
    p.step(S, { x: mx, y: -mz }, 0, m.world, m.level.windAt, m.level.gravityAt);
    if (p.pos.y < -5) return { ok: false, why: 'fell', t };
  }
  return { ok: arrived && Math.abs(p.pos.z - offZ) < 0.6, arrived, t: +t.toFixed(1), z: +p.pos.z.toFixed(1), f };
}
for (const seed of [1, 2, 3, 5, 8]) {
  const poles = islandPoles(seed);
  const other = (x) => (x === 'N' ? 'S' : 'N');
  const m = fresh(); m.level.setSeed(seed);
  const a = ride(m, 0, other(poles.front), -106, -137);
  T.check(`나룻배 1 시드 ${seed}: 섬 자석(${poles.front})과 다른 극으로 건넘`, { ok: a.ok, why: JSON.stringify({ ...a, f: undefined }) });
  const b = ride(m, 1, poles.back, -138, -170);
  T.check(`나룻배 2 시드 ${seed}: 섬 자석(${poles.back})과 같은 극으로 건넘`, { ok: b.ok, why: JSON.stringify({ ...b, f: undefined }) });
  const m2 = fresh(); m2.level.setSeed(seed);
  const wrong = ride(m2, 0, poles.front, -106, -137, 8);
  T.check(`나룻배 1 시드 ${seed}: 같은 극이면 출발 부두에 머묾(떨어지지 않음)`, { ok: !wrong.arrived && wrong.why !== 'fell' && Math.abs(m2.level.ferries[0].boat.position.z - m2.level.ferries[0].homeZ) < 0.05, why: JSON.stringify({ ...wrong, f: undefined }) });
  const m3 = fresh(); m3.level.setSeed(seed);
  const wrong2 = ride(m3, 1, other(poles.back), -138, -170, 8);
  T.check(`나룻배 2 시드 ${seed}: 다른 극이면 끌려 섬에 머묾`, { ok: !wrong2.arrived && wrong2.why !== 'fell', why: JSON.stringify({ ...wrong2, f: undefined }) });
}
{
  // 빈 배는 출발 부두로 돌아온다 (도착 후 내리거나 물에 빠진 뒤)
  const m = fresh(); m.level.setSeed(2);
  const poles = islandPoles(2);
  ride(m, 0, poles.front === 'N' ? 'S' : 'N', -106, -137);
  for (let t = 30; t < 40; t += S) m.level.update(t, S, { pos: new THREE.Vector3(0, 1, -138) });
  const f = m.level.ferries[0];
  T.check('빈 배는 극을 풀고 출발 부두로 돌아옴', { ok: Math.abs(f.boat.position.z - f.homeZ) < 0.05 && f.pole === null, why: String(f.boat.position.z) });
}
// 전 구간: 출발 → 철 화물 → 보트 → 크레인 → 나룻배 1 → 섬 → 나룻배 2 → 도착
for (const seed of [3, 6]) {
  const m = { world: new PhysicsWorld() }; m.level = buildMagnetHarbor(new THREE.Scene(), m.world, { seed });
  const c = m.level.crane;
  const t1 = [[5, -11], [5, -25], [5, -34], [0, -39], [-4.5, -43], [-4.5, -56], [-4.5, -66], [0, -66]];
  for (const i of c.pads.map((p, k) => k).filter((k) => c.pads[k].spec.iron)) t1.push([c.pads[i].x * 0.6, c.pads[i].z], [c.pads[i].x, c.pads[i].z], [c.pads[i].x * 0.6, c.pads[i].z]);
  t1.push([0, -80], ...CRANE_SLOTS.map((z) => [0, z]), [0, -106]);
  const r1 = run(m, [0, 1, 4], t1, { maxT: 150 });
  const poles = islandPoles(seed);
  const a = r1.ok && ride(m, 0, poles.front === 'N' ? 'S' : 'N', -106, -138);
  const b = a && a.ok && ride(m, 1, poles.back, -138, -173);
  const total = 4 + 170; // 참고용: 출발 z 4 → 결승 z -172
  T.check(`전 구간 걸어서 완주 시드 ${seed} (길이 약 ${total}m)`, { ok: r1.ok && a.ok && b.ok && m.level.finished, why: r1.why || JSON.stringify({ a: a && { ...a, f: undefined }, b: b && { ...b, f: undefined }, fin: m.level.finished }) });
}
T.report();
