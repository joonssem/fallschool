// 등고선 지형 탐험대: 규칙·이동 시험. 모든 활동은 run(...) 봇이 직접 걸어서 확인한다.
// 자동 시험은 이동·상태 규칙만 확인하며 재미·학습 효과의 증거가 아니다.
import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { buildTerrainExpedition, CHECKPOINTS, STAR_COUNT, ZONES } from '../src/levels/terrainexpedition.js';
import { mapById } from '../src/levels/index.js';

const T = tally('등고선 지형 탐험대');
const fresh = (seed = 1) => {
  const world = new PhysicsWorld();
  return { world, level: buildTerrainExpedition(new THREE.Scene(), world, { seed }) };
};
// 봇이 성공해서 실제로 걸은 구간의 직선 합(m)을 맵별로 쌓는다. 길이 시험은 이 걸은 거리를 쓴다.
const walked = new WeakMap();
const walk = (m, start, targets, maxT = 100) => {
  const r = run(m, [start[0], 1.3, start[1]], targets, { maxT });
  if (r.ok) {
    let d = 0, prev = start;
    for (const t of targets) { d += Math.hypot(t[0] - prev[0], t[1] - prev[1]); prev = t; }
    walked.set(m, (walked.get(m) ?? 0) + d);
  }
  return r;
};
const H = [0, 0], M = [32, 0], R = [0, -32], C = [-36, 10], P = [-30, -24];
const M_CONTOUR = [29, -8], M_RIDGE = [37, -8];
const R_NORTH = [-7, -23], R_SOUTH = [-7, -35], R_REDO = [-7, -29];
const MARKET_RIVER = [-16, -23], MARKET_TERRACE = [-21, -30], MARKET_REDO = [-18, -19];
const TO_RIVER_PLAIN_NORTH = [[-11, -22], [-16, -22], [-22, -22], [-28, -23], P];
const TO_RIVER_PLAIN_SOUTH = [[-11, -36], [-16, -37], [-22, -36], [-28, -33], P];
const TO_MOUNTAIN_PLAIN = [[14, -14], [7, -15], [0, -16], [-7, -16], [-14, -16], [-21, -16], [-28, -17], [-30, -19], P];
const TO_WEST_COAST = [[-22, -22], [-27, -17], [-31, -11], [-34, -5], C];
const TO_TERRACE_COAST = [[-18, -33], [-23, -28], [-27, -21], [-31, -13], [-34, -5], C];
const TO_HUB = [[-29, 18], [-20, 20], [-11, 17], [-4, 10], H];
const RETURN_HUB = [[-29, 7], [-21, 5], [-14, 4], [-7, 3], H];
const done = (s) => s.surveys.mountain && s.surveys.river && s.surveys.plain && s.surveys.westCoast;
const finish = (m, from) => walk(m, from, [[0, -2]], 15);

T.check('사회 분류·맵 id·빌더 등록', { ok: mapById('terrainexpedition').subject === '사회' && mapById('terrainexpedition').build === buildTerrainExpedition, why: '' });
{
  const { level } = fresh();
  T.check('고정 지도 첫 체험, 필수 4구역·선택 해안 1곳, 별 1개', { ok: level.terrainExpedition.surveys.eastCoast === false && level.stars.length === STAR_COUNT && STAR_COUNT <= 10, why: '' });
  T.check('방위와 체크포인트를 포함한 이동망', { ok: ZONES.mountain[0] > 0 && ZONES.river[1] < 0 && ZONES.westCoast[0] < 0 && level.checkpoints.length >= CHECKPOINTS.length + 3, why: String(level.checkpoints.length) });
  const ids = level.terrainExpedition.paths;
  T.check('공용 맵 상태에 세 평야 입구·하류 길·두 해안길 결과 노출', { ok: !!ids.mountainToPlain && !!ids.riverNorthToPlain && !!ids.riverSouthToPlain && !!ids.plainToRiver && !!ids.plainToCoastRiver && !!ids.plainToCoastTerrace, why: '' });
}

