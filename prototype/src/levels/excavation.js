// 유적 발굴 현장: 지표 단서를 읽고, 흙을 파 계단 지름길을 내며, 기록한 유물로 전시 문을 여는 첫 체험 맵.
import * as THREE from 'three';
import { createLevel, finalizeLevel, makeKit } from './kit.js';
import { dynamicSign, rngFor, shuffled } from './variants.js';

export const GRID_SIZE = 4;
export const LAYER_COUNT = 2;
export const SHOVEL_LAYERS = 2;
export const SHOVEL_FRAGMENTS = 3;
export const FRAGILE_COUNT = 1; // 시드마다 금이 간 유물 한 개. 단서판과 표식으로 미리 보인다
// 큰 삽 지름길: 파낸 흙이 두 단 계단이 되어 흙벽을 넘는다. 옆 우회로로도 갈 수 있다.
export const WALL = Object.freeze({ z: -74, depth: 4.4, top: 2.8, halfWidth: 8 });
export const STEP_TOPS = Object.freeze([1.4, 2.8]);
export const STEP_Z = Object.freeze([-65, -69.5]);
export const STEP_DEPTHS = Object.freeze([4.4, 4.6]);
export const BYPASS = Object.freeze({ x: 12.5, z: -74, width: 9, depth: 20 });
// 전시 문: 복원·기록 결과에 따라 문 자리가 옆으로 비껴 간다. 온전하면 곧장, 비어 있으면 돌아서 지난다.
export const GATE_SIDES = Object.freeze([-1, 1, -1]);
export const DOOR_SHIFT = Object.freeze({ whole: 0, unrecorded: 2.5, partial: 4.4, blank: 5.6 });
export const GATE_WALL = Object.freeze({ height: 3.2, depth: 0.8, halfWidth: 7.2 });
export const DISPLAY_WIDTHS = Object.freeze({ whole: 7.2, unrecorded: 5, partial: 3.6, blank: 2.8 });
export const JUMP_DIVE_DISTANCE = 8;
export const TOOLS = Object.freeze(['큰 삽', '모종삽', '붓']);
export const ARTIFACTS = Object.freeze([
  { id: 'pottery', name: '토기', clue: '얇은 그릇 조각이 흩어져 있어요', hue: 0xc87543, layer: 1 },
  { id: 'grain', name: '곡식 항아리', clue: '검게 탄 흙이 모여 있어요', hue: 0xb77b32, layer: 0 },
  { id: 'stone', name: '돌도구', clue: '뾰족한 돌 조각이 보여요', hue: 0x89929b, layer: 1 },
]);

export const Z = Object.freeze({ start: 5, finish: -188, tools: -9, survey: -31, plot: -43, rubble: -66, record: -98, restore: -128, exhibit: -153 });
export const PLOT_X = Object.freeze([-7.5, -2.5, 2.5, 7.5]);
export const CHECKPOINT_Z = Object.freeze([-22, -55, -79, -106, -145, -177]);
const TRIGGER_SIZE = 3.2;
const REARM_DISTANCE = 3.4;

const BASE_COLORS = { dirt: 0x8d6e63, path: 0xd6bd8c, station: 0xf4a261, tool: 0x4d908e };

export function plotLayout(seed) {
  const rand = rngFor(seed, 610);
  const slots = shuffled(rand, [0, 1, 2, 3]);
  const objects = shuffled(rngFor(seed, 611), [...ARTIFACTS]);
  const hiddenType = objects[0].id;
  const hiddenSlot = slots[0];
  const assignments = Array(4).fill(null);
  const fragileIndex = Math.floor(rngFor(seed, 620)() * objects.length);
  objects.forEach((artifact, i) => { assignments[slots[i]] = { ...artifact, depth: artifact.layer + 1, fragile: i === fragileIndex }; });
  return PLOT_X.map((x, i) => {
    const artifact = assignments[i];
    return {
      id: String.fromCharCode(65 + i), x, z: Z.plot + (i % 2 ? 3 : -3),
      artifact, layers: LAYER_COUNT, clue: artifact ? artifact.clue : '흔적이 있어도 유물이 없는 칸일 수 있어요',
      crack: !!artifact?.fragile,
      faint: !!artifact && artifact.id === hiddenType,
      hidden: !!artifact && i === hiddenSlot,
    };
  });
}

