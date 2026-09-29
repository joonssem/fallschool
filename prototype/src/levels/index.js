// 맵 목록. 교사가 고른 id가 방의 meta.mapId로 모든 학생에게 전달된다.
import { buildLevel } from '../level.js';
import { buildSolar } from './solar.js';
import { buildAcid } from './acid.js';

export const MAPS = [
  { id: 'lab', name: '점프 연구소 시험장', build: buildLevel },
  { id: 'solar', name: '태양계 중력 달리기', build: buildSolar },
  { id: 'acid', name: '산과 염기 실험실', build: buildAcid },
];

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
