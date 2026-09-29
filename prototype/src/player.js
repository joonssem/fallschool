// 젤리빈형 캐릭터: 이동, 점프, 다이브, 넘어짐(텀블)과 충돌 처리
import * as THREE from 'three';

export const TUNING = {
  maxSpeed: 7,
  groundAccel: 55,
  groundDecel: 45,
  airAccel: 16,
  jumpSpeed: 9.8,
  gravity: 26,
  maxFall: 30,
  diveSpeed: 10,
  diveUp: 5.5,
  bounceSpeed: 17,
  knockSpeed: 7,
  knockUp: 6,
  tumbleTime: 0.8,
  getupTime: 0.3,
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
  slideSpeed: 11,
  radius: 0.45,
};

const SPHERES = [TUNING.radius, 1.25]; // 발 기준 두 구의 중심 높이 (아래, 위)
const GROUND_NORMAL_Y = 0.55;

const _hit = { normal: new THREE.Vector3(), depth: 0 };
const _center = new THREE.Vector3();
const _vp = new THREE.Vector3();
const _vrel = new THREE.Vector3();
const _contact = new THREE.Vector3();
const _extra = new THREE.Vector3();
const _zero = new THREE.Vector3();

export class Player {
  constructor(scene, color = 0xff7aa8) {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0; // y축 회전. 0이면 -Z를 바라본다.
    this.grounded = false;
    this.ground = null;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.state = 'normal'; // normal | dive | getup | tumble
    this.jumpBoost = 1; // 도움 점프 (같은 곳에서 여러 번 떨어진 학생)
    this.stateTimer = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.diveRequested = false;
    this.canDive = true;
    this.bumperCooldown = 0;
    this.airTime = 0;
    this.lastImpact = 0;
    this.events = []; // 'jump' | 'land' | 'dive' | 'bounce' | 'knock'

    this.anim = { phase: 0, squash: 0, squashVel: 0, pitch: 0, spin: 0 };
    this.buildMesh(scene, color);
  }

  buildMesh(scene, color) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = 0.95;
    root.add(body);

