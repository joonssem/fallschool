// 맵 5: "물의 순환 구름 공장"
// 바다에서 증발한 물이 구름에서 응결하고, 비가 되어 지표수·지하수로 흐른 뒤 바다로 돌아가는 코스.
// 구간: 바다 → 증발 상승로 → 응결 구름 → 강수 → 지표수/지하수 → 강 하구 → 바다
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, shuffleGates, sectionFinder } from './kit.js';

const C = {
  sea: 0x45b7d1,
  seaLight: 0x90e0ef,
  land: 0x8bcf8b,
  rock: 0x738b8e,
  cloud: 0xf8fbff,
  rain: 0x64b5f6,
  checkpoint: 0x9be564,
  cave: 0x6d6875,
  soil: 0x9c6644,
  sunny: 0xffd166,
  shade: 0x7d8a99,
};

// 선택 지름길 "증발 상승기": 햇빛 아래(따뜻함)는 빨리, 그늘은 느리게 올라간다. 게임에서의 속도 차이는 과장이다.
// 위치는 시간 t로만 정해져 모든 화면에서 같다. 학생이 서 있는 곳과 무관하게 계산한다(서로 방해하지 않는다).
export const EVAP_LIFTS = {
  sun: { x: 12, rise: 3, top: 1, bottom: 2 }, // 오르는 데 3초, 위에서 1초·아래에서 2초 머문다 (주기 9초)
  shade: { x: -12, rise: 8, top: 1.5, bottom: 2 }, // 주기 19.5초
};
export const EVAP_BOTTOM = 1.5;
export const EVAP_TOP = 7.5;
/** 상승기 높이 비율 0(아래)~1(위). 아래에서 bottom초 머문 뒤 rise초 동안 오르고, top초 머문 뒤 rise초 동안 내려온다 */
export function liftFraction({ rise, top, bottom }, t) {
  const P = 2 * rise + top + bottom;
  const u = ((t % P) + P) % P;
  if (u < bottom) return 0;
  if (u < bottom + rise) return (u - bottom) / rise;
  if (u < bottom + rise + top) return 1;
  return 1 - (u - bottom - rise - top) / rise;
}

const SECTIONS = [
  { name: '바다와 증발', zMax: Infinity },
  { name: '증발 상승로', zMax: -27 },
  { name: '응결 구름', zMax: -48 },
  { name: '강수', zMax: -77 },
  { name: '지표수·지하수·빙하', zMax: -101 },
  { name: '강 하구', zMax: -137 },
  { name: '바다로 돌아가기', zMax: -153 },
];

