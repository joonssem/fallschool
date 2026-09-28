// Firebase Realtime Database 백엔드 (교실 대소동과 같은 SDK 버전, 로그인 없음)
import { firebaseConfig } from './config.js';

const SDK = 'https://www.gstatic.com/firebasejs/9.23.0';

function makeUid() {
  // 탭마다 다른 플레이어가 되도록 sessionStorage에 보관 (새로고침하면 같은 사람)
  try {
    let id = sessionStorage.getItem('fallschool.uid');
    if (!id) {
      id = 'u' + Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem('fallschool.uid', id);
    }
    return id;
  } catch {
    return 'u' + Math.random().toString(36).slice(2, 12);
  }
}

export async function createFirebaseBackend({ longPolling = false } = {}) {
  const appM = await import(`${SDK}/firebase-app.js`);
  const dbM = await import(`${SDK}/firebase-database.js`);
  const app = appM.initializeApp(firebaseConfig, 'fallschool');
  // 학교망에서 웹소켓이 막힐 때를 대비한 강제 롱폴링 (?lp)
  if (longPolling) dbM.forceLongPolling();
  const db = dbM.getDatabase(app);
  const ref = (path) => dbM.ref(db, path);

  let offset = 0;
  dbM.onValue(ref('.info/serverTimeOffset'), (s) => {
    offset = s.val() || 0;
  });

  return {
    uid: makeUid(),
    kind: 'firebase',
    now: () => Date.now() + offset,
    ts: () => dbM.serverTimestamp(),
    set: (path, value) => dbM.set(ref(path), value),
    update: (path, value) => dbM.update(ref(path), value),
    get: async (path) => (await dbM.get(ref(path))).val(),
    onValue: (path, cb) => dbM.onValue(ref(path), (s) => cb(s.val())),
    onChild(path, { added, changed, removed }) {
      const r = ref(path);
      const offs = [];
      if (added) offs.push(dbM.onChildAdded(r, (s) => added(s.key, s.val())));
      if (changed) offs.push(dbM.onChildChanged(r, (s) => changed(s.key, s.val())));
      if (removed) offs.push(dbM.onChildRemoved(r, (s) => removed(s.key)));
      return () => offs.forEach((off) => off());
    },
    onDisconnectRemove: (path) => dbM.onDisconnect(ref(path)).remove(),
    onConnected: (cb) => dbM.onValue(ref('.info/connected'), (s) => cb(!!s.val())),
    async createIfAbsent(path, value) {
      const res = await dbM.runTransaction(ref(path), (cur) => (cur === null ? value : undefined));
      return res.committed;
    },
  };
}
