// 씨앗 구조대: 씨앗 세 개를 구해 싹을 틔우고, 자란 싹이 만든 다리로 계곡을 건넌다.
// 정거장마다 싹이 트는 조건 하나만 비교한다(나머지는 같게): ① 물의 양 ② 온도 ③ 빛.
// 맞게 판단하면 가장 쉽고 빠른 길이 열리고, 틀리면 길이 막히지는 않지만 되돌아가 다시 해야 한다(떨어지지 않는다).
// 물·온도·시간의 수치는 실제 씨앗 자료가 아닌 게임 속 축약 모형이다. (기본 맵 Codex, 세 정거장 구조 Claude — docs/49)
//
// 예상 고르기(선택): 정거장마다 심기 전에 발판을 밟아 가설(예상)을 고르고, 심은 뒤 결과와 비교한다. 고르지 않아도 완주한다.
// 실험표 안내판은 '다르게 한 것 / 같게 한 것 / 알아볼 것'을 보여 준다(변인 통제를 초등 수준 말로).
// 조작 발판(화분·물 조절)은 모두 "올라선 순간 한 번"만 반응하고, 1.2m 넘게 벗어나야 다시 반응한다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { dynamicSign, rngFor, pick } from './variants.js';

export const SEED_SALT = 81;
// 물 정거장 씨앗: 알맞은 물의 양은 게임 모형. 숫자 범위는 화면에 보여 주지 않고 말 단서만 준다.
export const SEED_TYPES = [
  { id: 'small', label: '작은 씨앗', hint: '아주 작아서 물이 조금만 필요해요', minWater: 1, maxWater: 1 },
  { id: 'vegetable', label: '채소 씨앗', hint: '물이 너무 많지도 적지도 않게', minWater: 2, maxWater: 3 },
  { id: 'bean', label: '콩', hint: '물을 많이 먹고 통통하게 불어요', minWater: 4, maxWater: 5 },
  { id: 'large', label: '큰 씨앗', hint: '커서 물을 아주 많이 먹어요', minWater: 6, maxWater: 6 },
];
export const DEFAULT_SEED_ID = 'bean';
export const PREDICT_DWELL = 0.7; // 예상 발판에 서 있어야 하는 시간(초)
export const WATER_DROPS = { high: 2, low: 5, max: 6, radius: 1.2 };
export const WATER_RANGES = Object.fromEntries(SEED_TYPES.map(({ id, minWater, maxWater }) => [id, [minWater, maxWater]]));
export const JUMP_DISTANCES = { normal: 5, dive: 8, bounceSpeed: 15, starGap: 7.0 };
export const HIGH_DECK = { x: -6, y: 4.5, z0: -30.5, z1: -61.5 };
// 구간 z
export const Z = {
  water: -20, pot: -76, bridge1: [-82, -108], partialEnd: -91,
  temp: -113, warmPlanter: -122, coldPlanter: -141, bridge2: [-150, -170],
  light: -175, darkPlanter: -192, gardenPlanter: -192, bridge3: [-212, -232], finish: -238,
};
export const PETAL_ROWS = [-216, -221, -226];
export const PETAL_X = [6.5, 10];
export const PETAL_SWAY = { amp: 0.6, w: 1.2 };
export const petalX = (row, k, t) => PETAL_X[k] + PETAL_SWAY.amp * Math.sin(PETAL_SWAY.w * t + row * 1.3);

export const seedTypeFor = (seed) => pick(rngFor(seed, SEED_SALT), SEED_TYPES);
/** 시드별 배치: 온실이 왼쪽(-1)/오른쪽(1), 밝은 정원이 왼쪽/오른쪽, 꽃잎 줄마다 물 머금은 잎 위치 */
export function stationLayout(seed) {
  const r = rngFor(seed, SEED_SALT + 2);
  return { warmSide: r() < 0.5 ? -1 : 1, gardenSide: r() < 0.5 ? -1 : 1, petals: PETAL_ROWS.map(() => (r() < 0.5 ? 0 : 1)) };
}
export const petalLayout = (seed) => stationLayout(seed).petals;

export function sproutResult(seedType, water) {
  if (water < seedType.minWater) return 'low';
  if (water > seedType.maxWater) return 'excess';
  return 'good';
}

