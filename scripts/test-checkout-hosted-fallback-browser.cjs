// Daniel, 24. Nov 2026: kein eigenes eingebettetes Stripe-Formular. Die Kasse fordert immer die gehostete Seite und geht im
// selben Tab zu Stripe, ohne Stripe.js zu laden; ohne E-Mail liefert Stripe oder Apple Pay sie nach. Nur Test-Daten, keine echten Konten oder Zahlungen.
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
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    for (const withEmail of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage(), sessions = [], stripeScripts = [], popups = [];
      page.on('popup', p => popups.push(p));
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
        if (url.origin === origin) return route.continue();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('/firebase-app.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: 'export const initializeApp=()=>({});' });
        if (url.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: auth });
        if (url.hostname === 'js.stripe.com') { stripeScripts.push(req.url()); return route.abort(); }
        if (url.hostname === 'checkout.stripe.com') return route.fulfill({ contentType: 'text/html', body: '<h1>Stripe hosted fixture</h1>' });
        if (url.hostname.endsWith('cloudfunctions.net')) {
          if (url.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', hostedFallback: true, walletEmail: true, plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
          if (url.pathname.endsWith('/session')) {
            sessions.push({ body: req.postDataJSON() });
            return route.fulfill({ headers, json: req.postDataJSON().hostedFallback ? { checkoutMode: 'hosted', url: 'https://checkout.stripe.com/c/pay/cs_fx', trialDays: 7, plan: 'yearly', firstYear: null } : { clientSecret: 'cs_fx_secret', trialDays: 7, plan: 'yearly', firstYear: null } });
          }
          return route.fulfill({ headers, json: {} });
        }
        return route.abort();
      });
      try {
        await page.goto(origin + '/abo/?plan=yearly');
        const decline = page.getByRole('button', { name: 'Ablehnen', exact: true });
        if (await decline.count()) await decline.click();
        await page.evaluate(async withEmail => { const k = await import('/abo/kasse.js'); const b = document.createElement('button'); b.id = 'fx-open'; b.textContent = 'Plan starten'; b.style.cssText = 'position:fixed;top:8px;left:8px;z-index:5'; b.onclick = () => k.open({ plan: 'yearly', ...(withEmail ? { email: 'fixture@example.invalid' } : {}), source: 'hosted-test' }); document.body.append(b); }, withEmail);
        await page.locator('#fx-open').click();
        await page.waitForURL('https://checkout.stripe.com/**');
        assert.equal(sessions.length, 1);
        assert.equal(sessions[0].body.hostedFallback, true);
        assert.equal(sessions[0].body.emailLater, withEmail ? undefined : true, 'ohne E-Mail: Stripe oder Apple Pay liefert sie');
        assert.equal(sessions[0].body.email, withEmail ? 'fixture@example.invalid' : undefined);
        assert.deepEqual(stripeScripts, [], 'kein eingebettetes Stripe.js');
        assert.equal(popups.length, 0, 'selber Tab, kein Pop-up');
        cases++;
      } finally { await context.close(); }
    }
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
