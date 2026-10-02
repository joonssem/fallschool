// 연결 코스가 있는 맵의 시험 도구: 방·연결 코스를 지나는 경로와, 떨어지면 입구에서 다시 도전하는 재시도
import { run } from './harness.mjs';

/** level.course 로 시작에서 결승까지 걷는 경로를 만든다 (방 가운데 → 연결 코스 → 다음 방 …) */
export function courseRoute(level, first = [[0, -13], [0, -21]]) {
  const { rooms, connectors, tail } = level.course;
  const route = [...first];
  rooms.forEach((z, k) => {
    route.push([0, z]);
    const c = connectors[k];
    if (!c) return;
    const x = c.kind === 'bar' ? 3 : 0; // 회전 막대 판의 가운데 기둥을 피해 간다
    route.push([0, c.zStart - 2.5], [x, c.zStart - 8], [x, c.zEnd + 6], [0, c.zEnd + 2.5]);
  });
  return route.concat(tail);
}

/** 떨어지면 연결 코스 입구(또는 처음)에서 다시 도전하는 것과 같다: 시작 시각을 바꿔 최대 tries 번 */
export function runRetry(m, start, route, { tries = 3, t0 = 0, maxT = 120 } = {}) {
  let last = { ok: false, why: '시도 없음' };
  for (let i = 0; i < tries; i++) {
    last = run(m, start, route, { t0: t0 + i * 2.7, maxT });
    if (last.ok) return { ...last, attempts: i + 1 };
  }
  return last;
}
