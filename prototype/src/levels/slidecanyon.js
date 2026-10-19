// 이동으로 표면을 읽는 협곡. 장치 선택·정답 문 없이 감속과 관성을 다음 길에 쓴다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { SLIDE_SURFACES } from '../slide-motion.js';

export function buildSlideCanyon(parent, world, { seed = 0 } = {}) {
  const level = createLevel(parent, world, { pauseOnFreeze: true });
  const kit = makeKit(level);
  const { platform, block, ramp, sign } = kit;
  const glide = SLIDE_SURFACES.glide, grip = SLIDE_SURFACES.grip;
  const colors = { glide: 0x80d5ee, grip: 0xf1b968, normal: 0xa5b7c7, rail: 0x667d8d };
  const surfacePieces = [];
  function floor(x, y, z, width, length, surface = null, variable = null) {
    const mesh = platform(x, y, z, width, length, surface === glide ? colors.glide : surface === grip ? colors.grip : colors.normal,
      { slideSurface: surface });
    if (variable) surfacePieces.push({ mesh, choose: variable });
    return mesh;
  }
  function slope(x, z0, y0, z1, y1, width, surface = null) {
    const mesh = ramp(x, z0, y0, z1, y1, width, surface === glide ? colors.glide : colors.normal);
    mesh.userData.collider.slideSurface = surface;
    return mesh;
  }
  function wall(x, y, z, width, length) {
    return block(x, y + 1.8, z, width, 2, length, colors.rail);
  }
  function rails(x, z0, y0, z1, y1, width) {
    for (const dx of [-width / 2 - 0.3, width / 2 + 0.3]) slope(x + dx, z0, y0 + 1.8, z1, y1 + 1.8, 0.6);
  }
  function cp(mesh, point, name) { return kit.checkpoint(mesh, new THREE.Vector3(...point), name); }
  function star(x, y, z, name) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.6),
      new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xc58b0b, emissiveIntensity: 0.6 }));
    mesh.position.set(x, y + 1.2, z); level.root.add(mesh);
    level.stars.push({ mesh, got: false, name });
  }
  // 홈은 장식 자식이다. 표면 변경 때 보임도 바꿔 색 외의 단서를 유지한다.
  function grooves(mesh) {
    const { width, depth } = mesh.geometry.parameters;
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x9b703d });
    for (let z = -depth / 2 + 0.6; z < depth / 2; z += 1.5) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.025, 0.12), material);
      stripe.position.set(0, 0.515, z); group.add(stripe);
    }
    mesh.add(group); return group;
  }
  level.spawn.set(0, 0, 4);
  floor(0, 0, 1, 20, 14);
  kit.startCheckpoint('협곡 입구');
  floor(-5, 0, -17, 10, 22, glide);
  const entryGrip = floor(5, 0, -17, 10, 22, grip); grooves(entryGrip);
  const downhillRest = floor(0, 0, -26, 20, 4);
  cp(downhillRest, [5, 0, -26], '내리막 출발');
  // 첫 별은 길 옆의 감속 전망대. 지나쳐도 전진해 완주한다.
  const overlook = floor(14, 0, -18, 8, 10, grip); grooves(overlook);
  star(15, 0, -18, '감속 전망대');
  wall(-10.3, 0, -10, 0.6, 36);
  wall(0, 0, 8.3, 20, 0.6); wall(10.3, 0, 1, 0.6, 14);
  wall(10.3, 0, -9.5, 0.6, 7); wall(10.3, 0, -25.5, 0.6, 5);
  wall(18.3, 0, -18, 0.6, 10);
  wall(14, 0, -23.3, 8, 0.6); wall(14, 0, -12.7, 8, 0.6);
  // 두 가지 내리막: 속도를 이어가는 왼쪽과 방향 수정이 쉬운 오른쪽.
  slope(-5, -28, 0, -48, -5, 10, glide);
  slope(5, -28, 0, -48, -5, 10);
  rails(0, -28, 0, -48, -5, 20);
  floor(-5, -5, -57, 10, 18, glide);
  const arrival = floor(5, -5, -57, 10, 18);
  cp(arrival, [5, -5, -53], '내리막 옆 쉼터');
  wall(-10.3, -5, -57, 0.6, 18); wall(10.3, -5, -57, 0.6, 18);
  // 넓은 직각 굽이. 바깥 벽은 고정 벽이며 부딪혀도 튕기지 않는다.
  floor(-5, -5, -72, 10, 12, glide);
  const inner = floor(5, -5, -72, 10, 12, grip, v => v === 0 ? grip : glide);
  const innerMarks = grooves(inner);
  const outer = floor(-5, -5, -82, 10, 8, glide, v => v === 0 ? glide : grip);
  const outerMarks = grooves(outer);
  floor(11, -5, -82, 22, 8, grip);
  floor(24, -5, -82, 12, 8, grip);
  const bendExit = floor(24, -5, -95, 12, 18);
  cp(bendExit, [24, -5, -98], '굽이 뒤 쉼터');
  wall(-10.3, -5, -76, 0.6, 20);
  wall(10.3, -5, -71.7, 0.6, 11.4);
  wall(4, -5, -86.3, 28, 0.6);
  wall(18, -5, -91, 0.6, 10); wall(30.3, -5, -93, 0.6, 18);
  star(-6, -5, -83, '바깥 굽이 탐험');
  const rest = floor(29, -5, -105, 20, 6);
  cp(rest, [29, -5, -105], '관성 길 출발');
  wall(39.3, -5, -105, 0.6, 6);
  // 시험 구간과 같은 높이·길이 관계의 관성 연결. 오른쪽은 항상 걸을 수 있다.
  slope(24, -108, -5, -126, -10, 10, glide);
  slope(34, -108, -5, -126, -10, 10);
  rails(29, -108, -5, -126, -10, 20);
  floor(24, -10, -131, 10, 10, glide);
  const below = floor(34, -10, -131, 10, 10);
  cp(below, [34, -10, -130], '언덕 아래 안전 길');
  slope(24, -136, -10, -144, -8.15, 10, glide);
  slope(34, -136, -10, -160, -8.15, 10);
  const crest = floor(24, -8.15, -149, 10, 10, grip); grooves(crest);
  const highSide = floor(17, -8.15, -149, 4, 8, grip); grooves(highSide);
  star(17, -8.15, -150, '관성 언덕 전망대');
  floor(12, -8.15, -151, 6, 4);
  wall(8.7, -8.15, -151, 0.6, 4);
  wall(12, -8.15, -148.7, 6, 0.6); wall(12, -8.15, -153.3, 6, 0.6);
  wall(17, -8.15, -144.7, 4, 0.6); wall(17, -8.15, -153.3, 4, 0.6);
  floor(24, -8.15, -157, 10, 6, grip);
  const merge = floor(29, -8.15, -165, 20, 10);
  cp(merge, [34, -8.15, -164], '마지막 전망길');
  // 마지막 선택은 단순 반전이 아니다. 한 배치는 감속해 굽이 진입,
  // 다른 배치는 다음 완만한 언덕을 위해 매끈한 길을 이어가는 데 유리하다.
  const lastLeft = floor(24, -8.15, -177, 10, 14, glide, v => v === 0 ? grip : glide);
  const lastRight = floor(34, -8.15, -177, 10, 14, grip, v => v === 0 ? glide : grip);
  const leftMarks = grooves(lastLeft), rightMarks = grooves(lastRight);
  slope(24, -184, -8.15, -192, -7.65, 10, glide);
  slope(34, -184, -8.15, -192, -7.65, 10);
  const finish = floor(29, -7.65, -197, 20, 10);
  kit.finishPad(finish, -197);
  wall(18.7, -10, -131, 0.6, 10);
  slope(18.7, -136, -8.2, -144, -6.35, 0.6);
  wall(39.3, -10, -131, 0.6, 10);
  slope(39.3, -136, -8.2, -160, -6.35, 0.6);
  for (const x of [18.7, 39.3]) wall(x, -8.15, -176, 0.6, 32);
  wall(29, -7.65, -202.3, 20, 0.6);
  // 보이는 장면 변화: 단순한 협곡 기둥과 골인 전망대. 장식은 충돌하지 않는다.
  for (let i = 0; i < 11; i++) {
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 12 + i % 3 * 3, 6),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xc09270 : 0x9c7e6c }));
    rock.position.set(i % 2 ? 48 : -23, -7, -i * 19); level.root.add(rock);
  }
  sign('미끄럼 협곡 탐험대', -6, 3, 2, { width: 7 });
  sign('매끈한 바닥은 오래 미끄러져요', 0, 3, -8, { width: 8 });
  sign('별은 선택 · 옆 전망대', 15, 3, -13, { width: 5 });
  sign('굽이 전에 주황 홈을 살펴요', 2, -2, -62, { width: 8 });
  sign('속도를 이어 언덕으로 · 오른쪽은 편한 길', 35, -2, -103, { width: 8 });
  sign('오르기 어렵다면 오른쪽 길', 36, -7, -128, { width: 6 });
  sign('전망대 별은 옆길에 있어요', 17, -5, -146, { width: 5 });
  // 실패 복귀는 걷기. 다시 시도하고 싶을 때만 길 옆의 명시된 발판 사용.
  const retryPads = [];
  for (const [x, y, z] of [[37, -10, -133], [12, -8.15, -151]]) {
    const pad = floor(x, y + 0.02, z, 2.4, 2.4, grip);
    const retry = { x, z, armed: true }; retryPads.push(retry);
    pad.userData.collider.onStand = player => {
      if (!retry.armed) return;
      retry.armed = false;
      player.respawn(new THREE.Vector3(24, -5, -105));
      level.onMessage?.('관성 길 출발로 돌아왔어요. 다시 타기는 선택이에요.', true);
    };
    sign('다시 타기 · 선택', x, y + 2.5, z - 0.7, { width: 3.6 });
  }
  sign('바닥을 보고 나만의 길로', 34, -5.15, -167, { width: 7 });
  sign('협곡 완주!', 29, -4.65, -201, { width: 7 });
  level.sectionAt = sectionFinder([
    { name: '바닥 느끼기', zMax: 10 }, { name: '내리막', zMax: -28 },
    { name: '굽은 협곡', zMax: -66 }, { name: '관성 언덕', zMax: -104 }, { name: '전망길', zMax: -160 },
  ]);
  const marks = new Map([[inner, innerMarks], [outer, outerMarks], [lastLeft, leftMarks], [lastRight, rightMarks]]);
  const variableMaterials = new Map(surfacePieces.map(({ mesh }) => [mesh, mesh.material.clone()]));
  level.setSeed = s => {
    level.seed = s >>> 0;
    level.layout = level.seed % 2;
    for (const { mesh, choose } of surfacePieces) {
      const surface = choose(level.layout);
      mesh.userData.collider.slideSurface = surface;
      // 재시드 시 공유 재질을 변형하지 않는다.
      mesh.material = variableMaterials.get(mesh);
      mesh.material.color.setHex(surface === grip ? colors.grip : colors.glide);
      marks.get(mesh).visible = surface === grip;
    }
  };
  level.setSeed(seed);
  level.routes = {
    basic: [[5, -15], [5, -26], [5, -50], [5, -63], [5, -74], [5, -81], [24, -81], [24, -99],
      [34, -105], [34, -130], [34, -156], [34, -165], [34, -181], [34, -194], [29, -199]],
    outside: [[-5, -15], [-5, -26], [-5, -55], [-5, -74], [-5, -83], [24, -83], [24, -99]],
    hill: [[24, -105], [24, -127], [24, -135], [24, -147], [24, -157], [34, -165]],
  };
  finalizeLevel(level);
  const update = level.update, reset = level.resetProgress;
  level.update = (t, dt, player) => {
    if (player) for (const pad of retryPads) if (Math.hypot(player.pos.x - pad.x, player.pos.z - pad.z) > 3) pad.armed = true;
    update(t, dt, player);
  };
  level.resetProgress = () => { reset(); for (const pad of retryPads) pad.armed = true; };
  return level;
}
