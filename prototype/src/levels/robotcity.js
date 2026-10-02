// 명령 택배 로봇 도시: 학생이 명령을 고르고 실제 주행을 관찰해 배달한다.
// 명령은 짧은 미리보기 발판으로 고르고, 실행 장면은 실제 월드의 로봇과 경로로 나타난다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';

export const ROBOT_STOPS = [
  { name: '우체국 배송', start: [0, 0], target: [0, -6], dirs: [0, 0, 0], required: ['forward', 'forward', 'forward'] },
  { name: '모퉁이 배송', start: [0, -47], target: [2, -49], dirs: [0, 0, 1], required: ['forward', 'right', 'forward'] },
  { name: '공원 배송', start: [0, -82], target: [4, -84], dirs: [0, 0, 1, 1], required: ['forward', 'right', 'forward', 'forward'] },
];

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const same = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;

export function runRobotCommands(start, direction, commands) {
  const path = [start.slice()];
  let dir = direction;
  let pos = start.slice();
  for (const command of commands) {
    if (command === 'left') dir = (dir + 3) % 4;
    else if (command === 'right') dir = (dir + 1) % 4;
    else if (command === 'forward') {
      pos = [pos[0] + DIRS[dir][0] * 2, pos[1] + DIRS[dir][1] * 2];
      path.push(pos.slice());
    }
  }
  return { path, direction: dir, position: pos };
}

