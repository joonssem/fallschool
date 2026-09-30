// 맵 7: "인체 대탐험"
// 폐에서 얻은 산소가 혈액을 타고 심장과 혈관을 거쳐 근육으로 전달되는 흐름을 체험한다.
// 구간: 폐 → 심장 판막 → 동맥 → 모세혈관 → 근육
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, shuffleGates, sectionFinder } from './kit.js';

const C = {
  floor: 0xf4e8e8,
  vessel: 0xd1495b,
  vesselDark: 0x8f2937,
  oxygen: 0x4cc9f0,
  lung: 0xf6bdc0,
  heart: 0xd62839,
  muscle: 0xe9a76b,
  checkpoint: 0x9be564,
  valve: 0xffd166,
};

const SECTIONS = [
  { name: '폐와 산소', zMax: Infinity },
  { name: '심장 판막', zMax: -36 },
  { name: '동맥', zMax: -68 },
  { name: '모세혈관', zMax: -101 },
  { name: '근육', zMax: -132 },
];

export function buildBody(parent, world, { seed = Date.now() } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder(SECTIONS),
    sky: { background: 0xf6e5e5, fog: [0xf6e5e5, 80, 190], hemi: 1.45 },
  });
  const root = level.root;
  const { movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, choiceGate, challengeStar } = makeKit(level);
  const Y = 1.5;

  // ─── 폐에서 산소 받기 ─────────────────────────────────
  platform(0, 0, 2, 18, 18, C.floor);
  startCheckpoint('폐');
  lungs(0, 5, -5);
  sign('인체 대탐험', -8, 4, -1, {
    width: 6,
    color: '#a22c3a',
    lines: ['인체 대탐험', '산소를 싣고', '근육까지 달려요'],
    rotY: 0.42,
  });
  challengeStar(14, 0, -3);
  const cp0 = platform(0, Y, -10, 16, 8, C.checkpoint);
  checkpoint(cp0, new THREE.Vector3(0, Y, -8), '폐포');
  choiceGate({
    z: -14,
    y: Y,
    name: '폐포',
    question: '숨을 들이마신 뒤 산소가 혈액으로 들어가는 곳은?',
    hint: '폐 안의 아주 작은 공기주머니를 떠올려요.',
    options: [
      { text: '폐포', correct: true },
      { text: '위' },
      { text: '뼈' },
    ],
    right: '맞아요! 폐포에서 산소가 혈액으로 이동해요.',
    wrong: '폐의 작은 공기주머니인 폐포에서 산소가 혈액으로 이동해요.',
    color: '#a22c3a',
  });

  // ─── 심장 판막: 두 사람이 함께 누르거나 한 명이 차례로 밟는다 ──
  const heartDeck = platform(0, Y, -29, 20, 14, C.floor);
  checkpoint(heartDeck, new THREE.Vector3(0, Y, -26), '심장');
  challengeStar(-14, Y, -29);
  heart(0, 7, -35);
  sign('심장 판막', 10, 6, -31, { width: 5, color: '#a22c3a', lines: ['심장이 뛰며', '혈액을 밀어 보내요'], rotY: -0.4 });
  platform(0, Y, -42, 20, 12, C.floor);
  valveDoor({
    z: -47,
    y: Y,
    plates: [[-6, -39], [6, -39]],
    message: '함께 심장을 뛰게 했어요! 판막이 열려 혈액이 앞으로 흘러가요.',
  });
  platform(0, Y, -52, 18, 10, C.floor);
  const arteryDeck = platform(0, Y, -59, 18, 10, C.checkpoint);
  checkpoint(arteryDeck, new THREE.Vector3(0, Y, -56), '동맥');

  // ─── 동맥: 산소를 실은 혈액이 몸의 여러 곳으로 흐른다 ──
  vesselRun(-68, -97, C.vessel);
  bloodCells(-70, -96, 5, C.oxygen);
  const capillary = platform(0, 1, -101, 20, 10, C.checkpoint);
  checkpoint(capillary, new THREE.Vector3(0, 1, -98), '모세혈관');
  challengeStar(14, 1, -101);
  sign('모세혈관', -11, 5, -102, { width: 5, color: '#8f2937', lines: ['혈관이 가늘게 갈라져', '온몸에 산소를 나눠 줘요'], rotY: 0.4 });

  // ─── 근육으로 산소 전달 ───────────────────────────────
  const musclePath = [
    [-3, 1, -110], [3, 1, -118], [-2, 1, -126],
  ];
  musclePath.forEach(([x, y, z], i) => platform(x, y, z, 9, 8, i === 1 ? C.oxygen : C.vessel));
  bloodCells(-108, -130, 4, C.oxygen);
  const muscleDeck = platform(0, Y, -138, 20, 14, C.muscle);
  checkpoint(muscleDeck, new THREE.Vector3(0, Y, -134), '근육');
  muscle(0, 8, -138);
  choiceGate({
    z: -144,
    y: Y,
    name: '근육',
    question: '근육은 산소를 이용해 무엇을 할까요?',
    hint: '움직임에 필요한 힘을 얻어요.',
    options: [
      { text: '영양소에서 에너지 얻기', correct: true },
      { text: '뼈를 산소로 만들기' },
      { text: '피를 파란색으로 바꾸기' },
    ],
    right: '맞아요! 근육 세포는 산소를 이용해 영양소에서 에너지를 얻어요.',
    wrong: '근육은 산소와 영양소를 이용해 움직이는 데 필요한 에너지를 얻어요.',
    color: '#b45f2a',
  });
  const goal = platform(0, Y, -157, 16, 12, C.muscle);
  finishPad(goal, -155);
  sign('산소 전달 완료!', 0, 8, -155, { width: 7, color: '#a22c3a' });

  // 혈관 가지와 세포는 장식이며 플레이어와 부딪히지 않는다.
  vesselDecor(-70, -105);
  vesselDecor(-106, -140);

  level.setSeed = (s) => {
    level.seed = s;
    shuffleGates(level, s);
  };
  level.setSeed(seed);
  return finalizeLevel(level);

  function valveDoor({ z, y, plates: positions, message }) {
    const width = 22;
    const doorWidth = 4;
    const H = 7;
    for (const side of [-1, 1]) {
      block(side * (width / 2 - 1), y + H, z - 0.5, 2, H + 2, 1, C.vesselDark);
    }
    block(0, y + H, z - 0.5, width, H - 3, 1, C.vesselDark);
    platform(0, y, z - 0.5, doorWidth, 1, C.floor);
    const door = block(0, y + 3, z - 0.5, doorWidth - 0.1, 3, 0.5, C.valve, { dynamic: true, castShadow: true });
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 16, 12),
      new THREE.MeshStandardMaterial({ color: C.vesselDark, emissive: 0x25060a }),
    );
    lamp.position.set(0, y + 4.6, z + 0.4);
    root.add(lamp);
    const pads = positions.map(([x, pz], i) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.15, 0.2, 20),
        new THREE.MeshStandardMaterial({ color: C.vesselDark, emissive: C.vesselDark, emissiveIntensity: 0.2 }),
      );
      mesh.position.set(x, y + 0.1, pz);
      root.add(mesh);
      sign(i === 0 ? '심장' : '박동', x, y + 2.7, pz, { width: 2.2, color: '#a22c3a' });
      return { x, z: pz, until: -1, mesh };
    });
    const home = door.position.clone();
    let activated = false;
    let lift = 0;
    movers.push({
      root: null,
      update(t, dt, player) {
        const feet = [];
        if (player) feet.push(player.pos);
        feet.push(...(level.getOthers?.() || []));
        const latch = (level.getOthers?.().length || 0) >= 2 ? 2.5 : 8;
        for (const p of pads) {
          const pressed = feet.some((f) => Math.abs(f.x - p.x) < 1.35 && Math.abs(f.z - p.z) < 1.35 && f.y > y - 0.5 && f.y < y + 1.5);
          if (pressed) p.until = t + latch;
          const on = t < p.until;
          p.mesh.material.color.setHex(on ? C.oxygen : C.vesselDark);
          p.mesh.material.emissive.setHex(on ? C.oxygen : C.vesselDark);
          if (!on) p.mesh.material.emissiveIntensity = 0.2;
        }
        if (!activated && pads.every((p) => t < p.until)) {
          activated = true;
          level.onMessage?.(message, true);
        }
        lift = THREE.MathUtils.clamp(lift + (activated ? dt * 2 : 0), 0, 1);
        door.position.y = home.y + lift * 3.2;
        door.userData.collider.enabled = lift < 0.95;
        const pulse = 1 + Math.sin(t * 5) * 0.12;
        lamp.scale.setScalar(activated ? 1.15 : pulse);
        lamp.material.color.setHex(activated ? C.oxygen : C.vesselDark);
        lamp.material.emissive.setHex(activated ? 0x07506a : 0x25060a);
      },
    });
  }

  function lungs(x, y, z) {
    const g = new THREE.Group();
    const l = new THREE.Mesh(new THREE.SphereGeometry(2.8, 20, 16), mat(C.lung, { roughness: 0.7 }));
    const r = l.clone();
    l.position.set(-2.2, 0, 0);
    r.position.set(2.2, 0, 0);
    l.scale.set(0.8, 1.1, 0.7);
    r.scale.copy(l.scale);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 12), mat(C.vessel));
    tube.position.y = 3;
    g.add(l, r, tube);
    g.position.set(x, y, z);
    root.add(g);
  }

  function heart(x, y, z) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 20, 16),
      mat(C.heart, { emissive: 0x6d1020, emissiveIntensity: 0.3 }),
    );
    mesh.scale.set(1, 1.2, 0.8);
    mesh.position.set(x, y, z);
    root.add(mesh);
    movers.push({ root: mesh, update(t) { const p = 1 + Math.max(0, Math.sin(t * 5)) * 0.08; mesh.scale.set(p, p * 1.2, p * 0.8); } });
  }

  function muscle(x, y, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const fiber = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 3.4, 4, 8), mat(i % 2 ? C.muscle : 0xf1a66a));
      fiber.rotation.z = Math.PI / 2;
      fiber.position.set((i - 2) * 1.15, 0, 0);
      g.add(fiber);
    }
    g.position.set(x, y, z);
    root.add(g);
  }

  function vesselRun(z0, z1, color) {
    for (const x of [-9, 9]) {
      const wall = block(x, 5, (z0 + z1) / 2, 1.2, 7, z0 - z1, color);
      wall.material = mat(color, { roughness: 0.45, metalness: 0.1 });
    }
    for (let z = z0; z >= z1; z -= 8) {
      const p = platform(0, Y, z, 14, 7, C.floor);
      if (z === z0) checkpoint(p, new THREE.Vector3(0, Y, z + 2), '동맥');
    }
  }

  function bloodCells(z0, z1, count, color) {
    const cells = [];
    for (let i = 0; i < count; i++) {
      const cell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), mat(color, { emissive: 0x145064, emissiveIntensity: 0.25 }));
      cell.position.set((i % 3 - 1) * 3, Y + 1.3 + (i % 2) * 0.8, z0);
      root.add(cell);
      cells.push(cell);
    }
    movers.push({ root: null, update(t) { cells.forEach((c, i) => { c.position.z = z0 - ((t * 5 + i * 9) % (z0 - z1)); }); } });
  }

  function vesselDecor(z0, z1) {
    for (const x of [-17, 17]) {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 1.2, Math.abs(z1 - z0), 12, 1, true),
        new THREE.MeshStandardMaterial({ color: C.vessel, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
      );
      tube.rotation.x = Math.PI / 2;
      tube.position.set(x, 2, (z0 + z1) / 2);
      root.add(tube);
    }
  }
}
