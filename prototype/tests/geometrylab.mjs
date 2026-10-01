import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { buildGeometryLab, NET_OPTIONS } from '../src/levels/geometrylab.js';
import { analyzeCubeNet, reflectPoint } from '../src/levels/geometry-math.js';
const T = tally('도형 건축 연구소');
const make = (seed = 1) => {
  const world = new PhysicsWorld();
  return { world, level: buildGeometryLab(new THREE.Scene(), world, { seed }) };
};
function tap(m, state, index) {
  const p = state.pads[index];
  m.level.update(0, 1 / 120, { pos: new THREE.Vector3(p.x, 1.15, p.z) });
  m.level.update(0, 1 / 120, { pos: new THREE.Vector3(0, 1, state.z + 18) });
}

// 회전·반사를 같은 모양으로 정규화하여 연결된 정사각형 여섯 개의
// 모든 35개 모양을 생성한다. 정육면체 전개도 11개라는 독립 기준과 비교.
function variants(cells) {
  return Array.from({ length: 8 }, (_, i) => cells.map(([x, y]) => {
    if (i >= 4) x = -x;
    for (let r = 0; r < i % 4; r++) [x, y] = [-y, x];
    return [x, y];
  }));
}
function normalize(cells) {
  const minX = Math.min(...cells.map(([x]) => x)), minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
function canonical(cells) { return variants(cells).map((v) => JSON.stringify(normalize(v))).sort()[0]; }
let shapes = new Map([['[[0,0]]', [[0, 0]]]]);
for (let size = 2; size <= 6; size++) {
  const next = new Map();
  for (const cells of shapes.values()) {
    const occupied = new Set(cells.map((c) => c.join(',')));
    for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = [x + dx, y + dy];
      if (occupied.has(c.join(','))) continue;
      const expanded = [...cells, c], key = canonical(expanded);
      if (!next.has(key)) next.set(key, JSON.parse(key));
    }
  }
  shapes = next;
}
T.check('여섯 정사각형의 35개 연결 모양 생성', { ok: shapes.size === 35 });
const validNets = [...shapes.values()].filter((cells) => analyzeCubeNet(cells).valid);
T.check('35개 중 정육면체 전개도는 11개', { ok: validNets.length === 11, why: String(validNets.length) });
for (const [i, cells] of [...shapes.values()].entries()) {
  const expected = analyzeCubeNet(cells).valid;
  T.check(`회전·반사 불변 ${i}`, { ok: variants(cells).every((v) => analyzeCubeNet(v).valid === expected) });
}
for (const [name, cells] of [
  ['여섯 면 미만', [[0, 0]]],
  ['중복 면', [[0, 0], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]],
  ['분리된 면', [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [8, 0]]],
]) T.check(name, { ok: !analyzeCubeNet(cells).valid });
NET_OPTIONS.forEach((options, i) => T.check(`각 방 정답 하나 ${i}`, { ok: options.filter((c) => analyzeCubeNet(c).valid).length === 1 }));

// 수직·수평·대각·이동한 기준선의 반사점과, 두 번 반사하면 원래 위치.
for (const [source, axis, target] of [
  [[-2, 1], { normal: [1, 0] }, [2, 1]],
  [[-1, -2], { normal: [0, 1] }, [-1, 2]],
  [[2, 3], { normal: [1, -1] }, [3, 2]],
  [[-2, 1], { normal: [1, 0], offset: 1 }, [4, 1]],
]) {
  const reflected = reflectPoint(source, axis);
  T.check(`대칭 위치 ${source}/${target}`, { ok: reflected.every((n, i) => Math.abs(n - target[i]) < 1e-8) });
  const twice = reflectPoint(reflected, axis);
  T.check(`두 번 반사 ${source}`, { ok: twice.every((n, i) => Math.abs(n - source[i]) < 1e-8) });
}

const m = make();
const first = m.level.builders[0];
tap(m, first, 4);
T.check('선택 전 접기는 열리지 않음', { ok: !first.solved && !first.folding });
tap(m, first, 1); tap(m, first, 4);
m.level.update(2, 2, null);
T.check('틀린 전개도 접어도 길 없음', { ok: !first.solved && first.models[1].analysis.overlaps.length > 0 && first.bridge.every((b) => !b.userData.collider.enabled) });
tap(m, first, 3);
T.check('다시 펼치기', { ok: first.fold === 0 });
tap(m, first, 0); tap(m, first, 4);
T.check('옳은 전개도도 접기 완료 전에는 잠김', { ok: !first.solved });
m.level.update(3, 2, null);
T.check('접기 완료 후 상자 발판 생성', { ok: first.solved && first.bridge.every((b) => b.visible && b.userData.collider.enabled) });

