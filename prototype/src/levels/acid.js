// 맵 3: "산과 염기 실험실"
// 용액의 성질(지시약 색 변화)을 알아야 길을 고를 수 있는 코스. 조작은 쉽게, 판단이 성공을 가른다.
// 구간: 실험실 입구 → 페놀프탈레인 문 → 식초 웅덩이(리트머스 발판) → 비눗물 웅덩이(리트머스 발판)
//       → 붉은 양배추 문 → 유리 막대 젓기 → 섞으면? 문 → 결승
//
// 리트머스 발판: 그 용액에 넣은 리트머스 종이와 같은 색 발판만 버틴다 (식초 → 붉은색, 비눗물 → 푸른색).
// 틀린 색 발판은 밟는 순간 녹아 점프·다이브도 못 한다. 빨리 달리거나 연속 점프로 건너뛰지 못하게 한 것.
// 한 줄 이상 뛰어넘어도 다섯 줄(13.5m)은 점프 + 다이브로 넘지 못한다.
import * as THREE from 'three';
import { mulberry32, createLevel, makeKit, finalizeLevel, shuffleGates, sectionFinder } from './kit.js';

const C = {
  floor: 0xf1f5f9,
  floor2: 0xdbe7f0,
  checkpoint: 0x9be564,
  pillar: 0x94a3b8,
  red: 0xe63946,
  blue: 0x3a86ff,
  vinegar: 0xf6e7a1,
  soap: 0xe9f1f7,
  rod: 0x9fd8e8,
};

const SECTIONS = [
  { name: '실험실 입구', zMax: Infinity },
  { name: '페놀프탈레인 문', zMax: -23 },
  { name: '식초 웅덩이', zMax: -38 },
  { name: '비눗물 웅덩이', zMax: -58 },
  { name: '붉은 양배추 문', zMax: -78 },
  { name: '유리 막대 젓기', zMax: -93 },
  { name: '섞으면? 문', zMax: -111 },
  { name: '결승', zMax: -126 },
];

const COLS = 5;
const ROWS = 5;
const PITCH = 2.7;
const TILE = 2.4;

