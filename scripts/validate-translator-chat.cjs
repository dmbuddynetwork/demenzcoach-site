// Synthetic reproduction of an unknown sentence receiving only a safety response.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.SITE_URL || 'http://127.0.0.1:8906/';
const baselineRef = process.env.FUNNEL_BASELINE_REF;
const baseline = baselineRef ? execFileSync('git', ['show', `${baselineRef}:demenz-uebersetzer/translator.js`], { cwd: root, encoding: 'utf8' }) : null;
const screenshotDir = process.env.SCREENSHOT_DIR;

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
      localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
    });
    let sent = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/v1/translator-web') {
        sent.push(route.request().postDataJSON().text);
        return route.fulfill({ json: { kind: 'safety' } });
      }
      return url.origin === new URL(base).origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const submit = async (entry, text) => {
      await page.goto(new URL('/de/', base).href);
      if (entry === 'chat') {
        await page.locator('footer').scrollIntoViewIfNeeded();
        await page.locator('.translator-chat:not([hidden]) .translator-chat-input').waitFor();
        await page.locator('.translator-chat-input').fill(text);
        await page.locator('.translator-chat-send').click();
      } else {
        await page.locator('#translator-input').fill(text);
        await page.locator('#translator-form button[type="submit"]').click();
      }
      await page.locator('#translator-result .safety-urgent').first().waitFor();
      await page.waitForFunction(() => !document.querySelector('.translator-ai'));
    };
    if (baseline) {
      await page.route('**/demenz-uebersetzer/translator.js', route => route.fulfill({ contentType: 'text/javascript', body: baseline }));
      await submit('chat', 'sie ist mein eis weg');
      assert.equal(await page.locator('.translator-clarify').count(), 0);
      assert.equal(await page.locator('#translator-result .translator-phrases:visible').count(), 0);
      if (screenshotDir) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        await page.locator('#translator-result').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(screenshotDir, 'eis-chat-vorher.png') });
      }
      await page.unroute('**/demenz-uebersetzer/translator.js');
    }
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const text of ['sie ist mein eis weg', 'sie isst mein Eis weg']) {
        for (const entry of ['chat', 'main']) {
          sent = [];
          await submit(entry, text);
          await page.locator('.translator-clarify').waitFor();
          assert.deepEqual(sent, [text], `${entry}: exactly the entered sentence reaches the same request path`);
          const core = await page.evaluate(text => {
            const result = window.DemenzTranslatorCore.match(text, JSON.parse(document.getElementById('translator-data').textContent));
            return { key: result.entry?.key || null, safetyHit: result.safetyHit };
          }, text);
          assert.equal(core.safetyHit, false, 'no local safety hit for either ice sentence');
          assert.equal(core.key, null);
          assert.ok(await page.locator('.translator-clarify').evaluate(node => Boolean(node.previousElementSibling.querySelector('a[href="tel:112"]'))));
          assert.equal(await page.locator('.translator-plan-cta').count(), 0);
          assert.ok(!page.url().toLowerCase().includes('eis'));
          if (screenshotDir && width === 1280 && entry === 'chat' && text === 'sie ist mein eis weg') {
            await page.locator('#translator-result').screenshot({ path: path.join(screenshotDir, 'eis-chat-hinweis-und-rueckfrage.png') });
          }
          await page.getByRole('button', { name: 'Genauer beschreiben', exact: true }).click();
          assert.ok(await page.locator('#translator-input').evaluate(node => node === document.activeElement));
          assert.equal(await page.locator('#translator-input').inputValue(), text, 'the text remains editable');
          if (screenshotDir && entry === 'chat' && text === 'sie ist mein eis weg') {
            await page.locator('.translator-clarify').scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(screenshotDir, `eis-chat-nachher-${width}.png`) });
          }
        }
      }
    }
    for (const text of ['Sie bekommt keine Luft', 'Ich will nicht mehr leben']) {
      await submit('chat', text);
      assert.ok(await page.locator('#translator-result a[href="tel:112"]').count());
      assert.equal(await page.locator('.translator-plan-cta').count(), 0);
      assert.ok(!(await page.locator('#translator-result').innerText()).includes('keine Gefahr'));
    }
    console.log('Chat regression passed: baseline empty-state reproduced; exact/isst input through chat and main, editable clarification, 112 and no plan in safety output. AI responses were synthetic.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
