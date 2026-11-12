// Real transport/controller, synthetic held replies and auth. No real provider/auth actions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const evidence = process.env.SIGNUP_COPY_EVIDENCE;
const normal = { kind: 'answer', meaning: 'Eine Testbedeutung.', phrases: ['Testwort A.', 'Andere Testworte A.'], avoid: 'Nicht drängen.', nextStep: 'Eine Pause machen.', safetyLevel: 'standard', safetyMessage: null };
const exhausted = { verified: true, paid: false, used: 4, remaining: 0 };
const paid = { verified: true, paid: true, used: 0, remaining: 4 };
const guest = { verified: false, paid: false, used: 1, remaining: 0 };
const cases = [
  { name: 'paid-to-exhausted', A: paid, B: exhausted },
  { name: 'exhausted-to-paid', A: exhausted, B: paid },
  { name: 'guest-to-verified', A: guest, B: exhausted },
  { name: 'verified-to-guest', A: paid, B: guest },
  { name: 'A-B-A-still-new-generation', A: paid, B: exhausted, back: true },
  { name: 'clarification', A: paid, B: exhausted, kind: 'clarification' },
  { name: 'access-error', A: exhausted, B: paid, kind: 'access' },
  { name: 'warning-preserved', A: paid, B: exhausted, warning: true },
  { name: 'returned-result-cached-before-switch', A: paid, B: exhausted, buffered: true },
  { name: 'auth-lookup-crosses-account-switch', A: paid, B: exhausted, lookup: true },
  { name: 'token-lookup-crosses-account-switch', A: paid, B: exhausted, token: true },
  { name: 'token-lookup-A-B-A', A: paid, B: exhausted, token: true, back: true },
  { name: 'late-status-refresh', A: paid, B: exhausted, status: true }
];
(async () => {
  let preview, browser;
  const report = { providerCalls: 0, realAuthActions: 0, cases: [], errors: [] };
  try {
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    for (const spec of cases) {
      console.log('Checking ' + spec.name);
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      try {
        let release, holdStatus = false, modelReplies = 0;
        const authorities = [];
        const state = account => ({ enabled: true, registeredAdditional: 3, anonymousAnswers: 1, signupPlacement: 'after-first', ...spec[account] });
        const body = spec.kind === 'clarification'
          ? { kind: 'clarification', question: 'Welche Angabe fehlt hier?', meaning: 'Eine Testbedeutung.', nextStep: 'Bitte ergänze die Angabe.', safetyLevel: 'standard', safetyMessage: null }
          : { ...normal, ...(spec.warning ? { safetyLevel: 'concern', safetyMessage: 'Vorhandener Testhinweis bleibt sichtbar.' } : {}) };
        await context.addInitScript(() => { window.__account = 'A'; localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); });
        await context.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: `
            const users={A:{uid:'A',isAnonymous:${!spec.A.verified},emailVerified:${spec.A.verified},getIdToken:async()=>{if(window.__holdToken){window.__holdToken=false;await new Promise(r=>window.__releaseToken=r)}return'A'}},B:{uid:'B',isAnonymous:${!spec.B.verified},emailVerified:${spec.B.verified},getIdToken:async()=>'B'}};
            const auth={get currentUser(){return users[window.__account]}};
            export async function webAuth(){if(window.__holdLookup){window.__holdLookup=false;await new Promise(r=>window.__releaseLookup=r)}return{auth,sdk:{}}}` });
          if (url.pathname.includes('/v1/translator-web')) {
            const account = (request.headers().authorization || '').replace('Bearer ', '');
            if (url.pathname.endsWith('/access')) {
              if (holdStatus && account === 'A') await new Promise(resolve => { release = resolve; });
              return route.fulfill({ json: account ? { ...state(account), contract: 'signup-bonus-v1', signupCopy: { variant: account === 'A' ? 'variant_1' : 'variant_3' } } : { enabled: true, needsSession: true, contract: 'signup-bonus-v1' } });
            }
            if (url.pathname.endsWith('/translator-web')) {
              authorities.push(account);
              assert.deepEqual(Object.keys(request.postDataJSON()).sort(), ['formal', 'goal', 'share', 'text']);
              if (!account) return route.fulfill({ status: 401, json: { code: 'authentication_required', needsSession: true } });
              if (!spec.buffered) await new Promise(resolve => { release = resolve; });
              if (spec.kind === 'access') return route.fulfill({ status: 402, json: { code: 'payment_required', access: state('A') } });
              modelReplies++;
              return route.fulfill({ json: { ...body, access: state('A') } });
            }
          }
          return url.origin === preview.origin ? route.continue() : route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        page.on('pageerror', error => report.errors.push(error.message));
        await page.goto(preview.origin + '/de/');
        const statusText = account => spec[account].paid ? 'Deine Mitgliedschaft ist aktiv.' : spec[account].verified ? 'Noch 0 Antworten zum Ausprobieren' : '0 Antwort(en) noch ohne Konto';
        const waitStatus = account => page.waitForFunction(text => document.querySelector('#web-access-notice')?.textContent.includes(text), statusText(account));
        const snapshot = () => page.evaluate(() => window.DemenzKiFreigabe.afterAnswer({ safetyLevel: 'standard' })?.textContent || '');
        await waitStatus('A');
        if (spec.status) {
          holdStatus = true;
          await page.evaluate(() => { window.__mountPromise = window.DemenzKiFreigabe.mount(); });
          const deadline = Date.now() + 10000;
          while (!release && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
          assert.equal(typeof release, 'function', 'status request is held');
          await page.evaluate(() => { window.__account = 'B'; window.dispatchEvent(new Event('demenz-auth-changed')); });
          await waitStatus('B');
          const before = await page.locator('#web-access-notice').textContent();
          release(); await page.evaluate(() => window.__mountPromise);
          assert.equal(await page.locator('#web-access-notice').textContent(), before);
          assert.equal(modelReplies, 0);
          report.cases.push({ name: spec.name, currentAccount: 'B', staleMetadataRejected: true, modelReplies });
          continue;
        }
        await page.evaluate(({ token, lookup }) => {
          window.__holdToken = token === true; window.__holdLookup = lookup === true;
          window.__replyPromise = window.DemenzTranslatorAI.ask('Eine gewöhnliche Testsituation.', { goal: { id: 'act_now', label: 'Ruhig reagieren' } });
        }, spec);
        if (spec.token || spec.lookup) await page.waitForFunction(name => typeof window[name] === 'function', spec.token ? '__releaseToken' : '__releaseLookup');
        else if (spec.buffered) await page.evaluate(async () => { window.__buffered = await window.__replyPromise; });
        else {
          const deadline = Date.now() + 10000;
          while (!release && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
          assert.equal(typeof release, 'function', 'care request is held');
        }
        await page.evaluate(() => { window.__account = 'B'; window.dispatchEvent(new Event('demenz-auth-changed')); });
        await waitStatus('B');
        if (spec.back) {
          await page.evaluate(() => { window.__account = 'A'; window.dispatchEvent(new Event('demenz-auth-changed')); });
          await waitStatus('A');
        }
        const before = await snapshot();
        if (spec.token || spec.lookup) await page.evaluate(name => window[name](), spec.token ? '__releaseToken' : '__releaseLookup');
        else if (!spec.buffered) release();
        const result = await page.evaluate(async () => {
          const value = window.__buffered || await window.__replyPromise;
          window.DemenzKiFreigabe.noteAnswer(value);
          window.DemenzKiFreigabe.accept(value.access); // Same entry as clarification.
          const attached = window.DemenzKiFreigabe.afterAnswer(value);
          const error = value.kind === 'access' ? window.DemenzKiFreigabe.offerCard({ reason: value.reason, value: value.access }) : null;
          return { value, attached: attached?.textContent || '', error: error?.textContent || '' };
        });
        assert.equal(await snapshot(), before, spec.name + ': current account metadata must stay unchanged');
        assert.equal(result.attached, '', spec.name + ': old response cannot attach a new account offer');
        if (spec.token || spec.lookup) {
          assert.deepEqual(authorities, [''], 'A request cannot be silently rebound to B during auth lookup');
          assert.equal(modelReplies, 0); assert.equal(result.value.kind, 'access');
        } else if (spec.kind === 'access') {
          assert.equal(result.value.kind, 'access'); assert.equal(result.value.reason, 'access_unavailable');
          assert.doesNotMatch(result.error, /Mitgliedschaft ist aktiv|3 weitere|3 Antworten/);
        } else {
          const { access: ignored, ...clinical } = result.value;
          // Existing transport normalizes a missing answer warning to an empty
          // string; clarification retains its strict null contract.
          const expected = spec.kind === 'clarification' ? body : { ...body, safetyMessage: body.safetyMessage || '' };
          assert.deepEqual(clinical, expected, spec.name + ': care/question/warning fields are unchanged');
        }
        report.cases.push({ name: spec.name, currentAccount: spec.back ? 'A' : 'B', staleMetadataRejected: true, carePreserved: !spec.token && !spec.lookup && spec.kind !== 'access', modelReplies, authorities });
      } finally { await context.close(); }
    }
    assert.deepEqual(report.errors, []); report.passed = true;
    if (evidence) fs.writeFileSync(path.join(evidence, 'auth-generation-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
