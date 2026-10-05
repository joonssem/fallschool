// 분수 피자 공장: 같은 전체를 기준으로 분수 조각을 모아 주문을 완성한다.
// 주문은 학생별 상태. 친구의 선택 때문에 내 문이 닫히거나 마지막 학생이 막히지 않는다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { connector, ROOM_STEP } from './course.js';
import { dynamicSign, rngFor, pick } from './variants.js';

// 주문 방 z와 방 사이 연결 코스 종류 (방 사이는 달리기·점프·타이밍 구간)
const ROOMS = [-34, -34 - ROOM_STEP, -34 - 2 * ROOM_STEP];
const KINDS = ['bar', 'movers'];

// 매 판 다른 주문: 주문마다 후보(8분의 몇 판)에서 시드로 고른다. 모두 1/4 단위라 조각(1/2·1/4·1/8)으로 만들 수 있다.
const TARGET_POOLS = [[2, 4], [4, 6], [6, 8]];
const LABELS = { 2: '4분의 1 (1/4)', 4: '반 판 (1/2)', 6: '4분의 3판 (3/4)', 8: '한 판 (1)' };
export const orderLabel = (target) => LABELS[target];

/** 주어진 조각(8분의 몇)으로 target을 만드는 조각 개수들 (최대 maxPieces개) */
export function pieceCounts(units, target, maxPieces = 8) {
  const counts = new Set();
  const walk = (i, left, n) => {
    if (left === 0) { counts.add(n); return; }
    if (i >= units.length || n >= maxPieces) return;
    for (let k = 0; k * units[i] <= left && n + k <= maxPieces; k++) walk(i + 1, left - k * units[i], n + k);
  };
  walk(0, target, 0);
  return [...counts].sort((a, b) => a - b);
}

/** 보너스 요청 조각 수: 가장 적은 개수(큰 조각만 고르면 되는 답)는 빼고, 6개 이하에서 시드로 고른다 */
export function bonusCount(units, target, rand) {
  const counts = pieceCounts(units, target, 6);
  const options = counts.length > 1 ? counts.slice(1) : counts;
  return options[Math.floor(rand() * options.length) % options.length];
}

