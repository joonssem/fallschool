// 방과 방 사이 연결 코스: 개념 퍼즐 스테이션(분수 피자·미술 공방·도형 건축 등) 사이에서
// 달리기·점프·타이밍을 쓰는 짧은 구간. 퍼즐은 그대로 두고, 퍼즐 사이에 움직이는 장애물을 둔다.
//
// 원칙: 탈락 없음. 떨어지면 연결 코스 입구 체크포인트로 돌아오고, 이 체크포인트는 도움 점프를 켠다
// (개념 오답이 아니라 조작 실패이기 때문). 장애물은 맞아도 잠깐 밀릴 뿐이다. 학생 간 충돌은 없다.
// 모든 움직임은 시간 t(방에서는 서버 시계)에서 계산해 모든 화면에서 같다.
import * as THREE from 'three';

export const CONNECTOR_LENGTH = 26; // 연결 코스가 차지하는 길이(m) - 앞 방 출구 다리 끝부터 다음 방 뒷면까지는 이보다 1m 길다
export const ROOM_STEP = 33 + CONNECTOR_LENGTH; // 방과 방 사이 간격

export const CONNECTOR_KINDS = ['bar', 'movers', 'sweepers'];

/**
 * 연결 코스를 만든다. zStart: 앞 방 출구 다리가 끝나는 z, 코스는 zStart에서 CONNECTOR_LENGTH + 1 만큼 뒤로 이어진다.
 * kit: makeKit(level), level.movers 에 움직임을 등록한다.
 * 돌려주는 값: { kind, zStart, zEnd, checkpoint }
 */
export function connector(level, kit, { zStart, kind, color = 0xcdd5e0, accent = 0xe9806e, name = '연결 코스' }) {
  const { platform, block, sign, checkpoint } = kit;
  const movers = level.movers;
  const Y = 1; // 방 바닥 높이와 같다
  const zEnd = zStart - CONNECTOR_LENGTH - 1;

  // 입구: 체크포인트 (조작 실패를 위한 곳이므로 도움 점프 허용)
  const entry = platform(0, Y, zStart - 2.5, 10, 5, color);
  const cp = checkpoint(entry, new THREE.Vector3(0, Y, zStart - 2.5), name);
  // 출구: 다음 방 바닥과 이어진다
  platform(0, Y, zEnd + 2.5, 10, 5, color);

  const zA = zStart - 5; // 장애물 구간 시작
  const zB = zEnd + 5; // 장애물 구간 끝
  const mid = (zA + zB) / 2;
  const len = zA - zB; // 17
  const platforms = []; // 움직이는 발판 (시험에서 따라가며 건너는 데 쓴다)

  if (kind === 'bar') {
    // 회전 막대: 넓은 판 위에서 맞아도 밀릴 뿐이다. 막대를 뛰어넘거나 지나갈 때를 기다린다.
    platform(0, Y, mid, 16, len, color);
    const stir = new THREE.Group();
    stir.position.set(0, 0, mid);
    level.root.add(stir);
    block(0, Y + 0.9, 0, 13, 0.6, 0.6, accent, { parent: stir, kind: 'bumper', dynamic: true, castShadow: true });
    block(0, Y + 1.2, mid, 1, 1.2, 1, 0x8b95a5, { castShadow: true });
    movers.push({ root: stir, update(t) { stir.rotation.y = t * 0.75; } });
    sign('회전 막대', -7.4, Y + 3.6, zA - 6, { width: 4.5, color: '#8a4b3d', lines: ['회전 막대', '뛰어넘거나 때를 기다려요'], rotY: 0.45 });
  } else if (kind === 'movers') {
    // 움직이는 발판: 틈은 1.5m 이하이고 발판이 좌우로 오간다. 떨어지면 입구에서 다시 시작한다.
    const zs = [zA - 1.5, zA - 7, zA - 12.5];
    zs.forEach((z, i) => {
      const p = platform(0, Y, z, 5, 4, i % 2 ? accent : color, { dynamic: true, castShadow: true });
      platforms.push(p);
      movers.push({ root: p, update(t) { p.position.x = Math.sin(t * 0.9 + i * 2.1) * 2.6; } });
    });
    sign('움직이는 발판', -7.4, Y + 3.6, zA - 6, { width: 4.5, color: '#8a4b3d', lines: ['움직이는 발판', '타이밍을 맞춰 건너요'], rotY: 0.45 });
  } else if (kind === 'sweepers') {
    // 가로로 오가는 범퍼: 사이로 지나가거나 뛰어넘는다. 맞으면 잠깐 밀린다.
    platform(0, Y, mid, 14, len, color);
    [0, 1].forEach((i) => {
      const z = mid + (i ? -3.5 : 3.5);
      const b = block(0, Y + 1.2, z, 3, 1.2, 0.8, accent, { kind: 'bumper', dynamic: true, castShadow: true });
      movers.push({ root: b, update(t) { b.position.x = Math.sin(t * 1.1 + i * Math.PI) * 5; } });
    });
    sign('범퍼 지나가기', -7.4, Y + 3.6, zA - 6, { width: 4.5, color: '#8a4b3d', lines: ['범퍼 지나가기', '틈을 보고 달려요'], rotY: 0.45 });
  } else {
    throw new Error(`알 수 없는 연결 코스: ${kind}`);
  }
  return { kind, zStart, zEnd, checkpoint: cp, platforms };
}
