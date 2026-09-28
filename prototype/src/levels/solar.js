// 맵 2: "태양계 중력 달리기"
// 구역마다 중력이 다르다. 실제 값을 그대로 쓰면 조작이 어려워 게임용으로 조정했고, 안내판에 실제 값을 함께 적는다.
// 구간: 지구 발사대 → 달 크레이터 → 화성 모래 폭풍 → 소행성대 → 목성 소용돌이 → 토성 고리 → 우주 정거장
//
// 점프 거리 참고 (최고 속도 7m/s): 지구 약 5m, 달 약 16m, 화성 약 12m, 소행성대 약 10m, 목성 약 3m, 토성 약 6m
import * as THREE from 'three';
import { mulberry32, createLevel, makeKit, finalizeLevel } from './kit.js';

// 중력 배율(지구 = 1). z가 zMax보다 작아지면 그 구역.
const ZONES = [
  { name: '지구', zMax: Infinity, g: 1 },
  { name: '달', zMax: -28, g: 0.33 },
  { name: '화성', zMax: -99, g: 0.45 },
  { name: '소행성대', zMax: -145, g: 0.5 },
  { name: '목성', zMax: -188, g: 1.6 },
  { name: '토성', zMax: -222, g: 0.9 },
  { name: '우주 정거장', zMax: -258, g: 1 },
];

function zoneAt(z) {
  let zone = ZONES[0];
  for (const zn of ZONES) if (z < zn.zMax) zone = zn;
  return zone;
}

