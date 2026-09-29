import * as THREE from 'three';
import { PhysicsWorld } from './physics.js';
import { Player } from './player.js';
import { MAPS, mapById } from './levels/index.js';
import { Input } from './input.js';
import { Sfx } from './sfx.js';
import { RemoteCrowd, stateCode } from './remote.js';
import { Room } from './net/room.js';
import { TEACHER_CODE } from './net/config.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {
  get(k) {
    try {
      return localStorage.getItem(`fallschool.${k}`);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`fallschool.${k}`, v);
    } catch {}
  },
};

// ─── 렌더러 ───────────────────────────────────────────
const QUALITIES = [
  { label: '화질: 낮음', ratio: 1, shadow: false },
  { label: '화질: 보통', ratio: 1.5, shadow: true },
  { label: '화질: 높음', ratio: 2, shadow: true },
];
let qualityIndex = THREE.MathUtils.clamp(Number(store.get('quality') ?? 1) || 0, 0, 2);

const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe6ff);
scene.fog = new THREE.Fog(0xbfe6ff, 60, 170);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

const hemi = new THREE.HemisphereLight(0xffffff, 0x9fb7d6, 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

function applyQuality() {
  const q = QUALITIES[qualityIndex];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio));
  renderer.shadowMap.enabled = q.shadow;
  sun.castShadow = q.shadow;
  applyQualityToMaterials();
  $('btn-quality').textContent = q.label;
  resize();
}

