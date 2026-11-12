import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
const source = await readFile(new URL('../abo/email-auth.js', import.meta.url), 'utf8');
const { createEmailAccess, safeEmailReturn, emailAccountURL } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const address = 'caregiver@example.test';
function fixture({ customer = false, status = 200, collision = false, uid = 'guest-one', initialEmail = null, enabled = true, locale = 'de' } = {}) {
  let time = 100000, used = false;
  const storage = new Map(), session = new Map(), calls = [];
  const user = (id, email = null) => ({ uid: id, email, emailVerified: Boolean(email), isAnonymous: !email, providerData: email ? [{ providerId: 'password' }] : [], getIdToken: async () => 'synthetic-token' });
  const auth = { currentUser: uid ? user(uid, initialEmail) : null };
  const consume = (credential) => {
    if (used) throw Object.assign(new Error(), { code: 'auth/invalid-action-code' });
    if (credential.email.toLowerCase() !== address) throw Object.assign(new Error(), { code: 'auth/invalid-email' });
    used = true;
  };
  const sdk = {
    EmailAuthProvider: { credentialWithLink: (email, url) => ({ email, url }) },
    isSignInWithEmailLink: (_, url) => new URL(url).searchParams.has('oobCode'),
    async sendSignInLinkToEmail(_, email, settings) { calls.push({ kind: 'send', email, settings }); },
    async linkWithCredential(current, credential) {
      calls.push({ kind: 'link', uid: current.uid });
      if (collision) throw Object.assign(new Error(), { code: 'auth/email-already-in-use' });
      consume(credential); auth.currentUser = user(current.uid, credential.email);
    },
    async signInWithCredential(_, credential) { calls.push({ kind: 'signin' }); consume(credential); auth.currentUser = user('existing-email-user', credential.email); },
    async reauthenticateWithCredential(current, credential) { calls.push({ kind: 'reauth', uid: current.uid }); consume(credential); auth.currentUser = user(current.uid, credential.email); }
  };
  const host = { document: { documentElement: { lang: locale } }, location: { origin: 'https://dementiacoachapp.com' }, crypto: webcrypto,
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    sessionStorage: { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) },
    fetch: async (url, options) => { calls.push({ kind: 'binding', url, options }); return new Response(JSON.stringify(customer === 'malformed' ? {} : { hasCustomer: customer }), { status }); }
  };
  const api = createEmailAccess({ webAuth: async ({ anonymous }) => { if (anonymous && !auth.currentUser) auth.currentUser = user('new-guest'); return { auth, sdk }; }, config: { signIn: { emailLink: enabled }, endpoint: 'https://synthetic.invalid/v1/web-checkout' }, host, now: () => time });
  const link = () => {
    const url = new URL(calls.findLast((call) => call.kind === 'send').settings.url);
    url.searchParams.set('mode', 'signIn'); url.searchParams.set('oobCode', 'synthetic-action-code'); return url.href;
  };
  return { api, auth, host, storage, session, calls, link, advance: (ms) => { time += ms; } };
}

test('native send has fixed callback, no password/phone, no care/UID/email/checkout reference in the link', async () => {
  const f = fixture();
  await f.api.begin({ email: address, returnTo: '/abo/?plan=monthly&src=campaign_a&c=campaign_b&status=fertig&session_id=cs_synthetic_owner', intent: 'link' });
  const send = f.calls[0];
  assert.equal(send.kind, 'send'); assert.equal(send.settings.handleCodeInApp, true);
  const url = new URL(send.settings.url);
  assert.equal(url.pathname, '/abo/email-link.html'); assert.equal(url.searchParams.get('returnTo'), '/abo/');
  assert.ok(!send.settings.url.includes(address)); assert.ok(!send.settings.url.includes('guest-one')); assert.ok(!send.settings.url.includes('cs_synthetic_owner'));
  assert.equal(f.calls.filter((call) => call.kind === 'binding').length, 0);
});

test('same-browser link preserves the original UID and removes attempt data without newsletter enrollment', async () => {
  const f = fixture(); await f.api.begin({ email: address });
  const pending = f.api.attempt(); const result = await f.api.finish({ url: f.link(), state: pending.nonce });
  assert.equal(result.user.uid, 'guest-one'); assert.equal(result.user.emailVerified, true);
  assert.equal(f.api.attempt(), null); assert.equal(f.calls.some((call) => call.kind === 'signin'), false);
  assert.equal(f.session.size, 0); assert.ok(!JSON.stringify([...f.storage]).includes('synthetic-action-code'));
});

