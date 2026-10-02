// 얼음 택배: 고정된 게임 모형으로 포장을 비교하고 실제 배송 경로에서 화물 변화를 본다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';

export const ICE_PACKS = [
  { id: 'pack-a', name: '포장 A', loss: 0.24, sunFilter: 0.9, color: 0xf1b36d },
  { id: 'pack-b', name: '포장 B', loss: 0.16, sunFilter: 0.55, color: 0x86bde0 },
  { id: 'pack-c', name: '포장 C', loss: 0.1, sunFilter: 0.1, color: 0xa4ce91 },
];
export const ICE_ROUTES = {
  sun: { name: '햇빛 길', exposure: 0.14, length: 22 },
  shade: { name: '그늘 길', exposure: 0, length: 28 },
};
export const TRIAL_DURATION = 2.5;
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
    sign(`게임 포장 ${pack.name}`, x, 3.5, -8.8, { width: 4.5 });
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
  sign('어느 길로 배달할까요?', 0, 6, -41, { width: 8, lines: ['햇빛 길: 짧고 햇빛에 노출돼요', '그늘 길: 길지만 햇빛 노출이 적어요'] });
  const shadePads = [platform(-7, 1.1, -50, 8, 16, 0x8bc6aa), platform(-7, 1.1, -65, 8, 16, 0x8bc6aa)];
  const sunPads = [platform(7, 1.1, -50, 8, 12, 0xf4c782), platform(7, 1.1, -63, 8, 12, 0xf4c782)];
  sign('그늘 길', -7, 4, -49, { width: 4, lines: ['그늘 길', '거리 28 · 햇빛 적음'] });
  sign('햇빛 길', 7, 4, -49, { width: 4, lines: ['햇빛 길', '거리 22 · 햇빛 노출'] });
  const merge = platform(0, 1, -80, 24, 20, 0xc6e9ef);
  checkpoint(merge, new THREE.Vector3(0, 1, -75), '공연장 앞');
  sign('공연장 도착 지점', 0, 6, -79, { width: 8, lines: ['여기 도착하면 화물 결과가 보입니다', '포장이 열 이동을 완전히 막지는 않아요'] });
  const laneBlocks = [
    { x: -7, z0: -43, z1: -71, route: ICE_ROUTES.shade },
    { x: 7, z0: -43, z1: -65, route: ICE_ROUTES.sun },
  ];
  const routeDetector = laneBlocks.map((lane) => {
    const mesh = platform(lane.x, 1.12, (lane.z0 + lane.z1) / 2, 7.2, Math.abs(lane.z1 - lane.z0) + 2, lane.x < 0 ? 0x8bc6aa : 0xf4c782);
    return { ...lane, mesh, latched: false };
  });
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
  finishPad(stage, -104);
  sign('얼음 조각 전시', 0, 8, -101, { width: 8, lines: ['배달된 얼음으로 공연 소품을 만들었어요', '포장과 경로 조합에 따라 무대가 달라져요'] });
  challengeStar(10, 1, -84);

  state.choosePack = (pack) => {
    state.pack = pack; state.trial = iceTrial(pack);
    samples.forEach((s) => s.base.material.color.setHex(s.pack.id === pack.id ? 0xffffff : s.pack.color));
    drawStatus([`선택한 게임 포장: ${pack.name}`, `같은 시간 비교에서 ${Math.round(state.trial.remaining * 100)}% 남았어요`]);
    level.onMessage?.(`${pack.name}을 골랐어요. 배송 길을 선택할 수 있어요.`, true);
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
    drawStatus([`${state.route.name} 도착 · ${state.pack.name}${defaultedPack ? ' (기본 포장)' : ''}`, `게임 모형 결과: 얼음 약 ${100 - melted}% 남음`]);
    level.onMessage?.(`도착했어요. ${state.pack.name}${defaultedPack ? '을 기본 포장으로 사용' : ''} · 얼음 약 ${100 - melted}% 남음 · 세 조합 모두 안전하게 배달돼요.`, true);
    laneGateLift = 0;
  };
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
        routeDetector.forEach((lane) => { lane.latched = false; });
        drawStatus(['갈림길에서 경로를 다시 고를 수 있어요', '다시 배송장을 향해 이동해요']);
      }
    }
    if (!state.route) {
      for (const lane of routeDetector) {
        const on = Math.abs(p.x - lane.x) < 3.2 && p.z < lane.z0 && p.z > lane.z1 && p.y > 0.8 && p.y < 2;
        if (on && !lane.latched) { state.chooseRoute(lane.route); lane.latched = true; }
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
    routeDetector.forEach((lane) => { lane.latched = false; });
    drawStatus(['포장과 경로는 선택할 수 있어요', '포장을 건너뛰면 기본 포장으로 배송합니다']);
  };
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.setSeed(level.seed); };
  level.setSeed(seed);
  return level;
}