function applyQualityToMaterials() {
  scene.traverse((o) => {
    if (o.material) o.material.needsUpdate = true;
  });
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.2 ? 70 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ─── 월드 ─────────────────────────────────────────────
const world = new PhysicsWorld();
let level = null;
let mapId = null;

// 맵 교체: 이전 맵을 지우고 새 맵을 만든 뒤 콜백·하늘을 연결한다
function loadMap(id, seed = Date.now() >>> 0) {
  const def = mapById(id);
  level?.dispose();
  level = def.build(scene, world, { seed });
  mapId = def.id;
  level.onCheckpoint = onCheckpoint;
  level.onFinish = onFinish;
  level.onTileTriggered = (i) => net.room?.triggerTile(i);
  level.onMessage = (text, ok) => toast(text, { seconds: 4.5, tone: ok ? 'ok' : 'retry' });
  // 협동 장치(스위치 발판)용: 다른 학생의 마지막 받은 위치와 방 안 학생 수. 화면마다 같은 값으로 계산한다.
  level.getOthers = () => Array.from(crowd.avatars.values(), (a) => a.target);
  level.getPlayerCount = () => crowd.avatars.size + (net.mode === 'teacher' ? 0 : 1);
  const sky = level.sky;
  scene.background = new THREE.Color(sky.background);
  scene.fog = new THREE.Fog(...sky.fog);
  hemi.intensity = sky.hemi ?? 1.6;
  if (params.has('reveal')) level.revealPath();
  applyQualityToMaterials();
  return level;
}

const player = new Player(scene);
const crowd = new RemoteCrowd(scene);
let chosenMap = mapById(params.get('map') || store.get('map')).id;
loadMap(chosenMap);
player.respawn(level.spawn);

const sfx = new Sfx();
const input = new Input({
  surface: $('touch-surface'),
  stickBase: $('stick-base'),
  stickKnob: $('stick-knob'),
  jumpBtn: $('btn-jump'),
  diveBtn: $('btn-dive'),
});
input.onJump = () => player.requestJump();
input.onDive = () => player.requestDive();
input.enabled = false;

// ─── 상태 ─────────────────────────────────────────────
// mode: 'menu' | 'solo' | 'student' | 'teacher'
const net = { mode: 'menu', backend: null, room: null, lastPhase: null, followUid: null };
const game = {
  running: false,
  timerStarted: false,
  elapsed: 0,
  falls: 0,
  cpIndex: 0,
  respawning: 0,
  race: null,
  finishMs: 0,
};
const cam = { yaw: 0, pitch: 0.38, dist: 8.5, cur: 8.5, target: new THREE.Vector3() };

const currentCheckpoint = () => level.checkpoints[game.cpIndex];

// 방 안에서의 진행 단계
function phase() {
  const m = net.room?.meta;
  if (!m) return net.mode === 'solo' ? 'solo' : 'menu';
  if (m.phase === 'RACE') return net.room.now() < m.startAt ? 'countdown' : 'racing';
  return m.phase === 'RESULT' ? 'result' : 'lobby';
}

// 출발선에서 학생마다 다른 자리
function startSpot() {
  if (net.mode !== 'student') return level.spawn.clone();
  let h = 0;
  for (const ch of net.backend.uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return new THREE.Vector3(((h % 5) - 2) * 2.4, 0, 1.5 + (Math.floor(h / 5) % 3) * 2);
}

function respawnAtCheckpoint(countFall) {
  const cp = currentCheckpoint();
  if (countFall) {
    game.falls++;
    if (net.mode === 'student' && phase() === 'racing') net.room.publishProgress({ falls: game.falls });
  }
  player.respawn(game.cpIndex === 0 ? startSpot() : cp.respawn, 0);
  cam.yaw = 0;
  cam.target.copy(player.pos).y += 1.6;
}

function resetRun() {
  level.resetProgress();
  game.cpIndex = 0;
  game.falls = 0;
  game.elapsed = 0;
  game.finishMs = 0;
  game.timerStarted = false;
  $('overlay-finish').classList.add('hidden');
  respawnAtCheckpoint(false);
}

function onCheckpoint(cp) {
  if (cp.index > game.cpIndex) game.cpIndex = cp.index;
  toast(`체크포인트! (${cp.name})`);
  sfx.play('checkpoint');
  if (net.mode === 'student' && phase() === 'racing') net.room.publishProgress({ cp: game.cpIndex });
}

function onFinish() {
  sfx.play('finish');
  spawnConfetti();
  const p = phase();
  if (net.mode === 'solo') {
    game.running = false;
    input.enabled = false;
    showFinish('골인!', game.elapsed, true);
  } else if (net.mode === 'student') {
    if (p === 'racing') {
      game.finishMs = Math.max(1, Math.round(net.room.now() - net.room.meta.startAt));
      net.room.publishProgress({ finish: game.finishMs, cp: level.checkpoints.length - 1 });
      toast(`완주! ${formatTime(game.finishMs / 1000)}`);
    } else {
      toast('연습 완주! 선생님의 출발 신호를 기다려요');
    }
  }
}

// 방에서 정한 맵과 다르면 바꾼다. 바꿨으면 true
function ensureMap(m) {
  const want = mapById(m.mapId).id;
  if (want === mapId) return false;
  loadMap(want, m.seed);
  return true;
}

function showFinish(title, seconds, again) {
  $('finish-title').textContent = title;
  $('result-time').textContent = seconds > 0 ? formatTime(seconds) : '—';
  $('result-falls').textContent = `${game.falls}번`;
  $('btn-again').classList.toggle('hidden', !again);
  setTimeout(() => $('overlay-finish').classList.remove('hidden'), 900);
}

// ─── 방 이벤트 (학생) ─────────────────────────────────
function onStudentMeta(m) {
  if (!m) {
    $('banner').textContent = '방이 닫혔습니다';
    return;
  }
  const switched = ensureMap(m);
  if (m.phase === 'RACE' && game.race !== m.race) {
    // 새 경기: 모두 출발선으로
    game.race = m.race;
    level.setSeed(m.seed);
    resetRun();
    net.room.publishProgress({ race: m.race, cp: 0, falls: 0, finish: 0 });
  } else if (m.phase === 'LOBBY' && (net.lastPhase !== 'LOBBY' || level.seed !== m.seed || switched)) {
    game.race = null;
    level.setSeed(m.seed);
    resetRun();
  } else if (m.phase === 'RESULT' && net.lastPhase !== 'RESULT') {
    const mine = game.finishMs / 1000;
    showFinish(mine > 0 ? '경기 끝! 완주했어요' : '경기 끝!', mine, false);
    $('result-class-row').classList.remove('hidden');
  } else if (switched) {
    resetRun();
  }
  if (m.phase !== 'RESULT') $('overlay-finish').classList.add('hidden');
  net.lastPhase = m.phase;
}

function onTeacherMeta(m) {
  if (!m) return;
  ensureMap(m);
  if (level.seed !== m.seed) level.setSeed(m.seed);
  if (m.phase === 'RACE' && game.race !== m.race) {
    game.race = m.race;
    level.resetProgress();
  }
  net.lastPhase = m.phase;
  renderTeacherControls();
}

// ─── 시작 화면 ────────────────────────────────────────
const msg = (text, ok = false) => {
  $('start-msg').textContent = text;
  $('start-msg').classList.toggle('ok', ok);
};
let chosenColor = store.get('color') || '#ff7aa8';
$('in-name').value = store.get('name') || '';
$('in-room').value = params.get('room') || '';

document.querySelectorAll('.color-choice').forEach((btn) => {
  btn.style.background = btn.dataset.color;
  btn.classList.toggle('selected', btn.dataset.color === chosenColor);
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-choice').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    chosenColor = btn.dataset.color;
    player.setColor(parseInt(chosenColor.slice(1), 16));
  });
});
player.setColor(parseInt(chosenColor.slice(1), 16));

