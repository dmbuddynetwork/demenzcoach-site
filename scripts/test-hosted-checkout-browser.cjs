// Isolated developer fixtures only: no user profile, real account or purchase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2' };
const config = { checkoutMode:'hosted', plans:{yearly:{amount:6999,currency:'eur'},monthly:{amount:1299,currency:'eur'}}, trialDays:7, publishableKey:'pk_test_fixture',textVersions:{terms:'fixture'} };
const auth = `const user={uid:'fixture-A',email:'fixture@example.invalid',emailVerified:true,isAnonymous:false,getIdToken:async()=>'fixture-owner'};
const auth={currentUser:user};export const getAuth=()=>auth; export const getRedirectResult=async()=>null;
export const setFixtureUser=(uid)=>{auth.currentUser={...user,uid,email:uid==='fixture-B'?'fixture-b@example.invalid':user.email,getIdToken:async()=>uid==='fixture-B'?'fixture-owner-B':'fixture-owner'};};
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(a.currentUser),0);return ()=>{}};`;
const server = http.createServer((req,res)=>{try {
 let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error();
 const body=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);
}catch{res.writeHead(404);res.end();}});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser,cases=0;
 try {
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  for(const mode of ['page','modal'])for(const plan of ['monthly','yearly']){
   const context=await browser.newContext({viewport:{width:mode==='page'?390:1280,height:900}});
   const page=await context.newPage(),sessions=[],errors=[],stripeScripts=[];
   page.on('pageerror',error=>errors.push(error.message));
   await intercept(context,{origin,plan,sessions,stripeScripts});
   try {
    await open(page,origin,mode,plan);
    await page.waitForURL('https://checkout.stripe.com/**');
    assert.equal(await page.getByRole('heading',{name:'Stripe hosted fixture'}).count(),1);
    assert.equal(sessions.length,1);
    assert.equal(sessions[0].body.plan,plan);
    assert.equal(sessions[0].body.checkoutMode,'hosted');
    assert.equal(sessions[0].token,'Bearer fixture-owner');
    assert.deepEqual(stripeScripts,[],'hosted flow must not load embedded Stripe.js');
    await page.getByRole('link',{name:'Abbrechen'}).click();
    await page.waitForURL(origin+'/abo/?status=abgebrochen&plan='+plan);
    assert.equal(await page.locator('#step-plan').isVisible(),true);
    assert.equal(await page.locator('[data-plan="'+plan+'"]').getAttribute('aria-checked'),'true');
    assert.equal(await page.locator('#step-done').isVisible(),false);
    assert.equal(sessions.length,1,'Cancel return must not automatically create a second session');
    assert.deepEqual(errors,[]);cases++;
   }finally{await context.close();}
  }
  for(const mode of ['page','modal']){
   const context=await browser.newContext(),page=await context.newPage(),sessions=[],stripeScripts=[];
   await intercept(context,{origin,plan:'monthly',sessions,stripeScripts,foreign:true});
   try {
    await open(page,origin,mode,'monthly');
    await page.getByRole('alert').filter({hasText:'Die Zahlung kann gerade nicht starten'}).waitFor();
    assert.equal(new URL(page.url()).origin,origin);
    assert.deepEqual(stripeScripts,[]);
    if(mode==='page')assert.equal(await page.locator('#hosted-checkout-retry').isVisible(),true);
    cases++;
   }finally{await context.close();}
  }
  {
   const context=await browser.newContext(),page=await context.newPage(),sessions=[],stripeScripts=[];
   let release;const hold=new Promise(resolve=>{release=resolve;});
   await intercept(context,{origin,plan:'monthly',sessions,stripeScripts,hold});
   try {
    const request=page.waitForRequest(request=>new URL(request.url()).pathname.endsWith('/session'));
    await open(page,origin,'modal','monthly');
    await request;
    await page.getByRole('button',{name:'Schließen',exact:true}).click();
    const response=page.waitForResponse(result=>new URL(result.url()).pathname.endsWith('/session'));
    release();await response;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(new URL(page.url()).origin,origin);
    assert.equal(await page.getByRole('dialog').count(),0);
    assert.deepEqual(stripeScripts,[]);cases++;
   }finally{release();await context.close();}
  }
  for(const uid of ['fixture-A','fixture-B']){
   const context=await browser.newContext(),page=await context.newPage(),sessions=[],stripeScripts=[];
   let release;const hold=new Promise(resolve=>{release=resolve;});
   await intercept(context,{origin,plan:'monthly',sessions,stripeScripts,hold});
   try{
    const request=page.waitForRequest(request=>new URL(request.url()).pathname.endsWith('/session'));
    await open(page,origin,'modal','monthly');await request;
    await page.evaluate(async(uid)=>{const auth=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js');auth.setFixtureUser(uid);},uid);
    const response=page.waitForResponse(result=>new URL(result.url()).pathname.endsWith('/session'));
    release();await response;
    if(uid==='fixture-B'){
     await page.getByRole('alert').filter({hasText:'Dein Konto hat sich geändert'}).waitFor();
     assert.equal(new URL(page.url()).origin,origin,'UID-A checkout must never redirect the active UID-B');
     assert.equal(sessions.length,1);assert.equal(sessions[0].token,'Bearer fixture-owner');
     await page.getByRole('dialog').getByRole('button',{name:'Erneut versuchen',exact:true}).click();
     await page.waitForURL('https://checkout.stripe.com/**');
     assert.equal(sessions.length,2);assert.equal(sessions[1].token,'Bearer fixture-owner-B');
     assert.equal(sessions[1].body.email,'fixture-b@example.invalid');
    }else{
     await page.waitForURL('https://checkout.stripe.com/**');
     assert.equal(sessions.length,1,'a refreshed user object with the same UID must remain usable');
    }
    assert.deepEqual(stripeScripts,[]);cases++;
   }finally{release();await context.close();}
  }
  console.log(JSON.stringify({ok:true,cases,providerCalls:0,realAccountsOrPurchases:false,scope:'both hosted entry points, Cancel, foreign URLs, stale closed sheet, pending-session UID switch and retry'}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

 async function intercept(context,{origin,plan,sessions,stripeScripts,foreign=false,hold=null}){
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin===origin)return route.continue();
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(url.pathname.endsWith('/firebase-app.js'))return route.fulfill({headers,contentType:'text/javascript',body:'export const initializeApp=()=>({});'});
   if(url.pathname.endsWith('/firebase-auth.js'))return route.fulfill({headers,contentType:'text/javascript',body:auth});
   if(url.hostname==='js.stripe.com'){stripeScripts.push(request.url());return route.abort();}
   if(url.hostname==='checkout.stripe.com')return route.fulfill({contentType:'text/html',body:`<h1>Stripe hosted fixture</h1><a href="${origin}/abo/?status=abgebrochen&plan=${plan}">Abbrechen</a>`});
   if(url.hostname.endsWith('cloudfunctions.net')){
    if(url.pathname.endsWith('/config'))return route.fulfill({headers,json:config});
    if(url.pathname.endsWith('/session')){
     sessions.push({body:request.postDataJSON(),token:request.headers().authorization});
     if(hold)await hold;
     return route.fulfill({headers,json:{checkoutMode:'hosted',url:foreign?'https://evil.example/pay':'https://checkout.stripe.com/c/pay/cs_fixture_'+plan,trialDays:7,plan,firstYear:null}});
    }
    if(url.pathname.endsWith('/entitlement'))return route.fulfill({headers,json:{active:false}});
    return route.fulfill({headers,json:{}});
   }
   return route.abort();
  });
 }
 async function open(page,origin,mode,plan){
  await page.goto(origin+'/abo/?plan='+plan);
  const decline=page.getByRole('button',{name:'Ablehnen',exact:true});
  if(await decline.count())await decline.click();
  if(mode==='page'){
   await page.getByRole('button',{name:'Weiter',exact:true}).click();
  }else{
   await page.evaluate(async(plan)=>{const checkout=await import('/abo/kasse.js');window.fixtureCheckout=checkout.open({plan,email:'fixture@example.invalid',source:'hosted-browser-test'});},plan);
  }
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
