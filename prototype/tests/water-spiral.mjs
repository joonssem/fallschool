// 물의 순환: 선택 길 "수증기 나선 계단" - 봇이 입구에서 18칸을 걸어 올라 구름 쪽 다리를 지나 응결 구름에 닿는다.
// 기본 길(계단)과 상승기는 body-water.mjs water / water-lift.mjs 가 확인한다. 규칙·이동 검증이며 재미·학습 효과의 증거가 아니다.
import { loadMap, THREE, Player, S, tally, run } from './harness.mjs';
const { EVAP_SPIRAL, spiralTile, EVAP_TOP } = await import('../src/levels/water.js');
const make = await loadMap('water');
const T = tally('물의 순환 선택 길(수증기 나선 계단)');
const N = EVAP_SPIRAL.n;
const tiles = Array.from({ length: N }, (_, k) => spiralTile(k));

// 칸 구성: 한 칸 올라가는 높이는 점프로 충분하고(0.5m 이하), 맨 위는 구름 발판 높이와 같다
T.check('마지막 칸이 구름 발판 높이', { ok: Math.abs(tiles[N - 1].y - EVAP_TOP) < 1e-6, why: `마지막 칸 y=${tiles[N - 1].y}` });
for (let k = 1; k < N; k++) T.check('칸 사이 오르는 높이 0.5m 이하', { ok: tiles[k].y - tiles[k - 1].y <= 0.5, why: `칸 ${k}` });

const toCloud = [...tiles.map((t) => [t.x, t.z]), [26, -34.5], [16, -39], [8, -41], [0, -43]];
for (const seed of [1, 2, 3]) for (const t0 of [0, 4.7]) {
  const m = make(seed);
  T.check('입구 광장에서 나선 계단을 올라 구름 발판까지', run(m, [25, 1.5, -9], toCloud, { t0, maxT: 90 }));
  // 구름 발판에 선 뒤 이어지는 길(응결 문 앞 체크포인트)에도 그대로 연결된다
  T.check('나선 길 끝에서 응결 구름 문 앞까지', run(m, [16, 7.5, -39], [[8, -41], [0, -42], [0, -46]], { t0, maxT: 30 }));
}

// 전망 칸 별: 마지막 칸 옆. 걸어서 올라가 별을 얻는다
for (const seed of [1, 2]) {
  const m = make(seed);
  const view = spiralTile(N);
  const r = run(m, [25, 1.5, -9], [...tiles.map((t) => [t.x, t.z]), [view.x, view.z]], { maxT: 90 });
  T.check('나선 끝 전망 칸에 도착', r);
}
{
  const m = make(1);
  const view = spiralTile(N);
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(tiles[N - 1].x, tiles[N - 1].y, tiles[N - 1].z), 0);
  for (let i = 0; i < 360; i++) {
    const dx = view.x - p.pos.x, dz = view.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.3 && p.grounded && i % 40 === 0) p.requestJump();
    m.level.update(i * S, S, p);
    p.step(S, d > 0.3 ? { x: dx / d, y: -dz / d } : { x: 0, y: 0 }, 0, m.world, m.level.windAt, m.level.gravityAt);
  }
  const star = m.level.stars.some((st) => st.got && Math.abs(st.mesh.position.x - view.x) < 0.1 && Math.abs(st.mesh.position.z - view.z) < 0.1);
  T.check('나선 끝 전망 칸의 별을 얻음', { ok: star, why: `y=${p.pos.y.toFixed(2)} 별 미획득` });
}

// 떨어져도 안전한 복귀: 체크포인트 두 개(입구·중간)가 있다. 칸 사이 틈에서 떨어지면 마지막으로 밟은 체크포인트 위치가 있다
{
  const m = make(1);
  const names = m.level.checkpoints.map((c) => c.name);
  T.check('나선 계단 입구·중간 체크포인트가 있음', { ok: names.includes('나선 계단 입구') && names.includes('나선 계단 중간'), why: names.join(',') });
}
// 나선 길을 걷지 않는 학생은 아무 영향이 없다: 기본 계단 끝까지 걸어 구름에 도착(body-water.mjs 와 같은 경로)
for (const seed of [1, 2]) {
  const m = make(seed);
  T.check('나선을 안 타도 기본 계단으로 구름 발판까지', run(m, [0, 1.5, -5], [[-2, -11], [2, -17], [-2, -23], [2, -29], [0, -35], [0, -41]], { maxT: 60 }));
}
T.report();
