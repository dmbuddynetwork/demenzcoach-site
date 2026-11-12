import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
const source = await readFile(new URL('../abo/web-experiments.js', import.meta.url), 'utf8');
function fixture(src = 'campaign_a') {
  let consent = false;
  const saved = new Map(), session = new Map(), events = [];
  const host = { crypto: webcrypto, location: { href: `https://dementiacoachapp.com/de/?src=${src}` }, localStorage: {
    getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key)
  }, sessionStorage: { getItem: (key) => session.get(key) ?? null, setItem: (key,value) => session.set(key,value), removeItem: (key) => session.delete(key) }, addEventListener() {}, DemenzConsent: { statistics: () => consent, track: (...args) => events.push(args) } };
  runInContext(source, createContext({ window: host, URL, Date, Uint8Array }));
  return { saved, session, events, api: host.DemenzWebExperiments, grant() { consent = true; }, revoke() { consent = false; host.DemenzWebExperiments.consentChanged(); } };
}
test('no consent means no experiment ID, persisted campaign or events', () => {
  const f = fixture();
  assert.deepEqual(Object.keys(f.api.headers()), []); assert.equal(f.api.campaign(), '');
  f.api.track('web_signup_verified'); assert.equal(f.saved.size, 0); assert.equal(f.events.length, 0);
});
test('consented unit is stable and exposure/event properties are strictly allowlisted', () => {
  const f = fixture(); f.grant();
  const first = f.api.headers()['X-Experiment-Unit'];
  assert.match(first, /^[a-f0-9]{32}$/u); assert.equal(f.api.headers()['X-Experiment-Unit'], first);
  f.api.accept({ experiment: 'web-translator-introduction-v1', variation: 1, unit: first, text: 'must never pass' });
  f.api.accept({ experiment: 'web-translator-introduction-v1', variation: 1, unit: first });
  assert.equal(f.events.length, 1);
  f.api.track('web_signup_verified', { email: 'must not pass' }); f.api.track('arbitrary_event');
  assert.equal(f.events.length, 2);
  assert.deepEqual(Object.keys(f.events[1][1]).sort(), ['assignment_id', 'campaign_id', 'experiment_id', 'variation_id']);
  assert.equal(f.events[1][1].campaign_id, 'campaign_a');
  assert.ok(!JSON.stringify(f.events).includes('must'));
});
test('revocation clears browser attribution and stops later events', () => {
  const f = fixture(); f.grant();
  const id = f.api.headers()['X-Experiment-Unit'];
  f.api.accept({ experiment: 'web-translator-introduction-v1', variation: 0, unit: id });
  f.revoke(); f.api.track('web_checkout_clicked');
  assert.equal(f.saved.size, 0); assert.equal(f.events.length, 1); assert.equal(f.api.campaign(), '');
});
test('unapproved source values, stale IDs and invalid variants cannot enter events', () => {
  const f = fixture('private-care-text'); f.grant();
  const id = f.api.headers()['X-Experiment-Unit'];
  assert.equal(f.api.campaign(), 'direct');
  f.api.accept({ experiment: 'web-translator-introduction-v1', variation: 0, unit: 'a'.repeat(32) });
  f.api.track('web_answer_completed'); assert.equal(f.events.length, 0);
  f.api.accept({ experiment: 'web-translator-introduction-v1', variation: 99, unit: id });
  assert.equal(f.events.length, 0);
  assert.ok(!JSON.stringify([...f.saved.values()]).includes('private-care-text'));
});

test('an open page stops using an expired exposure rather than emitting its old ID', () => {
  const f = fixture(); f.grant();
  const id = f.api.headers()['X-Experiment-Unit'];
  f.api.accept({ experiment: 'web-translator-introduction-v1', variation: 0, unit: id });
  const record = JSON.parse(f.saved.get('demenzcoach.webExperiment.v1'));
  record.expires = Date.now() - 1;
  f.saved.set('demenzcoach.webExperiment.v1', JSON.stringify(record));
  f.api.track('web_checkout_clicked');
  assert.equal(f.events.length, 1);
  assert.notEqual(f.api.headers()['X-Experiment-Unit'], id);
});

test('email completion waits for a consented valid exposure and is emitted once without profile data', () => {
  const f=fixture(); f.grant();
  f.session.set('demenzcoach.emailSignupCompleted.v1',JSON.stringify({expires:Date.now()+600000}));
  assert.equal(f.events.length,0);
  const unit=f.api.headers()['X-Experiment-Unit'];
  f.api.accept({experiment:'web-translator-introduction-v1',variation:0,unit});
  f.api.accept({experiment:'web-translator-introduction-v1',variation:0,unit});
  assert.equal(f.events.filter(([name])=>name==='web_signup_verified').length,1);
  assert.equal(f.session.size,0);
  assert.deepEqual(Object.keys(f.events[1][1]).sort(),['assignment_id','campaign_id','experiment_id','variation_id']);
});
test('revocation or an expired email completion flag cannot trigger a signup measurement', () => {
  for(const revoked of [false,true]) {
    const f=fixture();f.grant();f.session.set('demenzcoach.emailSignupCompleted.v1',JSON.stringify({expires:Date.now()-1}));
    if(revoked) {f.revoke(); assert.equal(f.session.size,0);}
    const unit=f.api.headers()['X-Experiment-Unit'];f.api.accept({experiment:'web-translator-introduction-v1',variation:0,unit});
    assert.equal(f.events.filter(([name])=>name==='web_signup_verified').length,0);
  }
});

