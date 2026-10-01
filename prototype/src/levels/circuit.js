// 맵 4: "전기 회로 공장"
// 스위치 발판에 서면 회로가 이어진다. 직렬 연결은 스위치를 모두 눌러야, 병렬 연결은 하나만 눌러도 전구가 켜지고 문이 열린다.
// 구간: 입구 → 회로 잇기(스위치 1개) → 직렬 스위치 문(3개) → 병렬 스위치 문(3개) → 예측 문 2개 → 결승
//
// 협동: 직렬 문은 세 스위치가 동시에 이어져야 해서 친구와 나눠 서야 한다.
// 스위치는 발에서 떨어진 뒤에도 잠시 이어져 있다 (방에 3명 이상이면 1.5초, 혼자·둘이면 7초 — 혼자 연습도 가능하게).
// 발판 위에 누가 있는지는 각 화면이 모든 학생의 위치로 계산한다 (데이터베이스에 따로 쓰지 않는다).
//
// 직렬 문에서 뒤처진 학생: 아래 중 하나면 짧은 유지 대신 긴 유지(7초)를 쓴다. 세 스위치를 실제로 모두 밟아야 전구가 켜지는 건 그대로다.
//   · 아직 문을 지나지 않은 학생(나 포함)이 3명 미만 (마지막 무리: 협동할 친구가 앞으로 다 지나갔다)
//   · 내가 문 앞에서 PATIENCE 초 넘게 기다렸다 (친구가 접속을 끊었거나 멀리 있다)
// 먼저 도착한 학생은 뒤에 학생이 많이 남아 있으므로 그대로 친구를 기다려 함께 누른다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, shuffleGates, sectionFinder } from './kit.js';

const C = {
  floor: 0xe9ecef,
  floor2: 0xced4da,
  checkpoint: 0x9be564,
  wall: 0x495057,
  wireOff: 0x6c757d,
  wireOn: 0xffd60a,
  plateOff: 0xef476f,
  plateOn: 0x06d6a0,
  battery: 0x118ab2,
};

const SECTIONS = [
  { name: '입구', zMax: Infinity },
  { name: '회로 잇기', zMax: -23 },
  { name: '직렬 스위치 문', zMax: -38 },
  { name: '병렬 스위치 문', zMax: -63 },
  { name: '예측 문', zMax: -84 },
  { name: '결승', zMax: -110 },
];

const PLATE = 2.4; // 스위치 발판 한 변
const LATCH_TEAM = 1.5;
const LATCH_SOLO = 7;
const PATIENCE = 30; // 직렬 문 앞에서 기다린 뒤 도움이 켜지는 시간(초)
const WAIT_ZONE = 28; // 문 앞 이만큼(m) 안에 있을 때만 기다린 시간을 센다
const TEAM_SIZE = 3; // 직렬 문 스위치 수

