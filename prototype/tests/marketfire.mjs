// Actual walking + XZ trajectory measurements. No direct interaction-function calls.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { THREE, PhysicsWorld, S, run, tally } from './harness.mjs';
import { buildMarketFire, POINTS, METHODS, MATCH } from '../src/levels/marketfire.js';
import { makeCase, interpret, OBJECTS, SITE_IDS, CAUSES } from '../src/levels/marketfire-evidence.js';

const T = tally('시장 마을 불씨 조사단');
const fresh = (seed) => { const world = new PhysicsWorld(); return { world, level: buildMarketFire(new THREE.Scene(), world, { seed }) }; };
const spawn = [0, 0.02, 8];
const cardPoint = (site, kind) => { const [x, z] = POINTS.sites[site]; return [x + ({ trace: -5, ledger: 0, witness: 5 }[kind]), z]; };
const conclusionPoints = (cause, object) => {
  const c = POINTS.cause.find((p) => p.id === cause), o = POINTS.objects.find((p) => p.id === object);
  return [[c.x, c.z], [o.x, o.z], POINTS.submit];
};
// Uniform shortest visibility-graph path around OTHER control pads. No method-specific waypoints.
// The only mandatory targets are the actual buttons/supply/work/finish locations.
const controls = [...POINTS.cause, ...POINTS.objects, ...POINTS.methods, { x: 0, z: -17 },
  ...SITE_IDS.flatMap((s) => ['trace', 'ledger', 'witness'].map((k) => { const [x, z] = cardPoint(s, k); return { x, z }; }))];
function crosses(a, b, q, half = 1.9) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 2; k++) {
    const v = b[k] - a[k], center = k ? q.z : q.x;
    if (Math.abs(v) < 1e-9) { if (a[k] <= center - half || a[k] >= center + half) return false; }
    else { let s = (center - half - a[k]) / v, t = (center + half - a[k]) / v; if (s > t) [s, t] = [t, s]; lo = Math.max(lo, s); hi = Math.min(hi, t); if (lo >= hi) return false; }
  }
  return hi > 0 && lo < 1;
}
function route(a, b) {
  const obstacles = controls.filter((q) => Math.hypot(q.x - a[0], q.z - a[1]) > 2.8 && Math.hypot(q.x - b[0], q.z - b[1]) > 0.1);
  const clear = (p, q) => !obstacles.some((o) => crosses(p, q, o));
  if (clear(a, b)) return [b];
  const nodes = [a, b, ...obstacles.flatMap((q) => [-2.15, 2.15].flatMap((x) => [-2.15, 2.15].map((z) => [q.x + x, q.z + z])))];
  const dist = nodes.map(() => Infinity), prev = [], done = new Set(); dist[0] = 0;
  while (!done.has(1)) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done.has(i) && (u < 0 || dist[i] < dist[u])) u = i;
    assert(u >= 0 && Number.isFinite(dist[u]), 'visibility planner has no route'); done.add(u);
    for (let v = 0; v < nodes.length; v++) if (!done.has(v) && clear(nodes[u], nodes[v])) {
      const d = dist[u] + Math.hypot(nodes[u][0] - nodes[v][0], nodes[u][1] - nodes[v][1]);
      if (d < dist[v]) { dist[v] = d; prev[v] = u; }
    }
  }
  const path = []; for (let i = 1; i !== 0; i = prev[i]) path.unshift(nodes[i]); return path;
}
function planned(goals, start = [spawn[0], spawn[2]]) {
  const targets = []; let a = start;
  for (const b of goals) { targets.push(...route(a, b)); a = b; }
  return targets;
}

