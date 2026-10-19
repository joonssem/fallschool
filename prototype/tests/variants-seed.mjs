// 시드 고정 시험: variants.js 의 rngFor·shuffled·pick 이 같은 시드에서 같은 값을 내는지 고정해 둔다.
// 이 값이 바뀌면 같은 시드에서 이 도구를 쓰는 모든 맵(level.js와 맵 9개)의 문제 구성이 달라진다.
// 같은 방에 새 코드와 옛 코드(캐시된 화면)가 섞이면 학생마다 다른 문제를 본다.
// 일부러 바꾸는 경우: 영향 범위 점검(.claude/skills/blast-radius)을 하고 아래 기대값과 문서를 함께 고친다.
// 규칙·재현성 검증이며 재미·학습 효과의 증거가 아니다.
import { tally } from './harness.mjs';
const { rngFor, shuffled, pick } = await import('../src/levels/variants.js');

const T = tally('시드 고정(variants)');
const SEEDS = [1, 2, 3, 7];
const SALTS = [0, 100, 610];
const LIST = ['a', 'b', 'c', 'd', 'e'];
const EXPECT_RNG = [[511723, 471055, 178060], [788682, 481577, 389236], [314903, 1030, 805740], [645374, 239152, 68354]];
const EXPECT_SHUFFLED = ['cdeba', 'caedb', 'dabce', 'ecbda'];
const EXPECT_PICK = ['d', 'd', 'd', 'b'];

SEEDS.forEach((seed, i) => {
  const rng = SALTS.map((salt) => Math.round(rngFor(seed, salt)() * 1e6));
  T.check(`rngFor 시드 ${seed}`, { ok: rng.join() === EXPECT_RNG[i].join(), why: `${rng.join()} ≠ ${EXPECT_RNG[i].join()}` });
  const sh = shuffled(rngFor(seed, 610), LIST).join('');
  T.check(`shuffled 시드 ${seed}`, { ok: sh === EXPECT_SHUFFLED[i], why: `${sh} ≠ ${EXPECT_SHUFFLED[i]}` });
  const pk = pick(rngFor(seed, 5), LIST);
  T.check(`pick 시드 ${seed}`, { ok: pk === EXPECT_PICK[i], why: `${pk} ≠ ${EXPECT_PICK[i]}` });
});
// 섞기는 원본을 건드리지 않고, 모든 원소를 한 번씩 담는다
const src = [...LIST];
const out = shuffled(rngFor(5, 610), src);
T.check('shuffled 원본 보존', { ok: src.join('') === 'abcde', why: src.join('') });
T.check('shuffled 원소 보존', { ok: [...out].sort().join('') === 'abcde', why: out.join('') });
T.report();
