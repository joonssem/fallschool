import './harness.mjs';
import { tally } from './harness.mjs';
import { runRobotCommands, ROBOT_STOPS } from '../src/levels/robotcity.js';
import { MAPS, mapById } from '../src/levels/index.js';

const T = tally('명령 택배 로봇 도시');
T.check('맵 선택 목록 등록', { ok: mapById('robotcity').id === 'robotcity' && MAPS.length === 13, why: `${MAPS.length} maps` });
const expected = [
  { position: [0, -6], direction: 0 },
  { position: [2, -49], direction: 1 },
  { position: [4, -84], direction: 1 },
];
ROBOT_STOPS.forEach((stop, i) => {
  const result = runRobotCommands(stop.start, stop.dirs[0], stop.required);
  T.check(`${stop.name}: 배송 좌표`, { ok: result.position[0] === stop.target[0] && result.position[1] === stop.target[1], why: JSON.stringify(result.position) });
  T.check(`${stop.name}: 단계별 경로`, { ok: result.path.length === stop.required.filter((x) => x === 'forward').length + 1, why: `${result.path.length} points` });
  T.check(`${stop.name}: 실행 규칙 기대값`, { ok: result.position.every((n, j) => n === expected[i].position[j]) && result.direction === expected[i].direction, why: JSON.stringify(result) });
});
const wrong = runRobotCommands(ROBOT_STOPS[1].start, 0, ['forward', 'left', 'forward']);
T.check('잘못된 회전은 다른 경로에 도착', { ok: wrong.position[0] === -2 && wrong.position[1] === -49 && wrong.direction === 3, why: JSON.stringify(wrong) });
const repeat = runRobotCommands([2, 3], 0, ['forward', 'forward']);
T.check('반복 이동은 예측 가능한 두 칸 진행', { ok: repeat.position[0] === 2 && repeat.position[1] === -1 && repeat.path.length === 3, why: JSON.stringify(repeat) });
T.report();
