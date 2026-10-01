// 산과 염기 리트머스 시험대: 네 조합, 선택 순서·변경, 개인 상태, 초기화, 기존 타일·noHelp 유지, 이동(왕복·우회 없음)
import { loadMap, run, tally, THREE, Player, S } from './harness.mjs';
import { litmusResult, SOLUTIONS, PAPERS } from '../src/levels/acid.js';

const T = tally('리트머스 시험대');
const make = await loadMap('acid');
const ok = (cond, why) => ({ ok: !!cond, why });
const Y = 1.5;

// ── 판정표 (docs/15): 용액 × 시작 종이 → 결과 색·변화 여부·설명 ──
const EXPECT = {
  'vinegar|blue': { after: 'red', changed: true, name: '붉은색', line: '푸른 종이가 붉게 변했어요' },
  'vinegar|red': { after: 'red', changed: false, name: '붉은색', line: '붉은 종이는 그대로 붉어요' },
  'soap|red': { after: 'blue', changed: true, name: '푸른색', line: '붉은 종이가 푸르게 변했어요' },
  'soap|blue': { after: 'blue', changed: false, name: '푸른색', line: '푸른 종이는 그대로 푸르러요' },
};
for (const [key, e] of Object.entries(EXPECT)) {
  const [sol, paper] = key.split('|');
  const r = litmusResult(sol, paper);
  T.check(`판정 ${key}`, ok(r.after === e.after && r.changed === e.changed && r.afterName === e.name && r.lines[0] === e.line && r.lines[1].length > 0 && r.before === paper, JSON.stringify(r)));
}
T.check('녹인다는 표현이 설명에 없음', ok(!Object.keys(EXPECT).some((k) => litmusResult(...k.split('|')).lines.join('').includes('녹')), '설명에 녹 포함'));
T.check('알 수 없는 선택은 오류', ok((() => { try { litmusResult('x', 'blue'); } catch { return true; } return false; })(), '오류 없음'));
T.check('종이·용액 목록', ok(Object.keys(SOLUTIONS).length === 2 && Object.keys(PAPERS).length === 2, ''));

// ── 시험대 상호작용: 플레이어가 선택 발판에 설 때 ──
const stand = (m, pad, t = 1) => m.level.update(t, S, { pos: new THREE.Vector3(pad.x, Y, pad.z) });
const away = (m, t = 1) => m.level.update(t, S, { pos: new THREE.Vector3(0, Y, -20) });
const pad = (st, kind, value) => st.pads.find((p) => p.kind === kind && p.value === value);
const combos = [['vinegar', 'blue'], ['vinegar', 'red'], ['soap', 'red'], ['soap', 'blue']];
for (const [si, label] of [[0, '식초 입구'], [1, '비눗물 입구']]) {
  for (const [sol, paper] of combos) for (const solutionFirst of [true, false]) {
    const m = make(3);
    const st = m.level.litmusStations[si];
    const order = solutionFirst ? [['solution', sol], ['paper', paper]] : [['paper', paper], ['solution', sol]];
    let t = 1;
    for (const [i, [kind, value]] of order.entries()) {
      stand(m, pad(st, kind, value), t++);
      away(m, t++);
      if (i === 0) T.check(`${label} ${sol}+${paper} ${solutionFirst ? '용액' : '종이'} 먼저: 한쪽만 고르면 결과를 채우지 않음`, ok(st.result() === null, '추측해서 채움'));
    }
    const r = st.result();
    const e = EXPECT[`${sol}|${paper}`];
    T.check(`${label} ${sol}+${paper} ${solutionFirst ? '용액' : '종이'} 먼저: 결과`, ok(r && r.after === e.after && r.changed === e.changed && r.lines[0] === e.line, JSON.stringify(r)));
  }
  // 선택 변경: 이미 고른 뒤 다른 발판을 밟으면 즉시 바뀐다
  const m = make(3);
  const st = m.level.litmusStations[si];
  let t = 1;
  for (const [kind, value] of [['solution', 'vinegar'], ['paper', 'blue']]) { stand(m, pad(st, kind, value), t++); away(m, t++); }
  T.check(`${label} 변경 전 식초+푸른`, ok(st.result().after === 'red' && st.result().changed, ''));
  stand(m, pad(st, 'solution', 'soap'), t++); away(m, t++);
  T.check(`${label} 용액만 바꾸면 즉시 비눗물+푸른(그대로 푸름)`, ok(st.solution === 'soap' && st.result().after === 'blue' && !st.result().changed, ''));
  stand(m, pad(st, 'paper', 'red'), t++); away(m, t++);
  T.check(`${label} 종이도 바꾸면 비눗물+붉은(푸르게 변함)`, ok(st.paper === 'red' && st.result().after === 'blue' && st.result().changed, ''));
  // 같은 발판에 계속 서 있어도 변화 없음, 선택 표시(발판 크기)
  stand(m, pad(st, 'paper', 'red'), t++); stand(m, pad(st, 'paper', 'red'), t++);
  T.check(`${label} 선택 표시: 고른 발판만 커짐`, ok(pad(st, 'solution', 'soap').mesh.scale.x > 1 && pad(st, 'solution', 'vinegar').mesh.scale.x === 1 && pad(st, 'paper', 'red').mesh.scale.x > 1 && pad(st, 'paper', 'blue').mesh.scale.x === 1, ''));
}

