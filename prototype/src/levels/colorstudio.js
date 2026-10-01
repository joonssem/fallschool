// 색과 빛의 미술 공방: CMY 물감 모형과 RGB 빛 모형을 별도 공간에서 비교.
// 실제 물감의 재료·비율·조명 조건을 계산하는 물리 시뮬레이션은 아니다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';

const SOURCES = {
  paint: [
    { code: 'C', name: '청록', hex: 0x00ffff },
    { code: 'M', name: '자홍', hex: 0xff00ff },
    { code: 'Y', name: '노랑', hex: 0xffff00 },
  ],
  light: [
    { code: 'R', name: '빨강', hex: 0xff0000 },
    { code: 'G', name: '초록', hex: 0x00ff00 },
    { code: 'B', name: '파랑', hex: 0x0000ff },
  ],
};
const NAMES = new Map([
  [0x000000, '검정'], [0xffffff, '흰색'], [0xff0000, '빨강'], [0x00ff00, '초록'],
  [0x0000ff, '파랑'], [0x00ffff, '청록'], [0xff00ff, '자홍'], [0xffff00, '노랑'],
]);
const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

// 물감 모형: C는 R, M은 G, Y는 B 성분을 제거한다.
// 빛 모형: R·G·B 성분을 더한다. 각 발판은 정해진 강도 하나의 선택이다.
export function mixedColor(mode, mask) {
  if (!(mode in SOURCES)) throw new Error(`알 수 없는 색 모형: ${mode}`);
  let hex = 0;
  for (let i = 0; i < 3; i++) {
    const selected = !!(mask & (1 << i));
    if (mode === 'paint' ? !selected : selected) hex |= 0xff << (16 - i * 8);
  }
  return { hex, name: NAMES.get(hex) };
}

