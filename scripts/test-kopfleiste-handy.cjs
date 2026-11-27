// Kopf wie eine Landingpage (Daniel, 27. Nov), Konto-Karte unten und Ziel-Box auf dem Handy (26. Nov). Nur lokale Vorschau.
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
      // Kopf wie eine Landingpage (Daniel, 27. Nov 2026): Logo in der Mitte, rechts nur ein kleines Menü-Symbol.
      const head = await p.evaluate(() => {
        const h = document.querySelector('.e-header'), brand = h.querySelector('.e-brand'), r = brand.getBoundingClientRect(), span = brand.querySelector(':scope > span'), s = h.querySelector('.dc-navigation-menu > summary'), sr = s.getBoundingClientRect();
        const visible = [...h.querySelectorAll('a,button,summary,select')].filter(n => n.getClientRects().length && getComputedStyle(n).display !== 'none' && !n.closest('.dc-navigation-items'));
        return { controls: visible.length, centered: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 6, oneLine: span.getBoundingClientRect().height < 30, noOverlap: r.right <= sr.left, icon: sr.width <= 48 && sr.height >= 44 && getComputedStyle(s).fontSize === '0px', label: s.getAttribute('aria-label'), scroll: document.documentElement.scrollWidth > innerWidth };
      });
      assert.deepEqual(head, { controls: 2, centered: true, oneLine: true, noOverlap: true, icon: true, label: 'Menü', scroll: false }, `${view.n}: Kopf`);
      assert.equal(await p.locator('a.dc-navigation-store').count(), 0, `${view.n}: kein App-Store-Knopf im Kopf`);
      await p.locator('.dc-navigation-menu > summary').click();
      const items = p.locator('.dc-navigation-items');
      assert.ok(await items.locator('.dc-navigation-menu-account').isVisible(), `${view.n}: Anmelden im Menü`);
      for (const name of ['Abo verwalten', 'Zur App']) assert.ok(await items.getByRole('link', { name, exact: true }).isVisible(), `${view.n}: ${name}`);
      assert.ok(await items.getByRole('button', { name: 'Schrift größer', exact: true }).isVisible(), `${view.n}: Schrift größer`);
      assert.ok(await items.locator('select').isVisible(), `${view.n}: Sprache`);
      const box2 = await items.boundingBox(); assert.ok(box2.x >= 0 && box2.x + box2.width <= view.w + 1, `${view.n}: Menü im Bild`);
      await p.keyboard.press('Escape'); assert.equal(await p.locator('.dc-navigation-menu').evaluate(n => n.open), false);
      const box = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { chosen: r('.translator-goal-chosen'), change: r('.translator-goal-change'), row: r('.translator-goal-row') }; });
      if (view.w < 720) { assert.ok(box.change.top >= box.chosen.bottom - 2, `${view.n}: „Ändern“ unter dem Ziel`); assert.ok(box.chosen.width >= box.row.width - 40, `${view.n}: Ziel volle Breite`); }
      assert.deepEqual(errors, []); cases.push(view.n); await c.close();
    }
    // Fragebogen bekommt keinen App-Store-Knopf.
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ios }); await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
    const p = await c.newPage(); await p.goto(`${preview.origin}/start/`); await p.waitForTimeout(800);
    assert.equal(await p.locator('a.dc-navigation-store').count(), 0, 'kein Knopf im Fragebogen'); cases.push('start ohne Knopf');
    for (const page of ['/hilfe/', '/abo/konto.html']) { await p.goto(preview.origin + page); await p.waitForTimeout(800); assert.equal(await p.locator('a.dc-navigation-store').count(), 0, `kein Knopf auf ${page}`); cases.push(`${page} ohne Knopf`); }
    await c.close();
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
