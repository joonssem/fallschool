// 방 하나의 실시간 상태
// fallschool/rooms/{code}
//   meta               [저빈도] 교사만 쓰기: phase(LOBBY|RACE|RESULT), race, seed, startAt, frozen, epoch
//   players/{uid}      [중빈도] 학생 자기 것만: name, color, race, cp, falls, finish(ms)
//   pos/{uid}          [고빈도] "x,y,z,facing,state" 문자열, 초당 최대 10회
//   presence/{uid}     접속 표시, 연결이 끊기면 서버가 지운다
//   tiles/{race}/{i}   숨은 발판이 무너진 시각 (모두에게 같이 무너진다)
import { DB_ROOT } from './config.js';

const SEND_INTERVAL = 100; // ms
const ROOM_TTL = 6 * 60 * 60 * 1000; // 6시간 지난 방은 다음 교사가 방을 만들 때 지운다 (규칙과 같은 값)
const HEARTBEAT = 2000; // 움직이지 않아도 이 간격으로는 보낸다
const r2 = (v) => Math.round(v * 100) / 100;

function decodePos(v) {
  if (typeof v !== 'string') return null;
  const a = v.split(',').map(Number);
  if (a.length < 5 || a.some(Number.isNaN)) return null;
  return { x: a[0], y: a[1], z: a[2], f: a[3], s: a[4] };
}

const randomSeed = () => Math.floor(Math.random() * 1e9);

export class Room {
  constructor(backend, code, role) {
    this.b = backend;
    this.code = code;
    this.role = role; // 'teacher' | 'student'
    this.uid = backend.uid;
    this.base = `${DB_ROOT}/rooms/${code}`;
    this.meta = null;
    this.players = {};
    this.presence = {};
    this.positions = new Map();
    this.onMeta = null;
    this.onTile = null;
    this.offs = [];
    this.tileOff = null;
    this.tileRace = null;
    this.sent = { x: 1e9, y: 0, z: 0, f: 0, s: -1, at: 0 };
  }

  static async create(backend) {
    for (let i = 0; i < 10; i++) {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      const ok = await backend.createIfAbsent(`${DB_ROOT}/rooms/${code}/meta`, {
        phase: 'LOBBY',
        race: 0,
        seed: randomSeed(),
        startAt: 0,
        frozen: false,
        hostUid: backend.uid,
        epoch: backend.ts(),
      });
      if (ok) {
        backend.set(`${DB_ROOT}/index/${code}`, backend.ts()).catch(() => {});
        Room.cleanupOld(backend).catch(() => {});
        const room = new Room(backend, code, 'teacher');
        room.listen();
        return room;
      }
    }
    throw new Error('방 번호를 만들지 못했습니다. 다시 시도해 주세요.');
  }

  // 방 목록(index)에는 방 번호와 만든 시각만 있다. 학생 이름이 오래 남지 않도록 지난 방을 지운다.
  static async cleanupOld(backend) {
    const index = (await backend.get(`${DB_ROOT}/index`)) || {};
    const cutoff = backend.now() - ROOM_TTL;
    for (const [code, createdAt] of Object.entries(index)) {
      if (typeof createdAt !== 'number' || createdAt >= cutoff) continue;
      try {
        await backend.set(`${DB_ROOT}/rooms/${code}`, null);
        await backend.set(`${DB_ROOT}/index/${code}`, null);
      } catch {
        // 규칙이 거부하면(아직 6시간이 안 된 방 등) 건너뛴다
      }
    }
  }

  static async join(backend, code, profile) {
    const meta = await backend.get(`${DB_ROOT}/rooms/${code}/meta`);
    if (!meta) throw new Error(`${code}번 방이 없습니다. 방 번호를 확인해 주세요.`);
    const room = new Room(backend, code, 'student');
    room.listen();
    await room.enter(profile);
    return room;
  }