const fmtG = (g) => `×${g}`;

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
      const zone = zoneAt(z);
      return `${zone.name} · 중력 ${fmtG(zone.g)}`;
    },
    gravityAt: (pos) => zoneAt(pos.z).g,
    sky: { background: 0x0b1026, fog: [0x0b1026, 90, 260], hemi: 1.3 },
  });
  const root = level.root;
  const { movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad } = makeKit(level);
  const rand = mulberry32(19690720);

  // 구역 안내판: 길 옆(side = -1 왼쪽, 1 오른쪽)에 세우고 길 쪽을 비스듬히 바라보게 한다
  const info = (side, baseY, z, title, real, game, color = '#6a4c93') =>
    sign(title, side * 10, baseY + 4.5, z - 10, { width: 7, color, lines: [title, real, game], rotY: -side * 0.45 });

  // ─── 지구 발사대 ─────────────────────────────────────
  platform(0, 0, 0, 16, 16, C.earth);
  startCheckpoint('지구 발사대');
  info(-1, 0, -4, '지구', '중력의 기준 (×1)', '평소처럼 점프해요', '#2a9d8f');
  platform(0, 1, -12, 8, 4, C.earth2);
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
  const m1 = platform(0, 8, -37, 14, 12, C.checkpoint);
  checkpoint(m1, new THREE.Vector3(0, 8, -36), '달 도착');
  info(1, 8, -41, '달', '실제 중력: 지구의 약 1/6', '게임 중력: 약 1/3 (조작을 위해 조정)');
  platform(-2, 9, -57, 8, 12, C.moon);
  platform(2, 10, -75, 8, 8, C.moonDark);
  block(2, 13.5, -78.5, 8, 3.5, 1, C.moonDark, { castShadow: true });
  sign('달에서는 이 벽도 넘을 수 있어요', 2, 16.5, -77.9, { width: 7 });
  platform(0, 10, -89, 12, 20, C.moon);
  for (const [x, y, z, r] of [[-4, 8, -35, 1.4], [4.5, 8, -39, 1], [-2, 9, -58, 1.6], [3, 10, -92, 1.8], [-3, 10, -86, 1.1]]) {
    const crater = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 6, 18), mat(C.moonDark));
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(x, y + 0.05, z);
    root.add(crater);
  }

  // ─── 화성 모래 폭풍 ──────────────────────────────────
  const m2 = platform(0, 10, -103, 12, 8, C.checkpoint);
  checkpoint(m2, new THREE.Vector3(0, 10, -103), '화성 도착');
  info(-1, 10, -106, '화성', '실제 중력: 지구의 약 0.38배', '게임 중력: 약 0.45배');
  platform(0, 10, -122, 4, 30, C.mars);
  sign('모래 폭풍: 바위 옆에서 버텨요', 0, 15, -106.6, { width: 6.5, color: '#b85c44' });
  // 바람이 불어 가는 쪽 가장자리의 바위
  block(1.8, 11, -112, 0.4, 1, 2.5, C.marsDark);
  block(1.8, 11, -118, 0.4, 1, 2.5, C.marsDark);
  block(-1.8, 11, -127, 0.4, 1, 2.5, C.marsDark);
  block(-1.8, 11, -133, 0.4, 1, 2.5, C.marsDark);

  const storms = [
    { zMin: -122, zMax: -107, dir: 1, offset: 0, strength: 0 },
    { zMin: -137, zMax: -122, dir: -1, offset: 2, strength: 0 },
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
  const m3 = platform(0, 10, -141, 10, 8, C.checkpoint);
  checkpoint(m3, new THREE.Vector3(0, 10, -141), '소행성대 앞');
  info(1, 10, -144, '소행성대', '화성과 목성 사이의 작은 천체들', '게임 중력: 약 0.5배', '#8d6e63');
  platform(0, 10, -155, 6, 6, C.rock);
  const orbit = new THREE.Group();
  orbit.position.set(0, 8, -155);
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
  platform(0, 10, -169, 10, 8, C.rock);
  const rockGeo = new THREE.DodecahedronGeometry(1.05, 0);
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  // 착지 구역(섬 앞쪽)은 비워 두고 뒤쪽에서 굴러다닌다
  [[-169.3, 0], [-171.7, Math.PI]].forEach(([z, phase]) => {
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
  const m4 = platform(0, 9, -184, 12, 8, C.checkpoint);
  checkpoint(m4, new THREE.Vector3(0, 9, -184), '목성 앞');
  info(-1, 9, -187, '목성', '실제 중력: 지구의 약 2.5배', '게임 중력: 1.6배 (점프가 낮아요)', '#e76f51');
  platform(0, 9, -191.5, 6, 7, C.jupiter);
  // 정팔각형 회전판: 길이 2R·폭 2R·tan(22.5°) 직사각형 4장을 45°씩 돌려 겹치면 정팔각형이 된다.
  // 다리와의 틈이 거의 일정하다 (반지름 R=6, 꼭짓점까지 6.49)
  const swirl = new THREE.Group();
  swirl.position.set(0, 9, -201.6);
  root.add(swirl);
  const R = 6;
  const side = 2 * R * Math.tan(Math.PI / 8);
  for (let i = 0; i < 4; i++) {
    const plate = platform(0, 0, 0, 2 * R, side, i % 2 ? C.jupiter : C.jupiter2, { parent: swirl, dynamic: true });
    plate.rotation.y = (i * Math.PI) / 4;
    plate.position.y -= i * 0.004; // 겹친 면이 깜박이지 않게
  }
  sign('대적점 소용돌이', 0, 14, -194.8, { width: 5, color: '#e76f51' });
  movers.push({
    root: swirl,
    update(t) {
      swirl.rotation.y = t * 0.35;
    },
  });
  // 붙어 있는 높은 계단: 떨어질 걱정은 없지만 낮은 점프로 한 칸씩 겨우 오른다
  // 첫 칸은 회전판 꼭짓점(반지름 6.49) 바로 뒤에서 시작해 틈에 빠지지 않게 한다
  platform(0, 9.7, -209.7, 6, 3, C.jupiter);
  platform(0, 10.4, -212.7, 6, 3, C.jupiter2);
  platform(0, 11.1, -218.1, 6, 7.8, C.jupiter);

  // ─── 토성 고리: 다리를 건너며 도는 고리 조각을 넘거나 틈으로 지나기 ──
  const m5 = platform(0, 11, -226, 12, 8, C.checkpoint);
  checkpoint(m5, new THREE.Vector3(0, 11, -226), '토성 앞');
  info(1, 11, -229, '토성', '실제 중력: 지구의 약 1.07배', '게임 중력: 0.9배', '#b08900');
  platform(0, 11, -244, 4, 28, C.station);
  const ring = new THREE.Group();
  ring.position.set(0, 11.6, -242);
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
  sign('고리 조각은 뛰어넘거나 틈으로!', 0, 16, -230.4, { width: 6, color: '#b08900' });

  // ─── 우주 정거장 (골인) ───────────────────────────────
  const station = platform(0, 11, -266, 14, 12, C.station);
  for (const sx of [-1, 1]) block(sx * 6.4, 18, -262, 1, 7, 1, C.accent, { castShadow: true });
  const arch = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.8, 1), mat(C.accent));
  arch.position.set(0, 18.4, -262);
  root.add(arch);
  sign('우주 정거장 도착!', 0, 19.6, -261.45, { width: 6, color: '#118ab2' });
  finishPad(station, -262);

  // ─── 배경: 별, 행성 ──────────────────────────────────
  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    starPos.set([Math.cos(th) * s * 320, u * 256 + 40, Math.sin(th) * s * 320 - 140], i * 3);
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
  planet(12, 0xbfc3cc, -45, -8, -60); // 달
  planet(10, 0xc1440e, 48, 2, -120); // 화성
  planet(30, 0xd4a373, 85, 5, -205); // 목성
  planet(6.5, 0xe9c46a, 0, 2, -242); // 토성 (다리 아래, 고리 한가운데)
  planet(14, 0xffd166, -170, 70, -160, { emissive: 0xffb703, emissiveIntensity: 1 }); // 태양

  level.setSeed(seed);
  return finalizeLevel(level);
}
