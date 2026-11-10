// Local-only contracts: complete free help -> contextual offer -> existing contact/checkout.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.SITE_URL || 'http://127.0.0.1:8919';
const out = process.env.DIRECT_SCREENSHOTS;
let browser;
const source = fs.readFileSync(path.join(root, 'start/situation-context.js'), 'utf8');
const dictionary = { window: {}, document: { documentElement: { lang: 'en' } } };
vm.runInNewContext(source, dictionary);
const resolve = dictionary.window.DemenzSituationContext.resolve;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); if (out) fs.mkdirSync(out, { recursive: true }); });
after(async () => { await browser?.close(); });
async function setup(saved, intro = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const calls = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (intro && url.pathname.endsWith('/config')) return route.fulfill({ json: { plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, offers: { intro: { firstYear: 4999 } } } });
    if (url.pathname.endsWith('/offer')) {
      calls.push(route.request().postDataJSON());
      return route.fulfill({ json: { kind: 'intro', firstYear: 4999, regular: 6999, token: 'synthetic_signed_offer', expiresAt: Date.now() + 3600000 } });
    }
    if (url.origin !== new URL(base).origin) return route.abort();
    if (url.pathname === '/abo/konto.js') return route.fulfill({ contentType: 'text/javascript', body: 'export async function subscriberState() { return "active"; }' });
    if (url.pathname === '/abo/kasse.js') return route.fulfill({ contentType: 'text/javascript', body: `let opened = false; window.DemenzKasse = { open(o) { opened = true; window.checkoutCapture = { email:o.email, plan:o.plan, source:o.source, offer:o.offer }; window.closeTestCheckout = () => { opened = false; o.onClose(); }; }, isOpen() { return opened; }, close() { opened = false; } };` });
    return route.continue();
  });
  await context.addInitScript(value => {
    if (sessionStorage.getItem('directTestSeed')) return;
    if (value) localStorage.setItem('demenzCoachPlan', JSON.stringify(value));
    sessionStorage.setItem('demenzCoachQuizProgress.v1', '{"stale":"keep"}');
    sessionStorage.setItem('directTestSeed', 'yes');
  }, saved);
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  return { context, page, calls, errors };
}
async function decline(page) { if (await page.locator('.consent-decline').isVisible()) await page.locator('.consent-decline').click(); }
async function fits(page) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow'); }
async function capture(page, file) { if (out) { await page.screenshot({ path: path.join(out, file + '.png') }); } }

test('public key map excludes safety and arbitrary input; aliases retain the correct topic', () => {
  const html = fs.readFileSync(path.join(root, 'de/index.html'), 'utf8');
  const data = JSON.parse(html.match(/<script[^>]+id="translator-data"[^>]*>([\s\S]*?)<\/script>/u)[1]);
  for (const entry of data.entries) {
    const found = resolve(entry.key);
    if (entry.safetyOnly || entry.selfCare) assert.equal(found, null);
    else { assert.equal(found.title, entry.says); assert.ok(found.href.startsWith('/de/')); }
  }
  for (const key of ['__proto__', 'constructor', '<script>', 'https://evil.invalid', 'unknown']) assert.equal(resolve(key), null);
  assert.equal(resolve('wiederholt').key, 'uhrzeit');
});

