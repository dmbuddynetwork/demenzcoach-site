// Das Ziel wählt die Person selbst; „Ziel ändern“ führt zurück zur Zielfrage. Nur lokale Testdaten.
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const shots = process.env.GOAL_SHOTS || '';
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); const cases = [];
  try {
    for (const view of [{ n: 'handy', w: 390, h: 844 }, { n: 'desktop', w: 1280, h: 900 }]) {
      const c = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 }); c.setDefaultTimeout(8000);
      await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
      await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
      const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
      const shot = async (name) => { if (shots) await p.screenshot({ path: path.join(shots, `${name}-${view.n}.png`) }); };
      const goalHeading = p.getByRole('heading', { name: 'Was möchtest du jetzt erreichen?' });
      // 1 Kachel auf der Startseite führt zur Zielfrage, es ist nichts vorausgewählt.
      await p.goto(`${preview.origin}/de/`);
      const decline = p.getByRole('button', { name:'Nein, danke', exact: true }); if (await decline.count()) await decline.click().catch(() => {});
      await p.locator('a.e-tile[data-translator-key]').first().click();
      await goalHeading.waitFor();
      assert.equal(await p.locator('.translator-goal-chosen').count(), 0, 'kein Ziel vorausgewählt');
      assert.ok(await p.locator('.translator-goal').count() >= 3, 'drei Ziele zur Wahl');
      await shot('1-zielfrage'); cases.push(`${view.n}: Kachel öffnet Zielfrage`);
      // 2 Ziel wählen, dann „Ziel ändern“.
      const labels = await p.locator('.translator-goal-label').allTextContents();
      await p.locator('.translator-goal').nth(1).click();
      const chosen = p.locator('.translator-goal-chosen'); await chosen.waitFor();
      assert.equal((await chosen.innerText()).replace(/^Dein Ziel:\s*/, ''), labels[1], 'gewähltes Ziel steht da');
      const change = p.getByRole('button', { name: 'Ziel ändern' }); await change.waitFor();
      await shot('2-antwort-mit-ziel-aendern');
      await change.click(); await goalHeading.waitFor();
      assert.equal(await p.locator('.translator-goal-chosen').count(), 0, 'nach „Ziel ändern“ ist nichts gewählt');
      await p.locator('.translator-goal').nth(2).click(); await chosen.waitFor();
      assert.equal((await chosen.innerText()).replace(/^Dein Ziel:\s*/, ''), labels[2], 'neues Ziel ersetzt das alte');
      cases.push(`${view.n}: Ziel wählen und ändern`);
      // 3 Feste Situationsseite (Ziel steckt in der Adresse): auch dort „Ziel ändern“.
      await p.goto(`${preview.origin}/de/demenz-uebersetzer/wo-ist-mein-mann.html`);
      await p.getByRole('button', { name: 'Ziel ändern' }).waitFor();
      await p.getByRole('button', { name: 'Ziel ändern' }).click(); await goalHeading.waitFor();
      cases.push(`${view.n}: feste Seite mit Ziel ändern`);
      assert.deepEqual(errors, []); await c.close();
    }
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
