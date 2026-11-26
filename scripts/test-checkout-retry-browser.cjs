// Daniel, 26. Nov 2026: Wenn die Zahlung nicht geladen werden kann, zuerst selbst zweimal erneut versuchen, danach eine klare
// Meldung mit „Erneut versuchen“ und Hilfe-Link. Nur Test-Daten, keine echten Konten oder Zahlungen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const auth = `const user={uid:'u1',email:'fixture@example.invalid',emailVerified:true,isAnonymous:false,getIdToken:async()=>'tok'};
const auth={currentUser:user};export const getAuth=()=>auth;export const getRedirectResult=async()=>null;
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(a.currentUser),0);return()=>{}};`;
const server = http.createServer((req, res) => { try {
  let n = new URL(req.url, 'http://localhost').pathname; if (n.endsWith('/')) n += 'index.html';
  const f = path.resolve(root, '.' + n); if (!f.startsWith(root + path.sep)) throw Error();
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
} catch { res.writeHead(404); res.end(); } });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, cases = 0;
  // mode: Liste der Antworten je /session-Aufruf; danach gilt `after`
  const run = async (plan, after, check) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), state = { calls: 0, plan: [...plan], after };
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
      if (url.origin === origin) return route.continue();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/firebase-app.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: 'export const initializeApp=()=>({});' });
      if (url.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: auth });
      if (url.hostname === 'js.stripe.com') return route.abort();
      if (url.hostname === 'checkout.stripe.com') return route.fulfill({ contentType: 'text/html', body: '<h1>Stripe hosted fixture</h1>' });
      if (url.hostname.endsWith('cloudfunctions.net')) {
        if (url.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', hostedFallback: true, walletEmail: true, plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
        if (url.pathname.endsWith('/session')) {
          state.calls++;
          const step = state.plan.length ? state.plan.shift() : state.after;
          if (step === 'abort') return route.abort('failed');
          if (step === '503') return route.fulfill({ status: 503, headers, json: { message: 'busy' } });
          return route.fulfill({ headers, json: { checkoutMode: 'hosted', url: 'https://checkout.stripe.com/c/pay/cs_fx', trialDays: 7, plan: 'yearly', firstYear: null } });
        }
        return route.fulfill({ headers, json: {} });
      }
      return route.abort();
    });
    try {
      await page.goto(origin + '/abo/?plan=yearly&alt=1');
      const decline = page.getByRole('button', { name: 'Ablehnen', exact: true });
      if (await decline.count()) await decline.click();
      await page.evaluate(async () => { const k = await import('/abo/kasse.js'); const b = document.createElement('button'); b.id = 'fx-open'; b.textContent = 'Plan starten'; b.style.cssText = 'position:fixed;top:8px;left:8px;z-index:5'; b.onclick = () => k.open({ plan: 'yearly', email: 'fixture@example.invalid', source: 'retry-test' }); document.body.append(b); });
      await page.locator('#fx-open').click();
      await check(page, state);
      cases++;
    } finally { await context.close(); }
  };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    // 1) Zwei kurze Störungen: der Kunde merkt nichts, die Kasse wiederholt selbst und leitet zu Stripe.
    await run(['503', 'abort'], 'ok', async (page, state) => {
      await page.waitForURL('https://checkout.stripe.com/**', { timeout: 15000 });
      assert.equal(state.calls, 3, 'zwei automatische Wiederholungen, dann Erfolg');
    });
    // 2) Dauerhafte Störung: klare Meldung, Erneut-versuchen-Knopf, Hilfe-Link, nichts bezahlt. Knopf versucht neu und klappt.
    await run([], 'abort', async (page, state) => {
      const message = page.locator('.kasse .abo-error');
      await message.waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(state.calls, 3, 'genau drei Versuche, dann Meldung');
      const text = await message.innerText();
      assert.match(text, /nicht geladen werden/);
      assert.match(text, /nichts bezahlt/);
      const retry = page.locator('.kasse').getByRole('button', { name: 'Erneut versuchen' });
      assert.equal(await retry.count(), 1);
      await page.mouse.click(2, 2); await page.waitForTimeout(200);
      assert.equal(await page.locator('.kasse').count(), 1, 'Klick neben die Kasse schließt sie nicht');
      if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
      assert.equal(await page.locator('.kasse a.kasse-help[href="/kontakt.html"]').count(), 1, 'Hilfe-Link');
      state.after = 'ok';
      await retry.click();
      await page.waitForURL('https://checkout.stripe.com/**', { timeout: 15000 });
      assert.equal(state.calls, 4);
    });
    // 3) Auch ein dauerhafter Serverfehler (503) endet nach drei Versuchen in der Meldung.
    await run(['503'], '503', async (page, state) => {
      const message = page.locator('.kasse .abo-error');
      await message.waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(state.calls, 3);
    });
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
