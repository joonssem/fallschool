import { THREE, PhysicsWorld, run, tally } from './harness.mjs';
import { buildSentenceTrain, STORY_CHOICES } from '../src/levels/sentencetrain.js';
import { mapById } from '../src/levels/index.js';

const T = tally('문장 구조 열차');
const fresh = () => {
  const world = new PhysicsWorld();
  return { world, level: buildSentenceTrain(new THREE.Scene(), world, { seed: 5 }) };
};
T.check('맵 선택 목록 등록', { ok: mapById('sentencetrain').build === buildSentenceTrain, why: '' });
const { level } = fresh();
T.check('출발 때 문장과 사건은 비어 있음', {
  ok: level.story.place === null && level.story.event === null
    && Object.values(level.storyScenes.endings).every((board) => !board.visible), why: '',
});
level.story.choosePlace('forest');
T.check('숲 선택은 숲 장면·문장·열차 색으로 드러남', {
  ok: level.storyScenes.scenes.forest.visible && !level.storyScenes.scenes.sea.visible
    && level.storyScenes.placeSigns.forest.visible && !level.storyScenes.placeSigns.sea.visible
    && level.storyScenes.body.material.color.getHex() === STORY_CHOICES.places[0].color, why: '',
});
level.story.chooseEvent('friend');
level.update(2, 2, null);
T.check('친구 사건은 승객과 완성 문장·열차 이동으로 이어짐', {
  ok: level.storyScenes.friend.visible && !level.storyScenes.letter.visible
    && level.storyScenes.endings['forest:friend'].visible && level.storyScenes.train.position.z > -93, why: '',
});
level.story.choosePlace('sea');
level.story.chooseEvent('letter');
T.check('다시 고르면 새 이야기만 표시됨', {
  ok: level.storyScenes.scenes.sea.visible && !level.storyScenes.scenes.forest.visible
    && level.storyScenes.letter.visible && !level.storyScenes.friend.visible
    && level.storyScenes.endings['sea:letter'].visible
    && Object.values(level.storyScenes.endings).filter((board) => board.visible).length === 1, why: '',
});
level.resetProgress();
T.check('새 경기에는 선택·열차·별이 초기화됨', {
  ok: level.story.place === null && level.story.event === null && !level.finished
    && level.storyScenes.train.position.z === -93
    && Object.values(level.storyScenes.endings).every((board) => !board.visible)
    && level.stars.every((star) => !star.got && star.mesh.visible), why: '',
});

for (const place of STORY_CHOICES.places) for (const event of STORY_CHOICES.events) {
  const m = fresh();
  const targets = [
    [place.x, -18], [place.x, -28], [place.x, -33], [0, -40],
    [event.x, -54], [event.x, -63], [event.x, -68], [0, -85],
  ];
  const result = run(m, [0, 1, 4], targets, { maxT: 90 });
  T.check(`${place.phrase} → ${event.phrase}: 걸어서 완주`, {
    ok: result.ok && m.level.finished && m.level.story.place === place.id && m.level.story.event === event.id,
    why: result.why || `place=${m.level.story.place} event=${m.level.story.event} finish=${m.level.finished}`,
  });
  T.check(`${place.phrase} → ${event.phrase}: 선택한 이야기만 보임`, {
    ok: m.level.storyScenes.endings[`${place.id}:${event.id}`].visible
      && Object.values(m.level.storyScenes.endings).filter((board) => board.visible).length === 1, why: '',
  });
}
T.report();
