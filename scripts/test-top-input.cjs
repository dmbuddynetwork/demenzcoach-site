// Two representative local hydration cases; no production caches or88 exports.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createPreviewServer}=require('./generator-preview.cjs');
const root=path.resolve(__dirname,'..');
const evidence=path.resolve(process.env.TOP_INPUT_EVIDENCE||path.join(os.tmpdir(),'dc-top-input-evidence'));
const formPattern=/<form\b[^>]*\bid="translator-form"[^>]*>[\s\S]*?<\/form>/;
const choicePattern=/<section data-ready-situations="v1"[\s\S]*?<\/section>/;
(async()=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'dc-top-input-'));
 let browser,preview;const report={prototype:true,final88Export:false,cases:[],externalRequests:[],errors:[]};
 try{
  fs.mkdirSync(evidence,{recursive:true});
  fs.cpSync(root,fixture,{recursive:true,mode:fs.constants.COPYFILE_FICLONE,filter:file=>path.basename(file)!=='.git'});
  const sources=Object.fromEntries(['de','en'].map(lang=>[lang,fs.readFileSync(path.join(fixture,`content/ready-situations.${lang}.json`),'utf8')]));
  execFileSync(process.execPath,[path.join(root,'scripts/build-ready-situations.mjs'),fixture,'--prepare-views']);
  const routes=JSON.parse(fs.readFileSync(path.join(fixture,'content/generator-public-routes.json'),'utf8')).routes;
  const selected=routes.filter(route=>route.topicId==='finding-toilet'&&(!process.env.TOP_INPUT_DE_ONLY||route.language==='de'));assert.equal(selected.length,process.env.TOP_INPUT_DE_ONLY?1:2);
  // Prototype HTML uses the actual newly prepared shared form/examples. Existing
  // answer HTML is preserved until the actual controller hydrates it. These two
  // temporary files are not publishable outputs and never refresh cache bindings.
  for(const route of selected){
   const home=fs.readFileSync(path.join(fixture,route.language,'index.html'),'utf8');
   const file=path.join(fixture,route.path),original=fs.readFileSync(file,'utf8');
   const html=original.replace(/<body\b([^>]*)>/,(_m,attrs)=>`<body${attrs} data-translator-input-position="top">`)
    .replace(formPattern,()=>home.match(formPattern)[0]).replace(choicePattern,'');
   fs.writeFileSync(file,html);
  }
  preview=await createPreviewServer({root:fixture});
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  for(const route of selected){
   const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
   try{
    await context.addInitScript(()=>{localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied');});
    await context.route('**/*',request=>{const url=new URL(request.request().url());if(url.origin===preview.origin)return request.continue();report.externalRequests.push(url.origin+url.pathname);return request.abort();});
    const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>report.errors.push(error.message));
    const ready=()=>page.waitForFunction(()=>window.DemenzTranslatorCore&&!document.querySelector('#translator-result .translator-followup-question'));
    const inspect=()=>page.evaluate(()=>{
     const form=document.getElementById('translator-form'),input=document.getElementById('translator-input'),result=document.getElementById('translator-result'),box=input.getBoundingClientRect(),submit=form.querySelector('[type="submit"]').getBoundingClientRect();
     return {formCount:document.querySelectorAll('#translator-form').length,inputCount:document.querySelectorAll('#translator-input').length,formBeforeResult:Boolean(form.compareDocumentPosition(result)&Node.DOCUMENT_POSITION_FOLLOWING),outsideResult:!result.contains(form),visible:box.width>0&&box.height>0,inputTop:box.top,inputBottom:box.bottom,scrollY,activeTag:document.activeElement.tagName,activeInResult:result.contains(document.activeElement),label:form.querySelector('label').textContent,rows:input.rows,submitHeight:submit.height,submitWidth:submit.width,overflow:document.documentElement.scrollWidth>innerWidth+1,feedbackInInput:!!form.querySelector('.translator-feedback'),feedbackInAnswer:!!result.querySelector('.translator-feedback'),exampleLinks:document.querySelectorAll('[data-ready-situations] a').length,exampleButtons:document.querySelectorAll('[data-ready-situations] button').length,examplesOpen:document.querySelector('[data-ready-situations] details')?.open??false,hasOldInputLabel:!!document.querySelector('.translator-followup-question'),h1:document.querySelectorAll('h1').length};
    });
    const captures=[];
    for(const width of [390,1280]){
     await page.setViewportSize({width,height:900});await page.goto(preview.origin+route.path,{waitUntil:'networkidle'});await ready();
     const metrics=await inspect();assert.equal(metrics.formCount,1);assert.equal(metrics.inputCount,1);assert.ok(metrics.formBeforeResult&&metrics.outsideResult);assert.ok(metrics.visible&&metrics.inputTop>=0&&metrics.inputBottom<450);assert.equal(metrics.scrollY,0);assert.ok(!metrics.activeInResult&&metrics.activeTag!=='TEXTAREA');assert.equal(metrics.label,route.language==='de'?'Was sagen und tun bei Demenz?':'What can I say and do?');assert.equal(metrics.rows,2);assert.ok(metrics.submitHeight>=44&&metrics.submitWidth>=44);assert.equal(metrics.overflow,false);assert.equal(metrics.feedbackInInput,false);assert.equal(metrics.feedbackInAnswer,true);assert.equal(metrics.exampleLinks,0);assert.equal(metrics.exampleButtons,0);assert.equal(metrics.examplesOpen,false);assert.equal(metrics.hasOldInputLabel,false);assert.equal(metrics.h1,1);
     const design=await page.evaluate(()=>{
      const goal=document.querySelector('.translator-goal-chosen'),art=document.querySelector('.translator-said-art'),note=document.querySelector('#translator-form .translator-privacy'),label=document.querySelector('#translator-form label'),intro=document.querySelector('#translator-form-intro');
      const bounds=node=>{if(!node)return null;const r=node.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right,scroll:node.scrollWidth,client:node.clientWidth};};
      return {goal:bounds(goal),goalFont:goal?parseFloat(getComputedStyle(goal).fontSize):null,goalText:goal?.textContent,art:bounds(art),note:{font:parseFloat(getComputedStyle(note).fontSize),weight:getComputedStyle(note).fontWeight,color:getComputedStyle(note).color},links:[...note.querySelectorAll('a')].map(a=>({href:a.getAttribute('href'),weight:getComputedStyle(a).fontWeight,color:getComputedStyle(a).color,decoration:getComputedStyle(a).textDecorationLine})),intro:intro?.textContent,label:label.textContent,described:document.getElementById('translator-input').getAttribute('aria-describedby')};
     });
     assert.ok(design.art.height>=140);assert.ok(design.art.right<=width+1);assert.ok(design.note.font<=13.1);assert.equal(design.note.weight,'400');assert.equal(design.note.color,'rgb(98, 96, 107)');for(const a of design.links){assert.equal(a.weight,'400');assert.equal(a.color,design.note.color);assert.equal(a.decoration,'none');}
     assert.ok(design.described.includes('translator-form-intro'));assert.equal(design.intro,route.language==='de'?'Passende Worte und praktische Tipps für deine Situation.':'Find the right words and practical tips for your situation.');
     if(route.language==='de'){assert.ok(design.goalFont>=(width<640?22:26));assert.ok(design.goal.right<=width+1&&design.goal.scroll<=design.goal.client+1);assert.ok(design.goalText.includes('Den Weg zur Toilette zeigen'));}
     metrics.design=design;
     await page.screenshot({path:path.join(evidence,`${route.language}-${width}.png`),fullPage:false});captures.push({width,metrics});
    }
    // The legal links remain real, clickable local destinations and have a
    // visible keyboard focus; input-home examples stay available.
    if(route.language==='de'){
     const legal=await page.locator('#translator-form .translator-privacy a').evaluateAll(links=>links.map(a=>a.getAttribute('href')));assert.equal(legal.length,2);
     for(const href of legal){
      const link=page.locator('#translator-form .translator-privacy a').filter({hasText:href.includes('nutzungs')?'Nutzungsbedingungen':'Informationen zu Datenschutz'});await link.focus();assert.ok(await link.evaluate(a=>parseFloat(getComputedStyle(a).outlineWidth)>=2));await link.click();assert.equal(new URL(page.url()).pathname,new URL(href,preview.origin).pathname);await page.goBack({waitUntil:'networkidle'});await ready();
     }
     await page.goto(preview.origin+'/de/',{waitUntil:'networkidle'});assert.equal(await page.locator('[data-ready-situations]').isVisible(),true);assert.equal(await page.locator('[data-ready-situations] a').count(),2);
     await page.goto(preview.origin+route.path,{waitUntil:'networkidle'});await ready();
    }
    // Initial selection routes and legacy queries without a goal must retain
    // the visible input and must not force focus or scroll on page entry.
    if(route.language==='de'){
     for(const entryPath of [route.selectionPath,'/de/?situation='+route.key]){
      await page.goto(preview.origin+entryPath,{waitUntil:'networkidle'});await page.locator('.translator-goals').waitFor();
      const state=await inspect();assert.ok(state.visible&&state.formBeforeResult&&state.outsideResult);assert.equal(await page.locator('#translator-form').isVisible(),true);assert.equal(state.scrollY,0);assert.ok(!state.activeInResult&&state.activeTag!=='TEXTAREA');assert.equal(new URL(page.url()).pathname,route.selectionPath);assert.equal(new URL(page.url()).search,'');
     }
     await page.goto(preview.origin+route.path,{waitUntil:'networkidle'});await ready();
    }
    // A draft survives a change of answer goal; only explicit submission consumes it.
    if(route.language==='de'){
     await page.locator('#translator-input').fill('DRAFT_SENTINEL eigene noch nicht gesendete Situation');
     const label=JSON.parse(sources.de).find(entry=>entry.key===route.key).goals[1];
     await page.getByRole('button',{name:label,exact:true}).click();
     assert.equal(await page.locator('#translator-input').inputValue(),'DRAFT_SENTINEL eigene noch nicht gesendete Situation');assert.ok(!page.url().includes('DRAFT_SENTINEL'));
    }
    await page.setViewportSize({width:320,height:900});await page.addStyleTag({content:'html{font-size:200%}'});await page.locator('#translator-input').fill('Eine längere eigene Situation bleibt bei großer Schrift vollständig im Feld sichtbar.');
    const large=await page.locator('#translator-input').evaluate(input=>({clipped:input.scrollHeight>input.clientHeight+3,overflow:document.documentElement.scrollWidth>innerWidth+1}));assert.equal(large.clipped,false);assert.equal(large.overflow,false);if(route.language==='de'){const goalFit=await page.locator('.translator-goal-chosen').evaluate(p=>p.scrollWidth<=p.clientWidth+1&&p.getBoundingClientRect().right<=innerWidth+1);assert.equal(goalFit,true);}
    const next=JSON.parse(sources[route.language]).find(entry=>entry.page.topicId==='legacy-mutter');assert.ok(next);
    await page.locator('#translator-input').fill(next.says);await page.locator('#translator-input').press('Enter');
    if(route.language==='de'){
     await page.locator('.translator-goals').waitFor();
     assert.equal(await page.locator('#translator-form').isVisible(),true);
     const interim=await inspect();assert.ok(interim.formBeforeResult&&interim.outsideResult&&interim.visible);
     await page.getByRole('button',{name:next.goals[0],exact:true}).click();
    }
    await page.waitForFunction(key=>document.querySelector('#translator-result h1')&&location.pathname.includes(key),next.page.path.split('/').pop().replace('.html',''));
    assert.equal(new URL(page.url()).pathname,next.page.path);assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('#translator-input').inputValue(),'');assert.equal(await page.locator('#translator-form').count(),1);assert.equal(await page.locator('#translator-result #translator-form').count(),0);
    report.cases.push({language:route.language,key:route.key,captures,draftPreserved:route.language==='de'?'tested':'not-applicable',initialSelectionAndQuery:route.language==='de'?'tested':'not-applicable',goalInputVisible:route.language==='de'?'tested':'not-applicable',enterSubmit:true,largeText:true});
   }finally{await context.close();}
  }
  for(const lang of ['de','en'])assert.equal(fs.readFileSync(path.join(fixture,`content/ready-situations.${lang}.json`),'utf8'),sources[lang]);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.passed=true;
  fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,representativeCases:selected.length,screenshots:selected.length*2,final88Export:false,externalRequests:0,evidence}));
 }finally{if(browser)await browser.close();if(preview)await preview.close();fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
