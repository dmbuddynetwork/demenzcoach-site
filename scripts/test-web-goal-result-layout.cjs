// Real Chrome UI; all AI traffic is synthetic and never reaches a provider.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const evidence = process.env.GOAL_LAYOUT_EVIDENCE;
const goals = [
  { goal: 'act_now', label: 'Mein Eis selbst behalten' },
  { goal: 'understand', label: 'Mein ganzes Eis abgeben' },
  { goal: 'organize', label: 'Einen Teil meines Eises teilen' }
];
(async () => {
  let browser, preview;
  const report = { providerCalls: 0, mode: 'Synthetic responses in Google Chrome', cases: [], errors: [] };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    for (const language of ['de', 'en']) for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        const requests = [];
        await context.addInitScript(() => {
          localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
          localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
        });
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.pathname.includes('/v1/translator-web')) {
            const body = route.request().postDataJSON(); requests.push(body);
            if (url.pathname.endsWith('/goals')) return route.fulfill({ json: { kind: 'goals', goals, noSituation: false } });
            const value = body.goal.id === 'organize'
              ? { kind: 'clarification', question: 'Was genau möchtest du ändern?', meaning: 'Diese Angabe hilft, deine Situation besser zu verstehen.', nextStep: 'Beschreibe bitte die noch fehlende Angabe.', safetyLevel: 'standard', safetyMessage: null }
              : { kind: 'answer', meaning: 'Vielleicht möchte sie ebenfalls etwas Eis essen.', phrases: ['Wir nehmen uns beide eine kleine Portion.'], nextStep: 'Fülle zwei kleine Portionen in getrennte Schalen.', avoid: 'Du isst immer alles weg!', safetyLevel: 'standard', safetyMessage: null };
            return route.fulfill({ json: value });
          }
          return url.origin === preview.origin ? route.continue() : route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        page.on('pageerror', error => report.errors.push(error.message));
        await page.goto(preview.origin + '/' + language + '/');
        await page.locator('#translator-input').fill('Sie will mein ganzes Eis essen.');
        await page.locator('#translator-form [type=submit]').click();
        const choices = page.locator('.translator-ai-goal-choice');
        await choices.nth(0).click(); await page.locator('.translator-ai-answer').waitFor();
        const heading = page.locator('.translator-selected-goal');
        assert.match(await heading.innerText(), /Mein Eis selbst behalten/);
        const goalStyle = await heading.evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, icon: getComputedStyle(node, '::before').backgroundImage }));
        assert.equal(goalStyle.color, 'rgb(29, 94, 51)'); assert.equal(goalStyle.background, 'rgb(231, 244, 234)'); assert.match(goalStyle.icon, /svg/);
        assert.equal(await choices.nth(0).isVisible(), false);
        assert.equal(await page.locator('.translator-other-goals .translator-ai-goal-choice:visible').count(), 2);
        assert.equal(await page.locator('.translator-ai-goals .translator-change-goal').count(), 0);
        assert.equal(await page.locator('.translator-ai-answer > .translator-ai-label').count(), 0);
        const meaning = page.locator('.translator-ai-meaning');
        assert.equal(await meaning.isVisible(), true);
        assert.equal(await meaning.evaluate(node => node.previousElementSibling.tagName), 'H3');
        assert.equal(await meaning.evaluate(node => Boolean(node.closest('details'))), false);
        const layout = await page.locator('.translator-other-goals').evaluate(node => ({ top: node.getBoundingClientRect().top, answerBottom: document.querySelector('.translator-ai-answer').getBoundingClientRect().bottom }));
        assert.ok(layout.top >= layout.answerBottom, 'Other goals follow the complete answer');
        const offer = page.locator('.translator-goal-answer .ki-angebot');
        if (await offer.count()) assert.ok((await offer.boundingBox()).y >= (await page.locator('.translator-other-goals').boundingBox()).y, 'Goal choices precede the account offer');
        for (const choice of await page.locator('.translator-other-goals .translator-ai-goal-choice:visible').all()) assert.ok((await choice.boundingBox()).height >= 44);
        if (evidence && language === 'de') await page.evaluate(() => scrollTo(0,0));
        if (evidence && language === 'de') await page.screenshot({ path: path.join(evidence, `TESTFIXTURE-answer-${width}.png`), fullPage: true });
        await choices.nth(1).click(); await page.locator('.translator-ai-answer').waitFor();
        assert.match(await heading.innerText(), /Mein ganzes Eis abgeben/);
        assert.equal(await choices.nth(0).isVisible(), true); assert.equal(await choices.nth(1).isVisible(), false);
        await choices.nth(0).click(); await page.locator('.translator-ai-answer').waitFor();
        assert.equal(requests.length, 3, 'A → B → A reuses the existing answer');
        await choices.nth(2).click(); await page.locator('.translator-clarification-form').waitFor();
        const frames = await page.locator('.translator-ai-clarification').evaluate(node => {
          const result = []; for (let current = node; current && current.id !== 'translator-result'; current = current.parentElement) {
            const style = getComputedStyle(current); if (parseFloat(style.borderTopWidth) > 0) result.push(current.className);
          } return result;
        });
        assert.deepEqual(frames, [], 'No nested card frames around the clarification form');
        assert.equal(await page.locator('.translator-clarification-detail').isVisible(), true);
        assert.equal(await page.locator('.translator-clarification-detail').getAttribute('placeholder'), language === 'de' ? 'Ergänze nur die nötige Angabe.' : 'Add only the detail that is needed.');
        if (evidence && language === 'de') await page.evaluate(() => scrollTo(0,0));
        if (evidence && language === 'de') await page.screenshot({ path: path.join(evidence, `TESTFIXTURE-clarification-${width}.png`), fullPage: true });
        if (width === 390) {
          await page.addStyleTag({ content: 'html{font-size:225%}' });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          assert.equal(await page.locator('.translator-other-goals .translator-ai-goal-choice:visible').count(), 2);
        }
        assert.ok(requests.every(body => body.share === false));
        report.cases.push({ language, width, selectedGoalGreen: true, otherGoalsBelow: true, goalSwitchCached: true, meaningExpanded: true, clarificationFrames: frames.length, requests: requests.length });
      } finally { await context.close(); }
    }
    assert.deepEqual(report.errors, []); report.passed = true;
    if (evidence) fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