export function buildSeedRescue(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '씨앗 창고', zMax: Infinity },
      { name: '① 물 정거장: 물길', zMax: -20 },
      { name: '① 물 정거장: 화분', zMax: -62 },
      { name: '① 잎 다리', zMax: -82 },
      { name: '② 온도 정거장', zMax: -108 },
      { name: '② 잎 다리', zMax: -150 },
      { name: '③ 빛 정거장', zMax: -170 },
      { name: '③ 잎 다리', zMax: -212 },
      { name: '구조 완료', zMax: -232 },
    ]),
    sky: { background: 0xc7e7f1, fog: [0xc7e7f1, 85, 200], hemi: 1.7 },
  });
  const { root, movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, challengeStar } = makeKit(level);
  const HIDDEN = new THREE.Vector3(0, -200, 0);
  const state = level.seedRescue = {
    seedType: SEED_TYPES.find((s) => s.id === DEFAULT_SEED_ID), route: null, water: 0, adjustments: 0, result: null, plants: 0, autoPlanted: false,
    temp: { result: null, tries: 0 }, light: { result: null, place: null },
    predict: { water: null, temp: null, light: null }, hits: { water: null, temp: null, light: null },
    layout: null, drops: [], bridges: {}, stars: level.stars, time: 0,
  };
  const triggers = [];
  function trigger(x, z, half, fn, dwell = 0) { const tr = { x, z, half, fn, dwell, held: 0, armed: true }; triggers.push(tr); return tr; }
  // 예상 고르기 발판: 올라서면 예상이 기록된다(주 동선 옆, 고르지 않아도 진행). 높이 0.16m라 걸어서 올라선다.
  function predictPad(x, z, label, color, kind, value, width = 3.3) {
    platform(x, 1.16, z, 3, 3, color);
    sign(label, x, 3.4, z + 2, { width });
    trigger(x, z, 1.5, () => state.setPrediction(kind, value), PREDICT_DWELL); // 지나가다 밟아도 기록되지 않게 잠깐 서 있어야 한다
  }
  function tableSign(x, y, z, lines, color) { return sign(lines[0], x, y, z, { width: 5.2, lines, color }); }
  function hiddenStar(at) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.68), mat(0xffcf33, { emissive: 0xe79b00, emissiveIntensity: 0.72 }));
    mesh.position.copy(HIDDEN); root.add(mesh);
    const entry = { mesh, got: false, at }; level.stars.push(entry); return entry;
  }
  function sprout(x, z) { // 화분 위 싹 (결과에 따라 크기·색)
    const g = new THREE.Group(); g.position.set(x, 1.2, z); root.add(g);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 8), mat(0x5a9b53)); stem.position.y = 1.2; g.add(stem);
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat(0x75c46b));
      leaf.scale.set(0.92, 0.18, 0.48); leaf.position.set(side * 0.67, 1.65, 0); leaf.rotation.z = side * -0.3; g.add(leaf);
    }
    g.visible = false;
    return { g, show(kind) {
      g.visible = !!kind;
      g.scale.setScalar(kind === 'good' ? 1.4 : kind === 'low' ? 0.7 : 0.6);
      stem.material = mat(kind === 'good' ? 0x4f9f48 : kind === 'low' ? 0x8a9a4a : 0x8a6a48);
    } };
  }
  function pot(x, z, color = 0x9d6b48) { // 납작한 화분 (바닥보다 0.14m 높아 걸어서 올라선다)
    block(x, 1.14, z, 4.4, 0.35, 4.4, color);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 0.06, 16), mat(0x594332)); soil.position.set(x, 1.17, z); root.add(soil);
  }
  // 다리와 입구 덩굴 울타리(2.4m, 넘을 수 없음). 싹이 트면 다리가 생기고 울타리가 사라진다.
  function bridge(key, z0, z1, width, color) {
    const piece = platform(0, 1, (z0 + z1) / 2, width, z0 - z1, color, { dynamic: true });
    piece.visible = false; piece.userData.collider.enabled = false;
    state.bridges[key] = piece;
    return piece;
  }
  function fence(z) {
    const f = block(0, 3.4, z + 0.3, 22, 2.4, 0.6, 0x4f8a3c, { dynamic: true });
    f.material = mat(0x4f8a3c, { transparent: true, opacity: 0.75 });
    return f;
  }
  const setOn = (mesh, on) => { mesh.visible = on; mesh.userData.collider.enabled = on; };

  // ─── 씨앗 창고 ───────────────────────────────────────
  level.spawn.set(0, 1, 4);
  platform(0, 1, -8, 22, 24, 0xdacba9);
  startCheckpoint('씨앗 창고');
  sign('씨앗 구조대', -7, 5.6, -4, { width: 6, lines: ['씨앗 구조대', '씨앗 세 개를 싹 틔워 다리를 만들어요'] });
  sign('싹이 트는 조건', 7, 5.6, -4, { width: 7.2, lines: ['싹이 트는 조건을 찾아요', '정거장마다 한 가지만 달라요', '물 · 온도 · 빛 (게임 모형)'], color: '#43855c' });
  const seedSign = dynamicSign(root, { x: 0, y: 5.6, z: -14, width: 7, rows: 2, color: '#54834a' });
  checkpoint(platform(0, 1, -20, 22, 6, 0xdacba9), new THREE.Vector3(0, 1, -20), '① 물 정거장');

  // ─── ① 물 정거장: 물길 ───────────────────────────────
  sign('높은 잎길', -6, 5.2, -21, { width: 5.2, lines: ['높은 잎길', '짧아요 · 탄성 발판으로 올라가요', '물방울이 적어요'], color: '#3f8f4f' });
  sign('낮은 샘길', 6, 5.2, -21, { width: 5.2, lines: ['낮은 샘길', '평평하지만 돌아가요', '물방울이 많아요'], color: '#2f7f99' });
  platform(-6, 1, -26.75, 7.6, 7.5, 0x76c882);
  block(-6, 1.16, -28.6, 3.4, 0.24, 3.4, 0x8ed478, { kind: 'bounce', bounceSpeed: JUMP_DISTANCES.bounceSpeed });
  block(HIGH_DECK.x, HIGH_DECK.y, (HIGH_DECK.z0 + HIGH_DECK.z1) / 2, 7.6, HIGH_DECK.y, HIGH_DECK.z0 - HIGH_DECK.z1, 0x5fb36c, { castShadow: true });
  checkpoint(platform(-6, HIGH_DECK.y + 0.04, -46, 5, 4, 0xb8dda0), new THREE.Vector3(-6, HIGH_DECK.y, -46), '높은 길 중간');
  challengeStar(-9.8 - JUMP_DISTANCES.starGap - 1.5, HIGH_DECK.y, -52); // 별 섬 (점프+다이브)
  const islandStar = level.stars.at(-1);
  platform(6, 1, -30, 8, 14, 0x67b5c1);
  platform(11, 1, -43, 8, 14, 0x72c6c2);
  platform(6, 1, -56, 8, 14, 0x5caebc);
  checkpoint(platform(11, 1.04, -44.5, 5, 3.4, 0xb8dda0), new THREE.Vector3(11, 1, -44.5), '낮은 길 중간');
  const drops = state.drops;
  function waterDrop(x, y, z) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat(0x40c6ec, { emissive: 0x147b9e, emissiveIntensity: 0.28 }));
    mesh.position.set(x, y, z); root.add(mesh);
    drops.push({ mesh, got: false });
  }
  [[-6, -37], [-6, -54]].forEach(([x, z]) => waterDrop(x, HIGH_DECK.y + 1.1, z));
  [[6, -27], [6, -33], [11, -39], [11, -48], [6, -56]].forEach(([x, z]) => waterDrop(x, 2.1, z));

  // ─── ① 물 정거장: 화분 (물 조절 발판이 바로 옆, 틀려도 몇 걸음 돌아오면 고친다) ───
  checkpoint(platform(0, 1, -72, 22, 20, 0xc3dfd0), new THREE.Vector3(0, 1, -65), '① 화분');
  pot(0, Z.pot);
  const sprout1 = sprout(0, Z.pot - 1);
  platform(-7.5, 1.16, Z.pot, 3, 3, 0xe4a879); platform(7.5, 1.16, Z.pot, 3, 3, 0x63bde0);
  sign('물 한 방울 덜기', -7.5, 3.6, Z.pot + 2, { width: 3.8 });
  sign('물 한 방울 더하기', 7.5, 3.6, Z.pot + 2, { width: 3.8 });
  sign('화분', 0, 4.8, -69.5, { width: 6, lines: ['화분에 올라서면 심어요', '물을 바꿨다면 다시 올라서요'] });
  tableSign(-6, 6.2, -68, ['① 실험표 · 물', '다르게 한 것: 물의 양', '같게 한 것: 온도 · 빛', '알아볼 것: 싹의 모양'], '#267c9e');
  const predictWaterSign = dynamicSign(root, { x: -6, y: 4.6, z: -70, width: 5, rows: 1, color: '#267c9e' });
  sign('예상 고르기 (선택)', -6, 5.9, -70, { width: 4.4 });
  predictPad(-9.5, -70, '물이 적을 것 같아요', 0xe4a879, 'water', 'low');
  predictPad(-6, -70, '알맞을 것 같아요', 0x9ed39a, 'water', 'good');
  predictPad(-2.5, -70, '지나칠 것 같아요', 0x63bde0, 'water', 'excess');
  const waterSign = dynamicSign(root, { x: 0, y: 6.2, z: -81.6, width: 7, rows: 2, color: '#267c9e' });
  trigger(-7.5, Z.pot, 1.5, () => state.drainWater());
  trigger(7.5, Z.pot, 1.5, () => state.addWater());
  trigger(0, Z.pot, 2.2, () => state.plant());
  const fence1 = fence(Z.bridge1[0]);
  bridge('good', Z.bridge1[0], Z.bridge1[1], 6.4, 0x68b766);
  bridge('low', Z.bridge1[0], Z.partialEnd, 2.4, 0x8a9a4a); // 물이 적음: 가늘고 짧은 줄기
  bridge('excess', Z.bridge1[0], Z.partialEnd, 4, 0x8a6a48); // 물이 지나침: 공기가 부족해 약해진 갈색 줄기, 짧다
  const partialEnd = block(0, 3.4, Z.partialEnd - 0.3, 6, 2.4, 0.6, 0x7a5a3a, { dynamic: true }); // 짧은 줄기 끝 벽(떨어지지 않게)
  const partialSign = dynamicSign(root, { x: 0, y: 4.6, z: Z.partialEnd + 0.4, width: 5.6, rows: 2, color: '#8a4b2a' });
  const firstTryStar = hiddenStar(new THREE.Vector3(8, 2.6, -112));

  // ─── ② 온도 정거장 (물은 같게: 두 화분 모두 알맞은 물이 들어 있다) ───
  // 지나가는 길 위(가운데)에 얼음 창고 화분, 옆으로 돌아가면 온실 화분. 얼음 창고에 심으면 싹이 트지 않아 온실로 되돌아가야 한다.
  checkpoint(platform(0, 1, -129, 22, 42, 0xd9c8a5), new THREE.Vector3(0, 1, -112), '② 온도 정거장'); // -108 ~ -150
  sign('② 온도 정거장', 0, 6.6, -110, { width: 8, lines: ['② 온도 정거장', '두 화분의 물은 똑같아요', '어디에 심어야 싹이 틀까요?'], color: '#b0641c' });
  tableSign(-8, 6.4, -113, ['② 실험표 · 온도', '다르게 한 것: 온도', '같게 한 것: 물 · 빛', '알아볼 것: 싹이 트는지'], '#b0641c');
  const predictTempSign = dynamicSign(root, { x: 0, y: 4.6, z: -116, width: 5, rows: 1, color: '#b0641c' });
  sign('예상 고르기 (선택)', 0, 5.9, -116, { width: 4.4 });
  predictPad(-3.5, -116, '얼음 창고에서 틀 것 같아요', 0xcfeefa, 'temp', 'cold', 4.4);
  predictPad(3.5, -116, '온실에서 틀 것 같아요', 0xf5e6b8, 'temp', 'warm', 4.4);
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xcfeefa, roughness: 0.1, metalness: 0.2 });
  platform(0, 1.04, Z.coldPlanter, 9, 9, 0xcfeefa, { material: iceMat, icy: true }); // 얼음 바닥(미끄럽다)
  pot(0, Z.coldPlanter, 0x8fb7c9);
  for (const sx of [-1, 1]) block(sx * 5.2, 3.2, Z.coldPlanter, 0.5, 2.2, 9, 0xe6f6fd); // 얼음 창고 옆벽
  sign('얼음 창고', -2.6, 4.6, Z.coldPlanter + 4.2, { width: 4, lines: ['얼음 창고', '2℃ · 차가워요'], color: '#2f6f9f' });
  challengeStar(-11 - 6 - 1.5, 1, Z.coldPlanter - 3); // 정거장 서쪽 끝에서 6m 너머 별 섬(점프+다이브)
  const iceStar = level.stars.at(-1);
  const warm = { group: new THREE.Group() };
  root.add(warm.group);
  const greenhouseFloor = platform(0, 1.03, Z.warmPlanter, 6, 6, 0xf5e6b8, { dynamic: true });
  for (const [dx, dz, w, d] of [[-3, 0, 0.2, 6], [3, 0, 0.2, 6], [0, -3, 6, 0.2]]) {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.35 }));
    glass.position.set(dx, 2.5, Z.warmPlanter + dz); warm.group.add(glass);
  }
  const warmPotMesh = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 4.4), mat(0xb5703d)); warmPotMesh.position.set(0, 1.05, Z.warmPlanter); warm.group.add(warmPotMesh);
  const warmSign = sign('온실', 0, 4.6, Z.warmPlanter + 3.2, { width: 4, lines: ['온실', '25℃ · 따뜻해요'], color: '#c0602a' });
  const warmSprout = sprout(0, Z.warmPlanter - 1);
  checkpoint(platform(8, 1.04, -146, 5, 4, 0xb8dda0), new THREE.Vector3(8, 1, -146), '다리 앞(온도)'); // -112 → -173 구간(61m)을 둘로 나눈다
  const fence2 = fence(Z.bridge2[0]);
  bridge('temp', Z.bridge2[0], Z.bridge2[1], 6.4, 0x68b766);
  const tempNote = dynamicSign(root, { x: 0, y: 4.2, z: Z.bridge2[0] + 0.7, width: 6, rows: 2, color: '#4f8a3c' });
  trigger(0, Z.coldPlanter, 2.2, () => state.plantTemp('cold'));
  const warmTrig = trigger(0, Z.warmPlanter, 2.2, () => state.plantTemp('warm'));

  // ─── ③ 빛 정거장 (물·온도는 같게) ────────────────────
  // 가운데 어두운 터널은 짧고, 옆의 밝은 정원은 돌아간다. 어느 쪽에 심어도 싹이 튼다: 싹이 트는 데는 빛이 필요하지 않다.
  checkpoint(platform(0, 1, -191, 22, 42, 0xd9c8a5), new THREE.Vector3(0, 1, -173), '③ 빛 정거장'); // -170 ~ -212
  sign('③ 빛 정거장', 0, 6.6, -172, { width: 8, lines: ['③ 빛 정거장', '물과 온도는 같아요', '어두운 터널과 밝은 정원, 어디서 싹이 틀까요?'], color: '#6a4c93' });
  tableSign(8, 6.4, -176, ['③ 실험표 · 빛', '다르게 한 것: 빛', '같게 한 것: 물 · 온도', '알아볼 것: 싹이 트는지'], '#6a4c93');
  const predictLightSign = dynamicSign(root, { x: 0, y: 4.6, z: -178, width: 5, rows: 1, color: '#6a4c93' });
  sign('예상 고르기 (선택)', 0, 5.9, -178, { width: 4.4 });
  predictPad(-4.5, -178, '빛이 꼭 필요할 것 같아요', 0xffe08a, 'light', 'need', 4.4);
  predictPad(4.5, -178, '빛이 없어도 틀 것 같아요', 0x59607a, 'light', 'noneed', 4.4);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.MeshBasicMaterial({ color: 0x0b1424, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  curtain.position.set(0, 3.5, -181); root.add(curtain);
  for (const sx of [-1, 1]) block(sx * 3.3, 6, -192, 0.6, 5, 22, 0x2f3346); // 터널 벽 (z -181 ~ -203)
  platform(0, 1.02, -192, 6, 22, 0x3a3f55); // 어두운 바닥
  pot(0, Z.darkPlanter, 0x6b5a4a);
  const darkSprout = sprout(0, Z.darkPlanter - 1);
  sign('어두운 터널', 0, 3.4, -180.8, { width: 4, lines: ['어두운 터널', '빛이 거의 없어요'], color: '#3d405b' });
  const garden = { group: new THREE.Group() };
  root.add(garden.group);
  for (let i = 0; i < 6; i++) {
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), mat([0xff8fab, 0xffd166, 0xf28482][i % 3]));
    flower.position.set((i % 2 ? 2.3 : -2.3), 1.5, -184 - i * 3); garden.group.add(flower);
  }
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), mat(0xffdd55, { emissive: 0xffb703, emissiveIntensity: 0.6 })); sun.position.set(0, 9, -192); garden.group.add(sun);
  const gardenPotMesh = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 4.4), mat(0x9d6b48)); gardenPotMesh.position.set(0, 1.05, Z.gardenPlanter); garden.group.add(gardenPotMesh);
  const gardenSign = sign('밝은 정원', 0, 4.6, -184, { width: 4, lines: ['밝은 정원', '햇빛이 가득해요'], color: '#c07a1a' });
  const gardenSprout = sprout(0, Z.gardenPlanter - 1);
  const fence3 = fence(Z.bridge3[0]);
  bridge('light', Z.bridge3[0], Z.bridge3[1], 6.4, 0x68b766);
  trigger(0, Z.darkPlanter, 2.2, () => state.plantLight('dark'));
  const gardenTrig = trigger(0, Z.gardenPlanter, 2.2, () => state.plantLight('garden'));

  // 꽃잎 고르기(선택): 다리 옆 꽃잎 두 장씩 3줄. 물을 머금은 잎(진한 색·부푼 모양)은 단단, 마른 잎은 밟으면 처져 떨어진다.
  const petals = [];
  PETAL_ROWS.forEach((z, r) => {
    for (let k = 0; k < 2; k++) {
      const petal = platform(PETAL_X[k], 1, z, 3, 3.2, 0xc9cf9a, { dynamic: true });
      petal.material = petal.material.clone();
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(0x52a865)); puff.scale.set(1.35, 0.35, 1.45); puff.position.y = 0.5; petal.add(puff);
      petal.userData.petal = { row: r, k, wet: false, sagAt: null, originalY: petal.position.y, puff };
      petals.push(petal);
    }
  });
  state.petals = petals;
  // 꽃잎 별: 마지막 줄의 물 머금은 꽃잎 위 (마른 잎 쪽으로 가면 못 얻는다). 마지막 줄에서 결승까지 약 4.4m 점프
  const petalStarMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.68), mat(0xffcf33, { emissive: 0xe79b00, emissiveIntensity: 0.72 }));
  root.add(petalStarMesh);
  const petalStar = { mesh: petalStarMesh, got: false };
  level.stars.push(petalStar);
  sign('꽃잎 고르기 (선택)', 9.5, 4.2, -211.5, { width: 4.6, lines: ['꽃잎 고르기 (선택)', '물을 머금은 잎은 진하고 두툼해요', '마른 잎은 밟으면 처져요'], rotY: -0.3 });

  const finish = platform(0, 1.05, Z.finish, 22, 12, 0x8bd0ac);
  finishPad(finish, Z.finish);
  const finalSign = dynamicSign(root, { x: 0, y: 6.8, z: Z.finish - 4, width: 9, rows: 3, color: '#43855c' });

  // ─── 규칙 ───────────────────────────────────────────
  const RESULT_TEXT = {
    good: '알맞은 물이에요! 싹이 잘 터 넓은 잎 다리가 자라요.',
    low: '물이 적어 싹이 작아요. 줄기가 짧아 다리가 끝까지 닿지 않아요. 물을 더해 다시 심어요.',
    excess: '물이 지나쳐 공기가 부족해요. 줄기가 약하고 짧아요. 물을 덜어 다시 심어요.',
  };
  function updateWaterReadout() {
    waterSign.set([`모은 물: ${state.water}방울`, `${state.seedType.label}: ${state.seedType.hint}`]);
  }
  function refreshWater() {
    const r = state.result;
    setOn(state.bridges.good, r === 'good');
    setOn(state.bridges.low, r === 'low');
    setOn(state.bridges.excess, r === 'excess');
    setOn(partialEnd, r === 'low' || r === 'excess');
    partialSign.mesh.visible = r === 'low' || r === 'excess';
    partialSign.set(r === 'low' ? ['줄기가 짧아요', '물을 더해 다시 심어요'] : ['줄기가 약해요', '물을 덜어 다시 심어요']);
    setOn(fence1, !r);
    sprout1.show(r);
  }
  function refreshTemp() {
    const ok = state.temp.result === 'warm';
    setOn(state.bridges.temp, ok); setOn(fence2, !ok);
    warmSprout.show(ok ? 'good' : null);
    tempNote.mesh.visible = !ok;
    tempNote.set(state.temp.result === 'cold' ? ['얼음 창고에서는 싹이 안 텄어요', '따뜻한 곳을 찾아 다시 심어요'] : ['싹이 트면 다리가 자라요', '어느 화분에 심을까요?']);
  }
  function refreshLight() {
    const p = state.light.place;
    setOn(state.bridges.light, !!p); setOn(fence3, !p);
    darkSprout.show(p === 'dark' ? 'good' : null);
    gardenSprout.show(p === 'garden' ? 'good' : null);
  }

  // 예상(가설) 고르기와 결과 비교. 예상은 선택이라 안 골라도 진행되며, 정거장마다 첫 비교만 '맞음/달랐음'으로 센다.
  const PREDICT_LABEL = {
    water: { low: '물이 적을 것 같아요', good: '물이 알맞을 것 같아요', excess: '물이 지나칠 것 같아요' },
    temp: { cold: '얼음 창고에서 틀 것 같아요', warm: '온실에서 틀 것 같아요' },
    light: { need: '빛이 꼭 필요할 것 같아요', noneed: '빛이 없어도 틀 것 같아요' },
  };
  const readoutOf = { water: predictWaterSign, temp: predictTempSign, light: predictLightSign };
  state.setPrediction = (kind, value) => {
    if (!PREDICT_LABEL[kind]?.[value]) return false;
    if (kind === 'light' && state.light.place) return false; // 이미 심은 뒤에는 바꾸지 않는다
    if (kind === 'temp' && state.temp.result === 'warm') return false;
    state.predict[kind] = value;
    readoutOf[kind].set([`내 예상: ${PREDICT_LABEL[kind][value]}`]);
    level.onMessage?.(`내 예상: ${PREDICT_LABEL[kind][value]}. 심어서 확인해 봐요!`, true);
    return true;
  };
  /** 예상이 있으면 결과와 비교한 문장을 돌려주고 예상을 비운다. 없으면 ''. hit이 null이면 아직 판정할 수 없다. */
  function compare(kind, hit, hitText, missText, pendingText) {
    const guess = state.predict[kind];
    if (!guess) return '';
    if (hit === null) return pendingText;
    state.predict[kind] = null;
    readoutOf[kind].set(['예상을 골라 보세요']);
    if (state.hits[kind] === null) state.hits[kind] = hit;
    return `내 예상: ${PREDICT_LABEL[kind][guess]} → ${hit ? hitText : missText} `;
  }
  const hitMark = (v) => (v === null ? '-' : v ? '○' : '△');
  const predictSummary = () => (Object.values(state.hits).every((v) => v === null) ? null : `내 예상  물 ${hitMark(state.hits.water)}  온도 ${hitMark(state.hits.temp)}  빛 ${hitMark(state.hits.light)}`);
  state.chooseRoute = (id) => { if (state.route === id) return; state.route = id; level.onMessage?.(id === 'high' ? '높은 잎길: 짧지만 물방울이 적어요.' : '낮은 샘길: 길지만 물방울이 많아요.', true); };
  state.addWater = () => {
    if (state.water >= WATER_DROPS.max) { level.onMessage?.(`물이 가득해요 (${state.water}방울).`, false); return false; }
    state.water++; state.adjustments++; updateWaterReadout();
    level.onMessage?.(`물을 한 방울 더했어요. 지금 ${state.water}방울`, true); return true;
  };
  state.drainWater = () => {
    if (state.water <= 0) { level.onMessage?.('덜어 낼 물이 없어요.', false); return false; }
    state.water--; state.adjustments++; updateWaterReadout();
    level.onMessage?.(`물을 한 방울 덜었어요. 지금 ${state.water}방울`, true); return true;
  };
  state.plant = (auto = false) => {
    state.result = sproutResult(state.seedType, state.water);
    state.plants++; state.autoPlanted = auto;
    refreshWater();
    if (state.result === 'good' && state.plants === 1 && !firstTryStar.got) firstTryStar.mesh.position.copy(firstTryStar.at); // 한 번에 맞히면 별
    const cmp = compare('water', state.predict.water === state.result, '맞았어요!', '달랐어요. 왜 달랐을까요?');
    level.onMessage?.(`${auto ? '심지 않고 와서 지금 물로 심었어요. ' : ''}${cmp}${RESULT_TEXT[state.result]}`, state.result === 'good');
    return state.result;
  };
  state.plantTemp = (place) => {
    if (state.temp.result === 'warm') { if (place === 'cold') level.onMessage?.('이미 온실에서 싹이 텄어요.', true); return 'warm'; }
    state.temp.tries++;
    state.temp.result = place;
    refreshTemp();
    // 싹이 튼 곳은 온실뿐이다. 얼음 창고에 심었는데 예상이 '온실'이면 아직 판정하지 않는다(온실에도 심어 봐야 안다).
    const cmp = compare('temp', place === 'warm' ? state.predict.temp === 'warm' : state.predict.temp === 'cold' ? false : null, '맞았어요!', '달랐어요.', '얼음 창고에서는 싹이 안 텄어요. 온실에도 심어 예상을 확인해 봐요. ');
    level.onMessage?.(`${cmp}${place === 'warm' ? '따뜻한 온실에서 싹이 텄어요! 싹이 트려면 알맞은 온도가 필요해요.' : '얼음 창고는 너무 차가워 싹이 트지 않아요. 물은 같았는데 무엇이 달랐을까요? 따뜻한 곳을 찾아요.'}`, place === 'warm');
    return place;
  };
  state.plantLight = (place) => {
    if (state.light.place) return state.light.place;
    state.light.place = place; state.light.result = 'good';
    refreshLight();
    // 어두운 곳에서 싹이 터야 '빛이 필요 없다'를 확인한다. 밝은 정원에서 튼 것만으로는 예상을 판정할 수 없다.
    const cmp = compare('light', place === 'dark' ? state.predict.light === 'noneed' : null, '맞았어요!', '달랐어요. 빛이 없어도 싹이 텄어요.', '밝은 정원에서는 싹이 텄어요. 빛이 필요한지는 어두운 곳에서도 확인해야 알 수 있어요. ');
    finalSign.set(['구조 완료!', `물: 알맞게 · 온도: 따뜻하게 · 빛: ${place === 'dark' ? '어두워도 싹이 텄어요' : '밝은 정원'}`, predictSummary() || '싹이 트는 데 빛은 꼭 필요할까요?']);
    level.onMessage?.(`${cmp}${place === 'dark' ? '어두운 터널에서도 싹이 텄어요! 싹이 트는 데는 빛이 필요하지 않아요. (자라는 데는 빛이 필요해요)' : '밝은 정원에서 싹이 텄어요. 어두운 터널이었다면 어땠을까요? 다음에 확인해 봐요.'}`, true);
    return place;
  };
  state.setSeedType = (id) => { const next = SEED_TYPES.find((s) => s.id === id); if (!next) return false; state.seedType = next; seedSign.set([`씨앗 1: ${next.label}`, next.hint]); updateWaterReadout(); return true; };
  state.setWater = (n) => { state.water = THREE.MathUtils.clamp(Math.round(n), 0, WATER_DROPS.max); updateWaterReadout(); };

  function applyLayout(s) {
    const L = state.layout = stationLayout(s);
    // 온실: 출발 쪽 옆(x ±8). 얼음 창고는 가운데 지나가는 길 위.
    const wx = L.warmSide * 8;
    warm.group.position.x = wx; greenhouseFloor.position.x = wx; warmSign.position.x = wx; warmSprout.g.position.x = wx; warmTrig.x = wx;
    // 정원: 터널 벽 바깥 옆(x ±7)
    const gx = L.gardenSide * 7;
    garden.group.position.x = gx; gardenSign.position.x = gx; gardenSprout.g.position.x = gx; gardenTrig.x = gx;
    for (const petal of petals) {
      const info = petal.userData.petal;
      info.wet = L.petals[info.row] === info.k; info.sagAt = null;
      petal.material.color.setHex(info.wet ? 0x438b55 : 0xc9cf9a); info.puff.visible = info.wet;
      petal.position.y = info.originalY; petal.userData.collider.enabled = true;
    }
    petalStarMesh.position.set(PETAL_X[L.petals[PETAL_ROWS.length - 1]], 2.4, PETAL_ROWS.at(-1));
  }
  state.reset = (s = level.seed) => {
    state.seedType = seedTypeFor(s);
    Object.assign(state, { route: null, water: 0, adjustments: 0, result: null, plants: 0, autoPlanted: false, time: 0 });
    state.temp = { result: null, tries: 0 }; state.light = { result: null, place: null };
    state.predict = { water: null, temp: null, light: null }; state.hits = { water: null, temp: null, light: null };
    for (const k of Object.keys(readoutOf)) readoutOf[k].set(['예상을 골라 보세요']);
    for (const tr of triggers) { tr.armed = true; tr.held = 0; }
    for (const d of drops) { d.got = false; d.mesh.visible = true; }
    seedSign.set([`씨앗 1: ${state.seedType.label}`, state.seedType.hint]);
    applyLayout(s);
    updateWaterReadout(); refreshWater(); refreshTemp(); refreshLight();
    finalSign.set(['구조 완료!', '세 정거장에서 무엇이 달랐나요?', '물 · 온도 · 빛']);
    for (const st of level.stars) st.got = false;
    firstTryStar.mesh.position.copy(HIDDEN);
    for (const st of [islandStar, iceStar, petalStar]) st.mesh.visible = true;
    root.updateMatrixWorld(true);
    world.syncDynamic();
  };

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
        if (k > 3) { info.sagAt = null; petal.position.y = info.originalY; petal.userData.collider.enabled = true; }
      }
    }
    if (!player) return;
    const p = player.pos;
    for (const tr of triggers) {
      const d = Math.max(Math.abs(p.x - tr.x), Math.abs(p.z - tr.z));
      const inside = d < tr.half && p.y > 0.9 && p.y < 2.4;
      if (inside) {
        tr.held += dt;
        if (tr.armed && tr.held >= tr.dwell) { tr.armed = false; tr.fn(); }
      } else {
        tr.held = 0;
        if (d > tr.half + 1.2) tr.armed = true;
      }
    }
    if (p.z < -23 && p.z > -62) { if (p.x < -2) state.chooseRoute('high'); else if (p.x > 2) state.chooseRoute('low'); }
    for (const drop of drops) {
      if (drop.got) continue;
      const dx = p.x - drop.mesh.position.x, dy = p.y + 0.9 - drop.mesh.position.y, dz = p.z - drop.mesh.position.z;
      if (dx * dx + dy * dy + dz * dz > WATER_DROPS.radius * WATER_DROPS.radius + 0.6) continue;
      drop.got = true; drop.mesh.visible = false;
      state.water = Math.min(WATER_DROPS.max, state.water + 1); updateWaterReadout();
      level.onMessage?.(`물방울을 모았어요. ${state.water}방울`, true);
    }
    if (!state.result && p.z < Z.bridge1[0] + 1.5 && p.z > Z.bridge1[0] - 1 && p.y > 0.5) state.plant(true); // 울타리 앞에서 지금 물로 심기
  } });

  level.bridgeInfo = { Z };
  finalizeLevel(level);
  const baseReset = level.resetProgress;
  level.resetProgress = () => { baseReset(); state.reset(level.seed); };
  level.setSeed = (s) => { level.seed = s; state.reset(s); };
  level.setSeed(seed);
  return level;
}
