// 맵 2: "태양계 중력 달리기"
// 구역마다 중력이 다르다. 실제 값을 그대로 쓰면 조작이 어려워 게임용으로 조정했고, 안내판에 실제 값을 함께 적는다.
// 구간: 지구 발사대 → 달 크레이터 → 화성 모래 폭풍 → 소행성대 → 목성 소용돌이 → 토성 고리 → 우주 정거장
// 달·화성·목성·토성에는 문이 있다. 문 앞의 중력 구역 경계 때문에 질문의 성격이 다르다 (tests/solar-gates.mjs 가 확인):
//   목성: 문 앞은 소행성대(×0.5), 문 뒤가 목성(×1.6) → 진짜 예측 ("[예측]")
//   달·화성·토성: 이미 그 구역에 들어와 뛰어 본 뒤에 만난다 → 체험 뒤 관찰·비교 질문 ("[관찰]", "[비교]")
//   (달은 로켓 착지가 이미 달 구역이라 문만 앞으로 옮길 수 없다. 거리·착지·별을 건드리지 않고 질문 이름을 흐름에 맞췄다)
// 안내판은 문 뒤에 두어, 판단 → 실제 값 확인 순서가 되게 한다. 안내판에는 "실제"와 "게임(조작용)"을 구분해 적는다.
//
// 점프 거리 참고 (최고 속도 7m/s): 지구 약 5m, 달 약 16m, 화성 약 12m, 소행성대 약 10m, 목성 약 3m, 토성 약 6m
import * as THREE from 'three';
import { mulberry32, createLevel, makeKit, finalizeLevel, shuffleGates } from './kit.js';

// 중력 배율(지구 = 1). z가 zMax보다 작아지면 그 구역.
// real: 실제 값(지구 = 1), note: HUD 꼬리표. 목성·토성은 딛는 땅이 없는 가스 행성이라 실제 값은 구름 꼭대기(1기압 높이) 기준.
const ZONES = [
  { name: '지구', zMax: Infinity, g: 1 },
  { name: '달', zMax: -28, g: 0.33, real: '실제 ×0.17' },
  { name: '화성', zMax: -110, g: 0.45, real: '실제 ×0.38' },
  { name: '소행성대', zMax: -163, g: 0.5, real: '조작용' },
  { name: '목성', zMax: -206, g: 1.6, real: '실제 ×2.5' },
  { name: '토성', zMax: -247, g: 1.07, real: '실제 ×1.07' }, // 실제 값 그대로 (예전 0.9는 지구보다 약해 실제와 방향이 반대였다)
  { name: '우주 정거장', zMax: -290, g: 1, real: '조작용' },
];

function zoneAt(z) {
  let zone = ZONES[0];
  for (const zn of ZONES) if (z < zn.zMax) zone = zn;
  return zone;
}

const fmtG = (g) => `×${g}`;
const hud = (zone) => (zone.real ? `${zone.name} · 게임 중력 ${fmtG(zone.g)} (${zone.real})` : `${zone.name} · 중력 ${fmtG(zone.g)}`);

const C = {
  earth: 0x6fcf97,
  earth2: 0x56ccf2,
  pad: 0xff5d8f,
  checkpoint: 0x9be564,
  moon: 0xd9dce3,
  moonDark: 0xa7abb8,
  mars: 0xe07a5f,
  marsDark: 0xb85c44,
  rock: 0x8d6e63,
  belt: 0xbca58b,
  jupiter: 0xf4a261,
  jupiter2: 0xe76f51,
  saturn: 0xe9c46a,
  ring: 0xf1dca7,
  station: 0xf1faee,
  accent: 0x4cc9f0,
};

