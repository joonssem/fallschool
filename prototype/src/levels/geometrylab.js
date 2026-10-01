// 도형 건축 연구소: 전개도 실제 접기 → 정육면체 발판, 대칭 선택 → 다리.
// 작업 상태는 학생별. 친구와 설명을 주고받되 혼자 남아도 계속 진행한다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { analyzeCubeNet, reflectPoint } from './geometry-math.js';

const FACE_COLORS = [0x82b6f4, 0x97cba9, 0xf3c979, 0xcbace2, 0xf4a6a6, 0x86ced1];
export const NET_OPTIONS = [
  [
    [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1], [0, -2]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
  ],
  [
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
    [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, -1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  ],
];

// 면을 잇는 실제 경첩 계층. 옳고 그른 전개도 모두 같은 방식으로 접는다.
function foldingModel(root, cells, x, y, z) {
  const analysis = analyzeCubeNet(cells);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  root.add(group);
  const cx = (Math.min(...cells.map((c) => c[0])) + Math.max(...cells.map((c) => c[0]))) / 2;
  const cy = (Math.min(...cells.map((c) => c[1])) + Math.max(...cells.map((c) => c[1]))) / 2;
  const size = cells.some(([px]) => px >= 4) ? 0.8 : 1.05;
  const nodes = Array(6), hinges = [], meshes = [], outlines = [];
  const rootNode = new THREE.Group();
  rootNode.position.set((cells[0][0] - cx) * size, (cells[0][1] - cy) * size, 0);
  group.add(rootNode);
  nodes[0] = rootNode;
  function faceMesh(index, node) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[index], side: THREE.DoubleSide }));
    node.add(mesh); meshes[index] = mesh;
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x31415b }));
    outlines[index] = outline;
    node.add(outline);
  }
  faceMesh(0, rootNode);
  const pending = analysis.faces.filter((f) => f.parent >= 0);
  while (pending.length) {
    const i = pending.findIndex((f) => nodes[f.parent]);
    if (i < 0) break;
    const f = pending.splice(i, 1)[0];
    const hinge = new THREE.Group();
    hinge.position.set(f.dx * size / 2, f.dy * size / 2, 0);
    nodes[f.parent].add(hinge);
    const node = new THREE.Group();
    node.position.set(f.dx * size / 2, f.dy * size / 2, 0);
    hinge.add(node); nodes[f.index] = node;
    hinges.push({ hinge, dx: f.dx, dy: f.dy });
    faceMesh(f.index, node);
  }
  return { group, meshes, analysis, size, setFold(amount) {
    for (const { hinge, dx, dy } of hinges) {
      hinge.rotation.y = -dx * amount * Math.PI / 2;
      hinge.rotation.x = dy * amount * Math.PI / 2;
    }
    // 살짝 옆에서 보아 접힌 면의 깊이가 드러나게 한다.
    group.rotation.y = amount * 0.45;
    group.rotation.x = -amount * 0.2;
    group.scale.setScalar(1 + amount * 0.6);
    meshes.forEach((m, i) => m.material.color.setHex(amount > 0.9 && analysis.overlaps.includes(i) ? 0xff5263 : FACE_COLORS[i]));
    outlines.forEach((outline) => outline.material.color.setHex(amount > 0.9 && !analysis.valid ? 0xff263e : 0x31415b));
    group.updateMatrixWorld(true);
  } };
}

