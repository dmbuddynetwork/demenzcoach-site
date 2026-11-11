// Request-bound warning history, all provider responses synthetic.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createPreviewServer}=require('./generator-preview.cjs');
const evidence=process.env.WARNING_EVIDENCE;
const goals=[{goal:'act_now',label:'Eine freundliche Grenze sagen'},{goal:'understand',label:'Die Situation besser verstehen'},{goal:'organize',label:'Eine gemeinsame Lösung finden'}];
const standard={kind:'answer',safetyLevel:'standard',meaning:'Fixture context.',phrases:['Fixture words.'],avoid:'Fixture avoid.',nextStep:'Fixture step.',safetyMessage:null};
const warning=(kind,level)=>kind==='fixed'?{kind:'safety',safetyLevel:level,message:'Fixture concern guidance.'}:{...standard,safetyLevel:level,safetyMessage:level==='concern'?'Fixture concern guidance.':null};
(async()=>{let preview,browser;const report={providerCalls:0,cases:[],errors:[]};try{
 preview=await createPreviewServer();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const language of ['de','en'])for(const kind of ['fixed','model'])for(const level of ['concern','urgent'])for(const next of ['error','standard','warning','different-warning']){
  if(process.env.WARNING_NEXT_ONLY && next!==process.env.WARNING_NEXT_ONLY)continue;
  if(process.env.WARNING_CAPTURE_ONLY && (language!=='de'||kind!=='fixed'||next!=='standard'))continue;
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});let release,requests=0;
  try{
   await context.addInitScript(()=>{localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied');});
   await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname.includes('/v1/translator-web')){
    if(url.pathname.endsWith('/goals'))return route.fulfill({json:{kind:'goals',noSituation:false,goals}});
    const body=route.request().postDataJSON();requests++;
    if(body.goal.label===goals[0].label)return route.fulfill({json:warning(kind,level)});
    await new Promise(resolve=>{release=resolve;});
    return route.fulfill({json:next==='error'?{kind:'error',reason:'unavailable'}:next==='warning'?warning(kind,level):next==='different-warning'?{kind:'safety',safetyLevel:'concern',message:'Fixture different concern.'}:standard});
   }if(url.origin!==preview.origin)return route.abort();return route.continue();});
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(preview.origin+'/'+language+'/',{waitUntil:'networkidle'});await page.locator('#translator-input').fill('Eine normale Situation als Fixture.');await page.locator('#translator-form [type=submit]').click();
   await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();await page.locator('.translator-ai-goal-choice').nth(0).click();await page.locator('.translator-goal-answer .safety-note').waitFor();
   const original=await page.locator('.translator-goal-answer .safety-note').elementHandle();
   const links=await page.locator('.safety-note:visible a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')).sort());
   await page.locator('.translator-change-goal > summary').click();await page.locator('.translator-ai-goal-choice').nth(1).click();await page.locator('.translator-goal-answer .translator-ai-wait').waitFor();
   assert.equal(await page.locator('.safety-note:visible').count(),1,'Pending B must retain the received warning for A');
   assert.equal(await original.evaluate(n=>n.isConnected),true);
   assert.match(await page.locator('[data-goal-safety-history]:visible').innerText(),new RegExp(goals[0].label));
   assert.deepEqual(await page.locator('.safety-note:visible a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')).sort()),links);
   if(evidence&&process.env.WARNING_CAPTURE_ONLY){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,level+'-B-pending.png')});}
   release();
   if(next==='error')await page.locator('.translator-goal-answer .translator-ai-button:not([hidden])').waitFor();
   else if(next==='standard'||next==='warning'&&kind==='model')await page.locator('.translator-goal-answer .translator-ai-answer').waitFor();
   else await page.locator('.translator-goal-answer .safety-note').waitFor();
   assert.equal(await page.locator('.safety-note:visible').count(),next==='different-warning'?2:1,'No warning loss; only genuinely different warnings coexist');
   if(!['warning','different-warning'].includes(next))assert.equal(await page.locator('.translator-goal-answer .safety-note').count(),0,'Historic warning is not assigned to B');
   if(evidence&&process.env.WARNING_CAPTURE_ONLY)await page.screenshot({path:path.join(evidence,level+'-B-standard.png')});
   assert.equal(await page.evaluate(()=>document.activeElement.isConnected&&!document.activeElement.closest('[hidden]')),true);
   await page.locator('.translator-change-goal > summary').click();await page.locator('.translator-ai-goal-choice').nth(0).click();await page.locator('.translator-goal-answer .safety-note').waitFor();
   assert.equal(await page.locator('.safety-note:visible').count(),next==='different-warning'?2:1,'A current warning and a genuinely different previous B warning both remain');assert.equal(requests,2,'Returning to A reuses its exact response');
   if(next==='different-warning')assert.match(await page.locator('[data-goal-safety-history]:visible').innerText(),new RegExp(goals[1].label));
   if(evidence&&language==='de'&&kind==='fixed'&&next==='standard'){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,level+'-return-A.png')});}
   await page.locator('.translator-chat-input').fill('Ein anderes Original als Fixture.');await page.locator('.translator-chat-send').click();await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();
   assert.equal(await page.locator('.safety-note').count(),0,'A new original has no inherited warning');assert.equal(await original.evaluate(n=>n.isConnected),false);
   report.cases.push({language,kind,level,next,pending:true,returnA:true,newOriginal:true});
  }finally{await context.close();}
 }
 // Both custom goals have the same technical ID but different exact labels.
 if(!process.env.WARNING_CAPTURE_ONLY)for(const language of ['de','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
   await context.addInitScript(()=>{localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied');});
   await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname.includes('/v1/translator-web')){if(url.pathname.endsWith('/goals'))return route.fulfill({json:{kind:'goals',noSituation:false,goals}});const body=route.request().postDataJSON();return route.fulfill({json:body.goal.label==='Mein erstes <img src=x> Ziel'?warning('fixed','urgent'):standard});}return url.origin===preview.origin?route.continue():route.abort();});
   const page=await context.newPage();await page.goto(preview.origin+'/'+language+'/',{waitUntil:'networkidle'});await page.locator('#translator-input').fill('Eine normale Fixture Situation.');await page.locator('#translator-form [type=submit]').click();await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();
   const custom=async(label,changed)=>{if(changed)await page.locator('.translator-change-goal > summary').click();await page.locator('.translator-own-goal-details > summary').click();await page.locator('.translator-own-goal input').fill(label);await page.locator('.translator-own-goal button').click();};
   await custom('Mein erstes <img src=x> Ziel',false);await page.locator('.translator-goal-answer .safety-note').waitFor();await custom('Ein anderes eigenes Ziel',true);await page.locator('.translator-goal-answer .translator-ai-answer').waitFor();
   const history=page.locator('[data-goal-safety-history]:visible');assert.match(await history.innerText(),/Mein erstes <img src=x> Ziel/);assert.doesNotMatch(await history.innerText(),/Ein anderes eigenes Ziel/);assert.equal(await page.locator('.safety-note:visible').count(),1);assert.equal(await history.locator('img').count(),0);
   report.cases.push({language,sameIDdifferentLabel:true,customContext:true});
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.passed=true;if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'RESULT.json'),JSON.stringify(report,null,2));}console.log(JSON.stringify({passed:true,cases:report.cases.length,scope:process.env.WARNING_NEXT_ONLY||'all',providerCalls:0,errors:report.errors}));
}finally{if(browser)await browser.close();if(preview)await preview.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