// Instrument only the Player instance that run creates. Shared harness/player files are untouched.
function measuredRun(m, goals, { maxT = 250, direct = false } = {}) {
  const original = m.level.update;
  const sample = { distance: 0, seconds: 0, events: [], ticks: 0, maxSpeed: 0, jumps: 0 };
  let installed = false, historySize = 0;
  m.level.update = (t, dt, p) => {
    if (!installed) {
      installed = true;
      const step = p.step.bind(p);
      p.step = (...args) => {
        const x = p.pos.x, z = p.pos.z;
        step(...args);
        const d = Math.hypot(p.pos.x - x, p.pos.z - z);
        sample.distance += d; sample.seconds += args[0]; sample.ticks++;
        sample.maxSpeed = Math.max(sample.maxSpeed, d / args[0]);
        sample.jumps += p.events.filter((e) => e === 'jump').length;
        const s = m.level.marketfire;
        if (s.history.length > historySize) {
          for (const h of s.history.slice(historySize)) sample.events.push({ ...h, distance: sample.distance, seconds: sample.seconds, pos: [p.pos.x, p.pos.y, p.pos.z] });
          historySize = s.history.length;
        }
        if (sample.events.some((e) => e.point === 0) && sample.events.filter((e) => e.cause).length === 1 && !sample.events.some((e) => e.type === 'returned') && p.pos.z >= -20.4) {
          sample.events.push({ type: 'returned', distance: sample.distance, seconds: sample.seconds, pos: [p.pos.x, p.pos.y, p.pos.z] });
        }
      };
    }
    original(t, dt, p);
  };
  const result = run(m, spawn, direct ? goals : planned(goals), { maxT, nojump: true });
  m.level.update = original;
  return { ...sample, ...result };
}
const allCards = (sites) => sites.flatMap((s) => ['trace', 'ledger', 'witness'].map((k) => cardPoint(s, k)));
const minimum = (a = 'warehouse', b = 'smithy') => [cardPoint(a, 'trace'), cardPoint(a, 'ledger'), cardPoint(b, 'trace')];
function recovery(s, method, count = 3) {
  const p = POINTS.methods.find((p) => p.id === method);
  const goals = [[p.x, p.z]];
  let charges = 0;
  for (let i = 0; i < count; i++) {
    if (!charges) { goals.push(POINTS.sources[method]); charges = s.capacity[method]; }
    goals.push(POINTS.work[i]); charges--;
  }
  if (count === 3) goals.push(POINTS.finish);
  return goals;
}
const delta = (a, b) => ({ distance: +(b.distance - a.distance).toFixed(3), seconds: +(b.seconds - a.seconds).toFixed(3) });
const seedSet = new Set(Array.from({ length: 12 }, (_, i) => i + 1));
// Ensure both objects for all three causes are represented, regardless of RNG streaks.
const representative = {};
for (let seed = 1; Object.keys(representative).length < OBJECTS.length && seed < 500; seed++) representative[makeCase(seed).object] ??= seed;
Object.values(representative).forEach((s) => seedSet.add(s));
const seeds = [...seedSet];
T.check('흔적의 첫 표식 위치를 정답으로 외울 수 없음', { ok: new Set(seeds.flatMap((seed) => { const e = makeCase(seed); return e.cards.filter((c) => c.kind === 'trace').map((c) => c.origins.indexOf(e.focus)); })).size === 2, why: '' });
const sitePairs = [['warehouse', 'smithy'], ['warehouse', 'inn'], ['smithy', 'inn']];

for (const seed of seeds) for (const pair of sitePairs) for (const order of [pair, [...pair].reverse()]) {
  const m = fresh(seed), s = m.level.marketfire;
  const r = measuredRun(m, allCards(order));
  const result = interpret(s.cards);
  T.check(`seed ${seed} ${order.join('→')}: 실제 수집·두 필드 확정·착각 반박·전후 쌍`, {
    ok: r.ok && s.cards.length === 6 && result.candidates.length === 1 && result.candidates[0].id === s.event.object && result.candidates[0].cause === s.event.cause && result.contradictions.length > 0 && result.pairs.length > 0 && new Set(s.cards.map((c) => c.site)).size === 2,
    why: JSON.stringify({ r, cards: s.cards.map((c) => c.id), candidates: result.candidates.map((o) => o.id) }),
  });
  for (const site of pair) {
    const local = interpret(s.cards.filter((c) => c.site === site));
    T.check(`seed ${seed} ${site}: 한 현장만으로 정답 확정 불가·장부/흔적 쌍·증언 반박`, { ok: local.candidates.length === 2 && local.pairs.length > 0 && local.contradictions.length > 0, why: String(local.candidates.length) });
  }
  for (const kind of ['trace', 'ledger', 'witness']) T.check(`${seed}: ${kind} 하나로 두 필드 확정 불가`, { ok: interpret(s.cards.filter((c) => c.kind === kind)).candidates.length > 1, why: kind });
  m.level.dispose();
}

// Minimum 3 cards, any 2 sites, all seeds: solve using the COLLECTED evidence, not a hidden answer.
for (const seed of seeds) for (const pair of sitePairs) {
  const m = fresh(seed), s = m.level.marketfire;
  const ids = new Set([`${pair[0]}-trace`, `${pair[0]}-ledger`, `${pair[1]}-trace`]);
  const expected = interpret(s.event.cards.filter((c) => ids.has(c.id))).candidates;
  assert.equal(expected.length, 1);
  const collecting = measuredRun(m, [...minimum(...pair), ...conclusionPoints(expected[0].cause, expected[0].id), ...recovery(s, MATCH[expected[0].cause])]);
  const result = interpret(s.cards);
  T.check(`seed ${seed} ${pair.join('+')}: 정확히 3장·2종류 최소 증거로 완주`, { ok: collecting.ok && m.level.finished && s.cards.length === 3 && result.candidates.length === 1 && result.pairs.length > 0, why: collecting.why });
  m.level.dispose();
}

