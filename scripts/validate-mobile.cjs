// Run with Playwright installed; optionally set PLAYWRIGHT_MODULE and CHROME_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const pages = fs.readdirSync(root).filter(file => /^index(?:-[a-z]+)?\.html$/.test(file));
    const fits = async label => {
      const result = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        rails: [...document.querySelectorAll('main *')].filter(element =>
          element.scrollWidth > element.clientWidth + 2 &&
          ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)
        ).map(element => element.className),
      }));
      assert.ok(result.width <= result.viewport, `${label}: page overflows`);
      assert.deepEqual(result.rails, [], `${label}: horizontal scroller`);
    };
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const file of width === 320 ? pages : ['index.html', 'index-en.html', 'index-ar.html']) {
        await page.goto(pathToFileURL(path.join(root, file)).href);
        if (await page.locator('.consent-decline').isVisible()) await page.locator('.consent-decline').click();
        await fits(`${file} ${width}`);
        const menu = page.locator('.menu-button');
        assert.ok((await menu.boundingBox()).height >= 44);
        await menu.click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        await fits(`${file} ${width} menu open`);
        await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        await page.evaluate(() => { document.documentElement.style.fontSize = '225%'; });
        await fits(`${file} ${width} doubled text`);
      }
    }
    assert.deepEqual(errors, [], 'Browser script errors');
    console.log(`Mobile checks passed: ${pages.length} languages at 320px; DE/EN/AR also at 390/430px; menu and doubled text.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
