// 얼음 택배: 고정된 게임 모형으로 포장을 비교하고 실제 배송 경로에서 화물 변화를 본다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { dynamicSign } from './variants.js';

// bulk: 포장을 들고 갈 때의 무게감(게임 규칙). 중력 배율로 점프 높이만 낮춘다. 두꺼운 포장일수록 무겁다.
//   오를 수 있는 턱(시험 측정): A 2.2m 이상, B 1.9m, C 1.5m. 햇빛 길의 바위턱(1.7m)은 A·B만 오른다.
//   점프 + 다이브 거리: A 약 8.0m, B 약 6.6m. 바위 옆 별 섬(틈 7.4m)은 A만 닿는다.
// 그래서 열을 잘 막는 포장(C)은 긴 그늘 길로, 가벼운 포장(A)은 별 섬까지 갈 수 있다. 한 포장이 모든 목표에 유리하지 않다.
export const ICE_PACKS = [
  { id: 'pack-a', name: '포장 A', loss: 0.24, sunFilter: 0.9, bulk: 1, weight: '가벼움', color: 0xf1b36d },
  { id: 'pack-b', name: '포장 B', loss: 0.16, sunFilter: 0.55, bulk: 1.2, weight: '보통', color: 0x86bde0 },
  { id: 'pack-c', name: '포장 C', loss: 0.1, sunFilter: 0.1, bulk: 1.6, weight: '무거움', color: 0xa4ce91 },
];
export const SUN_LEDGE = 1.7; // 햇빛 길 바위턱 높이 (길 바닥 위)
export const SUN_STAR_GAP = 7.4; // 바위 동쪽 끝에서 별 섬까지의 틈
export const BIG_SHOW = 0.55; // 이만큼 남기고 도착하면 큰 얼음 조각 공연 + 별

export function showGrade(remaining) {
  return remaining >= BIG_SHOW ? '큰 얼음 조각 공연' : remaining >= 0.35 ? '중간 얼음 조각 공연' : '작은 얼음 조각 공연';
}
export const ICE_ROUTES = {
  sun: { name: '햇빛 길', exposure: 0.14, length: 22 },
  shade: { name: '그늘 길', exposure: 0, length: 28 },
};
export const TRIAL_DURATION = 2.5;

// ─── 두 번째 배달: 더 먼 마을, 더운 낮 (docs/56) ───
// 새 얼음을 다시 배달한다. 낮이 더워서 햇빛 노출의 영향이 커지고(HOT_DAY), 길마다 거리·노출이 다르다.
// 포장은 처음 고른 것을 그대로 쓰거나 재포장소에서 다시 고른다. 모든 조합은 배달 가능하다(실패 없음).
export const HOT_DAY = 1.6;
export const LEG2_DURATION = 1.5;
export const AMBIENT_MELT_PER_DISTANCE_2 = 0.005;
export const BIG_SHOW_2 = 0.6;
export const ICE_ROUTES_2 = {
  hill: { name: '고갯길', exposure: 0.24, length: 32 },
  forest: { name: '숲길', exposure: 0.1, length: 36 },
  tunnel: { name: '그늘 터널', exposure: 0, length: 44 },
};
export function iceDelivery2(pack, route) {
  const melted = Math.min(1, pack.loss * LEG2_DURATION + route.length * AMBIENT_MELT_PER_DISTANCE_2 + route.exposure * HOT_DAY * pack.sunFilter);
  return { melted, remaining: 1 - melted, delivered: melted < 0.9 };
}
export function showGrade2(remaining) {
  return remaining >= BIG_SHOW_2 ? '큰 얼음 조각 공연' : remaining >= 0.4 ? '중간 얼음 조각 공연' : '작은 얼음 조각 공연';
}
// 두 번째 배달 구간의 위치(z)
export const LEG2 = { plaza: -122, junction: -135, laneTop: -141, laneEnd: -173, merge: -183, gate: -193.2, stage: -203, finish: -206, cp: -160 };
export const LANE_X = { tunnel: -11, forest: 0, hill: 11 };
export const AMBIENT_MELT_PER_DISTANCE = 0.006;

export function iceTrial(pack, duration = TRIAL_DURATION) {
  const melted = Math.min(1, pack.loss * duration);
  return { melted, remaining: 1 - melted };
}

