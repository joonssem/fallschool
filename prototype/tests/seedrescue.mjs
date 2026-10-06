// 씨앗 구조대(세 정거장): 규칙·이동 시험. 조작은 봇이 실제로 걸어서 한다. 재미·학습 효과의 증거가 아니다.
import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { buildSeedRescue, PREDICT_DWELL, SEED_TYPES, WATER_DROPS, HIGH_DECK, PETAL_ROWS, PETAL_X, Z, seedTypeFor, stationLayout, sproutResult } from '../src/levels/seedrescue.js';
import { mapById } from '../src/levels/index.js';

const T = tally('씨앗 구조대');
const fresh = (seed = 3) => { const world = new PhysicsWorld(); return { world, level: buildSeedRescue(new THREE.Scene(), world, { seed }) }; };
T.check('생명 분류에 맵 등록', { ok: mapById('seedrescue').subject === '생명' && mapById('seedrescue').build === buildSeedRescue, why: '' });
T.check('체크포인트 7곳 이상, 출발~결승 약 242m', { ok: fresh().level.checkpoints.length >= 7 && Z.finish === -238, why: String(fresh().level.checkpoints.length) });

// 예상 발판에 올라서서 secs초 서 있는다(레벨 상태는 그대로 이어진다).
const standOn = (m, x, z, secs) => { const p = new Player(new THREE.Scene()); p.respawn(new THREE.Vector3(x, 1.2, z), 0);
  for (let t = 0; t < secs; t += S) { m.level.update(t, S, p); p.step(S, { x: 0, y: 0 }, 0, m.world, null, null); } };
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

