// 매 판 다른 문제: 시드로 목표를 고르는 도구와, 목표가 바뀌어도 맞는 글을 보여 주는 바뀌는 안내판.
// 시드는 방의 모든 학생이 같으므로(새 경기마다 바뀜) 같은 판에서는 같은 문제, 다음 판에서는 다른 문제가 나올 수 있다(보장은 아래 주의).
// (퍼즐 상태는 학생별이라 목표를 바꿔도 다른 화면과 모순이 생기지 않는다. 학생마다 다르게 하는 것은 하지 않았다.)
// 주의: 시드는 "후보 안에서 고르는" 값이라 **다음 판에도 같은 문제가 나올 수 있다**(후보가 적을수록 쉽다).
// 이전 판을 피하는 장치는 일부러 만들지 않았다: 화면마다 이전 판을 기억하는 정도가 달라 같은 방의 학생이 서로 다른 문제를 볼 수 있다.
// 보기 순서만 바뀌는 것은 새로운 문제로 세지 않는다.
import * as THREE from 'three';
import { mulberry32 } from './kit.js';

/** 시드와 이름표(salt)에서 0 이상 1 미만의 난수 생성기 */
export function rngFor(seed, salt) {
  return mulberry32(((seed | 0) ^ (Math.imul(salt + 1, 0x9e3779b1) | 0)) >>> 0);
}

/** 목록에서 하나 고르기 */
export const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];

/** 목록을 섞은 새 목록 (Fisher-Yates) */
export function shuffled(rand, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 글이 바뀌는 안내판 (kit.sign과 같은 모양). set(lines, color) 로 다시 그린다. 같은 글이면 다시 그리지 않는다.
 * rows: 줄 수(안내판 높이를 정한다)
 */
export function dynamicSign(root, { x, y, z, width = 6, rows = 1, rotY = 0, color = '#6a4c93' }) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128 * rows;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, (width / 4) * rows), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  root.add(mesh);
  const font = (px) => `bold ${px}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  let shown = '';
  return {
    mesh,
    get text() { return shown; },
    set(lines, titleColor = color) {
      const list = [].concat(lines);
      const key = `${list.join('|')}|${titleColor}`;
      if (key === shown) return;
      shown = key;
      g.clearRect(0, 0, 512, 128 * rows);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.roundRect(4, 4, 504, 128 * rows - 8, 40);
      g.fill();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      list.slice(0, rows).forEach((row, i) => {
        let size = i === 0 ? 64 : 44;
        g.font = font(size);
        while (size > 20 && g.measureText(row).width > 460) g.font = font((size -= 4));
        g.fillStyle = i === 0 ? titleColor : '#2b2d42';
        g.fillText(row, 256, 68 + i * 128);
      });
      tex.needsUpdate = true;
    },
  };
}
