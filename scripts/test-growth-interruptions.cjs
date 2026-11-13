// Real local UI/adapters with controlled auth/status transport. No real account, email or AI action.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createPreviewServer}=require('./generator-preview.cjs');
const source=fs.readFileSync(path.join(__dirname,'test-signup-sheet.cjs'),'utf8');
const auth=source.match(/const authModule = `([\s\S]*?)`;/)[1];
const key='demenzcoach.contentSignupCadence.v2';
const report={checks:[],realProviderMailModelActions:0};
(async()=>{let preview,browser;try{
 preview=await createPreviewServer();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 async function fixture(options={}){
  const context=await browser.newContext({viewport:{width:options.width||390,height:900},reducedMotion:'reduce'});
  await context.addInitScript(({options,key})=>{
   localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied');
   if(Object.prototype.hasOwnProperty.call(options,'user'))localStorage.setItem('__fixtureUser',JSON.stringify(options.user));
   Object.defineProperty(window,'__clockOffset',{get:()=>Number(localStorage.getItem('__growthClock')||0),set:value=>localStorage.setItem('__growthClock',String(value))});
   const now=Date.now;Date.now=()=>now()+window.__clockOffset;
   if(options.blocked){const original=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(this===sessionStorage)throw Error('controlled blocked session');return original.call(this,k);};}
  },{options,key});
  let hold=false;const gates=[],requests=[],errors=[];let page;
  await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/abo/web-auth.js')return route.fulfill({contentType:'text/javascript',body:options.lateAuth?auth.replace('export async function webAuth(){','export async function webAuth(){if(window.__holdSignupAuth){window.__holdSignupAuth=false;await new Promise(resolve=>window.__releaseSignupAuth=resolve);}'):auth});
   if(options.lateAuth&&url.pathname==='/abo/inline-signup.js'){const body=fs.readFileSync(path.join(__dirname,'../abo/inline-signup.js'),'utf8').replace('export async function mountInlineSignup(','async function realMountInlineSignup(');return route.fulfill({contentType:'text/javascript',body:body+'\nexport function mountInlineSignup(...args){window.__holdSignupAuth=true;return realMountInlineSignup(...args)}'});}
   if(url.hostname.endsWith('cloudfunctions.net')){
    if(req.method()==='OPTIONS')return route.fulfill({status:204});
    if(url.pathname.endsWith('/access')){if(hold)await new Promise(resolve=>gates.push(resolve));const paid=Boolean(options.paid)||(options.lateAuth&&await page.evaluate(()=>JSON.parse(localStorage.getItem('__fixtureUser'))?.uid==='different-paid'));return route.fulfill({json:{enabled:true,verified:Boolean(options.user?.emailVerified),paid:Boolean(paid),remaining:paid?999:1,registeredAdditional:3,contract:'signup-bonus-v1'}});}
    if(url.pathname.endsWith('/config'))return route.fulfill({json:{enabled:false}});
    requests.push(url.pathname);return route.abort();
   }
   return url.origin===preview.origin?route.continue():route.abort();
  });
  page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(preview.origin+(options.route||'/de/'),{waitUntil:'networkidle'});
  return{context,page,requests,errors,gates,setHold:value=>hold=value};
 }
 const modal=p=>p.locator('.dc-signup-sheet[open]');
 const tick=(p,ms)=>p.evaluate(ms=>window.__clockOffset+=ms,ms);
 async function read(p,{show=true,steps=26}={}){
  await p.mouse.move(180,700);await p.mouse.wheel(0,260);await p.waitForTimeout(80);await tick(p,5100);
  for(let i=0;i<steps;i++){await p.mouse.wheel(0,180);await p.waitForTimeout(45);if(await modal(p).count())break;}
  if(show)await modal(p).waitFor();
 }
 async function check(name,fn,options){
  if(process.env.GROWTH_FOCUS&&!new RegExp(process.env.GROWTH_FOCUS).test(name))return;
  const f=await fixture(options);try{await fn(f);assert.deepEqual(f.requests,[]);assert.deepEqual(f.errors,[]);report.checks.push(name);console.log('PASS',name);}finally{f.gates.forEach(resolve=>resolve());await f.context.close();}
 }
 await check('open signup history departure starts cooldown at departure, not initial presentation',async({page})=>{
  await page.goto(preview.origin+'/de/',{waitUntil:'networkidle'});await read(page);await tick(page,61000);const departure=await page.evaluate(()=>Date.now());
  await page.goBack({waitUntil:'networkidle'});assert.ok(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).lastAt,key)>=departure,'Open sheet departure synchronously persists close cooldown');
  await read(page,{show:false,steps:4});assert.equal(await modal(page).count(),0,'Fresh content reading within60s of leaving open sheet cannot reprompt');
  await page.goForward({waitUntil:'networkidle'});assert.equal(await modal(page).count(),0,'History return never restores stale open sheet');
 },{route:'/alltagstricks/zettel-wo-du-bist.html'});
 await check('persisted page lifecycle resets owned signup without touching a foreign dialog or draft',async({page})=>{
  await read(page);await tick(page,61000);const departure=await page.evaluate(()=>Date.now());
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));assert.equal(await modal(page).count(),0);assert.equal(await page.locator('[data-content-signup]').count(),0);
  assert.ok(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).lastAt,key)>=departure);assert.equal(await page.evaluate(()=>document.body.classList.contains('dc-signup-sheet-open')),false);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await read(page,{show:false,steps:4});assert.equal(await modal(page).count(),0);
  await page.evaluate(()=>{const d=document.createElement('dialog');d.id='foreign-dialog';d.innerHTML='<input value="Unveränderte Eingabe">';document.body.append(d);d.showModal();d.querySelector('input').focus();dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  assert.equal(await page.locator('#foreign-dialog').evaluate(d=>d.open),true);assert.equal(await page.locator('#foreign-dialog input').inputValue(),'Unveränderte Eingabe');assert.equal(await page.locator('#foreign-dialog input').evaluate(n=>document.activeElement===n),true);
 });
 for(const initial of ['guest','anonymous'])for(const change of [false,true])await check('late signup auth '+initial+(change?' to paid identity is suppressed':' stable identity still presents'),async({page})=>{
  await read(page,{show:false});await page.waitForFunction(()=>typeof window.__releaseSignupAuth==='function');
  assert.equal(await modal(page).count(),0,'Presentation waits for actual second auth resolution');
  await page.evaluate(change=>{if(change)localStorage.setItem('__fixtureUser',JSON.stringify({uid:'different-paid',email:null,emailVerified:false,isAnonymous:true}));window.__holdSignupAuth=false;window.__releaseSignupAuth();},change);
  if(change){await page.waitForTimeout(250);assert.equal(await modal(page).count(),0,'A newly changed anonymous paid identity never inherits earlier free status');assert.equal(await page.locator('[data-content-signup]').count(),0,'No orphan invite');assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),0);}
  else{await modal(page).waitFor();assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),1);}
 },{lateAuth:true,user:initial==='guest'?null:{uid:'anonymous-free',email:null,emailVerified:false,isAnonymous:true}});
 await check('earlier first invitation is reading based; dismissal restores reading focus',async({page})=>{
  await page.evaluate(()=>scrollTo(0,350));await tick(page,10000);await page.waitForTimeout(80);assert.equal(await modal(page).count(),0,'Programmatic scroll alone never invites');
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(60);await page.mouse.move(180,700);await page.mouse.wheel(0,260);await page.waitForTimeout(60);await tick(page,4000);await page.mouse.wheel(0,20);await page.waitForTimeout(60);assert.equal(await modal(page).count(),0,'Not before five seconds');
  await tick(page,1100);await page.mouse.wheel(0,120);await modal(page).waitFor();
  const y=await page.evaluate(()=>scrollY);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.matches('input,textarea')),false);assert.equal(await page.evaluate(()=>scrollY),y);assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),1);
 });
 await check('repeat needs cooldown and fresh content; maximum three then window reset',async({page})=>{
  await read(page);await page.keyboard.press('Escape');await tick(page,61000);
  await page.mouse.wheel(0,50);await tick(page,5100);await page.mouse.wheel(0,50);await page.waitForTimeout(80);assert.equal(await modal(page).count(),0,'No new six-block reading progress');
  await read(page);assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),2);await page.keyboard.press('Escape');
  await tick(page,61000);await read(page);assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),3);await page.keyboard.press('Escape');
  await tick(page,61000);await read(page,{show:false});assert.equal(await modal(page).count(),0);assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),3);
  await tick(page,31*60000);await page.goto(preview.origin+'/alltagstricks/farbiger-becher.html',{waitUntil:'networkidle'});await read(page,{steps:2});assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),1);
 });
 await check('new tip page can invite after cooldown; no permanent tab-wide suppression',async({page})=>{
  await read(page);await page.keyboard.press('Escape');await tick(page,61000);await page.goto(preview.origin+'/alltagstricks/farbiger-becher.html',{waitUntil:'networkidle'});await read(page,{steps:2});assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),2);
  const state=await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),key);assert.deepEqual(Object.keys(state),['version','startedAt','expiresAt','count','lastAt','pendingUntil']);
 });
 for(const [label,user,paid] of [['registered unpaid',{uid:'member',email:'member@example.test',emailVerified:true,isAnonymous:false},false],['paid',{uid:'paid',email:'paid@example.test',emailVerified:true,isAnonymous:false},true]])
  await check(label+' suppresses automatic registration',async({page})=>{await read(page,{show:false});assert.equal(await modal(page).count(),0);},{user,paid});
 await check('anonymous paid identity also suppresses registration',async({page})=>{await read(page,{show:false});assert.equal(await modal(page).count(),0);},{paid:true});
 for(const state of ['draft','menu','pending','urgent','dialog'])await check(state+' protects reading and rechecks before showing',async({page})=>{
  await page.evaluate(state=>{if(state==='draft')document.querySelector('#translator-input').value='Noch nicht gesendete Frage';else{const n=document.createElement(state==='dialog'?'dialog':'div');n.id='blocker';n.textContent='Controlled protected state';if(state==='menu'){n.className='site-menu';n.setAttribute('open','');}if(state==='pending')n.className='translator-ai-wait';if(state==='urgent')n.className='safety-urgent';document.body.append(n);if(state==='dialog')n.show();}},state);
  await read(page,{show:false});assert.equal(await modal(page).count(),0);
 });
 await check('blocked storage fails closed for automatic sheets',async({page})=>{await read(page,{show:false});assert.equal(await modal(page).count(),0);},{blocked:true});
 for(const width of [390,1280])await check('repeated original picture cards at 18/30/42 '+width,async({page})=>{
  await page.mouse.move(width/2,700);await page.mouse.wheel(0,240);await page.waitForTimeout(80);
  await page.evaluate(()=>{const b=document.querySelector('.content-feed-more');for(let i=0;i<9;i++)b.click();});
  await page.waitForFunction(()=>document.querySelectorAll('[data-feed-promotion-at]').length===3);
  assert.deepEqual(await page.locator('[data-feed-promotion-at]').evaluateAll(ns=>ns.map(n=>n.dataset.feedPromotionAt)),['18','30','42']);assert.equal(await page.locator('.content-funnel').count(),4);
  for(const section of await page.locator('.content-funnel').all())assert.equal(await section.locator('[data-relation]').count(),5);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(process.env.GROWTH_EVIDENCE){await page.locator('[data-feed-promotion-at="18"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.GROWTH_EVIDENCE,'REPEAT-FUNNEL-'+width+'.png')});}
  await page.locator('[data-feed-promotion-at="18"] [data-relation="papa"]').click();await page.waitForURL('**/start/?src=home_inline');const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('demenzCoachQuizProgress.v1')));assert.equal(saved.choices.relation,'papa');assert.equal(saved.screen,'name');
 },{width,...(width===1280?{user:{uid:'free-member',email:'free@example.test',emailVerified:true,isAnonymous:false}}:{})});
 await check('trusted More activation offers the original question without requiring wheel input',async({page})=>{
  for(let i=0;i<4&&!await page.locator('[data-feed-promotion-at]').count();i++){await page.locator('.content-feed-more').click();await page.waitForTimeout(150);}
  assert.ok(await page.locator('[data-feed-promotion-at]').count()>0);assert.equal(await modal(page).count(),0);
 });
 await check('paid state suppresses new feed promotions',async({page})=>{
  await page.mouse.move(180,700);await page.mouse.wheel(0,240);await page.waitForTimeout(60);await page.evaluate(()=>{const b=document.querySelector('.content-feed-more');for(let i=0;i<9;i++)b.click();});await page.waitForTimeout(400);assert.equal(await page.locator('[data-feed-promotion-at]').count(),0);
 },{user:{uid:'paid',email:'paid@example.test',emailVerified:true,isAnonymous:false},paid:true});
 for(const width of [390,1280])await check('detail includes same question after full content '+width,async({page})=>{
  await page.mouse.move(width/2,700);await page.mouse.wheel(0,240);await page.locator('.content-funnel-section').waitFor();
  const order=await page.evaluate(()=>{const intro=document.querySelector('.tricks-intro'),funnel=document.querySelector('.content-funnel-section'),app=document.querySelector('.translator-how');return{afterFullTip:Boolean(intro.compareDocumentPosition(funnel)&Node.DOCUMENT_POSITION_FOLLOWING),beforeApp:Boolean(funnel.compareDocumentPosition(app)&Node.DOCUMENT_POSITION_FOLLOWING)};});assert.deepEqual(order,{afterFullTip:true,beforeApp:true});assert.equal(await page.locator('.content-funnel [data-relation]').count(),5);
  if(process.env.GROWTH_EVIDENCE){await page.locator('.content-funnel').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.GROWTH_EVIDENCE,'DETAIL-FUNNEL-'+width+'.png')});}
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.content-funnel-section').isVisible(),false);await page.emulateMedia({media:'screen'});
  await page.locator('.content-funnel [data-relation="mama"]').click();await page.waitForURL('**/start/?src=content_inline');assert.equal(await page.locator('input[type=text]:visible').count(),1);
 },{width,route:'/alltagstricks/farbiger-becher.html'});
 await check('paid detail has no new questionnaire',async({page})=>{await page.mouse.move(180,700);await page.mouse.wheel(0,240);await page.waitForTimeout(400);assert.equal(await page.locator('.content-funnel-section').count(),0);},{route:'/alltagstricks/farbiger-becher.html',user:{uid:'paid',email:'paid@example.test',emailVerified:true,isAnonymous:false},paid:true});
 await check('short single-tip content now qualifies without a three-paragraph requirement',async({page})=>{await read(page,{steps:2});assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).count,key),1);},{route:'/alltagstricks/zettel-wo-du-bist.html'});
 await check('identity change during paid lookup does not insert stale promotion',async({page,setHold,gates})=>{
  setHold(true);await page.mouse.move(180,700);await page.mouse.wheel(0,240);for(let i=0;i<60&&!gates.length;i++)await page.waitForTimeout(50);assert.ok(gates.length);
  await page.evaluate(()=>localStorage.setItem('__fixtureUser',JSON.stringify({uid:'different',email:'different@example.test',emailVerified:true,isAnonymous:false})));setHold(false);gates.forEach(resolve=>resolve());await page.waitForTimeout(250);assert.equal(await page.locator('.content-funnel-section').count(),0);
 },{route:'/alltagstricks/farbiger-becher.html'});
 if(process.env.GROWTH_EVIDENCE)fs.writeFileSync(path.join(process.env.GROWTH_EVIDENCE,'GROWTH-CHECKS.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser?.close();await preview?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
