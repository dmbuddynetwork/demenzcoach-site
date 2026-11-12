// Bounded actual UI replay. Recorded German provider content is kept unchanged;
// English DTOs, access metadata and warning/continuation probes are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const recorded = JSON.parse(fs.readFileSync(process.env.OUTCOMES_REPLAY_FILE, 'utf8'));
const evidence = process.env.OUTCOMES_EVIDENCE;
const focusedSupport = process.env.OUTCOMES_FOCUSED_SUPPORT === '1';
const approved = JSON.parse(fs.readFileSync(process.env.GENERAL_INFO_APPROVED_FILE, 'utf8'));
const caseByID = id => recorded.cases.find(c => c.id === id);
const finalRecorded = process.env.FINAL_OUTCOMES_REPLAY_FILE ? JSON.parse(fs.readFileSync(process.env.FINAL_OUTCOMES_REPLAY_FILE, 'utf8')) : null;
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
  const report = { providerCalls: 0, realAuthActions: 0, profiles: [], errors: [], recordedResultsSHA256: recorded.sourceResultsSHA256, finalResultsSHA256: finalRecorded?.sourceResultsSHA256 || null,
    limits: 'German care text replays real backend results. English, access, warning race, canonical-info injections and200char limit probes are controlled fixtures, not model evidence. Initial cbda questions and0569postfix real followups are explicitly from separate captures. Static presets deliberately retain their reviewed local flow.' };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    for (const language of (focusedSupport ? ['de'] : ['de', 'en'])) for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        const calls = [];
        let current = language === 'de' ? caseByID('G01') : clone(english), followup = false, controlledWarning = false, controlledInfo = false, controlledQuestion = false, malformedMode = 0, recoverEdited = false, accessMode = '', delayNext = false, releaseHeld;
        const allowance = { enabled: true, verified: true, paid: false, used: 0, remaining: 4, anonymousAnswers: 1, registeredAdditional: 3, signupPlacement: 'after-first' };
        await context.addInitScript(() => { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); });
        await context.route('**/*', async route => {
          const req = route.request(), url = new URL(req.url());
          if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: "export async function webAuth(){globalThis.__outcomeFixtureAuth||={currentUser:{uid:'outcome-fixture',isAnonymous:false,emailVerified:true,getIdToken:async()=>'fixture-only'}};return{auth:globalThis.__outcomeFixtureAuth,sdk:{}}}" });
          if (url.hostname.endsWith('cloudfunctions.net') && url.pathname.includes('/translator-web')) {
            if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
            if (url.pathname.endsWith('/access')) return route.fulfill({ json: { ...allowance, contract: 'signup-bonus-v1', signupCopy: { variant: 'variant_1' } } });
            assert.equal(url.searchParams.get('goal_contract'), 'outcomes-v1');
            const body = req.postDataJSON(); calls.push({ path: url.pathname, query: url.search, body });
            if (!url.pathname.endsWith('/goals')) {
              if (delayNext) { delayNext = false; await new Promise(resolve => { releaseHeld = resolve; }); }
              if (accessMode) return route.fulfill({ status: accessMode === 'payment_required' ? 402 : 503, json: { code: accessMode, access: { ...allowance, remaining: 0 } } });
            }
            let response;
            if (url.pathname.endsWith('/goals')) {
              response = recoverEdited ? { kind: 'goals', contract: 'outcomes-v1', selectionMode: 'explicit', goals: [{ goal: 'act_now', label: 'Ein kontrolliert geklärtes Anliegen' }] } : followup ? realPause.requests[0].response : current.requests[0].response;
            } else {
              assert.equal(url.searchParams.get('response_contract'), 'clarification-v1');
              const match = current.requests.find(r => r.selectedGoal?.id === body.goal?.id && r.selectedGoal?.label === body.goal?.label);
              response = recoverEdited ? { kind: 'self_support', meaning: 'Kontrollierte Darstellung nach bewusstem Neustart.', steps: ['Ein kontrollierter erster Schritt.'], avoid: 'Ein kontrollierter ungünstiger Gedanke.', nextStep: 'Ein kontrollierter nächster Schritt.', safetyLevel: 'standard', safetyMessage: null } : followup ? realPause.requests[1].response : current.id === 'G20' && body.text !== current.input.text ? realPerception.requests[0].response : match?.response;
              assert.ok(response, 'A response must match the actual selected id and label');
              response = { ...response, access: { ...allowance, used: 1, remaining: 3 } };
              if (controlledWarning && body.goal.id === current.requests[0].response.goals[0].goal) response = { ...response, safetyLevel: 'concern', safetyMessage: 'Kontrollierter bereits empfangener Hinweis bleibt erhalten.' };
            }
            if (controlledInfo && !url.pathname.endsWith('/goals')) response = { ...response, generalSafetyInfo: { topic: 'swallowing', text: approved[language] } };
            if (controlledQuestion && !url.pathname.endsWith('/goals')) response = { kind: 'clarification', question: 'Welche Angabe fehlt noch?', meaning: 'Kontrollierte Rückfrage zur Darstellung.', nextStep: 'Ergänze die Angabe.', safetyLevel: 'standard', safetyMessage: null, generalSafetyInfo: { topic: 'swallowing', text: approved[language] } };
            if (malformedMode && !url.pathname.endsWith('/goals')) {
              response = { ...response };
              delete response.generalSafetyInfo;
              if (malformedMode === 1) response = { ...response, meaning: '', generalSafetyInfo: { topic: 'swallowing', text: approved[language] } };
              if (malformedMode === 2) response = { ...response, phrases: [] };
            }
            return route.fulfill({ json: response });
          }
          return url.origin === preview.origin ? route.continue() : route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        page.on('pageerror', e => report.errors.push(e.message));
        const home = async () => { await page.goto(`${preview.origin}/${language}/`); await page.waitForFunction(() => !!window.DemenzTranslatorAI && document.querySelector('#translator-input')); };
        const submit = async item => { current = clone(item); followup = false; controlledWarning = false; controlledInfo = false; controlledQuestion = false; malformedMode = 0; recoverEdited = false; accessMode = ''; delayNext = false; releaseHeld = undefined; await home();
          if (focusedSupport) await page.evaluate(() => {
            const ask = window.DemenzTranslatorAI.ask;
            window.__renderedRawResults = [];
            window.DemenzTranslatorAI.ask = async (...args) => {
              const result = await ask(...args);
              window.__renderedRawResults.push({ kind: result.kind, nextStep: result.nextStep, steps: result.steps, meaning: result.meaning, avoid: result.avoid });
              return result;
            };
          });
          await page.locator('#translator-input').fill(item.input.text); await page.locator('#translator-form').evaluate(f => f.requestSubmit()); };
        const answer = () => page.locator('.translator-ai-answer').waitFor();
        const settleMotion = () => page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().iterations)).map(a => a.finished.catch(() => {}))); });
        const productFrame = async name => {
          await settleMotion();
          await page.locator('.translator-selected-goal').evaluate(el => { const header = document.querySelector('.e-header')?.getBoundingClientRect().height || 70; window.scrollTo({ top: Math.max(0, scrollY + el.getBoundingClientRect().top - header - 16), behavior: 'instant' }); });
          await settleMotion();
          assert.equal(await page.getByText('Kontrollierter bereits empfangener Hinweis bleibt erhalten.', { exact: true }).count(), 0);
          if (evidence) await page.screenshot({ animations: 'disabled', path: path.join(evidence, name), fullPage: false });
        };
        const profile = { language, width, cases: [] };
        if (focusedSupport) {
          assert.ok(finalRecorded, 'Focused previews require the actual final2 recording');
          const normal = finalRecorded.cases.find(c => c.id === 'G03');
          const support = finalRecorded.cases.find(c => c.id === 'G11');
          const supportResponse = support.requests.find(r => r.response.kind === 'self_support');
          const assertSupport = async () => {
            const node = page.locator('.translator-ai-self-support'); await node.waitFor();
            assert.equal(await node.getByRole('heading', { name: 'Das kannst du tun', exact: true }).count(), 0);
            assert.equal(await node.locator('.translator-ai-next').count(), 0);
            assert.deepEqual(await node.locator('.translator-self-support-steps li').allTextContents(), supportResponse.response.steps);
            assert.equal(await node.locator('.translator-ai-meaning').innerText(), supportResponse.response.meaning);
            assert.ok((await node.locator('.translator-ai-avoid').innerText()).includes(supportResponse.response.avoid));
            assert.equal(await page.evaluate(() => window.__renderedRawResults.find(r => r.kind === 'self_support').nextStep), supportResponse.response.nextStep, 'The complete nextStep remains in the untouched transport result');
          };
          await submit(normal); await answer();
          assert.equal(await page.locator('.translator-ai-answer').getByRole('heading', { name: 'Das kannst du tun', exact: true }).count(), 1);
          assert.equal(await page.locator('.translator-ai-next').innerText(), normal.requests[1].response.nextStep);
          if (width === 1280) await productFrame('PRODUCT-PREVIEW-ICE-BOUNDARY-1280.png');
          profile.cases.push('actualfinal2 G03 normal communication keeps complete separate nextStep block');
          await submit(support); controlledWarning = true; controlledInfo = true;
          await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          await page.locator('.translator-ai-goal-choice').first().click(); await answer();
          await page.getByRole('button', { name: supportResponse.selectedGoal.label, exact: true }).click(); await assertSupport();
          assert.match(await page.locator('[data-goal-safety-history]').innerText(), /Kontrollierter bereits empfangener Hinweis/);
          assert.equal(await page.locator('.translator-ai-self-support .translator-general-safety-info p').innerText(), approved.de);
          const cachedCalls = calls.length;
          await page.getByRole('button', { name: support.requests[0].response.goals[0].label, exact: true }).click(); await answer();
          await page.getByRole('button', { name: supportResponse.selectedGoal.label, exact: true }).click(); await assertSupport();
          assert.equal(calls.length, cachedCalls);
          assert.match(await page.locator('[data-goal-safety-history]').innerText(), /Kontrollierter bereits empfangener Hinweis/);
          assert.equal(await page.locator('.translator-ai-self-support .translator-general-safety-info p').innerText(), approved.de);
          profile.cases.push('actualsupport steps/meaning/avoid preserved; nextStep only hidden; controlled canonical info and existing warning survive goal cache');
          await submit(support); await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          await page.getByRole('button', { name: supportResponse.selectedGoal.label, exact: true }).click(); await assertSupport();
          assert.equal(await page.locator('.translator-ai-self-support .translator-general-safety-info').count(), 0);
          if (width === 390) await productFrame('PRODUCT-PREVIEW-SELF-SUPPORT-390.png');
          profile.cases.push('clean actualfinal2 G11 support preview has no duplicate nextStep chapter or synthetic warnings');
        } else if (language === 'de') {
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
          await page.locator('.translator-goal-clarification .translator-clarification-detail').fill('x'.repeat(room + 1));
          await page.locator('.translator-goal-clarification button').click();
          assert.equal(calls.length, beforeLong);
          assert.equal(await page.locator('.translator-goal-clarification .translator-clarification-detail').inputValue(), 'x'.repeat(room + 1));
          assert.match(await page.locator('.translator-ai-status').innerText(), /1 Zeichen zu lang/);
          const detail = realPause.input.text.slice(current.input.text.length + 1);
          await page.locator('.translator-goal-clarification .translator-clarification-detail').fill(detail); followup = true;
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
          for (const originalLength of [199, 200]) {
            const noRoom = clone(caseByID('G26')); noRoom.input.text = 'a'.repeat(originalLength);
            await submit(noRoom); await page.locator('.translator-goal-clarification').waitFor();
            assert.match(await page.locator('.translator-clarification-budget').innerText(), /bis zu 0 Zeichen/);
            const noRoomCalls = calls.length;
            await page.locator('.translator-goal-clarification .translator-clarification-detail').fill('b');
            await page.locator('.translator-goal-clarification button').click();
            assert.equal(calls.length, noRoomCalls);
            await page.locator('.translator-goal-clarification').getByText('Situation bearbeiten', { exact: true }).click();
            const originalField = page.locator('.translator-goal-clarification .translator-clarification-original');
            assert.equal(await originalField.isVisible(), true);
            assert.equal(await originalField.inputValue(), noRoom.input.text);
            assert.equal(await page.locator('.translator-goal-clarification .translator-clarification-detail').inputValue(), 'b');
            await originalField.fill('a'.repeat(198));
            assert.equal(calls.length, noRoomCalls, 'Editing alone never sends or replaces the situation');
            assert.match(await page.locator('.translator-clarification-budget').innerText(), /bis zu 1 Zeichen/);
            recoverEdited = true;
            await page.getByRole('button', { name: 'Mit dieser Situation neu starten', exact: true }).click(); await answer();
            assert.equal(calls.at(-2).body.text, 'a'.repeat(198) + '\nb');
            assert.equal(calls.at(-1).body.text, calls.at(-2).body.text);
            assert.equal(await page.locator('.translator-ai-self-support').count(), 1);
          }
          profile.cases.push('synthetic199/200char planning original: drafts intact, reachable edit, explicit valid200char restart reaches answer');
          await submit(caseByID('G03')); malformedMode = 1;
          await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).waitFor();
          assert.equal(await page.locator('.translator-general-safety-info p').innerText(), approved.de);
          assert.equal(await page.locator('.safety-urgent').count(), 0);
          malformedMode = 2;
          const secondBroken = page.waitForResponse(r => r.url().includes('/translator-web?'));
          await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).click(); await secondBroken;
          await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Noch einmal versuchen' && !b.disabled));
          assert.equal(await page.locator('.translator-general-safety-info p').innerText(), approved.de);
          malformedMode = 3;
          await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).click(); await answer();
          assert.equal(await page.locator('.translator-ai-answer .translator-general-safety-info p').innerText(), approved.de);
          await page.getByRole('button', { name: 'Ja, merken', exact: true }).click(); await page.getByText('Antwort gemerkt.', { exact: true }).waitFor();
          assert.ok(await page.evaluate(text => JSON.parse(localStorage.getItem('demenzcoach.helpfulAnswers.v1')).items[0].answer.meaning.endsWith(text), approved.de));
          profile.cases.push('synthetic malformed meaning+canonical info, malformed phrases retry withoutinfo, then valid answer+saved record retains full canonicalinfo; no false emergency');
          // Do not save until AFTER switching away and returning to the cached answer.
          await page.evaluate(() => localStorage.removeItem('demenzcoach.helpfulAnswers.v1'));
          await submit(caseByID('G11')); malformedMode = 1;
          await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          await page.locator('.translator-ai-goal-choice').first().click();
          await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).waitFor();
          malformedMode = 3;
          await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).click(); await answer();
          const cacheA = current.requests[0].response.goals[0].label;
          const cacheB = current.requests.find(r => r.response.kind === 'self_support').selectedGoal.label;
          await page.getByRole('button', { name: cacheB, exact: true }).click(); await page.locator('.translator-ai-self-support').waitFor();
          const cachedCalls = calls.length;
          await page.getByRole('button', { name: cacheA, exact: true }).click(); await answer();
          assert.equal(calls.length, cachedCalls);
          assert.equal(await page.locator('.translator-ai-answer .translator-general-safety-info p').innerText(), approved.de);
          await page.getByRole('button', { name: 'Ja, merken', exact: true }).click(); await page.getByText('Antwort gemerkt.', { exact: true }).waitFor();
          assert.ok(await page.evaluate(text => JSON.parse(localStorage.getItem('demenzcoach.helpfulAnswers.v1')).items[0].answer.meaning.endsWith(text), approved.de));
          await home(); await page.locator('.translator-helpful-open').first().click(); await answer();
          assert.equal(await page.locator('.translator-ai-answer .translator-general-safety-info p').innerText(), approved.de);
          profile.cases.push('canonical errorA→validretrywithoutinfo→goalB→cachedA→firstbookmark→reopen retains complete info');
          await submit(caseByID('G03')); await answer();
          assert.equal(await page.locator('.translator-ai-answer .translator-general-safety-info').count(), 0, 'A different original situation never inherits prior display metadata');
          await submit(caseByID('G03')); malformedMode = 1;
          await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).waitFor();
          malformedMode = 3; accessMode = 'access_unavailable';
          await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).click();
          await page.locator('.translator-ai .ki-angebot').waitFor();
          assert.equal(await page.locator('.translator-ai .translator-general-safety-info p').innerText(), approved.de);
          assert.equal(await page.locator('div.translator-ai').evaluate(el => Boolean(el.querySelector('.translator-general-safety-info').compareDocumentPosition(el.querySelector('.ki-angebot')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
          // Account identity may change while this same original care flow remains visible.
          await page.evaluate(() => { window.__outcomeFixtureAuth.currentUser = { uid: 'second-controlled-account', isAnonymous: false, emailVerified: true, getIdToken: async () => 'second-fixture-only' }; window.dispatchEvent(new Event('demenz-auth-changed')); });
          accessMode = ''; delayNext = true;
          const pendingRequest = page.waitForRequest(r => r.url().includes('/translator-web?'));
          await page.locator('.translator-ai .ki-angebot').getByRole('button', { name: 'Erneut versuchen', exact: true }).click(); await pendingRequest;
          try {
            for (let attempt = 0; attempt < 30 && !releaseHeld; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
            assert.equal(typeof releaseHeld, 'function');
            assert.equal(await page.locator('.translator-ai .translator-general-safety-info p').innerText(), approved.de);
            assert.equal(await page.locator('.translator-ai .translator-general-safety-info').isVisible(), true);
          } finally { releaseHeld?.(); }
          await answer();
          assert.equal(await page.locator('.translator-ai-answer .translator-general-safety-info p').innerText(), approved.de);
          profile.cases.push('canonical error→accesscard, controlled account change→held pending retry→valid answer keeps care info; entitlement objects not retained');
          await submit(caseByID('G03')); controlledQuestion = true;
          await page.locator('.translator-clarification-detail').waitFor();
          accessMode = 'payment_required';
          await page.locator('.translator-clarification-detail').fill('Eine kontrollierte Ergänzung.');
          await page.locator('.translator-clarification-form button[type="submit"]').click();
          await page.locator('.translator-ai .ki-angebot').waitFor();
          assert.equal(await page.locator('.translator-ai .translator-general-safety-info p').innerText(), approved.de);
          assert.equal(await page.locator('div.translator-ai').evaluate(el => Boolean(el.querySelector('.translator-general-safety-info').compareDocumentPosition(el.querySelector('.ki-angebot')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
          profile.cases.push('canonical clarification→detail→quota accesscard retains full info before card');
          if (finalRecorded) for (const id of ['G01', 'G03', 'G11', 'G26', 'G38']) {
            const fresh = finalRecorded.cases.find(c => c.id === id);
            await submit(fresh);
            const planned = fresh.requests[0].response;
            if (planned.selectionMode === 'guessed') {
              await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
              assert.equal(await page.locator('.translator-ai-goal-choice').count(), planned.goals.length);
              assert.equal(await page.locator('.translator-ai-answer').count(), 0);
              await page.locator('.translator-ai-goal-choice').first().click();
            }
            if (id === 'G26') {
              await page.locator('.translator-ai-clarification').waitFor();
              assert.equal(await page.locator('.translator-clarification-question').innerText(), fresh.requests[1].response.question);
              assert.equal(await page.locator('.translator-clarification-detail').isVisible(), true);
            } else {
              await answer();
              assert.equal(await page.locator('.translator-ai-answer .translator-phrase').count(), fresh.requests[1].response.phrases.length);
              if (id === 'G11') {
                const intent = fresh.requests.find(r => r.response.kind === 'self_support');
                await page.getByRole('button', { name: intent.selectedGoal.label, exact: true }).click(); await page.locator('.translator-ai-self-support').waitFor();
                assert.equal(await page.locator('.translator-self-support-steps li').count(), intent.response.steps.length);
                assert.equal(await page.locator('.translator-ai-self-support q').count(), 0);
                if (width === 390) await productFrame('PRODUCT-PREVIEW-SELF-SUPPORT-390.png');
              }
              if (id === 'G03' && width === 1280) await productFrame('PRODUCT-PREVIEW-ICE-BOUNDARY-1280.png');
              if (id === 'G38') {
                assert.equal(await page.locator('.translator-general-safety-info p').innerText(), approved.de);
                assert.equal(await page.locator('.translator-general-safety-info.safety-note, .translator-general-safety-info a[href^="tel:"]').count(), 0);
              }
            }
          }
          if (finalRecorded) profile.cases.push('actualfinal2 G01guessed2, G03explicit1, G11normal+support, G26answerclarification, G38canonicalfullinfo');
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
