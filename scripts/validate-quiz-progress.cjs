// Real local quiz UI with remote services blocked: no synthetic plan-creation timers.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:54929';
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});try{
 for(const width of [1280,320]){
  const c=await b.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const p=await c.newPage();p.setDefaultTimeout(6000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/start/?src=qa_progress');
  for(let i=0;i<40;i++){
   const state=await p.locator('body').getAttribute('data-screen');if(state==='building')break;
   assert.equal(await p.locator('.start-ready,.start-build,[role="timer"]').count(),0,`no extra progress on ${state}`);
   const options=p.locator('#screen .start-option');
   if(await options.count()){
    await options.first().click();
    if(await p.locator('#screen .start-multi').count())await p.getByRole('button',{name:'Weiter',exact:true}).click();
   }else await p.getByRole('button',{name:'Weiter',exact:true}).click();
   await p.waitForFunction(state=>document.body.dataset.screen!==state,state);
  }
  assert.equal(await p.locator('body').getAttribute('data-screen'),'building');
  assert.equal(await p.locator('#screen h1').innerText(),'Deine Angaben im Überblick');
  assert.equal(await p.locator('.start-summary dd').count(),3);
  assert.doesNotMatch(await p.locator('#screen').innerText(),/Plan wird erstellt|\d+\s*%|Analysier|Zusammenstell/iu);
  await p.clock.install();await p.clock.fastForward(6000);
  assert.equal(await p.locator('body').getAttribute('data-screen'),'building','no timed automatic advancement');
  await p.getByRole('button',{name:'Weiter',exact:true}).click();
  await p.waitForFunction(()=>document.body.dataset.screen==='email');
  await p.reload();assert.equal(await p.locator('body').getAttribute('data-screen'),'email');
  if(await p.locator('.consent-decline').isVisible())await p.locator('.consent-decline').click();
  assert.equal(await p.evaluate(()=>window.DemenzConsent.statistics()),false);
  assert.equal(await p.evaluate(()=>localStorage.getItem('demenzcoach.analyticsConsent.v1')),'denied');
  if(width===320)await p.addStyleTag({content:'html {font-size:225% !important}'});
  const layout=await p.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth,offenders:[...document.querySelectorAll('body *')].map(n=>({node:n.tagName+'.'+n.className,rect:n.getBoundingClientRect().toJSON()})).filter(x=>x.rect.right>innerWidth+1).slice(0,7)}));
  assert.ok(layout.fits,'footer fits at large text: '+JSON.stringify(layout.offenders));
  for(const control of await p.locator('#footer a,#footer button').all()){
   if(!await control.isVisible())continue;
   assert.ok((await control.boundingBox()).height>=44,'footer target >=44px');
  }
  assert.ok(await p.locator('#footer a').filter({hasText:'Verträge hier kündigen'}).isVisible());
  const settings=p.locator('#footer .consent-settings');await settings.click();
  assert.ok(await p.locator('.consent-banner').isVisible(),'original settings control reopens consent');
  await p.locator('.consent-decline').click();
  await p.getByRole('button',{name:'Neu anfangen',exact:true}).click();
  assert.equal(await p.locator('body').getAttribute('data-screen'),'relation');
  assert.equal(await p.evaluate(()=>localStorage.getItem('demenzcoach.analyticsConsent.v1')),'denied');
  assert.deepEqual(errors,[]);await c.close();
 }
 console.log('Quiz progress/footer passed: actual summary, explicit continuation, reload, no timed creation, 320px/225%, real consent decline/reopen, links and reset.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
