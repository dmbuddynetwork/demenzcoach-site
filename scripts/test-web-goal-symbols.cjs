// Actual web renderer in Chrome; every remote endpoint is intercepted, no AI call.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createPreviewServer}=require('./generator-preview.cjs');
const evidence=process.env.GOAL_SYMBOL_EVIDENCE;
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../de/index.html'),'utf8').match(/<script type="application\/json" id="translator-data">([\s\S]*?)<\/script>/)[1]);
const mother=data.entries.find(e=>e.key==='mutter');
const mainGoals=mother.goals.map((label,i)=>({goal:'choice_'+(i+1),label}));
const matrix=[
 [['Ruhig eine Grenze setzen','boundary'],['Einen Teil meines Eises teilen','sharing'],['Das Verhalten verstehen','understand']],
 [['Den Alltag vorbereiten','planning'],['Tipps für Gespräche über früher','memory'],['Sicher nach Hause begleiten','orientation']],
 [['Beim Duschen unterstützen','personal-care'],['Über ihre Arbeit sprechen','work'],['Über Geld sprechen','money']],
 [['Die Person schützen','safety'],['Eine ruhige Antwort finden','conversation'],['Ein anderes Anliegen','question']]
];
(async()=>{let preview,browser;const report={mode:'Real Chrome UI, synthetic API responses; reviewed mother text replayed for screenshots',providerCalls:0,cases:[],errors:[]};try{
 if(evidence)fs.mkdirSync(evidence,{recursive:true});preview=await createPreviewServer();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const width of [390,1280,320]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});let goals=mainGoals;const requests=[];
  try{
   await context.addInitScript(()=>{localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied');});
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.includes('/v1/translator-web')){
     const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type'};
     if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
     if(url.pathname.endsWith('/access'))return route.fulfill({headers,json:{enabled:true,needsSession:true,contract:'signup-bonus-v1'}});
     const body=route.request().postDataJSON();requests.push(body);
     return route.fulfill({headers,json:url.pathname.endsWith('/goals')?{kind:'goals',goals,noSituation:false}:{kind:'answer',safetyLevel:'standard',safetyMessage:null,meaning:mother.short,phrases:mother.phrases,nextStep:mother.next[0],avoid:mother.avoid[2]}});
    }
    return url.origin===preview.origin?route.continue():route.abort();
   });
   const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.message));await page.goto(preview.origin+'/de/',{waitUntil:'networkidle'});
   const submit=async text=>{const top=page.locator('#translator-input');if(await top.isVisible()){await top.fill(text);await top.press('Enter');}else{await page.locator('.translator-chat-input').fill(text);await page.locator('.translator-chat-input').press('Enter');}await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();};
   await submit('Sie fragt immer wieder nach ihrer Mutter.');
   const choices=page.locator('.translator-ai-goal-choice');
   assert.deepEqual(await choices.allTextContents(),mother.goals);
   assert.deepEqual(await choices.locator('[data-goal-icon]').evaluateAll(nodes=>nodes.map(n=>n.dataset.goalIcon)),['conversation','understand','memory']);
   for(const choice of await choices.all()){
    assert.ok((await choice.boundingBox()).height>=44);assert.equal(await choice.locator('.translator-goal-icon').getAttribute('aria-hidden'),'true');assert.equal(await choice.locator('svg').getAttribute('focusable'),'false');
   }
   await choices.nth(0).click();await page.locator('.translator-ai-answer').waitFor();
   assert.deepEqual(requests[1].goal,{id:'choice_1',label:mother.goals[0]},JSON.stringify(requests.map(r=>({keys:Object.keys(r||{}),goal:r?.goal}))));
   const section=page.locator('.translator-other-goals'),own=section.locator('input'),cta=section.getByRole('button',{name:'Antwort zu meinem Ziel',exact:true});
   assert.equal(await own.getAttribute('type'),'text');assert.equal(await own.getAttribute('maxlength'),'160');assert.equal(await own.getAttribute('minlength'),'3');assert.equal(await own.getAttribute('required'),'');
   assert.equal(await page.getByLabel('Was möchtest du erreichen?',{exact:true}).count(),1);assert.equal(await own.getAttribute('placeholder'),'Zum Beispiel: Ruhig Nein sagen');
   assert.equal(await own.evaluate(n=>!!n.closest('details')),false);assert.equal(await own.isVisible(),true);assert.equal(await section.locator('textarea').count(),0);
   assert.ok((await own.boundingBox()).height>=44);assert.ok((await own.boundingBox()).height<=56);assert.ok((await cta.boundingBox()).height>=44);assert.ok(await own.evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=16);
   const box=await own.boundingBox(),button=await cta.boundingBox();if(width===1280)assert.ok(Math.abs(box.y+box.height-button.y-button.height)<2&&button.x>=box.x+box.width,'Desktop field and CTA share a row aligned at their lower edge');else assert.ok(button.y>=box.y+box.height,'Mobile field and CTA stack');
   assert.ok(await section.evaluate(n=>n.getBoundingClientRect().top>=document.querySelector('.translator-ai-answer').getBoundingClientRect().bottom),'Own goal remains below the complete answer');
   await page.evaluate(()=>document.fonts.ready);await section.evaluate(n=>scrollTo(0,scrollY+n.getBoundingClientRect().top-230));
   if(evidence&&width!==320)await page.screenshot({path:path.join(evidence,`GOALS-${width}.png`),fullPage:false});
   await own.fill('Noch nicht abgesendeter Entwurf');await own.evaluate(n=>n.dataset.draftIdentity='same');
   await choices.nth(1).click();await page.locator('.translator-ai-answer').waitFor();await choices.nth(0).click();await page.locator('.translator-ai-answer').waitFor();
   assert.equal(requests.length,3,'A-B-A reuses cached response');assert.equal(await own.inputValue(),'Noch nicht abgesendeter Entwurf');assert.equal(await own.getAttribute('data-draft-identity'),'same');
   await own.fill('ab');await own.press('Enter');assert.equal(requests.length,3,'Too-short goal sends no request');
   await own.fill('Ruhig eine Grenze setzen');await own.press('Enter');await page.getByRole('heading',{name:'Dein Ziel: Ruhig eine Grenze setzen',exact:true}).waitFor();await page.locator('.translator-ai-answer').waitFor();assert.equal(requests.length,4);assert.deepEqual(requests[3].goal,{id:'custom',label:'Ruhig eine Grenze setzen'});
   assert.ok(requests.every(r=>r.share===false));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   if(width===320){await page.addStyleTag({content:'html{font-size:200%}'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await own.isVisible(),true);}
   if(width===390){
    for(let i=0;i<matrix.length;i++){
     goals=matrix[i].map(([label],i)=>({goal:'choice_'+(i+1),label}));await submit('Eine andere Alltagssituation '+i+'.');
     assert.deepEqual(await choices.allTextContents(),goals.map(g=>g.label));assert.deepEqual(await choices.locator('[data-goal-icon]').evaluateAll(nodes=>nodes.map(n=>n.dataset.goalIcon)),matrix[i].map(([,icon])=>icon));
    }
    // The existing catalog path gets the same semantic icons without a new AI path.
    await page.goto(preview.origin+'/de/?situation=mutter&ziel=jetzt',{waitUntil:'networkidle'});
    const preset=page.locator('.translator-preset-other-goals .translator-ai-goal-choice');assert.equal(await preset.count(),2);assert.deepEqual(await preset.locator('[data-goal-icon]').evaluateAll(nodes=>nodes.map(n=>n.dataset.goalIcon)),['understand','memory']);
   }
   report.cases.push({width,semanticIcons:true,exactGoalPayload:true,smallDirectInput:true,layout:width===1280?'single-row':'stacked',preservedDraftAndCache:true,keyboardSubmitAndValidation:true,noOverflow:true,largeText:width===320,semanticMatrix:width===390?12:0});
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.passed=true;if(evidence)fs.writeFileSync(path.join(evidence,'GOAL-SYMBOL-REPORT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(browser)await browser.close();if(preview)await preview.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