// 평야는 처음 닫혀 있다. 지형 단서를 해석한 산지 답사 또는 하천 건넘길로만 들어간다.
{
  const m = fresh(); const s = m.level.terrainExpedition;
  T.check('두 답사 결과 전에는 평야 입구 세 곳 모두 닫힘', { ok: !s.opened.mountainPlain && !s.opened.riverPlain && !s.paths.mountainToPlain.some((p) => p.userData.collider.enabled) && !s.paths.riverNorthToPlain.some((p) => p.userData.collider.enabled) && !s.paths.riverSouthToPlain.some((p) => p.userData.collider.enabled), why: '' });
  const blocked = walk(m, H, [[-18, -18], [-22, -22], P, MARKET_RIVER], 25);
  T.check('닫힌 상태에서 하천 쪽 평야 입구를 걸어서 통과할 수 없음', { ok: !blocked.ok && !s.plainVisited.value, why: JSON.stringify({ ok: blocked.ok, why: blocked.why, plainVisited: s.plainVisited.value, entryOpen: s.opened.riverPlain }) });
  const mountain = fresh();
  const openM = walk(mountain, H, [M, M_CONTOUR], 30);
  const enterM = walk(mountain, M_CONTOUR, [...TO_MOUNTAIN_PLAIN, MARKET_RIVER], 35);
  T.check('산지 답사 뒤 북쪽 평야 입구가 열리고 걸어서 진입', { ok: openM.ok && enterM.ok && mountain.level.terrainExpedition.surveys.mountain && mountain.level.terrainExpedition.plainVisited.value && mountain.level.terrainExpedition.plainEntry === 'mountain', why: JSON.stringify({ openM: openM.why, enterM: enterM.why, state: mountain.level.terrainExpedition.plainEntry }) });
  const river = fresh();
  const openR = walk(river, H, [R, R_NORTH], 35);
  const enterR = walk(river, R_NORTH, [...TO_RIVER_PLAIN_NORTH, MARKET_RIVER], 35);
  T.check('하천 건넘길 뒤 강가 평야 입구가 열리고 걸어서 진입', { ok: openR.ok && enterR.ok && river.level.terrainExpedition.surveys.river && river.level.terrainExpedition.plainVisited.value && river.level.terrainExpedition.plainEntry === 'river', why: JSON.stringify({ openR: openR.why, enterR: enterR.why, crossing: river.level.terrainExpedition.riverCrossing, side: river.level.terrainExpedition.riverEntrySide, barriers: [river.level.terrainExpedition.barriers.riverNorth.userData.collider.enabled, river.level.terrainExpedition.barriers.riverSouth.userData.collider.enabled] }) });
}

// 선택을 바꾸는 행동도 수첩 가까이에서 고칠 수 있다.
{
  const m = fresh();
  walk(m, H, [M, M_CONTOUR]);
  const chooseRiver = walk(m, M_CONTOUR, TO_MOUNTAIN_PLAIN);
  const pickA = walk(m, P, [MARKET_RIVER]);
  const redo = walk(m, MARKET_RIVER, [MARKET_REDO, MARKET_TERRACE]);
  const s = m.level.terrainExpedition;
  T.check('처음 고른 장터 연결을 가까이서 바꾸고 대안 길이 열림', { ok: chooseRiver.ok && pickA.ok && redo.ok && s.marketSite === 'terrace' && !s.paths.plainToCoastRiver[0].userData.collider.enabled && s.paths.plainToCoastTerrace[0].userData.collider.enabled, why: redo.why });
  T.check('오선택 수정에 본부 왕복이나 낙하가 없음', { ok: s.surveys.plain && s.marketSite === 'terrace', why: '' });
  const river = fresh();
  walk(river, H, [R, R_NORTH]);
  const change = walk(river, R_NORTH, [R_REDO, R_SOUTH]);
  T.check('하천 건넘길도 가까운 곳에서 다시 선택 가능', { ok: change.ok && river.level.terrainExpedition.riverCrossing === 'south-bank' && river.level.terrainExpedition.paths.riverBridgeSouth.some((p) => p.userData.collider.enabled), why: change.why });
}

