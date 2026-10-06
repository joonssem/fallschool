// 유적 발굴 현장: 모든 핵심 확인은 run(...) 봇이 실제로 걸어 발판을 밟는다.
// 자동 시험은 규칙·이동 확인이며 재미·학습 효과를 판정하지 않는다.
import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { ARTIFACTS, CHECKPOINT_Z, DISPLAY_WIDTHS, PLOT_X, Z, buildExcavation, plotLayout } from '../src/levels/excavation.js';
import { mapById } from '../src/levels/index.js';

const T = tally('유적 발굴 현장');
const fresh = (seed = 3) => {
  const world = new PhysicsWorld();
  return { world, level: buildExcavation(new THREE.Scene(), world, { seed }) };
};
const field = [[0, -18], [0, -27], [0, -58], [0, -73], [0, -85]];
const exhibit = [[0, -112], [0, -138], [0, -148], [-4.2, -153], [0, -160], [4.2, -167], [0, -177], [0, -190]];
const straightFinish = [...field, [0, -100], ...exhibit];
const toolX = { '큰 삽': -5, '모종삽': 0, '붓': 5 };
const itemX = { pottery: -5, grain: 0, stone: 5 };
function wayToPlot(plot, tool) {
  const path = [[toolX[tool], -9], [0, -17], [0, -28], [plot.x, plot.z - 1.8]];
  const hits = tool === '큰 삽' ? 1 : 2;
  if (hits > 1) path.push([plot.x, plot.z - 5.6]);
  return path;
}
function methodRoute(seed, tool, plot) {
  const m = fresh(seed);
  const r = run(m, [0, 1, Z.start], [...wayToPlot(plot, tool), ...straightFinish], { maxT: 100 });
  return { ...m, r, plot };
}

T.check('사회 분류·맵 등록', { ok: mapById('excavation').subject === '사회' && mapById('excavation').build === buildExcavation, why: '' });
{
  const { level } = fresh();
  T.check('출발~결승 193m, 구간 5개, 체크포인트 7곳', { ok: Z.start - Z.finish === 193 && level.checkpoints.length >= 6 && CHECKPOINT_Z.length === 6 && ['① 허가소와 도구 창고', '② 지표 조사 들판', '③ 발굴 구덩이', '④ 기록 천막', '⑤ 복원실과 전시 길'].every((n) => level.sectionAt(({ '① 허가소와 도구 창고': -1, '② 지표 조사 들판': -30, '③ 발굴 구덩이': -70, '④ 기록 천막': -100, '⑤ 복원실과 전시 길': -130 })[n]) === n), why: `${level.checkpoints.length} checkpoints` });
  T.check('확장 상태에 격자·도구·굴착·기록·복원·전시·별 노출', { ok: level.excavation.cells.length === 8 && level.excavation.sites.length === 4 && !!level.excavation.displayMeshes && level.excavation.starChallenges.length === 4 && !!level.excavation.constants, why: '' });
}

// 기본 완주와 아무것도 파지 않은 가장 좁은 전시대.
{
  const m = fresh(4);
  const r = run(m, [0, 1, Z.start], straightFinish, { maxT: 90 });
  T.check('아무것도 파지 않고 기본 길 완주', { ok: r.ok && m.level.finished && m.level.excavation.finds.length === 0 && m.level.excavation.display.every((d) => d.width === DISPLAY_WIDTHS.blank), why: r.why || JSON.stringify(m.level.excavation.display.map((d) => d.width)) });
}

