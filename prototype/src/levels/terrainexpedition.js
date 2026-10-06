// 등고선 지형 탐험대: 지형도를 들고 구역을 자유 순서로 답사하는 고정 지도 첫 체험 맵.
import * as THREE from 'three';
import { createLevel, finalizeLevel, makeKit } from './kit.js';
import { dynamicSign } from './variants.js';

export const ZONES = Object.freeze({ hub: [0, 0], mountain: [32, 0], river: [0, -32], plain: [-18, -24], westCoast: [-32, 0], eastCoast: [43, 10], finish: [0, 0] });
export const CHECKPOINTS = Object.freeze([
  { name: '답사 본부', x: 0, z: 0 }, { name: '동쪽 산지', x: 32, z: 0 },
  { name: '북쪽 하천', x: 0, z: -32 }, { name: '평야 장터', x: -30, z: -24 },
  { name: '서·남쪽 해안', x: -32, z: 0 },
]);
export const MAP_BEARING = Object.freeze({ north: '-z', east: '+x' });
export const STAR_COUNT = 1;
const ROAD = Object.freeze({ step: 2.8, tile: 5.4, width: 7.2 });
const COLORS = Object.freeze({ grass: 0x789b68, path: 0xd6c79b, hub: 0xf4a261, mountain: 0x71845d, river: 0x61a9c2, plain: 0xb8b66c, coast: 0x8db9ad, sea: 0x5597bd, locked: 0x795548, open: 0x8aa65b });

