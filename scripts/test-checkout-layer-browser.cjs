// Die Kasse ist eine Ebene auf derselben Seite, nie ein Pop-up-Fenster. Nur Test-Daten, keine echten Konten oder Zahlungen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const shotDir = process.env.CHECKOUT_LAYER_SHOTS || '';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const auth = `const user={uid:'u1',email:'fixture@example.invalid',emailVerified:true,isAnonymous:false,getIdToken:async()=>'tok'};
const auth={currentUser:user};export const getAuth=()=>auth;export const getRedirectResult=async()=>null;
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(a.currentUser),0);return()=>{}};`;
// Minimaler Stripe-Ersatz: zeichnet Express-Knopf und Zahlungsfeld wie die echte Bibliothek in die Ebene.
const fakeStripe = `window.Stripe=()=>({initCheckoutElementsSdk:async(o)=>{window.__init=o;return{
 createExpressCheckoutElement:()=>({on(){},mount(n){n.innerHTML='<div class="fx-express" style="height:44px;background:#000;color:#fff;border-radius:8px;text-align:center;line-height:44px">Apple Pay</div>';}}),
 createPaymentElement:()=>{let ready;return{on(e,f){if(e==='ready')ready=f;},mount(n){n.innerHTML='<div class="fx-pay" style="border:1px solid #ccc;border-radius:10px;padding:14px">Karte · Kartennummer · MM/JJ · CVC</div>';setTimeout(()=>ready&&ready(),30);}};},
 confirm:async()=>({type:'success'}),loadActions:async()=>null}}});`;
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
    for (const view of [{ name: 'desktop', viewport: { width: 1280, height: 900 } }, { name: 'handy', viewport: { width: 390, height: 844 }, mobile: true }]) {
      for (const plan of ['yearly', 'monthly']) {
        const context = await browser.newContext({ viewport: view.viewport, isMobile: !!view.mobile, hasTouch: !!view.mobile, deviceScaleFactor: 2 });
        const page = await context.newPage(), sessions = [], popups = [], errors = [];
        page.on('popup', p => popups.push(p)); page.on('pageerror', e => errors.push(e.message));
        await context.route('**/*', async route => {
          const req = route.request(), url = new URL(req.url());
          const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
          if (url.origin === origin) return route.continue();
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          if (url.pathname.endsWith('/firebase-app.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: 'export const initializeApp=()=>({});' });
          if (url.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: auth });
          if (url.hostname === 'js.stripe.com') return route.fulfill({ headers, contentType: 'text/javascript', body: fakeStripe });
          if (url.hostname === 'checkout.stripe.com') throw new Error('Hosted Checkout darf nicht geöffnet werden');
          if (url.hostname.endsWith('cloudfunctions.net')) {
            if (url.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
            if (url.pathname.endsWith('/session')) { sessions.push({ body: req.postDataJSON(), token: req.headers().authorization }); return route.fulfill({ headers, json: { clientSecret: 'cs_fx_secret', trialDays: 7, plan, firstYear: null } }); }
            if (url.pathname.endsWith('/entitlement')) return route.fulfill({ headers, json: { active: false } });
            return route.fulfill({ headers, json: {} });
          }
          return route.abort();
        });
        try {
          await page.goto(origin + '/abo/?plan=' + plan);
          const decline = page.getByRole('button', { name: 'Ablehnen', exact: true });
          if (await decline.count()) await decline.click();
          // Echter Klick, wie auf der Angebotsseite: die Kasse öffnet sich aus einem Nutzerklick.
          await page.evaluate(async plan => { const k = await import('/abo/kasse.js'); const b = document.createElement('button'); b.id = 'fx-open'; b.textContent = 'Plan starten'; b.style.cssText = 'position:fixed;top:8px;left:8px;z-index:5'; b.onclick = () => k.open({ plan, email: 'fixture@example.invalid', source: 'layer-test' }); document.body.append(b); }, plan);
          await page.locator('#fx-open').click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor();
          await page.getByRole('button', { name: 'Zahlungspflichtig abonnieren', exact: true }).waitFor();
          assert.equal(popups.length, 0, 'kein Pop-up-Fenster');
          assert.equal(context.pages().length, 1, 'keine zweite Seite');
          assert.equal(new URL(page.url()).origin, origin, 'Seite bleibt, wo sie ist');
          assert.equal(sessions.length, 1);
          assert.equal(sessions[0].body.plan, plan);
          assert.equal(sessions[0].body.checkoutMode, undefined, 'Ebene fordert nie Hosted Checkout');
          assert.match(await dialog.innerText(), /Heute 0,00 €/);
          const box = await dialog.locator('.kasse-card').boundingBox();
          if (view.mobile) { assert.ok(Math.abs(box.y + box.height - view.viewport.height) < 2, 'Handy: Ebene sitzt unten'); assert.ok(box.width >= view.viewport.width - 2); }
          else { assert.ok(box.y > 0 && box.y + box.height < view.viewport.height, 'Desktop: Ebene steht mittig über der Seite'); assert.ok(box.width <= 561); }
          if (shotDir) await page.screenshot({ path: path.join(shotDir, `kasse-${view.name}-${plan}.png`) });
          await page.getByRole('button', { name: 'Schließen', exact: true }).click();
          assert.equal(await page.getByRole('dialog').count(), 0, 'Schließen entfernt die Ebene');
          assert.deepEqual(errors, []); cases++;
        } finally { await context.close(); }
      }
    }
    console.log(JSON.stringify({ ok: true, cases, popups: 0 }));
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