// 맵 고르기 (혼자 연습·방 만들기용). 고르면 바로 배경으로 보여 준다.
$('map-choices').insertAdjacentHTML(
  'beforeend',
  MAPS.map((m) => `<button class="map-choice" data-map="${m.id}">${m.name}</button>`).join(''),
);
const markMap = () =>
  document.querySelectorAll('.map-choice').forEach((b) => b.classList.toggle('selected', b.dataset.map === chosenMap));
markMap();
$('map-choices').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-map]');
  if (!btn) return;
  chosenMap = btn.dataset.map;
  store.set('map', chosenMap);
  markMap();
  if (chosenMap !== mapId) {
    loadMap(chosenMap);
    player.respawn(level.spawn);
    cam.target.copy(player.pos).y += 1.6;
  }
});

async function getBackend() {
  if (net.backend) return net.backend;
  if (params.get('net') === 'local') {
    const { createLocalBackend } = await import('./net/backend-local.js');
    net.backend = await createLocalBackend();
  } else {
    const { createFirebaseBackend } = await import('./net/backend-firebase.js');
    net.backend = await createFirebaseBackend({ longPolling: params.has('lp') });
  }
  return net.backend;
}

function closeMenu() {
  sfx.unlock();
  $('overlay-start').classList.add('hidden');
}

let busy = false;
async function withBusy(fn) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('#overlay-start button').forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (err) {
    console.error(err);
    msg(err.message || '연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
  } finally {
    busy = false;
    document.querySelectorAll('#overlay-start button').forEach((b) => (b.disabled = false));
  }
}

$('btn-join').addEventListener('click', () =>
  withBusy(async () => {
    const code = $('in-room').value.trim();
    const name = $('in-name').value.trim();
    if (!/^\d{4}$/.test(code)) throw new Error('방 번호 4자리를 입력해 주세요.');
    if (!name) throw new Error('이름을 입력해 주세요.');
    store.set('name', name);
    store.set('color', chosenColor);
    msg('연결하는 중…', true);
    const backend = await getBackend();
    net.room = await Room.join(backend, code, { name, color: chosenColor });
    net.mode = 'student';
    net.room.onTile = (i) => level.triggerTile(i);
    net.room.onMeta = onStudentMeta;
    if (net.room.meta) onStudentMeta(net.room.meta);
    $('btn-restart').classList.add('hidden');
    $('room-status').classList.remove('hidden');
    game.running = true;
    closeMenu();
  }),
);

$('btn-solo').addEventListener('click', () => {
  net.mode = 'solo';
  store.set('color', chosenColor);
  if (chosenMap !== mapId) loadMap(chosenMap);
  else level.setSeed(Date.now() >>> 0);
  if (startCp === 0) resetRun();
  game.running = true;
  closeMenu();
});

