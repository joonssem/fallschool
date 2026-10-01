// 맵 목록. 교사가 고른 id가 방의 meta.mapId로 모든 학생에게 전달된다.
import { buildLevel } from '../level.js';
import { buildSolar } from './solar.js';
import { buildAcid } from './acid.js';
import { buildCircuit } from './circuit.js';
import { buildWater } from './water.js';
import { buildGiantLab } from './giantlab.js';
import { buildBody } from './body.js';

// 맵 항목: id, name, build + (선택) subject(분류), blurb(한 줄 설명), coop(친구와 함께 해야 하는 장치가 있나)
// 선택 화면은 subject 로 묶어 보여 준다. 적지 않으면 '기타'.
export const SUBJECTS = ['연습', '물리', '화학', '지구·우주', '생명'];

export const MAPS = [
  { id: 'lab', name: '점프 연구소 시험장', subject: '연습', blurb: '이동·점프·다이브 연습, 기울어지는 시소', coop: true, build: buildLevel },
  { id: 'solar', name: '태양계 중력 달리기', subject: '지구·우주', blurb: '행성마다 다른 중력으로 점프', build: buildSolar },
  { id: 'acid', name: '산과 염기 실험실', subject: '화학', blurb: '지시약 색을 보고 길을 골라요', build: buildAcid },
  { id: 'circuit', name: '전기 회로 공장', subject: '물리', blurb: '스위치를 나눠 눌러 전구를 켜요', coop: true, build: buildCircuit },
  { id: 'water', name: '물의 순환 구름 공장', subject: '지구·우주', blurb: '바다에서 구름, 비, 강으로', build: buildWater },
  { id: 'giantlab', name: '거대 실험실', subject: '물리', blurb: '공기의 부피와 물의 힘', build: buildGiantLab },
  { id: 'body', name: '인체 대탐험', subject: '생명', blurb: '산소를 싣고 온몸으로', coop: true, build: buildBody },
];

// 분류별로 묶기: [[분류, [맵…]], …] (SUBJECTS 순서, 모르는 분류는 뒤에)
export function mapsBySubject(maps = MAPS) {
  const groups = new Map();
  for (const m of maps) {
    const key = m.subject || '기타';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const rank = (k) => (SUBJECTS.includes(k) ? SUBJECTS.indexOf(k) : SUBJECTS.length);
  return [...groups].sort((a, b) => rank(a[0]) - rank(b[0]));
}

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
