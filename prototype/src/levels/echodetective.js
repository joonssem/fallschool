// 메아리 탐정단: 방향을 정해 소리를 보내고, 되돌아오는 시간 단서로 동굴 갈림길을 탐험한다.
// 갈림길마다 한쪽 굴은 막다른 굴(반사면이 가까워 메아리가 빨리 돌아온다), 다른 쪽은 다음 동굴로 이어지는 깊은 굴이다.
// 굴 입구는 어두운 장막으로 가려 안이 보이지 않는다. 어느 쪽이 막혔는지는 경기 시드로 바뀌므로(같은 방은 같다) 외워서는 알 수 없다.
//   막다른 굴 끝에는 수정 조각이 있다(선택). 들어가면 조각을 얻지만 되돌아 나와야 한다.
//   깊은 굴은 바로 다음 동굴로 이어진다. → 스캔해서 "조각을 먼저 주울지, 곧장 갈지"를 고른다. 스캔 안 해도 완주된다.
import * as THREE from 'three';
import { createLevel, makeKit, finalizeLevel, sectionFinder } from './kit.js';
import { rngFor, pick } from './variants.js';

// 거리 후보: 뒤로 갈수록 가까운 쪽과 먼 쪽의 차이가 작아 시간을 더 주의해 비교해야 한다.
export const ECHO_STATIONS = [
  { id: 'entrance', name: '입구 동굴', z: -22, near: [5, 6], far: [12, 13] },
  { id: 'crystal', name: '수정 동굴', z: -60, near: [6, 7], far: [10, 11] },
  { id: 'lake', name: '지하 호수', z: -98, near: [8], far: [10] },
];
export const GAME_SOUND_SPEED = 20; // 임의 거리 단위/실제 화면 초. 실제 음속이 아닌 애니메이션 속도
export const echoRoundTrip = (distance) => 2 * distance / GAME_SOUND_SPEED;