$('btn-teacher').addEventListener('click', () =>
  withBusy(async () => {
    const code = window.prompt('선생님 코드를 입력하세요');
    if (code === null) return;
    if (code.trim() !== TEACHER_CODE) throw new Error('선생님 코드가 맞지 않습니다.');
    msg('방을 만드는 중…', true);
    const backend = await getBackend();
    net.room = await Room.create(backend, { mapId: chosenMap });
    net.mode = 'teacher';
    net.room.onTile = (i) => level.triggerTile(i);
    net.room.onMeta = onTeacherMeta;
    setupTeacherPanel();
    closeMenu();
  }),
);

// ─── 교사 패널 ────────────────────────────────────────
function joinUrl() {
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('room', net.room.code);
  if (params.get('net') === 'local') u.searchParams.set('net', 'local');
  return u.toString();
}

function loadQrLib() {
  return new Promise((resolve, reject) => {
    if (window.qrcode) return resolve(window.qrcode);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = () => resolve(window.qrcode);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function setupTeacherPanel() {
  document.body.classList.add('teacher');
  $('teacher-panel').classList.remove('hidden');
  player.root.visible = false;
  cam.dist = 13;
  cam.pitch = 0.5;
  const url = joinUrl();
  $('tp-code').textContent = net.room.code;
  $('tp-url').textContent = url;
  $('qr-big-code').textContent = `방 번호 ${net.room.code}`;
  $('qr-big-url').textContent = url;
  loadQrLib()
    .then((qrcode) => {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      $('tp-qr').innerHTML = svg;
      $('qr-big-img').innerHTML = svg;
    })
    .catch(() => {
      $('qr-big-img').textContent = 'QR 코드를 불러오지 못했습니다. 아래 주소로 접속하세요.';
    });

  // 전자칠판에 크게 띄우기
  const showQr = (show) => $('qr-big').classList.toggle('hidden', !show);
  $('tp-qr').addEventListener('click', () => showQr(true));
  $('tp-qr-zoom').addEventListener('click', () => showQr(true));
  $('qr-big-close').addEventListener('click', () => showQr(false));
  $('qr-big').addEventListener('click', (e) => {
    if (e.target.id === 'qr-big') showQr(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') showQr(false);
  });

  $('tp-start').addEventListener('click', () => net.room.startRace());
  $('tp-freeze').addEventListener('click', () => net.room.setFrozen(!net.room.meta?.frozen));
  $('tp-end').addEventListener('click', () => net.room.endRace());
  $('tp-lobby').addEventListener('click', () => net.room.toLobby());
  $('tp-maps').innerHTML = MAPS.map((m) => `<button class="tp-map" data-map="${m.id}">${m.name}</button>`).join('');
  $('tp-maps').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-map]');
    if (!btn || btn.disabled) return;
    net.room.setMap(btn.dataset.map);
  });
  $('tp-list').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-uid]');
    if (!li) return;
    net.followUid = net.followUid === li.dataset.uid ? null : li.dataset.uid;
    cam.yaw = 0;
  });
  renderTeacherControls();
}

function renderTeacherControls() {
  const m = net.room?.meta;
  if (!m || net.mode !== 'teacher') return;
  const p = phase();
  $('tp-phase').textContent = {
    lobby: '대기실 (자유 연습)',
    countdown: '출발 준비…',
    racing: '경기 중',
    result: '경기 끝 (결과 보기)',
  }[p];
  $('tp-start').textContent = p === 'lobby' ? '출발!' : '다시 출발';
  $('tp-end').disabled = !(p === 'racing' || p === 'countdown');
  $('tp-freeze').classList.toggle('on', !!m.frozen);
  $('tp-freeze').textContent = m.frozen ? '얼음 풀기' : '얼음!';
  // 맵은 경기 중이 아닐 때만 바꿀 수 있다
  const canChange = p === 'lobby' || p === 'result';
  document.querySelectorAll('#tp-maps .tp-map').forEach((b) => {
    b.classList.toggle('selected', b.dataset.map === mapId);
    b.disabled = !canChange;
  });
}

