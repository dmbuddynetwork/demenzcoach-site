// Eigenes Ziel eintippen unter den drei Zielen. Nur lokale Testdaten.
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const shots = process.env.ZIEL_SHOTS || '';
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); const cases = [];
  try {
    for (const view of [{ n: 'handy', w: 390, h: 844 }, { n: 'desktop', w: 1280, h: 900 }]) {
      const c = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 }); c.setDefaultTimeout(8000);
      await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
      await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
      const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
      const shot = async (name) => { if (shots) await p.screenshot({ path: path.join(shots, `${name}-${view.n}.png`) }); };
      await p.goto(`${preview.origin}/de/`);
      const decline = p.getByRole('button', { name: 'Ablehnen', exact: true }); if (await decline.count()) await decline.click().catch(() => {});
      await p.locator('a.e-tile[data-translator-key]').first().click();
      await p.getByRole('heading', { name: 'Was möchtest du jetzt erreichen?' }).waitFor();
      const field = p.locator('.translator-own-goal-input'); await field.waitFor();
      assert.equal(await field.getAttribute('placeholder'), 'Oder: Eigenes Ziel …');
      await p.locator('.translator-own-goal-row').scrollIntoViewIfNeeded(); await shot('1-eigenes-ziel');
      // zu kurz: nichts passiert
      await field.fill('ab'); await field.press('Enter');
      assert.equal(await p.locator('.translator-ai-goals').count(), 0, 'zu kurz wird nicht gesendet');
      await field.fill('Dass sie ruhig bleibt'); await field.press('Enter');
      await p.locator('.translator-selected-goal').waitFor();
      assert.match(await p.locator('.translator-selected-goal').innerText(), /Dein Ziel: Dass sie ruhig bleibt/);
      await shot('2-ziel-gewaehlt'); cases.push(`${view.n}: eigenes Ziel wird gewählt`);
      assert.deepEqual(errors, []); await c.close();
    }
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
