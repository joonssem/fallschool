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
T.report();