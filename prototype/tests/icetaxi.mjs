import './harness.mjs';
import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { ICE_PACKS, ICE_ROUTES, TRIAL_DURATION, iceTrial, iceDelivery, buildIceTaxi } from '../src/levels/icetaxi.js';
import { MAPS, mapById } from '../src/levels/index.js';

const T = tally('열을 지키는 얼음 택배');
T.check('맵 선택 목록 등록', { ok: mapById('icetaxi').id === 'icetaxi', why: `${MAPS.length} maps` });
T.check('시험은 동일한 고정 게임 시간과 게임 포장 3종', { ok: TRIAL_DURATION === 2.5 && ICE_PACKS.length === 3 && ICE_PACKS.every((p) => /^포장 [A-C]$/.test(p.name)), why: `${TRIAL_DURATION}, ${ICE_PACKS.map((p) => p.name)}` });
const trials = ICE_PACKS.map((pack) => iceTrial(pack));
T.check('게임 모형 포장 차이가 바로 비교됨', { ok: trials[0].remaining < trials[1].remaining && trials[1].remaining < trials[2].remaining, why: trials.map((x) => x.remaining.toFixed(2)).join(', ') });
const deliveryTable = ICE_PACKS.map((pack) => ({ pack: pack.name, sun: iceDelivery(pack, ICE_ROUTES.sun), shade: iceDelivery(pack, ICE_ROUTES.shade) }));
for (const row of deliveryTable) {
  T.check(`${row.pack}: 두 배송 조합 모두 완주 가능`, { ok: row.sun.delivered && row.shade.delivered, why: `햇빛 ${row.sun.delivered}, 그늘 ${row.shade.delivered}` });
  T.check(`${row.pack}: 이동 시간과 햇빛 노출이 모두 계산됨`, { ok: row.sun.travelHeat > 0 && row.shade.travelHeat > row.sun.travelHeat && row.sun.sunlightHeat > row.shade.sunlightHeat, why: `햇빛 ${row.sun.remaining.toFixed(3)}, 그늘 ${row.shade.remaining.toFixed(3)}` });
}
console.log('포장×경로 남은 얼음 비율(게임 모형):', JSON.stringify(deliveryTable.map((r) => [r.pack, Number(r.sun.remaining.toFixed(3)), Number(r.shade.remaining.toFixed(3))])));
T.check('경로 우세가 모든 포장에 고정되지 않음', { ok: deliveryTable[0].shade.remaining > deliveryTable[0].sun.remaining && deliveryTable[2].sun.remaining > deliveryTable[2].shade.remaining, why: '' });
const world = new PhysicsWorld();
const level = buildIceTaxi(new THREE.Scene(), world, { seed: 3 });
T.check('세 포장 결과가 같은 시험 시간 기준으로 표시됨', { ok: level.iceSamples.length === 3 && level.iceSamples.every((x) => x.outcome.remaining === iceTrial(x.pack).remaining), why: '' });
level.ice.choosePack(ICE_PACKS[2]);
T.check('포장 선택이 배송 계산에 반영됨', { ok: level.ice.pack.id === 'pack-c' && level.ice.trial.remaining === trials[2].remaining, why: '' });
level.ice.chooseRoute(ICE_ROUTES.shade);
T.check('경로 선택 순간에는 배송 결과를 미리 보여 주지 않음', { ok: level.ice.route === ICE_ROUTES.shade && !level.ice.delivered && level.ice.delivery === null && level.deliveryGate.userData.collider.enabled, why: '' });
level.update(1, 1, { pos: new THREE.Vector3(0, 1, -88) });
T.check('도착 후 화물 결과·무대·공연장 문이 바뀜', { ok: level.ice.delivered && level.ice.delivery.remaining === iceDelivery(ICE_PACKS[2], ICE_ROUTES.shade).remaining && !level.deliveryGate.userData.collider.enabled && level.iceStage.material.color.getHex() === 0x95c5a6, why: '' });
const defaultWorld = new PhysicsWorld(); const defaultLevel = buildIceTaxi(new THREE.Scene(), defaultWorld, { seed: 4 });
defaultLevel.ice.chooseRoute(ICE_ROUTES.sun); defaultLevel.update(1, 1, { pos: new THREE.Vector3(0, 1, -88) });
T.check('포장을 건너뛰어도 기본 포장으로 목적지 배송', { ok: defaultLevel.ice.pack === ICE_PACKS[0] && defaultLevel.ice.delivered && defaultLevel.ice.delivery, why: '' });
level.resetProgress();
T.check('초기화로 안전하게 새 배송을 고를 수 있음', { ok: level.ice.pack === null && level.ice.route === null && !level.ice.delivered, why: '' });
const walkWorld = new PhysicsWorld();
const walkLevel = buildIceTaxi(new THREE.Scene(), walkWorld, { seed: 7 });
const walking = run({ level: walkLevel, world: walkWorld }, [0, 0, 2], [[6, -6], [0, -25], [0, -39], [-7, -52], [-7, -68], [0, -80], [0, -104]], { maxT: 100 });
T.check('선택 포장·경로를 실제 이동해 도착 뒤 결과 확인', { ok: walking.ok && walkLevel.ice.pack.id === 'pack-c' && walkLevel.ice.route === ICE_ROUTES.shade && walkLevel.ice.delivered && !walkLevel.deliveryGate.userData.collider.enabled, why: walking.why || JSON.stringify({ pack: walkLevel.ice.pack?.id, route: walkLevel.ice.route?.id, delivered: walkLevel.ice.delivered, gate: walkLevel.deliveryGate.userData.collider.enabled }) });
const skipPackWorld = new PhysicsWorld(); const skipPackLevel = buildIceTaxi(new THREE.Scene(), skipPackWorld, { seed: 2 });
const skipPackWalk = run({ level: skipPackLevel, world: skipPackWorld }, [0, 0, 2], [[10, 2], [10, -6], [8, -8], [8, -18], [0, -22], [0, -25], [0, -39], [7, -53], [7, -63], [0, -80], [0, -104]], { maxT: 100 });
T.check('포장 비교·선택을 건너뛰고도 기본 포장으로 걸어서 완주', { ok: skipPackWalk.ok && skipPackLevel.ice.pack === ICE_PACKS[0] && skipPackLevel.ice.delivered && !skipPackLevel.deliveryGate.userData.collider.enabled, why: skipPackWalk.why || `pack=${skipPackLevel.ice.pack?.id}` });
T.report();
