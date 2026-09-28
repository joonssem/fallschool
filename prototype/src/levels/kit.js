// 맵 제작 공용 도구: 발판·안내판·체크포인트와 맵 공통 인터페이스
//
// 모든 맵(build 함수)은 다음을 갖춘 level 객체를 돌려준다.
//   root, spawn, checkpoints, update(t, dt, player), resetProgress(), sectionAt(z),
//   windAt(pos, out), gravityAt(pos), setSeed(seed), triggerTile(i), revealPath(), sky
//   콜백: onCheckpoint(cp), onFinish(), onTileTriggered(i)
import * as THREE from 'three';
import { BoxCollider } from '../physics.js';

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 구간 표: [{ name, zMax }] — z가 zMax보다 작아지면 그 구간
export function sectionFinder(sections) {
  return (z) => {
    let name = sections[0].name;
    for (const s of sections) if (z < s.zMax) name = s.name;
    return name;
  };
}

export function createLevel(parent, world, extra = {}) {
  const root = new THREE.Group();
  parent.add(root);
  return {
    root,
    world,
    spawn: new THREE.Vector3(0, 0, 5),
    checkpoints: [],
    movers: [],
    finished: false,
    seed: 0,
    sky: { background: 0xbfe6ff, fog: [0xbfe6ff, 60, 170] },
    onCheckpoint: null,
    onFinish: null,
    onTileTriggered: null,
    windAt: () => {},
    gravityAt: () => 1,
    setSeed(s) {
      this.seed = s;
    },
    triggerTile: () => {},
    revealPath: () => {},
    ...extra,
  };
}

export function makeKit(level) {
  const { root, world, checkpoints } = level;
  const matCache = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra }));
    return matCache.get(key);
  };

  // 박스 하나 = 메시 + 충돌체. 위치는 윗면 기준.
  function block(x, topY, z, sx, sy, sz, color, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), opts.material || mat(color));
    mesh.position.set(x, topY - sy / 2, z);
    mesh.castShadow = !!opts.castShadow;
    mesh.receiveShadow = true;
    (opts.parent || root).add(mesh);
    const col = world.add(new BoxCollider(mesh, new THREE.Vector3(sx / 2, sy / 2, sz / 2), opts));
    mesh.userData.collider = col;
    return mesh;
  }
  const platform = (x, topY, z, sx, sz, color, opts = {}) => block(x, topY, z, sx, opts.thick ?? 1, sz, color, opts);

  // 경사로: (z0, y0)에서 (z1, y1)까지 오르는 판
  function ramp(x, z0, y0, z1, y1, width, color) {
    const run = z0 - z1;
    const rise = y1 - y0;
    const theta = Math.atan2(rise, run);
    const len = Math.hypot(rise, run);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1, len), mat(color));
    mesh.rotation.x = theta;
    mesh.position.set(x, (y0 + y1) / 2 - 0.5 * Math.cos(theta), (z0 + z1) / 2 - 0.5 * Math.sin(theta));
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.userData.collider = world.add(new BoxCollider(mesh, new THREE.Vector3(width / 2, 0.5, len / 2)));
    return mesh;
  }

  function sign(text, x, y, z, { width = 6, color = '#6a4c93', rotY = 0, lines = null } = {}) {
    const rows = lines || [text];
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128 * rows.length;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(4, 4, 504, canvas.height - 8, 40);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const font = (px) => `bold ${px}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    rows.forEach((row, i) => {
      let size = i === 0 ? 64 : 44;
      g.font = font(size);
      while (size > 20 && g.measureText(row).width > 460) g.font = font((size -= 4));
      g.fillStyle = i === 0 ? color : '#2b2d42';
      g.fillText(row, 256, 68 + i * 128);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(width, (width / 4) * rows.length),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    root.add(m);
    return m;
  }

  function startCheckpoint(name = '출발') {
    checkpoints.push({ index: 0, name, respawn: level.spawn.clone(), reached: true });
  }

  function checkpoint(mesh, respawn, name) {
    const index = checkpoints.length;
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 8), mat(0xffffff));
    const top = mesh.position.y + mesh.geometry.parameters.height / 2;
    flagPole.position.set(mesh.position.x + mesh.geometry.parameters.width / 2 - 0.8, top + 1.5, respawn.z);
    root.add(flagPole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    flag.position.set(flagPole.position.x - 0.65, top + 2.6, respawn.z);
    root.add(flag);
    const cp = { index, name, respawn: respawn.clone(), flag, reached: false };
    checkpoints.push(cp);
    mesh.userData.collider.onStand = () => {
      if (cp.reached) return;
      cp.reached = true;
      flag.material.color.setHex(0x2ec4b6);
      level.onCheckpoint?.(cp);
    };
    return cp;
  }

  // 골인 발판: 선(zLine)을 넘어 올라서면 완주
  function finishPad(mesh, zLine) {
    mesh.userData.collider.onStand = (player) => {
      if (level.finished || player.pos.z > zLine) return;
      level.finished = true;
      level.onFinish?.();
    };
  }

  return { mat, block, platform, ramp, sign, startCheckpoint, checkpoint, finishPad };
}

// 공통 마무리: 매 스텝 갱신, 진행 초기화, 충돌체 동기화
export function finalizeLevel(level) {
  const { world, movers, checkpoints, root } = level;
  level.update = (t, dt, player) => {
    for (const m of movers) {
      m.update(t, dt, player);
      if (m.root) m.root.updateMatrixWorld(true);
    }
    world.syncDynamic();
  };
  level.resetProgress = () => {
    level.finished = false;
    for (const cp of checkpoints) {
      cp.reached = cp.index === 0;
      cp.flag?.material.color.setHex(cp.reached ? 0x2ec4b6 : 0xcccccc);
    }
  };
  level.dispose = () => {
    root.parent?.remove(root);
    root.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        m.map?.dispose();
        m.dispose();
      }
    });
    world.colliders.length = 0;
  };
  root.updateMatrixWorld(true);
  for (const c of world.colliders) c.sync(true);
  return level;
}