export function buildExcavation(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, { seed, sky: { background: 0xc9e6dc, fog: [0xc9e6dc, 75, 220] } });
  const kit = makeKit(level);
  const { platform, block, ramp, sign, startCheckpoint, checkpoint, finishPad, challengeStar } = kit;
  const state = {
    tool: '모종삽', method: null, plots: [], dugCells: [], finds: [], broken: [], records: [], restorations: [], rubble: [], display: [], hiddenSite: null,
  };
  const sections = [
    { name: '① 허가소와 도구 창고', zMax: -18 }, { name: '② 지표 조사 들판', zMax: -59 },
    { name: '③ 발굴 구덩이', zMax: -86 }, { name: '④ 기록 천막', zMax: -112 },
    { name: '⑤ 복원실과 전시 길', zMax: -189 },
  ];
  level.sectionAt = (z) => {
    if (z > -18) return sections[0].name;
    if (z > -59) return sections[1].name;
    if (z > -86) return sections[2].name;
    if (z > -112) return sections[3].name;
    return sections[4].name;
  };
  level.spawn.set(0, 0.08, Z.start);
  startCheckpoint('출발');

  // 193m의 기본 답사로. 흙길은 이 길 옆에 추가되어 발굴한 흙을 다음 이동에서 쓴다.
  platform(0, 0, -5, 16, 22, BASE_COLORS.path);
  platform(0, 0, -25, 20, 20, BASE_COLORS.path);
  platform(0, 0, -44, 22, 20, BASE_COLORS.dirt);
  platform(0, 0, -63, 20, 18, BASE_COLORS.path);
  platform(0, 0, -81, 16, 20, BASE_COLORS.path);
  platform(0, 0, -100, 16, 22, BASE_COLORS.station);
  platform(0, 0, -120, 16, 22, BASE_COLORS.path);
  platform(0, 0, -140, 14, 20, BASE_COLORS.path);
  platform(0, 0, -160, 14, 22, BASE_COLORS.path);
  platform(0, 0, -181, 16, 24, 0x88b04b);
  sign('가상 마을 유적 · 발굴은 허가를 받고 기록하며 해요', 0, 4.2, 1, { width: 12, color: '#8d5524', lines: ['가상 마을 유적', '발굴은 허가를 받고 기록하며 해요'] });
  sign('지층 안내', 0, 4, -17, { width: 8, color: '#6d597a', lines: ['보통 아래층이 더 오래됐어요', '방해받지 않은 지층에서 살펴봐요'] });
  sign('걸으며 지표 흔적을 살펴보고, 어디를 팔지 골라요', 0, 4.5, -27, { width: 10 });
  sign('① 큰 삽 · ② 모종삽 · ③ 붓', 0, 3.8, -3, { width: 8 });

  for (const z of CHECKPOINT_Z) {
    const cpPad = platform(0, 0.12, z, 7, 5, 0x80b918);
    checkpoint(cpPad, new THREE.Vector3(0, 0.08, z), `답사 지점 ${checkpointZLabel(z)}`);
  }

  // 도구는 걷는 선택 발판이다. 변경할 때마다 이득과 감수할 결과를 함께 안내한다.
  const toolPads = [];
  TOOLS.forEach((tool, i) => {
    const x = [-5, 0, 5][i];
    const pad = platform(x, 0.1, Z.tools, 3.4, 3.4, [0xe9c46a, 0x90be6d, 0x577590][i]);
    const label = sign(`${i + 1} ${tool}`, x, 2.8, Z.tools, { width: 3 });
    const entry = { tool, pad, armed: true, label };
    toolPads.push(entry);
    pad.userData.collider.onStand = (player) => {
      if (!entry.armed || player.ground !== pad.userData.collider) return;
      entry.armed = false;
      state.tool = tool;
      level.onMessage?.(`${tool}: ${toolMessage(tool)}`, true);
    };
  });

  const siteVisuals = [];
  const plots = plotLayout(seed);
  for (const plot of plots) {
    // 지층 모양은 장식 자식 메시로 표시해 크기 변경이 충돌 판정을 건드리지 않는다.
    const mound = new THREE.Group();
    mound.position.set(plot.x, 0, plot.z);
    level.root.add(mound);
    const soils = [];
    for (let layer = 0; layer < LAYER_COUNT; layer++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.22, 1.25), new THREE.MeshStandardMaterial({ color: layer === 0 ? 0xb08968 : 0x6f4e37 }));
      slab.position.set(0, 0.13 + layer * 0.23, 0.25);
      mound.add(slab);
      soils.push(slab);
    }
    const cueColor = plot.artifact?.hue ?? 0x9c8b78;
    const cue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.13, 0.45), new THREE.MeshStandardMaterial({ color: cueColor }));
    cue.position.set(0, 0.37, -0.55);
    mound.add(cue);
    const crackMark = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.07), new THREE.MeshStandardMaterial({ color: 0x3b2a20 }));
    crackMark.position.set(0, 0.45, -0.55);
    crackMark.rotation.y = 0.6;
    crackMark.visible = false;
    mound.add(crackMark);
    const clueBoard = dynamicSign(level.root, { x: plot.x, y: 2.9, z: plot.z + 1.4, width: 3.4, rows: 3, color: '#6a4c93' });
    clueBoard.set([`${plot.id} 구덩이`, plot.clue, '']);
    const pad = platform(plot.x, 0.1, plot.z - 1.8, TRIGGER_SIZE, TRIGGER_SIZE, 0xb08968);
    const deepPad = platform(plot.x, 0.1, plot.z - 5.6, TRIGGER_SIZE, TRIGGER_SIZE, 0x987554);
    const p = { ...plot, pad, deepPad, soils, cue, crackMark, clueBoard, dugLayers: 0, found: false, fragments: 0, recorded: false, restored: false, armed: true, deepArmed: true, hitCount: 0 };
    siteVisuals.push(p);
    pad.userData.collider.onStand = (player) => {
      if (!p.armed || player.ground !== pad.userData.collider) return;
      p.armed = false;
      digPlot(p);
    };
    deepPad.userData.collider.onStand = (player) => {
      if (!p.deepArmed || player.ground !== deepPad.userData.collider) return;
      p.deepArmed = false;
      digPlot(p);
    };
  }

  function digPlot(plot) {
    if (plot.dugLayers >= LAYER_COUNT) return;
    if (!state.method) state.method = state.tool;
    plot.hitCount++;
    let layers = 1;
    if (state.tool === '큰 삽') layers = SHOVEL_LAYERS;
    const previous = plot.dugLayers;
    plot.dugLayers = Math.min(LAYER_COUNT, plot.dugLayers + layers);
    const removed = plot.dugLayers - previous;
    for (let i = 0; i < plot.dugLayers; i++) plot.soils[i].visible = false;
    for (let i = previous; i < plot.dugLayers; i++) addRubble(plot, i, state.tool);
    if (!state.dugCells.includes(plot.id)) state.dugCells.push(plot.id);
    if (plot.artifact && !plot.found && plot.dugLayers >= plot.artifact.depth) {
      plot.found = true;
      plot.fragments = 0;
      if (state.tool === '큰 삽') plot.fragments = SHOVEL_FRAGMENTS;
      else if (state.tool === '모종삽' && plot.artifact.fragile) plot.fragments = 1;
      if (plot.fragments) state.broken.push({ plot: plot.id, type: plot.artifact.id, fragments: plot.fragments });
      state.finds.push({ plot: plot.id, type: plot.artifact.id, layer: plot.artifact.layer, fragments: plot.fragments, clue: plot.clue, intact: plot.fragments === 0 });
      level.onMessage?.(plot.fragments ? `${plot.artifact.name} 조각이 더 많이 나왔어요. 복원대에서 맞춰 봐요.` : `${plot.artifact.name}을(를) ${plot.artifact.layer + 1}층 ${plot.id}칸에서 찾았어요.`, !plot.fragments);
    } else if (plot.artifact && plot.dugLayers < plot.artifact.depth) {
      level.onMessage?.('한 층을 더 살펴보세요. 가까운 자리에서 다시 발굴할 수 있어요.', true);
    } else if (!plot.artifact) {
      level.onMessage?.('흔적만 있고 유물은 없었어요. 흙길은 만들어졌어요.', false);
    }
    if (removed) plot.pad.material?.color?.setHex(state.tool === '큰 삽' ? 0xbc6c25 : state.tool === '붓' ? 0xd8b384 : 0xa98467);
    plot.pad.userData.collider.enabled = true;
  }

  const rubbleParts = [];
  // 숨은 흙덩이는 보이지 않고 충돌도 없다. 발굴하면 흙 계단(1.4m → 2.8m)이 되어 흙벽 위로 이어진다.
  const rubbleLaneX = [-6, -2, 2, 6];
  for (let i = 0; i < siteVisuals.length * LAYER_COUNT; i++) {
    const plotIndex = Math.floor(i / LAYER_COUNT);
    const layer = i % LAYER_COUNT;
    const dirt = block(rubbleLaneX[plotIndex], -12, STEP_Z[layer], 3.2, STEP_TOPS[layer], STEP_DEPTHS[layer], BASE_COLORS.dirt, { dynamic: true });
    dirt.visible = false;
    dirt.userData.collider.enabled = false;
    rubbleParts.push(dirt);
  }
  // 흙벽은 길 전체를 막는다. 옆 우회로(기본 길)로 돌아가거나, 파낸 흙 계단으로 넘는 지름길을 낸다.
  block(0, WALL.top, WALL.z, WALL.halfWidth * 2, WALL.top, WALL.depth, 0x7a5c45);
  platform(BYPASS.x, 0, BYPASS.z, BYPASS.width, BYPASS.depth, BASE_COLORS.path);
  sign('흙벽이에요. 옆 우회로로 돌아가거나, 파낸 흙 계단으로 넘어가요', 0, 5.4, -61, { width: 11, color: '#6d4c41' });
  sign('우회로', BYPASS.x, 3, -64, { width: 3 });
  function addRubble(plot, layer, tool) {
    const plotIndex = siteVisuals.indexOf(plot);
    const part = rubbleParts[plotIndex * LAYER_COUNT + layer];
    part.visible = true;
    part.userData.collider.enabled = true;
    const width = tool === '큰 삽' ? 4.4 : tool === '붓' ? 2.8 : 3.6;
    part.scale.x = width / 3.2;
    part.position.set(rubbleLaneX[plotIndex], STEP_TOPS[layer] / 2, STEP_Z[layer]);
    part.updateMatrixWorld(true);
    part.userData.collider.sync(true);
    state.rubble.push({ plot: plot.id, layer, tool, mesh: part, width });
  }
  const undoPad = platform(9, 0.1, -56, 3.2, 3.2, 0xadb5bd);
  let undoArmed = true;
  sign('빈 칸이면 덮고 다른 칸을 살펴봐요', 9, 2.8, -54.2, { width: 4.2 });
  undoPad.userData.collider.onStand = (player) => {
    if (!undoArmed || player.ground !== undoPad.userData.collider) return;
    undoArmed = false;
    const plot = [...siteVisuals].reverse().find((p) => p.dugLayers > 0 && !p.artifact);
    if (!plot) { level.onMessage?.('덮을 빈 구덩이가 없어요. 다른 단서를 살펴봐요.', false); return; }
    plot.dugLayers = 0; plot.hitCount = 0; plot.armed = true; plot.deepArmed = true;
    plot.soils.forEach((m) => { m.visible = true; });
    plot.pad.material.color.setHex(0xb08968);
    for (const dirt of state.rubble.filter((r) => r.plot === plot.id)) { dirt.mesh.visible = false; dirt.mesh.userData.collider.enabled = false; }
    state.rubble = state.rubble.filter((r) => r.plot !== plot.id);
    state.dugCells = state.dugCells.filter((id) => id !== plot.id);
    level.onMessage?.(`${plot.id} 빈 구덩이를 덮었어요. 다른 칸을 살펴봐요.`, true);
  };

  // 기록은 유물 이름과 나온 층·칸을 스스로 확인해 해당 기록판까지 걸어가면 남는다.
  const recordPads = [];
  ARTIFACTS.forEach((artifact, i) => {
    const x = [-5, 0, 5][i];
    const pad = platform(x, 0.1, Z.record, 3.4, 3.4, artifact.hue);
    sign(`${artifact.name} 기록`, x, 2.8, Z.record, { width: 3.6, color: '#355070', lines: [`${artifact.name} 기록`, '층과 칸을 표시해요'] });
    const entry = { artifact, pad, armed: true };
    recordPads.push(entry);
    pad.userData.collider.onStand = (player) => {
      if (!entry.armed || player.ground !== pad.userData.collider) return;
      entry.armed = false;
      const find = state.finds.find((f) => f.type === artifact.id);
      if (!find) { level.onMessage?.('아직 찾지 못한 유물의 기록판이에요.', false); return; }
      const plot = siteVisuals.find((p) => p.id === find.plot);
      find.recorded = true;
      plot.recorded = true;
      if (!state.records.some((r) => r.type === artifact.id)) state.records.push({ type: artifact.id, plot: plot.id, layer: find.layer, correct: true });
      const existingRestore = state.restorations.find((r) => r.type === artifact.id);
      if (existingRestore) existingRestore.recorded = true;
      updateDisplay();
      level.onMessage?.(`${artifact.name}: ${find.layer + 1}층 ${plot.id}칸으로 기록했어요.`, true);
    };
  });
  sign('유물은 나온 층과 칸을 함께 기록해야 전시에 설명을 붙일 수 있어요.', 0, 4.3, -92, { width: 9 });

  const restorePads = [];
  ARTIFACTS.forEach((artifact, i) => {
    const x = [-5, 0, 5][i];
    const pad = platform(x, 0.1, Z.restore, 3.4, 3.4, 0xdda15e);
    sign(`${artifact.name} 맞추기`, x, 2.8, Z.restore, { width: 3.4 });
    const entry = { artifact, pad, armed: true };
    restorePads.push(entry);
    pad.userData.collider.onStand = (player) => {
      if (!entry.armed || player.ground !== pad.userData.collider) return;
      entry.armed = false;
      const find = state.finds.find((f) => f.type === artifact.id);
      if (!find) { level.onMessage?.('발굴한 조각이 아직 없어요. 빈 전시대는 지나갈 수 있어요.', false); return; }
      const plot = siteVisuals.find((p) => p.id === find.plot);
      find.restored = true;
      plot.restored = true;
      if (!state.restorations.some((r) => r.type === artifact.id)) state.restorations.push({ type: artifact.id, plot: plot.id, result: find.fragments ? 'partial' : 'whole', recorded: !!find.recorded });
      updateDisplay();
      level.onMessage?.(find.fragments ? `${artifact.name}: 남은 조각으로 좁은 전시대를 만들었어요.` : `${artifact.name}: 온전한 전시대와 설명 자리가 생겼어요.`, !find.fragments);
    };
  });
  sign('온전한 유물은 넓은 받침, 조각이 남은 유물은 좁은 받침이 돼요.', 0, 4.2, -116, { width: 9 });

  // 전시 문: 문 자리가 결과에 따라 옆으로 비껴 간다(온전하면 곧장, 비어 있으면 돌아서). 모두 걸어서 지날 수 있고 떨어지지 않는다.
  const displayOrder = [...ARTIFACTS].sort((a, b) => a.layer - b.layer);
  const MODES = ['whole', 'unrecorded', 'partial', 'blank'];
  const wallColor = 0xb8a58c;
  const doorX = (index, mode) => GATE_SIDES[index] * DOOR_SHIFT[mode];
  const displaySpecs = displayOrder.map((a, i) => ({ artifact: a, index: i, z: Z.exhibit - i * 7, options: [] }));
  for (const spec of displaySpecs) {
    for (const mode of MODES) {
      const width = DISPLAY_WIDTHS[mode];
      const cx = doorX(spec.index, mode);
      const slab = platform(cx, 0.1, spec.z, width, 6, mode === 'partial' ? 0xc9a27e : mode === 'blank' ? 0xbdbdbd : spec.artifact.hue);
      const walls = [];
      const edges = [[-GATE_WALL.halfWidth, cx - width / 2], [cx + width / 2, GATE_WALL.halfWidth]];
      for (const [a, b] of edges) {
        if (b - a < 0.3) continue;
        const wall = block((a + b) / 2, GATE_WALL.height, spec.z, b - a, GATE_WALL.height, GATE_WALL.depth, wallColor);
        walls.push(wall);
      }
      for (const m of [slab, ...walls]) { m.visible = false; m.userData.collider.enabled = false; }
      spec.options.push({ mesh: slab, walls, width, mode, doorX: cx });
    }
    spec.sign = dynamicSign(level.root, { x: 0, y: 4.6, z: spec.z - 0.6, width: 4.4, rows: 2, color: '#6a4c93' });
  }
  // 바닥은 이어져 있고, 전시 문의 자리만 결과에 따라 달라진다.
  platform(0, 0, -143, 14, 18, 0x9aa0a6);
  platform(0, 0, -178, 14, 18, 0x88b04b);
  function updateDisplay() {
    state.display = [];
    displaySpecs.forEach((spec) => {
      const find = state.finds.find((f) => f.type === spec.artifact.id);
      const restoration = state.restorations.find((r) => r.type === spec.artifact.id);
      const mode = !restoration ? 'blank' : restoration.result === 'partial' ? 'partial' : restoration.recorded ? 'whole' : 'unrecorded';
      for (const o of spec.options) {
        const enabled = o.mode === mode;
        for (const m of [o.mesh, ...o.walls]) { m.visible = enabled; m.userData.collider.enabled = enabled; }
      }
      spec.sign.mesh.visible = true;
      spec.sign.set(find && restoration ? [`${spec.artifact.name} · ${find.layer + 1}층`, restoration.recorded ? '자리 기록 있음 · 문이 곧장 열려요' : '자리 기록 없음'] : ['빈 전시 문', '발굴하지 않아 문이 옆으로 비껴 있어요']);
      state.display.push({ type: spec.artifact.id, width: DISPLAY_WIDTHS[mode], mode, doorX: doorX(spec.index, mode), gateZ: spec.z, recorded: !!restoration?.recorded, layer: find?.layer ?? null });
    });
  }
  updateDisplay();

  // 별은 서로 다른 첫 발굴 방식에 묶는다. 한 번의 답사에서 세 방식의 별을 모두 켤 수 없다.
  const starSpecs = [
    { x: -11, y: 0, z: -135, mode: 'perfect', name: '붓으로 온전 발굴' },
    { x: -11, y: 0, z: -145, mode: 'hidden', name: '희미한 단서 구덩이' },
    { x: 11, y: 0, z: -135, mode: 'records', name: '층·칸 기록' },
    { x: 0, y: WALL.top, z: WALL.z, mode: 'shovel', name: '큰 삽 흙 계단 지름길 별' },
  ];
  const starChallenges = starSpecs.map((s) => {
    // 흙벽 위 별은 벽 윗면이 곧 발판이다. 다른 별은 별 섬을 따로 둔다.
    const island = s.mode === 'shovel' ? null : platform(s.x, 0.1, s.z, 3.2, 3.2, 0xffe066);
    if (island) island.userData.collider.enabled = false;
    const priorColliderCount = world.colliders.length;
    challengeStar(s.x, s.y, s.z);
    world.colliders[priorColliderCount].enabled = false;
    const star = level.stars.at(-1);
    star.mesh.position.set(s.x, -1000, s.z);
    star.mesh.visible = false;
    return { ...s, island, star, shown: false };
  });
  function revealStar(mode) {
    const spec = starChallenges.find((s) => s.mode === mode);
    if (!spec || spec.shown || state.method !== spec.methodTool) return;
    spec.shown = true;
    if (spec.island) spec.island.userData.collider.enabled = true;
    spec.star.mesh.position.set(spec.x, spec.y + 1.5, spec.z);
    spec.star.mesh.visible = true;
  }
  starChallenges[0].methodTool = '붓';
  starChallenges[1].methodTool = '모종삽';
  starChallenges[2].methodTool = '모종삽';
  starChallenges[3].methodTool = '큰 삽';

  platform(0, 0, Z.finish, 18, 12, 0xffd166);
  sign('답사 완료!', 0, 4, Z.finish + 2, { width: 5, color: '#2a9d8f' });
  const finish = platform(0, 0, Z.finish - 2, 18, 8, 0x2a9d8f);
  finishPad(finish, Z.finish);

  function updateInteractionState(player) {
    if (!player) return;
    const rearm = (entry) => {
      if (!entry.armed && Math.hypot(player.pos.x - entry.pad.position.x, player.pos.z - entry.pad.position.z) >= REARM_DISTANCE) entry.armed = true;
    };
    for (const entry of [...toolPads, ...siteVisuals, ...recordPads, ...restorePads]) rearm(entry);
    if (!undoArmed && Math.hypot(player.pos.x - undoPad.position.x, player.pos.z - undoPad.position.z) >= REARM_DISTANCE) undoArmed = true;
    if (state.rubble.some((r) => r.mesh.userData.collider === player.ground)) state.rubbleWalked = true;
    updateChallenges();
  }

  function updateChallenges() {
    if (state.method === '붓' && state.finds.length === ARTIFACTS.length && state.finds.every((f) => f.fragments === 0)) revealStar('perfect');
    if (state.method === '모종삽' && state.plots.find((p) => p.hidden)?.dugLayers) revealStar('hidden');
    if (state.method === '모종삽' && state.records.length === ARTIFACTS.length) revealStar('records');
    if (state.method === '큰 삽' && state.rubble.length >= SHOVEL_LAYERS) revealStar('shovel');
  }

  function clearState() {
    Object.assign(state, { tool: '모종삽', method: null, dugCells: [], finds: [], broken: [], records: [], restorations: [], rubble: [], display: [], rubbleWalked: false });
    for (const p of siteVisuals) {
      p.dugLayers = 0; p.found = false; p.fragments = 0; p.recorded = false; p.restored = false; p.armed = true; p.deepArmed = true; p.hitCount = 0;
      p.soils.forEach((m) => { m.visible = true; });
      p.pad.material?.color?.setHex(0xb08968);
    }
    rubbleParts.forEach((m) => { m.visible = false; m.userData.collider.enabled = false; m.position.set(0, -12, -63); });
    for (const entry of [...toolPads, ...recordPads, ...restorePads]) entry.armed = true;
    undoArmed = true;
    state.rubble = [];
    state.plots = siteVisuals;
    updateDisplay();
    starChallenges.forEach((s) => { s.shown = false; if (s.island) s.island.userData.collider.enabled = false; s.star.mesh.position.set(s.x, -1000, s.z); s.star.mesh.visible = false; });
  }
  function applyLayout(nextSeed) {
    const layout = plotLayout(nextSeed);
    state.plots = siteVisuals;
    state.hiddenSite = layout.find((p) => p.hidden)?.id ?? null;
    layout.forEach((next, i) => {
      const old = siteVisuals[i];
      old.artifact = next.artifact; old.clue = next.clue; old.hidden = next.hidden; old.faint = next.faint; old.crack = next.crack;
      old.cue.material.color.setHex(next.artifact?.hue ?? 0x9c8b78);
      old.crackMark.visible = !!next.crack;
      old.clueBoard.set([`${old.id} 구덩이`, `${next.faint ? '희미한 흔적: ' : ''}${next.clue}`, next.crack ? '금이 간 조각이 보여요' : ''], next.hidden ? '#9b5de5' : '#6a4c93');
      old.soils.forEach((m, layer) => { m.material.color.setHex(layer === 0 ? (next.artifact?.hue ?? 0xb08968) : 0x6f4e37); });
      const cells = level.excavation?.cells;
      if (cells) {
        for (let layer = 0; layer < LAYER_COUNT; layer++) {
          const cell = cells[i * LAYER_COUNT + layer];
          cell.hasArtifact = !!next.artifact && layer === next.artifact.layer;
          cell.artifact = next.artifact?.id ?? null;
          cell.clue = next.clue;
        }
      }
    });
  }
  level.excavation = state;
  level.excavation.constants = { GRID_SIZE, LAYER_COUNT, SHOVEL_LAYERS, SHOVEL_FRAGMENTS, FRAGILE_COUNT, DISPLAY_WIDTHS, DOOR_SHIFT, GATE_SIDES, WALL, STEP_TOPS, BYPASS, JUMP_DIVE_DISTANCE };
  level.excavation.sites = siteVisuals;
  level.excavation.tools = TOOLS;
  level.excavation.displayMeshes = displaySpecs.map((d) => d.options.map((o) => ({ mesh: o.mesh, collider: o.mesh.userData.collider, walls: o.walls })));
  level.excavation.cells = siteVisuals.flatMap((p) => Array.from({ length: LAYER_COUNT }, (_, layer) => ({ site: p.id, layer, hasArtifact: !!p.artifact && layer === p.artifact.layer, artifact: p.artifact?.id ?? null, clue: p.clue })));
  level.excavation.starChallenges = starChallenges;
  level.excavation.soilBlocks = rubbleParts.map((mesh) => ({ mesh, collider: mesh.userData.collider }));
  level.excavation.gates = displaySpecs.map((d) => ({ z: d.z, side: GATE_SIDES[d.index], options: d.options }));
  function resetExcavation() {
    level.finished = false;
    level.stars.forEach((s) => { s.got = false; s.mesh.visible = false; });
    level.checkpoints.forEach((cp) => { cp.reached = cp.index === 0; cp.flag?.material.color.setHex(cp.reached ? 0x2ec4b6 : 0xcccccc); });
    clearState();
  }
  function setExcavationSeed(nextSeed) {
    level.seed = nextSeed;
    applyLayout(nextSeed);
    resetExcavation();
  }
  level.resetProgress = resetExcavation;
  level.setSeed = setExcavationSeed;
  level.updateTool = (tool) => { if (TOOLS.includes(tool)) state.tool = tool; };
  level.updateDisplay = updateDisplay;
  applyLayout(seed);
  clearState();
  const ready = finalizeLevel(level);
  const baseUpdate = ready.update;
  ready.update = (t, dt, player) => { baseUpdate(t, dt, player); updateInteractionState(player); };
  ready.resetProgress = resetExcavation;
  ready.setSeed = setExcavationSeed;
  ready.updateTool = level.updateTool;
  return ready;
}

function checkpointZLabel(z) { return `${Math.round(Math.abs(z))}m`; }
function toolMessage(tool) {
  if (tool === '큰 삽') return '두 층을 한 번에 걷고 흙길이 넓어져요. 유물이 있으면 조각이 더 생겨요.';
  if (tool === '붓') return '얇게 살펴 온전하게 드러내요. 깊은 칸은 다시 살펴야 해요.';
  return '한 층씩 살펴요. 깊은 칸은 다시 밟고, 일부 흔적은 상할 수 있어요.';
}
