// Es gibt nur noch eine Preisseite: die BetterMe-optimierte Angebotsseite /start/. Die alte Planwahl unter /abo/ leitet dorthin um,
// außer bei der Rückkehr von Stripe (status=fertig, session_id), beim Weg "weiter" und mit ?alt=1 / ?ap=1. Nur Test-Daten.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { try {
  let n = new URL(req.url, 'http://localhost').pathname; if (n.endsWith('/')) n += 'index.html';
  const f = path.resolve(root, '.' + n); if (!f.startsWith(root + path.sep)) throw Error();
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
} catch { res.writeHead(404); res.end(); } });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, cases = 0;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const visit = async (url) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
      const page = await context.newPage();
      await context.route('**/*', route => {
        const u = new URL(route.request().url());
        if (u.origin === origin) return route.continue();
        if (u.hostname.endsWith('cloudfunctions.net') && u.pathname.endsWith('/config')) return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { checkoutMode: 'elements', hostedFallback: true, plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
        return route.abort();
      });
      try {
        await page.goto(origin + url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(700);
        const u = new URL(page.url());
        return { path: u.pathname, search: u.searchParams, page, context };
      } catch (e) { await context.close(); throw e; }
    };
    const check = async (url, expectPath, expectQuery) => {
      const r = await visit(url);
      try {
        assert.equal(r.path, expectPath, `${url} -> ${r.path}`);
        for (const [k, v] of Object.entries(expectQuery || {})) assert.equal(r.search.get(k), v, `${url}: ${k}`);
        cases++;
      } finally { await r.context.close(); }
    };
    await check('/abo/', '/start/', { direkt: '1' });
    await check('/abo/?src=web_translator', '/start/', { direkt: '1', src: 'web_translator' });
    await check('/abo/?src=tip_membership&c=mama_nov26', '/start/', { direkt: '1', src: 'tip_membership', utm_campaign: 'mama_nov26' });
    await check('/abo/?status=abgebrochen&plan=monthly', '/start/', { direkt: '1', plan: 'monthly' });
    await check('/abo/index.html?src=x', '/start/', { direkt: '1', src: 'x' });
    // Ausnahmen bleiben auf /abo/
    await check('/abo/?status=fertig&session_id=cs_fx', '/abo/', { status: 'fertig' });
    await check('/abo/?weiter=1&plan=yearly&src=quiz_ads', '/abo/', { weiter: '1' });
    await check('/abo/?alt=1', '/abo/', { alt: '1' });
    await check('/abo/?ap=1', '/abo/', { ap: '1' });
    // /start/ nimmt plan=monthly als Vorauswahl
    const r = await visit('/abo/?plan=monthly');
    try {
      await r.page.locator('.start-tier[aria-checked="true"]').first().waitFor({ timeout: 8000 });
      assert.equal(await r.page.locator('.start-tier[aria-checked="true"]').first().getAttribute('data-plan'), 'monthly');
      cases++;
    } finally { await r.context.close(); }
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
