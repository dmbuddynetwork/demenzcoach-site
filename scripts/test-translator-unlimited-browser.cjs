// Daniel, 27 Nov 2026: 1 answer without an account, then unlimited after signup; the offer page opens as a layer (× closes) after an answer, 30-min/3-per-day capping.
// Real page + real backend quota (registeredUnlimited), simulated Firebase auth and model/payment I/O. Never touches the live checkout.
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
  const shots = process.env.SHOT_DIR || '';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const originalFetch = globalThis.fetch;
  let checks = 0;
  globalThis.fetch = async (_, options) => {
    const call = JSON.parse(options.body);
    if (call.text?.format?.name === 'translator_web_goals') return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({hasSituation:true,sourceWish:'',goals:[{goal:'choice_1',intentToPreserve:'',label:'Ruhig mit der Situation umgehen'},{goal:'choice_2',intentToPreserve:'',label:'Das Verhalten besser verstehen'},{goal:'choice_3',intentToPreserve:'',label:'Den Alltag leichter gestalten'}]})}]}]}));
    const response = { answerMode: 'communication', phrases: ['Ich bin bei dir.', 'Soll ich mich kurz zu dir setzen?'], avoidSaying: 'Das stimmt nicht.', explanation: 'Vielleicht sucht sie etwas Vertrautes.', nextStep: 'Setz dich kurz dazu.', whatToCheck: null, fallbackStep: null, sharedClosing: null, safetyLevel: 'standard', emergencyMessage: null };
    return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ topic: 'dementia_care', factPlan: { speakerIdentityQuote: '', activityOrReasonQuote: '', contextQuotes: [] }, response }) }] }] }));
  };
  try {
    for (const width of [390, 1280]) {
      const repository = createMemoryTranslatorUsageRepository();
      let caseIP = 0;
      const usage = createTranslatorUsageService({ repository, minimumRegisteredAdditional: 3, registeredUnlimited: true, verifyIDToken: async (token) => {
        if (!['anonymous', 'verified'].includes(token)) throw new Error();
        return { uid: 'browser-user', firebase: { sign_in_provider: 'anonymous' }, ...(token === 'verified' ? { email: 'caregiver@example.test', email_verified: true } : {}) };
      }, entitlement: async () => ({ active: false }), purchaseExists: async () => false });
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const errors = []; context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
      await context.route('**/*', async (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/abo/web-auth.js') return route.fulfill({ contentType: 'text/javascript', body: fakeAuth });
        if (url.origin === base && url.pathname === '/abo/abo-config.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'abo/abo-config.js'), 'utf8').replace('emailLink: false', 'emailLink: true').replace('google: true', 'google: false') });
        if (url.pathname.endsWith('/account-status')) return route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':base},contentType:'application/json',body:JSON.stringify({hasCustomer:false})});
        if (url.hostname.endsWith('.cloudfunctions.net') && url.pathname.includes('/v1/translator-web')) {
          let status, body; const headers = {};
          await handleRequest({ method: request.method(), url: url.pathname.slice(url.pathname.indexOf('/v1/')), headers: { ...request.headers(), origin: base }, body: request.method() === 'POST' ? request.postDataJSON() : undefined, socket: { remoteAddress: `browser-unlimited-${caseIP}` } },
            { setHeader(key, value) { headers[key] = value; }, writeHead(value) { status = value; }, end(value) { body = value; } },
            { apiKey: 'synthetic', translatorUsageService: usage, translatorWebOrigins: [base] });
          return route.fulfill({ status, headers, body: body || '' });
        }
        // Stripe and every other external host stay blocked: no live checkout.
        if (url.origin !== base || ['font', 'media'].includes(request.resourceType())) return route.abort();
        return route.continue();
      });
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      const ask = async number => {
        resetTranslatorWebLimitsForTests(); caseIP++;
        // Each ask is a new situation on a fresh page (a follow-up in the chat replaces the answer in place).
        if (number > 1) await page.goto(base + '/de/', { waitUntil: 'domcontentloaded' });
        const before = await page.locator('.translator-ai-answer').count();
        if (await page.locator('#translator-input').isVisible()) { await page.locator('#translator-input').fill(`Mama sucht ihre Tasche. Versuch ${number}.`); await page.locator('#translator-input').press('Enter'); }
        else { await page.locator('.translator-chat-input').fill(`Mama sucht ihre Tasche. Versuch ${number}.`); await page.locator('.translator-chat-send').click(); }
        await page.locator('.translator-ai-goals[data-goal-state="ready"]').last().waitFor();
        await page.locator('.translator-ai-goal-choice').last().click();
        try { await page.waitForFunction(n => document.querySelectorAll('.translator-ai-answer').length > n, before); }
        catch (error) { if (shots) await page.screenshot({ path: path.join(shots, `fail-${width}-${number}.png`), fullPage: true }); console.log('ask', number, (await page.locator('#translator-result').innerText()).slice(-600)); throw error; }
        await page.waitForTimeout(300);
      };
      const layer = () => page.locator('dialog.dc-funnel-layer[open]');
      const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, `${width}-${name}.png`), fullPage: false }); };
      const waitLayer = async () => { await layer().waitFor({ timeout: 10000 }); assert.match(await layer().locator('iframe').getAttribute('src'), /\/start\/\?src=layer&embed=1&angebot=1$/); };
      const noLayer = async () => { await page.waitForTimeout(6800); assert.equal(await layer().count(), 0); };
      await page.goto(base + '/de/', { waitUntil: 'domcontentloaded' });
      if (await page.locator('.consent-decline').isVisible()) await page.locator('.consent-decline').click();
      // 1) Without an account: one answer, then the free signup card, no paywall layer.
      await ask(1);
      await page.locator('.dc-signup input[type=email]').waitFor();
      await noLayer(); checks++;
      // 2) Signed in: unlimited answers; the offer page opens as a layer after the answer.
      await page.evaluate(() => localStorage.setItem('test.auth.verified', 'yes'));
      await ask(2);
      assert.equal(await page.locator('.ki-angebot').count(), 0, 'no inline card');
      await waitLayer(); checks++;
      await page.waitForTimeout(2500); await shot('1-angebot-layer');
      await layer().getByRole('button', { name: 'Schließen' }).click();
      assert.equal(await layer().count(), 0); checks++;
      // 3) Capping: within 30 minutes no layer, and answers never stop.
      for (const n of [3, 4, 5]) { await ask(n); await noLayer(); }
      assert.equal(await page.locator('.ki-angebot').count(), 0, 'no hard payment card');
      assert.equal(repository.records.get('browser-user').used, 5); checks++;
      // 4) After 30 minutes it comes back; at most 3 per 24 hours.
      const age = () => page.evaluate(() => { const v = JSON.parse(localStorage.getItem('demenzcoach.kiPaywallCadence.v1')); v.lastAt -= 31 * 60000; v.startedAt -= 31 * 60000; localStorage.setItem('demenzcoach.kiPaywallCadence.v1', JSON.stringify(v)); });
      for (const n of [6, 7]) { await age(); await ask(n); await waitLayer(); await layer().getByRole('button', { name: 'Schließen' }).click(); }
      await age(); await ask(8); await noLayer(); checks++;
      assert.equal(repository.records.get('browser-user').used, 8); checks++;
      assert.deepEqual(errors, []); await context.close();
      console.log(JSON.stringify({ width, checks, status: 'PASS' }));
    }
  } finally { globalThis.fetch = originalFetch; await browser.close(); server.close(); }
  console.log(JSON.stringify({ checks, status: 'PASS', mode: 'Real backend quota with registeredUnlimited and real pages; simulated auth/model; external hosts blocked' }));
})().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
