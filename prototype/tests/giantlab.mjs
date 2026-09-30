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
T.report();
