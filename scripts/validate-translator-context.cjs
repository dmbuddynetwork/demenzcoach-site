// Changed matching/safety routes plus UI replays of three recorded responses. No live API calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../demenz-uebersetzer/translator-core.js');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '../de/index.html'), 'utf8');
const data = JSON.parse(html.match(/id="translator-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const cases = [
 ['Früher wollte er nachts nie ins Bett, heute schläft er ständig.', 'temporal'],
 ['In meinem Zimmer ist ein fremder Mann.', 'presence'],
 ['Meine Mutter ruft alle fünf Minuten an. Ich kann mich auf der Arbeit kaum noch konzentrieren.', 'calls'],
 ['Sie behandelt mich wie ein kleines Kind.', 'speaker'],
 ['immer das gleiche', 'repetition'],
 ['Mein Vater hat keine Luftnot. Er wird nur beim Anziehen schnell müde.', 'description']
];
for (const [input, context] of cases) assert.equal(core.match(input, data).context, context, input);
const reportedThreats = [
 'Ich habe Angst, weil mein Mann sagt: ‚Ich werde ihr etwas antun‘.',
 'Ich habe Angst. Mein Bruder sagt: Ich werde ihr etwas antun.'
];
for (const input of ['Ich habe Angst, dass ich ihr etwas antue.', 'Ich fürchte, dass ich ihm etwas antun könnte.',
 'Ich habe Angst, dass ich ihr etwas antue. Mein Bruder sagt: „Hol Hilfe“.']) {
 const r = core.match(input, data); assert.equal(r.protection, 'self', input); assert.equal(r.entry.key, 'erschoepft'); assert.equal(r.safetyHit, true);
}
for (const input of ['Sie hat Angst, dass ich ihr etwas antue.', 'Ich habe Angst, dass sie mir etwas antut.', 'Ich habe keine Angst, dass ich ihr etwas antue.', ...reportedThreats]) {
 const r = core.match(input, data); assert.equal(r.protection, 'clarify', input); assert.equal(r.feeling, null); assert.equal(r.safetyHit, true);
}
assert.equal(core.match('Ich habe Angst.', data).feeling.id, 'angst');
for (const input of ['Ich will nicht mehr leben', 'Er ist gestürzt und reagiert nicht.']) assert.ok(core.match(input, data).safetyHit || core.match(input, data).entry?.safetyOnly, input);
assert.doesNotMatch(core.personalize('Ich bin Anna, deine Tochter. Du bist nicht allein.', {}), /Anna|Tochter/);
assert.match(core.personalize('Ich bin Anna, deine Tochter. Du bist nicht allein.', { me: 'Maria', role: 'tochter' }), /Maria/);
for (const input of ['Ich will meine Ruhe.', 'Lass mich nicht allein.']) assert.equal(core.match(input, data).alternatives.length, 0);
const base = process.env.SITE_URL || 'http://127.0.0.1:54929';
(async()=>{
 const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
  const context = await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:900}});
  await context.addInitScript(()=>{localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied');});
  let reply = null, requests = [];
  await context.route('**/*',route=>{
   const u = new URL(route.request().url());
   if(u.origin===new URL(base).origin)return route.continue();
   if(u.pathname==='/api/v1/translator-web'){requests.push(route.request().postDataJSON().text);return reply?route.fulfill({json:reply}):route.abort();}
   return route.abort();
  });
  const page = await context.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const submit=async text=>{requests=[];await page.goto(base+'/de/');await page.locator('#translator-input').fill(text);await page.locator('#translator-input').press('Enter');};
  const warning=async()=>{
   const note=page.locator('#translator-result .safety-urgent').first();await note.waitFor();
   assert.equal(await note.locator(':scope > span').textContent(),data.safetySignals.text);
   assert.ok(await note.locator('a[href="tel:112"]').count());return note;
  };
  for(const input of ['Ich habe Angst, dass ich ihr etwas antue.','Sie hat Angst, dass ich ihr etwas antue.','Ich habe Angst, dass sie mir etwas antut.',...reportedThreats]){
   await submit(input);await warning();assert.deepEqual(requests,[]);
   assert.equal(await page.locator('.translator-plan-cta,.translator-ai').count(),0);
   assert.doesNotMatch(await page.locator('#translator-result').innerText(),/deine ruhige Nähe|Du bist sicher\./u);
   assert.ok(await page.locator('#translator-result .safety-urgent').first().evaluate(n=>n===document.activeElement));
   if(input.startsWith('Ich habe Angst, dass ich')) assert.match(await page.locator('#translator-result').innerText(),/Abstand|Hilfe/u);
   else {assert.ok(await page.locator('.translator-followup-question').evaluate(n=>n.open));assert.equal(await page.locator('#translator-input').inputValue(),input);
    assert.equal(await page.getByRole('heading',{name:'Was genau ist passiert?',exact:true}).count(),1);
    assert.doesNotMatch(await page.locator('#translator-result').innerText(),/Das ist gerade viel für dich\./u);}
  }
  for(const [input,kind]of cases){
   await submit(input);
   if(['presence','speaker','repetition'].includes(kind)){await page.getByRole('heading',{name:'Was genau ist passiert?',exact:true}).waitFor();assert.deepEqual(requests,[]);}
   else {await page.locator('.translator-ai-button:visible').waitFor();assert.deepEqual(requests,[input]);}
   assert.doesNotMatch(await page.locator('#translator-result').innerText(),/Um drei Uhr fahren wir|blaue oder die grüne Bluse|Ich bin Anna/u);
   if(kind==='description')await warning();
  }
  const recorded=require('./fixtures/translator-live-20261109.json');
  for(const row of recorded.cases){
   reply=row.response;await submit(row.input);
   if(row.response.kind==='answer')await page.locator('.translator-ai-answer').waitFor();else await page.waitForFunction(()=>!document.querySelector('.translator-ai'));
   await page.setViewportSize({width:320,height:1000});await page.addStyleTag({content:'html {font-size:225% !important}'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`recorded ${row.caseId}: 320px/225% fits`);
   assert.equal(await page.locator('.translator-plan-cta,.translator-suggest').count(),0);
   if(row.caseId===48){await warning();assert.equal(await page.locator('.safety-urgent').count(),1);assert.equal(await page.locator('.translator-clarify').count(),0);}
   if(row.response.safetyLevel==='concern') assert.ok((await page.locator('#translator-result').innerText()).includes(row.response.safetyMessage));
   if(row.response.safetyLevel==='urgent') await warning();
   if(row.response.nextStep) assert.ok((await page.locator('#translator-result').innerText()).includes(row.response.nextStep));
   if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`recorded-${row.caseId}-320-font225.png`),fullPage:true});}
  }
  assert.deepEqual(errors,[]);
  console.log('Context/protection routes and recorded 46/47/48 replay UI passed; no live calls.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
