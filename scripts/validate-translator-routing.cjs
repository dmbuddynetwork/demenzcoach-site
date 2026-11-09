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
      await page.locator('#translator-form button[type="submit"]').click();
      assert.ok(await page.locator('#translator-input').evaluate(element => element === document.activeElement), `${home}: empty submit focuses the input`);
      const emptyHint = await page.locator('#translator-empty-hint').innerText();
      assert.ok(emptyHint.trim(), `${home}: empty submit explains the next step`);
      if (home === '/de/') assert.equal(emptyHint, 'Bitte zuerst einen Satz eintippen – oder eine Situation auswählen.');
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

    // Examples-first home: a not-yet-reached input must not put the chat over the choices.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(new URL('/de/', base).href);
    if (await page.locator('.consent-decline').isVisible()) await page.locator('.consent-decline').click();
    await page.waitForFunction(() => document.querySelector('.translator-chat'));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.ok(await page.locator('.translator-chat').isHidden(), 'initial choices remain unobstructed');
    await page.locator('#translator-input').scrollIntoViewIfNeeded();
    await page.locator('.e-footer').scrollIntoViewIfNeeded();
    await page.locator('.translator-chat').waitFor({ state: 'visible' });
    await page.locator('.translator-chat-close').click();
    assert.ok(await page.locator('.translator-chat-open').isVisible(), 'chat can still be minimized after passing the input');

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(new URL('/de/', base).href);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `home fits at ${width}px`);
      for (const control of await page.locator('.home-situations .e-tile, .e-font-toggle, #translator-form button[type="submit"]').all()) {
        assert.ok((await control.boundingBox()).height >= 44, `home controls remain large enough at ${width}px`);
      }
      if (width === 320) {
        await page.evaluate(() => { document.documentElement.style.fontSize = '225%'; });
        const layout = await page.evaluate(() => ({
          fits: document.documentElement.scrollWidth <= innerWidth,
          overflow: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0,6).map(element => `${element.tagName}.${element.className}`)
        }));
        assert.ok(layout.fits, `home fits at 320px with 225% text: ${layout.overflow.join(', ')}`);
      }
    }

    // Crawlers, no-JS readers, and new tabs get an actual, self-canonical article.
    const plain = await browser.newContext({ javaScriptEnabled: false });
    const noJS = await plain.newPage();
    await noJS.goto(new URL('/de/', base).href);
    await noJS.locator('a.e-tile[data-translator-key="nachhause"]').click();
    assert.equal(new URL(noJS.url()).pathname, '/ratgeber/demenz-nach-hause-was-sagen.html');
    assert.equal(await noJS.locator('link[rel="canonical"]').getAttribute('href'), `${production}/ratgeber/demenz-nach-hause-was-sagen.html`);
    assert.match(await noJS.locator('h1').innerText(), /nach Hause/);
    await plain.close();
    assert.deepEqual(errors, [], 'no browser script errors across routing and homepage checks');
  } finally { await browser.close(); }
  console.log('Translator/home passed: three entry points, empty input, stable metadata, share/reload/back, safety-state clearing, real no-JS links, examples-first chat visibility, 320/390/768/1440px and 225% text.');
})().catch(error => { console.error(error); process.exitCode = 1; });
