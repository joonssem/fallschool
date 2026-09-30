// 인체 대탐험 심장 판막: 학생이 여럿인 방(21명)에서 친구 둘이 두 발판에 서면 열리고, 같은 발판에만 서면 안 열린다
import { loadMap, run, tally, THREE } from './harness.mjs';
const make = await loadMap('body');
const T = tally('심장 판막 협동');
const V = (x, z) => new THREE.Vector3(x, 1.5, z);
function through(others) {
  const m = make(2);
  m.level.getOthers = () => others;
  m.level.getPlayerCount = () => 21;
  return run(m, [0, 1.5, -40], [[0, -45], [0, -52], [0, -58]], { maxT: 15 });
}
T.check('친구 둘이 두 발판에', through([V(-6, -39), V(6, -39)]));
const same = through([V(-6, -39), V(-6, -39), V(0, 20)]);
T.check('둘이 같은 발판에만 서면 안 열림', { ok: !same.ok, why: '열려 버림' });
T.report();