export function buildGeometryLab(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '도형 건축 연구소', zMax: Infinity },
      { name: '접기 실험실', zMax: -15 },
      { name: '상자 발판 공장', zMax: -48 },
      { name: '세로 기준선 대칭', zMax: -81 },
      { name: '가로 기준선 대칭', zMax: -114 },
      { name: '완성 전시실', zMax: -147 },
    ]),
    sky: { background: 0xdbeef5, fog: [0xdbeef5, 70, 180], hemi: 1.4 },
  });
  const { platform, block, sign, startCheckpoint, checkpoint, finishPad } = makeKit(level);
  level.builders = [];
  platform(0, 0, 2, 20, 20, 0xa5c6d3);
  startCheckpoint('연구소 입구');
  sign('도형 건축 연구소', 0, 5, -5, { width: 8, color: '#315a78', lines: ['도형 건축 연구소', '접어서 발판 만들기 · 대칭으로 다리 만들기'] });
  platform(0, 0.5, -13, 10, 6, 0xb4d6e3);
  platform(0, 1, -21, 10, 6, 0xa5c6d3);

  function room(z, title, kind) {
    const deck = platform(0, 1, z + 8, 26, 24, 0xc2dae4);
    const cp = checkpoint(deck, new THREE.Vector3(0, 1, z + 17), title);
    cp.noHelp = true;
    sign(title, 0, 8.5, z + 1, { width: 6, color: '#315a78' });
    const door = block(0, 7, z - 3, 8, 6, 0.8, 0x658ca6, { dynamic: true });
    for (const x of [-12, 12]) block(x, 13, z - 3, 16, 12, 1, 0x709bb1);
    block(0, 13, z - 3, 8, 6, 1, 0x709bb1);
    const bridge = kind === 'net'
      ? [block(0, 1, z - 6, 4, 4, 4, 0x97cba9), block(0, 1, z - 10, 4, 4, 4, 0x82b6f4)]
      : [platform(-2, 1, z - 7, 4, 10, 0x97cba9), platform(2, 1, z - 7, 4, 10, 0x82b6f4)];
    const state = { z, kind, selected: -1, solved: false, pads: [], attempts: 0, fold: 0, folding: false, reported: false, door, bridge };
    level.builders.push(state);
    const status = sign('안내', 0, 1.6, z + 13, { width: 5.5 });
    status.scale.y = 1.5;
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    status.material.map.dispose(); status.material.map = texture;
    const hint = (text) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1024, 384);
      ctx.fillStyle = '#293241'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 64px "Malgun Gothic", sans-serif';
      const rows = [];
      let row = '';
      for (const word of text.split(' ')) {
        const candidate = row ? `${row} ${word}` : word;
        if (row && ctx.measureText(candidate).width > 940) { rows.push(row); row = word; }
        else row = candidate;
      }
      if (row) rows.push(row);
      rows.forEach((line, i) => ctx.fillText(line, 512, 192 + (i - (rows.length - 1) / 2) * 110));
      texture.needsUpdate = true;
    };
    function pad(x, pz, label, action, option) {
      platform(x, 1.15, pz, 3, 3, action === 'submit' ? 0x97cba9 : action === 'clear' ? 0xaab1bd : 0x82b6f4);
      sign(label, x, 2.8, pz - 1.8, { width: 3.8, color: '#293241' });
      state.pads.push({ x, z: pz, action, option, occupied: false });
    }
    [-7, 0, 7].forEach((x, i) => pad(x, z + 8, kind === 'net' ? `전개도 ${i + 1}` : `위치 ${i + 1}`, 'select', i));
    pad(-5, z + 14, kind === 'net' ? '다시 펼치기' : '선택 지우기', 'clear');
    pad(5, z + 14, kind === 'net' ? '접어 보기' : '다리 완성', 'submit');
    let lift = 0;
    state.show = hint;
    state.unlock = () => {
      if (!state.solved) {
        state.solved = true;
        bridge.forEach((mesh) => { mesh.visible = true; mesh.userData.collider.enabled = true; });
        level.onMessage?.('길을 완성했어요! 더 관찰해도 열린 길은 유지돼요.', true);
      }
    };
    state.tick = (dt) => {
      lift = Math.min(1, lift + (state.solved ? dt * 2 : 0));
      door.position.y = 4 + lift * 7;
      door.updateMatrixWorld(true);
      door.userData.collider.enabled = lift < 0.95;
    };
    state.reset = () => {
      state.selected = -1; state.solved = false; state.attempts = 0;
      state.fold = 0; state.folding = false; state.reported = false; lift = 0;
      door.position.y = 4; door.updateMatrixWorld(true); door.userData.collider.enabled = true;
      bridge.forEach((mesh) => { mesh.visible = false; mesh.userData.collider.enabled = false; });
      state.pads.forEach((p) => { p.occupied = false; });
      state.refresh?.(); hint(kind === 'net' ? '전개도를 고르고 접어 보세요.' : '출발점과 대칭인 위치를 고르세요.');
    };
    level.movers.push({ root: null, update(t, dt, player) {
      for (const p of state.pads) {
        const f = player?.pos;
        const occupied = !!f && Math.abs(f.x - p.x) < 1.4 && Math.abs(f.z - p.z) < 1.4 && f.y > 0.8 && f.y < 2;
        if (occupied && !p.occupied) state.act?.(p);
        p.occupied = occupied;
      }
      state.animate?.(dt); state.tick(dt);
    } });
    return state;
  }

  function netRoom(z, options, title) {
    const state = room(z, title, 'net');
    state.options = options;
    state.models = options.map((cells, i) => foldingModel(level.root, cells, (i - 1) * 7, 4.8, z + 1));
    options.forEach((_, i) => sign(`전개도 ${i + 1}`, (i - 1) * 7, 7, z + 1, { width: 4 }));
    state.refresh = () => state.models.forEach((m, i) => m.setFold(i === state.selected ? state.fold : 0));
    state.act = (p) => {
      if (p.action === 'select') {
        state.selected = p.option; state.fold = 0; state.folding = false; state.reported = false;
        state.show(`전개도 ${state.selected + 1} 선택 · 접어 보기를 밟아요.`);
      } else if (p.action === 'clear') {
        state.fold = 0; state.folding = false; state.reported = false;
        state.show('다시 펼쳤어요. 다른 전개도와 비교해요.');
      } else if (state.selected < 0) state.show('먼저 전개도 하나를 선택해요.');
      else { state.attempts++; state.folding = true; state.reported = false; state.show('접는 중 · 면이 겹치는지 관찰해요.'); }
      state.refresh();
    };
    state.animate = (dt) => {
      if (!state.folding) return;
      state.fold = Math.min(1, state.fold + dt / 1.6);
      state.refresh();
      if (state.fold < 1 || state.reported) return;
      state.reported = true; state.folding = false;
      const result = state.models[state.selected].analysis;
      state.show(result.reason);
      if (result.valid) state.unlock();
      else level.onMessage?.('접힌 면을 비교하고 다른 전개도로 다시 도전해요.', false);
    };
  }

  function symmetryRoom(z, axis, source, options, title) {
    const state = room(z, title, 'symmetry');
    Object.assign(state, { axis, source, options, target: reflectPoint(source, axis) });
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ map: texture, fog: false, toneMapped: false }));
    board.position.set(0, 5, z + 1); level.root.add(board); state.board = board;
    state.refresh = () => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 768, 512);
      const px = (x) => 384 + x * 86, py = (y) => 256 - y * 86;
      ctx.lineWidth = 2; ctx.strokeStyle = '#c6d5df';
      for (let x = -3; x <= 3; x++) { ctx.beginPath(); ctx.moveTo(px(x), py(-2.5)); ctx.lineTo(px(x), py(2.5)); ctx.stroke(); }
      for (let y = -2; y <= 2; y++) { ctx.beginPath(); ctx.moveTo(px(-3.5), py(y)); ctx.lineTo(px(3.5), py(y)); ctx.stroke(); }
      ctx.strokeStyle = '#a65320'; ctx.lineWidth = 7; ctx.setLineDash([14, 9]); ctx.beginPath();
      if (axis.normal[0]) { ctx.moveTo(px(0), 25); ctx.lineTo(px(0), 487); }
      else { ctx.moveTo(35, py(0)); ctx.lineTo(733, py(0)); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#a65320'; ctx.font = 'bold 24px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('대칭 기준선', axis.normal[0] ? 384 : 660, axis.normal[0] ? 24 : 244);
      const mark = ([x, y], text, fill, radius) => {
        ctx.beginPath(); ctx.arc(px(x), py(y), radius, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px "Malgun Gothic", sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(text, px(x), py(y));
      };
      mark(source, '출발', '#315a78', 30);
      options.forEach((point, i) => mark(point, String(i + 1), state.selected === i ? '#a65320' : '#667788', 25));
      if (state.selected >= 0) {
        const chosen = options[state.selected];
        ctx.strokeStyle = '#a65320'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(px(source[0]), py(source[1])); ctx.lineTo(px(chosen[0]), py(chosen[1])); ctx.stroke(); ctx.setLineDash([]);
      }
      texture.needsUpdate = true;
    };
    state.act = (p) => {
      if (p.action === 'select') { state.selected = p.option; state.show(`위치 ${p.option + 1} 선택 · 기준선에서 같은 거리인가요?`); }
      else if (p.action === 'clear') { state.selected = -1; state.show('선택을 지웠어요. 기준선과 위치를 비교해요.'); }
      else if (state.selected < 0) state.show('먼저 위치 하나를 선택해요.');
      else {
        state.attempts++;
        const point = options[state.selected];
        const correct = point.every((n, i) => Math.abs(n - state.target[i]) < 1e-8);
        state.show(correct ? '기준선 양쪽의 같은 거리에 있어요. 다리 완성!' : '기준선까지 거리와 방향을 다시 비교해요.');
        if (correct) state.unlock();
        else level.onMessage?.('출발점과 선택한 위치를 기준선에 접어 겹쳐 생각해요.', false);
      }
      state.refresh();
    };
    state.refresh();
  }

  netRoom(-34, NET_OPTIONS[0], '접기 실험실 · 여섯 면');
  platform(0, 1, -47, 8, 6, 0xb4d6e3);
  netRoom(-67, NET_OPTIONS[1], '상자 공장 · 다른 전개도');
  platform(0, 1, -80, 8, 6, 0xb4d6e3);
  symmetryRoom(-100, { normal: [1, 0] }, [-2, 1], [[1, 1], [2, -1], [2, 1]], '대칭 다리 · 세로 기준선');
  platform(0, 1, -113, 8, 6, 0xb4d6e3);
  symmetryRoom(-133, { normal: [0, 1] }, [-1, -2], [[-1, 2], [1, 2], [-1, 1]], '대칭 다리 · 가로 기준선');
  platform(0, 1, -146, 8, 6, 0xb4d6e3);
  const goal = platform(0, 1, -159, 20, 18, 0x97cba9);
  sign('연구 완료!', 0, 5.5, -158, { width: 8, lines: ['연구 완료!', '면이 여섯 개면 모두 상자가 될까요?', '대칭인 점은 기준선에서 얼마나 떨어졌나요?'] });
  finishPad(goal, -156);
  level.setSeed = (s) => { level.seed = s; level.builders.forEach((b) => b.reset()); };
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.builders.forEach((b) => b.reset()); };
  level.setSeed(seed);
  return level;
}
