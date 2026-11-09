import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker, { tellerTarget } from '../cloudflare-worker.js';
const source = fs.readFileSync(new URL('../lovable-home.js', import.meta.url), 'utf8');
const context = { URL };
vm.runInNewContext(source.split('// End Teller experiment factory.')[0] + '\nglobalThis.factory = createTellerExperiment;', context);
const origin = 'https://dementiacoachapp.com';
const lockQueues = new WeakMap();
const fixture = ({ consent = false, path = '/de/?teller=website', storage = new Map(), blocked = false, locks = true } = {}) => {
  const events = [], cookies = [], redirects = [];
  let reads = 0, writes = 0, clock = 1800000000000;
  if (!lockQueues.has(storage)) lockQueues.set(storage, Promise.resolve());
  const navigator = locks ? { locks: { request(key, action) {
    const next = lockQueues.get(storage).then(action);
    lockQueues.set(storage, next.catch(() => {}));
    return next;
  } } } : {};
  const host = { navigator, location: { href: origin + path, origin, replace: value => redirects.push(value) },
    history: { state: { screen: 'relation' }, replaceState(state, title, path) { this.state = state; host.location.href = origin + path; } },
    document: { set cookie(value) { cookies.push(value); } },
    localStorage: {
      getItem(key) { reads++; if (blocked) throw Error('blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { writes++; if (blocked) throw Error('blocked'); storage.set(key, value); },
      removeItem(key) { storage.delete(key); }
    } };
  const experiment = context.factory({ host, statistics: () => consent, track: (name, params) => events.push({ name, params }), now: () => clock });
  return { experiment, host, events, cookies, redirects, storage, reads: () => reads, writes: () => writes,
    consent(value) { consent = value; return experiment.consentChanged(); }, advance(ms) { clock += ms; } };
};
test('entry endpoints use uncached 302s; subpages remain outside the experiment', async () => {
  for (const path of ['/teller', '/teller/', '/teller/index.html']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await worker.fetch(new Request(origin + path + '?text=synthetic-secret&utm_source=synthetic-secret', { method }), {});
      assert.equal(response.status, 302);
      assert.match(response.headers.get('Cache-Control'), /no-store/);
      assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
      assert.equal(response.headers.get('Set-Cookie'), null);
      assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
      assert.match(response.headers.get('Location'), /^https:\/\/dementiacoachapp.com\/(de|start)\/\?teller=(website|funnel)$/);
    }
  }
  assert.equal((await worker.fetch(new Request(origin + '/teller', { method: 'POST' }), {})).status, 405);
  const config = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  for (const path of ['/teller', '/teller/', '/teller/index.html']) assert.ok(config.includes(`"${path}"`));
  const response = await worker.fetch(new Request(origin + '/teller/bestehend.html'), { ASSETS: { fetch: () => new Response('missing', { status: 404 }) } });
  assert.equal(response.status, 404);
});
test('fair random boundary, safe language, fixed destinations and consent-cookie reuse', async () => {
  let website = 0;
  for (let i = 0; i < 200; i++) if (tellerTarget(new Request(origin + '/teller'), () => i / 200).includes('/de/')) website++;
  assert.equal(website, 100);
  assert.equal(tellerTarget(new Request(origin + '/teller?lang=en&url=https://evil.example'), () => 0), origin + '/en/?teller=website');
  assert.equal(tellerTarget(new Request(origin + '/teller?lang=//evil.example'), () => 0), origin + '/de/?teller=website');
  for (const arm of ['website', 'funnel']) assert.ok(tellerTarget(new Request(origin + '/teller', { headers: { Cookie: `other=1; dc_teller_v1=${arm}; x=1` } }), () => 0.5).endsWith('teller=' + arm));
});
test('no consent means no experimental storage, cookie, statistics or checkout metadata', async () => {
  const f = fixture();
  await f.experiment.stage('first_answer'); await f.experiment.stage('complete');
  assert.equal(f.reads(), 0); assert.equal(f.writes(), 0);
  assert.deepEqual(f.cookies, []); assert.deepEqual(f.events, []);
  assert.equal(JSON.stringify(f.experiment.attribution()), '{}');
  assert.equal(f.host.location.href, origin + '/de/');
});
test('grant records a fixed arm and deduplicated milestones, never input values', async () => {
  const f = fixture(); await f.consent(true);
  await f.experiment.stage('first_answer'); await f.experiment.stage('first_answer'); await f.experiment.stage('complete');
  assert.deepEqual(f.events.map(e => e.name), ['teller_website_assigned','teller_website_first_answer','teller_website_complete']);
  assert.equal(JSON.stringify(f.experiment.attribution()), JSON.stringify({ source: 'teller_website', campaign: 'teller_v1', variant: 'a' }));
  assert.match(f.cookies[0], /Max-Age=2592000; Path=\/; SameSite=Lax; Secure/);
  const next = fixture({ consent: true, path: '/start/', storage: f.storage });
  await next.experiment.ready;
  assert.equal(next.events.length, 0);
  assert.equal(next.experiment.attribution().source, 'teller_website');
  assert.equal(next.experiment.attribution().variant, 'a');
});
test('decline/revocation removes the assignment and immediately stops metadata and events', async () => {
  const f = fixture({ consent: true }); await f.experiment.ready; await f.consent(false);
  assert.equal(f.storage.size, 0); assert.match(f.cookies.at(-1), /Max-Age=0/);
  const count = f.events.length; await f.experiment.stage('complete');
  assert.equal(f.events.length, count); assert.equal(JSON.stringify(f.experiment.attribution()), '{}');
  await f.consent(true); assert.equal(f.events.length, count); // no resurrection after revocation
});
test('expired, malformed or invalid entries do not silently leak or extend attribution', async () => {
  for (const value of ['null', '{}', '{"arm":"website","expiresAt":1,"events":{}}']) {
    const f = fixture({ consent: true, path: '/abo/', storage: new Map([['demenzcoach.teller.v1', value]]) });
    await f.experiment.ready;
    assert.equal(JSON.stringify(f.experiment.attribution()), '{}'); assert.equal(f.events.length, 0);
  }
  const invalid = fixture({ consent: true, path: '/de/?teller=synthetic-secret' });
  assert.equal(invalid.events.length, 0); assert.equal(invalid.host.location.href, origin + '/de/');
  const f = fixture({ consent: true }); await f.experiment.ready; f.advance(30 * 86400000 + 1);
  assert.equal(JSON.stringify(f.experiment.attribution()), '{}');
});
test('blocked storage supports only the current page and writes no durable assignment cookie', async () => {
  const f = fixture({ consent: true, blocked: true }); await f.experiment.ready;
  assert.equal(f.cookies.length, 0); assert.equal(f.events.length, 1);
});
test('lost cookie cannot mix the shown landing page with the previously stored arm', async () => {
  const previous = fixture({ consent: true }); await previous.experiment.ready;
  const next = fixture({ consent: true, path: '/start/?teller=funnel', storage: previous.storage });
  await next.experiment.ready;
  assert.deepEqual(next.redirects, [origin + '/de/?teller=website']);
  await next.experiment.ready;
  assert.equal(next.events.length, 0); assert.equal(next.experiment.redirecting(), true);
});

test('two simultaneous tabs share one assignment and never duplicate or erase milestones', async () => {
  const storage = new Map();
  const a = fixture({ consent: true, path: '/start/?teller=funnel', storage });
  const b = fixture({ consent: true, path: '/start/?teller=funnel', storage });
  await Promise.all([a.experiment.ready, b.experiment.ready]);
  await Promise.all([a.experiment.stage('first_answer'), b.experiment.stage('first_answer')]);
  await b.experiment.consentChanged(); // cannot overwrite another tab's milestone
  await Promise.all([a.experiment.stage('complete'), b.experiment.stage('complete')]);
  const names = [...a.events, ...b.events].map(e => e.name);
  for (const stage of ['assigned','first_answer','complete']) assert.equal(names.filter(n => n === 'teller_funnel_' + stage).length, 1);
  assert.equal(JSON.parse(storage.get('demenzcoach.teller.v1')).events.complete, true);
});
test('without Web Locks routing can persist after consent but experimental statistics/metadata stay off', async () => {
  const f = fixture({ consent: true, locks: false }); await f.experiment.ready;
  await f.experiment.stage('complete');
  assert.equal(f.events.length, 0); assert.equal(JSON.stringify(f.experiment.attribution()), '{}');
  assert.match(f.cookies.at(-1), /dc_teller_v1=website/);
});
