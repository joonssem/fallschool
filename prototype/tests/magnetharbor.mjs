import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { buildMagnetHarbor, HARBOR_ROUTES, CRANE_SLOTS, craneLayout, islandPoles, ferryTarget, stoneX, STONE_SWAY } from '../src/levels/magnetharbor.js';
import { mapById } from '../src/levels/index.js';

const T = tally('자석 항구');
T.check('맵 선택 목록 등록', { ok: mapById('magnetharbor').build === buildMagnetHarbor, why: '' });
const fresh = () => {
  const world = new PhysicsWorld();
  return { world, level: buildMagnetHarbor(new THREE.Scene(), world, { seed: 7 }) };
};
// 흔들리는 징검다리 건너기 봇: 지금 선 곳에서 다음 돌의 좌우 위치에 맞춰 서 있다가, 가까워지면 천천히 다가가 짧게 뛰어 옮겨 간다
// (돌 깊이 3.4m라 전속력으로 뛰면 다음 돌을 지나칠 수 있다).
// smart=false: 돌을 보지 않고 가운데(x 0)로 곧장 달린다(비교용).
function crossStones(m, t0, smart = true) {
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(0, 1, -80.8), 0);
  let t = t0, i = 0; // i: 다음에 옮겨 갈 돌 번호 (4 = 도착 부두)
  while (t < t0 + 40) {
    const onZ = i === 0 ? -80.8 : CRANE_SLOTS[i - 1];
    const nextZ = i < CRANE_SLOTS.length ? CRANE_SLOTS[i] : -102;
    const nextX = i < CRANE_SLOTS.length ? stoneX(i, t + 0.6) - (stoneX(i - 1, t + 0.6) - stoneX(i - 1, t)) * (i > 0 ? 1 : 0) : 0; // 내려앉을 때의 다음 돌 위치(지금 돌이 움직이는 만큼은 빼 준다)
    let mx = 0, mz = 0;
    if (!smart) { mx = -p.pos.x; mz = -1; }
    else {
      const ready = Math.abs(nextX - p.pos.x) < 0.9; // 다음 돌이 내 앞에 왔다
      const curX = i === 0 ? 0 : stoneX(i - 1, t), room = i === 0 ? 8 : 1.1; // 지금 선 돌 밖으로는 걸어 나가지 않는다
      const tx = p.grounded ? THREE.MathUtils.clamp(nextX, curX - room, curX + room) : nextX;
      mx = THREE.MathUtils.clamp((tx - p.pos.x) * 1.5, -1, 1);
      if (!p.grounded) mz = -0.6; else if (ready) mz = -0.6; else mz = THREE.MathUtils.clamp((onZ - p.pos.z) * 2, -1, 1); // 준비가 안 되면 지금 선 돌 가운데에서 기다린다
    }
    if (p.pos.z < nextZ + 0.3 && p.grounded) { i++; if (i > CRANE_SLOTS.length) return { ok: true, t: +(t - t0).toFixed(1) }; }
    // 앞이 비면 점프 (harness 봇과 같은 방식: 돌 끝에서 뛴다)
    if (p.grounded && mz < 0 && (!smart || Math.abs(nextX - p.pos.x) < 0.9)) {
      const ahead = new THREE.Vector3(p.pos.x + mx * 0.3, p.pos.y + 0.6, p.pos.z - 0.9);
      let best = Infinity;
      for (const c of m.world.colliders) if (c.enabled) best = Math.min(best, c.raycast(ahead, new THREE.Vector3(0, -1, 0), 1.2));
      if (best > 1.15) p.requestJump();
    }
    m.level.update(t, S, p);
    p.step(S, { x: mx, y: -mz }, 0, m.world, m.level.windAt, m.level.gravityAt);
    if (p.pos.y < -5) return { ok: false, why: `떨어짐 z=${p.pos.z.toFixed(1)} 돌 ${i}`, t: +(t - t0).toFixed(1) };
    t += S;
  }
  return { ok: false, why: '시간 초과' };
}
function placeAllIron(m) {
  const c = m.level.crane;
  c.pads.forEach((pp, i) => { if (pp.spec.iron) c.tap(i); });
  for (let t = 0; t < 2; t += 1 / 60) m.level.update(t, 1 / 60, null);
}
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
  targets.push([0, -80]);
  const r0 = run(m, [0, 1, -66], targets, { maxT: 90 });
  for (let t = 0; t < 1.5; t += 1 / 60) m.level.update(t, 1 / 60, null); // 마지막 철이 날아가 자리 잡을 때까지
  const cross = r0.ok ? crossStones(m, 7.3) : r0;
  const r1 = cross.ok ? run(m, [0, 1, -102], [[7, -104]], { maxT: 10 }) : cross;
  return { r: { ok: r0.ok && cross.ok && r1.ok, why: r0.why || cross.why || r1.why }, m };
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
  t1.push([0, -80]);
  const r0 = run(m, [0, 1, 4], t1, { maxT: 150 });
  for (let t = 0; t < 1.5; t += 1 / 60) m.level.update(t, 1 / 60, null);
  const cr = r0.ok ? crossStones(m, 3.1) : r0;
  const r1 = { ok: r0.ok && cr.ok, why: r0.why || cr.why };
  const poles = islandPoles(seed);
  const a = r1.ok && ride(m, 0, poles.front === 'N' ? 'S' : 'N', -106, -138);
  const b = a && a.ok && ride(m, 1, poles.back, -138, -173);
  const total = 4 + 170; // 참고용: 출발 z 4 → 결승 z -172
  T.check(`전 구간 걸어서 완주 시드 ${seed} (길이 약 ${total}m)`, { ok: r1.ok && a.ok && b.ok && m.level.finished, why: r1.why || JSON.stringify({ a: a && { ...a, f: undefined }, b: b && { ...b, f: undefined }, fin: m.level.finished }) });
}

