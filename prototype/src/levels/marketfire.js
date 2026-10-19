// docs/63 + docs/66. Fictional market model; state is local to each student.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel } from './kit.js';
import { CAUSES, CAUSE_NAMES, OBJECTS, SITE_IDS, SITE_NAMES, makeCase, interpret } from './marketfire-evidence.js';

export const METHODS = ['water', 'cover', 'clear'];
export const METHOD_NAMES = { water: '물로 식히기', cover: '젖은 멍석 덮기', clear: '탈 물질 치우기' };
export const MATCH = { heat: 'water', fuel: 'clear', air: 'cover' };
export const POINTS = {
  sites: { warehouse: [-27, 3], smithy: [27, 3], inn: [0, 21] },
  cause: CAUSES.map((id, i) => ({ id, x: (i - 1) * 5, z: -6 })),
  objects: OBJECTS.map((o, i) => ({ id: o.id, x: (i - 2.5) * 3, z: -12 })),
  submit: [0, -17], methods: METHODS.map((id, i) => ({ id, x: (i - 1) * 6, z: -25 })),
  sources: { water: [-11, -29], cover: [0, -29], clear: [11, -29] },
  work: [[0, -35], [0, -47], [0, -59]], finish: [0, -77],
  stars: [[-35, 12], [35, 12]],
};

function board(root, x, y, z, width, rows = 5) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = rows * 68;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * canvas.height / canvas.width), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  mesh.position.set(x, y, z); root.add(mesh);
  return { mesh, lines: [], set(lines) {
    this.lines = [...lines]; g.fillStyle = '#fff8e7'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    lines.slice(0, rows).forEach((line, i) => { g.fillStyle = i === 0 ? '#74402f' : '#253b3a'; g.font = `bold ${i === 0 ? 40 : 32}px "Malgun Gothic", sans-serif`; g.fillText(line, 20, 34 + i * 68, 984); });
    texture.needsUpdate = true;
  } };
}

