import * as THREE from 'three';
import { PhysicsWorld } from './physics.js';
import { Player } from './player.js';
import { buildLevel, sectionAt } from './level.js';
import { Input } from './input.js';
import { Sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ─── 렌더러 ───────────────────────────────────────────
const QUALITIES = [
  { label: '화질: 낮음', ratio: 1, shadow: false },
  { label: '화질: 보통', ratio: 1.5, shadow: true },
  { label: '화질: 높음', ratio: 2, shadow: true },
];
let qualityIndex = 1;
try {
  const saved = localStorage.getItem('fallschool.quality');
  if (saved !== null) qualityIndex = THREE.MathUtils.clamp(Number(saved) || 0, 0, 2);
} catch {}

const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe6ff);
scene.fog = new THREE.Fog(0xbfe6ff, 60, 170);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb7d6, 1.6));
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
  scene.traverse((o) => {
    if (o.material) o.material.needsUpdate = true;
  });
  $('btn-quality').textContent = q.label;
  resize();
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
const level = buildLevel(scene, world);
const player = new Player(scene);
player.respawn(level.spawn);
if (params.has('reveal')) level.revealPath();

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

// ─── 게임 상태 ─────────────────────────────────────────
const game = {
  running: false,
  timerStarted: false,
  elapsed: 0,
  falls: 0,
  cpIndex: 0,
  respawning: 0,
};
const cam = { yaw: 0, pitch: 0.38, dist: 8.5, target: new THREE.Vector3() };

function currentCheckpoint() {
  return level.checkpoints[game.cpIndex];
}

level.onCheckpoint = (cp) => {
  if (cp.index > game.cpIndex) game.cpIndex = cp.index;
  toast(`체크포인트! (${cp.name})`);
  sfx.play('checkpoint');
};

level.onFinish = () => {
  game.running = false;
  input.enabled = false;
  sfx.play('finish');
  $('result-time').textContent = formatTime(game.elapsed);
  $('result-falls').textContent = `${game.falls}번`;
  setTimeout(() => $('overlay-finish').classList.remove('hidden'), 900);
  spawnConfetti();
};

function respawnAtCheckpoint(countFall) {
  const cp = currentCheckpoint();
  if (countFall) game.falls++;
  player.respawn(cp.respawn, 0);
  cam.yaw = 0;
  cam.target.copy(player.pos).add(new THREE.Vector3(0, 1.6, 0));
}

function restartAll() {
  level.resetProgress();
  game.cpIndex = 0;
  game.falls = 0;
  game.elapsed = 0;
  game.timerStarted = false;
  game.running = true;
  input.enabled = true;
  respawnAtCheckpoint(false);
  $('overlay-finish').classList.add('hidden');
}

// ─── HUD ─────────────────────────────────────────────
function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  toastTimer = 1.8;
}

$('btn-restart').addEventListener('click', () => restartAll());
$('btn-respawn').addEventListener('click', () => {
  if (game.running) respawnAtCheckpoint(false);
});
$('btn-quality').addEventListener('click', () => {
  qualityIndex = (qualityIndex + 1) % QUALITIES.length;
  try {
    localStorage.setItem('fallschool.quality', String(qualityIndex));
  } catch {}
  applyQuality();
});
$('btn-sound').addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  $('btn-sound').textContent = sfx.muted ? '소리 끔' : '소리 켬';
});

document.querySelectorAll('.color-choice').forEach((btn) => {
  btn.style.background = btn.dataset.color;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-choice').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    player.setColor(parseInt(btn.dataset.color.slice(1), 16));
  });
});

$('btn-start').addEventListener('click', () => {
  sfx.unlock();
  $('overlay-start').classList.add('hidden');
  game.running = true;
  input.enabled = true;
});
$('btn-again').addEventListener('click', () => restartAll());
input.enabled = false;

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

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // 입력
  input.poll();
  const look = input.consumeLook();
  cam.yaw -= look.x * 0.0055;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + look.y * 0.004, 0.05, 1.15);

  if (game.running && !game.timerStarted && (input.move.x || input.move.y || player.vel.y > 0)) game.timerStarted = true;

  // 고정 스텝 시뮬레이션
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 10) {
    simTime += STEP;
    level.update(simTime, STEP, player);
    if (game.respawning <= 0) player.step(STEP, input.move, cam.yaw, world, level.windAt);
    acc -= STEP;
    steps++;
  }
  if (steps === 10) acc = 0;

  for (const ev of player.events) sfx.play(ev);
  player.events.length = 0;

  // 낙하 → 체크포인트 복귀
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

  if (game.running && game.timerStarted) game.elapsed += dt;

  player.updateVisual(dt);
  updateConfetti(dt);

  // 카메라
  _want.copy(player.pos).y += 1.6;
  cam.target.lerp(_want, 1 - Math.exp(-12 * dt));
  _offset.set(
    Math.sin(cam.yaw) * Math.cos(cam.pitch),
    Math.sin(cam.pitch),
    Math.cos(cam.yaw) * Math.cos(cam.pitch),
  ).multiplyScalar(cam.dist);
  camera.position.copy(cam.target).add(_offset);
  camera.lookAt(cam.target);

  sun.position.set(player.pos.x + 8, player.pos.y + 30, player.pos.z + 10);
  sun.target.position.copy(player.pos);

  // HUD
  $('timer').textContent = formatTime(game.elapsed);
  $('falls').textContent = `떨어짐 ${game.falls}`;
  $('section').textContent = sectionAt(player.pos.z);
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('show');
  }
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    $('fps').textContent = `${Math.round(fpsFrames / fpsTime)} fps`;
    fpsFrames = 0;
    fpsTime = 0;
  }

  renderer.render(scene, camera);
}

// 시험용: ?cp=2 처럼 체크포인트에서 바로 시작
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

applyQuality();
cam.target.copy(player.pos).y += 1.6;
requestAnimationFrame(frame);