let listTimer = 0;
function renderTeacherList() {
  const room = net.room;
  const racing = phase() === 'racing' || phase() === 'result';
  const race = room.meta?.race;
  const rows = room.students().map((s) => {
    const inRace = racing && s.race === race;
    return { ...s, done: inRace && s.finish > 0 ? s.finish : 0, cp: inRace ? s.cp : 0, falls: inRace ? s.falls : 0 };
  });
  // 완주 기록 순 → 진행한 거리 순 (서열 강조 없이 교사만 보는 목록)
  rows.sort((a, b) => (a.done && b.done ? a.done - b.done : a.done ? -1 : b.done ? 1 : (a.pos?.z ?? 0) - (b.pos?.z ?? 0)));
  const finished = rows.filter((r) => r.done).length;
  $('tp-count').textContent = `접속 ${rows.length}명`;
  $('tp-finished').textContent = racing ? `완주 ${finished} / ${rows.length}` : '';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  $('tp-list').innerHTML = rows
    .map((r) => {
      const where = r.pos ? level.sectionAt(r.pos.z) : '—';
      const right = r.done ? `<span class="done">${formatTime(r.done / 1000)}</span>` : `<span class="where">떨어짐 ${r.falls}</span>`;
      return `<li data-uid="${esc(r.uid)}" class="${net.followUid === r.uid ? 'follow' : ''}">
        <span class="dot" style="background:${esc(r.color)}"></span>
        <span><span class="name">${esc(r.name)}</span><br><span class="where">${where}</span></span>${right}</li>`;
    })
    .join('');
  return rows;
}

// 교사 카메라: 선택한 학생, 없으면 가장 앞선 학생
function teacherTarget() {
  let a = net.followUid ? crowd.get(net.followUid) : null;
  if (!a) {
    net.followUid = null;
    let best = null;
    for (const [, av] of crowd.avatars) if (!best || av.player.pos.z < best.player.pos.z) best = av;
    a = best;
  }
  return a ? a.player.pos : level.spawn;
}

// ─── HUD ─────────────────────────────────────────────
function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

let toastTimer = 0;
function toast(text, { seconds = 1.8, tone = '' } = {}) {
  const el = $('toast');
  el.textContent = text;
  el.classList.toggle('long', seconds > 2);
  el.classList.toggle('retry', tone === 'retry');
  el.classList.add('show');
  toastTimer = seconds;
}

$('btn-restart').addEventListener('click', () => {
  if (net.mode !== 'solo') return;
  resetRun();
  game.running = true;
  input.enabled = true;
});
$('btn-respawn').addEventListener('click', () => {
  if (game.running && game.respawning <= 0) respawnAtCheckpoint(false);
});
$('btn-quality').addEventListener('click', () => {
  qualityIndex = (qualityIndex + 1) % QUALITIES.length;
  store.set('quality', String(qualityIndex));
  applyQuality();
});
$('btn-sound').addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  $('btn-sound').textContent = sfx.muted ? '소리 끔' : '소리 켬';
});
$('btn-again').addEventListener('click', () => {
  resetRun();
  game.running = true;
  input.enabled = true;
});

function classFinishCount() {
  const room = net.room;
  const race = room.meta?.race;
  const list = room.students();
  const done = list.filter((s) => s.race === race && s.finish > 0).length;
  return { done, total: list.length };
}

