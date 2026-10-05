// 씨앗 구조대: 규칙·이동 시험. 조작은 가능한 한 봇이 실제로 걸어서 한다(함수 직접 호출 대신).
// 자동 시험은 재미나 학습 효과의 증거가 아니다.
import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { buildSeedRescue, SEED_TYPES, WATER_DROPS, WATER_RANGES, HIGH_DECK, PETAL_ROWS, PETAL_X, seedTypeFor, petalLayout, sproutResult } from '../src/levels/seedrescue.js';
import { mapById } from '../src/levels/index.js';

const T = tally('씨앗 구조대');
const fresh = (seed = 3) => { const world = new PhysicsWorld(); return { world, level: buildSeedRescue(new THREE.Scene(), world, { seed }) }; };
T.check('생명 분류에 맵 등록', { ok: mapById('seedrescue').subject === '생명' && mapById('seedrescue').build === buildSeedRescue, why: '' });
T.check('체크포인트 6곳 이상, 출발~결승 약 174m', { ok: fresh().level.checkpoints.length >= 6, why: String(fresh().level.checkpoints.length) });

// 경로 도우미 (z -20 체크포인트에서 시작해 연못 입구 z -66까지)
const HIGH = [[-6, -24], [-6, -28.6], [-6, -36], [-6, -60], [-6, -63.5], [0, -66]];
const HIGH_EDGE = [[-6, -24], [-6, -28.6], [-6, -32], [-8.8, -34], [-8.8, -60], [-8.8, -63.5], [0, -66]];
const LOW = [[6, -25], [6, -36], [11, -38], [11, -50], [6, -51], [6, -60], [0, -66]];
const SPRING = [[4, -72], [7, -77], [3.5, -77]]; // 올라섰다 가운데 쪽으로 내려오기 한 번
const DRAIN = [[-4, -72], [-7, -77], [-3.5, -77]];
const POT = [[0, -96], [0, -102], [0, -108]];
const BRIDGE = [[0, -113], [0, -142], [0, -171]];

// 1. 발판은 올라선 순간 한 번만
{
  const m = fresh();
  const p = new Player(new THREE.Scene()); p.respawn(new THREE.Vector3(7, 1.2, -77), 0);
  for (let t = 0; t < 1.5; t += S) { m.level.update(t, S, p); p.step(S, { x: 0, y: 0 }, 0, m.world, null, null); }
  T.check('샘 발판에 1.5초 서 있어도 물은 한 방울만', { ok: m.level.seedRescue.water === 1 && m.level.seedRescue.adjustments === 1, why: String(m.level.seedRescue.water) });
  const r = run(m, [0, 1, -72], [...SPRING, ...SPRING], { maxT: 20 });
  T.check('샘 발판에 두 번 더 올라서면 두 방울 더', { ok: r.ok && m.level.seedRescue.water === 3, why: r.why || String(m.level.seedRescue.water) });
  const d = run(m, [0, 1, -72], [...DRAIN], { maxT: 20 });
  T.check('배수 발판에 한 번 올라서면 한 방울 덜기', { ok: d.ok && m.level.seedRescue.water === 2 && m.level.seedRescue.adjustments === 4, why: d.why || String(m.level.seedRescue.water) });
}
{
  const m = fresh(); let msgs = 0; m.level.onMessage = () => msgs++;
  const r = run(m, [0, 1, 2], [[-6.5, -12], [-6.5, -14], [0, -18]], { maxT: 15 });
  T.check('씨앗 받기 발판: 걸어서 받고 안내는 한 번', { ok: r.ok && m.level.seedRescue.seedCollected && msgs === 1, why: r.why || `msgs=${msgs}` });
}

