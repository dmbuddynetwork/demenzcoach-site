// Actual redirect, account UI, takePending and translator startup; controlled identity only.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
(async () => {
  let preview, browser; const report = { realProviderCalls: 0, realEmails: 0, automaticAnswerRequests: 0, profiles: [] };
  try {
    preview = await createPreviewServer(); browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    const output = process.env.SIGNIN_STORAGE_EVIDENCE; if (output) fs.mkdirSync(output, { recursive: true });
    for (const flow of ['account', 'inline-account']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
      try {
        await context.addInitScript(origin => {
          if (location.origin !== origin) return;
          localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
          if (sessionStorage.getItem('__returnStorageSeeded')) return;
          sessionStorage.setItem('__returnStorageSeeded', '1');
          sessionStorage.setItem('demenzCoachKiOffen', JSON.stringify({ text: 'Mein gespeicherter Situationsentwurf', until: Date.now() + 60000 }));
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) { if (key === 'demenzcoach.signupDraftReturn.v1' && !window.__allowDraftWrite) throw new DOMException('Controlled quota limit', 'QuotaExceededError'); return original.call(this, key, value); };
        }, preview.origin);
        await context.route('**/*', route => {
          const u = new URL(route.request().url());
          if (u.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: `const user=()=>({uid:localStorage.getItem('__storageUID')||'existing-owner',email:'care@example.test',emailVerified:true,isAnonymous:false,getIdToken:async()=>'controlled'});const auth={get currentUser(){return user()}};export async function webAuth(){return{auth,sdk:{isSignInWithEmailLink:()=>false}}}` });
          if (u.hostname.endsWith('cloudfunctions.net')) {
            if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
            if (!u.pathname.endsWith('/access')) { report.automaticAnswerRequests++; return route.abort(); }
            return route.fulfill({ json: { enabled: true, verified: true, paid: false, used: 0, remaining: 4, anonymousAnswers: 1, registeredAdditional: 3 } });
          }
          return u.origin === preview.origin ? route.continue() : route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        await page.goto(preview.origin + '/abo/konto.html?returnTo=%2Fde%2F');
        if (flow === 'inline-account') {
          // Mount the actual controller on the already protected account page, still with the valid draft.
          await page.evaluate(async () => {
            const card = document.createElement('section'); document.body.append(card);
            const module = await import('/abo/inline-signup.js');
            await module.mountInlineSignup(card, { bonus: 3, en: false, purpose: 'account', returnTo: '/de/', sentEmail: 'care@example.test' });
            dispatchEvent(new Event('demenz-auth-changed'));
          });
        }
        const retry = flow === 'account' ? page.locator('#account-return-retry') : page.locator('.dc-signup .signup-state button.primary');
        await retry.waitFor(); assert.equal(await retry.innerText(), 'Rückkehr erneut versuchen');
        const pendingBefore = await page.evaluate(() => sessionStorage.getItem('demenzCoachKiOffen'));
        assert.equal(new URL(page.url()).pathname, '/abo/konto.html');
        assert.equal(await page.evaluate(() => sessionStorage.getItem('demenzcoach.signupDraftReturn.v1')), null);
        await retry.click(); assert.equal(new URL(page.url()).pathname, '/abo/konto.html');
        assert.equal(await page.evaluate(() => sessionStorage.getItem('demenzCoachKiOffen')), pendingBefore);
        assert.equal(report.automaticAnswerRequests, 0);
        if (flow === 'account') {
          await page.evaluate(() => { localStorage.setItem('__storageUID', 'different-owner'); window.__allowDraftWrite = true; });
          await retry.click();
          await page.getByRole('status').filter({ hasText: 'Deine Anmeldung hat sich geändert' }).waitFor();
          assert.equal(new URL(page.url()).pathname, '/abo/konto.html');
          assert.equal(await page.evaluate(() => sessionStorage.getItem('demenzCoachKiOffen')), pendingBefore);
          await page.evaluate(() => localStorage.removeItem('__storageUID'));
        }
        if (output) await page.screenshot({ path: path.join(output, `STORAGE-RECOVERY-${flow}.png`) });
        await page.evaluate(() => { window.__allowDraftWrite = true; }); await retry.click();
        await page.waitForURL(preview.origin + '/de/'); await page.locator('.dc-signin-notice').waitFor();
        assert.equal(await page.locator('#translator-input').inputValue(), 'Mein gespeicherter Situationsentwurf');
        assert.equal(await page.evaluate(() => sessionStorage.getItem('demenzcoach.signupDraftReturn.v1')), null);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('demenzCoachKiOffen')), null);
        assert.equal(report.automaticAnswerRequests, 0);
        report.profiles.push({ flow, quotaFailureStayedOnOriginalPage: true, draftPreserved: true, identityChangeRetryBlocked: flow === 'account', explicitRecoveryRestoredActualInput: true, automaticAnswerRequests: 0 });
      } finally { await context.close(); }
    }
    report.passed = true; if (output) fs.writeFileSync(path.join(output, 'STORAGE-RECOVERY-REPORT.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
