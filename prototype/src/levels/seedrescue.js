// 씨앗 구조대: 물의 양을 모으고 조절해 싹을 틔운 뒤, 자란 줄기·잎 다리를 건넌다.
// 물·시간 변화는 종별 실제 생장 자료가 아닌 게임 속 축약 모형이다. (기본 맵: Codex, 2026-10-05 보완: Claude — docs/49)
//
// 조작 발판은 모두 "올라선 순간 한 번"만 반응한다(서 있는 동안 매 프레임 반응하지 않게).
// 구간: ① 씨앗 창고 → ② 물길 갈림길(높은 잎길: 탄성 발판으로 올라가는 짧은 길 / 낮은 샘길: 길고 평평한 길)
//       → ③ 물 조절 연못 → ④ 화분(올라서면 심기) → ⑤ 잎 다리 계곡(싹 결과마다 다른 다리, 옆에 꽃잎 고르기 도전)
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { dynamicSign, rngFor, pick } from './variants.js';

export const SEED_SALT = 81;
export const SEED_TYPES = [
  { id: 'small', label: '작은 씨앗 모형', minWater: 1, maxWater: 1 },
  { id: 'vegetable', label: '채소 씨앗 모형', minWater: 2, maxWater: 3 },
  { id: 'bean', label: '콩 씨앗 모형', minWater: 4, maxWater: 5 },
  { id: 'large', label: '큰 씨앗 모형', minWater: 6, maxWater: 6 },
];
export const DEFAULT_SEED_ID = 'bean';
export const WATER_DROPS = { high: 2, low: 5, max: 6, radius: 1.2 }; // radius: 물방울을 줍는 거리. 길 가장자리로 걸으면 피할 수 있다
export const WATER_RANGES = Object.fromEntries(SEED_TYPES.map(({ id, minWater, maxWater }) => [id, [minWater, maxWater]]));
export const BRIDGE_WIDTHS = { good: 6.4, low: 2.0, excess: 3.0 }; // 지나침: 짧은 줄기(폭 3) 뒤에 띄엄띄엄 뿌리 발판
export const JUMP_DISTANCES = { normal: 5, dive: 8, bounceSpeed: 15, starGap: 7.0 };
export const SEED_PATH = { start: 4, seedEnd: -20, pondEnd: -62, waterEnd: -92, potEnd: -114, finish: -170 };
export const HIGH_DECK = { x: -6, y: 4.5, z0: -30.5, z1: -61.5 }; // 높은 잎길 윗판
export const PETAL_ROWS = [-124, -131, -138, -145]; // 꽃잎 고르기 줄
export const PETAL_X = [6.5, 10]; // 한 줄에 꽃잎 두 장: 하나는 물을 머금은 단단한 잎, 하나는 마른 잎
export const PETAL_SWAY = { amp: 0.6, w: 1.2 }; // 꽃잎은 바람에 좌우로 살짝 흔들린다(시간 t로만 정해짐)
export const petalX = (row, k, t) => PETAL_X[k] + PETAL_SWAY.amp * Math.sin(PETAL_SWAY.w * t + row * 1.3);

export const seedTypeFor = (seed) => pick(rngFor(seed, SEED_SALT), SEED_TYPES);
/** 시드별 꽃잎 배치: 줄마다 물을 머금은 잎이 PETAL_X의 몇 번째인지 */
export const petalLayout = (seed) => { const r = rngFor(seed, SEED_SALT + 1); return PETAL_ROWS.map(() => (r() < 0.5 ? 0 : 1)); };

export function sproutResult(seedType, water) {
  if (water < seedType.minWater) return 'low';
  if (water > seedType.maxWater) return 'excess';
  return 'good';
}

