// Recorded real two-goal care content plus reviewed local three-goal presets.
// No model/auth providers are contacted. Quota/error behavior is a controlled probe.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const recorded = JSON.parse(fs.readFileSync(process.env.OUTCOMES_REPLAY_FILE, 'utf8'));
const item = recorded.cases.find(c => c.id === 'G11');
const evidence = process.env.GOAL_TEASER_EVIDENCE;
(async () => {
  let preview, browser;
  const report = { providerCalls: 0, realAuthActions: 0, errors: [], checks: [] };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer(); browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    try {
      let requests = 0, answerRequests = 0, denySecond = false; const customRequests = [];
      const access = { enabled: true, verified: true, paid: false, remaining: 3, used: 1, anonymousAnswers: 1, registeredAdditional: 3, signupPlacement: 'after-first' };
      await context.addInitScript(() => { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); });
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: "const auth={currentUser:{uid:'controlled-verified',isAnonymous:false,emailVerified:true,getIdToken:async()=>'fixture-only'}};export async function webAuth(){return{auth,sdk:{}}}" });
        if (url.hostname.endsWith('cloudfunctions.net') && url.pathname.includes('/translator-web')) {
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
          if (url.pathname.endsWith('/access')) return route.fulfill({ json: { ...access, contract: 'signup-bonus-v1', signupCopy: { variant: 'variant_1' } } });
          requests++;
          if (url.pathname.endsWith('/goals')) return route.fulfill({ json: item.requests[0].response });
          answerRequests++;
          const body = req.postDataJSON(), goal = body.goal;
          if (goal.id === 'custom') { customRequests.push(body); return route.fulfill({ json: { ...item.requests[1].response, access } }); }
          const match = item.requests.find(r => r.selectedGoal?.id === goal.id && r.selectedGoal?.label === goal.label);
          assert.ok(match);
          if (denySecond && match.response.kind === 'self_support') return route.fulfill({ status: 402, json: { code: 'payment_required', access: { ...access, remaining: 0 } } });
          return route.fulfill({ json: { ...match.response, access } });
        }
        return url.origin === preview.origin ? route.continue() : route.abort();
      });
      const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => report.errors.push(e.message));
      const home = () => page.goto(preview.origin + '/de/');
      const begin = async () => { await home(); await page.locator('#translator-input').fill(item.input.text); await page.locator('#translator-form').evaluate(form => form.requestSubmit()); await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor(); await page.locator('.translator-ai-goal-choice').first().click(); await page.locator('.translator-ai-answer').waitFor(); };
      const normalLabel = item.requests[1].selectedGoal.label, other = item.requests.find(r => r.response.kind === 'self_support');
      await begin();
      const alternatives = page.locator('.translator-other-goals');
      assert.equal(await alternatives.locator('.translator-ai-goal-choice:visible').count(), 1);
      assert.equal(await alternatives.evaluate(el => Boolean(document.querySelector('.translator-ai-answer').compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
      const custom = page.locator('.translator-own-goal input');
      assert.equal(await custom.isVisible(), true);
      assert.equal(await page.locator('.translator-own-goal-details summary').count(), 0);
      const customDraft = 'Eine klare freundliche Grenze finden';
      const beforeTyping = answerRequests; await custom.fill(customDraft);
      assert.equal(answerRequests, beforeTyping, 'Opening or typing a goal never requests an answer');
      assert.equal(await alternatives.isVisible(), true);
      const headerBottom = await page.locator('.translator-selected-goal').evaluate(el => el.getBoundingClientRect().bottom);
      const alternativeTop = await alternatives.evaluate(el => el.getBoundingClientRect().top);
      const answerBottom = await page.locator('.translator-ai-answer').evaluate(el => el.getBoundingClientRect().bottom);
      assert.ok(alternativeTop >= answerBottom && answerBottom > headerBottom);
      const optionalOffer = page.locator('.translator-goal-answer .ki-angebot, .translator-goal-answer .ki-angebot-klein');
      if (await optionalOffer.count()) assert.equal(await optionalOffer.first().evaluate(el => Boolean(document.querySelector('.translator-other-goals').compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
      await page.getByRole('button', { name: other.selectedGoal.label, exact: true }).click();
      assert.ok((await page.locator('.translator-selected-goal').innerText()).includes(other.selectedGoal.label));
      await page.locator('.translator-ai-self-support').waitFor();
      assert.equal(await custom.inputValue(), customDraft, 'A goal switch preserves the exact unsent custom draft');
      const beforeCache = answerRequests;
      await page.getByRole('button', { name: normalLabel, exact: true }).click(); await page.locator('.translator-ai-answer:not(.translator-ai-self-support)').waitFor();
      assert.equal(answerRequests, beforeCache);
      assert.equal(await custom.inputValue(),customDraft,'Returning to cached A preserves the exact custom draft');
      assert.deepEqual(await page.locator('.translator-ai-answer .translator-phrase q').allTextContents(), item.requests[1].response.phrases);
      await page.locator('.translator-selected-goal').evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - 80, behavior: 'instant' }));
      if (evidence) await page.screenshot({ path: path.join(evidence, 'ACTUAL-TWO-GOAL-TEASER-390.png'), animations: 'disabled' });
      for (const width of [390,1280]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await custom.isVisible(),true);
        assert.equal(await alternatives.evaluate(el => Boolean(document.querySelector('.translator-ai-answer').compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)),true);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await alternatives.scrollIntoViewIfNeeded();
        if(evidence)await page.screenshot({path:path.join(evidence,`GOALS-BELOW-ANSWER-${width}.png`)});
        if(evidence)await page.locator('.translator-ai-goals').screenshot({path:path.join(evidence,`ACTUAL-GOAL-FLOW-${width}.png`)});
      }
      await page.setViewportSize({width:390,height:450});
      await custom.fill(customDraft); await page.locator('.translator-own-goal').evaluate(el=>el.scrollIntoView({block:'end'}));
      await page.waitForFunction(()=>!document.querySelector('.translator-chat')||document.querySelector('.translator-chat').hidden||document.querySelector('.translator-chat').getBoundingClientRect().height>0);
      const overlap=await page.locator('.translator-own-goal button').evaluate(el=>{const a=el.getBoundingClientRect(),chat=document.querySelector('.translator-chat');if(!chat||chat.hidden)return false;const b=chat.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top});
      assert.equal(overlap,false,'Docked composer must not cover the custom goal submit with a small keyboard viewport');
      await page.locator('.translator-own-goal button').click(); await page.locator('.translator-ai-answer').waitFor();
      assert.equal(customRequests.length,1);
      assert.deepEqual(customRequests[0].goal,{id:'custom',label:customDraft});
      assert.equal(customRequests[0].text,item.input.text);
      assert.equal(await custom.inputValue(),customDraft);
      await page.setViewportSize({width:390,height:900});
      report.checks.push('Full answer before visible alternatives/custom field before optional offer; A→B→cachedA and exact draft survive; explicit custom submit uses original text; mobile/desktop and keyboard viewport');
      denySecond = true; await begin();
      await page.getByRole('button', { name: other.selectedGoal.label, exact: true }).click(); await page.locator('.translator-goal-answer .ki-angebot').waitFor();
      assert.ok((await page.locator('.translator-selected-goal').innerText()).includes(other.selectedGoal.label));
      assert.equal(await page.getByRole('link', { name: 'Mitgliedschaft ansehen', exact: true }).getAttribute('href'), '/abo/?src=web_translator');
      const deniedCalls = answerRequests;
      await page.getByRole('button', { name: normalLabel, exact: true }).click(); await page.locator('.translator-ai-answer').waitFor();
      assert.equal(answerRequests, deniedCalls);
      report.checks.push('Selected denied goal immediately changes header and displays direct membership offer; cached old answer remains readable without quota bypass');
      await home(); const localRequests = requests;
      await page.getByRole('link', { name: 'Will nach Hause', exact: true }).click();
      const selected = page.locator('.translator-goal-chosen'); await selected.waitFor();
      const a = (await selected.innerText()).replace(/^Dein Ziel:\s*/, '');
      const preset = page.locator('.translator-preset-other-goals');
      assert.equal(await preset.getByRole('button').count(), 2);
      assert.equal(await page.locator('.translator-change-goal').count(), 0);
      const b = await preset.getByRole('button').first().innerText(); await preset.getByRole('button', { name: b, exact: true }).click();
      assert.ok((await selected.innerText()).includes(b));
      await preset.getByRole('button', { name: a, exact: true }).click(); assert.ok((await selected.innerText()).includes(a));
      assert.equal(requests, localRequests);
      assert.equal(await preset.evaluate(el => Boolean(document.querySelector('.translator-answer .translator-phrases').compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
      report.checks.push('Reviewed three-goal preset: exactly two visible alternatives after complete answer, no duplicate chooser, A→B→A uses original entry with zero AI');
      assert.deepEqual(report.errors, []); report.passed = true;
      if (evidence) fs.writeFileSync(path.join(evidence, 'GOAL-REPORT.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify(report));
    } finally { await context.close(); }
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
