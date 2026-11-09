// Isolated browser regressions. Every remote request is mocked or blocked.
// SITE_URL must serve this checkout. Optional QA_OUTPUT stores JSON/screenshots.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.SITE_URL || 'http://127.0.0.1:8912').origin;
const output = process.env.QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'dc-webapp-'));
fs.mkdirSync(output, { recursive: true });
const valid = { kind: 'answer', safetyLevel: 'standard', meaning: 'Fiktive Bedeutung.',
  phrases: ['Fiktiver Testsatz.'], nextStep: 'Fiktiver Schritt.', avoid: 'Fiktiver Gegenbeispielsatz.' };
const results = [];
const revision = () => {
  const git = args => execFileSync('git', args, { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }).trim();
  return { sha: git(['rev-parse', 'HEAD']), tree: git(['rev-parse', 'HEAD^{tree}']),
    clean: !git(['status', '--porcelain']), files: Object.fromEntries([
      'demenz-uebersetzer/translator.js', 'demenz-uebersetzer/translator-ai.js', 'start/start.js',
      'einfach.css', 'scripts/validate-webapp-usecases.cjs'
    ].map(file => [file, createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '..', file))).digest('hex')])) };
};
const startedAt = new Date().toISOString(), startRevision = revision();
if (process.env.QA_REQUIRE_CLEAN === '1') assert.ok(startRevision.clean, 'a clean fixed checkout is required');
(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    let response = valid, mode = 'answer', calls = [], held = {}, errors = [];
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
      localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      if (url.pathname.endsWith('/web-checkout/config')) return route.fulfill({ json: { plans: {}, trialDays: 0 } });
      if (url.pathname === '/api/v1/translator-web') {
        const text = route.request().postDataJSON().text;
        calls.push(text);
        if (mode === 'offline') return route.abort();
        if (mode === 'held') { held[text] = route; return; }
        if (mode === 'busy') return route.fulfill({ status: 429, json: {} });
        return route.fulfill({ json: response });
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on('pageerror', error => errors.push(error.message));
    const check = async (name, run) => {
      if (process.env.QA_FILTER && !new RegExp(process.env.QA_FILTER).test(name)) return;
      errors = []; mode = 'answer'; response = valid; calls = [];
      try {
        await run();
        assert.deepEqual(errors, [], 'no uncaught browser errors');
        results.push({ name, status: 'passed' });
      } catch (error) {
        results.push({ name, status: 'failed', error: error.message });
        await page.screenshot({ path: path.join(output, `failure-${results.length}.png`) }).catch(() => {});
        process.exitCode = 1;
      }
      console.log(`${results.at(-1).status.toUpperCase()}: ${name}`);
      fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ base, startedAt, startRevision,
        mode: 'isolated browser; all remote services mocked or blocked', results }, null, 2));
    };
    const submit = async (text = 'Zyxwvu fiktiver Alltagsfall') => {
      await page.locator('#translator-input').fill(text);
      await page.locator('#translator-input').press('Enter');
    };
    const open = async (route = '/de/') => page.goto(base + route);
    const fullWarning = async route => {
      const note = page.locator('#translator-result .safety-note').first();
      await note.waitFor();
      assert.ok(await note.isVisible());
      const expected = await page.locator('#translator-data').evaluate(node => JSON.parse(node.textContent).safetySignals.text);
      assert.equal(await note.locator(':scope > span').textContent(), expected, 'the complete existing localized warning remains unchanged');
      for (const number of route === '/en/' ? ['911', '999'] : ['112']) {
        assert.ok(await note.locator(`a[href="tel:${number}"]`).count());
      }
    };
    for (const route of ['/de/', '/en/']) {
      for (const [name, message] of [['blank', ' \n\t '], ['empty', ''], ['missing', undefined], ['null', null], ['object', {}], ['number', 1]]) {
        for (const usableAnswer of [true, false]) {
          await check(`Safety delta: ${name} ${usableAnswer ? 'valid' : 'invalid'} concern ${route}`, async () => {
            response = { ...valid, safetyLevel: 'concern', safetyMessage: message,
              ...(usableAnswer ? {} : { meaning: undefined }) };
            await open(route); await submit(); await fullWarning(route);
            const answerExpected = usableAnswer && (message == null || typeof message === 'string');
            if (answerExpected) await page.locator('.translator-ai-answer').waitFor();
            else await page.locator('.translator-ai-button:visible').waitFor();
            assert.equal(await page.locator('.translator-ai-answer').count(), answerExpected ? 1 : 0);
            assert.equal(await page.locator('.translator-plan-cta').count(), 0);
            assert.ok(!(await page.locator('#translator-result').innerText()).includes('[object Object]'));
          });
        }
      }
      for (const [kind, level, message] of [
        ['off_topic', 'urgent', 'SYNTHETISCHER SICHERHEITSHINWEIS'],
        ['off_topic', 'concern', ' \t '], ['error', 'concern', {}],
        ['unknown', 'concern', ' \n '], ['error', 'urgent', 'SYNTHETISCHER SICHERHEITSHINWEIS'],
        ['unknown', 'concern', 'SYNTHETISCHER SICHERHEITSHINWEIS']
      ]) {
        const messageType = typeof message === 'string' ? (message.trim() ? 'usable-text' : 'blank') : typeof message;
        await check(`Safety delta: ${kind}-${level} ${messageType} ${route}`, async () => {
          response = { kind, safetyLevel: level, safetyMessage: message };
          await open(route); await submit();
          if (level === 'urgent' || route === '/en/' || typeof message !== 'string' || !message.trim()) await fullWarning(route);
          else {
            const note = page.locator('#translator-result .safety-note').first();
            await note.waitFor(); assert.equal(await note.innerText(), message);
          }
          assert.equal(await page.locator('.translator-ai-answer, .translator-plan-cta').count(), 0);
          const warnings = await page.locator('#translator-result .safety-note').allTextContents();
          assert.ok(warnings.every(text => text.trim() && !text.includes('[object Object]')));
          if (kind === 'off_topic') assert.ok((await page.locator('.translator-ai-status').innerText()).trim());
          else await page.locator('.translator-ai-button:visible').waitFor();
        });
      }
    }
    for (const width of [1280, 390]) {
      await check(`Keyboard retry focuses returned answer at ${width}px`, async () => {
        await page.setViewportSize({ width, height: 1000 });
        mode = 'offline'; await open(); await submit();
        const retry = page.getByRole('button', { name: 'Noch einmal versuchen', exact: true });
        await retry.waitFor(); mode = 'answer';
        await retry.focus(); await page.keyboard.press('Enter');
        await page.locator('.translator-ai-answer').waitFor();
        assert.ok(await page.evaluate(() => !!document.activeElement.closest('.translator-ai-answer')));
      });
    }
    const malformed = [
      ['empty phrases', { phrases: [] }], ['blank phrase', { phrases: ['  '] }],
      ['non-text phrase', { phrases: [null] }], ['missing meaning', { meaning: undefined }],
      ['missing avoid', { avoid: undefined }], ['object meaning', { meaning: {} }],
      ['invalid next step', { nextStep: [] }], ['unknown safety level', { safetyLevel: 'invalid' }],
      ['partial response', { kind: 'answer', phrases: ['Fiktiver Testsatz.'], safetyLevel: 'standard' }, true]
    ];
    for (const [name, fields, replace] of malformed) {
      await check(`Malformed response: ${name}`, async () => {
        response = replace ? fields : { ...valid, ...fields };
        await open(); await submit();
        await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).waitFor();
        assert.equal(await page.locator('.translator-ai-answer, .translator-plan-cta').count(), 0);
        assert.ok(!(await page.locator('#translator-result').innerText()).includes('undefined'));
      });
    }
    for (const level of ['urgent', 'concern']) {
      for (const route of ['/de/', '/en/']) {
        await check(`Malformed ${level} keeps safety in ${route}`, async () => {
          response = { ...valid, meaning: undefined, safetyLevel: level, safetyMessage: 'SYNTHETISCHER SICHERHEITSHINWEIS' };
          await open(route); await submit();
          await page.locator('.translator-ai-button:visible').waitFor();
          const note = page.locator('#translator-result .safety-note').first();
          await note.waitFor();
          if (route === '/en/') {
            assert.ok(await note.locator('a[href="tel:911"]').count());
            assert.ok(await note.locator('a[href="tel:999"]').count());
          } else if (level === 'urgent') assert.ok(await note.locator('a[href="tel:112"]').count());
          else assert.ok((await note.innerText()).includes('SYNTHETISCHER SICHERHEITSHINWEIS'));
          assert.equal(await page.locator('.translator-ai-answer, .translator-plan-cta').count(), 0);
        });
      }
    }
    for (const level of ['standard', 'concern', 'urgent']) {
      await check(`Healthy ${level} response preserves answer and warning`, async () => {
        response = { ...valid, safetyLevel: level, safetyMessage: 'SYNTHETISCHER SICHERHEITSHINWEIS' };
        await open(); await submit(); await page.locator('.translator-ai-answer').waitFor();
        assert.ok((await page.locator('.translator-ai-answer').innerText()).includes(valid.meaning));
        if (level === 'urgent') assert.ok(await page.locator('.translator-ai-answer a[href="tel:112"]').count());
        if (level === 'concern') assert.ok((await page.locator('.translator-ai-answer .safety-note').innerText()).includes('SYNTHETISCHER SICHERHEITSHINWEIS'));
        assert.equal(await page.locator('.translator-plan-cta').count(), level === 'standard' ? 1 : 0);
      });
    }
    for (const [name, payload] of [
      ['missing kind with urgent signal', { safetyLevel: 'urgent' }],
      ['concern without usable message', { ...valid, meaning: undefined, safetyLevel: 'concern' }],
      ['concern with malformed message', { ...valid, safetyLevel: 'concern', safetyMessage: {} }]
    ]) {
      await check(`Invalid safety payload: ${name}`, async () => {
        response = payload; await open(); await submit();
        await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).waitFor();
        assert.ok(await page.locator('#translator-result a[href="tel:112"]').count());
        assert.equal(await page.locator('.translator-ai-answer, .translator-plan-cta').count(), 0);
      });
    }
    await check('Busy service offers retry without a plan invitation', async () => {
      mode = 'busy'; await open(); await submit();
      await page.getByRole('button', { name: 'Noch einmal versuchen', exact: true }).waitFor();
      assert.ok((await page.locator('.translator-ai-status').innerText()).includes('viele Fragen'));
      assert.equal(await page.locator('.translator-plan-cta').count(), 0);
    });
    await check('Off-topic response has guidance without a plan invitation', async () => {
      response = { kind: 'off_topic' }; await open(); await submit();
      await page.locator('.translator-ai-status').filter({ hasText: 'nicht helfen' }).waitFor();
      assert.equal(await page.locator('.translator-ai-answer, .translator-plan-cta').count(), 0);
    });
    await check('Healthy older response without optional next step remains usable', async () => {
      response = { ...valid }; delete response.nextStep;
      await open(); await submit(); await page.locator('.translator-ai-answer').waitFor();
      assert.equal(await page.locator('.translator-ai-next').count(), 0);
    });
    for (const width of [1280, 390]) {
      await check(`Double submit does not activate shifted tile at ${width}px`, async () => {
        await page.setViewportSize({ width, height: 1000 }); await open();
        await page.locator('#translator-input').fill('Zyxwvu fiktiver Alltagsfall');
        await page.locator('#translator-form button[type="submit"]').dblclick();
        await page.locator('.translator-ai-answer').waitFor();
        assert.equal(calls.length, 1); assert.equal(new URL(page.url()).searchParams.has('situation'), false);
      });
    }
    await check('Late older answer cannot replace newer result', async () => {
      const waitForRequest = async text => {
        for (let attempt = 0; attempt < 100 && !held[text]; attempt++) await page.waitForTimeout(50);
        assert.ok(held[text], 'the isolated request must arrive within five seconds');
      };
      mode = 'held'; await open(); await submit('Zyxwvu fiktiver Fall A');
      await page.waitForFunction(() => !!document.querySelector('.translator-ai-wait'));
      await waitForRequest('Zyxwvu fiktiver Fall A');
      await submit('Zyxwvu fiktiver Fall B');
      await waitForRequest('Zyxwvu fiktiver Fall B');
      await held['Zyxwvu fiktiver Fall B'].fulfill({ json: { ...valid, meaning: 'ANTWORT B' } });
      await page.locator('.translator-ai-answer').waitFor();
      await held['Zyxwvu fiktiver Fall A'].fulfill({ json: { ...valid, meaning: 'ANTWORT A' } });
      await page.waitForTimeout(100);
      assert.ok((await page.locator('.translator-ai-answer').innerText()).includes('ANTWORT B'));
    });
    await check('Safety clarification keeps new draft and emergency information', async () => {
      response = { kind: 'safety' }; await open(); await submit('sie ist mein eis weg');
      await page.locator('.translator-clarify').waitFor();
      await page.locator('#translator-input').fill('NEUER FIKTIVER ENTWURF');
      assert.ok(await page.locator('.translator-followup-question').evaluate(node => node.open), 'clarification directly opens the same form');
      assert.equal(await page.locator('#translator-input').inputValue(), 'NEUER FIKTIVER ENTWURF');
      assert.ok(await page.locator('#translator-result a[href="tel:112"]').count());
      assert.equal(await page.locator('.translator-plan-cta').count(), 0);
    });
    await check('Large font answer at 320px keeps complete notes within viewport', async () => {
      await page.setViewportSize({ width: 320, height: 1000 });
      await open('/de/?situation=nachhause&ziel=jetzt');
      await page.locator('.translator-notes').waitFor();
      await page.addStyleTag({ content: 'html { font-size: 225% !important; }' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok((await page.locator('.translator-notes').innerText()).includes('Nutzungsbedingungen'));
      assert.ok((await page.locator('.translator-notes').innerText()).includes('ärztlichen Rat'));
      await page.locator('.translator-notes').screenshot({ path: path.join(output, 'large-font-notes.png') });
    });
    const reachSituation = async () => {
      await open('/start/?src=qa_usecases');
      if (await page.getByRole('button', { name: 'Neu anfangen', exact: true }).isVisible()) await page.getByRole('button', { name: 'Neu anfangen', exact: true }).click();
      await page.getByRole('button', { name: 'Meine Mutter', exact: true }).click();
      await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    };
    for (const activation of ['double click', 'two different options']) {
      await check(`Quiz ${activation} creates only one history entry`, async () => {
        await page.setViewportSize({ width: 390, height: 1000 }); await reachSituation();
        const options = page.locator('#screen .start-option');
        if (activation === 'double click') await options.first().dblclick();
        else { await options.nth(0).click(); await options.nth(1).click(); }
        await page.waitForFunction(() => document.body.dataset.screen === 'frequency');
        await page.waitForTimeout(200); await page.locator('#back').click();
        assert.equal(await page.locator('body').getAttribute('data-screen'), 'situation');
      });
    }
    await check('Quiz Back cancels pending selection navigation', async () => {
      await reachSituation(); await page.locator('#screen .start-option').first().click();
      await page.locator('#back').click(); await page.waitForTimeout(250);
      assert.equal(await page.locator('body').getAttribute('data-screen'), 'name');
    });
    await check('Per-tab quiz choices and restart remain independent', async () => {
      const a = await context.newPage(), b = await context.newPage();
      for (const p of [a, b]) {
        await p.goto(base + '/start/?src=qa_tabs');
        await p.getByRole('button', { name: p === a ? 'Meine Mutter' : 'Mein Vater', exact: true }).click();
      }
      await a.getByRole('button', { name: 'Neu anfangen', exact: true }).click(); await b.reload();
      assert.equal(await b.locator('body').getAttribute('data-screen'), 'name');
      assert.ok((await b.locator('h1').innerText()).includes('ihn'));
      await a.close(); await b.close();
    });
    const endRevision = revision();
    assert.deepEqual(endRevision, startRevision, 'the tested checkout must remain unchanged throughout the run');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ base, startedAt, endedAt: new Date().toISOString(),
      startRevision, endRevision, mode: 'isolated browser; all remote services mocked or blocked', results }, null, 2));
    console.log(JSON.stringify({ checks: results.length, passed: results.filter(x => x.status === 'passed').length,
      sha: startRevision.sha, tree: startRevision.tree, clean: startRevision.clean, output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
