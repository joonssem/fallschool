// 문장 구조 열차: 갈림길을 걸어 장소와 사건을 고르면 장면과 완성 문장이 바뀐다.
// 자유 입력·정오 판정이 아니라, 네 가지 자연스러운 이야기의 구조를 탐험한다.
// 구간: 출발역 → 행선지 갈림길 → 다음 장면역 → (2026-10-05 연장) 조사 터널 3곳 → 사건 갈림길 → 어순 철교 → 도착역
//   조사 터널: 역 이름 뒤에 '로'가 붙을지 '으로'가 붙을지 골라 터널로 들어간다. 틀린 터널은 막다른 굴(되돌아 나온다, 떨어지지 않음).
//   어순 철교: 좌우로 흔들리는 열차 칸에 낱말이 붙어 있다. 문장 차례대로 타야 건넌다. 틀린 칸은 천천히 가라앉아 아래 물길에 내려앉는다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { dynamicSign, rngFor, shuffled, pick } from './variants.js';

export const STORY_CHOICES = {
  places: [
    { id: 'forest', x: -5, word: '숲', phrase: '숲으로', color: 0x77bd78 },
    { id: 'sea', x: 5, word: '바다', phrase: '바다로', color: 0x6dbbd7 },
  ],
  events: [
    { id: 'friend', x: -5, phrase: '친구를 만났어요', chunks: ['그곳에서', '친구를', '만났어요.'], color: 0xf2b66d },
    { id: 'letter', x: 5, phrase: '편지를 찾았어요', chunks: ['그곳에서', '편지를', '찾았어요.'], color: 0xc4a9e7 },
  ],
};

/** 낱말 뒤의 조사 '로/으로': 받침이 없거나 ㄹ받침이면 '로', 그 밖의 받침이면 '으로' */
export function josaRo(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return '로';
  const jong = code % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}
// 경유역 이름 후보 (로: 받침 없음·ㄹ받침 / 으로: 그 밖의 받침)
export const STATION_WORDS = {
  ro: ['학교', '마을', '교실', '호수', '바위', '놀이터', '나라', '강가'],
  euro: ['산', '공원', '운동장', '들판', '도서관', '박물관', '섬', '시장'],
};
/** 시드별 경유역 두 곳: '로' 하나 + '으로' 하나를 섞어 둘 다 나오게 한다 */
export function stationWords(seed) {
  const rand = rngFor(seed, 71);
  return shuffled(rand, [pick(rand, STATION_WORDS.ro), pick(rand, STATION_WORDS.euro)]);
}
/** 시드별 어순 철교: 줄마다 맞는 칸이 왼쪽(-1)인지 오른쪽(1)인지 */
export function bridgeSides(seed) {
  const rand = rngFor(seed, 72);
  return [0, 1, 2].map(() => (rand() < 0.5 ? -1 : 1));
}
export const GATE_Z = [-50, -65, -80]; // 조사 터널 갈림목 (각 15m)
export const ROW_Z = [-135.5, -141, -146.5]; // 어순 철교 칸 줄
// 한 줄의 두 칸은 함께 좌우로 오간다(사이 2.4m). 이웃한 줄은 박자가 반대라, 맞는 칸이 왼쪽이든 오른쪽이든 기다리면 바로 앞에 온다.
export const CAR_SWAY = { amp: 3.2, w: 0.9 };
export const carX = (row, side, t) => side * 3.2 + CAR_SWAY.amp * Math.sin(CAR_SWAY.w * t + row * Math.PI);
const LANE_X = { ro: -5, euro: 5 };

