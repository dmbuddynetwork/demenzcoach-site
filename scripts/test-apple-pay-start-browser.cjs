// Apple Pay vorn auf der Angebotsseite /start/ (Test nur mit ?ap=1). Mit Apple Pay steht der Express-Knopf zwischen Tarifen und
// "Plan anfordern", mit Preis und Laufzeit darüber. Ohne ?ap=1 oder ohne Apple Pay: kein Stripe.js, keine Sitzung.
// Nur Test-Daten und ein Stripe-Ersatz, keine echten Konten oder Zahlungen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const auth = `const user={uid:'u1',email:null,emailVerified:false,isAnonymous:true,getIdToken:async()=>'tok'};
const auth={currentUser:null};export const getAuth=()=>auth;export const getRedirectResult=async()=>null;
export const signInAnonymously=async a=>{a.currentUser=user;return{user}};
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(a.currentUser),0);return()=>{}};`;
const stripe = (apple) => `window.__ece={mounted:[],options:null};
window.Stripe=()=>({initCheckoutElementsSdk:async()=>({loadActions:async()=>({actions:{confirm:async()=>({type:'success'})}}),
createExpressCheckoutElement:o=>{window.__ece.options=o;let h={};return{on:(n,f)=>{h[n]=f},mount:el=>{window.__ece.mounted.push(el.id);setTimeout(()=>h.availablepaymentmethodschange?.({paymentMethods:${apple ? '{applePay:true}' : '{}'}}),0)}}}})});`;
const server = http.createServer((req, res) => { try {
  let n = new URL(req.url, 'http://localhost').pathname; if (n.endsWith('/')) n += 'index.html';
  const f = path.resolve(root, '.' + n); if (!f.startsWith(root + path.sep)) throw Error();
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
} catch { res.writeHead(404); res.end(); } });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, cases = 0;
  const run = async ({ query, applePay, stripeApple = true, email }, check) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), sessions = [], stripeScripts = [];
    if (applePay) await page.addInitScript(() => { window.ApplePaySession = { canMakePayments: () => true }; });
    if (email) await page.addInitScript(e => { try { sessionStorage.setItem('demenzCoachEmail', e); } catch {} }, email);
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
      if (url.origin === origin) return route.continue();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/firebase-app.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: 'export const initializeApp=()=>({});' });
      if (url.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: auth });
      if (url.hostname === 'js.stripe.com') { stripeScripts.push(req.url()); return route.fulfill({ contentType: 'text/javascript', body: stripe(stripeApple) }); }
      if (url.hostname.endsWith('cloudfunctions.net')) {
        if (url.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', hostedFallback: true, walletEmail: true, plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
        if (url.pathname.endsWith('/session')) { sessions.push(req.postDataJSON()); return route.fulfill({ headers, json: { clientSecret: 'cs_fx_secret', trialDays: 7, plan: 'yearly', firstYear: null } }); }
        return route.fulfill({ headers, json: {} });
      }
      return route.abort();
    });
    try {
      await page.goto(origin + '/start/' + query);
      const decline = page.getByRole('button', { name: 'Ablehnen', exact: true });
      if (await decline.count()) await decline.click();
      page.on('console', m => process.env.DBG && console.log('console:', m.text())); page.on('pageerror', e => process.env.DBG && console.log('pageerror:', e.message));
      await page.locator('.start-cta').first().waitFor();
      await check({ page, sessions, stripeScripts });
      cases++;
    } finally { await context.close(); }
  };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    // 1) ?ap=1 + Apple Pay + bekannte E-Mail: Knopf vor "Plan anfordern", Sitzung mit E-Mail, Planwechsel gibt zweite Sitzung.
    await run({ query: '?direkt=1&ap=1', applePay: true, email: 'fixture@example.invalid' }, async ({ page, sessions, stripeScripts }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('start-ap-yearly'));
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].plan, 'yearly');
      assert.equal(sessions[0].email, 'fixture@example.invalid');
      assert.equal(sessions[0].emailLater, undefined);
      assert.equal(sessions[0].hostedFallback, undefined);
      assert.equal(stripeScripts.length, 1);
      assert.equal(await page.evaluate(() => window.__ece.options.paymentMethods.applePay), 'always');
      await page.locator('.start-ap').first().waitFor({ state: 'visible' });
      assert.match(await page.locator('.start-ap .start-fine').first().innerText(), /inkl\. MwSt\./);
      const order = await page.evaluate(() => { const ap = document.querySelector('.start-ap'), cta = document.querySelector('.start-cta'), tiers = document.querySelector('.start-tiers');
        return [tiers.compareDocumentPosition(ap) & Node.DOCUMENT_POSITION_FOLLOWING, ap.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING]; });
      assert.deepEqual(order.map(Boolean), [true, true], 'Reihenfolge: Tarife, Apple Pay, Plan anfordern');
      await page.locator('.start-tier[data-plan="monthly"]').first().click();
      await page.waitForFunction(() => window.__ece.mounted.includes('start-ap-monthly'));
      await page.locator('#start-ap-monthly').waitFor({ state: 'visible' });
      assert.equal(sessions.length, 2);
      assert.equal(sessions[1].plan, 'monthly');
      assert.equal(await page.locator('#start-ap-yearly').isHidden(), true);
    });
    // 2) ?ap=1 + Apple Pay ohne E-Mail: Sitzung mit emailLater (Apple Pay liefert die E-Mail).
    await run({ query: '?direkt=1&ap=1', applePay: true }, async ({ page, sessions }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('start-ap-yearly'));
      assert.equal(sessions[0].emailLater, true);
      assert.equal(sessions[0].email, undefined);
    });
    // 3) Ohne ?ap=1: nichts ändert sich.
    await run({ query: '?direkt=1', applePay: true }, async ({ page, sessions, stripeScripts }) => {
      await new Promise(r => setTimeout(r, 900));
      assert.equal(sessions.length, 0); assert.equal(stripeScripts.length, 0);
      assert.equal(await page.locator('.start-ap').count(), 0);
    });
    // 4) ?ap=1 ohne Apple Pay: nichts ändert sich.
    await run({ query: '?direkt=1&ap=1', applePay: false }, async ({ page, sessions, stripeScripts }) => {
      await new Promise(r => setTimeout(r, 900));
      assert.equal(sessions.length, 0); assert.equal(stripeScripts.length, 0);
      assert.equal(await page.locator('.start-ap').first().isHidden(), true);
    });
    // 5) Stripe meldet kein Apple Pay: der Block bleibt versteckt.
    await run({ query: '?direkt=1&ap=1', applePay: true, stripeApple: false }, async ({ page }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('start-ap-yearly'));
      await new Promise(r => setTimeout(r, 300));
      assert.equal(await page.locator('.start-ap').first().isHidden(), true);
    });
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