export function buildTerrainExpedition(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, { seed, sky: { background: 0xc5e2ec, fog: [0xc5e2ec, 115, 260] } });
  const kit = makeKit(level);
  const { platform, block, sign, startCheckpoint, checkpoint, challengeStar } = kit;
  const state = {
    surveys: { mountain: false, river: false, plain: false, westCoast: false, eastCoast: false },
    mountainRoute: null, riverCrossing: null, riverEntrySide: null, plainEntry: null, marketSite: null,
    opened: { mountainPlain: false, riverPlain: false, plainCoast: false, returnShortcut: false },
    finished: false,
  };
  level.spawn.set(0, 0.08, 4);
  level.sectionAt = (xOrZ, zMaybe) => {
    const x = zMaybe === undefined ? 0 : xOrZ;
    const z = zMaybe === undefined ? xOrZ : zMaybe;
    if (Math.abs(x) < 9 && Math.abs(z) < 9) return '답사 본부';
    if (x > 16 && z > -18) return '동쪽 산지';
    if (z < -17 && x > -12) return '북쪽 하천';
    if (x < -10 && z < -12) return '평야 장터';
    if (x < -18) return '서·남쪽 해안';
    if (x > 35) return '동쪽 해안 선택 답사';
    return '연결 길';
  };
  startCheckpoint('답사 본부');

  // Banded ground cells form a broad, safe field route. Small height changes show relief without jump-sized steps.
  function path(points, { color = COLORS.path, width = ROAD.width, step = ROAD.step, elevation = null, enabled = true, visible = true, name = '' } = {}) {
    const cells = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1];
      const length = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(length / step));
      for (let j = 0; j <= n; j++) {
        if (i > 0 && j === 0) continue;
        const t = j / n, x = THREE.MathUtils.lerp(ax, bx, t), z = THREE.MathUtils.lerp(az, bz, t);
        const y = elevation ? elevation(x, z) : 0;
        const mesh = platform(x, y, z, width, width, color);
        mesh.visible = visible;
        mesh.userData.collider.enabled = enabled;
        cells.push(mesh);
      }
    }
    cells.name = name;
    return cells;
  }
  function setPath(cells, active) {
    for (const mesh of cells) { mesh.visible = active; mesh.userData.collider.enabled = active; }
  }
  function barrier(x, z, width, height = 3.5) {
    return block(x, height, z, width, height, 0.8, COLORS.locked, { dynamic: true });
  }
  function crossBarrier(x, z, width, height = 3.5) {
    return block(x, height, z, 0.8, height, width, COLORS.locked, { dynamic: true });
  }
  function setBarrier(mesh, open) { mesh.visible = !open; mesh.userData.collider.enabled = !open; }

  // Mainland outline and three direct survey trails from the base. North is -z; east is +x.
  path([[-7, 3], [-14, 4], [-21, 5], [-28, 6], [-33, 7], [-36, 11]], { color: COLORS.path, name: 'base-to-west-coast' });
  path([[-3, -5], [-3, -12], [-2, -20], [-1, -27], [0, -33]], { color: COLORS.path, name: 'base-to-river' });
  path([[6, 0], [14, 0], [22, 0], [30, 0], [34, -2]], { color: COLORS.path, elevation: (x) => Math.min(1.2, Math.max(0, (x - 8) * 0.046)), name: 'base-to-mountain' });
  // Return edge of the circuit. The short return trail becomes available after the required coast survey.
  const returnShortcut = path([[-36, 11], [-29, 18], [-20, 20], [-11, 17], [-4, 10], [0, 5]], { color: COLORS.open, enabled: false, visible: false, name: 'coast-return-shortcut' });
  const returnBarrier = barrier(-4, 10, 8);
  sign('해안 답사 뒤 열리는 본부 지름길 · 선택', -15, 7, 16, { width: 10, color: '#2a6f6a' });

  // Region footprints; the terrain-colored contour strips are decorative children over broad safe ground.
  const hub = platform(0, 0, 0, 22, 22, COLORS.hub);
  const mountainBase = platform(33, 0, -5, 24, 24, COLORS.mountain);
  const riverBase = platform(1, 0, -36, 18, 20, COLORS.river);
  const plainBase = platform(-24, 0, -25, 18, 20, COLORS.plain);
  const westCoastBase = platform(-36, 0, 12, 26, 22, COLORS.coast);
  const seaWest = platform(-48, -0.2, 12, 16, 24, COLORS.sea);
  const eastCoastBase = platform(45, 0, 13, 20, 22, COLORS.coast);
  const seaEast = platform(56, -0.2, 13, 16, 24, COLORS.sea);
  // Elliptical contour marks are child meshes with no collider. Their height bands follow the mountain's gentle rise.
  const contourMaterial = new THREE.MeshStandardMaterial({ color: 0xe9d7a2, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 2.1, 0.12, 5, 48), contourMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(34, 0.18 + i * 0.18, -6);
    ring.scale.set(1.3, 0.75, 1);
    mountainBase.add(ring);
  }
  const riverLine = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x2c7da0 }));
  riverLine.position.set(2, 0.54, -35);
  riverBase.add(riverLine);
  const coastlineLines = [];
  for (let i = 0; i < 4; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 14 - i * 2), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf4e1ad : 0x598f84 }));
    line.position.set(-42 + i * 1.2, 0.56, 12 + (i % 2 ? 2.5 : -2.5));
    westCoastBase.add(line); coastlineLines.push(line);
  }
  for (const [title, x, y, z, width] of [
    ['답사 본부', 0, 5, -8, 9], ['동쪽 산지', 33, 6, -15, 8], ['북쪽 하천', 1, 5, -43, 8],
    ['평야 장터', -19, 5, -35, 8], ['서·남쪽 해안', -36, 5, 22, 9], ['동쪽 해안 · 선택', 45, 5, 24, 9],
  ]) sign(title, x, y, z, { width, color: '#39594b' });

  // The two plain entrances are separate hidden bridges. Each survey result opens only its own approach.
  const mountainApproach = path([[27, -7], [21, -11], [14, -14], [7, -15], [0, -16], [-7, -16], [-14, -16], [-21, -16], [-28, -17], [-30, -19]], { color: COLORS.open, enabled: false, visible: false, name: 'mountain-to-plain' });
  const riverNorthApproach = path([[-7, -23], [-11, -22], [-16, -22], [-22, -22], [-28, -23]], { color: COLORS.open, enabled: false, visible: false, name: 'river-north-to-plain' });
  const riverSouthApproach = path([[-7, -35], [-11, -36], [-16, -37], [-22, -36], [-28, -33]], { color: COLORS.open, enabled: false, visible: false, name: 'river-south-to-plain' });
  const mountainGate = barrier(-22, -16, 12);
  const riverNorthGate = crossBarrier(-12, -22, 8);
  const riverSouthGate = crossBarrier(-13, -36, 10);
  sign('평야 북쪽 입구 · 산지 답사 뒤 열려요', -24, 4.4, -13, { width: 9 });
  sign('평야 강가 입구 · 하천 건넘길 뒤 열려요', -12, 4.4, -37, { width: 9 });

  // East-to-west main river course is represented as a walkable downstream connector and a bridge choice.
  path([[4, -34], [0, -31], [-4, -29], [-8, -28]], { color: 0xa8d9e3, width: 6.8, name: 'river-downstream' });
  path([[-7, -22], [-7, -27], [-7, -32], [-7, -37]], { color: 0xb9d8d2, width: 5.8, name: 'riverbank-survey-walk' });
  const riverChannel = platform(-4, -0.5, -29, 11, 10, COLORS.sea);
  const bridgeNorth = path([[-8, -27], [-9, -24], [-11, -22]], { color: 0xc29c6d, width: 6.4, enabled: false, visible: false, name: 'north-bank-bridge' });
  const bridgeSouth = path([[-8, -31], [-9, -34], [-11, -36]], { color: 0xc29c6d, width: 6.4, enabled: false, visible: false, name: 'south-bank-bridge' });
  const bridgeWallN = barrier(-9, -25.5, 7);
  const bridgeWallS = barrier(-9, -32.5, 7);
  setBarrier(bridgeWallN, true); setBarrier(bridgeWallS, true);

  // Candidate market plots are a fictional route-planning comparison, not a claim about real settlement siting.
  const marketPads = [
    { id: 'river-flat', x: -16, z: -23, label: '강가의 넓은 터', hint: '넓고 평탄해요 · 강가 길이 이어져요', route: 'river' },
    { id: 'terrace', x: -21, z: -30, label: '완만한 언덕 터', hint: '조금 높아요 · 구릉길이 해안에 가까워요', route: 'terrace' },
  ];
  const marketChoice = [];
  let marketReady = false;
  function setMarketChoice(option) {
    if (!marketReady || !option) return;
    state.marketSite = option.id;
    state.surveys.plain = true;
    setPath(plainToCoastRiver, option.route === 'river');
    setPath(plainToCoastTerrace, option.route === 'terrace');
    setPath(plainToRiver, true);
    setBarrier(riverSouthGate, true);
    setBarrier(plainCoastGate, true);
    state.opened.plainCoast = true;
    marketBoard.set([`연결할 터: ${option.label}`, option.hint]);
    checklist();
    level.onMessage?.(`${option.label}을 골랐어요. 선택한 길이 해안 답사로 이어져요. 가까운 표식에서 바꿀 수 있어요.`, true);
  }
  const plainToCoastRiver = path([[-22, -22], [-27, -17], [-31, -11], [-34, -5], [-36, 4]], { color: COLORS.open, enabled: false, visible: false, name: 'plain-to-coast-river' });
  const plainToCoastTerrace = path([[-18, -33], [-23, -28], [-27, -21], [-31, -13], [-34, -5], [-36, 4]], { color: 0xb0a078, enabled: false, visible: false, name: 'plain-to-coast-terrace' });
  const plainToRiver = path([[-21, -31], [-18, -35], [-12, -39], [-6, -42], [-1, -43]], { color: 0xa8d9e3, enabled: false, visible: false, name: 'plain-to-river-downstream' });
  const plainCoastGate = barrier(-34, -5, 10);

  const marketBoard = dynamicSign(level.root, { x: -19, y: 6.2, z: -16, width: 9, rows: 2, color: '#6d597a' });
  marketBoard.set(['장터 자리를 비교해요', '두 곳 모두 가상 답사 경로예요']);
  for (const option of marketPads) {
    const tile = platform(option.x, 0.1, option.z, 4.4, 4.4, option.route === 'river' ? 0x87a96b : 0xc4a77d);
    sign(option.label, option.x, 3.3, option.z - 2.8, { width: 5.2 });
    const entry = { ...option, tile, armed: true };
    marketChoice.push(entry);
    tile.userData.collider.onStand = (player) => {
      if (!entry.armed || player.ground !== tile.userData.collider) return;
      entry.armed = false; setMarketChoice(entry);
    };
  }
  let choiceRepairArmed = true;
  const repairTile = platform(-18, 0.1, -19, 4, 3.8, 0xe0c36d);
  sign('가까운 곳에서 다시 비교할 수 있어요', -18, 3.2, -16.4, { width: 7 });
  repairTile.userData.collider.onStand = (player) => {
    if (!choiceRepairArmed || player.ground !== repairTile.userData.collider) return;
    choiceRepairArmed = false;
    marketChoice.forEach((x) => { x.armed = true; });
    level.onMessage?.('두 터를 다시 살펴보고 다른 연결을 골라도 돼요.', true);
  };

  const mountainPads = [
    { id: 'contour', x: 29, z: -8, label: '완만한 등고선 길', hint: '길지만 경사가 완만해요', gate: 'mountainPlain' },
    { id: 'ridge', x: 37, z: -8, label: '짧은 능선 길', hint: '짧고 전망점에 가까워요', gate: 'mountainPlain' },
  ];
  const mountainChoice = [];
  for (const option of mountainPads) {
    const tile = platform(option.x, 0.16, option.z, 4.6, 4.6, option.id === 'contour' ? 0x9ebc76 : 0x687f58);
    sign(option.label, option.x, 3.3, option.z - 3, { width: 5.5 });
    const entry = { ...option, tile, armed: true };
    mountainChoice.push(entry);
    tile.userData.collider.onStand = (player) => {
      if (!entry.armed || player.ground !== tile.userData.collider) return;
      entry.armed = false;
      state.mountainRoute = entry.id; state.surveys.mountain = true; state.opened.mountainPlain = true; state.plainEntry ??= 'mountain'; marketReady = true;
      setPath(mountainApproach, true); setBarrier(mountainGate, true);
      mountainBoard.set([entry.label, `${entry.hint} · 평야 북쪽 입구가 열렸어요`]);
      checklist();
      level.onMessage?.(`${entry.label}을 따라가요. 평야 북쪽 언덕 입구가 열렸어요. 두 길 모두 지나갈 수 있어요.`, true);
    };
  }
  const mountainBoard = dynamicSign(level.root, { x: 33, y: 7, z: -14, width: 10, rows: 2, color: '#596b44' });
  mountainBoard.set(['산지 지형을 비교해요', '등고선 간격과 현장 경사를 살펴요']);
  // Optional east coast: a distinct straight shoreline survey and a walk-up star. It is never a completion gate.
  const eastCoastTrail = path([[37, 2], [42, 5], [47, 8], [50, 13]], { color: 0x9bc9c0, enabled: true, visible: true, name: 'east-coast-optional' });
  const eastCoastMarker = platform(49, 0, 16, 5.2, 5.2, 0xc8d6b5);
  const eastCoastSurvey = platform(44, 0.1, 18, 3.8, 3.8, 0x6fb1ac);
  sign('동쪽 해안 · 곧은 해안선을 보는 선택 답사', 47, 4.5, 23, { width: 9 });
  eastCoastSurvey.userData.collider.onStand = (player) => {
    if (!state.surveys.eastCoast && player.ground === eastCoastSurvey.userData.collider) {
      state.surveys.eastCoast = true; checklist();
      level.onMessage?.('동쪽 해안 표식을 기록했어요. 필수 답사는 계속할 수 있어요.', true);
    }
  };
  challengeStar(52, 0, 18);
  const star = level.stars[0];
  // Star lies on an isolated broad pad; approach is walkable and optional, with no timing element.

  const riverPads = [
    { id: 'north-bank', x: -7, z: -23, label: '윗물 쪽 건넘길', hint: '북쪽 둑에서 돌아 건너요', route: 'north' },
    { id: 'south-bank', x: -7, z: -35, label: '아랫물 쪽 건넘길', hint: '하류 쪽으로 이어져요', route: 'south' },
  ];
  const riverChoice = [];
  const riverBoard = dynamicSign(level.root, { x: 1, y: 6, z: -45, width: 10, rows: 2, color: '#287b91' });
  riverBoard.set(['하천과 계곡을 살펴요', '물길을 따라 건넘 위치를 골라요']);
  for (const option of riverPads) {
    const tile = platform(option.x, 0.1, option.z, 4.8, 4.8, 0x87c3cf);
    sign(option.label, option.x, 3.1, option.z - 3, { width: 5.7 });
    const entry = { ...option, tile, armed: true };
    riverChoice.push(entry);
    tile.userData.collider.onStand = (player) => {
      if (!entry.armed || player.ground !== tile.userData.collider) return;
      entry.armed = false;
      state.riverCrossing = entry.id; state.riverEntrySide = entry.route; state.surveys.river = true; state.opened.riverPlain = true; state.plainEntry ??= 'river'; marketReady = true;
      setPath(riverNorthApproach, entry.route === 'north'); setPath(riverSouthApproach, entry.route === 'south');
      setBarrier(riverNorthGate, entry.route === 'north'); setBarrier(riverSouthGate, entry.route === 'south');
      setPath(bridgeNorth, entry.route === 'north'); setPath(bridgeSouth, entry.route === 'south');
      riverBoard.set([entry.label, `${entry.hint} · 평야 강가 입구가 열렸어요`]);
      checklist();
      level.onMessage?.(`${entry.label}이 열렸어요. 고른 건넘길이 평야 강가 입구로 이어져요. 다른 쪽도 가까이서 다시 고를 수 있어요.`, true);
    };
  }
  // The crossing choices can be changed locally without returning to the hub.
  const riverRedo = platform(-7, 0.1, -29, 3.8, 3.8, 0xd0bf75);
  sign('건넘길은 여기서 다시 고를 수 있어요', -7, 3.1, -26, { width: 6.6 });
  let riverRedoArmed = true;
  riverRedo.userData.collider.onStand = (player) => {
    if (!riverRedoArmed || player.ground !== riverRedo.userData.collider) return;
    riverRedoArmed = false; riverChoice.forEach((entry) => { entry.armed = true; });
    level.onMessage?.('다른 건넘길도 살펴볼 수 있어요.', true);
  };

  // Main west/south shore is mandatory; the more linear east coast is optional.
  const westCoastSurvey = platform(-36, 0.1, 10, 4.4, 4.4, 0x488f83);
  const westCoastBoard = dynamicSign(level.root, { x: -36, y: 6.4, z: 27, width: 10, rows: 2, color: '#2e6f67' });
  westCoastBoard.set(['서·남쪽 해안 답사', '굴곡이 많은 낮은 해안선을 살펴요']);
  westCoastSurvey.userData.collider.onStand = (player) => {
    if (!state.surveys.westCoast && player.ground === westCoastSurvey.userData.collider) {
      state.surveys.westCoast = true; state.opened.returnShortcut = true;
      setPath(returnShortcut, true); setBarrier(returnBarrier, true); checklist();
      level.onMessage?.('해안 표식을 기록했어요. 본부로 돌아가는 지름길도 열렸어요.', true);
    }
  };
  const coastPath = path([[-34, 4], [-39, 8], [-43, 12], [-39, 17], [-34, 20]], { color: 0xb0c8a4, name: 'west-coast-field-walk' });
  const optionalEastGate = barrier(39, 4, 8);
  setBarrier(optionalEastGate, true);

  // Main inland route segments: keep a visible break around Plain until one of its two approaches is surveyed.
  path([[30, 4], [24, 8], [18, 12], [12, 16]], { color: COLORS.path, elevation: (x) => Math.max(0, 1.2 - (x - 12) * 0.03), name: 'mountain-south-trail' });
  // Markers and map board show orientation and distribution; all map marks are non-colliding child visuals.
  sign('북쪽 ↑  ·  동쪽 →', 0, 6.5, 8.5, { width: 7, color: '#1d3557' });
  sign('동쪽 산지가 높고 이어져요 · 물길은 낮은 곳으로 흘러요', 8, 5.3, -4, { width: 11, color: '#405a3f' });
  sign('서·남쪽 해안은 굴곡이 많은 모습으로 단순화했어요', -42, 5.8, 27, { width: 12, color: '#2a6f6a' });
  sign('장터 두 곳은 가상 길 연결을 비교하는 선택이에요', -18, 5.8, -39, { width: 11, color: '#6c584c' });

  // Checklist and shared status surface for tests / teacher readout.
  const checklistBoard = dynamicSign(level.root, { x: 0, y: 7, z: 10, width: 12, rows: 3, color: '#6a4c93' });
  function checklist() {
    checklistBoard.set([
      `산지 ${state.surveys.mountain ? '✓' : '□'} · 하천 ${state.surveys.river ? '✓' : '□'}`,
      `평야 ${state.surveys.plain ? '✓' : '□'} · 해안 ${state.surveys.westCoast ? '✓' : '□'}`,
      state.surveys.eastCoast ? '선택 동쪽 해안 ✓' : '동쪽 해안은 선택 답사예요',
    ]);
  }
  checklist();

  const checkpointPads = [];
  for (const cp of CHECKPOINTS.slice(1)) {
    const pad = platform(cp.x, 0.08, cp.z, 5.4, 5.4, COLORS.open);
    checkpoint(pad, new THREE.Vector3(cp.x, 0.08, cp.z), cp.name);
    checkpointPads.push(pad);
  }
  // Base is checkpoint zero. Other points are surveyed using separate pads so the checkpoint callback stays intact.
  const tasks = [
    { key: 'mountain', x: 33, z: -8, pad: mountainPads.map((p) => mountainChoice.find((q) => q.id === p.id).tile) },
    { key: 'river', x: -7, z: -29, pad: riverChoice.map((x) => x.tile) },
    { key: 'plain', x: -19, z: -26, pad: marketChoice.map((x) => x.tile) },
    { key: 'westCoast', x: -36, z: 10, pad: [westCoastSurvey] },
  ];
  const plainVisited = { value: false };
  for (const tile of marketChoice.map((x) => x.tile)) {
    const previous = tile.userData.collider.onStand;
    tile.userData.collider.onStand = (player) => {
      if (state.opened.mountainPlain || state.opened.riverPlain) {
        plainVisited.value = true;
        previous(player);
      }
    };
  }
  // Gates carry visible labels and a physically closed collider until their source survey opens them.
  const mountainGateLabel = sign('닫힘: 산지 답사를 마치면 열려요', -24, 5.3, -10, { width: 10, color: '#795548' });
  const riverGateLabel = sign('닫힘: 하천 건넘길을 고르면 열려요', -16, 5.3, -33, { width: 10, color: '#795548' });
  const coastGateLabel = sign('닫힘: 평야에서 연결할 터를 고르면 열려요', -34, 5.3, -2, { width: 11, color: '#795548' });

  // Finish stays at the hub until all four required field surveys are recorded.
  const finish = platform(0, 0.1, -2, 4.2, 4.2, 0x77aa55);
  sign('네 필수 답사를 마치면 본부 지도가 완성돼요', 0, 4.1, -3.6, { width: 10 });
  finish.userData.collider.onStand = (player) => {
    if (level.finished) return;
    const required = state.surveys.mountain && state.surveys.river && state.surveys.plain && state.surveys.westCoast;
    if (!required) return;
    level.finished = true; state.finished = true; level.onFinish?.();
    level.onMessage?.('현장 표식이 본부 지도에 모였어요. 답사가 끝났어요!', true);
  };

  const checkpointFor = (x, z, name) => {
    const cpMesh = platform(x, 0.08, z, 5.2, 5.2, COLORS.open);
    return checkpoint(cpMesh, new THREE.Vector3(x, 0.08, z), name);
  };
  // A second checkpoint per long crossing keeps return travel short; every pad is static and wide.
  checkpointFor(17, 0, '산지 길목');
  checkpointFor(0, -19, '하천 상류');
  checkpointFor(-24, -4, '해안 길목');
  checkpointFor(-30, -31, '평야 답사');

  const zoneStates = {
    gates: { mountain: mountainGate, river: [riverNorthGate, riverSouthGate], coast: plainCoastGate },
    paths: { mountainToPlain: mountainApproach, riverNorthToPlain: riverNorthApproach, riverSouthToPlain: riverSouthApproach, riverBridgeNorth: bridgeNorth, riverBridgeSouth: bridgeSouth, plainToCoastRiver, plainToCoastTerrace, plainToRiver, returnShortcut },
    barriers: { mountain: mountainGate, riverNorth: riverNorthGate, riverSouth: riverSouthGate, coast: plainCoastGate, bridgeNorth: bridgeWallN, bridgeSouth: bridgeWallS, return: returnBarrier, eastOptional: optionalEastGate },
    boards: { checklist: checklistBoard, mountain: mountainBoard, river: riverBoard, market: marketBoard, coast: westCoastBoard },
    choices: { mountain: mountainChoice, river: riverChoice, market: marketChoice },
  };

  function resetState() {
    Object.assign(state.surveys, { mountain: false, river: false, plain: false, westCoast: false, eastCoast: false });
    Object.assign(state.opened, { mountainPlain: false, riverPlain: false, plainCoast: false, returnShortcut: false });
    state.mountainRoute = null; state.riverCrossing = null; state.riverEntrySide = null; state.plainEntry = null; state.marketSite = null; state.finished = false; plainVisited.value = false; marketReady = false;
    setPath(mountainApproach, false); setPath(riverNorthApproach, false); setPath(riverSouthApproach, false); setPath(bridgeNorth, false); setPath(bridgeSouth, false);
    setPath(plainToCoastRiver, false); setPath(plainToCoastTerrace, false); setPath(returnShortcut, false);
    setPath(plainToRiver, false);
    setBarrier(mountainGate, false); setBarrier(riverNorthGate, false); setBarrier(riverSouthGate, false); setBarrier(plainCoastGate, false); setBarrier(returnBarrier, false);
    mountainChoice.forEach((x) => { x.armed = true; }); riverChoice.forEach((x) => { x.armed = true; }); marketChoice.forEach((x) => { x.armed = true; });
    repairTile.userData.collider.enabled = true; choiceRepairArmed = true; riverRedo.userData.collider.enabled = true; riverRedoArmed = true;
    marketBoard.set(['장터 자리를 비교해요', '두 곳 모두 가상 답사 경로예요']);
    mountainBoard.set(['산지 지형을 비교해요', '등고선 간격과 현장 경사를 살펴요']);
    riverBoard.set(['하천과 계곡을 살펴요', '물길을 따라 건넘 위치를 골라요']);
    westCoastBoard.set(['서·남쪽 해안 답사', '굴곡이 많은 낮은 해안선을 살펴요']);
    mountainGateLabel.visible = true; riverGateLabel.visible = true; coastGateLabel.visible = true;
    checklist();
  }

  level.terrainExpedition = state;
  level.terrainExpedition.constants = { ZONES, CHECKPOINTS, MAP_BEARING, STAR_COUNT, ROAD };
  level.terrainExpedition.paths = zoneStates.paths;
  level.terrainExpedition.gates = zoneStates.gates;
  level.terrainExpedition.barriers = zoneStates.barriers;
  level.terrainExpedition.boards = zoneStates.boards;
  level.terrainExpedition.choices = zoneStates.choices;
  level.terrainExpedition.optionalStar = star;
  level.terrainExpedition.plainVisited = plainVisited;
  level.terrainExpedition.refreshChecklist = checklist;

  finalizeLevel(level);
  const resetBase = level.resetProgress;
  level.resetProgress = () => { resetBase(); resetState(); };
  level.setSeed = (nextSeed) => { level.seed = nextSeed; resetBase(); resetState(); };
  level.setSeed(seed);
  rootUpdate(level);
  return level;
}

function rootUpdate(level) { level.root.updateMatrixWorld(true); }
