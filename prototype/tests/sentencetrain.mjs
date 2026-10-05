// 문장 구조 열차: 규칙·이동 시험 (재미·국어 학습 효과의 증거가 아니다)
import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { buildSentenceTrain, STORY_CHOICES, josaRo, stationWords, bridgeSides, GATE_Z, ROW_Z, carX, STATION_WORDS } from '../src/levels/sentencetrain.js';
import { mapById } from '../src/levels/index.js';

const T = tally('문장 구조 열차');
const fresh = (seed = 5) => {
  const world = new PhysicsWorld();
  return { world, level: buildSentenceTrain(new THREE.Scene(), world, { seed }) };
};
T.check('맵 선택 목록 등록', { ok: mapById('sentencetrain').build === buildSentenceTrain, why: '' });
const { level } = fresh();
T.check('출발 때 문장과 사건은 비어 있음', {
  ok: level.story.place === null && level.story.event === null
    && Object.values(level.storyScenes.endings).every((board) => !board.visible), why: '',
});
level.story.choosePlace('forest');
T.check('숲 선택은 숲 장면·문장·열차 색으로 드러남', {
  ok: level.storyScenes.scenes.forest.visible && !level.storyScenes.scenes.sea.visible
    && level.storyScenes.placeSigns.forest.visible && !level.storyScenes.placeSigns.sea.visible
    && level.storyScenes.body.material.color.getHex() === STORY_CHOICES.places[0].color, why: '',
});
level.story.chooseEvent('friend');
level.update(2, 2, null);
T.check('친구 사건은 승객과 완성 문장·열차 이동으로 이어짐', {
  ok: level.storyScenes.friend.visible && !level.storyScenes.letter.visible
    && level.storyScenes.endings['forest:friend'].visible && level.storyScenes.train.position.z > -175, why: '',
});
level.story.choosePlace('sea');
level.story.chooseEvent('letter');
T.check('다시 고르면 새 이야기만 표시됨', {
  ok: level.storyScenes.scenes.sea.visible && !level.storyScenes.scenes.forest.visible
    && level.storyScenes.letter.visible && !level.storyScenes.friend.visible
    && level.storyScenes.endings['sea:letter'].visible
    && Object.values(level.storyScenes.endings).filter((board) => board.visible).length === 1, why: '',
});
level.resetProgress();
T.check('새 경기에는 선택·열차·별이 초기화됨', {
  ok: level.story.place === null && level.story.event === null && !level.finished
    && level.storyScenes.train.position.z === -175
    && Object.values(level.storyScenes.endings).every((board) => !board.visible)
    && level.stars.every((star) => !star.got), why: '',
});

// ─── 조사 규칙과 터널 ───
const cases = { 숲: '으로', 바다: '로', 마을: '로', 교실: '로', 산: '으로', 운동장: '으로', 놀이터: '로', 섬: '으로', 강가: '로', 박물관: '으로' };
T.check('조사 규칙: 받침 없음·ㄹ받침은 로, 그 밖의 받침은 으로', { ok: Object.entries(cases).every(([w, j]) => josaRo(w) === j), why: Object.keys(cases).map((w) => w + josaRo(w)).join(' ') });
T.check('경유역 후보 분류가 규칙과 맞음', { ok: STATION_WORDS.ro.every((w) => josaRo(w) === '로') && STATION_WORDS.euro.every((w) => josaRo(w) === '으로'), why: '' });
const wordSets = new Set();
for (let s = 1; s <= 30; s++) {
  const w = stationWords(s);
  wordSets.add(w.join());
  T.check(`경유역 시드 ${s}: 로 하나 + 으로 하나`, { ok: new Set(w.map(josaRo)).size === 2, why: w.join() });
}
T.check('경유역이 시드마다 달라짐', { ok: wordSets.size >= 10, why: `${wordSets.size}가지` });
{
  const m = fresh(3);
  m.level.story.choosePlace('forest');
  const g0 = m.level.tunnels.gates[0];
  T.check('첫 터널은 고른 장소: 숲 → 으로 터널만 열림', { ok: g0.word === '숲' && g0.answer === 'euro' && g0.lanes.ro.end.userData.collider.enabled && !g0.lanes.euro.end.userData.collider.enabled, why: '' });
  m.level.story.choosePlace('sea');
  T.check('장소를 바꾸면 첫 터널도 바뀜: 바다 → 로', { ok: g0.word === '바다' && g0.answer === 'ro' && !g0.lanes.ro.end.userData.collider.enabled, why: '' });
}

