// Real local Worker/Chrome UI, controlled auth/status only; no provider/mail/model/payment actions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createPreviewServer}=require('./generator-preview.cjs');
const source=fs.readFileSync(path.join(__dirname,'test-signup-sheet.cjs'),'utf8'),auth=source.match(/const authModule = `([\s\S]*?)`;/)[1];
const evidence=process.env.SHARED_EVIDENCE,report={cases:[],realProviderMailModelPaymentActions:0};
const member={uid:'fixture-member',email:'private@example.test',emailVerified:true,isAnonymous:false};
(async()=>{let preview,browser;try{
 preview=await createPreviewServer();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 async function check(name,fn,options={}){
  if(process.env.SHARED_FOCUS&&!new RegExp(process.env.SHARED_FOCUS).test(name))return;
  const context=await browser.newContext({viewport:{width:options.width||390,height:850},reducedMotion:'reduce'}),errors=[],unexpected=[],statuses=[];
  await context.addInitScript(({user,blocked,seed})=>{
   localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied');localStorage.setItem('__fixtureUser',JSON.stringify(user));
   window.__offset=0;const now=Date.now;Date.now=()=>now()+window.__offset;
   if(seed)sessionStorage.setItem('demenzcoach.tipInvitation.v1',JSON.stringify({version:1,count:seed,until:Date.now()+1800000,offered:false}));
   if(blocked){const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(this===sessionStorage)throw Error('blocked session');return get.call(this,k);};}
  },{user:options.user===undefined?member:options.user,blocked:options.blocked,seed:options.seed});
  await context.route('**/*',async route=>{const url=new URL(route.request().url());
   if(options.styleFailure&&url.pathname==='/abo/signup-offer-view.css')return route.abort();
   if(url.pathname==='/abo/web-auth.js')return route.fulfill({contentType:'text/javascript',body:auth.replace('export async function webAuth(){','export async function webAuth(options){if(options?.anonymous!==false)throw Error("Anonymous creation not allowed in this test");')});
   if(url.hostname.endsWith('cloudfunctions.net')){
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204});
    if(url.pathname.endsWith('/access')){statuses.push(url.pathname);return route.fulfill({status:options.unknown?503:200,json:{enabled:true,verified:true,paid:Boolean(options.paid),remaining:3,registeredAdditional:3,contract:'signup-bonus-v1'}});}
    if(url.pathname.endsWith('/config'))return route.fulfill({json:{enabled:false}});
    if(url.pathname.endsWith('/entitlement'))return route.fulfill({json:{active:Boolean(options.paid)}});
    unexpected.push(url.pathname);return route.abort();
   }
   if(url.origin!==preview.origin){unexpected.push(url.origin+url.pathname);return route.abort();}return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto(preview.origin+(options.route||'/de/'),{waitUntil:'domcontentloaded'});await fn({page,context,statuses});assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);report.cases.push(name);console.log('PASS',name);}catch(error){console.error(JSON.stringify({case:name,errors,unexpected,nav:await page.locator('.dc-navigation').count(),account:await page.locator('.dc-navigation-account').allTextContents(),state:await page.evaluate(()=>{try{return{tips:JSON.parse(sessionStorage.getItem('demenzcoach.tipInvitation.v1')),cadence:JSON.parse(sessionStorage.getItem('demenzcoach.contentSignupCadence.v2')),dialogs:[...document.querySelectorAll('dialog[open]')].map(n=>n.className)}}catch{return'blocked'}})}));throw error;}finally{await context.close();}
 }
 const modal=p=>p.locator('.dc-membership-invite');
 const tick=(p,ms)=>p.evaluate(ms=>window.__offset+=ms,ms);
 async function readList(page){
  for(let i=0;i<5;i++){
   await page.locator('.tips .tip').nth(i).scrollIntoViewIfNeeded();await page.mouse.move(150,550);await page.mouse.wheel(0,90);await page.waitForTimeout(70);await tick(page,1100);await page.mouse.wheel(0,2);await page.waitForTimeout(80);
   if(await modal(page).count())break;
  }
  await page.locator('main .note').scrollIntoViewIfNeeded();await page.mouse.wheel(0,220);await tick(page,1100);await page.mouse.wheel(0,2);await page.waitForTimeout(120);
 }
 const routes=['/de/','/en/','/de/demenz-uebersetzer/wo-ist-meine-mutter.html','/alltagstricks/','/alltagstricks/farbiger-becher.html','/de/demenz-alltagstipps.html','/start/','/abo/','/abo/garantie.html','/abo/konto.html','/de/app/','/plate/','/datenschutz.html','/privacy-en.html','/de/ratgeber/demenz-kommunikation.html'];
 for(const route of routes)await check('shared real header '+route,async({page})=>{
  await page.locator('.dc-navigation-account[data-account-state="signed-in"]').waitFor();assert.equal(await page.locator('.dc-navigation').count(),1);assert.equal(await page.locator('.dc-navigation').innerText().then(s=>s.includes(member.email)),false);
  const menu=page.locator('.dc-navigation-menu');await menu.locator('summary').click();assert.equal(await menu.locator('select option').count(),33);assert.equal(await menu.locator('select').isVisible(),true);
  if(evidence&&['/de/','/start/','/de/demenz-alltagstipps.html'].includes(route))await page.screenshot({path:path.join(evidence,'MENU-'+(route==='/de/'?'HOME':route==='/start/'?'FUNNEL':'LIST')+'-390.png')});
  await page.keyboard.press('Escape');assert.equal(await menu.evaluate(n=>n.open),false);assert.equal(await menu.locator('summary').evaluate(n=>n===document.activeElement),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(evidence&&['/de/','/start/','/de/demenz-alltagstipps.html'].includes(route))await page.screenshot({path:path.join(evidence,'HEADER-'+(route==='/de/'?'HOME':route==='/start/'?'FUNNEL':'LIST')+'-390.png')});
 },{route});
 await check('guest sign-in uses the existing native layer without care submission',async({page})=>{
  await page.locator('.dc-navigation-account[data-account-state="signed-out"]').click();await page.locator('.dc-signup-sheet[open]').waitFor();assert.equal(await page.locator('.dc-signup-sheet input[type=email]').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.dc-navigation-account').evaluate(n=>n===document.activeElement),true);
 },{user:null});
 await check('actual account changes update label without exposing identity',async({page})=>{
  await page.locator('.dc-navigation-account[data-account-state="signed-in"]').waitFor();await page.evaluate(()=>{localStorage.setItem('__fixtureUser','null');dispatchEvent(new Event('demenz-auth-changed'));});await page.locator('.dc-navigation-account[data-account-state="signed-out"]').waitFor();
  await page.evaluate(()=>{localStorage.setItem('__fixtureUser',JSON.stringify({uid:'second',isAnonymous:false,emailVerified:false,email:'secret@example.test'}));dispatchEvent(new Event('demenz-auth-changed'));});await page.getByRole('link',{name:'Dein Konto, angemeldet'}).waitFor();assert.equal(await page.locator('.dc-navigation-account').innerText(),'Konto bestätigen');assert.equal(await page.locator('.dc-navigation').innerText().then(s=>s.includes('@')),false);
 });
 await check('language equivalent and clearly labeled home fallback',async({page})=>{
  const destinations=await page.evaluate(async()=>{const {languageDestinations}=await import('/shared-navigation.js');return languageDestinations();});assert.equal(destinations.find(x=>x.lang==='en').href,'/en/dementia-translator/where-is-my-mother.html');assert.equal(destinations.find(x=>x.lang==='fr').href,'/fr/');assert.equal(destinations.find(x=>x.lang==='fr').equivalent,false);
 },{route:'/de/demenz-uebersetzer/wo-ist-meine-mutter.html'});
 await check('same language keeps current tip and draft; a real language change asks before discarding input',async({page})=>{
  await page.locator('.dc-navigation-account[data-account-state="signed-in"]').waitFor();const menu=page.locator('.dc-navigation-menu');await menu.locator('summary').click();await menu.locator('select').selectOption('/de/');await menu.getByRole('button',{name:'Sprache wechseln'}).click();assert.equal(new URL(page.url()).pathname,'/de/');
  await page.locator('#translator-input').fill('Ungesendete Situation');await menu.locator('summary').click();await menu.locator('select').selectOption('/en/');const prompt=page.waitForEvent('dialog');const clicked=menu.getByRole('button',{name:'Sprache wechseln'}).click();const dialog=await prompt;await dialog.dismiss();await clicked;assert.equal(new URL(page.url()).pathname,'/de/');assert.equal(await page.locator('#translator-input').inputValue(),'Ungesendete Situation');
 });
 await check('text size stays available in the shared menu',async({page})=>{
  await page.locator('.dc-navigation-account[data-account-state="signed-in"]').waitFor();await page.locator('.dc-navigation-menu summary').click();await page.getByRole('button',{name:'Schrift größer',exact:true}).click();assert.equal(await page.locator('html').evaluate(n=>n.classList.contains('e-large')),true);assert.equal(await page.locator('.dc-navigation-account').evaluate(n=>getComputedStyle(n).fontSize),'17px');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 },{route:'/de/demenz-alltagstipps.html'});
 for(const options of [{},{user:null},{paid:true},{unknown:true},{blocked:true},{styleFailure:true}])await check('membership after five complete tips '+JSON.stringify(options),async({page})=>{
  await page.waitForTimeout(100);await tick(page,10000);await page.evaluate(()=>scrollTo(0,500));await page.waitForTimeout(100);assert.equal(await modal(page).count(),0,'No load/timer/programmatic invitation');await page.evaluate(()=>scrollTo(0,0));await readList(page);
  if(options.user===null && await page.locator('.dc-signup-sheet[open]').count() && !await modal(page).count()){await page.keyboard.press('Escape');await tick(page,61000);await readList(page);}
  if(options.paid||options.unknown||options.blocked||options.styleFailure){assert.equal(await modal(page).count(),0);return;}
  await modal(page).waitFor();assert.equal(await page.locator('.tips .tip').count(),5);assert.equal(await page.locator('.dc-membership-invite a.primary').getAttribute('href'),'/abo/?src=tip_membership');
  if(evidence)await page.screenshot({path:path.join(evidence,'MEMBERSHIP-'+(options.user===null?'GUEST':'MEMBER')+'-390.png')});
  await page.getByRole('button',{name:'Weiterlesen',exact:true}).click();assert.equal(await modal(page).count(),0);assert.equal(await page.locator('.tips .tip').count(),5);await readList(page);assert.equal(await modal(page).count(),0,'No immediate or repeated tip invitation');
 },{route:'/de/demenz-alltagstipps.html',...options});
 await check('five actually read detail pages carry a count without recording tip identity',async({page})=>{
  const paths=['roter-teller','farbiger-becher','foto-zimmertuer','lied-anziehen','nachtlicht'];
  for(let i=0;i<paths.length;i++){
   await page.goto(preview.origin+'/alltagstricks/'+paths[i]+'.html',{waitUntil:'domcontentloaded'});await page.locator('.dc-navigation-account[data-account-state="signed-in"]').waitFor();await page.evaluate(()=>import('/abo/tip-membership.js'));
   await page.mouse.move(140,550);await page.mouse.wheel(0,200);await page.waitForTimeout(80);await tick(page,1100);await page.mouse.wheel(0,2);await page.waitForTimeout(80);
   await page.waitForFunction(i=>JSON.parse(sessionStorage.getItem('demenzcoach.tipInvitation.v1'))?.count===i,i+1);
   if(i<4)assert.equal(await modal(page).count(),0,'Fewer than five read tips never offers membership');
  }
  await tick(page,4100);await page.mouse.wheel(0,2);await modal(page).waitFor();
  assert.deepEqual(await page.evaluate(()=>Object.keys(JSON.parse(sessionStorage.getItem('demenzcoach.tipInvitation.v1'))).sort()),['count','offered','until','version']);
 });
 await check('membership respects an open menu and existing invitation cooldown',async({page})=>{
  await page.locator('.dc-navigation-account[data-account-state="signed-in"]').waitFor();const menu=page.locator('.dc-navigation-menu');await menu.locator('summary').click();await readList(page);assert.equal(await modal(page).count(),0);await page.keyboard.press('Escape');
  await page.evaluate(()=>sessionStorage.setItem('demenzcoach.contentSignupCadence.v2',JSON.stringify({version:2,startedAt:Date.now(),expiresAt:Date.now()+1800000,count:1,lastAt:Date.now(),pendingUntil:0})));await readList(page);assert.equal(await modal(page).count(),0);await tick(page,61000);await readList(page);await modal(page).waitFor();
 },{route:'/de/demenz-alltagstipps.html'});
 await check('printing an open membership layer closes it and preserves all five tips',async({page,statuses})=>{
  await readList(page);await modal(page).waitFor();const before=statuses.length;const pdf=await page.pdf({format:'A4',preferCSSPageSize:true});assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);assert.equal(await modal(page).count(),0);assert.equal(await page.locator('.tips .tip').count(),5);assert.equal(statuses.length,before);
 },{route:'/de/demenz-alltagstipps.html'});
 await check('print remains one A4 with no offer or new auth/status actions',async({page,statuses})=>{
  const before=statuses.length;await page.emulateMedia({media:'print'});assert.equal(await page.locator('.dc-navigation').isVisible(),false);assert.equal(await modal(page).count(),0);const pdf=await page.pdf({format:'A4',preferCSSPageSize:true});assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);assert.equal(statuses.length,before);
 },{route:'/de/demenz-alltagstipps.html'});
 for(const route of ['/de/','/de/demenz-alltagstipps.html','/start/'])await check('small phone navigation '+route,async({page})=>{
  await page.locator('.dc-navigation-account[data-account-state="signed-in"]').waitFor();await page.waitForFunction(()=>document.querySelector('link[href="/shared-navigation.css"]')?.sheet?.cssRules.length>0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const boxes=await page.evaluate(()=>{const c=document.querySelector('.dc-navigation-host'),b=c.querySelector('.e-brand,.brand,.abo-brand'),n=c.querySelector('.dc-navigation');return{brand:b?.getBoundingClientRect().right,nav:n.getBoundingClientRect().left,header:c.getBoundingClientRect().height}});assert.ok(boxes.brand<=boxes.nav+1,'Brand and account/menu never overlap');assert.ok(boxes.header<100,'Compact shared header');
 },{route,width:320});
 for(const route of ['/de/','/start/'])await check('desktop header '+route,async({page})=>{await page.locator('.dc-navigation-account[data-account-state="signed-in"]').waitFor();await page.locator('.dc-navigation-menu summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(evidence)await page.screenshot({path:path.join(evidence,'HEADER-'+(route==='/de/'?'HOME':'FUNNEL')+'-1280.png')});},{route,width:1280});
 if(evidence)fs.writeFileSync(path.join(evidence,'CHECKS.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser?.close();await preview?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
