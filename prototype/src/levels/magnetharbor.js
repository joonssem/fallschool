// 자석 항구: 자석으로 화물과 보트의 위치를 바꾸면 실제로 건널 길이 생긴다.
// 화물은 철, 보트는 자석이 붙은 게임 모형이다. 자유 물리 대신 짧은 레일 이동을 쓴다.
// 구간: 철 화물 길 → 자석 보트 길 → (2026-10-05 연장) 철 찾기 크레인 → 자석 나룻배(끌기) → 자석 섬 → 자석 나룻배(밀기) → 도착
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { rngFor, shuffled } from './variants.js';

// 철 찾기 크레인: 자석에 붙는 물건(철)과 붙지 않는 물건. 알루미늄·구리는 금속이지만 붙지 않는다.
export const CRANE_ITEMS = {
  iron: [{ name: '철 못 상자', color: 0x7d8790 }, { name: '철 클립 상자', color: 0x8d969e }, { name: '철 캔', color: 0x6f7a84 }, { name: '철 나사 상자', color: 0x828c95 }],
  other: [{ name: '알루미늄 캔', color: 0xd9dee3 }, { name: '구리 동전 상자', color: 0xc8733f }, { name: '나무 상자', color: 0xa0703f }, { name: '플라스틱 통', color: 0x5fb3d9 }],
};
export const CRANE_SLOTS = [-84, -88.3, -92.6, -96.9]; // 징검다리 자리 (z). 발판 3.4m, 틈 약 0.9m (터치에서도 낙하가 잦지 않게 넓게)
/** 시드별 크레인 배치: 발판 6개에 철 4개 + 붙지 않는 물건 2개 */
export function craneLayout(seed) {
  const rand = rngFor(seed, 61);
  const others = shuffled(rand, CRANE_ITEMS.other).slice(0, 2);
  return shuffled(rand, [...CRANE_ITEMS.iron.map((it) => ({ ...it, iron: true })), ...others.map((it) => ({ ...it, iron: false }))]);
}
/** 시드별 섬 자석의 극: 앞면(첫 나룻배가 다가가는 쪽)과 뒷면(둘째 나룻배가 떠나는 쪽) */
export function islandPoles(seed) {
  const rand = rngFor(seed, 62);
  return { front: rand() < 0.5 ? 'N' : 'S', back: rand() < 0.5 ? 'N' : 'S' };
}
/** 나룻배 자석 끝(독 자석을 마주 보는 끝)의 극이 정해졌을 때 배가 가는 곳: 다른 극은 끌림, 같은 극은 밀림 */
export function ferryTarget(boatPole, dockPole, magnetAhead) {
  if (!boatPole) return 'home';
  const attract = boatPole !== dockPole;
  return attract === magnetAhead ? 'far' : 'home'; // 자석이 앞이면 끌려야, 뒤면 밀려야 나아간다
}

export const HARBOR_ROUTES = {
  iron: [
    { id: 'challenge', x: -5, width: 3.6, label: '좁은 철 화물 · 별' },
    { id: 'steady', x: 5, width: 5.6, label: '넓은 철 화물' },
  ],
  boat: [
    { id: 'attract', x: -4.5, width: 5.6, label: '다른 극 · 넓은 길' },
    { id: 'repel', x: 4.5, width: 3.6, label: '같은 극 · 별 길' },
  ],
};

