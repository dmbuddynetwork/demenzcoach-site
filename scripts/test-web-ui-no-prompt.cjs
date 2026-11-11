const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const core = require('../demenz-uebersetzer/translator-core.js');
const root = path.resolve(__dirname, '..');
const evidence = process.env.UI_FIX_EVIDENCE;
const data = JSON.parse(fs.readFileSync(path.join(root, 'de/index.html'), 'utf8').match(/id="translator-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const negative = 'Mein Vater hat keine Luftnot. Er wird nur beim Anziehen schnell müde.';
const coreCases = [
  [negative, false],
  ['Er bekommt keine Luft mehr.', true],
  ['Er hat Luftnot.', true],
  ['Er hat keine Luftnot, aber er bekommt keine Luft mehr.', true],
  ['Er hat keine Luftnot, aber jetzt hat sie Luftnot.', true]
];
for (const [text, expected] of coreCases) assert.equal(core.match(text, data).safetyHit, expected, text);
const duplicateText = 'Meine Mutter ist seit heute plötzlich viel verwirrter als sonst.';
const labels = {
  de: ['Jetzt ruhig begleiten', 'Die aktuelle Lage verstehen', 'Tipps für den Alltag'],
  en: ['Offer calm support now', 'Understand the current situation', 'Tips for everyday care']
};
const answer = {
  kind: 'answer', safetyLevel: 'standard', safetyMessage: null,
  meaning: 'Eine ruhige Begleitung kann im Moment Halt geben.', phrases: ['Ich bin bei dir.'],
  avoid: 'Nun stell dich nicht so an!', nextStep: 'Bleib ruhig bei der Person.'
};
(async () => {
  let preview, browser;
  const report = { mode: 'actual local UI with existing API response contract; mocked responses only', providerCalls: 0,
    coreCases: coreCases.map(([text, safetyHit]) => ({ text, safetyHit })), languages: [] };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer({ root });
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    for (const language of ['de', 'en']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const requests = [], errors = [];
      let duplicateMode = 'identical', retryAnswerCount = 0;
      try {
        await context.addInitScript(() => {
          localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
          localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
        });
        await context.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
          if (url.hostname.endsWith('cloudfunctions.net') && url.pathname.includes('/translator-web')) {
            if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
            const body = request.postDataJSON(), goal = url.pathname.endsWith('/goals'); requests.push({ body, goal });
            let result = goal
              ? { kind: 'goals', noSituation: false, goals: ['act_now', 'understand', 'organize'].map((id, i) => ({ goal: id, label: labels[language][i] })) }
              : body.text === duplicateText
                ? { ...answer, safetyLevel: duplicateMode === 'identical' ? 'urgent' : 'concern', safetyMessage: 'Ein zusätzlicher, anderer Schutzhinweis bleibt erhalten.' }
                : answer;
            if (!goal && body.text === 'RetryFixture') {
              retryAnswerCount++;
              result = { ...answer, safetyLevel: 'urgent', safetyMessage: 'Existing urgent warning',
                phrases: retryAnswerCount === 1 ? [] : answer.phrases };
            }
            return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(result) });
          }
          if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: 'export async function webAuth(){return {auth:{currentUser:null},sdk:{}}}' });
          return url.origin === preview.origin ? route.continue() : route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(12000);
        page.on('pageerror', error => errors.push(error.message));
        const submit = async text => {
          await page.goto(preview.origin + '/' + language + '/', { waitUntil: 'domcontentloaded' });
          await page.locator('#translator-input').fill(text);
          await page.locator('#translator-form button[type="submit"]').click();
        };
        await submit(language === 'de' ? negative : 'She takes my ice cream.');
        await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
        assert.equal(requests.length, 1); assert.equal(requests[0].goal, true);
        assert.equal(await page.locator('#translator-result .safety-urgent').count(), 0);
        assert.equal(await page.locator('.translator-ai-answer').count(), 0);
        await page.locator('.translator-ai-goal-choice').first().click();
        await page.locator('.translator-ai-answer').waitFor();
        assert.equal(requests.length, 2); assert.equal(requests[1].body.goal.label, labels[language][0]);
        await page.locator('.translator-ai-avoid').scrollIntoViewIfNeeded();
        await page.locator('.translator-chat-open').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.translator-chat-open').isVisible(), false, 'Compact avatar cannot cover mobile answer text');
        if (evidence) await page.screenshot({ path: path.join(evidence, `answer-${language}-390.png`) });
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator('.translator-chat-open').click();
        assert.equal(await page.locator('.translator-chat-panel').isVisible(), true);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.translator-chat-close').click();
        await page.waitForFunction(() => document.activeElement.id === 'translator-result');
        await page.locator('.translator-chat-open').waitFor({ state: 'hidden' });
        if (language === 'de') {
          await submit(duplicateText); await page.locator('.translator-ai-answer').waitFor();
          assert.equal(await page.locator('#translator-result .safety-urgent').count(), 1, 'Identical complete warning from local and model paths shown once');
          assert.equal(await page.locator('#translator-result .safety-urgent a[href^="tel:"]').count(), 3, 'Full existing call links retained');
          assert.equal(await page.locator('#translator-result .safety-note').count(), 1);
          assert.equal(await page.locator('.translator-feedback').count(), 0, 'Urgent answer cannot become saveable through deduplication');
          if (evidence) {
            for (const width of [390, 1280]) {
              await page.setViewportSize({ width, height: 900 });
              await page.locator('#translator-result').screenshot({ path: path.join(evidence, `warning-once-${width}.png`) });
            }
          }
          duplicateMode = 'different';
          await submit(duplicateText); await page.locator('.translator-ai-answer').waitFor();
          assert.equal(await page.locator('#translator-result .safety-note').count(), 2, 'Different warnings are never removed');
          assert.ok((await page.locator('#translator-result').innerText()).includes('Ein zusätzlicher, anderer Schutzhinweis bleibt erhalten.'));
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await submit('RetryFixture');
        await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
        await page.locator('.translator-ai-goal-choice').first().click();
        const retry = page.locator('.translator-ai .translator-ai-button');
        await retry.waitFor({ state: 'visible' });
        assert.equal(await page.locator('.translator-ai > .safety-urgent').count(), 1, 'Invalid urgent response keeps a warning inside the retry container');
        assert.equal(await page.locator('.translator-ai-answer').count(), 0);
        await retry.click(); await page.locator('.translator-ai-answer').waitFor();
        assert.equal(retryAnswerCount, 2);
        assert.equal(await page.locator('#translator-result .safety-urgent').count(), 1, 'Replacing the retry container cannot discard its only complete warning');
        assert.equal(await page.locator('.translator-ai-answer .safety-urgent').count(), 1, 'Retried answer owns a connected replacement warning');
        assert.equal(await page.locator('.translator-feedback').count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement.isConnected && document.activeElement.matches('.safety-urgent')), true, 'Manual retry focuses a warning that remains in the DOM');
        if (language === 'de') assert.equal(await page.locator('#translator-result .safety-urgent a[href^="tel:"]').count(), 3);
        if (evidence) await page.locator('#translator-result').screenshot({ path: path.join(evidence, `retry-warning-${language}-390.png`) });
        assert.ok(requests.every(request => request.body.share === false)); assert.deepEqual(errors, []);
        report.languages.push({ language, existingGoalContract: true, explicitGoalBound: true, narrowOverlayPrevented: true,
          deliberateChatOpen: true, closeFocusPreserved: true, warningsChecked: language === 'de', retryWarningPreserved: true,
          retryFocusConnected: true, requestCount: requests.length, pageErrors: errors });
      } finally { await context.close(); }
    }
    report.passed = true;
    if (evidence) fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