export function iceDelivery(pack, route) {
  const test = iceTrial(pack);
  const travelHeat = route.length * AMBIENT_MELT_PER_DISTANCE;
  const sunlightHeat = route.exposure * pack.sunFilter;
  const melted = Math.min(1, test.melted + travelHeat + sunlightHeat);
  return { melted, remaining: 1 - melted, travelHeat, sunlightHeat, delivered: melted < 0.9 };
}

export function buildIceTaxi(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '얼음 공방', zMax: Infinity },
      { name: '같은 시간 포장 비교', zMax: -17 },
      { name: '배송 경로 선택', zMax: -43 },
      { name: '햇빛·그늘 배송길', zMax: -78 },
      { name: '얼음 공연장 도착', zMax: -112 },
      { name: '재포장소', zMax: -131 },
      { name: '더운 낮의 세 갈래 배달', zMax: -175 },
      { name: '두 번째 공연장', zMax: -215 },
    ]),
    sky: { background: 0xd7f0fa, fog: [0xd7f0fa, 80, 190], hemi: 1.7 },
  });
  const { root, movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, challengeStar } = makeKit(level);
  const state = level.ice = { pack: ICE_PACKS[0], route: null, trial: null, delivery: null, delivered: false };

  platform(0, 0, 1, 22, 20, 0xb5e7ed); startCheckpoint('얼음 공방');
  sign('열을 지키는 얼음 택배', 0, 6, -5, { width: 10, lines: ['포장과 길을 골라 얼음 소품을 배달해요', '화물 상태를 보며 공연장까지 가요'] });
  sign('고정된 게임 모형 · 같은 시간', 0, 3.5, 6, { width: 9, lines: ['같은 양의 얼음 · 같은 주변 온도', '짧은 가상 시간 뒤 남은 양을 비교해요'] });
  platform(0, 0.5, -13, 18, 8, 0xd8f3f4); platform(0, 1, -20, 18, 8, 0xb5e7ed);
  platform(0, 0.8, -28, 16, 10, 0xd8f3f4);

  function iceBlock(x, y, z, scale = 1) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * scale, 1), mat(0x91e3f5, { transparent: true, opacity: 0.83, roughness: 0.18 }));
    mesh.position.set(x, y, z); root.add(mesh); return mesh;
  }
  const samples = ICE_PACKS.map((pack, i) => {
    const x = (i - 1) * 6;
    const base = platform(x, 1.15, -6, 4.2, 4.2, pack.color);
    base.material = base.material.clone();
    sign(`게임 포장 ${pack.name}`, x, 3.5, -8.8, { width: 4.5, lines: [`게임 포장 ${pack.name}`, `무게: ${pack.weight}`] });
    const cube = iceBlock(x, 3.2, -6, 0.9);
    const gauge = platform(x, 2.15, -11, 3.2, 0.5, 0x83d6ed, { thick: 0.2 });
    gauge.material = gauge.material.clone();
    const outcome = iceTrial(pack);
    const resultSign = sign(`${Math.round(outcome.remaining * 100)}% 남음`, x, 4.8, -11, { width: 4.5, color: '#315b73' });
    cube.scale.y = 0.35 + outcome.remaining * 0.8;
    gauge.scale.x = outcome.remaining;
    return { pack, x, base, cube, gauge, resultSign, outcome };
  });
  sign('비교 결과', 0, 8, -15, { width: 7, lines: ['같은 시간 뒤 남은 얼음 양', '게임 속 포장 세 가지를 비교해요'] });

  sign('고른 게임 포장은 도착 시점까지 반영돼요', 0, 2.7, -31, { width: 8 });
  const packChoices = samples.map((sample) => ({ x: sample.x, z: -6, pack: sample.pack, occupied: false, mesh: sample.base }));

  // 도로는 각 경로에서 연속된 넓은 보행면이다. 두 길 모두 낙하 없이 배송장에 합류한다.
  const junction = platform(0, 1, -40, 24, 18, 0xc6e9ef);
  checkpoint(junction, new THREE.Vector3(0, 1, -39), '배송 경로 갈림길');
  sign('어느 길로 배달할까요?', 0, 6, -41, { width: 8, lines: ['햇빛 길: 짧지만 햇빛 · 바위턱을 올라요', '그늘 길: 길지만 평평하고 햇빛이 적어요', '무거운 포장은 높이 뛰지 못해요'] });
  const shadePads = [platform(-7, 1.1, -50, 8, 16, 0x8bc6aa), platform(-7, 1.1, -65, 8, 16, 0x8bc6aa)];
  sign('그늘 길', -7, 4, -49, { width: 4, lines: ['그늘 길', '거리 28 · 햇빛 적음', '평평해요'] });
  sign('햇빛 길', 7, 4.4, -45, { width: 4, lines: ['햇빛 길', '거리 22 · 햇빛 노출', '바위턱: 포장 A·B만'] });
  const merge = platform(0, 1, -80, 24, 20, 0xc6e9ef);
  checkpoint(merge, new THREE.Vector3(0, 1, -75), '공연장 앞');
  sign('공연장 도착 지점', 0, 6, -79, { width: 8, lines: ['여기 도착하면 화물 결과가 보입니다', '포장이 열 이동을 완전히 막지는 않아요'] });
  const laneBlocks = [
    { x: -7, z0: -43, z1: -71, route: ICE_ROUTES.shade },
    { x: 7, z0: -43, z1: -65, route: ICE_ROUTES.sun },
  ];
  // 그늘 길은 평평한 한 판. 햇빛 길은 바닥 → 바위턱(1.7m 오르기) → 바위 위 → 내려와 공연장 앞으로 이어진다.
  const shadeMesh = platform(-7, 1.12, -57, 7.2, 30, 0x8bc6aa);
  const sunFloor = platform(7, 1.12, -46.5, 7.2, 9, 0xf4c782);
  const ledgeTop = 1.12 + SUN_LEDGE;
  block(7, ledgeTop, -55.5, 7.2, ledgeTop, 9, 0xe0a85a, { castShadow: true });
  platform(7, 1.12, -64.9, 7.2, 9.8, 0xf4c782); // 바위에서 내려오는 쪽 (내려오기는 누구나), 공연장 앞 판(-70)까지
  // 바위 동쪽 별 섬(선택): 바위 끝에서 7.4m. 가벼운 포장(A)으로 점프 + 다이브해야 닿는다. 못 닿으면 떨어져 갈림길에서 다시.
  const islandX = 7 + 3.6 + SUN_STAR_GAP + 1.5;
  challengeStar(islandX, ledgeTop, -55.5);
  const rockStar = level.stars.at(-1).mesh;
  sign('바위턱', 3, ledgeTop + 2.4, -50.6, { width: 4.2, color: '#b0641c', lines: [`바위턱 ${SUN_LEDGE}m`, '무거운 포장 C로는 못 올라요', '돌아서 그늘 길로 가도 돼요'], rotY: 0.3 });
  sign('별 섬 (선택)', islandX - 1, ledgeTop + 3.2, -52.5, { width: 4.2, color: '#b0641c', lines: ['별 섬 (선택)', '가벼운 포장이면 점프 + 다이브로', '닿을 수 있어요'], rotY: -0.4 });
  const routeDetector = laneBlocks.map((lane) => ({ ...lane, mesh: lane.x < 0 ? shadeMesh : sunFloor }));
  level.sunRock = { x: 7, zFace: -51, top: ledgeTop, east: 10.6, islandX, star: rockStar };
  const destination = block(8, 6, -100, 8, 10, 1, 0x8296ad);
  const stage = platform(0, 1, -101, 18, 16, 0xd3e4f0);
  stage.material = stage.material.clone();
  level.iceStage = stage;
  const deliveredIce = iceBlock(0, 4, -99, 1.15); deliveredIce.visible = false;
  const sculptureGroup = new THREE.Group(); root.add(sculptureGroup);
  for (let i = 0; i < 5; i++) {
    const piece = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), mat(i % 2 ? 0x91e3f5 : 0xb6f1ff, { transparent: true, opacity: 0.86 }));
    piece.position.set((i - 2) * 1.2, 2 + Math.sin(i) * 0.2, -100); sculptureGroup.add(piece);
  }
  sculptureGroup.visible = false;
  // 큰 공연 별: 많이 남겨 도착했을 때만 무대 위에 나타난다 (아니면 닿지 않는 곳에 숨긴다)
  const showStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.8 }));
  const SHOW_STAR_AT = new THREE.Vector3(-5, 2.4, -97), HIDDEN = new THREE.Vector3(0, -200, 0);
  showStar.position.copy(HIDDEN); root.add(showStar);
  const showStarEntry = { mesh: showStar, got: false };
  level.stars.push(showStarEntry);
  level.showStar = showStarEntry;
  const status = sign('화물 상태', 0, 4, -88, { width: 8 });
  const statusCanvas = document.createElement('canvas'); statusCanvas.width = 768; statusCanvas.height = 256;
  const statusCtx = statusCanvas.getContext('2d'); const statusTexture = new THREE.CanvasTexture(statusCanvas); statusTexture.colorSpace = THREE.SRGBColorSpace;
  status.material.map.dispose(); status.material.map = statusTexture; status.scale.y = 1.8;
  function drawStatus(lines) {
    statusCtx.fillStyle = '#ffffff'; statusCtx.fillRect(0, 0, 768, 256); statusCtx.fillStyle = '#264653';
    statusCtx.textAlign = 'center'; statusCtx.textBaseline = 'middle';
    lines.forEach((line, i) => { statusCtx.font = `bold ${i ? 34 : 42}px sans-serif`; statusCtx.fillText(line, 384, 78 + i * 82); });
    statusTexture.needsUpdate = true;
  }
  drawStatus(['포장과 경로는 선택할 수 있어요', '포장을 건너뛰면 기본 포장으로 배송합니다']);
  const finalGate = block(0, 5, -91.5, 24, 8, 0.8, 0x8296ad, { dynamic: true });
  level.deliveryGate = finalGate;
  checkpoint(stage, new THREE.Vector3(0, 1, -99), '1차 공연장');
  sign('얼음 조각 전시', 0, 8, -101, { width: 8, lines: ['배달된 얼음으로 공연 소품을 만들었어요', `얼음이 ${Math.round(BIG_SHOW * 100)}% 넘게 남으면 큰 공연 별!`, '별 섬과 큰 공연 별은 서로 다른 포장이 필요해요'] });
  challengeStar(10, 1, -84);

  // ═══ 두 번째 배달 (docs/56): 재포장소 → 더운 낮의 세 갈래 → 두 번째 공연장 ═══
  platform(0, 1, -113, 16, 8, 0xc6e9ef);
  sign('두 번째 배달', 0, 6, -112, { width: 9, lines: ['더 먼 마을로 새 얼음을 배달해요', '오늘은 더워요: 햇빛의 영향이 더 커요', '같은 포장도 길에 따라 결과가 달라요'] });
  const plaza = platform(0, 1, LEG2.plaza, 24, 14, 0xd8f3f4);
  checkpoint(plaza, new THREE.Vector3(0, 1, -126), '재포장소');
  sign('재포장소 (선택)', 0, 6.5, -116, { width: 9, lines: ['포장을 다시 고르거나 그대로 가요', '더운 날에는 햇빛을 막는 포장이 더 중요해져요', '무거운 포장은 높이 뛰지 못해요'] });
  const packChoices2 = ICE_PACKS.map((pack, i) => {
    const x = (i - 1) * 6;
    const base = platform(x, 1.15, -121, 4.2, 4.2, pack.color);
    base.material = base.material.clone();
    sign(`2차 ${pack.name}`, x, 3.6, -123.4, { width: 4.2, lines: [`2차 ${pack.name}`, `무게: ${pack.weight}`] });
    return { x, z: -121, pack, base, occupied: false };
  });
  const junction2 = platform(0, 1, LEG2.junction, 34, 12, 0xc6e9ef);
  sign('어느 길로 배달할까요? (더운 낮)', 0, 6.5, -131.5, { width: 9, lines: ['고갯길: 가장 짧지만 햇빛이 세요 · 바위턱', '숲길: 나뭇잎 사이로 햇빛이 조금', '그늘 터널: 가장 길고 햇빛이 닿지 않아요'] });
  const laneFloorY = 1.12;
  const laneLen = LEG2.laneTop - LEG2.laneEnd;
  const laneMid = (LEG2.laneTop + LEG2.laneEnd) / 2;
  const cpPad = (x, name, color) => {
    const pad = platform(x, laneFloorY + 0.13, LEG2.cp, 5, 4, color);
    checkpoint(pad, new THREE.Vector3(x, laneFloorY + 0.16, LEG2.cp), name);
  };
  // 고갯길: 바닥 → 바위턱(1.7m) → 내려오기. 무거운 포장 C는 못 오른다(앞의 햇빛 길과 같은 규칙).
  platform(LANE_X.hill, laneFloorY, -146, 7.2, 10, 0xf4c782);
  const hillTop = laneFloorY + SUN_LEDGE;
  block(LANE_X.hill, hillTop, -155, 7.2, hillTop, 8, 0xe0a85a, { castShadow: true });
  platform(LANE_X.hill, laneFloorY, -166, 7.2, 14, 0xf4c782);
  cpPad(LANE_X.hill, '고갯길 가운데', 0xf4c782);
  challengeStar(LANE_X.hill, hillTop, -155);
  const hillStar = level.stars.at(-1);
  sign('고갯길', LANE_X.hill, 4.2, -142.5, { width: 4.2, lines: ['고갯길', '가장 짧아요 · 햇빛이 세요', '바위턱 위에 별! (가벼운 포장)'] });
  // 숲길: 평평하고 나무 두 그루를 돌아 지난다.
  platform(LANE_X.forest, laneFloorY, laneMid, 7.2, laneLen, 0x8bc6aa);
  block(-1.8, laneFloorY + 3, -150, 3.6, 3, 1.2, 0x3f7d4f);
  block(1.8, laneFloorY + 3, -167, 3.6, 3, 1.2, 0x3f7d4f);
  cpPad(LANE_X.forest, '숲길 가운데', 0x8bc6aa);
  sign('숲길', LANE_X.forest, 4.2, -142.5, { width: 4.2, lines: ['숲길', '나뭇잎 사이로 햇빛이 조금', '나무를 돌아가요'] });
  // 그늘 터널: 벽이 번갈아 막고 있어 지그재그로 걷는다(가장 길다). 지붕은 장식이다.
  platform(LANE_X.tunnel, laneFloorY, laneMid, 7.2, laneLen, 0x6f8fa3);
  [[-147, 1], [-153, -1], [-167, 1], [-171, -1]].forEach(([z, gapSide]) => {
    const w = 5.6, cx = LANE_X.tunnel - gapSide * (7.2 / 2 - w / 2);
    block(cx, laneFloorY + 3.2, z, w, 3.2, 0.8, 0x4a6275);
  });
  cpPad(LANE_X.tunnel, '그늘 터널 가운데', 0x6f8fa3);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, laneLen), mat(0x9fb9c9, { transparent: true, opacity: 0.35 }));
  roof.position.set(LANE_X.tunnel, laneFloorY + 4.4, laneMid); root.add(roof);
  sign('그늘 터널', LANE_X.tunnel, 4.2, -142.5, { width: 4.2, lines: ['그늘 터널', '가장 길어요 · 햇빛이 닿지 않아요', '벽 사이로 돌아가요'] });
  const merge2 = platform(0, 1, LEG2.merge, 34, 22, 0xc6e9ef);
  checkpoint(merge2, new THREE.Vector3(0, 1, -181), '두 번째 공연장 앞');
  sign('두 번째 공연장 도착 지점', 0, 6, -181.5, { width: 8, lines: ['여기 도착하면 두 번째 화물 결과가 보입니다', '1차와 2차를 합친 무대가 열려요'] });
  const stage2 = platform(0, 1, LEG2.stage, 18, 18, 0xd3e4f0);
  stage2.material = stage2.material.clone();
  const deliveredIce2 = iceBlock(0, 4, -202, 1.15); deliveredIce2.visible = false;
  const sculpture2 = new THREE.Group(); root.add(sculpture2);
  for (let i = 0; i < 5; i++) {
    const piece = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), mat(i % 2 ? 0x91e3f5 : 0xb6f1ff, { transparent: true, opacity: 0.86 }));
    piece.position.set((i - 2) * 1.2, 2 + Math.sin(i) * 0.2, -203); sculpture2.add(piece);
  }
  sculpture2.visible = false;
  const gate2 = block(0, 5, LEG2.gate, 34, 8, 0.8, 0x8296ad, { dynamic: true });
  level.deliveryGate2 = gate2;
  const status2 = dynamicSign(root, { x: 0, y: 4.4, z: -187, width: 8, rows: 3 });
  status2.set(['두 번째 배달', '길을 골라 새 얼음을 배달해요', '']);
  const showStar2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.8 }));
  const SHOW_STAR2_AT = new THREE.Vector3(-5, 2.4, -200), HIDDEN2 = new THREE.Vector3(0, -200, 0);
  showStar2.position.copy(HIDDEN2); root.add(showStar2);
  const showStar2Entry = { mesh: showStar2, got: false };
  level.stars.push(showStar2Entry);
  level.showStar2 = showStar2Entry;
  level.hillStar = hillStar;
  sign('두 번의 배달 전시', 0, 8, -203, { width: 8, lines: ['두 번 배달한 얼음으로 무대를 만들었어요', `2차에서 얼음이 ${Math.round(BIG_SHOW_2 * 100)}% 넘게 남으면 큰 공연 별!`, '고갯길 별은 가벼운 포장이 필요해요'] });
  finishPad(stage2, LEG2.finish);
  Object.assign(state, { pack2: null, route2: null, delivery2: null, delivered2: false, carrying2: false });
  const lanes2 = [
    { x: LANE_X.tunnel, route: ICE_ROUTES_2.tunnel },
    { x: LANE_X.forest, route: ICE_ROUTES_2.forest },
    { x: LANE_X.hill, route: ICE_ROUTES_2.hill },
  ];
  let gate2Lift = 0;
  const effectivePack2 = () => state.pack2 ?? state.pack ?? ICE_PACKS[0];
  state.choosePack2 = (pack) => {
    state.pack2 = pack;
    packChoices2.forEach((c) => c.base.material.color.setHex(c.pack.id === pack.id ? 0xffffff : c.pack.color));
    level.onMessage?.(`2차 포장으로 ${pack.name}(${pack.weight})을 골랐어요.${pack.bulk > 1.4 ? ' 무거워서 높이 뛰지 못해요.' : ''} 더운 낮의 길을 골라요.`, true);
  };
  state.chooseRoute2 = (route) => {
    state.route2 = route; state.delivery2 = null; state.delivered2 = false;
    status2.set([`${route.name}을 선택했어요`, '두 번째 공연장에 도착하면 결과가 보여요', '']);
    level.onMessage?.(`${route.name}을 선택했어요. 두 번째 공연장을 향해 가요.`, true);
  };
  state.arrive2 = () => {
    if (state.delivered2 || !state.route2) return;
    const pack = effectivePack2();
    const reused = !state.pack2;
    state.delivery2 = iceDelivery2(pack, state.route2); state.delivered2 = true; state.carrying2 = false;
    deliveredIce2.visible = state.delivery2.delivered;
    sculpture2.visible = state.delivery2.delivered;
    sculpture2.scale.setScalar(0.7 + state.delivery2.remaining * 1.6);
    sculpture2.children.forEach((piece, index) => { piece.visible = index < Math.ceil(state.delivery2.remaining * 6); });
    stage2.material.color.setHex(state.route2 === ICE_ROUTES_2.tunnel ? 0x95b5c6 : state.route2 === ICE_ROUTES_2.forest ? 0x95c5a6 : 0xf2c276);
    const left2 = Math.round(state.delivery2.remaining * 100);
    const left1 = state.delivery ? Math.round(state.delivery.remaining * 100) : null;
    const big = state.delivery2.remaining >= BIG_SHOW_2;
    showStar2.position.copy(big && !showStar2Entry.got ? SHOW_STAR2_AT : HIDDEN2);
    status2.set([`${state.route2.name} 도착 · ${pack.name}${reused ? ' (처음 포장)' : ''}`, `게임 모형 결과: 얼음 약 ${left2}% 남음 · ${showGrade2(state.delivery2.remaining)}`, left1 === null ? '' : `1차 ${left1}% · 2차 ${left2}%`]);
    level.onMessage?.(`도착했어요. ${pack.name} · ${state.route2.name} · 얼음 약 ${left2}% 남음 · ${showGrade2(state.delivery2.remaining)}${big ? '! 무대에 별이 나타났어요.' : '.'}`, true);
    gate2Lift = 0;
  };
  function resetLeg2() {
    Object.assign(state, { pack2: null, route2: null, delivery2: null, delivered2: false, carrying2: false });
    packChoices2.forEach((c) => { c.occupied = false; c.base.material.color.setHex(c.pack.color); });
    deliveredIce2.visible = false; sculpture2.visible = false; sculpture2.scale.setScalar(1);
    sculpture2.children.forEach((piece) => { piece.visible = true; });
    stage2.material.color.setHex(0xd3e4f0);
    gate2.userData.collider.enabled = true; gate2.position.y = 1; gate2Lift = 0;
    showStar2.position.copy(HIDDEN2);
    status2.set(['두 번째 배달', '길을 골라 새 얼음을 배달해요', '']);
  }
  movers.push({ root: null, update(t, dt, player) {
    if (!player) return;
    const p = player.pos;
    for (const choice of packChoices2) {
      const on = Math.abs(p.x - choice.x) < 1.7 && Math.abs(p.z - choice.z) < 1.7 && p.y > 0.8 && p.y < 2;
      if (on && !choice.occupied && state.delivered) { state.choosePack2(choice.pack); choice.occupied = true; }
      if (!on) choice.occupied = false;
    }
    // 갈림길부터 두 번째 화물을 든다(무게 적용). 재포장소로 돌아오면 내려놓고 길을 다시 고를 수 있다.
    if (state.delivered && !state.delivered2) {
      if (p.z < -131) state.carrying2 = true;
      if (p.z > -129 && state.carrying2) { state.carrying2 = false; if (state.route2) { state.route2 = null; status2.set(['재포장소에서 다시 고를 수 있어요', '', '']); } }
      for (const lane of lanes2) {
        const on = Math.abs(p.x - lane.x) < 3.2 && p.z < LEG2.laneTop && p.z > LEG2.laneEnd && p.y > 0.8;
        if (on && state.route2 !== lane.route) state.chooseRoute2(lane.route);
      }
    }
    if (state.route2 && !state.delivered2 && Math.abs(p.x) < 12 && p.z < -185 && p.z > -191) state.arrive2();
    gate2Lift = Math.min(1, gate2Lift + (state.delivered2 ? dt * 1.8 : 0));
    gate2.position.y = 1 + gate2Lift * 8;
    gate2.userData.collider.enabled = gate2Lift < 0.92;
    gate2.updateMatrixWorld(true);
  } });

  state.choosePack = (pack) => {
    state.pack = pack; state.trial = iceTrial(pack);
    samples.forEach((s) => s.base.material.color.setHex(s.pack.id === pack.id ? 0xffffff : s.pack.color));
    drawStatus([`선택한 게임 포장: ${pack.name} (${pack.weight})`, `같은 시간 비교에서 ${Math.round(state.trial.remaining * 100)}% 남았어요`]);
    level.onMessage?.(`${pack.name}(${pack.weight})을 골랐어요.${pack.bulk > 1.4 ? ' 무거워서 높이 뛰지 못해요.' : ''} 배송 길을 선택할 수 있어요.`, true);
  };
  state.chooseRoute = (route) => {
    state.route = route; state.delivery = null; state.delivered = false;
    drawStatus([`${route.name}을 선택했어요`, '공연장에 도착하면 얼음 상태가 보여요']);
    level.onMessage?.(`${route.name}을 선택했어요. 배송장을 향해 계속 가요.`, true);
  };
  state.arrive = () => {
    if (state.delivered || !state.route) return;
    const defaultedPack = !state.pack;
    if (defaultedPack) { state.pack = ICE_PACKS[0]; state.trial = iceTrial(state.pack); }
    state.delivery = iceDelivery(state.pack, state.route); state.delivered = true;
    destination.material.color.setHex(state.route === ICE_ROUTES.shade ? 0x6b8e8b : 0xd18b45);
    deliveredIce.visible = state.delivery.delivered;
    sculptureGroup.visible = state.delivery.delivered;
    sculptureGroup.scale.setScalar(0.7 + state.delivery.remaining * 1.6);
    stage.material.color.setHex(state.route === ICE_ROUTES.shade ? 0x95c5a6 : 0xf2c276);
    sculptureGroup.children.forEach((piece, index) => { piece.visible = index < Math.ceil(state.delivery.remaining * 6); });
    const melted = Math.round(state.delivery.melted * 100);
    const big = state.delivery.remaining >= BIG_SHOW;
    showStar.position.copy(big && !showStarEntry.got ? SHOW_STAR_AT : HIDDEN);
    drawStatus([`${state.route.name} 도착 · ${state.pack.name}${defaultedPack ? ' (기본 포장)' : ''}`, `게임 모형 결과: 얼음 약 ${100 - melted}% 남음 · ${showGrade(state.delivery.remaining)}`]);
    level.onMessage?.(`도착했어요. ${state.pack.name}${defaultedPack ? '을 기본 포장으로 사용' : ''} · 얼음 약 ${100 - melted}% 남음 · ${showGrade(state.delivery.remaining)}${big ? '! 무대에 별이 나타났어요.' : '.'}`, true);
    laneGateLift = 0;
  };
  // 화물을 들고 있는 동안(도착 전)만 포장 무게가 점프 높이를 낮춘다. 포장을 안 골랐으면 가벼운 기본 포장 A와 같다.
  level.gravityAt = () => (state.carrying2 ? effectivePack2().bulk : state.delivered || !state.pack ? 1 : state.pack.bulk);
  level.iceSamples = samples;
  level.iceRoutes = routeDetector;
  let laneGateLift = 0;
  movers.push({ root: null, update(t, dt, player) {
    if (!player) return;
    const p = player.pos;
    for (const choice of packChoices) {
      const on = Math.abs(p.x - choice.x) < 1.7 && Math.abs(p.z - choice.z) < 1.7 && p.y > 0.8 && p.y < 2;
      if (on && !choice.occupied) { state.choosePack(choice.pack); choice.occupied = true; }
      if (!on) choice.occupied = false;
    }
    if (state.route) {
      if (p.z > -42) {
        state.route = null; state.delivered = false; state.delivery = null;
        showStar.position.copy(HIDDEN);
        drawStatus(['갈림길에서 경로를 다시 고를 수 있어요', '다시 배송장을 향해 이동해요']);
      }
    }
    // 도착 전이면 다른 길로 옮겨 가도 그 길로 바뀐다 (바위턱 앞에서 돌아서 그늘 길로 가는 경우)
    if (!state.delivered) {
      for (const lane of routeDetector) {
        const on = Math.abs(p.x - lane.x) < 3.2 && p.z < lane.z0 && p.z > lane.z1 && p.y > 0.8;
        if (on && state.route !== lane.route) state.chooseRoute(lane.route);
      }
    }
    // 도착 지점에서 처음 화물 결과를 계산하고 보여 준다. 경로 진입 순간에는 결과를 미리 확정하지 않는다.
    if (state.route && !state.delivered && Math.abs(p.x) < 9 && p.z < -82 && p.z > -90) state.arrive();
    laneGateLift = Math.min(1, laneGateLift + (state.delivered ? dt * 1.8 : 0));
    finalGate.position.y = 1 + laneGateLift * 8;
    finalGate.userData.collider.enabled = laneGateLift < 0.92;
    finalGate.updateMatrixWorld(true);
  } });
  level.setSeed = (s) => {
    level.seed = s; state.pack = null; state.route = null; state.trial = null; state.delivery = null; state.delivered = false;
    deliveredIce.visible = false; sculptureGroup.visible = false; sculptureGroup.scale.setScalar(1); sculptureGroup.children.forEach((piece) => { piece.visible = true; });
    stage.material.color.setHex(0xd3e4f0); finalGate.userData.collider.enabled = true; finalGate.position.y = 1; laneGateLift = 0;
    samples.forEach((sample) => { sample.base.material.color.setHex(sample.pack.color); });
    showStar.position.copy(HIDDEN);
    drawStatus(['포장과 경로는 선택할 수 있어요', '포장을 건너뛰면 기본 포장으로 배송합니다']);
    resetLeg2();
  };
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.setSeed(level.seed); };
  level.setSeed(seed);
  return level;
}
