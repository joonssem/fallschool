import './harness.mjs';
import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { ECHO_STATIONS, GAME_SOUND_SPEED, echoRoundTrip, buildEchoDetective } from '../src/levels/echodetective.js';
import { MAPS, mapById } from '../src/levels/index.js';

const T = tally('메아리 탐정단');
T.check('새 맵 선택 목록 등록', { ok: mapById('echodetective').id === 'echodetective', why: `${MAPS.length} maps` });
T.check('메아리 왕복 시간 모델은 이동 거리가 길수록 증가', { ok: GAME_SOUND_SPEED > 0 && echoRoundTrip(15) > echoRoundTrip(8), why: `${echoRoundTrip(8)}, ${echoRoundTrip(15)}` });
T.check('메아리는 표면 반사 뒤 돌아오는 왕복 신호', { ok: echoRoundTrip(6) === 0.6 && echoRoundTrip(12) === 1.2 && ECHO_STATIONS.length === 3, why: `${ECHO_STATIONS.length} stations` });
const world = new PhysicsWorld();
const level = buildEchoDetective(new THREE.Scene(), world, { seed: 12 });
const first = level.echo.scan(0, -1);
T.check('스캔 때 거리 숫자 없이 방향 신호 애니메이션 시작', { ok: first.side === -1 && first.roundTripSeconds === echoRoundTrip(first.distance) && level.echo.scans === 0 && level.echoStations[0].pads[0].active, why: JSON.stringify(first) });
level.update(0, first.roundTripSeconds / 2, null);
T.check('파동이 실제 표면에 닿는 위치까지 나감', { ok: Math.abs(level.echoStations[0].pads[0].ring.position.x - (level.echoStations[0].pads[0].x - ECHO_STATIONS[0].left)) < 1e-6, why: '' });
level.update(0.3, 0.15, null);
T.check('반사된 파동이 출발 쪽으로 돌아옴', { ok: level.echoStations[0].pads[0].ring.position.x > level.echoStations[0].pads[0].x - ECHO_STATIONS[0].left, why: '' });
for (let t = 0.45; t < first.roundTripSeconds; t += 1 / 60) level.update(t, 1 / 60, null);
T.check('가까운 메아리가 짧은 실제 화면 시간에 왕복', { ok: !level.echoStations[0].pads[0].active && level.echoStations[0].scanTimes[-1] === echoRoundTrip(ECHO_STATIONS[0].left) && level.echo.scans === 1, why: JSON.stringify(level.echoStations[0].scanTimes) });
const far = level.echo.scan(0, 1);
T.check('먼 반사면 애니메이션은 더 오래 걸림', { ok: far.roundTripSeconds > first.roundTripSeconds && level.echoStations[0].pads[1].active, why: `${first.roundTripSeconds} vs ${far.roundTripSeconds}` });
for (let t = 0; t < far.roundTripSeconds; t += 1 / 60) level.update(t, 1 / 60, null);
T.check('양쪽 시간만으로 가까운 방향 비교 가능', { ok: level.echoStations[0].scanTimes[-1] < level.echoStations[0].scanTimes[1], why: JSON.stringify(level.echoStations[0].scanTimes) });
T.check('세 지점에 체크포인트와 모든 갈림길 선택이 있음', { ok: level.checkpoints.length >= 3 && level.echoStations.every((s) => s.routePads.length === 2), why: `${level.checkpoints.length} checkpoints` });
T.check('반사면 벽 장식은 통로 밖에 있고 충돌 가능', { ok: level.echoStations.every((s) => s.pads.every((p) => p.wall.userData.collider.enabled)), why: '' });
for (const [i, station] of level.echoStations.entries()) {
  const route = station.routePads.find((r) => r.near);
  level.update(0, 1 / 60, { pos: new THREE.Vector3(route.x, 1, (route.z0 + route.z1) / 2) });
  T.check(`${station.spec.name}: 가까운 통로의 보상만 발견`, { ok: route.found && route.cache.visible && route.marker.visible && level.echo.fragments === i + 1 && level.echo.discoveries === i + 1, why: '' });
}
const farWorld = new PhysicsWorld(); const farLevel = buildEchoDetective(new THREE.Scene(), farWorld, { seed: 3 });
const farStation = farLevel.echoStations[0], farRoute = farStation.routePads.find((r) => !r.near);
farLevel.update(0, 1 / 60, { pos: new THREE.Vector3(farRoute.x, 1, (farRoute.z0 + farRoute.z1) / 2) });
T.check('먼 쪽 통로도 보상 없이 안전하게 탐험 가능', { ok: farRoute.explored && !farRoute.cache.visible && farLevel.echo.fragments === 0, why: '' });
level.resetProgress();
T.check('안전 재시도로 스캔·발견·조각 상태 초기화', { ok: level.echo.scans === 0 && level.echo.discoveries === 0 && level.echo.fragments === 0 && level.echoStations.every((s) => !s.routePads.some((r) => r.found)), why: '' });
const walkWorld = new PhysicsWorld();
const walkLevel = buildEchoDetective(new THREE.Scene(), walkWorld, { seed: 7 });
const targets = [];
for (const station of walkLevel.echoStations) {
  const route = station.routePads.find((r) => r.near);
  const pad = station.pads.find((p) => p.side === route.side);
  targets.push([pad.x, pad.padZ], [0, station.hubZ - 5], [route.x, (route.z0 + route.z1) / 2], [0, station.hubZ - 27]);
}
targets.push([0, walkLevel.echo.exit.z - 2]);
const walking = run({ level: walkLevel, world: walkWorld }, [0, 0, 2], targets, { maxT: 180 });
T.check('실제 이동으로 가까운 쪽을 고르고 조각 3개 수집·완주', { ok: walking.ok && walkLevel.echo.scans >= 3 && walkLevel.echo.discoveries === 3 && walkLevel.echo.fragments === 3 && walkLevel.finished, why: walking.why || JSON.stringify({ scans: walkLevel.echo.scans, discoveries: walkLevel.echo.discoveries, fragments: walkLevel.echo.fragments, finished: walkLevel.finished }) });
const skipWorld = new PhysicsWorld(); const skipLevel = buildEchoDetective(new THREE.Scene(), skipWorld, { seed: 8 });
const skipTargets = [];
for (const station of skipLevel.echoStations) {
  const route = station.routePads.find((r) => r.near);
  skipTargets.push([0, station.hubZ - 5], [route.x, (route.z0 + route.z1) / 2], [0, station.hubZ - 27]);
}
skipTargets.push([0, skipLevel.echo.exit.z - 2]);
const skipped = run({ level: skipLevel, world: skipWorld }, [0, 0, 2], skipTargets, { maxT: 180 });
T.check('스캔을 건너뛰어도 안전하게 완주', { ok: skipped.ok && skipLevel.echo.scans === 0 && skipLevel.finished, why: skipped.why || `scans=${skipLevel.echo.scans}` });
T.report();
