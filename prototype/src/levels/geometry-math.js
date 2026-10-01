// 격자 정사각형 전개도를 90도로 접어 면의 방향·위치·연결을 검증한다.
const neg = (v) => v.map((n) => -n);
const add = (a, b) => a.map((n, i) => n + b[i]);
const eq = (a, b) => a.every((n, i) => n === b[i]);
const key = ([x, y]) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function analyzeCubeNet(cells) {
  const invalid = (reason) => ({ valid: false, reason, faces: [], overlaps: [] });
  if (cells.length !== 6 || cells.some((c) => c.length !== 2 || !c.every(Number.isInteger))) return invalid('같은 크기 정사각형 여섯 개가 필요해요.');
  const lookup = new Map(cells.map((c, i) => [key(c), i]));
  if (lookup.size !== 6) return invalid('같은 자리에 면이 겹쳐 있어요.');
  const faces = Array(6).fill(null);
  faces[0] = { index: 0, parent: -1, dx: 0, dy: 0, u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], p2: [0, 0, 0] };
  const queue = [0];
  let inconsistent = false;
  for (const i of queue) {
    const face = faces[i];
    for (const [dx, dy] of STEPS) {
      const j = lookup.get(key([cells[i][0] + dx, cells[i][1] + dy]));
      if (j === undefined) continue;
      let u, v, n, axis;
      if (dx) {
        u = dx > 0 ? face.n : neg(face.n); v = face.v;
        n = dx > 0 ? neg(face.u) : face.u;
        axis = dx > 0 ? face.u : neg(face.u);
      } else {
        u = face.u; v = dy > 0 ? face.n : neg(face.n);
        n = dy > 0 ? neg(face.v) : face.v;
        axis = dy > 0 ? face.v : neg(face.v);
      }
      const p2 = add(face.p2, add(axis, face.n));
      if (!faces[j]) {
        faces[j] = { index: j, parent: i, dx, dy, u, v, n, p2 };
        queue.push(j);
      } else if (!eq(faces[j].u, u) || !eq(faces[j].v, v) || !eq(faces[j].n, n) || !eq(faces[j].p2, p2)) inconsistent = true;
    }
  }
  if (faces.some((f) => !f)) return invalid('면들이 변으로 이어져 있지 않아요.');
  const byNormal = new Map();
  for (const f of faces) {
    const nk = f.n.join(',');
    if (!byNormal.has(nk)) byNormal.set(nk, []);
    byNormal.get(nk).push(f.index);
  }
  const overlaps = [...byNormal.values()].filter((group) => group.length > 1).flat();
  const sameCenter = faces.every((f) => eq(add(f.p2, f.n), [0, 0, 1]));
  const valid = !inconsistent && overlaps.length === 0 && sameCenter;
  return { valid, faces, overlaps, reason: valid ? '여섯 면이 겹치지 않고 정육면체를 닫아요.' : '접으면 면이 겹치거나 변이 맞지 않아 상자를 닫을 수 없어요.' };
}

// ax*x + ay*y = offset 를 기준으로 점을 반사한다. 화면 좌우와 무관하다.
export function reflectPoint([x, y], { normal: [ax, ay], offset = 0 }) {
  const norm2 = ax * ax + ay * ay;
  if (!norm2) throw new Error('대칭선의 법선은 0일 수 없습니다.');
  const d = (ax * x + ay * y - offset) / norm2;
  return [x - 2 * d * ax, y - 2 * d * ay];
}
