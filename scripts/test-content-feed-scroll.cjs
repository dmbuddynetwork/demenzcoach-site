// Real local pages and signup adapters; controlled transport, never a real account or model call.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
// Share the established transport fixture, rather than replacing the account UI itself.
const fixtureSource = fs.readFileSync(path.join(__dirname, 'test-signup-sheet.cjs'), 'utf8');
const auth = fixtureSource.match(/const authModule = `([\s\S]*?)`;/)[1];
const google = fixtureSource.match(/const googleModule = `([\s\S]*?)`;/)[1];
const tips = require('../content/teller-five-tricks.de.json');
const key = 'demenzcoach.contentSignupCadence.v2';
const report = { checks: [], realProviderCalls: 0, realEmails: 0, careRequests: 0 };
(async () => {
 let preview, browser;
 try {
  preview = await createPreviewServer();
  browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
  async function fixture(options={}) {
   const context = await browser.newContext({viewport:{width:options.width || 390,height:1000},reducedMotion:'reduce'});
   await context.addInitScript(({options,key}) => {
    localStorage.setItem('demenzcoach.analyticsConsent.v1','denied'); localStorage.setItem('demenzcoach.marketingConsent.v1','denied');
    if(options.user) localStorage.setItem('__fixtureUser',JSON.stringify(options.user));
    if(options.seen) sessionStorage.setItem(key,JSON.stringify({version:2,startedAt:Date.now(),expiresAt:Date.now()+1800000,count:3,lastAt:Date.now(),pendingUntil:0}));
    if(options.blocked) { const original=Storage.prototype.getItem; Storage.prototype.getItem=function(k){ if(this===sessionStorage)throw Error('controlled blocked'); return original.call(this,k); }; }
    window.__clockOffset=0;const now=Date.now;Date.now=()=>now()+window.__clockOffset;
   },{options,key});
   const requests=[];
   await context.route('**/*', async route => {
    const req=route.request(),url=new URL(req.url());
    if(url.pathname==='/abo/web-auth.js') return route.fulfill({contentType:'text/javascript',body:auth});
    if(url.pathname==='/abo/google-auth.js') return route.fulfill({contentType:'text/javascript',body:google});
    if(url.hostname.endsWith('cloudfunctions.net')) {
     if(req.method()==='OPTIONS') return route.fulfill({status:204});
     if(url.pathname.endsWith('/access'))return route.fulfill({json:{enabled:true,verified:(req.headers().authorization||'').includes('signed-fixture'),paid:Boolean(options.paid),remaining:options.paid?999:1,registeredAdditional:3,anonymousAnswers:1,signupPlacement:'after-first',contract:'signup-bonus-v1'}});
     if(req.method()==='GET'&&url.pathname.endsWith('/config'))return route.fulfill({json:{enabled:false}});
     if(url.pathname.endsWith('/account-status'))return route.fulfill({json:{hasCustomer:false}});
     requests.push(url.pathname);report.careRequests++;return route.abort();
    }
    return url.origin===preview.origin?route.continue():route.abort();
   });
   const page=await context.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(preview.origin+'/de/',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('.content-feed')?.dataset.contentLoaded==='6');
   return {context,page,requests,errors};
  }
  const modal=p=>p.locator('.dc-signup-sheet[open]');
  async function read(page,expectModal=false) {
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(80);
   await page.mouse.move(195,850);await page.mouse.wheel(0,500);await page.waitForTimeout(100);
   await page.evaluate(()=>window.__clockOffset+=7000);
   for(let i=0;i<18;i++) {await page.mouse.wheel(0,300);await page.waitForTimeout(80);if(await modal(page).count())break;if(!expectModal&&i===11)break;}
   if(expectModal)await modal(page).waitFor();
  }
  async function check(name,fn,options) {
   if(process.env.CONTENT_SCROLL_FOCUS&&!new RegExp(process.env.CONTENT_SCROLL_FOCUS).test(name))return;
   const f=await fixture(options);try{await fn(f);assert.deepEqual(f.requests,[]);assert.deepEqual(f.errors,[]);report.checks.push(name);if(process.env.CONTENT_SCROLL_REPORT)fs.writeFileSync(process.env.CONTENT_SCROLL_REPORT,JSON.stringify(report,null,2)+'\n');console.log('PASS',name);}finally{await f.context.close();}
  }
  await check('actual catalog, two examples, early original question, compact previews with original grid and reviewed detail links, finite unique feed',async({page})=>{
   assert.equal(await page.locator('.home-situations .e-tiles > li').count(),2);
   assert.equal(await page.locator('#web-access-notice').isVisible(),false);
   assert.deepEqual(await page.locator('#e-tiles > li').evaluateAll(nodes=>nodes.slice(0,7).map(n=>n.hasAttribute('data-feed-interlude'))),[false,false,false,false,false,false,true]);
   await page.evaluate(()=>{const more=document.querySelector('.content-feed-more');for(let i=0;i<40&&!more.hidden;i++)more.click();});
   const hrefs=await page.locator('[data-content-item] > a').evaluateAll(nodes=>nodes.map(n=>n.href));assert.equal(hrefs.length,161);assert.equal(new Set(hrefs).size,161);
   for(const tip of tips.tips){const card=page.locator(`[data-feed-verified-tip="${tip.id}"]`);assert.equal(await card.locator('span').textContent(),tip.id==='nachtlicht'?'Licht auf dem Weg':tip.title);assert.equal(await card.locator('p,h3').count(),0,'Home stays a compact preview');assert.equal(await card.locator('a').getAttribute('href'),'/alltagstricks/'+tip.id+'.html');}
   const grid=await page.locator('#e-tiles').evaluate(node=>({display:getComputedStyle(node).display,columns:getComputedStyle(node).gridTemplateColumns.split(' ').length}));assert.deepEqual(grid,{display:'grid',columns:2});assert.equal(await page.locator('[data-content-item] > a').first().evaluate(n=>getComputedStyle(n).flexDirection),'column');
   assert.equal(await page.locator('.content-feed-more').isVisible(),false);assert.match(await page.locator('.content-feed-status').textContent(),/alle Tipps/);assert.equal(await modal(page).count(),0);
   const image=page.locator('[data-content-item] img').first();await image.evaluate(n=>n.dispatchEvent(new Event('error')));assert.match(await image.getAttribute('src'),/chat-helferin-fragend-lossless/);await image.evaluate(n=>n.dispatchEvent(new Event('error')));assert.equal(await image.isVisible(),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  });
  await check('programmatic scrolling never opens signup',async({page})=>{await page.evaluate(()=>{window.__clockOffset=10000;scrollTo(0,2200)});await page.waitForTimeout(250);assert.equal(await modal(page).count(),0);});
  await check('trusted scroll opens native signup; Escape restores position, focus and cooldown suppression',async({page})=>{
   await read(page,true);const count=await page.locator('[data-content-item]').count(),y=await page.evaluate(()=>scrollY);
   assert.equal(await page.locator('[data-content-signup]').count(),0);assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),1);
   await page.keyboard.press('Tab');assert.equal(await modal(page).evaluate(n=>n.contains(document.activeElement)),true);
   await page.keyboard.press('Escape');assert.equal(await modal(page).count(),0);assert.equal(await page.locator('[data-content-item]').count(),count);assert.equal(await page.evaluate(()=>scrollY),y);assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('dc-signup-sheet-open')),false);
   await page.locator('#translator-input').fill('Lokaler Entwurf bleibt erhalten');await page.locator('#translator-input').blur();await read(page);assert.equal(await modal(page).count(),0);
   await page.reload({waitUntil:'networkidle'});await read(page);assert.equal(await modal(page).count(),0);
  });
  for(const [name,user,paid] of [['verified unpaid',{uid:'member',email:'member@example.test',emailVerified:true,isAnonymous:false},false],['paid',{uid:'paid',email:'paid@example.test',emailVerified:true,isAnonymous:false},true],['unverified account',{uid:'unverified',email:'unverified@example.test',emailVerified:false,isAnonymous:false},false]])
   await check(`actual ${name} auth suppresses invitation`,async({page})=>{await read(page);assert.equal(await modal(page).count(),0);},{user,paid});
  for(const state of ['draft','dialog','pending','urgent','menu'])await check(`${state} suppresses interruption`,async({page})=>{
   await page.evaluate(state=>{if(state==='draft')document.querySelector('#translator-input').value='Meine noch nicht gesendete Frage';else{const n=document.createElement(state==='dialog'?'dialog':'div');n.id='test-blocker';n.textContent='Controlled active state';if(state==='pending')n.className='translator-ai-wait';if(state==='urgent')n.className='safety-urgent';if(state==='menu'){n.className='e-menu';n.setAttribute('open','');}document.body.append(n);if(state==='dialog')n.show();}},state);
   await read(page);assert.equal(await modal(page).count(),0);
   await page.evaluate(()=>{document.querySelector('#test-blocker')?.remove();document.querySelector('#translator-input').value='';});await read(page,true);
  });
  await check('blocked session storage fails closed',async({page})=>{await read(page);assert.equal(await modal(page).count(),0);},{blocked:true});
  await check('native normal signup already seen suppresses later scroll invitation',async({page})=>{
   await page.evaluate(async()=>{const card=document.createElement('section');document.body.append(card);const{mountInlineSignup}=await import('/abo/inline-signup.js');await mountInlineSignup(card,{bonus:3,en:false,purpose:'invitation',returnTo:'/de/'});});
   await page.keyboard.press('Escape');await read(page);assert.equal(await modal(page).count(),0);
  });
  await check('controlled Google success consumes no care action and preserves old pending draft',async({page})=>{
   await page.evaluate(()=>sessionStorage.setItem('demenzCoachKiOffen',JSON.stringify({text:'Alter geplanter Pflegefall',until:Date.now()+60000})));
   await read(page,true);const count=await page.locator('[data-content-item]').count();await page.getByRole('button',{name:'Mit Google fortfahren',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.dc-signup-sheet[open]'));
   assert.equal(await page.locator('[data-content-item]').count(),count);assert.match(await page.evaluate(()=>sessionStorage.getItem('demenzCoachKiOffen')),/Alter geplanter/);
  });
  await check('real email adapter and callback restore draft without automatic goal/answer request',async({page,context})=>{
   await read(page,true);await page.locator('.dc-signup-sheet input[type=email]').fill('controlled@example.test');await page.getByRole('button',{name:'Mit E-Mail fortfahren',exact:true}).click();await page.waitForFunction(()=>window.__requestedLink);
   const requested=await page.evaluate(()=>window.__requestedLink);assert.equal(new URL(requested).searchParams.get('returnTo'),'/de/');
   await page.evaluate(()=>sessionStorage.setItem('demenzCoachKiOffen',JSON.stringify({text:'Alter geplanter Pflegefall',until:Date.now()+60000})));
   const snapshot=await page.evaluate(()=>({storage:{...sessionStorage},offset:window.__clockOffset}));const callback=await context.newPage();await callback.addInitScript(({storage,offset})=>{Object.entries(storage).forEach(([k,v])=>sessionStorage.setItem(k,v));window.__clockOffset=offset;},snapshot);
   const url=new URL(requested);url.searchParams.set('mode','signIn');url.searchParams.set('oobCode','controlled-not-real');await callback.goto(url.href,{waitUntil:'networkidle'});
   await callback.waitForURL('**/de/',{timeout:10000});await callback.waitForLoadState('networkidle');assert.equal(await callback.locator('#translator-input').inputValue(),'Alter geplanter Pflegefall');assert.equal(await callback.locator('.translator-ai-goals').count(),0);await callback.close();
  });
  for(const relation of ['mama','papa','partner','grosseltern','andere'])await check(`original relation ${relation} hands off to original name question`,async({page})=>{
   await page.locator(`.content-funnel [data-relation="${relation}"]`).click();await page.waitForURL('**/start/?src=home_inline');const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('demenzCoachQuizProgress.v1')));assert.equal(saved.choices.relation,relation);assert.equal(saved.screen,'name');assert.equal(await page.locator('input[type=text]:visible').count(),1);
  });
  // Directly hold the existing sheet's lazy stylesheet, then change state before presentation.
  for(const race of ['auth','draft'])await check(`lazy presentation rechecks ${race}`,async({page})=>{
   await page.route('**/abo/signup-offer-view.css',async route=>{await page.evaluate(race=>{if(race==='auth')localStorage.setItem('__fixtureUser',JSON.stringify({uid:'late',email:'late@example.test',emailVerified:false,isAnonymous:false}));else document.querySelector('#translator-input').value='Entwurf während Anmeldung lädt';},race);await route.continue();});
   await read(page);assert.equal(await modal(page).count(),0);assert.equal(await page.locator('[data-content-signup]').count(),0);assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)||'null')?.pendingUntil||0,key),0);
  });
  const output=JSON.stringify(report,null,2);if(process.env.CONTENT_SCROLL_REPORT)fs.writeFileSync(process.env.CONTENT_SCROLL_REPORT,output+'\n');console.log(output);
 } finally {await browser?.close();await preview?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
