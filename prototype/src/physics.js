// 간단한 충돌 시스템: 플레이어(구 2개)와 회전 가능한 박스(OBB)만 다룬다.
// 움직이는 발판은 매 스텝 이전/현재 변환 행렬을 비교해 플레이어를 실어 나른다.
import * as THREE from 'three';

const _local = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _toC = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _prevPoint = new THREE.Vector3();

export class BoxCollider {
  /**
   * @param {THREE.Object3D} object 박스의 월드 변환을 결정하는 객체 (스케일 1이어야 함)
   * @param {THREE.Vector3} half 박스 반 크기
   * @param {object} opts kind: 'solid' | 'bounce' | 'bumper', dynamic, slippery, icy, onStand
   */
  constructor(object, half, opts = {}) {
    this.object = object;
    this.half = half.clone();
    this.kind = opts.kind || 'solid';
    this.dynamic = !!opts.dynamic;
    this.slippery = !!opts.slippery;
    this.icy = !!opts.icy; // 평평한 얼음: 가속·감속이 느려 미끄러진다 (slippery는 경사에서 밀려 내려가는 것)
    this.bounceSpeed = opts.bounceSpeed ?? null; // 'bounce' 발판마다 튕기는 힘을 다르게
    this.onStand = opts.onStand || null;
    this.enabled = true;
    this.radius = this.half.length();
    this.center = new THREE.Vector3();
    this.matrix = new THREE.Matrix4();
    this.inverse = new THREE.Matrix4();
    this.prevMatrix = new THREE.Matrix4();
    this.prevInverse = new THREE.Matrix4();
    this.delta = new THREE.Matrix4();
    this.sync(true);
  }

  // object의 matrixWorld가 최신이라고 가정한다.
  sync(reset = false) {
    this.prevMatrix.copy(this.matrix);
    this.prevInverse.copy(this.inverse);
    this.matrix.copy(this.object.matrixWorld);
    this.inverse.copy(this.matrix).invert();
    this.center.setFromMatrixPosition(this.matrix);
    if (reset) {
      this.prevMatrix.copy(this.matrix);
      this.prevInverse.copy(this.inverse);
    }
    // 이전 → 현재 변환: 발판 위 점을 함께 옮길 때 쓴다.
    this.delta.multiplyMatrices(this.matrix, this.prevInverse);
  }

  // 월드 좌표의 점이 이번 스텝에 움직인 속도
  pointVelocity(point, dt, out) {
    _prevPoint.copy(point).applyMatrix4(this.inverse).applyMatrix4(this.prevMatrix);
    return out.copy(point).sub(_prevPoint).divideScalar(dt);
  }

  // 구와 충돌하면 out.normal(월드), out.depth를 채우고 true
  collideSphere(center, r, out) {
    _local.copy(center).applyMatrix4(this.inverse);
    const h = this.half;
    _closest.set(
      THREE.MathUtils.clamp(_local.x, -h.x, h.x),
      THREE.MathUtils.clamp(_local.y, -h.y, h.y),
      THREE.MathUtils.clamp(_local.z, -h.z, h.z),
    );
    const dx = _local.x - _closest.x;
    const dy = _local.y - _closest.y;
    const dz = _local.z - _closest.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r * r) return false;

    if (d2 > 1e-10) {
      const d = Math.sqrt(d2);
      out.normal.set(dx / d, dy / d, dz / d);
      out.depth = r - d;
    } else {
      // 구 중심이 박스 안: 가장 얕은 면으로 밀어낸다.
      const px = h.x - Math.abs(_local.x);
      const py = h.y - Math.abs(_local.y);
      const pz = h.z - Math.abs(_local.z);
      if (py <= px && py <= pz) {
        out.normal.set(0, Math.sign(_local.y) || 1, 0);
        out.depth = py + r;
      } else if (px <= pz) {
        out.normal.set(Math.sign(_local.x) || 1, 0, 0);
        out.depth = px + r;
      } else {
        out.normal.set(0, 0, Math.sign(_local.z) || 1);
        out.depth = pz + r;
      }
    }
    out.normal.transformDirection(this.matrix);
    return true;
  }

  // 반직선(origin + dir·t, dir 단위 벡터)이 박스에 처음 닿는 t. 안 닿으면 Infinity (카메라가 벽 뒤로 가지 않게)
  raycast(origin, dir, maxDist) {
    _local.copy(origin).applyMatrix4(this.inverse);
    _rayDir.copy(dir).transformDirection(this.inverse);
    let t0 = 0;
    let t1 = maxDist;
    for (const k of ['x', 'y', 'z']) {
      const o = _local[k];
      const d = _rayDir[k];
      const h = this.half[k];
      if (Math.abs(d) < 1e-9) {
        if (o < -h || o > h) return Infinity;
        continue;
      }
      let a = (-h - o) / d;
      let b = (h - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return Infinity;
    }
    return t0;
  }
}

export class PhysicsWorld {
  constructor() {
    this.colliders = [];
  }

  add(collider) {
    this.colliders.push(collider);
    return collider;
  }

  // 움직이지 않는 충돌체 중 반직선에 처음 닿는 거리 (없으면 maxDist)
  raycast(origin, dir, maxDist) {
    let best = maxDist;
    for (const c of this.colliders) {
      if (!c.enabled || c.dynamic) continue;
      // 경계 구로 먼저 거른다
      _toC.copy(c.center).sub(origin);
      const along = THREE.MathUtils.clamp(_toC.dot(dir), 0, best);
      if (_toC.addScaledVector(dir, -along).lengthSq() > c.radius * c.radius) continue;
      const t = c.raycast(origin, dir, best);
      if (t < best) best = t;
    }
    return best;
  }

  syncDynamic() {
    for (const c of this.colliders) if (c.dynamic) c.sync();
  }
}
