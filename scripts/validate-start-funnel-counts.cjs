// Isolated regression for the start funnel (no real network): step counter calls for the direct offer, no counting for
// test runs / internal devices, the scratch card (reveal) moving on to the plan by itself, and the practice result line.
// All remote calls are answered locally; the checkout window is a stub, so no account, session or payment is ever created.
const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_URL || 'http://127.0.0.1:54929';
const key = 'demenzCoachQuizProgress.v1';
const email = 'qa-funnel-counts@example.invalid';

async function open(browser, { device, init, url }) {
  const context = await browser.newContext({ ...(device ? devices[device] : { viewport: { width: 390, height: 900 } }), reducedMotion: 'reduce' });
  const counts = [];
  const offers = [];
  await context.route('**/*', async route => {
    const target = new URL(route.request().url());
    if (target.origin === new URL(base).origin) {
      if (target.pathname === '/abo/kasse.js') return route.fulfill({ contentType: 'text/javascript', body:
        'window.__kasse = []; window.DemenzKasse = { open(options) { window.__kasse.push(options.plan); }, close() {}, isOpen: () => false };' });
      return route.continue();
    }
    if (target.pathname.endsWith('/v1/quiz-count')) { counts.push(JSON.parse(route.request().postData())); return route.fulfill({ status: 204 }); }
    if (target.pathname.endsWith('/web-checkout/config')) return route.fulfill({ json: {
      plans: { yearly: { amount: 6999, currency: 'eur' }, monthly: { amount: 1299, currency: 'eur' } }, trialDays: 7, offers: { intro: { firstYear: 4999, minutes: 15 } } } });
    if (target.pathname.endsWith('/web-checkout/offer')) {
      offers.push(route.request().postDataJSON());
      return route.fulfill({ json: { kind: 'intro', expiresAt: Date.now() + 15 * 60000, token: 'synthetic-offer-token', firstYear: 4999, regular: 6999, emailBound: true } });
    }
    return route.abort();
  });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + url);
  return { context, page, counts, errors, steps: () => counts.map(item => item.step) };
}

const at = (page, name, timeout) => page.waitForFunction(name => document.body.dataset.screen === name, name, timeout ? { timeout } : undefined);

