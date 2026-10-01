// 맵 제작 공용 도구: 발판·안내판·체크포인트와 맵 공통 인터페이스
//
// 모든 맵(build 함수)은 다음을 갖춘 level 객체를 돌려준다.
//   root, spawn, checkpoints, update(t, dt, player), resetProgress(), sectionAt(z),
//   windAt(pos, out), gravityAt(pos), setSeed(seed), triggerTile(i), revealPath(), sky
//   콜백: onCheckpoint(cp), onFinish(), onTileTriggered(i), onMessage(text, ok)
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
    onMessage: null, // (text, ok) 예측 문 안내
    onStar: null, // (모은 수, 전체 수) 도전 별
    gates: [],
    stars: [],
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
  const { root, world, checkpoints, gates, stars } = level;
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

  // 예측 문: 벽에 커튼 문 3개, 질문에 맞는 문 뒤에만 바닥이 있다 (틀린 문 뒤는 떨어진다)
  // z = 벽 앞면, y = 바닥 높이. 벽 1 + 통로 4 + 나오는 발판 2 → z - GATE_DEPTH 에서 다음 발판으로 이어진다.
  // 나오는 발판은 폭 전체라서 옆 문이 정답이어도 가운데 길로 이어진다.
  // 조작 실력으로 돌아갈 수 없게 벽을 높고 넓게, 통로 위는 지붕으로 막는다 (달 중력 점프로도 못 넘는다).
  // 어느 문이 정답인지는 경기 시드로 섞는다 (같은 방이면 모두 같은 배치).
  // name: 교사 화면 요약에 쓰는 짧은 이름 (예: '달')
  function choiceGate({ z, y, name, question, hint, options, right, wrong, color = '#6a4c93' }) {
    const DOOR = 3;
    const DOOR_H = 2.4; // 캐릭터 키 1.7. 낮을수록 문 위 질문이 눈높이에 가깝다
    const PILLAR = 1.2;
    const H = 10;
    const wallColor = 0x3d405b;
    const doorX = [-(DOOR + PILLAR), 0, DOOR + PILLAR];
    const inner = (3 * DOOR + 4 * PILLAR) / 2; // 6.9
    const zl = z - 1 - GATE_LANE / 2; // 통로 가운데
    const zEnd = z - 1 - GATE_LANE; // 통로 끝 = 나오는 발판 시작

    // 문턱(벽 두께만큼의 바닥)과 기둥·문 위 벽·양옆 날개
    platform(0, y, z - 0.5, inner * 2, 1, 0x9aa0b5);
    for (const px of [-inner + PILLAR / 2, -DOOR / 2 - PILLAR / 2, DOOR / 2 + PILLAR / 2, inner - PILLAR / 2]) {
      block(px, y + H, z - 0.5, PILLAR, H + 6, 1, wallColor, { castShadow: true });
      block(px, y + H, zl, PILLAR, H + 6, GATE_LANE, wallColor); // 통로 칸막이 (아래로도 길게)
    }
    block(0, y + H, z - 0.5, inner * 2, H - DOOR_H, 1, wallColor, { castShadow: true });
    for (const sx of [-1, 1]) block(sx * (inner + 5.5), y + H, z - 0.5, 11, H + 2, 1, wallColor, { castShadow: true });
    block(0, y + H + 0.4, zl, inner * 2, 0.4, GATE_LANE, wallColor); // 지붕: 위에서 들여다보거나 넘어가지 못하게
    platform(0, y, zEnd - (GATE_DEPTH - 1 - GATE_LANE) / 2, inner * 2, GATE_DEPTH - 1 - GATE_LANE, 0x9aa0b5);

    // 힌트는 한 줄(문자열) 또는 여러 줄(배열). 안내판 아래 끝을 문 이름표 바로 위에 맞춘다.
    const lines = [question, ...[].concat(hint)];
    sign(question, 0, y + DOOR_H + 0.95 + ((9 / 4) * lines.length) / 2, z + 0.03, { width: 9, color, lines });

    const curtainColors = [0xff5d8f, 0xffd166, 0x4cc9f0];
    const lanes = doorX.map((x, i) => {
      const curtain = new THREE.Mesh(
        new THREE.PlaneGeometry(DOOR, DOOR_H),
        new THREE.MeshStandardMaterial({ color: curtainColors[i], roughness: 0.9, side: THREE.DoubleSide }),
      );
      curtain.position.set(x, y + DOOR_H / 2, z + 0.02);
      root.add(curtain);
      const floor = platform(x, y, zl, DOOR, GATE_LANE, 0x9aa0b5);
      // 틀린 문 통로 끝을 막는 벽 (떨어지는 중에 나오는 발판으로 건너가지 못하게)
      const back = block(x, y + H, zEnd + 0.2, DOOR, H + 6, 0.4, wallColor);
      // 문 위 이름표: 보기 3개를 문마다 만들어 두고 배치에 맞는 것만 보인다
      const labels = options.map((o) => sign(o.text, x, y + DOOR_H + 0.55, z + 0.03, { width: 3.4, color: '#2b2d42' }));
      return { x, floor, back, labels };
    });

    // wrong 은 문자열 하나, 또는 단계별 배열 (첫 오답엔 생각할 거리, 다시 틀리면 정답 설명)
    const gate = { z, y, name: name || `문 ${gates.length + 1}`, question, lanes, options, right, wrong: [].concat(wrong), tries: 0, order: [0, 1, 2], answered: false };
    gates.push(gate);
    return gate;
  }

  // 도전 별: 길에서 벗어난 작은 섬 위의 별. 보통 점프로는 안 닿고 점프 + 다이브로 닿는 거리에 둔다.
  // 순위·완주와 상관없는 개인 도전 (잘하는 학생용). 모은 별은 떨어져도 그대로다.
  const starGeo = new THREE.OctahedronGeometry(0.7);
  function challengeStar(x, y, z) {
    platform(x, y, z, 3, 3, 0xffe066);
    const mesh = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color: 0xffd60a, emissive: 0xffb703, emissiveIntensity: 0.8 }));
    mesh.position.set(x, y + 1.4, z);
    mesh.castShadow = true;
    root.add(mesh);
    stars.push({ mesh, got: false });
  }

  // 시소: 긴 판이 긴 축을 중심으로 옆으로 기운다. 올라탄 **모든 학생**의 무게로 기울기를 정한다.
  // 기울기 목표 = -(각 학생이 가운데에서 떨어진 거리의 합) × k. 혼자면 soloMax까지, 둘 이상이면 crowdMax까지 기운다 (양쪽에 나눠 서면 합이 작아 수평)
  // → 한쪽에 여럿이 몰리면 확 기울어 미끄러진다. 다른 학생 위치는 화면마다 같은 값(마지막 받은 위치)으로 계산한다.
  // slope: 판 전체의 앞뒤 경사(라디안, +면 -z 쪽이 높다)
  // crowdMax 0.95(약 54°): 미끄러지는 힘(약 초속 9m)이 걷는 힘(초속 7m)보다 커서 버틸 수 없다. 혼자일 때(soloMax)는 버틸 수 있다
  function seesaw({ x = 0, y, z, width, length, color, slope = 0, k = 0.14, soloMax = 0.38, crowdMax = 0.95 }) {
    const base = new THREE.Group();
    base.position.set(x, y, z);
    base.rotation.x = slope;
    root.add(base);
    const pivot = new THREE.Group();
    base.add(pivot);
    const plank = block(0, 0, 0, width, 0.6, length, color, { parent: pivot, dynamic: true, slippery: true, castShadow: true });
    const col = plank.userData.collider;
    const loc = new THREE.Vector3();
    let angle = 0;
    level.movers.push({
      root: base,
      update(t, dt, player) {
        let torque = 0;
        let n = 0;
        if (player && player.ground === col) {
          pivot.worldToLocal(loc.copy(player.pos));
          torque += loc.x;
          n++;
        }
        for (const o of level.getOthers?.() || []) {
          pivot.worldToLocal(loc.copy(o));
          if (Math.abs(loc.x) < width / 2 + 0.3 && Math.abs(loc.z) < length / 2 && loc.y > -0.4 && loc.y < 2) {
            torque += loc.x;
            n++;
          }
        }
        const max = n >= 2 ? crowdMax : soloMax;
        const target = THREE.MathUtils.clamp(-torque * k, -max, max);
        const rate = n ? 0.4 + 0.35 * Math.min(n, 4) : 0.35; // 많이 올라탈수록 빨리 기운다
        angle += THREE.MathUtils.clamp(target - angle, -rate * dt, rate * dt);
        pivot.rotation.z = angle;
      },
    });
    return plank;
  }

  // 갈림길 입구 (산과 염기·전기 회로 맵 공용): 출발 발판 끝(z0, 높이 0)에서 첫 체크포인트(z1, 높이 y1)까지
  //   가운데: 외나무 시소 지름길 — 폭 1.2m, 곧게 가지만 무게로 기울어 여럿이 한꺼번에 오르면 뒤집힌다
  //   옆(side = -1 왼쪽, 1 오른쪽): 넓은 계단으로 돌아가는 길 — 안전하지만 더 오래 걸린다 (시뮬레이션 측정값은 README)
  // 도전 별 섬과 반대쪽에 둔다 (돌아가는 길에서 보통 점프로 별에 닿지 않게)
  function forkEntry({ z0 = -8, z1 = -23, y1 = 1.5, side, color, color2 }) {
    const len = Math.hypot(z0 - z1, y1);
    seesaw({ y: y1 / 2, z: (z0 + z1) / 2, width: 1.2, length: len, color, slope: Math.atan2(y1, z0 - z1), k: 0.8, soloMax: 0.3 }); // 폭이 좁아 가운데에서 떨어진 거리가 작으므로 민감하게
    // 지그재그 계단 세 개 (바깥으로 나갔다가 돌아온다): 틈은 모두 1m 안팎, 보통 점프로 충분
    platform(side * 11, y1 / 3, z0 - 3.5, 4, 5, color2);
    platform(side * 16, y1 / 2, z0 - 7.5, 4, 4, color2);
    platform(side * 11, (y1 * 2) / 3, z0 - 11.5, 4, 4, color2);
    sign('외나무 다리: 빠르지만 여럿이 오르면 기울어요', 0, y1 + 5.5, z1 + 0.6, { width: 9, color: '#e76f51' });
  }

  return { mat, block, platform, ramp, sign, startCheckpoint, checkpoint, finishPad, choiceGate, challengeStar, seesaw, forkEntry };
}

