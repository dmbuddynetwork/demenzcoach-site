// Focused regression for the optional answer/guide entries. No real AI/payment requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.SITE_URL || 'http://127.0.0.1:8906/';
const cases = {
  'demenz-nach-hause-was-sagen': 'nachhause',
  'demenz-fragt-nach-verstorbener-mutter': 'mutter',
  'demenz-will-sich-nicht-waschen': 'waschen',
  'demenz-diebstahlvorwuerfe': 'geld',
  'demenz-nachts-zur-arbeit': 'arbeit',
  'demenz-immer-dieselbe-frage': 'wiederholt',
  'demenz-kommunikation': ''
};
const screenshotDir = process.env.SCREENSHOT_DIR;
const before = async (page, a, b) => assert.ok(await page.locator(a).evaluate((node, selector) =>
  Boolean(node.compareDocumentPosition(document.querySelector(selector)) & Node.DOCUMENT_POSITION_FOLLOWING), b), `${a} must precede ${b}`);
const fits = async page => { const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, offenders: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map(e => ({tag:e.tagName, cls:e.className, text:e.textContent.slice(0,60)})) })); assert.ok(size.width <= size.viewport, `${page.url()}: overflow ${JSON.stringify(size)}`); };
const events = page => page.evaluate(() => Array.from(window.dataLayer || []).filter(item => item[0] === 'event').map(item => Array.from(item)));

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
      localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
    });
    // All remote services are blocked. AI test responses are supplied separately below.
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const baselineRef = process.env.FUNNEL_BASELINE_REF;
    let baseline;
    if (baselineRef) baseline = execFileSync('git', ['show', `${baselineRef}:demenz-uebersetzer/translator.js`], { cwd: root, encoding: 'utf8' });

    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const key of ['nachhause', 'mutter', 'waschen']) {
        for (const goal of ['jetzt', 'verstehen', 'tipps']) {
          const route = `/de/?situation=${key}&ziel=${goal}`;
          let original;
          if (baseline) {
            await page.route('**/demenz-uebersetzer/translator.js', r => r.fulfill({ contentType: 'text/javascript', body: baseline }));
            await page.goto(new URL(route, base).href);
            await page.locator('.translator-answer').waitFor();
            original = await page.locator('.translator-answer').innerText();
            await page.unroute('**/demenz-uebersetzer/translator.js');
          }
          await page.goto(new URL(route, base).href);
          const answer = page.locator('.translator-answer');
          await answer.waitFor();
          if (baseline) assert.equal(await answer.innerText(), original, `${key}/${goal}: complete free answer unchanged`);
          assert.equal(await page.locator('.translator-plan-cta').count(), 1, 'one invitation per answer');
          await before(page, '.translator-answer', '.translator-plan-cta');
          const link = page.locator('.translator-plan-cta a');
          const url = new URL(await link.getAttribute('href'), base);
          assert.equal(url.pathname, '/start/');
          assert.equal(url.searchParams.get('m'), key);
          assert.deepEqual([...url.searchParams.keys()].sort(), ['m', 'src']);
          await fits(page);
          if (key === 'nachhause' && goal === 'jetzt') {
            if (screenshotDir && width !== 320) {
              fs.mkdirSync(screenshotDir, { recursive: true });
              await page.locator('.translator-plan-cta').scrollIntoViewIfNeeded();
              await page.screenshot({ path: path.join(screenshotDir, `antwort-${width}.png`) });
            }
            await link.click();
            await page.getByRole('heading', { name: 'Für wen suchst du Hilfe?' }).waitFor();
            await page.getByRole('button', { name: 'Meine Mutter', exact: true }).click();
            await page.locator('#name').waitFor();
            assert.deepEqual(await events(page), [], 'no analytics without consent');
          }
        }
      }
      for (const [slug, moment] of Object.entries(cases)) {
        const source = fs.readFileSync(path.join(root, `ratgeber/${slug}.html`), 'utf8');
        await page.goto(new URL(`/ratgeber/${slug}.html`, base).href);
        assert.equal(await page.locator('.guide-plan-cta').count(), 1);
        await before(page, slug === 'demenz-kommunikation' ? '#professionelle-hilfe' : '#sicherheit', '.guide-plan-cta');
        await before(page, '[data-related-link="passende-situation"]', '.guide-plan-cta');
        await before(page, '.guide-plan-cta', '.article-cta');
        assert.ok(source.includes('Weiterlesen') && source.includes('article-sources'));
        const link = page.locator('.guide-plan-cta a');
        const url = new URL(await link.getAttribute('href'), base);
        assert.equal(url.searchParams.get('src'), 'ratgeber');
        assert.equal(url.searchParams.get('m') || '', moment);
        await fits(page);
        if (screenshotDir && width !== 320 && slug === 'demenz-nach-hause-was-sagen') {
          await page.locator('.guide-plan-cta').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(screenshotDir, `ratgeber-${width}.png`) });
        }
        await link.click();
        await page.getByRole('heading', { name: 'Für wen suchst du Hilfe?' }).waitFor();
        if (moment) assert.ok((await page.locator('h1').innerText()).includes('Was sagen bei'));
      }
    }
    // Enlarged text still fits the small screen.
    for (const route of ['/de/?situation=nachhause&ziel=jetzt', '/ratgeber/demenz-nach-hause-was-sagen.html']) {
      let previousWidth = route.startsWith('/de/') ? null : 320;
      if (baseline && route.startsWith('/de/')) {
        await page.route('**/demenz-uebersetzer/translator.js', r => r.fulfill({ contentType: 'text/javascript', body: baseline }));
        await page.goto(new URL(route, base).href);
        await page.locator('.translator-answer').waitFor();
        await page.addStyleTag({ content: 'html { font-size: 225% !important; }' });
        previousWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        await page.unroute('**/demenz-uebersetzer/translator.js');
      }
      await page.goto(new URL(route, base).href);
      await page.locator('.translator-plan-cta, .guide-plan-cta').waitFor();
      await page.addStyleTag({ content: 'html { font-size: 225% !important; }' });
      const currentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      if (previousWidth !== null) assert.ok(currentWidth <= previousWidth, 'enlarged text does not introduce page overflow');
      const box = await page.locator('.translator-plan-cta, .guide-plan-cta').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= 320, 'enlarged invitation fits');
    }
    for (const route of ['/de/?situation=sterben&ziel=jetzt', '/ratgeber/pflegende-angehoerige-ueberfordert.html', '/en/?situation=home']) {
      await page.goto(new URL(route, base).href);
      assert.equal(await page.locator('.translator-plan-cta, .guide-plan-cta').count(), 0, `${route}: no invitation`);
    }
    // Synthetic unknown input: no CTA before completion; complete AI output before CTA.
    let finishAI;
    await page.route('**/api/v1/translator-web', route => new Promise(resolve => { finishAI = async safetyLevel => {
      await route.fulfill({ json: { kind: 'answer', safetyLevel, meaning: 'Fiktive Testantwort.', phrases: ['Testsatz eins.', 'Testsatz zwei.'], nextStep: 'Fiktiver nächster Schritt.', avoid: 'Testhinweis.' } }); resolve();
    }; }));
    for (const safetyLevel of ['standard', 'urgent']) {
      finishAI = null;
      await page.goto(new URL('/de/', base).href);
      await page.locator('#translator-input').fill('Zyxwvu Fiktiver Test');
      await page.locator('#translator-form button[type="submit"]').click();
      await page.waitForFunction(() => Boolean(document.querySelector('.translator-ai')));
      assert.equal(await page.locator('.translator-plan-cta').count(), 0, 'no invitation during AI loading');
      for (let i = 0; !finishAI && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.ok(finishAI, 'synthetic AI request reached stub');
      await finishAI(safetyLevel);
      await page.locator('.translator-ai-answer').waitFor();
      assert.ok((await page.locator('.translator-ai-answer').innerText()).includes('Testsatz zwei.'));
      assert.equal(await page.locator('.translator-plan-cta').count(), safetyLevel === 'standard' ? 1 : 0);
      if (safetyLevel === 'standard') {
        await before(page, '.translator-ai-answer', '.translator-plan-cta');
        assert.equal(await page.locator('.translator-plan-cta a').getAttribute('href'), '/start/?src=ergebnis');
      }
    }
    // Existing consent path measures the next screen after the first answer; no answer values.
    await page.goto(new URL('/start/?src=ratgeber&m=nachhause', base).href);
    // Use the real consent UI because the public API intentionally has no grant method.
    await page.getByRole('button', { name: 'Datenschutz-Einstellungen', exact: true }).click();
    await page.locator('.consent-accept').click();
    await page.getByRole('button', { name: 'Meine Mutter', exact: true }).click();
    await page.locator('#name').waitFor();
    const measured = (await events(page)).filter(item => item[1] === 'quiz_name');
    assert.equal(measured.length, 1);
    assert.equal(measured[0][2].source, 'ratgeber');
    assert.ok(!JSON.stringify(measured).includes('mama'));
    assert.deepEqual(errors, []);
    console.log('Funnel entries passed: complete answers, 7 contextual guides, real first-question flow, AI loading/safety, consent and responsive layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
