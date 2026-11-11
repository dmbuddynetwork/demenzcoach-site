const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const core = require('../demenz-uebersetzer/translator-core.js');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'de/index.html'), 'utf8').match(/id="translator-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
assert.equal(core.match('Mein Vater hat keine Luftnot. Er wird nur beim Anziehen schnell müde.', data).safetyHit, false);
assert.equal(core.match('Er bekommt keine Luft mehr.', data).safetyHit, true);
assert.equal(core.match('Er hat keine Luftnot, aber er bekommt keine Luft mehr.', data).safetyHit, true);
const duplicateText = 'Meine Mutter ist seit heute plötzlich viel verwirrter als sonst.';
const warning = { de: 'Lass die deutliche Veränderung ärztlich abklären. Bei akuter Gefahr hole sofort örtliche Notfallhilfe.',
  en: 'Please seek medical advice about this clear change. Get local emergency help if anyone may be in danger.' };
const question = { de: 'Wer beschreibt das, und ist tatsächlich jemand im Zimmer?', en: 'Who described this, and is someone actually in the room?' };
const labels = { de: ['Jetzt ruhig begleiten', 'Die aktuelle Lage verstehen', 'Tipps für den Alltag'], en: ['Offer calm support now', 'Understand the current situation', 'Tips for everyday care'] };
const answer = { kind: 'answer', safetyLevel: 'standard', safetyMessage: null, meaning: 'Eine ruhige Begleitung kann im Moment Halt geben.',
  phrases: ['Ich bin bei dir.'], avoid: 'Nun stell dich nicht so an!', nextStep: 'Bleib ruhig bei der Person.' };
(async () => {
  const preview = await createPreviewServer({ root });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const report = { mode: 'local actual rendered UI; mocked provider responses only', providerCalls: 0, languages: [] };
  try {
    for (const language of ['de', 'en']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const requests = [], errors = [];
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
            let result;
            if (!goal) result = body.text.startsWith(duplicateText)
              ? { ...answer, safetyLevel: body.text.endsWith('Specific') ? 'concern' : 'urgent', safetyMessage: warning[language] } : answer;
            else {
              result = { kind: 'goals', noSituation: false, goals: ['act_now', 'understand', 'organize'].map((id, i) => ({ goal: id, label: labels[language][i] })),
                safetyLevel: 'standard', safetyMessage: null, clarificationQuestion: null };
              if (body.text === 'ChangeFixture') result = { ...result, safetyLevel: 'concern', safetyMessage: warning[language] };
              if (body.text === 'ClarifyFixture') result = { ...result, noSituation: true, goals: [], clarificationQuestion: question[language] };
              if (body.text === 'MalformedFixture') result = { ...result, safetyLevel: 'concern', safetyMessage: null };
            }
            return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(result) });
          }
          if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: 'export async function webAuth(){return {auth:{currentUser:null},sdk:{}}}' });
          return url.origin === preview.origin ? route.continue() : route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
        const submit = async text => {
          await page.goto(preview.origin + '/' + language + '/', { waitUntil: 'domcontentloaded' });
          await page.locator('#translator-input').fill(text);
          await page.locator('#translator-form button[type="submit"]').click();
        };
        await submit('ChangeFixture'); await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
        assert.equal(await page.locator('.translator-goal-safety').isVisible(), true);
        const positions = await page.locator('#translator-result').evaluate(node => ({
          warning: node.querySelector('.translator-goal-safety').getBoundingClientRect().top,
          choices: node.querySelector('.translator-ai-goal-choices').getBoundingClientRect().top
        }));
        assert.ok(positions.warning < positions.choices); assert.equal(requests.length, 1); assert.equal(await page.locator('.translator-ai-answer').count(), 0);
        await page.locator('.translator-ai-goal-choice').first().click(); await page.locator('.translator-ai-answer').waitFor();
        assert.equal(await page.locator('#translator-result .safety-note').count(), 1, 'Earlier concern survives a standard final response, once');
        assert.equal(await page.locator('.translator-feedback').count(), 0, 'Concern response is not saved as a standard answer');
        assert.equal(await page.locator('.translator-chat-open').isVisible(), false, 'Compact button does not cover a narrow result');
        assert.equal(requests[1].body.goal.label, labels[language][0]);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator('.translator-chat-open').click();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.translator-chat-close').click();
        await page.waitForFunction(() => document.activeElement.id === 'translator-result');
        await page.locator('.translator-chat-open').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.translator-chat-open').isVisible(), false);
        await submit('ClarifyFixture'); await page.locator('.translator-ai-goals[data-goal-state="needs-situation"]').waitFor();
        assert.equal(await page.locator('.translator-ai-status').innerText(), question[language]);
        assert.equal(await page.locator('.translator-ai-goal-choice').count(), 0); assert.equal(await page.locator('.translator-ai-answer').count(), 0);
        await submit('MalformedFixture'); await page.locator('.translator-ai-goals[data-goal-state="unavailable"]').waitFor();
        assert.equal(await page.locator('.translator-ai-goal-choice').count(), 0);
        if (language === 'de') {
          await submit(duplicateText); await page.locator('.translator-ai-answer').waitFor();
          assert.equal(await page.locator('#translator-result .safety-urgent').count(), 1, 'Exact local/model warning duplicated in46 is shown once');
          assert.equal(await page.locator('#translator-result .safety-urgent a[href^="tel:"]').count(), 3, 'Full existing contacts retained');
          await submit(duplicateText + ' Specific'); await page.locator('.translator-ai-answer').waitFor();
          assert.equal(await page.locator('#translator-result .safety-note').count(), 2, 'Different protective content is never deduplicated');
          assert.ok((await page.locator('#translator-result').innerText()).includes(warning.de));
          await submit('Mein Vater hat keine Luftnot. Er wird nur beim Anziehen schnell müde.');
          await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          assert.equal(requests.at(-1).goal, true); assert.equal(await page.locator('#translator-result .safety-urgent').count(), 0);
        }
        assert.ok(requests.every(request => request.body.share === false)); assert.deepEqual(errors, []);
        report.languages.push({ language, warningBeforeChoice: true, concernPreserved: true, clarificationSpecific: true,
          malformedWarningRejected: true, narrowOverlayPrevented: true, closeFocusPreserved: true, requestCount: requests.length });
      } finally { await context.close(); }
    }
    report.passed = true;
    if (process.env.GOAL_CONTEXT_EVIDENCE) fs.writeFileSync(process.env.GOAL_CONTEXT_EVIDENCE, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { await browser.close(); await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