// 실제 겹치는 영역을 색 혼합 모형으로 그린다. 색 이름·기호도 함께 제공.
function mixingDiagram(root, mode, x, y, z, initialMask = 0, width = 6) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.75),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, fog: false }));
  mesh.name = `mixing-diagram-${mode}-${z}`;
  mesh.position.set(x, y, z);
  root.add(mesh);
  const centers = [[190, 140], [322, 140], [256, 255]];
  function paint(mask) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = mode === 'paint' ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, 512, 384);
    ctx.globalCompositeOperation = mode === 'paint' ? 'multiply' : 'lighter';
    SOURCES[mode].forEach((source, i) => {
      if (!(mask & (1 << i))) return;
      ctx.fillStyle = css(source.hex);
      ctx.beginPath(); ctx.arc(...centers[i], 120, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    // 기호는 겹침 영역 밖의 흰 꼬리표에 표시한다.
    centers.forEach(([cx, cy], i) => {
      const lx = i === 0 ? 78 : i === 1 ? 410 : 256;
      const ly = i === 2 ? 340 : 32;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(lx - 42, ly - 18, 84, 36);
      ctx.fillStyle = '#293241'; ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${SOURCES[mode][i].code} ${mask & (1 << i) ? 'ON' : 'OFF'}`, lx, ly);
    });
    texture.needsUpdate = true;
  }
  paint(initialMask);
  return { mesh, paint };
}

export function buildColorStudio(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '색과 빛의 미술 공방', zMax: Infinity },
      { name: '물감 작업실 · 초록', zMax: -15 },
      { name: '물감 작업실 · 빨강', zMax: -48 },
      { name: '빛 무대 · 노랑', zMax: -81 },
      { name: '빛 무대 · 흰색', zMax: -114 },
      { name: '비교 전시실', zMax: -147 },
    ]),
    sky: { background: 0xe3e9fa, fog: [0xe3e9fa, 70, 180], hemi: 1.4 },
  });
  const { platform, block, sign, startCheckpoint, checkpoint, finishPad } = makeKit(level);
  level.mixers = [];
  platform(0, 0, 2, 20, 20, 0xa8b8de);
  startCheckpoint('공방 입구');
  sign('색과 빛의 미술 공방', 0, 5, -5, { width: 8, color: '#4a4582', lines: ['색과 빛의 미술 공방', '발판으로 조합 → 관찰 → 작품 완성'] });
  platform(0, 0.5, -13, 10, 6, 0xbdb0e3);
  platform(0, 1, -21, 10, 6, 0xa8b8de);

  function workshop({ z, mode, targetMask, title }) {
    const light = mode === 'light';
    const deck = platform(0, 1, z + 8, 24, 24, light ? 0x46506b : 0xe7d2b1);
    const cp = checkpoint(deck, new THREE.Vector3(0, 1, z + 17), title);
    cp.noHelp = true;
    const target = mixedColor(mode, targetMask);
    const state = { z, mode, target, mask: 0, solved: false, attempts: 0, pads: [] };
    level.mixers.push(state);
    sign(title, 0, 8.5, z + 1, { width: 6, color: light ? '#364b8b' : '#8b4c32' });
    sign('겹치는 곳 관찰', 0, 7, z + 1, { width: 5 });
    const diagram = mixingDiagram(level.root, mode, 0, 4.3, z + 0.8);
    const goalSwatch = new THREE.Mesh(new THREE.PlaneGeometry(3, 3),
      new THREE.MeshBasicMaterial({ color: target.hex, toneMapped: false, fog: false }));
    goalSwatch.position.set(-6.5, 4.3, z + 0.9);
    level.root.add(goalSwatch);
    sign(`목표 · ${target.name}`, -6.5, 6.5, z + 1, { width: 4 });
    const resultSwatch = new THREE.Mesh(new THREE.PlaneGeometry(3, 1),
      new THREE.MeshBasicMaterial({ color: mixedColor(mode, 0).hex, toneMapped: false, fog: false }));
    resultSwatch.position.set(6.5, 3.7, z + 0.9);
    level.root.add(resultSwatch);
    const status = sign('결과', 6.5, 5.1, z + 1, { width: 4.8 });
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    status.material.map.dispose(); status.material.map = texture;
    status.scale.y = 2;
    const instruction = light ? ['빛을 겹치는 모형', '같은 세기로 켜요'] : ['정해진 가상 물감 모형', '실제는 재료·비율에 따라 달라요'];
    sign('구역 설명', -8.5, 4, z + 6, { width: 3.5, lines: instruction, rotY: 0.35 });
    const door = block(0, 7, z - 3, 8, 6, 0.8, light ? 0x526aa3 : 0xa77b50, { dynamic: true });
    for (const x of [-12, 12]) block(x, 13, z - 3, 16, 12, 1, light ? 0x29354f : 0xbd9974);
    block(0, 13, z - 3, 8, 6, 1, light ? 0x29354f : 0xbd9974);
    const bridge = platform(0, 1, z - 7, 8, 10, 0x929eb8);
    // 복제해 둬 다른 발판의 공유 캐시 재질을 바꾸지 않는다.
    bridge.material = bridge.material.clone();
    SOURCES[mode].forEach((source, i) => {
      const x = (i - 1) * 5;
      const material = new THREE.MeshBasicMaterial({ color: source.hex, toneMapped: false });
      const mesh = platform(x, 1.15, z + 8, 3, 3, source.hex, { material });
      sign(`${source.code} · ${source.name}`, x, 3, z + 6.2, { width: 3.5, color: '#293241' });
      state.pads.push({ x, z: z + 8, bit: 1 << i, mesh, occupied: false });
      // 한 번 선택한 재료를 글자 ON/OFF로도 확인할 수 있다.
    });
    for (const [x, action, text] of [[-5, 'clear', '조합 지우기'], [5, 'submit', '작품 완성']]) {
      const mesh = platform(x, 1.15, z + 14, 3, 3, action === 'submit' ? 0x91c788 : 0xaab1bd);
      sign(text, x, 2.8, z + 12.2, { width: 3.8, color: '#293241' });
      state.pads.push({ x, z: z + 14, action, mesh, occupied: false });
    }
    function paint() {
      const result = mixedColor(mode, state.mask);
      diagram.paint(state.mask);
      resultSwatch.material.color.setHex(result.hex);
      const selected = SOURCES[mode].filter((_, i) => state.mask & (1 << i)).map((s) => s.code).join('+');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 640, 256);
      ctx.fillStyle = '#293241'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 42px "Malgun Gothic", sans-serif';
      ctx.fillText(`결과 · ${result.name}`, 320, 72);
      ctx.font = 'bold 34px "Malgun Gothic", sans-serif';
      ctx.fillText(`${selected || (light ? '모두 꺼짐' : '흰 바탕')} ${state.solved ? '· 통과 완료' : ''}`, 320, 176);
      texture.needsUpdate = true;
    }
    let lift = 0;
    level.movers.push({ root: null, update(t, dt, player) {
      for (const pad of state.pads) {
        const p = player?.pos;
        const occupied = !!p && Math.abs(p.x - pad.x) < 1.4 && Math.abs(p.z - pad.z) < 1.4 && p.y > 0.8 && p.y < 2;
        if (occupied && !pad.occupied) {
          if (pad.bit) state.mask ^= pad.bit;
          else if (pad.action === 'clear') state.mask = 0;
          else {
            state.attempts++;
            const correct = mixedColor(mode, state.mask).hex === target.hex;
            if (correct) {
              state.solved = true;
              bridge.material.color.setHex(target.hex);
              level.onMessage?.('작품 완성! 길이 열렸어요. 조합을 바꿔 더 관찰해도 길은 유지돼요.', true);
            } else level.onMessage?.(`지금 결과는 ${mixedColor(mode, state.mask).name}이에요. 목표 ${target.name}과 비교하고 조합을 바꿔요.`, false);
          }
          paint();
        }
        pad.occupied = occupied;
      }
      lift = Math.min(1, lift + (state.solved ? dt * 2 : 0));
      door.position.y = 4 + lift * 7;
      door.userData.collider.enabled = lift < 0.95;
    } });
    state.reset = () => {
      state.mask = 0; state.solved = false; state.attempts = 0; lift = 0;
      door.position.y = 4; door.userData.collider.enabled = true;
      bridge.material.color.setHex(0x929eb8);
      state.pads.forEach((p) => { p.occupied = false; }); paint();
    };
    paint();
  }

  workshop({ z: -34, mode: 'paint', targetMask: 5, title: '물감 1 · 초록 작품' });
  platform(0, 1, -47, 8, 6, 0xbdb0e3);
  workshop({ z: -67, mode: 'paint', targetMask: 6, title: '물감 2 · 빨강 작품' });
  platform(0, 1, -80, 8, 6, 0x8e9dc5);
  workshop({ z: -100, mode: 'light', targetMask: 3, title: '빛 1 · 노랑 무대' });
  platform(0, 1, -113, 8, 6, 0x8e9dc5);
  workshop({ z: -133, mode: 'light', targetMask: 7, title: '빛 2 · 흰색 무대' });
  platform(0, 1, -146, 8, 6, 0xbdb0e3);
  const goal = platform(0, 1, -159, 24, 18, 0xaabbe1);
  sign('비교 전시실', 0, 8, -160, { width: 6, lines: ['물감과 빛은 다르게 섞여요', '세 가지를 모두 사용했을 때 비교해요'] });
  mixingDiagram(level.root, 'paint', -6, 4.5, -160, 7, 5);
  mixingDiagram(level.root, 'light', 6, 4.5, -160, 7, 5);
  sign('물감 모형 · 겹친 곳은 검정', -6, 1.9, -160, { width: 6 });
  sign('빛 모형 · 겹친 곳은 흰색', 6, 1.9, -160, { width: 6 });
  finishPad(goal, -156);
  level.setSeed = (s) => { level.seed = s; level.mixers.forEach((m) => m.reset()); };
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.mixers.forEach((m) => m.reset()); };
  level.setSeed(seed);
  return level;
}
