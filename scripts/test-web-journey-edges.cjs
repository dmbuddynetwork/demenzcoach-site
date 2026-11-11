// Bounded rendered edge journeys. Model/auth are synthetic; all other local assets are real.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createPreviewServer}=require('./generator-preview.cjs');
const evidence=process.env.EDGE_UI_EVIDENCE;
(async()=>{let preview,browser;const cases=[],errors=[];try{
 preview=await createPreviewServer();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const language of ['de','en']){
  const context=await browser.newContext({viewport:{width:320,height:844},reducedMotion:'reduce'});let calls=0,mode='normal';
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.includes('/v1/translator-web')){
    calls++;const body=route.request().postDataJSON();
    if(url.pathname.endsWith('/goals')){
     if(mode==='offline')return route.abort('failed');
     if(mode==='busy')return route.fulfill({status:429,json:{code:'rate_limited'}});
     if(mode==='timeout'){await new Promise(resolve=>setTimeout(resolve,16000));try{return await route.fulfill({status:503,body:''});}catch{return;}}
     return route.fulfill({json:{kind:'goals',noSituation:false,goals:[{goal:'choice_1',label:'Eine freundliche Grenze sagen'},{goal:'choice_2',label:'Die Situation besser verstehen'},{goal:'choice_3',label:'Den Alltag einfacher machen'}]}});
    }
    return route.fulfill({json:{kind:'answer',safetyLevel:'standard',safetyMessage:null,meaning:'FIXTURE Hintergrund.',phrases:['FIXTURE Eine kurze Antwort.','FIXTURE Eine zweite Möglichkeit.','FIXTURE Eine dritte Möglichkeit.'],avoid:'FIXTURE Nicht so.',nextStep:'FIXTURE Ein nächster Schritt.'}});
   }
   if(url.origin!==preview.origin)return route.abort();return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(19000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(preview.origin+'/'+language+'/',{waitUntil:'networkidle'});
  await page.locator('.consent-banner:not([hidden])').waitFor();
  assert.equal(await page.locator('.translator-chat-panel').isVisible(),false);
  await page.locator('.consent-decline').click();
  await page.locator('#translator-form [type=submit]').click();assert.equal(calls,0);assert.ok((await page.locator('#translator-empty-hint').innerText()).trim());
  const menu=page.locator('.e-menu');await menu.locator('summary').click();await menu.locator('[data-font-toggle]').click();
  assert.equal(await page.locator('html').evaluate(node=>node.classList.contains('e-large')),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('demenzcoach.textSize.v1')),'large');
  await menu.locator('summary').press('Escape');await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('html').evaluate(node=>node.classList.contains('e-large')),true);
  await page.addStyleTag({content:'html{font-size:200%}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'320px start with 200% text has no overflow');
  const text='Ü'.repeat(200);await page.locator('#translator-input').fill(text);await page.locator('#translator-input').press('Enter');
  await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();await page.locator('.translator-ai-goal-choice').first().click();await page.locator('.translator-ai-answer').waitFor();
  assert.equal(calls,2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'320px result with 200% text has no overflow');
  await page.locator('.translator-change-goal > summary').click();await page.locator('.translator-own-goal-details > summary').click();
  const custom=page.locator('.translator-own-goal input');await custom.fill('Ein eigenes Ziel mit ruhiger klarer Grenze');await page.locator('.translator-own-goal button').click();
  await page.locator('.translator-ai-answer').waitFor();assert.equal(calls,3);
  assert.equal(await page.evaluate(()=>document.activeElement.closest('[hidden],details:not([open]) > :not(summary)')!==null),false,'Focus does not stay in collapsed goal controls');
  if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,language+'-320-200percent.png')});}
  // A new situation is entered without re-opening the original form.
  await page.locator('.translator-chat-input').fill('Eine neue Situation.');await page.locator('.translator-chat-send').click();await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();
  await page.addStyleTag({content:'html{font-size:100%}'});mode='offline';
  await page.locator('.translator-chat-input').fill('Offline fixture.');await page.locator('.translator-chat-send').click();await page.locator('.translator-ai-goals[data-goal-state=unavailable]').waitFor();
  assert.equal(await page.locator('.translator-ai-wait').count(),0);mode='normal';await page.locator('.translator-ai-goal-retry').click();await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();
  mode='busy';await page.locator('.translator-chat-input').fill('Rate fixture.');await page.locator('.translator-chat-send').click();await page.locator('.translator-ai-goals[data-goal-state=unavailable]').waitFor();assert.equal(await page.locator('.translator-ai-wait').count(),0);assert.equal(await page.locator('.translator-ai-goal-retry').isEnabled(),true);assert.equal(await page.locator('#translator-result .ki-angebot').count(),0);
  // Preserve the production 15-second timeout, rather than weakening it for a test.
  if(language==='de'){
   mode='timeout';await page.locator('.translator-chat-input').fill('Timeout fixture.');const start=Date.now();await page.locator('.translator-chat-send').click();await page.locator('.translator-ai-goals[data-goal-state=unavailable]').waitFor();
   assert.ok(Date.now()-start>=14000 && Date.now()-start<19000);assert.equal(await page.locator('.translator-ai-wait').count(),0);
  }
  cases.push({language,width:320,textZoom:'200%',fontPreference:true,emptyNoRequest:true,customGoal:true,offlineRetry:true,productionTimeout:language==='de'});
  await context.close();
 }
 assert.deepEqual(errors,[]);const result={passed:true,cases,providerCalls:0,errors};if(evidence)fs.writeFileSync(path.join(evidence,'edges.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(browser)await browser.close();if(preview)await preview.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