// 애니메이션의 실제 면 꼭짓점으로 검증: 정육면체는 꼭짓점 8개,
// 각 꼭짓점에 정확히 세 면이 만난다. 판정 함수의 방향값을 재사용하지 않는다.
for (const [ri, state] of m.level.builders.slice(0, 2).entries()) {
  const model = state.models.find((model) => model.analysis.valid);
  model.setFold(1);
  const vertices = [];
  for (const mesh of model.meshes) {
    const points = mesh.geometry.attributes.position;
    const faceVertices = [];
    for (let i = 0; i < points.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(mesh.matrixWorld);
      if (!faceVertices.some((point) => point.distanceTo(v) < 1e-5)) faceVertices.push(v);
    }
    for (const point of faceVertices) {
      const existing = vertices.find((vertex) => vertex.point.distanceTo(point) < 1e-5);
      if (existing) existing.count++;
      else vertices.push({ point, count: 1 });
    }
  }
  T.check(`실제 접힘 정육면체 꼭짓점 ${ri}`, { ok: vertices.length === 8 && vertices.every((v) => v.count === 3), why: `꼭짓점 ${vertices.length}` });
  model.setFold(0);
}
tap(m, first, 2); tap(m, first, 4); m.level.update(6, 2, null);
T.check('성공 후 다른 전개도 관찰해도 길 유지', { ok: first.solved });

const third = m.level.builders[2];
tap(m, third, 0); tap(m, third, 4);
T.check('기준선 거리 다른 오답은 잠김', { ok: !third.solved });
tap(m, third, 1); tap(m, third, 4);
T.check('좌우 위치만 바꾼 오답도 잠김', { ok: !third.solved });
tap(m, third, 2); tap(m, third, 4);
T.check('수직선 대칭 다리 생성', { ok: third.solved });
tap(m, third, 3);
T.check('선택 지워도 완성 다리 유지', { ok: third.solved && third.selected === -1 });
const other = make();
other.level.getOthers = () => first.pads.map((p) => new THREE.Vector3(p.x, 1.15, p.z));
other.level.update(1, 1, null);
T.check('다른 학생 위치로 내 작업이 바뀌지 않음', { ok: other.level.builders.every((b) => b.selected === -1 && !b.solved) });

for (const seed of [1, 5, 99]) {
  const path = make(seed);
  T.check(`출입구 잠김 ${seed}`, { ok: !run(path, [0, 1, -33], [[0, -41]], { maxT: 3 }).ok });
  for (const [index, state] of path.level.builders.entries()) {
    const chosen = index < 2 ? state.models.findIndex((m) => m.analysis.valid) : state.options.findIndex((p) => p.every((n, i) => n === state.target[i]));
    const choicePad = state.pads[chosen], submit = state.pads[4];
    T.check(`걸어서 선택·완성·통과 ${seed}/${index}`, run(path, [0, 1, state.z + 17], [[choicePad.x, choicePad.z], [0, state.z + 12], [submit.x, submit.z], [0, state.z + 2], [0, state.z - 8]]));
    T.check(`완성 상태 ${seed}/${index}`, { ok: state.solved });
  }
  T.check(`전체 경로 ${seed}`, run(path, [0, 0, 5], [[0, -13], [0, -21], [0, -34], [0, -47], [0, -67], [0, -80], [0, -100], [0, -113], [0, -133], [0, -146], [0, -157]]));
  T.check(`완주 ${seed}`, { ok: path.level.finished });
  path.level.resetProgress();
  T.check(`처음부터 초기화 ${seed}`, { ok: !path.level.finished && path.level.builders.every((b) => !b.solved && b.selected === -1 && b.fold === 0 && b.bridge.every((mesh) => !mesh.userData.collider.enabled)) });
}
m.level.setSeed(42);
T.check('새 경기 초기화', { ok: m.level.seed === 42 && m.level.builders.every((b) => !b.solved && b.selected === -1) });
T.report();
