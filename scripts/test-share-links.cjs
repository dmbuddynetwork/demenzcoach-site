// Answer links, offline: mocked backend, no provider calls. Checks the proof chain, the one-time
// confirmation, creation, the read-only page (DE and EN, mobile and desktop) and deletion.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const root = path.resolve(__dirname, '..');
const evidence = process.env.SHARE_LINKS_EVIDENCE;
const readToken = 'R'.repeat(43), deleteToken = 'D'.repeat(43);
const goals = {
  de: [{ goal: 'act_now', label: 'Mein Eis für mich behalten' }, { goal: 'understand', label: 'Das Verhalten besser verstehen' }, { goal: 'organize', label: 'Tipps für getrennte Portionen' }],
  en: [{ goal: 'act_now', label: 'Keep my own portion' }, { goal: 'understand', label: 'Understand what happened' }, { goal: 'organize', label: 'Tips for separate portions' }]
};
const answer = {
  kind: 'answer', safetyLevel: 'standard', safetyMessage: null,
  meaning: 'Deine eigene Portion darf dir wichtig sein.', phrases: ['Das ist meine Portion.', 'Für dich steht hier eine eigene Schale.'],
  avoid: 'Du nimmst mir immer alles weg!', nextStep: 'Stelle zwei getrennte Schalen hin.'
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Translator-Snapshot-Context', 'Access-Control-Expose-Headers': 'X-Translator-Snapshot-Proof, X-Translator-Snapshot-Error' };

(async () => {
  let preview, browser;
  const report = { mode: 'offline; backend mocked', cases: [], errors: [] };
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    preview = await createPreviewServer({ root });
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    for (const language of ['de', 'en']) {
      for (const mode of ['ask', 'auto', 'off']) {
        const enabled = mode !== 'off';
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        const seen = { contexts: [], created: [], deleted: [], resolved: [], composed: [] };
        let createdSnapshot = null;
        await context.addInitScript(() => {
          localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
          localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
        });
        await context.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.hostname.endsWith('cloudfunctions.net') && url.pathname.includes('/translator-web')) {
            if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
            if (url.pathname.endsWith('/access')) return route.fulfill({ headers: cors, json: { enabled: true, needsSession: true, contract: 'signup-bonus-v1' } });
            const body = request.postDataJSON();
            if (url.pathname.includes('/snapshots/')) {
              const action = url.pathname.split('/').pop();
              if (action === 'create') { seen.created.push(body); createdSnapshot = body.proof; return route.fulfill({ status: 201, headers: cors, json: { readToken, deleteToken, expiresAt: '2026-12-17T10:00:00.000Z' } }); }
              if (action === 'delete') { seen.deleted.push(body); return route.fulfill({ headers: cors, json: { ok: true } }); }
              if (action === 'compose') { seen.composed.push(body); return route.fulfill({ headers: cors, json: { proof: 'composed-proof' } }); }
              if (action === 'resolve') {
                seen.resolved.push(body);
                if (body.readToken !== readToken) return route.fulfill({ status: 404, headers: cors, json: { code: 'snapshot_unavailable', message: 'Snapshot unavailable' } });
                return route.fulfill({ headers: cors, json: { expiresAt: '2026-12-17T10:00:00.000Z', proof: 'p', snapshot: {
                  version: 1, originalText: 'sie ist mein eis weg', text: 'sie ist mein eis weg', language, formal: false, goals: goals[language].map(g => ({ id: g.goal, label: g.label })),
                  selectedGoal: { id: goals[language][0].goal, label: goals[language][0].label }, response: answer,
                  warnings: [{ text: 'sie ist mein eis weg', selectedGoal: { id: 'understand', label: goals[language][1].label }, response: { kind: 'answer', meaning: 'x', phrases: ['y'], avoid: 'z', nextStep: 'w', safetyLevel: 'concern', safetyMessage: 'Bei Atemnot: Notruf 112 <b>nicht fett</b>.' } }] } } });
              }
            }
            const goalRequest = url.pathname.endsWith('/goals');
            const context = request.headers()['x-translator-snapshot-context'];
            seen.contexts.push({ phase: goalRequest ? 'goals' : 'answer', context: context || null });
            const proof = goalRequest ? 'proof-goals' : 'proof-answer-' + body.goal.id;
            return route.fulfill({ contentType: 'application/json', headers: { ...cors, 'X-Translator-Snapshot-Proof': proof }, body: JSON.stringify(goalRequest ? { kind: 'goals', goals: goals[language], noSituation: false } : answer) });
          }
          if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: 'export async function webAuth(){return {auth:{currentUser:null},sdk:{}}}' });
          if (url.pathname === '/abo/abo-config.js' && enabled) {
            const text = fs.readFileSync(path.join(root, 'abo/abo-config.js'), 'utf8').replace("snapshotLinks: Object.freeze({ enabled: false, mode: 'auto' })", `snapshotLinks: Object.freeze({ enabled: true, mode: '${mode}' })`);
            assert.match(text, new RegExp(`enabled: true, mode: '${mode}'`));
            return route.fulfill({ contentType: 'text/javascript', body: text });
          }
          if (url.origin !== preview.origin) return route.abort();
          return route.continue();
        });
        const page = await context.newPage(); page.setDefaultTimeout(12000);
        page.on('pageerror', e => report.errors.push(e.message));
        await page.goto(preview.origin + '/' + language + '/', { waitUntil: 'networkidle' });
        const input = page.locator('#translator-input');
        if (await input.isVisible()) { await input.fill('sie ist mein eis weg'); await page.locator('#translator-form [type="submit"]').click(); }
        else { await page.locator('.translator-chat-input').fill('sie ist mein eis weg'); await page.keyboard.press('Enter'); }
        await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
        await page.locator('.translator-ai-goal-choice').first().click();
        await page.locator('.translator-ai-answer').waitFor();
        if (!enabled) {
          await page.waitForTimeout(500);
          assert.equal(await page.locator('[data-snapshot-share]').count(), 0, 'Flag off: no share control');
          assert.deepEqual(seen.contexts.map(c => c.context), [null, null], 'Flag off: no proof header is sent');
          report.cases.push({ language, mode, noShareControl: true }); await context.close(); continue;
        }
        if (mode === 'auto') {
          // No click and no question: the link exists and sits in the address bar as soon as the answer is shown.
          const auto = page.locator('[data-snapshot-share]:not([hidden]) .translator-snapshot-remove');
          await auto.waitFor();
          assert.deepEqual(seen.contexts, [{ phase: 'goals', context: null }, { phase: 'answer', context: 'proof-goals' }]);
          assert.deepEqual(seen.created, [{ proof: 'proof-answer-act_now' }]);
          const here = new URL(page.url());
          assert.equal(here.hash, '#r=' + readToken, 'The address bar holds the share link');
          assert.doesNotMatch(page.url(), /%20|situation=|eis/, 'The situation text is never in the address');
          assert.match(await page.locator('.translator-snapshot-auto').innerText(), language === 'de' ? /Adresszeile.*dauerhaft gespeichert/s : /address bar.*stored permanently/s);
          if (evidence && language === 'de') await page.screenshot({ path: path.join(evidence, 'auto-390.png') });
          // Opening the copied address (fresh visitor) lands on the read-only page, same fragment.
          const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } });
          await visitor.route('**/*', async route => {
            const request = route.request(), reqUrl = new URL(request.url());
            if (reqUrl.hostname.endsWith('cloudfunctions.net')) {
              if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
              return route.fulfill({ headers: cors, json: { proof: 'p', snapshot: { version: 1, originalText: 'sie ist mein eis weg', text: 'sie ist mein eis weg', language, formal: false, goals: [], selectedGoal: null, response: answer, warnings: [] } } });
            }
            return reqUrl.origin === preview.origin ? route.continue() : route.abort();
          });
          const view = await visitor.newPage();
          await view.goto(here.href, { waitUntil: 'networkidle' });
          await view.locator('#shared-content').waitFor();
          assert.equal(new URL(view.url()).pathname, language === 'de' ? '/de/geteilt.html' : '/en/shared.html');
          assert.equal(new URL(view.url()).hash, '#r=' + readToken);
          assert.match(await view.locator('.shared-meta').innerText(), language === 'de' ? /dauerhaft gespeichert/ : /stored permanently/);
          await visitor.close();
          // Another goal: the old address is cleared at once and a new link replaces it.
          await page.locator('.translator-ai-goal-choice:visible').first().click();
          await page.waitForFunction(() => document.querySelectorAll('.translator-snapshot-auto:not([hidden])').length === 1);
          assert.equal(seen.created.length, 2); assert.equal(new URL(page.url()).hash, '#r=' + readToken);
          // A new situation clears the address bar before any new answer exists.
          const next = page.locator('#translator-input');
          if (await next.isVisible()) { await next.fill('er will nicht duschen'); await page.locator('#translator-form [type="submit"]').click(); }
          else { await page.locator('.translator-chat-input').fill('er will nicht duschen'); await page.keyboard.press('Enter'); }
          await page.waitForFunction(() => location.hash === '');
          await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
          await page.locator('.translator-ai-goal-choice').first().click();
          await page.locator('.translator-snapshot-remove').waitFor();
          assert.equal(new URL(page.url()).hash, '#r=' + readToken);
          await page.locator('.translator-snapshot-remove').click();
          await page.waitForFunction(() => location.hash === '' && !document.querySelector('.translator-snapshot-auto'));
          assert.deepEqual(seen.deleted.at(-1), { readToken, deleteToken });
          report.cases.push({ language, mode, createdWithoutClick: true, addressBar: true, readerRedirect: true, clearedOnNewSituation: true, deleted: true });
          await context.close(); continue;
        }
        const share = page.locator('[data-snapshot-share]');
        await share.waitFor();
        assert.deepEqual(seen.contexts, [{ phase: 'goals', context: null }, { phase: 'answer', context: 'proof-goals' }], 'The answer request carries the goals proof');
        assert.equal(seen.created.length, 0, 'Nothing is stored before the confirmation');
        await share.locator('.translator-snapshot-start').click();
        const notice = await share.locator('.translator-snapshot-confirm-panel').innerText();
        assert.match(notice, language === 'de' ? /dauerhaft.*Jede Person mit dem Link/s : /permanently.*Anyone with the link/s);
        assert.equal(seen.created.length, 0, 'Still nothing stored while the question is open');
        if (evidence && language === 'de') await page.screenshot({ path: path.join(evidence, 'confirm-390.png') });
        await share.locator('.translator-snapshot-confirm').click();
        await share.locator('.translator-snapshot-url').waitFor();
        assert.deepEqual(seen.created, [{ proof: 'proof-answer-act_now' }]);
        const url = await share.locator('.translator-snapshot-url').inputValue();
        const shell = language === 'de' ? '/de/geteilt.html' : '/en/shared.html';
        assert.equal(url, preview.origin + shell + '#r=' + readToken, 'The link holds only the page and the read token in the fragment');
        assert.doesNotMatch(url, /sie%20ist|eis/i);
        assert.equal(new URL(page.url()).hash, '#r=' + readToken, 'The address bar holds the link after the confirmation');
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('demenzcoach.sharedLinks.v1')));
        assert.equal(stored[0].deleteToken, deleteToken, 'The delete capability stays findable in this browser');
        if (evidence && language === 'de') await page.screenshot({ path: path.join(evidence, 'link-390.png'), fullPage: true });
        // Another goal later: no second question, and the older answer is composed with the newest chain.
        await page.locator('.translator-ai-goal-choice:visible').first().click();
        await page.locator('.translator-ai-answer').waitFor();
        await page.locator('.translator-snapshot-start').waitFor();
        await page.locator('.translator-snapshot-start').click();
        await page.locator('.translator-snapshot-url').waitFor();
        assert.equal(seen.created.length, 2, 'The second state created a new record without asking again');
        assert.deepEqual(seen.contexts[2], { phase: 'answer', context: 'proof-answer-act_now' }, 'The chain is cumulative');
        // Back to the first goal (cached answer): its older proof is composed with the newest chain.
        await page.locator('.translator-ai-goal-choice:visible', { hasText: goals[language][0].label }).click();
        await page.locator('.translator-ai-answer').waitFor();
        await page.waitForFunction(() => document.querySelectorAll('[data-snapshot-share]').length === 1);
        await page.locator('.translator-snapshot-start').click();
        await page.waitForFunction(() => document.querySelector('.translator-snapshot-url')?.value);
        assert.deepEqual(seen.composed, [{ context: 'proof-answer-understand', answerProof: 'proof-answer-act_now' }]);
        assert.deepEqual(seen.created.at(-1), { proof: 'composed-proof' });
        // Reading page on a fresh visitor (no storage), DE/EN, mobile and desktop.
        for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
          const visitor = await browser.newContext({ viewport, reducedMotion: 'reduce' });
          await visitor.route('**/*', async route => {
            const request = route.request(), reqUrl = new URL(request.url());
            if (reqUrl.hostname.endsWith('cloudfunctions.net')) {
              if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
              const body = request.postDataJSON();
              if (reqUrl.pathname.endsWith('/resolve')) {
                seen.resolved.push(body);
                if (body.readToken !== readToken) return route.fulfill({ status: 404, headers: cors, json: { code: 'snapshot_unavailable' } });
                return route.fulfill({ headers: cors, json: { expiresAt: '2026-12-17T10:00:00.000Z', proof: 'p', snapshot: {
                  version: 1, originalText: 'sie ist mein eis weg', text: 'sie ist mein eis weg', language, formal: false, goals: [], selectedGoal: { id: 'act_now', label: goals[language][0].label }, response: answer,
                  warnings: [{ text: 'sie ist mein eis weg', selectedGoal: { id: 'understand', label: goals[language][1].label }, response: { kind: 'answer', meaning: 'x', phrases: ['y'], avoid: 'z', nextStep: 'w', safetyLevel: 'concern', safetyMessage: 'Bei Atemnot: Notruf 112 <b>nicht fett</b>.' } }] } } });
              }
              return route.fulfill({ status: 404, headers: cors, json: {} });
            }
            if (reqUrl.origin !== preview.origin) return route.abort();
            return route.continue();
          });
          const view = await visitor.newPage(); view.setDefaultTimeout(12000);
          view.on('pageerror', e => report.errors.push(e.message));
          const outbound = [];
          view.on('request', r => { if (!r.url().startsWith(preview.origin)) outbound.push(r.url()); });
          await view.goto(url, { waitUntil: 'networkidle' });
          await view.locator('#shared-content').waitFor();
          const body = await view.locator('#shared-content').innerText();
          assert.match(body, /sie ist mein eis weg/); assert.match(body, /Das ist meine Portion\./);
          assert.match(body, /<b>nicht fett<\/b>/, 'Stored text is shown as text, never as markup');
          assert.equal(await view.locator('#shared-content b').count(), 0);
          assert.equal(await view.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No horizontal scroll');
          assert.equal(await view.locator('.shared-actions button').count(), 0, 'A stranger cannot delete');
          assert.ok(outbound.every(u => u.includes('cloudfunctions.net')), 'Only the API is contacted: ' + outbound.join(','));
          assert.equal(await view.locator('meta[name="robots"]').getAttribute('content'), 'noindex,nofollow,noarchive');
          if (evidence && language === 'de') await view.screenshot({ path: path.join(evidence, `shared-${viewport.width}.png`), fullPage: true });
          const missing = await visitor.newPage();
          await missing.route('**/*', route => route.request().url().startsWith(preview.origin) ? route.continue() : route.fulfill({ status: 404, headers: cors, json: { code: 'snapshot_unavailable' } }));
          await missing.goto(preview.origin + shell + '#r=' + 'X'.repeat(43), { waitUntil: 'networkidle' });
          await missing.waitForFunction(() => /abgelaufen|expired/.test(document.getElementById('shared-status').textContent));
          await missing.goto(preview.origin + shell, { waitUntil: 'networkidle' });
          assert.match(await missing.locator('#shared-status').innerText(), language === 'de' ? /nicht vollständig/ : /not complete/);
          await visitor.close();
        }
        // The creator sees a delete button on the link's own page and can revoke it.
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.locator('.shared-actions button').click();
        await page.waitForFunction(() => document.getElementById('shared-content').hidden);
        assert.deepEqual(seen.deleted[0], { readToken, deleteToken });
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('demenzcoach.sharedLinks.v1')).length), 0);
        report.cases.push({ language, mode, chain: true, confirmedOnce: true, createdRecords: seen.created.length, readerPage: true, deleted: true });
        await context.close();
      }
    }
    report.passed = report.errors.length === 0;
    console.log(JSON.stringify(report));
    if (!report.passed) process.exitCode = 1;
  } finally {
    await browser?.close(); await preview?.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
