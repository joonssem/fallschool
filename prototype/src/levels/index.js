// 맵 목록. 교사가 고른 id가 방의 meta.mapId로 모든 학생에게 전달된다.
import { buildLevel } from '../level.js';
import { buildSolar } from './solar.js';
import { buildAcid } from './acid.js';
import { buildCircuit } from './circuit.js';
import { buildWater } from './water.js';
import { buildGiantLab } from './giantlab.js';
import { buildBody } from './body.js';
import { buildPizza } from './pizza.js';
import { buildColorStudio } from './colorstudio.js';
import { buildGeometryLab } from './geometrylab.js';
import { buildWindVillage } from './windvillage.js';
import { buildShadowTheater } from './shadowtheater.js';
import { buildRobotCity } from './robotcity.js';
import { buildIceTaxi } from './icetaxi.js';
import { buildEchoDetective } from './echodetective.js';
import { buildMagnetHarbor } from './magnetharbor.js';
import { buildSentenceTrain } from './sentencetrain.js';
import { buildSeedRescue } from './seedrescue.js';
import { buildExcavation } from './excavation.js';

// 맵 항목: id, name, build + (선택) subject(분류), blurb(한 줄 설명), coop(친구와 함께 해야 하는 장치가 있나)
// 선택 화면은 subject 로 묶어 보여 준다. 적지 않으면 '기타'.
export const SUBJECTS = ['연습', '물리', '화학', '지구·우주', '생명', '수학', '국어', '미술', '정보', '사회'];

export const MAPS = [
  { id: 'lab', name: '점프 연구소 시험장', subject: '연습', blurb: '이동·점프·다이브 연습, 기울어지는 시소', coop: true, build: buildLevel },
  // 난이도 변형: 방 설정(meta)에 새 필드를 만들지 않고 맵 id로 단계를 고른다 (database.rules 변경 없음). docs/41
  { id: 'labeasy', name: '점프 연구소 시험장 (쉬움)', subject: '연습', blurb: '느리고 넓은 장애물로 연습해요', coop: true, build: (parent, world, opts) => buildLevel(parent, world, { ...opts, difficulty: 'easy' }) },
  { id: 'labhard', name: '점프 연구소 시험장 (어려움)', subject: '연습', blurb: '빠르고 좁은 장애물에 도전해요', coop: true, build: (parent, world, opts) => buildLevel(parent, world, { ...opts, difficulty: 'hard' }) },
  { id: 'solar', name: '태양계 중력 달리기', subject: '지구·우주', blurb: '행성마다 다른 중력으로 점프', build: buildSolar },
  { id: 'acid', name: '산과 염기 실험실', subject: '화학', blurb: '지시약 색을 보고 길을 골라요', build: buildAcid },
  { id: 'circuit', name: '전기 회로 공장', subject: '물리', blurb: '스위치를 나눠 눌러 전구를 켜요', coop: true, build: buildCircuit },
  { id: 'water', name: '물의 순환 구름 공장', subject: '지구·우주', blurb: '바다에서 구름, 비, 강으로', build: buildWater },
  { id: 'giantlab', name: '거대 실험실', subject: '물리', blurb: '공기의 부피와 물의 힘', build: buildGiantLab },
  { id: 'body', name: '인체 대탐험', subject: '생명', blurb: '산소를 싣고 온몸으로', coop: true, build: buildBody },
  { id: 'pizza', name: '분수 피자 공장', subject: '수학', blurb: '조각을 모아 피자 주문을 완성해요', coop: false, build: buildPizza },
  { id: 'colorstudio', name: '색과 빛의 미술 공방', subject: '미술', blurb: '물감과 빛을 섞어 결과를 비교해요', coop: false, build: buildColorStudio },
  { id: 'geometrylab', name: '도형 건축 연구소', subject: '수학', blurb: '전개도를 접고 대칭 다리를 만들어요', coop: false, build: buildGeometryLab },
  { id: 'windvillage', name: '바람마을', subject: '지구·우주', blurb: '바람 방향을 보고 순풍 길을 골라요', coop: false, build: buildWindVillage },
  { id: 'shadowtheater', name: '그림자 변신 극장', subject: '물리', blurb: '물체를 바꿔 그림자 공연을 만들어요', coop: false, build: buildShadowTheater },
  { id: 'robotcity', name: '명령 택배 로봇 도시', subject: '정보', blurb: '명령을 고쳐 배송하고 길을 열어요', coop: false, build: buildRobotCity },
  { id: 'icetaxi', name: '열을 지키는 얼음 택배', subject: '물리', blurb: '포장과 길을 골라 얼음을 배달해요', coop: false, build: buildIceTaxi },
  { id: 'echodetective', name: '메아리 탐정단', subject: '물리', blurb: '반사 신호로 동굴을 탐험해요', coop: false, build: buildEchoDetective },
  { id: 'magnetharbor', name: '자석 항구', subject: '물리', blurb: '자석으로 화물을 옮겨 길을 만들어요', coop: false, build: buildMagnetHarbor },
  { id: 'sentencetrain', name: '문장 구조 열차', subject: '국어', blurb: '길을 골라 네 가지 이야기를 만들어요', coop: false, build: buildSentenceTrain },
  { id: 'seedrescue', name: '씨앗 구조대', subject: '생명', blurb: '물의 양을 맞춰 싹 다리를 만들어요', coop: false, build: buildSeedRescue },
  { id: 'excavation', name: '유적 발굴 현장', subject: '사회', blurb: '단서를 보고 파내 전시해요', coop: false, build: buildExcavation },
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
