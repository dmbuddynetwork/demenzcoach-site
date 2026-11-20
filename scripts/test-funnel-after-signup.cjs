// Nach dem Absenden der Anmeldung (vor dem Klick auf den E-Mail-Link) geht der Nutzer in den Web-Funnel /start/.
// Echte Seitenmodule, Anmeldung und Backend nur als Testdaten. Keine E-Mail, kein Konto.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const shots = process.env.FUNNEL_AFTER_SIGNUP_SHOTS || '';
const authModule = `
const auth={currentUser:{uid:'guest-1',isAnonymous:true,emailVerified:false,getIdToken:async()=>'t'}};
const sdk={isSignInWithEmailLink:()=>false,EmailAuthProvider:{credentialWithLink:()=>({})},sendSignInLinkToEmail:async()=>{localStorage.setItem('__mailSent','1')}};
export async function webAuth(){return{auth,sdk}}`;
const googleModule = `export function createGoogleAccess(){return{begin:async()=>({signedIn:false})}}`;
const harness = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main><section class="translator-goal-answer"><p>Vorhandene Antwort</p><textarea id="translator-input">Meine Eingabe</textarea><section id="offer" data-signup-credit-offer="true"></section></section></main><script src="/abo/abo-config.js"></script><script type="module">
import {mountInlineSignup} from '/abo/inline-signup.js';
window.DemenzKiFreigabe={refresh:async()=>({enabled:true,verified:false,paid:false}),takePending(){}};
await mountInlineSignup(document.querySelector('#offer'),{bonus:3,en:false,purpose:'intro',creditActive:true,returnTo:'/de/'});
</script></body></html>`;
(async () => {
  let preview, browser; const report = { cases: [], errors: [] };
  try {
    preview = await createPreviewServer(); browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    const open = async (width = 390) => {
      const c = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
      await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
      await c.route('**/*', async r => {
        const u = new URL(r.request().url());
        if (u.pathname === '/__funnel-test.html') return r.fulfill({ contentType: 'text/html', body: harness });
        if (u.pathname === '/abo/web-auth.js') return r.fulfill({ contentType: 'text/javascript', body: authModule });
        if (u.pathname === '/abo/google-auth.js') return r.fulfill({ contentType: 'text/javascript', body: googleModule });
        if (u.hostname.endsWith('cloudfunctions.net')) return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
        return u.origin === preview.origin ? r.continue() : r.abort();
      });
      const p = await c.newPage(); p.on('pageerror', e => report.errors.push(e.message)); return { c, p };
    };
    const submit = async (p, button = 'Mit E-Mail fortfahren') => {
      await p.locator('.dc-signup').getByLabel('Deine E-Mail-Adresse', { exact: true }).fill('care@example.test');
      await p.getByRole('button', { name: button, exact: true }).click();
    };
    // 1 Konto-Seite (Menü, Meine Sätze): geht in den Funnel, Hinweis einmal sichtbar, Anmeldeversuch bleibt gespeichert.
    for (const [name, returnTo] of [['Konto-Link', '%2Fde%2F'], ['Meine Sätze', '%2Fde%2Fmeine-saetze%2F']]) {
      const { c, p } = await open();
      try {
        await p.goto(`${preview.origin}/abo/konto.html?returnTo=${returnTo}&intent=signin`);
        await submit(p);
        await p.waitForURL(`${preview.origin}/start/?src=anmeldung`);
        await p.locator('#welcome').waitFor({ state: 'visible' });
        assert.match(await p.locator('#welcome').innerText(), /Anmeldelink ist unterwegs/);
        assert.equal(await p.evaluate(() => Boolean(localStorage.getItem('demenzcoach.emailLinkAttempt.v1'))), true, 'Anmeldeversuch bleibt für den E-Mail-Link gespeichert');
        assert.equal(await p.evaluate(() => sessionStorage.getItem('demenzcoach.funnelWelcome.v1')), null, 'Hinweis wird nur einmal gezeigt');
        if (shots && name === 'Konto-Link') await p.screenshot({ path: path.join(shots, 'funnel-nach-anmeldung-handy.png') });
        await p.reload(); await p.locator('#screen').waitFor();
        assert.equal(await p.locator('#welcome').isVisible(), false, 'nach Neuladen kein Hinweis mehr');
        report.cases.push(name);
      } finally { await c.close(); }
    }
    // 2 Anmelde-Karte im Übersetzer (Layer von unten): ebenfalls in den Funnel.
    { const { c, p } = await open();
      try {
        await p.goto(preview.origin + '/__funnel-test.html'); await p.getByRole('dialog').waitFor(); await submit(p, 'Kostenlos freischalten');
        await p.waitForURL(`${preview.origin}/start/?src=anmeldung`); await p.locator('#welcome').waitFor({ state: 'visible' }); report.cases.push('Übersetzer-Karte');
      } finally { await c.close(); } }
    // 3 Kauf und Plan (/abo/) und englische Seiten: bleiben, kein Funnel.
    for (const [name, returnTo] of [['nach Kauf (abo)', '%2Fabo%2F&intent=link']]) {
      const { c, p } = await open();
      try {
        await p.goto(`${preview.origin}/abo/konto.html?returnTo=${returnTo.includes('intent') ? returnTo : returnTo + '&intent=signin'}`);
        await submit(p);
        await p.getByRole('heading', { name: /Bestätige kurz deine E-Mail|Confirm your email/ }).waitFor();
        await p.waitForTimeout(1500);
        assert.equal(new URL(p.url()).pathname, '/abo/konto.html', name + ': bleibt auf der Konto-Seite');
        report.cases.push(name);
      } finally { await c.close(); }
    }
    { const { c, p } = await open();
      try {
        await p.goto(preview.origin + '/abo/konto.html');
        const results = await p.evaluate(async () => { const m = await import('/abo/funnel-after-signup.js'); return ['/en/dementia-translator/', '/abo/', '/abo/?plan=yearly', '/de/', '/de/meine-saetze/'].map(t => [t, m.leaveForFunnel({ target: t, delay: 60000 })]); });
        assert.deepEqual(Object.fromEntries(results), { '/en/dementia-translator/': false, '/abo/': false, '/abo/?plan=yearly': false, '/de/': true, '/de/meine-saetze/': true });
        report.cases.push('Ziele: nur deutsche Seiten, nie /abo/ und nie Englisch');
      } finally { await c.close(); } }
    assert.deepEqual(report.errors, []); console.log(JSON.stringify({ ok: true, ...report, realEmails: 0, realAccounts: 0 }));
  } finally { await browser?.close(); await preview?.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
