// Production UI/controller, synthetic auth and access transport, zero real AI calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const root = path.resolve(__dirname, '..');
const evidence = process.env.SIGNUP_COPY_EVIDENCE;
const cases = [
  { language: 'de', width: 390, consent: true, variant: 'variant_3', transition: true },
  { language: 'de', width: 1280, consent: true, variant: 'variant_1' },
  { language: 'de', width: 390, consent: true, variant: 'variant_1' },
  { language: 'en', width: 390, consent: false, variant: 'variant_3' },
  { language: 'en', width: 1280, consent: true, variant: 'variant_3' },
  { language: 'de', width: 390, bonus: 2 },
  { language: 'de', width: 390, bonus: 5 },
  { language: 'de', width: 390, verified: true },
  { language: 'de', width: 390, client: false },
  { language: 'de', width: 390, server: false },
  { language: 'de', width: 390, authFailure: true },
  { language: 'de', width: 390, noSessionInitially: true },
  { language: 'de', width: 390, badContract: true },
  { language: 'de', width: 390, malformedStatus: true }
];
(async () => {
  let preview, browser;
  const report = { providerCalls: 0, realAuthActions: 0, cases: [], errors: [] };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    for (const spec of cases) {
      const context = await browser.newContext({ viewport: { width: spec.width, height: 900 }, reducedMotion: 'reduce' });
      try {
        let verified = spec.verified === true, used = 0, careRequests = 0, accessRequests = 0;
        const bonus = spec.bonus ?? 3, client = spec.client !== false, enabled = client && spec.server !== false;
        const variant = spec.variant || 'variant_1';
        const access = () => ({ enabled: true, verified, paid: false, used, remaining: Math.max(0, (verified ? 1 + bonus : 1) - used), anonymousAnswers: 1, registeredAdditional: bonus, signupPlacement: 'after-first' });
        const requests = [];
        await context.addInitScript(({ consent, verified }) => {
          localStorage.setItem('demenzcoach.analyticsConsent.v1', consent ? 'granted' : 'denied');
          localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
          window.__authVerified = verified; window.__anonCreates = 0;
        }, { consent: spec.consent === true, verified });
        await context.route('**/*', route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin === preview.origin && url.pathname === '/abo/abo-config.js') {
            const source = fs.readFileSync(path.join(root, 'abo/abo-config.js'), 'utf8');
            return route.fulfill({ contentType: 'text/javascript', body: source.replace(/(translatorGate: Object\.freeze\(\{\s*enabled:) (?:false|true)/, '$1 ' + client) });
          }
          if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: spec.authFailure
            ? 'export async function webAuth(){throw new Error("synthetic unavailable");}'
            : `const user={uid:"synthetic-user",get isAnonymous(){return !window.__authVerified},get emailVerified(){return window.__authVerified},getIdToken:async()=>"synthetic-token"};let ready=${!spec.noSessionInitially};const auth={get currentUser(){return ready?user:null}};export async function webAuth({anonymous=false}={}){if(anonymous&&!ready){ready=true;window.__anonCreates++;window.dispatchEvent(new Event("demenz-auth-changed"));}return {auth,sdk:{}}}` });
          if (url.pathname.includes('/v1/translator-web')) {
            const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Translator-Access-Contract,X-Translator-Request-ID,X-Experiment-Consent,X-Experiment-Unit' };
            if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
            const negotiated = request.headers()['x-translator-access-contract'];
            requests.push({ path: url.pathname, contract: negotiated });
            const reply = (json, status = 200) => route.fulfill({ status, headers, json });
            if (url.pathname.endsWith('/access')) {
              accessRequests++;
              if (!enabled) return reply({ enabled: false, mode: 'legacy' });
              if (!request.headers().authorization) return reply({ enabled: true, needsSession: true, contract: 'signup-bonus-v1' });
              const unit = request.headers()['x-experiment-unit'];
              return reply({ ...access(), ...(spec.malformedStatus ? {remaining:'4'} : {}), contract: spec.badContract ? 'unsupported-contract' : 'signup-bonus-v1', signupCopy: { variant,
                ...(unit ? { exposure: { experiment: 'web-translator-signup-copy-v1', unit, variation: variant === 'variant_3' ? 1 : 0 } } : {}) } });
            }
            if (url.pathname.endsWith('/goals')) return reply({ kind: 'goals', noSituation: false, goals: [
              { goal: 'act_now', label: 'Mein Eis selbst essen' }, { goal: 'understand', label: 'Das Eis freiwillig teilen' }, { goal: 'organize', label: 'Ruhig über das Eis sprechen' }
            ] });
            if (url.pathname.endsWith('/translator-web')) {
              careRequests++;
              if (enabled && spec.authFailure) return reply({ code: 'authentication_required', needsSession: true }, 401);
              used++;
              return reply({ kind: 'answer', meaning: 'Eine freundliche Grenze erklärt deinen Wunsch.', phrases: ['Ich möchte mein Eis selbst essen.', 'Bitte lass mir mein Eis.'], nextStep: 'Stell dein Eis zu dir.', avoid: 'Du nimmst mir immer alles weg!', safetyLevel: 'standard', safetyMessage: null,
                ...(enabled ? { access: access() } : {}) }); // GET-only signupCopy/contract deliberately absent.
            }
          }
          return url.origin === preview.origin ? route.continue() : route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        page.on('pageerror', error => report.errors.push(error.message));
        await page.goto(preview.origin + '/' + spec.language + '/');
        await page.evaluate(() => {
          window.__copyEvents = [];
          window.DemenzConsent = { ...window.DemenzConsent, track: (name, properties) => window.__copyEvents.push({ name, properties }) };
        });
        if (client) await page.waitForFunction(() => document.querySelector('#web-access-notice') && !/wird geprüft|Checking/.test(document.querySelector('#web-access-notice').textContent));
        if (spec.noSessionInitially) assert.equal(await page.evaluate(() => window.__anonCreates), 0, 'Reading the landing page must not create an anonymous Firebase user');
        await page.locator('#translator-input').fill('sie ist mein eis weg QA_PRIVATE_SITUATION');
        await page.locator('#translator-form [type=submit]').click(); await page.locator('.translator-ai-goal-choice').first().click();
        if (spec.authFailure) {
          await page.locator('.ki-angebot').waitFor();
          assert.equal(await page.locator('.translator-ai-answer').count(), 0);
          assert.doesNotMatch(await page.locator('.ki-angebot').innerText(), /3 weitere|3 Antworten/);
        } else {
          await page.locator('.translator-ai-answer').waitFor();
          if (enabled && !verified && bonus >= 3 && !spec.badContract && !spec.malformedStatus) {
            await page.locator('.dc-signup').waitFor();
            const shown = spec.consent === true ? variant : 'variant_1';
            assert.equal(await page.locator('.dc-signup').getAttribute('data-signup-copy'), shown);
            assert.match(await page.locator('.dc-signup .lead').innerText(), new RegExp(`${bonus} ${spec.language === 'de' ? 'weitere KI-Antworten' : 'more AI answers'}`));
            assert.equal(await page.locator('.dc-signup input[type=email]').isVisible(), true);
            if (spec.consent) {
              await page.locator('.dc-signup').scrollIntoViewIfNeeded();
              await page.waitForFunction(() => window.__copyEvents.some(event => event.name === 'web_signup_copy_shown'));
            }
            if (evidence && spec.variant === 'variant_1' && spec.language === 'de') await page.screenshot({ path: path.join(evidence, 'INTEGRATED-SIGNUP-' + spec.width + '.png') });
            if (spec.transition) {
              await page.evaluate(() => window.DemenzWebExperiments.queueSignupCompletion());
              verified = true;
              const before = careRequests;
              await page.evaluate(() => { window.__authVerified = true; window.dispatchEvent(new Event('demenz-auth-changed')); });
              await page.waitForFunction(() => window.__copyEvents.some(event => event.name === 'web_signup_copy_verified'));
              assert.equal(careRequests, before, 'Auth/status transition must not request another AI answer');
              assert.equal(await page.locator('.dc-signup[data-signup-copy]').count(), 0, 'A verified account no longer sees a new-credit promise');
            }
          } else if (enabled && !verified) {
            await page.locator('.dc-signup').waitFor();
            assert.equal(await page.locator('.dc-signup').getAttribute('data-signup-copy'), null);
            assert.doesNotMatch(await page.locator('.dc-signup').innerText(), /3 weitere|3 Antworten/);
          } else {
            assert.equal(await page.locator('.dc-signup[data-signup-copy]').count(), 0);
          }
        }
        assert.ok(requests.filter(request => !request.path.endsWith('/goals')).every(request => client ? request.contract === 'signup-bonus-v1' : request.contract === undefined));
        if (spec.noSessionInitially) assert.equal(await page.evaluate(() => window.__anonCreates), 1, 'First Care request creates one shared anonymous session');
        const events = await page.evaluate(() => window.__copyEvents);
        assert.ok(!JSON.stringify(events).includes('QA_PRIVATE_SITUATION'));
        for (const event of events.filter(event => event.name.startsWith('web_signup_copy_'))) assert.deepEqual(Object.keys(event.properties).sort(), ['assignment_id', 'campaign_id', 'experiment_id', 'variation_id']);
        if (!spec.consent) assert.equal(events.filter(event => event.name.startsWith('web_signup_copy_')).length, 0);
        report.cases.push({ ...spec, careRequests, accessRequests, metadataKeptAcrossCare: enabled && !spec.authFailure, copyEvents: events.filter(event => event.name.startsWith('web_signup_copy_')).map(event => event.name) });
      } finally { await context.close(); }
    }
    assert.deepEqual(report.errors, []); report.passed = true;
    if (evidence) fs.writeFileSync(path.join(evidence, 'integration-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