// ─── 흔들리는 다리 ───
{
  // 징검다리: 이웃한 돌은 가장 많이 어긋나도 겹친다, 가운데(x 0)에서 빠져나가는 때가 있다
  let worstOverlap = Infinity, centerOff = false;
  for (let t = 0; t < 12; t += 0.01) {
    for (let i = 0; i + 1 < CRANE_SLOTS.length; i++) worstOverlap = Math.min(worstOverlap, 3.4 - Math.abs(stoneX(i, t) - stoneX(i + 1, t)));
    if (Math.abs(stoneX(0, t)) > 1.7 - 0.45) centerOff = true;
  }
  T.check(`징검다리: 이웃한 돌은 항상 겹침 (최소 ${worstOverlap.toFixed(2)}m)`, { ok: worstOverlap > 0.5, why: '' });
  T.check('징검다리: 가만히 가운데로만 가면 돌이 빠져나가는 때가 있음(타이밍 필요)', { ok: centerOff, why: '' });
  const t0s = [0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2, 3.6, 4.0, 4.4, 4.8, 5.2];
  let smartOk = 0, naiveOk = 0, times = [];
  for (const t0 of t0s) {
    const m = fresh(); placeAllIron(m);
    const a = crossStones(m, t0, true); if (a.ok) { smartOk++; times.push(a.t); }
    const m2 = fresh(); placeAllIron(m2);
    if (crossStones(m2, t0, false).ok) naiveOk++;
  }
  console.log(`  흔들리는 징검다리: 돌을 보고 건너는 봇 ${smartOk}/${t0s.length} (평균 ${(times.reduce((x, y) => x + y, 0) / Math.max(1, times.length)).toFixed(1)}초), 가운데로 곧장 ${naiveOk}/${t0s.length}`);
  T.check('징검다리: 돌 위치를 보고 건너면 어느 출발 시각에도 건넘', { ok: smartOk === t0s.length, why: `${smartOk}/${t0s.length}` });
  // 좁은 별 길만 흔들리고 넓은 길은 멈춰 있다
  const m = fresh();
  m.level.harbor.choose('iron', 'challenge'); m.level.harbor.choose('boat', 'attract');
  const xs = { narrow: [], wide: [] };
  for (let t = 0; t < 6; t += 1 / 60) { m.level.update(t, 1 / 60, null); if (t > 3) { xs.narrow.push(m.level.routeBridges.iron[0].mesh.position.x); xs.wide.push(m.level.routeBridges.boat[0].mesh.position.x); } }
  const span = (a) => Math.max(...a) - Math.min(...a);
  T.check('좁은 별 다리는 자리 잡은 뒤 좌우로 흔들림', { ok: span(xs.narrow) > 2 && m.level.routeBridges.iron[0].mesh.userData.collider.enabled, why: span(xs.narrow).toFixed(2) });
  T.check('넓은 다리는 멈춰 있음', { ok: span(xs.wide) < 0.01, why: span(xs.wide).toFixed(3) });
}
// ─── 나룻배 2 하늘 별: 서 있기만 하면 못 얻고, 별 밑에서 뛰면 얻는다 ───
function airStarTry(jump) {
  const m = fresh(); m.level.setSeed(4);
  const poles = islandPoles(4);
  const f = m.level.ferries[1];
  const pad = f.pads.find((q) => q.pole === poles.back);
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(pad.x, 1, f.homeZ + pad.dz), 0);
  let jumped = false;
  for (let t = 0; t < 9; t += S) {
    const bz = f.boat.position.z;
    const mx = Math.abs(f.boat.position.z - f.homeZ) > 0.5 ? THREE.MathUtils.clamp(-p.pos.x * 2, -1, 1) : 0; // 출발하면 배 가운데로
    if (jump && !jumped && p.grounded && Math.abs(p.pos.x) < 0.3 && Math.abs(p.pos.z - (-154)) < 0.9) { p.requestJump(); jumped = true; }
    m.level.update(t, S, p);
    p.step(S, { x: mx, y: 0 }, 0, m.world, m.level.windAt, m.level.gravityAt);
    if (p.pos.y < -5) return { got: m.level.airStar.got, fell: true };
    void bz;
  }
  return { got: m.level.airStar.got, fell: false, onBoat: Math.abs(p.pos.z - f.farZ) < 2.6 };
}
{
  const stand = airStarTry(false), hop = airStarTry(true);
  T.check('하늘 별: 배 위에 서 있기만 하면 못 얻음', { ok: !stand.got && !stand.fell, why: JSON.stringify(stand) });
  T.check('하늘 별: 별 밑에서 뛰면 얻고 배 위로 내려앉음', { ok: hop.got && !hop.fell && hop.onBoat, why: JSON.stringify(hop) });
}
T.report();
