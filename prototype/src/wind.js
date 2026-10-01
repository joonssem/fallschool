// 압력에서 바람 만들기 (바람마을 맵 등에서 쓰는 공용 계산, 맵 파일은 이 파일을 불러다 쓴다)
//
// 고기압(+)·저기압(-)을 압력 원본(source)으로 놓으면 압력장 p(x, z, t)는 원본들의 합이다.
// 바람은 압력이 높은 곳에서 낮은 곳으로 분다: 바람 = -k × (압력의 기울기).
// 압력이 가파르게 변하는 곳(등압선이 촘촘한 곳)일수록, 압력 차(세기)가 클수록 바람이 세다. 가우스 모양이라 원본 중심에서는 기울기가 0이어서
// 바람이 약하고, 중심에서 sigma 쯤 떨어진 곳에서 가장 세다 (고기압·저기압 사이가 너무 가까우면 오히려 약해질 수 있다).
// 화면의 깃발·입자도 같은 함수로 그리면 화면과 규칙이 어긋나지 않는다.
//
// 게임 단순화: 바람은 곧게 분다. 실제로는 지구 자전 때문에 휘어 불지만(전향력) 여기서는 다루지 않는다.
// 학생을 밀어내는 속도는 게임 과장이다 (실제 바람이 사람을 날려 보내지 않는다).
//
// 원본: { x, z, sigma, a } — a(세기, 고기압 +, 저기압 -)는 숫자 또는 시간 함수 (t) => 숫자

const amp = (src, t) => (typeof src.a === 'function' ? src.a(t) : src.a);

/** (x, z, t)의 압력 (단위 없음, 고기압은 양수 쪽) */
export function pressureAt(sources, x, z, t = 0) {
  let p = 0;
  for (const s of sources) {
    const dx = x - s.x;
    const dz = z - s.z;
    p += amp(s, t) * Math.exp(-(dx * dx + dz * dz) / (2 * s.sigma * s.sigma));
  }
  return p;
}

/**
 * (x, z, t)의 바람 속도(m/s)를 out.x, out.z 에 더한다. 압력이 높은 쪽에서 낮은 쪽으로 분다.
 * k: 압력 기울기 → 속도 배율, maxSpeed: 바람 속도 상한 (조작 가능한 범위를 지키려는 게임용 제한)
 */
export function addWindFromPressure(sources, x, z, t, out, { k = 1, maxSpeed = 5 } = {}) {
  let gx = 0;
  let gz = 0;
  for (const s of sources) {
    const dx = x - s.x;
    const dz = z - s.z;
    const e = (amp(s, t) * Math.exp(-(dx * dx + dz * dz) / (2 * s.sigma * s.sigma))) / (s.sigma * s.sigma);
    gx -= e * dx; // 압력의 x 기울기
    gz -= e * dz;
  }
  let vx = -k * gx;
  let vz = -k * gz;
  const speed = Math.hypot(vx, vz);
  if (speed > 1e-9) {
    const cap = maxSpeed * Math.tanh(speed / maxSpeed); // 방향은 그대로, 속도만 부드럽게 상한에 가까워진다
    vx *= cap / speed;
    vz *= cap / speed;
  }
  out.x += vx;
  out.z += vz;
}

/**
 * level.windAt 으로 쓰는 함수 만들기. region: 바람이 부는 범위 { xMin, xMax, zMin, zMax, yMin, yMax } (생략하면 어디서나)
 * getTime: 현재 시간(초)을 돌려주는 함수. 방에서는 서버 시계에 맞춘 시간이라 모두 같은 바람을 느낀다.
 */
export function makeWindAt(sources, { getTime = () => 0, region = null, k = 1, maxSpeed = 5 } = {}) {
  return (pos, out) => {
    if (region) {
      const r = region;
      if (pos.x < (r.xMin ?? -Infinity) || pos.x > (r.xMax ?? Infinity)) return;
      if (pos.z < (r.zMin ?? -Infinity) || pos.z > (r.zMax ?? Infinity)) return;
      if (pos.y < (r.yMin ?? -Infinity) || pos.y > (r.yMax ?? Infinity)) return;
    }
    addWindFromPressure(sources, pos.x, pos.z, getTime(), out, { k, maxSpeed });
  };
}

/**
 * 해풍·육풍: 바다(고정 위치)와 육지가 낮밤 주기로 반대 부호의 압력을 갖는다.
 * 낮(주기의 앞 절반)에는 육지가 데워져 저기압, 바다는 상대적으로 고기압 → 바람은 바다에서 육지로 (해풍).
 * 밤(뒤 절반)에는 반대 → 육지에서 바다로 (육풍). period: 낮밤 한 바퀴(초).
 */
export function seaLandBreeze({ sea, land, sigma = 12, strength = 1, period = 24 }) {
  const s = (t) => Math.sin((2 * Math.PI * t) / period);
  return [
    { x: sea.x, z: sea.z, sigma, a: (t) => strength * s(t) },
    { x: land.x, z: land.z, sigma, a: (t) => -strength * s(t) },
  ];
}

/** 낮인가 (해풍이 부는 때) */
export const isDay = (t, period = 24) => ((t % period) + period) % period < period / 2;
