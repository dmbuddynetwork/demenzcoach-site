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
      // Kopf wie eine Landingpage (Daniel, 27. Nov 2026): nur Logo und Name, in der Mitte, eine Zeile, keine Knöpfe.
      const head = await p.evaluate(() => {
        const h = document.querySelector('.e-header'), brand = h.querySelector('.e-brand'), r = brand.getBoundingClientRect(), span = brand.querySelector(':scope > span');
        return { onlyBrand: h.querySelectorAll('a,button,summary,select').length === 1, centered: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 6, oneLine: span.getBoundingClientRect().height < 30, scroll: document.documentElement.scrollWidth > innerWidth };
      });
      assert.deepEqual(head, { onlyBrand: true, centered: true, oneLine: true, scroll: false }, `${view.n}: Kopf`);
      assert.equal(await p.locator('a.dc-navigation-store').count(), 0, `${view.n}: kein App-Store-Knopf im Kopf`);
      // Konto, Abo, Schrift, App und Sprache stehen unten in der Karte über der Fußzeile.
      const tools = p.locator('.dc-foot-tools');
      assert.equal(await tools.count(), 1, `${view.n}: Karte unten`);
      assert.ok(await tools.evaluate(n => n.nextElementSibling?.matches('footer.e-footer')), `${view.n}: Karte direkt über der Fußzeile`);
      for (const label of ['Anmelden', '✓ Angemeldet', 'Konto bestätigen']) {
        const m = await p.evaluate(label => { const a = document.querySelector('.dc-foot-tools .dc-navigation-account'); a.textContent = label; const r = a.getBoundingClientRect(); return { h: r.height >= 44, inside: r.right <= innerWidth, scroll: document.documentElement.scrollWidth > innerWidth }; }, label);
        assert.deepEqual(m, { h: true, inside: true, scroll: false }, `${view.n} ${label}`);
      }
      for (const name of ['Abo verwalten', 'Zur App']) assert.ok(await tools.getByRole('link', { name, exact: true }).isVisible(), `${view.n}: ${name}`);
      assert.ok(await tools.getByRole('button', { name: 'Schrift größer', exact: true }).isVisible(), `${view.n}: Schrift größer`);
      assert.ok(await tools.locator('select').isVisible(), `${view.n}: Sprache`);
      assert.equal(await tools.locator('.e-saved-toggle[hidden]').evaluateAll(n => n.filter(x => getComputedStyle(x).display !== 'none').length), 0, `${view.n}: leeres Herz bleibt versteckt`);
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