export function buildMarketFire(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world);
  const kit = makeKit(level);
  const { platform, block, sign, startCheckpoint, checkpoint, challengeStar, mat } = kit;
  level.spawn.set(0, 0.02, 8); startCheckpoint('조사 본부');
  level.sky = { background: 0xf9dfb5, fog: [0xf9dfb5, 100, 200] };
  level.sectionAt = (z) => z < -69 ? '다시 열린 시장' : z < -21 ? '불씨 골목 복구' : '시장 마을 조사';
  const state = { cards: [], conclusion: { cause: null, object: null }, submitted: false, method: null, charges: 0, repaired: [false, false, false], contradictions: [], history: [], finished: false };
  level.marketfire = state;
  state.points = POINTS;
  platform(0, 0, 4, 80, 52, 0xd3bd95);
  platform(0, 0, -49, 32, 66, 0xc4aa87);
  // High side walls physically prevent jumping past evidence entry or repair operations.
  for (const x of [-16.5, 16.5]) block(x, 10, -50, 1, 12, 66, 0x8f7160);
  block(0, 10, -82, 34, 12, 1, 0x8f7160);
  const entry = block(0, 10, -21, 32, 12, 0.8, 0x9a7660);
  const fireWalls = POINTS.work.map(([, z]) => block(0, 9, z - 3, 32, 11, 0.8, 0xd9a384));
  const setWall = (mesh, closed) => { mesh.visible = closed; mesh.userData.collider.enabled = closed; };
  const pads = [];
  function pad(x, z, color, action, name) {
    const mesh = platform(x, 0.12, z, 2.3, 2.3, color, { thick: 0.12 });
    const p = { mesh, x, z, armed: true, name };
    pads.push(p);
    mesh.userData.collider.onStand = (player) => {
      if (!p.armed || player.ground !== mesh.userData.collider) return;
      p.armed = false; action(player);
    };
    return p;
  }
  const evidenceBoard = board(level.root, 0, 4.2, -3.8, 13, 7);
  const cardBoard = board(level.root, -13, 6.5, -3.8, 10, 9);
  const recoveryBoard = board(level.root, 0, 7, -24, 15, 5);
  state.boards = { evidenceBoard, cardBoard, recoveryBoard };
  // A readable local notebook complements world signs. It is removed with this map.
  // Headless harness has no DOM body; gameplay rules never depend on this panel.
  let notebook = null;
  if (typeof document.body?.appendChild === 'function') {
    const toggle = document.createElement('button'); toggle.textContent = '증거 수첩';
    toggle.style.cssText = 'position:fixed;left:16px;top:82px;z-index:15;padding:10px 16px;border:2px solid #8f7160;border-radius:12px;background:#fff8e7;font-weight:bold;color:#49372c;display:none';
    const panel = document.createElement('aside'); panel.setAttribute('aria-label', '시장 마을 증거 수첩');
    panel.style.cssText = 'position:fixed;left:16px;top:128px;z-index:15;width:min(380px,calc(100vw - 32px));max-height:46vh;overflow:auto;padding:16px;box-sizing:border-box;border:2px solid #8f7160;border-radius:14px;background:#fff8e7;color:#253b3a;font:16px/1.6 sans-serif;display:none';
    const heading = document.createElement('strong'), close = document.createElement('button'), select = document.createElement('select'), text = document.createElement('div');
    close.textContent = '닫기'; close.style.cssText = 'float:right;padding:4px 10px;margin-left:8px';
    select.setAttribute('aria-label', '모은 증거 고르기'); select.style.cssText = 'display:block;width:100%;margin:12px 0;padding:8px;font:inherit';
    text.style.whiteSpace = 'pre-line'; panel.append(heading, close, select, text); document.body.append(toggle, panel);
    const show = (id) => { const card = state.cards.find((c) => c.id === id) || state.cards.at(-1); if (!card) return; select.value = card.id; heading.textContent = card.title; text.textContent = card.lines.join('\n\n'); panel.style.display = 'block'; };
    toggle.addEventListener('click', () => panel.style.display === 'none' ? show(select.value) : panel.style.display = 'none');
    close.addEventListener('click', () => { panel.style.display = 'none'; }); select.addEventListener('change', () => show(select.value));
    notebook = { refresh() { const selected = select.value; select.replaceChildren(); state.cards.forEach((c) => { const option = document.createElement('option'); option.value = c.id; option.textContent = c.title; select.append(option); }); select.value = selected; toggle.textContent = `증거 수첩 (${state.cards.length}장)`; toggle.style.display = state.cards.length ? 'block' : 'none'; if (!state.cards.length) panel.style.display = 'none'; }, show, dispose() { toggle.remove(); panel.remove(); } };
  }
  sign('창고 ←', -9, 1.8, 4, { width: 4 });
  sign('대장간 →', 9, 1.8, 4, { width: 4 });
  sign('객주 · 뒤쪽', 5, 1.8, 10, { width: 3.6 });
  for (const [x, z, sx, sz] of [[-15, 5, 20, 1.4], [15, 5, 20, 1.4], [0, 16, 1.4, 12]]) {
    const trail = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.02, sz), mat(0xbba075)); trail.position.set(x, 0.015, z); level.root.add(trail);
  }
  function refresh() {
    notebook?.refresh();
    const result = interpret(state.cards);
    // No correct-answer reveal. Reference the observed cards that contradict a chosen field.
    const conflicts = [];
    if (result.candidates.length < OBJECTS.length && state.conclusion.object && !result.candidates.some((o) => o.id === state.conclusion.object)) conflicts.push('물체');
    if (result.candidates.length < OBJECTS.length && state.conclusion.cause && !result.candidates.some((o) => o.cause === state.conclusion.cause)) conflicts.push('주원인');
    state.contradictions = conflicts.length ? state.cards.filter((c) => c.kind !== 'witness').map((c) => c.id) : [];
    evidenceBoard.set([
      '시장 마을 불씨 조사단 · 옛 시장 마을 모형',
      `서로 다른 카드 ${state.cards.length}장 · ${new Set(state.cards.map((c) => c.kind)).size}종류 (입장: 3장·2종류)`,
      `주원인: ${CAUSE_NAMES[state.conclusion.cause] || '아직 고르지 않음'}`,
      `물체: ${OBJECTS.find((o) => o.id === state.conclusion.object)?.name || '아직 고르지 않음'}`,
      conflicts.length ? `${conflicts.join('·')} 칸 ↔ ${state.cards.filter((c) => c.kind === 'trace').map((c) => SITE_NAMES[c.site]).join('·')} 흔적 / 당일 장부와 충돌` : '흔적의 두 표식을 다른 장소의 흔적·장부와 비교해요.',
      result.contradictions.length ? `${result.contradictions[0].person}의 말 ↔ 당일 장부의 오후 반입 기록` : '객주의 말은 본 시간과 장부의 반입 시간을 비교해요.',
      '아래에서 두 칸 선택 → 제출. 틀려도 복구에 들어가요.',
    ]);
    cardBoard.set(['모은 증거 · 현장에서 자세히 읽어요', ...state.cards.slice(-8).map((c) => `✓ ${c.title}`)]);
    recoveryBoard.set([
      '세 방법 모두 연소 조건 하나를 없애요.',
      `선택: ${METHOD_NAMES[state.method] || '아래에서 도구를 골라요'} · 남은 작업 ${state.charges}곳`,
      '물: 온도 낮추기 / 멍석: 산소 차단 / 치우기: 탈 물질 제거',
      '현장 도구 크기·배치에 따라 왕복이 달라지는 게임 모형이에요.',
      '불씨는 안전한 모형. 돌아서 본부에서 결론을 바꿔도 돼요.',
    ]);
  }
  const siteBoards = {};
  for (const site of SITE_IDS) {
    const [x, z] = POINTS.sites[site];
    sign(SITE_NAMES[site], x, 8, z - 3, { width: 13 });
    siteBoards[site] = [];
    ['trace', 'ledger', 'witness'].forEach((kind, i) => {
      const px = x + (i - 1) * 5;
      const b = board(level.root, px, kind === 'ledger' ? 4.6 : 4, z - 1.8, 4.8, kind === 'ledger' ? 9 : 5);
      siteBoards[site].push(b);
      pad(px, z, [0x9fbbb5, 0xe6c576, 0xe7b7b0][i], () => {
        const card = state.event.cards.find((c) => c.site === site && c.kind === kind);
        if (!state.cards.some((c) => c.id === card.id)) { state.cards.push(card); refresh(); }
        notebook?.show(card.id);
        level.onMessage?.(`${card.title}: ${card.lines.join(' ')} 본부에 카드가 남아요.`, true);
      }, `${site}-${kind}`);
    });
    // Decorative model buildings do not collide with walking routes or alter collider scales.
    const houseZ = z + (site === 'inn' ? 7 : -6);
    const house = new THREE.Mesh(new THREE.BoxGeometry(11, 4, 3), mat(0xb28765)); house.position.set(x, 2, houseZ); level.root.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 2.5, 4), mat(0x526b6e)); roof.rotation.y = Math.PI / 4; roof.position.set(x, 5, houseZ); level.root.add(roof);
    const ash = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), mat(0x363a3c)); ash.position.set(x - 5, 0.7, z + 2); level.root.add(ash);
    const wood = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.6), mat(0x986d40)); wood.position.set(x, 0.4, z + 2); level.root.add(wood);
  }
  POINTS.cause.forEach((p) => { pad(p.x, p.z, 0xb8c997, () => { state.conclusion.cause = p.id; refresh(); }, `cause-${p.id}`); sign(CAUSE_NAMES[p.id], p.x, 2.3, p.z + 0.5, { width: 3.6 }); });
  POINTS.objects.forEach((p) => { pad(p.x, p.z, 0xc2b4db, () => { state.conclusion.object = p.id; refresh(); }, `object-${p.id}`); sign(OBJECTS.find((o) => o.id === p.id).name, p.x, 2.5, p.z + 0.5, { width: 2.8 }); });
  pad(...POINTS.submit, 0x91c1b4, () => {
    if (state.cards.length < 3 || new Set(state.cards.map((c) => c.kind)).size < 2) { level.onMessage?.('증거 카드 3장·2종류를 모아 주세요. 같은 카드는 중복되지 않아요.', false); return; }
    if (!state.conclusion.cause || !state.conclusion.object) { level.onMessage?.('주원인과 물체, 두 칸을 먼저 골라 주세요.', false); return; }
    state.submitted = true; state.history.push({ ...state.conclusion, conflicts: [...state.contradictions] }); setWall(entry, false); refresh();
    level.onMessage?.('결론을 기록했어요. 아래 도구를 직접 골라 복구해요. 다시 돌아와 바꿔도 돼요.', true);
  }, 'submit');
  sign('결론 제출 · 틀려도 입장 가능', 0, 3.2, -17.8, { width: 8 });
  POINTS.methods.forEach((p) => {
    pad(p.x, p.z, { water: 0x88cbe0, cover: 0xb5c49c, clear: 0xddb47d }[p.id], () => {
      if (!state.submitted) return;
      state.method = p.id; state.charges = 0; refresh(); level.onMessage?.(`${METHOD_NAMES[p.id]} 선택. 앞의 도구 보급 위치로 가요.`, true);
    }, `method-${p.id}`);
    sign(METHOD_NAMES[p.id], p.x, 2.7, p.z + 0.5, { width: 5 });
  });
  const sourceBoards = {};
  for (const method of METHODS) {
    const [x, z] = POINTS.sources[method];
    sourceBoards[method] = board(level.root, x, 4, z - 1.8, 7, 3);
    pad(x, z, 0xd1c18e, () => {
      if (!state.submitted || state.method !== method) return;
      state.charges = state.capacity[method]; refresh(); level.onMessage?.(`${state.toolLabels[method]}을 들었어요. 앞의 작업 표식으로 운반해요.`, true);
    }, `source-${method}`);
  }
  const flames = [], effects = [], bundles = [], residuals = [];
  POINTS.work.forEach(([x, z], i) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8), mat(0xffb04b)); flame.position.set(x, 0.8, z - 2.3); level.root.add(flame); flames.push(flame);
    const effect = new THREE.Group(); effect.position.set(x, 0.3, z - 2.3); level.root.add(effect); effects.push(effect);
    const bundle = new THREE.Group(); bundle.position.set(x, 0.4, z - 2.3); level.root.add(bundle); bundles.push(bundle);
    for (let j = -1; j <= 1; j++) { const log = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 2), mat(0x986c40)); log.position.x = j * 0.65; bundle.add(log); }
    const residual = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(0xe7ba71)); residual.position.set(2.4, 0.25, z - 1); level.root.add(residual); residuals.push(residual);
    pad(x, z, 0xe1b580, () => {
      if (!state.submitted || !state.method || state.repaired[i]) return;
      if (state.charges < 1) { level.onMessage?.('도구를 다시 가져오거나 본부로 돌아가 대응을 바꿀 수 있어요.', false); return; }
      state.charges--; state.repaired[i] = true; state.history.push({ point: i, method: state.method });
      setWall(fireWalls[i], false); flame.visible = false;
      bundle.position.x = state.method === 'clear' ? 4 : 0;
      residual.visible = state.method !== MATCH[state.event.cause];
      while (effect.children.length) { const c = effect.children[0]; effect.remove(c); c.geometry?.dispose(); }
      const color = { water: 0x6ccae0, cover: 0x819b62, clear: 0xd0a260 }[state.method];
      const visual = new THREE.Mesh(state.method === 'water' ? new THREE.SphereGeometry(1, 12, 6) : new THREE.BoxGeometry(3, 0.2, 2), mat(color)); visual.scale.y = 0.15; effect.add(visual);
      refresh(); level.onMessage?.(`${i + 1}번째 골목: ${METHOD_NAMES[state.method]}로 불씨가 꺼지고 길이 열렸어요.`, true);
    }, `work-${i}`);
    sign('도구를 운반해 여기서 작업해요', x, 3.5, z + 0.8, { width: 8 });
  });
  // Carried tool is visible on the student's model; it is decorative, with no collision.
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), mat(0x77b8d3)); level.root.add(cargo);
  const cp = platform(-7, 0.08, -32, 3, 3, 0x91b99a, { thick: 0.08 });
  checkpoint(cp, new THREE.Vector3(-7, 0.08, -32), '복구 골목 입구');
  sign('본부 ↑ · 첫 작업에서 돌아가도 안전해요', -7, 3, -31, { width: 8 });
  POINTS.stars.forEach(([x, z]) => challengeStar(x, 0, z));
  pad(...POINTS.finish, 0x8cbd91, () => {
    if (!state.submitted || !state.repaired.every(Boolean) || level.finished) return;
    level.finished = state.finished = true; level.onFinish?.(); level.onMessage?.('세 골목을 복구했어요. 시장이 다시 열렸어요!', true);
  }, 'finish');
  sign('다시 열린 시장 · 별 없이도 완주', 0, 4.5, -79, { width: 13 });
  state.pads = pads;
  state.entry = entry;
  state.fireWalls = fireWalls;
  finalizeLevel(level);
  const baseUpdate = level.update, baseReset = level.resetProgress, baseDispose = level.dispose;
  level.dispose = () => { notebook?.dispose(); baseDispose(); };
  level.update = (t, dt, player) => {
    if (player) {
      for (const p of pads) if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) > 2.3) p.armed = true;
      cargo.visible = state.charges > 0; cargo.position.copy(player.pos).add(new THREE.Vector3(0.7, 1, 0));
      cargo.material = mat({ water: 0x6ccae0, cover: 0x819b62, clear: 0xd0a260 }[state.method] || 0xffffff);
    }
    flames.forEach((f, i) => { f.rotation.y = t + i; });
    baseUpdate(t, dt, player);
  };
  level.resetProgress = () => {
    baseReset();
    Object.assign(state, { cards: [], conclusion: { cause: null, object: null }, submitted: false, method: null, charges: 0, repaired: [false, false, false], contradictions: [], history: [], finished: false });
    state.event = makeCase(level.seed);
    const matched = MATCH[state.event.cause];
    // Physical scene tools, independent of submitted answer. Other tools carry one operation.
    state.capacity = Object.fromEntries(METHODS.map((m) => [m, m === matched ? 3 : 1]));
    state.toolLabels = { water: matched === 'water' ? '연결 수로 물수레 · 세 곳 분량' : '우물 물통 · 한 곳 분량', cover: matched === 'cover' ? '이어진 통로용 긴 젖은 멍석 · 세 곳 분량' : '낱장 젖은 멍석 · 한 곳 분량', clear: matched === 'clear' ? '연결 짚단용 손수레 · 세 곳 분량' : '작은 운반 바구니 · 한 곳 분량' };
    sourceBoards.water.set(['우물 · 온도를 낮춰요', state.toolLabels.water, '우물까지 운반 거리 / 물을 다시 받을 수 있어요']);
    sourceBoards.cover.set(['멍석 보급 · 산소를 차단해요', state.toolLabels.cover, '가벼운 덮개 / 틈마다 설치해요']);
    sourceBoards.clear.set(['치우기 도구 · 탈 물질을 없애요', state.toolLabels.clear, '쌓인 것을 옆으로 옮겨 통로를 내요']);
    SITE_IDS.forEach((s) => state.event.cards.filter((c) => c.site === s).forEach((c, i) => siteBoards[s][i].set([c.title, ...c.lines])));
    pads.forEach((p) => { p.armed = true; });
    setWall(entry, true); fireWalls.forEach((w) => setWall(w, true)); flames.forEach((f) => { f.visible = true; });
    bundles.forEach((b) => { b.position.x = 0; }); residuals.forEach((r) => { r.visible = false; });
    effects.forEach((g) => { while (g.children.length) { const c = g.children[0]; g.remove(c); c.geometry?.dispose(); } });
    cargo.visible = false; refresh();
  };
  level.setSeed = (s) => { level.seed = s >>> 0; level.resetProgress(); };
  level.setSeed(seed);
  return level;
}