export function buildPizza(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '분수 피자 공장', zMax: Infinity },
      { name: '주문 1', zMax: -15 },
      { name: '연결 코스', zMax: ROOMS[0] - 12 },
      { name: '주문 2', zMax: ROOMS[1] + 19 },
      { name: '연결 코스', zMax: ROOMS[1] - 12 },
      { name: '주문 3', zMax: ROOMS[2] + 19 },
      { name: '포장 출구', zMax: ROOMS[2] - 14 },
    ]),
    sky: { background: 0xffe6b8, fog: [0xffe6b8, 70, 180], hemi: 1.4 },
  });
  const kit = makeKit(level);
  const { platform, block, sign, startCheckpoint, checkpoint, finishPad } = kit;
  const colors = [0xf4a261, 0xe9c46a, 0x91c788];
  level.orders = [];
  platform(0, 0, 2, 20, 20, 0xf4a261);
  startCheckpoint('공장 입구');
  sign('분수 피자 공장', 0, 5, -5, { width: 8, color: '#a44a19', lines: ['분수 피자 공장', '조각 발판을 밟아 주문량을 만들어요'] });
  sign('같은 크기의 피자 한 판이 기준!', -9, 3, -4, { width: 5, rotY: 0.4 });
  // 조작 연습: 낮은 발판, 최대 2m 틈.
  platform(0, 0.5, -13, 10, 6, 0xe9c46a);
  platform(0, 1, -21, 10, 6, 0xf4a261);

  function orderStation(index, z, units, color) {
    const title = `주문 ${index + 1}`;
    const deck = platform(0, 1, z + 8, 24, 24, color);
    const cp = checkpoint(deck, new THREE.Vector3(0, 1, z + 17), title);
    cp.noHelp = true; // 주문의 틀린 조합은 낙하로 처리하지 않는다.
    const order = { target: 0, units, total: 0, pieces: [], solved: false, pads: [], z, index, bonus: 0, bonusDone: false };
    level.orders.push(order);
    const heading = dynamicSign(level.root, { x: 0, y: 8.5, z: z + 1, width: 6, color: '#a44a19' });
    // 보너스 요청(선택): 같은 양을 정해진 조각 수로. 문은 주문량만 맞추면 열리고, 보너스는 그 뒤에도 다시 해 볼 수 있다.
    const bonusSign = dynamicSign(level.root, { x: -9.5, y: 6.6, z: z + 1.4, width: 5, rows: 2, rotY: 0.35, color: '#7b2cbf' });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshStandardMaterial({ color: 0xffd60a, emissive: 0xffb703, emissiveIntensity: 0.8 }));
    const STAR_AT = new THREE.Vector3(-8.5, 2.6, z + 10), HIDDEN = new THREE.Vector3(0, -200, 0);
    star.position.copy(HIDDEN); level.root.add(star);
    order.star = { mesh: star, got: false };
    level.stars.push(order.star);
    sign('조각 담기', -8.5, 4, z + 6, { width: 3.5, color: '#a44a19', lines: ['한 번 밟으면 한 조각', '내려왔다 다시 밟아요'], rotY: 0.35 });

    // 같은 반지름, 같은 8등분: 주문량과 내가 모은 양을 나란히 비교.
    const disks = [];
    for (const [x, targetDisk] of [[-5, true], [5, false]]) {
      const slices = [];
      for (let i = 0; i < 8; i++) {
        const mesh = new THREE.Mesh(
          new THREE.CircleGeometry(2.5, 10, i * Math.PI / 4 + 0.015, Math.PI / 4 - 0.03),
          new THREE.MeshStandardMaterial({ color: 0xddd3c0, side: THREE.DoubleSide }),
        );
        mesh.position.set(x, 4.6, z + 0.8);
        level.root.add(mesh);
        slices.push(mesh);
      }
      disks.push(slices);
      sign(targetDisk ? '주문량' : '내가 모은 양', x, 7.5, z + 0.9, { width: 4 });
    }
    // 틀린 양을 가시적으로 보여주되 추락시키거나 자동으로 정답을 선택하지 않는다.
    const status = sign('0 / 8', 10, 4.6, z + 0.9, { width: 4 });
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    status.material.map.dispose();
    status.material.map = texture;
    function paint() {
      disks.forEach((disk, di) => disk.forEach((slice, i) => {
        slice.material.color.setHex(i < (di === 0 ? order.target : order.total) ? 0xffb347 : 0xddd3c0);
      }));
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = order.total > order.target ? '#b03030' : '#634024';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 46px "Malgun Gothic", sans-serif';
      const exact = order.total === order.target;
      ctx.fillText(`${order.total}/8 · 조각 ${order.pieces.length}개${exact ? ' · 완성!' : order.total > order.target ? ' · 많아요' : ''}`, 256, 64);
      bonusSign.set(order.bonusDone ? ['보너스 성공!', `조각 ${order.bonus}개로 만들었어요`] : ['보너스 요청 (선택)', `조각 ${order.bonus}개로 같은 양을!`], order.bonusDone ? '#2a9d8f' : '#7b2cbf');
      texture.needsUpdate = true;
    }
    const door = block(0, 7, z - 3, 8, 6, 0.8, 0xb5651d, { dynamic: true });
    // 문 양옆과 위를 막아 주문을 점프·도움 점프로 건너뛰지 못한다.
    for (const x of [-12, 12]) block(x, 13, z - 3, 16, 12, 1, 0xc79056);
    block(0, 13, z - 3, 8, 6, 1, 0xc79056);
    platform(0, 1, z - 7, 8, 10, 0xf4a261);
    for (const [i, unit] of units.entries()) {
      const x = (i - (units.length - 1) / 2) * 5;
      const mesh = platform(x, 1.15, z + 8, 3, 3, colors[i]);
      const label = unit === 4 ? '1/2' : unit === 2 ? '1/4' : '1/8';
      sign(`+ ${label}`, x, 3, z + 6.2, { width: 3, color: '#634024' });
      order.pads.push({ x, z: z + 8, unit, mesh, occupied: false });
    }
    for (const [x, unit, text] of [[-5, -1, '한 조각 취소'], [5, 0, '처음부터']]) {
      const mesh = platform(x, 1.15, z + 14, 3, 3, 0x9aa8b2);
      sign(text, x, 2.8, z + 12.2, { width: 3.8, color: '#38434b' });
      order.pads.push({ x, z: z + 14, unit, mesh, occupied: false });
    }
    let lift = 0;
    level.movers.push({ root: null, update(t, dt, player) {
      for (const pad of order.pads) {
        const p = player?.pos;
        const occupied = !!p && Math.abs(p.x - pad.x) < 1.4 && Math.abs(p.z - pad.z) < 1.4 && p.y > 0.8 && p.y < 2;
        // 완성한 뒤에도 조각을 바꿔 볼 수 있다(문은 열린 채). 같은 양을 다른 조각으로 만드는 보너스를 위해서다.
        if (occupied && !pad.occupied) {
          if (pad.unit === 0) { order.total = 0; order.pieces = []; }
          else if (pad.unit === -1) order.total -= order.pieces.pop() || 0;
          else if (order.total + pad.unit <= 16) { order.pieces.push(pad.unit); order.total += pad.unit; }
          else level.onMessage?.('한 판보다 많이 담았어요. 조각 취소나 처음부터를 사용해요.', false);
          const exact = order.total === order.target;
          const bonusNow = exact && order.pieces.length === order.bonus && !order.bonusDone;
          if (bonusNow) { order.bonusDone = true; if (!order.star.got) star.position.copy(STAR_AT); }
          if (exact && !order.solved) {
            order.solved = true;
            level.onMessage?.(bonusNow ? `주문 완성! 보너스 요청(조각 ${order.bonus}개)까지 맞췄어요. 별을 받아요!` : `주문 완성! 문이 열렸어요. 보너스: 조각 ${order.bonus}개로도 만들 수 있을까요? (선택)`, true);
          } else if (bonusNow) level.onMessage?.(`보너스 성공! 조각 ${order.bonus}개로 같은 양을 만들었어요. 별을 받아요!`, true);
          else if (exact && order.solved) level.onMessage?.(`같은 양이에요! 이번엔 조각 ${order.pieces.length}개.${order.bonusDone ? '' : ` 보너스는 ${order.bonus}개예요.`}`, true);
          else if (order.total > order.target) level.onMessage?.('주문보다 많아요. 마지막 조각을 취소해 보세요.', false);
          paint();
        }
        pad.occupied = occupied;
      }
      lift = Math.min(1, lift + (order.solved ? dt * 2 : 0));
      door.position.y = 4 + lift * 7;
      door.userData.collider.enabled = lift < 0.95;
    } });
    // 이 판의 주문량: 제목·구간 이름·주문량 그림이 함께 바뀐다
    order.setTarget = (t, bonus) => {
      order.target = t;
      order.bonus = bonus;
      heading.set([`${title} · ${LABELS[t]}`]);
      order.reset();
    };
    order.heading = heading;
    order.reset = () => {
      order.total = 0; order.pieces = []; order.solved = false; order.bonusDone = false; lift = 0;
      star.position.copy(HIDDEN);
      door.position.y = 4; door.userData.collider.enabled = true;
      order.pads.forEach((p) => { p.occupied = false; }); paint();
    };
    paint();
  }

  const connectors = [];
  orderStation(0, ROOMS[0], [4, 2, 1], 0xf6d28b);
  connectors.push(connector(level, kit, { zStart: ROOMS[0] - 12, kind: KINDS[0], color: 0xe9c46a, accent: 0xc8553d, name: '연결 코스 1' }));
  orderStation(1, ROOMS[1], [4, 2, 1], 0xf3c596);
  connectors.push(connector(level, kit, { zStart: ROOMS[1] - 12, kind: KINDS[1], color: 0xe9c46a, accent: 0xc8553d, name: '연결 코스 2' }));
  orderStation(2, ROOMS[2], [2, 1], 0xf6d28b);
  const zl = ROOMS[2];
  platform(0, 1, zl - 13, 8, 6, 0xe9c46a);
  const goal = platform(0, 1, zl - 24, 18, 14, 0x91c788);
  sign('포장 완료!', 0, 5, zl - 22, { width: 7, lines: ['포장 완료!', '반 판을 만드는 다른 방법을 말해 볼까요?'] });
  finishPad(goal, zl - 23);
  level.course = { rooms: ROOMS, connectors, tail: [[0, zl - 13], [0, zl - 24]], goalZ: zl - 23 }; // 시험에서 경로를 만들 때 쓴다

  level.setSeed = (s) => {
    level.seed = s;
    level.orders.forEach((o, k) => {
      const rand = rngFor(s, k);
      const target = pick(rand, TARGET_POOLS[k]);
      o.setTarget(target, bonusCount(o.units, target, rand));
    });
  };
  // 구간 이름(HUD)에 이 판의 주문량을 붙인다
  const baseSection = level.sectionAt;
  level.sectionAt = (z) => {
    const name = baseSection(z);
    const m = /^주문 (\d)$/.exec(name);
    return m ? `${name} · ${LABELS[level.orders[+m[1] - 1].target]}` : name;
  };
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.orders.forEach((o) => o.reset()); };
  level.setSeed(seed);
  return level;
}
