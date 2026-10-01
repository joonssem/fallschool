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
};

const SECTIONS = [
  { name: '바다와 증발', zMax: Infinity },
  { name: '증발 상승로', zMax: -27 },
  { name: '응결 구름', zMax: -48 },
  { name: '강수', zMax: -77 },
  { name: '지표수와 지하수', zMax: -101 },
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
  sign('강수', 9, 9, -68, { width: 4.5, color: '#2677b8', lines: ['강수', '구름 속 물방울이', '비가 되어 내려요'], rotY: -0.4 });
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
  sign('지표수', -11, 5, -107, { width: 4, color: '#167d9a', lines: ['지표수', '땅 위를 따라', '강으로 흘러가요'], rotY: 0.4 });
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

  const merge = platform(0, Y, -125, 18, 12, C.seaLight);
  checkpoint(merge, new THREE.Vector3(0, Y, -122), '강 하구');
  sign('강 하구', -9, 6, -123, { width: 4, color: '#167d9a', lines: ['강 하구', '지표수와 지하수가', '바다로 모여요'], rotY: 0.45 });
  platform(0, 0.8, -135, 12, 8, C.sea);
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
  return finalizeLevel(level);

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
