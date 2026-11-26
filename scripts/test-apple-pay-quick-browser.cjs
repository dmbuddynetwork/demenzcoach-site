// Apple-Pay-Vorfahrt (nur mit ?ap=1): Auf Geräten mit Apple Pay steht der Express-Knopf auf der Angebotsseite. Ohne ?ap=1 oder ohne
// Apple Pay lädt die Seite weder Stripe.js noch erzeugt sie eine Sitzung. "Weiter" geht immer auf die gehostete Stripe-Seite.
// Nur Test-Daten und ein Stripe-Ersatz, keine echten Konten oder Zahlungen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const auth = `const user={uid:'u1',email:null,emailVerified:false,isAnonymous:true,getIdToken:async()=>'tok'};
const auth={currentUser:null};export const getAuth=()=>auth;export const getRedirectResult=async()=>null;
export const signInAnonymously=async a=>{a.currentUser=user;return{user}};
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(a.currentUser),0);return()=>{}};`;
const stripeFixture = `window.__ece={mounted:[],options:null,handlers:{}};
window.Stripe=()=>({initCheckoutElementsSdk:async()=>({loadActions:async()=>({actions:{confirm:async(a)=>{(window.__ece.confirms=window.__ece.confirms||[]).push(a);return{type:'success'}}}}),
createExpressCheckoutElement:o=>{window.__ece.options=o;return{on:(n,f)=>{window.__ece.handlers[n]=f},mount:el=>{window.__ece.mounted.push(el.id);setTimeout(()=>window.__ece.handlers.availablepaymentmethodschange?.({paymentMethods:window.__ece.apple===false?{}:{applePay:true}}),0)}}}})});`;
const server = http.createServer((req, res) => { try {
  let n = new URL(req.url, 'http://localhost').pathname; if (n.endsWith('/')) n += 'index.html';
  const f = path.resolve(root, '.' + n); if (!f.startsWith(root + path.sep)) throw Error();
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
} catch { res.writeHead(404); res.end(); } });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, cases = 0;
  const run = async ({ query, applePay, eceApple = true }, check) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), sessions = [], stripeScripts = [];
    if (applePay) await page.addInitScript(() => { window.ApplePaySession = { canMakePayments: () => true }; });
    if (!eceApple) await page.addInitScript(() => { window.__eceNoApple = true; });
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
      if (url.origin === origin) return route.continue();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/firebase-app.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: 'export const initializeApp=()=>({});' });
      if (url.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: auth });
      if (url.hostname === 'js.stripe.com') { stripeScripts.push(req.url()); return route.fulfill({ contentType: 'text/javascript', body: (eceApple ? '' : 'window.__ece0=1;') + stripeFixture.replace('window.__ece.apple===false', eceApple ? 'false' : 'true') }); }
      if (url.hostname === 'checkout.stripe.com') return route.fulfill({ contentType: 'text/html', body: '<h1>Stripe hosted fixture</h1>' });
      if (url.hostname.endsWith('cloudfunctions.net')) {
        if (url.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', hostedFallback: true, walletEmail: true, plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
        if (url.pathname.endsWith('/session')) {
          sessions.push(req.postDataJSON());
          return route.fulfill({ headers, json: req.postDataJSON().hostedFallback ? { checkoutMode: 'hosted', url: 'https://checkout.stripe.com/c/pay/cs_fx', trialDays: 7, plan: 'yearly', firstYear: null } : { clientSecret: 'cs_fx_secret', trialDays: 7, plan: 'yearly', firstYear: null } });
        }
        return route.fulfill({ headers, json: {} });
      }
      return route.abort();
    });
    try {
      await page.goto(origin + '/abo/' + query);
      const decline = page.getByRole('button', { name: 'Ablehnen', exact: true });
      if (await decline.count()) await decline.click();
      await page.waitForSelector('#yearly-price:not(:empty)');
      await check({ page, sessions, stripeScripts, origin });
      cases++;
    } finally { await context.close(); }
  };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    // 1) ?ap=1 + Apple Pay: Knopf im Jahresplan, Sitzung mit emailLater, ohne hostedFallback; Planwechsel gibt zweite Sitzung.
    await run({ query: '?ap=1', applePay: true }, async ({ page, sessions, stripeScripts }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('quick-slot-yearly'));
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].plan, 'yearly');
      assert.equal(sessions[0].emailLater, true);
      assert.equal(sessions[0].hostedFallback, undefined, 'Express-Knopf braucht die eingebettete Sitzung');
      assert.equal(stripeScripts.length, 1);
      assert.equal(await page.evaluate(() => window.__ece.options.paymentMethods.applePay), 'always');
      assert.equal(await page.evaluate(() => window.__ece.options.paymentMethods.paypal), 'never');
      // Nach Face ID muss das confirm-Ereignis an Stripe übergeben werden (sonst scheitert die Zahlung).
      await page.evaluate(() => window.__ece.handlers.confirm({ marker: 'ev1' }));
      await page.waitForFunction(() => window.__ece.confirms?.length === 1);
      assert.equal(await page.evaluate(() => window.__ece.confirms[0].expressCheckoutConfirmEvent.marker), 'ev1');
      assert.match(await page.locator('#quick-summary').innerText(), /Inkl\. MwSt\./);
      assert.equal(await page.locator('#quick-pay').isVisible(), true);
      assert.equal(await page.locator('#plan-next').innerText(), 'Mit Karte oder PayPal weiter');
      await page.locator('[data-plan="monthly"]').click();
      await page.waitForFunction(() => window.__ece.mounted.includes('quick-slot-monthly'));
      assert.equal(sessions.length, 2);
      assert.equal(sessions[1].plan, 'monthly');
      assert.equal(await page.locator('#quick-slot-yearly').isHidden(), true);
      await page.locator('[data-plan="yearly"]').click();
      await new Promise(r => setTimeout(r, 700));
      assert.equal(sessions.length, 2, 'bereits angelegte Sitzung wird wiederverwendet');
    });
    // 2) "Weiter" bleibt der normale Weg (E-Mail, dann gehostete Stripe-Seite), auch wenn der Express-Knopf da ist.
    await run({ query: '?ap=1', applePay: true }, async ({ page, sessions }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('quick-slot-yearly'));
      await page.locator('#plan-next').click();
      await page.locator('#email').waitFor({ state: 'visible' });
      await page.locator('#email').fill('fixture@example.invalid');
      await page.locator('#email-next').click();
      await page.waitForURL('https://checkout.stripe.com/**', { timeout: 15000 });
      assert.ok(sessions.some(s => s.hostedFallback === true), 'Weiter fordert die gehostete Seite');
    });
    // 3) Ohne ?ap=1: nichts ändert sich.
    await run({ query: '?alt=1', applePay: true }, async ({ page, sessions, stripeScripts }) => {
      await new Promise(r => setTimeout(r, 900));
      assert.equal(sessions.length, 0);
      assert.equal(stripeScripts.length, 0);
      assert.equal(await page.locator('#quick-pay').isHidden(), true);
      assert.equal(await page.locator('#plan-next').innerText(), 'Weiter');
    });
    // 4) ?ap=1 ohne Apple Pay (Android, Desktop-Chrome): nichts ändert sich.
    await run({ query: '?ap=1', applePay: false }, async ({ page, sessions, stripeScripts }) => {
      await new Promise(r => setTimeout(r, 900));
      assert.equal(sessions.length, 0);
      assert.equal(stripeScripts.length, 0);
      assert.equal(await page.locator('#quick-pay').isHidden(), true);
      assert.equal(await page.locator('#plan-next').innerText(), 'Weiter');
    });
    // 5) Stripe meldet kein Apple Pay: Knopf und Hinweis verschwinden, "Weiter" heißt wieder "Weiter".
    await run({ query: '?ap=1', applePay: true, eceApple: false }, async ({ page }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('quick-slot-yearly'));
      await page.waitForFunction(() => document.querySelector('#quick-pay').hidden);
      assert.equal(await page.locator('#plan-next').innerText(), 'Weiter');
    });
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
