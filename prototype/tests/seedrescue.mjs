// 씨앗 구조대(세 정거장): 규칙·이동 시험. 조작은 봇이 실제로 걸어서 한다. 재미·학습 효과의 증거가 아니다.
import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { buildSeedRescue, SEED_TYPES, WATER_DROPS, HIGH_DECK, PETAL_ROWS, PETAL_X, Z, seedTypeFor, stationLayout, sproutResult } from '../src/levels/seedrescue.js';
import { mapById } from '../src/levels/index.js';

const T = tally('씨앗 구조대');
const fresh = (seed = 3) => { const world = new PhysicsWorld(); return { world, level: buildSeedRescue(new THREE.Scene(), world, { seed }) }; };
T.check('생명 분류에 맵 등록', { ok: mapById('seedrescue').subject === '생명' && mapById('seedrescue').build === buildSeedRescue, why: '' });
T.check('체크포인트 7곳 이상, 출발~결승 약 242m', { ok: fresh().level.checkpoints.length >= 7 && Z.finish === -238, why: String(fresh().level.checkpoints.length) });

const HIGH = [[0, -18], [-6, -24], [-6, -28.6], [-6, -36], [-6, -60], [-6, -63.5], [0, -66]];
const HIGH_EDGE = [[0, -18], [-6, -24], [-6, -28.6], [-6, -32], [-8.8, -34], [-8.8, -60], [-8.8, -63.5], [0, -66]];
const LOW = [[0, -18], [6, -25], [6, -36], [11, -38], [11, -50], [6, -51], [6, -60], [0, -66]];
const SPRING = [[4, -72], [7.5, -76], [4, -76]];
const DRAIN = [[-4, -72], [-7.5, -76], [-4, -76]];
const POT = [[0, -71], [0, -76], [0, -79.5]];
const BRIDGE1 = [[0, -84], [0, -107]];
const warmPath = (L) => [[L.warmSide * 8, -114], [L.warmSide * 8, -122], [L.warmSide * 8, -126], [0, -148], [0, -169]];
const darkPath = [[0, -178], [0, -192], [0, -205], [0, -239]];
const gardenPath = (L) => [[L.gardenSide * 7, -178], [L.gardenSide * 7, -192], [L.gardenSide * 7, -205], [0, -209], [0, -239]];

// ─── ① 물 정거장 ───
{
  const m = fresh(); const p = new Player(new THREE.Scene()); p.respawn(new THREE.Vector3(7.5, 1.2, -76), 0);
  for (let t = 0; t < 1.5; t += S) { m.level.update(t, S, p); p.step(S, { x: 0, y: 0 }, 0, m.world, null, null); }
  T.check('물 발판에 1.5초 서 있어도 한 방울만', { ok: m.level.seedRescue.water === 1, why: String(m.level.seedRescue.water) });
}
{
  const m = fresh(); const r = run(m, [0, 1, 2], HIGH, { maxT: 40 });
  T.check('높은 잎길: 탄성 발판으로 올라 지나감, 물 2', { ok: r.ok && m.level.seedRescue.route === 'high' && m.level.seedRescue.water === WATER_DROPS.high, why: r.why || String(m.level.seedRescue.water) });
  const m2 = fresh(); const r2 = run(m2, [0, 1, 2], LOW, { maxT: 40 });
  T.check('낮은 샘길: 지나감, 물 5', { ok: r2.ok && m2.level.seedRescue.water === WATER_DROPS.low, why: r2.why || String(m2.level.seedRescue.water) });
  const m3 = fresh(); const r3 = run(m3, [0, 1, 2], HIGH_EDGE, { maxT: 40 });
  T.check('가장자리로 걸으면 물방울을 피함', { ok: r3.ok && m3.level.seedRescue.water === 0, why: r3.why || String(m3.level.seedRescue.water) });
  const r4 = run(fresh(), [-8.6, 1, -24], [[-8.6, -36]], { maxT: 8 });
  T.check('탄성 발판 없이는 높은 잎길에 못 오름', { ok: !r4.ok, why: r4.why || 'climbed' });
}
{
  const m = fresh(); const st = m.level.seedRescue;
  T.check('숫자 범위 대신 말 단서', { ok: SEED_TYPES.every((s) => s.hint && !/\d/.test(s.hint)), why: '' });
  const r = run(m, [0, 1, -66], [[5, -70], [5, -80.6], [0, -80.8]], { maxT: 10 }); // 화분을 피해 울타리로
  T.check('심기 전에는 울타리가 막음 → 울타리 앞에서 지금 물로 자동 심기', { ok: r.ok && st.autoPlanted && st.result === 'low', why: r.why || st.result });
  st.setSeedType('vegetable');
  const r2 = run(m, [0, 1, -80], [[0, -95]], { maxT: 10 });
  T.check('틀린 결과(적음): 짧은 줄기 끝 벽에서 막힘(떨어지지 않음)', { ok: !r2.ok && /막힘/.test(r2.why), why: r2.why || 'passed' });
  const r3 = run(m, [0, 1, -88], [[0, -80], ...SPRING, ...SPRING, ...POT, ...BRIDGE1], { maxT: 40 });
  T.check('되돌아가 물을 더해 다시 심으면 넓은 잎 다리로 건넘', { ok: r3.ok && st.result === 'good' && st.plants >= 2, why: r3.why || `${st.result} ${st.water} plants=${st.plants}` });
  T.check('다시 심어 맞히면 한 번에 맞힘 별은 없음', { ok: m.level.stars.find((s) => s.at).mesh.position.y < -100, why: '' });
}
{
  const m = fresh(); const st = m.level.seedRescue; st.setSeedType('bean');
  const r = run(m, [0, 1, 2], [...LOW, ...POT, ...BRIDGE1, [8, -112], [0, -113]], { maxT: 60 });
  const star = m.level.stars.find((s) => s.at);
  T.check('낮은 길 물 5 · 콩 → 한 번에 알맞음 → 별을 걸어서 얻음', { ok: r.ok && st.result === 'good' && star.got, why: r.why || st.result });
  const m2 = fresh(); m2.level.seedRescue.setSeedType('vegetable');
  run(m2, [0, 1, 2], [...LOW, ...POT], { maxT: 60 });
  T.check('물이 지나치면(채소, 물 5) 지나침', { ok: m2.level.seedRescue.result === 'excess', why: m2.level.seedRescue.result });
}

