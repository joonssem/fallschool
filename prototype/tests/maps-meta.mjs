// 맵 목록 메타데이터: 모든 맵에 분류·설명이 있고, 분류별 묶음이 모든 맵을 정확히 한 번씩 담는다
import './harness.mjs';
import { tally } from './harness.mjs';
const { MAPS, SUBJECTS, mapsBySubject, mapById } = await import('../src/levels/index.js');
const T = tally('맵 목록 메타데이터');
const ids = new Set();
for (const m of MAPS) {
  T.check(`${m.id}: 분류`, { ok: SUBJECTS.includes(m.subject), why: `분류 ${m.subject}` });
  T.check(`${m.id}: 설명`, { ok: typeof m.blurb === 'string' && m.blurb.length > 0 && m.blurb.length <= 24, why: `설명 길이 ${m.blurb?.length}` });
  T.check(`${m.id}: id 중복 없음`, { ok: !ids.has(m.id), why: m.id });
  ids.add(m.id);
}
const grouped = mapsBySubject().flatMap(([, l]) => l.map((m) => m.id));
T.check('묶음이 모든 맵을 한 번씩', { ok: grouped.length === MAPS.length && new Set(grouped).size === MAPS.length, why: grouped.join() });
// 분류를 적지 않은 새 맵은 '기타'로 맨 뒤에 나온다
const extra = mapsBySubject([...MAPS, { id: 'x', name: '새 맵', build() {} }]);
T.check('분류 없는 맵은 기타로 맨 뒤', { ok: extra.at(-1)[0] === '기타' && extra.at(-1)[1][0].id === 'x', why: extra.map((g) => g[0]).join() });
T.check('모르는 id는 첫 맵', { ok: mapById('nope').id === MAPS[0].id, why: '' });
T.report();
