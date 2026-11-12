import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../abo/web-auth.js', import.meta.url), 'utf8');
const signed = () => ({ uid: 'same-account', isAnonymous: false, emailVerified: true,
  email: 'caregiver@example.test', metadata: { lastSignInTime: 'Thu, 12 Nov 2026 08:51:00 GMT' } });
async function fixture(initial = signed()) {
  const events = [];
  let observer, anonymousCalls = 0;
  const auth = { currentUser: initial, authStateReady: async () => {} };
  const context = createContext({ Event, window: {
    DEMENZ_ABO_CONFIG: { firebase: { apiKey: 'fixture', projectId: 'fixture' } },
    dispatchEvent: event => events.push(event.type)
  } });
  const exports = [
    { getApps: () => [{ options: { projectId: 'fixture' } }] },
    { getAuth: () => auth, onIdTokenChanged: (_, callback) => { observer = callback; },
      signInAnonymously: async () => { anonymousCalls++; } }
  ];
  const dependencies = await Promise.all(exports.map(async values => {
    const module = new SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context });
    await module.link(() => {}); await module.evaluate(); return module;
  }));
  const module = new SourceTextModule(source, { context, importModuleDynamically: specifier => {
    if (specifier.endsWith('/firebase-app.js')) return dependencies[0];
    if (specifier.endsWith('/firebase-auth.js')) return dependencies[1];
    throw new Error('Unexpected dependency');
  } });
  await module.link(() => {}); await module.evaluate();
  await module.namespace.webAuth({ anonymous: false });
  return { auth, events, emit(user = auth.currentUser) { auth.currentUser = user; observer(user); },
    anonymousCalls: () => anonymousCalls };
}

test('successful same-UID reauthentication notifies the original tab exactly once', async () => {
  const f = await fixture();
  f.emit(); assert.deepEqual(f.events, []);
  f.emit({ ...f.auth.currentUser, metadata: { lastSignInTime: 'Thu, 12 Nov 2026 13:04:30 GMT' } });
  assert.deepEqual(f.events, ['demenz-auth-changed']);
  assert.equal(f.auth.currentUser.uid, 'same-account');
  f.emit(); assert.equal(f.events.length, 1);
});

test('ordinary token refresh and unrelated metadata do not claim another sign-in', async () => {
  const f = await fixture();
  for (let i = 0; i < 3; i++) f.emit({ ...f.auth.currentUser,
    stsTokenManager: { accessToken: 'synthetic-refresh-' + i },
    metadata: { ...f.auth.currentUser.metadata, creationTime: 'unrelated' } });
  assert.deepEqual(f.events, []);
  assert.equal(f.anonymousCalls(), 0);
});

test('missing metadata never loops and existing sign-out/account-change signals remain', async () => {
  const initial = signed(); delete initial.metadata;
  const f = await fixture(initial);
  f.emit(); f.emit({ ...initial, metadata: null }); f.emit({ ...initial, metadata: {} });
  assert.deepEqual(f.events, []);
  f.emit({ ...initial, uid: 'other-account' });
  f.emit(null); f.emit(null);
  assert.deepEqual(f.events, ['demenz-auth-changed', 'demenz-auth-changed']);
  assert.equal(f.anonymousCalls(), 0);
});

test('anonymous-to-verified transitions retain the existing event behavior', async () => {
  const f = await fixture({ uid: 'same-account', isAnonymous: true, emailVerified: false });
  f.emit({ ...signed(), metadata: undefined });
  assert.deepEqual(f.events, ['demenz-auth-changed']);
  assert.equal(f.auth.currentUser.uid, 'same-account');
});
