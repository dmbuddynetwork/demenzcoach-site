// /auswahl/-Seiten zeigen nie zuerst die fertige Antwort (Daniel, 26. Nov). Der Worker markiert <body>;
// hier ahmt eine Route den Worker nach und bremst translator.js, damit der Zustand vor dem Skript prüfbar ist.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); c.setDefaultTimeout(8000);
    await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
    let release; const gate = new Promise(r => { release = r; });
    await c.route('**/*', async r => {
      const url = new URL(r.request().url());
      if (url.origin !== preview.origin) return r.abort();
      if (url.pathname === '/de/demenz-uebersetzer/wo-sind-meine-kinder/auswahl/') {
        const res = await fetch(`${preview.origin}/de/demenz-uebersetzer/wo-sind-meine-kinder.html`);
        const html = (await res.text()).replace('<body ', '<body data-translator-pending-goal ');
        return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      }
      if (url.pathname === '/demenz-uebersetzer/translator.js') await gate;
      return r.continue();
    });
    const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(`${preview.origin}/de/demenz-uebersetzer/wo-sind-meine-kinder/auswahl/`, { waitUntil: 'commit' });
    await p.waitForSelector('#translator-result', { state: 'attached' });
    assert.equal(await p.locator('#translator-result').isVisible(), false, 'Antwort vor dem Skript verdeckt');
    assert.equal(await p.locator('#translator-result').evaluate(n => getComputedStyle(n).visibility), 'hidden');
    release();
    await p.getByRole('heading', { name: 'Was möchtest du jetzt erreichen?' }).waitFor();
    assert.equal(await p.locator('body[data-translator-pending-goal]').count(), 0, 'Markierung nach dem Skript entfernt');
    assert.equal(await p.locator('#translator-result').evaluate(n => getComputedStyle(n).visibility), 'visible');
    assert.equal(await p.locator('.translator-goal').first().isVisible(), true, 'Ziele sichtbar');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, cases: ['Antwort vor Skript verdeckt', 'Zielfrage nach Skript sichtbar'] }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
