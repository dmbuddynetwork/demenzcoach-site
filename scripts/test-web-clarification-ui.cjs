// Real Chrome controllers, synthetic transport only. Includes exact shipped legacy source.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createPreviewServer}=require('./generator-preview.cjs');
const legacySHA='abd6d2d95cd5285fa8dffe6a1f3d39c69880f4d6';
const evidence=process.env.CLARIFICATION_EVIDENCE;
const goals=[{goal:'act_now',label:'Eine freundliche Grenze sagen'},{goal:'understand',label:'Die Situation besser verstehen'},{goal:'organize',label:'Eine gemeinsame Lösung finden'}];
const clarification={kind:'clarification',question:'Was genau möchtest du ändern? <img src=x onerror="window.badQuestion=true">?' ,meaning:'Diese Angabe hilft, deine Situation besser zu verstehen.',nextStep:'Beschreibe bitte die noch fehlende Angabe.',safetyLevel:'standard',safetyMessage:null};
const answer={kind:'answer',meaning:'Fixture context.',phrases:['Ein Satz.','Zweiter Satz.','Dritter Satz.'],avoid:'Nicht so.',nextStep:'Ein Schritt.',safetyLevel:'standard',safetyMessage:null};
(async()=>{let preview,browser;const report={providerCalls:0,legacySHA,cases:[],errors:[]};try{
 if(evidence)fs.mkdirSync(evidence,{recursive:true});preview=await createPreviewServer();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const legacy of [true,false])for(const language of ['de','en']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const requests=[];let mode='clarification',fail=false,release=null;
  await context.addInitScript(()=>{localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied');});
  await context.route('**/*',async route=>{const url=new URL(route.request().url());
   if(legacy&&['/demenz-uebersetzer/translator.js','/demenz-uebersetzer/translator-ai.js'].includes(url.pathname))return route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show',legacySHA+':'+url.pathname.slice(1)],{encoding:'utf8'})});
   if(url.pathname.includes('/v1/translator-web')){const body=route.request().postDataJSON();requests.push({url:url.href,body,headers:route.request().headers()});
    if(url.pathname.endsWith('/goals'))return route.fulfill({json:{kind:'goals',noSituation:false,goals}});
    if(fail){fail=false;return route.fulfill({status:503,json:{}});}
    if(mode==='hold')await new Promise(r=>{release=r;});
    const result=legacy?{kind:'off_topic',reason:'clarification_required',access:{enabled:false}}:body.goal?.id==='organize'?{kind:'safety',safetyLevel:'concern',message:'Fixture received concern guidance.'}:mode==='answer'||mode==='hold'?answer:clarification;
    return route.fulfill({json:result});
   }
   if(url.pathname==='/abo/web-auth.js')return route.fulfill({contentType:'text/javascript',body:'export async function webAuth(){return {auth:{currentUser:null},sdk:{}}}'});
   return url.origin===preview.origin?route.continue():route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(preview.origin+'/'+language+'/',{waitUntil:'networkidle'});
  if(!legacy)await page.evaluate(()=>{window.DemenzKiFreigabe={enabled:()=>true,requestContext:async({requestID})=>({'X-Translator-Request-ID':requestID}),accept:()=>{},noteAnswer:()=>{},afterAnswer:()=>null};});
  const original='Eine normale Situation als Fixture.';
  await page.locator('#translator-input').fill(original);await page.locator('#translator-form [type=submit]').click();await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();await page.locator('.translator-ai-goal-choice').first().click();
  if(legacy){
   const status=page.locator('.translator-goal-answer .translator-ai-status');await assert.doesNotReject(()=>status.filter({hasText:language==='de'?'Beschreibe eine Situation':'Type in something'}).waitFor());
   assert.equal(await page.locator('.translator-goal-answer .translator-phrase,.translator-goal-answer q,.translator-goal-answer .safety-note,.translator-goal-answer .translator-ai-button:visible').count(),0);
   assert.doesNotMatch(await status.innerText(),/nicht erreichbar|not available|unavailable/i);assert.equal(requests.length,2);assert.equal(new URL(requests[1].url).search,'');
   report.cases.push({language,legacy:true,requests:requests.length,status:await status.innerText(),patientPhrase:false,alarm:false,retry:false});
  }else{
   const form=()=>page.locator('.translator-clarification-form');const field=()=>form().locator('.translator-clarification-detail');const send=()=>form().locator('button');
   await form().waitFor();assert.equal(await page.locator('.translator-goal-answer q,.translator-goal-answer .translator-phrase,.translator-goal-answer .translator-helpful,.translator-goal-answer .translator-save,.translator-goal-answer .translator-phrase-share').count(),0);
   assert.equal(await page.locator('.translator-clarification-question img').count(),0);assert.equal(await page.evaluate(()=>window.badQuestion),undefined);clarification.question='Was genau möchtest du ändern?';
   assert.match(await page.locator('.translator-ai-clarification').innerText(),/Eine Rückfrage|A question about/);
   assert.equal(requests.filter(r=>new URL(r.url).pathname.endsWith('/goals')).length,1);
   await send().click();assert.equal(requests.length,2);
   const long='🙂'.repeat(200);await field().fill(long);await send().click();assert.equal(await field().inputValue(),long);assert.equal(requests.length,2);assert.match(await page.locator('.translator-ai-clarification [role=status]').innerText(),/200/);
   const supplement='Cafe\u0301';await field().fill(supplement);fail=true;await send().click();await page.locator('.translator-ai-button:visible').waitFor();assert.equal(await field().inputValue(),supplement);
   const failed=requests.at(-1);assert.equal(failed.body.text,original+'\nCafé');assert.equal(failed.body.goal.label,goals[0].label);assert.equal(failed.body.share,false);assert.equal(failed.body.language,language==='en'?'en':undefined);assert.equal(new URL(failed.url).search,'?response_contract=clarification-v1');
   await page.locator('.translator-ai-button:visible').click();await page.waitForFunction(()=>document.querySelector('.translator-clarification-detail')?.value==='');assert.equal(requests.at(-1).headers['x-translator-request-id'],failed.headers['x-translator-request-id']);
   assert.equal(requests.at(-1).headers['x-translator-correction-of'],undefined);
   // Re-select goal A after another goal: latest combined input/result is reused, no repeated answer request.
   await page.locator('.translator-change-goal>summary').click();await page.locator('.translator-ai-goal-choice').nth(1).click();await form().waitFor();await field().fill('Entwurf bleibt lokal');const beforeReturn=requests.length;
   await page.locator('.translator-change-goal>summary').click();await page.locator('.translator-ai-goal-choice').first().click();await form().waitFor();assert.equal(requests.length,beforeReturn);await page.locator('.translator-change-goal>summary').click();await page.locator('.translator-ai-goal-choice').nth(1).click();await form().waitFor();assert.equal(await field().inputValue(),'Entwurf bleibt lokal');await page.locator('.translator-change-goal>summary').click();await page.locator('.translator-ai-goal-choice').first().click();await form().waitFor();
   // Received warning survives selecting a clarification goal.
   await page.locator('.translator-change-goal>summary').click();await page.locator('.translator-ai-goal-choice').nth(2).click();await page.locator('.safety-note:visible').waitFor();
   await page.locator('.translator-change-goal>summary').click();await page.locator('.translator-ai-goal-choice').first().click();await form().waitFor();assert.equal(await page.locator('.safety-note:visible').count(),1);
   assert.equal(await page.locator('.translator-chat:visible').count(),0);
   await page.setViewportSize({width:390,height:460});await field().focus();assert.equal(await page.locator('.translator-chat:visible').count(),0);
   for(const width of [390,1280])for(const scale of [1,2.25]){await page.setViewportSize({width,height:1000});await page.evaluate(scale=>{document.documentElement.style.fontSize=16*scale+'px';},scale);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+width+'/'+scale);if(evidence&&language==='de')await page.screenshot({path:path.join(evidence,`clarification-${width}-${scale}.png`),fullPage:true});}
   await page.evaluate(()=>{document.documentElement.style.fontSize='';});for(const width of [390,1280]){await page.setViewportSize({width,height:844});await page.locator('.translator-ai-clarification h3').evaluate(n=>window.scrollTo(0,window.scrollY+n.getBoundingClientRect().top-100));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));if(evidence&&language==='de')await page.screenshot({animations:'disabled',path:path.join(evidence,`clarification-clean-${width}-viewport.png`)});}
   mode='answer';await field().fill('Noch ein Detail');await send().click();await page.locator('.translator-ai-answer').waitFor();assert.equal(requests.at(-1).body.text,original+'\nCafé\nNoch ein Detail');assert.notEqual(requests.at(-1).headers['x-translator-request-id'],failed.headers['x-translator-request-id']);assert.equal(await page.locator('.translator-ai-answer .translator-phrase').count(),3);
   report.cases.push({language,legacy:false,requests:requests.length,fullContinuation:true,retrySameID:true,newSupplementNewID:true,cache:true,warningRetained:true,viewports:[390,1280],textScale:2.25});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;if(evidence)fs.writeFileSync(path.join(evidence,'UI-CONTRACT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser?.close();await preview?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
