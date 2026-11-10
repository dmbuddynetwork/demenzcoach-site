const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(process.env.SITE_ROOT || path.join(__dirname, '..'));
const screenshots = process.env.SCREENSHOT_DIR;
const candidate = process.env.TRANSLATOR_CANDIDATE;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try { if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream'); res.end(fs.readFileSync(target));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  let checks = 0;
  let backend;
  if (process.env.FEEDBACK_BACKEND_DIR) {
    const { pathToFileURL } = require('node:url');
    const dir = pathToFileURL(path.resolve(process.env.FEEDBACK_BACKEND_DIR) + path.sep);
    backend = { ...(await import(new URL('server.mjs', dir))), ...(await import(new URL('translator-web.mjs', dir))) };
  }
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
        localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
      });
      let requests = [], mode = 'ok', release, answerRequests = 0, storedReasons = [];
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.endsWith('/translator-web/feedback')) {
          requests.push({ body: req.postDataJSON(), headers: req.headers() });
          let result = { status: mode === 'fail' ? 503 : 200, body: { ok: true } };
          if (backend) {
            await backend.handleRequest({ method: 'POST', url: '/v1/translator-web/feedback', headers: { origin: base, 'content-type': 'application/json' }, socket: { remoteAddress: 'browser-test' }, body: req.postDataJSON() }, {
              setHeader() {}, writeHead(s) { result.status = s; }, end(s) { result.body = JSON.parse(s); }
            }, { apiKey: '', translatorWebOrigins: [base], translatorFeedbackStore: { async record(reason) {
              if (mode === 'fail') throw new Error('test storage unavailable');
              storedReasons.push(reason);
            } } });
          }
          if (mode === 'hold') await new Promise(resolve => { release = resolve; });
          if (mode === 'network') return route.abort('failed');
          return route.fulfill({ status: result.status, json: mode === 'malformed' ? { ok: false } : result.body });
        }
        if (url.pathname.endsWith('/translator-web')) {
          answerRequests++;
          if (req.postDataJSON().text === 'Er ist bewusstlos') return route.fulfill({ json: { kind: 'safety' } });
          return route.fulfill({ json: { kind: 'answer', meaning: 'Sie sucht etwas Vertrautes.', phrases: ['Ich bin bei dir.'], avoid: 'Das stimmt nicht.', nextStep: 'Setz dich kurz dazu.', safetyLevel: 'standard', safetyMessage: null } });
        }
        if (url.origin !== base || ['image', 'font', 'media'].includes(req.resourceType())) return route.abort();
        if (candidate && url.pathname.endsWith('/demenz-uebersetzer/translator.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(candidate, 'utf8') });
        return route.continue();
      });
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      const open = async (language = 'de', ai = false) => {
        requests = []; answerRequests = 0; storedReasons = []; backend?.resetTranslatorWebLimitsForTests();
        await page.goto(base + (language === 'en' ? '/en/dementia-translator/' : '/de/'), { waitUntil: 'domcontentloaded' });
        await page.locator('#translator-input').fill(ai ? 'Der Vorhang summt wie ein Kühlschrank.' : language === 'en' ? 'Where is my mother?' : 'Wo ist meine Mutter?');
        await page.locator('#translator-input').press('Enter');
        if (!ai && language === 'de') { await page.locator('.translator-goal').first().click(); }
        await page.locator('.translator-feedback').first().waitFor();
      };
      const feedback = () => page.locator('.translator-feedback').first();
      await open();
      const answer = await page.locator('#translator-result .translator-phrases').first().innerText();
      await feedback().getByRole('button', { name: 'Nein', exact: true }).click();
      await feedback().getByText('Was hat nicht gepasst?', { exact: true }).waitFor();
      assert.equal(requests.length, 0); assert.equal(answerRequests, 0); checks++;
      mode = 'hold';
      const choice = feedback().getByRole('button', { name: 'Die Situation wurde falsch verstanden.', exact: true });
      await choice.focus(); await page.keyboard.press('Enter');
      await feedback().getByRole('status').getByText('Wird gespeichert …', { exact: true }).waitFor();
      await choice.evaluate(n => n.click());
      assert.equal(requests.length, 1); assert.deepEqual(requests[0].body, { reason: 'situation_mismatch' });
      if (backend) assert.deepEqual(storedReasons, ['situation_mismatch']);
      assert.equal(requests[0].headers.cookie, undefined); assert.equal(requests[0].headers.referer, undefined); checks++;
      release();
      await feedback().getByRole('status').getByText('Danke, deine Auswahl wurde gespeichert.', { exact: true }).waitFor();
      assert.equal(await choice.evaluate(n => n === document.activeElement), true);
      await feedback().getByRole('button', { name: 'Die Formulierung passte nicht.', exact: true }).evaluate(n => n.click());
      assert.equal(requests.length, 1); assert.equal(answerRequests, 0);
      assert.equal(await page.locator('#translator-result .translator-phrases').first().innerText(), answer); checks++;
      if (screenshots) { fs.mkdirSync(screenshots, { recursive: true }); await feedback().screenshot({ path: path.join(screenshots, `feedback-saved-${width}.png`) }); }
      for (const failedMode of ['fail', 'network', 'malformed']) {
        mode = failedMode; await open(); await feedback().getByRole('button', { name: 'Nein', exact: true }).click();
        await feedback().getByRole('button', { name: 'Die Formulierung passte nicht.', exact: true }).click();
        await feedback().getByRole('status').getByText('Bestätigung fehlt. Bitte versuche es erneut.', { exact: true }).waitFor();
        assert.equal(requests.length, 1); assert.deepEqual(requests[0].body, { reason: 'wording_mismatch' }); assert.equal(answerRequests, 0);
        mode = 'ok'; await feedback().getByRole('button', { name: 'Die Formulierung passte nicht.', exact: true }).click();
        await feedback().getByRole('status').getByText('Danke, deine Auswahl wurde gespeichert.', { exact: true }).waitFor(); assert.equal(requests.length, 2); checks++;
      }
      mode = 'ok'; await open(); await feedback().getByRole('button', { name: 'Nein', exact: true }).click();
      await feedback().getByRole('button', { name: 'Ohne Auswahl weiter', exact: true }).click(); assert.equal(requests.length, 0); assert.equal(answerRequests, 0); checks++;
      await open('en'); await feedback().getByRole('button', { name: 'No', exact: true }).click();
      await feedback().getByRole('button', { name: 'The wording did not fit.', exact: true }).click();
      await feedback().getByRole('status').getByText('Thank you. Your choice has been saved.', { exact: true }).waitFor(); assert.deepEqual(requests[0].body, { reason: 'wording_mismatch' }); checks++;
      await open('de', true);
      assert.equal(answerRequests, 1);
      const aiAnswer = await page.locator('.translator-ai-answer .translator-phrases').innerText();
      await feedback().getByRole('button', { name: 'Nein', exact: true }).click();
      await feedback().getByRole('button', { name: 'Die Formulierung passte nicht.', exact: true }).click();
      await feedback().getByRole('status').getByText('Danke, deine Auswahl wurde gespeichert.', { exact: true }).waitFor();
      assert.equal(answerRequests, 1); assert.deepEqual(requests[0].body, { reason: 'wording_mismatch' });
      assert.equal(await page.locator('.translator-ai-answer .translator-phrases').innerText(), aiAnswer); checks++;
      await page.goto(base + '/de/', { waitUntil: 'domcontentloaded' }); requests = []; answerRequests = 0;
      await page.locator('#translator-input').fill('Er ist bewusstlos'); await page.locator('#translator-input').press('Enter');
      await page.locator('#translator-result .safety-urgent').first().waitFor();
      await page.waitForFunction(() => !document.querySelector('.translator-ai'));
      if (await feedback().count()) await feedback().getByRole('button', { name: 'Nein', exact: true }).click();
      assert.equal(await feedback().getByText('Was hat nicht gepasst?', { exact: true }).count(), 0);
      assert.equal(requests.length, 0); assert.equal(answerRequests, 1); checks++;
      console.log(JSON.stringify({ width, checks, status: 'PASS' }));
      await context.close();
    }
    console.log(JSON.stringify({ checks, mode: backend ? 'synthetic browser with actual backend route and fake reason store; no external services' : 'synthetic browser; all external services blocked or stubbed', status: 'PASS' }));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
