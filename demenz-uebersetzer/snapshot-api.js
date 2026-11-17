// Calls for anonymous answer links. No login, no cookies, no referrer.
// The server stores a link record only after create. Resolve, delete and compose never call the AI.
(function (root) {
  const base = 'https://europe-west1-dementica-df17b.cloudfunctions.net/api/v1/translator-web/snapshots/';
  const call = async (action, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(base + action, {
        method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal
      });
      let data = {};
      try { data = await response.json(); } catch { data = {}; }
      if (response.ok) return { ok: true, status: response.status, data };
      return { ok: false, status: response.status, code: typeof data?.code === 'string' ? data.code : 'unavailable' };
    } catch { return { ok: false, status: 0, code: 'network' }; }
    finally { clearTimeout(timer); }
  };
  root.DemenzSnapshotAPI = Object.freeze({
    create: proof => call('create', { proof }),
    resolve: readToken => call('resolve', { readToken }),
    remove: (readToken, deleteToken) => call('delete', { readToken, deleteToken }),
    compose: (context, answerProof) => call('compose', { context, answerProof })
  });
  // Delete capabilities stay in this browser only, never in the shared URL. If this storage is
  // unavailable the link still works, but the creator cannot revoke it early.
  const storageKey = 'demenzcoach.sharedLinks.v1';
  const tokenShape = /^[A-Za-z0-9_-]{43}$/u;
  const readAll = () => {
    try {
      const list = JSON.parse(root.localStorage.getItem(storageKey) || '[]');
      return Array.isArray(list) ? list.filter(item => item && tokenShape.test(item.readToken) && tokenShape.test(item.deleteToken)) : [];
    } catch { return []; }
  };
  const writeAll = list => { try { root.localStorage.setItem(storageKey, JSON.stringify(list.slice(-30))); return true; } catch { return false; } };
  root.DemenzSnapshotStore = Object.freeze({
    add: entry => writeAll([...readAll().filter(item => item.readToken !== entry.readToken), entry]),
    find: readToken => readAll().find(item => item.readToken === readToken) || null,
    remove: readToken => writeAll(readAll().filter(item => item.readToken !== readToken)),
    tokenShape
  });
})(typeof window !== 'undefined' ? window : globalThis);
