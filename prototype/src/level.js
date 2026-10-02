// 맵 1: 장애물 코스 "점프 연구소 시험장"
// 구간: 출발 → 몸풀기 계단 → 숨은 발판 → 회전 막대 광장 → 움직이는 발판·바람 다리 → 시소 다리
//       → (2부 시험 구간) 좁은 평균대 → 징검다리 → 사라지는 발판 → 컨베이어 → 얼음 판 → 점프 패드 탑 → 해머 복도 → 맞바람 → 골인 언덕
// 2026-10-02: 이 맵을 "게임성 시험 맵"으로 쓴다. 학생이 쉬는 시간에 혼자 연습하는 맵이라 난이도를 올리고 장애물을 다양하게 시험한다.
// 구간마다 이름(난이도 ★)이 달라 교사 화면의 구간별 낙하 횟수로 어느 장애물이 어려운지 볼 수 있다. docs/31 참고.
import * as THREE from 'three';
import { mulberry32, sectionFinder, createLevel, makeKit, finalizeLevel } from './levels/kit.js';

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

export function buildLevel(parent, world, { seed = Date.now() } = {}) {
  const level = createLevel(parent, world, { sectionAt: sectionFinder(SECTIONS), fanZones: [] });
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
  sweeper(-89, 1.5, 5.3, 2.5, COLORS.bar); // 2026-10-02 난이도 상향: 회전 속도 1.2→1.5, 0.9→1.15
  sweeper(-101, -1.15, 6.95, 3.2, 0x8338ec);

  // ─── 체크포인트 3 + 움직이는 발판 ───────────────────────
  const cp3 = platform(0, 5, -112, 12, 8, COLORS.checkpoint);
  checkpoint(cp3, new THREE.Vector3(0, 5, -112), '움직이는 발판 앞');
  sign('움직이는 발판', 0, 10.5, -115.8, { width: 6 });

  for (const [z, phase] of [[-120.5, 0], [-127, Math.PI]]) {
    const m = platform(0, 5, z, 5.5, 4, COLORS.mover, { dynamic: true, castShadow: true });
    movers.push({
      root: m,
      update(t) {
        m.position.x = Math.sin(t * 1.0 + phase) * 3.5; // 속도 0.8→1.0 (난이도 상향)
      },
    });
  }
  [-133, -138.5, -144].forEach((z, i) => {
    const m = platform(0, 5.5, z, 3.5, 3.5, COLORS.mover, { dynamic: true, thick: 0.8, castShadow: true });
    const baseY = m.position.y;
    movers.push({
      root: m,
      update(t) {
        m.position.y = baseY + Math.sin(t * 1.6 - i * 1.1) * 1.2; // 속도 1.3→1.6 (난이도 상향)
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
  const WIND_SPEED = 4.2; // 3.6→4.2 (난이도 상향)
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
  for (const [w, len] of [[2.4, 6], [1.8, 6], [1.4, 6], [1.0, 6]]) {
    platform(0, 5, zc - len / 2, w, len, COLORS.bridge);
    zc -= len;
  }
  stage('평균대 뒤');

  // 2) 징검다리: 틈이 점점 벌어진다 (마지막은 달려서 뛰어야 한다)
  extStart('징검다리 ★★');
  extSign('징검다리: 틈이 점점 벌어진다');
  const GAPS = [2.4, 3.0, 3.6, 4.1, 4.6]; // 마지막 틈은 발판 가장자리 가까이에서 뛰어야 닿는다
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
  const BLINK = { P: 4.4, vis: 3.6, warn: 0.9 };
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
  const BELTS = [{ dx: 0, dz: 1, speed: 3.2 }, { dx: 1, dz: 0, speed: 3.4 }, { dx: 0, dz: 1, speed: 4.2 }];
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
  [[4.5, 1.4, 1.5, 0], [10, 2.5, 1.9, 1.7], [15.5, 1.4, 1.7, 3.2], [21, 2.5, 1.4, 0.6]].forEach(([hz, h, omega, phase]) => {
    const hammer = block(0, 5 + h, zc - hz, 3.2, h, 1.4, COLORS.bar, { kind: 'bumper', dynamic: true, castShadow: true });
    movers.push({ root: hammer, update(t) { hammer.position.x = Math.sin(t * omega + phase) * 2.5; } });
  });
  zc -= 26;
  stage('해머 복도 뒤');

  // 8) 맞바람: 바람이 시작 쪽으로 불어 온다 (벽 뒤에서 쉬었다 달린다)
  extStart('맞바람 ★★★');
  extSign('맞바람: 벽 뒤에서 쉬었다 달려라');
  const HZ = { zMin: zc - 28, zMax: zc, power: 9 };
  platform(0, 5, zc - 14, 9, 28, COLORS.bridge);
  const shelters = [6, 13, 20].map((sz, i) => {
    const x = i % 2 ? 1.8 : -1.8;
    block(x, 6.9, zc - sz, 3.6, 1.9, 0.8, COLORS.pillar, { castShadow: true });
    return { xMin: x - 2.2, xMax: x + 2.2, zMin: zc - sz, zMax: zc - sz + 4 }; // 벽 뒤(시작 쪽)는 바람이 약하다
  });
  const streaks = [];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    scene.add(m);
    streaks.push({ m, x: ((i * 37) % 9) - 4.5, y: 5.6 + (i % 4) * 0.7, p: i / 22 });
  }
  level.headwindStrength = (t) => gust(t, 1.4, 0.6, 2.6, 0.5);
  level.shelters = shelters;
  level.headwindZone = HZ;
  movers.push({ root: null, update(t, dt) {
    const s = level.headwindStrength(t);
    for (const k of streaks) {
      k.p = (k.p + dt * (0.15 + s * 0.9)) % 1;
      k.m.position.set(k.x, k.y, HZ.zMax - 28 + k.p * 28);
      k.m.material.opacity = s * 0.55;
    }
  } });
  extWind.push((pos, out, t) => {
    if (pos.z > HZ.zMax || pos.z < HZ.zMin || pos.y < 4.5 || pos.y > 10 || Math.abs(pos.x) > 5) return;
    for (const sh of shelters) if (pos.x > sh.xMin && pos.x < sh.xMax && pos.z > sh.zMin && pos.z < sh.zMax) return;
    out.z += level.headwindStrength(t) * HZ.power;
  });
  zc -= 28;
  stage('맞바람 뒤');
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
