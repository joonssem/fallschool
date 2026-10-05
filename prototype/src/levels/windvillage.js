// 바람마을: 같은 압력장으로 이동·깃발·입자를 계산한다. 틀린 길도 완주 가능하다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { makeWindAt, pressureAt, seaLandBreeze, isDay } from '../wind.js';
import { BoxCollider } from '../physics.js';

export const BREEZE_PERIOD = 32;
export function buildWindVillage(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '풍향계 마을 입구', zMax: Infinity },
      { name: '고기압·저기압 갈림길', zMax: -30 },
      { name: '상승·하강 기류', zMax: -68 },
      { name: '해풍·육풍 바람다리', zMax: -104 },
      { name: '바람마을 도착', zMax: -148 },
    ]),
    sky: { background: 0xc7e8f4, fog: [0xc7e8f4, 85, 210], hemi: 1.5 },
  });
  const { platform, block, ramp, sign, checkpoint, startCheckpoint, finishPad, challengeStar, mat } = makeKit(level);
  let time = 0;
  const zones = [];
  const gauges = [];
  const color = { road: 0xf3dfa2, sea: 0x69c5e0, land: 0x9ed188, rail: 0xb7c3cf };
  function road(x, y, z, w, d, c = color.road, rails = true) {
    const deck = platform(x, y, z, w, d, c);
    if (rails) for (const sx of [-1, 1]) block(x + sx * (w / 2 - 0.2), y + 1.4, z, 0.4, 1.4, d, color.rail);
    return deck;
  }
  function zone(sources, region, maxSpeed = 2.5) {
    const wind = makeWindAt(sources, { getTime: () => time, region, k: 36, maxSpeed });
    const item = { sources, region, wind }; zones.push(item); return item;
  }
  level.windZones = zones;
  // 연 발판 위는 바람에 밀리지 않는다(가만히 서 있어도 떨어지지 않게 - 조작 부담을 늘리지 않는다)
  level.windAt = (pos, out) => { if (level.kite?.shelters(pos)) return; for (const z of zones) z.wind(pos, out); };
  function region(xMin, xMax, zMin, zMax) { return { xMin, xMax, zMin, zMax, yMin: -0.5, yMax: 8 }; }
  function marker(text, x, y, z, c) {
    sign(text, x, y, z, { width: 3, color: c });
  }
  // 초록 화살표·깃발은 가는 쪽, 풍향계 빨간 끝은 바람이 오는 쪽.
  function gauge(x, y, z, field, vane = false) {
    const pos = new THREE.Vector3(x, y, z);
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), pos, 2.3, vane ? 0xe05252 : 0x168891, 0.8, 0.5);
    const flag = new THREE.Group(); flag.position.copy(pos).add(new THREE.Vector3(0, 0.8, 0));
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.6), mat(0xf2b84d, { side: THREE.DoubleSide }));
    cloth.rotation.y = Math.PI / 2; cloth.position.z = -0.85; flag.add(cloth);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), mat(0x657786)); pole.position.copy(pos); level.root.add(pole, flag, arrow);
    gauges.push({ pos, arrow, field, vane, flag });
    return arrow;
  }
  function board(x, y, z, width = 6) {
    const mesh = sign('바람', x, y, z, { width });
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256;
    const g = canvas.getContext('2d'); const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    mesh.material.map.dispose(); mesh.material.map = tex;
    let previous = '';
    return (rows) => {
      const key = rows.join('|'); if (key === previous) return; previous = key;
      g.clearRect(0, 0, 768, 256); g.fillStyle = '#fff'; g.fillRect(0, 0, 768, 256);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#24485b';
      rows.forEach((row, i) => {
        let size = i === 0 ? 52 : 38;
        const font = (px) => `bold ${px}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
        g.font = font(size);
        while (size > 22 && g.measureText(row).width > 720) g.font = font((size -= 2));
        g.fillText(row, 384, 48 + i * 76);
      });
      tex.needsUpdate = true;
    };
  }
  // 1. 입구: 눈에 보이지 않는 공기를 점과 깃발로 표현한다.
  road(0, 0, -9, 22, 34);
  startCheckpoint('풍향계 마을 입구');
  sign('바람마을', 0, 5, -8, { width: 7, lines: ['바람마을', '바람을 보고 길을 골라요'] });
  sign('학생 아이디어', 8, 2.8, 1, { width: 4, lines: ['학생 아이디어', '아이엠가든 · 버블리'] });
  sign('풍향계', -8, 4.6, -15, { width: 5, lines: ['풍향은 불어오는 방향', '빨간 끝: 바람이 오는 쪽', '초록 화살표: 가는 쪽'] });
  sign('게임에서는 단순하게', 8, 4.6, -15, { width: 5, lines: ['미는 힘은 게임 과장', '바람 길은 곧게 표현해요', '실제는 자전으로 휘기도 해요'] });
  const entry = zone([{ x: 0, z: -5, sigma: 12, a: 1 }, { x: 0, z: -26, sigma: 12, a: -1 }], region(-10, 10, -27, 7), 1.6);
  gauge(-5, 2.1, -17, entry, true); gauge(4, 1.1, -17, entry);

  // 2. 두 길: 압력 배열이 서로 반대라 왼쪽은 순풍, 오른쪽은 역풍이다.
  const fork = road(0, 0, -31, 26, 10);
  checkpoint(fork, new THREE.Vector3(0, 0, -29), '고기압·저기압 갈림길');
  sign('어느 길이 등을 밀어 줄까요?', 0, 4, -34, { width: 7, lines: ['H: 고기압 / L: 저기압', '지표 바람은 높은 쪽에서 낮은 쪽', '순풍 길엔 도약대, 역풍 길엔 연 발판'] });
  for (const x of [-7, 7]) {
    road(x, 0, -49, 8, 28, x < 0 ? 0xbce5cf : 0xf4ccaa);
    const forward = x < 0;
    const sources = [{ x, z: -36, sigma: 10, a: forward ? 1 : -1 }, { x, z: -62, sigma: 10, a: forward ? -1 : 1 }];
    const field = zone(sources, region(x - 3.5, x + 3.5, -63, -35));
    marker(forward ? 'H 고기압' : 'L 저기압', x, 3, -38, forward ? '#a64d41' : '#2467a3');
    marker(forward ? 'L 저기압' : 'H 고기압', x, 3, -60, forward ? '#2467a3' : '#a64d41');
    gauge(x, 1.2, -49, field);
  }
  buildTailwindJump();
  buildHeadwindKite(zones.at(-1));
  road(0, 0, -67, 26, 10);
  sign('바람 세기', 10, 3.5, -66, { width: 5, lines: ['압력이 가파르게 변하는 곳', '바람이 더 세게 불어요'] });

  // 3. 상승·하강은 별도 게임 발판으로 표현. 수평 압력 계산에서 수직 기류를 추론하지 않는다.
  const airDeck = road(0, 0, -82, 26, 22);
  checkpoint(airDeck, new THREE.Vector3(0, 0, -74), '상승·하강 기류');
  sign('지표 부근의 공기 흐름', 0, 6.8, -86, { width: 7, lines: ['저기압 쪽: 모여 올라가요', '고기압 쪽: 내려와 퍼져요', '기류 발판은 게임 장치예요'] });
  const lifts = [];
  for (const [x, rising] of [[-7, true], [7, false]]) {
    const p = platform(x, 1, -84, 5, 7, rising ? 0xaedced : 0xf1d296, { dynamic: true });
    marker(rising ? 'L 상승 기류' : 'H 하강 기류', x, 5.2, -84, rising ? '#2467a3' : '#a64d41');
    level.movers.push({ root: p, update(t) {
      const phase = ((t % 10) + 10) % 10 / 10;
      // 천천히 보여 준 뒤 되돌아오는 발판. 실제 압력을 바꾸는 스위치는 없다.
      const rise = phase < 0.8 ? phase / 0.8 : (1 - phase) / 0.2;
      p.position.y = 1 + (rising ? rise : 1 - rise) * 2;
    } });
    lifts.push(p);
    for (let i = 0; i < 6; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), mat(0x78c7df)); level.root.add(dot);
      level.movers.push({ root: null, update(t) { const h = ((t * 0.6 + i / 6) % 1 + 1) % 1; dot.position.set(x + Math.sin(i) * 1.5, 1.2 + (rising ? h : 1 - h) * 5, -86); } });
    }
  }
  level.airLifts = lifts;
  for (let i = 0; i < 4; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), mat(0xffffff));
    cloud.position.set(-8 + i, 8 + (i % 2) * 0.3, -85); cloud.scale.set(1.5, 0.7, 1); level.root.add(cloud);
  }
  challengeStar(-7, 3.6, -85);
  sign('안전 계단', 5, 3.2, -91, { width: 4, lines: ['가운데 계단으로도 가요', '발판은 되돌아와요'] });
  for (let i = 0; i < 5; i++) road(0, i * 0.5, -91 - i * 3, 8, 4, color.land);

  // 4. 바다는 왼쪽, 육지는 오른쪽. 두 번 가로질러 낮/밤에 바뀐 순풍을 느낀다.
  const coast = road(0, 2, -123, 28, 42, color.sea);
  platform(7, 2.02, -123, 14, 42, color.land);
  checkpoint(coast, new THREE.Vector3(-8, 2, -105), '해풍·육풍 바람다리');
  // 넓은 끝 통로를 남긴 벽: 정답 문 없이 이동 경로가 양쪽 해안을 가로지른다.
  block(-6, 5.2, -114, 16, 3.2, 0.6, color.land);
  block(6, 5.2, -132, 16, 3.2, 0.6, color.land);
  const breezeSources = seaLandBreeze({ sea: { x: -16, z: -123 }, land: { x: 16, z: -123 }, sigma: 20, strength: 2, period: BREEZE_PERIOD });
  const breeze = zone(breezeSources, region(-14, 14, -145, -102), 2.2);
  level.breezeSources = breezeSources;
  level.breezePeriod = BREEZE_PERIOD;
  marker('바다', -11, 5.3, -108, '#2467a3'); marker('육지', 11, 5.3, -108, '#45803b');
  const showBreeze = board(-7, 6.7, -114, 6);
  gauge(-7, 3.3, -105.5, breeze); gauge(5, 3.3, -134, breeze);
  sign('해풍·육풍', -10, 5.5, -142, { width: 6, lines: ['낮 해풍: 바다에서 육지로', '밤 육풍: 육지에서 바다로', '바람이 도우면 건너 보세요'] });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), mat(0xffdd55)); sun.position.set(15, 11, -123); level.root.add(sun);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(0xdfe5fa)); moon.position.set(-15, 11, -123); level.root.add(moon);
  buildCoastJumps();
  road(0, 2, -149, 26, 12, color.land);
  const goal = road(0, 2, -160, 22, 14, color.land);
  sign('바람마을 도착!', 0, 6, -159, { width: 7, lines: ['바람마을 도착!', '어느 길에서 바람이 도왔나요?', '낮과 밤에 방향은 어땠나요?'] });
  finishPad(goal, -160);
  challengeStar(10, 3.2, -151);
  // 길 밖의 작은 집들. 장식은 충돌 지형을 만들지 않는다.
  for (let i = 0; i < 8; i++) for (const side of [-1, 1]) {
    const house = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), mat(i % 2 ? 0xf3c5a4 : 0xcbd9e8));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.7, 4), mat(0xc9846f));
    house.position.set(side * 23, 0, 5 - i * 22); roof.position.copy(house.position).add(new THREE.Vector3(0, 3.3, 0)); roof.rotation.y = Math.PI / 4;
    level.root.add(house, roof);
  }

  // 낮·밤 도약(선택): 해풍(낮, 바다→육지=동쪽)이면 동쪽 섬으로, 육풍(밤, 육지→바다=서쪽)이면 서쪽 섬으로 뛰어야 닿는다.
  // 바람이 반대이면 틈에 닿지 못하고 아래 해안 길(높이 2)에 안전하게 내려앉는다. 기본 길과 무관한 선택이다.
  function buildCoastJumps() {
    const J = { gap: 6.6, deckW: 3, topY: 5, islandY: 3.5 };
    const deckMat = 0xe6f4ea;
    function xRamp(xFrom, xTo, y0, y1, z, width) { // x 방향으로 오르는 경사로
      const run = Math.abs(xTo - xFrom), rise = y1 - y0, theta = Math.atan2(rise, run), len = Math.hypot(run, rise), dir = Math.sign(xTo - xFrom);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 1, width), mat(0xbce5cf));
      mesh.rotation.z = dir > 0 ? theta : -theta;
      mesh.position.set((xFrom + xTo) / 2 - 0.5 * Math.sin(theta) * -1 * 0, (y0 + y1) / 2 - 0.5 * Math.cos(theta), z);
      mesh.position.x += dir * 0.5 * Math.sin(theta) * -1;
      level.root.add(mesh);
      mesh.userData.collider = level.world.add(new BoxCollider(mesh, new THREE.Vector3(len / 2, 0.5, width / 2)));
    }
    function device({ dir, z, label, lines, labelColor }) { // dir +1: 서쪽에서 동쪽으로 뛴다 (낮), -1: 동쪽에서 서쪽으로 (밤)
      const deckX = -dir * 7;
      xRamp(-dir * 13.5, -dir * 8.5, 2, J.topY, z, 2.4);
      block(deckX, J.topY, z, J.deckW, J.topY - 2, J.deckW, deckMat); // 도약대 (바닥까지 닿는 기둥 모양)
      const islandX = deckX + dir * (J.deckW / 2 + J.gap + 2);
      block(islandX, J.islandY, z, 4, J.islandY - 2, 4, deckMat);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.8 }));
      star.position.set(islandX, J.islandY + 1.4, z); star.castShadow = true; level.root.add(star);
      level.stars.push({ mesh: star, got: false });
      sign(label, deckX - dir * 0.5, J.topY + 3.2, z + 3.2, { width: 5, color: labelColor, lines });
      return { deckX, islandX, z };
    }
    level.coastJumps = {
      day: device({ dir: 1, z: -109, label: '낮 도약대 (선택)', labelColor: '#c07a1a', lines: ['낮 도약대 (선택)', '낮에는 바다에서 육지로 불어요', '동쪽으로 뛰어 별까지! 밤엔 어려워요'] }),
      night: device({ dir: -1, z: -138, label: '밤 도약대 (선택)', labelColor: '#3a4a8a', lines: ['밤 도약대 (선택)', '밤에는 육지에서 바다로 불어요', '서쪽으로 뛰어 별까지! 낮엔 어려워요'] }),
    };
  }

  // 순풍 도약(선택): 왼쪽 순풍 길 한가운데의 도약대에서 앞의 섬으로 뛴다. 틈은 바람 없이는 닿지 않고
  // 순풍을 타면 닿는다. 섬은 길 위(높이 1.5)라 실패해도 아래 길에 안전하게 내려앉는다. 역풍 길에는 두지 않았다.
  function buildTailwindJump() {
    const x = -7, deckZ = -42.75, islandZ = -53.3;
    sign('바람 도약대 (선택)', x - 3.3, 3.6, -45, { width: 4.6, color: '#2467a3', lines: ['바람 도약대 (선택)', '순풍을 타고 멀리 뛰어 별까지!', '못 닿아도 길로 안전하게 내려와요'], rotY: 0.5 });
    ramp(x, -36, 0, -41.5, 3, 2.4, 0xbce5cf);
    platform(x, 3, deckZ, 2.4, 2.5, 0xe6f4ea); // 높은 도약대: 내려 뛰어 공중에 오래 떠 있어야 바람이 더 크게 작용한다
    platform(x, 1.5, islandZ, 3.6, 4, 0xe6f4ea);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.8 }));
    star.position.set(x, 2.9, islandZ); star.castShadow = true; level.root.add(star);
    level.stars.push({ mesh: star, got: false });
  }

  // 맞바람 연 발판(선택): 오른쪽 역풍 길에만 있다. 연은 바람을 마주 볼 때 뜬다는 생활 경험을 게임 장치로 쓴 것.
  // 누군가 올라서 있으면 발판 위치의 맞바람(진행 반대 방향 바람) 세기만큼 올라가고, 비면 내려온다. 꼭대기 옆 섬에 별.
  // 순풍 길에 같은 발판을 두면 뜨지 않는다(시험으로 확인). 위치는 이 화면 학생 + 다른 학생 위치로 정한다(시소와 같은 방식).
  function buildHeadwindKite(field) {
    const KX = 9.3, KZ = -52, TOP = 5.5, BASE = 0.15;
    const pad = platform(KX, BASE, KZ, 2.4, 2.4, 0xf28482, { dynamic: true, thick: 0.4 });
    const kite = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.2, 4), mat(0xf28482, { side: THREE.DoubleSide }));
    kite.rotation.x = Math.PI / 2; level.root.add(kite);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), mat(0xffffff)); level.root.add(string);
    challengeStar(13, TOP, KZ);
    sign('연 발판 (선택)', 4.2, 3.4, -45.5, { width: 4.6, color: '#c0392b', lines: ['연 발판 (선택)', '연은 바람을 마주 볼 때 높이 떠요', '맞바람이 불면 올라가 별까지!'], rotY: -0.5 });
    const probe = new THREE.Vector3(KX, 1, KZ), w = new THREE.Vector3();
    const kiteState = { height: 0, rate: 0 };
    level.kite = { pad, x: KX, z: KZ, top: TOP, base: BASE, state: kiteState, field };
    level.movers.push({ root: pad, update(t, dt, player) {
      // 올라탄 사람: 발판 윗면 근처에 서 있는 이 화면 학생과 다른 학생 (발판이 움직일 때 접촉이 잠깐 끊겨도 흔들리지 않게 위치로 본다)
      const top = pad.position.y + 0.2;
      const on = (q) => Math.abs(q.x - KX) < 1.4 && Math.abs(q.z - KZ) < 1.4 && q.y > top - 0.4 && q.y < top + 1.2;
      const feet = [];
      if (player && on(player.pos)) feet.push(player.pos);
      for (const o of level.getOthers?.() || []) if (on(o)) feet.push(o);
      w.set(0, 0, 0); field.wind(probe, w);
      const headwind = Math.max(0, w.z); // +z: 진행 방향(-z)의 반대에서 불어오는 바람
      kiteState.rate = feet.length ? Math.min(1.6, headwind * 0.75) : -2;
      kiteState.height = THREE.MathUtils.clamp(kiteState.height + kiteState.rate * dt, 0, TOP - BASE);
      pad.position.y = BASE - 0.2 + kiteState.height;
      kite.position.set(KX, pad.position.y + 4.2 + Math.sin(t * 2) * 0.2, KZ - 2.5);
      string.position.set(KX, pad.position.y + 2.1, KZ - 1.25); string.scale.y = 4.4; string.rotation.x = -0.5;
    } });
    level.kite.shelters = (p) => Math.abs(p.x - KX) < 1.3 && Math.abs(p.z - KZ) < 1.3 && p.y > pad.position.y && p.y < pad.position.y + 2;
    level.kite.reset = () => { kiteState.height = 0; pad.position.y = BASE - 0.2; };
  }

  // 압력의 같은 음의 기울기가 화살표·풍향계·깃발·입자를 움직인다.
  const wind = new THREE.Vector3(); const direction = new THREE.Vector3();
  const particles = [];
  for (const field of zones) for (let i = 0; i < 18; i++) {
    const r = field.region;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), mat(0xffffff));
    const pos = new THREE.Vector3(r.xMin + (r.xMax - r.xMin) * ((i * 7 % 18) / 18), 1.2 + i % 3 * 0.7 + (field === breeze ? 2 : 0), r.zMin + (r.zMax - r.zMin) * i / 18);
    dot.position.copy(pos); level.root.add(dot); particles.push({ dot, field, initial: pos.clone() });
  }
  level.windGauges = gauges;
  const initialUpdate = { root: null, update(t, dt) {
    time = t;
    for (const g of gauges) {
      wind.set(0, 0, 0); g.field.wind(g.pos, wind);
      const speed = wind.length(); g.arrow.visible = speed > 0.03;
      if (speed > 0.03) {
        direction.copy(wind).normalize(); g.flag.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
        direction.multiplyScalar(g.vane ? -1 : 1); g.arrow.setDirection(direction); g.arrow.setLength(1 + Math.min(speed, 2), 0.6, 0.35);
      }
    }
    for (const p of particles) {
      wind.set(0, 0, 0); p.field.wind(p.dot.position, wind); p.dot.position.addScaledVector(wind, Math.min(dt, 0.1));
      const r = p.field.region;
      if (p.dot.position.x < r.xMin || p.dot.position.x > r.xMax || p.dot.position.z < r.zMin || p.dot.position.z > r.zMax) p.dot.position.copy(p.initial);
    }
    const day = isDay(t, BREEZE_PERIOD); sun.visible = day; moon.visible = !day;
    const seaP = pressureAt(breezeSources, -16, -123, t);
    const landP = pressureAt(breezeSources, 16, -123, t);
    const changing = Math.abs(seaP - landP) < 0.08;
    showBreeze(changing ? ['낮밤이 바뀌는 중', '잠시 바람이 약해져요'] : day ? ['낮 · 해풍', '바다 H → 육지 L', '바다에서 육지로 불어요'] : ['밤 · 육풍', '육지 H → 바다 L', '육지에서 바다로 불어요']);
  } };
  level.movers.unshift(initialUpdate);
  level.setSeed = (s) => { level.seed = s; time = 0; particles.forEach((p) => p.dot.position.copy(p.initial)); level.kite.reset(); };
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.setSeed(level.seed); };
  level.setSeed(seed);
  return level;
}
