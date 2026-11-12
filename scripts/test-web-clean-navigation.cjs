// Rendered offline regression: no accounts, email, provider or payment calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const evidence = process.env.CLEAN_UI_EVIDENCE;
(async () => {
 let preview, browser;
 const report = { providerCalls: 0, mockedRequests: [], cases: [], errors: [], assetErrors: [], navigationReloads: [] };
 try {
  preview = await createPreviewServer();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  for (const language of ['de', 'en']) {
   const context = await browser.newContext({ viewport: { width: process.env.DESKTOP_DIAGNOSTIC ? 1280 : 390, height: process.env.DESKTOP_DIAGNOSTIC ? 800 : 844 }, reducedMotion: 'reduce' });
   try {
    let releaseGoals, failGoals = false;
    const goals = [{ goal: 'choice_1', label: 'Meine Grenze freundlich sagen' }, { goal: 'choice_2', label: 'Das Verhalten besser verstehen' }, { goal: 'choice_3', label: 'Den Alltag leichter gestalten' }];
    await context.addInitScript(() => { navigator.share=async payload=>{window.__fixtureShared=payload;};localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied'); });
    await context.route('**/*', async route => {
     const url = new URL(route.request().url());
     if (url.pathname.includes('/v1/translator-web')) {
      const body = route.request().postDataJSON(); report.mockedRequests.push({ path: url.pathname, body });
      if (url.pathname.endsWith('/access')) return route.fulfill({ json: { enabled:false } });
      if (url.pathname.endsWith('/goals')) {
       if (failGoals) return route.fulfill({ status:503, json:{} });
       await new Promise(resolve => { releaseGoals = resolve; });
       return route.fulfill({ json: { kind:'goals',noSituation:false,goals } });
      }
      if (body.goal.id === 'choice_2') await new Promise(resolve => setTimeout(resolve,250));
      return route.fulfill({ json:{ kind:'answer',meaning:body.goal.label,phrases:['Das ist mein Anteil.','Ich möchte meinen Anteil behalten.','Lass uns eine andere Lösung finden.'],avoid:'Du nimmst immer alles!',nextStep:'Sprich in Ruhe weiter.',safetyLevel:'standard',safetyMessage:null } });
     }
     if (url.origin === preview.origin && url.pathname === '/abo/web-auth.js') return route.fulfill({contentType:'text/javascript',body:'export async function webAuth(){return {auth:{currentUser:null},sdk:{}}}'});
     if (url.origin !== preview.origin) return route.abort();
     return route.continue();
    });
    const page = await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));page.on('response',response=>{if(response.url().startsWith(preview.origin)&&response.status()>=400)report.assetErrors.push({url:response.url(),status:response.status()});});
    await page.goto(preview.origin+'/'+language+'/',{waitUntil:'networkidle'});
    assert.equal(await page.locator('[data-ready-situations]').count(),0);
    const menu = page.locator('.e-menu'); await menu.locator('summary').click();
    assert.equal(await menu.locator('a[href*="konto.html"]').count(),1);
    await menu.locator('summary').press('Escape'); assert.equal(await menu.getAttribute('open'),null);
    await page.evaluate(()=>scrollTo(0,400)); assert.ok((await page.locator('.e-header').boundingBox()).y>=0);
    await page.evaluate(()=>scrollTo(0,0));
    await page.locator('#translator-input').fill('Sie will mein ganzes Eis essen.');
    await page.locator('#translator-form [type=submit]').click();
    await page.locator('.translator-ai-goals[aria-busy=true] .translator-ai-wait').waitFor();
    assert.equal(await page.locator('.translator-ai-goal-retry').isVisible(),false);
    assert.equal(await page.locator('#translator-form').isVisible(),false);
    assert.equal(await page.locator('.translator-ai-answer').count(),0);
    releaseGoals();await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();
    const choices=page.locator('.translator-ai-goal-choice');await choices.nth(0).click();
    await page.locator('.translator-ai-answer').waitFor();
    assert.equal(await choices.count(),3);assert.equal(await choices.nth(0).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.translator-ai-answer .translator-phrase').count(),3);
    await choices.nth(1).click();await choices.nth(0).click();
    await page.locator('.translator-ai-answer').waitFor();await page.waitForTimeout(350);
    assert.equal(await page.locator('.translator-ai-answer .translator-ai-meaning').first().textContent(),goals[0].label);
    assert.equal(report.mockedRequests.filter(r=>r.body?.goal?.id==='choice_1' && r.body.text==='Sie will mein ganzes Eis essen.').length,language==='de'?1:2,'A is requested once per independent situation, including A → B → A');
    assert.equal(await page.locator('.translator-chat-input').isVisible(),true);
    for (const width of (process.env.MOBILE_DIAGNOSTIC ? [390] : process.env.DESKTOP_DIAGNOSTIC ? [1280] : [390,1280])) {
     await page.setViewportSize({width,height:width===390?844:800});
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
     if(evidence){
      fs.mkdirSync(evidence,{recursive:true});
      await page.evaluate(()=>{scrollTo(0,0);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      const headerGeometry=await page.locator('.e-header').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent,rect:node.getBoundingClientRect().toJSON()})));
      assert.equal(headerGeometry.length,1);
      fs.writeFileSync(path.join(evidence,language+'-header-'+width+'.json'),JSON.stringify({viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight})),headers:headerGeometry,bottomHit:await page.evaluate(()=>document.elementFromPoint(400,750)?.outerHTML.slice(0,180))},null,2));
      await page.screenshot({path:path.join(evidence,language+'-answer-top-'+width+'.png')});
      await page.locator('.translator-ai-answer').evaluate(node=>node.scrollIntoView({block:'start',behavior:'instant'}));
      await page.screenshot({path:path.join(evidence,language+'-answer-'+width+'.png')});
      const feedback=page.locator('.translator-feedback button').last();
      await feedback.focus();await feedback.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
      const focusBox=await feedback.boundingBox(),dockBox=await page.locator('.translator-chat').boundingBox(),headerBox=await page.locator('.e-header').boundingBox();
      assert.ok(focusBox.y>=headerBox.y+headerBox.height && focusBox.y+focusBox.height<=dockBox.y,'Feedback can be focused and scrolled fully clear of header/composer');
      await page.locator('.e-footer').scrollIntoViewIfNeeded();
      await page.waitForLoadState('networkidle');
      await page.locator('.e-footer').evaluate(node=>node.scrollIntoView({block:'start',behavior:'instant'}));
      const lastFooter=page.locator('.e-footer a').last();await lastFooter.scrollIntoViewIfNeeded();await page.waitForLoadState('networkidle');await lastFooter.focus();await lastFooter.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
      const footerBox=await lastFooter.boundingBox(),composerBox=await page.locator('.translator-chat').boundingBox();
      assert.ok(footerBox.y+footerBox.height<=composerBox.y,'Last footer action can be reached above the composer '+JSON.stringify({footerBox,composerBox}));
      assert.ok(footerBox.y>=0,'Actual footer link is in the viewport');
      await page.screenshot({path:path.join(evidence,language+'-footer-'+width+'.png')});
     }
    }
    const text='Eine neue Situation mit genügend Text, damit auch die vollständige Eingabe übertragen wird.';
    await page.locator('.translator-chat-input').fill(text);await page.locator('.translator-chat-send').click();
    await page.locator('.translator-ai-goals[aria-busy=true]').waitFor();releaseGoals();await page.locator('.translator-ai-goals[data-goal-state=ready]').waitFor();
    assert.equal(report.mockedRequests.filter(r=>r.path.endsWith('/goals')).at(-1).body.text,text);
    assert.equal(new URL(page.url()).search,'');assert.equal(new URL(page.url()).hash,'');
    // Invoke the real production mount + full local asset graph. Only its auth
    // context is a read-only fixture; there is no account creation or email send.
    const signup=await page.evaluate(async language=>{
     const {mountInlineSignup}=await import('/abo/inline-signup.js');
     const holder=document.createElement('div');document.getElementById('translator-result').replaceChildren(holder);
     await mountInlineSignup(holder,{bonus:4,en:language==='en',purpose:'invitation',onBegin(){},returnTo:location.pathname});
     const card=document.querySelector('.dc-signup');
     if(!card)throw new Error('Production signup mount did not render');
     return {text:card.textContent,images:card.querySelectorAll('img').length,count:document.querySelectorAll('.dc-signup').length};
    },language);
    await page.locator('link[data-inline-signup]').evaluate(link=>link.sheet?true:new Promise(resolve=>link.addEventListener('load',()=>resolve(true),{once:true})));
    assert.equal(signup.count,1);
    assert.equal(await page.locator('.dc-signup .google svg').evaluate(node=>Math.round(node.getBoundingClientRect().width)),20);
    assert.equal(signup.images,0);assert.doesNotMatch(signup.text,/Debby|wiederfinden|sync/i);assert.doesNotMatch(signup.text,/4|weitere KI-Antworten|more AI answers/);
    const creditModes=await page.evaluate(async()=>{const {createSignupOffer}=await import('/abo/signup-offer-view.js');return ['invitation','intro','intro'].map((purpose,index)=>createSignupOffer({additionalAnswers:4,purpose,creditActive:index!==1,onEmail:async()=>({sent:true})}).textContent);});
    assert.doesNotMatch(creditModes[0],/4/);assert.doesNotMatch(creditModes[1],/4/);assert.match(creditModes[2],/4/);
    await page.locator('.dc-signup').scrollIntoViewIfNeeded();
    if(evidence)for(const width of [390,1280]){await page.setViewportSize({width,height:width===390?844:800});await page.screenshot({path:path.join(evidence,language+'-signup-'+width+'.png'),fullPage:false});}
    await page.goto(preview.origin+'/'+language+'/',{waitUntil:'networkidle'});failGoals=true;
    await page.locator('#translator-input').fill('Ein neuer schwieriger Moment.');await page.locator('#translator-form [type=submit]').click();
    await page.locator('.translator-ai-goals[data-goal-state=unavailable]').waitFor();assert.equal(await page.locator('.translator-ai-wait').count(),0);assert.equal(await page.locator('.translator-ai-goal-retry').isEnabled(),true);
    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/generator-public-routes.json')));
    const route=manifest.routes.find(route=>route.language===language && route.goalPaths);
    if(route && !process.env.SKIP_PREPARED_CHECK){
     await page.goto(preview.origin+route.path,{waitUntil:'networkidle'});
     assert.equal(await page.locator('#translator-form').isVisible(),false);
     assert.equal(await page.locator('.translator-answer').isVisible(),true);
     const paths=Object.values(route.goalPaths);
     await page.locator('.translator-answer .translator-change-goal > summary').click();
     await page.locator('.translator-answer .translator-ai-goal-choice').nth(1).click();
     assert.equal(new URL(page.url()).pathname,paths[1]);
     await page.reload({waitUntil:'networkidle'});
     assert.equal(await page.locator('#translator-form').isVisible(),false);
     assert.equal(await page.locator('.translator-answer .translator-ai-goal-choice[aria-pressed=true]').count(),1);
     await page.goBack({waitUntil:'networkidle'});
     assert.equal(new URL(page.url()).pathname,route.path);
     try { await page.goForward({waitUntil:'networkidle'}); } catch(error) { if(!error.message.includes('ERR_ABORTED'))throw error;report.navigationReloads.push({language,operation:'forward',cause:'existing popstate forces document reload'}); }
     await page.waitForURL(preview.origin+paths[1],{waitUntil:'networkidle'});assert.equal(new URL(page.url()).pathname,paths[1]);
     await page.locator('.translator-answer').waitFor();assert.equal(await page.locator('.translator-answer .translator-ai-goal-choice').nth(1).getAttribute('aria-pressed'),'true');
     const save=page.locator('.translator-answer .translator-save').first();await save.click();assert.equal(await save.getAttribute('aria-pressed'),'true');
     await page.locator('.translator-answer .translator-phrase-share').first().click();
     const shared=await page.evaluate(()=>window.__fixtureShared);assert.equal(new URL(shared.url).hostname,'dementiacoachapp.com');assert.doesNotMatch(shared.text,/mein ganzes Eis|persönliche Situation/);
     const raw=await (await page.request.get(preview.origin+route.path)).text();
     assert.match(raw,/<form hidden [^>]*id="translator-form"/,'Prepared direct URL hides the primary form before hydration');
    }
    report.cases.push(language+': menu, sticky header, pending, three phrases, persistent goals, A→B→A cache/race, composer, signup, retry');
   } finally {await context.close();}
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.assetErrors,[]);
  if(evidence)fs.writeFileSync(path.join(evidence,'RESULT.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({pass:true,...report,cases:report.cases,mockedRequests:report.mockedRequests.length}));
 } finally {if(browser)await browser.close();if(preview)await preview.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