// ── 앞 웅덩이와 같은 실험 표시: 해당 조합에서만 켜지고 답(안전한 색)은 알려 주지 않는다 ──
for (const [si, field] of [[0, ['vinegar', 'blue']], [1, ['soap', 'red']]]) {
  const m = make(3);
  const st = m.level.litmusStations[si];
  T.check(`입구 ${si + 1}: 선택 전에는 같은 실험 아님`, ok(!st.matchesField(), ''));
  for (const [sol, paper] of combos) {
    const mm = make(3);
    const s2 = mm.level.litmusStations[si];
    stand(mm, pad(s2, 'solution', sol), 1); away(mm, 2);
    stand(mm, pad(s2, 'paper', paper), 3); away(mm, 4);
    const expected = sol === field[0] && paper === field[1];
    T.check(`입구 ${si + 1} ${sol}+${paper}: 같은 실험 표시 ${expected ? '켜짐' : '꺼짐'}`, ok(s2.matchesField() === expected, String(s2.matchesField())));
  }
}

// ── 개인 상태: 다른 학생의 위치·선택·발판 녹음은 내 시험대를 바꾸지 않음 ──
{
  const m = make(3);
  const st = m.level.litmusStations[0];
  m.level.getOthers = () => st.pads.map((p) => new THREE.Vector3(p.x, Y, p.z)); // 친구들이 네 발판 모두에 서 있음
  m.level.getPlayerCount = () => 21;
  for (let i = 0; i < 20; i++) m.level.triggerTile(i);
  for (let t = 1; t < 4; t++) away(m, t);
  T.check('친구가 발판에 서 있어도 내 시험대는 미선택', ok(st.solution === null && st.paper === null && st.result() === null, `${st.solution}/${st.paper}`));
  // 내가 고르고 친구가 다른 발판에 서도 내 선택 유지
  stand(m, pad(st, 'solution', 'vinegar'), 5); away(m, 6);
  T.check('내 선택은 친구 위치와 무관하게 유지', ok(st.solution === 'vinegar' && st.paper === null, `${st.solution}/${st.paper}`));
  const other = m.level.litmusStations[1];
  T.check('다른 입구 시험대는 따로', ok(other.solution === null, '다른 시험대에 영향'));
  // 교사 화면(player 없음)에서도 오류 없음
  T.check('교사 화면(player 없음)', ok((() => { try { m.level.update(9, S, null); return true; } catch { return false; } })(), '오류'));
}

// ── 초기화: 새 경기(setSeed)·처음부터(resetProgress) ──
for (const how of ['setSeed', 'resetProgress']) {
  const m = make(3);
  for (const st of m.level.litmusStations) {
    stand(m, pad(st, 'solution', 'soap'), 1); away(m, 2);
    stand(m, pad(st, 'paper', 'red'), 3); away(m, 4);
  }
  const before = m.level.litmusStations.every((st) => st.result());
  how === 'setSeed' ? m.level.setSeed(9) : m.level.resetProgress();
  T.check(`${how}: 초기화 전에는 선택됨`, ok(before, ''));
  T.check(`${how}: 두 시험대 모두 미선택·발판 표시 해제`, ok(m.level.litmusStations.every((st) => st.solution === null && st.paper === null && st.pads.every((p) => p.mesh.scale.x === 1)), ''));
  // 초기화 직후 같은 발판에 서 있어도 다시 선택됨(점유 상태도 초기화)
  const st = m.level.litmusStations[0];
  stand(m, pad(st, 'solution', 'soap'), 5);
  T.check(`${how}: 초기화 후 다시 선택 가능`, ok(st.solution === 'soap', ''));
}

