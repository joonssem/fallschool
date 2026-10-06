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
// 맵·문서 색인(docs/55): 등록된 모든 맵 id가 색인에 있고, 색인이 링크한 문서 파일이 실제로 있다
import { readFileSync, existsSync } from 'node:fs';
const docsDir = new URL('../../docs/', import.meta.url);
const indexPath = new URL('55-맵-문서-색인.md', docsDir);
T.check('맵·문서 색인 파일 있음', { ok: existsSync(indexPath), why: 'docs/55-맵-문서-색인.md' });
if (existsSync(indexPath)) {
  const index = readFileSync(indexPath, 'utf8');
  for (const m of MAPS) {
    T.check(`${m.id}: 색인에 있음`, { ok: index.includes('`' + m.id + '`'), why: 'docs/55에 `id` 행 필요' });
  }
  const links = [...index.matchAll(/\]\((\d{2}-[^)]+\.md)\)/g)].map((x) => x[1]);
  const missing = [...new Set(links)].filter((f) => !existsSync(new URL(f, docsDir)));
  T.check('색인이 링크한 문서가 모두 있음', { ok: missing.length === 0, why: missing.join() });
}
T.report();
