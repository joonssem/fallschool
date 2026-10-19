// 새 맵에서 명시한 표면에만 적용하는 이동 모형. 기존 icy/slippery와 분리한다.
export const SLIDE_SURFACES = Object.freeze({
  glide: Object.freeze({ drag: 1.4, drive: 3.8, steering: 7, maxSpeed: 12 }),
  grip: Object.freeze({ drag: 22, drive: 32, steering: 40, maxSpeed: 7 }),
});

export function stepSlideVelocity(vel, moveX, moveZ, dt, surface) {
  const length = Math.hypot(moveX, moveZ);
  const input = Math.min(1, length);
  const speed = Math.hypot(vel.x, vel.z);
  const keep = speed > 0 ? Math.max(0, speed - surface.drag * dt) / speed : 0;
  vel.x *= keep;
  vel.z *= keep;
  if (input > 0.08) {
    const ux = moveX / length, uz = moveZ / length;
    // 입력 방향에 수직인 속도만 조향으로 줄인다. 정방향 관성은 남긴다.
    const lateral = vel.x * -uz + vel.z * ux;
    const turn = Math.min(Math.abs(lateral), surface.steering * input * dt) * Math.sign(lateral);
    const forward = vel.x * ux + vel.z * uz;
    const drive = surface.drive * Math.min(1, Math.max(0, surface.maxSpeed - forward));
    vel.x += uz * turn + ux * input * drive * dt;
    vel.z += -ux * turn + uz * input * drive * dt;
  }
  const nextSpeed = Math.hypot(vel.x, vel.z);
  // 거친 바닥 진입 시 낮은 상한으로 순간 고정하지 않고 마찰로 감속한다.
  const limit = Math.min(SLIDE_SURFACES.glide.maxSpeed, Math.max(surface.maxSpeed, speed));
  if (nextSpeed > limit) {
    vel.x *= limit / nextSpeed;
    vel.z *= limit / nextSpeed;
  }
}
