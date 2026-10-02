// 물의 순환: 선택 지름길 "증발 상승기" - 두 상승기 모두 구름 쪽 계단 끝까지 갈 수 있고, 햇빛 쪽이 더 빠르다.
// 안 타도 계단으로 간다는 것은 body-water.mjs water 의 '증발 상승로'가 확인한다.
import { loadMap, THREE, Player, S, tally } from './harness.mjs';
const { liftFraction, EVAP_LIFTS } = await import('../src/levels/water.js');
const make = await loadMap('water');
const T = tally('물의 순환 증발 상승기');

// 봇: 승강장에서 상승기가 아래에 올 때까지 기다렸다가 타고, 위에 닿으면 계단 끝 발판(0, 7.5, -35)까지 걸어간다. 걸린 시간을 돌려준다.
function ride(m, cfg, t0) {
  const dir = Math.sign(cfg.x);
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(cfg.x, 1.5, -9), 0);
  const route = [[cfg.x, -24], [cfg.x + dir * 5.5, -24], [cfg.x, -24], [cfg.x - dir * 4, -32], [0, -36]];
  let phase = 'wait', i = 0, t = t0;
  while (t < t0 + 80) {
    let mx = 0, mz = 0;
    const f = liftFraction(cfg, t);
    // 초록 불(아래에 와 있음)이고 1.2초 더 아래에 머물 때만 탄다 (학생이 불을 보고 타는 것과 같다)
    if (phase === 'wait' && f < 0.001 && liftFraction(cfg, t + 1.2) < 0.001) phase = 'board';
    if (phase === 'board') { mz = p.pos.z > -14.4 ? -1 : 0; if (mz === 0) phase = 'stand'; }
    if (phase === 'stand' && f > 0.999) phase = 'walk';
    if (phase === 'walk') {
      const [tx, tz] = route[i];
      const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { if (++i >= route.length) return { ok: true, time: t - t0 }; } else { mx = dx / d; mz = dz / d; }
    }
    m.level.update(t, S, p);
    p.step(S, { x: mx, y: -mz }, 0, m.world, m.level.windAt, m.level.gravityAt);
    if (p.pos.y < -20) return { ok: false, why: `떨어짐 (${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)}) 단계 ${phase} t=${(t - t0).toFixed(2)} f=${f.toFixed(2)} t0=${t0} y=${p.pos.y.toFixed(1)}` };
    t += S;
  }
  return { ok: false, why: `막힘 단계 ${phase} (${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)}, ${p.pos.z.toFixed(1)})` };
}

const sum = { sun: 0, shade: 0 };
const starts = [0, 1.7, 3.3, 5, 7.1, 9, 12, 15];
for (const seed of [1, 2]) for (const t0 of starts) {
  const m = make(seed);
  const r = {};
  for (const kind of ['sun', 'shade']) {
    r[kind] = ride(m, EVAP_LIFTS[kind], t0);
    T.check(`${kind === 'sun' ? '햇빛' : '그늘'} 상승기로 구름까지`, r[kind]);
    const star = m.level.stars.find((st) => Math.abs(st.mesh.position.x - (EVAP_LIFTS[kind].x + Math.sign(EVAP_LIFTS[kind].x) * 5.5)) < 0.1);
    T.check('상승기 위 별을 얻음', { ok: !!star?.got, why: `${kind} 별 미획득` });
    if (r[kind].ok) sum[kind] += r[kind].time;
  }
  if (r.sun.ok && r.shade.ok) T.check('같은 시각 출발이면 햇빛 쪽이 먼저 도착', { ok: r.sun.time < r.shade.time, why: `햇빛 ${r.sun.time.toFixed(1)}초, 그늘 ${r.shade.time.toFixed(1)}초 (t0=${t0})` });
}
const n = 2 * starts.length;
console.log(`  평균 소요: 햇빛 ${(sum.sun / n).toFixed(1)}초, 그늘 ${(sum.shade / n).toFixed(1)}초`);
T.report();