/** 시드별 배치: 갈림길마다 막다른(가까운) 쪽과 두 반사면 거리 */
export function echoLayout(seed) {
  return ECHO_STATIONS.map((spec, i) => {
    const rand = rngFor(seed, 40 + i);
    const nearSide = rand() < 0.5 ? -1 : 1;
    const near = pick(rand, spec.near), far = pick(rand, spec.far);
    return { nearSide, left: nearSide < 0 ? near : far, right: nearSide < 0 ? far : near };
  });
}

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
  sign('탐험 방법', 0, 4, -12, { width: 10, lines: ['실제 소리는 사방으로 퍼져요. 여기서는 한 방향씩 보내는 모형이에요.', '메아리가 빨리 오면 가까이 벽이 있어요: 막다른 굴(수정 조각)', '늦게 오면 굴이 깊어요: 다음 동굴로 이어져요'] });

  const curtainMat = new THREE.MeshBasicMaterial({ color: 0x070d18, transparent: true, opacity: 0.94, side: THREE.DoubleSide });
  const stations = ECHO_STATIONS.map((spec, index) => {
    const hubZ = spec.z;
    const padZ = hubZ + 4;
    platform(0, 0, hubZ, 24, 16, floorColor);
    if (index === 0) checkpoint(platform(0, 0, hubZ + 1, 24, 10, 0x6d8293), new THREE.Vector3(0, 0, hubZ + 3), '첫 메아리');
    sign(`${index + 1}. ${spec.name}`, 0, 7, hubZ + 7, { width: 9, lines: ['원판을 밟아 좌우 굴에 짧은 신호를 보내요', '돌아오는 시간이 짧은 쪽은 막다른 굴이에요'] });
    const pads = [-1, 1].map((side) => {
      const x = side * 6;
      const mesh = platform(x, 0, padZ, 5, 4, side < 0 ? 0x64b5d4 : 0xd49a57);
      sign(side < 0 ? '왼쪽 굴 스캔' : '오른쪽 굴 스캔', x, 3, padZ, { width: 4 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.09, 8, 32), mat(side < 0 ? 0x74e6ff : 0xffce75, { emissive: side < 0 ? 0x12627a : 0x70420c, emissiveIntensity: 0.6 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(x, 1.4, padZ - 2); ring.visible = false; root.add(ring);
      // 반사면: 메아리가 돌아오기 전에는 어둠 속이라 보이지 않는다(장식, 충돌 없음). 위치는 시드 배치에 맞춰 옮긴다.
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 7, 7), new THREE.MeshStandardMaterial({ color: side < 0 ? 0x8eeaff : 0xffd178, roughness: 0.55 }));
      wall.position.set(x, 3.5, padZ - 2); wall.visible = false; root.add(wall);
      return { side, x, distance: 0, routeName: '', mesh, ring, wall, padZ, active: false, cooldown: 0, elapsed: 0 };
    });
    const routePads = [-1, 1].map((side) => {
      const x = side * 7;
      const z0 = hubZ - 9, z1 = hubZ - 22;
      platform(x, 0, (z0 + z1) / 2, 8, z0 - z1 + 3, side < 0 ? 0x4b7888 : 0x8a704f);
      // 굴: 양옆 벽 + 어두운 입구 장막(지나갈 수 있다). 막다른 쪽만 끝 벽이 켜진다.
      for (const wx of [x - 4.3, x + 4.3]) block(wx, 6, hubZ - 12.6, 0.6, 6, 8.2, 0x2a3c50);
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), curtainMat);
      mouth.position.set(x, 3, hubZ - 8.6); root.add(mouth);
      const endWall = block(x, 6, hubZ - 16.8, 8, 6.5, 0.8, 0x3b5068);
      const cache = new THREE.Mesh(new THREE.OctahedronGeometry(1.05), mat(side < 0 ? 0x8fe7ee : 0xffd178, { emissive: side < 0 ? 0x287888 : 0x846018, emissiveIntensity: 0.55 }));
      cache.position.set(x, 2, hubZ - 14.5); cache.visible = false; root.add(cache);
      const marker = sign('막다른 굴', x, 4.2, hubZ - 16.2, { width: 5, lines: ['막다른 굴', '메아리가 빨리 돌아온 쪽이에요', '돌아 나가 깊은 굴로 가요'] });
      marker.visible = false;
      return { side, x, z0, z1, cache, marker, endWall, near: false, distance: 0, found: false, explored: false };
    });
    platform(0, 0, hubZ - 25, 24, 16, 0x697f8e);
    sign('깊은 굴 출구', 0, 5, hubZ - 24, { width: 8, lines: ['깊은 굴을 지나왔어요', '막다른 굴의 조각은 선택이에요'] });
    if (index < ECHO_STATIONS.length - 1) platform(0, 0, hubZ - 34, 12, 12, floorColor);
    state.stations.push({ spec, pads, routePads, scanTimes: {}, chosen: null, hubZ });
    return state.stations.at(-1);
  });
  const finishZ = ECHO_STATIONS.at(-1).z - 37;
  const lake = platform(0, 0, finishZ - 2, 22, 18, 0x315a70);
  checkpoint(lake, new THREE.Vector3(0, 0, finishZ + 1), '지하 호수');
  sign('동굴 지도 완성', 0, 7, finishZ - 3, { width: 8, lines: ['막다른 굴 세 곳의 조각을 모으면 별!', '스캔하지 않아도 완주할 수 있어요'] });
  finishPad(lake, finishZ - 8);
  challengeStar(9, 0, finishZ - 1);
  state.exit = { z: finishZ - 8 };
  state.crystalDisplay = [-1, 0, 1].map((x) => {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.85), mat(0x8fe7ee, { emissive: 0x287888, emissiveIntensity: 0.8 }));
    crystal.position.set(x * 3, 2.8, finishZ - 1); crystal.visible = false; root.add(crystal); return crystal;
  });
  // 조각 세 개 별: 다 모으면 호수 가운데에 나타난다(그 전에는 닿지 않는 곳에 숨긴다)
  const mapStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.8 }));
  const MAP_STAR_AT = new THREE.Vector3(0, 1.4, finishZ + 3), HIDDEN = new THREE.Vector3(0, -200, 0);
  mapStar.position.copy(HIDDEN); root.add(mapStar);
  state.mapStar = { mesh: mapStar, got: false };
  level.stars.push(state.mapStar);

  function applyLayout(s) {
    const layout = echoLayout(s);
    state.layout = layout;
    stations.forEach((station, i) => {
      const L = layout[i];
      for (const pad of station.pads) {
        pad.distance = pad.side < 0 ? L.left : L.right;
        pad.routeName = pad.side === L.nearSide ? '막다른 굴' : '깊은 굴';
        pad.wall.position.x = pad.x + pad.side * pad.distance;
      }
      for (const route of station.routePads) {
        route.near = route.side === L.nearSide;
        route.distance = route.side < 0 ? L.left : L.right;
        route.endWall.visible = route.near;
        route.endWall.userData.collider.enabled = route.near;
      }
    });
  }

  state.scan = (stationIndex, side) => {
    const station = stations[stationIndex];
    const pad = station?.pads.find((p) => p.side === side);
    if (!pad) return null;
    const roundTrip = echoRoundTrip(pad.distance);
    const roundTripSeconds = roundTrip;
    station.pads.forEach((other) => { if (other !== pad) other.active = false; });
    pad.active = true; pad.elapsed = 0; pad.ring.visible = true; pad.ring.position.x = pad.x;
    station.echo = { side, distance: pad.distance, roundTrip, roundTripSeconds, routeName: pad.routeName };
    level.onMessage?.(`${side < 0 ? '왼쪽' : '오른쪽'} 굴로 신호를 보냈어요. 되돌아오는 파동을 살펴봐요.`, true);
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
          if (!outbound) pad.wall.visible = true; // 반사된 순간 반사면이 드러난다
          if (pad.elapsed >= echoRoundTrip(pad.distance)) {
            pad.active = false; pad.ring.visible = false;
            station.scanTimes[pad.side] = pad.elapsed; state.scans++;
            const other = station.scanTimes[-pad.side];
            const compare = other === undefined ? ' 반대쪽도 보내 비교해 봐요.' : pad.elapsed < other ? ' 이쪽이 더 빨라요: 가까운 벽, 막다른 굴!' : ' 이쪽이 더 늦어요: 깊은 굴!';
            level.onMessage?.(`${pad.side < 0 ? '왼쪽' : '오른쪽'} 메아리 왕복 ${pad.elapsed.toFixed(1)}초 · 화면 모형 시간.${compare}`, true);
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
            if (state.fragments === stations.length && !state.mapStar.got) mapStar.position.copy(MAP_STAR_AT);
            level.onMessage?.(`막다른 굴에서 수정 조각을 찾았어요 (${state.fragments}/${stations.length}). 돌아 나가 깊은 굴로 가요.`, true);
          } else {
            level.onMessage?.(`${route.side < 0 ? '왼쪽' : '오른쪽'}은 깊은 굴이에요. 다음 동굴로 이어져요.`, true);
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
        pad.active = false; pad.elapsed = 0; pad.cooldown = 0; pad.ring.visible = false; pad.ring.position.x = pad.x; pad.ring.scale.setScalar(1);
        pad.wall.visible = false;
      }
      for (const route of station.routePads) { route.found = false; route.explored = false; route.cache.visible = false; route.marker.visible = false; route.cache.scale.setScalar(1); route.cache.material.emissiveIntensity = 0.55; }
    }
    state.crystalDisplay.forEach((crystal) => { crystal.visible = false; });
    mapStar.position.copy(HIDDEN);
    applyLayout(s);
  };
  finalizeLevel(level);
  const resetProgress = level.resetProgress;
  level.resetProgress = () => { resetProgress(); level.setSeed(level.seed); };
  level.setSeed(seed);
  return level;
}
