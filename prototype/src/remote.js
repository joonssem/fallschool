// 다른 학생 캐릭터: 초당 10회 들어오는 좌표를 보간해 60fps로 그린다.
import * as THREE from 'three';
import { Player } from './player.js';

export const STATES = ['normal', 'dive', 'getup', 'tumble'];
export const stateCode = (player) => STATES.indexOf(player.state) + (player.grounded ? 10 : 0);

const parseColor = (c) => (typeof c === 'string' ? parseInt(c.replace('#', ''), 16) || 0xff7aa8 : 0xff7aa8);
const _prev = new THREE.Vector3();

function nameTag(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.font = 'bold 34px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const w = Math.min(248, g.measureText(text).width + 28);
  g.fillStyle = 'rgba(43, 45, 66, 0.72)';
  g.beginPath();
  g.roundRect((256 - w) / 2, 6, w, 52, 26);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(2.4, 0.6, 1);
  sprite.position.y = 2.35;
  return sprite;
}

export class RemoteCrowd {
  constructor(scene) {
    this.scene = scene;
    this.avatars = new Map();
  }

  get(uid) {
    return this.avatars.get(uid);
  }

  update(dt, room) {
    const seen = new Set();
    if (room) {
      for (const [uid, p] of room.positions) {
        const info = room.players[uid];
        if (!info || !room.presence[uid]) continue;
        seen.add(uid);
        let a = this.avatars.get(uid);
        if (!a) {
          const player = new Player(this.scene, parseColor(info.color));
          const tag = nameTag(info.name || '?');
          player.root.add(tag);
          a = { player, tag, color: info.color, target: new THREE.Vector3(p.x, p.y, p.z), facing: p.f };
          player.pos.copy(a.target);
          this.avatars.set(uid, a);
        }
        if (a.color !== info.color) {
          a.color = info.color;
          a.player.setColor(parseColor(info.color));
        }
        a.target.set(p.x, p.y, p.z);
        a.facing = p.f;
        a.player.state = STATES[p.s % 10] || 'normal';
        a.player.grounded = p.s >= 10;
      }
    }
    for (const [uid, a] of this.avatars) {
      if (!seen.has(uid)) this.remove(uid);
    }

    const k = 1 - Math.exp(-12 * dt);
    for (const a of this.avatars.values()) {
      const pl = a.player;
      _prev.copy(pl.pos);
      if (pl.pos.distanceTo(a.target) > 6) pl.pos.copy(a.target); // 체크포인트 복귀 등 순간이동
      else pl.pos.lerp(a.target, k);
      pl.vel.subVectors(pl.pos, _prev).divideScalar(Math.max(dt, 1e-3));
      let d = a.facing - pl.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      pl.facing += d * k;
      pl.updateVisual(dt);
    }
  }

  remove(uid) {
    const a = this.avatars.get(uid);
    if (!a) return;
    this.scene.remove(a.player.root);
    a.player.root.traverse((o) => {
      o.geometry?.dispose();
      o.material?.map?.dispose();
    });
    this.avatars.delete(uid);
  }
}
