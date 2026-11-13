const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const root = path.resolve(__dirname, '..');
const evidence = process.env.GOAL_FLOW_EVIDENCE;
const goals = {
  de: [{ goal: 'act_now', label: 'Mein Eis für mich behalten' }, { goal: 'understand', label: 'Das Verhalten besser verstehen' }, { goal: 'organize', label: 'Tipps für getrennte Portionen' }],
  en: [{ goal: 'act_now', label: 'Keep my own portion' }, { goal: 'understand', label: 'Understand what happened' }, { goal: 'organize', label: 'Tips for separate portions' }]
};
const answer = {
  kind: 'answer', safetyLevel: 'standard', safetyMessage: null,
  meaning: 'Deine eigene Portion darf dir wichtig sein. Eine ruhige Grenze kann den Streit um das Eis vermeiden.',
  phrases: ['Das ist meine Portion. Für dich steht hier eine eigene Schale.'],
  avoid: 'Du nimmst mir immer alles weg!', nextStep: 'Stelle eure Portionen in zwei getrennte Schalen.',
  share: { sentence: 'FIXTURE ONLY', token: 'NOT A REAL TOKEN', stored: true }
};
(async () => {
  let preview, browser;
  const report = { mode: 'offline rendered UI contract; provider responses mocked', cases: [], providerCalls: 0, errors: [] };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer({ root });
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    for (const language of ['de', 'en']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const requests = [];
      let failWorkImage = true, workImageFailures = 0;
      let goalMode = 'normal';
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
            if (url.pathname.endsWith('/access')) return route.fulfill({ headers: cors, json: { enabled: true, needsSession: true, contract: 'signup-bonus-v1' } });
            const body = request.postDataJSON(); requests.push({ path: url.pathname, body });
            const goalRequest = url.pathname.endsWith('/goals');
            if (goalRequest && goalMode === 'error') return route.fulfill({ status: 502, headers: cors, body: '{}' });
            const value = body.text === 'GuardFixture'
              ? { kind: 'safety', safetyLevel: 'urgent', message: 'Existing safety guidance' }
              : goalRequest && goalMode === 'empty' ? { kind: 'goals', goals: [], noSituation: true }
              : goalRequest && goalMode === 'contradictory' ? { kind: 'goals', goals: goals[language], noSituation: true }
              : goalRequest ? { kind: 'goals', goals: goals[language], noSituation: false } : answer;
            return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(value) });
          }
          if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: 'export async function webAuth(){return {auth:{currentUser:null},sdk:{}}}' });
          if (url.origin !== preview.origin) return route.abort();
          if (failWorkImage && url.pathname.endsWith('/work.webp')) {
            workImageFailures++; return route.fulfill({ status: 404, body: '' });
          }
          return route.continue();
        });
        const page = await context.newPage(); page.setDefaultTimeout(12000);
        page.on('pageerror', e => report.errors.push(e.message));
        await page.goto(preview.origin + '/' + language + '/', { waitUntil: 'networkidle' });
        const input = page.locator('#translator-input');
        const submit = async text => { if (await input.isVisible()) { await input.fill(text); await page.locator('#translator-form [type="submit"]').click(); } else { await page.locator('.translator-chat-input').fill(text); await page.locator('.translator-chat-send').click(); } };
        const ready = () => page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
        await submit('sie ist mein eis weg'); await ready();
        assert.equal(requests.length, 1); assert.ok(requests[0].path.endsWith('/goals'));
        assert.equal(requests[0].body.share, false); assert.equal(requests[0].body.goal, undefined);
        assert.equal(await page.locator('.translator-ai-answer').count(), 0, 'No advice before the explicit goal choice');
        assert.equal(await page.locator('.translator-ai-goal-choice').count(), 3);
        assert.equal(await page.locator('.translator-ai-goal-retry').isVisible(), false, 'Retry is only visible after a goal-loading error');
        assert.equal(await page.locator('.translator-chat-input').isVisible(), true, 'A different situation can be entered directly');
        assert.ok((await page.locator('.translator-said-art').getAttribute('src')).endsWith('/chat-helferin-fragend-lossless.png'));
        if (evidence && language === 'de') {
          for (const width of [390, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            await page.screenshot({ path: path.join(evidence, `goals-${width}.png`), fullPage: false });
          }
        }
        await page.locator('.translator-ai-goal-choice').first().click();
        await page.locator('.translator-ai-answer').waitFor();
        assert.equal(requests.length, 2); assert.equal(requests[1].body.share, false);
        assert.deepEqual(requests[1].body.goal, { id: goals[language][0].goal, label: goals[language][0].label });
        assert.ok((await page.locator('.translator-ai-goals-selected > h2').innerText()).includes(goals[language][0].label));
        const resultText = await page.locator('#translator-result').innerText();
        assert.doesNotMatch(resultText, /Zur Verbesserung des Übersetzers|Nicht speichern|sichtbar für alle|visible to anyone/);
        const spacing = await page.locator('.translator-ai-answer').evaluate(node => {
          const phrases = node.querySelector('.translator-phrases'), headings = node.querySelectorAll('.translator-step');
          return headings[1].getBoundingClientRect().top - phrases.getBoundingClientRect().bottom;
        });
        assert.ok(spacing >= 20, 'Readable space between the answer sections');
        if (evidence && language === 'de') {
          for (const width of [390, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForTimeout(4000);
            assert.equal(await page.locator('.translator-chat-input').isVisible(), true, 'The directly editable composer stays available');
            if (width === 390) assert.equal(await page.locator('.translator-chat-open').isVisible(), false, 'The compact launcher cannot cover the mobile answer either');
            await page.screenshot({ path: path.join(evidence, `answer-${width}.png`), fullPage: false });
          }
        }
        if (language === 'de') {
          assert.equal(await page.locator('.translator-chat-panel').isVisible(), true, 'Deliberate chat opening still works');
          await page.getByRole('button', { name: 'Ja, merken', exact: true }).click();
          await page.getByText('Antwort gemerkt.', { exact: true }).waitFor();
          await page.locator('.translator-chat-input').fill('Ich muss zur Arbeit.');
          await page.locator('.translator-chat-send').click(); await ready();
          assert.equal(await page.locator('.translator-chat-input').isVisible(), true, 'The composer stays available during goal selection');
          assert.equal(requests.length, 3, 'A library keyword still requests AI goals');
          assert.equal(await page.locator('.translator-ai-answer').count(), 0);
          await page.waitForFunction(() => document.querySelector('.translator-said-art')?.src.endsWith('/chat-helferin-fragend-lossless.png')).catch(async error => {
            console.error(JSON.stringify({ workImageFailures, image: await page.locator('.translator-said-art').evaluate(n => ({ src: n.src, complete: n.complete, width: n.naturalWidth })) }));
            throw error;
          });
          assert.ok(workImageFailures >= 1, 'The mapped image really fails to load');
          const image = page.locator('.translator-said-art');
          await image.evaluate(node => node.dispatchEvent(new Event('error')));
          assert.equal(await image.isVisible(), false, 'A failed fallback does not cause a retry loop');
          assert.equal(await page.locator('.translator-own-goal input').isVisible(), true, 'Custom goal is directly visible without expanding a disclosure');
          await page.getByLabel('Was möchtest du erreichen?', { exact: true }).fill('Ich möchte erst verstehen, was sie meint');
          await page.getByRole('button', { name: 'Antwort zu meinem Ziel', exact: true }).click();
          await page.locator('.translator-ai-answer').waitFor();
          assert.deepEqual(requests[3].body.goal, { id: 'custom', label: 'Ich möchte erst verstehen, was sie meint' });
          goalMode = 'error';
          await submit('Der Pullover kratzt.');
          await page.locator('.translator-ai-goals[data-goal-state="unavailable"]').waitFor();
          assert.equal(await page.locator('.translator-ai-answer').count(), 0);
          assert.equal(await page.locator('.translator-ai-goal-retry').isVisible(), true);
          goalMode = 'normal';
          await page.locator('.translator-ai-goal-retry').click(); await ready();
          for (const mode of ['empty', 'contradictory']) {
            goalMode = mode; await submit('Der Pullover kratzt.');
            await page.locator(`.translator-ai-goals[data-goal-state="${mode === 'empty' ? 'needs-situation' : 'unavailable'}"]`).waitFor();
            assert.equal(await page.locator('.translator-ai-answer').count(), 0);
            if (mode === 'empty') assert.equal(await page.locator('.translator-own-goal').isVisible(), false);
          }
          goalMode = 'normal';
          await page.setViewportSize({ width: 320, height: 900 });
          await page.addStyleTag({ content: 'html{font-size:200%}' });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          await submit('GuardFixture');
          await page.locator('#translator-result > .safety-urgent').waitFor();
          assert.equal(await page.locator('.translator-ai-goal-choice').count(), 0);
          assert.equal(await page.locator('.translator-ai-answer').count(), 0);
        }
        assert.ok(requests.every(r => r.body.share === false));
        report.cases.push({ language, requestCount: requests.length, beforeGoalNoAdvice: true, explicitGoalBound: true,
          noticesRemoved: true, missingMappingFallback: true, mappedImageErrorFallback: language === 'de', savedAnswersPreserved: language === 'de' });
      } finally { await context.close(); }
    }
    assert.deepEqual(report.errors, []); report.passed = true;
    if (evidence) fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
