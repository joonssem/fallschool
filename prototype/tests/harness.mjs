// 헤드리스 시뮬레이션 공용 도구: 브라우저 없이 맵을 만들고 봇이 걷는다.
// 실행 준비: prototype 폴더에서 `npm install` (three 설치)
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 100 }) : typeof k === 'string' ? () => {} : undefined), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

export const THREE = await import('three');
export const { PhysicsWorld } = await import('../src/physics.js');
export const { Player } = await import('../src/player.js');

const BUILDERS = {
  solar: 'buildSolar', acid: 'buildAcid', circuit: 'buildCircuit',
  water: 'buildWater', giantlab: 'buildGiantLab', body: 'buildBody',
};
export async function loadMap(name) {
  const build = (await import(`../src/levels/${name}.js`))[BUILDERS[name]];
  return (seed) => {
    const world = new PhysicsWorld();
    return { world, level: build(new THREE.Scene(), world, { seed }) };
  };
}

export const S = 1 / 120;
const down = new THREE.Vector3(0, -1, 0);
function groundBelow(world, x, y, z, maxD) {
  let best = Infinity;
  for (const c of world.colliders) {
    if (!c.enabled) continue;
    const t = c.raycast(new THREE.Vector3(x, y, z), down, maxD);
    if (t < best) best = t;
  }
  return best;
}

// 정답 문의 x 좌표 (wrong=true 면 틀린 문)
export function lane(level, gi, wrong = false) {
  const g = level.gates[gi];
  const li = g.lanes.findIndex((_, i) => !!g.options[g.order[i]].correct === !wrong);
  return g.lanes[li].x;
}

// 봇: start에서 출발해 targets를 차례로 걷는다. 발판 가장자리·벽 앞에서 자동 점프.
// nojump: 문 통로 안 (점프하면 지붕에 부딪힌다). t0: 움직이는 발판의 시작 시각.
export function run({ level, world }, start, targets, { maxT = 40, t0 = 0, nojump = false } = {}) {
  const p = new Player(new THREE.Scene());
  p.respawn(new THREE.Vector3(...start), 0);
  let i = 0;
  let t = t0;
  while (t < t0 + maxT && i < targets.length) {
    const [tx, tz] = targets[i];
    const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { i++; continue; }
    const ux = dx / d, uz = dz / d;
    if (p.grounded && !nojump) {
      const ahead = groundBelow(world, p.pos.x + ux * 0.9, p.pos.y + 0.6, p.pos.z + uz * 0.9, 1.2);
      const near = groundBelow(world, p.pos.x + ux * 1.6, p.pos.y + 0.6, p.pos.z + uz * 1.6, 1.2);
      const wall = groundBelow(world, p.pos.x + ux * 0.7, p.pos.y + 1.6, p.pos.z + uz * 0.7, 0.4) < 0.4;
      if (ahead > 1.15 || wall || near < 0.3) p.requestJump();
    }
    level.update(t, S, p);
    p.step(S, { x: ux, y: -uz }, 0, world, level.windAt, level.gravityAt);
    if (p.pos.y < -20) return { ok: false, why: `떨어짐 (${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)}, ${p.pos.z.toFixed(1)}) 목표 #${i}` };
    t += S;
  }
  const ok = i >= targets.length;
  return { ok, why: ok ? '' : `막힘 (${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)}, ${p.pos.z.toFixed(1)}) 목표 #${i}` };
}

// 결과 집계: check(이름, 결과)로 쌓고 report()로 출력. 실패가 있으면 종료 코드 1.
export function tally(title) {
  let pass = 0, fail = 0;
  const bad = {};
  return {
    check(name, r) { r.ok ? pass++ : (fail++, (bad[name] ??= new Set()).add(r.why)); },
    report() {
      console.log(`${title}: 통과 ${pass} / 실패 ${fail}`);
      for (const [k, v] of Object.entries(bad)) console.log('  실패', k, [...v].slice(0, 3).join(' | '));
      if (fail) process.exitCode = 1;
    },
  };
}
