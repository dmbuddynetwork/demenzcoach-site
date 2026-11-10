// Isolated UI regression: synthetic config/offers only; no email, checkout or payment is sent.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_URL || 'http://127.0.0.1:54929';
const key = 'demenzCoachQuizProgress.v1';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const mode of ['short', 'long', 'none', 'expired']) {
      const context = await browser.newContext({ viewport: { width: mode === 'short' ? 390 : 1280, height: 900 }, reducedMotion: 'reduce' });
      const requests = [];
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(base).origin) return route.continue();
        if (url.pathname.endsWith('/web-checkout/config')) return route.fulfill({ json: {
          plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7,
          offers: mode === 'none' ? null : { intro: { firstYear: 4999, minutes: mode === 'long' ? 10080 : 15 } }
        } });
        if (url.pathname.endsWith('/web-checkout/offer')) {
          requests.push(route.request().postDataJSON());
          return mode === 'expired' ? route.fulfill({ status: 409, json: { error: 'offer_expired' } }) : route.fulfill({ json: {
            kind: 'intro', expiresAt: Date.now() + (mode === 'long' ? 10080 : 15) * 60000,
            token: 'synthetic-offer-token', firstYear: 4999, regular: 6999, emailBound: true
          } });
        }
        return route.abort();
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      const at = name => page.waitForFunction(name => document.body.dataset.screen === name, name);
      await page.goto(`${base}/start/?src=qa_no_urgency`);
      await page.getByRole('button', { name: 'Meine Mutter', exact: true }).click();
      await page.getByRole('button', { name: 'Weiter', exact: true }).click();
      await page.locator('.start-option').first().click(); await at('frequency');
      await page.evaluate(key => {
        const saved = JSON.parse(sessionStorage.getItem(key)); const data = window.DEMENZ_PLAN_DATA;
        saved.screen = 'plan';
        for (const [name, list] of Object.entries({ frequency: data.frequencies, dayTime: data.dayTimes, duration: data.durations,
          living: data.livings, goal: data.goals, burden: data.burdens, minutes: data.minutes })) saved.choices[name] = list[0].key;
        sessionStorage.setItem(key, JSON.stringify(saved));
      }, key);
      await page.reload(); await at('email');
      await page.locator('#email').fill('qa-no-urgency@example.invalid');
      await page.getByRole('button', { name: 'Plan ansehen', exact: true }).click(); await at('newsletter');
      await page.getByRole('button', { name: 'Kein Interesse', exact: true }).click(); await at('result');
      await page.getByRole('button', { name: 'Weiter', exact: true }).click();
      if (mode === 'short' || mode === 'long') {
        await at('reveal'); await page.getByRole('button', { name: 'Aufdecken', exact: true }).click();
        await page.getByRole('button', { name: 'Weiter zum Angebot', exact: true }).click();
      }
      await at('plan');
      const check = async () => {
        assert.equal(await page.locator('[role="timer"], .start-clock').count(), 0, mode);
        assert.doesNotMatch(await page.locator('#screen').innerText(), /reserviert|Reservierung|nur noch|15:00|Minuten.*Sekunden/iu, mode);
        assert.match(await page.locator('#screen').innerText(), /7 Tage kostenlos/u);
        assert.match(await page.locator('#screen').innerText(), /12,99/u);
        assert.match(await page.locator('#screen').innerText(), /69,99/u);
        if (mode === 'short' || mode === 'long') assert.match(await page.locator('#screen').innerText(), /49,99/u);
        else assert.doesNotMatch(await page.locator('#screen').innerText(), /49,99/u);
      };
      await check(); await page.clock.install(); await page.clock.fastForward(120000); await check();
      if (mode !== 'none') assert.ok(requests.length && requests.every(r => r.email === 'qa-no-urgency@example.invalid' && r.kind === 'intro'));
      if (process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/start-offer-${mode}.png`, fullPage: true });
      }
      assert.deepEqual(errors, []); await context.close();
      console.log(`${mode}: no countdown/reservation claim; prices, trial and email offer request preserved`);
    }
    const source = fs.readFileSync(`${__dirname}/../start/start.js`, 'utf8');
    assert.doesNotMatch(source, /deals\.countdown|role: "timer"|text: "15"/u);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
