// 맵 1: 장애물 코스 "점프 연구소 시험장"
// 구간: 출발 → 몸풀기 계단 → 숨은 발판 → 회전 막대 광장 → 움직이는 발판·바람 다리 → 시소 다리
//       → (2부 시험 구간) 좁은 평균대 → 징검다리 → 사라지는 발판 → 컨베이어 → 얼음 판 → 점프 패드 탑 → 해머 복도 → 맞바람·돌풍 → 골인 언덕
// 2026-10-02: 이 맵을 "게임성 시험 맵"으로 쓴다. 학생이 쉬는 시간에 혼자 연습하는 맵이라 난이도를 올리고 장애물을 다양하게 시험한다.
// 구간마다 이름(난이도 ★)이 달라 교사 화면의 구간별 낙하 횟수로 어느 장애물이 어려운지 볼 수 있다. docs/31 참고.
import * as THREE from 'three';
import { mulberry32, sectionFinder, createLevel, makeKit, finalizeLevel } from './levels/kit.js';
import { dynamicSign, rngFor, shuffled } from './levels/variants.js';

const COLORS = {
  start: 0xb8a9ff,
  step: 0xffd166,
  step2: 0x7bdff2,
  pad: 0xff5d8f,
  checkpoint: 0x9be564,
  tile: 0x74c0fc,
  plaza: 0xffc6ff,
  bar: 0xff595e,
  pillar: 0x6a4c93,
  mover: 0xffca3a,
  bridge: 0xa0e7e5,
  wall: 0xf1faee,
  fan: 0x577590,
  seesaw: 0xff9f1c,
  ramp: 0x80ed99,
  finish: 0xffe066,
};

export const SECTIONS = [
  { name: '출발', zMax: Infinity },
  { name: '몸풀기 계단', zMax: -8 },
  { name: '숨은 발판', zMax: -35 },
  { name: '회전 막대 광장', zMax: -67 },
  { name: '움직이는 발판', zMax: -108 },
  { name: '바람 다리', zMax: -147 },
  { name: '시소 다리', zMax: -175 },
];

// 난이도 단계 (맵 목록의 변형 맵 id로 고른다: lab=기본, labeasy=쉬움, labhard=어려움. 방 설정(database.rules)은 바꾸지 않는다).
// 쉬움 = 2026-10-02 난이도 상향 이전의 1부 값 + 더 넓고 느린 2부, 기본 = 상향 후 값, 어려움 = 숙련 학생용. 값은 코드 한 곳(여기)에서 조정한다.
export const DIFFICULTY = {
  easy: {
    label: '쉬움', sweep: [1.2, -0.9], mover: 0.8, piston: 1.3, fan: 3.6,
    beam: [2.8, 2.4, 2.0, 1.6], gaps: [2.2, 2.6, 3.0, 3.4, 3.8],
    blink: { P: 4.4, vis: 3.9, warn: 1.0 }, belts: [2.4, 2.6, 3.1], hammer: 0.8,
    wind: { power: 6.5, calm: 1.4, ramp: 0.5, strong: 2.0, fade: 0.5, dirs: ['front', 'left', 'right'] }, // 6.5 < 걷기 7이라 밀려도 뒤로 가지는 않는다
  },
  normal: {
    label: '기본', sweep: [1.5, -1.15], mover: 1.0, piston: 1.6, fan: 4.2,
    beam: [2.4, 1.8, 1.4, 1.0], gaps: [2.4, 3.0, 3.6, 4.1, 4.6],
    blink: { P: 4.4, vis: 3.6, warn: 0.9 }, belts: [3.2, 3.4, 4.2], hammer: 1.0,
    wind: { power: 9, calm: 1.2, ramp: 0.5, strong: 2.2, fade: 0.5, dirs: ['front', 'left', 'right'] },
  },
  hard: {
    label: '어려움', sweep: [1.9, -1.5], mover: 1.3, piston: 2.0, fan: 4.8,
    beam: [2.0, 1.5, 1.2, 0.9], gaps: [2.6, 3.3, 3.9, 4.4, 4.7],
    blink: { P: 4.4, vis: 3.2, warn: 0.8 }, belts: [4.0, 4.2, 5.2], hammer: 1.25,
    wind: { power: 10, calm: 1.0, ramp: 0.5, strong: 2.4, fade: 0.5, dirs: ['front', 'left', 'fr', 'right', 'fl'] }, // 어려움은 비스듬한 바람도 분다
  },
};