let lastCount = -1;
function updateHud(dt) {
  const p = phase();
  const room = net.room;

  // 타이머
  let t = game.elapsed;
  if (room) {
    if (p === 'racing') t = game.finishMs ? game.finishMs / 1000 : (room.now() - room.meta.startAt) / 1000;
    else if (p === 'result') t = game.finishMs / 1000;
    else t = 0;
  }
  $('timer').textContent = room && p === 'lobby' ? '연습' : formatTime(Math.max(0, t));
  $('falls').textContent = `떨어짐 ${game.falls}`;
  $('section').textContent = level.sectionAt(net.mode === 'teacher' ? teacherTarget().z : player.pos.z);

  // 카운트다운
  const cd = $('countdown');
  if (room && room.meta?.phase === 'RACE') {
    const left = (room.meta.startAt - room.now()) / 1000;
    if (left > 0) {
      const n = Math.ceil(left);
      if (n !== lastCount) {
        lastCount = n;
        sfx.play('jump');
      }
      cd.textContent = String(n);
      cd.classList.remove('hidden');
    } else if (left > -0.8) {
      if (lastCount !== 0) {
        lastCount = 0;
        sfx.play('checkpoint');
      }
      cd.textContent = '출발!';
      cd.classList.remove('hidden');
    } else cd.classList.add('hidden');
  } else {
    cd.classList.add('hidden');
    lastCount = -1;
  }

  // 안내 띠, 방 상태
  const banner = $('banner');
  if (net.mode === 'student') {
    const { done, total } = classFinishCount();
    $('room-status').textContent = `${room.code}번 방 · ${total}명`;
    const text =
      p === 'lobby'
        ? '자유 연습 중 · 선생님이 출발 신호를 주면 시작해요'
        : p === 'racing' || p === 'result'
          ? `우리 반 완주 ${done} / ${total}명`
          : '';
    banner.textContent = text;
    banner.classList.toggle('hidden', !text);
    $('result-class').textContent = `${done} / ${total}명`;
  } else banner.classList.add('hidden');

  // 얼음
  const frozen = !!room?.meta?.frozen;
  $('freeze').classList.toggle('hidden', !(frozen && net.mode === 'student'));

  if (net.mode === 'teacher') {
    listTimer -= dt;
    if (listTimer <= 0) {
      listTimer = 0.5;
      renderTeacherList();
      renderTeacherControls();
    }
  }

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('show');
  }
}

// ─── 색종이 ───────────────────────────────────────────
const confetti = [];
function spawnConfetti() {
  const colors = [0xff5d8f, 0xffd166, 0x7bdff2, 0x9be564, 0xb8a9ff];
  const geo = new THREE.PlaneGeometry(0.25, 0.15);
  for (let i = 0; i < 120; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }));
    m.position.copy(player.pos).add(new THREE.Vector3((Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2));
    const v = new THREE.Vector3((Math.random() - 0.5) * 8, 6 + Math.random() * 6, (Math.random() - 0.5) * 8);
    scene.add(m);
    confetti.push({ m, v, life: 4 });
  }
}
function updateConfetti(dt) {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i];
    c.v.y -= 9 * dt;
    c.v.multiplyScalar(1 - 1.5 * dt);
    c.m.position.addScaledVector(c.v, dt);
    c.m.rotation.x += dt * 6;
    c.m.rotation.y += dt * 4;
    c.life -= dt;
    if (c.life <= 0) {
      scene.remove(c.m);
      c.m.material.dispose();
      confetti.splice(i, 1);
    }
  }
}

// ─── 루프 ─────────────────────────────────────────────
const STEP = 1 / 120;
let simTime = 0;
let acc = 0;
let last = performance.now();
let fpsFrames = 0;
let fpsTime = 0;
const _offset = new THREE.Vector3();
const _want = new THREE.Vector3();
const _camDir = new THREE.Vector3();

// 방에 있으면 움직이는 장애물 시각을 서버 시계에 맞춘다 (모두 같은 순간에 같은 위치)
function sharedTime() {
  const m = net.room?.meta;
  if (!m || typeof m.epoch !== 'number') return null;
  return (net.room.now() - m.epoch) / 1000;
}

