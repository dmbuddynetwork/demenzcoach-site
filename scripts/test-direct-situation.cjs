// Local-only contracts: complete free help -> contextual offer -> existing contact/checkout.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
// Exact article bytes independently verified against the accepted73 delivery and5c1 baseline.
// Literal hashes keep this source guard portable across patch/squash/shallow checkouts.
const articleSourceSHA256 = Object.freeze({
  "de/ratgeber/demenz-diebstahlvorwuerfe.html": "36a20ee53dfcb48bd854e5d7bd93c4e3560e290cc816ff4eb90f135ad3a91ee0",
  "de/ratgeber/demenz-fragt-nach-verstorbener-mutter.html": "671de59a24467e96086eba15a765f29a0245c3e4579b0341bc3c27ba6a0aea93",
  "de/ratgeber/demenz-immer-dieselbe-frage.html": "64c0782fed03863130acafaefcb1ab1ec7ae7fd6023d4f974b61cbe74e7e9b16",
  "de/ratgeber/demenz-nach-hause-was-sagen.html": "a5b6af3bc5a96d27845805410bbf368b040b9ffa49a88cd5c1d88f8347fd0c93",
  "de/ratgeber/demenz-nachts-zur-arbeit.html": "acf201a20844c79f0df20a27b7e3dc52d1296e91f072f319cb35b7861b3a537f",
  "de/ratgeber/demenz-will-sich-nicht-waschen.html": "57ddbe0afd4f20a8b87d78e95fe9c2b4500c4f5c22277044e6d4aa404969a035",
  "de/demenz-uebersetzer/da-ist-jemand-im-zimmer.html": "b3b17d45e8a2ab8d568d1e2bd48493e30c0b4573683717d4dc1775f71bb83e21",
  "de/demenz-uebersetzer/das-essen-ist-vergiftet.html": "936cf60bc9637b5c99106e93b08b8822b7ba05c4ec28fbaa4a93a9ecc043a100",
  "de/demenz-uebersetzer/die-nachbarn-reden-ueber-mich.html": "eb0dacbe6e3f413f5d207a6a43c313a1235202fc0aa9241ee3fdb48618554371",
  "de/demenz-uebersetzer/du-hast-einen-anderen.html": "2ffa26c7f2592849844d2f9f3ef286cf96393d3383f57b04d25226b7507910fe",
  "de/demenz-uebersetzer/du-hast-mein-geld-gestohlen.html": "f6ee6014f4f4cd4e3f0af842567b878ca5771463fbce8ad9380a38531b944ee5",
  "de/demenz-uebersetzer/du-luegst-mich-an.html": "57470ecf2bb02b439efa764c0d0da190b5e5e7f8d0534a161272b5ad827a76a7",
  "de/demenz-uebersetzer/es-wird-dunkel-ich-muss-los.html": "b2d4ca9728c6768c4a4cdb06e970ae476a3421d28596e540127341fe3f3f41f3",
  "de/demenz-uebersetzer/hilfe-hilfe-rufen.html": "499f3795c81ca505d1950bb7a5338092e9a511d4e06f257d9cd8fd8de50fec5a",
  "de/demenz-uebersetzer/ich-bin-doch-kein-kind.html": "3d6fd7de9b72b68164b04b9c3b546282be941227389d724a78f99e569fa65acd",
  "de/demenz-uebersetzer/ich-bin-doch-nicht-dement.html": "4d4efb02956a94194f1b373da0e80b2f997466d11df6c64b7595903555bbc5e2",
  "de/demenz-uebersetzer/ich-bin-hier-eingesperrt.html": "777e7406c892125c97d4d8e14e78d53c272b886a108e70ce5dc7c46f9f6d8d58",
  "de/demenz-uebersetzer/ich-bleibe-heute-im-bett.html": "e09ff169aa6cc15b320cdca6c4f198665acac52e94d70b8123946886831c1d90",
  "de/demenz-uebersetzer/ich-gehe-nicht-in-die-tagespflege.html": "740f43a35758903bf9336b8ddf4c82a7ba855f74e736fa47c6084fa1915a3a6a",
  "de/demenz-uebersetzer/ich-habe-noch-nichts-gegessen.html": "f213ed4798e607926a8b68071840154243c813eaa48ec58a30d73433d646e1a0",
  "de/demenz-uebersetzer/ich-habe-schon-gegessen.html": "8b830cd09b7541e343cd27daf4019c6cc9624c2b17bbc9853142be34dcdfaa5f",
  "de/demenz-uebersetzer/ich-kann-gar-nichts-mehr.html": "ba0456ecae1f82e5bd26ed5580677a064a9ccfe38ed0094e5a49c6f39fe9a45f",
  "de/demenz-uebersetzer/ich-muss-aufstehen-nachts.html": "895fe18cf4daedf025ef7dd3efe0ac28d600a484f6dd5c2367f8e0a0e1225cb1",
  "de/demenz-uebersetzer/ich-muss-jemanden-anrufen.html": "caadaa58114b27d2a4817b0870d2ace7f86a3f40c7305b876d3d51526fd8c85b",
  "de/demenz-uebersetzer/ich-muss-nicht-aufs-klo.html": "10de8ba9daf94617a509c9a1765b685779f0d07d36e18666fac1b00476f5c372",
  "de/demenz-uebersetzer/ich-muss-noch-einkaufen.html": "d04e3ee77d48ddbc11c9d18e346c7eabb3dacaad4fe85ba71a6670e06f8c44bc",
  "de/demenz-uebersetzer/ich-muss-zur-arbeit.html": "b9007f55dacbe850ab0284f4b65b8fefcc260b23aed6c5901b83a693908ceb3f",
  "de/demenz-uebersetzer/ich-nehme-keine-tabletten.html": "30cdb5592f3536a6c05be141c51ac8f61cb6a6ed5263a1890a49ef2a5702d447",
  "de/demenz-uebersetzer/ich-will-auto-fahren.html": "977bac14507a542365e89c549e20793a8ee7cd4a3cf6e71ccf5d28ff10ed52f3",
  "de/demenz-uebersetzer/ich-will-das-ausziehen.html": "07adabac6296b307df142e3d9f3574da836b714756bc17a4ac462462c39c83fa",
  "de/demenz-uebersetzer/ich-will-nicht-duschen.html": "016e2293f7d17ed0bbce3ff9e3a8dd6765be253fb01f4b98e58f9bf7f078ba4e",
  "de/demenz-uebersetzer/ich-will-nicht-ins-bett.html": "4f2771ddc844b676d0c63206848e8cf82010ef2e1bd7b7381c05eaf854b0791c",
  "de/demenz-uebersetzer/ich-will-nicht-ins-heim.html": "2945380c162bf8390f6a7aeb9987d0f4fb3e7eec4b7b5b62a0440ac936542e3f",
  "de/demenz-uebersetzer/ich-ziehe-mich-nicht-um.html": "576ec976884c1850cc2088ebaa811336982c59aaaba41e67efdd9f4a94e37c67",
  "de/demenz-uebersetzer/lass-mich-in-ruhe.html": "e7ce14d2d9f3fa82af8d830d14b751c921a275b324ae7c188ac0db1bf1ee0b24",
  "de/demenz-uebersetzer/lass-mich-nicht-allein.html": "6d060da415868a82e16631dd5ff0001f2406362957791c7b146fc79caa87033d",
  "de/demenz-uebersetzer/mir-ist-langweilig.html": "159750b4488d4dc35155a403a36c6d73d524c21ca7635256b3cfed1136b63cd3",
  "de/demenz-uebersetzer/mir-ist-so-kalt.html": "3cd1b9046682f0ee41b314192cbcc4d32c8c5ad8354cfc768ef76775b10aa7d2",
  "de/demenz-uebersetzer/wann-gehen-wir.html": "9a9a4c20051b3fa08106b08fc93bebc753e70093dec9b541ef51ee6cc74b23cb",
  "de/demenz-uebersetzer/wann-kommt-mein-sohn.html": "c301b8fa0c05db4e11211f0596ed6709c20e90fe31b9ec5972b6ff1a12fcd6e5",
  "de/demenz-uebersetzer/wer-sind-sie.html": "8ed817e2bc2653d96facb7151d506d576a55f9733a0f8a64b0934b33cfbd377c",
  "de/demenz-uebersetzer/wo-bin-ich.html": "ddb016226e95e49ee105f1ea2bf91f914990ccff81577616d5e0c19cd809b71c",
  "de/demenz-uebersetzer/wo-ist-mein-hund.html": "79edd22de6800bbad84f7aa8b5e0e9a3912b1361d8a5b3047addff41e03fd58a",
  "de/demenz-uebersetzer/wo-ist-mein-mann.html": "3f5b20d88abe6141230b9443b204fd63b67e0f9e20faa1bc676fb8e79341eb09",
  "de/demenz-uebersetzer/wo-ist-meine-mutter.html": "41ac4b8896fe373f1050d54e32d0ba7d4083abd0220d9ac3038e8b49e81b2e79",
  "de/demenz-uebersetzer/wo-sind-meine-kinder.html": "4d419a8623974c15e869f2ee7b7ad2d6baf0b7789d21fa9b9373e09e3de2d456"
});

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
  const publicRoutes=JSON.parse(fs.readFileSync(path.join(root,'content/generator-public-routes.json'),'utf8')).routes;
  const inventory=JSON.parse(fs.readFileSync(path.join(root,'content/generator-route-manifest.json'),'utf8')).routes;
  const migrated=new Map(publicRoutes.filter(route=>route.language==='de'&&Object.hasOwn(articleSourceSHA256,route.path.slice(1))).map(route=>[route.path.slice(1),route]));
  for(const [file,route]of migrated){const approved=inventory.find(item=>item.language==='de'&&item.key===route.key&&item.path===route.path);assert.equal(approved?.legacySourceSHA256,articleSourceSHA256[file],file);if(!files.includes(file))files.push(file);}
  assert.equal(files.length, 46);
  assert.deepEqual(files.slice().sort(), Object.keys(articleSourceSHA256).sort());
  const { context, page, errors } = await setup();
  try {
    for (const file of files) {
      const mapped=migrated.get(file),html=fs.readFileSync(path.join(root,file),'utf8');
      if(mapped){assert.ok(html.includes(`data-translator-initial-situation="${mapped.key}"`));assert.equal((html.match(/id="translator-form"/g)||[]).length,1);assert.equal((html.match(/id="translator-result"/g)||[]).length,1);assert.ok(html.includes(`rel="canonical" href="https://dementiacoachapp.com${mapped.path}"`));}
      else assert.equal(createHash('sha256').update(Buffer.from(html)).digest('hex'),articleSourceSHA256[file],file);
      await page.goto(`${base}/${file}`);
      if(mapped?.selfCare||mapped?.safetyOnly){await page.locator('#translator-result:not([hidden])').waitFor();assert.equal(await page.locator('.translator-plan-cta').count(),0);continue;}
      const link = page.locator('a[data-direct-situation]').first(); await link.waitFor();
      const url = new URL(await link.getAttribute('href'), base);
      assert.equal(url.pathname, '/start/'); assert.equal(url.searchParams.get('direkt'), '1');
      assert.ok(resolve(url.searchParams.get('s'))); assert.ok((mapped?['ergebnis','wieder','tipps']:['situation','ratgeber']).includes(url.searchParams.get('src')));
      if(mapped)assert.equal(url.searchParams.get('s'),mapped.key);
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

for (const query of ['s=uhrzeit', 'm=wiederholt']) test(`review regression ${query}: no invented departure time or email access promise`, async () => {
  const previous = { name:'Papa', relation:'papa', situation:'wiederholt', helperNote:'synthetic_keep' };
  const { context, page, errors } = await setup(previous);
  const invented = /Wir fahren nach dem Mittagessen|Um drei Uhr fahren wir los/u;
  try {
    await page.goto(`${base}/start/?direkt=1&src=situation&${query}`);
    await page.locator('body[data-screen="plan"]').waitFor(); await decline(page);
    assert.doesNotMatch(await page.locator('#screen').innerText(), invented);
    assert.equal(await page.getByRole('link',{name:'Zur kostenlosen Situationshilfe'}).getAttribute('href'), '/de/demenz-uebersetzer/wann-gehen-wir.html');
    await page.getByRole('button',{name:'Persönliche Hilfe starten',exact:true}).first().click();
    assert.equal(await page.locator('#screen h1').innerText(), 'E-Mail für die Vertragsbestätigung');
    assert.doesNotMatch(await page.locator('#screen').innerText(), /Zugang|Login|Zugangslink/u);
    await capture(page, `kontakt-${query.startsWith('s=')?'uhrzeit':'alias'}`);
    await page.locator('#email').fill('review@example.invalid');
    await page.getByRole('button',{name:'Angebot prüfen',exact:true}).click();
    await page.getByRole('button',{name:'Weiter zur Zahlung',exact:true}).first().click();
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('demenzCoachPlan'))), { ...previous, directSituation:'uhrzeit' });
    await page.goto(`${base}/abo/mein-plan.html`); await page.locator('#plan:not([hidden])').waitFor();
    assert.equal(await page.locator('#plan h3').first().innerText(), '„Wann gehen wir?“');
    const firstCard=page.locator('#plan > .start-card').first();
    assert.equal(await firstCard.getByRole('link',{name:'Hilfe zu dieser Situation öffnen'}).getAttribute('href'), '/de/demenz-uebersetzer/wann-gehen-wir.html');
    assert.equal(await firstCard.locator('.start-say').count(),0);
    assert.doesNotMatch(await firstCard.innerText(), invented);
    assert.doesNotMatch(await page.locator('#plan').innerText(), invented, 'The visible overview must not highlight the old time assumptions');
    await decline(page); await capture(page, `uebersicht-${query.startsWith('s=')?'uhrzeit':'alias'}`);
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});
