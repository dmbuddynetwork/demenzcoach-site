// Browser regression: tool states must not impersonate editorial documents.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_URL || 'http://127.0.0.1:8898/';
const production = 'https://dementiacoachapp.com';

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const home of ['/de/', '/en/', '/demenz-uebersetzer/']) {
      await page.goto(new URL(`${home}?src=seo_test`, base).href);
      const situation = home === '/en/' ? 'home' : 'nachhause';
      const title = await page.title();
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      const chip = page.locator(`[data-translator-key="${situation}"]`);
      await chip.first().click();
      await page.waitForURL(url => url.searchParams.get('situation') === situation);
      let url = new URL(page.url());
      assert.equal(url.pathname, home);
      assert.equal(url.searchParams.get('src'), 'seo_test');
      assert.equal(await page.title(), title);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
      if (home !== '/en/') {
        await page.locator('.translator-goal').first().click();
        await page.waitForURL(url => url.searchParams.get('ziel') === 'jetzt');
      }
      await page.reload();
      await page.locator('.translator-phrases').waitFor();
      assert.equal(new URL(page.url()).pathname, home);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
      assert.equal(await page.title(), title);
      // A safety answer replaces prior state; a reload must not restore the old question.
      const safetySentence = await page.locator('#translator-data').evaluate((element, key) => JSON.parse(element.textContent).entries.find(entry => entry.key === key).says, home === '/en/' ? 'die' : 'sterben');
      await page.locator('#translator-input').fill(safetySentence);
      await page.locator('#translator-input').press('Enter');
      await page.waitForURL(url => !url.searchParams.has('situation'));
      assert.ok(!new URL(page.url()).searchParams.has('ziel'));
      assert.ok(!page.url().includes('leben'));
    }
    await page.goto(new URL('/de/', base).href);
    const anchor = page.locator('a.e-tile[data-translator-key="mutter"]');
    assert.ok(await anchor.getAttribute('href'));
    await anchor.click();
    await page.waitForURL(url => url.searchParams.get('situation') === 'mutter');
    await page.goBack();
    await page.waitForURL(url => url.pathname === '/de/' && !url.searchParams.has('situation'));
    await page.locator('#translator-form').waitFor();
    await page.goto(new URL('/demenz-uebersetzer/?situation=waschen&ziel=tipps', base).href);
    await page.locator('.translator-phrases').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('ziel'), 'tipps');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `${production}/demenz-uebersetzer/`);
    await page.goto(new URL('/de/?situation=unknown&ziel=invalid', base).href);
    assert.ok(await page.locator('#translator-input').isVisible());
    assert.deepEqual(errors, []);

    // Crawlers, no-JS readers, and new tabs get an actual, self-canonical article.
    const plain = await browser.newContext({ javaScriptEnabled: false });
    const noJS = await plain.newPage();
    await noJS.goto(new URL('/de/', base).href);
    await noJS.locator('a.e-tile[data-translator-key="nachhause"]').click();
    assert.equal(new URL(noJS.url()).pathname, '/ratgeber/demenz-nach-hause-was-sagen.html');
    assert.equal(await noJS.locator('link[rel="canonical"]').getAttribute('href'), `${production}/ratgeber/demenz-nach-hause-was-sagen.html`);
    assert.match(await noJS.locator('h1').innerText(), /nach Hause/);
    await plain.close();
  } finally { await browser.close(); }
  console.log('Translator routing passed: three entry points, stable document metadata, share/reload/back, safety-state clearing, invalid state and real no-JS links.');
})().catch(error => { console.error(error); process.exitCode = 1; });
