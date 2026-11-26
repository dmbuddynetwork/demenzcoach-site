// Daniel, 26. Nov 2026: Stripes eingebettete Zahlungsseite kommt IMMER im obersten Layer (auch wenn die Kasse im Rahmen des
// Quiz-Layers läuft), nie als Weiterleitung. Klick daneben schließt nicht. Fehler zeigt Meldung mit „Erneut versuchen“.
// Nur Test-Daten, kein echtes Stripe, keine echten Konten oder Zahlungen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const auth = `const user={uid:'u1',email:'fixture@example.invalid',emailVerified:true,isAnonymous:false,getIdToken:async()=>'tok'};
const auth={currentUser:user};export const getAuth=()=>auth;export const getRedirectResult=async()=>null;
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(a.currentUser),0);return()=>{}};`;
const stripeFixture = (failFirst) => `window.__dcCalls=window.__dcCalls||{create:0,secrets:[]};
window.Stripe=(key)=>({createEmbeddedCheckoutPage:async(o)=>{window.__dcCalls.create++;window.__dcCalls.key=key;
if(${failFirst ? 'window.__dcCalls.create===1' : 'false'}) throw new Error('boom');
window.__dcCalls.secrets.push(await o.fetchClientSecret());let f;
return{mount:el=>{f=document.createElement('iframe');f.srcdoc='<p>Stripe embedded fixture</p>';f.style.cssText='width:100%;height:400px;border:0';el.append(f)},destroy:()=>{f?.remove();window.__dcCalls.destroyed=true}}}});`;
const server = http.createServer((req, res) => { try {
  let n = new URL(req.url, 'http://localhost').pathname; if (n.endsWith('/')) n += 'index.html';
  const f = path.resolve(root, '.' + n); if (!f.startsWith(root + path.sep)) throw Error();
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
} catch { res.writeHead(404); res.end(); } });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, cases = 0;
  const run = async ({ failFirst = false }, check) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), state = { sessions: [] };
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
      if (url.origin === origin) return route.continue();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/firebase-app.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: 'export const initializeApp=()=>({});' });
      if (url.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: auth });
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: stripeFixture(failFirst) });
      if (url.hostname === 'checkout.stripe.com') return route.fulfill({ contentType: 'text/html', body: '<h1>Stripe hosted fixture</h1>' });
      if (url.hostname.endsWith('cloudfunctions.net')) {
        if (url.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', hostedFallback: true, embedded: true, walletEmail: true, plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx' } });
        if (url.pathname.endsWith('/session')) {
          const body = req.postDataJSON(); state.sessions.push(body);
          return route.fulfill({ headers, json: body.embedded ? { checkoutMode: 'embedded', clientSecret: 'cs_fx_secret', trialDays: 7, plan: 'yearly', firstYear: null } : { checkoutMode: 'hosted', url: 'https://checkout.stripe.com/c/pay/cs_fx', trialDays: 7, plan: 'yearly', firstYear: null } });
        }
        return route.fulfill({ headers, json: {} });
      }
      return route.abort();
    });
    try { await check(page, state); cases++; } finally { await context.close(); }
  };
  const openIn = async (frame) => frame.evaluate(() => window.DemenzKasse.open({ plan: 'yearly', email: 'fixture@example.invalid', source: 'embedded-test' }));
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    // 1) Direkt auf der Seite: Layer mit Stripes Seite, keine Weiterleitung, Klick daneben schließt nicht, × schließt.
    await run({}, async (page, state) => {
      await page.goto(origin + '/start/?direkt=1');
      await page.waitForFunction(() => window.DemenzKasse?.open);
      await openIn(page);
      const layer = page.locator('dialog.kasse-embed');
      await layer.waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('dialog.kasse-embed iframe').waitFor();
      assert.equal(state.sessions.length >= 1 && state.sessions.at(-1).embedded, true, 'Sitzung wird als eingebettet angefragt');
      assert.equal(await page.evaluate(() => window.__dcCalls.secrets[0]), 'cs_fx_secret');
      assert.equal(await page.evaluate(() => window.__dcCalls.key), 'pk_test_fx');
      assert.match(page.url(), /\/start\//, 'keine Weiterleitung');
      await page.mouse.click(2, 2); await page.waitForTimeout(200);
      assert.equal(await layer.count(), 1, 'Klick daneben schließt nicht');
      await page.locator('.kasse-embed-close').click();
      assert.equal(await layer.count(), 0, '× schließt');
      assert.equal(await page.evaluate(() => window.__dcCalls.destroyed), true);
    });
    // 2) Im Rahmen des Quiz-Layers: der Layer erscheint im OBERSTEN Dokument, der Rahmen wird nicht zu Stripe.
    await run({}, async (page, state) => {
      await page.goto(origin + '/start/?direkt=1');
      await page.evaluate(() => { const f = document.createElement('iframe'); f.id = 'fx-frame'; f.src = '/start/?src=layer&embed=1'; f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9'; document.body.append(f); });
      const frame = await (await page.locator('#fx-frame').elementHandle()).contentFrame();
      await frame.waitForLoadState('load');
      await frame.waitForFunction(() => window.DemenzKasse?.open);
      await openIn(frame);
      await page.locator('dialog.kasse-embed').waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(await page.locator('dialog.kasse-embed').count(), 1, 'Layer im obersten Dokument');
      assert.equal(await frame.locator('dialog.kasse-embed').count(), 0, 'nicht im Rahmen');
      assert.equal(await frame.locator('.kasse').count(), 0, 'Ladehinweis im Rahmen ist weg');
      assert.match(frame.url(), /\/start\//, 'Rahmen wurde nicht weitergeleitet');
      assert.doesNotMatch(page.url(), /stripe\.com/);
    });
    // 3) Stripe lässt sich nicht starten: klare Meldung mit „Erneut versuchen“, danach klappt es.
    await run({ failFirst: true }, async (page) => {
      await page.goto(origin + '/start/?direkt=1');
      await page.waitForFunction(() => window.DemenzKasse?.open);
      await openIn(page);
      const problem = page.locator('.kasse-embed-problem');
      await problem.waitFor({ state: 'visible', timeout: 15000 });
      assert.match(await problem.innerText(), /nicht geladen werden/);
      assert.match(await problem.innerText(), /nichts bezahlt/);
      await problem.getByRole('button', { name: 'Erneut versuchen' }).click();
      await page.locator('dialog.kasse-embed iframe').waitFor({ timeout: 15000 });
      assert.equal(await page.locator('dialog.kasse-embed').count(), 1);
    });
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
