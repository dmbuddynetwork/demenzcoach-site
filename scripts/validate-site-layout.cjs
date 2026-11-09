// Start a local HTTP server first; SITE_URL may also point to the deployed site.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const files = [];
function walk(directory, prefix = '') {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const relative = path.posix.join(prefix, item.name);
    if (item.isDirectory()) walk(path.join(directory, item.name), relative);
    else if (relative.endsWith('.html')) files.push(relative);
  }
}
walk(root);
// Optional file arguments keep route changes verifiable without a full-site browser audit.
const targets = process.argv.slice(2).length ? process.argv.slice(2) : files;
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const fits = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const file of targets) {
        await page.goto(new URL(file, process.env.SITE_URL || 'http://127.0.0.1:8892/').href);
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        if (/<meta\s+http-equiv=["']refresh["']/i.test(html)) {
          const target = /<link\s+rel="canonical"\s+href="([^"]+)"/.exec(html)?.[1];
          const expected = new URL(target).pathname;
          await page.waitForURL(url => url.pathname === (expected === '/' ? '/de/' : expected));
        }
        if (await page.locator('.consent-decline').isVisible()) await page.locator('.consent-decline').click();
        assert.equal(await page.locator('h1').count(), 1, file);
        assert.equal(await page.locator('link[href*="lovable-home.css"], link[href$="einfach.css"]').count(), 1, file);
        await fits(`${file}: ${width}px`);
        const menu = page.locator('.menu-button');
        if (await menu.isVisible()) {
          await menu.click();
          assert.equal(await menu.getAttribute('aria-expanded'), 'true');
          await fits(`${file}: open menu`);
          await page.keyboard.press('Escape');
          assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        }
        if (width === 320) {
          await page.evaluate(() => { document.documentElement.style.fontSize = '225%'; });
          await fits(`${file}: large text`);
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log(`${targets.length} pages passed: shared layout, 320/390/768/1440px, mobile menu, enlarged text, no script errors.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
