// Regression on the actual five-tip page, real menu, normal bootstrap and trusted wheel input.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const report = { checks: [], realProviderCalls: 0, careRequests: 0 };
(async () => {
 let preview, browser;
 try {
  preview = await createPreviewServer();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  for (const mode of ['reading-timer', 'auth-resolution', 'late-presentation']) {
   const context = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' });
   let releaseStyle;
   try {
    await context.addInitScript(() => {
     localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
     localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
     window.__clockOffset = 0; const now = Date.now; Date.now = () => now() + window.__clockOffset;
    });
    const errors = [], unexpected = [];
    await context.route('**/*', async route => {
     const url = new URL(route.request().url());
     if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: `
       const auth={currentUser:null};
       export async function webAuth(){if(window.__holdAuth)await new Promise(resolve=>window.__releaseAuth=resolve);return{auth,sdk:{}};}` });
     if (mode === 'late-presentation' && url.pathname === '/abo/signup-offer-view.css') {
      await new Promise(resolve => releaseStyle = resolve); return route.continue();
     }
     if (url.origin !== preview.origin) { unexpected.push(url.pathname); return route.abort(); }
     return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(6000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(preview.origin + '/de/demenz-alltagstipps.html', { waitUntil: 'networkidle' });
    const menu = page.locator('.site-menu'), toggle = menu.locator('summary'), modal = page.locator('.dc-signup-sheet[open]');
    assert.equal(await menu.count(), 1); assert.equal(await page.locator('.e-menu').count(), 0);
    if (mode === 'auth-resolution') await page.evaluate(() => window.__holdAuth = true);
    await page.mouse.move(180, 650); await page.mouse.wheel(0, 500); await page.waitForTimeout(120);
    await page.mouse.wheel(0, 150); await page.waitForTimeout(120);
    if (mode !== 'reading-timer') {
     await page.evaluate(() => window.__clockOffset = 7000);
     await page.mouse.wheel(0, 60);
     if (mode === 'auth-resolution') await page.waitForFunction(() => typeof window.__releaseAuth === 'function');
     else { for (let i = 0; i < 60 && !releaseStyle; i++) await page.waitForTimeout(50); assert.ok(releaseStyle, 'Existing signup stylesheet reached'); }
    }
    await toggle.click(); assert.equal(await menu.evaluate(node => node.open), true);
    if (mode === 'reading-timer') await page.waitForTimeout(6300);
    if (mode === 'auth-resolution') await page.evaluate(() => { window.__holdAuth = false; window.__releaseAuth(); });
    if (mode === 'late-presentation') releaseStyle();
    await page.waitForTimeout(300);
    assert.equal(await menu.evaluate(node => node.open), true);
    assert.equal(await modal.count(), 0, mode + ': actual open menu prevents signup');
    assert.equal(await page.locator('[data-content-signup]').count(), 0, 'No orphan placeholder');
    await toggle.click(); assert.equal(await menu.evaluate(node => node.open), false);
    assert.equal(await modal.count(), 0, 'Closing menu alone never opens signup');
    await page.mouse.move(180, 650); await page.mouse.wheel(0, -250); await page.waitForTimeout(120); await page.mouse.wheel(0, 250);
    await modal.waitFor(); assert.equal(await modal.count(), 1);
    await page.keyboard.press('Escape'); await page.mouse.wheel(0, -150); await page.waitForTimeout(100); await page.mouse.wheel(0, 150); await page.waitForTimeout(200);
    assert.equal(await modal.count(), 0, 'Once-per-tab remains intact');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('demenzcoach.contentSignupShown.v1')), 'shown');
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    report.checks.push({ mode, realList: true, realMenu: true, blockedWhileOpen: true, exactlyOnceAfterCloseAndTrustedScroll: true, errors });
    console.log('PASS', mode);
   } finally { releaseStyle?.(); await context.close(); }
  }
  if (process.env.CONTENT_MENU_REPORT) fs.writeFileSync(process.env.CONTENT_MENU_REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
 } finally { await browser?.close(); await preview?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