test('callback in another browser asks for email and cannot infer an address from the URL', async () => {
  const original = fixture(); await original.api.begin({ email: address }); const url = original.link();
  const other = fixture({ uid: null }); const state = new URL(url).searchParams.get('state');
  assert.equal((await other.api.inspect(url, state)).pending, null);
  await assert.rejects(other.api.finish({ url, state }), { code: 'email_required' });
  const signed = await other.api.finish({ url, state, email: address });
  assert.equal(signed.user.uid, 'existing-email-user'); assert.equal(original.auth.currentUser.uid, 'guest-one');
});

test('a changed signed-in UID cannot use another local link attempt', async () => {
  const f = fixture(); await f.api.begin({ email: address }); const state = f.api.attempt().nonce;
  f.auth.currentUser = { ...f.auth.currentUser, uid: 'different-user' };
  await assert.rejects(f.api.finish({ url: f.link(), state }), { code: 'original_browser_required' });
  assert.equal(f.calls.some((call) => ['link', 'signin'].includes(call.kind)), false);
});

test('another email cannot consume a locally initiated link', async () => {
  const f = fixture(); await f.api.begin({ email: address });
  await assert.rejects(f.api.finish({ url: f.link(), state: f.api.attempt().nonce, email: 'other@example.test' }), { code: 'email_mismatch' });
});

for (const mode of [{ customer: true }, { customer: 'malformed' }, { customer: false, status: 503 }]) {
  test(`paid/pending/unknown collision never abandons guest UID: ${JSON.stringify(mode)}`, async () => {
    const f = fixture({ ...mode, collision: true }); await f.api.begin({ email: address, intent: 'signin' });
    await assert.rejects(f.api.finish({ url: f.link(), state: f.api.attempt().nonce }), { code: 'account_collision' });
    assert.equal(f.auth.currentUser.uid, 'guest-one'); assert.equal(f.calls.some((call) => call.kind === 'signin'), false);
  });
}

test('explicit existing-account sign-in can switch only an authoritatively unbound guest', async () => {
  const f = fixture({ collision: true }); await f.api.begin({ email: address, intent: 'signin' });
  const result = await f.api.finish({ url: f.link(), state: f.api.attempt().nonce });
  assert.equal(result.user.uid, 'existing-email-user');
  const check = f.calls.find((call) => call.kind === 'binding');
  assert.equal(check.options.headers.Authorization, 'Bearer synthetic-token'); assert.equal(check.options.referrerPolicy, 'no-referrer');
});

test('a registration collision does not silently turn into another account', async () => {
  const f = fixture({ collision: true }); await f.api.begin({ email: address, intent: 'link' });
  await assert.rejects(f.api.finish({ url: f.link(), state: f.api.attempt().nonce }), { code: 'account_collision' });
  assert.equal(f.calls.some((call) => call.kind === 'signin'), false);
});

test('a callback without local linking proof cannot switch paid or unknown guest identities', async () => {
  for (const customer of [true, 'malformed']) {
    const f = fixture({ customer });
    await assert.rejects(f.api.finish({ email: address, url: 'https://dementiacoachapp.com/abo/email-link.html?oobCode=synthetic', state: 'foreign' }), { code: 'original_browser_required' });
    assert.equal(f.auth.currentUser.uid, 'guest-one');
  }
});

test('resending is bounded and stale attempt records are removed rather than reused', async () => {
  const f = fixture(); await f.api.begin({ email: address });
  await assert.rejects(f.api.begin({ email: address }), { code: 'wait_before_resend' });
  f.advance(31 * 60000); assert.equal(f.api.attempt(), null);
  assert.equal(f.storage.has('demenzcoach.emailLinkAttempt.v1'), false);
});

test('an already verified current email account reauthenticates without changing UID', async () => {
  const f = fixture({ initialEmail: address }); await f.api.begin({ email: address, intent: 'signin' });
  const result = await f.api.finish({ url: f.link(), state: f.api.attempt().nonce });
  assert.equal(result.user.uid, 'guest-one'); assert.equal(f.calls.findLast((call) => call.kind === 'reauth').uid, 'guest-one');
});

test('an existing unverified password-provider email reauthenticates and verifies the original UID', async () => {
  const f=fixture({initialEmail:address}); f.auth.currentUser.emailVerified=false;
  await f.api.begin({email:address,intent:'link'});
  const result=await f.api.finish({url:f.link(),state:f.api.attempt().nonce});
  assert.equal(result.user.uid,'guest-one');assert.equal(result.user.emailVerified,true);
  assert.equal(f.calls.filter((call)=>call.kind==='link').length,0);
  assert.equal(f.calls.filter((call)=>call.kind==='reauth').length,1);
});

