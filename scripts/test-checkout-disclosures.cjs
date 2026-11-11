// Hosted checkout contract checks. All external services are intercepted.
// The destination is a fixture, never evidence of actual Stripe rendering.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2' };
const config = { plans:{yearly:{amount:6999,currency:'eur'},monthly:{amount:1299,currency:'eur'}}, trialDays:7,textVersions:{terms:'fixture'} };
const auth = `const user={email:'fixture@example.invalid',isAnonymous:true,getIdToken:async()=>'fixture-owner'};
export const getAuth=()=>({currentUser:user}); export const getRedirectResult=async()=>null;
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(user),0);return ()=>{}};`;
const server = http.createServer((req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); const origin='http://127.0.0.1:'+server.address().port;
  let browser; let cases=0;
  try {
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
    for(const width of [320,390,1280]) for(const mode of ['page','modal']) for(const scenario of ['yearly','monthly',...(width===390?['network','invalid_url','old_backend','already_subscribed','stale']:[])]) {
      const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
      const errors=[], sessions=[], external=[]; let release, requested, closed=0;
      const requestSeen=new Promise(r=>requested=r); const held=new Promise(r=>release=r);
      const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
      await page.exposeFunction('recordCheckoutClose',()=>{closed++;});
      try {
        await context.route('**/*',async route=>{
          const req=route.request(),url=new URL(req.url()); if(url.origin===origin)return route.continue();
          const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
          if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
          if(url.pathname.endsWith('/firebase-app.js'))return route.fulfill({headers,contentType:'text/javascript',body:'export const initializeApp=()=>({});'});
          if(url.pathname.endsWith('/firebase-auth.js'))return route.fulfill({headers,contentType:'text/javascript',body:auth});
          if(url.hostname==='checkout.stripe.com')return route.fulfill({contentType:'text/html',body:'<h1>Hosted destination fixture — no payment</h1>'});
          if(url.hostname.endsWith('cloudfunctions.net')) {
            if(url.pathname.endsWith('/config'))return route.fulfill({headers,json:config});
            if(url.pathname.endsWith('/session')) {
              sessions.push({body:req.postDataJSON(),token:req.headers().authorization}); requested();
              if(scenario==='stale')await held;
              if(scenario==='network'&&sessions.length===1)return route.fulfill({status:503,headers,json:{code:'unavailable'}});
              if(scenario==='already_subscribed')return route.fulfill({status:409,headers,json:{code:'already_subscribed'}});
              return route.fulfill({headers,json: scenario==='old_backend'?{clientSecret:'old-fixture'}:{url:scenario==='invalid_url'?'https://checkout.stripe.com.evil.invalid/pay':'https://checkout.stripe.com/c/pay/hosted_fixture'}});
            }
            return route.fulfill({headers,json:{}});
          }
          external.push(url.hostname);return route.abort();
        });
        await page.goto(origin+'/abo/');
        if(await page.locator('.consent-decline').isVisible())await page.locator('.consent-decline').click();
        await page.evaluate(()=>{window.DemenzTeller={ready:Promise.resolve(),attribution:()=>({source:'teller_website',campaign:'teller_v1',variant:'a'})};});
        const plan=scenario==='monthly'?'monthly':'yearly';
        if(mode==='page') {
          if(plan==='monthly')await page.locator('[data-plan="monthly"]').click();
          await page.locator('#plan-next').click();
        } else {
          await page.evaluate(plan=>{import('/abo/kasse.js').then(({open})=>open({plan,email:'fixture@example.invalid',source:'quiz_home',onClose:()=>window.recordCheckoutClose()}));},plan);
        }
        await requestSeen;
        if(scenario==='stale') {
          if(mode==='modal') {
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.kasse').count(),0);
          } else await page.locator('#step-pay [data-back="plan"]').click();
          release(); await page.waitForTimeout(120);
          assert.ok(page.url().startsWith(origin));
          assert.equal(await page.locator('#step-plan').isVisible(),true);
        } else if(['invalid_url','old_backend','network'].includes(scenario)) {
          const retry=page.locator(mode==='page'?'#pay-retry':'.kasse .abo-button');
          await retry.waitFor({state:'visible'});
          assert.ok(page.url().startsWith(origin));
          assert.equal(await page.locator('[role="alert"]:visible').count(),1);
          if(mode==='modal') {
            await page.keyboard.press('Tab');
            const focused=await page.evaluate(()=>document.activeElement.closest('[role="dialog"]')!==null);
            assert.equal(focused,true,'keyboard focus stays inside the dialog');
          }
          if(scenario==='network') {await retry.click();await page.waitForURL('https://checkout.stripe.com/**');assert.equal(sessions.length,2);}
        } else if(scenario==='already_subscribed') {
          if(mode==='page')await page.locator('#step-already').waitFor({state:'visible'});
          else {await page.getByRole('link',{name:'Abo verwalten',exact:true}).waitFor();assert.equal(await page.getByText('Dein Plan ist freigeschaltet.',{exact:true}).count(),0);}
          assert.ok(page.url().startsWith(origin));
        } else {
          await page.waitForURL('https://checkout.stripe.com/**');
          assert.equal(sessions.length,1);
        }
        assert.equal(closed,scenario==='stale'&&mode==='modal'?1:0,'internal retries must preserve browser history');
        for(const session of sessions) {
          assert.equal(session.body.checkoutUI,'hosted'); assert.equal(session.body.plan,plan);
          assert.equal(session.body.termsVersion,'fixture');assert.equal(session.token,'Bearer fixture-owner');
          assert.equal(session.body.source,'teller_website');assert.equal(session.body.variant,'a');assert.equal(session.body.campaign,'teller_v1');
          assert.equal(session.body.amount,undefined);assert.equal(session.body.price,undefined);
        }
        assert.equal(external.includes('js.stripe.com'),false,'no embedded Stripe SDK');
        assert.deepEqual(errors,[]);
        cases++;
      } finally {release();await context.close();}
    }
    console.log(JSON.stringify({passed:cases,realProvider:false,purchases:0}));
  } finally {await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
