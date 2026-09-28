// 파일 없이 WebAudio로 만드는 짧은 효과음
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // iOS는 사용자 터치 안에서 오디오를 열어야 한다.
  unlock() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.ctx.resume?.();
  }

  tone(freq, endFreq, dur, type = 'sine', gain = 0.18, delay = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump':
        this.tone(320, 640, 0.12, 'square', 0.06);
        break;
      case 'dive':
        this.tone(500, 200, 0.18, 'triangle', 0.12);
        break;
      case 'land':
        this.tone(140, 70, 0.1, 'sine', 0.2);
        break;
      case 'bounce':
        this.tone(200, 900, 0.3, 'sine', 0.18);
        break;
      case 'knock':
        this.tone(180, 60, 0.25, 'sawtooth', 0.12);
        this.tone(900, 400, 0.12, 'square', 0.05);
        break;
      case 'fall':
        this.tone(700, 120, 0.5, 'triangle', 0.12);
        break;
      case 'checkpoint':
        [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.14, 'triangle', 0.12, i * 0.09));
        break;
      case 'finish':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.25, 'triangle', 0.14, i * 0.12));
        break;
    }
  }
}
