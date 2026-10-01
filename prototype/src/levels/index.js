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

export const MAPS = [
  { id: 'lab', name: '점프 연구소 시험장', build: buildLevel },
  { id: 'solar', name: '태양계 중력 달리기', build: buildSolar },
  { id: 'acid', name: '산과 염기 실험실', build: buildAcid },
  { id: 'circuit', name: '전기 회로 공장', build: buildCircuit },
  { id: 'water', name: '물의 순환 구름 공장', build: buildWater },
  { id: 'giantlab', name: '거대 실험실', build: buildGiantLab },
  { id: 'body', name: '인체 대탐험', build: buildBody },
  { id: 'pizza', name: '분수 피자 공장', build: buildPizza },
  { id: 'colorstudio', name: '색과 빛의 미술 공방', build: buildColorStudio },
  { id: 'geometrylab', name: '도형 건축 연구소', build: buildGeometryLab },
];

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