// ─── 예상(가설) 고르기: 선택 활동. 걸어서 발판을 밟으면 기록되고, 건너뛰어도 완주된다 ───
{
  const water = (seedId, pad, water) => { const m = fresh(); const st = m.level.seedRescue; st.setSeedType(seedId); st.setWater(water);
    standOn(m, pad[0], pad[1], PREDICT_DWELL + 0.5);
    const r = run(m, [pad[0], 1.2, pad[1]], [[pad[0], -73], [0, -76], [0, -79.5]], { maxT: 20 });
    return { st, r, after: { predict: st.predict.water, hit: st.hits.water } }; };
  const a = water('vegetable', [-6, -70], 2); // 알맞을 것 같아요 → 채소 씨앗 물 2 = 알맞음
  T.check('물 예상: 발판을 걸어서 밟고 심으면 예상이 맞았다고 비교', { ok: a.st.result === 'good' && a.after.hit === true && a.after.predict === null, why: JSON.stringify(a.after) });
  const b = water('vegetable', [-9.5, -70], 2); // 적을 것 같아요 → 실제 알맞음
  T.check('물 예상: 예상과 다르면 달랐다고 기록', { ok: b.st.result === 'good' && b.after.hit === false, why: JSON.stringify(b.after) });
  const c = water('vegetable', [-2.5, -70], 5); // 지나칠 것 같아요 → 실제 지나침
  T.check('물 예상: 지나침을 맞힘', { ok: c.st.result === 'excess' && c.after.hit === true, why: JSON.stringify(c.after) });
  const m = fresh(); const st = m.level.seedRescue; st.setSeedType('vegetable'); st.setWater(2);
  st.setPrediction('water', 'low'); st.plant(); st.setPrediction('water', 'good'); st.plant();
  T.check('물 예상: 정거장마다 첫 비교만 센다(다시 심어 맞혀도 처음 결과 유지)', { ok: st.hits.water === false, why: String(st.hits.water) });
  T.check('잘못된 예상 값은 무시', { ok: st.setPrediction('water', 'huge') === false && st.setPrediction('nope', 'low') === false, why: '' });
}
for (const seed of [2, 5]) {
  const L = stationLayout(seed);
  const tryTemp = (guessPad, path) => { const m = fresh(seed); const st = m.level.seedRescue; standOn(m, guessPad[0], guessPad[1], PREDICT_DWELL + 0.5); run(m, [guessPad[0], 1.2, guessPad[1]], path, { maxT: 40 }); return st; };
  const w = tryTemp([3.5, -116], warmPath(L));
  T.check(`온도 예상 시드 ${seed}: 온실 예상 → 온실에 심어 맞힘`, { ok: w.temp.result === 'warm' && w.hits.temp === true, why: JSON.stringify(w.hits) });
  const c = tryTemp([-3.5, -116], warmPath(L));
  T.check(`온도 예상 시드 ${seed}: 얼음 창고 예상 → 온실에서 싹이 터 예상이 달랐음`, { ok: c.hits.temp === false, why: JSON.stringify(c.hits) });
  const m = fresh(seed); const st = m.level.seedRescue;
  st.setPrediction('temp', 'warm'); st.plantTemp('cold');
  T.check(`온도 예상 시드 ${seed}: 온실 예상인데 창고에 심으면 아직 판정하지 않고 예상 유지`, { ok: st.hits.temp === null && st.predict.temp === 'warm', why: JSON.stringify(st.predict) });
  st.plantTemp('warm');
  T.check(`온도 예상 시드 ${seed}: 이어서 온실에 심으면 맞힘`, { ok: st.hits.temp === true && st.predict.temp === null, why: JSON.stringify(st.hits) });
  const m2 = fresh(seed); const st2 = m2.level.seedRescue;
  st2.setPrediction('temp', 'cold'); st2.plantTemp('cold');
  T.check(`온도 예상 시드 ${seed}: 얼음 창고 예상 → 창고에 심어도 싹이 안 터 달랐음`, { ok: st2.hits.temp === false, why: JSON.stringify(st2.hits) });
}
{
  const dark = (pad) => { const m = fresh(5); const st = m.level.seedRescue; standOn(m, pad[0], pad[1], PREDICT_DWELL + 0.5); run(m, [pad[0], 1.2, pad[1]], darkPath, { maxT: 40 }); return st; };
  const a = dark([4.5, -178]);
  T.check('빛 예상: 없어도 틀 것 같다 → 어두운 터널에서 맞힘', { ok: a.light.place === 'dark' && a.hits.light === true, why: JSON.stringify(a.hits) });
  const b = dark([-4.5, -178]);
  T.check('빛 예상: 꼭 필요할 것 같다 → 어두운 터널에서 싹이 터 달랐음', { ok: b.hits.light === false, why: JSON.stringify(b.hits) });
  const m = fresh(5); const st = m.level.seedRescue;
  st.setPrediction('light', 'need'); st.plantLight('garden');
  T.check('빛 예상: 밝은 정원에 심으면 판정할 수 없어 보류(기록 없음)', { ok: st.hits.light === null && st.predict.light === 'need', why: JSON.stringify(st.hits) });
}
{
  const m = fresh(); const st = m.level.seedRescue;
  run(m, [-11, 1.2, -70], [[-1, -70], [4, -70]], { maxT: 10 }); // 세 발판을 걸어서 지나감
  T.check('예상 발판을 지나치기만 하면 기록되지 않음(잠깐 서 있어야 선택)', { ok: st.predict.water === null, why: String(st.predict.water) });
  standOn(m, -6, -70, 0.3);
  T.check('예상 발판에 잠깐만 서도 기록되지 않음', { ok: st.predict.water === null, why: String(st.predict.water) });
  standOn(m, -6, -70, PREDICT_DWELL + 0.5);
  T.check('예상 발판에 서 있으면 기록됨', { ok: st.predict.water === 'good', why: String(st.predict.water) });
}
{
  const L = stationLayout(4); const m = fresh(4); const st = m.level.seedRescue; st.setSeedType('bean');
  const r = run(m, [0, 1, 2], [...LOW, ...POT, ...BRIDGE1, ...warmPath(L), ...darkPath], { maxT: 200 });
  T.check('예상을 하나도 안 골라도 완주(선택 활동은 건너뛸 수 있음)', { ok: r.ok && m.level.finished && Object.values(st.hits).every((v) => v === null), why: r.why || JSON.stringify(st.hits) });
  const m2 = fresh(2); const s2 = m2.level.seedRescue; s2.setPrediction('water', 'good'); s2.hits.water = true; m2.level.resetProgress();
  T.check('처음부터: 예상 기록 초기화', { ok: Object.values(s2.predict).every((v) => v === null) && Object.values(s2.hits).every((v) => v === null), why: '' });
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