// 세 도구 모두 실제로 구덩이 발판을 밟고 완주한다. 깨짐·층 수·흙길 결과가 다르다.
for (const tool of ['큰 삽', '모종삽', '붓']) {
  const seed = 7;
  const targetPlot = plotLayout(seed).find((p) => p.artifact && p.artifact.layer === 0);
  const { level, r, plot } = methodRoute(seed, tool, targetPlot);
  const find = level.excavation.finds.find((f) => f.plot === plot.id);
  const expectedFragments = tool === '큰 삽' ? 3 : null;
  T.check(`${tool}: 걸어서 발굴하고 기본 길 완주`, { ok: r.ok && level.finished && !!find, why: r.why || JSON.stringify({ tool, finds: level.excavation.finds.length }) });
  T.check(`${tool}: 선택 결과가 흙길·조각 수에 반영`, { ok: level.excavation.rubble.some((p) => p.plot === plot.id) && (expectedFragments === null ? find?.fragments <= 1 : find?.fragments === expectedFragments) && (tool !== '큰 삽' || level.excavation.rubble.filter((p) => p.plot === plot.id).length === 2), why: JSON.stringify({ tool, find, rubble: level.excavation.rubble.filter((p) => p.plot === plot.id).length }) });
}

// 네 구덩이를 각각 고르고 걸어 완주한다. 시드에 따라 세 유물과 한 빈 칸을 모두 밟아 본다.
{
  const seed = 14;
  for (const plot of plotLayout(seed)) {
    const m = fresh(seed);
    const r = run(m, [0, 1, Z.start], [...wayToPlot(plot, '모종삽'), ...straightFinish], { maxT: 95 });
    const selected = m.level.excavation.sites.find((p) => p.id === plot.id);
    T.check(`구덩이 ${plot.id}: 선택 발판을 밟고 기본 길 완주`, { ok: r.ok && m.level.finished && selected.dugLayers > 0, why: r.why || '' });
  }
}

// 붓으로 세 유물을 보존하고 기록·복원한 뒤, 걸어서 달라진 전시 발판을 건넌다.
{
  const seed = 12;
  const m = fresh(seed);
  const artifacts = plotLayout(seed).filter((p) => p.artifact);
  const path = [[5, -9], [0, -17], [0, -28]];
  for (const plot of artifacts) path.push([plot.x, plot.z - 1.8], [plot.x, plot.z - 5.6]);
  path.push([0, -58], [0, -85]);
  for (const artifact of ARTIFACTS) path.push([itemX[artifact.id], Z.record]);
  path.push([0, -112]);
  for (const artifact of ARTIFACTS) path.push([itemX[artifact.id], Z.restore]);
  path.push(...exhibit);
  const r = run(m, [0, 1, Z.start], path, { maxT: 140 });
  const state = m.level.excavation;
  T.check('붓 두 번 살피기·세 기록판·복원대까지 걸어 완주', { ok: r.ok && m.level.finished && state.finds.length === 3 && state.records.length === 3 && state.restorations.length === 3, why: r.why || JSON.stringify({ finds: state.finds.length, records: state.records.length, restored: state.restorations.length }) });
  T.check('정확한 기록과 온전 복원이 넓은 전시 발판이 됨', { ok: state.display.every((d) => d.width === DISPLAY_WIDTHS.whole && d.recorded && d.layer !== null), why: JSON.stringify(state.display) });
  T.check('붓 방식의 선택 별만 나타나며 모든 별을 한 판에 얻지 못함', { ok: state.starChallenges.find((s) => s.mode === 'perfect').star.mesh.visible && state.starChallenges.filter((s) => s.star.mesh.visible).length === 1, why: String(state.starChallenges.filter((s) => s.star.mesh.visible).length) });
}

// 모종삽의 약한 지표 단서는 시드마다 위치가 바뀌지만, 단서 종류와 유물 관계는 유지한다.
{
  const a = plotLayout(2), b = plotLayout(19);
  const loc = (layout, id) => layout.find((p) => p.artifact?.id === id)?.id;
  const { level } = fresh(2);
  const before = level.excavation.hiddenSite;
  level.setSeed(19);
  const after = level.excavation.hiddenSite;
  T.check('시드가 유물·희미한 단서의 위치를 바꿈', { ok: ARTIFACTS.some((x) => loc(a, x.id) !== loc(b, x.id)) && before !== after, why: `${before} → ${after}` });
  T.check('단서와 해당 유물의 대응은 시드가 달라도 같음', { ok: [a, b].every((layout) => layout.filter((p) => p.artifact).every((p) => p.clue === p.artifact.clue && p.artifact.id === ARTIFACTS.find((x) => x.clue === p.clue)?.id)), why: '' });
  T.check('약한 단서는 숨은 구덩이 하나에 대응', { ok: a.filter((p) => p.faint).length === 1 && b.filter((p) => p.faint).length === 1, why: '' });
}

