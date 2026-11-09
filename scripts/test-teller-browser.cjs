// Local browser verification. Every external service is stubbed; never creates a real account/payment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
let origin;
const config = { plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7,
  publishableKey: 'pk_test_fixture', textVersions: { terms: 'fixture' } };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const authStub = `const user = { email:'fixture@example.invalid', isAnonymous:true, getIdToken:async()=> 'fixture' };
export const getAuth=()=>({currentUser:user}); export const onAuthStateChanged=(auth,cb)=>{setTimeout(()=>cb(user),0);return ()=>{}};
export const getRedirectResult=async()=>null; export const signInAnonymously=async()=>({user});`;
(async () => {
  const { default: worker } = await import(pathToFileURL(path.join(root, 'cloudflare-worker.js')));
  const asset = async value => {
    const pathname = decodeURIComponent(new URL(value).pathname);
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('', { status: 404 });
    return new Response(fs.readFileSync(file), { headers: { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' } });
  };
  const server = require('node:http').createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const direct = await asset(url);
      const response = direct.ok && !['/','/index.html','/teller','/teller/','/teller/index.html'].includes(url.pathname)
        ? direct : await worker.fetch(new Request(url, { method: req.method, headers: req.headers }), { ASSETS: { fetch: asset } });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const screenshotDir = process.env.SCREENSHOT_DIR;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
    const bodies = [], errors = [];
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === origin) return route.continue();
      if (url.pathname.endsWith('/firebase-app.js')) return route.fulfill({ contentType: 'text/javascript', body: 'export const initializeApp=()=>({});', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (url.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ contentType: 'text/javascript', body: authStub, headers: { 'Access-Control-Allow-Origin': '*' } });
      if (url.hostname.endsWith('cloudfunctions.net')) {
        if (url.pathname.endsWith('/config')) return route.fulfill({ json: config, headers: { 'Access-Control-Allow-Origin': '*' } });
        if (url.pathname.endsWith('/session')) {
          bodies.push(req.postDataJSON());
          return route.fulfill({ json: { clientSecret: 'fixture', trialDays: 7 }, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        return route.fulfill({ json: {}, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (url.hostname === 'www.googletagmanager.com') return route.fulfill({ contentType: 'text/javascript', body: '' });
      return route.abort();
    });
    await context.addInitScript(() => {
      window.Stripe = () => ({ initCheckoutElementsSdk: async () => ({
        createExpressCheckoutElement: () => ({ on() {}, mount() {} }),
        createPaymentElement: () => ({ mount() {} }),
        loadActions: async () => ({ confirm: async () => { throw Error('No payments in this test'); } })
      }) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => { if (r.url().startsWith(origin)) console.error('Local request failed:', r.url(), r.failure()); });
    const eventNames = () => page.evaluate(() => (window.dataLayer || []).filter(e => e[0] === 'event').map(e => e[1]));
    await page.goto(origin + '/teller?text=synthetic-secret&utm_source=synthetic-secret', { waitUntil: 'domcontentloaded' });
    assert.match(new URL(page.url()).pathname, /^\/(de|start)\/$/);
    assert.equal(new URL(page.url()).search, '');
    assert.equal(await page.evaluate(() => localStorage.getItem('demenzcoach.teller.v1')), null);
    assert.equal((await context.cookies()).some(c => c.name === 'dc_teller_v1'), false);
    assert.equal((await eventNames()).length, 0);
    await page.locator('.consent-decline').click();
    assert.equal(await page.evaluate(() => Object.keys(DemenzTeller.attribution()).length), 0);
    // Fix both arms explicitly as synthetic inputs; the randomized Worker is tested separately.
    for (const arm of ['website', 'funnel']) {
      await page.evaluate(() => localStorage.clear()); await context.clearCookies();
      await page.goto(origin + (arm === 'website' ? '/de/' : '/start/') + '?teller=' + arm);
      await page.locator('.consent-accept').click();
      await page.evaluate(() => DemenzTeller.ready);
      assert.ok((await eventNames()).includes(`teller_${arm}_assigned`));
      assert.equal(await page.evaluate(() => DemenzTeller.attribution().source), 'teller_' + arm);
      for (const entry of ['/teller','/teller/','/teller/index.html']) {
        await page.goto(origin + entry);
        assert.equal(new URL(page.url()).pathname, arm === 'website' ? '/de/' : '/start/');
        assert.equal(new URL(page.url()).search, '');
      }
      if (screenshotDir) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({ path: path.join(screenshotDir, `teller-${arm}-desktop.png`), fullPage: false });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: path.join(screenshotDir, `teller-${arm}-mobile.png`), fullPage: false });
        await page.setViewportSize({ width: 1280, height: 1000 });
      }
      // Website arm attribution survives entering the existing funnel with no experiment URL.
      await page.goto(origin + '/start/');
      await page.locator('.start-pic, .start-option').first().click();
      await page.waitForFunction(() => document.body.dataset.screen === 'name');
      await page.waitForFunction(name => (window.dataLayer || []).some(e => e[0] === 'event' && e[1] === name), `teller_${arm}_first_answer`);
      for (let i=0; i<30; i++) {
        const screen = await page.locator('body').getAttribute('data-screen');
        if (screen === 'result') break;
        if (screen === 'building') { await page.waitForFunction(() => document.body.dataset.screen !== 'building'); continue; }
        if (screen === 'email') { await page.locator('#email').fill('fixture@example.invalid'); }
        if (screen === 'newsletter') await page.getByRole('button', { name: 'Kein Interesse', exact: true }).click();
        else if (await page.locator('.start-option:not(.start-multi)').count()) await page.locator('.start-option:not(.start-multi)').first().click();
        else await page.locator('#screen .abo-button').first().click();
        await page.waitForFunction(previous => document.body.dataset.screen !== previous, screen);
      }
      assert.equal(await page.locator('body').getAttribute('data-screen'), 'result');
      await page.waitForFunction(name => (window.dataLayer || []).some(e => e[0] === 'event' && e[1] === name), `teller_${arm}_complete`);
      // Exercise actual embedded checkout request builder with synthetic auth and payment SDK.
      await page.evaluate(() => DemenzKasse.open({ plan:'yearly',email:'fixture@example.invalid',source:'quiz_home',campaign:'original' }));
      await page.waitForFunction(() => document.querySelector('.kasse button.abo-button')?.disabled === false);
      assert.equal(bodies.at(-1).source, 'teller_' + arm); assert.equal(bodies.at(-1).campaign, 'teller_v1');
      assert.equal(bodies.at(-1).variant, arm === 'website' ? 'a' : 'b');
      await page.goto(origin + '/abo/');
      await page.locator('#plan-next').click();
      await page.waitForFunction(() => document.querySelector('#pay-button')?.disabled === false);
      assert.equal(bodies.at(-1).source, 'teller_' + arm); assert.equal(bodies.at(-1).variant, arm === 'website' ? 'a' : 'b');
      await page.locator('.consent-settings').click(); await page.locator('.consent-decline').click();
      assert.equal(await page.evaluate(() => localStorage.getItem('demenzcoach.teller.v1')), null);
      assert.equal((await context.cookies()).some(c => c.name === 'dc_teller_v1'), false);
      await page.goto(origin + '/abo/'); await page.locator('#plan-next').click();
      await page.waitForFunction(() => document.querySelector('#pay-button')?.disabled === false);
      assert.equal(bodies.at(-1).variant, undefined); assert.notEqual(bodies.at(-1).campaign, 'teller_v1');
      assert.equal(JSON.stringify(await page.evaluate(() => window.dataLayer || [])).includes('fixture@example.invalid'), false);
    }
    // Real Web Locks coordinate two already-open tabs, including simultaneous answers.
    await page.evaluate(() => localStorage.clear()); await context.clearCookies();
    await page.goto(origin + '/start/?teller=funnel');
    await page.locator('.consent-accept').click(); await page.evaluate(() => DemenzTeller.ready);
    const second = await context.newPage(); second.on('pageerror', e => errors.push(e.message));
    await second.goto(origin + '/start/'); await second.evaluate(() => DemenzTeller.ready);
    await Promise.all([page.locator('.start-pic').first().click(), second.locator('.start-pic').first().click()]);
    await Promise.all([page.waitForFunction(() => document.body.dataset.screen === 'name'), second.waitForFunction(() => document.body.dataset.screen === 'name')]);
    await Promise.all([page.evaluate(() => DemenzTeller.stage('complete')), second.evaluate(() => DemenzTeller.stage('complete'))]);
    const both = [...await eventNames(), ...await second.evaluate(() => (window.dataLayer || []).filter(e => e[0] === 'event').map(e => e[1]))];
    for (const milestone of ['assigned','first_answer','complete']) assert.equal(both.filter(n => n === 'teller_funnel_' + milestone).length, 1);
    // Key removal AND whole-storage clearing must invalidate a prior in-memory grant.
    await context.addCookies([{ name:'_ga',value:'fixture',url:origin }]);
    await second.evaluate(() => localStorage.removeItem('demenzcoach.analyticsConsent.v1'));
    await page.waitForFunction(() => !DemenzConsent.statistics() && localStorage.getItem('demenzcoach.teller.v1') === null);
    assert.equal(await page.evaluate(() => Object.keys(DemenzTeller.attribution()).length), 0);
    assert.equal(await page.evaluate(() => window['ga-disable-G-5NRN1EMJDC']), true);
    assert.equal(await page.evaluate(() => [...dataLayer].reverse().find(e => e[0] === 'consent' && e[1] === 'update')[2].analytics_storage), 'denied');
    assert.equal((await context.cookies()).some(c => c.name.startsWith('_ga')), false);
    assert.equal((await context.cookies()).some(c => c.name === 'dc_teller_v1'), false);
    await page.goto(origin + '/start/?teller=funnel'); await page.locator('.consent-accept').click(); await page.evaluate(() => DemenzTeller.ready);
    await second.evaluate(() => localStorage.clear());
    await page.waitForFunction(() => !DemenzConsent.statistics() && localStorage.getItem('demenzcoach.teller.v1') === null);
    assert.equal(await page.evaluate(() => window['ga-disable-G-5NRN1EMJDC']), true);
    assert.equal(await page.evaluate(() => [...dataLayer].reverse().find(e => e[0] === 'consent' && e[1] === 'update')[2].analytics_storage), 'denied');
    assert.equal((await context.cookies()).some(c => c.name === 'dc_teller_v1'), false);
    // A genuinely new grant from another tab updates GA, without resurrecting the cleared experiment.
    await second.evaluate(() => localStorage.setItem('demenzcoach.analyticsConsent.v1', 'granted'));
    await page.waitForFunction(() => DemenzConsent.statistics() && window['ga-disable-G-5NRN1EMJDC'] === false);
    assert.equal(await page.evaluate(() => [...dataLayer].reverse().find(e => e[0] === 'consent' && e[1] === 'update')[2].analytics_storage), 'granted');
    assert.equal(await page.evaluate(() => localStorage.getItem('demenzcoach.teller.v1')), null);
    await second.evaluate(() => localStorage.clear());
    await page.waitForFunction(() => !DemenzConsent.statistics() && window['ga-disable-G-5NRN1EMJDC'] === true);
    await second.close();
    // Existing localized banners stay unchanged outside the experiment.
    await page.goto(origin + '/fr/');
    assert.equal(await page.locator('.consent-banner').innerText().then(t => /With your statistics consent|Avec votre accord pour les statistiques/.test(t)), false);
    await page.goto(origin + '/fr/?teller=website');
    assert.equal(await page.locator('.consent-banner').innerText().then(t => t.includes('Avec votre accord pour les statistiques')), true);
    assert.equal(await page.locator('.consent-banner').innerText().then(t => t.includes('With your statistics consent')), false);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Teller browser checks passed: entry, both arms, repeat visits, first answer/completion, both checkout request paths, revocation, mobile, concurrent tabs, consent key/storage deletion with GA withdrawal/disable/cookie cleanup, localized notice. All services stubbed; no live account or payment.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
