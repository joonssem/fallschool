// 제작 전 이동 시험 구간. 정식 MAPS에 등록하지 않는다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { SLIDE_SURFACES } from '../slide-motion.js';

export function buildSlideCanyonTrial(parent, world) {
  const level = createLevel(parent, world);
  const kit = makeKit(level);
  const { platform, block, ramp, sign } = kit;
  const blue = 0x83d7ee, orange = 0xf2bd73, stone = 0x9dabc0;
  function lane(x, y, z, width, length, surface = null) {
    return platform(x, y, z, width, length, surface === SLIDE_SURFACES.glide ? blue : surface ? orange : stone,
      { slideSurface: surface });
  }
  function slope(x, z0, y0, z1, y1, surface, width = 8) {
    const mesh = ramp(x, z0, y0, z1, y1, width, surface === SLIDE_SURFACES.glide ? blue : stone);
    mesh.userData.collider.slideSurface = surface;
    return mesh;
  }
  // 비교 구역: 같은 높이, 같은 길이, 같은 출발 조건의 평지 세 줄.
  for (const [x, surface] of [[-24, SLIDE_SURFACES.glide], [-14, SLIDE_SURFACES.grip], [-4, null]]) {
    lane(x, 0, 30, 8, 80, surface);
    block(x - 4.3, 2, 30, 0.6, 3, 80, stone);
    block(x + 4.3, 2, 30, 0.6, 3, 80, stone);
  }
  // 관성: 출발 → 내리막 → 평지 → 언덕. 경계에서 강제 속도 주입 없음.
  level.spawn.set(10, 0, 4);
  lane(10, 0, 0, 8, 16);
  slope(10, -8, 0, -26, -5, SLIDE_SURFACES.glide);
  lane(10, -5, -31, 8, 10, SLIDE_SURFACES.glide);
  slope(10, -36, -5, -44, -3.15, SLIDE_SURFACES.glide);
  lane(10, -3.15, -49, 8, 10, SLIDE_SURFACES.grip);
  // 속도가 부족하면 오른쪽 보통 길로 나간다. 아래 평지는 항상 연결된다.
  const cpPad = lane(19, -5, -31, 10, 10);
  slope(19, -36, -5, -60, -3.15, null, 10);
  const end = lane(14.5, -3.15, -65, 19, 10);
  slope(10, -54, -3.15, -60, -3.15, SLIDE_SURFACES.grip);
  for (const x of [5.6, 24.4]) block(x, 3, -31, 0.8, 12, 78, stone);
  block(15, 3, -70.4, 20, 12, 0.8, stone);
  // 가속 전 체크포인트와 언덕 앞에서 멈춰도 나갈 수 있는 옆길.
  kit.startCheckpoint('시험 출발');
  kit.checkpoint(cpPad, new THREE.Vector3(19, -5, -31), '언덕 아래 안전 길');
  kit.finishPad(end, -64);
  // 넓은 곡선: 직선 → 감속 띠 → 옆으로 회전 → 앞쪽 합류.
  lane(-14, 0, -22, 8, 24, SLIDE_SURFACES.glide);
  lane(-14, 0, -37, 8, 6, SLIDE_SURFACES.grip);
  lane(-8, 0, -41, 20, 8, SLIDE_SURFACES.grip);
  lane(0, 0, -51, 8, 20, SLIDE_SURFACES.grip);
  block(-18.4, 2, -31, 0.8, 3, 44, stone);
  block(-8, 2, -45.4, 12, 3, 0.8, stone);
  block(4.4, 2, -51, 0.8, 3, 20, stone);
  // 장식 무늬는 충돌이 없는 자식 메시.
  for (let z = -34.5; z >= -39; z -= 1) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: 0x8c653e }));
    mark.position.set(-14, 0.015, z); level.root.add(mark);
  }
  sign('미끄럼 협곡 · 제작 시험', 21, 3, 1, { width: 6 });
  sign('주황 바닥에서 방향 바꾸기', -14, 3, -32, { width: 8 });
  sign('언덕이 어렵다면 오른쪽 길', 19, -2, -27, { width: 8 });
  level.sectionAt = sectionFinder([{ name: '시험 출발', zMax: 10 }, { name: '내리막', zMax: -8 }, { name: '언덕', zMax: -36 }]);
  level.trial = { comparison: [-24, -14, -4], bendStart: [-14, 0, -12], hillStart: [10, 0, 4] };
  return finalizeLevel(level);
}
