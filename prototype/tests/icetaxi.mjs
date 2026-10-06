import './harness.mjs';
import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { ICE_PACKS, ICE_ROUTES, ICE_ROUTES_2, TRIAL_DURATION, BIG_SHOW, BIG_SHOW_2, LEG2, LANE_X, iceTrial, iceDelivery, iceDelivery2, buildIceTaxi } from '../src/levels/icetaxi.js';
import { MAPS, mapById } from '../src/levels/index.js';

const T = tally('열을 지키는 얼음 택배');
T.check('맵 선택 목록 등록', { ok: mapById('icetaxi').id === 'icetaxi', why: `${MAPS.length} maps` });
T.check('시험은 동일한 고정 게임 시간과 게임 포장 3종', { ok: TRIAL_DURATION === 2.5 && ICE_PACKS.length === 3 && ICE_PACKS.every((p) => /^포장 [A-C]$/.test(p.name)), why: `${TRIAL_DURATION}, ${ICE_PACKS.map((p) => p.name)}` });
const trials = ICE_PACKS.map((pack) => iceTrial(pack));
T.check('게임 모형 포장 차이가 바로 비교됨', { ok: trials[0].remaining < trials[1].remaining && trials[1].remaining < trials[2].remaining, why: trials.map((x) => x.remaining.toFixed(2)).join(', ') });
const deliveryTable = ICE_PACKS.map((pack) => ({ pack: pack.name, sun: iceDelivery(pack, ICE_ROUTES.sun), shade: iceDelivery(pack, ICE_ROUTES.shade) }));
for (const row of deliveryTable) {
  T.check(`${row.pack}: 두 배송 조합 모두 완주 가능`, { ok: row.sun.delivered && row.shade.delivered, why: `햇빛 ${row.sun.delivered}, 그늘 ${row.shade.delivered}` });
  T.check(`${row.pack}: 이동 시간과 햇빛 노출이 모두 계산됨`, { ok: row.sun.travelHeat > 0 && row.shade.travelHeat > row.sun.travelHeat && row.sun.sunlightHeat > row.shade.sunlightHeat, why: `햇빛 ${row.sun.remaining.toFixed(3)}, 그늘 ${row.shade.remaining.toFixed(3)}` });
}
console.log('포장×경로 남은 얼음 비율(게임 모형):', JSON.stringify(deliveryTable.map((r) => [r.pack, Number(r.sun.remaining.toFixed(3)), Number(r.shade.remaining.toFixed(3))])));
T.check('경로 우세가 모든 포장에 고정되지 않음', { ok: deliveryTable[0].shade.remaining > deliveryTable[0].sun.remaining && deliveryTable[2].sun.remaining > deliveryTable[2].shade.remaining, why: '' });
const world = new PhysicsWorld();
const level = buildIceTaxi(new THREE.Scene(), world, { seed: 3 });
T.check('세 포장 결과가 같은 시험 시간 기준으로 표시됨', { ok: level.iceSamples.length === 3 && level.iceSamples.every((x) => x.outcome.remaining === iceTrial(x.pack).remaining), why: '' });
level.ice.choosePack(ICE_PACKS[2]);
T.check('포장 선택이 배송 계산에 반영됨', { ok: level.ice.pack.id === 'pack-c' && level.ice.trial.remaining === trials[2].remaining, why: '' });
level.ice.chooseRoute(ICE_ROUTES.shade);
T.check('경로 선택 순간에는 배송 결과를 미리 보여 주지 않음', { ok: level.ice.route === ICE_ROUTES.shade && !level.ice.delivered && level.ice.delivery === null && level.deliveryGate.userData.collider.enabled, why: '' });
level.update(1, 1, { pos: new THREE.Vector3(0, 1, -88) });
T.check('도착 후 화물 결과·무대·공연장 문이 바뀜', { ok: level.ice.delivered && level.ice.delivery.remaining === iceDelivery(ICE_PACKS[2], ICE_ROUTES.shade).remaining && !level.deliveryGate.userData.collider.enabled && level.iceStage.material.color.getHex() === 0x95c5a6, why: '' });
const defaultWorld = new PhysicsWorld(); const defaultLevel = buildIceTaxi(new THREE.Scene(), defaultWorld, { seed: 4 });
defaultLevel.ice.chooseRoute(ICE_ROUTES.sun); defaultLevel.update(1, 1, { pos: new THREE.Vector3(0, 1, -88) });
T.check('포장을 건너뛰어도 기본 포장으로 목적지 배송', { ok: defaultLevel.ice.pack === ICE_PACKS[0] && defaultLevel.ice.delivered && defaultLevel.ice.delivery, why: '' });
level.resetProgress();
T.check('초기화로 안전하게 새 배송을 고를 수 있음', { ok: level.ice.pack === null && level.ice.route === null && !level.ice.delivered, why: '' });
const walkWorld = new PhysicsWorld();
const walkLevel = buildIceTaxi(new THREE.Scene(), walkWorld, { seed: 7 });
const walking = run({ level: walkLevel, world: walkWorld }, [0, 0, 2], [[6, -6], [0, -25], [0, -39], [-7, -52], [-7, -68], [0, -80], [0, -104]], { maxT: 100 });
T.check('선택 포장·경로를 실제 이동해 도착 뒤 결과 확인', { ok: walking.ok && walkLevel.ice.pack.id === 'pack-c' && walkLevel.ice.route === ICE_ROUTES.shade && walkLevel.ice.delivered && !walkLevel.deliveryGate.userData.collider.enabled, why: walking.why || JSON.stringify({ pack: walkLevel.ice.pack?.id, route: walkLevel.ice.route?.id, delivered: walkLevel.ice.delivered, gate: walkLevel.deliveryGate.userData.collider.enabled }) });
const skipPackWorld = new PhysicsWorld(); const skipPackLevel = buildIceTaxi(new THREE.Scene(), skipPackWorld, { seed: 2 });
const skipPackWalk = run({ level: skipPackLevel, world: skipPackWorld }, [0, 0, 2], [[10, 2], [10, -6], [8, -8], [8, -18], [0, -22], [0, -25], [0, -39], [7, -53], [7, -63], [0, -80], [0, -104]], { maxT: 100 });
T.check('포장 비교·선택을 건너뛰고도 기본 포장으로 걸어서 완주', { ok: skipPackWalk.ok && skipPackLevel.ice.pack === ICE_PACKS[0] && skipPackLevel.ice.delivered && !skipPackLevel.deliveryGate.userData.collider.enabled, why: skipPackWalk.why || `pack=${skipPackLevel.ice.pack?.id}` });

