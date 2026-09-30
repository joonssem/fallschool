// 인체 대탐험(body) / 물의 순환 구름 공장(water): 구간별 통과, 맞는 문 통과·틀린 문 낙하
// 사용: node tests/body-water.mjs body | water
import { loadMap, lane, run, tally } from './harness.mjs';
const map = process.argv[2] || 'body';
const make = await loadMap(map);
const T = tally(map === 'body' ? '인체 대탐험' : '물의 순환');
const segs = {
  body: (L) => [
    ['첫 문', [lane(L, 0), 1.5, -8], [[lane(L, 0), -20]], true],
    ['심장 판막(혼자 차례로)', [0, 1.5, -25], [[0, -29], [-6, -39], [6, -39], [0, -45], [0, -52], [0, -58]]],
    ['동맥', [0, 1.5, -56], [[0, -68], [0, -76], [0, -84], [0, -92], [0, -100]]],
    ['근육 발판', [0, 1, -98], [[-3, -110], [3, -118], [-2, -126], [0, -136]]],
    ['근육 문', [lane(L, 1), 1.5, -134], [[lane(L, 1), -150]], true],
    ['결승', [0, 1.5, -152], [[0, -157]]],
  ],
  water: (L) => [
    ['증발 상승로', [0, 0, -3], [[-2, -11], [2, -17], [-2, -23], [2, -29], [0, -35], [0, -43]]],
    ['응결 문', [lane(L, 0), 7.5, -40], [[lane(L, 0), -53]], true],
    ['구름 발판', [0, 7.5, -56], [[0, -58], [-3, -65], [3, -72], [0, -79], [0, -91]]],
    ['지표수 길', [0, 1.5, -88], [[-5.5, -101], [-5.5, -108], [-5.5, -115], [0, -125]]],
    ['지하수 길', [0, 1.5, -88], [[5.5, -101], [5.5, -108], [5.5, -115], [0, -125]]],
    ['강 하구·결승', [0, 1.5, -122], [[0, -135], [0, -145], [0, -153]]],
  ],
};
const wrongLane = { body: [1.5, -8, -40], water: [7.5, -40, -75] }[map];
for (const seed of [1, 2, 3, 4, 5]) for (const t0 of [0, 1.7, 3.3, 5, 7.1, 9]) {
  const m = make(seed);
  for (const [name, start, targets, nojump] of segs[map](m.level)) T.check(name, run(m, start, targets, { t0, nojump }));
  // 틀린 문은 떨어져야 한다
  const x = lane(m.level, 0, true);
  const r = run(m, [x, wrongLane[0], wrongLane[1]], [[x, wrongLane[2]]], { t0, nojump: true });
  T.check('틀린 문은 떨어짐', { ok: !r.ok && r.why.startsWith('떨어짐'), why: '떨어지지 않음' });
}
T.report();