{
  const m = fresh(3), s = m.level.marketfire;
  const r = measuredRun(m, [...conclusionPoints(s.event.cause, s.event.object), POINTS.finish], { direct: true, maxT: 20 });
  T.check('조사 통째 건너뛰기 불가·입장 장벽 실제 충돌', { ok: !r.ok && !s.submitted && !m.level.finished, why: r.why });
  m.level.dispose();
}
{
  const m = fresh(3), s = m.level.marketfire;
  measuredRun(m, [cardPoint('warehouse', 'trace'), [ -35, 3 ], cardPoint('warehouse', 'trace'), ...conclusionPoints(s.event.cause, s.event.object)]);
  T.check('같은 카드 왕복 수집으로 N 채우기 불가', { ok: s.cards.length === 1 && !s.submitted, why: JSON.stringify(s.cards.map((c) => c.id)) });
  m.level.dispose();
}
{
  const m = fresh(3), s = m.level.marketfire;
  measuredRun(m, SITE_IDS.map((site) => cardPoint(site, 'trace')).concat(conclusionPoints(s.event.cause, s.event.object)));
  T.check('카드 3장이어도 한 종류만으로 입장 불가', { ok: s.cards.length === 3 && !s.submitted, why: String(s.cards.length) });
  m.level.dispose();
}

const matrix = [], retries = [], fullRoutes = [];
for (const cause of CAUSES) {
  const seed = Object.values(representative).find((seed) => makeCase(seed).cause === cause);
  const row = { cause, seed, methods: {} };
  for (const method of METHODS) {
    const m = fresh(seed), s = m.level.marketfire;
    const goals = [...minimum(), ...conclusionPoints(cause, s.event.object), ...recovery(s, method)];
    const r = measuredRun(m, goals);
    const submitted = r.events.find((e) => e.cause);
    T.check(`${cause}×${method}: 최소 증거부터 별 없이 결승`, { ok: r.ok && m.level.finished && s.cards.length === 3 && s.repaired.every(Boolean) && m.level.stars.every((s) => !s.got) && s.history.filter((h) => h.method).every((h) => h.method === method), why: JSON.stringify({ why: r.why, history: s.history, repaired: s.repaired }) });
    assert(submitted, `no submission: ${r.why}`);
    row.methods[method] = delta(submitted, r);
    fullRoutes.push({ cause, method, seed, investigation: delta({ distance: 0, seconds: 0 }, submitted), recovery: row.methods[method], total: delta({ distance: 0, seconds: 0 }, r), jumps: r.jumps, maxSpeed: r.maxSpeed });
    T.check(`${cause}×${method}: 실제 모든 tick 측정·수평 속도 한계`, { ok: r.ticks > 100 && Math.abs(r.seconds - r.ticks * S) < 1e-6 && r.maxSpeed <= 7.1 && r.jumps === 0, why: JSON.stringify({ seconds: r.seconds, ticks: r.ticks, speed: r.maxSpeed, jumps: r.jumps }) });
    m.level.dispose();
  }
  const best = row.methods[MATCH[cause]];
  const prefixes = fullRoutes.filter((r) => r.cause === cause).map((r) => r.investigation);
  T.check(`${cause}: 대응 비교의 조사·제출 시작 상태 동일`, { ok: prefixes.every((p) => p.distance === prefixes[0].distance && p.seconds === prefixes[0].seconds), why: JSON.stringify(prefixes) });
  for (const method of METHODS.filter((m) => m !== MATCH[cause])) {
    const other = row.methods[method];
    T.check(`${cause}: 적합 대응이 ${method}보다 10m·15% 이상 짧고 빠름`, { ok: other.distance - best.distance >= 10 && (other.distance - best.distance) / other.distance >= 0.15 && best.seconds < other.seconds, why: JSON.stringify({ best, other }) });
  }
  matrix.push(row);
  // Wrong cause AND object; every cause gets a measured walking return and a new submission.
  const m = fresh(seed), s = m.level.marketfire;
  const wrong = OBJECTS.find((o) => o.cause !== cause);
  const wrongMethod = MATCH[wrong.cause];
  // First point is already repaired. Visit remaining points, not an artificial extra first-point trip.
  const firstTrip = [...minimum(), ...conclusionPoints(wrong.cause, wrong.id), ...recovery(s, wrongMethod, 1)];
  const c = POINTS.methods.find((p) => p.id === MATCH[cause]);
  const r = measuredRun(m, [...firstTrip, [0, -19.8], ...conclusionPoints(cause, s.event.object), [c.x, c.z], POINTS.sources[c.id], ...POINTS.work.slice(1), POINTS.finish]);
  const firstWork = r.events.find((e) => e.point === 0), submissions = r.events.filter((e) => e.cause);
  T.check(`${cause}: 틀린 결론 입장·모순 표시·첫 복구·본부 재결론·완주`, { ok: r.ok && m.level.finished && submissions.length === 2 && s.history[0].cause === wrong.cause && s.history[0].conflicts.length > 0 && submissions[1].conflicts.length === 0, why: JSON.stringify({ why: r.why, history: s.history }) });
  const returned = r.events.find((e) => e.type === 'returned');
  assert(firstWork && submissions[1] && returned);
  retries.push({ cause, seed, returnOnly: { from: '첫 작업 완료', to: '본부 입구(제출 앞 z=-20.4 경계)', ...delta(firstWork, returned) }, reviseAndSubmit: delta(returned, submissions[1]), total: delta(firstWork, submissions[1]) });
  m.level.dispose();
}