// ─── 포장 무게 ↔ 길·별 (한 포장이 모든 목표에 유리하지 않다) ───
const fresh = (seed = 5) => { const w = new PhysicsWorld(); return { world: w, level: buildIceTaxi(new THREE.Scene(), w, { seed }) }; };
const sunWalk = (pack) => {
  const m = fresh();
  if (pack) m.level.ice.choosePack(pack);
  return { m, r: run(m, [0, 1, -36], [[7, -44], [7, -53], [7, -58], [7, -66], [0, -80], [0, -104]], { maxT: 40 }) };
};
for (const pack of ICE_PACKS) {
  const { m, r } = sunWalk(pack);
  const expectClimb = pack.id !== 'pack-c';
  T.check(`${pack.name}(${pack.weight}): 햇빛 길 바위턱 ${expectClimb ? '오름' : '못 오름'}`, { ok: r.ok === expectClimb && (expectClimb ? m.level.ice.delivered : !m.level.ice.delivered), why: r.why || `delivered=${m.level.ice.delivered}` });
}
{
  const m = fresh(); m.level.ice.choosePack(ICE_PACKS[2]);
  const r = run(m, [0, 1, -36], [[7, -45], [7, -49], [7, -45], [-7, -46], [-7, -68], [0, -80], [0, -104]], { maxT: 60 });
  T.check('포장 C: 바위턱 앞에서 돌아 그늘 길로 바꾸면 그늘 길로 배송', { ok: r.ok && m.level.ice.route === ICE_ROUTES.shade && m.level.ice.delivered, why: r.why || `route=${m.level.ice.route?.name}` });
}
// 별 섬: 바위 위에서 동쪽으로 달려 끝에서 점프하고 공중에서 다이브. 점프·다이브 시각을 바꿔 한 번이라도 닿는지 본다.
function rockStarReach(pack) {
  let hits = 0, tries = 0, first = null;
  for (const startX of [4.2]) for (const jumpX of [9.4, 9.8, 10.1, 10.4]) for (const diveVy of [3, 1.5, 0, -1.5, -3]) {
    const m = fresh();
    if (pack) m.level.ice.choosePack(pack);
    const top = m.level.sunRock.top;
    const p = new Player(new THREE.Scene());
    p.respawn(new THREE.Vector3(startX, top, -55.5), Math.PI / 2);
    let jumped = false, dived = false;
    for (let t = 0; t < 3.5; t += S) {
      if (!jumped && p.pos.x >= jumpX && p.grounded) { p.requestJump(); jumped = true; }
      if (jumped && !dived && !p.grounded && p.vel.y <= diveVy) { p.requestDive(); dived = true; }
      m.level.update(t, S, p);
      p.step(S, { x: 1, y: 0 }, 0, m.world, m.level.windAt, m.level.gravityAt);
    }
    tries++;
    if (m.level.sunRock.star.visible === false) { hits++; first ??= [jumpX, diveVy]; }
  }
  return { ok: hits > 0, hits: `${hits}/${tries}`, first };
}
const reachA = rockStarReach(ICE_PACKS[0]), reachB = rockStarReach(ICE_PACKS[1]), reachC = rockStarReach(ICE_PACKS[2]);
console.log('  별 섬 (점프+다이브):', JSON.stringify({ A: reachA.hits, B: reachB.hits, C: reachC.hits }));
T.check('별 섬: 가벼운 포장 A는 점프 + 다이브로 닿음', { ok: reachA.ok, why: '' });
T.check('별 섬: 포장 B·C로는 닿지 않음', { ok: !reachB.ok && !reachC.ok, why: `B ${reachB.ok}, C ${reachC.ok}` });
const big = deliveryTable.filter((row) => row.shade.remaining >= BIG_SHOW || row.sun.remaining >= BIG_SHOW).map((r) => r.pack);
T.check(`큰 공연(${BIG_SHOW * 100}% 이상)은 포장 C로만`, { ok: big.length === 1 && big[0] === '포장 C', why: big.join(',') });
{
  const m = fresh(); m.level.ice.choosePack(ICE_PACKS[2]);
  const r = run(m, [0, 1, -36], [[-7, -46], [-7, -68], [0, -80], [0, -96], [-5, -97]], { maxT: 60 });
  T.check('포장 C + 그늘 길: 큰 공연 별이 무대에 나타나 얻음', { ok: r.ok && m.level.showStar.got, why: r.why || `remaining=${m.level.ice.delivery?.remaining}` });
  const m2 = fresh(); m2.level.ice.choosePack(ICE_PACKS[1]);
  const r2 = run(m2, [0, 1, -36], [[-7, -46], [-7, -68], [0, -80], [0, -96], [-5, -97]], { maxT: 60 });
  T.check('포장 B: 도착해도 큰 공연 별은 나타나지 않음', { ok: r2.ok && !m2.level.showStar.got && m2.level.showStar.mesh.position.y < -100, why: r2.why });
  m.level.resetProgress();
  T.check('초기화하면 공연 별·무게가 처음으로', { ok: !m.level.showStar.got && m.level.showStar.mesh.position.y < -100 && m.level.gravityAt() === 1, why: '' });
}
T.check('도착 뒤에는 포장 무게가 사라짐(점프 보통)', (() => { const m = fresh(); m.level.ice.choosePack(ICE_PACKS[2]); const before = m.level.gravityAt(); m.level.ice.chooseRoute(ICE_ROUTES.shade); m.level.update(1, 1, { pos: new THREE.Vector3(0, 1, -88) }); return { ok: before === 1.6 && m.level.gravityAt() === 1, why: `${before} → ${m.level.gravityAt()}` }; })());