// ─── ② 온도 정거장 ───
for (const seed of [2, 5]) {
  const L = stationLayout(seed);
  const m = fresh(seed); const st = m.level.seedRescue;
  const r = run(m, [0, 1, -110], warmPath(L), { maxT: 40 });
  T.check(`온도 시드 ${seed}: 옆 온실에 심으면 다리로 건넘`, { ok: r.ok && st.temp.result === 'warm' && st.temp.tries === 1, why: r.why || JSON.stringify(st.temp) });
  const m2 = fresh(seed); const st2 = m2.level.seedRescue;
  const r2 = run(m2, [0, 1, -110], [[0, -130], [0, -141], [0, -149.6], [0, -155]], { maxT: 20 });
  T.check(`온도 시드 ${seed}: 지나가는 길의 얼음 창고에 심으면 싹이 안 트고 울타리가 막음`, { ok: !r2.ok && st2.temp.result === 'cold' && /막힘/.test(r2.why), why: r2.why || JSON.stringify(st2.temp) });
  const back = [[0, -146], [-L.warmSide * 0 + L.warmSide * 7, -146], [L.warmSide * 7, -132], ...warmPath(L).slice(1)];
  const r3 = run(m2, [0, 1, -146], back, { maxT: 40 });
  T.check(`온도 시드 ${seed}: 온실로 되돌아가 심으면 건넘`, { ok: r3.ok && st2.temp.result === 'warm' && st2.temp.tries === 2, why: r3.why || JSON.stringify(st2.temp) });
}
T.check('온실 위치가 시드마다 달라짐', { ok: new Set(Array.from({ length: 10 }, (_, s) => stationLayout(s + 1).warmSide)).size === 2, why: '' });

// ─── ③ 빛 정거장 ───
for (const seed of [2, 5]) {
  const L = stationLayout(seed);
  const m = fresh(seed); const st = m.level.seedRescue;
  const r = run(m, [0, 1, -172], darkPath, { maxT: 40 });
  T.check(`빛 시드 ${seed}: 어두운 터널에 심어도 싹이 트고 결승`, { ok: r.ok && st.light.place === 'dark' && m.level.finished, why: r.why || JSON.stringify(st.light) });
  const m2 = fresh(seed); const st2 = m2.level.seedRescue;
  const r2 = run(m2, [0, 1, -172], gardenPath(L), { maxT: 40 });
  T.check(`빛 시드 ${seed}: 밝은 정원에 심어도 싹이 트고 결승`, { ok: r2.ok && st2.light.place === 'garden' && m2.level.finished, why: r2.why || JSON.stringify(st2.light) });
}
{
  const measure = (path) => { const m = fresh(5); const p = new Player(new THREE.Scene()); p.respawn(new THREE.Vector3(0, 1, -172), 0); let i = 0, t = 0;
    while (i < path.length && t < 40) { const [tx, tz] = path[i]; const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz); if (d < 0.6) { i++; continue; } m.level.update(t, S, p); p.step(S, { x: dx / d, y: -dz / d }, 0, m.world, null, null); t += S; } return t; };
  const td = measure(darkPath.slice(0, 3)), tg = measure(gardenPath(stationLayout(5)).slice(0, 4));
  console.log(`  빛 정거장 출발~다리 앞: 어두운 터널 ${td.toFixed(1)}초, 밝은 정원 ${tg.toFixed(1)}초`);
  T.check('어두운 터널이 밝은 정원보다 빠름(맞는 개념이 빠른 길)', { ok: td < tg, why: `${td.toFixed(1)} vs ${tg.toFixed(1)}` });
}

