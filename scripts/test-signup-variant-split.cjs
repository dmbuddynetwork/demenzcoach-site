// A/B-Test Anmeldung: 50/50 pro Tab, feste Wahl per Adresse, Automatisierung bekommt immer „standard“.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const key = 'demenzcoach.anmeldungVariante.v1';
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); let cases = 0;
  const run = async ({ random, webdriver, query = '', expect }) => {
    const c = await browser.newContext();
    await c.addInitScript(([r, w]) => { Math.random = () => r; Object.defineProperty(navigator, 'webdriver', { get: () => w }); }, [random, webdriver]);
    await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
    const p = await c.newPage();
    await p.goto(`${preview.origin}/de/${query}`);
    assert.equal(await p.evaluate(k => sessionStorage.getItem(k), key), expect, JSON.stringify({ random, webdriver, query }));
    await c.close(); cases++;
  };
  try {
    await run({ random: 0.2, webdriver: false, expect: 'funnel' });
    await run({ random: 0.8, webdriver: false, expect: 'standard' });
    await run({ random: 0.2, webdriver: true, expect: 'standard' });
    await run({ random: 0.8, webdriver: false, query: '?anmeldung=funnel', expect: 'funnel' });
    await run({ random: 0.2, webdriver: false, query: '?anmeldung=standard', expect: 'standard' });
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