  listen() {
    const { b, base } = this;
    this.offs.push(
      b.onValue(`${base}/meta`, (m) => {
        this.meta = m;
        if (m) this.watchTiles(m.race);
        this.onMeta?.(m);
      }),
    );
    this.offs.push(b.onValue(`${base}/players`, (v) => (this.players = v || {})));
    this.offs.push(b.onValue(`${base}/presence`, (v) => (this.presence = v || {})));
    const put = (uid, v) => {
      if (uid === this.uid) return;
      const p = decodePos(v);
      if (p) this.positions.set(uid, p);
    };
    this.offs.push(
      b.onChild(`${base}/pos`, { added: put, changed: put, removed: (uid) => this.positions.delete(uid) }),
    );
  }

  async enter({ name, color }) {
    const { b, base, uid } = this;
    await b.set(`${base}/players/${uid}`, { name, color, race: -1, cp: 0, falls: 0, finish: 0 });
    // 재접속할 때마다 퇴장 처리 예약 후 접속 표시
    b.onConnected((ok) => {
      if (!ok) return;
      b.onDisconnectRemove(`${base}/presence/${uid}`);
      b.onDisconnectRemove(`${base}/pos/${uid}`);
      b.set(`${base}/presence/${uid}`, b.ts());
    });
  }

  watchTiles(race) {
    if (race === this.tileRace) return;
    this.tileOff?.();
    this.tileRace = race;
    const hit = (key, t) => {
      // 방금 무너진 것만 (늦게 들어온 학생에게 예전 기록을 다시 재생하지 않는다)
      if (typeof t === 'number' && Math.abs(this.b.now() - t) < 2500) this.onTile?.(Number(key));
    };
    this.tileOff = this.b.onChild(`${this.base}/tiles/${race}`, { added: hit, changed: hit });
  }

  // ─── 학생 ───
  publishPosition(player, stateCode, nowMs = performance.now()) {
    const s = this.sent;
    if (nowMs - s.at < SEND_INTERVAL) return;
    const p = player.pos;
    const moved = Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z);
    let df = Math.abs(player.facing - s.f) % (Math.PI * 2);
    if (df > Math.PI) df = Math.PI * 2 - df;
    if (moved < 0.05 && df < 0.02 && stateCode === s.s && nowMs - s.at < HEARTBEAT) return;
    Object.assign(s, { x: p.x, y: p.y, z: p.z, f: player.facing, s: stateCode, at: nowMs });
    this.b.set(`${this.base}/pos/${this.uid}`, `${r2(p.x)},${r2(p.y)},${r2(p.z)},${r2(player.facing)},${stateCode}`);
  }

  publishProgress(fields) {
    return this.b.update(`${this.base}/players/${this.uid}`, fields);
  }

  triggerTile(index) {
    if (this.tileRace === null) return;
    this.b.set(`${this.base}/tiles/${this.tileRace}/${index}`, this.b.ts());
  }

  // ─── 교사 ───
  startRace(countdownMs = 4000) {
    return this.b.update(`${this.base}/meta`, {
      phase: 'RACE',
      race: (this.meta?.race || 0) + 1,
      seed: randomSeed(),
      startAt: this.b.now() + countdownMs,
      frozen: false,
    });
  }

  setFrozen(frozen) {
    return this.b.update(`${this.base}/meta`, { frozen });
  }

  endRace() {
    return this.b.update(`${this.base}/meta`, { phase: 'RESULT', frozen: false });
  }

  toLobby() {
    return this.b.update(`${this.base}/meta`, {
      phase: 'LOBBY',
      race: (this.meta?.race || 0) + 1,
      seed: randomSeed(),
      frozen: false,
    });
  }

  // 접속 중인 학생 목록
  students() {
    return Object.entries(this.players)
      .filter(([uid]) => this.presence[uid])
      .map(([uid, p]) => ({ uid, ...p, pos: this.positions.get(uid) || null }));
  }

  now() {
    return this.b.now();
  }
}
