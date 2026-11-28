// Eingabe, die genau zu einer Situation passt, zeigt deren Adresse; Zurück führt zur Startseite. Nur lokale Testdaten.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const c = await browser.newContext({ viewport: { width: 430, height: 900 } }); c.setDefaultTimeout(8000);
    await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
    await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
    const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(`${preview.origin}/de/`);
    const decline = p.getByRole('button', { name:'Nein, danke', exact: true }); if (await decline.count()) await decline.click().catch(() => {});
    await p.locator('#translator-input').fill('Ich ziehe mich nicht um.'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => location.pathname.includes('ich-ziehe-mich-nicht-um'));
    await p.goBack(); await p.waitForFunction(() => location.pathname === '/de/');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, cases: ['Eingabe zeigt Situationsadresse', 'Zurück zur Startseite'] }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
