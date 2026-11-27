// Kauf-Trichter ohne Einwilligung (27. Nov 2026, Thread „Kauf-Trichter richtig messen“): Welche Schritte an /v1/quiz-count gehen
// und welche Kürzel (Anzeige, Testlauf) in der Stripe-Sitzung landen. Geprüft auf /start/?direkt=1, im Fragebogen-Layer,
// mit Apple Pay und auf /hilfe/. Testläufe (?src=test, Merkzeichen von /intern/) zählen nie und tragen test=true in die Kasse.
// Nur Test-Daten und ein Stripe-Ersatz, keine echten Konten oder Zahlungen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const auth = `const user={uid:'u1',email:null,emailVerified:false,isAnonymous:true,getIdToken:async()=>'tok'};
const auth={currentUser:null};export const getAuth=()=>auth;export const getRedirectResult=async()=>null;
export const signInAnonymously=async a=>{a.currentUser=user;return{user}};
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(a.currentUser),0);return()=>{}};`;
// Stripe-Ersatz: Der Express-Knopf ist wie bei Stripe ein iframe im Platz; confirm lässt sich auslösen.
const stripe = `window.__ece={handlers:{}};
window.Stripe=()=>({initCheckoutElementsSdk:async()=>({loadActions:async()=>({actions:{confirm:async()=>({type:'success'})}}),
createExpressCheckoutElement:o=>({on:(n,f)=>{window.__ece.handlers[n]=f},mount:el=>{const f=document.createElement('iframe');f.title='Apple Pay';el.append(f);
setTimeout(()=>window.__ece.handlers.availablepaymentmethodschange?.({paymentMethods:{applePay:true}}),0)}})})});`;
const server = http.createServer((req, res) => { try {
  let n = new URL(req.url, 'http://localhost').pathname;
  if (n === '/__layer.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><iframe id="q" style="width:390px;height:800px" src="/start/?embed=1&angebot=1&src=layer"></iframe>'); return; }
  if (n.endsWith('/')) n += 'index.html';
  const f = path.resolve(root, '.' + n); if (!f.startsWith(root + path.sep)) throw Error();
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
} catch { res.writeHead(404); res.end(); } });

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, cases = 0;
  const run = async ({ url, applePay = false, internal = false, done = false, viewport = { width: 390, height: 844 } }, check) => {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: true });
    const page = await context.newPage(), counts = [], sessions = [];
    if (applePay) await page.addInitScript(() => { window.ApplePaySession = { canMakePayments: () => true }; });
    if (internal) await page.addInitScript(() => { try { localStorage.setItem('demenzcoach.internal.v1', '1'); } catch {} });
    if (done) await page.addInitScript(() => { try { localStorage.setItem('demenzCoachQuizDone.v1', JSON.stringify({ version: 1, at: Date.now() - 1000, choices: { relation: 'mama' }, tries: [], multi: {} })); } catch {} });
    await context.route('**/*', async route => {
      const req = route.request(), u = new URL(req.url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
      if (u.origin === origin) return route.continue();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (u.pathname.endsWith('/firebase-app.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: 'export const initializeApp=()=>({});' });
      if (u.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: auth });
      if (u.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: stripe });
      if (u.hostname === 'checkout.stripe.com') return route.fulfill({ contentType: 'text/html', body: '<h1>Stripe hosted fixture</h1>' });
      if (u.hostname.endsWith('cloudfunctions.net')) {
        if (u.pathname.endsWith('/quiz-count')) { counts.push(JSON.parse(req.postData()).step); return route.fulfill({ status: 204, headers, body: '' }); }
        if (u.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', hostedFallback: true, walletEmail: true, plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
        if (u.pathname.endsWith('/offer')) return route.fulfill({ headers, json: {} });
        if (u.pathname.endsWith('/session')) { const body = req.postDataJSON(); sessions.push(body); return route.fulfill({ headers, json: body.hostedFallback ? { checkoutMode: 'hosted', url: 'https://checkout.stripe.com/c/pay/cs_fx', trialDays: 7, plan: body.plan, firstYear: null } : { clientSecret: 'cs_fx_secret', trialDays: 7, plan: body.plan, firstYear: null } }); }
        return route.fulfill({ headers, json: {} });
      }
      return route.abort();
    });
    try {
      page.on('pageerror', e => process.env.DBG && console.log('pageerror:', e.message));
      await page.goto(origin + url);
      const decline = page.getByRole('button', { name: 'Ablehnen', exact: true });
      if (await decline.count()) await decline.click();
      await check({ page, counts, sessions });
      cases++;
    } finally { await context.close(); }
  };
  const settle = page => page.waitForTimeout(400);
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });

    // 1) Direkt-Angebot vom Reel: Ansicht, Kaufknopf, E-Mail-Stand, Kasse. Anzeige und Kampagne gehen in die Kasse, kein Testmerkmal.
    await run({ url: '/start/?direkt=1&src=fb&utm_campaign=reel&a=Oma-Bus' }, async ({ page, counts, sessions }) => {
      await page.locator('.start-cta').first().click({ force: true });
      await page.waitForURL(/checkout\.stripe\.com/);
      assert.deepEqual(counts, ['direct', 'direct_cta', 'direct_email', 'direct_kasse']);
      const last = sessions.at(-1);
      assert.equal(last.ad, 'oma-bus');
      assert.equal(last.campaign, 'reel');
      assert.equal(last.test, undefined);
    });

    // 2) Testlauf über die Adresse: nichts gezählt, Kasse trägt test=true.
    await run({ url: '/start/?direkt=1&src=test' }, async ({ page, counts, sessions }) => {
      await page.locator('.start-cta').first().click({ force: true });
      await page.waitForURL(/checkout\.stripe\.com/);
      assert.deepEqual(counts, []);
      assert.equal(sessions.at(-1).test, true);
    });

    // 3) Eigenes Gerät (Merkzeichen von /intern/): nichts gezählt, Kasse trägt test=true.
    await run({ url: '/hilfe/', internal: true }, async ({ page, counts, sessions }) => {
      await page.locator('[data-buy]').first().click();
      await page.waitForURL(/checkout\.stripe\.com/);
      assert.deepEqual(counts, []);
      assert.equal(sessions.at(-1).test, true);
    });

    // 4) /hilfe/: Ansicht, Preis im Bild, Kaufknopf, Kasse (je einmal, auch bei zwei Klicks).
    await run({ url: '/hilfe/?src=fb&utm_campaign=reel&utm_content=pflege-1' }, async ({ page, counts, sessions }) => {
      await settle(page);
      assert.deepEqual(counts, ['lp_view']);
      await page.locator('[data-buy-slot]').first().scrollIntoViewIfNeeded();
      await page.waitForFunction(() => true); await settle(page);
      assert.ok(counts.includes('lp_price'), counts.join());
      await page.locator('[data-buy]').first().click();
      await page.waitForURL(/checkout\.stripe\.com/);
      assert.deepEqual(counts.filter(s => s !== 'lp_price'), ['lp_view', 'lp_cta', 'lp_kasse']);
      assert.equal(sessions.at(-1).source, 'lp_fb');
      assert.equal(sessions.at(-1).ad, 'pflege-1');
      assert.equal(sessions.at(-1).test, undefined);
    });

    // 5) Apple Pay auf dem Direkt-Angebot: Tipp auf Stripes Knopf (iframe bekommt den Fokus) und Bestätigung zählen.
    await run({ url: '/start/?direkt=1', applePay: true }, async ({ page, counts }) => {
      await page.waitForFunction(() => document.querySelector('[data-ap-slot="yearly"] iframe') && !document.querySelector('[data-ap-slot="yearly"]').hidden);
      await page.evaluate(() => document.querySelector('[data-ap-slot="yearly"] iframe').focus());
      await page.evaluate(() => window.__ece.handlers.confirm?.({}));
      await settle(page);
      assert.deepEqual(counts, ['direct', 'direct_applepay', 'direct_applepay_ok']);
    });

    // 6) Fragebogen fertig, Angebot im Layer: Kaufknopf und Kasse zählen als quiz_cta/quiz_kasse (vorher gar nicht).
    await run({ url: '/__layer.html', done: true }, async ({ page, counts }) => {
      const frame = page.frameLocator('#q');
      await frame.locator('.start-cta').first().click({ force: true });
      await settle(page);
      assert.ok(counts.includes('plan'), counts.join());
      assert.deepEqual(counts.filter(s => s.startsWith('quiz_')), ['quiz_cta', 'quiz_kasse']);
      assert.ok(!counts.some(s => s.startsWith('direct')), counts.join());
    });

    console.log(`Kauf-Trichter-Zähler: ${cases} Fälle bestanden`);
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
