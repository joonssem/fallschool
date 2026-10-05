// 모든 맵 공통 규칙 시험 (docs/50 3·4절). 새 맵을 index.js에 등록하면 자동으로 검사된다.
// 규칙·이동 검증이며 재미·학습 효과의 증거가 아니다.
//   1. 발판은 서 있는 동안 매 프레임 반응하지 않는다: 작은 발판 위에 1.5초 서 있어도 안내 메시지가 몇 번만 나온다
//   2. 체크포인트(부활 위치)는 안전하다: 그 자리에 2초 서 있어도 튕겨 오르거나 떨어지지 않는다
//   3. 도전 별은 데이터베이스 규칙 상한(10개) 이하
//   4. 맵마다 봇이 실제로 걷는 시험이 있다: tests/에 그 맵 파일을 불러와 run(...)으로 걷는 시험 파일이 있어야 한다
//      (함수를 직접 불러 확인하는 시험만으로는 "걸어서는 막히는" 문제를 못 잡는다 — 씨앗 구조대 첫 버전)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THREE, PhysicsWorld, Player, S, tally } from './harness.mjs';
const { MAPS } = await import('../src/levels/index.js');

const T = tally('맵 공통 규칙');
const here = fileURLToPath(new URL('.', import.meta.url));
const MAX_STARS = 10; // firebase/database.rules.json 의 stars 상한
const MSG_LIMIT = 4; // 한 발판에 1.5초 서 있을 때 허용하는 안내 수 (매 프레임 반응이면 수십~수백 번)
const variant = (m) => /(easy|hard)$/.test(m.id); // 같은 빌더의 난이도 변형은 1·2를 한 번만 검사

function build(m, seed = 3) {
  const world = new PhysicsWorld();
  const level = m.build(new THREE.Scene(), world, { seed });
  return { world, level };
}
// 윗면이 작은 발판(조작 발판 후보): 가로·세로 4.5m 이하인 판 모양 충돌체
function smallPads(world) {
  const out = [];
  for (const c of world.colliders) {
    if (!c.enabled || c.kind === 'bounce' || c.kind === 'bumper') continue;
    const sx = new THREE.Vector3().setFromMatrixColumn(c.matrix, 0).length() * c.half.x * 2;
    const sz = new THREE.Vector3().setFromMatrixColumn(c.matrix, 2).length() * c.half.z * 2;
    const sy = new THREE.Vector3().setFromMatrixColumn(c.matrix, 1).length() * c.half.y * 2;
    if (sx > 4.5 || sz > 4.5 || sx < 1.5 || sz < 1.5 || sy > 1.6) continue;
    out.push({ c, top: c.center.y + sy / 2, x: c.center.x, z: c.center.z });
  }
  return out;
}
function standFor(m, x, y, z, seconds) {
  const { world, level } = build(m);
  let msgs = 0, last = '';
  level.onMessage = (text) => { msgs++; last = text; };
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(x, y, z), 0);
  let top = y, low = y;
  for (let t = 0; t < seconds; t += S) {
    level.update(t, S, p);
    p.step(S, { x: 0, y: 0 }, 0, world, level.windAt, level.gravityAt);
    top = Math.max(top, p.pos.y); low = Math.min(low, p.pos.y);
  }
  return { msgs, last, rise: top - y, drop: y - low };
}

for (const m of MAPS) {
  const { world, level } = build(m);
  T.check(`${m.id}: 도전 별 ${level.stars.length}개 ≤ ${MAX_STARS}`, { ok: level.stars.length <= MAX_STARS, why: String(level.stars.length) });
  if (variant(m)) continue;

  // 1. 작은 발판에 서 있기
  const spam = [];
  for (const pad of smallPads(world)) {
    const r = standFor(m, pad.x, pad.top + 0.02, pad.z, 1.5);
    if (r.msgs > MSG_LIMIT) spam.push(`(${pad.x.toFixed(1)}, ${pad.z.toFixed(1)}) ${r.msgs}번 "${r.last.slice(0, 24)}"`);
  }
  T.check(`${m.id}: 발판이 매 프레임 반응하지 않음`, { ok: spam.length === 0, why: spam.slice(0, 3).join(' | ') });

  // 2. 체크포인트 부활 위치에 서 있기
  const unsafe = [];
  for (const cp of level.checkpoints) {
    const r = standFor(m, cp.respawn.x, cp.respawn.y + 0.05, cp.respawn.z, 2);
    if (r.rise > 1.2 || r.drop > 1.5) unsafe.push(`${cp.name}: 오름 ${r.rise.toFixed(1)}m, 내려감 ${r.drop.toFixed(1)}m`);
  }
  T.check(`${m.id}: 체크포인트 ${level.checkpoints.length}곳 모두 안전`, { ok: unsafe.length === 0, why: unsafe.slice(0, 3).join(' | ') });
}

// 4. 봇 걷기 시험이 있는가 (맵 파일 → 그 파일을 불러와 run(...)을 쓰는 시험 파일)
const indexSrc = readFileSync(new URL('../src/levels/index.js', import.meta.url), 'utf8');
const files = [...indexSrc.matchAll(/import \{ (\w+) \} from '(\.\.?\/[\w./-]+)';/g)].map(([, name, path]) => ({ name, file: path.split('/').pop().replace('.js', '') }));
const tests = readdirSync(here).filter((f) => f.endsWith('.mjs') && f !== 'map-rules.mjs' && f !== 'harness.mjs').map((f) => readFileSync(here + f, 'utf8'));
for (const { file } of files) {
  const walks = tests.some((src) => (src.includes(`/${file}.js`) || src.includes(`loadMap('${file}')`) || src.includes(`process.argv[2] || '${file}'`) || src.includes(`node tests/body-water.mjs ${file}`)) && /\brun\(/.test(src));
  T.check(`${file}: 봇이 걷는 시험이 있음`, { ok: walks, why: `tests/에 ${file}.js를 불러와 run(...)으로 걷는 시험이 없음` });
}
T.report();