export function buildWater(parent, world, { seed = Date.now() } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder(SECTIONS),
    sky: { background: 0x9ddcf2, fog: [0x9ddcf2, 90, 210], hemi: 1.45 },
  });
  const root = level.root;
  const { movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, choiceGate, challengeStar } = makeKit(level);
  const Y = 1.5;

  // 시작은 바다 표면. 물은 장식으로 두고, 발판은 물 위에 둔다.
  platform(0, 0, 2, 18, 18, C.sea);
  startCheckpoint('바다');
  sign('물의 순환 구름 공장', -8, 4, -1, {
    width: 7,
    color: '#167d9a',
    lines: ['물의 순환 구름 공장', '바다에서 하늘로,', '다시 바다로!'],
    rotY: 0.45,
  });
  challengeStar(14, 0, -3);

  // 바다에서 구름까지 계단형 발판을 오르며 증발을 시각적으로 표현한다.
  const ascent = [
    [-2, 1.5, -11], [2, 3, -17], [-2, 4.5, -23], [2, 6, -29], [0, 7.5, -35],
  ];
  ascent.forEach(([x, y, z], i) => {
    const p = platform(x, y, z, 8, 7, i % 2 ? C.seaLight : C.land);
    if (i === ascent.length - 1) checkpoint(p, new THREE.Vector3(x, y, z), '구름에 도착');
  });
  sign('증발', -8, 5, -18, { width: 5, color: '#e76f51', lines: ['증발', '물이 눈에 보이지 않는 기체,', '수증기가 되어 올라가요'], rotY: 0.4 });
  sun(18, 14, -21);
  steamDots();
  buildEvapLifts();

  // 구름 속 응결: 공기가 식으면 수증기가 작은 물방울이 된다.
  const cloudPad = platform(0, Y + 6, -43, 16, 10, C.cloud);
  checkpoint(cloudPad, new THREE.Vector3(0, Y + 6, -40), '응결 구름');
  challengeStar(-12.5, Y + 6, -42);
  sign('구름', 10, Y + 10, -37, { width: 5.5, color: '#3986a8', lines: ['구름', '수증기가 식어 생긴 작은 물방울과', '얼음 알갱이예요 (수증기는 안 보여요)'], rotY: -0.4 });
  cloudPuffs(-18, 10, -46, 6);
  cloudDroplets(0, Y + 8.2, -42);
  cloudPuffs(19, 12, -44, 6);
  choiceGate({
    z: -48,
    y: Y + 6,
    name: '응결',
    question: '수증기가 식어 물방울이 되는 현상은?',
    hint: '구름 속 공기의 온도가 내려가면 어떻게 될까요?',
    options: [
      { text: '공기가 식으며 응결', correct: true },
      { text: '더 뜨거워져 증발' },
      { text: '바로 얼어 눈이 됨' },
    ],
    right: '맞아요! 공기가 식으면 수증기(기체)가 작은 물방울로 응결해요. 구름은 이 작은 물방울이나 얼음 알갱이가 모인 것이에요.',
    wrong: '수증기는 눈에 보이지 않는 기체예요. 식으면 작은 물방울로 응결하고, 이 물방울이 모여 구름이 돼요.',
    color: '#3986a8',
  });

  // 구름 사이를 건너 강수 구역으로 내려간다. 작은 발판 두 개는 좌우로 움직인다.
  const cloudSteps = [
    [0, 7.5, -58], [-3, 6, -65], [3, 4.5, -72], [0, 3, -79],
  ];
  cloudSteps.forEach(([x, y, z], i) => {
    const p = platform(x, y, z, i === 1 || i === 2 ? 7 : 9, 6, C.cloud, {
      dynamic: i === 1 || i === 2,
      castShadow: true,
    });
    if (i === 1 || i === 2) {
      const homeX = x;
      movers.push({
        root: p,
        update(t) { p.position.x = homeX + Math.sin(t * 0.7 + i) * 0.8; },
      });
    }
    if (i === cloudSteps.length - 1) checkpoint(p, new THREE.Vector3(x, y, z), '비가 내리는 곳');
  });
  sign('강수', 9, 9, -68, { width: 4.5, color: '#2677b8', lines: ['강수', '구름 속 물방울·얼음 알갱이가', '비나 눈이 되어 내려요'], rotY: -0.4 });
  buildSnowRoute();
  rainCurtain(-70, 5, -6);
  rainCurtain(-77, 4, 6);

  // 땅에 도착한 물은 표면을 흐르거나 땅속으로 스며든다. 두 길은 강 하구에서 만난다.
  const fork = platform(0, Y, -91, 18, 10, C.land);
  checkpoint(fork, new THREE.Vector3(0, Y, -88), '물의 흐름 갈림길');
  challengeStar(12.5, Y, -91);
  sign('비가 땅에 닿으면', -9, 6, -90, { width: 5.5, color: '#39834a', lines: ['비가 땅에 닿으면', '일부는 표면을 흐르고', '일부는 땅속으로 스며들어요'], rotY: 0.45 });

  // 지표수 길: 얕은 물길의 흐름이 진행 방향으로 살짝 밀어 준다.
  const surface = [
    [-5.5, 1.5, -101], [-5.5, 1.5, -108], [-5.5, 1.5, -115],
  ];
  surface.forEach(([x, y, z], i) => platform(x, y, z, 7, 7, i === 1 ? C.seaLight : C.rock));
  sign('지표수', -6, 4.2, -107, { width: 4, color: '#167d9a', lines: ['지표수', '땅 위를 따라', '강으로 흘러가요'], rotY: 0.4 });
  level.windAt = (pos, out) => {
    if (pos.z < -99 && pos.z > -120 && pos.y > 0 && pos.y < 5 && pos.x < -2 && pos.x > -9) out.z -= 1.1;
  };

  // 지하수 길: 흙 단면 아래의 넓은 동굴. 길은 평평하고 밝은 돌로 표시한다.
  platform(5.5, 1.5, -101, 7, 7, C.soil);
  platform(5.5, 1.5, -108, 7, 7, C.soil);
  platform(5.5, 1.5, -115, 7, 7, C.soil);
  block(5.5, 7, -108, 7, 1, 27, C.cave); // 동굴 천장
  for (const x of [1.5, 9.5]) block(x, 5.5, -108, 1, 3, 27, C.cave); // 동굴 옆벽
  for (const z of [-101, -108, -115]) {
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), mat(0x7bdff2, { emissive: 0x2a9dba, emissiveIntensity: 0.45 }));
    glow.position.set(5.5, 3.5, z);
    root.add(glow);
  }
  sign('지하수', 10.5, 4, -104, { width: 4, color: '#754c24', lines: ['지하수', '땅속으로 스며들어', '천천히 흘러가요'], rotY: -0.4 });

  buildGlacierLane();
  const merge = platform(0, Y, -123.5, 18, 9, C.seaLight); // 문 앞까지만 (틀린 문 아래는 비워 둔다)
  checkpoint(merge, new THREE.Vector3(0, Y, -122), '강 하구');
  sign('강 하구', -9, 6, -123, { width: 4, color: '#167d9a', lines: ['강 하구', '지표수·지하수·빙하 녹은 물이', '바다로 모여요'], rotY: 0.45 });
  // 순환 마무리 문: 바다에 닿은 물이 다음에 어떻게 되는지 떠올려 순환을 이어 본다 (틀린 문은 떨어져 강 하구 체크포인트에서 다시)
  choiceGate({
    z: -128,
    y: Y,
    name: '다시 증발',
    question: '바다에 모인 물이 햇빛에 데워지면 다시?',
    hint: ['처음 출발한 곳을 떠올려요.', '바다에서 물은 어떻게 하늘로 올라갔나요?'],
    options: [
      { text: '증발해 수증기가 돼요', correct: true },
      { text: '모두 땅속에 갇혀요' },
      { text: '얼음 알갱이로만 변해요' },
    ],
    right: '맞아요! 바닷물도 햇빛에 데워지면 증발해 눈에 보이지 않는 수증기가 되고, 물의 순환이 다시 시작돼요.',
    wrong: [
      '순환의 처음을 떠올려요. 바다에서 물은 어떻게 하늘로 올라갔나요?',
      '햇빛에 데워진 바닷물은 증발해 수증기가 되어 올라가요. 그래서 물은 계속 순환해요.',
    ],
    color: '#167d9a',
  });
  platform(0, 0.8, -142, 12, 8, C.sea);
  platform(0, 0, -145, 16, 12, C.seaLight);
  const goal = platform(0, 0, -154, 14, 8, C.sea);
  finishPad(goal, -152);
  sign('물은 다시 바다로', 0, 7, -151, { width: 7, color: '#167d9a' });

  // 수면, 태양, 구름과 빗방울은 배경 장식이며 충돌에는 영향을 주지 않는다.
  const waterPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 230),
    new THREE.MeshStandardMaterial({ color: C.sea, transparent: true, opacity: 0.82, roughness: 0.25 }),
  );
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.set(0, -1.5, -76);
  root.add(waterPlane);
  cloudPuffs(-25, 6, -72, 9);
  cloudPuffs(27, 8, -87, 10);

  level.setSeed = (s) => {
    level.seed = s;
    shuffleGates(level, s);
  };
  level.setSeed(seed);
  level.evapLifts = EVAP_LIFTS; // 시험용
  return finalizeLevel(level);

  // 눈 구름 길(선택): 아주 차가운 구름에서는 비 대신 눈이 내린다. 눈 쌓인 구름 발판은 미끄럽다(얼음 바닥).
  // 기본 구름 길(비) 서쪽에 나란히 있고 같은 착지점으로 이어진다. 바깥쪽 둔덕이 막아 옆으로는 잘 떨어지지 않는다.
  function buildSnowRoute() {
    const X = -12, zs = [-61, -68.5, -76], ys = [7, 5.8, 4.6];
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.1, metalness: 0.2 });
    zs.forEach((z, i) => {
      const x = i === 2 ? X + 2.5 : X; // 마지막 칸은 착지점(비 구름 길의 끝)에 거의 맞닿는다
      platform(x, ys[i], z, 9, 6, 0xeaf6ff, { material: snowMat, icy: true, castShadow: true });
      block(x - 4.7, ys[i] + 0.9, z, 0.6, 0.9, 6, C.cloud); // 서쪽 눈 둔덕
      if (i === 1) block(x + 4.7, ys[i] + 0.9, z, 0.6, 0.9, 6, C.cloud); // 가운데 칸은 동쪽도 막는다 (양끝은 드나드는 길)
    });
    challengeStar(X - 8.5, ys[1], zs[1]); // 둔덕 너머 별: 미끄러운 바닥에서 방향을 잡아 뛰어야 한다
    sign('눈 구름 길 (선택)', -6.5, 11.5, -64, { width: 5.2, color: '#3a8fb7', lines: ['눈 구름 길 (선택)', '아주 차가운 구름에서는 눈이 내려요', '눈 쌓인 바닥은 미끄러워요'], rotY: 0.35 });
    const flakes = [];
    for (let i = 0; i < 26; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      root.add(f);
      flakes.push({ f, x: X - 6 + ((i * 7) % 13), z: -58 - ((i * 5) % 22), phase: i / 26 });
    }
    movers.push({ root: null, update(t) {
      for (const k of flakes) {
        const h = (t * 0.12 + k.phase) % 1;
        k.f.position.set(k.x + Math.sin(t * 0.8 + k.phase * 20) * 0.5, 12 - h * 9, k.z);
      }
    } });
  }

  // 빙하 길(선택): 얼음(고체) 위는 미끄럽다. 달리면 멈추기까지 미끄러지니 얼음 기둥 사이를 돌아 나간다.
  // 양옆은 눈 둔덕이 막아 미끄러져도 떨어지지 않는다. 지표수·지하수와 같은 강 하구로 이어진다(옆 길과 무관한 선택).
  function buildGlacierLane() {
    const X = -14, Z0 = -97, Z1 = -122, len = Z0 - Z1;
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfeaf7, roughness: 0.08, metalness: 0.25 });
    platform(-13.5, Y, -91, 9, 10, C.cloud); // 눈 쌓인 입구 (보통 바닥)
    platform(X, Y, (Z0 + Z1) / 2, 7, len, 0xbfeaf7, { material: iceMat, icy: true });
    platform(-13.5, Y, -123.5, 9, 9, C.cloud); // 눈 쌓인 출구
    for (const wx of [X - 3.7, X + 3.7]) block(wx, Y + 1.3, (Z0 + Z1) / 2, 0.8, 1.3, len, C.cloud, { castShadow: true });
    // 얼음 기둥: 지그재그로 서 있어 돌아 나가야 한다 (점프로 넘어도 된다)
    [[X - 1.6, -102], [X + 1.6, -107.5], [X - 1.6, -113], [X + 1.6, -118]].forEach(([x, z]) => block(x, Y + 1.6, z, 1.8, 1.6, 1.8, 0xd9f3fb, { castShadow: true }));
    sign('빙하 길 (선택)', X - 2, 5.2, -92.5, { width: 6, color: '#3a8fb7', lines: ['빙하 길 (선택)', '물이 얼음(고체)으로 쌓여 있어요', '미끄러워요 · 녹은 물은 강으로 가요'], rotY: 0.4 });
    sign('얼음 위', X + 0.5, 4.2, -125.5, { width: 5, color: '#3a8fb7', lines: ['얼음 위는 미끄러워요', '달리다 멈추려면 미리 힘을 빼요'], rotY: 0.4 });
  }

  // 수증기는 눈에 보이지 않는 기체다: 아주 희미한 작은 점으로만 그려 위로 올라가게 한다 (안내판: "점으로 표시")
  function steamDots() {
    const dots = [];
    const geo = new THREE.SphereGeometry(0.14, 6, 4);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }));
      root.add(m);
      dots.push({ m, x: -9 + (i % 5) * 4.5, z: -8 - Math.floor(i / 5) * 9, phase: i * 0.37 });
    }
    movers.push({
      root: null,
      update(t) {
        for (const d of dots) {
          const k = (t * 0.12 + d.phase) % 1;
          d.m.position.set(d.x + Math.sin(t + d.phase * 9) * 0.3, 1 + k * 9, d.z - k * 24);
          d.m.material.opacity = 0.22 * Math.sin(k * Math.PI);
        }
      },
    });
    sign('수증기', 8, 5, -12, { width: 5, color: '#5a6b7b', lines: ['수증기', '보이지 않는 기체예요', '(희미한 점으로 표시)'], rotY: -0.4 });
  }

  // 구름 속 작은 물방울: 응결한 물방울을 알갱이로 보여 준다
  function cloudDroplets(x, y, z) {
    const geo = new THREE.SphereGeometry(0.22, 8, 6);
    const drops = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: C.rain, roughness: 0.25, transparent: true, opacity: 0.85 }));
      m.position.set(x + ((i % 4) - 1.5) * 3.2, y + Math.floor(i / 4) * 0.7, z + ((i * 5) % 4) * 1.5 - 3);
      root.add(m);
      drops.push(m);
    }
    movers.push({ root: null, update(t) { drops.forEach((m, i) => { m.position.y += Math.sin(t * 1.3 + i) * 0.003; }); } });
  }

  // 증발 상승기: 계단과 별개의 선택 지름길. 안 타도 계단으로 구름에 갈 수 있다.
  function buildEvapLifts() {
    for (const [kind, cfg] of Object.entries(EVAP_LIFTS)) {
      const sunny = kind === 'sun';
      const x = cfg.x, dir = Math.sign(x);
      const color = sunny ? C.sunny : C.shade;
      platform(x, 1.5, -9, 6, 6, color); // 아래 승강장
      const lift = platform(x, EVAP_BOTTOM, -14.3, 5, 4.6, sunny ? 0xffb703 : 0x5d6b7a, { dynamic: true, castShadow: true });
      // 신호등: 초록 = 아래에 와 있어 탈 수 있다. 빨강 = 움직이는 중이라 기다린다 (틈으로 떨어져도 안전하게 다시 시작할 뿐이다)
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshBasicMaterial({ color: 0xef476f }));
      lamp.position.set(x, 5, -11.6);
      root.add(lamp);
      movers.push({ root: lift, update(t) {
        const f = liftFraction(cfg, t);
        lift.position.y = EVAP_BOTTOM - 0.5 + f * (EVAP_TOP - EVAP_BOTTOM);
        lamp.material.color.setHex(f < 0.02 ? 0x2ec4b6 : 0xef476f);
      } });
      platform(x, EVAP_TOP, -24, 6, 14, color); // 위 통로: 계단 끝 발판과 이어진다
      platform(x - dir * 4, EVAP_TOP, -32, 8, 6, color);
      challengeStar(x + dir * 5.5, EVAP_TOP, -24); // 상승기를 탄 학생만 쉽게 닿는 별 (계단 길과 무관한 선택 보상)
      sign(sunny ? '햇빛 아래 상승기' : '그늘 상승기', x + dir * 1.2, 4.8, -9, {
        width: 5.2, color: sunny ? '#e76f51' : '#4a5a6a', rotY: -dir * 0.45,
        lines: sunny
          ? ['햇빛 아래 상승기 (선택)', '따뜻하면 증발이 활발해요', '초록 불일 때 타요 (게임에서는 더 빨라요)']
          : ['그늘 상승기 (선택)', '덜 따뜻하면 증발이 느려요', '초록 불일 때 타요 · 계단도 있어요'],
      });
      // 위로 올라가는 희미한 수증기 점: 햇빛 쪽이 더 많고 빠르다 (수증기는 눈에 보이지 않는다: 점은 표시일 뿐)
      const n = sunny ? 10 : 4;
      const dots = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
        root.add(m);
        dots.push({ m, ox: ((i * 7) % 5 - 2) * 0.8, oz: ((i * 3) % 5 - 2) * 0.8, phase: i / n });
      }
      const speed = sunny ? 0.45 : 0.15;
      movers.push({ root: null, update(t) {
        for (const d of dots) {
          const k = (t * speed + d.phase) % 1;
          d.m.position.set(x + d.ox, 2 + k * 8, -14.5 + d.oz);
          d.m.material.opacity = 0.25 * Math.sin(k * Math.PI);
        }
      } });
    }
    cloudPuffs(-12, 11, -14, 4); // 그늘 쪽 구름
  }

  function sun(x, y, z) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(5, 20, 14),
      mat(0xffd166, { emissive: 0xffb703, emissiveIntensity: 0.65 }),
    );
    sphere.position.set(x, y, z);
    root.add(sphere);
  }

  function cloudPuffs(x, y, z, count) {
    const cloud = new THREE.Group();
    const puff = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < count; i++) {
      const part = new THREE.Mesh(puff, mat(C.cloud));
      const a = (i / count) * Math.PI * 2;
      part.position.set(Math.cos(a) * 2.8, Math.sin(a) * 0.7, Math.sin(a * 2) * 1.5);
      part.scale.set(2.2, 1.2 + (i % 3) * 0.25, 1.7);
      cloud.add(part);
    }
    cloud.position.set(x, y, z);
    root.add(cloud);
  }

  function rainCurtain(z, y, x) {
    const drops = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const drop = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.8, 3, 6), mat(C.rain));
      drop.position.set(x + (i - 3) * 0.65, y + (i % 2) * 0.7, z);
      drops.add(drop);
    }
    root.add(drops);
  }
}
