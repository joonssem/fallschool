// 메아리 탐정단: 방향을 정해 소리를 보내고, 되돌아오는 시간 단서로 동굴 갈림길을 탐험한다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';

export const ECHO_STATIONS = [
  { id: 'entrance', name: '입구 동굴', z: -22, left: 6, right: 12, leftName: '짧은 왼쪽 굴', rightName: '긴 오른쪽 굴' },
  { id: 'crystal', name: '수정 동굴', z: -60, left: 12, right: 6, leftName: '긴 왼쪽 굴', rightName: '짧은 오른쪽 굴' },
  { id: 'lake', name: '지하 호수', z: -98, left: 8, right: 10, leftName: '가까운 왼쪽 벽', rightName: '먼 오른쪽 벽' },
];
export const GAME_SOUND_SPEED = 20; // 임의 거리 단위/실제 화면 초. 실제 음속이 아닌 애니메이션 속도
export const echoRoundTrip = (distance) => 2 * distance / GAME_SOUND_SPEED;

export function buildEchoDetective(parent, world, { seed = 1 } = {}) {
  const level = createLevel(parent, world, {
    sectionAt: sectionFinder([
      { name: '동굴 입구', zMax: Infinity },
      { name: '방향을 정해 메아리 보내기', zMax: -18 },
      { name: '되돌아온 신호 따라 탐험', zMax: -38 },
      { name: '수정 동굴 갈림길', zMax: -56 },
      { name: '왕복 시간으로 거리 비교', zMax: -76 },
      { name: '지하 호수 탐험', zMax: -96 },
    ]),
    sky: { background: 0x182b45, fog: [0x182b45, 48, 150], hemi: 0.75 },
  });
  const { root, movers } = level;
  const { mat, block, platform, sign, startCheckpoint, checkpoint, finishPad, challengeStar } = makeKit(level);
  const state = level.echo = { stations: [], scans: 0, discoveries: 0, fragments: 0, selectedRoutes: [], finished: false };
  const floorColor = 0x53677b;
  platform(0, 0, 3, 24, 36, 0x62798b); startCheckpoint('동굴 입구');
  sign('메아리 탐정단', 0, 6, -4, { width: 10, lines: ['스캔 방향과 되돌아온 시간을 살펴요', '파동 애니메이션은 소리를 위한 게임 모형입니다'] });
  sign('탐험 방법', 0, 4, -12, { width: 10, lines: ['실제 소리는 사방으로 퍼져요. 여기서는 한 방향씩 보내는 모형이에요.', '가까운 반사면의 메아리는 더 빨리 돌아와요. 두 방향 시간을 비교해요.'] });

  function caveWall(x, z, color = 0x344b61) {
    const height = 7;
    return block(x, height, z, 2.2, height, 7, color, { castShadow: true });
  }
  // 세 구간은 모두 넓고 평평하며, 두 선택 통로 모두 안전하게 다음 동굴에 합류한다.
  const stations = ECHO_STATIONS.map((spec, index) => {
    const hubZ = spec.z;
    const padZ = hubZ + 4;
    const leftRouteX = -7, rightRouteX = 7;
    platform(0, 0, hubZ, 24, 16, floorColor);
    if (index === 0) checkpoint(platform(0, 0, hubZ + 1, 24, 10, 0x6d8293), new THREE.Vector3(0, 0, hubZ + 3), '첫 메아리');
    sign(`${index + 1}. ${spec.name}`, 0, 7, hubZ + 7, { width: 9, lines: ['원판을 밟아 좌우에 짧은 신호를 보내요', '방향은 내가 고르고, 시간은 거리 단서예요'] });
    const pads = [-1, 1].map((side) => {
      const x = side * 6;
      const distance = side < 0 ? spec.left : spec.right;
      const routeName = side < 0 ? spec.leftName : spec.rightName;
      const mesh = platform(x, 0, padZ, 5, 4, side < 0 ? 0x64b5d4 : 0xd49a57);
      sign(side < 0 ? '왼쪽 스캔' : '오른쪽 스캔', x, 3, padZ, { width: 4 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.09, 8, 32), mat(side < 0 ? 0x74e6ff : 0xffce75, { emissive: side < 0 ? 0x12627a : 0x70420c, emissiveIntensity: 0.6 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(x, 1.4, padZ - 2); ring.visible = false; root.add(ring);
      const targetX = x + side * distance;
      const wall = caveWall(targetX, padZ - 2, side < 0 ? 0x4d8190 : 0x927448);
      const detector = { side, x, distance, routeName, mesh, ring, wall, padZ, active: false, cooldown: 0, elapsed: 0, latched: false };
      return detector;
    });
    // fork lanes reach a shared, broad chamber; route choice remains open after scanning.
    const nearSide = spec.left < spec.right ? -1 : 1;
    const routePads = [-1, 1].map((side) => {
      const x = side * 7;
      const z0 = hubZ - 9, z1 = hubZ - 22;
      platform(x, 0, (z0 + z1) / 2, 8, z0 - z1 + 3, side < 0 ? 0x4b7888 : 0x8a704f);
      const cache = new THREE.Mesh(new THREE.OctahedronGeometry(1.05), mat(side < 0 ? 0x8fe7ee : 0xffd178, { emissive: side < 0 ? 0x287888 : 0x846018, emissiveIntensity: 0.55 }));
      cache.position.set(x, 2, hubZ - 15); cache.visible = false; root.add(cache);
      const distance = side < 0 ? spec.left : spec.right;
      const marker = sign(`반사면까지 ${distance} 게임 거리`, x, 4.2, hubZ - 18, { width: 5 }); marker.visible = false;
      return { side, x, z0, z1, cache, marker, near: side === nearSide, distance, found: false, explored: false };
    });
    platform(0, 0, hubZ - 25, 24, 16, 0x697f8e);
    sign('두 통로 모두 안전하게 이어져요', 0, 5, hubZ - 24, { width: 8, lines: ['가까운 반사면은 왕복 시간이 짧아요', '원하는 쪽을 골라 탐험하고 다음 신호소로 가요'] });
    if (index < ECHO_STATIONS.length - 1) platform(0, 0, hubZ - 34, 12, 12, floorColor);
    state.stations.push({ spec, pads, routePads, scanTimes: {}, chosen: null, hubZ });
    return state.stations.at(-1);
  });
  const finishZ = ECHO_STATIONS.at(-1).z - 37;
  const lake = platform(0, 0, finishZ - 2, 22, 18, 0x315a70);
  checkpoint(lake, new THREE.Vector3(0, 0, finishZ + 1), '지하 호수');
  sign('동굴 지도 완성', 0, 7, finishZ - 3, { width: 8, lines: ['가까운 메아리 쪽을 탐험해 조각을 찾아요', '스캔하지 않아도 완주할 수 있어요'] });
  finishPad(lake, finishZ - 8);
  challengeStar(9, 0, finishZ - 1);
  state.exit = { z: finishZ - 8 };
  state.crystalDisplay = [-1, 0, 1].map((x) => {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.85), mat(0x8fe7ee, { emissive: 0x287888, emissiveIntensity: 0.8 }));
    crystal.position.set(x * 3, 2.8, finishZ - 1); crystal.visible = false; root.add(crystal); return crystal;
  });

  state.scan = (stationIndex, side) => {
    const station = stations[stationIndex];
    const pad = station?.pads.find((p) => p.side === side);
    if (!pad) return null;
    const roundTrip = echoRoundTrip(pad.distance);
    const roundTripSeconds = roundTrip;
    station.pads.forEach((other) => { if (other !== pad) other.active = false; });
    pad.active = true; pad.elapsed = 0; pad.ring.visible = true; pad.ring.position.x = pad.x;
    station.echo = { side, distance: pad.distance, roundTrip, roundTripSeconds, routeName: pad.routeName };
    station.chosen = side;
    pad.wall.material.color.setHex(side < 0 ? 0x8eeaff : 0xffd178);
    level.onMessage?.(`${side < 0 ? '왼쪽' : '오른쪽'}으로 신호를 보냈어요. 되돌아오는 파동을 살펴봐요.`, true);
    return station.echo;
  };
  level.echoStations = stations;
  movers.push({ root: null, update(_t, dt, player) {
    for (const station of stations) {
      for (const pad of station.pads) {
        pad.cooldown = Math.max(0, pad.cooldown - dt);
        if (pad.active) {
          pad.elapsed = Math.min(echoRoundTrip(pad.distance), pad.elapsed + dt);
          const oneWay = echoRoundTrip(pad.distance) / 2;
          const outbound = pad.elapsed <= oneWay;
          const phase = outbound ? pad.elapsed / oneWay : 1 - (pad.elapsed - oneWay) / oneWay;
          pad.ring.position.x = THREE.MathUtils.lerp(pad.x, pad.x + pad.side * pad.distance, phase);
          pad.ring.scale.setScalar(0.35 + phase * 0.5);
          if (pad.elapsed >= echoRoundTrip(pad.distance)) {
            pad.active = false; pad.ring.visible = false;
            station.scanTimes[pad.side] = pad.elapsed; state.scans++;
            level.onMessage?.(`${pad.side < 0 ? '왼쪽' : '오른쪽'} 메아리 왕복 ${pad.elapsed.toFixed(1)}초 · 화면 모형 시간`, true);
          }
        }
        const p = player?.pos;
        const onPad = p && Math.abs(p.x - pad.x) < 2.2 && Math.abs(p.z - pad.padZ) < 1.8;
        if (onPad && !pad.active && pad.cooldown === 0) { state.scan(stations.indexOf(station), pad.side); pad.cooldown = 1.2; }
      }
      for (const route of station.routePads) {
        const p = player?.pos;
        const onRoute = p && Math.abs(p.x - route.x) < 3.3 && p.z < route.z0 && p.z > route.z1;
        if (onRoute && !route.explored) {
          route.explored = true;
          station.chosen = route.side; state.selectedRoutes.push({ station: station.spec.id, side: route.side }); state.discoveries++;
          if (route.near) {
            route.found = true; route.cache.visible = true; route.marker.visible = true;
            route.cache.material.emissiveIntensity = 1.4; route.cache.scale.setScalar(1.35);
            state.fragments++; state.crystalDisplay[stations.indexOf(station)].visible = true;
            level.onMessage?.(`${route.side < 0 ? '왼쪽' : '오른쪽'} 길에서 가까운 반사면 조각을 찾았어요. 표식에서 거리를 확인하고 다음 동굴로 가요.`, true);
          } else {
            level.onMessage?.(`${route.side < 0 ? '왼쪽' : '오른쪽'} 통로를 탐험했어요. 긴 메아리 쪽에도 안전한 길이 이어져요.`, true);
          }
        }
      }
    }
  } });
  level.setSeed = (s) => {
    level.seed = s;
    state.scans = 0; state.discoveries = 0; state.fragments = 0; state.selectedRoutes = []; state.finished = false;
    for (const station of stations) {
      station.echo = null; station.chosen = null; station.scanTimes = {};
      for (const pad of station.pads) {
        pad.active = false; pad.elapsed = 0; pad.cooldown = 0; pad.latched = false; pad.ring.visible = false; pad.ring.position.x = pad.x; pad.ring.scale.setScalar(1);
        pad.wall.material.color.setHex(pad.side < 0 ? 0x4d8190 : 0x927448);
      }
      for (const route of station.routePads) { route.found = false; route.explored = false; route.cache.visible = false; route.marker.visible = false; route.cache.scale.setScalar(1); route.cache.material.emissiveIntensity = 0.55; }
    }
    state.crystalDisplay.forEach((crystal) => { crystal.visible = false; });
  };
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.setSeed(level.seed); };
  level.setSeed(seed);
  return level;
}
