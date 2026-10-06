import './harness.mjs';
import { tally } from './harness.mjs';
import { runRobotCommands, ROBOT_STOPS } from '../src/levels/robotcity.js';
const forwardSteps = (cmds) => { let times = 1, n = 0; for (const c of cmds) { if (c === 'x3') { times = 3; continue; } if (c === 'forward') n += times; times = 1; } return n; };
import { MAPS, mapById } from '../src/levels/index.js';

const T = tally('명령 택배 로봇 도시');
T.check('맵 선택 목록 등록', { ok: mapById('robotcity').id === 'robotcity', why: `${MAPS.length} maps` });
const expected = [
  { position: [0, -6], direction: 0 },
  { position: [2, -49], direction: 1 },
  { position: [4, -84], direction: 1 },
  { position: [2, -12], direction: 1 },
  { position: [6, -4], direction: 1 },
];
ROBOT_STOPS.forEach((stop, i) => {
  const result = runRobotCommands(stop.start, stop.dirs[0], stop.required);
  T.check(`${stop.name}: 배송 좌표`, { ok: result.position[0] === stop.target[0] && result.position[1] === stop.target[1], why: JSON.stringify(result.position) });
  T.check(`${stop.name}: 단계별 경로`, { ok: result.path.length === forwardSteps(stop.required) + 1, why: `${result.path.length} points` });
  T.check(`${stop.name}: 실행 규칙 기대값`, { ok: result.position.every((n, j) => n === expected[i].position[j]) && result.direction === expected[i].direction, why: JSON.stringify(result) });
});
const wrong = runRobotCommands(ROBOT_STOPS[1].start, 0, ['forward', 'left', 'forward']);
T.check('잘못된 회전은 다른 경로에 도착', { ok: wrong.position[0] === -2 && wrong.position[1] === -49 && wrong.direction === 3, why: JSON.stringify(wrong) });
const repeat = runRobotCommands([2, 3], 0, ['forward', 'forward']);
T.check('반복 이동은 예측 가능한 두 칸 진행', { ok: repeat.position[0] === 2 && repeat.position[1] === -1 && repeat.path.length === 3, why: JSON.stringify(repeat) });

// 반복 ×3: 바로 다음 명령을 세 번 한다(움직이지 않는 수정 명령). 이어지는 명령에는 적용되지 않는다.
{
  const a = runRobotCommands([0, 0], 0, ['x3', 'forward']);
  T.check('반복 ×3 + 앞으로 = 세 칸 이동', { ok: a.position[0] === 0 && a.position[1] === -6 && a.path.length === 4 && a.steps.length === 2, why: JSON.stringify(a) });
  const b = runRobotCommands([0, 0], 0, ['x3', 'forward', 'forward']);
  T.check('반복은 바로 다음 명령에만 적용', { ok: b.position[1] === -8, why: JSON.stringify(b.position) });
  const c = runRobotCommands([0, 0], 0, ['x3', 'right']);
  T.check('반복 ×3 + 오른쪽 회전 = 세 번 회전(왼쪽을 본다)', { ok: c.direction === 3, why: String(c.direction) });
  const d = runRobotCommands([0, 0], 0, ['forward', 'x3']);
  T.check('끝에 있는 반복은 효과 없음', { ok: d.position[1] === -2, why: JSON.stringify(d.position) });
}
// 반복 배송은 반복 없이는 명령 여섯 개로 닿지 않는다. 도시 광장은 반복 없이 6개, 반복을 쓰면 5개.
{
  const reach = (stop, symbols, len) => {
    const target = stop.target;
    let found = false;
    const walk = (cmds) => {
      if (found) return;
      if (cmds.length === len) { const r = runRobotCommands(stop.start, stop.dirs[0], cmds); if (r.position[0] === target[0] && r.position[1] === target[1]) found = true; return; }
      for (const sym of symbols) walk([...cmds, sym]);
    };
    walk([]);
    return found;
  };
  const noRepeat = ['forward', 'left', 'right'], withRepeat = [...noRepeat, 'x3'];
  const [, , , repeatStop, plazaStop] = ROBOT_STOPS;
  T.check('반복 배송: 반복 없이는 명령 6개 이하로 닿지 않음', { ok: [1, 2, 3, 4, 5, 6].every((n) => !reach(repeatStop, noRepeat, n)), why: '' });
  T.check('반복 배송: 반복을 쓰면 명령 6개로 닿음', { ok: reach(repeatStop, withRepeat, 6), why: '' });
  T.check('도시 광장: 반복 없이 6개로 닿음(기본 배송)', { ok: reach(plazaStop, noRepeat, 6) && ![1, 2, 3, 4, 5].some((n) => reach(plazaStop, noRepeat, n)), why: '' });
  T.check('도시 광장: 반복을 쓰면 5개로 닿고 4개 이하로는 안 닿음(선택 별 기준)', { ok: reach(plazaStop, withRepeat, 5) && ![1, 2, 3, 4].some((n) => reach(plazaStop, withRepeat, n)), why: '' });
}
T.report();