const copyFeature = 'web-translator-signup-copy-v1';
const copyKey = 'demenzcoach.signupCopyExposure.v1';
const completionKey = 'demenzcoach.emailSignupCompleted.v1';
const copyValue = (unit, variant = 'variant_3', variation = 1) => ({ variant, exposure: { experiment: copyFeature, variation, unit } });
test('copy without statistics consent stays at variant1 without attribution storage or events', () => {
  const f = fixture();
  assert.equal(f.api.signupCopyVariant(copyValue('a'.repeat(32))), 'variant_1');
  f.api.showSignupCopy(copyValue('a'.repeat(32)));
  f.api.queueSignupCompletion(); f.api.acceptAccess({ enabled: true, verified: true });
  assert.equal(f.saved.size, 0); assert.equal(f.session.size, 0); assert.equal(f.events.length, 0);
});
test('copy exposure is independent of quota experiments and stores only approved metadata', () => {
  const f = fixture(); f.grant(); const unit = f.api.headers()['X-Experiment-Unit'];
  const value = { ...copyValue(unit), email: 'private@example.test', text: 'PRIVATE_CARE_TEXT' };
  assert.equal(f.api.signupCopyVariant(value), 'variant_3');
  f.api.showSignupCopy(value); f.api.showSignupCopy(value);
  assert.equal(f.events.length, 1); assert.equal(f.events[0][0], 'web_signup_copy_shown');
  assert.equal(f.events[0][1].experiment_id, copyFeature);
  assert.deepEqual(Object.keys(JSON.parse(f.saved.get(copyKey))).sort(), ['converted', 'expires', 'unit', 'variant', 'variation']);
  assert.ok(!JSON.stringify([...f.saved.values(), f.events]).includes('PRIVATE'));
  assert.ok(!JSON.stringify([...f.saved.values(), f.events]).includes('private@example.test'));
});
test('signup conversion waits for backend verified access and attributes the copy actually seen', () => {
  const f = fixture(); f.grant(); const unit = f.api.headers()['X-Experiment-Unit'];
  f.api.showSignupCopy(copyValue(unit)); f.api.queueSignupCompletion();
  f.api.acceptAccess({ enabled: true, verified: false });
  assert.equal(f.events.length, 1); assert.equal(f.session.size, 1);
  f.api.acceptAccess({ enabled: true, verified: true, signupCopy: copyValue(unit, 'variant_1', 0) });
  assert.equal(f.events.length, 2); assert.equal(f.events[1][0], 'web_signup_copy_verified');
  assert.equal(f.events[1][1].variation_id, 1); assert.equal(f.session.size, 0);
  assert.deepEqual(Object.keys(f.events[1][1]).sort(), ['assignment_id', 'campaign_id', 'experiment_id', 'variation_id']);
  f.api.queueSignupCompletion(); assert.equal(f.session.size, 0);
  f.session.set(completionKey, JSON.stringify({ expires: Date.now() + 600000 }));
  f.api.acceptAccess({ enabled: true, verified: true }); assert.equal(f.events.length, 2);
});
test('valid access alone, an invalid expiry and an expired copy cannot fabricate signup conversion', () => {
  for (const mode of ['missing-completion', 'invalid-completion', 'expired-copy', 'disabled-access']) {
    const f = fixture(); f.grant(); const unit = f.api.headers()['X-Experiment-Unit'];
    f.api.showSignupCopy(copyValue(unit));
    if (mode !== 'missing-completion') f.session.set(completionKey, JSON.stringify(mode === 'invalid-completion' ? {} : { expires: Date.now() + 600000 }));
    if (mode === 'expired-copy') {
      const record = JSON.parse(f.saved.get(copyKey)); record.expires = Date.now() - 1; f.saved.set(copyKey, JSON.stringify(record));
    }
    f.api.acceptAccess({ enabled: mode !== 'disabled-access', verified: true });
    assert.equal(f.events.length, 1, mode);
  }
});
test('invalid copy assignments cannot create exposure and unknown variants use the selected default', () => {
  const f = fixture(); f.grant(); const unit = f.api.headers()['X-Experiment-Unit'];
  assert.equal(f.api.signupCopyVariant({ variant: '<img src=x>' }), 'variant_1');
  for (const value of [copyValue('a'.repeat(32)), copyValue(unit, 'unknown'), copyValue(unit, 'variant_3', 20), copyValue(unit, 'variant_3', 0), { variant: 'variant_1', exposure: { experiment: 'another-project', unit, variation: 0 } }]) f.api.showSignupCopy(value);
  assert.equal(f.events.length, 0); assert.equal(f.saved.has(copyKey), false);
});
test('revocation clears copy attribution and completion flags, then restores default copy', () => {
  const f = fixture(); f.grant(); const unit = f.api.headers()['X-Experiment-Unit'];
  f.api.showSignupCopy(copyValue(unit)); f.api.queueSignupCompletion(); f.revoke();
  assert.equal(f.saved.size, 0); assert.equal(f.session.size, 0);
  assert.equal(f.api.signupCopyVariant(copyValue(unit)), 'variant_1');
  f.api.acceptAccess({ enabled: true, verified: true }); assert.equal(f.events.length, 1);
});
test('unit expiry removes copy attribution and stale assignments return to the default', () => {
  const f = fixture(); f.grant(); const oldUnit = f.api.headers()['X-Experiment-Unit'];
  f.api.showSignupCopy(copyValue(oldUnit));
  const identity = JSON.parse(f.saved.get('demenzcoach.webExperiment.v1'));
  identity.expires = Date.now() - 1; f.saved.set('demenzcoach.webExperiment.v1', JSON.stringify(identity));
  assert.equal(f.api.signupCopyVariant(copyValue(oldUnit)), 'variant_1');
  assert.equal(f.saved.has(copyKey), false);
  assert.notEqual(f.api.headers()['X-Experiment-Unit'], oldUnit);
});
