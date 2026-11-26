// Leiste unter der Antwort: eine flache Zeile „Frag weiter …“, runder „+“-Knopf für eine neue Situation. Nur lokale Testdaten.
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const shots = process.env.LEISTE_SHOTS || '';
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
      await p.locator('.translator-goal').nth(0).click();
      await p.locator('.translator-goal-chosen').waitFor();
      await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(600);
      const bar = p.locator('.translator-chat'); await bar.waitFor({ state: 'visible' });
      const plus = p.locator('.translator-chat-plus'); const field = p.locator('.translator-chat-input');
      assert.ok(await plus.isVisible(), '+ sichtbar');
      assert.equal(await field.getAttribute('placeholder'), 'Frag weiter …');
      assert.equal(await p.locator('.translator-chat-choice, .translator-chat-chip').count(), 0, 'keine Zweizeiler mehr');
      const box = await bar.boundingBox(); assert.ok(box.height <= 96, `Leiste flach (${box.height}px)`);
      await shot('1-frag-weiter'); cases.push(`${view.n}: Frag weiter, flach (${Math.round(box.height)}px)`);
      await plus.click();
      await p.waitForFunction(() => { const f = document.querySelector('.translator-chat-input'); return f && f.placeholder !== 'Frag weiter …' && f.placeholder.length > 0; });
      assert.equal(await plus.getAttribute('aria-label'), 'Zurück zur Nachfrage');
      await shot('2-neue-situation'); cases.push(`${view.n}: + wechselt zu neuer Situation`);
      await plus.click();
      assert.equal(await field.getAttribute('placeholder'), 'Frag weiter …');
      cases.push(`${view.n}: × zurück zur Nachfrage`);
      assert.deepEqual(errors, []); await c.close();
    }
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
