// 맵 6: "거대 실험실"
// 같은 양의 공기를 눌러 부피가 줄어드는 피스톤 장치와 액체에 뜨는 발판을 통과한다.
// 구간: 안전 준비 → 기체 부피 피스톤(+선택 도전 공기 실험대) → 부력과 뜨는 발판 → 실험대 → 출구
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, shuffleGates, sectionFinder } from './kit.js';
import { dynamicSign, rngFor, pick } from './variants.js';

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
  { name: '부력과 뜨는 발판', zMax: -96 },
  { name: '실험대', zMax: -126 },
  { name: '출구', zMax: -150 },
];

// 힘 → 같은 양의 공기가 차지하는 부피(칸, 모형). 세게 누를수록 더 줄어든다.
const AIR_FORCES = [
  { name: '약하게', vol: 12 },
  { name: '보통', vol: 9 },
  { name: '세게', vol: 6 },
];
const AIR_VOLUMES = AIR_FORCES.map((f) => f.vol);

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
  const airBench = buildAirBench();
  const cp1 = platform(0, Y, -74, 16, 10, C.checkpoint);
  checkpoint(cp1, new THREE.Vector3(0, Y, -71), '액체 실험대');
  challengeStar(12.5, Y, -74);

  // ─── 액체 높이와 뜨는 발판 ───────────────────────────
  label('부력', -9, 6, -78, ['물속에 잠긴 물체를', '물이 위로 밀어 올려요'], '#168aad');
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
    airBench.setTarget(pick(rngFor(s, 61), AIR_VOLUMES));
  };
  level.setSeed(seed);
  finalizeLevel(level);
  level.airBench = airBench; // 시험용
  const baseReset = level.resetProgress;
  level.resetProgress = () => { baseReset(); airBench.reset(); };
  return level;

  // ─── 선택 도전: 공기 실험대 ──────────────────────────
  // 힘을 골라 공기를 누르면 부피(칸, 모형)가 바뀌고, 목표 부피와 같으면 문이 열려 별로 간다.
  // 기본 완주와 무관한 선택 활동이다. 문 밖의 길(피스톤 발판)은 이 장치와 연결되지 않는다.
  // 상태는 학생별(미술 공방과 같음). 과학 범위: 같은 양의 공기를 세게 누를수록 부피가 더 줄어든다.
  function buildAirBench() {
    const X0 = 11, ZP = -39.5, ZPAD = -41, ZD = -45; // 발판은 북쪽 줄, 문으로 가는 길(ZP)은 발판 옆
    platform(X0, Y, -39.5, 8, 5, C.floor);
    const state = { sel: null, vol: 12, shownVol: 12, target: 9, lift: 0, pads: [] };
    sign('공기 실험대 · 선택 도전', 9, Y + 7.2, -42.4, { width: 6.5, color: '#326782', lines: ['공기 실험대 · 선택 도전', '힘을 골라 공기를 눌러 봐요', '건너뛰어도 길은 이어져요'] });
    AIR_FORCES.forEach((f, i) => {
      const x = X0 - 2.6 + i * 2.6;
      const material = new THREE.MeshStandardMaterial({ color: 0xcfe8f0, roughness: 0.55 });
      const mesh = platform(x, Y + 0.15, ZPAD, 2, 2, 0xcfe8f0, { material });
      sign(f.name, x, Y + 2.1, ZPAD - 1.3, { width: 2.4, color: '#326782' });
      state.pads.push({ x, i, mesh, occupied: false });
    });
    // 주사기 모양 도식: 같은 개수의 알갱이가 부피에 따라 촘촘해진다 (모형)
    const BY = Y + 1.2, UNIT = 0.5, R = 2;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 12 * UNIT + 0.6, 24, 1, true), new THREE.MeshStandardMaterial({ color: C.glass, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    barrel.position.set(X0, BY + (12 * UNIT + 0.6) / 2, ZD);
    root.add(barrel);
    const plunger = new THREE.Group();
    plunger.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.35, 24), mat(C.yellow, { metalness: 0.25 })));
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 12), mat(C.steel));
    rod.position.y = 2.1;
    plunger.add(rod);
    root.add(plunger);
    const dots = [];
    const dotMat = new THREE.MeshStandardMaterial({ color: 0x168aad, roughness: 0.4 });
    for (let k = 0; k < 12; k++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dotMat);
      dots.push({ mesh: dot, col: k % 3, row: Math.floor(k / 3) });
      root.add(dot);
    }
    const mark = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.07, 6, 28), new THREE.MeshBasicMaterial({ color: 0xef476f }));
    mark.rotation.x = Math.PI / 2;
    root.add(mark);
    const readout = dynamicSign(root, { x: X0, y: BY + 12 * UNIT + 3.4, z: ZD, width: 6, rows: 2, color: '#326782' });
    // 목표 부피 안내판 (문 앞)
    const goalSign = dynamicSign(root, { x: 15, y: Y + 6.6, z: -42.6, width: 4.2, rows: 1, color: '#ef476f' });
    const door = block(15.5, Y + 4.5, ZP, 1, 4.5, 6, 0x5a6b7b, { dynamic: true, castShadow: true });
    const doorHome = door.position.y;
    for (const dz of [-3.4, 3.4]) block(15.5, Y + 6, ZP + dz, 1.6, 6, 1, C.wall, { castShadow: true });
    platform(17, Y, ZP, 4, 4, C.floor);
    challengeStar(19.5, Y, ZP);

    const open = () => state.sel !== null && AIR_FORCES[state.sel].vol === state.target;
    function paint() {
      const f = state.sel === null ? null : AIR_FORCES[state.sel];
      readout.set([`공기 부피 ${Math.round(state.shownVol)}칸 (모형)`, f ? `${f.name} 눌렀어요` : '아직 누르지 않았어요']);
      goalSign.set([`목표 부피 ${state.target}칸`]);
      state.pads.forEach((p) => p.mesh.material.color.setHex(state.sel === p.i ? 0x80ed99 : 0xcfe8f0));
    }
    function place() {
      const v = state.shownVol;
      plunger.position.set(X0, BY + 0.3 + v * UNIT, ZD);
      mark.position.set(X0, BY + 0.3 + state.target * UNIT, ZD);
      const span = Math.max(0.1, v * UNIT - 0.7);
      dots.forEach(({ mesh, col, row }) => mesh.position.set(X0 + (col - 1) * 1.0, BY + 0.55 + (row / 3) * span, ZD + (row % 2 ? 0.35 : -0.35)));
    }
    level.movers.push({ root: null, update(t, dt, player) {
      const p = player?.pos;
      for (const pad of state.pads) {
        const on = !!p && Math.abs(p.x - pad.x) < 1.2 && Math.abs(p.z - ZPAD) < 1.2 && p.y > 1.3 && p.y < 2.8;
        if (on && !pad.occupied) {
          state.sel = pad.i;
          const f = AIR_FORCES[pad.i];
          if (open()) level.onMessage?.(`부피가 ${f.vol}칸이 됐어요! 목표와 같아서 문이 열려요.`, true);
          else level.onMessage?.(`${f.name} 누르면 부피 ${f.vol}칸이에요. 목표는 ${state.target}칸이에요. 다른 힘도 눌러 봐요.`, false);
        }
        pad.occupied = on;
      }
      state.vol = state.sel === null ? 12 : AIR_FORCES[state.sel].vol;
      const d = state.vol - state.shownVol;
      state.shownVol = Math.abs(d) < 0.05 ? state.vol : state.shownVol + Math.sign(d) * Math.min(Math.abs(d), dt * 8);
      state.lift = Math.min(1, Math.max(0, state.lift + (open() ? dt * 2 : -dt * 2)));
      door.position.y = doorHome + state.lift * 5.5;
      door.userData.collider.enabled = state.lift < 0.95;
      place(); paint();
    } });
    state.setTarget = (v) => { state.target = v; place(); paint(); };
    state.reset = () => {
      state.sel = null; state.vol = 12; state.shownVol = 12; state.lift = 0;
      door.position.y = doorHome; door.userData.collider.enabled = true;
      state.pads.forEach((p) => { p.occupied = false; });
      place(); paint();
    };
    state.reset();
    return state;
  }

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
