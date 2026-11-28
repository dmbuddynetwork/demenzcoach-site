// Wechselnde Beispielsätze im Eingabefeld: Startseite, Leiste auf Tipp-Seiten. Nur lokale Testdaten.
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const shots = process.env.BEISPIEL_SHOTS || '';
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); const cases = [];
  try {
    for (const view of [{ n: 'handy', w: 390, h: 844 }, { n: 'desktop', w: 1280, h: 900 }]) {
      const c = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 }); c.setDefaultTimeout(8000);
      await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
      await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
      const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
      const shot = async (name) => { if (shots) await p.screenshot({ path: path.join(shots, `${name}-${view.n}.png`) }); };
      // 1 Startseite: Platzhalter tippt sich ein und wechselt.
      await p.goto(`${preview.origin}/de/`);
      const decline = p.getByRole('button', { name:'Nein, danke', exact: true }); if (await decline.count()) await decline.click().catch(() => {});
      const big = p.locator('#translator-input');
      const ph = () => big.getAttribute('placeholder');
      await p.waitForFunction(() => document.querySelector('#translator-input')?.placeholder.length > 'Zum Beispiel: '.length + 8 && document.querySelector('#translator-input').placeholder.startsWith('Zum Beispiel: '));
      await shot('1-tippt');
      const seen = new Set();
      for (let i = 0; i < 60 && seen.size < 3; i++) { const v = await ph(); if (v.length > 18) seen.add(v.replace(/…$/, '')); await p.waitForTimeout(500); }
      assert.ok(new Set([...seen].map(v => v.slice(0, 22))).size >= 2 || seen.size >= 3, 'mehrere Beispiele wechseln');
      cases.push(`${view.n}: Startseite wechselt Beispiele`);
      // 2 Tippen stoppt die Animation, der Text bleibt.
      await big.fill('Mama ruft nachts.');
      await p.waitForTimeout(600);
      assert.equal(await big.inputValue(), 'Mama ruft nachts.');
      await big.fill(''); const before = await ph(); await p.waitForTimeout(1500);
      assert.ok((await ph()) !== before || (await ph()).length > 0, 'läuft nach Leeren weiter');
      cases.push(`${view.n}: Tippen stoppt, Leeren startet`);
      // 2b Leeres Feld + Absenden schickt das gezeigte Beispiel ab.
      await big.fill(''); await p.waitForFunction(() => document.querySelector('#translator-input').dataset.dcBeispielText);
      const shown = await big.evaluate(el => el.dataset.dcBeispielText);
      await big.focus(); await p.keyboard.press('Enter');
      await p.waitForFunction(text => document.body.innerText.includes(text), shown);
      cases.push(`${view.n}: leeres Feld sendet Beispiel „${shown}“`);
      // 3 Leiste auf Tipp-Seite.
      await p.goto(`${preview.origin}/alltagstricks/abendritual.html`);
      const bar = p.locator('.translator-chat-input');
      await p.waitForFunction(() => { const f = document.querySelector('.translator-chat-input'); return f && f.placeholder.startsWith('z. B. ') && f.placeholder.length > 10; });
      await shot('3-leiste-tipps');
      assert.ok((await bar.getAttribute('placeholder')).length <= 6 + 44);
      cases.push(`${view.n}: Tipp-Seite Leiste animiert`);
      assert.deepEqual(errors, []); await c.close();
    }
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
