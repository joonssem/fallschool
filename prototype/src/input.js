// 터치(가상 조이스틱 + 카메라 드래그 + 버튼)와 키보드·마우스 입력
const STICK_RADIUS = 60;

export class Input {
  constructor({ surface, stickBase, stickKnob, jumpBtn, diveBtn }) {
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 }; // 누적 드래그 픽셀, 프레임마다 소비
    this.onJump = null;
    this.onDive = null;
    this.enabled = true;

    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookPointers = new Map();
    this.keys = new Set();
    this.stickBase = stickBase;
    this.stickKnob = stickKnob;

    surface.addEventListener('pointerdown', (e) => this.pointerDown(e));
    surface.addEventListener('pointermove', (e) => this.pointerMove(e));
    surface.addEventListener('pointerup', (e) => this.pointerUp(e));
    surface.addEventListener('pointercancel', (e) => this.pointerUp(e));

    this.bindButton(jumpBtn, () => this.onJump?.());
    this.bindButton(diveBtn, () => this.onDive?.());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (!this.enabled) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.onJump?.();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE' || e.code === 'KeyJ') this.onDive?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // iPad Safari 기본 제스처 막기
    for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) {
      document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    }
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  bindButton(el, fn) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('active');
      if (this.enabled) fn();
    });
    const up = (e) => {
      e.stopPropagation();
      el.classList.remove('active');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  pointerDown(e) {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    const isTouch = e.pointerType !== 'mouse';
    if (isTouch && this.stick.id === null && e.clientX < window.innerWidth * 0.45) {
      Object.assign(this.stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickBase.classList.add('active');
      this.updateKnob();
      return;
    }
    this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  pointerMove(e) {
    if (e.pointerId === this.stick.id) {
      let dx = e.clientX - this.stick.ox;
      let dy = e.clientY - this.stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      this.stick.x = dx / STICK_RADIUS;
      this.stick.y = -dy / STICK_RADIUS;
      this.updateKnob();
      return;
    }
    const p = this.lookPointers.get(e.pointerId);
    if (p) {
      this.look.x += e.clientX - p.x;
      this.look.y += e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
    }
  }

  pointerUp(e) {
    if (e.pointerId === this.stick.id) {
      Object.assign(this.stick, { id: null, x: 0, y: 0 });
      this.stickBase.classList.remove('active');
      this.stickBase.style.left = '';
      this.stickBase.style.top = '';
      this.updateKnob();
    }
    this.lookPointers.delete(e.pointerId);
  }

  updateKnob() {
    const r = STICK_RADIUS;
    this.stickKnob.style.transform = `translate(${this.stick.x * r}px, ${-this.stick.y * r}px)`;
  }

  // 프레임마다 호출: 이동 입력 계산
  poll() {
    let x = this.stick.x;
    let y = this.stick.y;
    // 조이스틱 가운데 작은 영역은 무시
    const len = Math.hypot(x, y);
    if (len < 0.12) {
      x = 0;
      y = 0;
    }
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      x = kx / l;
      y = ky / l;
    }
    if (!this.enabled) {
      x = 0;
      y = 0;
    }
    this.move.x = x;
    this.move.y = y;
  }

  consumeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = 0;
    this.look.y = 0;
    return l;
  }
}
