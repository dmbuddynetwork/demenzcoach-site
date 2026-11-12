// Real local app/SDK adapters, controlled Firebase/Google transport: no actual emails or AI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const recording = JSON.parse(fs.readFileSync(process.env.OUTCOMES_REPLAY_FILE, 'utf8'));
const care = recording.cases.find(item => item.id === 'G03');
const evidence = process.env.SIGNUP_SHEET_EVIDENCE;
const authModule = `
const read=()=>JSON.parse(localStorage.getItem('__fixtureUser')||'null')||{uid:'controlled-guest',email:null,emailVerified:false,isAnonymous:true};
const user=()=>({...read(),providerData:read().email?[{providerId:'password'}]:[],getIdToken:async()=>read().emailVerified?'signed-fixture-token':'guest-fixture-token'});
const auth={get currentUser(){return user()}};
const set=credential=>{localStorage.setItem('__fixtureUser',JSON.stringify({uid:read().uid,email:credential.email,emailVerified:true,isAnonymous:false}));window.dispatchEvent(new Event('demenz-auth-changed'));};
addEventListener('storage',e=>{if(e.key==='__fixtureUser')window.dispatchEvent(new Event('demenz-auth-changed'));});
const sdk={isSignInWithEmailLink:(_,url)=>new URL(url).searchParams.get('mode')==='signIn',EmailAuthProvider:{credentialWithLink:(email,url)=>({email,url})},
sendSignInLinkToEmail:async(_,email,settings)=>{window.__sent=(window.__sent||0)+1;window.__sendLanguage=auth.languageCode;window.__requestedLink=settings.url;
if(window.__mailFailure)throw Object.assign(new Error('controlled failure'),{code:'auth/network-request-failed'});
if(window.__holdMail)await new Promise(resolve=>window.__releaseMail=resolve);},linkWithCredential:async(_,credential)=>set(credential),reauthenticateWithCredential:async(_,credential)=>set(credential),signInWithCredential:async(_,credential)=>set(credential)};
export async function webAuth(){return{auth,sdk}}`;
const googleModule = `export function createGoogleAccess(){return{begin:async()=>{window.__googleCalls=(window.__googleCalls||0)+1;if(window.__googleCancel)throw Object.assign(new Error('controlled cancel'),{code:'auth/popup-closed-by-user'});localStorage.setItem('__fixtureUser',JSON.stringify({uid:'controlled-guest',email:'google@example.test',emailVerified:true,isAnonymous:false}));window.dispatchEvent(new Event('demenz-auth-changed'));return{signedIn:true,email:'google@example.test'};}}}`;
(async () => {
  let preview, browser;
  const report = { sourceMode: 'controlled local browser with actual recorded care responses', providerCalls: 0, realEmails: 0, realGoogleActions: 0, profiles: [], errors: [] };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    async function fixture(width) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const counters = { care: 0, goals: 0 };
      await context.addInitScript(() => {
        localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
        const actualNow = Date.now.bind(Date); Date.now = () => actualNow() + Number(localStorage.getItem('__clockOffset') || 0);
      });
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: authModule });
        if (url.pathname === '/abo/google-auth.js') return route.fulfill({ contentType: 'text/javascript', body: googleModule });
        if (url.hostname.endsWith('cloudfunctions.net')) {
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
          const signed = (req.headers().authorization || '').includes('signed-fixture');
          const access = { enabled: true, verified: signed, paid: false, used: counters.care, remaining: Math.max(0, (signed ? 4 : 1) - counters.care), anonymousAnswers: 1, registeredAdditional: 3, signupPlacement: 'after-first' };
          if (url.pathname.endsWith('/access')) return route.fulfill({ json: { ...access, contract: 'signup-bonus-v1', signupCopy: { variant: 'variant_1' } } });
          if (url.pathname.includes('account-binding')) return route.fulfill({ json: { hasCustomer: false } });
          if (url.pathname.endsWith('/goals')) { counters.goals++; return route.fulfill({ json: care.requests[0].response }); }
          if (url.pathname.endsWith('/translator-web')) { counters.care++; return route.fulfill({ json: { ...care.requests[1].response, access: { ...access, used: counters.care, remaining: Math.max(0, (signed ? 4 : 1) - counters.care) } } }); }
          throw new Error('Unexpected nonlocal request path');
        }
        return url.origin === preview.origin ? route.continue() : route.abort();
      });
      const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message)); page.setDefaultTimeout(10000);
      await page.goto(preview.origin + '/de/');
      await page.locator('#translator-input').fill(care.input.text); await page.locator('#translator-form').evaluate(form => form.requestSubmit());
      await page.getByRole('dialog').waitFor();
      return { context, page, counters };
    }
    const shot = async (page, name) => { if (evidence) await page.screenshot({ path: path.join(evidence, name), animations: 'disabled' }); };
    const actionLink = async page => { const link = await page.evaluate(() => window.__requestedLink); const url = new URL(link); url.searchParams.set('mode', 'signIn'); url.searchParams.set('oobCode', 'controlled-test-code'); return url.href; };
    for (const width of [390, 1280]) {
      const { context, page, counters } = await fixture(width);
      try {
        const checks = [];
        const dialog = page.getByRole('dialog');
        if (process.env.SIGNUP_SHEET_FOCUS_SUCCESS === '1') {
          const linkStyle = await dialog.locator('.signup-legal a').first().evaluate(node => ({ weight: getComputedStyle(node).fontWeight, decoration: getComputedStyle(node).textDecorationLine }));
          assert.equal(linkStyle.weight, '400'); assert.equal(linkStyle.decoration, 'none');
          await shot(page, `SHEET-${width}.png`);
          await page.getByLabel('Deine E-Mail-Adresse', { exact: true }).fill('caregiver@example.test');
          await page.getByRole('button', { name: '3 Antworten kostenlos freischalten', exact: true }).click();
          await page.getByRole('heading', { name: 'Öffne jetzt dein E-Mail-Postfach', exact: true }).waitFor();
          await shot(page, `SENT-${width}.png`);
          const before = { ...counters }, original = await page.locator('.translator-ai-answer').innerText();
          const callback = await context.newPage(); callback.setDefaultTimeout(10000); callback.on('pageerror', error => report.errors.push(error.message));
          await callback.goto(await actionLink(page));
          await callback.getByRole('heading', { name: 'Du bist angemeldet', exact: true }).waitFor();
          assert.equal(await callback.locator('#account-back').isVisible(), false);
          assert.equal(await callback.locator('#account-privacy').isVisible(), false);
          assert.equal(await callback.locator('#account-safety').isVisible(), false);
          assert.equal(await callback.locator('#account-privacy-link').isVisible(), true);
          assert.equal(await callback.locator('#account-help-link').isVisible(), true);
          assert.equal(await callback.locator('.web-account > a').first().innerText(), 'Demenz Coach App');
          assert.equal(await callback.locator('#account-continue').innerText(), 'Weiter');
          await page.getByRole('heading', { name: 'Du bist angemeldet', exact: true }).waitFor();
          assert.deepEqual(counters, before);
          await shot(page, `ORIGINAL-SUCCESS-${width}.png`); await shot(callback, `CALLBACK-SUCCESS-${width}.png`);
          await page.getByRole('button', { name: 'Zurück zu deiner Situation', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
          assert.equal(await page.locator('.translator-ai-answer').innerText(), original);
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.locator('.translator-chat').waitFor({ state: 'visible' });
          await shot(page, `COMPOSER-${width}.png`);
          report.profiles.push({ width, checks: ['final success hierarchy: no contradictory unsigned-back or repeated privacy/safety paragraphs; Continue/privacy/help and brand preserved', 'modal legal links normal weight/unadorned by default; both states and composer frames rebound', 'original answer retained without new care request'], ...counters });
          continue;
        }
        assert.equal(await dialog.evaluate(node => node.matches(':modal')), true);
        assert.equal(await page.locator('.translator-chat').isVisible(), false);
        assert.equal(await page.locator('#translator-privacy-note a').count() >= 2, true);
        assert.equal(await page.locator('.translator-chat-privacy').count(), 0);
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
        assert.equal(await dialog.evaluate(node => getComputedStyle(node).animationName), 'none');
        if (width === 390) {
          await page.setViewportSize({ width, height: 450 });
          await page.getByLabel('Deine E-Mail-Adresse', { exact: true }).focus();
          await page.getByLabel('Deine E-Mail-Adresse', { exact: true }).scrollIntoViewIfNeeded();
          assert.equal(await dialog.evaluate(node => node.getBoundingClientRect().bottom <= innerHeight + 1), true);
          assert.equal(await page.getByRole('button', { name: 'Anmeldung schließen', exact: true }).isVisible(), true);
          await page.setViewportSize({ width, height: 900 });
        }
        await page.evaluate(() => { window.__googleCancel = true; });
        await page.getByRole('button', { name: 'Mit Google fortfahren', exact: true }).click();
        await page.getByText('Die Anmeldung wurde abgebrochen. Versuche es erneut oder nutze E-Mail.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('dialog').count(), 1);
        assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('demenzCoachKiOffen')).text), care.input.text, 'Actual afterAnswer trigger retains the original request, not an emptied form field');
        for (let index = 0; index < 9; index++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('dialog'))), true); }
        await page.locator('#translator-input').evaluate(node => node.focus());
        assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('dialog'))), true, 'Native modal makes the background inert');
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
        assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
        assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('dialog'))), false);
        await page.evaluate(() => { const card = window.DemenzKiFreigabe.offerCard({ reason: 'signup_required', sentence: JSON.parse(sessionStorage.getItem('demenzCoachKiOffen')).text }); document.querySelector('.translator-goal-answer').append(card); });
        await page.getByRole('dialog').waitFor();
        checks.push('actual first-answer gate opens native bottom sheet; focus/inert/Escape/scroll restoration; main legal links retained');
        await shot(page, `SHEET-${width}.png`);
        await page.evaluate(() => { window.__holdMail = true; });
        await page.getByLabel('Deine E-Mail-Adresse', { exact: true }).fill('caregiver@example.test');
        await page.getByRole('button', { name: '3 Antworten kostenlos freischalten', exact: true }).click();
        await page.waitForFunction(() => typeof window.__releaseMail === 'function');
        assert.equal(await dialog.getAttribute('aria-modal'), 'true');
        assert.equal(await page.locator('.dc-signup').getAttribute('aria-busy'), 'true');
        assert.equal(await page.getByRole('button', { name: 'Link wird angefordert …', exact: true }).isEnabled(), false);
        await page.evaluate(() => window.__releaseMail());
        await page.getByRole('heading', { name: 'Öffne jetzt dein E-Mail-Postfach', exact: true }).waitFor();
        assert.equal(await page.locator('.signup-address').innerText(), 'caregiver@example.test');
        assert.match(await page.locator('.signup-guidance').innerText(), /Anmeldelink angefordert/);
        assert.equal(await page.locator('.signup-resend').isVisible(), false);
        assert.equal(await page.locator('.signup-resend-wait').isVisible(), true);
        assert.equal(await dialog.getByRole('link', { name: 'Nutzungsbedingungen (neuer Tab)', exact: true }).isVisible(), true);
        assert.equal(await dialog.getByRole('link', { name: 'Datenschutz & KI (neuer Tab)', exact: true }).isVisible(), true);
        await shot(page, `SENT-${width}.png`);
        assert.equal(await page.evaluate(() => window.__sendLanguage), 'de');
        assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('demenzCoachKiOffen')).text), care.input.text);
        await page.getByRole('button', { name: 'Adresse ändern', exact: true }).click();
        assert.equal(await page.getByLabel('Deine E-Mail-Adresse', { exact: true }).inputValue(), 'caregiver@example.test');
        await page.getByLabel('Deine E-Mail-Adresse', { exact: true }).fill('corrected@example.test');
        await page.evaluate(() => { localStorage.setItem('__clockOffset', '61000'); window.__holdMail = false; });
        await page.waitForFunction(() => !document.querySelector('.offer-body .primary').disabled);
        await page.getByRole('button', { name: '3 Antworten kostenlos freischalten', exact: true }).click();
        await page.getByRole('heading', { name: 'Öffne jetzt dein E-Mail-Postfach', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => window.__sent), 2);
        assert.equal(await page.locator('.signup-address').innerText(), 'corrected@example.test');
        checks.push('Google cancellation, immediate pending state, real typed address, explicit sent screen, correction and60second resend boundary');
        const before = { ...counters }, original = await page.locator('.translator-ai-answer').innerText();
        const callback = await context.newPage(); callback.setDefaultTimeout(10000); callback.on('pageerror', error => report.errors.push(error.message));
        await callback.goto(await actionLink(page));
        await callback.getByRole('heading', { name: 'Du bist angemeldet', exact: true }).waitFor();
        assert.equal(new URL(callback.url()).search, '', 'Magic link is removed before page SDK and UI processing');
        assert.equal(await callback.locator('#account-continue').innerText(), 'Weiter', 'A new tab never falsely promises a missing local situation');
        await page.getByRole('heading', { name: 'Du bist angemeldet', exact: true }).waitFor();
        assert.deepEqual(counters, before, 'Mail callback and original-tab continuation never request another care answer');
        assert.equal(await page.locator('.translator-ai-answer').innerText(), original);
        await shot(page, `ORIGINAL-SUCCESS-${width}.png`); await shot(callback, `CALLBACK-SUCCESS-${width}.png`);
        await page.getByRole('button', { name: 'Zurück zu deiner Situation', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });
        assert.equal(await page.locator('.translator-ai-answer').innerText(), original);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('demenzCoachKiOffen')), null);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.locator('.translator-chat').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.translator-chat').evaluate(node => Math.abs(node.getBoundingClientRect().left) < 1 && Math.abs(node.getBoundingClientRect().right - innerWidth) < 1), true);
        await shot(page, `COMPOSER-${width}.png`);
        checks.push('real email adapter mocked provider→new callback tab→sameUID verified original success; existing answer retained without extra debit; docked composer returns');
        report.profiles.push({ width, checks, ...counters });
      } catch (error) {
        const diagnostics = [];
        for (const open of context.pages()) diagnostics.push(await open.evaluate(() => ({ path: location.pathname, queryPresent: Boolean(location.search), title: document.title, heading: document.querySelector('#account-title')?.textContent, status: document.querySelector('#account-status')?.textContent, userVerified: JSON.parse(localStorage.getItem('__fixtureUser') || 'null')?.emailVerified, hasAttempt: Boolean(localStorage.getItem('demenzcoach.emailLinkAttempt.v1')), clockOffset: localStorage.getItem('__clockOffset') })));
        console.error(JSON.stringify({ controlledFixtureDiagnostics: diagnostics })); throw error;
      } finally { await context.close(); }
    }
    if (process.env.SIGNUP_SHEET_FOCUS_SUCCESS !== '1') {
    // Original tab closed before the link opens: honest generic continuation, no hidden care replay.
    {
      const { context, page, counters } = await fixture(390);
      try {
        await page.getByLabel('Deine E-Mail-Adresse', { exact: true }).fill('caregiver@example.test'); await page.getByRole('button', { name: '3 Antworten kostenlos freischalten', exact: true }).click();
        await page.getByRole('heading', { name: 'Öffne jetzt dein E-Mail-Postfach', exact: true }).waitFor();
        const link = await actionLink(page), before = { ...counters }; await page.close();
        const callback = await context.newPage(); await callback.goto(link); await callback.getByRole('heading', { name: 'Du bist angemeldet', exact: true }).waitFor();
        assert.equal(await callback.locator('#account-continue').innerText(), 'Weiter'); assert.deepEqual(counters, before);
        report.originalClosed = 'PASS: generic success, no missing-situation promise, no new care request';
      } finally { await context.close(); }
    }
    {
      const { context, page, counters } = await fixture(1280);
      try {
        const before = { ...counters }, original = await page.locator('.translator-ai-answer').innerText();
        await page.evaluate(() => { window.__mailFailure = true; });
        await page.getByLabel('Deine E-Mail-Adresse', { exact: true }).fill('failed@example.test');
        await page.getByRole('button', { name: '3 Antworten kostenlos freischalten', exact: true }).click();
        await page.getByText('Die E-Mail-Anforderung konnte nicht bestätigt werden. Prüfe dein Postfach oder versuche es erneut. Du kannst auch Google nutzen.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('heading', { name: 'Öffne jetzt dein E-Mail-Postfach', exact: true }).count(), 0);
        assert.equal(await page.getByLabel('Deine E-Mail-Adresse', { exact: true }).inputValue(), 'failed@example.test');
        await page.getByRole('button', { name: 'Mit Google fortfahren', exact: true }).click(); await page.getByRole('heading', { name: 'Du bist angemeldet', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Zurück zu deiner Situation', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'detached' });
        assert.deepEqual(counters, before); assert.equal(await page.locator('.translator-ai-answer').innerText(), original);
        report.googleSameTab = 'PASS controlled Google success keeps the original answer without reload or care debit';
      } finally { await context.close(); }
    }
    }
    assert.deepEqual(report.errors, []); report.passed = true;
    if (evidence) fs.writeFileSync(path.join(evidence, process.env.SIGNUP_SHEET_FOCUS_SUCCESS === '1' ? 'SUCCESS-REPORT.json' : 'FLOW-REPORT.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
