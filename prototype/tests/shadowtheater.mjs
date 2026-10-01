import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { projectPoint, projectBox, boxVertices, insideHull, shadowMask, maskSimilarity } from '../src/levels/shadow-math.js';
import { buildShadowTheater, SHADOW_SCENES } from '../src/levels/shadowtheater.js';
const T = tally('그림자 변신 극장');
const close = (a, b, e = 1e-6) => Math.abs(a - b) < e;
function make(seed = 1) { const world = new PhysicsWorld(); return { world, level: buildShadowTheater(new THREE.Scene(), world, { seed }) }; }
function tap(m, s, i) {
  const p = s.pads[i]; m.level.update(0, 1 / 120, { pos: new THREE.Vector3(p.x, 1.15, p.z) });
  m.level.update(0, 1 / 120, { pos: new THREE.Vector3(0, 1, s.z + 19) });
}
function action(s, name, value) { return s.pads.findIndex((p) => p.action === name && (value === undefined || p.value === value)); }
const solutions = [
  [['distance', -1], ['distance', -1], ['distance', -1]],
  [['rotate', 1], ['rotate', 1], ['rotate', 1]],
  [['x', 0.25], ['x', 0.25], ['y', 0.25], ['y', 0.25]],
  [['x', 0.25], ['x', 0.25], ['x', 0.25], ['select', 1], ['x', -0.25], ['x', -0.25], ['x', -0.25]],
];
T.check('점 투영', { ok: JSON.stringify(projectPoint([2, 1, 6])) === '[4,2]', why: '' });
for (const p of [[0, 0, 0], [0, 0, 12], [0, 0, -1], [NaN, 0, 6]]) {
  let throws = false; try { projectPoint(p); } catch { throws = true; }
  T.check(`잘못된 위치`, { ok: throws, why: '' });
}
const flat = (d) => ({ size: [1, 1, 0], position: [0, 0, d] });
T.check('거리와 그림자 크기', { ok: close(Math.max(...projectBox(flat(4)).map(p => p[0])), 2 * Math.max(...projectBox(flat(8)).map(p => p[0]))), why: '' });
T.check('빈 그림자 미완성', { ok: maskSimilarity(new Uint8Array(10), new Uint8Array(10)) === 0, why: '' });
for (const rotationY of [0, Math.PI / 6, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
  const b = { size: [1.4, 1.2, 0.35], position: [0.5, -0.25, 6], rotationY };
  const hull = projectBox(b);
  T.check(`윤곽에 꼭짓점 포함`, { ok: boxVertices(b).every((p) => insideHull(projectPoint(p), hull)), why: '' });
  T.check(`회전 주기`, { ok: maskSimilarity(shadowMask([hull]), shadowMask([projectBox({ ...b, rotationY: rotationY + Math.PI * 2 })])) === 1, why: '' });
}
const m = make();
for (const [i, s] of m.level.theaters.entries()) {
  T.check(`초기 미완성`, { ok: !s.solved && s.similarity < 0.975 && s.door.userData.collider.enabled, why: '' });
  tap(m, s, action(s, 'submit'));
  T.check(`오답은 문 유지`, { ok: !s.solved && s.attempts === 1, why: '' });
  for (const [name, value] of solutions[i]) tap(m, s, action(s, name, value));
  T.check(`확정 전 결과 갱신`, { ok: s.similarity >= 0.975 && !s.solved, why: `일치 ${s.similarity}` });
  for (const [oi, mesh] of s.meshes.entries()) {
    const vertices = mesh.geometry.getAttribute('position'), projected = [];
    for (let vi = 0; vi < vertices.count; vi++) {
      const p = new THREE.Vector3().fromBufferAttribute(vertices, vi).applyMatrix4(mesh.matrixWorld);
      const ray = p.clone().sub(s.lightOrigin);
      const t = -4.8 / ray.z;
      const hit = s.lightOrigin.clone().addScaledVector(ray, t);
      projected.push([(hit.x + 6) / 0.4, (hit.y - 4.6) / 0.4]);
    }
    const expected = boxVertices(s.objects[oi]).map((p) => projectPoint(p));
    T.check(`모형의 실제 투영`, { ok: projected.every((p) => expected.some((q) => close(p[0], q[0]) && close(p[1], q[1]))), why: '' });
  }
  tap(m, s, action(s, 'submit')); m.level.update(1, 1, null);
  T.check(`완성 후 문 열림`, { ok: s.solved && !s.door.userData.collider.enabled, why: '' });
  tap(m, s, action(s, 'clear'));
  T.check(`완성 경로 유지`, { ok: s.solved && !s.door.userData.collider.enabled && s.similarity < 0.975, why: '' });
}
m.level.resetProgress();
T.check('전체 초기화', { ok: m.level.theaters.every((s) => !s.solved && s.attempts === 0 && s.selected === 0 && s.door.userData.collider.enabled), why: '' });
const s = m.level.theaters[0];
const before = JSON.stringify(s.objects);
m.level.getOthers = () => s.pads.map((p) => new THREE.Vector3(p.x, 1.15, p.z));
m.level.getPlayerCount = () => 21;
m.level.update(2, 1, { pos: new THREE.Vector3(0, 1, s.z + 19) });
T.check('학생별 선택 독립', { ok: before === JSON.stringify(s.objects) && !s.solved, why: '' });
for (let i = 0; i < 20; i++) tap(m, s, action(s, 'distance', -1));
T.check('거리 제한', { ok: s.objects[0].position[2] === 4, why: '' });
const pad = s.pads[action(s, 'distance', 1)];
m.level.update(0, 1 / 120, { pos: new THREE.Vector3(pad.x, 1.15, pad.z) });
m.level.update(0.5, 0.5, { pos: new THREE.Vector3(pad.x, 1.15, pad.z) });
T.check('연속 입력 방지', { ok: s.objects[0].position[2] === 5, why: '' });
for (const seed of [1, 7, 99]) {
  const walk = make(seed), targets = [];
  for (const [i, state] of walk.level.theaters.entries()) {
    targets.push([0, state.z + 19]);
    for (const [name, value] of [...solutions[i], ['submit']]) {
      const p = state.pads[action(state, name, value)]; targets.push([p.x, p.z], [0, state.z + 19]);
    }
    targets.push([0, state.z - 10]);
  }
  targets.push([0, -157]);
  T.check(`걸어서 조작과 통과`, run(walk, [0, 0, 2], targets, { maxT: 200 }));
  T.check(`걸어서 무대 완성`, { ok: walk.level.theaters.every((state) => state.solved), why: '' });
  walk.level.setSeed(3);
  T.check(`새 경기 초기화`, { ok: walk.level.theaters.every((state) => !state.solved), why: '' });
}
T.report();