// 큰 삽 결과는 별도의 넓은 흙길을 만든다. 시작점에서 흙길로 옮겨도 낙하 없이 연결된다.
{
  const seed = 8;
  const m = fresh(seed);
  const plot = plotLayout(seed).find((p) => p.artifact);
  const laneX = plot.x * 0.8;
  const path = [...wayToPlot(plot, '큰 삽'), [0, -58], [laneX, -63], [laneX, -67], [laneX, -71], [0, -79], [0, -100], ...exhibit];
  const r = run(m, [0, 1, Z.start], path, { maxT: 110 });
  T.check('큰 삽이 파낸 흙 발판을 실제로 밟아 다음 구간에 도달', { ok: r.ok && m.level.excavation.soilBlocks.some((s) => s.collider.enabled) && m.level.excavation.rubble.length >= 2 && m.level.excavation.rubbleWalked, why: r.why || `rubble walked=${m.level.excavation.rubbleWalked}` });
  T.check('흙 블록이 사라질 때 충돌체도 함께 꺼짐', { ok: m.level.excavation.soilBlocks.every((s) => s.mesh.visible === s.collider.enabled), why: '' });
}

// 빈 칸 오답을 걸어서 되돌려 덮고, 단서가 있는 칸을 다시 찾아 가까운 체크포인트까지 이동한다.
// 그 뒤 일부러 길 밖으로 걸어 떨어지고, 같은 체크포인트에서 상태가 남은 채 답사를 계속한다.
{
  const seed = 5;
  const m = fresh(seed);
  const layout = plotLayout(seed);
  const empty = layout.find((p) => !p.artifact);
  const correct = layout.find((p) => p.artifact);
  const wrongThenRight = [[0, -9], [0, -17], [0, -28], [empty.x, empty.z - 1.8], [9, -56], [correct.x, correct.z - 1.8], [correct.x, correct.z - 5.6], [0, -55]];
  const first = run(m, [0, 1, Z.start], wrongThenRight, { maxT: 55 });
  const wrongPlot = m.level.excavation.sites.find((p) => p.id === empty.id);
  const savedFinds = m.level.excavation.finds.length;
  T.check('빈 칸 오답을 덮고 이웃의 단서 칸을 파서 복귀', { ok: first.ok && wrongPlot.dugLayers === 0 && m.level.excavation.finds.some((f) => f.plot === correct.id) && m.level.checkpoints.find((cp) => cp.name.includes('55m'))?.reached, why: first.why || `${wrongPlot.dugLayers}, finds=${savedFinds}` });
  const fell = run(m, [0, 1, -55], [[30, -55]], { maxT: 20 });
  const afterFall = run(m, [0, 1, -55], [[0, -58], [0, -85], [0, -100], ...exhibit], { maxT: 75 });
  T.check('길 밖으로 걸어 떨어져도 가장 가까운 체크포인트에서 상태를 유지해 재개', { ok: !fell.ok && /떨어짐/.test(fell.why) && afterFall.ok && m.level.finished && m.level.excavation.finds.length >= savedFinds && m.level.checkpoints.find((cp) => cp.name.includes('55m'))?.reached, why: `${fell.why} · ${afterFall.why}` });
}

