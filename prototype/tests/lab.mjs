// 점프 연구소 시험장(2부 시험 구간): 구간별 통과 가능성(규칙·이동 검증). 시험 통과는 재미나 난이도 적절함의 증거가 아니다.
// 움직이는 장애물 구간은 봇이 출발 시각을 바꿔 가며 지나간다. 통과 비율은 출력으로 남기고 최소 기준만 검사한다.
import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { buildLevel, DIFFICULTY } from '../src/level.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// 난이도 단계(쉬움·기본·어려움)마다 같은 시험을 한 번씩 돈다. 인자 없이 실행하면 기본 단계를 돌고 이어서 나머지 단계를 자식 프로세스로 돈다.
const DIFF = process.env.LAB_DIFFICULTY || 'normal';
const G = DIFFICULTY[DIFF].gaps;
const T = tally(`점프 연구소 시험장(시험 구간, ${DIFFICULTY[DIFF].label})`);
const build = (seed = 1) => { const world = new PhysicsWorld(); return { world, level: buildLevel(new THREE.Scene(), world, { seed, difficulty: DIFF }) }; };
const rate = {};
function tryMany(name, startFn, targets, t0s, opts = {}) {
  let ok = 0;
  for (const t0 of t0s) if (run(build(1), ...startFn(), { t0, maxT: 40, ...opts }).ok) ok++;
  rate[name] = `${ok}/${t0s.length}`;
  return ok;
}
const ALL_T0 = [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4, 6.3, 7.2, 8.1, 9, 9.9];

const cpz = (level, name) => level.checkpoints.find((c) => c.name === name).respawn.z; // 체크포인트 발판 가운데 z (발판 길이: 입구 10, 나머지 9)

// 구간 이름과 체크포인트
{
  const { level } = build();
  const probes = [['시험장 입구', '시험장 입구', -1], ['좁은 평균대 ★', '시험장 입구', -8], ['징검다리 ★★', '평균대 뒤', -6], ['사라지는 발판 ★★', '징검다리 뒤', -8], ['컨베이어 ★★', '사라지는 발판 뒤', -8], ['얼음 판 ★★', '컨베이어 뒤', -8], ['점프 패드 탑 ★★★', '얼음 판 뒤', -8], ['해머 복도 ★★★', '점프 패드 탑 뒤', -8], ['맞바람·돌풍 ★★★', '해머 복도 뒤', -8], ['골인 언덕', '맞바람·돌풍 뒤', -8]];
  for (const [n, cp, dz] of probes) T.check(`구간 이름 ${n}`, { ok: level.sectionAt(cpz(level, cp) + dz) === n, why: `${n}: ${level.sectionAt(cpz(level, cp) + dz)}` });
  T.check('체크포인트 14곳', { ok: level.checkpoints.length === 14, why: String(level.checkpoints.length) });
  T.check('도전 별 5개', { ok: level.stars.length === 5, why: String(level.stars.length) });
}
const Z = (name) => cpz(build().level, name);
const z5 = Z('시험장 입구'), z6 = Z('평균대 뒤'), z7 = Z('징검다리 뒤'), z8 = Z('사라지는 발판 뒤'), z9 = Z('컨베이어 뒤'), z10 = Z('얼음 판 뒤'), z11 = Z('점프 패드 탑 뒤'), z12 = Z('해머 복도 뒤'), z13 = Z('맞바람·돌풍 뒤');