// 요청된 순서 세 가지를 봇이 직접 걷고, 선택 해안을 건너뛴 채 허브에서 마친다.
function sequenceOne() {
  const m = fresh(); const s = m.level.terrainExpedition;
  let r = walk(m, H, [M, M_RIDGE]); if (!r.ok) return { m, r };
  r = walk(m, M_RIDGE, [H]); if (!r.ok) return { m, r };
  r = walk(m, H, [R, R_SOUTH]); if (!r.ok) return { m, r };
  r = walk(m, R_SOUTH, [...TO_RIVER_PLAIN_SOUTH, MARKET_RIVER]); if (!r.ok) return { m, r };
  r = walk(m, MARKET_RIVER, TO_WEST_COAST); if (!r.ok) return { m, r };
  r = walk(m, C, RETURN_HUB); if (!r.ok) return { m, r };
  r = finish(m, H); return { m, r, state: s };
}
function sequenceTwo() {
  const m = fresh(); const s = m.level.terrainExpedition;
  let r = walk(m, H, [R, R_NORTH]); if (!r.ok) return { m, r };
  r = walk(m, R_NORTH, [...TO_RIVER_PLAIN_NORTH, MARKET_TERRACE]); if (!r.ok) return { m, r };
  r = walk(m, MARKET_TERRACE, TO_TERRACE_COAST); if (!r.ok) return { m, r };
  r = walk(m, C, RETURN_HUB); if (!r.ok) return { m, r };
  r = walk(m, H, [M, M_CONTOUR]); if (!r.ok) return { m, r };
  r = walk(m, M_CONTOUR, [M, H]); if (!r.ok) return { m, r };
  r = finish(m, H); return { m, r, state: s };
}
function sequenceThree() {
  const m = fresh(); const s = m.level.terrainExpedition;
  let r = walk(m, H, [[-14, 4], [-28, 6], C]); if (!r.ok) return { m, r };
  r = walk(m, C, RETURN_HUB); if (!r.ok) return { m, r };
  r = walk(m, H, [M, M_CONTOUR]); if (!r.ok) return { m, r };
  r = walk(m, M_CONTOUR, TO_MOUNTAIN_PLAIN); if (!r.ok) return { m, r };
  r = walk(m, P, [MARKET_TERRACE]); if (!r.ok) return { m, r };
  r = walk(m, MARKET_TERRACE, [[-18, -35], [-12, -39], [-6, -42], [-1, -43], R_SOUTH]); if (!r.ok) return { m, r };
  r = walk(m, R_SOUTH, [H]); if (!r.ok) return { m, r };
  r = finish(m, H); return { m, r, state: s };
}
for (const [label, fn] of [['산지→하천→평야→해안', sequenceOne], ['하천→평야→해안→산지', sequenceTwo], ['해안→산지→평야→하천', sequenceThree]]) {
  const { m, r } = fn();
  const state = m.level.terrainExpedition;
  T.check(`${label}: 봇이 걸은 거리 170~280m(250m 초과 여부는 문서 59에 기록)`, { ok: walked.get(m) >= 170 && walked.get(m) <= 280, why: `${(walked.get(m) ?? 0).toFixed(1)}m` });
  T.check(`${label}: 기본 답사 순서로 걸어서 결승`, { ok: r.ok && m.level.finished && done(state) && !state.surveys.eastCoast, why: JSON.stringify({ r: r.why, finished: m.level.finished, surveys: state.surveys, crossing: state.riverCrossing, side: state.riverEntrySide }) });
}

// Falling beyond the field does not clear a completed checklist or map marks.
{
  const m = fresh();
  walk(m, H, [R, R_SOUTH]);
  const before = JSON.stringify(m.level.terrainExpedition.surveys);
  const fall = walk(m, R_SOUTH, [[80, 80]], 20);
  T.check('필드 밖으로 떨어져도 가까운 체크포인트에서 상태가 유지됨', { ok: !fall.ok && JSON.stringify(m.level.terrainExpedition.surveys) === before && m.level.terrainExpedition.opened.riverPlain, why: fall.why });
}

// Optional eastern coast and star can be reached by walking; neither blocks the required west/south coast route.
{
  const m = fresh();
  const r = walk(m, H, [M, [44, 18], [52, 18]], 50);
  T.check('선택 동쪽 해안 별에 걸어서 도달', { ok: r.ok && m.level.stars[0].got && !done(m.level.terrainExpedition), why: r.why });
}

// 체크포인트: 낙하 뒤 가까운 곳에서 다시 시작하고(본부로 돌아가지 않음), 위치 설계가 안전한지 본다.
{
  const m = fresh(); const { level } = m;
  const last = () => [...level.checkpoints].filter((cp) => cp.reached).at(-1);
  const toUpstream = walk(m, H, [[-2, -10], [0, -19]], 30);
  T.check('하천 상류 체크포인트를 밟으면 도달 처리됨', { ok: toUpstream.ok && last()?.name === '하천 상류', why: String(last()?.name) });
  const south = walk(m, [0, -19], [R, R_SOUTH], 30);
  const fall = walk(m, R_SOUTH, [[80, 80]], 20);
  const rp = last().respawn;
  const dist = Math.hypot(rp.x - R_SOUTH[0], rp.z - R_SOUTH[1]);
  T.check('낙하는 실제로 일어나고(떨어짐), 부활 지점이 낙하 위치에서 40m 이내', { ok: south.ok && !fall.ok && fall.why.startsWith('떨어짐') && dist <= 40, why: `${fall.why} / ${dist.toFixed(0)}m` });
  const keep = JSON.stringify(level.terrainExpedition.surveys);
  const again = walk(m, [rp.x, rp.z], [R, R_SOUTH], 30);
  T.check('부활 지점에서 걸어 되돌아와도 수첩 상태가 유지됨', { ok: again.ok && JSON.stringify(level.terrainExpedition.surveys) === keep, why: again.why });
  const gaps = level.checkpoints.map((cp) => cp.respawn);
  T.check('체크포인트 8곳 이상, 움직이는 장치 없음(부활 자리 안전은 map-rules가 검사)', { ok: gaps.length >= 8 && !level.movers.length, why: String(gaps.length) });
}

T.report();
