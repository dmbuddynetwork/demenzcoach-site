// Run against `wrangler dev --local`, not a plain file server: this checks asset/Worker routing too.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.SITE_URL || 'http://127.0.0.1:8897/');
const production = 'https://dementiacoachapp.com';
const root = path.resolve(__dirname, '..');
const languages = fs.readdirSync(root).filter(language => /^[a-z]{2}$/.test(language)
  && fs.existsSync(path.join(root, language, 'index.html')));

const redirect = async (from, to, method = 'GET') => {
  const response = await fetch(new URL(from, base), { method, redirect: 'manual' });
  assert.equal(response.status, 301, `${method} ${from}`);
  assert.equal(response.headers.get('location'), new URL(to, base).href, from);
  if (method === 'HEAD') assert.equal(await response.text(), '', 'HEAD has no response body');
};

(async () => {
  assert.equal(languages.length, 33, 'all existing homepage languages remain available');
  await redirect('/?utm_source=test&a=1%2B2', '/de/?utm_source=test&a=1%2B2');
  await redirect('/index.html', '/de/');
  await redirect('/?utm_source=test', '/de/?utm_source=test', 'HEAD');
  for (const language of languages) {
    if (language !== 'de') {
      await redirect(`/index-${language}.html?utm_source=test`, `/${language}/?utm_source=test`);
      await redirect(`/index-${language}.html`, `/${language}/`, 'HEAD');
    }
    const response = await fetch(new URL(`/${language}/`, base), { redirect: 'manual' });
    assert.equal(response.status, 200, language);
    const html = await response.text();
    const etag = response.headers.get('etag');
    assert.ok(etag, `${language}: asset ETag available`);
    const cached = await fetch(new URL(`/${language}/`, base), {
      headers: { 'if-none-match': etag }, redirect: 'manual'
    });
    assert.equal(cached.status, 304, `${language}: conditional visit must not become 404`);
    assert.ok(html.includes(`rel="canonical" href="${production}/${language}/"`), `${language}: self-canonical`);
    for (const alternate of [...languages, 'x-default']) {
      assert.ok(html.includes(`hreflang="${alternate}" href="${production}/${alternate === 'x-default' ? 'de' : alternate}/"`), `${language}: ${alternate} alternate`);
    }
  }
  for (const pathname of ['/de', '/en', '/de/app']) await redirect(pathname, `${pathname}/`);
  for (const pathname of ['/datenschutz.html', '/privacy-en.html', '/demenz-uebersetzer/', '/en/dementia-translator/']) {
    const response = await fetch(new URL(pathname, base), { redirect: 'manual' });
    assert.equal(response.status, 200, pathname);
    assert.equal(response.headers.get('location'), null, `${pathname} keeps its address`);
  }
  for (const pathname of ['/zz/', '/index-zz.html', '/missing-page.html']) {
    assert.equal((await fetch(new URL(pathname, base), { redirect: 'manual' })).status, 404, pathname);
  }

  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const language of ['de', 'en', 'fr', 'ar']) {
        assert.equal((await page.goto(new URL(`/${language}/`, base).href)).status(), 200, language);
        assert.ok((await page.locator('html').getAttribute('lang')).startsWith(language));
        assert.equal(await page.locator('h1').count(), 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}: ${width}px layout`);
        if (language === 'ar') assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
        if (language === 'de' || language === 'en') {
          const data = await page.locator('#translator-data').textContent();
          assert.ok(JSON.parse(data).chatImage, `${language}: current main chat metadata retained`);
        }
      }
    }
    await page.goto(new URL('/?utm_source=test#translator', base).href);
    assert.equal(new URL(page.url()).pathname, '/de/');
    assert.equal(new URL(page.url()).search, '?utm_source=test');
    assert.equal(new URL(page.url()).hash, '#translator', 'browser retains fragment through 301');
    await page.locator('a[href="/en/"]').click();
    await page.waitForURL(url => url.pathname === '/en/');
    await page.locator('a[href="/de/"]').first().click();
    await page.waitForURL(url => url.pathname === '/de/');
    await page.goto(new URL('/fr/', base).href);
    await page.locator('details.e-lang > summary').click();
    await page.locator('.e-lang-menu a[href="/ar/"]').click();
    await page.waitForURL(url => url.pathname === '/ar/');
    await page.goto(new URL('/de/app/', base).href);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `${production}/de/app/`);
    const assets = await page.locator('img[src], script[src], link[rel="stylesheet"]').evaluateAll(elements => elements
      .map(element => element.src || element.href).filter(url => url.startsWith(location.origin)));
    for (const asset of new Set(assets)) {
      assert.equal((await page.request.get(asset)).status(), 200, `preserved landing asset ${asset}`);
    }
    assert.deepEqual(errors, [], 'no browser script errors');
  } finally { await browser.close(); }
  console.log('Language routing passed: 33 homes and legacy redirects, query/HEAD/304, canonical/hreflang, legal/tool URLs, 404, DE/EN/FR/AR at 320/390/768/1440px, manual language choice, fragments and preserved app landing assets.');
})().catch(error => { console.error(error); process.exitCode = 1; });