// ── 기존 규칙 유지: 같은 시드의 타일 색·배치, noHelp, 체크포인트·도전 별·예측 문 개수 ──
const tilesOf = (m) => m.level.root.children.filter((o) => o.geometry?.parameters && Math.abs(o.geometry.parameters.height - 0.3) < 1e-6 && o.geometry.parameters.width === 2.4);
const BASE = { // 시험대를 넣기 전(0dd1d7c)의 acid.js에서 같은 방법으로 기록한 지문 (R 붉은 타일, B 푸른 타일)
  1: 'BBBRRBBBRRBBBRRBBBRRBBBRBBBBRRRBBRRRRBBRBBBBBRRRRB',
  7: 'BBRBRBBBRRBBBRRBBBBRBBBBRRRRBBRRRRBRRRBBRRBBRBRBBR',
  99: 'BBBRRBRBRRBRBRRRBRRBBRRBBBBBRRBBRRRRBBBRRRBBRBRBBR',
};
for (const [seed, fp] of Object.entries(BASE)) {
  const tiles = tilesOf(make(+seed));
  T.check(`시드 ${seed}: 타일 50개·색 배치 불변`, ok(tiles.length === 50 && tiles.map((t) => (t.material.color.getHex() === 0xe63946 ? 'R' : 'B')).join('') === fp, `${tiles.length}`));
}
{
  const m = make(1);
  const cps = m.level.checkpoints;
  T.check('리트머스 두 구역 체크포인트 noHelp 유지', ok(cps.filter((c) => c.noHelp).map((c) => c.name).join() === '식초 웅덩이 앞,비눗물 웅덩이 앞', cps.filter((c) => c.noHelp).map((c) => c.name).join()));
  // 시험대를 넣기 전(0dd1d7c)과 같다: 체크포인트 7, 도전 별 3, 예측 문 3 (시험대에 확정 버튼·새 문이 없다)
  T.check('체크포인트·도전 별 개수 유지', ok(cps.length === 7 && m.level.stars.length === 3, `cp ${cps.length}, 별 ${m.level.stars.length}`));
  T.check('예측 문 세 개 그대로(새 문 없음)', ok(m.level.gates.map((g) => g.name).join() === '페놀프탈레인,붉은 양배추,섞으면?', m.level.gates.map((g) => g.name).join()));
}