// ─── 걷기 경로 도우미 ───
const laneX = (key) => (key === 'ro' ? -5 : 5);
function tunnelTargets(lvl, wrongAt = -1, placeWord = null) {
  const t = [];
  lvl.tunnels.gates.forEach((g, i) => {
    const ans = i === 0 && placeWord ? (josaRo(placeWord) === '로' ? 'ro' : 'euro') : g.answer; // 첫 터널은 걸으며 고를 장소로 정해진다
    const right = laneX(ans), wrong = laneX(ans === 'ro' ? 'euro' : 'ro');
    if (i === wrongAt) t.push([0, g.z - 2], [wrong, g.z - 3], [wrong, g.z - 11.5], [wrong, g.z - 3], [0, g.z - 2.5]);
    t.push([right, g.z - 3], [right, g.z - 14], [0, g.z - 16]);
  });
  return t;
}
// 어순 철교 봇: 다음 줄의 맞는 칸이 앞에 올 때 짧게 뛰어 옮겨 탄다. pickWrong이면 첫 줄은 틀린 칸에 탄다.
function crossBridge(m, t0, pickWrong = false) {
  const b = m.level.orderBridge;
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(0, 1, -131.5), 0);
  let t = t0, i = 0, sank = false;
  while (t < t0 + 40) {
    const side = pickWrong && i === 0 ? -b.sides[0] : (i < 3 ? b.sides[i] : 0);
    const onZ = i === 0 ? -131.5 : ROW_Z[i - 1];
    const curX = i === 0 ? p.pos.x : carX(i - 1, b.sides[i - 1], t);
    const nextX = i < 3 ? carX(i, side, t + 0.7) : 0; // 공중에서는 칸에 실려 가지 않으므로 내려앉을 때 다음 칸 위치를 본다
    const ready = i === 3 || Math.abs(nextX - p.pos.x) < 0.8; // 도착역은 넓어 어디로 뛰어도 된다
    const room = i === 0 ? 9 : 1.3;
    const tx = i === 3 ? curX : p.grounded ? THREE.MathUtils.clamp(nextX, curX - room, curX + room) : nextX;
    const mx = THREE.MathUtils.clamp((tx - p.pos.x) * 1.5, -1, 1);
    let mz = !p.grounded || ready ? -0.6 : THREE.MathUtils.clamp((onZ - p.pos.z) * 2, -1, 1);
    if (pickWrong && i === 1 && !sank) mz = 0; // 틀린 칸에 서서 가라앉기를 기다린다
    if (p.pos.y < -1 && !sank) { sank = true; return { ok: false, sank: true, y: p.pos.y, t: t - t0 }; }
    const nz = i < 3 ? ROW_Z[i] : -152;
    if (p.grounded && p.pos.z < nz + 0.4 && p.pos.y > 0.5) { i++; if (i > 3) return { ok: true, t: +(t - t0).toFixed(1) }; }
    if (p.grounded && mz < 0 && ready) {
      const ahead = new THREE.Vector3(p.pos.x, p.pos.y + 0.6, p.pos.z - 0.9);
      let best = Infinity;
      for (const c of m.world.colliders) if (c.enabled) best = Math.min(best, c.raycast(ahead, new THREE.Vector3(0, -1, 0), 1.2));
      if (best > 1.15) p.requestJump();
    }
    m.level.update(t, S, p);
    p.step(S, { x: mx, y: -mz }, 0, m.world, m.level.windAt, m.level.gravityAt);
    if (p.pos.y < -10) return { ok: false, why: `떨어짐 z=${p.pos.z.toFixed(1)} 줄 ${i}` };
    t += S;
  }
  return { ok: false, why: '시간 초과' };
}

