import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { buildColorStudio, mixedColor } from '../src/levels/colorstudio.js';
const T = tally('색과 빛의 미술 공방');
const make = (seed = 1) => {
  const world = new PhysicsWorld();
  return { world, level: buildColorStudio(new THREE.Scene(), world, { seed }) };
};
function tap(m, state, index) {
  const pad = state.pads[index];
  m.level.update(0, 1 / 120, { pos: new THREE.Vector3(pad.x, 1.15, pad.z) });
  m.level.update(0, 1 / 120, { pos: new THREE.Vector3(0, 1, state.z + 18) });
}
// 독립된 기대표: 0..7의 모든 조합. 단순히 구현 공식을 반복하지 않는다.
const paintExpected = [0xffffff, 0x00ffff, 0xff00ff, 0x0000ff, 0xffff00, 0x00ff00, 0xff0000, 0x000000];
const lightExpected = [0x000000, 0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff];
for (let mask = 0; mask < 8; mask++) {
  T.check(`물감 조합 ${mask}`, { ok: mixedColor('paint', mask).hex === paintExpected[mask] });
  T.check(`빛 조합 ${mask}`, { ok: mixedColor('light', mask).hex === lightExpected[mask] });
}
const targets = [5, 6, 3, 7];
const m = make();
const first = m.level.mixers[0];
const messages = [];
m.level.onMessage = (text, ok) => messages.push({ text, ok });
tap(m, first, 0);
for (let i = 0; i < 120; i++) m.level.update(i / 120, 1 / 120, { pos: new THREE.Vector3(first.pads[0].x, 1.15, first.pads[0].z) });
T.check('발판 진입마다 한 번만 토글', { ok: first.mask === 0 });
tap(m, first, 1);
tap(m, first, 4);
T.check('오답 제출은 문을 열지 않음', { ok: !first.solved && first.attempts === 1 && messages.at(-1).ok === false });
tap(m, first, 3);
T.check('조합 초기화', { ok: first.mask === 0 && !first.solved });
tap(m, first, 0); tap(m, first, 2);
T.check('맞는 조합도 제출 전에는 막힘', { ok: first.mask === 5 && !first.solved });
T.check('닫힌 문으로 진행 불가', { ok: !run(m, [0, 1, -33], [[0, -41]], { maxT: 3 }).ok });
tap(m, first, 4);
T.check('맞는 결과 제출로 완성', { ok: first.solved && first.attempts === 2 });
tap(m, first, 1);
T.check('완성 후에도 추가 혼합 관찰', { ok: first.solved && first.mask === 7 && mixedColor('paint', first.mask).name === '검정' });
tap(m, first, 3);
T.check('완성 후 지워도 길 유지', { ok: first.solved && first.mask === 0 });

// 같은 방의 다른 학생이 밟는 것은 개인 작업에 영향을 주지 않는다.
const peer = make();
peer.level.getOthers = () => first.pads.map((p) => new THREE.Vector3(p.x, 1.15, p.z));
peer.level.getPlayerCount = () => 21;
peer.level.update(1, 1 / 120, { pos: new THREE.Vector3(0, 1, -17) });
T.check('다른 학생 위치는 내 조합을 변경하지 않음', { ok: peer.level.mixers.every((s) => s.mask === 0 && !s.solved) });

for (const seed of [1, 5, 99]) {
  const path = make(seed);
  // 모든 조합과 제출을 실제로 걷는 경로로 해결.
  for (const [index, state] of path.level.mixers.entries()) {
    const steps = [];
    for (let bit = 0; bit < 3; bit++) {
      if (!(targets[index] & (1 << bit))) continue;
      const pad = state.pads[bit];
      steps.push([pad.x, pad.z], [pad.x, pad.z + 4]);
    }
    const submit = state.pads[4];
    steps.push([submit.x, submit.z], [0, state.z + 2], [0, state.z - 8]);
    T.check(`걸어서 조합·제출·통과 ${seed}/${index}`, run(path, [0, 1, state.z + 17], steps));
    T.check(`완성 기록 ${seed}/${index}`, { ok: state.solved && state.attempts === 1 });
  }
  T.check(`전체 경로 ${seed}`, run(path, [0, 0, 5], [[0, -13], [0, -21], [0, -34], [0, -47], [0, -67], [0, -80], [0, -100], [0, -113], [0, -133], [0, -146], [0, -157]]));
  T.check(`결승 ${seed}`, { ok: path.level.finished });
  path.level.resetProgress();
  T.check(`처음부터 ${seed}`, { ok: !path.level.finished && path.level.mixers.every((s) => s.mask === 0 && !s.solved && s.attempts === 0) });
  T.check(`초기화 후 문 다시 막힘 ${seed}`, { ok: !run(path, [0, 1, -33], [[0, -41]], { maxT: 3 }).ok });
}
const reset = make();
tap(reset, reset.level.mixers[0], 0);
reset.level.setSeed(42);
T.check('새 경기 조합 초기화', { ok: reset.level.seed === 42 && reset.level.mixers.every((s) => s.mask === 0 && !s.solved) });
T.report();