// 2. 갈림길: 실제로 걸어서 경로·물 모으기
{
  const m = fresh(); const r = run(m, [0, 1, -20], HIGH, { maxT: 30 });
  T.check('높은 잎길: 탄성 발판으로 올라 걸어서 지나감, 물 2', { ok: r.ok && m.level.seedRescue.route === 'high' && m.level.seedRescue.water === WATER_DROPS.high, why: r.why || `route=${m.level.seedRescue.route} water=${m.level.seedRescue.water}` });
  const m2 = fresh(); const r2 = run(m2, [0, 1, -20], LOW, { maxT: 30 });
  T.check('낮은 샘길: 걸어서 지나감, 물 5', { ok: r2.ok && m2.level.seedRescue.route === 'low' && m2.level.seedRescue.water === WATER_DROPS.low, why: r2.why || `route=${m2.level.seedRescue.route} water=${m2.level.seedRescue.water}` });
  const m3 = fresh(); const r3 = run(m3, [0, 1, -20], HIGH_EDGE, { maxT: 30 });
  T.check('높은 잎길 가장자리로 걸으면 물방울을 피할 수 있음', { ok: r3.ok && m3.level.seedRescue.water === 0, why: r3.why || String(m3.level.seedRescue.water) });
  const m4 = fresh(); const r4 = run(m4, [-8.6, 1, -24], [[-8.6, -36]], { maxT: 8 });
  T.check('탄성 발판 없이는 높은 잎길에 오르지 못함', { ok: !r4.ok, why: r4.why || 'climbed' });
  const m5 = fresh(); const p = new Player(new THREE.Scene()); p.respawn(m5.level.checkpoints.find((c) => c.name === '높은 길 중간').respawn, 0);
  let top = 0; for (let t = 0; t < 2; t += S) { m5.level.update(t, S, p); p.step(S, { x: 0, y: 0 }, 0, m5.world, null, null); top = Math.max(top, p.pos.y); }
  T.check('높은 길 중간 체크포인트에서 튕기지 않음', { ok: top < HIGH_DECK.y + 0.3, why: top.toFixed(2) });
}

// 3. 화분: 올라서면 심기, 물을 바꾸고 다시 올라서면 다시 심기. 심지 않고 지나가도 다리가 생김
{
  const m = fresh(); const st = m.level.seedRescue; st.setSeedType('vegetable');
  const r = run(m, [0, 1, -66], [...SPRING, ...SPRING, ...POT], { maxT: 30 });
  T.check('화분에 걸어 올라서면 심김 (물 2 → 채소 알맞음)', { ok: r.ok && st.result === 'good' && !st.autoPlanted, why: r.why || `${st.result}` });
  const r2 = run(m, [0, 1, -108], [[0, -92], ...SPRING, ...SPRING, ...POT], { maxT: 40 });
  T.check('물을 바꿔 다시 올라서면 다시 심김 (물 4 → 지나침)', { ok: r2.ok && st.water === 4 && st.result === 'excess', why: r2.why || `${st.water} ${st.result}` });
  const m2 = fresh(); const r3 = run(m2, [6, 1, -95], [[6, -110], ...BRIDGE], { maxT: 40 });
  T.check('화분을 지나쳐도 계곡 입구에서 자동으로 심겨 완주', { ok: r3.ok && m2.level.seedRescue.autoPlanted && m2.level.finished, why: r3.why || `${m2.level.seedRescue.result}` });
}

