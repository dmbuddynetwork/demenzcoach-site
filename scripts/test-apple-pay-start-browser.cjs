// Apple Pay direkt auf der normalen Angebotsseite von /start/ (Daniel 26. Nov 2026: „genau die gleiche Seite, nur dass statt Stripe
// Apple Pay sich direkt öffnet“ + Link „Andere Zahlungsmöglichkeiten“). Auf Geräten mit Apple Pay (oder ?ap=1) liegt der unsichtbare
// Express-Knopf über dem lila Knopf; Link und Hinweistext darunter. Ohne Apple Pay lädt die Seite weder Stripe.js
// noch eine Sitzung. Nur Test-Daten und ein Stripe-Ersatz, keine echten Konten oder Zahlungen.
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
createExpressCheckoutElement:o=>{window.__ece.options=o;let h={};return{on:(n,f)=>{h[n]=f},mount:el=>{window.__ece.mounted.push(el.dataset.apSlot||el.id);setTimeout(()=>h.availablepaymentmethodschange?.({paymentMethods:${apple ? '{applePay:true}' : '{}'}}),0)}}}})});`;
const server = http.createServer((req, res) => { try {
  let n = new URL(req.url, 'http://localhost').pathname; if (n.endsWith('/')) n += 'index.html';
  const f = path.resolve(root, '.' + n); if (!f.startsWith(root + path.sep)) throw Error();
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
} catch { res.writeHead(404); res.end(); } });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, cases = 0;
  const run = async ({ query, applePay, stripeApple = true, email, embedded = false, viewport = { width: 390, height: 844 } }, check) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
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
        if (url.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', ...(embedded ? { embedded: true, form: true } : {}), hostedFallback: true, walletEmail: true, plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
        if (url.pathname.endsWith('/session')) { { const body = req.postDataJSON(); if (body.hostedFallback) (sessions.hosted ||= []).push(body); else sessions.push(body); } return route.fulfill({ headers, json: req.postDataJSON().hostedFallback ? { checkoutMode: 'hosted', url: 'https://checkout.stripe.com/c/pay/cs_fx', trialDays: 7, plan: 'yearly', firstYear: null } : { clientSecret: 'cs_fx_secret', trialDays: 7, plan: 'yearly', firstYear: null } }); }
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
    const slot = (page, key) => page.locator(`.start-ap-wrap >> nth=0`).locator(`[data-ap-slot="${key}"]`);
    // 1) Apple Pay + bekannte E-Mail: gleiche Angebotsseite (Kopf, Titel, Kacheln), Express-Knopf unsichtbar über dem lila Knopf,
    //    Link „Andere Zahlungsmöglichkeiten“ direkt darunter, dann der Hinweistext, Planwechsel gibt zweite Sitzung.
    await run({ query: '?direkt=1', applePay: true, email: 'fixture@example.invalid', embedded: true }, async ({ page, sessions, stripeScripts }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('yearly'));
      await page.waitForFunction(() => !document.querySelector('[data-ap-slot="yearly"]').hidden);
      assert.equal(sessions.length, 1, 'nur der obere Knopf startet sofort eine Sitzung');
      assert.equal(sessions[0].plan, 'yearly');
      assert.equal(sessions[0].email, 'fixture@example.invalid');
      assert.equal(sessions[0].emailLater, undefined);
      assert.equal(sessions[0].hostedFallback, undefined);
      assert.equal(stripeScripts.length, 1);
      assert.equal(await page.evaluate(() => window.__ece.options.paymentMethods.applePay), 'always');
      assert.equal(await page.locator('.start-tp').count(), 0, 'keine eigene Apple-Pay-Vorseite mehr');
      assert.equal(await page.locator('.start-head').count(), 1);
      assert.equal(await page.locator('.start-plan-title').count(), 1);
      assert.equal(await page.locator('.start-tiers').first().locator('.start-tier').count(), 2);
      assert.match(await page.locator('.start-cta').first().innerText(), /freischalten/);
      const order = await page.evaluate(() => { const f = document.querySelector('.start-fine'), w = document.querySelector('.start-ap-wrap'), a = document.querySelector('.start-ap-alt');
        return { fineAfterLink: Boolean(a.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING), altAfterButton: Boolean(w.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) }; });
      assert.deepEqual(order, { fineAfterLink: true, altAfterButton: true });
      assert.match(await page.locator('.start-fine').first().innerText(), /Heute zahlst du 0,00 €.*inkl\. MwSt\./s);
      await page.waitForFunction(() => !document.querySelector('.start-ap-alt').hidden);
      assert.equal(await page.locator('.start-ap-alt').first().innerText(), 'Andere Zahlungsmöglichkeiten');
      const box = await page.evaluate(() => { const c = document.querySelector('.start-ap-wrap .start-cta').getBoundingClientRect(), s = document.querySelector('[data-ap-slot="yearly"]').getBoundingClientRect();
        return { same: Math.abs(c.top - s.top) < 2 && Math.abs(c.height - s.height) < 2 && Math.abs(c.width - s.width) < 2, opacity: getComputedStyle(document.querySelector('[data-ap-slot="yearly"]')).opacity }; });
      assert.deepEqual(box, { same: true, opacity: '0' });
      await page.locator('.start-tier[data-plan="monthly"]').first().click();
      await page.waitForFunction(() => window.__ece.mounted.includes('monthly'));
      await page.waitForFunction(() => !document.querySelector('[data-ap-slot="monthly"]').hidden);
      assert.equal(sessions.filter(x => x.plan === 'monthly').length, 1);
      assert.equal(await slot(page, 'yearly').isHidden(), true);
      await page.locator('.start-ap-alt').first().click();
      await page.waitForURL('https://checkout.stripe.com/**', { timeout: 15000 });
      assert.ok((sessions.hosted || []).some(x => x.hostedFallback === true && x.plan === 'monthly' && x.embedded === undefined && x.form === undefined), 'andere Zahlart am Handy: Stripes eigene Seite für den gewählten Plan');
    });
    // 2) Apple Pay ohne E-Mail: Sitzung mit emailLater (Apple Pay liefert die E-Mail).
    await run({ query: '?direkt=1', applePay: true }, async ({ page, sessions }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('yearly'));
      assert.equal(sessions[0].emailLater, true);
      assert.equal(sessions[0].email, undefined);
    });
    // 3) Der untere Knopf bekommt seine Sitzung erst beim Scrollen.
    await run({ query: '?direkt=1', applePay: true }, async ({ page, sessions }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('yearly'));
      await page.locator('.start-ap-wrap').last().scrollIntoViewIfNeeded();
      await page.waitForFunction(() => window.__ece.mounted.filter(x => x === 'yearly').length === 2);
      assert.ok(sessions.length <= 2, 'höchstens eine Sitzung je Knopf');
    });
    // 3b) ?ap=0 und Geräte ohne Apple Pay: normale Seite ohne Stripe.js, ohne Sitzung, ohne Link.
    for (const [query, applePay] of [['?direkt=1&ap=0', true], ['?direkt=1', false]]) {
      await run({ query, applePay }, async ({ page, sessions, stripeScripts }) => {
        await new Promise(r => setTimeout(r, 900));
        assert.equal(sessions.length, 0); assert.equal(stripeScripts.length, 0);
        assert.equal(await page.locator('.start-ap-wrap').count(), 0);
        assert.equal(await page.locator('.start-ap-alt').count(), 0);
      });
    }
    // 3c) iPhone SE, normal, Pro Max: Kacheln, Rechtstext und Knopf ohne Scrollen sichtbar.
    for (const viewport of [{ width: 375, height: 548 }, { width: 393, height: 659 }, { width: 430, height: 739 }]) {
      await run({ query: '?direkt=1', applePay: true, viewport }, async ({ page }) => {
        await page.evaluate(() => window.scrollTo(0, 0));
        const fit = await page.evaluate(() => ({ tiers: document.querySelector('.start-tiers').getBoundingClientRect().top >= 0, cta: document.querySelector('.start-ap-wrap').getBoundingClientRect().bottom, h: innerHeight }));
        assert.ok(fit.tiers, `Kacheln sichtbar bei ${viewport.width}x${viewport.height}`);
        if (viewport.height >= 650) assert.ok(fit.cta <= fit.h, `Knopf sichtbar bei ${viewport.width}x${viewport.height}: ${fit.cta} > ${fit.h}`);
      });
    }
    // 4) ?ap=1 ohne Apple Pay: Knopf-Hülle da, aber ohne Stripe.js und Sitzung; der lila Knopf trägt, kein Link.
    await run({ query: '?direkt=1&ap=1', applePay: false }, async ({ page, sessions, stripeScripts }) => {
      await new Promise(r => setTimeout(r, 900));
      assert.equal(sessions.length, 0); assert.equal(stripeScripts.length, 0);
      assert.equal(await slot(page, 'yearly').isHidden(), true);
      assert.equal(await page.locator('.start-ap-wrap .start-cta').first().isVisible(), true);
      assert.equal(await page.locator('.start-ap-alt').first().isHidden(), true);
    });
    // 5) Stripe meldet kein Apple Pay: Express-Knopf bleibt versteckt, der normale Knopf trägt.
    await run({ query: '?direkt=1', applePay: true, stripeApple: false }, async ({ page }) => {
      await page.waitForFunction(() => window.__ece?.mounted.includes('yearly'));
      await new Promise(r => setTimeout(r, 300));
      assert.equal(await slot(page, 'yearly').isHidden(), true);
      assert.equal(await page.locator('.start-ap-alt').first().isHidden(), true);
    });
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