export function buildMagnetHarbor(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '자석 항구 출발', zMax: Infinity },
      { name: '철 화물 길', zMax: -18 },
      { name: '자석 보트 길', zMax: -48 },
      { name: '철 찾기 크레인', zMax: -66 },
      { name: '자석 나룻배 (끌기)', zMax: -100 },
      { name: '자석 섬', zMax: -131 },
      { name: '자석 나룻배 (밀기)', zMax: -145 },
      { name: '항구 도착', zMax: -163 },
    ]),
    sky: { background: 0xb9e4ed, fog: [0xb9e4ed, 75, 170], hemi: 1.6 },
  });
  const { root, movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad } = makeKit(level);
  const state = level.harbor = { iron: null, boat: null };
  const routes = { iron: [], boat: [] };

  level.spawn.set(0, 1, 4);
  platform(0, 1, -6, 20, 24, 0xd9c6a1);
  startCheckpoint('항구 출발');
  sign('자석 항구', -7, 4.4, 0, { width: 4.5, color: '#634a80', rotY: 0.2 });
  sign('철 화물만 움직여요', 7, 4.7, -7, { width: 4.5, lines: ['철 화물만 움직여요', '모든 금속이 붙지는 않아요'], rotY: -0.2 });
  // 청동색 장식 화물은 자석으로 움직이는 길이 아니다.
  block(-9, 2.3, -23, 2, 1.3, 3, 0xb68a5c, { castShadow: true });
  block(9, 2.3, -23, 2, 1.3, 3, 0xb68a5c, { castShadow: true });
  platform(0, 1, -40, 20, 16, 0xd9c6a1);
  checkpoint(platform(0, 1.03, -36, 7, 5, 0xa6d9a2), new THREE.Vector3(0, 1, -36), '자석 보트 앞');

  function movingBridge(group, spec, z, length, color) {
    const mesh = platform(spec.x < 0 ? -24 : 24, 1, z, spec.width, length, color, { dynamic: true, castShadow: true });
    mesh.userData.collider.enabled = false;
    // 레일 화물의 갑판과 자석 표식. 둘 다 장식이며 충돌 판정에는 관여하지 않는다.
    for (const offset of [-length / 3, 0, length / 3]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.45, 0.05, 0.36), mat(group === 'iron' ? 0xe0e6e8 : 0xf8e3a8));
      stripe.position.set(0, 0.53, offset);
      mesh.add(stripe);
    }
    const marker = new THREE.Group();
    marker.position.set(spec.x < 0 ? -spec.width / 2 - 0.7 : spec.width / 2 + 0.7, 2.7, 0);
    for (const [side, poleColor] of [[-1, 0xe85d5d], [1, 0x527cd1]]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.25, 0.55), mat(poleColor));
      pole.position.set(side * 0.42, -0.45, 0);
      marker.add(pole);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.38, 0.55), mat(0x48546c));
    back.position.y = 0.35;
    marker.add(back);
    mesh.add(marker);
    const entry = { ...spec, mesh, targetX: spec.x, active: false };
    routes[group].push(entry);
    movers.push({ root: mesh, update(_t, dt) {
      const wanted = entry.active ? entry.targetX : (entry.x < 0 ? -24 : 24);
      const dx = wanted - mesh.position.x;
      mesh.position.x += Math.sign(dx) * Math.min(Math.abs(dx), 18 * dt);
      mesh.userData.collider.enabled = entry.active && Math.abs(mesh.position.x - wanted) < 0.03;
    } });
    return entry;
  }

  function star(x, z) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.8 }));
    mesh.position.set(x, 3.25, z); root.add(mesh);
    level.stars.push({ mesh, got: false });
  }

  for (const spec of HARBOR_ROUTES.iron) {
    const control = platform(spec.x, 1.13, -12, 3.4, 3.4, spec.id === 'challenge' ? 0xf3b45a : 0x76c7cd);
    sign(spec.label, spec.x, 4.7, -15, { width: 5.5 });
    control.userData.collider.onStand = () => state.choose('iron', spec.id);
    movingBridge('iron', spec, -25, 15, spec.id === 'challenge' ? 0xe4a36c : 0x7ea5b7);
  }
  star(-5, -25);

  sign('보트에는 자석이 붙어 있어요', -7, 4.7, -39, { width: 4.5, lines: ['보트에는 자석이 있어요', '다른 극은 끌고 같은 극은 밀어요'], rotY: 0.2 });
  platform(0, 1, -73, 20, 18, 0xd9c6a1);
  for (const spec of HARBOR_ROUTES.boat) {
    const control = platform(spec.x, 1.13, -43, 3.4, 3.4, spec.id === 'repel' ? 0xf3b45a : 0x76c7cd);
    sign(spec.label, spec.x, 4.7, -46, { width: 5.5 });
    control.userData.collider.onStand = () => state.choose('boat', spec.id);
    movingBridge('boat', spec, -56, 16.4, spec.id === 'repel' ? 0xea9765 : 0x72b4c3);
  }
  star(4.5, -56);

  // ─── 철 찾기 크레인 (부두 -64 ~ -82) ───────────────────────
  // 발판을 밟으면 크레인 자석이 옆 물건을 들어 올리려 한다. 철이면 날아가 다음 징검다리 자리에 놓이고,
  // 철이 아니면 흔들리기만 한다(떨어지거나 막히지 않는다). 징검다리 4개가 놓이면 다음 부두까지 뛰어 건넌다.
  checkpoint(platform(0, 1.03, -68, 7, 4, 0xa6d9a2), new THREE.Vector3(0, 1, -68), '철 찾기 크레인');
  sign('철 찾기 크레인', 0, 6.2, -80.5, { width: 7, lines: ['철 찾기 크레인', '자석에 붙는 물건만 징검다리가 돼요', '금속이라고 다 붙지는 않아요'] });
  const crane = { pads: [], placed: 0, wrong: 0, layout: null };
  level.crane = crane;
  const padSpots = [[-6.5, -69], [-6.5, -73.5], [-6.5, -78], [6.5, -69], [6.5, -73.5], [6.5, -78]];
  padSpots.forEach(([x, z], i) => {
    const side = Math.sign(x);
    const pad = platform(x, 1.12, z, 2.4, 2.4, 0xf3d17a);
    pad.material = pad.material.clone();
    platform(x + side * 2.6, 1.4, z, 1.8, 1.8, 0x9aa5ad); // 받침대
    const item = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.3), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 }));
    root.add(item);
    const label = sign('물건', x + side * 2.6, 3.6, z, { width: 3.2, color: '#2b2d42' });
    const home = new THREE.Vector3(x + side * 2.6, 1.95, z);
    crane.pads.push({ x, z, pad, item, label, home, spec: null, used: false, occupied: false, flight: null, shake: 0 });
  });
  // 징검다리 자리: 철 물건이 날아오면 밟을 수 있는 발판이 켜진다
  const stones = CRANE_SLOTS.map((z) => {
    const mesh = platform(0, 1, z, 3.4, 3.4, 0x7d8790, { castShadow: true });
    mesh.visible = false; mesh.userData.collider.enabled = false;
    return mesh;
  });
  crane.stones = stones;
  const craneStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.8 }));
  const CRANE_STAR_AT = new THREE.Vector3(7, 2.6, -104), HIDDEN = new THREE.Vector3(0, -200, 0);
  craneStar.position.copy(HIDDEN); root.add(craneStar);
  crane.star = { mesh: craneStar, got: false };
  level.stars.push(crane.star);
  function paintLabel(mesh, text) { // 물건 이름표 다시 그리기
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#2b2d42'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 54px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'; g.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    mesh.material.map?.dispose(); mesh.material.map = tex; mesh.material.needsUpdate = true;
  }
  crane.tap = (i) => {
    const p = crane.pads[i];
    if (!p || p.used) return;
    if (!p.spec.iron) {
      p.shake = 0.8; crane.wrong++;
      level.onMessage?.(`${p.spec.name}: 자석에 붙지 않아요. ${/알루미늄|구리/.test(p.spec.name) ? '금속이지만 철이 아니에요.' : '금속이 아니에요.'}`, false);
      return;
    }
    if (crane.placed >= stones.length) return;
    p.used = true;
    p.pad.material.color.setHex(0x9bd38a);
    p.flight = { from: p.item.position.clone(), to: new THREE.Vector3(0, 1.55, CRANE_SLOTS[crane.placed]), slot: crane.placed, t: 0 };
    crane.placed++;
    const done = crane.placed === stones.length;
    if (done && crane.wrong === 0 && !crane.star.got) craneStar.position.copy(CRANE_STAR_AT);
    level.onMessage?.(done ? `징검다리 완성! 건너가요.${crane.wrong === 0 ? ' 철만 골라서 다음 부두에 별이 나타났어요.' : ''}` : `${p.spec.name}: 자석에 붙어요! 징검다리 ${crane.placed}/${stones.length}`, true);
  };
  movers.push({ root: null, update(t, dt, player) {
    const pos = player?.pos;
    crane.pads.forEach((p, i) => {
      const on = !!pos && Math.abs(pos.x - p.x) < 1.3 && Math.abs(pos.z - p.z) < 1.3 && pos.y > 0.8 && pos.y < 2.4;
      if (on && !p.occupied) crane.tap(i);
      p.occupied = on;
      if (p.flight) {
        p.flight.t = Math.min(1, p.flight.t + dt / 0.9);
        const k = p.flight.t;
        p.item.position.lerpVectors(p.flight.from, p.flight.to, k);
        p.item.position.y += Math.sin(k * Math.PI) * 4;
        if (k >= 1) { stones[p.flight.slot].visible = true; stones[p.flight.slot].userData.collider.enabled = true; p.item.visible = false; p.flight = null; }
      } else if (p.shake > 0) {
        p.shake = Math.max(0, p.shake - dt);
        p.item.position.copy(p.home); p.item.position.x += Math.sin(t * 40) * 0.12 * p.shake; p.item.position.y += 0.15 * p.shake;
      }
    });
  } });
  crane.reset = (s) => {
    crane.layout = craneLayout(s); crane.placed = 0; crane.wrong = 0;
    crane.pads.forEach((p, i) => {
      p.spec = crane.layout[i]; p.used = false; p.occupied = false; p.flight = null; p.shake = 0;
      p.item.visible = true; p.item.position.copy(p.home); p.item.material.color.setHex(p.spec.color);
      p.pad.material.color.setHex(0xf3d17a); paintLabel(p.label, p.spec.name);
    });
    stones.forEach((st) => { st.visible = false; st.userData.collider.enabled = false; });
    craneStar.position.copy(HIDDEN);
  };

  // ─── 자석 나룻배 두 구간 ────────────────────────────────
  // 배에는 자석 막대가 있고, 학생이 배 위 N/S 발판으로 "독 자석을 마주 보는 끝"의 극을 고른다.
  // 다른 극이면 끌리고 같은 극이면 밀린다. 첫 배는 섬 자석이 앞에 있어 끌려야, 둘째 배는 섬 자석이 뒤에 있어 밀려야 나아간다.
  // 섬 자석의 극은 시드로 바뀐다(같은 방은 같다). 틀리면 배가 출발 부두에 머문다(떨어지지 않는다). 빈 배는 출발 부두로 돌아온다.
  const dockB = platform(0, 1, -106, 20, 12, 0xd9c6a1);
  checkpoint(platform(0, 1.03, -103, 7, 4, 0xa6d9a2), new THREE.Vector3(0, 1, -103), '자석 나룻배 (끌기)');
  void dockB;
  const island = platform(0, 1, -138, 20, 12, 0xcfe3b0);
  checkpoint(platform(0, 1.03, -138, 7, 4, 0xa6d9a2), new THREE.Vector3(0, 1, -138), '자석 섬');
  void island;
  const poleColor = { N: 0xe85d5d, S: 0x527cd1 };
  const ferries = [];
  function poleLetter(x, y, z, rotY = 0) { // N/S 글자판 (극이 바뀌면 다시 그린다)
    const m = sign('N', x, y, z, { width: 2.4, rotY });
    return (pole) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = pole === 'N' ? '#e85d5d' : '#527cd1'; g.fillRect(0, 0, 512, 128);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 96px sans-serif'; g.fillText(pole, 256, 68);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      m.material.map?.dispose(); m.material.map = tex; m.material.needsUpdate = true;
    };
  }
  function ferry({ name, homeZ, farZ, magnetAhead, magnetZ, poleKey }) {
    const boat = platform(0, 1, homeZ, 5, 5, 0xf2e8cf, { dynamic: true, castShadow: true });
    // 배 위 자석 막대: 독 자석을 마주 보는 끝(앞 또는 뒤)이 고른 극의 색으로 바뀐다
    const dirToMagnet = magnetAhead ? -1 : 1; // 배에서 독 자석 쪽 z 방향
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 2.2), mat(0x48546c)); bar.position.set(0, 0.8, dirToMagnet * 1.2); boat.add(bar);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.7), new THREE.MeshStandardMaterial({ color: 0xbbbbbb })); tip.position.set(0, 0.8, dirToMagnet * 2.1); boat.add(tip);
    const pads = ['N', 'S'].map((pole, i) => {
      const x = i === 0 ? -1.5 : 1.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.6), mat(poleColor[pole])); m.position.set(x, 0.54, -dirToMagnet * 1.2); boat.add(m);
      const label = sign(pole, 0, 0, 0, { width: 1.2, color: pole === 'N' ? '#e85d5d' : '#527cd1' });
      boat.add(label); label.position.set(x, 1.6, -dirToMagnet * 1.2);
      return { pole, x, dz: -dirToMagnet * 1.2, occupied: false };
    });
    // 독 자석: 섬 쪽 부두 옆면의 판 + 글자판
    const magnet = new THREE.Mesh(new THREE.BoxGeometry(4, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: 0xbbbbbb }));
    magnet.position.set(0, 0.5, magnetZ); root.add(magnet);
    const letter = poleLetter(0, 3.4, magnetZ, 0);
    const f = { name, boat, homeZ, farZ, magnetAhead, poleKey, pads, magnet, letter, tip, pole: null, dockPole: 'N', away: 0, target: 'home' };
    ferries.push(f);
    movers.push({ root: boat, update(t, dt, player) {
      const p = player?.pos;
      const bz = boat.position.z;
      const onBoat = !!p && Math.abs(p.x) < 2.6 && Math.abs(p.z - bz) < 2.6 && p.y > 0.6 && p.y < 2.6;
      if (onBoat) {
        f.away = 0;
        for (const pad of pads) {
          const on = Math.abs(p.x - pad.x) < 0.9 && Math.abs(p.z - (bz + pad.dz)) < 0.9;
          if (on && !pad.occupied && f.pole !== pad.pole) {
            f.pole = pad.pole;
            tip.material.color.setHex(poleColor[f.pole]);
            const attract = f.pole !== f.dockPole;
            const go = ferryTarget(f.pole, f.dockPole, magnetAhead) === 'far';
            level.onMessage?.(`배 자석 ${f.pole}극 ↔ 섬 자석 ${f.dockPole}극: ${attract ? '다른 극이라 끌어당겨요' : '같은 극이라 밀어내요'}. ${go ? '배가 나아가요!' : '배가 나아가지 못해요. 다른 극을 골라 볼까요?'}`, go);
          }
          pad.occupied = on;
        }
      } else {
        f.away += dt;
        if (f.away > 1.0 && f.pole) { f.pole = null; tip.material.color.setHex(0xbbbbbb); } // 빈 배는 극을 풀고 돌아온다
      }
      f.target = ferryTarget(f.pole, f.dockPole, magnetAhead);
      const want = f.target === 'far' ? farZ : homeZ;
      const dz = want - bz;
      const speed = f.target === 'far' ? 3 : 5;
      // 같은 극으로 밀리는데 이미 출발 부두라면 살짝 흔들려 "밀어냄"을 보여 준다
      boat.position.z = bz + Math.sign(dz) * Math.min(Math.abs(dz), speed * dt);
      boat.position.x = f.pole && f.target === 'home' && Math.abs(dz) < 0.01 ? Math.sin(t * 30) * 0.05 : 0;
    } });
    return f;
  }
  // 첫 나룻배: 부두 B(-112) → 섬 앞(-132), 섬 앞면 자석이 앞에 있다(끌려야 간다)
  ferry({ name: '끌기', homeZ: -114.7, farZ: -129.3, magnetAhead: true, magnetZ: -131.85, poleKey: 'front' });
  sign('자석 나룻배 1', -6.5, 4.6, -110, { width: 5, lines: ['자석 나룻배 1', '섬의 자석이 배를 끌어당기게 하려면?', '배 위 N·S 발판으로 극을 골라요'], rotY: 0.3 });
  // 둘째 나룻배: 섬 뒤(-144) → 도착 부두(-164), 섬 뒷면 자석이 뒤에 있다(밀려야 간다)
  ferry({ name: '밀기', homeZ: -146.7, farZ: -161.3, magnetAhead: false, magnetZ: -144.15, poleKey: 'back' });
  sign('자석 나룻배 2', -6.5, 4.6, -142, { width: 5, lines: ['자석 나룻배 2', '이번엔 자석이 배 뒤에 있어요', '밀어내게 하려면 어떤 극?'], rotY: 0.3 });
  level.ferries = ferries;

  const goalDock = platform(0, 1, -170, 20, 12, 0xd9c6a1);
  void goalDock;
  sign('항구 도착!', 0, 7, -172, { width: 7, lines: ['항구 도착!', '끌어당길 때와 밀어낼 때 어떤 극을 골랐나요?', '어떤 물건이 자석에 붙었나요?'] });
  const finish = platform(0, 1.05, -172, 16, 7, 0x8bd0ac);
  finishPad(finish, -172);

  function applySeed(s) {
    crane.reset(s);
    const poles = islandPoles(s);
    for (const f of ferries) {
      f.dockPole = poles[f.poleKey]; f.letter(f.dockPole); f.magnet.material.color.setHex(poleColor[f.dockPole]);
      f.pole = null; f.away = 0; f.target = 'home'; f.tip.material.color.setHex(0xbbbbbb);
      f.boat.position.set(0, 0.5, f.homeZ); f.boat.updateMatrixWorld(true);
      f.pads.forEach((pad) => { pad.occupied = false; });
    }
  }
  level.setSeed = (s) => { level.seed = s; applySeed(s); };

  state.choose = (group, id) => {
    const choice = routes[group].find((entry) => entry.id === id);
    if (!choice || state[group] === id) return;
    state[group] = id;
    for (const entry of routes[group]) {
      entry.active = entry === choice;
      if (!entry.active) entry.mesh.userData.collider.enabled = false;
    }
    level.onMessage?.(group === 'iron'
      ? `${choice.label}: 자석이 철 화물을 끌어와 길을 만들어요.`
      : `${choice.label}: 자석 보트가 움직여 길을 만들어요.`, true);
  };
  level.routeBridges = routes;
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => {
    resetProgress();
    state.iron = null; state.boat = null;
    for (const entry of [...routes.iron, ...routes.boat]) {
      entry.active = false;
      entry.mesh.position.x = entry.x < 0 ? -24 : 24;
      entry.mesh.userData.collider.enabled = false;
      entry.mesh.updateMatrixWorld(true);
    }
    applySeed(level.seed);
    world.syncDynamic();
  };
  level.setSeed(seed);
  return level;
}