// ─── 터널: 틀린 터널은 막다른 굴(떨어지지 않음), 되돌아 나와 맞는 터널로 ───
{
  const m = fresh(4);
  m.level.story.choosePlace('forest');
  const g = m.level.tunnels.gates[1];
  const wrong = laneX(g.answer === 'ro' ? 'euro' : 'ro');
  const r = run(m, [0, 1, g.z - 1], [[wrong, g.z - 3], [wrong, g.z - 18]], { maxT: 12 });
  T.check('틀린 터널은 끝 벽에 막힘(떨어지지 않음)', { ok: !r.ok && /막힘/.test(r.why), why: r.why || 'passed' });
  T.check('틀린 터널에 들어가면 한 번 셈', { ok: g.wrong === 1 && m.level.tunnels.wrongEntries === 1, why: String(g.wrong) });
}
// ─── 어순 철교 ───
for (let s = 1; s <= 20; s++) {
  const sides = bridgeSides(s);
  if (s <= 3) T.check(`철교 시드 ${s}: 줄마다 맞는 칸 방향`, { ok: sides.length === 3 && sides.every((x) => x === -1 || x === 1), why: sides.join() });
}
T.check('철교: 맞는 칸 배치가 시드마다 달라짐', { ok: new Set(Array.from({ length: 12 }, (_, s) => bridgeSides(s + 1).join())).size >= 4, why: '' });
{
  const m = fresh(6); m.level.story.choosePlace('sea'); m.level.story.chooseEvent('letter');
  const rows = m.level.orderBridge.rows;
  T.check('철교: 맞는 칸에는 문장 차례의 낱말, 틀린 칸에는 다른 자리 낱말', { ok: rows.every((row, r) => row.cars.find((c) => c.correct).word === STORY_CHOICES.events[1].chunks[r] && row.cars.find((c) => !c.correct).word !== STORY_CHOICES.events[1].chunks[r]), why: rows.map((row) => row.cars.map((c) => c.word).join('/')).join(' | ') });
}
{
  const t0s = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5];
  let ok = 0; const times = [];
  for (const t0 of t0s) {
    const m = fresh(7); m.level.story.choosePlace('forest'); m.level.story.chooseEvent('friend');
    const r = crossBridge(m, t0);
    if (r.ok) { ok++; times.push(r.t); }
  }
  console.log(`  어순 철교: 맞는 칸을 보고 건너는 봇 ${ok}/${t0s.length} (평균 ${(times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)).toFixed(1)}초)`);
  T.check('철교: 맞는 칸을 따라가면 어느 출발 시각에도 건넘', { ok: ok === t0s.length, why: `${ok}/${t0s.length}` });
  const m = fresh(7); m.level.story.choosePlace('forest'); m.level.story.chooseEvent('friend');
  const w = crossBridge(m, 1, true);
  T.check('철교: 틀린 칸은 가라앉아 아래 물길에 안전하게 내려앉음', { ok: w.sank && m.level.orderBridge.mistakes === 1, why: JSON.stringify(w) });
  const back = run(m, [0, -1.6, -140], [[10.5, -138], [10.5, -135.6], [10.5, -134.4], [10.5, -131], [0, -128]], { maxT: 20 });
  T.check('철교: 물길 계단으로 철교 앞 역에 돌아옴', back);
  const under = run(fresh(7), [0, -1.6, -145], [[0, -149.5], [0, -158]], { maxT: 8 });
  T.check('철교: 아래 물길에서 도착역으로 바로 올라가지 못함', { ok: !under.ok, why: under.why || 'climbed' });
}

// ─── 전 구간: 네 조합 모두 걸어서 완주 (터널 맞게, 철교 맞는 칸) + 별 ───
for (const place of STORY_CHOICES.places) for (const event of STORY_CHOICES.events) {
  const m = fresh(9);
  const r1 = run(m, [0, 1, 4], [[place.x, -18], [place.x, -28], [place.x, -33], [0, -44], ...tunnelTargets(m.level, -1, place.word),
    [0, -103], [event.x, -108], [event.x, -118], [event.x, -122], [0, -126]], { maxT: 120 });
  const r2 = r1.ok ? crossBridge(m, 2) : r1;
  const r3 = r2.ok ? run(m, [0, 1, -152], [[0, -167]], { maxT: 10 }) : r2;
  const label = `${place.phrase} → ${event.phrase}`;
  T.check(`${label}: 걸어서 완주 (약 170m)`, {
    ok: r3.ok && m.level.finished && m.level.story.place === place.id && m.level.story.event === event.id,
    why: r1.why || r2.why || r3.why || `place=${m.level.story.place} event=${m.level.story.event} finish=${m.level.finished}`,
  });
  T.check(`${label}: 선택한 이야기만 보임`, {
    ok: m.level.storyScenes.endings[`${place.id}:${event.id}`].visible
      && Object.values(m.level.storyScenes.endings).filter((board) => board.visible).length === 1, why: '',
  });
  T.check(`${label}: 터널·철교를 실수 없이 지나면 두 별이 나타남`, { ok: m.level.tunnels.star.mesh.position.y > 0 && m.level.orderBridge.star.mesh.position.y > 0, why: '' });
}
{
  const m = fresh(9);
  const r = run(m, [0, 1, 4], [[-5, -18], [-5, -28], [-5, -33], [0, -44], ...tunnelTargets(m.level, 2, '숲'), [0, -97]], { maxT: 120 });
  T.check('터널: 한 번 막다른 굴에 들어가도 되돌아 나와 지나감, 별은 없음', { ok: r.ok && m.level.tunnels.wrongEntries === 1 && m.level.tunnels.star.mesh.position.y < -100, why: r.why || String(m.level.tunnels.wrongEntries) });
}
T.report();
