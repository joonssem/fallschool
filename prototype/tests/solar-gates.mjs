// 태양계 문: 질문 이름([예측]/[관찰]/[비교])이 문 앞뒤 중력과 맞는지, 표시가 조작용 설정을 밝히는지, 단계별 오답 힌트
import { loadMap, run, lane, tally, THREE } from './harness.mjs';
const T = tally('태양계 문·표시');
const { level, world } = (await loadMap('solar'))(3);
const gAt = (y, z) => level.gravityAt(new THREE.Vector3(0, y, z));

for (const g of level.gates) {
  const before = gAt(g.y, g.z + 1);
  const after = gAt(g.y, g.z - 3);
  const isPrediction = after !== before; // 문 뒤에서 처음 바뀌는 중력
  const tag = /^\[(예측|관찰|비교)\]/.exec(g.question)?.[1];
  T.check(`${g.name}: 질문 이름이 흐름과 일치`, { ok: isPrediction ? tag === '예측' : tag === '관찰' || tag === '비교', why: `중력 ${before}→${after}, 이름 ${tag}` });
  T.check(`${g.name}: 오답 힌트 2단계`, { ok: g.wrong.length >= 2 && g.wrong[0] !== g.wrong[1], why: `${g.wrong.length}단계` });
}
const hud = (z) => level.sectionAt(z);
T.check('우주 정거장 HUD에 조작용 표시', { ok: hud(-300).includes('조작용'), why: hud(-300) });
T.check('소행성대 HUD에 조작용 표시', { ok: hud(-180).includes('조작용'), why: hud(-180) });
T.check('달 HUD에 실제 값 표시', { ok: hud(-50).includes('실제'), why: hud(-50) });

// 단계별 오답 힌트: 같은 문을 두 번 틀리면 두 번째에 정답 설명이 나온다
{
  const msgs = [];
  level.onMessage = (text, ok) => msgs.push([text, ok]);
  const g = level.gates[0];
  const wrongX = lane(level, 0, true);
  for (let i = 0; i < 2; i++) run({ level, world }, [wrongX, 8, g.z + 2], [[wrongX, g.z - 3]], { maxT: 5, nojump: true });
  T.check('첫 오답은 첫 번째 힌트', { ok: msgs[0]?.[0] === g.wrong[0] && !msgs[0][1], why: String(msgs[0]) });
  T.check('두 번째 오답은 정답 설명', { ok: msgs[1]?.[0] === g.wrong[1], why: String(msgs[1]) });
}

// 달 높이뛰기 탑(선택): 달의 중력이라야 오른다. 달 평원 체크포인트에서 꼭대기 별까지, 같은 높이를 지구 중력으로는 못 오른다
{
  const m = (await loadMap('solar'))(3);
  const climb = [[9, -62], [16, -66], [9, -70]];
  T.check('달 높이뛰기 탑을 올라 별까지', run(m, [-2, 9, -68], climb, { maxT: 40 }));
  T.check('꼭대기 별을 얻음', { ok: m.level.stars.some((st) => st.got && st.mesh.position.y > 20), why: '별 미획득' });
  T.check('달 평원 체크포인트가 있음', { ok: m.level.checkpoints.some((c) => c.name === '달 평원'), why: m.level.checkpoints.map((c) => c.name).join() });
  const earth = (await loadMap('solar'))(3);
  earth.level.gravityAt = () => 1; // 지구 중력이면 같은 계단을 오를 수 없다 (한 칸 +4.5m)
  const r = run(earth, [-2, 9, -68], climb, { maxT: 20 });
  T.check('지구 중력이면 같은 계단은 오르지 못함', { ok: !r.ok, why: '지구 중력에서도 올랐음' });
}

// 화성 대협곡 도약(선택): 화성 중력(×0.45)이라야 닿는 틈. 폭풍이 서쪽으로 불 때 바람이 도와주며, 어느 출발 시각에도 건널 수 있다
{
  const got = (m, x) => m.level.stars.some((st) => st.got && Math.abs(st.mesh.position.x - x) < 1);
  // 폭풍(4초 주기)이 길에서 학생을 서쪽으로 밀기도 하므로 출발 시각에 따라 닿지 못할 수 있다. 어떤 시각에는 닿아야 한다.
  let ok = 0;
  const t0s = [0, 0.7, 1.4, 2.1, 2.8, 3.5];
  for (const t0 of t0s) {
    const m = (await loadMap('solar'))(3);
    run(m, [0, 10, -142], [[-3.5, -142], [-16, -142]], { t0, maxT: 15 });
    if (got(m, -16)) ok++;
  }
  console.log(`  화성 협곡 도약 별을 얻은 출발 시각: ${ok}/${t0s.length}`);
  T.check('화성 협곡 도약: 어떤 출발 시각에는 별에 닿음 (3/6 이상)', { ok: ok >= 3, why: `${ok}/${t0s.length}` });
  const earth = (await loadMap('solar'))(3);
  earth.level.gravityAt = () => 1;
  run(earth, [0, 10, -142], [[-3.5, -142], [-16, -142]], { maxT: 10 });
  T.check('지구 중력이면 같은 협곡을 건너지 못함', { ok: !got(earth, -16), why: '지구 중력에서도 닿음' });
  const mm = (await loadMap('solar'))(3);
  T.check('화성 폭풍 길 체크포인트', { ok: mm.level.checkpoints.some((c) => c.name === '화성 폭풍 앞'), why: mm.level.checkpoints.map((c) => c.name).join() });
}
// 목성 패드 별(선택): 목성에서는 보통 점프로 닿지 않는 높은 발판에 패드로 오른다 (패드 속도는 같아도 중력이 세면 덜 높이 오른다)
{
  const got = (m) => m.level.stars.some((st) => st.got && st.mesh.position.x > 5 && st.mesh.position.z < -215);
  const withPad = (await loadMap('solar'))(3);
  run(withPad, [-1, 9, -216.5], [[2.2, -216.5], [5.5, -216.5]], { maxT: 10 });
  T.check('목성 패드를 밟으면 높은 별 발판에 오름', { ok: got(withPad), why: '별 미획득' });
  const noPad = (await loadMap('solar'))(3);
  run(noPad, [2.8, 9, -219.5], [[5.5, -216.5]], { maxT: 8 });
  T.check('패드 없이 보통 점프로는 닿지 않음', { ok: !got(noPad), why: '패드 없이 닿음' });
}
T.report();