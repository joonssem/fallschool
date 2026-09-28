// 시험용 장애물 코스 "점프 연구소 시험장"
// 구간: 출발 → 몸풀기 계단 → 숨은 발판 → 회전 막대 광장 → 움직이는 발판·바람 다리 → 시소 다리 → 골인 언덕
import * as THREE from 'three';
import { BoxCollider } from './physics.js';

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
  { name: '골인 언덕', zMax: -221.7 },
];

export function sectionAt(z) {
  let name = SECTIONS[0].name;
  for (const s of SECTIONS) if (z < s.zMax) name = s.name;
  return name;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLevel(scene, world, { seed = Date.now() } = {}) {
  const matCache = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra }));
    return matCache.get(key);
  };

  const movers = [];
  const checkpoints = [];
  const level = {
    spawn: new THREE.Vector3(0, 0, 5),
    checkpoints,
    movers,
    finished: false,
    onCheckpoint: null,
    onFinish: null,
    fanZones: [],
  };

  // 박스 하나 = 메시 + 충돌체. 위치는 윗면 기준.
  function block(x, topY, z, sx, sy, sz, color, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), opts.material || mat(color));
    mesh.position.set(x, topY - sy / 2, z);
    mesh.castShadow = !!opts.castShadow;
    mesh.receiveShadow = true;
    (opts.parent || scene).add(mesh);
    const col = world.add(new BoxCollider(mesh, new THREE.Vector3(sx / 2, sy / 2, sz / 2), opts));
    mesh.userData.collider = col;
    return mesh;
  }
  const platform = (x, topY, z, sx, sz, color, opts = {}) => block(x, topY, z, sx, opts.thick ?? 1, sz, color, opts);

  function sign(text, x, y, z, { width = 6, color = '#6a4c93', rotY = 0 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(4, 4, 504, 120, 40);
    g.fill();
    g.fillStyle = color;
    let size = 64;
    const font = (px) => `bold ${px}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    g.font = font(size);
    while (size > 24 && g.measureText(text).width > 460) g.font = font((size -= 4));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 68);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width / 4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    scene.add(m);
    return m;
  }

  function checkpoint(mesh, respawn, name) {
    const index = checkpoints.length;
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 8), mat(0xffffff));
    const top = mesh.position.y + mesh.geometry.parameters.height / 2;
    flagPole.position.set(mesh.position.x + mesh.geometry.parameters.width / 2 - 0.8, top + 1.5, respawn.z);
    scene.add(flagPole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    flag.position.set(flagPole.position.x - 0.65, top + 2.6, respawn.z);
    scene.add(flag);
    const cp = { index, name, respawn: respawn.clone(), flag, reached: index === 0 };
    if (cp.reached) flag.material.color.setHex(0x2ec4b6);
    checkpoints.push(cp);
    mesh.userData.collider.onStand = () => {
      if (cp.reached) return;
      cp.reached = true;
      flag.material.color.setHex(0x2ec4b6);
      level.onCheckpoint?.(cp);
    };
    return cp;
  }

  // ─── 출발 ───────────────────────────────────────────
  platform(0, 0, 0, 16, 16, COLORS.start);
  checkpoints.push({ index: 0, name: '출발', respawn: level.spawn.clone(), reached: true });
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
  sweeper(-89, 1.2, 5.3, 2.5, COLORS.bar);
  sweeper(-101, -0.9, 6.95, 3.2, 0x8338ec);

  // ─── 체크포인트 3 + 움직이는 발판 ───────────────────────
  const cp3 = platform(0, 5, -112, 12, 8, COLORS.checkpoint);
  checkpoint(cp3, new THREE.Vector3(0, 5, -112), '움직이는 발판 앞');
  sign('움직이는 발판', 0, 10.5, -115.8, { width: 6 });

  for (const [z, phase] of [[-120.5, 0], [-127, Math.PI]]) {
    const m = platform(0, 5, z, 5.5, 4, COLORS.mover, { dynamic: true, castShadow: true });
    movers.push({
      root: m,
      update(t) {
        m.position.x = Math.sin(t * 0.8 + phase) * 3.5;
      },
    });
  }
  [-133, -138.5, -144].forEach((z, i) => {
    const m = platform(0, 5.5, z, 3.5, 3.5, COLORS.mover, { dynamic: true, thick: 0.8, castShadow: true });
    const baseY = m.position.y;
    movers.push({
      root: m,
      update(t) {
        m.position.y = baseY + Math.sin(t * 1.3 - i * 1.1) * 1.2;
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
  const WIND_SPEED = 3.6;
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
  sign('시소 다리: 가운데로 걸어라', 0, 11, -184.8, { width: 8 });

  function seesaw(z) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 5, z);
    scene.add(pivot);
    const plank = block(0, 0, 0, 6, 0.6, 14, COLORS.seesaw, {
      parent: pivot,
      dynamic: true,
      slippery: true,
      castShadow: true,
    });
    const fulcrum = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 4), mat(COLORS.pillar));
    fulcrum.position.set(0, 3.2, z);
    scene.add(fulcrum);
    const col = plank.userData.collider;
    const local = new THREE.Vector3();
    let angle = 0;
    movers.push({
      root: pivot,
      update(t, dt, player) {
        let target = 0;
        let rate = 0.35;
        if (player && player.ground === col) {
          local.copy(player.pos);
          pivot.worldToLocal(local);
          target = THREE.MathUtils.clamp(-local.x * 0.14, -0.38, 0.38);
          rate = 0.75;
        }
        const d = THREE.MathUtils.clamp(target - angle, -rate * dt, rate * dt);
        angle += d;
        pivot.rotation.z = angle;
      },
    });
  }
  seesaw(-192.3);
  platform(0, 5, -203.5, 5, 7.8, COLORS.bridge);
  seesaw(-214.7);

  // ─── 골인 언덕 ───────────────────────────────────────
  const rise = 3;
  const run = 12;
  const theta = Math.atan2(rise, run);
  const len = Math.hypot(rise, run);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 1, len), mat(COLORS.ramp));
  ramp.rotation.x = theta;
  ramp.position.set(0, 5 + rise / 2 - 0.5 * Math.cos(theta), -222 - run / 2 - 0.5 * Math.sin(theta));
  ramp.receiveShadow = true;
  scene.add(ramp);
  world.add(new BoxCollider(ramp, new THREE.Vector3(4, 0.5, len / 2)));
  sign('골인 언덕', 0, 12, -221.5, { width: 5 });

  [[-225, 0], [-229.5, Math.PI]].forEach(([z, phase]) => {
    const y = 5 + ((-222 - z) / run) * rise;
    const bumper = block(0, y + 1.4, z, 1.4, 1.4, 1.4, COLORS.bar, { kind: 'bumper', dynamic: true, castShadow: true });
    movers.push({
      root: bumper,
      update(t) {
        bumper.position.x = Math.sin(t * 1.4 + phase) * 3.2;
      },
    });
  });

  const finish = platform(0, 8, -240, 14, 12, COLORS.finish);
  for (const sx of [-1, 1]) block(sx * 6.4, 15, -236, 1, 7, 1, COLORS.pillar, { castShadow: true });
  const goalArch = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.8, 1), mat(COLORS.pad));
  goalArch.position.set(0, 15.4, -236);
  scene.add(goalArch);
  sign('골인!', 0, 16.6, -235.45, { width: 4, color: '#ff5d8f' });
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.25, 8, 5), mat(0xffd60a, { emissive: 0x664400 }));
  crown.position.set(0, 10, -242);
  scene.add(crown);
  movers.push({ root: null, update(t) { crown.rotation.y = t * 1.5; crown.position.y = 10 + Math.sin(t * 2) * 0.2; } });
  finish.userData.collider.onStand = (player) => {
    if (level.finished || player.pos.z > -236) return;
    level.finished = true;
    level.onFinish?.();
  };

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

  // ─── 매 스텝 갱신 ────────────────────────────────────
  level.update = (t, dt, player) => {
    for (const m of movers) {
      m.update(t, dt, player);
      if (m.root) m.root.updateMatrixWorld(true);
    }
    world.syncDynamic();
  };

  level.resetProgress = () => {
    level.finished = false;
    for (const cp of checkpoints) {
      cp.reached = cp.index === 0;
      cp.flag?.material.color.setHex(cp.reached ? 0x2ec4b6 : 0xcccccc);
    }
  };

  level.setSeed(seed);
  scene.updateMatrixWorld(true);
  for (const c of world.colliders) c.sync(true);
  return level;
}