// 4. 전 구간: 경로 × 조절 × 결과 (모두 걸어서)
const cases = [
  ['high', 'vegetable', [], 'good'], ['high', 'bean', [], 'low'], ['high', 'small', [], 'excess'],
  ['high', 'bean', [SPRING, SPRING], 'good'], ['low', 'bean', [], 'good'], ['low', 'large', [], 'low'],
  ['low', 'vegetable', [], 'excess'], ['low', 'vegetable', [DRAIN, DRAIN], 'good'], ['low', 'large', [SPRING], 'good'],
];
for (const [route, seedId, adjust, expect] of cases) {
  const m = fresh(11); const st = m.level.seedRescue; st.setSeedType(seedId);
  const r = run(m, [0, 1, 4], [[0, -18], ...(route === 'high' ? HIGH : LOW), ...adjust.flat(), [0, -88], ...POT, ...BRIDGE], { maxT: 150 });
  T.check(`${route} 길 · ${seedId} · 조절 ${adjust.length}번 → ${expect} 다리로 완주`, { ok: r.ok && st.result === expect && m.level.finished, why: r.why || `result=${st.result} water=${st.water}` });
}
// 지나침 다리(뿌리 발판)는 정말로 뛰어야 한다 / 적음 다리는 좁다
{
  const m = fresh(); const st = m.level.seedRescue; st.setSeedType('small'); st.setWater(4); st.plant();
  const pieces = st.bridges.excess;
  T.check('지나침 다리: 짧은 줄기 뒤 띄엄띄엄 뿌리 발판', { ok: pieces.length >= 5 && pieces.every((p) => p.userData.collider.enabled), why: String(pieces.length) });
  const w = run(m, [0, 1, -113], BRIDGE, { maxT: 40, nojump: true });
  T.check('지나침 다리: 뛰지 않으면 건너지 못함', { ok: !w.ok, why: w.why || 'walked' });
}

// 5. 별: 높은 길 별 섬(점프+다이브), 낮은 길 무조절 알맞음 별(화분 옆), 꽃잎 별
function islandTry() {
  let hits = 0, tries = 0;
  for (const jumpX of [-8.8, -9.2, -9.5]) for (const dv of [3, 1, 0, -1, -2]) {
    const m = fresh(); const p = new Player(new THREE.Scene());
    p.respawn(new THREE.Vector3(-4, HIGH_DECK.y, -52), -Math.PI / 2);
    let jumped = false, dived = false;
    for (let t = 0; t < 3.5; t += S) {
      if (!jumped && p.pos.x <= jumpX && p.grounded) { p.requestJump(); jumped = true; }
      if (jumped && !dived && !p.grounded && p.vel.y <= dv) { p.requestDive(); dived = true; }
      m.level.update(t, S, p); p.step(S, { x: -1, y: 0 }, 0, m.world, null, null);
    }
    tries++; if (m.level.stars[0].got) hits++;
  }
  return `${hits}/${tries}`;
}
{
  const r = islandTry();
  console.log('  높은 길 별 섬 (점프+다이브):', r);
  T.check('높은 길 별 섬: 점프+다이브로 닿음', { ok: !r.startsWith('0/'), why: r });
  const mj = fresh(); run(mj, [-6, HIGH_DECK.y, -52], [[-20, -52]], { maxT: 5 });
  T.check('높은 길 별 섬: 보통 점프만으로는 못 닿음', { ok: !mj.level.stars[0].got, why: '' });
  const m = fresh(); const st = m.level.seedRescue; st.setSeedType('bean');
  const r2 = run(m, [0, 1, -20], [...LOW, [0, -88], ...POT, [-7, -106]], { maxT: 60 });
  T.check('낮은 길 · 조절 없이 알맞음 → 화분 옆 별을 걸어서 얻음', { ok: r2.ok && m.level.stars[1].got, why: r2.why || `${st.result} adj=${st.adjustments}` });
  const m2 = fresh(); m2.level.seedRescue.setSeedType('bean');
  run(m2, [0, 1, -20], [...LOW, ...SPRING, ...DRAIN, [0, -88], ...POT], { maxT: 60 });
  T.check('물을 조절했으면 그 별은 나타나지 않음', { ok: m2.level.seedRescue.result === 'good' && m2.level.stars[1].mesh.position.y < -100, why: '' });
}
{
  // 꽃잎: 물 머금은 잎만 밟아 끝의 별 → 받침으로 다리 쪽에 돌아옴 / 마른 잎은 떨어짐
  const m = fresh(5); const st = m.level.seedRescue; st.setSeedType('vegetable'); st.setWater(2); st.plant();
  const layout = petalLayout(5);
  const path = [[8, -117.5]];
  PETAL_ROWS.forEach((z, r) => path.push([PETAL_X[layout[r]], z]));
  path.push([8.25, -152], [3, -152], [0, -152], [0, -171]);
  const r = run(m, [0, 1, -115], path, { maxT: 40 });
  T.check('꽃잎: 물 머금은 잎만 밟으면 별을 얻고 다리로 돌아가 완주', { ok: r.ok && m.level.stars[2].got && m.level.finished, why: r.why });
  const m2 = fresh(5); m2.level.seedRescue.setSeedType('vegetable'); m2.level.seedRescue.setWater(2); m2.level.seedRescue.plant();
  const dp = new Player(new THREE.Scene()); dp.respawn(new THREE.Vector3(PETAL_X[1 - layout[0]], 1.05, PETAL_ROWS[0]), 0);
  for (let t = 0; t < 2.5; t += S) { m2.level.update(t, S, dp); dp.step(S, { x: 0, y: 0 }, 0, m2.world, null, null); }
  T.check('꽃잎: 마른 잎은 밟으면 처져 떨어짐', { ok: dp.pos.y < -1, why: dp.pos.y.toFixed(2) });
  const wp = new Player(new THREE.Scene()); wp.respawn(new THREE.Vector3(PETAL_X[layout[0]], 1.05, PETAL_ROWS[0]), 0);
  for (let t = 0; t < 2.5; t += S) { m2.level.update(t, S, wp); wp.step(S, { x: 0, y: 0 }, 0, m2.world, null, null); }
  T.check('꽃잎: 물 머금은 잎은 버팀', { ok: wp.pos.y > 0.9, why: wp.pos.y.toFixed(2) });
  const layouts = new Set(Array.from({ length: 12 }, (_, s) => petalLayout(s + 1).join('')));
  T.check('꽃잎 배치가 시드마다 달라짐', { ok: layouts.size >= 4, why: String(layouts.size) });
  const wet = st.petals.find((pt) => pt.userData.petal.wet), dry = st.petals.find((pt) => !pt.userData.petal.wet);
  T.check('밟기 전 단서: 물 머금은 잎은 진한 색·부푼 모양', { ok: wet.material.color.getHex() !== dry.material.color.getHex() && wet.userData.petal.puff.visible && !dry.userData.petal.puff.visible, why: '' });
}