// 숨은 단서 칸을 밟고 체크포인트를 지나간 뒤 진행 상태가 초기화 없이 유지된다.
{
  const seed = 5;
  const m = fresh(seed);
  const hidden = plotLayout(seed).find((p) => p.hidden);
  const r = run(m, [0, 1, Z.start], [...wayToPlot(hidden, '모종삽'), [0, -55], [0, -79]], { maxT: 50 });
  const cp = m.level.checkpoints.find((c) => c.name.includes('79m'));
  T.check('희미한 단서 구덩이를 걸어서 찾고 복귀', { ok: r.ok && m.level.excavation.plots.find((p) => p.id === hidden.id).dugLayers > 0 && cp?.reached, why: r.why || '' });
  const oldSeed = m.level.seed;
  m.level.resetProgress();
  T.check('처음부터: 도구·파낸 칸·발견·기록·복원·별 초기화', { ok: m.level.excavation.tool === '모종삽' && !m.level.excavation.dugCells.length && !m.level.excavation.finds.length && !m.level.excavation.records.length && !m.level.excavation.restorations.length && m.level.stars.every((s) => !s.got) && m.level.seed === oldSeed && m.level.excavation.sites.every((p) => p.soils.every((s) => s.visible)), why: '' });
  const nextSeed = oldSeed + 1;
  m.level.setSeed(nextSeed);
  T.check('새 경기 시드: 새 배치와 진행 초기화', { ok: m.level.seed === nextSeed && !m.level.excavation.finds.length && m.level.excavation.sites.every((p) => p.dugLayers === 0), why: '' });
}

// 별 섬은 선택 도전이다. 봇 run(...)이 큰 삽을 밟고 흙길·스프링을 거쳐 실제로 이동한다.
{
  const seed = 8;
  const m = fresh(seed);
  const plot = plotLayout(seed).find((p) => p.artifact);
  const r = run(m, [0, 1, Z.start], [...wayToPlot(plot, '큰 삽'), [0, -58], [6.3, -67]], { maxT: 55 });
  const p = new Player(new THREE.Scene()); p.respawn(new THREE.Vector3(6.3, 1.2, -67), 0);
  let jumped = false, dived = false;
  for (let t = 0; t < 2; t += S) {
    if (!jumped && p.grounded) { p.requestJump(); jumped = true; }
    if (jumped && !dived && t > 0.18 && !p.grounded) { p.requestDive(); dived = true; }
    m.level.update(t, S, p);
    const moveX = p.pos.x < 10.5 ? 1 : -1;
    p.step(S, { x: moveX, y: 0 }, 0, m.world, m.level.windAt, m.level.gravityAt);
  }
  T.check('큰 삽이 선택 흙길과 별 섬을 열고, 봇이 걸어와 점프·다이브로 별을 획득', { ok: r.ok && jumped && dived && m.level.excavation.starChallenges.find((s) => s.mode === 'shovel').star.got && m.level.excavation.shovelSpring.collider.kind === 'bounce', why: r.why || `jump=${jumped}, dive=${dived}, got=${m.level.excavation.starChallenges.find((s) => s.mode === 'shovel').star.got}, pos=${p.pos.toArray().map((n) => n.toFixed(1))}` });
}

// 다른 별도 trowel 방식에서만 나타나며 실제 경로로 접근할 수 있다.
{
  const seed = 5;
  const m = fresh(seed);
  const hidden = plotLayout(seed).find((p) => p.hidden);
  const path = [...wayToPlot(hidden, '모종삽'), [0, -58], [0, -85], [0, -100], [0, -120], [0, -132], [-11, -145], [0, -150], [0, -177], [0, -190]];
  const r = run(m, [0, 1, Z.start], path, { maxT: 90 });
  T.check('모종삽의 희미한 흔적 별을 걸어서 찾아 획득', { ok: r.ok && m.level.excavation.starChallenges.find((s) => s.mode === 'hidden').star.got && !m.level.excavation.starChallenges.find((s) => s.mode === 'shovel').star.visible, why: r.why || '' });
}

// 안전한 부활 위치는 자동 map-rules에서 검사된다. 여기는 선택된 사이트와 선택 활동이 생략 가능함을 확인.
T.report();