const additionalComparisons = {};
for (const method of METHODS) {
  // Both specific objects of every cause, with every method: no representative-only success.
  for (const seed of Object.values(representative)) {
    const m = fresh(seed), s = m.level.marketfire;
    const r = measuredRun(m, [...minimum(), ...conclusionPoints(s.event.cause, s.event.object), ...recovery(s, method)]);
    T.check(`seed ${seed} ${method}: 모든 사건 완주`, { ok: r.ok && m.level.finished, why: r.why });
    const submitted = r.events.find((e) => e.cause);
    assert(submitted);
    additionalComparisons[seed] ??= { cause: s.event.cause, object: s.event.object, methods: {} };
    additionalComparisons[seed].methods[method] = delta(submitted, r);
    m.level.dispose();
  }
}
for (const [seed, row] of Object.entries(additionalComparisons)) {
  const best = row.methods[MATCH[row.cause]];
  T.check(`seed ${seed}: 두 세부 물체 모두 10m·15% 기준 충족`, { ok: METHODS.filter((m) => m !== MATCH[row.cause]).every((m) => row.methods[m].distance - best.distance >= 10 && (row.methods[m].distance - best.distance) / row.methods[m].distance >= 0.15 && row.methods[m].seconds > best.seconds), why: JSON.stringify(row) });
}
{
  const m = fresh(3), s = m.level.marketfire;
  const r = measuredRun(m, [...POINTS.stars, ...minimum(), ...conclusionPoints(s.event.cause, s.event.object), ...recovery(s, MATCH[s.event.cause])]);
  T.check('선택 별 2개 모두 걸어서 도달·완주', { ok: r.ok && m.level.finished && m.level.stars.every((s) => s.got), why: r.why });
  m.level.resetProgress();
  T.check('초기화: 카드·결론·복구·별·입장 전부 복원', { ok: !s.cards.length && !s.submitted && !s.conclusion.cause && s.repaired.every((x) => !x) && s.entry.userData.collider.enabled && m.level.stars.every((x) => !x.got), why: '' });
  m.level.setSeed(7);
  T.check('setSeed 실제 사건·도구·현장 안내 함께 갱신', { ok: s.event.seed === 7 && s.event.object === makeCase(7).object && s.boards.evidenceBoard.lines[1].includes('0장'), why: '' });
  m.level.dispose();
}

const report = { schema: 1, units: { distance: 'actual horizontal metres', seconds: 'simulation seconds' }, threshold: { absoluteMetres: 10, relative: 0.15 }, seeds, representatives: representative, matrix, retries, fullRoutes, additionalComparisons };
const measurementFile = new URL('./marketfire-measurements.json', import.meta.url);
if (existsSync(measurementFile) && !process.argv.includes('--write-measurements')) {
  const saved = JSON.parse(readFileSync(measurementFile, 'utf8'));
  T.check('보관 실측과 현재 재측정 일치', { ok: JSON.stringify(saved) === JSON.stringify(report), why: '코드 변경 뒤 --write-measurements와 docs/66 실측 표 갱신 필요' });
}
console.log('시장 마을 실측 3×3 (수평 m / 초):');
for (const row of matrix) console.log(row.cause, METHODS.map((m) => `${m}=${row.methods[m].distance.toFixed(2)}m/${row.methods[m].seconds.toFixed(2)}s`).join(' | '));
console.log('틀린 결론 뒤 복귀·재결론:', JSON.stringify(retries));
T.report();
if (process.argv.includes('--write-measurements') && !process.exitCode) writeFileSync(measurementFile, JSON.stringify(report, null, 2) + '\n');
