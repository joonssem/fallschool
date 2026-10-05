// 문장 구조 열차: 갈림길을 걸어 장소와 사건을 고르면 장면과 완성 문장이 바뀐다.
// 자유 입력·정오 판정이 아니라, 네 가지 자연스러운 이야기의 구조를 탐험한다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';

export const STORY_CHOICES = {
  places: [
    { id: 'forest', x: -5, phrase: '숲으로', color: 0x77bd78 },
    { id: 'sea', x: 5, phrase: '바다로', color: 0x6dbbd7 },
  ],
  events: [
    { id: 'friend', x: -5, phrase: '친구를 만났어요', color: 0xf2b66d },
    { id: 'letter', x: 5, phrase: '편지를 찾았어요', color: 0xc4a9e7 },
  ],
};

export function buildSentenceTrain(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '이야기 출발역', zMax: Infinity },
      { name: '행선지 갈림길', zMax: -14 },
      { name: '다음 장면역', zMax: -33 },
      { name: '사건 갈림길', zMax: -51 },
      { name: '이야기 도착역', zMax: -68 },
    ]),
    sky: { background: 0xcde8f4, fog: [0xcde8f4, 75, 170], hemi: 1.6 },
  });
  const { root, movers } = level;
  const { mat, platform, sign, startCheckpoint, checkpoint } = makeKit(level);
  const state = level.story = { place: null, event: null };
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
  sign('그곳에서 무엇을 했을까요?', 0, 7.5, -48, { width: 9 });

  for (const event of STORY_CHOICES.events) {
    platform(event.x, 1, -59, 6, 18, event.color);
    const pad = platform(event.x, 1.12, -63, 5, 4, 0xffefb3);
    sign(event.phrase, event.x, 5.3, -54, { width: 5.4 });
    pad.userData.collider.onStand = () => state.chooseEvent(event.id);
  }
  storyStar(-10, -61); // 기본 갈림길 밖의 선택 도전. 완주 조건이 아니다.
  platform(0, 1, -78, 20, 22, 0xe5d6b1);

  // 도착역 옆의 열차는 선택한 장소색·사건 물체로 바뀌고 앞으로 들어온다.
  const train = new THREE.Group();
  train.position.set(12, 0, -93);
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
  for (const x of [10.2, 13.8]) decoration(new THREE.BoxGeometry(0.18, 0.12, 25), 0x596171, x, 1.08, -80);
  movers.push({ root: train, update(_t, dt) {
    const target = state.event ? -78 : -93;
    const dz = target - train.position.z;
    train.position.z += Math.sign(dz) * Math.min(Math.abs(dz), 10 * dt);
  } });

  const endings = {};
  for (const place of STORY_CHOICES.places) for (const event of STORY_CHOICES.events) {
    const board = sign('', 0, 6.9, -78, { width: 11, lines: [
      `기차는 ${place.phrase} 갔어요.`, `그곳에서 ${event.phrase}.`,
    ] });
    endings[`${place.id}:${event.id}`] = board;
  }
  const finish = platform(0, 1.1, -84, 12, 6, 0x88cfa2);
  finish.userData.collider.onStand = (player) => {
    if (level.finished || player.pos.z > -84 || !state.place || !state.event) return;
    level.finished = true;
    level.onFinish?.();
  };

  function refresh() {
    for (const [id, group] of Object.entries(scenes)) group.visible = !state.place || state.place === id;
    for (const [id, board] of Object.entries(placeSigns)) board.visible = state.place === id;
    for (const [key, board] of Object.entries(endings)) board.visible = key === `${state.place}:${state.event}`;
    body.material = mat(STORY_CHOICES.places.find((p) => p.id === state.place)?.color ?? 0x999999);
    friend.visible = state.event === 'friend';
    letter.visible = state.event === 'letter';
  }
  state.choosePlace = (id) => {
    const place = STORY_CHOICES.places.find((p) => p.id === id);
    if (!place || state.place === id) return;
    state.place = id;
    refresh();
    level.onMessage?.(`기차는 ${place.phrase} 갔어요. 이제 그곳에서 일어날 일을 고르세요.`, true);
  };
  state.chooseEvent = (id) => {
    const event = STORY_CHOICES.events.find((e) => e.id === id);
    if (!event || state.event === id) return;
    state.event = id;
    refresh();
    level.onMessage?.(`그곳에서 ${event.phrase}. 완성한 이야기를 도착역에서 보세요.`, true);
  };
  level.storyScenes = { scenes, placeSigns, endings, train, friend, letter, body };
  refresh();
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => {
    resetProgress();
    state.place = null;
    state.event = null;
    train.position.z = -93;
    refresh();
  };
  level.setSeed(seed);
  return level;
}