// 6. 상태 유지·초기화·시드
{
  const m = fresh(2), st = m.level.seedRescue;
  run(m, [0, 1, -20], [...LOW], { maxT: 30 });
  const saved = [st.seedType.id, st.water, st.route];
  const p = new Player(new THREE.Scene()); p.respawn(m.level.checkpoints.find((c) => c.name === '낮은 길 중간').respawn, 0);
  T.check('체크포인트 복귀 뒤 씨앗·물·경로 유지', { ok: JSON.stringify([st.seedType.id, st.water, st.route]) === JSON.stringify(saved), why: JSON.stringify(saved) });
  m.level.resetProgress();
  T.check('처음부터: 진행은 초기화, 그 판의 씨앗 종류는 유지', { ok: st.route === null && st.water === 0 && st.result === null && st.seedType.id === seedTypeFor(2).id && m.level.stars.every((s) => !s.got) && st.bridges.good.every((b) => !b.userData.collider.enabled), why: st.seedType.id });
  const kinds = new Set(Array.from({ length: 20 }, (_, i) => seedTypeFor(i + 1).id));
  m.level.setSeed(9);
  T.check('시드에 따라 씨앗 종류가 바뀜', { ok: kinds.size > 1 && st.seedType.id === seedTypeFor(9).id, why: [...kinds].join(',') });
  T.check('씨앗마다 알맞은 범위가 다름 · 결과 규칙', { ok: new Set(SEED_TYPES.map((s) => WATER_RANGES[s.id].join('-'))).size === 4 && sproutResult(SEED_TYPES[2], 3) === 'low' && sproutResult(SEED_TYPES[2], 4) === 'good' && sproutResult(SEED_TYPES[2], 6) === 'excess', why: '' });
}
T.report();
