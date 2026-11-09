// Isolated reload regression. All nonlocal services are blocked or synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_URL || 'http://127.0.0.1:8907';
const key = 'demenzCoachQuizProgress.v1';

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (url.pathname.endsWith('/web-checkout/config')) return route.fulfill({ json: {
        plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, offers: null
      } });
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const at = name => page.waitForFunction(name => document.body.dataset.screen === name, name);
    const checkpoint = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || 'null'), key);
    const start = async () => {
      await page.goto(`${base}/start/?src=qa_resume`);
      await page.getByRole('button', { name: 'Meine Mutter', exact: true }).click();
      await at('name');
      await page.locator('#name').fill('FiktiverNameNurImFeld');
      await page.getByRole('button', { name: 'Weiter', exact: true }).click();
      await at('situation');
      await page.locator('.start-option').first().click();
      await at('frequency');
    };
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/start/?src=qa_resume`);
      await page.evaluate(key => sessionStorage.removeItem(key), key);
      await start();
      const saved = await checkpoint();
      assert.equal(saved.screen, 'frequency');
      assert.deepEqual(Object.keys(saved).sort(), ['at', 'choices', 'context', 'screen', 'tries', 'version']);
      assert.ok(!JSON.stringify(saved).includes('FiktiverNameNurImFeld'));
      if (process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `quiz-vor-neuladen-${width}.png`) });
      }
      await page.reload();
      await at('frequency');
      await page.locator('#back').click();
      await at('situation');
      assert.equal(await page.locator('.start-option[aria-pressed="true"]').innerText(), 'Will nach Hause');
      await page.locator('.start-option').first().click();
      await at('frequency');
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `quiz-nach-neuladen-${width}.png`) });
      if (await page.locator('.consent-decline').isVisible()) {
        await page.locator('.consent-decline').click();
        assert.equal(await page.evaluate(() => window.DemenzConsent.statistics()), false, 'visible refusal is applied');
        assert.equal(await page.evaluate(() => localStorage.getItem('demenzcoach.analyticsConsent.v1')), 'denied', 'refusal persists');
        assert.equal(await page.locator('.consent-banner').isVisible(), false);
      }
      await page.getByRole('button', { name: 'Neu anfangen', exact: true }).click();
      await at('relation');
      assert.equal(await checkpoint(), null);
      assert.ok(await page.locator('#screen h1').evaluate(node => node === document.activeElement));
      await page.goBack();
      await at('relation');
      assert.equal(await checkpoint(), null, 'old history after restart cannot recover old answers');
    }
    // Restore only validated fixed choices, never arbitrary objects or free input.
    await start();
    const saved = await checkpoint();
    await page.evaluate(({ key, saved }) => {
      saved.at = Date.now() - 30 * 60 * 1000;
      sessionStorage.setItem(key, JSON.stringify(saved));
    }, { key, saved });
    await page.reload(); await at('relation'); assert.equal(await checkpoint(), null);
    for (const value of ['{broken', JSON.stringify({ ...saved, at: Date.now(), context: 'different context' }), JSON.stringify({ ...saved, at: Date.now() + 60000 })]) {
      await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), { key, value });
      await page.reload(); await at('relation'); assert.equal(await checkpoint(), null);
    }
    await start();
    await page.goto(`${base}/start/?src=another_source&m=mutter`);
    await at('relation'); assert.equal(await checkpoint(), null);
    // No free field from a later screen is persisted: ask for email again after reload.
    await start();
    const later = { ...(await checkpoint()), screen: 'plan' };
    const data = await page.evaluate(() => window.DEMENZ_PLAN_DATA);
    for (const [name, list] of Object.entries({ frequency: data.frequencies, dayTime: data.dayTimes, duration: data.durations,
      living: data.livings, goal: data.goals, burden: data.burdens, minutes: data.minutes })) later.choices[name] = list[0].key;
    await page.evaluate(({ key, later }) => sessionStorage.setItem(key, JSON.stringify(later)), { key, later });
    await page.reload(); await at('email');
    await page.locator('#email').fill('qa-private@example.invalid');
    await page.getByRole('button', { name: 'Plan ansehen', exact: true }).click();
    await at('newsletter');
    assert.ok(!JSON.stringify(await checkpoint()).includes('qa-private'));
    await page.reload(); await at('email');
    assert.equal(await page.locator('#email').inputValue(), '');
    // A blocked storage API must not prevent answering questions.
    const blocked = await browser.newContext();
    await blocked.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await blocked.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('storage unavailable'); } }));
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(`${base}/start/?src=qa_blocked`);
    await blockedPage.getByRole('button', { name: 'Meine Mutter', exact: true }).click();
    await blockedPage.getByRole('button', { name: 'Weiter', exact: true }).click();
    assert.equal(await blockedPage.locator('body').getAttribute('data-screen'), 'situation');
    await blocked.close();
    await page.evaluate(key => sessionStorage.removeItem(key), key);
    await page.clock.install();
    await start();
    await page.clock.fastForward(30 * 60 * 1000 + 1);
    assert.equal(await checkpoint(), null, 'idle cleanup removes the checkpoint while the tab stays open');
    assert.deepEqual(errors, []);
    console.log('Quiz resume passed: desktop/mobile reload, selected answer/back, restart/old history, 30-minute expiry, invalid/context data, no name/email/free text, blocked storage.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
