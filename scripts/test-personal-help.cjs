// Focused browser contracts for the personal-help offer and subscriber overview.
// No real accounts, AI calls, newsletters, Stripe requests or payments are used.
// Run against a local HTTP server with PLAYWRIGHT_MODULE and SITE_URL if needed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_URL || 'http://127.0.0.1:8918';
const output = process.env.PERSONAL_HELP_SCREENSHOTS;
let browser;
before(async () => {
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ headless: true, ...(existsSync(chrome) ? { executablePath: chrome } : {}) });
  if (output) mkdirSync(output, { recursive: true });
});
after(async () => { await browser?.close(); });
async function pageFor(state = 'active', saved = { relation: 'mama', name: 'Mama', situation: 'waschen' }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin) return route.abort();
    if (url.pathname === '/abo/konto.js') return route.fulfill({ contentType: 'text/javascript', body:
      `export async function subscriberState(config, callback) { callback({ startedAt: '2026-11-01T00:00:00Z' }); return ${JSON.stringify(state)}; }` });
    if (url.pathname === '/abo/kasse.js') return route.fulfill({ contentType: 'text/javascript', body:
      `window.DemenzKasse = { open(options) { window.testCheckout = { plan: options.plan, email: options.email }; }, isOpen() { return false; } };` });
    return route.continue();
  });
  await context.addInitScript((value) => { if (value) localStorage.setItem('demenzCoachPlan', JSON.stringify(value)); }, saved);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, errors };
}
async function offer(page, moment) {
  await page.goto(`${base}/start/${moment ? '?m=' + moment : ''}`);
  await page.locator('.consent-decline').click();
  const visited = [];
  for (let step = 0; step < 30; step += 1) {
    visited.push(await page.locator('body').getAttribute('data-screen'));
    if (await page.locator('.start-tiers').count()) return;
    if (await page.locator('#email').count()) {
      await page.locator('#email').fill('synthetic@example.invalid');
      await page.getByRole('button', { name: 'Zum Angebot', exact: true }).click();
    } else if (await page.getByRole('button', { name: 'Kein Interesse', exact: true }).count()) {
      await page.getByRole('button', { name: 'Kein Interesse', exact: true }).click();
    } else if (await page.getByRole('button', { name: 'Überspringen', exact: true }).count()) {
      await page.getByRole('button', { name: 'Überspringen', exact: true }).click();
    } else if (await page.locator('#screen .abo-button').count()) {
      await page.locator('#screen .abo-button').first().click();
    } else {
      await page.locator('#screen button').first().click();
    }
    await page.waitForFunction((old) => document.body.dataset.screen !== old, visited.at(-1));
  }
  assert.fail('Offer not reached: ' + visited.join(' > '));
}
async function capture(page, name) {
  if (output) {
    await page.screenshot({ path: path.join(output, name + '-ausschnitt.png') });
    await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
  }
}
async function fits(page) {
  const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth,
    offenders: [...document.querySelectorAll('main *')].filter(n => n.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 8).map(n => ({ tag: n.tagName, class: n.className, text: n.textContent.slice(0, 60) })) }));
  assert.ok(layout.width <= layout.viewport + 1, 'No horizontal overflow: ' + JSON.stringify(layout));
}

test('selected situation remains first across weeks; weekly help is secondary and keyboard operable', async () => {
  const { context, page, errors } = await pageFor();
  try {
    await page.goto(`${base}/abo/mein-plan.html?woche=3`);
    await page.locator('#plan:not([hidden])').waitFor();
    await page.locator('.consent-decline').click();
    assert.equal(await page.locator('#plan h1').innerText(), 'Deine persönliche Hilfe');
    assert.equal(await page.locator('#plan h3').first().innerText(), '„Ich will nicht duschen.“');
    const ownHelp = page.getByRole('link', { name: 'Eigene Situation beschreiben', exact: true });
    assert.equal(await ownHelp.getAttribute('href'), '/de/#translator-input');
    const missingAnchors = await page.evaluate(async () => {
      const missing = [];
      for (const link of document.querySelectorAll('#plan a[href^="/de/#"]')) {
        const url = new URL(link.href);
        const html = await (await fetch(url.pathname)).text();
        if (!new DOMParser().parseFromString(html, 'text/html').getElementById(url.hash.slice(1))) missing.push(url.hash);
      }
      return missing;
    });
    assert.deepEqual(missingAnchors, [], 'Every overview link points to a real destination anchor');
    const weekly = page.locator('.plan-weekly');
    assert.equal(await weekly.getAttribute('open'), null);
    await weekly.locator(':scope > summary').focus();
    await page.keyboard.press('Enter');
    assert.notEqual(await weekly.getAttribute('open'), null);
    assert.ok((await weekly.innerText()).includes('Woche 3:'));
    await page.keyboard.press('Enter');
    await fits(page);
    await capture(page, 'hilfe-mobil');
    await page.setViewportSize({ width: 1280, height: 900 });
    await fits(page);
    await capture(page, 'hilfe-desktop');
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => document.documentElement.style.fontSize = '225%');
    await fits(page);
    await capture(page, 'hilfe-320-grossschrift');
    assert.deepEqual(errors, []);
    // Existing destination and actual input; no care text is passed in the URL.
    await ownHelp.click();
    await page.locator('#translator-input').waitFor();
    assert.equal(new URL(page.url()).search, '');
    assert.equal(await page.locator('#translator-input').getAttribute('maxlength'), '200');
  } finally { await context.close(); }
});

