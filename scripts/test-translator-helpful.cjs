const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(process.env.SITE_ROOT || path.join(__dirname, '..'));
const screenshots = process.env.SCREENSHOT_DIR;
const os = require('node:os');
const helpfulKey = 'demenzcoach.helpfulAnswers.v1';
const phraseKey = 'demenzcoach.savedPhrases.v1';
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
  let checks = 0;
  const profiles = [];
  let context;
  try {
    for (const width of [390, 1280]) {
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'helpful-answers-test-')); profiles.push(profile);
      let sent = [], feedback = [], safetyLevel = 'standard', pageErrors = [];
      const start = async () => {
        context = await chromium.launchPersistentContext(profile, { headless: true,
          executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
        await context.addInitScript(({ helpfulKey }) => {
          localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
          localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
          const set = Storage.prototype.setItem, get = Storage.prototype.getItem, remove = Storage.prototype.removeItem;
          Storage.prototype.setItem = function (key, value) {
            if (key === helpfulKey && window.__storageFault === 'write') throw new DOMException('test quota', 'QuotaExceededError');
            return set.call(this, key, value);
          };
          Storage.prototype.getItem = function (key) {
            if (key === helpfulKey && window.__storageFault === 'readback') return null;
            return get.call(this, key);
          };
          Storage.prototype.removeItem = function (key) {
            if (key === helpfulKey && window.__storageFault === 'delete') throw new DOMException('test denied', 'SecurityError');
            return remove.call(this, key);
          };
        }, { helpfulKey });
        await context.route('**/*', route => {
          const request = route.request(), url = new URL(request.url());
          if (url.pathname.endsWith('/translator-web/feedback')) { feedback.push(request.postDataJSON()); return route.fulfill({ json: { ok: true } }); }
          if (url.pathname.endsWith('/translator-web')) {
            const body = request.postDataJSON(); sent.push(body);
            if (safetyLevel === 'safety') return route.fulfill({ json: { kind: 'safety' } });
            const english = body.language === 'en';
            return route.fulfill({ json: { kind: 'answer', meaning: english ? 'Anna needs something familiar.' : 'Anna sucht etwas Vertrautes.',
              phrases: [english ? 'I am here with you.' : 'Ich bin bei dir.'], avoid: english ? 'That is not true.' : 'Das stimmt nicht.',
              nextStep: english ? 'Sit down together.' : 'Setz dich kurz dazu.', safetyLevel,
              safetyMessage: safetyLevel === 'standard' ? null : english ? 'Please get local help.' : 'Bitte hole örtliche Hilfe.',
              share: { sentence: 'Ich will nach Hause.', token: 'qa-share-data-not-to-save', stored: true } } });
          }
          if (url.origin !== base || ['image', 'font', 'media'].includes(request.resourceType())) return route.abort();
          return route.continue();
        });
        const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => pageErrors.push(error.message));
        return page;
      };
      let page = await start();
      const home = async (language = 'de', target = page) => { await target.goto(base + (language === 'en' ? '/en/dementia-translator/' : '/de/'), { waitUntil: 'domcontentloaded' }); };
      const store = async () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), helpfulKey);
      const overview = () => page.locator('.translator-helpful');
      const open = async ({ ai = false, language = 'de' } = {}) => {
        await home(language);
        await page.locator('#translator-input').fill(ai ? language === 'en' ? 'The curtain hums like a refrigerator. QA_PRIVATE_INPUT' : 'Der Vorhang summt wie ein Kühlschrank. QA_PRIVATE_INPUT' : language === 'en' ? 'Where is my mother?' : 'Wo ist meine Mutter?');
        await page.locator('#translator-input').press('Enter');
        if (!ai && language === 'de') await page.locator('.translator-goal').first().click();
        await page.locator('.translator-feedback').first().waitFor();
      };
      const mark = async (language = 'de') => { await page.getByRole('button', { name: language === 'en' ? 'Yes, save' : 'Ja, merken', exact: true }).click();
        await page.getByText(language === 'en' ? 'Answer saved.' : 'Antwort gemerkt.', { exact: true }).waitFor(); };
      await home();
      const legacy = JSON.stringify([{ key: 'mutter', says: 'Wo ist meine Mutter?', text: 'Ich bin bei dir.' }]);
      await page.evaluate(({ phraseKey, legacy }) => localStorage.setItem(phraseKey, legacy), { phraseKey, legacy });
      assert.equal(await store(), null); assert.equal(await overview().isVisible(), false);
      checks++;
      await open();
      await page.getByText('„Ja, merken“ speichert die Antwort in diesem Browser, sichtbar für alle, die ihn nutzen.', { exact: true }).waitFor();
      assert.equal(await store(), null); await mark();
      const catalog = await store(); assert.deepEqual(catalog.items, [{ kind: 'catalog', language: 'de', key: 'mutter', goal: 'jetzt' }]); checks++;
      await open(); await mark(); assert.equal((await store()).items.length, 1); checks++;
      await open({ ai: true }); await mark();
      const data = await store(); assert.equal(data.items.length, 2); assert.equal(data.items[0].kind, 'ai');
      assert.deepEqual(Object.keys(data.items[0].answer), ['meaning', 'phrases', 'avoid', 'nextStep', 'safetyLevel']);
      assert.equal(JSON.stringify(data).includes('QA_PRIVATE_INPUT'), false); assert.equal(JSON.stringify(data).includes('qa-share-data'), false);
      assert.equal(data.items[0].answer.meaning.includes('Anna'), true, 'snapshots may contain personal details; never claim anonymity');
      assert.equal(await page.evaluate(key => localStorage.getItem(key), phraseKey), legacy); checks++;
      await context.close(); page = await start(); sent = []; feedback = [];
      await home(); await overview().waitFor(); assert.equal(await overview().locator('.translator-helpful-open').count(), 2);
      assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('.translator-helpful'))), false);
      assert.equal(sent.length, 0); assert.equal(feedback.length, 0); checks++;
      const bounds = await overview().evaluate(node => ({ width: window.innerWidth, right: node.getBoundingClientRect().right,
        buttons: [...node.querySelectorAll('button')].map(b => ({ h: b.getBoundingClientRect().height, right: b.getBoundingClientRect().right })),
        removeArrow: getComputedStyle(node.querySelector('.translator-helpful-remove'), '::after').display }));
      assert.ok(bounds.right <= bounds.width + 1 && bounds.buttons.every(b => b.h >= 44 && b.right <= bounds.width + 1));
      assert.equal(bounds.removeArrow, 'none');
      if (screenshots) { fs.mkdirSync(screenshots, { recursive: true }); await overview().screenshot({ path: path.join(screenshots, `helpful-return-${width}.png`) }); }
      if (width === 390) {
        await page.setViewportSize({ width: 320, height: 1000 });
        await page.addStyleTag({ content: 'html{font-size:200% !important}' });
        assert.equal(await overview().evaluate(node => [...node.querySelectorAll('button')].every(b => b.getBoundingClientRect().right <= innerWidth + 1)), true);
        await overview().scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('.translator-chat')?.hidden === true);
        assert.equal(await page.locator('.translator-chat').isVisible(), false); checks++;
        if (screenshots) await overview().screenshot({ path: path.join(screenshots, 'helpful-return-320-font200.png') });
        await page.locator('footer').scrollIntoViewIfNeeded();
        await page.locator('.translator-chat:not([hidden])').waitFor();
        await page.locator('.translator-chat-input').fill('QA unsent draft');
        await page.evaluate(() => document.querySelector('.translator-helpful').scrollIntoView());
        assert.equal(await page.locator('.translator-chat-input').inputValue(), 'QA unsent draft');
        assert.equal(await page.locator('.translator-chat-input').isVisible(), true); checks++;
        await page.setViewportSize({ width, height: 1000 });
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
      await overview().getByRole('button', { name: /^Antwort öffnen: Gemerkte KI-Antwort/u }).click();
      await page.locator('.translator-ai-label').getByText('Gemerkte KI-Antwort. Prüfe, ob sie noch zu eurer Situation passt.', { exact: true }).waitFor();
      assert.equal(await page.locator('.translator-ai-answer .translator-phrases q').textContent(), 'Ich bin bei dir.');
      assert.equal(await page.locator('.translator-ai-answer .translator-notes').count(), 1);
      assert.equal(await page.locator('.translator-ai-answer .translator-feedback').count(), 0);
      assert.equal(sent.length, 0); assert.equal(feedback.length, 0); checks++;
      await home(); await overview().locator('.translator-helpful-open').last().click();
      await page.locator('#translator-result .translator-phrases').waitFor(); assert.equal(sent.length, 0); checks++;
      await home(); await overview().locator('.translator-helpful-remove').first().click(); assert.equal((await store()).items.length, 1);
      assert.equal(await page.evaluate(() => document.activeElement.classList.contains('translator-helpful-open')), true); checks++;
      await overview().getByRole('button', { name: 'Alle hilfreichen Antworten löschen', exact: true }).click();
      assert.equal(await store(), null); assert.equal(await overview().isVisible(), false);
      assert.equal(await page.locator('#translator-input').evaluate(node => node === document.activeElement), true);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), phraseKey), legacy); checks++;
      if (width === 390) {
        await open(); await mark(); await home(); await overview().locator('.translator-helpful-remove').click();
        assert.equal(await store(), null); assert.equal(await page.locator('#translator-input').evaluate(node => node === document.activeElement), true); checks++;
        await open(); await page.evaluate(() => { window.__storageFault = 'write'; });
        await page.getByRole('button', { name: 'Ja, merken', exact: true }).click();
        await page.getByText('Das Merken konnte nicht bestätigt werden. Bitte erneut versuchen.', { exact: true }).waitFor();
        assert.equal(await store(), null); await page.evaluate(() => { window.__storageFault = ''; }); await mark(); checks++;
        await home(); await page.evaluate(() => { window.__storageFault = 'delete'; });
        await overview().getByRole('button', { name: 'Alle hilfreichen Antworten löschen', exact: true }).click();
        await page.getByText('Das Löschen konnte nicht bestätigt werden.', { exact: true }).waitFor(); assert.equal((await store()).items.length, 1);
        await page.evaluate(() => { window.__storageFault = ''; }); await overview().getByRole('button', { name: 'Alle hilfreichen Antworten löschen', exact: true }).click(); checks++;
        await open(); await page.evaluate(() => { window.__storageFault = 'readback'; });
        await page.getByRole('button', { name: 'Ja, merken', exact: true }).click();
        await page.getByText('Das Merken konnte nicht bestätigt werden. Bitte erneut versuchen.', { exact: true }).waitFor();
        await page.evaluate(() => { window.__storageFault = ''; }); assert.equal((await store()).items.length, 1); checks++;
        await page.evaluate(key => localStorage.setItem(key, '{broken'), helpfulKey); await home();
        await overview().getByText('Die gemerkten Antworten konnten nicht gelesen werden.', { exact: true }).waitFor();
        await overview().getByRole('button', { name: 'Alle hilfreichen Antworten löschen', exact: true }).click(); assert.equal(await store(), null); checks++;
        const unsafeKey = await page.evaluate(() => JSON.parse(document.getElementById('translator-data').textContent).entries.find(e => e.safety && !e.safetyOnly).key);
        await page.evaluate(({ key, unsafeKey }) => localStorage.setItem(key, JSON.stringify({ version: 1, items: [
          { kind: 'catalog', language: 'de', key: 'no-longer-in-catalog', goal: '' }, { kind: 'catalog', language: 'de', key: unsafeKey, goal: 'jetzt' },
          { kind: 'ai', language: 'de', answer: { meaning: 'No.', phrases: ['No.'], avoid: 'No.', nextStep: '', safetyLevel: 'urgent' } },
          { kind: 'ai', language: 'de', answer: { meaning: 'No.', phrases: ['No.'], avoid: 'No.', nextStep: '', safetyLevel: 'standard', input: 'must reject' } }
        ] })), { key: helpfulKey, unsafeKey });
        await home(); await overview().getByText('Die gemerkten Antworten konnten nicht gelesen werden.', { exact: true }).waitFor();
        await overview().getByRole('button', { name: 'Alle hilfreichen Antworten löschen', exact: true }).click(); assert.equal(await store(), null); checks++;
        await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, items: [
          { kind: 'ai', language: 'de', answer: { meaning: 'No.', phrases: ['No.'], avoid: 'No.', nextStep: '', safetyLevel: 'standard', input: 'must reject' } }
        ] })), helpfulKey);
        await home(); await overview().getByText('Die gemerkten Antworten konnten nicht gelesen werden.', { exact: true }).waitFor();
        await overview().getByRole('button', { name: 'Alle hilfreichen Antworten löschen', exact: true }).click(); assert.equal(await store(), null); checks++;
        await page.evaluate(({ key, unsafeKey }) => localStorage.setItem(key, JSON.stringify({ version: 1, items: [
          { kind: 'catalog', language: 'de', key: 'no-longer-in-catalog', goal: '' }, { kind: 'catalog', language: 'de', key: unsafeKey, goal: 'jetzt' }
        ] })), { key: helpfulKey, unsafeKey });
        await home(); assert.equal(await overview().locator('.translator-helpful-open').count(), 0);
        assert.equal(await overview().getByText('Diese vorbereitete Antwort ist nicht mehr verfügbar.', { exact: true }).count(), 2); checks++;
        const safeAI = { kind: 'ai', language: 'de', answer: { meaning: 'Ein gespeicherter Text.', phrases: ['<img src=x onerror="window.__unsafe=1">'], avoid: 'Nein.', nextStep: '', safetyLevel: 'standard' } };
        await page.evaluate(({ key, safeAI }) => localStorage.setItem(key, JSON.stringify({ version: 1, items: [safeAI] })), { key: helpfulKey, safeAI });
        await home(); await overview().locator('.translator-helpful-open').click();
        assert.equal(await page.locator('.translator-ai-answer img').count(), 0); assert.equal(await page.evaluate(() => window.__unsafe), undefined); checks++;
        await home(); await overview().getByRole('button', { name: 'Alle hilfreichen Antworten löschen', exact: true }).click();
        const second = await context.newPage(); second.setDefaultTimeout(12000); await home('de', second);
        await open(); await mark(); await second.locator('.translator-helpful').waitFor();
        assert.equal(await second.locator('.translator-helpful-open').count(), 1); assert.equal(await second.evaluate(() => Boolean(document.activeElement.closest('.translator-helpful'))), false);
        await home(); await overview().locator('.translator-helpful-open').focus();
        await second.getByRole('button', { name: 'Alle hilfreichen Antworten löschen', exact: true }).click();
        await page.waitForFunction(() => document.activeElement === document.getElementById('translator-input'));
        assert.equal(await store(), null); await second.close(); checks++;
        const twenty = Array.from({ length: 20 }, (_, i) => ({ ...safeAI, answer: { ...safeAI.answer, phrases: [`Satz ${i}.`] } }));
        await page.evaluate(({ key, items }) => localStorage.setItem(key, JSON.stringify({ version: 1, items })), { key: helpfulKey, items: twenty });
        await open({ ai: true }); await mark(); assert.equal((await store()).items.length, 20); assert.equal((await store()).items[0].answer.phrases[0], 'Ich bin bei dir.'); checks++;
        await home(); await overview().getByRole('button', { name: 'Alle hilfreichen Antworten löschen', exact: true }).click();
        for (const level of ['concern', 'urgent', 'safety']) {
          safetyLevel = level; await home(); await page.locator('#translator-input').fill('Der Vorhang summt wie ein Kühlschrank.'); await page.locator('#translator-input').press('Enter');
          await page.waitForFunction(() => !document.querySelector('.translator-ai'));
          assert.equal(await page.getByRole('button', { name: 'Ja, merken', exact: true }).count(), 0); assert.equal(await store(), null);
        } safetyLevel = 'standard'; checks++;
        await home();
        await page.evaluate(() => {
          const original = window.DemenzTranslatorCore.match;
          window.DemenzTranslatorCore.match = (...args) => ({ ...original(...args), entry: null, safetyHit: true, context: null, protection: null, feeling: null });
        });
        await page.locator('#translator-input').fill('Ein unbekannter Sicherheitshinweis.'); await page.locator('#translator-input').press('Enter');
        await page.locator('.translator-ai-answer').waitFor();
        assert.equal(await page.getByRole('button', { name: 'Ja, merken', exact: true }).count(), 0, 'a standard model label cannot override a local safety hit');
        assert.equal(await store(), null); checks++;
        await page.goto(`${base}/de/?situation=${unsafeKey}&ziel=jetzt`, { waitUntil: 'domcontentloaded' });
        await page.locator('#translator-result .translator-feedback').waitFor(); assert.equal(await page.getByRole('button', { name: 'Ja, merken', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Ja', exact: true }).click(); assert.equal(await store(), null); checks++;
        await open({ ai: true, language: 'en' }); await mark('en'); await home('en');
        await overview().getByRole('heading', { name: 'Your helpful answers', exact: true }).waitFor();
        await overview().getByRole('button', { name: /^Open answer: Saved AI answer/u }).click();
        await page.locator('.translator-ai-label').getByText('Saved AI answer. Check whether it still fits your situation.', { exact: true }).waitFor(); checks++;
      }
      assert.deepEqual(pageErrors, []); console.log(JSON.stringify({ width, checks, status: 'PASS' }));
      await context.close(); context = null;
    }
    console.log(JSON.stringify({ checks, status: 'PASS', mode: 'Synthetic browser-local storage, persistent return and blocked external services' }));
  } finally {
    if (context) await context.close();
    await new Promise(resolve => server.close(resolve));
    for (const profile of profiles) fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
