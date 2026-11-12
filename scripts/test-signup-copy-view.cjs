// Real Chrome rendering; auth callbacks are simulated, no messages or provider calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const evidence = process.env.SIGNUP_COPY_EVIDENCE;
(async () => {
  let browser, preview;
  const report = { providerCalls: 0, authCalls: 0, cases: [] };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    for (const locale of ['de', 'en']) for (const width of [390, 1280]) {
      if (process.env.SIGNUP_VIEW_PROFILE && process.env.SIGNUP_VIEW_PROFILE !== `${locale}-${width}`) continue;
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      try {
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.origin !== preview.origin) return route.abort();
          if (url.pathname === '/__signup-copy-view') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/abo/signup-offer-view.css"></head><body style="margin:16px"><main></main></body></html>' });
          return route.continue();
        });
        const page = await context.newPage(); await page.goto(preview.origin + '/__signup-copy-view');
        const render = options => page.evaluate(async options => {
          const { createSignupOffer } = await import('/abo/signup-offer-view.js');
          window.__calls = [];
          const card = createSignupOffer({ locale: options.locale, creditActive: true, additionalAnswers: 3, googleAvailable: true,
            onEmail: async email => { window.__calls.push(['email', email]); return { sent: true }; },
            onGoogle: async () => { window.__calls.push(['google']); return { signedIn: true }; },
            onLater: () => window.__calls.push(['later']), ...options });
          document.querySelector('main').replaceChildren(card);
        }, options);
        for (const signupCopy of ['variant_1', 'variant_3']) {
          await render({ locale, signupCopy });
          assert.equal(await page.locator('.dc-signup').getAttribute('data-signup-copy'), signupCopy);
          const expected = locale === 'de'
            ? signupCopy === 'variant_1' ? 'Was sage ich jetzt am besten?' : 'Ein Satz zum Sagen. Ein Schritt zum Ausprobieren.'
            : signupCopy === 'variant_1' ? 'What can I say right now?' : 'Words to say. A step to try.';
          assert.equal(await page.getByRole('heading', { level: 3 }).innerText(), expected);
          assert.match(await page.locator('.lead').innerText(), locale === 'de' ? /3 weitere KI-Antworten kostenlos/ : /3 more AI answers for free/);
          assert.equal(await page.locator('.offer-body .primary').innerText(), locale === 'de' ? '3 Antworten kostenlos freischalten' : 'Unlock 3 free answers');
          assert.equal(await page.locator('input[type=email]').isVisible(), true);
          assert.equal(await page.locator('.google').isVisible(), true);
          assert.match(await page.locator('.details').innerText(), locale === 'de' ? /Keine automatische Newsletter-Anmeldung/ : /No automatic newsletter signup/);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          assert.deepEqual(await page.evaluate(() => window.__calls), []);
          await page.locator('.offer-body .primary').click(); assert.deepEqual(await page.evaluate(() => window.__calls), []);
          await page.locator('input').fill('caregiver@example.test'); await page.locator('.offer-body .primary').click();
          await page.waitForFunction(() => window.__calls.length === 1);
          assert.deepEqual(await page.evaluate(() => window.__calls[0]), ['email', 'caregiver@example.test']);
          assert.equal(await page.locator('.signup-address').innerText(), 'caregiver@example.test');
          assert.equal(await page.getByRole('heading', { name: locale === 'en' ? 'Open your email inbox now' : 'Öffne jetzt dein E-Mail-Postfach', exact: true }).count(), 1);
          await page.getByRole('button', { name: locale === 'en' ? 'Change email address' : 'Adresse ändern', exact: true }).click();
          await page.locator('.google').click(); await page.waitForFunction(() => window.__calls.length === 2);
          assert.deepEqual(await page.evaluate(() => window.__calls[1]), ['google']);
          if (evidence && signupCopy === 'variant_1' && locale === 'de') {
            await render({ locale, signupCopy }); await page.screenshot({ path: path.join(evidence, `SIGNUP-DRAFT-${width}.png`) });
          }
          report.cases.push({ locale, width, signupCopy, emailVisible: true, hooksPreserved: true });
        }
        await render({ locale, signupCopy: '<img src=x onerror=alert(1)>' });
        assert.equal(await page.locator('.dc-signup').getAttribute('data-signup-copy'), 'variant_1');
        assert.equal(await page.locator('.dc-signup img').count(), 0);
        for (const options of [{ creditActive: false }, { purpose: 'account' }, { purpose: 'invitation' }]) {
          await render({ locale, ...options });
          assert.equal(await page.locator('.dc-signup').getAttribute('data-signup-copy'), null);
          assert.doesNotMatch(await page.locator('.dc-signup').innerText(), /3 (?:weitere|Antworten|more|free)/);
        }
        await render({ locale, additionalAnswers: 2 });
        assert.match(await page.locator('.lead').innerText(), locale === 'de' ? /2 weitere/ : /2 more/);
        assert.doesNotMatch(await page.locator('.dc-signup').innerText(), /3 (?:weitere|Antworten|more|free)/);
        await render({ locale, googleAvailable: false }); assert.equal(await page.locator('.google').isVisible(), false);
      } finally { await context.close(); }
    }
    report.passed = true;
    if (evidence) fs.writeFileSync(path.join(evidence, 'copy-view-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