test('all 40 existing situation and six specific guide links become direct; source HTML stays unchanged', async () => {
  const files = [];
  for (const folder of ['de/ratgeber', 'de/demenz-uebersetzer']) for (const file of fs.readdirSync(path.join(root, folder))) {
    if (!file.endsWith('.html')) continue;
    const rel = `${folder}/${file}`;
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    if (/href="\/start\/\?src=situation/u.test(html) || /href="\/start\/\?src=ratgeber[^"\n]*m=/u.test(html)) files.push(rel);
  }
  assert.equal(files.length, 46);
  const { context, page, errors } = await setup();
  try {
    for (const file of files) {
      assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), execFileSync('git', ['show', `73d35da:${file}`], { cwd: root, encoding: 'utf8' }));
      await page.goto(`${base}/${file}`);
      const link = page.locator('a[data-direct-situation]').first(); await link.waitFor();
      const url = new URL(await link.getAttribute('href'), base);
      assert.equal(url.pathname, '/start/'); assert.equal(url.searchParams.get('direkt'), '1');
      assert.ok(resolve(url.searchParams.get('s'))); assert.ok(['situation', 'ratgeber'].includes(url.searchParams.get('src')));
      assert.equal(await link.innerText(), 'Persönliche Hilfe ansehen');
    }
    await page.goto(`${base}/de/ratgeber/demenz-kommunikation.html`);
    assert.equal(await page.locator('a[data-direct-situation]').count(), 0, 'General guide keeps the general entry');
    await page.goto(`${base}/en/`);
    assert.equal(await page.locator('script[src="/start/situation-context.js"]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const key of ['waschen', 'hunger']) test(`direct ${key} preserves prior answers, requires email and returns to the same topic`, async () => {
  const previous = { name: 'Papa', relation: 'papa', situation: 'mutter', dayTime: 'abends', helperNote: 'synthetic_keep' };
  const { context, page, calls, errors } = await setup(previous);
  try {
    await page.goto(`${base}/start/?direkt=1&src=situation&s=${key}`);
    await page.locator('body[data-screen="plan"]').waitFor(); await decline(page);
    assert.ok((await page.locator('#screen h1').innerText()).includes(resolve(key).title));
    assert.equal(await page.locator('#name, #email, .start-options').count(), 0);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('demenzCoachPlan'))), previous);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('demenzCoachQuizProgress.v1')), '{"stale":"keep"}');
    await fits(page); await page.evaluate(() => scrollTo({ top:0, behavior:'instant' })); await capture(page, `angebot-${key}-mobil`);
    await page.setViewportSize({ width:1280, height:900 }); await fits(page); await capture(page, `angebot-${key}-desktop`);
    await page.setViewportSize({ width:320, height:740 }); await page.evaluate(() => document.documentElement.style.fontSize='225%'); await fits(page);
    await page.getByRole('button', { name:'Persönliche Hilfe starten', exact:true }).first().click();
    await page.locator('#email').fill('bad'); await page.getByRole('button', { name:'Angebot prüfen', exact:true }).click();
    assert.equal(await page.evaluate(() => document.body.dataset.screen), 'email'); assert.equal(await page.evaluate(() => window.checkoutCapture), undefined);
    await page.locator('#email').fill('direct@example.invalid'); await page.getByRole('button', { name:'Angebot prüfen', exact:true }).click();
    await page.locator('body[data-screen="plan"]').waitFor();
    await page.getByRole('button', { name:'Weiter zur Zahlung', exact:true }).first().click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('demenzCoachPlan')));
    assert.deepEqual(saved, { ...previous, directSituation:key });
    const checkout = await page.evaluate(() => window.checkoutCapture);
    assert.equal(checkout.email, 'direct@example.invalid'); assert.equal(checkout.source, 'direkt_situation');
    assert.deepEqual(calls, []);
    await page.evaluate(() => window.closeTestCheckout());
    await page.locator('body[data-screen="plan"]').waitFor();
    assert.ok((await page.locator('#screen h1').innerText()).includes(resolve(key).title));
    await page.goto(`${base}/abo/mein-plan.html`); await page.locator('#plan:not([hidden])').waitFor();
    assert.equal(await page.locator('#plan h3').first().innerText(), `„${resolve(key).title}“`);
    if (key==='hunger') assert.equal(await page.getByRole('link',{name:'Hilfe zu dieser Situation öffnen'}).getAttribute('href'), resolve(key).href);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('generic direct entry invents no example and leaves saved answers untouched', async () => {
  const previous = { name:'Mama', relation:'mama', situation:'mutter', directSituation:'waschen' };
  const { context, page } = await setup(previous);
  try {
    await page.goto(`${base}/start/?direkt=1&src=ergebnis`); await page.locator('body[data-screen="plan"]').waitFor(); await decline(page);
    const text = await page.locator('#screen').innerText();
    assert.ok(!text.includes('Ich will nach Hause.')); assert.ok(!text.includes('Mama'));
    await page.getByRole('button',{name:'Persönliche Hilfe starten',exact:true}).first().click();
    await page.locator('#email').fill('generic@example.invalid'); await page.getByRole('button',{name:'Angebot prüfen',exact:true}).click();
    await page.getByRole('button',{name:'Weiter zur Zahlung',exact:true}).first().click();
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('demenzCoachPlan'))),previous);
  } finally { await context.close(); }
});

