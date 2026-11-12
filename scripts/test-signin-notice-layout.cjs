// Geometry and hit-testing on the actual local app shell; no auth or provider actions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
(async () => {
  let preview, browser;
  const report = { providerCalls: 0, authActions: 0, profiles: [] };
  try {
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    const output = process.env.SIGNIN_NOTICE_EVIDENCE;
    if (output) fs.mkdirSync(output, { recursive: true });
    for (const width of [390, 1280]) for (const textScale of [100, 200]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        await context.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
        await context.route('**/*', route => new URL(route.request().url()).origin === preview.origin ? route.continue() : route.abort());
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        await page.goto(preview.origin + '/de/');
        await page.evaluate(async scale => {
          document.documentElement.style.fontSize = scale + '%';
          const module = await import('/abo/signin-success.js'); module.showSignInNotice({ offerSetup: true });
        }, textScale);
        const geometry = () => page.evaluate(() => {
          const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
          const header = document.querySelector('.e-header'), note = document.querySelector('.dc-signin-notice');
          const free = node => { const r = rect(node); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return top === node || node.contains(top); };
          return { header: rect(header), notice: rect(note), fontSize: getComputedStyle(note).fontSize, linkFontSize: getComputedStyle(note.querySelector('a')).fontSize, linkWeight: getComputedStyle(note.querySelector('a')).fontWeight, headerControlsReachable: free(header.querySelector('.e-brand')) && free(header.querySelector('summary')), noOverflow: document.documentElement.scrollWidth <= innerWidth, noticeHidden: note.hidden };
        });
        let closed = await geometry();
        assert.equal(closed.headerControlsReachable, true);
        assert.equal(closed.noticeHidden, false);
        assert.ok(closed.notice.y >= closed.header.bottom + 7);
        assert.equal(closed.noOverflow, true);
        if (textScale === 100 && closed.notice.height > 60) console.log(JSON.stringify({compactDiagnostic:closed}));
        if (textScale === 100) assert.ok(closed.notice.height <= 60, 'Ordinary hint stays compact');
        assert.equal(closed.linkWeight, '400', 'Optional setup link is visually secondary');
        if (output) await page.screenshot({ path: path.join(output, `NOTICE-${width}-TEXT${textScale}.png`) });
        await page.locator('.e-header summary').click();
        await page.waitForFunction(() => document.querySelector('.dc-signin-notice').hidden);
        const open = await geometry();
        assert.equal(open.headerControlsReachable, true);
        const firstControl = page.locator('.e-menu[open] .e-menu-items a[href]:visible, .e-menu[open] .e-menu-items button:visible').first();
        await firstControl.focus();
        assert.equal(await firstControl.evaluate(node => node === document.activeElement), true);
        if (output) await page.screenshot({ path: path.join(output, `MENU-${width}-TEXT${textScale}.png`) });
        await page.locator('.e-header summary').click();
        await page.waitForFunction(() => !document.querySelector('.dc-signin-notice').hidden);
        await page.evaluate(() => window.scrollTo(0, 300));
        await page.waitForFunction(() => document.querySelector('.dc-signin-notice').getBoundingClientRect().top >= document.querySelector('.e-header').getBoundingClientRect().bottom + 7);
        const scrolled = await geometry(); assert.equal(scrolled.headerControlsReachable, true);
        await page.setViewportSize({ width: width === 390 ? 420 : 1100, height: 850 });
        await page.waitForFunction(() => document.querySelector('.dc-signin-notice').getBoundingClientRect().top >= document.querySelector('.e-header').getBoundingClientRect().bottom + 7);
        const resized = await geometry(); assert.equal(resized.headerControlsReachable, true); assert.equal(resized.noOverflow, true);
        await page.getByRole('button', { name: 'Anmeldehinweis schließen', exact: true }).click();
        assert.equal(await page.locator('.dc-signin-notice').count(), 0);
        report.profiles.push({ width, textScale, closed, open, scrollAndResize: 'PASS', dismiss: 'PASS' });
      } finally { await context.close(); }
    }
    report.passed = true;
    if (output) fs.writeFileSync(path.join(output, 'NOTICE-LAYOUT-REPORT.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
