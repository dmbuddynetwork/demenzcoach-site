// Real page + real backend quota, simulated native Firebase email links and model/payment I/O.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const backend = process.env.BACKEND_ROOT;
if (!backend) throw new Error('BACKEND_ROOT is required');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404); res.end(); }
});
const fakeAuth = `
const verified=()=>localStorage.getItem('test.auth.verified')==='yes';
const user={uid:'browser-user',get isAnonymous(){return !verified()},get emailVerified(){return verified()},get email(){return verified()?'caregiver@example.test':null},providerData:[],getIdToken:async()=>verified()?'verified':'anonymous'};
const auth={currentUser:user};
const sdk={
 EmailAuthProvider:{credentialWithLink(email,url){if(email!=='caregiver@example.test')throw Object.assign(new Error(),{code:'auth/invalid-action-code'});return {email,url}}},
 isSignInWithEmailLink(_,url){return new URL(url).searchParams.has('oobCode')},
 async sendSignInLinkToEmail(_,email,settings){window.__testEmailLink=settings.url+'&oobCode=synthetic-email-code';window.__testEmailSettings=settings},
 async linkWithCredential(){if(localStorage.getItem('test.auth.collision'))throw Object.assign(new Error(),{code:'auth/credential-already-in-use'});localStorage.setItem('test.auth.verified','yes')},
 async signInWithCredential(){localStorage.setItem('test.auth.verified','yes')},async reauthenticateWithCredential(){}}
export async function webAuth(){if(localStorage.getItem('test.auth.hang'))await new Promise(()=>{});if(localStorage.getItem('test.auth.failure'))throw new Error('synthetic offline');return {auth,sdk}};
`;

