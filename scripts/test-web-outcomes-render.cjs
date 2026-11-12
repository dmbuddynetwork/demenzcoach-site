// Bounded actual UI replay. Recorded German provider content is kept unchanged;
// English DTOs, access metadata and warning/continuation probes are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const recorded = JSON.parse(fs.readFileSync(process.env.OUTCOMES_REPLAY_FILE, 'utf8'));
const evidence = process.env.OUTCOMES_EVIDENCE;
const approved = JSON.parse(fs.readFileSync(process.env.GENERAL_INFO_APPROVED_FILE, 'utf8'));
const caseByID = id => recorded.cases.find(c => c.id === id);
const postfix = JSON.parse(fs.readFileSync(process.env.FOLLOWUP_REPLAY_FILE, 'utf8'));
const realPause = postfix.cases.find(c => c.id === 'G26-POSTFIX-F1');
const realPerception = postfix.cases.find(c => c.id === 'G20-POSTFIX-F1');
const clone = value => JSON.parse(JSON.stringify(value));
const english = {
  input: { text: 'A controlled situation for the English interface.' },
  requests: [
    { stage: 'goals', response: { kind: 'goals', contract: 'outcomes-v1', selectionMode: 'guessed', goals: [{ goal: 'act_now', label: 'Keep my own boundary clear' }] } },
    { stage: 'answer_1', selectedGoal: { id: 'act_now', label: 'Keep my own boundary clear' }, response: { kind: 'self_support', meaning: 'Controlled English interface fixture.', steps: ['A controlled first step.', 'A controlled second step.'], avoid: 'A controlled unhelpful thought.', nextStep: 'A controlled next step.', safetyLevel: 'standard', safetyMessage: null } }
  ]
};
(async () => {
  let preview, browser;
  const report = { providerCalls: 0, realAuthActions: 0, profiles: [], errors: [], recordedResultsSHA256: recorded.sourceResultsSHA256,
    limits: 'German care text replays real backend results. English, access, warning race, canonical-info injections and200char limit probes are controlled fixtures, not model evidence. Initial cbda questions and0569postfix real followups are explicitly from separate captures. Static presets deliberately retain their reviewed local flow.' };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    for (const language of ['de', 'en']) for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        const calls = [];
        let current = language === 'de' ? caseByID('G01') : clone(english), followup = false, controlledWarning = false, controlledInfo = false, controlledQuestion = false;
        const allowance = { enabled: true, verified: true, paid: false, used: 0, remaining: 4, anonymousAnswers: 1, registeredAdditional: 3, signupPlacement: 'after-first' };
        await context.addInitScript(() => { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); });
        await context.route('**/*', async route => {
          const req = route.request(), url = new URL(req.url());
          if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: "export async function webAuth(){return{auth:{currentUser:{uid:'outcome-fixture',isAnonymous:false,emailVerified:true,getIdToken:async()=>'fixture-only'}},sdk:{}}}" });
          if (url.hostname.endsWith('cloudfunctions.net') && url.pathname.includes('/translator-web')) {
            if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
            if (url.pathname.endsWith('/access')) return route.fulfill({ json: { ...allowance, contract: 'signup-bonus-v1', signupCopy: { variant: 'variant_1' } } });
            assert.equal(url.searchParams.get('goal_contract'), 'outcomes-v1');
            const body = req.postDataJSON(); calls.push({ path: url.pathname, query: url.search, body });
            let response;
            if (url.pathname.endsWith('/goals')) {
              response = followup ? realPause.requests[0].response : current.requests[0].response;
            } else {
              assert.equal(url.searchParams.get('response_contract'), 'clarification-v1');
              const match = current.requests.find(r => r.selectedGoal?.id === body.goal?.id && r.selectedGoal?.label === body.goal?.label);
              response = followup ? realPause.requests[1].response : current.id === 'G20' && body.text !== current.input.text ? realPerception.requests[0].response : match?.response;
              assert.ok(response, 'A response must match the actual selected id and label');
              response = { ...response, access: { ...allowance, used: 1, remaining: 3 } };
              if (controlledWarning && body.goal.id === current.requests[0].response.goals[0].goal) response = { ...response, safetyLevel: 'concern', safetyMessage: 'Kontrollierter bereits empfangener Hinweis bleibt erhalten.' };
            }
            if (controlledInfo && !url.pathname.endsWith('/goals')) response = { ...response, generalSafetyInfo: { topic: 'swallowing', text: approved[language] } };
            if (controlledQuestion && !url.pathname.endsWith('/goals')) response = { kind: 'clarification', question: 'Welche Angabe fehlt noch?', meaning: 'Kontrollierte Rückfrage zur Darstellung.', nextStep: 'Ergänze die Angabe.', safetyLevel: 'standard', safetyMessage: null, generalSafetyInfo: { topic: 'swallowing', text: approved[language] } };
            return route.fulfill({ json: response });
          }
          return url.origin === preview.origin ? route.continue() : route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        page.on('pageerror', e => report.errors.push(e.message));
        const home = async () => { await page.goto(`${preview.origin}/${language}/`); await page.waitForFunction(() => !!window.DemenzTranslatorAI && document.querySelector('#translator-input')); };
        const submit = async item => { current = clone(item); followup = false; controlledWarning = false; controlledInfo = false; controlledQuestion = false; await home(); await page.locator('#translator-input').fill(item.input.text); await page.locator('#translator-form').evaluate(f => f.requestSubmit()); };
        const answer = () => page.locator('.translator-ai-answer').waitFor();
        const settleMotion = () => page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().iterations)).map(a => a.finished.catch(() => {}))); });
        const profile = { language, width, cases: [] };
        if (language === 'de') {
          await submit(caseByID('G01'));
          await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          assert.equal(await page.locator('.translator-ai-goal-choice').count(), 1);
          assert.equal(await page.locator('.translator-ai-answer').count(), 0, 'A guessed single goal still requires a click');
          await page.locator('.translator-ai-goal-choice').click(); await answer();
          assert.equal(await page.locator('.translator-ai-answer .translator-phrase').count(), 2);
          profile.cases.push('actual G01 guessed single requires confirmation; two phrases');
          await submit(caseByID('G03')); await answer();
          assert.ok(await page.locator('.translator-selected-goal').isVisible());
          assert.ok(await page.locator('.translator-own-goal-details summary').isVisible());
          profile.cases.push('actual G03 explicit goal directly answered with correction control');
          await submit(caseByID('G11'));
          await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          controlledWarning = true;
          await page.locator('.translator-ai-goal-choice').first().click(); await answer();
          const supportGoal = current.requests.find(r => r.response.kind === 'self_support').selectedGoal;
          await page.getByRole('button', { name: supportGoal.label, exact: true }).click(); await page.locator('.translator-ai-self-support').waitFor();
          assert.equal(await page.locator('.translator-ai-self-support q').count(), 0);
          assert.equal(await page.locator('.translator-self-support-steps li').count(), current.requests.find(r => r.response.kind === 'self_support').response.steps.length);
          assert.match(await page.locator('[data-goal-safety-history]').innerText(), /Kontrollierter bereits empfangener Hinweis/);
          assert.equal(await page.locator('.translator-ai-self-support').getByRole('button', { name: 'Ja, merken', exact: true }).count(), 0);
          const before = calls.length;
          await page.getByRole('button', { name: current.requests[0].response.goals[0].label, exact: true }).click(); await answer();
          await page.getByRole('button', { name: supportGoal.label, exact: true }).click(); await page.locator('.translator-ai-self-support').waitFor();
          assert.equal(calls.length, before, 'A→B→A reuses care content without another charged request');
          profile.cases.push('actual G11 support steps and alternatives; controlled warning retained; cache');
          await settleMotion();
          if (evidence) await page.screenshot({ animations: 'disabled', path: path.join(evidence, `support-de-${width}.png`), fullPage: false });
          // Canonical metadata injection is synthetic; the underlying German care response stays recorded.
          await submit(caseByID('G11')); controlledInfo = true;
          await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          await page.locator('.translator-ai-goal-choice').first().click(); await answer();
          const infoText = () => page.locator('.translator-general-safety-info p').last().innerText();
          assert.equal(await infoText(), approved.de);
          assert.equal(await page.locator('.translator-general-safety-info.safety-note, .translator-general-safety-info a[href^="tel:"]').count(), 0);
          await page.getByRole('button', { name: 'Ja, merken', exact: true }).click();
          await page.getByText('Antwort gemerkt.', { exact: true }).waitFor();
          const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('demenzcoach.helpfulAnswers.v1')));
          assert.ok(stored.items[0].answer.meaning.endsWith(approved.de));
          assert.deepEqual(Object.keys(stored.items[0].answer), ['meaning', 'phrases', 'avoid', 'nextStep', 'safetyLevel']);
          const infoSupport = current.requests.find(r => r.response.kind === 'self_support').selectedGoal;
          await page.getByRole('button', { name: infoSupport.label, exact: true }).click(); await page.locator('.translator-ai-self-support').waitFor();
          assert.equal(await infoText(), approved.de);
          const infoCalls = calls.length;
          await page.getByRole('button', { name: current.requests[0].response.goals[0].label, exact: true }).click(); await answer();
          assert.equal(calls.length, infoCalls); assert.equal(await infoText(), approved.de);
          await home(); await page.locator('.translator-helpful-open').first().click(); await answer();
          assert.equal(await infoText(), approved.de);
          profile.cases.push('synthetic canonical general info stays neutral, complete in support, cache and V1 saved answer');
          await submit(caseByID('G03')); controlledQuestion = true;
          await page.locator('.translator-clarification-form').waitFor();
          assert.equal(await infoText(), approved.de);
          profile.cases.push('synthetic canonical general info complete before answer clarification');
          await submit(caseByID('G26'));
          await page.locator('.translator-goal-clarification').waitFor();
          assert.equal(await page.locator('.translator-ai-answer').count(), 0);
          assert.ok((await page.locator('.translator-ai-status').innerText()).includes(current.requests[0].response.question));
          const beforeLong = calls.length;
          const room = 199 - Array.from(current.input.text).length;
          assert.match(await page.locator('.translator-goal-clarification .translator-clarification-budget').innerText(), new RegExp(`bis zu ${room} Zeichen`));
          await page.locator('.translator-goal-clarification textarea').fill('x'.repeat(room + 1));
          await page.locator('.translator-goal-clarification button').click();
          assert.equal(calls.length, beforeLong);
          assert.equal(await page.locator('.translator-goal-clarification textarea').inputValue(), 'x'.repeat(room + 1));
          assert.match(await page.locator('.translator-ai-status').innerText(), /1 Zeichen zu lang/);
          const detail = realPause.input.text.slice(current.input.text.length + 1);
          await page.locator('.translator-goal-clarification textarea').fill(detail); followup = true;
          await page.locator('.translator-goal-clarification button').click(); await answer();
          const secondGoals = calls.filter(c => c.path.endsWith('/goals')).at(-1);
          assert.equal(secondGoals.body.text, current.input.text + '\n' + detail);
          assert.equal(calls.at(-1).body.text, secondGoals.body.text);
          assert.notEqual(calls.at(-1).body.goal.id, 'custom');
          assert.equal(calls.at(-1).body.text, realPause.input.text);
          assert.equal(await page.locator('.translator-self-support-steps li').count(), realPause.requests[1].response.steps.length);
          profile.cases.push('cbda G26 planning question plus actual0569postfix continuation, full195char text; oversize rejected without losing draft');
          await submit(caseByID('G20'));
          await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          await page.getByRole('button', { name: realPerception.requests[0].selectedGoal.label, exact: true }).click();
          await page.locator('.translator-clarification-detail').waitFor();
          const extra = realPerception.input.text.slice(current.input.text.length + 1);
          await page.locator('.translator-clarification-detail').fill(extra);
          await page.locator('.translator-clarification-form button[type="submit"]').click(); await answer();
          assert.equal(calls.at(-1).body.text, realPerception.input.text);
          assert.deepEqual(calls.at(-1).body.goal, realPerception.requests[0].selectedGoal);
          profile.cases.push('cbda G20 clarification plus actual0569postfix continuation preserves160char full text and selected goal');
          const noRoom = clone(caseByID('G26')); noRoom.input.text = 'a'.repeat(200);
          await submit(noRoom); await page.locator('.translator-goal-clarification').waitFor();
          assert.match(await page.locator('.translator-clarification-budget').innerText(), /bis zu 0 Zeichen/);
          assert.match(await page.locator('.translator-clarification-budget').innerText(), /ursprüngliche Situation/);
          const noRoomCalls = calls.length;
          await page.locator('.translator-goal-clarification textarea').fill('b');
          await page.locator('.translator-goal-clarification button').click();
          assert.equal(calls.length, noRoomCalls);
          profile.cases.push('synthetic200char original reports zero room, no truncation and no unsupported followup');
          await submit(caseByID('G06'));
          await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          assert.equal(calls.at(-1).body.text, current.input.text);
          profile.cases.push('typed known home-wish uses versioned AI goals');
          await home(); const presetCalls = calls.length;
          await page.getByRole('link', { name: 'Will nach Hause', exact: true }).click();
          await page.locator('.translator-change-goal > summary').click();
          assert.equal(await page.locator('.translator-change-goal .translator-ai-goal-choice').count(), 3);
          await page.locator('.translator-change-goal .translator-ai-goal-choice').first().click();
          assert.equal(calls.length, presetCalls, 'A deliberately opened static preset does not invoke paid AI');
          profile.cases.push('static home-wish preset retains three local reviewed categories, zero AI');
        } else {
          await submit(english); controlledInfo = true; await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          assert.equal(await page.locator('.translator-ai-answer').count(), 0);
          await page.locator('.translator-ai-goal-choice').click(); await page.locator('.translator-ai-self-support').waitFor();
          assert.equal(await page.locator('.translator-ai-self-support').getByRole('heading', { name: 'What can help you now', exact: true }).count(), 1);
          assert.equal(await page.locator('.translator-general-safety-info p').innerText(), approved.en);
          assert.equal(await page.locator('.translator-general-safety-info.safety-note, .translator-general-safety-info a[href^="tel:"]').count(), 0);
          assert.equal(calls.at(-1).body.language, 'en'); assert.equal(await page.locator('.translator-ai-self-support q').count(), 0);
          await settleMotion();
          if (evidence) await page.screenshot({ animations: 'disabled', path: path.join(evidence, `support-en-${width}.png`), fullPage: false });
          profile.cases.push('synthetic English locale support labels, confirmed single goal and wire language');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'No horizontal page overflow');
        profile.requests = calls.length; report.profiles.push(profile);
      } finally { await context.close(); }
    }
    assert.deepEqual(report.errors, []); report.passed = true;
    if (evidence) fs.writeFileSync(path.join(evidence, 'RENDER-REPORT.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
