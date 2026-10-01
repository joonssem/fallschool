// 그림자 변신 극장: 거리·회전·위치·두 물체의 조합. 개인별 실험, 완성 길 유지.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { projectBox, shadowMask, maskSimilarity, SHADOW_VIEW } from './shadow-math.js';

const box = (size, position, rotationY = 0) => ({ size, position, rotationY });
const clone = (boxes) => boxes.map((b) => ({ size: [...b.size], position: [...b.position], rotationY: b.rotationY }));
export const SHADOW_SCENES = [
  { kind: 'distance', title: '1막 · 그림자 크기', initial: [box([0.8, 1.2, 0.12], [0, 0, 9])], target: [box([0.8, 1.2, 0.12], [0, 0, 6])] },
  { kind: 'rotation', title: '2막 · 다른 쪽에서 보기', initial: [box([1.4, 1.2, 0.35], [0, 0, 6])], target: [box([1.4, 1.2, 0.35], [0, 0, 6], Math.PI / 2)] },
  { kind: 'position', title: '3막 · 그림자 자리', initial: [box([0.8, 0.8, 0.12], [0, 0, 6])], target: [box([0.8, 0.8, 0.12], [0.5, 0.5, 6])] },
  { kind: 'combine', title: '4막 · 두 물체의 공연', initial: [box([0.35, 1.2, 0.12], [-0.75, -0.25, 6]), box([1.4, 0.4, 0.12], [0.75, 0.5, 6])], target: [box([0.35, 1.2, 0.12], [0, -0.25, 6]), box([1.4, 0.4, 0.12], [0, 0.5, 6])] },
];

