// 작은 점 광원에서 고정 화면으로 투영하는 모형. 흐린 가장자리·여러 광원은 다루지 않는다.
export function projectPoint([x, y, z], screenDistance = 12) {
  if (![x, y, z, screenDistance].every(Number.isFinite) || z <= 0 || z >= screenDistance) throw new RangeError('물체는 빛과 화면 사이에 있어야 합니다.');
  return [x * screenDistance / z, y * screenDistance / z];
}

export function convexHull(points) {
  const sorted = [...new Map(points.map((p) => [p.join(','), p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower = [], upper = [];
  for (const p of sorted) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 1e-10) lower.pop(); lower.push(p); }
  for (const p of [...sorted].reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 1e-10) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function boxVertices({ size, position, rotationY = 0 }) {
  const c = Math.cos(rotationY), s = Math.sin(rotationY), vertices = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * size[0] / 2, y = sy * size[1] / 2, z = sz * size[2] / 2;
    vertices.push([position[0] + c * x + s * z, position[1] + y, position[2] - s * x + c * z]);
  }
  return vertices;
}

export const projectBox = (box, distance = 12) => convexHull(boxVertices(box).map((p) => projectPoint(p, distance)));
export function insideHull([x, y], hull) {
  if (hull.length < 3) return false;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < -1e-9) return false;
  }
  return true;
}
export const SHADOW_VIEW = { xMin: -3.5, xMax: 3.5, yMin: -2.4, yMax: 2.4, width: 140, height: 96 };
export function shadowMask(hulls, view = SHADOW_VIEW) {
  const mask = new Uint8Array(view.width * view.height);
  for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) {
    const p = [view.xMin + (x + 0.5) * (view.xMax - view.xMin) / view.width, view.yMin + (y + 0.5) * (view.yMax - view.yMin) / view.height];
    mask[y * view.width + x] = hulls.some((h) => insideHull(p, h)) ? 1 : 0;
  }
  return mask;
}
export function maskSimilarity(a, b) {
  if (a.length !== b.length) throw new RangeError('같은 화면 크기를 비교해야 합니다.');
  let intersection = 0, union = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) intersection++; if (a[i] || b[i]) union++; }
  return union ? intersection / union : 0;
}