// Fills the direct offer until the checkout window is requested; returns the steps counted on the way.
async function runDirect(browser, { device, url, init }) {
  const run = await open(browser, { device, url, init });
  const { page } = run;
  await at(page, 'plan');
  await page.waitForFunction(() => window.DemenzKasse && document.querySelector('.start-cta'));
  await page.locator('.start-cta').first().click(); // no address yet: the e-mail step comes first
  await at(page, 'email');
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: 'Angebot prüfen', exact: true }).click();
  await at(page, 'plan');
  await page.locator('.start-cta').first().click();
  await page.waitForFunction(() => window.__kasse?.length === 1);
  await page.locator('.start-cta').last().click(); // a second tap on the same view must not be counted again
  await page.waitForFunction(() => window.__kasse?.length === 2);
  await page.waitForTimeout(300);
  return run;
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const device of ['Pixel 7', 'iPhone 13']) {
      const run = await runDirect(browser, { device, url: '/start/?direkt=1&src=simulator' });
      const steps = run.steps();
      for (const step of ['direct_cta', 'direct_email', 'direct_kasse']) assert.equal(steps.filter(item => item === step).length, 1, `${device}: ${step} once in ${steps}`);
      assert.ok(steps.includes('direct'), `${device}: view still counted as "direct"`);
      assert.deepEqual(steps.filter(item => /^direct_/u.test(item)), ['direct_cta', 'direct_email', 'direct_kasse'], `${device}: order`);
      assert.deepEqual(run.counts.filter(item => Object.keys(item).some(name => name !== 'step')), [], 'only the step is sent');
      assert.deepEqual(run.errors, [], device);
      await run.context.close();
      console.log(`${device}: direct offer counts direct_cta, direct_email, direct_kasse once each`);
    }

    for (const [label, options] of [
      ['src=test', { url: '/start/?direkt=1&src=test' }],
      ['utm_source=test', { url: '/start/?direkt=1&utm_source=Test' }],
      ['internal device', { url: '/start/?direkt=1&src=simulator', init: () => localStorage.setItem('demenzcoach.internal.v1', '1') }]
    ]) {
      const run = await runDirect(browser, options);
      assert.deepEqual(run.counts, [], `${label}: nothing is counted`);
      assert.deepEqual(run.errors, [], label);
      await run.context.close();
      console.log(`${label}: nothing counted`);
    }
    {
      const run = await open(browser, { url: '/start/?src=test' });
      await at(run.page, 'relation');
      await run.page.getByRole('button', { name: 'Meine Mutter', exact: true }).click();
      await at(run.page, 'age');
      assert.deepEqual(run.counts, [], 'quiz with src=test: nothing counted');
      await run.context.close();
      const normal = await open(browser, { url: '/start/?src=qa_counts' });
      await at(normal.page, 'relation');
      await normal.page.waitForTimeout(200);
      assert.deepEqual(normal.steps(), ['relation'], 'quiz without test marker still counts its steps');
      await normal.context.close();
      console.log('quiz: test link not counted, normal link still counted');
    }

    {
      // Practice result line (stored by simulator.js in this tab) and the example picture pair.
      const run = await open(browser, { device: 'Pixel 7', url: '/start/?direkt=1&src=simulator', init: () => {
        sessionStorage.setItem('demenzCoachSimPair', JSON.stringify({ before: '/assets/zeichnungen/nach-hause.webp', after: '/assets/zeichnungen/nach-hause-ruhig.webp' }));
        sessionStorage.setItem('demenzCoachSimResult', JSON.stringify({ calm: true, text: '<b>Du hast ruhig geantwortet.</b>' }));
      } });
      await at(run.page, 'plan');
      const line = run.page.locator('.start-result-line');
      assert.equal(await line.count(), 1);
      assert.equal(await line.innerText(), 'Das hat bei dir geklappt: <b>Du hast ruhig geantwortet.</b>', 'text only, no markup');
      assert.equal(await run.page.locator('.start-result-line b').count(), 0, 'no markup from the stored text');
      assert.equal(await run.page.locator('.start-result-line strong').count(), 1, 'only the label is bold');
      await run.context.close();
      const none = await open(browser, { device: 'Pixel 7', url: '/start/?direkt=1&src=simulator' });
      await at(none.page, 'plan');
      assert.equal(await none.page.locator('.start-result-line').count(), 0, 'no result, no line');
      await none.context.close();
      console.log('practice result line shown only when present');
    }

    {
      // Scratch card: moves on to the plan after about 6 seconds, with no text about it; a tap on "Weiter" still goes at once.
      const reach = async (run) => {
        const { page } = run;
        await at(page, 'relation');
        await page.getByRole('button', { name: 'Meine Mutter', exact: true }).click(); await at(page, 'age');
        await page.evaluate(storageKey => {
          const saved = JSON.parse(sessionStorage.getItem(storageKey)); const data = window.DEMENZ_PLAN_DATA;
          saved.screen = 'plan';
          for (const [name, list] of Object.entries({ situation: data.situations, frequency: data.frequencies, dayTime: data.dayTimes, duration: data.durations,
            living: data.livings, goal: data.goals, burden: data.burdens, minutes: data.minutes })) saved.choices[name] = list[0].key;
          for (const name of ['age', 'personAge', 'reaction', 'visits', 'outings', 'meals', 'helpreact', 'feeling', 'sleep', 'breaks', 'work', 'when', 'joy']) saved.choices[name] = '0';
          sessionStorage.setItem(storageKey, JSON.stringify(saved));
        }, key);
        await page.reload(); await at(page, 'email');
        await page.locator('.consent-decline').click({ timeout: 3000 }).catch(() => {});
        await page.locator('#email').fill(email);
        await page.getByRole('button', { name: 'Weiter', exact: true }).click(); await at(page, 'newsletter');
        await page.getByRole('button', { name: 'Kein Interesse', exact: true }).click(); await at(page, 'name');
        await page.getByRole('button', { name: 'Überspringen', exact: true }).click(); await at(page, 'result');
        await page.getByRole('button', { name: 'Weiter', exact: true }).click();
        await at(page, 'reveal');
        return Date.now();
      };
      const untouched = await open(browser, { url: '/start/?src=qa_reveal' });
      const shown = await reach(untouched);
      assert.doesNotMatch(await untouched.page.locator('#screen').innerText(), /Sekunden|automatisch weiter|gleich weiter|läuft ab/iu, 'no timer text');
      await at(untouched.page, 'plan', 9000);
      const waited = Date.now() - shown;
      assert.ok(waited >= 5000 && waited <= 8500, `auto advance after about 6 s, was ${waited} ms`);
      assert.deepEqual(untouched.errors, []);
      await untouched.context.close();

      const late = await open(browser, { url: '/start/?src=qa_reveal_late' });
      const lateShown = await reach(late);
      await late.page.waitForTimeout(4500);
      await late.page.getByRole('button', { name: 'Aufdecken', exact: true }).click();
      await late.page.waitForTimeout(1500);
      assert.equal(await late.page.locator('body').getAttribute('data-screen'), 'reveal', 'a late reveal still gets a moment to look');
      await at(late.page, 'plan', 5000);
      assert.ok(Date.now() - lateShown >= 7000, 'late reveal waits at least 2.5 s');
      await late.context.close();

      const quick = await open(browser, { url: '/start/?src=qa_reveal_tap' });
      await reach(quick);
      await quick.page.getByRole('button', { name: 'Aufdecken', exact: true }).click();
      await quick.page.getByRole('button', { name: 'Weiter zum Angebot', exact: true }).click();
      await at(quick.page, 'plan', 1500);
      await quick.page.waitForTimeout(3500); // the old timer must not fire on the plan or on a later screen
      assert.equal(await quick.page.locator('body').getAttribute('data-screen'), 'plan');
      await quick.context.close();
      console.log('scratch card: automatic advance after about 6 s, tap goes at once, no timer text');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
