// /en/ wie /de/ (Daniel, 28. Nov): saubere Umbrüche, Kaufknöpfe unter Schritten, Beispielen, Stimmen und Antwort, iPhone-Hinweis.
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const shots = process.env.EN_SHOTS || '';
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); const cases = [];
  try {
    for (const view of [{ n: 'iphone', ctx: { ...devices['iPhone 13'] } }, { n: 'android', ctx: { ...devices['Pixel 7'] } }]) {
      const c = await browser.newContext(view.ctx); c.setDefaultTimeout(10000);
      await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
      // KI nur simuliert (keine echten Anfragen): Ziele und eine Antwort auf Englisch.
      const goals = [{ goal: 'act_now', label: 'Answer him calmly right now' }, { goal: 'understand', label: 'Understand why he asks' }, { goal: 'organize', label: 'Plan for the evenings' }];
      const answer = { kind: 'answer', safetyLevel: 'standard', safetyMessage: null, meaning: 'He is looking for safety, not for facts. A calm answer helps more than the truth about the date.',
        phrases: ['You miss him. Tell me about him.'], avoid: 'He died years ago, you know that!', nextStep: 'Sit with her and look at a photo together.' };
      await c.route('**/*', async r => {
        const req = r.request(), url = new URL(req.url()), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
        if (url.hostname.endsWith('cloudfunctions.net') && url.pathname.includes('/translator-web')) {
          if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
          if (url.pathname.endsWith('/access')) return r.fulfill({ headers: cors, json: { enabled: true, needsSession: true, contract: 'signup-bonus-v1' } });
          return r.fulfill({ headers: cors, json: url.pathname.endsWith('/goals') ? { kind: 'goals', goals, noSituation: false } : answer });
        }
        if (url.pathname === '/abo/web-auth.js') return r.fulfill({ contentType: 'text/javascript', body: 'export async function webAuth(){return {auth:{currentUser:null},sdk:{}}}' });
        return url.origin === preview.origin ? r.continue() : r.abort();
      });
      const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
      const shot = async (name) => { if (shots) await p.screenshot({ path: path.join(shots, `${name}-${view.n}.png`) }); };
      await p.goto(`${preview.origin}/en/`);
      const decline = p.getByRole('button', { name: 'Decline', exact: true }); if (await decline.count()) await decline.click().catch(() => {});
      assert.equal(await p.locator('#home-title .home-line').innerText(), 'What do I say now?');
      assert.equal(await p.locator('#translator-form-intro .home-line').count(), 2);
      assert.equal(await p.evaluate(() => [...document.querySelectorAll('[data-hs-buy]')].filter(b => { const r = b.getBoundingClientRect(); return r.height && r.top < innerHeight; }).length), 0, 'erster Bildschirm ohne Kaufknopf');
      await shot('1-oben');
      await p.locator('.hs-mini-cta').first().waitFor({ state: 'attached' });
      assert.equal(await p.locator('.hs-mini-cta [data-hs-buy]').count(), 3, 'Kaufknopf unter Schritten, Beispielen, Stimmen');
      assert.match(await p.locator('.hs-mini-cta [data-hs-buy]').first().innerText(), /^Try 7 days free$|^Start now$/);
      const apps = await p.locator('a.hs-app').count();
      assert.equal(apps, view.n === 'android' ? 0 : 2, 'iPhone-Hinweis nur außerhalb von Android');
      if (apps) assert.match(await p.locator('a.hs-app').first().getAttribute('href'), /ct=web_en_home_preise/);
      await p.locator('.hs-mini-cta').first().scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -260)); await shot('2-kaufknopf-schritte');
      if (apps) { await p.locator('a.hs-app').first().scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -300)); await shot('3-iphone-hinweis'); }
      cases.push(`${view.n}: Umbrüche, 3 Kaufknöpfe, iPhone-Hinweis ${apps}`);
      // Antwort: Kauf-Block darunter, englisch.
      await p.evaluate(() => scrollTo(0, 0));
      await p.fill('#translator-input', 'Mom keeps asking when Dad comes home. He died years ago.');
      await p.locator('#translator-form button[type=submit]').click();
      await p.locator('.translator-goal').first().waitFor(); await shot('4-ziele'); await p.locator('.translator-goal').first().click();
      const buyBox = p.locator('.hs-answer-buy'); await buyBox.first().waitFor({ timeout: 15000 });
      const text = await buyBox.first().innerText();
      assert.match(text, /Get answers like this whenever you need them[\s\S]*€[\d.]+ a month[\s\S]*a day[\s\S]*30-day money-back guarantee/);
      assert.doesNotMatch(text, /im Monat|Garantie/);
      assert.equal(await p.getByText('Link löschen').count() + await p.getByText('Delete link').count(), 0);
      await buyBox.first().scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -200)); await shot('5-antwort-kaufblock');
      cases.push(`${view.n}: Kauf-Block unter der Antwort`);
      assert.deepEqual(errors, []); await c.close();
    }
    console.log(JSON.stringify({ ok: true, cases }, null, 1));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
