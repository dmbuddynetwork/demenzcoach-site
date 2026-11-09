// Focused layout verification of the actual standalone and modal checkout.
// Every external service is intercepted; no real account, payment or email.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2' };
const config = { plans:{yearly:{amount:6999,currency:'eur'},monthly:{amount:1299,currency:'eur'}}, trialDays:7, publishableKey:'pk_test_fixture',textVersions:{terms:'fixture'} };
const auth = `const user={email:'fixture@example.invalid',isAnonymous:true,getIdToken:async()=>'fixture-owner'};
export const getAuth=()=>({currentUser:user}); export const getRedirectResult=async()=>null;
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(user),0);return ()=>{}};`;
const server = http.createServer((req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); const origin='http://127.0.0.1:'+server.address().port;
  let browser; let cases=0;
  try {
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
    for(const width of [390,1280]) for(const mode of ['page','modal']) for(const plan of ['yearly','monthly']) for(const scenario of (plan==='yearly'?['ready','delayed','loaderror','already_subscribed',...(mode==='modal'?['timeout']:[])]:['ready'])) {
      const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}); const errors=[], sessions=[];
      try {
        await context.route('**/*',route=>{
          const req=route.request(), url=new URL(req.url()); if(url.origin===origin)return route.continue();
          const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
          if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
          if(url.pathname.endsWith('/firebase-app.js'))return route.fulfill({headers,contentType:'text/javascript',body:'export const initializeApp=()=>({});'});
          if(url.pathname.endsWith('/firebase-auth.js'))return route.fulfill({headers,contentType:'text/javascript',body:auth});
          if(url.hostname.endsWith('cloudfunctions.net')) {
            if(url.pathname.endsWith('/config'))return route.fulfill({headers,json:config});
            if(url.pathname.endsWith('/session')&&scenario==='already_subscribed')return route.fulfill({status:409,headers,json:{code:'already_subscribed'}});
            if(url.pathname.endsWith('/session')) {sessions.push({body:req.postDataJSON(),token:req.headers().authorization});return route.fulfill({headers,json:{clientSecret:'fixture',trialDays:plan==='yearly'?7:0,firstYear:plan==='yearly'?4999:null}});}
            if(url.pathname.endsWith('/entitlement'))return route.fulfill({headers,json:{active:false}});
            return route.fulfill({headers,json:{}});
          }
          return route.abort();
        });
        await context.addInitScript(scenario=>{
          const originalTimeout=window.setTimeout.bind(window);if(scenario==='timeout')window.setTimeout=(cb,ms,...args)=>originalTimeout(cb,ms===15000?30:ms,...args);
          const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2026-11-09T12:00:00+08:00']));}static now(){return new NativeDate('2026-11-09T12:00:00+08:00').getTime();}};
          window.Stripe=()=>({initCheckoutElementsSdk:async options=>{window.__fixtureAppearance=options.elementsOptions.appearance;return ({
            createExpressCheckoutElement:()=>({on(name,cb){if(name==='availablepaymentmethodschange')cb({paymentMethods:{paypal:true}});},mount(target){const e=typeof target==='string'?document.querySelector(target):target;e.innerHTML='<div class="fixture-wallets"><button type="button">Link</button><button type="button">PayPal</button></div>';}}),
            createPaymentElement:()=>({handlers:{},on(name,cb){this.handlers[name]=cb;},mount(target){const e=typeof target==='string'?document.querySelector(target):target;e.innerHTML='<div class="fixture-tabs"><span>Karte</span><span>SEPA-Lastschrift</span><span>Klarna</span></div><label>Kartennummer<input type="text" placeholder="1234 1234 1234 1234"></label><label>Gültig bis<input type="text" placeholder="MM / JJ"></label><label>Prüfziffer<input type="text" placeholder="CVC"></label>';window.__fixturePayment=this;if(scenario==='ready')queueMicrotask(()=>this.handlers.ready?.());if(scenario==='loaderror')queueMicrotask(()=>this.handlers.loaderror?.());}}),
            loadActions:async()=>({confirm:async()=>{throw Error('No payment in layout fixture');}})
          });}});
        },scenario);
        const page=await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror',e=>errors.push(e.message));
        await page.goto(origin+(mode==='page'?'/abo/?plan='+plan:'/start/'),{waitUntil:'domcontentloaded'});
        await page.locator('.consent-decline').click();
        await page.addStyleTag({content:'.fixture-tabs,.fixture-wallets{display:flex;gap:8px;margin-bottom:14px}.fixture-tabs span,.fixture-wallets button{flex:1;padding:10px 4px;border:1px solid #d6d3dc;border-radius:10px;text-align:center;font:inherit;font-size:14px}.fixture-wallets button{background:#ffd15a;font-weight:700}.fixture-wallets button:first-child{background:#47cf82}'});
        if(mode==='page') await page.locator('#plan-next').click();
        else await page.evaluate(async plan=>{const {open}=await import('/abo/kasse.js');await open({plan,email:'fixture@example.invalid',source:'layout_fixture'});},plan);
        if(scenario==='already_subscribed') {
          await page.locator(mode==='page'?'#step-already':'.kasse-card .abo-summary').waitFor({state:'visible'});
          assert.deepEqual(errors,[]);cases++;continue;
        }
        await page.waitForFunction(()=>Boolean(window.__fixturePayment));
        const payControl=page.locator(mode==='page'?'#pay-button':'.kasse-card .abo-button');
        if(scenario==='loaderror') {
          await page.getByText(/Die Zahlungsarten konnten nicht geladen werden/).waitFor({state:'visible'});
          assert.equal(await payControl.isDisabled(),true);assert.equal(sessions.length,1);assert.deepEqual(errors,[]);
          if(mode==='modal'){await page.keyboard.press('Escape');assert.equal(await page.locator('.kasse').count(),0);}
          cases++;continue;
        }
        if(scenario==='timeout'){await page.getByRole('status').filter({hasText:'Das Laden dauert länger.'}).waitFor({state:'visible'});assert.equal(await payControl.isDisabled(),true);await page.evaluate(()=>window.__fixturePayment.handlers.ready());}
        if(scenario==='delayed') {
          assert.equal(await payControl.isDisabled(),true);
          if(mode==='modal') {
            await page.evaluate(()=>{window.__stalePayment=window.__fixturePayment;});
            await page.keyboard.press('Escape');assert.equal(await page.locator('.kasse').count(),0);
            await page.evaluate(async plan=>{const {open}=await import('/abo/kasse.js');await open({plan,email:'fixture@example.invalid',source:'layout_fixture'});},plan);
            await page.evaluate(()=>window.__stalePayment.handlers.ready());
            assert.equal(await payControl.isDisabled(),true);
          }
          await page.evaluate(()=>window.__fixturePayment.handlers.ready());
        }
        await page.waitForFunction(mode=>!document.querySelector(mode==='page'?'#pay-button':'.kasse-card .abo-button').disabled,mode);
        const result=await page.evaluate(mode=>{
          const box=mode==='page'?document.querySelector('#pay-block'):document.querySelector('.kasse-card');
          const fields=box.querySelector(mode==='page'?'#payment-element':'#kasse-payment'), summary=box.querySelector('.abo-summary'), express=box.querySelector(mode==='page'?'#express-checkout':'#kasse-express');
          const pay=box.querySelector(mode==='page'?'#pay-button':'.abo-button'), details=box.querySelector('.abo-checkout-details');
          const before=(a,b)=>Boolean(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);
          const cs=getComputedStyle(summary), ds=getComputedStyle(details);
          return {order:[before(fields,summary),before(summary,express),before(express,pay),before(pay,details)],summary:summary.textContent,details:details.textContent,
            duplicateHidden:box.querySelector(mode==='page'?'#pay-summary-short':'.kasse-short').hidden,font:parseFloat(cs.fontSize),detailsFont:parseFloat(ds.fontSize),border:cs.borderTopWidth,group:summary.getAttribute('aria-label'),button:pay.textContent,
            appearance:window.__fixtureAppearance,summaryHeight:Math.round(summary.getBoundingClientRect().height),detailsHeight:Math.round(details.getBoundingClientRect().height),overflow:document.documentElement.scrollWidth>innerWidth+1};
        },mode);
        assert.deepEqual(result.order,[true,true,true,true]); assert.equal(result.duplicateHidden,true); assert.ok(result.font>=16); assert.ok(result.detailsFont>=14); assert.equal(result.border,'0px'); assert.equal(result.group,'Preis und Laufzeit');assert.equal(result.button,'Zahlungspflichtig abonnieren');assert.equal(result.overflow,false);assert.equal(result.appearance.variables.fontSizeBase,'16px');assert.equal(result.appearance.variables.fontSizeSm,'14px');
        assert.match(result.summary,/inklusive MwSt\./u); assert.match(result.details,/Verträge hier kündigen/u); assert.match(result.details,/30 Tage/u);assert.match(result.details,/Widerrufsbelehrung/u);
        if(plan==='yearly'){for(const value of ['0,00','16. November 2026','49,99','69,99','Laufzeit: 1 Jahr','einem Monat'])assert.ok(result.summary.includes(value),value);}
        else {assert.match(result.summary,/12,99/u);assert.match(result.summary,/Monat/u);assert.match(result.summary,/jederzeit zum Monatsende/u);assert.doesNotMatch(result.summary,/49,99|0,00/u);}
        assert.equal(sessions.length,scenario==='delayed'&&mode==='modal'?2:1);assert.equal(sessions[0].body.plan,plan);assert.equal(sessions[0].token,'Bearer fixture-owner');assert.deepEqual(errors,[]);
        if(process.env.SCREENSHOT_DIR&&plan==='yearly'&&scenario==='ready'){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`checkout-${mode}-${width}.png`),fullPage:true});}
        if(mode==='modal'){assert.equal(await page.locator('#kasse-title').evaluate(e=>document.activeElement===e),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.kasse').count(),0);}
        console.log(JSON.stringify({mode,plan,width,scenario,summaryHeight:result.summaryHeight,detailsHeight:result.detailsHeight,font:result.font,detailsFont:result.detailsFont}));
        cases++;
      } finally {await context.close();}
    }
    console.log(JSON.stringify({passed:cases,scope:'standalone/modal × yearly/monthly × mobile/desktop; ready/delayed/loaderror; Escape; no real services',browserClosed:true}));
  } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
