// Vorschau der A/B-Variante: Web-Funnel als Layer von unten statt Anmelde-Layer. Nur Testdaten.
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const shots = process.env.FUNNEL_LAYER_SHOTS || '';
const authModule = `const auth={currentUser:{uid:'guest-1',isAnonymous:true,emailVerified:false,getIdToken:async()=>'t'}};
const sdk={isSignInWithEmailLink:()=>false,EmailAuthProvider:{credentialWithLink:()=>({})},sendSignInLinkToEmail:async()=>{}};
export async function webAuth(){return{auth,sdk}}`;
const googleModule = `export function createGoogleAccess(){return{begin:async()=>({signedIn:false})}}`;
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); let cases = 0;
  try {
    for (const view of [{ n: 'handy', w: 390, h: 844 }, { n: 'desktop', w: 1280, h: 900 }]) {
      for (const variant of ['anmeldung', 'funnel']) {
        const c = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
        await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
        await c.route('**/*', async r => {
          const u = new URL(r.request().url());
          if (u.pathname === '/abo/web-auth.js') return r.fulfill({ contentType: 'text/javascript', body: authModule });
          if (u.pathname === '/abo/google-auth.js') return r.fulfill({ contentType: 'text/javascript', body: googleModule });
          if (u.hostname.endsWith('cloudfunctions.net')) return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
          return u.origin === preview.origin ? r.continue() : r.abort();
        });
        const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
        try {
          await p.goto(`${preview.origin}/de/${variant === 'funnel' ? '?anmeldung=funnel' : ''}`);
          const decline = p.getByRole('button', { name: 'Ablehnen', exact: true }); if (await decline.count()) await decline.click().catch(() => {});
          await p.evaluate(async () => {
            window.DemenzKiFreigabe = { refresh: async () => ({ enabled: true, verified: false, paid: false }), takePending() {} };
            const { mountInlineSignup } = await import('/abo/inline-signup.js');
            const card = document.createElement('section'); card.dataset.signupCreditOffer = 'true'; document.querySelector('main').append(card);
            await mountInlineSignup(card, { bonus: 3, en: false, purpose: 'invitation', creditActive: false, returnTo: '/de/' });
          });
          if (variant === 'funnel') {
            const dialog = p.locator('dialog.dc-funnel-layer'); await dialog.waitFor();
            const frame = p.frameLocator('iframe.dc-funnel-layer-frame');
            await frame.getByRole('heading', { name: /Tipps und Tricks zum Ausdrucken/ }).waitFor();
            await p.waitForTimeout(500);
            const box = await dialog.boundingBox();
            assert.ok(Math.abs(box.y + box.height - view.h) < 2, 'Layer sitzt unten');
            assert.equal(await p.locator('.dc-signup').count(), 0, 'keine Anmeldung in dieser Variante');
            // Layer von unten, breit, Seite dahinter abgedunkelt erkennbar (Daniel, 26. Nov 2026).
            assert.ok(box.width >= Math.min(view.w, 1100) - 2 && box.height < view.h - 10, 'breiter Layer von unten, kein Vollbild');
            if (shots) await p.screenshot({ path: path.join(shots, `layer-funnel-${view.n}-1.png`) });
            // Nur die erste Frage im Layer: danach eigene Fragebogen-Seite mit dem Stand aus diesem Tab.
            await Promise.all([p.waitForURL(/\/start\/\?src=layer&weiter=1/), frame.getByRole('button', { name: /Mutter/ }).first().click()]);
            await p.waitForFunction(() => document.body.dataset.screen === 'age');
            if (shots) await p.screenshot({ path: path.join(shots, `layer-funnel-${view.n}-2.png`) });
            await p.goBack(); // frische Seite für Bild 1
          }
          if (variant === 'anmeldung') { await p.locator('dialog.dc-signup-sheet').waitFor(); await p.waitForTimeout(700); if (shots) await p.screenshot({ path: path.join(shots, `layer-anmeldung-${view.n}.png`) }); }
          cases++;
        } finally { assert.deepEqual(errors, []); await c.close(); }
      }
    }
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