export const GATE_DEPTH = 7;
const _starProbe = new THREE.Vector3();
const GATE_LANE = 4;

// 시드로 예측 문의 정답 위치를 섞는다
export function shuffleGates(level, seed) {
  level.gates.forEach((gate, gi) => {
    const rand = mulberry32((seed ^ (gi + 1) * 0x9e3779b9) >>> 0);
    const order = [0, 1, 2];
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    gate.order = order; // order[문 번호] = 보기 번호
    gate.answered = false;
    gate.tries = 0;
    gate.lanes.forEach((lane, li) => {
      const ok = gate.options[order[li]].correct;
      lane.floor.visible = ok;
      lane.floor.userData.collider.enabled = ok;
      lane.back.visible = !ok;
      lane.back.userData.collider.enabled = !ok;
      lane.labels.forEach((m, oi) => (m.visible = oi === order[li]));
    });
  });
}

// 문을 지나 통로로 들어서면 한 번 안내한다. 문 앞으로 돌아오면(다시 시도) 초기화.
function checkGates(level, player) {
  level.gates.forEach((gate, gi) => {
    const p = player.pos;
    if (p.z > gate.z) {
      gate.answered = false;
      return;
    }
    if (gate.answered || p.z > gate.z - 1.2 || p.z < gate.z - 1 - GATE_LANE || Math.abs(p.x) > 7) return;
    gate.answered = true;
    const li = gate.lanes.reduce((best, l, i) => (Math.abs(l.x - p.x) < Math.abs(gate.lanes[best].x - p.x) ? i : best), 0);
    const ok = gate.options[gate.order[li]].correct;
    if (!ok) gate.tries++;
    level.onMessage?.(ok ? gate.right : gate.wrong[Math.min(gate.tries, gate.wrong.length) - 1], ok);
    level.onGateResult?.(gi, ok);
  });
}

// 공통 마무리: 매 스텝 갱신, 진행 초기화, 충돌체 동기화
export function finalizeLevel(level) {
  const { world, movers, checkpoints, root } = level;
  level.update = (t, dt, player) => {
    for (const m of movers) {
      m.update(t, dt, player);
      if (m.root) m.root.updateMatrixWorld(true);
    }
    if (player && level.gates.length) checkGates(level, player);
    for (const s of level.stars) {
      if (s.got) continue;
      s.mesh.rotation.y = t * 2;
      if (player && s.mesh.position.distanceTo(_starProbe.copy(player.pos).setY(player.pos.y + 0.9)) < 1.4) {
        s.got = true;
        s.mesh.visible = false;
        level.onStar?.(level.stars.filter((x) => x.got).length, level.stars.length);
      }
    }
    world.syncDynamic();
  };
  level.resetProgress = () => {
    level.finished = false;
    for (const g of level.gates) g.tries = 0;
    for (const s of level.stars) {
      s.got = false;
      s.mesh.visible = true;
    }
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