(async () => {
  const { handleRequest } = await import(pathToFileURL(path.join(backend, 'server.mjs')));
  const { createTranslatorUsageService, createMemoryTranslatorUsageRepository } = await import(pathToFileURL(path.join(backend, 'translator-usage.mjs')));
  const { resetTranslatorWebLimitsForTests } = await import(pathToFileURL(path.join(backend, 'translator-web.mjs')));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const originalFetch = globalThis.fetch;
  let checks = 0;
  globalThis.fetch = async (_, options) => {
    const call = JSON.parse(options.body);
    if (call.text?.format?.name === 'translator_web_goals') return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({hasSituation:true,goals:[{goal:'act_now',label:'Ruhig mit der Situation umgehen'},{goal:'understand',label:'Das Verhalten besser verstehen'},{goal:'organize',label:'Den Alltag leichter gestalten'}]})}]}]}));
    const english = call.input[1].content.startsWith('Language: English');
    const response = { sayNow: english ? 'I am here with you.' : 'Ich bin bei dir.', avoidSaying: english ? 'That is not true.' : 'Das stimmt nicht.', explanation: english ? 'She may need something familiar.' : 'Vielleicht sucht sie etwas Vertrautes.', nextStep: english ? 'Sit with her for a moment.' : 'Setz dich kurz dazu.', whatToCheck: null, fallbackStep: null, sharedClosing: null, safetyLevel: 'standard', emergencyMessage: null };
    return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ topic: 'dementia_care', response }) }] }] }));
  };
  try {
    for (const width of [390, 1280]) {
      resetTranslatorWebLimitsForTests();
      const repository = createMemoryTranslatorUsageRepository();
      let paid = false, hasPurchase = false, dropAfterCommit = true, caseIP = 'browser-test-legitimate';
      const operationIDs = [];
      const usage = createTranslatorUsageService({ repository, verifyIDToken: async (token) => {
        if (!['anonymous', 'verified'].includes(token)) throw new Error();
        return { uid: 'browser-user', firebase: { sign_in_provider: 'anonymous' }, ...(token === 'verified' ? { email: 'caregiver@example.test', email_verified: true } : {}) };
      }, entitlement: async () => ({ active: paid }), purchaseExists: async () => hasPurchase });
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const errors = []; context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
      await context.route('**/*', async (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: fakeAuth });
        if (url.origin === base && url.pathname === '/abo/abo-config.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'abo/abo-config.js'), 'utf8').replace('emailLink: false', 'emailLink: true').replace('google: true', 'google: false').replace(/translatorGate: Object.freeze\(\{\s*enabled: false/u, 'translatorGate: Object.freeze({ enabled: true') });
        if (url.pathname.endsWith('/account-status')) {
          assert.equal(request.headers().authorization, 'Bearer anonymous');
          return route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':base},contentType:'application/json',body:JSON.stringify({hasCustomer:hasPurchase})});
        }
        if (url.hostname.endsWith('.cloudfunctions.net') && url.pathname.includes('/v1/translator-web')) {
          let status, body; const headers = {};
          if (request.method() === 'POST' && !url.pathname.endsWith('/goals')) operationIDs.push(request.headers()['x-translator-request-id']);
          await handleRequest({ method: request.method(), url: url.pathname.slice(url.pathname.indexOf('/v1/')), headers: { ...request.headers(), origin: base }, body: request.method() === 'POST' ? request.postDataJSON() : undefined, socket: { remoteAddress: caseIP } },
            { setHeader(key, value) { headers[key] = value; }, writeHead(value) { status = value; }, end(value) { body = value; } },
            { apiKey: 'synthetic', translatorUsageService: usage, translatorWebOrigins: [base] });
          if (dropAfterCommit && status === 200 && body && JSON.parse(body).kind === 'answer') { dropAfterCommit = false; return route.abort('failed'); }
          if(status>=400)console.log(JSON.stringify({phase:url.pathname.split('/').at(-1),status,code:JSON.parse(body||'{}').code}));
          return route.fulfill({ status, headers, body: body || '' });
        }
        if (url.origin !== base || ['image', 'font', 'media'].includes(request.resourceType())) return route.abort();
        return route.continue();
      });
      let page = await context.newPage(); page.setDefaultTimeout(12000);
      const submitSituation = async text => {
        if (await page.locator('#translator-input').isVisible()) { await page.locator('#translator-input').fill(text); await page.locator('#translator-input').press('Enter'); }
        else { await page.locator('.translator-chat-input').fill(text); await page.locator('.translator-chat-send').click(); }
      };
      const ask = async number => {
        await submitSituation(`Der Vorhang summt wie ein Kühlschrank. Versuch ${number}.`);
        await page.locator('.translator-ai-goals[data-goal-state="ready"]').waitFor();
        await page.locator('.translator-ai-goal-choice').first().click();
      };
      await page.goto(base + '/de/', { waitUntil: 'domcontentloaded' });
      if(await page.locator('.consent-decline').isVisible())await page.locator('.consent-decline').click();
      await page.getByText(/3 weitere mit verifiziertem Konto/).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('demenzcoach.webExperiment.v1')), null); checks++;
      await ask(1);
      await page.locator('.translator-ai-button:not([hidden])').click();
      await page.getByText(/einmalig ein kostenloser Wiederholungsversuch freigegeben/).waitFor();
      await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
      await page.locator('.translator-ai-answer').waitFor();
      assert.equal(operationIDs[0], operationIDs[1]); assert.notEqual(operationIDs[1], operationIDs[2]);
      assert.equal(repository.records.get('browser-user').used, 1); checks++;

      await page.locator('.dc-signup input[type=email]').waitFor();
      assert.match(await page.locator('.dc-signup h3').innerText(), /3 weitere KI-Antworten kostenlos/,'An actual enabled server credit contract reaches the intro presentation');
      assert.equal(repository.records.get('browser-user').used, 1); checks++;
      await page.locator('.translator-feedback').first().getByRole('button', { name: /Ja, merken/ }).click();
      assert.equal(await page.locator('.ki-supporter').count(), 0); checks++;
      await ask(2); await page.locator('.dc-signup input[type=email]').waitFor();
      assert.equal(repository.records.get('browser-user').used, 1); checks++;
      assert.equal(new URL(page.url()).pathname, '/de/'); checks++;
      await page.locator('.dc-signup input[type=email]').fill('caregiver@example.test');
      await page.locator('.dc-signup .primary').click();
      await page.getByText('Prüfe dein Postfach und den Spamordner. Öffne den Anmeldelink, um weiterzufragen.', {exact:true}).waitFor();
      const callback = await page.evaluate(() => window.__testEmailLink);
      assert.ok(callback.includes('/abo/email-link.html?state=')); checks++;
      const callbackPage = await context.newPage();
      await callbackPage.goto(callback, {waitUntil:'domcontentloaded'});
      await callbackPage.getByText('Du bist angemeldet. Du kannst hier weitergehen oder deinen ursprünglichen Browser-Tab weiterverwenden.', {exact:true}).waitFor();
      assert.equal(await callbackPage.evaluate(() => location.search), '');
      assert.equal(await callbackPage.evaluate(() => localStorage.getItem('demenzcoach.emailLinkAttempt.v1')), null); checks++;
      await page.close();
      page = callbackPage;
      assert.equal(repository.records.get('browser-user').used, 1); checks++;
      await Promise.all([page.waitForURL(base + '/de/'), page.locator('#account-continue').click()]);
      await page.locator('#translator-input').waitFor({state:'attached'});
      await ask(2); // A fresh callback tab has no copy of another tab's pending question.
      await page.locator('.translator-ai-answer').waitFor();
      assert.equal(repository.records.get('browser-user').used, 2);
      assert.ok(await page.evaluate(() => localStorage.getItem('demenzcoach.helpfulAnswers.v1'))); checks++;
      for (const n of [3, 4]) { await ask(n); await page.locator('.translator-ai-answer').waitFor(); }
      await page.getByRole('link', { name: 'Mitgliedschaft ansehen', exact: true }).waitFor();
      assert.equal(repository.records.get('browser-user').used, 4); checks++;
      paid = true; await ask(6); await page.getByText('Deine Mitgliedschaft ist aktiv.', { exact: true }).waitFor();
      assert.equal(repository.records.get('browser-user').used, 4); checks++;
      // Separate abuse/tamper scenarios from the legitimate 1+3 → paid journey.
      resetTranslatorWebLimitsForTests();
      caseIP = 'browser-test-tamper';
      paid = false;
      await page.evaluate(() => localStorage.setItem('demenzCoachKi', JSON.stringify({ activeUntil: Date.now() + 999999999 })));
      await ask(5); await page.getByRole('link', { name: 'Mitgliedschaft ansehen', exact: true }).waitFor();
      assert.equal(repository.records.get('browser-user').used, 4); checks++;
      paid = true;
      caseIP = 'browser-test-abuse';
      resetTranslatorWebLimitsForTests();
      const goalBudget = await page.evaluate(async () => {
        const results = [];
        for(let i=0;i<7;i++) results.push(await window.DemenzTranslatorAI.askGoals(`Rate budget fixture ${i}.`));
        return results;
      });
      assert.ok(goalBudget.slice(0,6).every(result=>result.kind==='goals'));
      assert.equal(goalBudget[6].kind,'error');assert.equal(goalBudget[6].reason,'busy');checks++;
      // The next failure/retry is a separate rate-window scenario; the complete
      // 1+3 and purchase journey above used the unmodified production limits.
      resetTranslatorWebLimitsForTests();
      await page.evaluate(() => localStorage.setItem('test.auth.failure', 'yes'));
      await ask(7); await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).waitFor();
      await page.evaluate(() => localStorage.removeItem('test.auth.failure'));
      await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
      await page.getByText('Deine Mitgliedschaft ist aktiv.', { exact: true }).waitFor();
      assert.ok(operationIDs.at(-1)); assert.equal(operationIDs.at(-1), operationIDs.at(-2)); checks++;
      await page.evaluate(() => localStorage.setItem('test.auth.hang', 'yes'));
      const began = Date.now();
      const urgent = await page.evaluate(() => window.DemenzTranslatorAI.ask('Sie ist bewusstlos.'));
      assert.equal(urgent.kind, 'safety'); assert.ok(Date.now() - began < 5000); checks++;
      await page.evaluate(() => localStorage.removeItem('test.auth.hang'));
      await submitSituation('Sie ist bewusstlos.');
      await page.locator('#translator-result').getByText(/112|Notruf/).first().waitFor();
      assert.equal(await page.locator('#translator-result .ki-angebot').count(), 0); checks++;
      // A paid/pending customer association may never be silently abandoned.
      await page.evaluate(() => { localStorage.removeItem('test.auth.failure'); localStorage.removeItem('test.auth.verified'); localStorage.setItem('test.auth.collision', 'yes'); });
      hasPurchase = true;
      await page.goto(base + '/abo/konto.html?returnTo=%2Fde%2F', { waitUntil: 'domcontentloaded' });
      await page.locator('.dc-signup input[type=email]').waitFor();
      await page.locator('.dc-signup input[type=email]').fill('caregiver@example.test'); await page.locator('.dc-signup .primary').click();
      await page.waitForFunction(() => window.__testEmailLink);
      await page.goto(await page.evaluate(() => window.__testEmailLink), {waitUntil:'domcontentloaded'});
      await page.getByText(/damit vorhandene Käufe erhalten bleiben/).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('test.auth.verified')), null); checks++;
      await page.goto(base + '/abo/konto.html?returnTo=%2Fen%2Fdementia-translator%2F', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Continue with email', exact: true }).waitFor();
      assert.equal(await page.title(), 'Your account · DemenzCoach');
      assert.equal(await page.locator('#account-back').textContent(), 'Back without signing in');
      assert.match(await page.locator('#account-safety').textContent(), /remain free/); checks++;
      assert.equal(await page.locator('input[type=tel]').count(), 0); checks++;
      assert.deepEqual(errors, []); await context.close();
      console.log(JSON.stringify({ width, checks, status: 'PASS', goalBudget: '6 per IP per 10 minutes, seventh blocked even for paid', isolation: 'legitimate paid path, local-tamper probe and abuse-budget probe use separate rate windows' }));
    }
  } finally { globalThis.fetch = originalFetch; await browser.close(); server.close(); }
  console.log(JSON.stringify({ checks, status: 'PASS', goalBudget: '6 per IP per 10 minutes, seventh blocked even for paid', isolation: 'legitimate paid path, local-tamper probe and abuse-budget probe use separate rate windows', mode: 'Real backend quota and real pages; simulated native Firebase email links/payment/model' }));
})().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