export function buildCircuit(parent, world, { seed = Date.now() } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder(SECTIONS),
    sky: { background: 0x1d2d44, fog: [0x1d2d44, 70, 180], hemi: 1.6 },
  });
  const root = level.root;
  const { movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, choiceGate, challengeStar, forkEntry } = makeKit(level);
  const Y = 1.5;
  const doors = [];

  // 바닥에 붙인 전선 한 가닥 (a → b, 모두 바닥 높이 y)
  function wire(ax, az, bx, bz, y) {
    const len = Math.hypot(bx - ax, bz - az);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, len), new THREE.MeshStandardMaterial({ color: C.wireOff }));
    m.position.set((ax + bx) / 2, y + 0.04, (az + bz) / 2);
    m.rotation.y = Math.atan2(bx - ax, bz - az);
    root.add(m);
    return m;
  }

  // 문 위 현황판: "이어진 스위치 N / M" (발판 상태이며 참여 학생 수가 아니다. 발에서 떨어진 뒤 잠시 이어진 스위치도 센다)
  function board(x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const g = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    mesh.position.set(x, y, z);
    root.add(mesh);
    let shown = '';
    return {
      mesh,
      set(rows, color) {
        const key = rows.join('|') + color;
        if (key === shown) return;
        shown = key;
        g.clearRect(0, 0, 512, 256);
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.roundRect(4, 4, 504, 248, 36);
        g.fill();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        rows.forEach((row, i) => {
          let size = i === 0 ? 60 : 38;
          const font = (px) => `bold ${px}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
          g.font = font(size);
          while (size > 20 && g.measureText(row).width > 470) g.font = font((size -= 4));
          g.fillStyle = i === 0 ? color : '#2b2d42';
          g.fillText(row, 256, 62 + i * 70);
        });
        tex.needsUpdate = true;
      },
    };
  }

  function plateMesh(x, z, y, name = '스위치') {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(PLATE, 0.08, PLATE),
      new THREE.MeshStandardMaterial({ color: C.plateOff, emissive: C.plateOff, emissiveIntensity: 0.25 }),
    );
    m.position.set(x, y + 0.05, z);
    root.add(m);
    const label = sign(name, x, y + 2.6, z, { width: 2.2, color: '#2b2d42' });
    return { x, z, y, mesh: m, label, until: -1, closed: false };
  }

  // 스위치 문: 벽 가운데 문 하나, 문 위 전구. kind = 'single' | 'series' | 'parallel'
  // z = 벽 앞면, width = 벽 너비(발판보다 넓게 해 옆으로 돌아가지 못하게)
  function switchDoor({ z, y, width, kind, plates, message }) {
    const DW = 3.4;
    const DH = 3;
    const H = 6;
    const side = (width - DW) / 2;
    for (const sx of [-1, 1]) block(sx * (DW / 2 + side / 2), y + H, z - 0.5, side, H + 4, 1, C.wall, { castShadow: true });
    block(0, y + H, z - 0.5, DW, H - DH, 1, C.wall, { castShadow: true });
    platform(0, y, z - 0.5, DW, 1, C.floor2); // 문턱
    const door = block(0, y + DH, z - 0.5, DW - 0.1, DH, 0.5, 0xf8f9fa, {
      material: new THREE.MeshStandardMaterial({ color: 0xadb5bd, metalness: 0.3, roughness: 0.4 }),
    });
    const home = door.position.clone();
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0x000000 }));
    bulb.position.set(0, y + DH + 1.2, z + 0.4);
    root.add(bulb);
    // 전지: 문 왼쪽 앞
    const bat = block(-DW / 2 - 1.2, y + 1.1, z + 0.8, 0.9, 1.1, 0.6, C.battery);
    bat.material = mat(C.battery, { emissive: C.battery, emissiveIntensity: 0.2 });

    const ps = plates.map(([px, pz], i) => plateMesh(px, pz, y, plates.length > 1 ? `스위치 ${'①②③④'[i]}` : '스위치'));
    const wires = [];
    const L = [-DW / 2 - 1.2, z + 0.8]; // 전지
    const R = [DW / 2 + 0.6, z + 0.2]; // 전구 쪽 (문 오른쪽 아래로 이어진다)
    if (kind === 'parallel') {
      // 스위치마다 전지와 전구 사이에 따로 이어진 갈래
      for (const p of ps) {
        const w1 = wire(L[0], L[1], p.x, p.z, y);
        const w2 = wire(p.x, p.z, R[0], R[1], y);
        p.wires = [w1, w2];
        wires.push(w1, w2);
      }
    } else {
      // 한 줄로: 전지 → 스위치 1 → 2 → 3 → 전구
      let prev = L;
      for (const p of ps) {
        wires.push(wire(prev[0], prev[1], p.x, p.z, y));
        prev = [p.x, p.z];
      }
      wires.push(wire(prev[0], prev[1], R[0], R[1], y));
    }
    // 닫힌 회로로 읽히게: 전구 쪽 연결(기둥 + 가로대)과 전구에서 전지로 돌아오는 선
    const loop = [wire(R[0], R[1], L[0], L[1], y)];
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, DH + 1.2, 0.22), new THREE.MeshStandardMaterial({ color: C.wireOff }));
    post.position.set(R[0], y + (DH + 1.2) / 2, R[1] + 0.1);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(R[0] - 0.4, 0.22, 0.22), new THREE.MeshStandardMaterial({ color: C.wireOff }));
    bar.position.set((R[0] + 0.4) / 2, y + DH + 1.2, bulb.position.z);
    root.add(post, bar);
    loop.push(post, bar);
    const info = board(0, y + H + 1.6, z + 0.05);
    const d = { z, y, kind, plates: ps, wires, loop, info, door, home, bulb, open: false, lift: 0, message, told: false, wait: 0, helped: false };
    doors.push(d);
    return d;
  }

  const setGlow = (m, on) => {
    m.material.color.setHex(on ? C.wireOn : C.wireOff);
    m.material.emissive?.setHex(on ? 0x886600 : 0x000000);
  };

  // ─── 입구 ──────────────────────────────────────────
  platform(0, 0, 0, 16, 16, C.floor);
  startCheckpoint('입구');
  sign('전기 회로 공장', -7.5, 3.4, -3, { width: 6, color: '#118ab2', lines: ['전기 회로 공장', '스위치 발판에 서면', '회로가 이어져요'], rotY: 0.45 });
  forkEntry({ side: 1, color: 0xc9a227, color2: C.floor2 }); // 돌아가는 길은 오른쪽 (도전 별이 왼쪽)

  // ─── 회로 잇기: 스위치 1개 ───────────────────────────────
  const s1 = platform(0, Y, -30, 14, 14, C.floor);
  checkpoint(s1, new THREE.Vector3(0, Y, -25), '회로 잇기');
  // 도전 별: 발판 끝에서 7m(지구 중력) — 보통 점프 최대 5.5m, 점프 + 다이브 최대 8.5m (시뮬레이션 측정)
  challengeStar(-15.5, Y, -30);
  sign('회로 잇기', 7.5, Y + 3.4, -29, { width: 6, color: '#118ab2', lines: ['회로 잇기', '스위치를 눌러', '전구에 불을 켜요'], rotY: -0.45 });
  switchDoor({
    z: -37,
    y: Y,
    width: 18,
    kind: 'single',
    plates: [[-4, -31]],
    message: '회로가 끊기지 않고 이어지면 전구에 불이 켜져요',
  });

  // ─── 직렬 스위치 문: 세 스위치를 모두 ─────────────────────
  const s2 = platform(0, Y, -50, 22, 24, C.floor);
  checkpoint(s2, new THREE.Vector3(0, Y, -39.5), '직렬 스위치 문');
  challengeStar(19.5, Y, -50);
  sign('직렬 연결', -11.5, Y + 3.4, -42, { width: 6, color: '#ef476f', lines: ['직렬 연결 스위치 문', '스위치 세 개가', '한 줄로 이어져 있어요'], rotY: 0.45 });
  switchDoor({
    z: -62,
    y: Y,
    width: 26,
    kind: 'series',
    plates: [[-8, -44], [8, -44], [0, -55]],
    message: '직렬 연결: 스위치 하나라도 끊기면 전구가 꺼져요. 모두 이어져야 해요',
  });

  // ─── 병렬 스위치 문: 하나만 눌러도 ────────────────────────
  const s3 = platform(0, Y, -73, 22, 20, C.floor);
  checkpoint(s3, new THREE.Vector3(0, Y, -64.5), '병렬 스위치 문');
  challengeStar(-19.5, Y, -73);
  sign('병렬 연결', 11.5, Y + 3.4, -65, { width: 6, color: '#06d6a0', lines: ['병렬 연결 스위치 문', '스위치 세 개가', '나란히 이어져 있어요'], rotY: -0.45 });
  switchDoor({
    z: -83,
    y: Y,
    width: 26,
    kind: 'parallel',
    plates: [[-8, -67], [8, -67], [-7, -79]], // 문으로 곧장 가는 길 위에는 두지 않는다 (모르고 밟지 않게)
    message: '병렬 연결: 갈래가 하나만 이어져도 전구가 켜져요',
  });

  // ─── 예측 문 두 개 ──────────────────────────────────
  const a1 = platform(0, Y, -87, 14, 6, C.checkpoint);
  sign('확장 도전', -8, Y + 3.4, -88, { width: 5, color: '#118ab2', lines: ['확장 도전', '전구 밝기 비교', '(같은 전구·같은 전지)'], rotY: 0.4 });
  checkpoint(a1, new THREE.Vector3(0, Y, -86), '예측 문 1');
  choiceGate({
    z: -90,
    y: Y,
    name: '더 밝게',
    question: '[확장 도전] 같은 전구 두 개를 더 밝게 켜려면?',
    hint: '같은 전지 한 개와 같은 전구 두 개로 비교해요',
    options: [{ text: '병렬로 연결', correct: true }, { text: '직렬로 연결' }, { text: '어떻게 해도 같아요' }],
    right: '정답! 같은 전지 한 개, 같은 전구 두 개라면 병렬로 연결할 때가 직렬로 연결할 때보다 밝아요',
    wrong: '다시! 같은 전지에 같은 전구 두 개를 직렬로 연결하면 전구 하나일 때보다 어두워요',
    color: '#118ab2',
  });
  const a2 = platform(0, Y, -100, 14, 6, C.checkpoint);
  checkpoint(a2, new THREE.Vector3(0, Y, -99), '예측 문 2');
  choiceGate({
    z: -103,
    y: Y,
    name: '하나를 빼도',
    question: '[확장 도전] 하나를 빼도 켜져 있는 연결은?',
    hint: '같은 전구 두 개 중 하나를 빼면?',
    options: [{ text: '병렬 연결', correct: true }, { text: '직렬 연결' }, { text: '둘 다 꺼져요' }],
    right: '정답! 병렬 연결은 갈래가 따로라서 전구 하나를 빼도 다른 전구는 켜져 있어요',
    wrong: '다시! 직렬 연결은 한 줄로 이어져 있어요. 하나를 빼면 회로가 어떻게 될까?',
    color: '#118ab2',
  });

  // ─── 결승 ───────────────────────────────────────────
  const goal = platform(0, Y, -116, 14, 12, C.floor);
  for (const sx of [-1, 1]) block(sx * 6.4, Y + 7, -114, 1, 7, 1, C.wall, { castShadow: true });
  const arch = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.8, 1), mat(C.wireOn, { emissive: 0x886600 }));
  arch.position.set(0, Y + 7.4, -114);
  root.add(arch);
  sign('불이 켜졌어요!', 0, Y + 8.6, -113.45, { width: 5, color: '#118ab2' });
  finishPad(goal, -114);

  // ─── 배경: 전봇대와 전선 ───────────────────────────────
  for (let i = 0; i < 10; i++) {
    for (const sx of [-1, 1]) {
      const x = sx * 24;
      const z = 5 - i * 14;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 18, 8), mat(0x6b4f3a));
      pole.position.set(x, 4, z);
      root.add(pole);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 0.3), mat(0x6b4f3a));
      bar.position.set(x, 12, z);
      root.add(bar);
    }
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x2b3a55));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -6, -60);
  root.add(ground);

  // ─── 스위치·문 갱신 ──────────────────────────────────
  const _feet = [];
  movers.push({
    root: null,
    update(t, dt, player) {
      _feet.length = 0;
      if (player) _feet.push(player.pos);
      const others = level.getOthers?.() || [];
      for (const o of others) _feet.push(o);
      const crowd = (level.getPlayerCount?.() ?? 1) >= 3;

      for (const d of doors) {
        // 직렬 문: 앞서 설명한 두 경우에는 긴 유지 시간. 아직 문을 지나지 않은 학생 수는 나 포함.
        if (d.kind === 'series' && player) {
          let before = player.pos.z > d.z - 1 ? 1 : 0;
          for (const o of others) if (o.z > d.z - 1) before++;
          d.lastGroup = before < TEAM_SIZE;
          const waiting = player.pos.z > d.z && player.pos.z < d.z + WAIT_ZONE;
          d.wait = waiting && !d.open ? d.wait + dt : waiting ? 0 : player.pos.z <= d.z ? 0 : d.wait;
          if (!d.helped && d.wait > PATIENCE) {
            d.helped = true;
            level.onMessage?.(`도움이 켜졌어요! 이 문의 스위치는 이제 ${LATCH_SOLO}초 동안 이어져요. 세 스위치를 모두 밟아 보세요`, true);
          }
          if (player.pos.z <= d.z) d.helped = false;
        }
        const latch = !crowd || (d.kind === 'series' && (d.lastGroup || d.helped)) ? LATCH_SOLO : LATCH_TEAM;
        for (const p of d.plates) {
          const on = _feet.some((f) => Math.abs(f.x - p.x) < PLATE / 2 + 0.2 && Math.abs(f.z - p.z) < PLATE / 2 + 0.2 && f.y > p.y - 0.5 && f.y < p.y + 1.5);
          if (on) p.until = t + latch;
          // 시간이 거꾸로 맞춰질 때(서버 시계 보정)를 대비해 너무 먼 값은 버린다
          if (p.until > t + latch) p.until = t + latch;
          p.closed = t < p.until;
          const col = p.closed ? C.plateOn : C.plateOff;
          p.mesh.material.color.setHex(col);
          p.mesh.material.emissive.setHex(col);
        }
        const open = d.kind === 'parallel' ? d.plates.some((p) => p.closed) : d.plates.every((p) => p.closed);
        d.open = open;
        for (const w of d.loop) setGlow(w, open);
        const closedN = d.plates.filter((p) => p.closed).length;
        const need = d.kind === 'parallel' ? '1개만 이어져도 켜져요' : d.plates.length > 1 ? `${d.plates.length}개 모두 이어져야 켜져요` : '스위치를 눌러 이어요';
        const rows = [`이어진 스위치 ${closedN} / ${d.plates.length}`, need];
        if (d.kind === 'series' && (d.lastGroup || d.helped) && crowd) rows.push(`스위치가 ${LATCH_SOLO}초 이어져요`);
        d.info.set(rows, open ? '#06a77d' : '#d1495b');
        if (d.kind === 'parallel') {
          for (const p of d.plates) for (const w of p.wires) setGlow(w, p.closed);
        } else {
          for (const w of d.wires) setGlow(w, open);
        }
        d.bulb.material.color.setHex(open ? 0xfff3b0 : 0x777777);
        d.bulb.material.emissive.setHex(open ? 0xffd60a : 0x000000);
        // 문: 빨리 열리고(0.25초) 천천히 닫힌다(4초). 전구는 회로가 끊기면 바로 꺼지지만 문은 내려오는 동안 지나갈 수 있어
        // 스위치를 누르고 있던 마지막 학생들도 문까지 올 수 있다 (가장 먼 스위치에서 문까지 약 19m ≈ 2.7초).
        d.lift = THREE.MathUtils.clamp(d.lift + (open ? dt * 4 : -dt / 4), 0, 1);
        d.door.position.y = d.home.y + d.lift * 2.9;
        // 닫힌 문은 그대로 막고, 열렸던 문은 문 자리(문짝 두께 + 몸 반지름)에 서 있는 동안 다시 막지 않는다
        const col = d.door.userData.collider;
        if (open || d.lift >= 0.05) col.enabled = false;
        else if (!col.enabled) {
          const inDoorway = player && Math.abs(player.pos.x) < 2.2 && Math.abs(player.pos.z - (d.z - 0.5)) < 0.75 && player.pos.y > d.y - 1;
          col.enabled = !inDoorway;
        }
        // 문을 지나가면 한 번 알려 준다
        if (player && !d.told && player.pos.z < d.z - 1.5 && player.pos.z > d.z - 6 && player.pos.y > d.y - 1) {
          d.told = true;
          level.onMessage?.(d.message, true);
        }
      }
    },
  });

  level.setSeed = (s) => {
    level.seed = s;
    for (const d of doors) {
      d.told = false;
      d.wait = 0;
      d.helped = false;
      d.lastGroup = false;
      for (const p of d.plates) p.until = -1;
    }
    shuffleGates(level, s);
  };
  level.setSeed(seed);
  return finalizeLevel(level);
}