// ─── 두 번째 배달 (docs/56): 재포장소 → 더운 낮의 세 갈래 → 두 번째 공연장 ───
const table2 = ICE_PACKS.map((pack) => ({ pack, rows: Object.entries(ICE_ROUTES_2).map(([key, route]) => ({ key, ...iceDelivery2(pack, route) })) }));
console.log('2차 포장×길 남은 얼음 비율(게임 모형):', JSON.stringify(table2.map((r) => [r.pack.name, ...r.rows.map((x) => `${x.key}:${x.remaining.toFixed(3)}`)])));
T.check('2차: 모든 포장×길 조합이 배달 가능(실패 없음)', { ok: table2.every((r) => r.rows.every((x) => x.delivered)), why: JSON.stringify(table2.map((r) => r.rows.map((x) => x.remaining.toFixed(2)))) });
const bestRoute2 = table2.map((r) => r.rows.reduce((a, b) => (b.remaining > a.remaining ? b : a)).key);
T.check('2차: 포장마다 가장 좋은 길이 모두 같지 않음(길 하나가 항상 이기지 않음)', { ok: new Set(bestRoute2).size >= 2, why: bestRoute2.join(',') });
T.check('2차: 더운 날이라 같은 길도 1차보다 햇빛 노출 영향이 큼', { ok: iceDelivery2(ICE_PACKS[0], ICE_ROUTES_2.hill).remaining < iceDelivery2(ICE_PACKS[2], ICE_ROUTES_2.hill).remaining && iceDelivery2(ICE_PACKS[0], ICE_ROUTES_2.hill).remaining < iceDelivery2(ICE_PACKS[0], ICE_ROUTES_2.tunnel).remaining, why: '' });
const bigs2 = table2.flatMap((r) => r.rows.filter((x) => x.remaining >= BIG_SHOW_2).map((x) => `${r.pack.name}+${x.key}`));
T.check(`2차 큰 공연(${BIG_SHOW_2 * 100}% 이상)은 포장 C로만`, { ok: bigs2.length > 0 && bigs2.every((x) => x.startsWith('포장 C')), why: bigs2.join(',') });
{
  const level2 = buildIceTaxi(new THREE.Scene(), new PhysicsWorld(), { seed: 3 });
  const zs = level2.checkpoints.map((c) => c.respawn.z).sort((a, b) => b - a);
  const gaps = zs.slice(1).map((z, i) => zs[i] - z);
  T.check('길이 200m 이상(출발 z 5 → 결승 z -206), 체크포인트 간격 45m 이하', { ok: 5 - LEG2.finish >= 200 && Math.max(...gaps) <= 45, why: `${zs.map((z) => z.toFixed(0)).join(',')}` });
}
const part1 = (packX) => [[packX, -6], [0, -25], [0, -39], [-7, -52], [-7, -68], [0, -80], [0, -96], [0, -112]];
const lanePath = {
  tunnel: [[LANE_X.tunnel, -138], [-8.2, -146], [-8.2, -148.5], [-13.8, -152], [-13.8, -154.5], [LANE_X.tunnel, -160], [-8.2, -166], [-8.2, -168.5], [-13.8, -171], [-13.8, -173.5]],
  forest: [[LANE_X.forest, -138], [2, -150], [2, -152], [0, -158], [-2, -166], [-2, -168], [0, -173]],
  hill: [[LANE_X.hill, -138], [LANE_X.hill, -146], [LANE_X.hill, -155], [LANE_X.hill, -166], [LANE_X.hill, -173]],
};
const fullWalk = (pack1X, pack2X, lane, seed = 9) => {
  const w = new PhysicsWorld(); const level2 = buildIceTaxi(new THREE.Scene(), w, { seed });
  const path = [...part1(pack1X)];
  if (pack2X !== null) path.push([pack2X, -121]);
  else path.push([10, -117], [10, -125]); // 재포장소 선택 발판을 피해 돌아서 지난다
  path.push([0, -128], ...lanePath[lane], [0, -178], [0, -188], [0, -200], [0, -208]);
  const r = run({ level: level2, world: w }, [0, 0, 2], path, { maxT: 260 });
  return { level: level2, r };
};
for (const lane of ['tunnel', 'forest', 'hill']) {
  const { level: l, r } = fullWalk(0, null, lane);
  const route = ICE_ROUTES_2[lane];
  T.check(`2차 ${route.name}: 포장 B로 처음부터 끝까지 걸어서 완주(재포장 건너뜀)`, { ok: r.ok && l.finished && l.ice.delivered2 && l.ice.route2 === route && !l.deliveryGate2.userData.collider.enabled, why: r.why || `delivered2=${l.ice.delivered2}` });
  T.check(`2차 ${route.name}: 결과가 계산식과 같고 처음 포장을 그대로 사용`, { ok: l.ice.delivery2 && l.ice.delivery2.remaining === iceDelivery2(ICE_PACKS[1], route).remaining && !l.ice.pack2, why: '' });
}
{
  // 재포장: 1차 포장 C(무거움) → 재포장소에서 A(가벼움)를 골라 고갯길 바위턱을 오르고 별을 얻는다.
  const { level: l, r } = fullWalk(6, -6, 'hill');
  T.check('재포장: 1차 포장 C → 2차 포장 A로 바꾸면 고갯길 바위턱을 올라 별을 얻음', { ok: r.ok && l.ice.pack.id === 'pack-c' && l.ice.pack2?.id === 'pack-a' && l.hillStar.got && l.ice.delivery2.remaining === iceDelivery2(ICE_PACKS[0], ICE_ROUTES_2.hill).remaining, why: r.why || `pack2=${l.ice.pack2?.id} star=${l.hillStar.got}` });
  const heavy = fullWalk(6, 6, 'hill');
  T.check('무거운 포장 C(2차)로는 고갯길 바위턱을 못 올라 막힘(길을 바꾸면 됨)', { ok: !heavy.r.ok && /막힘/.test(heavy.r.why) && !heavy.level.ice.delivered2, why: heavy.r.why });
  const heavyForest = fullWalk(6, 6, 'forest');
  T.check('포장 C + 숲길: 처음부터 끝까지 완주하고 2차 큰 공연 기준(60%)을 채움', { ok: heavyForest.r.ok && heavyForest.level.finished && heavyForest.level.ice.delivery2.remaining >= BIG_SHOW_2 && heavyForest.level.showStar2.mesh.position.y > -100, why: heavyForest.r.why || `remaining=${heavyForest.level.ice.delivery2?.remaining}` });
}
{
  const m = fullWalk(0, 0, 'tunnel');
  T.check('포장 B + 그늘 터널: 완주하지만 2차 큰 공연 별은 나타나지 않음', { ok: m.r.ok && m.level.showStar2.mesh.position.y < -100 && !m.level.showStar2.got, why: m.r.why });
  const c = new PhysicsWorld(); const cl = buildIceTaxi(new THREE.Scene(), c, { seed: 9 });
  const path = [...part1(6), [6, -121], [0, -128], ...lanePath.forest, [0, -178], [0, -188], [-5, -200]];
  const rc = run({ level: cl, world: c }, [0, 0, 2], path, { maxT: 260 });
  T.check('포장 C + 숲길: 2차 큰 공연 별이 무대에 나타나 걸어서 얻음', { ok: rc.ok && cl.showStar2.got, why: rc.why || `remaining=${cl.ice.delivery2?.remaining}` });
  cl.resetProgress();
  T.check('초기화하면 2차 포장·길·결과·별·문이 처음으로', { ok: !cl.ice.pack2 && !cl.ice.route2 && !cl.ice.delivered2 && !cl.showStar2.got && cl.deliveryGate2.userData.collider.enabled && cl.gravityAt() === 1, why: '' });
}
{
  // 갈림길 앞(재포장소)으로 되돌아오면 다시 고를 수 있다.
  const w = new PhysicsWorld(); const l = buildIceTaxi(new THREE.Scene(), w, { seed: 9 });
  const path = [...part1(0), [0, -128], [LANE_X.forest, -143], [0, -126]];
  const r = run({ level: l, world: w }, [0, 0, 2], path, { maxT: 120 });
  T.check('갈림길 앞으로 되돌아오면 2차 길 선택이 풀려 다시 고를 수 있음', { ok: r.ok && l.ice.route2 === null && !l.ice.carrying2, why: r.why || `route2=${l.ice.route2?.name}` });
}
T.report();