export function buildRobotCity(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '로봇 우체국', zMax: Infinity },
      { name: '짧은 배송', zMax: -15 },
      { name: '모퉁이 배송', zMax: -55 },
      { name: '공원 배송', zMax: -90 },
      { name: '도시 배송 완료', zMax: -125 },
    ]),
    sky: { background: 0xb9d8ee, fog: [0xb9d8ee, 75, 185], hemi: 1.5 },
  });
  const { root, movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, challengeStar } = makeKit(level);
  level.deliveries = [];
  platform(0, 0, 2, 20, 20, 0x9ad8c5); startCheckpoint('로봇 우체국');
  sign('명령 택배 로봇 도시', 0, 6, -5, { width: 10, lines: ['명령을 고르고 실행해요', '로봇의 길을 보고 배송을 완성해요'] });
  sign('명령 발판을 골라요', 0, 3, 3, { width: 8, lines: ['앞으로 · 왼쪽 회전 · 오른쪽 회전', '명령은 짧게, 경로는 눈으로 확인'] });
  platform(0, 0.5, -13, 12, 6, 0xb8e0d2); platform(0, 1, -21, 12, 8, 0x9ad8c5);

  function makeRobot(x, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.8), mat(0x3976a8, { roughness: 0.4 }));
    body.position.y = 0.8; group.add(body);
    const packageBox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.7, 0.75), mat(0xffc857));
    packageBox.position.set(0, 1.45, -0.1); group.add(packageBox);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.08), mat(0xeaffff, { emissive: 0x9be7ff }));
    eye.position.set(0, 0.95, -0.94); group.add(eye);
    group.position.set(x, 0, z); root.add(group);
    return group;
  }

  function station(config, index) {
    const z = [-31, -66, -101][index];
    const deck = platform(0, 1, z + 8, 22, 24, [0xd7e8ce, 0xf3dfbd, 0xc9d9f0][index]);
    checkpoint(deck, new THREE.Vector3(0, 1, z + 17), config.name);
    sign(config.name, 0, 13, z + 2, { width: 8 });
    const robotStart = [0, z + 1];
    const target = config.target;
    // 짧은 도로망은 타일 표식만 보여 주고, 캐릭터 점프는 필요 없다.
    for (let i = -1; i <= 1; i++) {
      platform(i * 4, 1.05, z - 5, 3.6, 24, 0x8a9aa5, { thick: 0.18 });
      for (let j = 0; j < 4; j++) block(i * 4, 1.16, z - 1 - j * 4, 0.12, 0.025, 1.4, 0xf7f2d0);
    }
    const startPad = platform(-8, 1.15, z + 1, 3, 3, 0x75c9a5); sign('출발', -8, 3, z - 0.8, { width: 2.8 });
    const targetBuilding = block(target[0], 4.8, target[1] + z + 1, 4, 7.6, 4, 0xf2a65a, { castShadow: true });
    const door = block(0, 5, z - 10.5, 12, 8, 0.8, 0x566b7b, { dynamic: true });
    const roadBridge = platform(0, 1, z - 13, 12, 5, 0xa7c7d5);
    const robot = makeRobot(robotStart[0], robotStart[1]);
    const grid = [];
    for (let k = 0; k < config.required.length; k++) {
      const x = -6 + k * 4;
      block(x, 3.2, z + 12, 2.6, 0.15, 2.6, 0xe9f0f2);
      const label = config.required[k] === 'forward' ? '앞으로' : config.required[k] === 'left' ? '왼쪽' : '오른쪽';
      const tile = platform(x, 1.15, z + 12, 2.4, 2.4, 0xb9c4d0);
      tile.material = tile.material.clone();
      sign(label, x, 3, z + 10.1, { width: 3.2 });
      grid.push({ x, z: z + 12, command: config.required[k], mesh: tile, occupied: false });
    }
    const runPad = platform(0, 1.15, z + 19, 4, 3, 0xf4c95d); sign('로봇 실행', 0, 3.3, z + 17, { width: 4 });
    const resetPad = platform(7, 1.15, z + 19, 3, 3, 0xd7e0e5); sign('명령 지우기', 7, 3.3, z + 17, { width: 4 });
    const message = sign('명령을 골라요', 0, 2.7, z + 22, { width: 9 });
    const msgCanvas = document.createElement('canvas'); msgCanvas.width = 768; msgCanvas.height = 128;
    const ctx = msgCanvas.getContext('2d'); const tex = new THREE.CanvasTexture(msgCanvas); tex.colorSpace = THREE.SRGBColorSpace;
    message.material.map.dispose(); message.material.map = tex;
    const showMessage = (text) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 768, 128); ctx.fillStyle = '#263238'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 64); tex.needsUpdate = true; };
    const state = { config, index, robot, targetBuilding, door, roadBridge, grid, commands: [], path: [], deliveries: 0, solved: false, running: false, runAt: 0, startPad, runPad, resetPad, status: showMessage, message: '명령을 골라요' };
    level.deliveries.push(state);
    const pathPoints = [];
    for (let i = 0; i <= config.required.length; i++) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffef99 }));
      marker.position.set(0, 1.3, z + 1); marker.visible = false; root.add(marker); pathPoints.push(marker);
    }
    state.markers = pathPoints;
    state.reset = () => {
      state.commands = []; state.path = []; state.solved = false; state.running = false; state.runAt = 0;
      state.message = '명령을 골라요'; showMessage(state.message); robot.position.set(robotStart[0], 0, robotStart[1]); robot.rotation.y = 0;
      door.position.y = 1; door.userData.collider.enabled = true; roadBridge.material.color.setHex(0xa7c7d5);
      pathPoints.forEach((p) => { p.visible = false; }); grid.forEach((g) => { g.mesh.material.color.setHex(0xb9c4d0); g.occupied = false; });
    };
    state.run = () => {
      if (state.running || state.solved || state.commands.length === 0) return;
      const result = runRobotCommands(robotStart, config.dirs[0], state.commands);
      state.path = result.path.map(([x, zz]) => [x, zz + z + 1]);
      state.path.forEach(([x, zz], i) => { if (pathPoints[i]) { pathPoints[i].position.set(x, 1.3, zz); pathPoints[i].visible = true; } });
      state.finalDirection = result.direction;
      state.targetReached = same(result.position, target);
      state.running = true; state.runAt = 0; state.message = '로봇이 명령을 실행해요'; showMessage(state.message);
    };
    state.update = (t, dt) => {
      if (!state.running) return;
      state.runAt += dt;
      const segment = Math.min(state.path.length - 1, Math.floor(state.runAt / 0.45));
      const from = state.path[Math.max(0, segment - 1)] || state.path[0];
      const to = state.path[segment] || from;
      const blend = THREE.MathUtils.clamp((state.runAt - segment * 0.45) / 0.45, 0, 1);
      robot.position.set(THREE.MathUtils.lerp(from[0], to[0], blend), 0, THREE.MathUtils.lerp(from[1], to[1], blend));
      const deltaX = to[0] - from[0], deltaZ = to[1] - from[1];
      if (Math.abs(deltaX) + Math.abs(deltaZ) > 0.01) robot.rotation.y = Math.atan2(-deltaX, -deltaZ);
      else robot.rotation.y = state.finalDirection * Math.PI / 2;
      if (state.runAt < Math.max(0.55, (state.path.length - 1) * 0.45)) return;
      state.running = false;
      if (state.targetReached) {
        state.solved = true; state.message = '배송 성공! 건너갈 길이 생겼어요.'; showMessage(state.message);
        roadBridge.material.color.setHex(0x70d6a5); targetBuilding.material.color.setHex(0x8bd17c);
        level.onMessage?.(state.message, true);
        state.deliveries++;
      } else {
        state.message = '배송지에 도착하지 않았어요. 지나온 길을 보고 명령을 고쳐요.'; showMessage(state.message);
        level.onMessage?.(state.message, false);
      }
    };
    movers.push({ root: null, update(t, dt, player) {
      state.update(t, dt);
      if (!player || state.running || state.solved) return;
      const p = player.pos;
      for (const g of grid) {
        const occupied = Math.abs(p.x - g.x) < 1.2 && Math.abs(p.z - g.z) < 1.2 && p.y > 0.8 && p.y < 2;
        if (occupied && !g.occupied) {
          if (state.commands.length < 6) state.commands.push(g.command);
          g.mesh.material.color.setHex(g.command === 'forward' ? 0x68c99a : g.command === 'left' ? 0x67a9e5 : 0xe99361);
          showMessage(`명령 ${state.commands.length}개 · 실행 발판에서 로봇을 출발시켜요`);
        }
        g.occupied = occupied;
      }
      const onRun = Math.abs(p.x) < 1.8 && Math.abs(p.z - (z + 19)) < 1.7 && p.y > 0.8 && p.y < 2;
      if (onRun && !state.runOccupied) state.run(); state.runOccupied = onRun;
      const onReset = Math.abs(p.x - 7) < 1.4 && Math.abs(p.z - (z + 19)) < 1.5 && p.y > 0.8 && p.y < 2;
      if (onReset && !state.resetOccupied) { state.reset(); }
      state.resetOccupied = onReset;
      state.runOccupied = onRun;
    } });
  }

  ROBOT_STOPS.forEach(station);
  for (const z of [-44, -79, -114]) platform(0, 1, z, 12, 8, 0xb8e0d2);
  const finish = platform(0, 1, -130, 24, 18, 0xffdc8a);
  sign('도시 배송 완료!', 0, 7, -130, { width: 9, lines: ['세 곳의 배송이 끝났어요', '지름길 명령은 선택 도전이에요'] });
  finishPad(finish, -126);
  challengeStar(10, 1, -119);
  level.setSeed = (s) => { level.seed = s; level.deliveries.forEach((d) => d.reset()); };
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.deliveries.forEach((d) => d.reset()); };
  level.setSeed(seed);
  return level;
}