for (const state of ['signed-out', 'no-subscription', 'error']) test(`subscriber overview stays protected for ${state}`, async () => {
  const { context, page } = await pageFor(state);
  try {
    await page.goto(`${base}/abo/mein-plan.html`);
    const visible = state === 'no-subscription' ? '#no-subscription' : '#signed-out';
    await page.locator(visible + ':not([hidden])').waitFor();
    assert.equal(await page.locator('#plan').isVisible(), false);
    if (state === 'error') assert.equal(await page.locator('#error').isVisible(), true);
  } finally { await context.close(); }
});

test('unknown selection is clearly an example, while a name renders as text', async () => {
  const { context, page, errors } = await pageFor('active', { name: '<img src=x onerror=alert(1)>', situation: 'andere' });
  try {
    await page.goto(`${base}/abo/mein-plan.html`);
    await page.locator('#plan:not([hidden])').waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Ein Beispiel für den Anfang', exact: true }).count(), 1);
    assert.equal(await page.locator('#plan img').count(), 0);
    assert.ok((await page.locator('#plan').innerText()).includes('<img src=x onerror=alert(1)>'));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('questionnaire preserves the chosen moment through offer, plan selection and checkout handoff', async () => {
  const { context, page, errors } = await pageFor();
  try {
    await offer(page, 'nachhause');
    assert.equal(await page.locator('#screen h1').innerText(), 'Passende Worte für euren Alltag');
    assert.ok((await page.locator('#screen .start-card').first().innerText()).includes('Ich will nach Hause.'));
    assert.equal(await page.locator('.start-hero').count(), 0, 'No unproven before/after improvement graphic');
    assert.ok((await page.locator('[data-start-fine]').first().innerText()).includes('verlängert sich'));
    await fits(page);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await capture(page, 'angebot-mobil');
    await page.setViewportSize({ width: 1280, height: 900 });
    await fits(page);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await capture(page, 'angebot-desktop');
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => document.documentElement.style.fontSize = '225%');
    await fits(page);
    await capture(page, 'angebot-320-grossschrift');
    await page.locator('[data-plan="monthly"]').first().click();
    assert.equal(await page.locator('[data-plan="monthly"][aria-checked="true"]').count(), 2);
    assert.ok((await page.locator('[data-start-fine]').first().innerText()).includes('12,99'));
    await page.getByRole('button', { name: 'Persönliche Hilfe starten', exact: true }).first().click();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('demenzCoachPlan')))).situation, 'nachhause');
    assert.deepEqual(await page.evaluate(() => window.testCheckout), { plan: 'monthly', email: 'synthetic@example.invalid' });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const outcome of ['pending', 'failed', 'paid', 'trialing']) test(`actual payment return shows personal help only after verified ${outcome}`, async () => {
  const { context, page, errors } = await pageFor();
  const requests = [];
  const active = outcome === 'paid' || outcome === 'trialing';
  try {
    await context.route('https://www.gstatic.com/firebasejs/**', (route) => route.fulfill({ contentType: 'text/javascript', body:
      route.request().url().endsWith('firebase-app.js')
        ? 'export const initializeApp = () => ({});'
        : `export const getAuth = () => ({}); export const getRedirectResult = async () => null;
           export function onAuthStateChanged(auth, callback) { queueMicrotask(() => callback({ isAnonymous: true, getIdToken: async () => 'synthetic_owner_token' })); return () => {}; }` }));
    await context.route('**/session-status?*', (route) => {
      requests.push(route.request().headers().authorization);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'complete', outcome, active }) });
    });
    await context.route('**/entitlement', (route) => route.fulfill({ contentType: 'application/json', body: '{"active":false}' }));
    await page.goto(`${base}/abo/?status=fertig&session_id=cs_synthetic`);
    if (active) await page.locator('#done-plan:not([hidden])').waitFor();
    else await page.waitForFunction(() => !document.getElementById('payment-status-retry').disabled);
    assert.equal(await page.locator('#done-plan').isVisible(), active);
    assert.equal(await page.locator('#done-plan-link').isVisible(), active);
    assert.deepEqual(requests, ['Bearer synthetic_owner_token']);
    if (active) assert.equal(await page.locator('#done-plan-link').innerText(), 'Zu deiner persönlichen Hilfe');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('homepage keeps the input first and its personal-help entry retains the source', async () => {
  const { context, page, errors } = await pageFor();
  try {
    await page.goto(`${base}/de/`);
    await page.locator('.consent-decline').click();
    assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'Was soll ich sagen?');
    const input = await page.locator('#translator-input').boundingBox();
    const situations = await page.locator('#home-situations-title').boundingBox();
    assert.ok(input.y < situations.y, 'Input precedes the situation list');
    const link = page.locator('[data-related-link="plan_home"]');
    assert.equal(await link.innerText(), 'Persönliche Hilfe ansehen');
    assert.equal(await link.getAttribute('href'), '/start/?src=home');
    await fits(page);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => document.documentElement.style.fontSize = '225%');
    await fits(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
    await page.locator('#plan').scrollIntoViewIfNeeded();
    if (await page.locator('.translator-chat-close').isVisible()) await page.locator('.translator-chat-close').click();
    await capture(page, 'home-einstieg-mobil');
    await link.click();
    await page.locator('body[data-screen="relation"]').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('src'), 'home');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