export function buildAcid(parent, world, { seed = Date.now() } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder(SECTIONS),
    sky: { background: 0xe3eef5, fog: [0xe3eef5, 70, 190], hemi: 1.5 },
  });
  const root = level.root;
  const { movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, choiceGate } = makeKit(level);
  const Y = 1.5; // 코스 대부분의 높이

  // 비커: 받침대(충돌) 위에 유리 + 색 있는 용액. 문 앞에서 "이 색"을 눈으로 보여 준다.
  function beaker(x, baseY, z, liquid) {
    block(x, baseY + 1, z, 1.4, 1, 1.4, C.pillar);
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 1.5, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    glass.position.set(x, baseY + 1.75, z);
    root.add(glass);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.95, 20), mat(liquid, { emissive: liquid, emissiveIntensity: 0.25 }));
    water.position.set(x, baseY + 1.5, z);
    root.add(water);
  }

  // 옆에 비스듬히 세우는 안내판 (길을 가리지 않게)
  const sideSign = (side, y, z, lines, color) =>
    sign(lines[0], side * 7.5, y + 3.2, z, { width: 6, color, lines, rotY: -side * 0.45 });

  // ─── 실험실 입구 ─────────────────────────────────────
  platform(0, 0, 0, 16, 16, C.floor);
  startCheckpoint('실험실 입구');
  sideSign(-1, 0, -3, ['산과 염기 실험실', '용액의 성질을 알아야', '길이 열려요'], '#6a4c93');
  platform(0, 0.5, -12.5, 5, 5, C.floor2);
  platform(0, 1, -19, 5, 4, C.floor2);

  // ─── 페놀프탈레인 문 ─────────────────────────────────
  const cp1 = platform(0, Y, -27, 14, 8, C.checkpoint);
  checkpoint(cp1, new THREE.Vector3(0, Y, -25), '페놀프탈레인 문 앞');
  beaker(-5.5, Y, -25.5, 0xe5487a); // 문 앞을 막지 않게 뒤쪽에
  choiceGate({
    z: -31,
    y: Y,
    question: '붉게 변한 이 용액은 무엇일까?',
    hint: '페놀프탈레인 용액을 넣었어요',
    options: [{ text: '비눗물', correct: true }, { text: '식초' }, { text: '레몬즙' }],
    right: '정답! 페놀프탈레인 용액은 염기성 용액에서 붉게 변해요. 비눗물은 염기성 용액이에요',
    wrong: '다시! 식초와 레몬즙은 산성 용액이에요. 페놀프탈레인 용액은 어떤 용액에서 붉게 변했지?',
    color: '#c9184a',
  });

  // ─── 리트머스 발판 두 구역 ─────────────────────────────
  const tiles = [];
  const fields = [];
  const pool = (z0, z1, color) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(22, z0 - z1),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.75, roughness: 0.2 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, Y - 3, (z0 + z1) / 2);
    root.add(m);
  };

  function litmusField(zFirst, safeColor, name, wrong) {
    const field = { safeColor, name, wrong, tiles: [], hinted: false };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = (c - (COLS - 1) / 2) * PITCH;
        const z = zFirst - r * PITCH;
        const mesh = block(x, Y, z, TILE, 0.3, TILE, 0, {
          material: new THREE.MeshStandardMaterial({ color: C.red, roughness: 0.8 }),
        });
        const tile = { index: tiles.length, field, row: r, col: c, mesh, safe: true, home: mesh.position.clone(), state: 'idle', timer: 0 };
        tiles.push(tile);
        field.tiles.push(tile);
        mesh.userData.collider.onStand = (player) => {
          if (tile.safe || tile.state !== 'idle') return;
          melt(tile);
          // 녹는 발판에서는 뛰지도 다이브하지도 못한다
          player.grounded = false;
          player.ground = null;
          player.canDive = false;
          level.onTileTriggered?.(tile.index);
          if (!field.hinted) {
            field.hinted = true;
            level.onMessage?.(field.wrong, false);
          }
        };
      }
    }
    fields.push(field);
    return field;
  }

  function melt(tile) {
    tile.state = 'melting';
    tile.timer = 2.5;
    tile.mesh.userData.collider.enabled = false;
  }

  // 식초 웅덩이: 입구 발판(-38 ~ -44) → 발판 5줄 (-44.5 ~ -57.7)
  // 입구 발판은 발판 5칸 너비(13.2)보다 넓게: 끝 칸이 안전한 칸이어도 옆으로 떨어지지 않고 간다
  const cpA = platform(0, Y, -41, 14, 6, C.floor2);
  checkpoint(cpA, new THREE.Vector3(0, Y, -40), '식초 웅덩이 앞');
  sideSign(-1, Y, -41, ['식초 웅덩이', '식초에 넣은 리트머스 종이와', '같은 색 발판만 버텨요'], '#b08900');
  litmusField(-45.7, 'red', '식초', '앗, 녹았어요! 식초는 산성 용액이에요. 산성 용액에서 리트머스 종이는 무슨 색이 됐지?');
  pool(-44, -58, C.vinegar);

  // 비눗물 웅덩이: 입구 발판(-58 ~ -64) → 발판 5줄 (-64.5 ~ -77.7)
  const cpB = platform(0, Y, -61, 14, 6, C.floor2);
  checkpoint(cpB, new THREE.Vector3(0, Y, -60), '비눗물 웅덩이 앞');
  sideSign(1, Y, -61, ['비눗물 웅덩이', '비눗물에 넣은 리트머스 종이와', '같은 색 발판만 버텨요'], '#1d4ed8');
  litmusField(-65.7, 'blue', '비눗물', '앗, 녹았어요! 비눗물은 염기성 용액이에요. 염기성 용액에서 리트머스 종이는 무슨 색이 됐지?');
  pool(-64, -78, C.soap);

  // 녹은 발판은 가라앉았다가 잠시 뒤 제자리로 (색은 그대로라 다시 봐도 판단은 같다)
  movers.push({
    root: null,
    update(t, dt) {
      for (const tile of tiles) {
        if (tile.state !== 'melting') continue;
        tile.timer -= dt;
        tile.mesh.position.y -= dt * 2.5;
        tile.mesh.scale.setScalar(Math.max(0.2, tile.timer / 2.5));
        if (tile.timer <= 0) {
          tile.state = 'idle';
          tile.mesh.position.copy(tile.home);
          tile.mesh.scale.setScalar(1);
          tile.mesh.userData.collider.enabled = true;
        }
      }
    },
  });

  // 다른 학생이 밟아 녹은 발판 (모두의 화면에서 같이 녹는다)
  level.triggerTile = (index) => {
    const tile = tiles[index];
    if (tile && !tile.safe && tile.state === 'idle') melt(tile);
  };

  // ─── 붉은 양배추 문 ──────────────────────────────────
  const cp3 = platform(0, Y, -82, 14, 8, C.checkpoint);
  checkpoint(cp3, new THREE.Vector3(0, Y, -80), '붉은 양배추 문 앞');
  beaker(5.5, Y, -80.5, 0xffd60a);
  choiceGate({
    z: -86,
    y: Y,
    question: '노랗게 변한 이 용액의 성질은?',
    hint: '붉은 양배추 지시약을 넣었어요',
    options: [{ text: '염기성', correct: true }, { text: '산성' }, { text: '알 수 없어요' }],
    right: '정답! 붉은 양배추 지시약은 산성에서 붉은색 계열, 염기성에서 푸른색·노란색 계열로 변해요',
    wrong: '다시! 붉은 양배추 지시약은 산성 용액에서 붉은색 계열로 변해요. 그럼 노란색은?',
    color: '#7b2cbf',
  });

  // ─── 유리 막대 젓기: 도는 막대를 뛰어넘기 ─────────────────
  const plaza = platform(0, Y, -102, 14, 18, C.floor);
  checkpoint(plaza, new THREE.Vector3(0, Y, -94), '유리 막대 젓기');
  sign('유리 막대로 젓는 중! 뛰어넘어요', 0, Y + 5.5, -93.3, { width: 7, color: '#0e7490' });
  const stir = new THREE.Group();
  stir.position.set(0, 0, -102);
  root.add(stir);
  block(0, Y + 0.9, 0, 13, 0.6, 0.6, C.rod, { parent: stir, kind: 'bumper', dynamic: true, castShadow: true });
  block(0, Y + 1.2, -102, 1, 1.2, 1, C.pillar, { castShadow: true });
  movers.push({
    root: stir,
    update(t) {
      stir.rotation.y = t * 0.9;
    },
  });

  // ─── 섞으면? 문 ──────────────────────────────────────
  const cp4 = platform(0, Y, -115, 14, 8, C.checkpoint);
  checkpoint(cp4, new THREE.Vector3(0, Y, -114), '섞으면? 문 앞');
  choiceGate({
    z: -119,
    y: Y,
    question: '묽은 염산에 염기성 용액을 계속 넣으면?',
    hint: '묽은 수산화 나트륨 용액을 조금씩 넣어요',
    options: [{ text: '산성이 약해져요', correct: true }, { text: '산성이 강해져요' }, { text: '변하지 않아요' }],
    right: '정답! 산성 용액에 염기성 용액을 넣을수록 산성이 점점 약해져요',
    wrong: '다시! 산성 용액과 염기성 용액을 섞으면 서로의 성질이 어떻게 될까?',
    color: '#2a9d8f',
  });

  // ─── 결승 ───────────────────────────────────────────
  const goal = platform(0, Y, -132, 14, 12, C.floor);
  for (const sx of [-1, 1]) block(sx * 6.4, Y + 7, -130, 1, 7, 1, C.pillar, { castShadow: true });
  const arch = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.8, 1), mat(0x4cc9f0));
  arch.position.set(0, Y + 7.4, -130);
  root.add(arch);
  sign('실험 완료!', 0, Y + 8.6, -129.45, { width: 5, color: '#118ab2' });
  finishPad(goal, -130);

  // ─── 배경: 큰 플라스크와 시험관 ─────────────────────────
  const rand = mulberry32(20260929);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, fog: true });
  const liquids = [0xe5487a, 0xffd60a, 0x3a86ff, 0x9d4edd, 0x2ec4b6];
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (26 + rand() * 20);
    const z = 10 - i * 11 - rand() * 6;
    const r = 3 + rand() * 3;
    const h = 8 + rand() * 10;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), glassMat);
    body.position.set(x, -6 + h / 2, z);
    root.add(body);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.94, h * 0.5, 24), mat(liquids[i % liquids.length]));
    liquid.position.set(x, -6 + h * 0.25, z);
    root.add(liquid);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0xcbd5e1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -6, -60);
  root.add(ground);

  // 경기마다 새 배치: 리트머스 발판 색, 예측 문 정답 위치 (같은 방이면 모두 같다)
  level.setSeed = (s) => {
    level.seed = s;
    fields.forEach((field, fi) => {
      const r = mulberry32((s ^ (fi + 1) * 0x85ebca6b) >>> 0);
      // 이어지는 안전한 길 + 나머지는 섞기. 옆 칸으로 옮길 때는 같은 줄의 옆 칸도 안전하게 해서
      // (ㄱ자 길) 대각선으로 건너다 이웃한 틀린 칸 모서리를 밟지 않고도 갈 수 있게 한다.
      const safe = new Set();
      let col = Math.floor(r() * COLS);
      for (let row = 0; row < ROWS; row++) {
        safe.add(`${row},${col}`);
        const next = THREE.MathUtils.clamp(col + Math.floor(r() * 3) - 1, 0, COLS - 1);
        safe.add(`${row},${next}`);
        col = next;
      }
      for (const tile of field.tiles) {
        tile.safe = safe.has(`${tile.row},${tile.col}`) || r() < 0.15;
        const isRed = tile.safe === (field.safeColor === 'red');
        tile.mesh.material.color.setHex(isRed ? C.red : C.blue);
        tile.state = 'idle';
        tile.mesh.position.copy(tile.home);
        tile.mesh.scale.setScalar(1);
        tile.mesh.userData.collider.enabled = true;
      }
      field.hinted = false;
    });
    shuffleGates(level, s);
  };
  level.revealPath = () => {};
  level.setSeed(seed);
  return finalizeLevel(level);
}
