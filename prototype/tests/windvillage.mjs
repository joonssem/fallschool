import { THREE, PhysicsWorld, Player, S, run, tally } from './harness.mjs';
import { buildWindVillage, BREEZE_PERIOD } from '../src/levels/windvillage.js';
const T = tally('바람마을');
function build(seed = 1) { const world = new PhysicsWorld(); return { world, level: buildWindVillage(new THREE.Scene(), world, { seed }) }; }
const m = build();
const v = new THREE.Vector3();
function wind(x, y, z, t) { m.level.update(t, 1 / 120, null); v.set(0, 0, 0); m.level.windAt(new THREE.Vector3(x, y, z), v); return v.clone(); }
T.check('왼쪽 길은 진행 방향 순풍', { ok: wind(-7, 0, -49, 0).z < -1, why: '' });
T.check('오른쪽 길은 진행 방향 역풍', { ok: wind(7, 0, -49, 0).z > 1, why: '' });
T.check('낮 해풍: 바다에서 육지로', { ok: wind(0, 2, -123, BREEZE_PERIOD / 4).x > 1, why: '' });
T.check('밤 육풍: 육지에서 바다로', { ok: wind(0, 2, -123, BREEZE_PERIOD * 3 / 4).x < -1, why: '' });
T.check('반전 시 바람은 부드럽게 약해짐', { ok: wind(0, 2, -123, BREEZE_PERIOD / 2).length() < 1e-8, why: '' });
T.check('안전 계단은 바람 구역 밖', { ok: wind(0, 2, -99, 8).length() === 0, why: '' });
T.check('갈림길 중앙은 바람 없음', { ok: wind(0, 0, -49, 8).length() === 0, why: '' });
T.check('구역 위는 바람 없음', { ok: wind(-7, 10, -49, 8).length() === 0, why: '' });
for (const t of [8, 24, 72]) {
  m.level.update(t, 1 / 120, null);
  for (const g of m.level.windGauges) {
    const actual = new THREE.Vector3(); m.level.windAt(g.pos, actual);
    const displayed = new THREE.Vector3(0, 1, 0).applyQuaternion(g.arrow.quaternion);
    const flag = new THREE.Vector3(0, 0, -1).applyQuaternion(g.flag.quaternion);
    T.check(`표시 방향 ${t} ${g.pos.x},${g.pos.z}`, { ok: actual.length() > 0.03 && displayed.dot(actual.clone().normalize()) * (g.vane ? -1 : 1) > 0.999 && flag.dot(actual.normalize()) > 0.999, why: '' });
  }
}
T.check('과학 오답 낙하를 요구하는 문 없음', { ok: m.level.gates.length === 0, why: '' });
T.check('도움 점프 허용', { ok: m.level.checkpoints.every((cp) => !cp.noHelp), why: '' });
for (const seed of [1, 7, 99]) for (const t0 of [0, 8, 16, 24]) for (const side of [-7, 7]) {
  const route = [[0, -29], [side, -33], [side, -49], [side, -66], [0, -70], [0, -90], [0, -96], [0, -103], [-8, -105], [8, -105], [8, -112.3], [9, -116], [9, -120], [-9, -126], [-9, -138], [0, -148], [0, -160]];
  T.check(`전 구간 ${side < 0 ? '순풍' : '역풍'} seed=${seed} t=${t0}`, run(build(seed), [0, 0, 2], route, { t0, maxT: 120 }));
}

// 순풍 도약(선택): 바람이 있어야 섬에 닿고, 못 닿아도 아래 길로 내려앉아 떨어지지 않는다. 도약대 옆으로 지나가는 길도 막히지 않는다.
function tailwindJump(windOn, takeoffZ, seed = 1) {
  const mm = build(seed);
  if (!windOn) mm.level.windAt = () => {};
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(-7, 0, -34.5), 0);
  let t = 0, jumped = false;
  for (let i = 0; i < 1500; i++) {
    mm.level.update(t, S, p);
    if (!jumped && p.pos.z < takeoffZ) { p.requestJump(); jumped = true; }
    p.step(S, { x: 0, y: 1 }, 0, mm.world, mm.level.windAt, mm.level.gravityAt);
    if (jumped && p.grounded && p.pos.z < -44.2) {
      const onIsland = p.pos.y > 1, y = p.pos.y;
      for (let k = 0; k < 200 && onIsland; k++) { // 섬에 내리면 별 쪽으로 걸어간다
        mm.level.update(t, S, p); p.step(S, { x: 0, y: p.pos.z > -53.3 ? 1 : 0 }, 0, mm.world, mm.level.windAt, mm.level.gravityAt); t += S;
      }
      return { onIsland, y, star: mm.level.stars.some((s) => s.got) };
    }
    if (p.pos.y < -10) return { onIsland: false, y: p.pos.y, fell: true };
    t += S;
  }
  return { onIsland: false, y: NaN, stuck: true };
}
for (const tz of [-43.4, -43.8, -44.0]) {
  const w = tailwindJump(true, tz), n = tailwindJump(false, tz);
  T.check(`순풍을 타면 섬에 닿고 별을 얻음 (도약 z=${tz})`, { ok: w.onIsland && w.star, why: JSON.stringify(w) });
  T.check(`바람이 없으면 닿지 않고 길로 내려앉음 (도약 z=${tz})`, { ok: !n.onIsland && !n.fell && Math.abs(n.y) < 0.1, why: JSON.stringify(n) });
}
for (const x of [-9.8, -4.6]) T.check(`도약대 옆 길로 지나감 x=${x}`, run(build(), [0, 0, -29], [[x, -33], [x, -49], [x, -66]], { maxT: 40 }));

