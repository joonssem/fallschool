// 거대 실험실: 문 3개, 피스톤 발판, 액체 발판, 실험대·결승을 시드 3 × 출발 시각 8로 통과하는지
import { loadMap, lane, run, tally } from './harness.mjs';
const make = await loadMap('giantlab');
const T = tally('거대 실험실');
for (const seed of [1, 2, 3]) for (const t0 of [0, 1.5, 3, 4.5, 6, 8, 10, 12]) {
  const m = make(seed);
  const g = (i) => lane(m.level, i);
  const o = { t0 };
  T.check('안전 장비 문', run(m, [g(0), 1.5, -12], [[g(0), -14.5], [g(0), -20], [0, -27]], { ...o, nojump: true }));
  T.check('기체 부피 문', run(m, [g(1), 1.5, -30], [[g(1), -40]], { ...o, nojump: true }));
  T.check('피스톤 발판', run(m, [0, 1.5, -40.5], [[-3, -45], [3, -55], [-2, -65], [0, -74]], o));
  T.check('액체 발판', run(m, [0, 1.5, -72], [[0, -84], [0, -92], [0, -100], [0, -108]], o));
  T.check('부력 문', run(m, [g(2), 5.5, -106], [[g(2), -120]], { ...o, nojump: true }));
  T.check('실험대·결승', run(m, [0, 5.5, -121.5], [[0, -128], [0, -143], [0, -152]], o));
}

// 선택 도전 공기 실험대: 안 눌러도 길은 열려 있고(위 검사), 문은 목표 부피에서만 열린다. 문으로 가는 길(z=-38.2)은 발판(z=-41) 옆이라 지나가도 눌리지 않는다
const PAD_X = [8.4, 11, 13.6], VOL = [12, 9, 6], LANE = -38.2;
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const m = make(seed);
  const b = m.level.airBench;
  const t = VOL.indexOf(b.target);
  const toPad = (i, from) => run(m, from, [[PAD_X[i], -41]]);
  T.check('목표 부피는 세 값 중 하나', { ok: t >= 0, why: String(b.target) });
  const closed = run(m, [0, 1.5, -40.5], [[8, LANE], [14.2, LANE], [19.5, LANE]], { maxT: 10 });
  T.check('누르지 않으면 문이 닫혀 막힘', { ok: !closed.ok && b.sel === null, why: `sel=${b.sel} ${closed.why}` });
  const wrong = [0, 1, 2].filter((i) => i !== t)[0];
  T.check('틀린 힘 발판 밟기', toPad(wrong, [12, 1.5, LANE]));
  T.check('틀린 힘이면 문 닫힘', { ok: b.sel === wrong && b.lift < 0.1, why: `sel=${b.sel} lift=${b.lift}` });
  T.check('맞는 힘 발판 밟기', toPad(t, [PAD_X[wrong], 1.65, -41]));
  T.check('맞는 힘이면 별까지 갈 수 있음', run(m, [PAD_X[t], 1.65, -41], [[PAD_X[t], LANE], [14.2, LANE], [17, LANE], [19.5, -39.5]], { maxT: 20 }));
  T.check('별을 얻음', { ok: m.level.stars.find((s) => Math.abs(s.mesh.position.x - 19.5) < 0.1).got, why: '별 미획득' });
  m.level.resetProgress();
  T.check('진행 초기화하면 장치도 처음으로', { ok: b.sel === null && b.shownVol === 12 && m.level.stars.every((s) => !s.got), why: `sel=${b.sel}` });
}
T.report();