// 1) 좁은 평균대
T.check('좁은 평균대', run(build(), [0, 5, z5], [[0, z6 + 3]], { nojump: true, maxT: 20 }));
// 2) 징검다리 (중심 z는 평균대 뒤 체크포인트 끝에서 계산)
const s0 = z6 - 4.5 - 1.7;
const STONES = [[0, s0]];
{ let cz = s0 - 1.7; const xs = [0, 1, -1, 1, 0]; G.forEach((g, i) => { cz -= g + 1.7; STONES.push([xs[i], cz]); cz -= 1.7; }); STONES.push([0, z7]); }
T.check('징검다리', run(build(), [0, 5, z6], STONES, { maxT: 40 }));
// 3) 사라지는 발판: 어느 시각에도 각 줄에 밟을 수 있는 발판이 있고(경고 중 포함), 안정된 발판도 있다
{
  const { level } = build();
  let minSolid = 3, minStable = 3;
  for (let t = 0; t < 60; t += 0.05) for (let r = 0; r < 7; r++) {
    const row = level.blinkTiles.filter((b) => b.row === r);
    minSolid = Math.min(minSolid, row.filter((b) => level.blinkState(b.phase, t) !== 2).length);
    minStable = Math.min(minStable, row.filter((b) => level.blinkState(b.phase, t) === 0).length);
  }
  T.check('줄마다 항상 밟을 수 있는 발판 ≥ 1', { ok: minSolid >= 1, why: String(minSolid) });
  T.check('줄마다 항상 안정된 발판 ≥ 1', { ok: minStable >= 1, why: String(minStable) });
  console.log(`  사라지는 발판: 줄당 최소 밟을 수 있는 발판 ${minSolid}, 안정된 발판 ${minStable}`);
  // 가능성 검사: 사람이 줄마다 발판 중심으로 옆 칸으로도 이동(초속 6m, 출발·도착 0.15초)하며 지나갈 수 있는 경로가 있는지 시간을 0.1초씩 끊어 찾는다.
  // 출발 칸은 떠날 때까지, 도착 칸은 도착해서 0.3초까지 사라지지 않아야 한다. 경고 중인 발판은 아직 밟을 수 있다.
  function feasible(t0) {
    const solid = (b, tt) => m0.level.blinkState(b.phase, tt) !== 2;
    const stable = (b, tt) => m0.level.blinkState(b.phase, tt) === 0;
    const tile = (r, c) => m0.level.blinkTiles.find((b) => b.row === r && b.col === c);
    // 상태: [줄, 칸, 시각]. 0번 줄에는 체크포인트에서 출발한다 (체크포인트는 안전)
    const seen = new Set();
    const stack = [];
    for (let c = 0; c < 3; c++) for (let dt = 0; dt <= 4.4; dt += 0.1) stack.push([0, c, Math.round((t0 + dt) * 10) / 10, 'cp']);
    const okWindow = (b, from, to) => { for (let tt = from; tt <= to + 1e-9; tt += 0.1) if (!solid(b, tt)) return false; return true; };
    while (stack.length) {
      const [r, c, t, src] = stack.pop();
      const key = `${r}|${c}|${t}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const b = tile(r, c);
      if (!okWindow(b, t, t + 0.3) || !stable(b, t)) continue; // 도착해서 설 수 있는 발판이어야 한다
      if (r === 6) return true;
      for (let c2 = 0; c2 < 3; c2++) {
        const tau = Math.hypot(3.5 * Math.abs(c2 - c), 3.5) / 6 + 0.3;
        const b2 = tile(r + 1, c2);
        for (let dep = 0; dep <= 3.0; dep += 0.1) { // 이 칸에서 dep초 기다렸다 간다 (기다리는 동안 이 칸이 사라지면 안 된다)
          const td = Math.round((t + dep) * 10) / 10;
          if (!okWindow(b, t, td)) break;
          const ta = Math.round((td + tau) * 10) / 10;
          if (okWindow(b2, td, ta + 0.3) && stable(b2, ta)) stack.push([r + 1, c2, ta, 'tile']);
        }
      }
    }
    return false;
  }
  const m0 = build();
  { let ok = 0; for (const t0 of ALL_T0) if (feasible(t0)) ok++; rate['사라지는 발판(가능성 검사)'] = `${ok}/${ALL_T0.length}`; T.check('사라지는 발판: 어느 출발 시각에도 지나갈 경로가 있음', { ok: ok === ALL_T0.length, why: `${ok}/${ALL_T0.length}` }); }
  const blink = tryMany('사라지는 발판(직진 봇)', () => [[0, 5, z7 - 4], [[0, z7 - 4.5], [0, z7 - 31]]], null, ALL_T0);
}
// 4) 컨베이어
T.check('컨베이어 세 칸', run(build(), [0, 5, z8], [[0, z8 - 6.5], [-1, z8 - 15], [0, z8 - 25], [0, z9]], { maxT: 40 }));
// 5) 얼음 판: 기둥 사이로
T.check('얼음 판 (기둥 사이로)', run(build(), [0, 5, z9], [[1.4, z9 - 9.5], [-1.5, z9 - 15.5], [1.4, z9 - 21.5], [0, z9 - 27.5], [0, z10]], { maxT: 60 }));
T.check('얼음 판 곧장 달려도 안 떨어짐', run(build(), [0, 5, z9], [[2.5, z10 + 1]], { maxT: 40 }));
// 6) 점프 패드 탑
{
  // 층 중심 z: A = z10 - 7.5, B = A - 8.4, C = B - 8.4 (층 사이 틈 2.4), 내려오는 계단 D, E는 각각 3m 떨어진 6m 발판
  const A = z10 - 7.5, B = A - 8.4, C = B - 8.4, D = C - 9, E = D - 9;
  T.check('점프 패드 탑', run(build(), [0, 5, z10], [[0, A - 1.9], [0, B], [0, C], [0, D], [0, E], [0, z11 + 1]], { maxT: 60 }));
  // 패드를 밟고 앞으로만 걸어도 다음 층 안쪽에 닿는다 (자유 비행 길이 5.5~7m)
  T.check('점프 패드 탑: 패드 한 번에 다음 층까지', run(build(), [0, 5, A + 1], [[0, A - 1.9], [0, B - 1]], { maxT: 20 }));
}
// 7) 해머 복도: 봇이 출발 시각을 바꿔 가며
const hammer = tryMany('해머 복도', () => [[0, 5, z11], [[0, z11 - 6.5], [0, z12 + 1]]], null, ALL_T0);
T.check('해머 복도는 어떤 시각에는 지나갈 수 있음', { ok: hammer > 0, why: rate['해머 복도'] });
// 8) 맞바람·돌풍: 바람 방향(앞·왼·오른쪽, 어려움은 비스듬히도)과 벽의 가로·세로 방향을 생각해 숨는다
const WD = DIFFICULTY[DIFF].wind;
const GPERIOD = WD.calm + WD.ramp + WD.strong + WD.fade;
const zSec = z12 - 4.5; // 맞바람·돌풍 구간이 시작하는 z (앞 체크포인트 발판 끝)
{
  const { level } = build();
  const walls = level.shelters;
  const horiz = walls.find((w) => w.w > w.d), vert = walls.find((w) => w.d > w.w);
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  T.check('가로 벽 뒤(시작 쪽)는 앞바람을 막는다', { ok: level.sheltered(P(horiz.cx, 5, horiz.cz + 2), [0, 1]), why: JSON.stringify(horiz) });
  T.check('가로 벽 뒤라도 옆바람(왼쪽에서)은 막지 못한다', { ok: !level.sheltered(P(horiz.cx, 5, horiz.cz + 2), [1, 0]), why: '옆바람도 막힘' });
  T.check('세로 벽 동쪽은 왼쪽에서 오는 바람을 막는다', { ok: level.sheltered(P(vert.cx + 1.5, 5, vert.cz), [1, 0]), why: JSON.stringify(vert) });
  T.check('세로 벽 서쪽은 오른쪽에서 오는 바람을 막는다', { ok: level.sheltered(P(vert.cx - 1.5, 5, vert.cz), [-1, 0]), why: JSON.stringify(vert) });
  T.check('점프로 벽 위로 올라가면 바람을 맞는다', { ok: !level.sheltered(P(horiz.cx, 7.2, horiz.cz + 2), [0, 1]), why: '점프 중에도 막힘' });
  // 어느 방향의 돌풍이든 어디서나 (예고+거세지는 시간) × 6m/s 안에 숨을 곳이 있다
  const reach = (WD.calm + WD.ramp) * 6;
  const free = (x, dz) => !walls.some((w) => Math.abs(x - w.cx) < w.w / 2 + 0.4 && Math.abs(zSec - dz - w.cz) < w.d / 2 + 0.4);
  const pts = [];
  for (let x = -5.5; x <= 5.5; x += 0.5) for (let dz = 0.5; dz <= 37.5; dz += 0.5) if (free(x, dz)) pts.push([x, dz]);
  for (const name of [...new Set(WD.dirs)]) {
    const dir = { front: [0, 1], left: [1, 0], right: [-1, 0], fl: [Math.SQRT1_2, Math.SQRT1_2], fr: [-Math.SQRT1_2, Math.SQRT1_2] }[name];
    const sh = pts.filter(([x, dz]) => level.sheltered(P(x, 5, zSec - dz), dir));
    let worst = 0;
    for (const [x, dz] of pts) { let best = 1e9; for (const [sx, sdz] of sh) best = Math.min(best, Math.hypot(x - sx, dz - sdz)); worst = Math.max(worst, best); }
    rate[`돌풍 ${name} 숨을 곳까지 최대 거리`] = `${worst.toFixed(1)}m (허용 ${reach.toFixed(1)}m)`;
    T.check(`돌풍(${name}): 어디서나 ${reach.toFixed(1)}m 안에 숨을 곳이 있음`, { ok: sh.length > 0 && worst <= reach, why: `${worst.toFixed(1)}m` });
  }
}
// 바람이 실제로 미는지: 강풍 시각에 벽에 가려지지 않은 곳은 방향대로 밀고, 벽 뒤는 밀지 않는다
{
  const { level } = build();
  const o = new THREE.Vector3();
  const tStrong = WD.calm + WD.ramp + WD.strong / 2; // 첫 돌풍(front)의 한가운데
  const g = level.gustAt(tStrong);
  const open = new THREE.Vector3(5.2, 5, zSec - 1.5); // 벽이 없는 가장자리
  level.update(tStrong, S, null); // 마지막 갱신 시각을 맞춘다
  level.windAt(open, o);
  T.check('강풍에 가려지지 않은 곳은 바람 방향으로 민다', { ok: g.strength === 1 && Math.abs(o.z - g.dir[1] * WD.power) < 1e-6 && Math.abs(o.x - g.dir[0] * WD.power) < 1e-6, why: `${o.x.toFixed(2)},${o.z.toFixed(2)} 방향 ${g.dir}` });
  const horiz = level.shelters.find((w) => w.w > w.d);
  o.set(0, 0, 0); level.windAt(new THREE.Vector3(horiz.cx, 5, horiz.cz + 2), o);
  T.check('가로 벽 뒤는 앞바람을 받지 않는다', { ok: o.length() === 0, why: `${o.x},${o.z}` });
}
// 영리한 봇: 예고 때 다음 돌풍 방향을 보고 앞쪽에서 그 방향을 막는 벽 뒤로 이동, 강풍 동안 그 자리에서 버틴다
function gustRun(t0) {
  const m = build();
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(0, 5, z12), 0);
  const walls = m.level.shelters;
  const free = (x, dz) => !walls.some((w) => Math.abs(x - w.cx) < w.w / 2 + 0.7 && Math.abs(zSec - dz - w.cz) < w.d / 2 + 0.7);
  let t = t0, lastK = -1, target = [0, 0];
  const here = () => [p.pos.x, zSec - p.pos.z]; // [x, dz]
  while (t < t0 + 120) {
    const g = m.level.gustAt(t);
    const k = Math.floor(t / GPERIOD);
    const [hx, hdz] = here();
    if (hdz > 38.8) return { ok: true, time: t - t0 };
    if (k !== lastK && g.u < 0.05 + WD.calm) { // 새 돌풍이 예고되면 목표를 정한다
      lastK = k;
      const left = Math.max(0.2, WD.calm + WD.ramp - g.u);
      let best = null;
      if (38.5 - hdz <= left * 5.5) best = [0, 39.5]; // 끝까지 달릴 수 있으면 달린다
      if (!best) for (let dz = 1; dz <= 37; dz += 1) for (let x = -5; x <= 5; x += 1) {
        if (!free(x, dz) || dz < hdz - 1) continue;
        if (!m.level.sheltered(new THREE.Vector3(x, 5, zSec - dz), g.dir)) continue;
        if (Math.hypot(x - hx, dz - hdz) > left * 5.5) continue;
        if (!best || dz > best[1] || (dz === best[1] && Math.hypot(x - hx, dz - hdz) < Math.hypot(best[0] - hx, best[1] - hdz))) best = [x, dz];
      }
      if (!best) { // 앞으로 갈 곳이 없으면 가장 가까운 숨을 곳
        let bd = 1e9;
        for (let dz = 1; dz <= 37; dz += 1) for (let x = -5; x <= 5; x += 1) {
          if (!free(x, dz) || !m.level.sheltered(new THREE.Vector3(x, 5, zSec - dz), g.dir)) continue;
          const d = Math.hypot(x - hx, dz - hdz); if (d < bd) { bd = d; best = [x, dz]; }
        }
      }
      target = best || [hx, hdz];
      if (process.env.DEBUG_GUST) console.log('t0', t0, 'k', k, g.name, 'at', hx.toFixed(1), hdz.toFixed(1), '->', target.map((v) => v.toFixed(1)).join(','), 'left', left.toFixed(2));
    }
    const dx = target[0] - hx, ddz = target[1] - hdz, d = Math.hypot(dx, ddz);
    const move = d > 0.4 ? { x: dx / d, y: ddz / d } : { x: 0, y: 0 }; // y: 앞(-z)이 +
    m.level.update(t, S, p);
    p.step(S, move, 0, m.world, m.level.windAt, m.level.gravityAt);
    if (p.pos.y < -20) return { ok: false, why: `떨어짐 (${hx.toFixed(1)}, ${hdz.toFixed(1)})` };
    t += S;
  }
  const [hx, hdz] = here();
  return { ok: false, why: `시간 초과 (${hx.toFixed(1)}, ${hdz.toFixed(1)}) 목표 ${target.map((v) => v.toFixed(1)).join(',')}` };
}
{
  let ok = 0; const bad = [];
  const t0s = [0, 1.1, 2.3, 3.4, 4.6, 5.7, 6.9];
  for (const t0 of t0s) { const r = gustRun(t0); if (r.ok) ok++; else bad.push(r.why); }
  rate['돌풍(영리한 봇)'] = `${ok}/${t0s.length}`;
  if (bad.length) rate['돌풍 실패 사례'] = bad.slice(0, 3).join(' | ');
  T.check('돌풍: 방향을 보고 벽 뒤에 숨으며 지나갈 수 있음 (5/7 이상)', { ok: ok >= 5, why: `${ok}/${t0s.length} ${bad.slice(0, 2).join(' | ')}` });
  // 숨지 않고 곧장 달리는 봇은 시간이 더 걸린다 (바람이 실제로 영향을 준다는 확인은 아래 windAt 검사)
  let straight = 0;
  for (const t0 of t0s) if (run(build(), [0, 5, z12], [[3, z13 + 3]], { t0, maxT: 30 }).ok) straight++;
  rate['돌풍(직진 봇)'] = `${straight}/${t0s.length}`;
}
// 컨베이어·맞바람이 실제로 밀어 주는지(영향 확인)
{
  const { level } = build();
  const o = new THREE.Vector3();
  level.update(0, S, null);
  o.set(0, 0, 0); level.windAt(new THREE.Vector3(0, 5.05, z8 - 5), o);
  T.check('첫 컨베이어는 시작 쪽(+z)으로 민다', { ok: Math.abs(o.z - DIFFICULTY[DIFF].belts[0]) < 1e-6 && o.x === 0, why: `${o.x},${o.z}` });
  o.set(0, 0, 0); level.windAt(new THREE.Vector3(0, 5.05, z8 - 15), o);
  T.check('둘째 컨베이어는 옆(+x)으로 민다', { ok: Math.abs(o.x - DIFFICULTY[DIFF].belts[1]) < 1e-6, why: `${o.x},${o.z}` });
  o.set(0, 0, 0); level.windAt(new THREE.Vector3(0, 7.5, z8 - 5), o);
  T.check('점프로 떠 있으면 컨베이어 영향 없음', { ok: o.length() === 0, why: `${o.x},${o.z}` });
}
// 1부 난이도 상향 구간(2026-10-02): 회전 막대·움직이는 발판·바람 다리를 봇이 출발 시각을 바꿔 가며 지나간다 (최소 한 번은 통과해야 한다)
{
  const t0s = [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6, 6.3, 7, 7.7];
  const many = (start, tg) => t0s.filter((t0) => run(build(), start, tg, { t0, maxT: 40 }).ok).length;
  const sweep = many([0, 5, -72], [[0, -79.5], [0, -84], [0, -95], [0, -107], [0, -112]]);
  const movers = many([0, 5, -112], [[0, -120.5], [0, -127], [0, -133], [0, -138.5], [0, -144], [0, -150]]);
  const wind = many([0, 5, -150], [[0, -160], [0, -170], [0, -180]]);
  rate['회전 막대(1부, 상향 후)'] = `${sweep}/${t0s.length}`; rate['움직이는 발판(1부, 상향 후)'] = `${movers}/${t0s.length}`; rate['바람 다리(1부, 상향 후)'] = `${wind}/${t0s.length}`;
  T.check('회전 막대: 어떤 시각에는 지나감', { ok: sweep > 0, why: String(sweep) });
  T.check('움직이는 발판: 어떤 시각에는 지나감', { ok: movers > 0, why: String(movers) });
  T.check('바람 다리: 어떤 시각에는 지나감', { ok: wind > 0, why: String(wind) });
}
// 시소 안전 길(선택): 시소를 거치지 않고 서쪽 외길로 시험장 입구까지, 시소 기울기와 무관
{
  const m = build();
  T.check('시소 안전 길(외길)로 시험 구간 입구까지', run(m, [0, 5, -180], [[-7.5, -183.5], [-9, -190], [-9, -204], [-9, -218], [-7.5, -226], [0, z5]], { maxT: 60 }));
  const seesawMid = run(build(), [-9, 5, -190], [[-9, -218]], { nojump: true, maxT: 30 });
  T.check('외길을 점프 없이도 곧게 걸어서 통과', seesawMid);
}
// 골인
T.check('골인 언덕·결승 (시험 구간 뒤)', run(build(), [0, 5, z13], [[0, z13 - 9], [0, z13 - 21], [0, z13 - 26]], { maxT: 60 }));
console.log('  통과 비율(출발 시각별):', JSON.stringify(rate));
T.report();
if (!process.env.LAB_DIFFICULTY) {
  for (const d of ['easy', 'hard']) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, LAB_DIFFICULTY: d }, stdio: 'inherit' });
    if (r.status) process.exitCode = 1;
  }
}
