// Kopfleiste einzeilig, App-Store-Knopf und Ziel-Box auf dem Handy (Daniel, 26. Nov). Nur lokale Vorschau.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); const cases = [];
  try {
    for (const view of [{ n: 'iphone-390', w: 390, ua: ios, store: true }, { n: 'iphone-360', w: 360, ua: ios, store: true }, { n: 'android-390', w: 390, ua: android, store: false }, { n: 'desktop', w: 1280, store: true }]) {
      const c = await browser.newContext({ viewport: { width: view.w, height: 844 }, userAgent: view.ua });
      await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
      await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
      const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
      await p.goto(`${preview.origin}/de/demenz-uebersetzer/wo-ist-mein-mann.html`);
      await p.getByRole('button', { name: 'Ziel ändern' }).waitFor(); await p.waitForTimeout(400);
      for (const label of ['Anmelden', '✓ Angemeldet', 'Konto bestätigen']) {
        const m = await p.evaluate(async label => {
          document.querySelector('.dc-navigation-account').textContent = label; dispatchEvent(new Event('load')); await new Promise(r => setTimeout(r, 30));
          const span = document.querySelector('.e-header .e-brand > span'), dock = document.querySelector('.e-header .dc-navigation'), brand = document.querySelector('.e-header .e-brand');
          const shown = getComputedStyle(span).display !== 'none';
          return { oneLine: !shown || span.getBoundingClientRect().height < 26, clipped: shown && span.scrollWidth > span.clientWidth + 1, sameRow: Math.abs(dock.getBoundingClientRect().top - brand.getBoundingClientRect().top) < 8, scroll: document.documentElement.scrollWidth > innerWidth };
        }, label);
        assert.deepEqual(m, { oneLine: true, clipped: false, sameRow: true, scroll: false }, `${view.n} ${label}`);
      }
      const store = p.locator('.e-header a.dc-navigation-store');
      assert.equal(await store.count(), view.store ? 1 : 0, `${view.n}: App-Store-Knopf`);
      if (view.store) { assert.match(await store.getAttribute('href'), /^https:\/\/apps\.apple\.com\/app\/apple-store\/id6790763941\?/); assert.ok(await store.isVisible()); assert.ok((await store.boundingBox()).height >= 44); }
      const box = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { chosen: r('.translator-goal-chosen'), change: r('.translator-goal-change'), row: r('.translator-goal-row') }; });
      if (view.w < 720) { assert.ok(box.change.top >= box.chosen.bottom - 2, `${view.n}: „Ändern“ unter dem Ziel`); assert.ok(box.chosen.width >= box.row.width - 40, `${view.n}: Ziel volle Breite`); }
      assert.deepEqual(errors, []); cases.push(view.n); await c.close();
    }
    // Fragebogen bekommt keinen App-Store-Knopf.
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ios }); await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
    const p = await c.newPage(); await p.goto(`${preview.origin}/start/`); await p.waitForTimeout(800);
    assert.equal(await p.locator('a.dc-navigation-store').count(), 0, 'kein Knopf im Fragebogen'); cases.push('start ohne Knopf'); await c.close();
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
