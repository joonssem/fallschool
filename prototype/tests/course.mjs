// 연결 코스: 세 종류(회전 막대·움직이는 발판·가로 범퍼)를 여러 시작 시각에서 통과할 수 있는지, 체크포인트·도움 점프 설정, 세 맵의 배치
import { THREE, PhysicsWorld, tally } from './harness.mjs';
import { createLevel, makeKit, finalizeLevel } from '../src/levels/kit.js';
import { connector, CONNECTOR_KINDS, CONNECTOR_LENGTH } from '../src/levels/course.js';
import { runRetry } from './course-helpers.mjs';
import { buildPizza } from '../src/levels/pizza.js';
import { buildColorStudio } from '../src/levels/colorstudio.js';
import { buildGeometryLab } from '../src/levels/geometrylab.js';

const T = tally('연결 코스');
const ok = (cond, why = '') => ({ ok: !!cond, why });

function lone(kind) {
  const world = new PhysicsWorld();
  const level = createLevel(new THREE.Scene(), world, {});
  const kit = makeKit(level);
  kit.platform(0, 1, 0, 10, 10, 0xcccccc);
  const c = connector(level, kit, { zStart: -5, kind });
  finalizeLevel(level);
  return { world, level, c };
}

T.check('종류 세 가지', ok(CONNECTOR_KINDS.join() === 'bar,movers,sweepers'));
T.check('알 수 없는 종류는 오류', ok((() => { try { lone('x'); } catch { return true; } return false; })()));
for (const kind of CONNECTOR_KINDS) {
  const x = kind === 'bar' ? 3 : 0; // 회전 막대 판의 가운데 기둥을 피해 간다
  let firstTry = 0;
  for (let t0 = 0; t0 < 24; t0++) {
    const m = lone(kind);
    const route = [[x, -20], [0, m.c.zEnd + 1]];
    const r = runRetry(m, [0, 1, -7.5], route, { t0, maxT: 40, tries: 3 });
    T.check(`${kind}: 시작 시각 ${t0}에서 3번 안에 통과`, r);
    if (r.ok && r.attempts === 1) firstTry++;
  }
  T.check(`${kind}: 처음 시도에 통과하는 시작 시각이 절반 이상`, ok(firstTry >= 12, `${firstTry}/24`));
  const m = lone(kind);
  T.check(`${kind}: 길이`, ok(Math.abs(m.c.zStart - m.c.zEnd - (CONNECTOR_LENGTH + 1)) < 1e-9));
  T.check(`${kind}: 입구 체크포인트는 도움 점프 허용`, ok(m.c.checkpoint && !m.c.checkpoint.noHelp));
}

// 세 맵: 방 사이마다 연결 코스, 퍼즐 방 체크포인트는 noHelp 유지, 연결 코스 체크포인트는 방과 방 사이 순서
for (const [name, build, rooms] of [['분수 피자', buildPizza, 3], ['미술 공방', buildColorStudio, 4], ['도형 건축', buildGeometryLab, 4]]) {
  const world = new PhysicsWorld();
  const level = build(new THREE.Scene(), world, { seed: 1 });
  const cps = level.checkpoints;
  const names = cps.map((c) => c.name);
  T.check(`${name}: 연결 코스 ${rooms - 1}개`, ok(level.course.connectors.length === rooms - 1, `${level.course.connectors.length}`));
  const idx = (n) => names.indexOf(n);
  for (let k = 0; k < rooms - 1; k++) {
    const link = idx(`연결 코스 ${k + 1}`);
    T.check(`${name}: 연결 코스 ${k + 1} 체크포인트가 방 ${k + 1}과 방 ${k + 2} 사이`, ok(link > 0 && cps[link].respawn.z < cps[link - 1].respawn.z && (cps[link + 1]?.respawn.z ?? -999) < cps[link].respawn.z, names.join('/')));
    T.check(`${name}: 연결 코스 ${k + 1}은 도움 점프 허용`, ok(!cps[link].noHelp));
    T.check(`${name}: 방 ${k + 1}은 개념 오답 보호(noHelp)`, ok(cps[link - 1].noHelp === true));
  }
  T.check(`${name}: 구간 이름에 연결 코스`, ok(level.sectionAt(level.course.connectors[0].zStart - 10) === '연결 코스', level.sectionAt(level.course.connectors[0].zStart - 10)));
  T.check(`${name}: 방 사이 간격이 같음`, ok(level.course.rooms.every((z, i, a) => i === 0 || Math.abs(a[i - 1] - z - (33 + CONNECTOR_LENGTH)) < 1e-9)));
}
T.report();