// ─── 전 구간 (출발 → 결승, 모두 맞게) ───
for (const [seed, seedId, route, adjust] of [[4, 'bean', LOW, []], [6, 'vegetable', HIGH, []], [8, 'large', LOW, [SPRING]], [9, 'small', HIGH, [DRAIN]]]) {
  const L = stationLayout(seed);
  const m = fresh(seed); const st = m.level.seedRescue; st.setSeedType(seedId);
  const r = run(m, [0, 1, 2], [...route, ...adjust.flat(), ...POT, ...BRIDGE1, ...warmPath(L), ...(seed % 2 ? darkPath : gardenPath(L))], { maxT: 200 });
  T.check(`전 구간 시드 ${seed} · ${seedId}: 세 정거장 모두 맞게 → 결승`, { ok: r.ok && st.result === 'good' && st.temp.result === 'warm' && !!st.light.place && m.level.finished, why: r.why || JSON.stringify({ r: st.result, w: st.water, t: st.temp, l: st.light }) });
}

// ─── 선택 별 ───
{
  let hits = 0;
  for (const jumpX of [-8.8, -9.2, -9.5]) for (const dv of [3, 1, 0, -1, -2]) {
    const m = fresh(); const p = new Player(new THREE.Scene()); p.respawn(new THREE.Vector3(-4, HIGH_DECK.y, -52), -Math.PI / 2);
    let jumped = false, dived = false;
    for (let t = 0; t < 3.5; t += S) {
      if (!jumped && p.pos.x <= jumpX && p.grounded) { p.requestJump(); jumped = true; }
      if (jumped && !dived && !p.grounded && p.vel.y <= dv) { p.requestDive(); dived = true; }
      m.level.update(t, S, p); p.step(S, { x: -1, y: 0 }, 0, m.world, null, null);
    }
    if (m.level.stars[0].got) hits++;
  }
  console.log(`  높은 길 별 섬 (점프+다이브): ${hits}/15`);
  T.check('높은 길 별 섬: 점프+다이브로 닿음', { ok: hits > 0, why: String(hits) });
  const m = fresh(5); const st = m.level.seedRescue; st.setSeedType('vegetable'); st.setWater(2); st.plant(); st.plantTemp('warm'); st.plantLight('dark');
  const lay = stationLayout(5).petals;
  const path = [[8, -210]];
  PETAL_ROWS.forEach((z, i) => path.push([PETAL_X[lay[i]], z]));
  path.push([4, -233], [0, -239]);
  const r = run(m, [0, 1, -205], path, { maxT: 40 });
  T.check('꽃잎: 물 머금은 잎만 밟아 마지막 꽃잎 위 별 → 결승', { ok: r.ok && m.level.stars.at(-1).got && m.level.finished, why: r.why });
  const dp = new Player(new THREE.Scene()); dp.respawn(new THREE.Vector3(PETAL_X[1 - lay[0]], 1.05, PETAL_ROWS[0]), 0);
  for (let t = 0; t < 2.5; t += S) { m.level.update(t, S, dp); dp.step(S, { x: 0, y: 0 }, 0, m.world, null, null); }
  T.check('꽃잎: 마른 잎은 처져 떨어짐', { ok: dp.pos.y < -1, why: dp.pos.y.toFixed(2) });
}

// ─── 상태 ───
{
  const m = fresh(2), st = m.level.seedRescue;
  st.setWater(3); st.plant(); st.plantTemp('cold'); st.plantTemp('warm'); st.plantLight('garden');
  T.check('온실 성공 뒤 얼음 창고를 밟아도 결과 유지', { ok: st.plantTemp('cold') === 'warm' && st.bridges.temp.userData.collider.enabled, why: '' });
  m.level.resetProgress();
  T.check('처음부터: 세 정거장·별 초기화, 그 판의 씨앗 유지', { ok: st.result === null && st.temp.result === null && st.light.place === null && st.water === 0 && st.seedType.id === seedTypeFor(2).id && !st.bridges.good.userData.collider.enabled && m.level.stars.every((s) => !s.got), why: '' });
  T.check('결과 규칙', { ok: sproutResult(SEED_TYPES[2], 3) === 'low' && sproutResult(SEED_TYPES[2], 4) === 'good' && sproutResult(SEED_TYPES[2], 6) === 'excess', why: '' });
  T.check('씨앗 종류가 시드마다 달라짐', { ok: new Set(Array.from({ length: 20 }, (_, i) => seedTypeFor(i + 1).id)).size > 1, why: '' });
}
T.report();