export function buildLevel(parent, world, { seed = Date.now(), difficulty = 'normal' } = {}) {
  const D = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const level = createLevel(parent, world, { sectionAt: sectionFinder(SECTIONS), fanZones: [] });
  level.difficulty = difficulty in DIFFICULTY ? difficulty : 'normal';
  const scene = level.root;
  const { movers, checkpoints } = level;
  const { mat, block, platform, ramp, sign, startCheckpoint, checkpoint, finishPad, challengeStar, seesaw: kitSeesaw } = makeKit(level);

  // ─── 출발 ───────────────────────────────────────────
  platform(0, 0, 0, 16, 16, COLORS.start);
  startCheckpoint();
  for (const sx of [-1, 1]) block(sx * 7.4, 7, -7.4, 1, 7, 1, COLORS.pillar, { castShadow: true });
  const arch = new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.8, 1), mat(COLORS.pillar));
  arch.position.set(0, 7.4, -7.4);
  scene.add(arch);
  sign('점프 연구소 시험장', 0, 8.6, -7.35, { width: 9 });

  // ─── 몸풀기 계단 ─────────────────────────────────────
  platform(0, 0.8, -12, 8, 4, COLORS.step);
  platform(-3, 1.6, -17.5, 5, 4, COLORS.step2);
  platform(3, 2.4, -23, 5, 4, COLORS.step);
  platform(0, 0.5, -30, 8, 6, COLORS.step2);
  // 점프 패드
  const pad = block(0, 0.75, -31.2, 2.6, 0.25, 2.6, COLORS.pad, { kind: 'bounce' });
  pad.material = mat(COLORS.pad, { emissive: 0x661133 });
  sign('↑ 점프 패드', 0, 3.2, -27.2, { width: 4, color: '#ff5d8f' });

  // ─── 체크포인트 1 + 숨은 발판 ─────────────────────────
  const cp1 = platform(0, 5, -40, 14, 10, COLORS.checkpoint);
  checkpoint(cp1, new THREE.Vector3(0, 5, -40), '숨은 발판 앞');
  // 도전 별: 발판 끝에서 7m(지구 중력) — 보통 점프 최대 5.5m, 점프 + 다이브 최대 8.5m (시뮬레이션 측정)
  challengeStar(15.5, 5, -40);
  sign('숨은 발판: 진짜 길을 찾아라!', 0, 11, -44.5, { width: 9 });

  // 장식용 난수는 코스 시드와 분리 (방마다 배경이 달라지지 않게)
  const rand = mulberry32(20260928);
  const COLS = 5;
  const ROWS = 8;
  const PITCH = 2.7;
  const TILE = 2.4;
  const tiles = [];
  const tileBase = new THREE.Color(COLORS.tile);

  function startShake(tile) {
    tile.state = 'shaking';
    tile.timer = 0.45;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c - (COLS - 1) / 2) * PITCH;
      const z = -46.5 - r * PITCH;
      const mesh = block(x, 5, z, TILE, 0.6, TILE, 0, {
        material: new THREE.MeshStandardMaterial({ color: tileBase, roughness: 0.5 }),
      });
      const tile = { index: tiles.length, row: r, col: c, mesh, real: false, home: mesh.position.clone(), timer: 0, state: 'idle', fell: false };
      tiles.push(tile);
      mesh.userData.collider.onStand = () => {
        if (tile.real) {
          if (tile.state === 'idle') {
            tile.state = 'stepped';
            mesh.material.color.set(0xb9f2ff);
          }
        } else if (tile.state === 'idle') {
          startShake(tile);
          level.onTileTriggered?.(tile.index);
        }
      };
    }
  }

  // 방 시드로 진짜 길을 정한다 (같은 방이면 모두 같은 길)
  level.setSeed = (s) => {
    level.seed = s;
    level.clearGustCache?.();
    const pathRand = mulberry32(s);
    let col = Math.floor(pathRand() * COLS);
    const path = [];
    for (let r = 0; r < ROWS; r++) {
      path.push(col);
      col = THREE.MathUtils.clamp(col + Math.floor(pathRand() * 3) - 1, 0, COLS - 1);
    }
    for (const tile of tiles) {
      tile.real = path[tile.row] === tile.col;
      tile.state = 'idle';
      tile.fell = false;
      tile.timer = 0;
      tile.mesh.position.copy(tile.home);
      tile.mesh.userData.collider.enabled = true;
      tile.mesh.material.color.copy(tileBase);
    }
    if (level.revealed) level.revealPath();
  };

  // 다른 학생이 밟아 무너진 발판
  level.triggerTile = (index) => {
    const tile = tiles[index];
    if (tile && !tile.real && tile.state === 'idle') startShake(tile);
  };
  movers.push({
    root: null,
    update(t, dt) {
      for (const tile of tiles) {
        if (tile.state === 'shaking') {
          tile.timer -= dt;
          tile.mesh.position.x = tile.home.x + Math.sin(t * 70) * 0.06;
          if (tile.timer <= 0) {
            tile.state = 'falling';
            tile.timer = 3;
            tile.mesh.userData.collider.enabled = false;
          }
        } else if (tile.state === 'falling') {
          tile.timer -= dt;
          tile.mesh.position.y -= dt * 9;
          if (tile.timer <= 0) {
            tile.state = 'idle';
            tile.fell = true;
            tile.mesh.position.copy(tile.home);
            tile.mesh.userData.collider.enabled = true;
            // 한 번 떨어진 가짜 발판은 살짝 어둡게 돌아온다 (기억 단서)
            tile.mesh.material.color.set(0x5a9bd4);
          }
        }
      }
    },
  });
  level.revealPath = () => {
    level.revealed = true;
    for (const tile of tiles) if (tile.real) tile.mesh.material.color.set(0xffe066);
  };

  // ─── 체크포인트 2 + 회전 막대 광장 ──────────────────────
  const cp2 = platform(0, 5, -72, 14, 10, COLORS.checkpoint);
  checkpoint(cp2, new THREE.Vector3(0, 5, -72), '회전 막대 앞');
  challengeStar(-15.5, 5, -72);
  platform(0, 5, -79.5, 5, 5, COLORS.bridge);
  platform(0, 5, -95, 15, 26, COLORS.plaza);
  sign('회전 막대: 낮은 건 넘고, 높은 건 피하라!', 0, 11, -76.8, { width: 10 });

  function sweeper(z, speed, barBottom, pillarH, color) {
    block(0, 5 + pillarH, z, 1.2, pillarH, 1.2, COLORS.pillar, { castShadow: true });
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, z);
    scene.add(pivot);
    const bar = block(0, barBottom + 0.6, 0, 15, 0.6, 0.6, color, {
      parent: pivot,
      kind: 'bumper',
      dynamic: true,
      castShadow: true,
    });
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), mat(0xffffff));
      cap.position.set(sx * 7.5, 0, 0);
      bar.add(cap);
    }
    movers.push({
      root: pivot,
      update(t) {
        pivot.rotation.y = t * speed;
      },
    });
  }
  sweeper(-89, D.sweep[0], 5.3, 2.5, COLORS.bar); // 2026-10-02 난이도 상향: 회전 속도 1.2→1.5, 0.9→1.15 (단계는 DIFFICULTY)
  sweeper(-101, D.sweep[1], 6.95, 3.2, 0x8338ec);

  // ─── 체크포인트 3 + 움직이는 발판 ───────────────────────
  const cp3 = platform(0, 5, -112, 12, 8, COLORS.checkpoint);
  checkpoint(cp3, new THREE.Vector3(0, 5, -112), '움직이는 발판 앞');
  sign('움직이는 발판', 0, 10.5, -115.8, { width: 6 });

  for (const [z, phase] of [[-120.5, 0], [-127, Math.PI]]) {
    const m = platform(0, 5, z, 5.5, 4, COLORS.mover, { dynamic: true, castShadow: true });
    movers.push({
      root: m,
      update(t) {
        m.position.x = Math.sin(t * D.mover + phase) * 3.5; // 속도 0.8→1.0 (난이도 상향)
      },
    });
  }
  [-133, -138.5, -144].forEach((z, i) => {
    const m = platform(0, 5.5, z, 3.5, 3.5, COLORS.mover, { dynamic: true, thick: 0.8, castShadow: true });
    const baseY = m.position.y;
    movers.push({
      root: m,
      update(t) {
        m.position.y = baseY + Math.sin(t * D.piston - i * 1.1) * 1.2; // 속도 1.3→1.6 (난이도 상향)
      },
    });
  });
  platform(0, 5, -150, 8, 6, COLORS.bridge);

  // ─── 바람 다리 ───────────────────────────────────────
  platform(0, 5, -164, 3.5, 22, COLORS.bridge);
  sign('바람 다리: 난간 옆에서 버텨라', 0, 11, -152.8, { width: 9 });
  // 난간 (바람이 불어 가는 쪽 가장자리)
  block(1.55, 6, -158, 0.4, 1, 3, COLORS.wall);
  block(1.55, 6, -163, 0.4, 1, 2.5, COLORS.wall);
  block(-1.55, 6, -168, 0.4, 1, 2.5, COLORS.wall);
  block(-1.55, 6, -172.5, 0.4, 1, 2.5, COLORS.wall);

  function fanZone(zMin, zMax, dir, offset) {
    const zone = { zMin, zMax, dir, offset, strength: 0, blades: [], streaks: null };
    const fanX = -dir * 7.5;
    for (let z = zMax - 2; z >= zMin + 2; z -= 5) {
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.8, 20), mat(COLORS.fan));
      housing.rotation.z = Math.PI / 2;
      housing.position.set(fanX, 6.2, z);
      scene.add(housing);
      const blades = new THREE.Group();
      blades.position.set(fanX + dir * 0.45, 6.2, z);
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.5), mat(0xf1faee));
        b.rotation.x = (i * Math.PI * 2) / 3;
        blades.add(b);
      }
      scene.add(blades);
      zone.blades.push(blades);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), mat(COLORS.fan));
      stand.position.set(fanX, 3, z);
      scene.add(stand);
    }
    // 바람 줄기
    const COUNT = 36;
    const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.05, 0.05), streakMat, COUNT);
    const seeds = [];
    for (let i = 0; i < COUNT; i++) seeds.push({ y: 5.3 + rand() * 2.5, z: zMin + rand() * (zMax - zMin), p: rand() });
    zone.streaks = { mesh: streaks, seeds, mat: streakMat };
    scene.add(streaks);
    level.fanZones.push(zone);
    return zone;
  }
  fanZone(-165, -154, 1, 0);
  fanZone(-175, -165, -1, 2);
  const _m = new THREE.Matrix4();
  movers.push({
    root: null,
    update(t, dt) {
      for (const zone of level.fanZones) {
        // 4초 주기: 0~0.6 예고(가속), 0.6~2.6 강풍, 2.6~3 감속, 3~4 멈춤
        const c = (t + zone.offset) % 4;
        let s = 0;
        if (c < 0.6) s = (c / 0.6) * 0.35;
        else if (c < 2.6) s = 1;
        else if (c < 3) s = 1 - (c - 2.6) / 0.4;
        zone.strength = s;
        for (const b of zone.blades) b.rotation.x += dt * (1 + s * 18);
        const st = zone.streaks;
        st.mat.opacity = Math.max(0, s - 0.3) * 0.8;
        st.seeds.forEach((sd, i) => {
          sd.p = (sd.p + dt * 0.9 * s) % 1;
          const x = zone.dir * (-6 + sd.p * 12);
          _m.makeTranslation(x, sd.y, sd.z);
          st.mesh.setMatrixAt(i, _m);
        });
        st.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  });
  const WIND_SPEED = D.fan; // 3.6→4.2 (난이도 상향)
  level.windAt = (pos, out) => {
    for (const zone of level.fanZones) {
      if (zone.strength <= 0) continue;
      if (pos.z > zone.zMax || pos.z < zone.zMin || pos.y < 3.5 || pos.y > 11) continue;
      if (Math.abs(pos.x) > 9) continue;
      out.x += zone.dir * zone.strength * WIND_SPEED;
    }
  };

  // ─── 체크포인트 4 + 시소 다리 ──────────────────────────
  const cp4 = platform(0, 5, -180, 12, 10, COLORS.checkpoint);
  checkpoint(cp4, new THREE.Vector3(0, 5, -180), '시소 다리 앞');
  challengeStar(14.5, 5, -180);
  sign('시소 다리: 가운데로 걸어라', 0, 11, -184.8, { width: 8 });

  // 시소: 올라탄 모든 학생의 무게로 기운다 (한쪽에 여럿이 몰리면 확 기운다, kit.js)
  function seesaw(z) {
    kitSeesaw({ y: 5, z, width: 6, length: 14, color: COLORS.seesaw });
    const fulcrum = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 4), mat(COLORS.pillar));
    fulcrum.position.set(0, 3.2, z);
    scene.add(fulcrum);
  }
  seesaw(-192.3);
  platform(0, 5, -203.5, 5, 7.8, COLORS.bridge);
  seesaw(-214.7);

  // 시소 안전 길(선택): 학생들의 위치로 기울어지는 시소 대신 지나갈 수 있는 서쪽의 좁은 외길(폭 1.8m).
  // 다른 학생의 위치에 영향을 받지 않아 혼자서도 안정적이다. 대신 좁고 길어서 정밀한 걷기가 필요하다.
  platform(-7.5, 5, -183.5, 3, 4, COLORS.bridge); // 체크포인트 서쪽 끝에서 이어지는 입구
  platform(-9, 5, -204, 1.8, 36, COLORS.bridge); // 외길 (z -186 ~ -222)
  platform(-9, 5, -196, 4, 4, COLORS.bridge); // 쉬는 칸
  platform(-9, 5, -210, 4, 4, COLORS.bridge);
  platform(-7.5, 5, -226, 3, 8, COLORS.bridge); // 시험장 입구 발판 서쪽으로 이어진다
  sign('안전한 외길 (선택)', -13.5, 8.6, -186, { width: 6, color: '#2a9d8f', lines: ['안전한 외길 (선택)', '시소 대신 좁은 길로 가요', '다른 친구의 위치에 흔들리지 않아요'], rotY: 0.45 });

  // ═══ 2부: 시험 구간 ═══════════════════════════════════
  // 장애물 종류마다 구간을 나눠 이름에 난이도(★)를 붙였다. 탈락은 없고 떨어지면 구간 앞 체크포인트로 돌아온다.
  // 움직이는 장애물은 모두 시간 t(방에서는 서버 시계)로 계산해 모든 화면이 같다.
  const ext = []; // 2부 구간 표
  let zc = -222.3; // 다음 구간이 시작하는 z
  const extStart = (name) => ext.push({ name, zMax: zc });
  const extSign = (text, w = 9) => sign(text, 0, 10.5, zc - 0.8, { width: w });
  function stage(label, len = 9) { // 체크포인트 발판
    const z = zc - len / 2;
    const p = platform(0, 5, z, 12, len, COLORS.checkpoint);
    checkpoint(p, new THREE.Vector3(0, 5, z), label);
    zc -= len;
  }
  const extWind = []; // (pos, out, t) 함수들: 컨베이어·맞바람
  const gust = (t, calm, ramp, strong, fade) => { // 0~1 세기의 반복 파형
    const P = calm + ramp + strong + fade;
    const c = ((t % P) + P) % P;
    if (c < calm) return 0;
    if (c < calm + ramp) return (c - calm) / ramp;
    if (c < calm + ramp + strong) return 1;
    return 1 - (c - calm - ramp - strong) / fade;
  };

  extStart('시험장 입구');
  stage('시험장 입구', 10);
  sign('여기부터 시험 구간 (난이도 ★)', 0, 11, -226.4, { width: 9, color: '#e76f51' });
  sign('어려우면 쉬었다 가도 돼요', 0, 8.6, -226.4, { width: 7, color: '#6a4c93' });

  // 1) 좁은 평균대: 폭이 줄어드는 외길
  extStart('좁은 평균대 ★');
  extSign('좁은 평균대: 곧게 걸어라');
  for (const [w, len] of D.beam.map((bw) => [bw, 6])) {
    platform(0, 5, zc - len / 2, w, len, COLORS.bridge);
    zc -= len;
  }
  stage('평균대 뒤');

  // 2) 징검다리: 틈이 점점 벌어진다 (마지막은 달려서 뛰어야 한다)
  extStart('징검다리 ★★');
  extSign('징검다리: 틈이 점점 벌어진다');
  const GAPS = D.gaps; // 마지막 틈은 발판 가장자리 가까이에서 뛰어야 닿는다
  const STONE_X = [0, 1, -1, 1, 0];
  platform(0, 5, zc - 1.7, 3.4, 3.4, COLORS.step);
  zc -= 3.4;
  GAPS.forEach((g, i) => {
    zc -= g;
    platform(STONE_X[i], 5, zc - 1.7, 3.4, 3.4, i % 2 ? COLORS.step : COLORS.step2);
    if (i === 2) challengeStar(10.5, 5, zc - 1.7); // 점프 + 다이브로 닿는 거리
    zc -= 3.4;
  });
  zc -= 3.4; // 마지막 징검다리와 체크포인트 사이 틈 (3.4)
  stage('징검다리 뒤');

  // 3) 사라지는 발판: 깜빡이면 곧 사라진다
  extStart('사라지는 발판 ★★');
  extSign('사라지는 발판: 깜빡이면 곧 사라져요');
  const BLINK = D.blink;
  const blinkTiles = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) {
    const mesh = block((c - 1) * 3.5, 5, zc - 1.75 - r * 3.5, 3.1, 0.6, 3.1, 0, {
      material: new THREE.MeshStandardMaterial({ color: 0x9ad1f5, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 }),
    });
    blinkTiles.push({ mesh, row: r, col: c, phase: (r * 1.1 + c * 1.5) % BLINK.P });
  }
  const blinkState = (phase, t) => { // 0 보임, 1 경고(깜빡임), 2 사라짐
    const u = (((t + phase) % BLINK.P) + BLINK.P) % BLINK.P;
    if (u < BLINK.vis - BLINK.warn) return 0;
    return u < BLINK.vis ? 1 : 2;
  };
  level.blinkTiles = blinkTiles;
  level.blinkState = blinkState;
  movers.push({ root: null, update(t) {
    for (const b of blinkTiles) {
      const st = blinkState(b.phase, t);
      b.mesh.visible = st !== 2;
      b.mesh.userData.collider.enabled = st !== 2;
      b.mesh.material.emissiveIntensity = st === 1 ? (Math.sin(t * 28) > 0 ? 0.55 : 0) : 0;
    }
  } });
  zc -= 7 * 3.5;
  stage('사라지는 발판 뒤');

  // 4) 컨베이어: 바닥이 밀어 준다 (점프하면 벗어난다)
  extStart('컨베이어 ★★');
  extSign('컨베이어: 화살표 방향으로 바닥이 움직여요');
  const BELTS = [{ dx: 0, dz: 1, speed: D.belts[0] }, { dx: 1, dz: 0, speed: D.belts[1] }, { dx: 0, dz: 1, speed: D.belts[2] }];
  const beltZones = [];
  BELTS.forEach((b, i) => {
    const top = zc;
    platform(0, 5, top - 5, 10, 10, i % 2 ? 0x59606b : 0x6b7280);
    const zone = { ...b, zMin: top - 10, zMax: top, xMin: -5, xMax: 5 };
    beltZones.push(zone);
    const chevrons = [];
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.dx ? 1.4 : 3.4, 0.06, b.dx ? 3.4 : 1.0), mat(0xffd166));
      m.position.y = 5.04;
      scene.add(m);
      chevrons.push({ m, k });
    }
    movers.push({ root: null, update(t) {
      for (const { m, k } of chevrons) {
        const f = (((t * b.speed * 0.1 + k / 6) % 1) + 1) % 1;
        m.position.set(b.dx ? -4.5 + f * 9 : ((k % 2) - 0.5) * 4, 5.04, b.dz ? top - 0.5 - f * 9 : top - 2 - (k % 3) * 3);
      }
    } });
    zc -= 10;
  });
  level.beltZones = beltZones;
  extWind.push((pos, out) => {
    for (const z of beltZones) {
      if (pos.y < 4.9 || pos.y > 5.4 || pos.z > z.zMax || pos.z < z.zMin || pos.x < z.xMin || pos.x > z.xMax) continue;
      out.x += z.dx * z.speed;
      out.z += z.dz * z.speed;
    }
  });
  stage('컨베이어 뒤');

  // 5) 얼음 판: 달리다 멈추기 어렵다 (양옆은 눈 둔덕이 막는다)
  extStart('얼음 판 ★★');
  extSign('얼음 판: 미리 힘을 빼요');
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfeaf7, roughness: 0.08, metalness: 0.25 });
  platform(0, 5, zc - 11, 8, 22, 0xbfeaf7, { material: iceMat, icy: true });
  for (const sx of [-1, 1]) block(sx * 4.3, 6.2, zc - 11, 0.6, 1.2, 22, 0xf8fbff, { castShadow: true });
  [[-1.6, 5], [1.6, 11], [-1.6, 17]].forEach(([x, pz]) => block(x, 6.6, zc - pz, 1.8, 1.6, 1.8, 0xd9f3fb, { castShadow: true }));
  zc -= 22;
  stage('얼음 판 뒤');

  // 6) 점프 패드 탑: 패드로 올라갔다가 계단으로 내려온다
  extStart('점프 패드 탑 ★★★');
  extSign('점프 패드 탑: 패드를 밟고 위로!');
  const tower = [{ y: 5, pad: 16 }, { y: 9.4, pad: 17 }, { y: 13.8, pad: 0 }];
  const towerZ = [];
  tower.forEach((lv, i) => {
    zc -= i === 0 ? 0 : 2.4; // 층 사이 틈 2.4m
    const z = zc - 3;
    platform(0, lv.y, z, 6, 6, i % 2 ? COLORS.step : COLORS.step2);
    towerZ.push(z);
    if (lv.pad) {
      const pd = block(0, lv.y + 0.25, z - 1.9, 2.6, 0.25, 2.6, COLORS.pad, { kind: 'bounce', bounceSpeed: lv.pad }); // 앞쪽 가장자리 가까이
      pd.material = mat(COLORS.pad, { emissive: 0x661133 });
    }
    zc -= 6;
  });
  challengeStar(9, 13.8, towerZ[2]); // 꼭대기 옆의 별
  [9.4, 5].forEach((y) => { // 내려오는 계단
    zc -= 3;
    platform(0, y, zc - 3, 6, 6, COLORS.step2);
    zc -= 6;
  });
  level.towerZ = towerZ;
  stage('점프 패드 탑 뒤');

  // 7) 해머 복도: 좁은 복도를 가로지르는 범퍼 (낮은 것은 넘고 높은 것은 기다린다)
  extStart('해머 복도 ★★★');
  extSign('해머 복도: 때를 보고 지나가라');
  platform(0, 5, zc - 13, 8, 26, COLORS.bridge);
  for (const sx of [-1, 1]) block(sx * 4.6, 10, zc - 13, 1.2, 5, 26, COLORS.pillar, { castShadow: true });
  [[4.5, 1.4, 1.5, 0], [10, 2.5, 1.9, 1.7], [15.5, 1.4, 1.7, 3.2], [21, 2.5, 1.4, 0.6]].forEach(([hz, h, omega0, phase]) => {
    const omega = omega0 * D.hammer;
    const hammer = block(0, 5 + h, zc - hz, 3.2, h, 1.4, COLORS.bar, { kind: 'bumper', dynamic: true, castShadow: true });
    movers.push({ root: hammer, update(t) { hammer.position.x = Math.sin(t * omega + phase) * 2.5; } });
  });
  zc -= 26;
  stage('해머 복도 뒤');

  // 8) 맞바람·돌풍: 바람이 앞·왼쪽·오른쪽(어려움은 비스듬히도)에서 번갈아 분다.
  // 가로 벽·세로 벽·ㄱ자 벽 중 바람 방향과 각도를 생각해 벽 뒤에 숨는다. 바람이 오는 쪽으로 6m 안에 벽이 있고 몸이 벽에 가려지면 안전하다(점프로 벽 위로 올라가면 맞는다).
  // 바람 방향과 세기는 시간 t로만 정해져 모든 화면이 같다. 다음 돌풍의 방향은 바람이 시작되기 전(예고)부터 화살표로 보인다.
  extStart('맞바람·돌풍 ★★★');
  extSign('돌풍: 화살표 방향을 보고 벽 뒤에 숨어라');
  const WL = 38, WW = 12; // 길이·폭
  const HZ = { zMin: zc - WL, zMax: zc, xMax: WW / 2, power: D.wind.power };
  platform(0, 5, zc - WL / 2, WW, WL, COLORS.bridge);
  for (const sx of [-1, 1]) block(sx * (WW / 2 + 0.2), 6.2, zc - WL / 2, 0.4, 1.2, WL, 0xcfd8dc); // 가장자리 난간 (옆바람에 밀려도 떨어지지 않게. 낮아서 바람막이는 아니다)
  const R2 = Math.SQRT1_2;
  const WDIR = { front: [0, 1], left: [1, 0], right: [-1, 0], fl: [R2, R2], fr: [-R2, R2] }; // (x, z) 바람이 가는 방향. z+는 시작 쪽
  const WDIR_NAME = { front: '앞에서', left: '왼쪽에서', right: '오른쪽에서', fl: '앞 왼쪽에서', fr: '앞 오른쪽에서' };
  const SEQ = D.wind.dirs;
  const GP = D.wind.calm + D.wind.ramp + D.wind.strong + D.wind.fade;
  // 바람막이 벽: 가로(x로 긴 벽)는 앞바람을, 세로(z로 긴 벽)는 옆바람을, ㄱ자는 비스듬한 바람을 막는다.
  // 6곳, 곳마다 가로 벽 + 세로 벽(ㄱ자) (+ 반대편 세로 벽). 어느 방향의 바람이든 앞쪽 6m 안에 막아 주는 곳이 있게 배치했다(tests/lab.mjs가 확인).
  const WALLS = [];
  [4, 10, 16, 22, 28, 34].forEach((dzs, i) => {
    const side = i % 2 ? 1 : -1;
    WALLS.push({ cx: side * 2, dz: dzs, w: 5, d: 0.8, h: 1.9 }); // 가로 벽 (앞바람)
    WALLS.push({ cx: side * 2 - side * 2.9, dz: dzs + 1.6, w: 0.8, d: 4, h: i % 3 === 2 ? 2.8 : 1.9 }); // 세로 벽 (옆바람, 가로 벽 끝에 붙은 ㄱ자). 보라색은 점프해도 가려지는 높은 벽
    if (i % 2 === 0) WALLS.push({ cx: -side * 3.8, dz: dzs + 3, w: 0.8, d: 3.5, h: 1.9 }); // 반대편 세로 벽
  });
  WALLS.forEach((wl) => { wl.cz = zc - wl.dz; wl.top = 5 + wl.h; });
  for (const wl of WALLS) block(wl.cx, wl.top, wl.cz, wl.w, wl.h, wl.d, wl.h > 2 ? 0x8338ec : COLORS.pillar, { castShadow: true });
  const SHELTER_REACH = 6;
  // 바람이 가는 방향 w=(wx, wz)일 때 pos가 벽에 가려지는가: 바람이 오는 쪽(-w)으로 SHELTER_REACH m 안에 벽이 있고 몸(허리 높이)이 벽보다 낮다
  const sheltered = (pos, w) => {
    for (const wl of WALLS) {
      if (pos.y + 0.9 > wl.top) continue;
      const x0 = wl.cx - wl.w / 2, x1 = wl.cx + wl.w / 2, z0 = wl.cz - wl.d / 2, z1 = wl.cz + wl.d / 2;
      let tmin = 0, tmax = SHELTER_REACH, ok = true;
      for (const [p, d, a, b] of [[pos.x, -w[0], x0, x1], [pos.z, -w[1], z0, z1]]) {
        if (Math.abs(d) < 1e-9) { if (p < a || p > b) { ok = false; break; } }
        else { let t1 = (a - p) / d, t2 = (b - p) / d; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) { ok = false; break; } }
      }
      if (ok) return true;
    }
    return false;
  };
  // 시각 t의 돌풍: 방향, 세기(0~1), 예고 중인지. 한 번의 돌풍은 예고(잔잔) → 거세짐 → 강풍 → 약해짐
  // 돌풍 순서는 경기 시드로 섞는다(같은 방은 모두 같은 순서). 한 바퀴(방향 수만큼) 안에 모든 방향이 한 번씩 나오고,
  // 바퀴가 바뀔 때 같은 방향이 연달아 나오지 않게 한다. 외워서 숨기보다 예고(화살표·안내판)를 보고 판단하게 하려는 것.
  const rawCycle = (c) => shuffled(rngFor(level.seed ?? 0, 100 + c), SEQ);
  const cycleCache = new Map();
  const cycle = (c) => {
    if (!cycleCache.has(c)) {
      const order = rawCycle(c);
      if (order[0] === rawCycle(c - 1).at(-1)) [order[0], order[1]] = [order[1], order[0]];
      if (cycleCache.size > 64) cycleCache.clear();
      cycleCache.set(c, order);
    }
    return cycleCache.get(c);
  };
  level.clearGustCache = () => cycleCache.clear();
  const gustAt = (t) => {
    const k = Math.floor(t / GP);
    const u = t - k * GP;
    const n = SEQ.length, c = Math.floor(k / n);
    const name = cycle(c)[k - c * n];
    let s = 0;
    const { calm, ramp, strong, fade } = D.wind;
    if (u >= calm) s = u < calm + ramp ? (u - calm) / ramp : u < calm + ramp + strong ? 1 : 1 - (u - calm - ramp - strong) / fade;
    return { name, dir: WDIR[name], strength: s, preview: u < calm, u };
  };
  level.gustAt = gustAt;
  level.headwindStrength = (t) => gustAt(t).strength;
  level.sheltered = sheltered;
  level.shelters = WALLS;
  level.headwindZone = HZ;
  // 방향 화살표 (예고: 노랑, 강풍: 빨강, 약해지는 중: 회색). 길 위 세 곳에 세운다.
  const arrows = [4, 19, 34].map((dzA) => {
    const a = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 9.5, zc - dzA), 4.2, 0xffe066, 1.4, 0.9);
    scene.add(a);
    return a;
  });
  const windLabel = dynamicSign(scene, { x: 0, y: 12.5, z: zc - 1.5, width: 6.4, rows: 2, color: '#577590' });
  const streaks = [];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    scene.add(m);
    streaks.push({ m, lat: ((i * 37) % 13) - 6, y: 5.6 + (i % 4) * 0.7, p: i / 26 });
  }
  const cz0 = zc - WL / 2;
  movers.push({ root: null, update(t, dt) {
    const g = gustAt(t);
    const [wx, wz] = g.dir;
    const color = g.strength >= 1 ? 0xef476f : g.strength > 0 ? 0xf4845f : g.preview ? 0xffe066 : 0x90a4ae;
    for (const a of arrows) { a.setDirection(new THREE.Vector3(wx, 0, wz)); a.setColor(color); }
    windLabel.set([`바람 ${WDIR_NAME[g.name]} 불어요`, g.preview ? '곧 시작! 벽 뒤로 숨어요' : g.strength >= 1 ? '강풍! 벽 뒤에서 버텨요' : '바람이 약해져요']);
    for (const k of streaks) {
      k.p = (k.p + dt * (0.1 + g.strength * 0.9)) % 1;
      const along = (k.p - 0.5) * 34;
      k.m.position.set(wx * along + wz * k.lat, k.y, cz0 + wz * along - wx * k.lat); // 바람 방향으로 흐르고, 옆(수직) 위치는 줄마다 다르다
      k.m.rotation.y = Math.atan2(wx, wz);
      k.m.material.opacity = g.strength * 0.55;
    }
  } });
  extWind.push((pos, out, t) => {
    if (pos.z > HZ.zMax || pos.z < HZ.zMin || pos.y < 4.5 || pos.y > 10 || Math.abs(pos.x) > HZ.xMax + 0.5) return;
    const g = gustAt(t);
    if (g.strength <= 0 || sheltered(pos, g.dir)) return;
    out.x += g.dir[0] * g.strength * HZ.power;
    out.z += g.dir[1] * g.strength * HZ.power;
  });
  zc -= WL;
  stage('맞바람·돌풍 뒤');
  extStart('골인 언덕');
  const dz = zc + 222; // 골인 구간을 새 끝(zc)으로 옮기는 값 (음수)

  // 바람 계산 합치기 (선풍기 + 컨베이어 + 맞바람). 맞바람은 시간이 필요해 마지막 갱신 시각을 쓴다.
  const baseWind = level.windAt;
  let lastT = 0;
  movers.push({ root: null, update(t) { lastT = t; } });
  level.windAt = (pos, out) => {
    baseWind(pos, out);
    for (const f of extWind) f(pos, out, lastT);
  };
  level.sectionAt = sectionFinder([...SECTIONS, ...ext]);

  // ─── 골인 언덕 ───────────────────────────────────────
  const rise = 3;
  const run = 12;
  ramp(0, -222 + dz, 5, -222 + dz - run, 5 + rise, 8, COLORS.ramp);
  sign('골인 언덕', 0, 12, -221.5 + dz, { width: 5 });

  [[-225, 0], [-229.5, Math.PI]].forEach(([z0, phase]) => {
    const z = z0 + dz;
    const y = 5 + ((-222 + dz - z) / run) * rise;
    const bumper = block(0, y + 1.4, z, 1.4, 1.4, 1.4, COLORS.bar, { kind: 'bumper', dynamic: true, castShadow: true });
    movers.push({
      root: bumper,
      update(t) {
        bumper.position.x = Math.sin(t * 1.4 + phase) * 3.2;
      },
    });
  });

  const finish = platform(0, 8, -240 + dz, 14, 12, COLORS.finish);
  for (const sx of [-1, 1]) block(sx * 6.4, 15, -236 + dz, 1, 7, 1, COLORS.pillar, { castShadow: true });
  const goalArch = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.8, 1), mat(COLORS.pad));
  goalArch.position.set(0, 15.4, -236 + dz);
  scene.add(goalArch);
  sign('골인!', 0, 16.6, -235.45 + dz, { width: 4, color: '#ff5d8f' });
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.25, 8, 5), mat(0xffd60a, { emissive: 0x664400 }));
  crown.position.set(0, 10, -242 + dz);
  scene.add(crown);
  movers.push({ root: null, update(t) { crown.rotation.y = t * 1.5; crown.position.y = 10 + Math.sin(t * 2) * 0.2; } });
  finishPad(finish, -236 + dz);

  // ─── 배경 장식: 구름과 떠 있는 섬 ─────────────────────
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const puff = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 40; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(puff, cloudMat);
      const r = 1.5 + rand() * 2;
      s.scale.set(r, r * 0.7, r);
      s.position.set(k * 2 - n, rand(), rand() * 1.5);
      g.add(s);
    }
    const side = rand() < 0.5 ? -1 : 1;
    g.position.set(side * (16 + rand() * 40), -12 + rand() * 30, 20 - rand() * 280);
    scene.add(g);
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: 0x9ad1f5 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -14, -120);
  scene.add(sea);

  level.setSeed(seed);
  return finalizeLevel(level);
}