// 낮·밤 도약(선택): 해당 시각의 바람이면 섬(높이 3.5)에 닿고, 바람이 없거나 반대면 닿지 않고 해안 길(높이 2)에 내려앉는다
function coastJump(dir, z, t0, windOn, takeoffX) {
  const mm = build(1);
  if (!windOn) mm.level.windAt = () => {};
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(-dir * 12.5, 2, z), 0);
  let t = t0, jumped = false;
  for (let i = 0; i < 1500; i++) {
    mm.level.update(t, S, p);
    if (!jumped && (dir > 0 ? p.pos.x > takeoffX : p.pos.x < takeoffX)) { p.requestJump(); jumped = true; }
    p.step(S, { x: dir, y: 0 }, 0, mm.world, mm.level.windAt, mm.level.gravityAt);
    if (jumped && p.grounded && (dir > 0 ? p.pos.x > -5 : p.pos.x < 5)) {
      const onIsland = p.pos.y > 3;
      for (let k = 0; k < 120 && onIsland; k++) { // 섬에 내리면 별 쪽으로 걸어간다
        const cx = mm.level.coastJumps[dir > 0 ? 'day' : 'night'].islandX;
        mm.level.update(t, S, p); p.step(S, { x: Math.abs(p.pos.x - cx) > 0.5 ? dir : 0, y: 0 }, 0, mm.world, mm.level.windAt, mm.level.gravityAt); t += S;
      }
      return { onIsland, y: p.pos.y, star: mm.level.stars.some((s) => s.got) };
    }
    if (p.pos.y < -10) return { onIsland: false, y: p.pos.y, fell: true };
    t += S;
  }
  return { onIsland: false, stuck: true };
}
const DAY = BREEZE_PERIOD / 4 - 1.5, NIGHT = BREEZE_PERIOD * 3 / 4 - 1.5;
for (const [name, dir, z, good, bad] of [['낮 도약대(동쪽)', 1, -109, DAY, NIGHT], ['밤 도약대(서쪽)', -1, -138, NIGHT, DAY]]) for (const edge of [5.8, 6.2]) {
  const takeoff = -dir * edge;
  const w = coastJump(dir, z, good, true, takeoff), n = coastJump(dir, z, good, false, takeoff), o = coastJump(dir, z, bad, true, takeoff);
  T.check(`${name}: 맞는 바람이면 섬과 별 (도약 ${edge})`, { ok: w.onIsland && w.star, why: JSON.stringify(w) });
  T.check(`${name}: 바람이 없으면 못 닿고 해안 길로 (도약 ${edge})`, { ok: !n.onIsland && !n.fell && Math.abs(n.y - 2) < 0.1, why: JSON.stringify(n) });
  T.check(`${name}: 반대 바람이면 못 닿고 해안 길로 (도약 ${edge})`, { ok: !o.onIsland && !o.fell && Math.abs(o.y - 2) < 0.1, why: JSON.stringify(o) });
}
// 맞바람 연 발판(선택): 역풍 길에서 올라서면 맞바람으로 떠올라 옆 섬의 별에 닿는다. 순풍 길 바람으로는 뜨지 않는다.
function kiteRide(fieldOverride, seed = 1) {
  const mm = build(seed);
  const k = mm.level.kite;
  if (fieldOverride) k.field.wind = fieldOverride(mm);
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(k.x, k.base + 0.05, k.z), 0);
  let t = 0, topAt = null;
  for (; t < 8; t += S) {
    mm.level.update(t, S, p);
    p.step(S, { x: 0, y: 0 }, 0, mm.world, mm.level.windAt, mm.level.gravityAt);
    if (topAt === null && k.state.height >= k.top - k.base - 0.01) topAt = t;
  }
  const atTop = p.pos.y > k.top - 0.2;
  // 꼭대기에서 동쪽 섬으로 걸어간다
  for (let i = 0; i < 240; i++, t += S) { mm.level.update(t, S, p); p.step(S, { x: 1, y: 0 }, 0, mm.world, mm.level.windAt, mm.level.gravityAt); }
  const star = mm.level.stars.some((s) => s.got && Math.abs(s.mesh.position.x - 13) < 0.5 && Math.abs(s.mesh.position.z - k.z) < 0.5);
  return { atTop, topAt: topAt && +topAt.toFixed(2), star, y: +p.pos.y.toFixed(2), mm };
}
{
  const r = kiteRide(null);
  console.log('  연 발판: 꼭대기까지', r.topAt, '초');
  T.check('연 발판: 맞바람(역풍 길)에서 떠올라 섬의 별을 얻음', { ok: r.atTop && r.star, why: JSON.stringify({ ...r, mm: undefined }) });
  const tail = kiteRide((mm) => mm.level.windZones[mm.level.windZones.indexOf(mm.level.kite.field) - 1].wind.bind(null));
  T.check('연 발판: 순풍 길 바람이면 뜨지 않음', { ok: !tail.atTop && !tail.star && tail.y < 1, why: JSON.stringify({ ...tail, mm: undefined }) });
  const calm = kiteRide(() => () => {});
  T.check('연 발판: 바람이 없으면 뜨지 않음', { ok: !calm.atTop && calm.y < 1, why: JSON.stringify({ ...calm, mm: undefined }) });
  // 내려오면 발판은 다시 내려간다, 초기화하면 처음 높이
  const mm = r.mm;
  for (let t = 20; t < 25; t += S) mm.level.update(t, S, null);
  T.check('연 발판: 아무도 없으면 내려옴', { ok: mm.level.kite.state.height === 0, why: String(mm.level.kite.state.height) });
}
T.report();
