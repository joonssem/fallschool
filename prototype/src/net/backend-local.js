// 시험용 모의 Realtime Database: 같은 브라우저의 탭들이 localStorage를 데이터베이스처럼 나눠 쓴다.
// 값 하나(말단)를 키 하나에 저장한다. 탭 사이의 localStorage 동기화는 비동기라서, 트리 전체를
// 통째로 덮어쓰면 다른 탭의 변경이 사라지기 때문이다. 다른 탭의 변경은 'storage' 이벤트로 받는다.
// 주소에 ?net=local 을 붙이면 Firebase 대신 이것을 쓴다.
const PREFIX = 'mockdb:';

const split = (path) => path.split('/').filter(Boolean);
const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

function getAt(tree, parts) {
  let n = tree;
  for (const p of parts) {
    if (n === null || typeof n !== 'object') return null;
    n = n[p];
  }
  return n === undefined ? null : n;
}

function setAt(tree, parts, value) {
  let n = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof n[parts[i]] !== 'object' || n[parts[i]] === null) n[parts[i]] = {};
    n = n[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (value === null || value === undefined) delete n[last];
  else n[last] = clone(value);
}

// 말단 키들을 모아 트리로 복원
function load() {
  const tree = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      setAt(tree, split(key.slice(PREFIX.length)), JSON.parse(localStorage.getItem(key)));
    } catch {}
  }
  return tree;
}

function removeUnder(path) {
  const base = PREFIX + split(path).join('/');
  const doomed = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === base || key?.startsWith(base + '/')) doomed.push(key);
  }
  for (const key of doomed) localStorage.removeItem(key);
}

function writeLeaves(path, value) {
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) writeLeaves(`${path}/${k}`, v);
  } else if (value !== null && value !== undefined) {
    localStorage.setItem(PREFIX + split(path).join('/'), JSON.stringify(value));
  }
}

export async function createLocalBackend() {
  const uid = 'u' + Math.random().toString(36).slice(2, 10);
  let tree = load();
  const listeners = new Set();
  const disconnectPaths = [];

  const notify = () => {
    for (const l of listeners) l.check();
  };

  function write(changes) {
    for (const [path, value] of changes) {
      removeUnder(path);
      writeLeaves(path, value);
    }
    tree = load();
    notify();
    return Promise.resolve();
  }

  window.addEventListener('storage', (e) => {
    if (e.key !== null && !e.key.startsWith(PREFIX)) return;
    tree = load();
    notify();
  });
  window.addEventListener('pagehide', () => write(disconnectPaths.map((p) => [p, null])));

  return {
    uid,
    kind: 'local',
    now: () => Date.now(),
    ts: () => Date.now(),
    set: (path, value) => write([[path, value]]),
    update: (path, value) => write(Object.entries(value).map(([k, v]) => [`${path}/${k}`, v])),
    get: (path) => Promise.resolve(clone(getAt(load(), split(path)))),
    onValue(path, cb) {
      const parts = split(path);
      const l = {
        last: undefined,
        check() {
          const v = getAt(tree, parts);
          const json = JSON.stringify(v);
          if (json === this.last) return;
          this.last = json;
          cb(clone(v));
        },
      };
      listeners.add(l);
      queueMicrotask(() => l.check());
      return () => listeners.delete(l);
    },
    onChild(path, { added, changed, removed }) {
      const parts = split(path);
      const l = {
        last: new Map(),
        check() {
          const v = getAt(tree, parts);
          const obj = v && typeof v === 'object' ? v : {};
          const seen = new Set();
          for (const [k, child] of Object.entries(obj)) {
            seen.add(k);
            const json = JSON.stringify(child);
            if (!this.last.has(k)) added?.(k, clone(child));
            else if (this.last.get(k) !== json) changed?.(k, clone(child));
            this.last.set(k, json);
          }
          for (const k of [...this.last.keys()]) {
            if (!seen.has(k)) {
              this.last.delete(k);
              removed?.(k);
            }
          }
        },
      };
      listeners.add(l);
      queueMicrotask(() => l.check());
      return () => listeners.delete(l);
    },
    onDisconnectRemove(path) {
      if (!disconnectPaths.includes(path)) disconnectPaths.push(path);
    },
    onConnected(cb) {
      queueMicrotask(() => cb(true));
    },
    async createIfAbsent(path, value) {
      if (getAt(load(), split(path)) !== null) return false;
      await write([[path, value]]);
      return true;
    },
  };
}