// ── 이동: 시험대를 쓰지 않고 기존 길 통과, 시험대 왕복, 타일 구간 우회 없음 ──
const safeRoute = (m, field) => { // field 0: 식초(붉은 타일이 안전), 1: 비눗물(푸른 타일이 안전)
  const tiles = tilesOf(m).slice(field * 25, field * 25 + 25);
  const safeHex = field === 0 ? 0xe63946 : 0x3a86ff;
  const safe = tiles.map((t) => t.material.color.getHex() === safeHex);
  const at = (r, c) => r * 5 + c;
  const prev = new Map();
  const queue = [];
  for (let c = 0; c < 5; c++) if (safe[at(0, c)]) { prev.set(at(0, c), -1); queue.push(at(0, c)); }
  let end = -1;
  while (queue.length) {
    const i = queue.shift();
    const r = Math.floor(i / 5), c = i % 5;
    if (r === 4) { end = i; break; }
    for (const [dr, dc] of [[1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr > 4 || nc < 0 || nc > 4 || !safe[at(nr, nc)] || prev.has(at(nr, nc))) continue;
      prev.set(at(nr, nc), i); queue.push(at(nr, nc));
    }
  }
  const path = [];
  for (let i = end; i !== -1 && i !== undefined; i = prev.get(i)) path.unshift([tiles[i].position.x, tiles[i].position.z]);
  return path;
};
for (const seed of [1, 7, 99]) {
  const m = make(seed);
  const a = safeRoute(m, 0), b = safeRoute(m, 1);
  T.check(`시드 ${seed}: 안전 타일 길이 있음`, ok(a.length >= 5 && b.length >= 5, `${a.length}/${b.length}`));
  T.check(`시드 ${seed}: 시험대를 쓰지 않고 식초 구역 통과`, run(m, [0, Y, -40], [...a, [0, -61]], { maxT: 40 }));
  const m2 = make(seed);
  T.check(`시드 ${seed}: 시험대를 쓰지 않고 비눗물 구역 통과`, run(m2, [0, Y, -60], [...safeRoute(m2, 1), [0, -82]], { maxT: 40 }));
  const m3 = make(seed);
  T.check(`시드 ${seed}: 시험대 왕복(식초 입구)`, run(m3, [0, Y, -40], [[9.2, -39.7], [12.8, -42.3], [9.2, -39.7], [0, -40]], { maxT: 20 }));
  const m4 = make(seed);
  T.check(`시드 ${seed}: 시험대 왕복(비눗물 입구)`, run(m4, [0, Y, -60], [[-9.2, -59.7], [-12.8, -62.3], [-9.2, -59.7], [0, -60]], { maxT: 20 }));
}

// 우회 없음: 시험대 앞 가장자리에서 달려 점프 + 다이브를 해도 건너편 입구 발판(타일 구간 뒤)에 첫 착지로 닿지 못한다.
// (한 줄 이상 뛰어넘어도 다섯 줄은 못 넘는다는 기존 설계 유지) 대조: 기존 입구 발판 가장자리에서도 같아야 한다.
function firstLanding(m, from, aim, edgeZ) {
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(...from), 0);
  let launched = false, air = 0, t = 0, reachZ = from[2];
  while (t < 8) {
    const dx = aim[0] - p.pos.x, dz = aim[1] - p.pos.z, d = Math.hypot(dx, dz);
    m.level.update(t, S, p);
    p.step(S, { x: dx / d, y: -dz / d }, 0, m.world, m.level.windAt, m.level.gravityAt);
    if (!launched && p.grounded && p.pos.z < edgeZ + 0.35) { p.requestJump(); launched = true; }
    if (launched && !p.grounded) { air += S; if (air > 0.2) p.requestDive(); }
    if (launched && p.pos.y >= Y - 0.3) reachZ = Math.min(reachZ, p.pos.z); // 발판 높이 이상에서 간 가장 먼 곳
    if (launched && p.grounded && air > 0.1) return { landed: true, reachZ, x: p.pos.x, y: p.pos.y, z: p.pos.z };
    if (p.pos.y < -10) return { landed: false, reachZ, x: p.pos.x, y: p.pos.y, z: p.pos.z };
    t += S;
  }
  return { landed: false, x: p.pos.x, y: p.pos.y, z: p.pos.z, timeout: true };
}
const reachedFar = (r, zFar) => r.landed && r.z < zFar && Math.abs(r.x) < 7.2; // 건너편 입구 발판에 올라섬
for (const [label, from, aim, edge, zFar] of [
  ['식초 시험대', [12.8, Y, -40.5], [5, -58.5], -44, -57.9],
  ['식초 입구 가운데(대조)', [0, Y, -40.5], [0, -58.5], -44, -57.9],
  ['비눗물 시험대', [-12.8, Y, -60.5], [-5, -78.5], -64, -77.9],
  ['비눗물 입구 가운데(대조)', [0, Y, -60.5], [0, -78.5], -64, -77.9],
]) {
  const r = firstLanding(make(1), from, aim, edge);
  T.check(`${label}에서 점프+다이브: 건너편 발판에 닿지 못함`, ok(!reachedFar(r, zFar) && r.reachZ > zFar + 1, `첫 착지 (${r.x.toFixed(1)}, ${r.y.toFixed(1)}, ${r.z.toFixed(1)}) 발판 높이에서 최대 도달 z=${r.reachZ?.toFixed(1)}`));
  console.log(`  ${label}: 시작 z=${from[2]}, 발판 높이에서 최대 도달 z=${r.reachZ.toFixed(1)} (이동 ${(from[2] - r.reachZ).toFixed(1)}m), 첫 착지 ${r.landed ? `(${r.x.toFixed(1)}, ${r.z.toFixed(1)})` : '낙하'}`);
}
T.report();
