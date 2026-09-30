// 맵 6: "거대 실험실"
// 같은 양의 공기를 눌러 부피가 줄어드는 피스톤 장치와 액체에 뜨는 발판을 통과한다.
// 구간: 안전 준비 → 기체 부피 피스톤 → 액체 높이 실험 → 실험대 → 출구
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, shuffleGates, sectionFinder } from './kit.js';

const C = {
  floor: 0xe8edf2,
  steel: 0x768b9b,
  glass: 0xb9e6ee,
  liquid: 0x4cc9f0,
  liquid2: 0x80ed99,
  checkpoint: 0x9be564,
  yellow: 0xffd166,
  wall: 0x52606d,
  red: 0xef476f,
};

const SECTIONS = [
  { name: '안전 준비', zMax: Infinity },
  { name: '기체 부피 피스톤', zMax: -27 },
  { name: '피스톤 실험대', zMax: -65 },
  { name: '액체 높이 실험', zMax: -96 },
  { name: '실험대', zMax: -126 },
  { name: '출구', zMax: -150 },
];

export function buildGiantLab(parent, world, { seed = Date.now() } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder(SECTIONS),
    sky: { background: 0xdceaf1, fog: [0xdceaf1, 80, 200], hemi: 1.5 },
  });
  const root = level.root;
  const { movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, choiceGate, challengeStar } = makeKit(level);
  const Y = 1.5;

  // ─── 안전 준비 ───────────────────────────────────────
  platform(0, 0, 2, 18, 18, C.floor);
  startCheckpoint('안전 준비');
  sign('거대 실험실', -8, 4, -1, {
    width: 6,
    color: '#326782',
    lines: ['거대 실험실', '공기의 부피와 물의 힘으로', '실험대를 지나가요'],
    rotY: 0.42,
  });
  safetyGlasses(8, 2, -5);
  challengeStar(14, 0, -3);
  const cp0 = platform(0, Y, -10, 16, 8, C.checkpoint);
  checkpoint(cp0, new THREE.Vector3(0, Y, -8), '실험 준비');
  choiceGate({
    z: -14,
    y: Y,
    name: '안전 장비',
    question: '실험을 시작하기 전에 먼저 할 일은?',
    hint: '눈과 몸을 보호할 준비를 해요.',
    options: [
      { text: '보안경 착용', correct: true },
      { text: '시약을 맛보기' },
      { text: '용기를 흔들기' },
    ],
    right: '좋아요! 실험 전에는 보안경 등 필요한 보호 장비를 착용해요.',
    wrong: '실험 전에는 먼저 안전 장비를 확인하고 착용해야 해요.',
    color: '#326782',
  });

  // ─── 기체 부피 피스톤 ────────────────────────────────
  const pistonBase = platform(0, Y, -28, 18, 10, C.floor);
  checkpoint(pistonBase, new THREE.Vector3(0, Y, -25), '피스톤 실험대');
  challengeStar(-12.5, Y, -28);
  label('기체의 부피', -10, Y + 4, -29, ['같은 양의 공기를 누르면', '차지하는 공간이 줄어요'], '#326782');
  choiceGate({
    z: -34,
    y: Y,
    name: '기체 부피',
    question: '피스톤으로 같은 양의 공기를 누르면 부피는?',
    hint: '주사기 끝을 막고 피스톤을 눌러 본 적이 있나요?',
    options: [
      { text: '줄어든다', correct: true },
      { text: '늘어난다' },
      { text: '항상 그대로다' },
    ],
    right: '맞아요! 같은 양의 공기를 누르면 공기가 차지하는 공간(부피)이 줄어들어요.',
    wrong: '피스톤을 누르면 같은 양의 공기가 차지하는 공간이 줄어들어요.',
    color: '#326782',
  });

  // 피스톤 머리 발판이 천천히 오르내린다. 좌우로 건너며 움직임을 살핀다.
  const pistonSteps = [
    [-3, 2.5, -45], [3, 3, -55], [-2, 2.5, -65],
  ];
  pistonSteps.forEach(([x, y, z], i) => {
    pistonHead(x + 4.5, y, z);
    const head = platform(x, y, z, 7, 7, i % 2 ? C.yellow : C.steel, { dynamic: true, castShadow: true });
    const homeY = head.position.y;
    movers.push({
      root: head,
      update(t) { head.position.y = homeY + Math.sin(t * 1.1 + i * 1.7) * 0.35; },
    });
  });
  const cp1 = platform(0, Y, -74, 16, 10, C.checkpoint);
  checkpoint(cp1, new THREE.Vector3(0, Y, -71), '액체 실험대');
  challengeStar(12.5, Y, -74);

  // ─── 액체 높이와 뜨는 발판 ───────────────────────────
  label('액체 높이', -9, 6, -78, ['물속에 잠긴 물체를', '물이 위로 밀어 올려요'], '#168aad');
  const liquid = beaker(0, -3, -93, 10, 0x4cc9f0);
  // 비커 속 발판 하나는 물높이와 함께 천천히 올라갔다 내려온다.
  platform(0, 2.5, -84, 8, 6, C.liquid);
  const float = platform(0, 2.2, -92, 8, 6, C.liquid2, { dynamic: true, castShadow: true });
  platform(0, 4, -100, 8, 6, C.liquid);
  movers.push({
    root: float,
    update(t) {
      const height = 5.4 + (Math.sin(t * 0.45) + 1) * 0.6;
      liquid.scale.y = height / 5;
      liquid.position.y = -3 + height / 2;
      float.position.y = -3 + height + 0.2 - 0.5;
    },
  });
  const cp2 = platform(0, 5.5, -108, 16, 10, C.checkpoint);
  checkpoint(cp2, new THREE.Vector3(0, 5.5, -105), '비커 위쪽');
  choiceGate({
    z: -114,
    y: 5.5,
    name: '뜨는 힘',
    question: '물이 물체를 위로 밀어 올리는 힘은?',
    hint: '물속에서 물체가 가벼워지는 것처럼 느껴져요.',
    options: [
      { text: '부력', correct: true },
      { text: '마찰력' },
      { text: '자기력' },
    ],
    right: '맞아요! 물이 물체를 위로 밀어 올리는 힘을 부력이라고 해요.',
    wrong: '물이 물체를 위로 밀어 올리는 힘은 부력이에요.',
    color: '#168aad',
  });

  // ─── 실험대와 출구 ──────────────────────────────────
  const workbench = platform(0, Y, -128, 20, 12, C.floor);
  checkpoint(workbench, new THREE.Vector3(0, Y, -125), '실험대');
  label('실험 기록', 10, 6, -129, ['공기를 누르면 부피가 줄고', '물은 물체를 위로 밀어 올려요'], '#326782');
  // 유리 막대가 돌아가는 조작 구간을 장식하고, 통로는 넓게 확보한다.
  const stirrer = new THREE.Group();
  stirrer.position.set(0, Y + 2, -139);
  root.add(stirrer);
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 10), mat(C.red, { metalness: 0.2, roughness: 0.35 }));
  stirrer.add(rod);
  movers.push({ root: stirrer, update(t) { stirrer.rotation.y = Math.sin(t * 0.7) * 0.35; } });
  platform(0, 1, -143, 14, 8, C.floor);
  const goal = platform(0, 0, -153, 16, 12, C.checkpoint);
  finishPad(goal, -151);
  sign('실험 완료!', 0, 7, -151, { width: 6, color: '#326782' });

  // 거대 비커·시험관·피스톤 장식은 충돌하지 않는다.
  glassware(-17, -5, -50, 5, 16, 0x80ed99);
  glassware(18, -7, -73, 7, 19, 0x4cc9f0);
  testTube(-13, -2, -112);

  level.setSeed = (s) => {
    level.seed = s;
    shuffleGates(level, s);
  };
  level.setSeed(seed);
  return finalizeLevel(level);

  function label(title, x, y, z, lines, color) {
    sign(title, x, y, z, { width: 7, color, lines, rotY: x < 0 ? 0.4 : -0.4 });
  }

  function safetyGlasses(x, y, z) {
    const frame = new THREE.Group();
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x5bc0eb, transparent: true, opacity: 0.55, metalness: 0.25 });
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.25), lensMat);
      lens.position.x = sx * 0.9;
      frame.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.25), mat(C.steel));
    frame.add(bridge);
    frame.position.set(x, y, z);
    root.add(frame);
  }

  function pistonHead(x, y, z) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 6, 16), mat(C.steel, { metalness: 0.35 }));
    shaft.position.set(x, 2, z);
    root.add(shaft);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.6, 20), mat(C.yellow, { metalness: 0.25 }));
    cap.position.set(x, 5.3, z);
    root.add(cap);
  }

  function beaker(x, y, z, radius, liquidColor) {
    const glassMat = new THREE.MeshStandardMaterial({ color: C.glass, transparent: true, opacity: 0.28, side: THREE.DoubleSide, roughness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 17, 24, 1, true), glassMat);
    body.position.set(x, y + 8.5, z);
    root.add(body);
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, 5, 24),
      mat(liquidColor, { transparent: true, opacity: 0.65, roughness: 0.2 }),
    );
    liquid.position.set(x, y + 3, z);
    root.add(liquid);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.18, 8, 32), mat(C.glass));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, y + 17, z);
    root.add(rim);
    return liquid;
  }

  function glassware(x, y, z, radius, height, liquidColor) {
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.7, radius, height, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: C.glass, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
    );
    outer.position.set(x, y + height / 2, z);
    root.add(outer);
    const fluid = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.65, radius * 0.92, height * 0.35, 20), mat(liquidColor));
    fluid.position.set(x, y + height * 0.2, z);
    root.add(fluid);
  }

  function testTube(x, y, z) {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 8, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: C.glass, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    );
    tube.position.set(x, y + 4, z);
    tube.rotation.z = 0.12;
    root.add(tube);
  }
}
