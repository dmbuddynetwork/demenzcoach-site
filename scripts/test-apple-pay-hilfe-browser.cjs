// Verkaufsseite /hilfe/ mit Apple Pay (Daniel, 26. Nov 2026): Im ersten Preisblock liegt auf Geräten mit Apple Pay der unsichtbare
// Express-Knopf von Stripe über „Für 0,00 € starten“. Ohne Apple Pay lädt die Seite weder Stripe.js noch eine eingebettete Sitzung,
// und jeder Knopf startet die gehostete Stripe-Seite.
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
  const run = async ({ query, applePay, stripeApple = true, email, embedded = false }, check) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: process.env.SHOT ? 2 : 1 });
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
      if (url.hostname === 'checkout.stripe.com') return route.fulfill({ contentType: 'text/html', body: '<h1>Stripe hosted fixture</h1>' });
      if (url.hostname.endsWith('cloudfunctions.net')) {
        if (url.pathname.endsWith('/offer')) return route.fulfill({ headers, json: { kind: 'intro', expiresAt: Date.now() + 900000, token: 'tok_fx', emailBound: false, firstYear: 4999, regular: 6999, currency: 'eur' } });
        if (url.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', ...(embedded ? { embedded: true, form: true } : {}), hostedFallback: true, walletEmail: true, plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, offers: { intro: { firstYear: 4999 } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
        if (url.pathname.endsWith('/session')) { { const body = req.postDataJSON(); if (body.hostedFallback) (sessions.hosted ||= []).push(body); else sessions.push(body); } return route.fulfill({ headers, json: req.postDataJSON().hostedFallback ? { checkoutMode: 'hosted', url: 'https://checkout.stripe.com/c/pay/cs_fx', trialDays: 7, plan: 'yearly', firstYear: null } : { clientSecret: 'cs_fx_secret', trialDays: 7, plan: 'yearly', firstYear: null } }); }
        return route.fulfill({ headers, json: {} });
      }
      return route.abort();
    });
    try {
      await page.goto(origin + '/hilfe/' + query);
      const decline = page.getByRole('button', { name:'Nein, danke', exact: true });
      if (await decline.count()) await decline.click();
      await page.locator('#preis .lp-btn').waitFor();
      await page.evaluate(() => document.querySelector('#preis').scrollIntoView({ block: 'center' }));
      await check({ page, sessions, stripeScripts });
      cases++;
    } finally { await context.close(); }
  };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    // 1) Gerät mit Apple Pay: Express-Knopf unsichtbar über dem Knopf, Willkommenspreis in der Sitzung, Planwechsel gibt zweite Sitzung.
    await run({ query: '?utm_source=meta&utm_campaign=fx', applePay: true, embedded: true }, async ({ page, sessions, stripeScripts }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('lp-ap-yearly'), null, { timeout: 8000 });
      await page.waitForFunction(() => !document.querySelector('#lp-ap-yearly').hidden);
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].plan, 'yearly');
      assert.equal(sessions[0].source, 'lp_meta');
      assert.equal(sessions[0].campaign, 'fx');
      assert.equal(sessions[0].emailLater, true);
      assert.equal(sessions[0].offer?.token, 'tok_fx', 'Willkommenspreis geht mit in die Apple-Pay-Sitzung');
      assert.equal(stripeScripts.length, 1);
      assert.equal(await page.evaluate(() => window.__ece.options.paymentMethods.applePay), 'always');
      assert.equal(await page.locator('.lp-ap-mark').isVisible(), true);
      assert.equal(await page.locator('.lp-ap-alt').isVisible(), true);
      assert.equal(await page.locator('#lp-ap-monthly').count(), 1, 'nur der erste Preisblock bekommt Apple Pay');
      assert.equal(await page.locator('.lp-ap-slot').count(), 2);
      const box = await page.evaluate(() => { const c = document.querySelector('#preis .lp-btn').getBoundingClientRect(), s = document.querySelector('#lp-ap-yearly').getBoundingClientRect();
        return { same: Math.abs(c.top - s.top) < 2 && Math.abs(c.height - s.height) < 2 && Math.abs(c.width - s.width) < 2, opacity: getComputedStyle(document.querySelector('#lp-ap-yearly')).opacity }; });
      assert.deepEqual(box, { same: true, opacity: '0' });
      if (process.env.SHOT) { await page.evaluate(() => window.scrollBy(0, document.querySelector('#preis .lp-plans').getBoundingClientRect().top - 24)); await page.screenshot({ path: process.env.SHOT }); }
      assert.match(await page.locator('#preis .lp-terms').innerText(), /49,99\s€ im ersten Jahr/u);
      await page.locator('#preis [data-plan="monthly"]').click();
      await page.waitForFunction(() => window.__ece.mounted.includes('lp-ap-monthly'));
      await page.waitForFunction(() => !document.querySelector('#lp-ap-monthly').hidden);
      assert.equal(sessions.length, 2);
      assert.equal(sessions[1].plan, 'monthly');
      assert.equal(sessions[1].offer, undefined);
      assert.equal(await page.locator('#lp-ap-yearly').isHidden(), true);
      await page.locator('.lp-ap-alt').click();
      await page.waitForURL('https://checkout.stripe.com/**', { timeout: 15000 });
      assert.ok((sessions.hosted || []).some(x => x.plan === 'monthly' && x.source === 'lp_meta' && x.embedded === undefined && x.form === undefined), 'andere Zahlart am Handy: Stripes eigene Seite für den gewählten Plan, kein Layer');
    });
    // 2) Ohne Apple Pay (z. B. Instagram-Browser): kein Stripe.js, keine eingebettete Sitzung, Knopf → gehostete Seite.
    await run({ query: '', applePay: false }, async ({ page, sessions, stripeScripts }) => {
      await new Promise(r => setTimeout(r, 2200));
      assert.equal(sessions.length, 0); assert.equal(stripeScripts.length, 0);
      assert.equal(await page.locator('#lp-ap-yearly').isHidden(), true);
      assert.equal(await page.locator('.lp-ap-mark').isHidden(), true);
      assert.equal(await page.locator('.lp-ap-alt').isHidden(), true);
      await page.locator('#preis .lp-btn').click();
      await page.waitForURL('https://checkout.stripe.com/**', { timeout: 15000 });
      assert.ok((sessions.hosted || []).some(x => x.plan === 'yearly' && x.offer?.token === 'tok_fx'), 'gehostete Seite mit Willkommenspreis');
    });
    // 3) Stripe meldet kein Apple Pay: Express-Knopf bleibt versteckt, der normale Knopf trägt.
    await run({ query: '', applePay: true, stripeApple: false }, async ({ page }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('lp-ap-yearly'), null, { timeout: 8000 });
      await new Promise(r => setTimeout(r, 300));
      assert.equal(await page.locator('#lp-ap-yearly').isHidden(), true);
      assert.equal(await page.locator('.lp-ap-mark').isHidden(), true);
    });
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