function simulate(dt) {
  const simulatePlayer = net.mode === 'solo' || net.mode === 'student';
  const stepOnce = () => {
    simTime += STEP;
    level.update(simTime, STEP, simulatePlayer ? player : null);
    if (simulatePlayer && game.respawning <= 0) player.step(STEP, input.move, cam.yaw, world, level.windAt, level.gravityAt);
  };

  const target = sharedTime();
  let steps = 0;
  if (target !== null) {
    if (Math.abs(target - simTime) > 0.5) simTime = target - STEP;
    while (simTime + STEP <= target && steps < 12) {
      stepOnce();
      steps++;
    }
  } else {
    acc += dt;
    while (acc >= STEP && steps < 10) {
      stepOnce();
      acc -= STEP;
      steps++;
    }
    if (steps === 10) acc = 0;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const p = phase();

  // 입력 허용 여부
  const frozen = !!net.room?.meta?.frozen;
  if (net.mode === 'student') input.enabled = !frozen && p !== 'countdown';
  else if (net.mode === 'solo') input.enabled = game.running;
  else input.enabled = false;

  input.poll();
  const look = input.consumeLook();
  cam.yaw -= look.x * 0.0055;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + look.y * 0.004, 0.05, 1.15);

  if (net.mode === 'solo' && game.running && !game.timerStarted && (input.move.x || input.move.y || player.vel.y > 0)) {
    game.timerStarted = true;
  }

  simulate(dt);

  for (const ev of player.events) sfx.play(ev);
  player.events.length = 0;

  // 낙하 → 체크포인트 복귀
  if (net.mode === 'solo' || net.mode === 'student') {
    if (game.respawning > 0) {
      game.respawning -= dt;
      if (game.respawning <= 0) {
        respawnAtCheckpoint(true);
        $('fade').classList.remove('show');
      }
    } else if (player.pos.y < currentCheckpoint().respawn.y - 10) {
      game.respawning = 0.35;
      $('fade').classList.add('show');
      sfx.play('fall');
    }
  }

  if (net.mode === 'solo' && game.running && game.timerStarted) game.elapsed += dt;
  if (net.mode === 'student') net.room.publishPosition(player, stateCode(player), now);

  player.updateVisual(dt);
  crowd.update(dt, net.room);
  updateConfetti(dt);

  // 카메라
  const focus = net.mode === 'teacher' ? teacherTarget() : player.pos;
  _want.copy(focus).y += 1.6;
  cam.target.lerp(_want, 1 - Math.exp(-12 * dt));
  _offset
    .set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch))
    .multiplyScalar(cam.dist);
  // 벽이 카메라와 캐릭터 사이를 가리면 벽 앞으로 당긴다 (가까워질 때는 바로, 멀어질 때는 천천히)
  _camDir.copy(_offset).divideScalar(cam.dist);
  const clear = Math.max(1.5, world.raycast(cam.target, _camDir, cam.dist) - 0.4);
  cam.cur = clear < cam.cur ? clear : cam.cur + (clear - cam.cur) * (1 - Math.exp(-4 * dt));
  _offset.copy(_camDir).multiplyScalar(cam.cur);
  camera.position.copy(cam.target).add(_offset);
  camera.lookAt(cam.target);

  sun.position.set(focus.x + 8, focus.y + 30, focus.z + 10);
  sun.target.position.copy(focus);

  updateHud(dt);
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    $('fps').textContent = `${Math.round(fpsFrames / fpsTime)} fps`;
    fpsFrames = 0;
    fpsTime = 0;
  }

  renderer.render(scene, camera);
}

// 시험용: ?cp=2 처럼 체크포인트에서 바로 시작 (혼자 연습)
const startCp = THREE.MathUtils.clamp(parseInt(params.get('cp'), 10) || 0, 0, level.checkpoints.length - 1);
if (startCp > 0) {
  for (const cp of level.checkpoints) {
    if (cp.index <= startCp) {
      cp.reached = true;
      cp.flag?.material.color.setHex(0x2ec4b6);
    }
  }
  game.cpIndex = startCp;
  respawnAtCheckpoint(false);
}

// 모의 백엔드 시험 때만 상태를 들여다볼 수 있게 한다
if (params.get('net') === 'local') window.__fs = {
    net,
    game,
    player,
    crowd,
    phase,
    get level() {
      return level;
    },
  };

applyQuality();
cam.target.copy(player.pos).y += 1.6;
requestAnimationFrame(frame);