test('intro reservation waits for a valid contact and its signed price is reviewed before checkout', async () => {
  const { context, page, calls, errors } = await setup(undefined, true);
  try {
    await page.goto(`${base}/start/?direkt=1&src=ratgeber&m=nachhause`); await page.locator('body[data-screen="plan"]').waitFor(); await decline(page);
    assert.deepEqual(calls, []);
    await page.getByRole('button',{name:'Persönliche Hilfe starten',exact:true}).first().click();
    await page.locator('#email').fill('intro@example.invalid'); await page.getByRole('button',{name:'Angebot prüfen',exact:true}).click();
    await page.locator('body[data-screen="plan"]').waitFor();
    assert.equal(calls.length,1); assert.equal(calls[0].email,'intro@example.invalid'); assert.equal(calls[0].kind,'intro');
    assert.ok((await page.locator('[data-start-fine]').first().innerText()).includes('49,99'));
    await page.getByRole('button',{name:'Weiter zur Zahlung',exact:true}).first().click();
    assert.equal((await page.evaluate(()=>window.checkoutCapture)).offer.token,'synthetic_signed_offer');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const key of ['sterben', '__proto__', 'unknown']) test(`invalid/excluded ${key} cannot select a direct situation`, async () => {
  const { context,page }=await setup();
  try { await page.goto(`${base}/start/?direkt=1&s=${encodeURIComponent(key)}`); await page.locator('body[data-screen="relation"]').waitFor(); assert.equal(await page.locator('.start-tiers').count(),0); }
  finally { await context.close(); }
});

test('normal answers remain complete before the CTA; safety and self-care answers have none', async () => {
  const { context,page,errors }=await setup();
  try {
    for (const key of ['waschen','hunger','sterben','erschoepft']) {
      if (['sterben','erschoepft'].includes(key)) {
        await page.goto(`${base}/de/`); await decline(page);
        await page.locator('#translator-input').fill(key==='sterben' ? 'Ich will nicht mehr leben.' : 'Ich kann nicht mehr.');
        await page.locator('#translator-form button[type="submit"]').click();
        await page.locator('#translator-result:not([hidden])').waitFor();
      } else { await page.goto(`${base}/de/?situation=${key}&ziel=jetzt`); await page.locator('.translator-answer').waitFor(); }
      const link=page.locator('.translator-plan-cta a');
      if (['sterben','erschoepft'].includes(key)) assert.equal(await link.count(),0);
      else {
        await link.waitFor(); const url=new URL(await link.getAttribute('href'),base); assert.equal(url.searchParams.get('direkt'),'1'); assert.equal(url.searchParams.get('s'),key);
        assert.ok(await page.locator('.translator-answer').evaluate(n=>Boolean(n.compareDocumentPosition(document.querySelector('.translator-plan-cta'))&Node.DOCUMENT_POSITION_FOLLOWING)));
      }
    }
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});

test('free AI response stays complete and loading/urgent output never adds a direct offer', async () => {
  const { context, page, errors } = await setup();
  let finish;
  await context.route('**/api/v1/translator-web', route => new Promise(done => {
    finish = async safetyLevel => {
      await route.fulfill({ json: { kind:'answer', safetyLevel, meaning:'Fiktive Testantwort.', phrases:['Testsatz eins.','Testsatz zwei.'], nextStep:'Fiktiver nächster Schritt.', avoid:'Testhinweis.' } });
      done();
    };
  }));
  try {
    for (const level of ['standard','urgent']) {
      finish = null;
      await page.goto(`${base}/de/`); await decline(page);
      await page.locator('#translator-input').fill('Zyxwvu Fiktiver Test');
      await page.locator('#translator-form button[type="submit"]').click();
      await page.locator('.translator-ai').waitFor();
      assert.equal(await page.locator('.translator-plan-cta').count(),0);
      await page.waitForFunction(() => Boolean(document.querySelector('.translator-ai')));
      // Wait for the actual request to reach the local stub, without live API calls.
      for (let n=0; !finish && n<50; n++) await new Promise(done=>setTimeout(done,20));
      assert.ok(finish); await finish(level);
      await page.locator('.translator-ai-answer').waitFor();
      assert.ok((await page.locator('.translator-ai-answer').innerText()).includes('Testsatz zwei.'));
      const link=page.locator('.translator-plan-cta a');
      if (level==='urgent') assert.equal(await link.count(),0);
      else {
        await link.waitFor(); const url=new URL(await link.getAttribute('href'),base);
        assert.equal(url.searchParams.get('direkt'),'1'); assert.equal(url.searchParams.get('s'),null);
        assert.ok(!url.href.includes('Zyxwvu'));
      }
    }
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});
