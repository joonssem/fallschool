// Market model evidence. No answer code or curriculum code is printed in the world.
import { mulberry32 } from './kit.js';

export const CAUSES = ['heat', 'fuel', 'air'];
export const CAUSE_NAMES = { heat: '열', fuel: '탈 물질', air: '공기' };
export const OBJECTS = [
  { id: 'brazier', name: '옮겨 온 화로', cause: 'heat', detail: '주변보다 오래 뜨거운 받침' },
  { id: 'lamp', name: '넘어진 등잔', cause: 'heat', detail: '쓰러진 작은 불씨 받침' },
  { id: 'straw', name: '짚 가마니', cause: 'fuel', detail: '옆 골목까지 이어진 마른 짚' },
  { id: 'wood', name: '마른 장작', cause: 'fuel', detail: '촘촘하게 이어 쌓은 장작' },
  { id: 'door', name: '열린 뒷문', cause: 'air', detail: '뒤뜰에서 이어지는 바람 통로' },
  { id: 'roof', name: '지붕 틈', cause: 'air', detail: '위에서 계속 내려오는 바람 통로' },
];
export const SITE_IDS = ['warehouse', 'smithy', 'inn'];
export const SITE_NAMES = { warehouse: '곡식·땔감 창고', smithy: '대장간 골목', inn: '객주 마당' };
const MARKS = ['꽃', '달', '잎', '별', '해', '물결'];
const shuffled = (xs, rand) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export function makeCase(seed) {
  const rand = mulberry32(seed >>> 0);
  const object = OBJECTS[Math.floor(rand() * OBJECTS.length)];
  const layout = shuffled(OBJECTS, rand).map((o, i) => ({ mark: MARKS[i], object: o.id }));
  const focus = layout.find((x) => x.object === object.id).mark;
  const decoys = shuffled(MARKS.filter((m) => m !== focus), rand);
  const witness = ['새벽 짐꾼', '아침 장사꾼', '이른 순찰꾼'][Math.floor(rand() * 3)];
  const pairId = `delivery-${seed >>> 0}`;
  const report = `${witness}: 아침엔 장작이 없었으니 저녁에도 없었을 거예요.`;
  const cards = SITE_IDS.flatMap((site, i) => {
    const origins = shuffled([focus, decoys[i]], rand);
    return [
    {
      id: `${site}-trace`, site, kind: 'trace', title: `${SITE_NAMES[site]} · 흔적`,
      // These are two plausible origins, not a field secretly containing the answer.
      origins, pairId, after: true,
      lines: [`번진 자국이 ${origins.join('·')} 표식 쪽에서 겹쳐요.`,
        { heat: '가운데 받침의 잔열이 유독 오래 남았어요.', fuel: '마른 물건을 따라 타고 간 자국이 유독 길어요.', air: '바람 드는 틈을 따라 탄 자국이 유독 길어요.' }[object.cause],
        '다른 흔적과 비교해야 출발점을 가릴 수 있어요.', '같은 반입 끈 옆: 검고 잘 부서지는 숯·재.'],
    },
    {
      id: `${site}-ledger`, site, kind: 'ledger', title: `${SITE_NAMES[site]} · ${site === 'inn' ? '당일 장부' : '장부 사본'}`,
      layout: layout.map((x) => ({ ...x })), pairId, before: true,
      delivery: { material: '장작', amount: 6, from: '서쪽 나무터', time: '오후', day: '오늘' },
      lines: [
        ...layout.map((x) => `${x.mark}: ${OBJECTS.find((o) => o.id === x.object).name}`),
        '오늘 오후 · 장작 여섯 묶음 · 서쪽 나무터에서 반입.',
        '갈색·단단한 나무. 묶음 끈은 흔적의 숯·재 옆과 같아요.',
      ],
    },
    {
      id: `${site}-witness`, site, kind: 'witness', title: site === 'inn' ? `${witness}의 증언` : '객주에서 전달받은 증언',
      witness, claimedAbsent: '장작', observedTime: '아침', claimedTime: '저녁',
      lines: [report, '아침 모습만 보았다고 해요. 오늘 장부와 비교해요.',
        i === 0 ? '창고지기: 마른 물건은 다른 곳에도 있었어요.' : i === 1 ? '대장장이: 불씨도, 공기 통로도 함께 있었어요.' : '객주지기: 반입 시간은 바로 옆 당일 장부에 있어요.'],
    },
    ];
  });
  return { seed: seed >>> 0, cause: object.cause, object: object.id, focus, witness, cards };
}

// Derive candidates ONLY from collected observations + layout, never from the case answer.
// One kind alone, or one site's trace+ledger alone, cannot settle both conclusion fields.
export function interpret(cards) {
  const traces = cards.filter((c) => c.kind === 'trace');
  const ledgers = cards.filter((c) => c.kind === 'ledger');
  let candidates = [...OBJECTS];
  if (traces.length && ledgers.length) {
    candidates = OBJECTS.filter((o) => ledgers.every((l) => {
      const mark = l.layout.find((x) => x.object === o.id)?.mark;
      return traces.every((t) => t.origins.includes(mark));
    }));
  }
  const contradictions = cards.filter((c) => c.kind === 'witness').flatMap((w) =>
    ledgers.filter((l) => l.delivery.material === w.claimedAbsent && l.delivery.day === '오늘' && l.delivery.amount > 0)
      .map((l) => ({ witness: w.id, ledger: l.id, person: w.witness })));
  const pairs = traces.flatMap((t) => ledgers.filter((l) => l.pairId === t.pairId).map((l) => [l.id, t.id]));
  return { candidates, contradictions, pairs };
}