export function buildSentenceTrain(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '이야기 출발역', zMax: Infinity },
      { name: '행선지 갈림길', zMax: -14 },
      { name: '다음 장면역', zMax: -33 },
      { name: '조사 터널', zMax: -50 },
      { name: '사건 갈림길', zMax: -95 },
      { name: '어순 철교', zMax: -123 },
      { name: '이야기 도착역', zMax: -150 },
    ]),
    sky: { background: 0xcde8f4, fog: [0xcde8f4, 75, 170], hemi: 1.6 },
  });
  const { root, movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint } = makeKit(level);
  const state = level.story = { place: null, event: null };
  const HIDDEN = new THREE.Vector3(0, -200, 0);
  level.spawn.set(0, 1, 4);
  platform(0, 1, -4, 20, 20, 0xe5d6b1);
  startCheckpoint('이야기 출발역');
  sign('문장 구조 열차', -8, 4.6, -5, { width: 4.4, rotY: 0.2 });
  sign('두 길 중 한 곳으로 가요', 8, 4.6, -5, { width: 4.4, rotY: -0.2 });

  function decoration(geometry, color, x, y, z) {
    const mesh = new THREE.Mesh(geometry, mat(color));
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  }
  function storyStar(x, z) {
    platform(x, 1, z, 2.8, 3.2, 0xffdc83);
    const mesh = decoration(new THREE.OctahedronGeometry(0.7), 0xffd60a, x, 3.25, z);
    level.stars.push({ mesh, got: false });
  }
  function hiddenStar(at) { // 조건을 채우면 at에 나타나는 별 (그 전에는 닿지 않는 곳)
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.8 }));
    mesh.position.copy(HIDDEN); root.add(mesh);
    const entry = { mesh, got: false, at };
    level.stars.push(entry);
    return entry;
  }

  // ─── 행선지 갈림길 ───────────────────────────────────
  const scenes = {};
  for (const place of STORY_CHOICES.places) {
    platform(place.x, 1, -23, 6, 20, place.color); // 두 경로 모두 넓고 완주 가능
    const pad = platform(place.x, 1.12, -28, 5, 4, 0xffefb3);
    sign(place.phrase, place.x, 5.3, -17, { width: 4.4 });
    pad.userData.collider.onStand = () => state.choosePlace(place.id);
    const group = new THREE.Group();
    root.add(group);
    if (place.id === 'forest') {
      for (const [x, z] of [[-10, -19], [-11, -25], [-9.5, -30]]) {
        const trunk = decoration(new THREE.CylinderGeometry(0.22, 0.28, 2, 8), 0x8f6345, x, 2, z);
        const crown = decoration(new THREE.ConeGeometry(1.25, 2.7, 8), 0x448e65, x, 4, z);
        group.add(trunk, crown);
      }
    } else {
      for (const [x, z] of [[10, -19], [11, -25], [9.5, -30]]) {
        const wave = decoration(new THREE.TorusGeometry(0.85, 0.15, 6, 18, Math.PI), 0x408db4, x, 1.35, z);
        wave.rotation.x = -Math.PI / 2;
        group.add(wave);
      }
    }
    scenes[place.id] = group;
  }
  platform(0, 1, -41, 20, 18, 0xe5d6b1);
  checkpoint(platform(0, 1.03, -37, 6, 5, 0xa6d9a2), new THREE.Vector3(0, 1, -37), '다음 장면역');
  const placeSigns = Object.fromEntries(STORY_CHOICES.places.map((place) => [place.id,
    sign(`기차는 ${place.phrase} 갔어요.`, 0, 6, -45, { width: 9 })]));

  // ─── 조사 터널 3곳 ───────────────────────────────────
  // 갈림목마다 역 이름판이 있고, 왼쪽 터널은 '로', 오른쪽 터널은 '으로'다. 맞는 터널만 다음 갈림목으로 이어진다.
  // 터널 입구는 어두운 장막이라 안이 보이지 않는다(메아리 탐정단의 막다른 굴). 틀린 터널 끝 벽 앞에 규칙 안내가 있다.
  // 첫 역은 학생이 고른 장소, 나머지 두 역은 시드로 고른다('로' 하나, '으로' 하나).
  const curtainMat = new THREE.MeshBasicMaterial({ color: 0x0b1424, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
  const tunnels = { gates: [], wrongEntries: 0, star: null };
  GATE_Z.forEach((zg, g) => {
    platform(0, 1, zg - 2, 20, 4, 0xe5d6b1); // 갈림목 (앞 구간과 이어짐)
    platform(0, 1, zg - 9.5, 16, 11, 0xcfc3a1); // 두 터널 바닥 (가운데 벽으로 나뉜다, 아래로 떨어지는 틈 없음)
    for (const wx of [-8.2, 0, 8.2]) block(wx, 6, zg - 9.6, wx === 0 ? 3.6 : 0.6, 5, 11.2, 0x5b6476);
    const board = dynamicSign(root, { x: 0, y: 5.6, z: zg - 0.4, width: 7, rows: 2, color: '#3d405b' });
    const lanes = {};
    for (const key of ['ro', 'euro']) {
      const x = LANE_X[key];
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5), curtainMat);
      mouth.position.set(x, 3.5, zg - 4.1); root.add(mouth);
      sign(key === 'ro' ? '로' : '으로', x, 3.3, zg - 3.9, { width: 2.6, color: key === 'ro' ? '#2a7f62' : '#8a4fbf' });
      const end = block(x, 6, zg - 13, 6.4, 5.2, 0.6, 0x3d405b);
      const note = sign('막힌 철로', x, 3.2, zg - 12.6, { width: 5.4, lines: ['막힌 철로! 돌아 나가요', '받침이 없거나 ㄹ받침이면 → 로', '다른 받침이면 → 으로'] });
      lanes[key] = { x, end, note, entered: false };
    }
    if (g === 1) checkpoint(platform(0, 1.03, zg - 2, 6, 3.6, 0xa6d9a2), new THREE.Vector3(0, 1, zg - 2), '조사 신호소');
    tunnels.gates.push({ z: zg, board, lanes, word: '', answer: 'ro', wrong: 0 });
  });
  tunnels.star = hiddenStar(new THREE.Vector3(7, 2.6, -97));
  level.tunnels = tunnels;
  function setGate(gate, word) {
    gate.word = word;
    gate.answer = josaRo(word) === '로' ? 'ro' : 'euro';
    gate.board.set([`다음 역: ${word}`, `기차는 ${word}○ 가요. 로? 으로?`]);
    for (const [key, lane] of Object.entries(gate.lanes)) {
      const blocked = key !== gate.answer;
      lane.end.visible = blocked; lane.end.userData.collider.enabled = blocked; lane.note.visible = blocked;
    }
  }

  // ─── 사건 갈림길 ─────────────────────────────────────
  platform(0, 1, -100, 20, 10, 0xe5d6b1);
  checkpoint(platform(0, 1.03, -98, 6, 3.6, 0xa6d9a2), new THREE.Vector3(0, 1, -98), '사건 갈림길');
  sign('그곳에서 무엇을 했을까요?', 0, 7.2, -104.5, { width: 9 });
  for (const event of STORY_CHOICES.events) {
    platform(event.x, 1, -114, 6, 18, event.color);
    const pad = platform(event.x, 1.12, -118, 5, 4, 0xffefb3);
    sign(event.phrase, event.x, 5.3, -109, { width: 5.4 });
    pad.userData.collider.onStand = () => state.chooseEvent(event.id);
  }
  storyStar(-10, -116); // 기본 갈림길 밖의 선택 도전. 완주 조건이 아니다.

  // ─── 어순 철교 ───────────────────────────────────────
  // 줄마다 열차 칸 두 개가 좌우로 흔들린다(자석 항구 징검다리·점프 연구소 움직이는 발판). 한 칸에는 문장의 다음 낱말,
  // 다른 칸에는 차례가 틀린 낱말이 붙어 있다. 틀린 칸에 0.6초 서 있으면 천천히 가라앉아 아래 물길(안전한 바닥)에 내려앉고,
  // 물길 끝 계단으로 철교 앞 역에 돌아온다. 맞는 칸 위치(왼쪽·오른쪽)는 시드로 바뀐다.
  platform(0, 1, -128, 20, 10, 0xe5d6b1); // 철교 앞 역 (-123 ~ -133), 첫 칸과의 틈 약 0.4m
  checkpoint(platform(0, 1.03, -126, 6, 3.6, 0xa6d9a2), new THREE.Vector3(0, 1, -126), '어순 철교');
  const orderBoard = dynamicSign(root, { x: 0, y: 6.6, z: -130.6, width: 8, rows: 2, color: '#a44a19' });
  platform(0.5, -1.6, -141.5, 23, 17, 0x6aa9c9); // 아래 물길 (z -133 ~ -150). 도착역 바닥은 2.6m 위라 아래에서 바로 올라가지 못한다
  for (const [i, top] of [[0, -0.6], [1, 0.4]]) platform(10.5, top, -135.6 + i * 1.2, 3, 1.2, 0xbfae8a); // 물길 → 철교 앞 역 계단 (칸이 오가는 범위 |x| < 8.4 밖)
  sign('물길 계단', 10.5, 1.6, -138, { width: 3.4, lines: ['물길 계단', '역으로 돌아가요'] });
  const bridge = { rows: [], mistakes: 0, sides: [-1, 1, 1], star: null };
  ROW_Z.forEach((z, r) => {
    const cars = [-1, 1].map((side) => {
      const mesh = platform(side * 3.2, 1, z, 4, 4.2, 0xe9edf2, { dynamic: true, castShadow: true });
      mesh.material = mesh.material.clone();
      const label = dynamicSign(root, { x: 0, y: 0, z: 0, width: 3.6 });
      mesh.add(label.mesh); label.mesh.position.set(0, 1.9, 1.6);
      const car = { side, mesh, label, word: '', correct: false, standFor: 0, sink: 0, downFor: 0 };
      movers.push({ root: mesh, update(t, dt, player) {
        const p = player?.pos;
        const on = !!p && Math.abs(p.x - mesh.position.x) < 2.1 && Math.abs(p.z - z) < 2.2 && p.y > mesh.position.y - 0.2 && p.y < mesh.position.y + 1.6;
        if (!car.correct && car.sink === 0 && on) {
          car.standFor += dt;
          if (car.standFor > 0.6) { car.sink = 1e-6; bridge.mistakes++; level.onMessage?.(`'${car.word}'는 지금 차례가 아니에요. 문장 순서: ${bridge.chunks.join(' → ')}`, false); }
        } else if (!on) car.standFor = 0;
        if (car.sink > 0) { // 가라앉기 → 아래에 머물기 → 다시 떠오르기
          if (car.sink < 1) car.sink = Math.min(1, car.sink + dt / 0.8);
          else if ((car.downFor += dt) > 2.5) { car.sink = 0; car.downFor = 0; }
        }
        mesh.position.x = carX(r, side, t);
        mesh.position.y = 0.5 - car.sink * 4;
        mesh.userData.collider.enabled = car.sink < 0.5;
        mesh.material.color.setHex(car.sink > 0 ? 0xb8c4d0 : 0xe9edf2);
      } });
      return car;
    });
    bridge.rows.push({ z, cars });
  });
  bridge.star = hiddenStar(new THREE.Vector3(-7, 2.6, -153));
  level.orderBridge = bridge;
  function setBridge(event, sides) {
    bridge.chunks = event.chunks;
    bridge.sides = sides;
    bridge.rows.forEach((row, r) => {
      const wrong = event.chunks[(r + 2) % 3]; // 차례가 틀린 낱말 (같은 문장의 다른 자리)
      for (const car of row.cars) {
        car.correct = car.side === sides[r];
        car.word = car.correct ? event.chunks[r] : wrong;
        car.label.set([car.word]);
      }
    });
    orderBoard.set(['문장 차례대로 칸을 타요', `기차는 ${STORY_CHOICES.places.find((p) => p.id === state.place)?.phrase ?? '…로'} 갔어요. → ( ) ( ) ( )`]);
  }

  // ─── 도착역 ─────────────────────────────────────────
  platform(0, 1, -160, 20, 20, 0xe5d6b1);
  // 도착역 옆의 열차는 선택한 장소색·사건 물체로 바뀌고 앞으로 들어온다.
  const train = new THREE.Group();
  train.position.set(12, 0, -175);
  root.add(train);
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2, 8), mat(0x999999));
  body.position.y = 2.35;
  train.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 8.4), mat(0xfaf0cc));
  roof.position.y = 3.55;
  train.add(roof);
  for (const z of [-2.7, 2.7]) for (const x of [-1.7, 1.7]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 12), mat(0x434a5d));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.85, z);
    train.add(wheel);
  }
  const friend = new THREE.Mesh(new THREE.SphereGeometry(0.65), mat(0xffcd7b));
  friend.position.set(0, 4.45, 0);
  train.add(friend);
  const letter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.2), mat(0xfff5dc));
  letter.position.set(0, 4.35, 0);
  train.add(letter);
  for (const x of [10.2, 13.8]) decoration(new THREE.BoxGeometry(0.18, 0.12, 25), 0x596171, x, 1.08, -162);
  movers.push({ root: train, update(_t, dt) {
    const target = state.event ? -160 : -175;
    const dz = target - train.position.z;
    train.position.z += Math.sign(dz) * Math.min(Math.abs(dz), 10 * dt);
  } });

  const endings = {};
  for (const place of STORY_CHOICES.places) for (const event of STORY_CHOICES.events) {
    const board = sign('', 0, 6.9, -160, { width: 11, lines: [
      `기차는 ${place.phrase} 갔어요.`, `그곳에서 ${event.phrase}.`,
    ] });
    endings[`${place.id}:${event.id}`] = board;
  }
  const finish = platform(0, 1.1, -166, 12, 6, 0x88cfa2);
  finish.userData.collider.onStand = (player) => {
    if (level.finished || player.pos.z > -166 || !state.place || !state.event) return;
    level.finished = true;
    level.onFinish?.();
  };

  // ─── 진행 ──────────────────────────────────────────
  // 터널: 들어간 쪽을 기록해 막다른 굴에 처음 들어가면 한 번 센다. 세 터널을 한 번도 막히지 않고 지나면 별.
  movers.push({ root: null, update(_t, _dt, player) {
    const p = player?.pos;
    if (!p) return;
    tunnels.gates.forEach((gate, g) => {
      for (const [key, lane] of Object.entries(gate.lanes)) {
        const inside = Math.abs(p.x - lane.x) < 3 && p.z < gate.z - 5 && p.z > gate.z - 12.6;
        if (inside && !lane.entered) {
          lane.entered = true;
          if (key !== gate.answer) {
            gate.wrong++; tunnels.wrongEntries++;
            level.onMessage?.(`'${gate.word}${key === 'ro' ? '로' : '으로'}'는 어색해요. 소리 내어 읽어 봐요: ${gate.word}${josaRo(gate.word)}.`, false);
          } else {
            level.onMessage?.(`${gate.word}${josaRo(gate.word)}! 철로가 이어져요.`, true);
            if (g === GATE_Z.length - 1 && tunnels.wrongEntries === 0 && !tunnels.star.got) tunnels.star.mesh.position.copy(tunnels.star.at);
          }
        }
      }
    });
    // 철교를 실수 없이 건너면 별 (도착역에 처음 들어설 때 판정)
    if (!bridge.judged && p.z < -151 && p.y > 0.5) {
      bridge.judged = true;
      if (bridge.mistakes === 0 && !bridge.star.got) bridge.star.mesh.position.copy(bridge.star.at);
    }
  } });

  function refresh() {
    for (const [id, group] of Object.entries(scenes)) group.visible = !state.place || state.place === id;
    for (const [id, board] of Object.entries(placeSigns)) board.visible = state.place === id;
    for (const [key, board] of Object.entries(endings)) board.visible = key === `${state.place}:${state.event}`;
    body.material = mat(STORY_CHOICES.places.find((p) => p.id === state.place)?.color ?? 0x999999);
    friend.visible = state.event === 'friend';
    letter.visible = state.event === 'letter';
    const place = STORY_CHOICES.places.find((p) => p.id === state.place) ?? STORY_CHOICES.places[(level.seed >>> 0) % 2];
    setGate(tunnels.gates[0], place.word);
    const event = STORY_CHOICES.events.find((e) => e.id === state.event) ?? STORY_CHOICES.events[(level.seed >>> 1) % 2];
    setBridge(event, bridge.sides);
  }
  state.choosePlace = (id) => {
    const place = STORY_CHOICES.places.find((p) => p.id === id);
    if (!place || state.place === id) return;
    state.place = id;
    refresh();
    level.onMessage?.(`기차는 ${place.phrase} 갔어요. 가는 길에 터널 세 곳을 지나요.`, true);
  };
  state.chooseEvent = (id) => {
    const event = STORY_CHOICES.events.find((e) => e.id === id);
    if (!event || state.event === id) return;
    state.event = id;
    refresh();
    level.onMessage?.(`그곳에서 ${event.phrase}. 철교에서는 이 문장을 차례대로 타요.`, true);
  };
  level.storyScenes = { scenes, placeSigns, endings, train, friend, letter, body };
  function applySeed(s) {
    level.seed = s;
    state.place = null; state.event = null;
    const words = stationWords(s);
    setGate(tunnels.gates[1], words[0]); setGate(tunnels.gates[2], words[1]);
    tunnels.wrongEntries = 0;
    for (const gate of tunnels.gates) { gate.wrong = 0; for (const lane of Object.values(gate.lanes)) lane.entered = false; }
    tunnels.star.mesh.position.copy(HIDDEN);
    bridge.sides = bridgeSides(s); bridge.mistakes = 0; bridge.judged = false;
    for (const row of bridge.rows) for (const car of row.cars) { car.sink = 0; car.standFor = 0; car.downFor = 0; }
    bridge.star.mesh.position.copy(HIDDEN);
    train.position.z = -175;
    refresh();
  }
  level.setSeed = applySeed;
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => {
    resetProgress();
    applySeed(level.seed);
  };
  level.setSeed(seed);
  return level;
}
