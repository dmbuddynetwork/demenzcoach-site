// Real caller/browser tests with synthetic auth/provider responses only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const popupWait=page=>{const p=page.waitForEvent('popup');p.catch(()=>{});return p;};
const auth=`const listeners=new Set();const make=(uid)=>({uid,email:uid+'@example.invalid',emailVerified:true,isAnonymous:false,getIdToken:async()=>uid});const auth={currentUser:make('ownerA')};
export const getAuth=()=>auth;export const getRedirectResult=async()=>null;export const setUser=(uid)=>{auth.currentUser=make(uid);for(const cb of listeners)cb(auth.currentUser);};
export const onAuthStateChanged=(a,cb)=>{let live=true;listeners.add(cb);setTimeout(()=>{if(live)cb(a.currentUser)},0);return()=>{live=false;listeners.delete(cb);}};`;
const server=http.createServer((req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error();const b=fs.readFileSync(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(b);}catch{res.writeHead(404);res.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser,cases=0;
 try{
  browser=await chromium.launch({headless:!process.env.CHECKOUT_WINDOW_HEADED,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  for(const mode of ['page','modal']){
   const f=await fixture({mode,hold:true});try{
    const popupEvent=popupWait(f.page);await f.open();const popup=await popupEvent;await f.request;
    assert.match(popup.url(),/checkout-opening\.html/,'window must be reserved before the session response');
    assert.equal(f.sessions.length,1);f.release();await popup.waitForURL('https://checkout.stripe.com/**');
    assert.equal(new URL(f.page.url()).origin,origin);assert.equal(await popup.evaluate(()=>window.opener===null),true);
    const geometry=await popup.evaluate(()=>({innerWidth,outerWidth,innerHeight,outerHeight}));
    assert.ok(geometry.innerWidth<=650,'actual popup document is narrow: '+JSON.stringify(geometry));
    if(mode==='page'){
     await popup.getByRole('link',{name:'Cancel'}).click();await popup.waitForURL(origin+'/abo/?status=abgebrochen&plan=monthly');
     await popup.waitForFunction(()=>document.querySelector('[data-plan="monthly"]')?.getAttribute('aria-checked')==='true');
     assert.equal(await popup.locator('#step-done').isVisible(),false);assert.equal(f.sessions.length,1);
     await popup.close();await f.page.getByRole('button',{name:'Zahlungsfenster anzeigen',exact:true}).click();
     assert.equal(await f.page.locator('#step-done').isVisible(),false);
     await f.page.getByRole('button',{name:'Zahlung in diesem Tab öffnen',exact:true}).click();
     await f.page.waitForURL('https://checkout.stripe.com/**');assert.equal(f.sessions.length,1,'refocus fallback must reuse the exact session');
    }else{
     await popup.getByRole('link',{name:'Provider redirect'}).click();await popup.waitForURL('https://auth.example/**');
     await popup.getByRole('link',{name:'Return'}).click();await popup.waitForURL(origin+'/abo/?status=fertig&session_id=cs_fixture');
     await popup.getByRole('heading',{name:'Deine Zahlung wird noch geprüft',exact:true}).waitFor();
     assert.equal(await popup.locator('#done-plan-link').isVisible(),false);assert.equal(f.statusTokens.at(-1),'Bearer ownerA');
    }
    assert.equal(f.popups.length,1);assert.deepEqual(f.errors,[]);cases++;
   }finally{await f.close();}
  }
  for(const mode of ['page','modal']){
   const f=await fixture({mode,blocked:true});try{await f.open();await f.page.waitForURL('https://checkout.stripe.com/**');assert.equal(f.popups.length,0);assert.equal(f.sessions.length,1);cases++;}finally{await f.close();}
  }
  {
   const f=await fixture({mode:'modal',mobile:true});try{await f.open();await f.page.waitForURL('https://checkout.stripe.com/**');assert.equal(f.popups.length,0);cases++;}finally{await f.close();}
  }
  for(const mode of ['page','modal']){
   const f=await fixture({mode,hold:true});try{
    const next=popupWait(f.page);await f.open();const popup=await next;await f.request;await popup.close();f.release();
    await f.page.getByRole('alert').filter({hasText:'Zahlungsfenster wurde geschlossen'}).waitFor();
    assert.equal(new URL(f.page.url()).origin,origin);assert.equal(f.providerNavigations,0);assert.equal(f.sessions.length,1);cases++;
   }finally{await f.close();}
  }
  for(const uid of ['ownerA','ownerB']){
   const f=await fixture({mode:'modal',hold:true});try{
    const next=popupWait(f.page);await f.open();const popup=await next;await f.request;
    await f.page.evaluate(async uid=>{const a=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js');a.setUser(uid);},uid);
    f.release();
    if(uid==='ownerB'){
     await f.page.getByRole('alert').filter({hasText:'Dein Konto hat sich geändert'}).waitFor();assert.equal(popup.isClosed(),true);assert.equal(f.providerNavigations,0);
     const retryPopup=popupWait(f.page);await f.page.getByRole('dialog').getByRole('button',{name:'Erneut versuchen',exact:true}).click();const current=await retryPopup;await current.waitForURL('https://checkout.stripe.com/**');assert.equal(f.sessions[1].token,'Bearer ownerB');
    }else{await popup.waitForURL('https://checkout.stripe.com/**');assert.equal(f.sessions.length,1);}
    cases++;
   }finally{await f.close();}
  }
  {
   const f=await fixture({mode:'modal',hold:true});try{
    const next=popupWait(f.page);await f.open(true);const popup=await next;await f.request;f.release();await popup.waitForURL('https://checkout.stripe.com/**');
    assert.equal(f.popups.length,1);assert.equal(f.sessions.length,1,'double-click creates exactly one session');cases++;
   }finally{await f.close();}
  }
  {
   const f=await fixture({mode:'page',hold:true});try{
    const next=popupWait(f.page);await f.open();const popup=await next;await f.request;
    const closed=popup.waitForEvent('close');await f.page.getByRole('button',{name:'Anderes Angebot wählen'}).click();await closed;
    const response=f.page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/session'));f.release();await response;
    await f.page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await f.page.waitForFunction(()=>!document.querySelector('#step-plan').hidden);
    assert.equal(popup.isClosed(),true);assert.equal(f.providerNavigations,0);assert.equal(f.sessions.length,1);cases++;
   }finally{await f.close();}
  }
  {
   const f=await fixture({mode:'modal'});try{
    const next=popupWait(f.page);await f.open();const popup=await next;await popup.waitForURL('https://checkout.stripe.com/**');
    await f.page.evaluate(async()=>{const a=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js');a.setUser('ownerB');});
    await popup.close();await f.page.getByRole('button',{name:'Zahlungsfenster anzeigen',exact:true}).click();
    await f.page.getByRole('alert').filter({hasText:'Dein Konto hat sich geändert'}).waitFor();
    assert.equal(f.sessions.length,1);assert.equal(new URL(f.page.url()).origin,origin);cases++;
   }finally{await f.close();}
  }
  {
   const f=await fixture({mode:'modal',foreign:true});try{
    const next=popupWait(f.page);await f.open();const popup=await next;
    await f.page.getByRole('alert').filter({hasText:'Die Zahlung kann gerade nicht starten'}).waitFor();
    assert.equal(popup.isClosed(),true);assert.equal(f.providerNavigations,0);assert.equal(new URL(f.page.url()).origin,origin);cases++;
   }finally{await f.close();}
  }
  console.log(JSON.stringify({ok:true,cases,realProviderCalls:0,realAccountsOrPayments:false,scope:'real desktop popup callers, mobile/blocker fallback, close/Cancel/protected pending return, UID refresh/change, double-click, stale plan'}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}

 async function fixture({mode,mobile=false,blocked=false,hold=false,foreign=false}){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:null});const page=await context.newPage();page.setDefaultTimeout(8000);
  if(!mobile)await page.setViewportSize({width:1280,height:900});
  console.log(JSON.stringify({startingCase:cases+1,mode,mobile,blocked,hold,foreign}));
  const f={page,sessions:[],statusTokens:[],popups:[],errors:[],providerNavigations:0};let release,requested;
  const held=new Promise(r=>{release=r});f.release=release;f.request=new Promise(r=>{requested=r});
  page.on('popup',p=>f.popups.push(p));page.on('pageerror',e=>f.errors.push(e.message));
  if(blocked)await context.addInitScript(()=>{window.open=()=>null;});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
   if(u.origin===origin)return route.continue();if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(u.pathname.endsWith('/firebase-app.js'))return route.fulfill({headers,contentType:'text/javascript',body:'export const initializeApp=()=>({});'});
   if(u.pathname.endsWith('/firebase-auth.js'))return route.fulfill({headers,contentType:'text/javascript',body:auth});
   if(u.hostname==='checkout.stripe.com'){f.providerNavigations++;return route.fulfill({contentType:'text/html',body:`<h1>Stripe fixture</h1><a href="${origin}/abo/?status=abgebrochen&plan=monthly">Cancel</a><a href="https://auth.example/3ds">Provider redirect</a>`});}
   if(u.hostname==='auth.example')return route.fulfill({contentType:'text/html',body:`<a href="${origin}/abo/?status=fertig&session_id=cs_fixture">Return</a>`});
   if(u.hostname.endsWith('cloudfunctions.net')){
    if(u.pathname.endsWith('/config'))return route.fulfill({headers,json:{checkoutMode:'hosted',plans:{yearly:{amount:6999,currency:'eur'},monthly:{amount:1299,currency:'eur'}},trialDays:7,textVersions:{terms:'fixture'},publishableKey:'pk_test_fixture'}});
    if(u.pathname.endsWith('/session')){f.sessions.push({body:req.postDataJSON(),token:req.headers().authorization});requested();if(hold)await held;return route.fulfill({headers,json:{checkoutMode:'hosted',url:foreign?'https://other.example/pay':'https://checkout.stripe.com/c/pay/cs_fixture',trialDays:7,plan:'monthly'}});}
    if(u.pathname.endsWith('/session-status')){f.statusTokens.push(req.headers().authorization);return route.fulfill({headers,json:{status:'complete',active:false,outcome:'pending'}});}
    if(u.pathname.endsWith('/entitlement'))return route.fulfill({headers,json:{active:false}});
    return route.fulfill({headers,json:{}});
   }
   return route.abort();
  });
  f.open=async(double=false)=>{
   await page.goto(origin+'/abo/?plan=monthly');await page.waitForFunction(()=>document.querySelector('#plan-note')?.textContent.includes('7')||document.querySelector('[data-plan="monthly"]')?.textContent.includes('inkl.'));
   const consent=page.getByRole('button',{name:'Ablehnen',exact:true});await consent.waitFor({state:'visible'});await consent.click();
   if(mode==='page')return page.getByRole('button',{name:'Weiter',exact:true}).click({clickCount:double?2:1});
   await page.evaluate(async()=>{const checkout=await import('/abo/kasse.js');const b=document.createElement('button');b.textContent='Fixture Checkout starten';b.onclick=()=>{window.fixtureCheckout=checkout.open({plan:'monthly',email:'ownerA@example.invalid'});};document.body.append(b);});
   await page.getByRole('button',{name:'Fixture Checkout starten'}).click({clickCount:double?2:1});
  };
  f.close=async()=>{release();await context.close();};return f;
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
