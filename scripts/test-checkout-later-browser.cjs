// „Später weitermachen“ (27. Nov 2026, Hebel K6): Wer die Kasse ohne Kauf schließt, bekommt einmal das Angebot, den Link zum
// Plan per E-Mail zu bekommen. Die Erinnerung am nächsten Tag nur mit eigenem, leerem Häkchen. Ohne reminderMail in /config
// erscheint nichts. Nur Test-Daten, kein echtes Stripe, keine echten Mails.
// SHOTS=<ordner> speichert Bildschirmfotos (Desktop und Handy).
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const shots = process.env.SHOTS || '';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const auth = `const user={uid:'u1',email:null,isAnonymous:true,getIdToken:async()=>'tok'};
const auth={currentUser:user};export const getAuth=()=>auth;export const getRedirectResult=async()=>null;export const signInAnonymously=async()=>({user});
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(a.currentUser),0);return()=>{}};`;
const stripeFixture = `window.Stripe=()=>({createEmbeddedCheckoutPage:async()=>{let f;return{mount:el=>{f=document.createElement('iframe');f.srcdoc='<p>Stripe fixture</p>';f.style.cssText='width:100%;height:400px;border:0';el.append(f)},destroy:()=>f?.remove()}}});`;
const consentText = 'Erinnert mich morgen einmal daran. Danach kommt nichts mehr.';
const server = http.createServer((req, res) => { try {
  let n = new URL(req.url, 'http://localhost').pathname; if (n.endsWith('/')) n += 'index.html';
  const f = path.resolve(root, '.' + n); if (!f.startsWith(root + path.sep)) throw Error();
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
} catch { res.writeHead(404); res.end(); } });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, cases = 0;
  const run = async ({ phone = false, reminder = true }, check) => {
    const context = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: shots ? 2 : 1 }
      : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: shots ? 2 : 1 });
    // Für Bildschirmfotos ohne Cookie-Hinweis dahinter (die Wahl selbst ist hier egal).
    if (shots) await context.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
    const page = await context.newPage(), state = { reminders: [] };
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
      if (url.origin === origin) return route.continue();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/firebase-app.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: 'export const initializeApp=()=>({});' });
      if (url.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ headers, contentType: 'text/javascript', body: auth });
      if (url.hostname === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: stripeFixture });
      if (url.hostname.endsWith('cloudfunctions.net')) {
        if (url.pathname.endsWith('/config')) return route.fulfill({ headers, json: { checkoutMode: 'elements', hostedFallback: true, embedded: true, walletEmail: true,
          plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, textVersions: { terms: 'fx' }, publishableKey: 'pk_test_fx',
          ...(reminder ? { reminderMail: { consentVersion: '2026-11-27', consentText } } : {}) } });
        if (url.pathname.endsWith('/session')) return route.fulfill({ headers, json: { checkoutMode: 'embedded', clientSecret: 'cs_fx_secret', trialDays: 7, plan: 'yearly', firstYear: null } });
        if (url.pathname.endsWith('/reminder')) { state.reminders.push({ body: req.postDataJSON(), auth: req.headers().authorization }); return route.fulfill({ headers, json: { sent: true, reminder: true } }); }
        return route.fulfill({ headers, json: {} });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    try { await check(page, state); cases++; } finally { await context.close(); }
  };
  const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name) }); };
  const closeCheckout = async (page) => {
    await page.goto(origin + '/start/?direkt=1');
    await page.waitForFunction(() => window.DemenzKasse?.open);
    await page.evaluate(() => window.DemenzKasse.open({ plan: 'yearly', source: 'later-test' }));
    await page.locator('dialog.kasse-embed iframe').waitFor({ timeout: 15000 });
    await page.locator('.kasse-embed-close').click();
  };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    // 1) Desktop: × an der Kasse → Angebot. Häkchen leer. Mit Häkchen senden → /reminder mit Einwilligungsfassung.
    await run({}, async (page, state) => {
      await closeCheckout(page);
      const later = page.locator('dialog.dc-later');
      await later.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await page.locator('#dc-later-tick').isChecked(), false, 'Häkchen ist leer');
      assert.match(await later.innerText(), /Später in Ruhe weitermachen\?/u);
      assert.match(await later.innerText(), /Erinnert mich morgen einmal daran/u);
      await shot(page, 'spaeter-desktop.png');
      await page.locator('.dc-later-send').click();
      assert.match(await page.locator('.dc-later-error').innerText(), /gültige E-Mail/u, 'leere Adresse wird abgefangen');
      assert.equal(state.reminders.length, 0);
      await page.fill('#dc-later-email', 'fixture@example.invalid');
      await page.locator('#dc-later-tick').check();
      await shot(page, 'spaeter-desktop-ausgefuellt.png');
      await page.locator('.dc-later-send').click();
      await page.getByText('Gesendet', { exact: true }).waitFor();
      await shot(page, 'spaeter-desktop-gesendet.png');
      assert.equal(state.reminders.length, 1);
      assert.deepEqual(state.reminders[0].body, { email: 'fixture@example.invalid', plan: 'yearly', source: 'later-test', followUp: true, consentVersion: '2026-11-27' });
      assert.equal(state.reminders[0].auth, 'Bearer tok');
      await page.locator('.dc-later-send').click();
      assert.equal(await later.count(), 0, 'Schließen schließt');
      // Nach dem Senden nie wieder.
      await page.evaluate(() => window.DemenzKasse.open({ plan: 'yearly', source: 'later-test' }));
      await page.locator('dialog.kasse-embed iframe').waitFor({ timeout: 15000 });
      await page.locator('.kasse-embed-close').click();
      await page.waitForTimeout(600);
      assert.equal(await page.locator('dialog.dc-later').count(), 0, 'nach dem Senden kein zweites Angebot');
    });
    // 2) Ohne Häkchen: keine Einwilligungsfassung, followUp false. „Nein danke“ sperrt 3 Tage.
    await run({}, async (page, state) => {
      await closeCheckout(page);
      await page.locator('dialog.dc-later').waitFor({ state: 'visible', timeout: 5000 });
      await page.fill('#dc-later-email', 'fixture@example.invalid');
      await page.locator('.dc-later-send').click();
      await page.getByText('Gesendet', { exact: true }).waitFor();
      assert.deepEqual(state.reminders[0].body, { email: 'fixture@example.invalid', plan: 'yearly', source: 'later-test', followUp: false });
    });
    await run({}, async (page) => {
      await closeCheckout(page);
      await page.locator('dialog.dc-later').waitFor({ state: 'visible', timeout: 5000 });
      await page.mouse.click(4, 4); await page.waitForTimeout(200);
      assert.equal(await page.locator('dialog.dc-later').count(), 1, 'Klick daneben schließt nicht');
      await page.locator('.dc-later-no').click();
      assert.equal(await page.locator('dialog.dc-later').count(), 0);
      await page.reload();
      await page.waitForFunction(() => window.DemenzKasse?.open);
      await page.evaluate(() => window.DemenzKasse.open({ plan: 'yearly', source: 'later-test' }));
      await page.locator('dialog.kasse-embed iframe').waitFor({ timeout: 15000 });
      await page.locator('.kasse-embed-close').click();
      await page.waitForTimeout(600);
      assert.equal(await page.locator('dialog.dc-later').count(), 0, '„Nein danke“ sperrt für 3 Tage');
    });
    // 3) Server bietet es nicht an → nichts erscheint.
    await run({ reminder: false }, async (page) => {
      await closeCheckout(page);
      await page.waitForTimeout(800);
      assert.equal(await page.locator('dialog.dc-later').count(), 0);
    });
    // 4) Handy: Stripes Zurück-Link (cancel_url) → /abo/ → /start/?…&zurueck=1 → Angebot, Adresse aufgeräumt.
    await run({ phone: true }, async (page, state) => {
      await page.goto(origin + '/abo/?status=abgebrochen&plan=monthly');
      await page.waitForURL(/\/start\//u);
      const later = page.locator('dialog.dc-later');
      await later.waitFor({ state: 'visible', timeout: 8000 });
      assert.doesNotMatch(page.url(), /zurueck/u, 'zurueck=1 wird aus der Adresse entfernt');
      assert.match(page.url(), /plan=monthly/u);
      await shot(page, 'spaeter-handy.png');
      await page.fill('#dc-later-email', 'fixture@example.invalid');
      await page.locator('.dc-later-send').click();
      await page.getByText('Gesendet', { exact: true }).waitFor();
      await shot(page, 'spaeter-handy-gesendet.png');
      assert.equal(state.reminders[0].body.plan, 'monthly');
      assert.equal(state.reminders[0].body.source, 'stripe_zurueck');
    });
    console.log(`ok - ${cases} Fälle „Später weitermachen“`);
  } finally {
    await browser?.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