export function buildSeedRescue(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '씨앗 창고', zMax: Infinity },
      { name: '물길 갈림길', zMax: -20 },
      { name: '물 조절 연못', zMax: -62 },
      { name: '싹 틔우기 화분', zMax: -92 },
      { name: '잎 다리 계곡', zMax: -114 },
    ]),
    sky: { background: 0xc7e7f1, fog: [0xc7e7f1, 85, 190], hemi: 1.7 },
  });
  const { root, movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, challengeStar } = makeKit(level);
  const HIDDEN = new THREE.Vector3(0, -200, 0);
  const state = level.seedRescue = {
    seedType: SEED_TYPES.find((s) => s.id === DEFAULT_SEED_ID),
    seedCollected: false,
    route: null,
    water: 0,
    adjustments: 0,
    result: null,
    autoPlanted: false,
    bridges: { good: [], low: [], excess: [] },
    drops: [],
    controls: [],
    stars: level.stars,
  };
  // 올라선 순간 한 번만 반응하는 발판 영역 (발판 메시와 따로 위치로 판정한다)
  const triggers = [];
  // 한 번 반응한 뒤에는 발판에서 1.2m 넘게 벗어나야 다시 반응한다(가장자리에서 들락날락해도 여러 번 세지 않게)
  function trigger(x, z, half, yMin, fn) { const tr = { x, z, half, yMin, fn, armed: true }; triggers.push(tr); return tr; }

  // ─── ① 씨앗 창고 ─────────────────────────────────────
  level.spawn.set(0, 1, 4);
  platform(0, 1, -8, 22, 24, 0xdacba9);
  startCheckpoint('씨앗 창고');
  sign('씨앗 구조대', -7, 5.6, -4, { width: 5.2 });
  sign('씨앗 싹 틔우기 모형', 7, 5.6, -4, { width: 7.2, lines: ['씨앗 싹 틔우기 모형', '물의 양만 비교해요 · 온도는 알맞게 고정'], color: '#43855c' });
  const seedSign = dynamicSign(root, { x: -6.5, y: 5.2, z: -15.5, width: 6, rows: 2, color: '#54834a' });
  platform(-6.5, 1.12, -12, 3.4, 3.4, 0xc6a66a); // 씨앗 받기 발판 (주 동선 x 0에서 벗어나 있다)
  sign('씨앗 받기', -6.5, 3.6, -10, { width: 3.6 });
  trigger(-6.5, -12, 1.6, 0.9, () => {
    state.seedCollected = true;
    seedSign.set([state.seedType.label, `알맞은 물: ${state.seedType.minWater}~${state.seedType.maxWater}`]);
    level.onMessage?.(`${state.seedType.label}을 받았어요. 알맞은 물은 ${state.seedType.minWater}~${state.seedType.maxWater}이에요.`, true);
  });
  checkpoint(platform(0, 1, -20, 22, 6, 0xdacba9), new THREE.Vector3(0, 1, -20), '물길 갈림길');

  // ─── ② 물길 갈림길 ───────────────────────────────────
  // 높은 잎길(서쪽): 짧은 바닥 → 탄성 발판으로 3.5m 위 잎길에 올라 곧게 간다. 물방울 2개. 별 섬(점프+다이브).
  // 낮은 샘길(동쪽): 평평하지만 옆으로 돌아가 더 길다. 물방울 5개. 물방울은 길 가장자리로 걸으면 피할 수 있다.
  const routePlatforms = { high: [], low: [] };
  sign('높은 잎길', -6, 5.2, -21, { width: 5.2, lines: ['높은 잎길', '짧아요 · 탄성 발판으로 올라가요', '물방울이 적어요'], color: '#3f8f4f' });
  sign('낮은 샘길', 6, 5.2, -21, { width: 5.2, lines: ['낮은 샘길', '평평하지만 돌아가요', '물방울이 많아요'], color: '#2f7f99' });
  routePlatforms.high.push(platform(-6, 1, -26.75, 7.6, 7.5, 0x76c882)); // 잎길 아래 바닥 (-23 ~ -30.5)
  block(-6, 1.16, -28.6, 3.4, 0.24, 3.4, 0x8ed478, { kind: 'bounce', bounceSpeed: JUMP_DISTANCES.bounceSpeed }); // 탄성 발판
  routePlatforms.high.push(block(HIGH_DECK.x, HIGH_DECK.y, (HIGH_DECK.z0 + HIGH_DECK.z1) / 2, 7.6, HIGH_DECK.y, HIGH_DECK.z0 - HIGH_DECK.z1, 0x5fb36c, { castShadow: true }));
  sign('탄성 발판', -9.2, 3.2, -27, { width: 3.4, lines: ['탄성 발판', '밟고 앞으로!'], rotY: 0.5 });
  checkpoint(platform(-6, HIGH_DECK.y + 0.04, -46, 5, 4, 0xb8dda0), new THREE.Vector3(-6, HIGH_DECK.y, -46), '높은 길 중간');
  // 별 섬: 잎길 서쪽 가장자리(x -9.8)에서 7m 너머, 같은 높이. 못 닿으면 떨어져 높은 길 중간 체크포인트로.
  challengeStar(-9.8 - JUMP_DISTANCES.starGap - 1.5, HIGH_DECK.y, -52);
  const highStarEntry = level.stars.at(-1);
  routePlatforms.low.push(platform(6, 1, -30, 8, 14, 0x67b5c1));
  routePlatforms.low.push(platform(11, 1, -43, 8, 14, 0x72c6c2));
  routePlatforms.low.push(platform(6, 1, -56, 8, 14, 0x5caebc));
  checkpoint(platform(11, 1.04, -44.5, 5, 3.4, 0xb8dda0), new THREE.Vector3(11, 1, -44.5), '낮은 길 중간');

  const drops = [];
  function waterDrop(route, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat(0x40c6ec, { emissive: 0x147b9e, emissiveIntensity: 0.28 }));
    mesh.position.set(x, y, z); root.add(mesh);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.08, 6, 16), mat(0xb6f1ff));
    halo.position.copy(mesh.position); halo.rotation.x = Math.PI / 2; root.add(halo);
    const drop = { route, mesh, halo, got: false };
    drops.push(drop); state.drops.push(drop);
  }
  [[-6, -37], [-6, -54]].forEach(([x, z]) => waterDrop('high', x, HIGH_DECK.y + 1.1, z));
  [[6, -27], [6, -33], [11, -39], [11, -48], [6, -56]].forEach(([x, z]) => waterDrop('low', x, 2.1, z));

  // ─── ③ 물 조절 연못 ──────────────────────────────────
  checkpoint(platform(0, 1, -66, 22, 9, 0xc9d9b4), new THREE.Vector3(0, 1, -65), '물 조절 연못'); // 잎길 끝(-61.5)에서 뛰어내리면 여기
  const pond = platform(0, 1, -80, 24, 20, 0xc3dfd0);
  const drainPad = platform(-7, 1.16, -77, 3.2, 3.2, 0xe4a879);
  const springPad = platform(7, 1.16, -77, 3.2, 3.2, 0x63bde0);
  sign('물을 덜어요', -7, 4.4, -74.5, { width: 4, lines: ['물을 덜어요', '한 번 올라설 때 한 방울'] });
  sign('물을 더 받아요', 7, 4.4, -74.5, { width: 4, lines: ['물을 더 받아요', '한 번 올라설 때 한 방울'] });
  trigger(-7, -77, 1.5, 0.9, () => state.drainWater());
  trigger(7, -77, 1.5, 0.9, () => state.addWater());
  state.controls.push(drainPad, springPad);
  const waterSign = dynamicSign(root, { x: 0, y: 5.8, z: -88, width: 7, rows: 2, color: '#267c9e' });

  // ─── ④ 싹 틔우기 화분 ────────────────────────────────
  checkpoint(platform(0, 1.03, -93, 8, 3, 0xb8dda0), new THREE.Vector3(0, 1, -93), '싹 틔우기 화분');
  const potArea = platform(0, 1, -103, 22, 22, 0xd9c8a5);
  void potArea;
  const pot = block(0, 1.14, -102, 5.4, 0.35, 5.4, 0x9d6b48); // 바닥보다 0.14m 높은 납작한 화분: 걸어서 그대로 올라선다(뛰지 않아도 됨)
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.06, 16), mat(0x594332));
  soil.position.set(0, 1.17, -102); root.add(soil);
  const plantPad = soil; // 호환: 화분 흙 = 심는 곳
  sign('화분에 올라서면 심어요', 0, 5, -97.5, { width: 7.8, lines: ['화분에 올라서면 심어요', '물을 바꿨다면 다시 올라서 다시 심어요'] });
  trigger(0, -102, 2.6, 0.9, () => state.plant());
  const sprout = new THREE.Group();
  sprout.position.set(0, 1.4, -106.5);
  root.add(sprout);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 8), mat(0x5a9b53));
  stem.position.y = 1.2; sprout.add(stem);
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat(0x75c46b));
    leaf.scale.set(0.92, 0.18, 0.48); leaf.position.set(side * 0.67, 1.65, 0); leaf.rotation.z = side * -0.3; sprout.add(leaf);
  }
  sprout.visible = false;
  const resultSign = dynamicSign(root, { x: 8, y: 5.6, z: -108, width: 7, rows: 2, color: '#39854c' });
  // 물 조절 없이 낮은 길에서 알맞음을 맞추면 화분 옆에 별 (그 판의 높은 길 별 섬과 한 번에 얻기 어렵다)
  const dryStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.66), mat(0xffcf33, { emissive: 0xe79b00, emissiveIntensity: 0.72 }));
  const dryStarPosition = new THREE.Vector3(-7, 2.6, -106);
  dryStar.position.copy(HIDDEN); root.add(dryStar);
  const dryStarEntry = { mesh: dryStar, got: false };
  level.stars.push(dryStarEntry);

  // ─── ⑤ 잎 다리 계곡 ──────────────────────────────────
  // 알맞음: 넓은 잎 다리(폭 6.4, 끊김 없음) / 적음: 가는 줄기(폭 2.0, 끊김 없음) /
  // 지나침: 짧은 줄기(폭 3, 18m) 뒤에 뿌리 발판(3×3, 틈 1m)을 뛰어 건넌다. 모두 완주 가능.
  checkpoint(platform(0, 1, -115, 22, 8, 0xd9c8a5), new THREE.Vector3(0, 1, -115), '잎 다리 계곡');
  const B0 = -119, B1 = -165;
  function bridgePiece(result, x, z0, z1, width, color) {
    const piece = platform(x, 1, (z0 + z1) / 2, width, z0 - z1, color, { dynamic: true });
    piece.visible = false; piece.userData.collider.enabled = false;
    state.bridges[result].push(piece);
  }
  bridgePiece('good', 0, B0, B1, BRIDGE_WIDTHS.good, 0x68b766);
  bridgePiece('low', 0, B0, B1, BRIDGE_WIDTHS.low, 0x81914a);
  bridgePiece('excess', 0, B0, B0 - 18, BRIDGE_WIDTHS.excess, 0x956d4e);
  // 뿌리 발판: 깊이 4.5, 틈 1.5 (전속력으로 뛰어도 다음 발판에 내려앉는 간격). 좌우로 조금씩 어긋난다
  for (let i = 0, z = B0 - 18 - 1.5; z - 4.5 > B1 - 1; i++, z -= 6) bridgePiece('excess', i % 2 ? 0.7 : -0.7, z, z - 4.5, 3, 0x9d875e);
  const valleyMid = platform(0, 1.02, -142, 5, 4, 0xb8dda0);
  checkpoint(valleyMid, new THREE.Vector3(0, 1, -142), '계곡 중간');
  const finish = platform(0, 1.05, -170, 22, 10, 0x8bd0ac);
  finishPad(finish, -170);
  sign('구조 완료!', 0, 6.5, -172, { width: 7, lines: ['구조 완료!', '물의 양에 따라 싹이 어떻게 달랐나요?'] });

  // 꽃잎 고르기(선택): 줄마다 꽃잎 두 장. 물을 머금은 잎(진한 초록, 두툼하고 넓음)은 단단하고,
  // 마른 잎(연한 색, 얇고 좁음)은 밟으면 0.4초 뒤 처지다 떨어진다(계곡 체크포인트에서 다시). 끝의 별 섬에서 다리로 돌아온다.
  // 어느 쪽이 물을 머금었는지는 시드로 바뀐다. 단서는 밟기 전에 보인다.
  const petals = [];
  PETAL_ROWS.forEach((z, r) => {
    for (let k = 0; k < 2; k++) {
      const petal = platform(PETAL_X[k], 1, z, 3, 3.2, 0xc9cf9a, { dynamic: true });
      petal.material = petal.material.clone();
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(0x52a865)); // 물을 머금어 부푼 모양 (장식, 충돌 없음)
      puff.scale.set(1.35, 0.35, 1.45); puff.position.y = 0.5; petal.add(puff);
      petal.userData.petal = { row: r, k, wet: false, sagAt: null, originalY: petal.position.y, puff };
      petals.push(petal);
    }
  });
  challengeStar(8.25, 1, -152);
  const petalStarEntry = level.stars.at(-1);
  platform(4.6, 1, -152, 4.2, 3, 0xc9d9b4); // 별 섬 → 다리로 돌아오는 받침
  sign('꽃잎 고르기 (선택)', 9.5, 4.2, -119.5, { width: 4.6, lines: ['꽃잎 고르기 (선택)', '물을 머금은 잎은 진하고 두툼해요', '마른 잎은 밟으면 처져요'], rotY: -0.3 });
  state.petals = petals;
  state.time = 0;

  function applyPetals(s) {
    const layout = petalLayout(s);
    for (const petal of petals) {
      const info = petal.userData.petal;
      info.wet = layout[info.row] === info.k; info.sagAt = null;
      petal.material.color.setHex(info.wet ? 0x438b55 : 0xc9cf9a);
      info.puff.visible = info.wet; // 물 머금은 잎은 두툼하게 부풀어 보인다 (크기를 바꾸면 충돌 상자도 바뀌므로 장식으로만)
      petal.position.y = info.originalY; petal.userData.collider.enabled = true;
    }
  }

  // ─── 상태 갱신 ───────────────────────────────────────
  function updateWaterReadout() {
    waterSign.set([`모은 물: ${state.water}`, `${state.seedType.label} 알맞은 범위: ${state.seedType.minWater}~${state.seedType.maxWater}`]);
  }
  function updateStars() {
    const dryOk = state.route === 'low' && state.adjustments === 0 && state.result === 'good' && !dryStarEntry.got;
    dryStar.position.copy(dryOk ? dryStarPosition : HIDDEN);
  }
  function makeBridge() {
    for (const [result, list] of Object.entries(state.bridges)) for (const piece of list) {
      const on = result === state.result;
      piece.visible = on; piece.userData.collider.enabled = on;
    }
  }
  function showSprout() {
    sprout.visible = !!state.result;
    if (!state.result) return;
    sprout.scale.setScalar(state.result === 'good' ? 1.45 : state.result === 'low' ? 0.8 : 0.58);
    stem.material.color.setHex(state.result === 'good' ? 0x4f9f48 : state.result === 'low' ? 0x81914a : 0x956d4e);
  }
  const RESULT_TEXT = {
    good: ['알맞은 물이에요', '싹이 잘 터 넓은 잎 다리가 자라요'],
    low: ['물이 적어요', '작은 싹이 가는 줄기 다리를 만들어요'],
    excess: ['물이 지나쳐요', '짧은 줄기 뒤로 뿌리 발판을 뛰어 건너요'],
  };
  function refreshResult(auto = false) {
    makeBridge(); showSprout();
    resultSign.set([`${state.seedType.label} · 물 ${state.water}`, RESULT_TEXT[state.result][1]]);
    level.onMessage?.(`${auto ? '심지 않고 와서 지금 물로 심었어요. ' : ''}${RESULT_TEXT[state.result][0]}. ${RESULT_TEXT[state.result][1]}`, state.result === 'good');
    updateStars();
  }

  state.chooseRoute = (id) => {
    if (id !== 'high' && id !== 'low') return false;
    if (state.route === id) return true;
    state.route = id;
    level.onMessage?.(id === 'high' ? '높은 잎길: 짧지만 물방울이 적어요.' : '낮은 샘길: 길지만 물방울이 많아요.', true);
    updateStars();
    return true;
  };
  state.addWater = () => {
    if (state.water >= WATER_DROPS.max) { level.onMessage?.(`물이 가득해요 (${state.water}).`, false); return false; }
    state.water++; state.adjustments++;
    updateWaterReadout(); updateStars();
    level.onMessage?.(`물을 한 방울 더했어요. 지금 ${state.water}`, true);
    return true;
  };
  state.drainWater = () => {
    if (state.water <= 0) { level.onMessage?.('덜어 낼 물이 없어요.', false); return false; }
    state.water--; state.adjustments++;
    updateWaterReadout(); updateStars();
    level.onMessage?.(`물을 한 방울 덜었어요. 지금 ${state.water}`, true);
    return true;
  };
  state.plant = (auto = false) => {
    state.result = sproutResult(state.seedType, state.water);
    state.autoPlanted = auto;
    refreshResult(auto);
    return state.result;
  };
  state.setSeedType = (id) => {
    const next = SEED_TYPES.find((s) => s.id === id);
    if (!next) return false;
    state.seedType = next; state.seedCollected = true;
    seedSign.set([next.label, `알맞은 물: ${next.minWater}~${next.maxWater}`]);
    updateWaterReadout();
    return true;
  };
  state.setWater = (amount) => { state.water = THREE.MathUtils.clamp(Math.round(amount), 0, WATER_DROPS.max); updateWaterReadout(); };
  state.reset = (s = level.seed) => {
    state.seedType = seedTypeFor(s); // 처음부터 해도 그 판의 씨앗 종류는 그대로
    state.seedCollected = false; state.route = null; state.water = 0; state.adjustments = 0; state.result = null; state.autoPlanted = false; state.time = 0;
    for (const tr of triggers) tr.armed = true;
    for (const drop of drops) { drop.got = false; drop.mesh.visible = true; drop.halo.visible = true; }
    seedSign.set([`이번 씨앗: ${state.seedType.label}`, '발판에 올라서면 알맞은 물을 알려 줘요']);
    updateWaterReadout();
    sprout.visible = false;
    makeBridge();
    applyPetals(s);
    for (const star of level.stars) star.got = false;
    highStarEntry.mesh.visible = true; petalStarEntry.mesh.visible = true;
    updateStars();
    world.syncDynamic();
  };
  level.routePlatforms = routePlatforms;
  level.plantPad = plantPad;
  level.pot = pot;
  level.pond = pond;
  level.bridgeInfo = { B0, B1 };
  level.triggers = triggers;

  // 매 스텝: 발판 영역(한 번만), 경로 판정(위치), 물방울, 화분을 지나치면 자동 심기, 마른 꽃잎
  movers.push({ root: null, update(t, dt, player) {
    state.time = t;
    for (const petal of petals) {
      const info = petal.userData.petal;
      petal.position.x = petalX(info.row, info.k, t);
      if (info.wet) continue;
      const p = player?.pos;
      const on = !!p && Math.abs(p.x - petal.position.x) < 1.6 && Math.abs(p.z - petal.position.z) < 1.8 && p.y > petal.position.y - 0.4 && p.y < petal.position.y + 1.4;
      if (on && info.sagAt === null) info.sagAt = t;
      if (info.sagAt !== null) {
        const k = t - info.sagAt - 0.4;
        petal.position.y = info.originalY - Math.max(0, k) * 2.5;
        petal.userData.collider.enabled = k < 0.5;
        if (k > 3) { info.sagAt = null; petal.position.y = info.originalY; petal.userData.collider.enabled = true; } // 다시 떠오른다
      }
    }
    if (!player) return;
    const p = player.pos;
    for (const tr of triggers) {
      const d = Math.max(Math.abs(p.x - tr.x), Math.abs(p.z - tr.z));
      const on = d < tr.half && p.y > tr.yMin && p.y < tr.yMin + 1.5;
      if (on && tr.armed) { tr.armed = false; tr.fn(); }
      else if (d > tr.half + 1.2) tr.armed = true;
    }
    if (p.z < -23 && p.z > -62) {
      if (p.x < -2) state.chooseRoute('high');
      else if (p.x > 2) state.chooseRoute('low');
    }
    for (const drop of drops) {
      if (drop.got) continue;
      const dx = p.x - drop.mesh.position.x, dy = p.y + 0.9 - drop.mesh.position.y, dz = p.z - drop.mesh.position.z;
      if (dx * dx + dy * dy + dz * dz > WATER_DROPS.radius * WATER_DROPS.radius + 0.6) continue;
      drop.got = true; drop.mesh.visible = false; drop.halo.visible = false;
      state.water = Math.min(WATER_DROPS.max, state.water + 1);
      updateWaterReadout();
      level.onMessage?.(`물방울을 모았어요. ${state.water}`, true);
    }
    if (!state.result && p.z < -112.5 && p.y > 0.5) state.plant(true); // 심지 않고 와도 다리가 생긴다(완주 보장)
  } });

  finalizeLevel(level);
  const baseReset = level.resetProgress;
  level.resetProgress = () => { baseReset(); state.reset(level.seed); };
  level.setSeed = (s) => { level.seed = s; state.reset(s); };
  level.setSeed(seed);
  return level;
}