test('only prior statistics consent queues a neutral verified-signup event', async () => {
  const f = fixture(); f.storage.set('demenzcoach.analyticsConsent.v1', 'granted'); await f.api.begin({ email: address });
  await f.api.finish({ url: f.link(), state: f.api.attempt().nonce });
  const event = f.session.get('demenzcoach.emailSignupCompleted.v1');
  assert.ok(event); assert.ok(!event.includes(address)); assert.ok(!event.includes('guest-one')); assert.ok(!event.includes('synthetic-action-code'));
});

test('return targets retain only explicit checkout fields and reject foreign or care-text URLs', () => {
  const origin = 'https://dementiacoachapp.com';
  assert.equal(safeEmailReturn('https://evil.example/abo/', origin), '/de/');
  assert.equal(safeEmailReturn('//evil.example/abo/', origin), '/de/');
  assert.equal(safeEmailReturn('/de/?text=private-care-text', origin), '/de/');
  const returnTo = '/abo/?plan=monthly&src=campaign_a&c=campaign_b&status=fertig&session_id=cs_synthetic_owner&input=private';
  assert.equal(safeEmailReturn(returnTo, origin), '/abo/?plan=monthly&src=campaign_a&c=campaign_b&status=fertig&session_id=cs_synthetic_owner');
  assert.match(emailAccountURL('/abo/mein-plan.html', origin, 'signin'), /intent=signin/u);
});

test('bootstrap removes action parameters before any other scripts and keeps the link in memory only', async () => {
  const code = await readFile(new URL('../abo/email-link-bootstrap.js', import.meta.url), 'utf8');
  const url = 'https://dementiacoachapp.com/abo/email-link.html?state=abc&returnTo=%2Fde%2F&mode=signIn&oobCode=synthetic-secret#tracking';
  const writes = [], host = { location: { href: url }, history: { state: null, replaceState(...args) { writes.push(args); } } };
  runInContext(code, createContext({ window: host, URL, Object }));
  assert.equal(writes[0][2], '/abo/email-link.html');
  assert.equal(host.DemenzEmailLinkContext.take().url, url); assert.equal(host.DemenzEmailLinkContext.take().url, '');
  for (const name of ['konto.html', 'email-link.html']) {
    const html = await readFile(new URL('../abo/' + name, import.meta.url), 'utf8');
    assert.ok(html.indexOf('name="referrer" content="no-referrer"') < html.indexOf('email-link-bootstrap.js'));
    assert.ok(html.indexOf('email-link-bootstrap.js') < html.indexOf('stylesheet'));
    assert.doesNotMatch(html, /lovable-home|web-experiments|gtag|facebook|recaptcha|type="tel"/iu);
  }
});

test('email collision stops if another account takes over during purchase-binding lookup',async()=>{const f=fixture({collision:true});await f.api.begin({email:address,intent:'signin'});f.host.fetch=async()=>{f.auth.currentUser={uid:'other-account',isAnonymous:false,emailVerified:true,email:'other@example.test'};return new Response(JSON.stringify({hasCustomer:false}))};await assert.rejects(f.api.finish({url:f.link(),state:f.api.attempt().nonce}),{code:'identity_changed'});assert(!f.calls.some(c=>c.kind==='signin'));assert.equal(f.auth.currentUser.uid,'other-account');});

test('no-pending email callback preserves a same-UID account upgraded during lookup',async()=>{const f=fixture();f.host.fetch=async()=>{f.auth.currentUser={...f.auth.currentUser,isAnonymous:false,emailVerified:true,email:'other@example.test'};return new Response(JSON.stringify({hasCustomer:false}))};await assert.rejects(f.api.finish({url:'https://dementiacoachapp.com/abo/email-link.html?oobCode=synthetic',state:'foreign',email:address}),{code:'identity_changed'});assert(!f.calls.some(c=>c.kind==='signin'));assert.equal(f.auth.currentUser.uid,'guest-one');});

for (const [locale, expected] of [['de', 'de'], ['en-US', 'en'], ['', 'de']]) test(`the actual email send uses page locale ${locale || 'fallback'}`, async () => {
  const f = fixture({ locale });
  await f.api.begin({ email: address });
  assert.equal(f.auth.languageCode, expected);
  assert.equal(f.calls.filter(call => call.kind === 'send').length, 1);
  assert.equal(f.auth.currentUser.uid, 'guest-one');
});