export function buildShadowTheater(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '그림자 변신 극장', zMax: Infinity },
      { name: '그림자 크기', zMax: -15 }, { name: '물체 방향', zMax: -48 },
      { name: '그림자 자리', zMax: -81 }, { name: '두 물체의 공연', zMax: -114 },
      { name: '커튼콜', zMax: -147 },
    ]),
    sky: { background: 0x25223e, fog: [0x25223e, 70, 180], hemi: 1.8 },
  });
  const { platform, block, sign, startCheckpoint, checkpoint, finishPad, challengeStar, mat } = makeKit(level);
  level.theaters = [];
  platform(0, 0, 2, 20, 20, 0x8e80ad); startCheckpoint('극장 입구');
  sign('그림자 변신 극장', 0, 5, -5, { width: 8, lines: ['그림자 변신 극장', '바꿔 보고 · 비교하고 · 공연 완성'] });
  sign('작은 빛의 모형', -8, 3, -3, { width: 5, lines: ['빛을 가리면 그림자가 생겨요', '여기서는 작은 광원 하나예요'] });
  sign('발판으로 실험해요', 8, 3, -3, { width: 5, lines: ['발판을 밟으면 바뀌어요', '내렸다 다시 밟으면 한 번 더'] });
  platform(0, 0.5, -13, 10, 6, 0xab9fc2); platform(0, 1, -21, 10, 6, 0x8e80ad);

  function room(config, index) {
    const z = -34 - index * 33;
    const deck = platform(0, 1, z + 8, 26, 24, 0xaa9cbb);
    const cp = checkpoint(deck, new THREE.Vector3(0, 1, z + 17), config.title); cp.noHelp = true;
    sign(config.title, 0, 14, z + 1, { width: 7, color: '#51416d' });
    const door = block(0, 7, z - 3, 8, 6, 0.8, 0x73568c, { dynamic: true });
    for (const x of [-12, 12]) block(x, 13, z - 3, 16, 12, 1, 0x594166);
    block(0, 13, z - 3, 8, 6, 1, 0x594166);
    const bridge = platform(0, 1, z - 7, 8, 10, 0x9c8daf);
    const state = { z, kind: config.kind, objects: clone(config.initial), selected: 0, solved: false, attempts: 0, pads: [], door, bridge, similarity: 0 };
    level.theaters.push(state);
    const targetHulls = config.target.map((b) => projectBox(b));
    const targetMask = shadowMask(targetHulls);
    // 같은 투영을 왼쪽 작은 모형과 오른쪽 확대 화면에 그린다.
    const screenCanvas = document.createElement('canvas'); screenCanvas.width = 840; screenCanvas.height = 576;
    const ctx = screenCanvas.getContext('2d'); const texture = new THREE.CanvasTexture(screenCanvas); texture.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 5.76), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    screen.position.set(3, 5.8, z + 1); level.root.add(screen);
    sign('청록 점선이 목표', 3, 10.4, z + 1, { width: 6, lines: ['청록 점선이 목표', '검은 모양이 지금 그림자'] });
    const miniCanvas = document.createElement('canvas'); miniCanvas.width = 420; miniCanvas.height = 288;
    const miniCtx = miniCanvas.getContext('2d'); const miniTexture = new THREE.CanvasTexture(miniCanvas); miniTexture.colorSpace = THREE.SRGBColorSpace;
    const miniScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.92), new THREE.MeshBasicMaterial({ map: miniTexture, toneMapped: false }));
    miniScreen.position.set(-6, 4.6, z + 1.6); level.root.add(miniScreen);
    sign('빛 · 물체 · 화면', -6, 7, z + 1.6, { width: 4.6, lines: ['빛 · 물체 · 화면', '작은 모형 / 오른쪽은 확대'] });
    const lightOrigin = new THREE.Vector3(-6, 4.6, z + 6.4);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat(0xffe595, { emissive: 0xffd358 })); lamp.position.copy(lightOrigin); level.root.add(lamp);
    const meshes = state.objects.map((b, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...b.size.map((v) => v * 0.4)), mat(i ? 0x82c9de : 0xf4ad75)); level.root.add(m); return m;
    });
    const rays = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe7ce88, transparent: true, opacity: 0.45 })); level.root.add(rays);
    const statusCanvas = document.createElement('canvas'); statusCanvas.width = 768; statusCanvas.height = 256;
    const statusCtx = statusCanvas.getContext('2d'); const statusTexture = new THREE.CanvasTexture(statusCanvas); statusTexture.colorSpace = THREE.SRGBColorSpace;
    const status = sign('목표와 비교해요', 0, 1.9, z + 13, { width: 6 }); status.material.map.dispose(); status.material.map = statusTexture; status.geometry.dispose(); status.geometry = new THREE.PlaneGeometry(6, 1.2);
    function statusText(text) {
      statusCtx.fillStyle = '#fff'; statusCtx.fillRect(0, 0, 768, 256); statusCtx.textAlign = 'center'; statusCtx.textBaseline = 'middle'; statusCtx.fillStyle = '#40304e';
      let size = 46; const font = (px) => `bold ${px}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; statusCtx.font = font(size);
      while (size > 24 && statusCtx.measureText(text).width > 720) statusCtx.font = font(size -= 2);
      statusCtx.fillText(text, 384, 128); statusTexture.needsUpdate = true;
    }
    const toPixel = ([x, y], w, h) => [(x - SHADOW_VIEW.xMin) * w / 7, (SHADOW_VIEW.yMax - y) * h / 4.8];
    function drawHulls(g, hulls, w, h, outline = false) {
      for (const hull of hulls) {
        g.beginPath(); hull.forEach((point, i) => { const p = toPixel(point, w, h); i ? g.lineTo(...p) : g.moveTo(...p); }); g.closePath();
        if (outline) g.stroke(); else g.fill();
      }
    }
    function paint() {
      const hulls = state.objects.map((b) => projectBox(b));
      state.similarity = maskSimilarity(shadowMask(hulls), targetMask);
      ctx.fillStyle = '#fff7de'; ctx.fillRect(0, 0, 840, 576);
      ctx.fillStyle = '#30263c'; drawHulls(ctx, hulls, 840, 576);
      ctx.strokeStyle = '#008d91'; ctx.lineWidth = 7; ctx.setLineDash([14, 10]); drawHulls(ctx, targetHulls, 840, 576, true); ctx.setLineDash([]);
      texture.needsUpdate = true;
      miniCtx.fillStyle = '#fff7de'; miniCtx.fillRect(0, 0, 420, 288); miniCtx.fillStyle = '#30263c'; drawHulls(miniCtx, hulls, 420, 288); miniTexture.needsUpdate = true;
      const rayPoints = [];
      meshes.forEach((m, i) => {
        const b = state.objects[i]; m.position.set(-6 + b.position[0] * 0.4, 4.6 + b.position[1] * 0.4, lightOrigin.z - b.position[2] * 0.4); m.rotation.y = -b.rotationY;
        m.material.color.setHex(i === state.selected ? 0xf4ad75 : 0x82c9de); m.updateMatrixWorld(true);
        for (const p of hulls[i]) rayPoints.push(lightOrigin.x, lightOrigin.y, lightOrigin.z, -6 + p[0] * 0.4, 4.6 + p[1] * 0.4, z + 1.6);
      });
      rays.geometry.setAttribute('position', new THREE.Float32BufferAttribute(rayPoints, 3)); rays.geometry.computeBoundingSphere();
      state.pads.forEach((p) => { if (p.action === 'select') p.mesh.material.color.setHex(p.value === state.selected ? 0xf4ad75 : 0x82c9de); });
      statusText(state.solved ? '공연 완성! 길은 계속 열려요' : state.similarity >= 0.975 ? '목표와 겹쳤어요! 공연 완성으로' : config.kind === 'combine' ? `${state.selected ? '가로 막대' : '세로 막대'}를 움직여 비교해요` : '모양과 크기·자리를 비교해요');
    }
    function pad(x, dz, label, action, value) {
      const mesh = platform(x, 1.15, z + dz, 3, 3, action === 'submit' ? 0x9bd2ae : 0xdac4e7); mesh.material = mesh.material.clone();
      sign(label, x, 2.8, z + dz - 1.8, { width: 3.8, color: '#51416d' });
      state.pads.push({ x, z: z + dz, action, value, mesh, occupied: false });
    }
    if (config.kind === 'distance') {
      pad(-5, 8, '빛 쪽으로', 'distance', -1); pad(5, 8, '화면 쪽으로', 'distance', 1);
    } else if (config.kind === 'rotation') {
      pad(-5, 8, '한 칸 돌리기', 'rotate', 1); pad(5, 8, '반대로 돌리기', 'rotate', -1);
    } else if (config.kind === 'position') {
      pad(-5, 7, '왼쪽으로', 'x', -0.25); pad(5, 7, '오른쪽으로', 'x', 0.25);
      pad(-5, 12, '위로', 'y', 0.25); pad(5, 12, '아래로', 'y', -0.25);
    } else {
      pad(-5, 7, '세로 막대 선택', 'select', 0); pad(5, 7, '가로 막대 선택', 'select', 1);
      pad(-5, 12, '왼쪽으로', 'x', -0.25); pad(5, 12, '오른쪽으로', 'x', 0.25);
    }
    const rear = state.pads.length > 2 ? 17 : 14;
    pad(-8, rear, '처음 모양', 'clear'); pad(8, rear, '공연 완성', 'submit');
    let lift = 0;
    function act(pad) {
      const b = state.objects[state.selected];
      if (pad.action === 'distance') b.position[2] = THREE.MathUtils.clamp(b.position[2] + pad.value, 4, 9);
      else if (pad.action === 'rotate') b.rotationY = ((b.rotationY + pad.value * Math.PI / 6) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      else if (pad.action === 'x') b.position[0] = THREE.MathUtils.clamp(b.position[0] + pad.value, -1, 1);
      else if (pad.action === 'y') b.position[1] = THREE.MathUtils.clamp(b.position[1] + pad.value, -0.75, 0.75);
      else if (pad.action === 'select') state.selected = pad.value;
      else if (pad.action === 'clear') { state.objects = clone(config.initial); state.selected = 0; }
      paint();
      if (pad.action === 'submit') {
        state.attempts++;
        if (state.similarity >= 0.975) {
          state.solved = true; bridge.material = mat(0xb9dfc5); level.onMessage?.('공연 완성! 그림자가 목표와 겹쳤어요. 길이 열렸어요.', true);
        } else level.onMessage?.('아직 목표와 달라요. 결과를 보고 다시 바꿔 보세요.', false);
        paint();
      }
    }
    level.movers.push({ root: null, update(t, dt, player) {
      for (const p of state.pads) {
        const pos = player?.pos;
        const occupied = !!pos && Math.abs(pos.x - p.x) < 1.35 && Math.abs(pos.z - p.z) < 1.35 && pos.y > 0.8 && pos.y < 2;
        if (occupied && !p.occupied) act(p); p.occupied = occupied;
      }
      lift = Math.min(1, lift + (state.solved ? dt * 2 : 0)); door.position.y = 4 + lift * 7; door.userData.collider.enabled = lift < 0.95; door.updateMatrixWorld(true);
    } });
    state.reset = () => { state.objects = clone(config.initial); state.selected = 0; state.solved = false; state.attempts = 0; lift = 0; door.position.y = 4; door.userData.collider.enabled = true; bridge.material = mat(0x9c8daf); state.pads.forEach((p) => { p.occupied = false; }); paint(); };
    state.meshes = meshes; state.screen = screen; state.targetHulls = targetHulls; state.lightOrigin = lightOrigin;
    state.reset();
  }
  SHADOW_SCENES.forEach(room);
  for (const z of [-47, -80, -113, -146]) platform(0, 1, z, 8, 6, 0x8e80ad);
  const goal = platform(0, 1, -159, 20, 14, 0xb9dfc5);
  sign('커튼콜!', 0, 6, -158, { width: 7, lines: ['커튼콜!', '어떤 선택이 그림자를 바꿨나요?', '빛을 가린 결과를 친구에게 설명해요'] }); finishPad(goal, -157);
  challengeStar(8, 1, -148);
  for (let i = 0; i < 8; i++) for (const side of [-1, 1]) {
    const curtain = new THREE.Mesh(new THREE.BoxGeometry(2, 18, 8), mat(0x783858)); curtain.position.set(side * 24, 3, -10 - i * 22); level.root.add(curtain);
  }
  level.setSeed = (s) => { level.seed = s; level.theaters.forEach((state) => state.reset()); };
  finalizeLevel(level); const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.theaters.forEach((state) => state.reset()); };
  level.setSeed(seed);
  return level;
}
