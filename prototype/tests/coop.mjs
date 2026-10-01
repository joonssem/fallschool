// 협동 구간 시험 (21명 방): 직렬 문의 마지막 학생·먼저 온 학생·기다림 도움·협동자 이탈, 판막 단독/늦은 도착
// 결정: 판막은 "선택 협동" — 혼자서도 두 발판을 빠르게 차례로 밟으면 열린다 (필수 협동으로 바꾸지 않는다).
//       직렬 문은 친구가 뒤에 남아 있는 동안은 함께 눌러야 하고, 마지막 무리거나 30초 기다리면 혼자서도 열 수 있다.
import { loadMap, run, tally, THREE } from './harness.mjs';
const T = tally('협동 구간');
const V = (x, z) => new THREE.Vector3(x, 1.5, z);
const AHEAD = [V(0, -70), V(3, -72), V(-3, -74)]; // 이미 직렬 문(-62)을 지난 학생들
const BEHIND = [V(0, 20), V(2, 21), V(-2, 22)]; // 아직 문 앞에 못 온 학생들(시작 지점)

// ── 전기 회로: 직렬 문 ──
const circuit = await loadMap('circuit');
const PLATES = [[-8, -44], [8, -44], [0, -55]];
function series(others, players, targets, opts = {}, hook) {
  const m = circuit(2);
  m.level.getOthers = () => (hook?.gone ? [] : others);
  m.level.getPlayerCount = () => players;
  if (hook) {
    const update = m.level.update;
    m.level.update = (t, ...a) => { if (t > hook.at) hook.gone = true; update(t, ...a); };
  }
  return { m, r: run(m, [0, 1.5, -40], targets, opts) };
}
const THROUGH = [...PLATES, [0, -62], [0, -68]];

T.check('마지막 학생: 앞 친구들이 모두 지나간 뒤 혼자 통과', series(AHEAD, 21, THROUGH, { maxT: 30 }).r);
T.check('혼자 연습(방 1명)', series([], 1, THROUGH, { maxT: 30 }).r);
{
  const r = series(BEHIND, 21, THROUGH, { maxT: 25 }).r; // 뒤에 친구가 남아 있으면 혼자 못 연다 (협동 유지)
  T.check('먼저 온 학생: 뒤에 친구가 남아 있으면 혼자 못 엶', { ok: !r.ok, why: '혼자 열려 버림' });
}
// 친구가 접속을 끊었거나 멀리 있어 30초 넘게 기다리면 도움이 켜진다 (스위치를 세 번 모두 밟아야 하는 건 그대로)
const cycle = [];
for (let i = 0; i < 6; i++) cycle.push(...PLATES, [0, -58]);
T.check('30초 기다린 뒤 도움으로 통과', series(BEHIND, 21, [...cycle, [0, -62], [0, -68]], { maxT: 120 }).r);
// 친구 둘이 두 스위치에 서 있고 내가 세 번째 스위치 → 통과. 열린 뒤 친구가 모두 떠나도 통과
T.check('친구 둘 + 나', series([V(-8, -44), V(8, -44)], 3, [PLATES[2], [0, -62], [0, -68]], { maxT: 20 }).r);
T.check('친구 둘 + 나, 열린 뒤 친구가 떠남', series([V(-8, -44), V(8, -44)], 3, [PLATES[2], [0, -62], [0, -68]], { maxT: 20 }, { at: 2, gone: false }).r);

// ── 인체 대탐험: 심장 판막 ──
const body = await loadMap('body');
function valve(others, players, start, targets) {
  const m = body(2);
  m.level.getOthers = () => others;
  m.level.getPlayerCount = () => players;
  return run(m, start, targets, { maxT: 20 });
}
const PASS = [[0, -45], [0, -52], [0, -58]];
T.check('판막: 친구 둘이 두 발판에', valve([V(-6, -39), V(6, -39)], 21, [0, 1.5, -40], PASS));
T.check('판막: 21명 방에서 혼자 두 발판을 차례로 (선택 협동)', valve(AHEAD, 21, [-6, 1.5, -39], [[-6, -39], [6, -39], ...PASS]));
T.check('판막: 늦게 도착한 학생(친구는 이미 지나감)', valve([], 21, [-6, 1.5, -39], [[-6, -39], [6, -39], ...PASS]));
T.check('판막: 혼자 연습(1명)', valve([], 1, [-6, 1.5, -39], [[-6, -39], [6, -39], ...PASS]));
{
  const r = valve(AHEAD, 21, [-6, 1.5, -39], [[-6, -39], [-5, -39], [-6, -39], ...PASS]);
  T.check('판막: 한 발판에만 서 있으면 안 열림', { ok: !r.ok, why: '열려 버림' });
}
T.report();