export function buildSolar(parent, world, { seed = Date.now() } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: (z) => {
      return hud(zoneAt(z));
    },
    gravityAt: (pos) => zoneAt(pos.z).g,
    sky: { background: 0x0b1026, fog: [0x0b1026, 90, 260], hemi: 1.3 },
  });
  const root = level.root;
  const { movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, choiceGate, challengeStar } = makeKit(level);
  const rand = mulberry32(19690720);

  // 구역 안내판: 길 옆(side = -1 왼쪽, 1 오른쪽)에 세우고 길 쪽을 비스듬히 바라보게 한다
  const info = (side, baseY, z, title, real, game, color = '#6a4c93') =>
    sign(title, side * 10, baseY + 4.5, z - 10, { width: 7, color, lines: [title, real, game], rotY: -side * 0.45 });

  // ─── 지구 발사대 ─────────────────────────────────────
  platform(0, 0, 0, 16, 16, C.earth);
  startCheckpoint('지구 발사대');
  // 도전 별: 중력마다 닿는 거리가 다르다 — 지구 7m, 달 19.5m, 토성 6.5m (보통 점프로는 안 되고 점프 + 다이브로 닿는 거리)
  challengeStar(16.5, 0, -2);
  info(-1, 0, -4, '지구', '중력의 기준 (×1)', '평소처럼 점프해요', '#2a9d8f');
  // 첫 틈은 보통 점프로 넘는 3m (예전 6m는 점프 + 다이브가 필요해 처음 하는 학생이 막혔다)
  platform(0, 1, -13.5, 8, 7, C.earth2);
  platform(0, 2, -24, 8, 8, C.earth);
  const rocket = block(0, 2.25, -25, 2.6, 0.25, 2.6, C.pad, { kind: 'bounce', bounceSpeed: 20 });
  rocket.material = mat(C.pad, { emissive: 0x661133 });
  sign('↑ 로켓 패드: 달까지 날아가요', 0, 5.2, -21, { width: 5.5, color: '#ff5d8f' });
  for (const sx of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3, 4), mat(0xffffff));
    fin.position.set(sx * 3, 3.5, -27);
    root.add(fin);
  }

  // ─── 달 크레이터: 멀리 날아가는 점프 ───────────────────
  // 로켓 착지에 여유를 두려고 앞뒤로 길게 (-31 ~ -47), 끝에 예측 문
  const m1 = platform(0, 8, -39, 14, 16, C.checkpoint);
  checkpoint(m1, new THREE.Vector3(0, 8, -36), '달 도착');
  challengeStar(-28, 8, -39); // 달: 19.5m (도움 점프로 보통 점프를 해도 안 닿게)
  choiceGate({
    z: -47,
    y: 8,
    name: '달',
    question: '[관찰] 달에서 뛰어 보니?',
    hint: '지구에서 뛸 때와 비교해 봐요',
    options: [{ text: '지구보다 높이', correct: true }, { text: '지구와 비슷하게' }, { text: '지구보다 낮게' }],
    right: '맞아요! 달에서 끌어당기는 힘(중력)은 지구의 약 1/6이라서 더 높이·멀리 가요. (게임에서는 조작하기 쉽게 약 1/3로 했어요)',
    wrong: [
      '다시 떠올려 봐요. 지구 발사대에서 뛸 때와 달 위에서 뛸 때, 어느 쪽이 더 높이 올라갔나요?',
      '달의 중력은 지구보다 약해서 같은 힘으로 뛰어도 더 높이 올라가요.',
    ],
  });
  // 문 뒤(-54)부터: 예전 좌표에서 11만큼 뒤로 민 값
  info(1, 9, -52, '달', '실제 중력: 지구의 약 1/6', '게임 중력: 약 1/3 (조작용으로 조정)');
  // 달 높이뛰기 탑(선택): 달의 약한 중력이라야 오르는 높은 계단 (한 칸 +4.5m. 지구 점프 높이는 약 1.9m, 달은 약 5.6m). 꼭대기에 도전 별.
  // 떨어지면 '달 평원' 체크포인트에서 다시 시작한다. 안 올라가도 길은 이어진다.
  const plain = platform(-2, 9, -68, 8, 12, C.moon);
  checkpoint(plain, new THREE.Vector3(-2, 9, -68), '달 평원');
  platform(9, 13.5, -62, 5, 5, C.moonDark);
  platform(16, 18, -66, 5, 5, C.moon);
  challengeStar(9, 22.5, -70);
  sign('달 높이뛰기 (선택)', 6.2, 18.5, -57, { width: 5, color: '#6a4c93', lines: ['달 높이뛰기 (선택)', '약한 중력이라 높은 계단도 올라요', '꼭대기에 별! 떨어져도 괜찮아요'], rotY: -0.45 });
  platform(2, 10, -86, 8, 8, C.moonDark);
  block(2, 13.5, -89.5, 8, 3.5, 1, C.moonDark, { castShadow: true });
  sign('달에서는 이 벽도 넘을 수 있어요', 2, 16.5, -88.9, { width: 7 });
  platform(0, 10, -100, 12, 20, C.moon);
  for (const [x, y, z, r] of [[-4, 8, -35, 1.4], [4.5, 8, -39, 1], [-2, 9, -69, 1.6], [3, 10, -103, 1.8], [-3, 10, -97, 1.1]]) {
    const crater = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 6, 18), mat(C.moonDark));
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(x, y + 0.05, z);
    root.add(crater);
  }

  // ─── 화성 모래 폭풍 ──────────────────────────────────
  const m2 = platform(0, 10, -114, 12, 8, C.checkpoint);
  checkpoint(m2, new THREE.Vector3(0, 10, -114), '화성 도착');
  choiceGate({
    z: -118,
    y: 10,
    name: '화성',
    question: '[비교] 화성의 중력은 지구보다?',
    hint: '지구·달에서 뛴 높이와 비교해요',
    options: [{ text: '지구보다 약해요', correct: true }, { text: '지구와 같아요' }, { text: '지구보다 세요' }],
    right: '맞아요! 화성의 중력은 지구의 약 0.38배예요. (게임에서는 약 0.45배)',
    wrong: [
      '지구에서 뛴 높이와 비교해 보세요. 화성에서는 더 높이 올라갔나요, 낮게 올라갔나요?',
      '화성에서는 지구보다 높이 뛰었죠? 그만큼 화성의 중력은 지구보다 약해요.',
    ],
  });
  // 문 뒤(-125)부터: 예전 좌표에서 18만큼 뒤로 민 값
  info(-1, 10, -119, '화성', '실제 중력: 지구의 약 0.38배', '게임 중력: 약 0.45배 (조작용으로 조정)');
  const marsPath = platform(0, 10, -140, 4, 30, C.mars);
  checkpoint(marsPath, new THREE.Vector3(0, 10, -127), '화성 폭풍 앞'); // 폭풍 길에서 떨어져도 문 앞(-114)까지 되돌아가지 않는다
  // 화성 대협곡 도약(선택): 화성의 약한 중력(×0.45)이라야 건너는 틈. 지구(×1)에서는 같은 틈이 닿지 않는다. 폭풍이 서쪽으로 불 때는 바람이 도와준다.
  // 서쪽 섬(9×9m)은 폭풍으로 더 멀리 날아가도 받아 줄 만큼 넓다. 못 닿으면 협곡 아래로 떨어져 '화성 폭풍 앞'에서 다시 시작한다.
  platform(-16, 10, -142, 9, 9, C.marsDark);
  challengeStar(-16, 10, -142);
  sign('화성 대협곡 도약 (선택)', -9, 15.5, -137, { width: 5.4, color: '#b85c44', lines: ['화성 대협곡 도약 (선택)', '약한 중력이라 이 틈도 뛰어 건너요', '폭풍이 서쪽으로 불 때 도와줘요'], rotY: 0.45 });
  // 게임에서 바람으로 밀어내는 건 도전을 위한 과장: 실제 화성은 대기가 아주 얇아 같은 속도의 바람도 미는 힘이 훨씬 작다
  sign('모래 폭풍', 0, 17.5, -125.6, { width: 7.5, color: '#b85c44', lines: ['모래 폭풍: 바위 옆에서 버텨요', '(게임을 위한 과장이에요)', '실제는 대기가 얇아 힘이 작아요'] });
  // 바람이 불어 가는 쪽 가장자리의 바위
  block(1.8, 11, -130, 0.4, 1, 2.5, C.marsDark);
  block(1.8, 11, -136, 0.4, 1, 2.5, C.marsDark);
  block(-1.8, 11, -145, 0.4, 1, 2.5, C.marsDark);
  block(-1.8, 11, -151, 0.4, 1, 2.5, C.marsDark);

  const storms = [
    // 체크포인트 '화성 폭풍 앞'(부활 z -127) 둘레는 바람이 닿지 않게 -129.5부터 분다 (가만히 서 있어도 밀려 떨어지지 않게, tests/map-rules.mjs)
    { zMin: -140, zMax: -129.5, dir: 1, offset: 0, strength: 0 },
    { zMin: -155, zMax: -140, dir: -1, offset: 2, strength: 0 },
  ];
  for (const st of storms) {
    const COUNT = 50;
    const dust = new THREE.MeshBasicMaterial({ color: 0xf4a261, transparent: true, opacity: 0 });
    st.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), dust, COUNT);
    st.seeds = Array.from({ length: COUNT }, () => ({ y: 10.3 + rand() * 3, z: st.zMin + rand() * (st.zMax - st.zMin), p: rand() }));
    root.add(st.mesh);
  }
  const _m = new THREE.Matrix4();
  movers.push({
    root: null,
    update(t, dt) {
      for (const st of storms) {
        // 4초 주기: 예고 → 강풍 → 약해짐 → 멈춤
        const c = (t + st.offset) % 4;
        st.strength = c < 0.6 ? (c / 0.6) * 0.35 : c < 2.6 ? 1 : c < 3 ? 1 - (c - 2.6) / 0.4 : 0;
        st.mesh.material.opacity = Math.max(0.15, st.strength) * 0.85;
        st.seeds.forEach((sd, i) => {
          sd.p = (sd.p + dt * (0.15 + 0.9 * st.strength)) % 1;
          _m.makeTranslation(st.dir * (-6 + sd.p * 12), sd.y, sd.z);
          st.mesh.setMatrixAt(i, _m);
        });
        st.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  });
  level.windAt = (pos, out) => {
    for (const st of storms) {
      if (st.strength <= 0 || pos.z > st.zMax || pos.z < st.zMin || pos.y < 8 || pos.y > 18) continue;
      out.x += st.dir * st.strength * 3.6;
    }
  };

  // ─── 소행성대: 가운데 바위를 딛고 건너기, 아래에는 궤도를 도는 안전망 발판 ──
  const m3 = platform(0, 10, -159, 10, 8, C.checkpoint);
  checkpoint(m3, new THREE.Vector3(0, 10, -159), '소행성대 앞');
  info(1, 10, -162, '소행성대', '작은 천체들이 띄엄띄엄 있어요', '게임 0.5배는 조작용 (띠 전체 중력 없음)', '#8d6e63');
  platform(0, 10, -173, 6, 6, C.rock);
  const orbit = new THREE.Group();
  orbit.position.set(0, 8, -173);
  root.add(orbit);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    platform(Math.cos(a) * 7, 0, Math.sin(a) * 7, 5, 5, C.belt, { parent: orbit, dynamic: true, castShadow: true });
  }
  movers.push({
    root: orbit,
    update(t) {
      orbit.rotation.y = t * 0.4;
    },
  });
  platform(0, 10, -187, 10, 8, C.rock);
  const rockGeo = new THREE.DodecahedronGeometry(1.05, 0);
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  // 착지 구역(섬 앞쪽)은 비워 두고 뒤쪽에서 굴러다닌다
  [[-187.3, 0], [-189.7, Math.PI]].forEach(([z, phase]) => {
    const box = block(0, 11.6, z, 1.6, 1.6, 1.6, 0, { kind: 'bumper', dynamic: true, material: hidden });
    const rock = new THREE.Mesh(rockGeo, mat(0x6d4c41));
    rock.castShadow = true;
    box.add(rock);
    movers.push({
      root: box,
      update(t) {
        box.position.x = Math.sin(t * 0.8 + phase) * 3.6;
        rock.rotation.set(t * 1.7, t * 1.1, 0);
      },
    });
  });

  // ─── 목성 소용돌이: 점프가 낮다 ─────────────────────────
  const m4 = platform(0, 9, -202, 12, 8, C.checkpoint);
  checkpoint(m4, new THREE.Vector3(0, 9, -202), '목성 앞');
  choiceGate({
    z: -206,
    y: 9,
    name: '목성',
    question: '[예측] 목성에서 점프하면?',
    hint: '이 문 뒤가 목성 구역이에요',
    options: [{ text: '지구보다 낮게', correct: true }, { text: '지구와 비슷하게' }, { text: '지구보다 높이' }],
    right: '맞아요! 목성은 구름 꼭대기 근처 중력이 지구의 약 2.5배예요. 점프가 낮아져요. (목성에는 딛는 땅이 없어서 발판은 게임 장치예요)',
    wrong: [
      '중력이 약한 달에서는 점프가 높았어요. 중력이 강한 곳이라면 어떻게 될까요?',
      '목성의 중력은 지구보다 훨씬 세요(구름 꼭대기 기준 약 2.5배). 중력이 강하면 점프가 낮아져요.',
    ],
    color: '#e76f51',
  });
  // 문 뒤(-213)부터: 예전 좌표에서 25만큼 뒤로 민 값
  info(-1, 9, -207, '목성', '실제: 구름 꼭대기 기준 약 2.5배', '게임 1.6배 · 발판은 게임 장치', '#e76f51');
  platform(0, 9, -216.5, 6, 7, C.jupiter);
  // 목성 패드 별(선택): 점프 패드의 튕겨 오르는 속도는 같아도 중력이 세면 덜 높이 오른다(화성 약 12m, 목성 약 3.5m).
  // 목성에서는 보통 점프(약 1.2m)로 닿지 않는 높은 별 발판에 패드로 오른다.
  const jupPad = block(2.2, 9.25, -216.5, 2.6, 0.25, 2.6, C.pad, { kind: 'bounce', bounceSpeed: 17 });
  jupPad.material = mat(C.pad, { emissive: 0x661133 });
  challengeStar(5.5, 11, -216.5);
  sign('목성 점프 패드 (선택)', 0.5, 14.5, -214, { width: 5, color: '#e76f51', lines: ['목성 점프 패드 (선택)', '중력이 세서 패드로도 낮게 올라요', '패드를 밟고 높은 별 발판으로!'], rotY: -0.3 });
  // 정팔각형 회전판: 길이 2R·폭 2R·tan(22.5°) 직사각형 4장을 45°씩 돌려 겹치면 정팔각형이 된다.
  // 다리와의 틈이 거의 일정하다 (반지름 R=6, 꼭짓점까지 6.49)
  const swirl = new THREE.Group();
  swirl.position.set(0, 9, -226.6);
  root.add(swirl);
  const R = 6;
  const side = 2 * R * Math.tan(Math.PI / 8);
  for (let i = 0; i < 4; i++) {
    const plate = platform(0, 0, 0, 2 * R, side, i % 2 ? C.jupiter : C.jupiter2, { parent: swirl, dynamic: true });
    plate.rotation.y = (i * Math.PI) / 4;
    plate.position.y -= i * 0.004; // 겹친 면이 깜박이지 않게
  }
  sign('대적점 소용돌이', 0, 14, -219.8, { width: 5, color: '#e76f51' });
  movers.push({
    root: swirl,
    update(t) {
      swirl.rotation.y = t * 0.35;
    },
  });
  // 붙어 있는 높은 계단: 떨어질 걱정은 없지만 낮은 점프로 한 칸씩 겨우 오른다
  // 첫 칸은 회전판 꼭짓점(반지름 6.49) 바로 뒤에서 시작해 틈에 빠지지 않게 한다
  platform(0, 9.7, -234.7, 6, 3, C.jupiter);
  platform(0, 10.4, -237.7, 6, 3, C.jupiter2);
  platform(0, 11.1, -243.1, 6, 7.8, C.jupiter);

  // ─── 토성 고리: 다리를 건너며 도는 고리 조각을 넘거나 틈으로 지나기 ──
  const m5 = platform(0, 11, -251, 12, 8, C.checkpoint);
  checkpoint(m5, new THREE.Vector3(0, 11, -251), '토성 앞');
  challengeStar(14, 11, -251); // 토성(×1.07): 보통 점프 5m, 점프 + 다이브 7.75m → 6.5m
  choiceGate({
    z: -255,
    y: 11,
    name: '토성',
    question: '[비교] 토성의 중력은?',
    hint: '목성에서 뛴 느낌과 비교해요',
    options: [{ text: '지구와 비슷해요', correct: true }, { text: '목성만큼 세요' }, { text: '달처럼 약해요' }],
    right: '맞아요! 토성은 목성 다음으로 크지만 구름 꼭대기 근처 중력은 지구와 비슷해요 (약 1.07배). 행성의 중력은 크기만으로 정해지지 않아요',
    wrong: [
      '목성에서 뛸 때보다 점프가 높아졌나요, 낮아졌나요? 지구에서 뛸 때와도 비교해 봐요.',
      '토성도 큰 행성이지만 중력은 지구와 비슷한 정도(약 1.07배)예요. 크기만 보고 판단하면 안 돼요.',
    ],
    color: '#b08900',
  });
  // 문 뒤(-262)부터: 예전 좌표에서 32만큼 뒤로 민 값
  info(1, 11, -256, '토성', '실제: 구름 꼭대기 기준 약 1.07배', '게임 1.07배 · 발판·고리는 게임 장치', '#b08900');
  platform(0, 11, -276, 4, 28, C.station);
  const ring = new THREE.Group();
  ring.position.set(0, 11.6, -274);
  root.add(ring);
  const SEGMENTS = 12;
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const seg = block(Math.cos(a) * 9, 0.2, Math.sin(a) * 9, 2.5, 0.4, 3, i % 2 ? C.ring : C.saturn, {
      parent: ring,
      kind: 'bumper',
      dynamic: true,
      castShadow: true,
    });
    seg.rotation.y = -a;
  }
  movers.push({
    root: ring,
    update(t) {
      ring.rotation.y = t * 0.3;
    },
  });
  sign('고리 조각은 뛰어넘거나 틈으로!', 0, 16, -262.4, { width: 6, color: '#b08900' });

  // ─── 우주 정거장 (골인) ───────────────────────────────
  // 실제 정거장에도 중력은 있다(지표의 약 90%). 떠다니는 건 정거장과 사람이 함께 자유낙하하기 때문. 게임의 ×1은 걷기 위한 조작용 설정.
  info(-1, 11, -283, '우주 정거장', '실제: 중력은 있고 함께 자유낙하해요', '게임 ×1은 걷기 위한 조작용', '#118ab2');
  const station = platform(0, 11, -298, 14, 12, C.station);
  for (const sx of [-1, 1]) block(sx * 6.4, 18, -294, 1, 7, 1, C.accent, { castShadow: true });
  const arch = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.8, 1), mat(C.accent));
  arch.position.set(0, 18.4, -294);
  root.add(arch);
  sign('우주 정거장 도착!', 0, 19.6, -293.45, { width: 6, color: '#118ab2' });
  finishPad(station, -294);

  // ─── 배경: 별, 행성 ──────────────────────────────────
  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    starPos.set([Math.cos(th) * s * 320, u * 256 + 40, Math.sin(th) * s * 320 - 160], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  root.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));

  const planet = (r, color, x, y, z, extra = {}) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 20),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, fog: false, ...extra }),
    );
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };
  planet(26, 0x3a86ff, 0, -34, 10); // 지구 (발밑)
  planet(12, 0xbfc3cc, -45, -8, -71); // 달
  planet(10, 0xc1440e, 48, 2, -138); // 화성
  planet(30, 0xd4a373, 85, 5, -230); // 목성
  planet(6.5, 0xe9c46a, 0, 2, -274); // 토성 (다리 아래, 고리 한가운데)
  planet(14, 0xffd166, -170, 70, -180, { emissive: 0xffb703, emissiveIntensity: 1 }); // 태양

  // 경기마다 예측 문의 정답 위치를 섞는다
  level.setSeed = (s) => {
    level.seed = s;
    shuffleGates(level, s);
  };
  level.setSeed(seed);
  return finalizeLevel(level);
}
