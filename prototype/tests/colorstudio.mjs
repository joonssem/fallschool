import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { courseRoute, runRetry } from './course-helpers.mjs';
import { buildColorStudio, mixedColor } from '../src/levels/colorstudio.js';
const T = tally('색과 빛의 미술 공방');
// 기존 시험은 목표가 초록·빨강·노랑·흰색일 때를 기준으로 쓰였으므로 목표를 고정해서 만든다 (매 판 달라지는 목표는 아래에서 따로 시험)
const FIXED = [5, 6, 3, 7];
const make = (seed = 1) => {
  const world = new PhysicsWorld();
  const level = buildColorStudio(new THREE.Scene(), world, { seed });
  level.mixers.forEach((m, i) => m.setTarget(FIXED[i]));
  return { world, level };
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
  T.check(`전체 경로 ${seed}`, runRetry(path, [0, 0, 5], courseRoute(path.level)));
  T.check(`결승 ${seed}`, { ok: path.level.finished });
  path.level.resetProgress();
  T.check(`처음부터 ${seed}`, { ok: !path.level.finished && path.level.mixers.every((s) => s.mask === 0 && !s.solved && s.attempts === 0) });
  T.check(`초기화 후 문 다시 막힘 ${seed}`, { ok: !run(path, [0, 1, -33], [[0, -41]], { maxT: 3 }).ok });
}
const reset = make();
tap(reset, reset.level.mixers[0], 0);
reset.level.setSeed(42);
T.check('새 경기 조합 초기화', { ok: reset.level.seed === 42 && reset.level.mixers.every((s) => s.mask === 0 && !s.solved) });

// ── 매 판 다른 작품 (시드) ──
const seenCombos = new Set();
for (let seed = 1; seed <= 24; seed++) {
  const w = new PhysicsWorld();
  const level = buildColorStudio(new THREE.Scene(), w, { seed });
  const masks = level.mixers.map((m) => m.targetMask);
  seenCombos.add(masks.join());
  T.check(`시드 ${seed}: 물감 두 작업실의 목표가 서로 다른 두 색 섞기`, { ok: [3, 5, 6].includes(masks[0]) && [3, 5, 6].includes(masks[1]) && masks[0] !== masks[1], why: masks.join() });
  T.check(`시드 ${seed}: 빛 첫 무대는 두 색, 마지막은 흰색`, { ok: [3, 5, 6].includes(masks[2]) && masks[3] === 7, why: masks.join() });
  T.check(`시드 ${seed}: 제목·구간 이름이 목표 색과 일치`, { ok: level.mixers.every((m) => m.heading.text.includes(m.target.name) && level.sectionAt(m.z - 1).includes(m.target.name)), why: level.mixers.map((m) => `${m.heading.text}/${level.sectionAt(m.z - 1)}`).join(' | ') });
  // 목표 색은 실제로 만들 수 있고(해당 조합 제출 → 완성) 다른 조합은 막힌다
  for (const [i, state] of level.mixers.entries()) {
    const wrongMask = (state.targetMask + 1) % 8;
    const stateCheck = buildColorStudio(new THREE.Scene(), new PhysicsWorld(), { seed });
    const st = stateCheck.mixers[i];
    for (let bit = 0; bit < 3; bit++) if (wrongMask & (1 << bit)) tap({ level: stateCheck }, st, bit);
    if (mixedColor(st.mode, wrongMask).hex !== st.target.hex) {
      tap({ level: stateCheck }, st, 4);
      T.check(`시드 ${seed} 작업실 ${i + 1}: 다른 조합은 완성되지 않음`, { ok: !st.solved, why: `${wrongMask}` });
    }
    tap({ level: stateCheck }, st, 3);
    for (let bit = 0; bit < 3; bit++) if (st.targetMask & (1 << bit)) tap({ level: stateCheck }, st, bit);
    tap({ level: stateCheck }, st, 4);
    T.check(`시드 ${seed} 작업실 ${i + 1}: 목표 조합으로 완성(${st.target.name})`, { ok: st.solved, why: `${st.mask}` });
  }
}
T.check('시드에 따라 다른 작품 조합이 나옴', { ok: seenCombos.size >= 6, why: `${seenCombos.size}가지` });
{
  const a = buildColorStudio(new THREE.Scene(), new PhysicsWorld(), { seed: 5 });
  const same = buildColorStudio(new THREE.Scene(), new PhysicsWorld(), { seed: 5 });
  T.check('같은 시드는 같은 작품(모든 화면이 같음)', { ok: a.mixers.map((m) => m.targetMask).join() === same.mixers.map((m) => m.targetMask).join() });
  const before = a.mixers.map((m) => m.targetMask).join();
  tap({ level: a }, a.mixers[0], 0);
  a.resetProgress();
  T.check('처음부터는 목표를 유지하고 조합만 비움', { ok: a.mixers.map((m) => m.targetMask).join() === before && a.mixers[0].mask === 0 });
  let changed = false;
  for (let s = 6; s < 40 && !changed; s++) { a.setSeed(s); changed = a.mixers.map((m) => m.targetMask).join() !== before; }
  T.check('새 경기(시드)에서 목표가 바뀌고 조합·완성 초기화', { ok: changed && a.mixers.every((m) => m.mask === 0 && !m.solved) });
}
T.report();
