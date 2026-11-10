// Actual cancellation pages; all API and third-party requests are intercepted.
// No live account, cancellation, refund, email, credential or Stripe call.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const message = 'Deine Erklärung ist eingegangen. Die Bearbeitung ist noch nicht vollständig abgeschlossen.';
const base = { received: true, confirmed: true, id: 'test-eingang', receivedAtText: '10. November 2026, 09:00 Uhr', kindText: 'Ordentliche Kündigung', name: 'Test Nutzer', email: 'test@example.invalid', confirmByMail: false };
const success = { status: 200, body: base };
const partial = { status: 202, body: { ...base, processingIncomplete: true, processingState: 'needs_review', failedAccounts: [{ accountID: 'acct_internal_fixture' }], debug: 'must_not_render_fixture' } };
const server = http.createServer((request, response) => {
  try {
    const filename = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!filename.startsWith(root + path.sep)) throw new Error('invalid path');
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(filename)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type }); response.end(fs.readFileSync(filename));
  } catch { response.writeHead(404); response.end(); }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser; let cases = 0;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    async function fixture(mode, replies, width = 390) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const calls = []; const errors = [];
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === origin) return route.continue();
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (request.method() === 'POST' && /\/v1\/web-checkout\/cancel(?:\/confirm)?$/u.test(url.pathname)) {
          calls.push({ path: url.pathname, body: request.postDataJSON() });
          const reply = replies.shift();
          if (!reply) return route.fulfill({ status: 500, headers, json: { code: 'unexpected_test_request' } });
          return route.fulfill({ status: reply.status, headers, json: reply.body });
        }
        return route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const url = mode === 'form' ? '/abo/kuendigen.html' : '/abo/kuendigung-bestaetigen.html?id=test-id&t=test-token';
      await page.goto(origin + url);
      async function submit(key = 'Enter') {
        if (mode === 'form') {
          await page.locator('#name').fill(base.name); await page.locator('#email').fill(base.email);
        }
        await page.locator(mode === 'form' ? '#cancel-button' : '#confirm').focus();
        await page.keyboard.press(key);
      }
      async function done(incomplete) {
        await page.locator(mode === 'form' ? '#cancel-done' : '#done').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#done-title').innerText(), incomplete ? 'Eingang bestätigt' : mode === 'form' ? 'Kündigung erhalten' : 'Bestätigt');
        const text = await page.locator(mode === 'form' ? '#done-mail' : '#done-message').innerText();
        if (incomplete) assert.equal(text, message);
        else assert.doesNotMatch(text, /noch nicht vollständig/u);
        assert.equal(await page.locator('#done-time').innerText(), base.receivedAtText);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'done-title');
        assert.doesNotMatch(await page.locator('body').innerText(), /acct_internal_fixture|must_not_render_fixture|failedAccounts|processingIncomplete|needs_review/u);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.deepEqual(errors, []);
      }
      return { context, page, calls, errors, submit, done };
    }

    for (const width of [390, 1280]) for (const mode of ['form', 'confirm']) for (const incomplete of [false, true]) {
      const f = await fixture(mode, [incomplete ? partial : success], width);
      try {
        assert.equal(f.calls.length, 0, 'loading must not mutate');
        await f.submit(); await f.done(incomplete);
        assert.equal(f.calls.length, 1);
        if (mode === 'confirm') assert.deepEqual(f.calls[0].body, { id: 'test-id', token: 'test-token' });
        else { assert.equal(f.calls[0].body.name, base.name); assert.equal(f.calls[0].body.kind, 'ordentlich'); }
        if (incomplete && width === 390 && process.env.SCREENSHOT_DIR) {
          fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
          await f.page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `cancellation-${mode}-202-mobile.png`), fullPage: true });
        }
        cases++;
      } finally { await f.context.close(); }
    }

    for (const mode of ['form', 'confirm']) {
      const f = await fixture(mode, [partial, success]);
      try {
        await f.submit(); await f.done(true);
        await f.page.reload();
        assert.equal(f.calls.length, 1, 'reload must not repeat a cancellation');
        await f.submit('Space'); await f.done(false);
        assert.equal(f.calls.length, 2, 'retry needs an explicit keyboard action');
        if (mode === 'confirm') assert.deepEqual(f.calls[1].body, f.calls[0].body);
        cases++;
      } finally { await f.context.close(); }
    }

    const awaitingMail = await fixture('form', [{ status: 200, body: { ...base, confirmByMail: true } }]);
    try {
      await awaitingMail.submit();
      await awaitingMail.page.locator('#cancel-done').waitFor({ state: 'visible' });
      assert.equal(await awaitingMail.page.locator('#done-title').innerText(), 'Kündigung erhalten');
      assert.equal(await awaitingMail.page.locator('#done-confirm').isVisible(), true);
      assert.equal(await awaitingMail.page.locator('#done-mail').isVisible(), false);
      assert.equal(awaitingMail.calls.length, 1, 'email confirmation must not be submitted automatically');
      cases++;
    } finally { await awaitingMail.context.close(); }

    for (const mode of ['form', 'confirm']) {
      const f = await fixture(mode, [{ status: 503, body: { code: 'unavailable', message: 'must_not_render_fixture' } }, success]);
      try {
        await f.submit();
        await f.page.locator(mode === 'form' ? '#cancel-error' : '#error').waitFor({ state: 'visible' });
        assert.equal(await f.page.locator(mode === 'form' ? '#cancel-button' : '#confirm').isEnabled(), true);
        assert.equal(await f.page.locator(mode === 'form' ? '#cancel-done' : '#done').isVisible(), false);
        assert.doesNotMatch(await f.page.locator('body').innerText(), /must_not_render_fixture/u);
        await f.submit('Space'); await f.done(false);
        assert.equal(f.calls.length, 2); cases++;
      } finally { await f.context.close(); }
    }

    const expired = await fixture('confirm', [{ status: 410, body: { code: 'link_expired' } }]);
    try {
      await expired.submit(); await expired.page.locator('#error').waitFor({ state: 'visible' });
      assert.match(await expired.page.locator('#error').innerText(), /Dieser Link ist abgelaufen\. Deine Erklärung liegt uns trotzdem vor/u);
      assert.equal(await expired.page.locator('#done').isVisible(), false);
      assert.equal(expired.calls.length, 1); cases++;
    } finally { await expired.context.close(); }
    console.log(JSON.stringify({ passed: cases, scope: '200/202 form+confirmation, mobile+desktop, keyboard, reload, explicit token retry, errors, no internal details', realMutations: 0 }));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