    const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
    this.skin = skin;
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.3 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.6, 6, 16), skin);
    trunk.castShadow = true;
    body.add(trunk);

    // 고글형 얼굴
    const visor = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), dark);
    visor.scale.set(0.34, 0.22, 0.14);
    visor.position.set(0, 0.22, -0.34);
    body.add(visor);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), white);
      eye.position.set(sx * 0.13, 0.24, -0.46);
      body.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dark);
      pupil.position.set(sx * 0.13, 0.24, -0.53);
      body.add(pupil);
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin);
      arm.position.set(sx * 0.5, -0.1, 0);
      arm.castShadow = true;
      body.add(arm);
    }

    const legGeo = new THREE.CapsuleGeometry(0.13, 0.12, 4, 8);
    this.legs = [-1, 1].map((sx) => {
      const leg = new THREE.Mesh(legGeo, skin);
      leg.position.set(sx * 0.2, 0.2, 0);
      leg.castShadow = true;
      root.add(leg);
      return leg;
    });

    this.root = root;
    this.body = body;
    scene.add(root);
  }

  setColor(color) {
    this.skin.color.setHex(color);
  }

  respawn(point, facing = 0) {
    this.pos.copy(point);
    this.vel.set(0, 0, 0);
    this.facing = facing;
    this.state = 'normal';
    this.stateTimer = 0;
    this.grounded = false;
    this.ground = null;
    this.jumpBuffer = 0;
    this.diveRequested = false;
    this.anim.pitch = 0;
    this.anim.spin = 0;
  }

  requestJump() {
    this.jumpBuffer = TUNING.jumpBufferTime;
  }

  requestDive() {
    this.diveRequested = true;
  }

  /**
   * @param {number} dt 고정 스텝
   * @param {{x:number,y:number}} move 조이스틱 입력 (y가 앞)
   * @param {number} camYaw 카메라 방위각
   * @param {import('./physics.js').PhysicsWorld} world
   * @param {(pos:THREE.Vector3, out:THREE.Vector3)=>void} windAt
   * @param {(pos:THREE.Vector3)=>number} [gravityAt] 지구 중력 대비 배율 (행성 맵)
   */
  step(dt, move, camYaw, world, windAt, gravityAt) {
    const T = TUNING;

    // 1. 움직이는 발판 위라면 함께 이동
    if (this.ground && this.ground.dynamic && this.ground.enabled) {
      this.pos.applyMatrix4(this.ground.delta);
    }

    // 2. 타이머
    this.coyote = this.grounded ? T.coyoteTime : this.coyote - dt;
    this.jumpBuffer -= dt;
    this.bumperCooldown -= dt;
    this.stateTimer -= dt;
    if (this.state === 'getup' && this.stateTimer <= 0) this.state = 'normal';
    if (this.state === 'tumble' && this.stateTimer <= 0 && this.grounded) this.state = 'normal';

    // 3. 카메라 기준 입력 방향
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    let wx = move.x * cos - move.y * sin;
    let wz = -move.x * sin - move.y * cos;
    const wlen = Math.hypot(wx, wz);
    if (wlen > 1) {
      wx /= wlen;
      wz /= wlen;
    }
    const hasInput = wlen > 0.08;

    // 4. 수평 속도
    let control = 1;
    if (this.state === 'dive') control = 0.12;
    else if (this.state === 'getup') control = 0.35;
    else if (this.state === 'tumble') control = 0;

    if (control > 0) {
      const tx = wx * T.maxSpeed;
      const tz = wz * T.maxSpeed;
      let accel = this.grounded ? (hasInput ? T.groundAccel : T.groundDecel) : T.airAccel;
      if (this.state === 'dive') accel = T.airAccel;
      const dx = tx - this.vel.x;
      const dz = tz - this.vel.z;
      const dlen = Math.hypot(dx, dz);
      const maxStep = accel * control * dt;
      if (dlen <= maxStep || dlen === 0) {
        if (this.state !== 'dive') {
          this.vel.x = tx;
          this.vel.z = tz;
        }
      } else {
        this.vel.x += (dx / dlen) * maxStep;
        this.vel.z += (dz / dlen) * maxStep;
      }
    } else {
      // 넘어진 채 미끄러지는 마찰 (공중에서는 약하게)
      const f = Math.max(0, 1 - (this.grounded ? 6 : 1.5) * dt);
      this.vel.x *= f;
      this.vel.z *= f;
    }

    if (hasInput && (this.state === 'normal' || this.state === 'getup')) {
      const target = Math.atan2(-wx, -wz);
      let diff = target - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const turn = 14 * dt;
      this.facing += THREE.MathUtils.clamp(diff, -turn, turn);
    }

    // 5. 점프
    if (this.jumpBuffer > 0 && this.coyote > 0 && this.state === 'normal') {
      this.vel.y = T.jumpSpeed * this.jumpBoost;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.ground = null;
      this.anim.squashVel = 6;
      this.events.push('jump');
    }

    // 6. 다이브
    if (this.diveRequested) {
      this.diveRequested = false;
      if (this.canDive && this.state === 'normal') {
        const fx = -Math.sin(this.facing);
        const fz = -Math.cos(this.facing);
        const speed = Math.max(T.diveSpeed, Math.hypot(this.vel.x, this.vel.z));
        this.vel.x = fx * speed;
        this.vel.z = fz * speed;
        this.vel.y = this.grounded ? T.diveUp : Math.max(this.vel.y, T.diveUp * 0.55);
        this.state = 'dive';
        this.canDive = false;
        this.grounded = false;
        this.ground = null;
        this.events.push('dive');
      }
    }

    // 7. 중력
    this.gravityScale = gravityAt ? gravityAt(this.pos) : 1;
    this.vel.y = Math.max(this.vel.y - T.gravity * this.gravityScale * dt, -T.maxFall);

    // 8. 외부 이동 (바람, 미끄러운 경사)
    _extra.set(0, 0, 0);
    if (windAt) windAt(this.pos, _extra);
    if (this.grounded && this.ground && this.ground.slippery) {
      _extra.x += this.groundNormal.x * T.slideSpeed;
      _extra.z += this.groundNormal.z * T.slideSpeed;
    }

    this.pos.x += (this.vel.x + _extra.x) * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += (this.vel.z + _extra.z) * dt;

    // 9. 충돌
    const wasGrounded = this.grounded;
    const impactSpeed = -this.vel.y;
    let newGround = null;
    let knocked = false;
    for (let iter = 0; iter < 3; iter++) {
      for (let s = 0; s < SPHERES.length; s++) {
        for (const col of world.colliders) {
          if (!col.enabled) continue;
          _center.set(this.pos.x, this.pos.y + SPHERES[s], this.pos.z);
          if (_center.distanceToSquared(col.center) > (col.radius + T.radius) ** 2) continue;
          if (!col.collideSphere(_center, T.radius, _hit)) continue;

          const n = _hit.normal;
          this.pos.addScaledVector(n, _hit.depth);
          _contact.copy(_center).addScaledVector(n, -T.radius);
          if (col.dynamic) col.pointVelocity(_contact, dt, _vp);
          else _vp.copy(_zero);

          if (col.kind === 'bumper' && this.bumperCooldown <= 0) {
            this.knock(n, _vp);
            knocked = true;
            continue;
          }

          _vrel.copy(this.vel).sub(_vp);
          const vn = _vrel.dot(n);
          if (vn < 0) this.vel.addScaledVector(n, -vn);

          if (s === 0 && n.y > GROUND_NORMAL_Y) {
            newGround = col;
            this.groundNormal.copy(n);
          }
        }
      }
    }

    if (knocked) newGround = null;
    this.grounded = !!newGround;
    this.ground = newGround;

    if (newGround) {
      if (newGround.kind === 'bounce') {
        this.vel.y = newGround.bounceSpeed ?? T.bounceSpeed;
        this.grounded = false;
        this.ground = null;
        this.canDive = true;
        if (this.state === 'dive') this.state = 'normal';
        this.anim.squashVel = 9;
        this.events.push('bounce');
      } else {
        this.canDive = true;
        if (this.state === 'dive') {
          this.state = 'getup';
          this.stateTimer = T.getupTime;
        }
        if (!wasGrounded) {
          this.lastImpact = impactSpeed;
          if (impactSpeed > 4) {
            this.anim.squashVel = -Math.min(impactSpeed, 16) * 0.6;
            this.events.push('land');
          }
        }
      }
      if (newGround.onStand) newGround.onStand(this);
    }

    this.airTime = this.grounded ? 0 : this.airTime + dt;
  }

  knock(n, platformVel) {
    let hx = n.x;
    let hz = n.z;
    let hl = Math.hypot(hx, hz);
    if (hl < 0.2) {
      hx = platformVel.x;
      hz = platformVel.z;
      hl = Math.hypot(hx, hz) || 1;
    }
    this.vel.set(
      (hx / hl) * TUNING.knockSpeed + platformVel.x * 0.25,
      TUNING.knockUp,
      (hz / hl) * TUNING.knockSpeed + platformVel.z * 0.25,
    );
    this.state = 'tumble';
    this.stateTimer = TUNING.tumbleTime;
    this.bumperCooldown = TUNING.tumbleTime;
    this.grounded = false;
    this.ground = null;
    this.events.push('knock');
  }

  updateVisual(dt) {
    const a = this.anim;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;

    // 스쿼시 & 스트레치 (감쇠 스프링)
    a.squashVel += (-a.squash * 180 - a.squashVel * 14) * dt;
    a.squash += a.squashVel * dt;
    const sq = THREE.MathUtils.clamp(a.squash, -0.35, 0.35);
    this.body.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);

    // 자세
    let targetPitch = 0;
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.state === 'dive' || this.state === 'getup') targetPitch = this.state === 'dive' ? -1.35 : -0.9;
    else if (this.grounded) targetPitch = -0.12 * (hspeed / TUNING.maxSpeed);
    a.pitch += (targetPitch - a.pitch) * Math.min(1, 12 * dt);

    if (this.state === 'tumble') a.spin += dt * 14;
    else a.spin += (Math.round(a.spin / (Math.PI * 2)) * Math.PI * 2 - a.spin) * Math.min(1, 10 * dt);

    this.body.rotation.set(a.pitch + a.spin, 0, 0);
    this.body.position.y = 0.95 + (this.state === 'dive' || this.state === 'getup' ? -0.45 : 0);

    // 걷기
    if (this.grounded && hspeed > 0.5 && this.state === 'normal') {
      a.phase += dt * (6 + hspeed * 1.6);
      const bob = Math.abs(Math.sin(a.phase)) * 0.06;
      this.body.position.y += bob;
      this.legs[0].position.z = Math.sin(a.phase) * 0.18;
      this.legs[1].position.z = -Math.sin(a.phase) * 0.18;
      this.legs[0].position.y = this.legs[1].position.y = 0.2;
    } else {
      const tuck = this.grounded ? 0.2 : 0.3;
      for (const leg of this.legs) {
        leg.position.z += (0 - leg.position.z) * Math.min(1, 10 * dt);
        leg.position.y += (tuck - leg.position.y) * Math.min(1, 10 * dt);
      }
    }
    const hideLegs = this.state === 'dive' || this.state === 'getup' || this.state === 'tumble';
    for (const leg of this.legs) leg.visible = !hideLegs;
  }
}
