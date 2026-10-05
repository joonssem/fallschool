// 인체 대탐험: 동맥 빠른 혈류(선택)와 근육 튕김 발판(산소 배달의 결과)
// 규칙·이동 시험이다. 재미·학습 효과의 증거로 쓰지 않는다.
import { loadMap, THREE, Player, S, tally, run } from './harness.mjs';
const make = await loadMap('body');
const T = tally('인체 혈류·근육 발판');

// 1. 빠른 혈류는 가운데 띠에서만 진행 방향(-z)으로 민다
{
  const m = make(1);
  const v = new THREE.Vector3();
  const at = (x, z) => { v.set(0, 0, 0); m.level.windAt(new THREE.Vector3(x, 1.5, z), v); return v.z; };
  T.check('혈류: 가운데는 진행 방향으로 민다', { ok: at(0, -80) < -2, why: String(at(0, -80)) });
  T.check('혈류: 양옆은 밀지 않는다', { ok: at(-5.5, -80) === 0 && at(5.5, -80) === 0, why: '' });
  T.check('혈류: 동맥 밖은 밀지 않는다', { ok: at(0, -60) === 0 && at(0, -105) === 0, why: '' });
}

// 2. 가운데(빠르지만 적혈구) vs 옆(느리지만 안전): 여러 출발 시각에서 시간·튕김 횟수 비교, 둘 다 떨어지지 않는다
function arteryRun(x, t0, dodge = false) {
  const m = make(1);
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(x, 1.5, -62), 0);
  let t = t0, knocks = 0, prev = 'normal';
  while (t < t0 + 20) {
    if (p.pos.z < -99) break;
    m.level.update(t, S, p);
    let tx = x;
    if (dodge) for (const c of m.level.artery.cells) {
      const ahead = p.pos.z - c.position.z;
      if (ahead > -0.8 && ahead < 4 && Math.abs(c.position.x - p.pos.x) < 1.8) tx = c.position.x > 0 ? c.position.x - 2.4 : c.position.x + 2.4;
    }
    const dx = tx - p.pos.x;
    p.step(S, { x: Math.max(-1, Math.min(1, dx)), y: 1 }, 0, m.world, m.level.windAt, m.level.gravityAt);
    if (p.state === 'tumble' && prev !== 'tumble') knocks++;
    prev = p.state;
    if (p.pos.y < 0) return { ok: false, fell: true };
    t += S;
  }
  return { ok: p.pos.z < -99, time: t - t0, knocks };
}
const res = { center: [], side: [] };
for (const t0 of [0, 1.3, 2.6, 3.9, 5.2, 6.5]) {
  const c = arteryRun(0, t0), s = arteryRun(-5.5, t0), d = arteryRun(0, t0, true);
  T.check(`혈류 가운데로 통과 t=${t0}`, { ok: c.ok, why: JSON.stringify(c) });
  T.check(`혈류 가운데 적혈구 피하며 통과 t=${t0}`, { ok: d.ok, why: JSON.stringify(d) });
  (res.dodge ??= []).push(d);
  T.check(`혈류 옆으로 통과 t=${t0}`, { ok: s.ok && s.knocks === 0, why: JSON.stringify(s) });
  res.center.push(c); res.side.push(s);
}
const avg = (a, k) => (a.reduce((x, r) => x + (r[k] || 0), 0) / a.length).toFixed(2);
console.log(`  동맥: 가운데 곧장 평균 ${avg(res.center, 'time')}초·튕김 ${avg(res.center, 'knocks')}회 / 가운데 피하며 ${avg(res.dodge, 'time')}초·튕김 ${avg(res.dodge, 'knocks')}회 / 옆 ${avg(res.side, 'time')}초`);
T.check('혈류: 가운데가 항상 유리하지는 않다(곧장 가면 적혈구에 걸리는 출발 시각이 있다)', { ok: res.center.some((r) => r.knocks > 0), why: '' });
T.check('혈류: 적혈구를 안 만나면 가운데가 빠르다', { ok: res.center.filter((r) => r.knocks === 0).every((r) => r.time < res.side[0].time), why: '' });

// 3. 근육 튕김 발판: 배달 전에는 보통 바닥, 근육에 배달하면 튕겨 올라 별에 닿는다
function springTry(deliver) {
  const m = make(1);
  if (deliver) m.level.delivery.done.muscle = true;
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(-7, 1.65, -134.5), 0);
  let t = 0, top = 0;
  for (; t < 4; t += S) {
    m.level.update(t, S, p);
    const up = p.vel.y > 0 || p.pos.y > 4;
    const dz = -140.5 - p.pos.z;
    p.step(S, { x: 0, y: up && Math.abs(dz) > 0.3 ? -Math.sign(dz) : 0 }, 0, m.world, m.level.windAt, m.level.gravityAt);
    top = Math.max(top, p.pos.y);
  }
  const star = m.level.stars.some((s) => s.got && Math.abs(s.mesh.position.z + 140.5) < 0.1);
  return { top: +top.toFixed(2), star, m };
}
const off = springTry(false), on = springTry(true);
T.check('근육 발판: 배달 전에는 튕기지 않음', { ok: off.top < 2 && !off.star, why: JSON.stringify({ top: off.top }) });
T.check('근육 발판: 근육에 배달하면 튕겨 올라 별을 얻음', { ok: on.top > 5 && on.star, why: JSON.stringify({ top: on.top, star: on.star }) });
on.m.level.resetProgress();
on.m.level.update(0, S, null);
T.check('근육 발판: 초기화하면 다시 보통 바닥', { ok: on.m.level.muscleSpring.col.kind === 'solid', why: on.m.level.muscleSpring.col.kind });
// 기본 길은 근육 발판을 밟지 않고 지나간다 (근육 구역 가운데 x 0)
T.check('근육 구역 기본 길은 발판과 떨어져 있음', run(make(2), [0, 1.5, -131], [[0, -136], [0, -140]], { maxT: 10 }));
T.report();
