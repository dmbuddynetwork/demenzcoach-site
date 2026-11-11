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
const auth = `const user={uid:'fixture-owner',email:'fixture@example.invalid',isAnonymous:true,getIdToken:async()=>'fixture-owner'};
export const getAuth=()=>({currentUser:user}); export const getRedirectResult=async()=>null;
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(user),0);return ()=>{}};`;
const server = http.createServer((req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); const origin='http://127.0.0.1:'+server.address().port;
  let browser; let cases=0;
  try {
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
    for(const {width,textZoom} of [{width:390,textZoom:1},{width:1280,textZoom:1},{width:320,textZoom:2.25}]) for(const mode of ['page','modal']) for(const plan of ['yearly','monthly']) for(const scenario of (textZoom>1?['ready']:plan==='yearly'?['ready','delayed','loaderror','already_subscribed',...(mode==='modal'?['timeout']:['race']),...(width===390?['no_trial','no_discount']:[])]:['ready'])) {
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
            if(url.pathname.endsWith('/session')) {sessions.push({body:req.postDataJSON(),token:req.headers().authorization});return route.fulfill({headers,json:{clientSecret:'fixture-'+sessions.length,trialDays:req.postDataJSON().plan==='yearly'&&scenario!=='no_trial'?7:0,firstYear:req.postDataJSON().plan==='yearly'&&scenario!=='no_discount'?4999:null}});}
            if(url.pathname.endsWith('/entitlement'))return route.fulfill({headers,json:{active:false}});
            return route.fulfill({headers,json:{}});
          }
          return route.abort();
        });
        await context.addInitScript(scenario=>{
          const originalTimeout=window.setTimeout.bind(window);if(scenario==='timeout')window.setTimeout=(cb,ms,...args)=>originalTimeout(cb,ms===15000?30:ms,...args);
          const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2026-11-09T12:00:00+08:00']));}static now(){return new NativeDate('2026-11-09T12:00:00+08:00').getTime();}};
          window.__fixtureCheckouts=[];
          window.Stripe=()=>({initCheckoutElementsSdk:async options=>{
            window.__fixtureAppearance=options.elementsOptions.appearance;
            const instance={confirmed:0,actionLoads:0};
            window.__fixtureCheckouts.push(instance);
            const confirm=async()=>{instance.confirmed++;return {type:'error',error:{message:'Fixture confirmation error'}};};
            instance.createExpressCheckoutElement=options=>({handlers:{},on(name,cb){this.handlers[name]=cb;if(name==='availablepaymentmethodschange')cb({paymentMethods:{paypal:true}});},unmount(){},mount(target){instance.express=this;const e=typeof target==='string'?document.querySelector(target):target;e.innerHTML='<div class="fixture-wallets">'+(options?.paymentMethods?.link==='never'?'':'<button type="button">Link</button>')+'<button type="button">PayPal</button></div>';}});
            instance.createPaymentElement=options=>({handlers:{},on(name,cb){this.handlers[name]=cb;},unmount(){},mount(target){instance.payment=this;const e=typeof target==='string'?document.querySelector(target):target;e.innerHTML='<div class="fixture-tabs"><span>Karte</span><span>SEPA-Lastschrift</span><span>Klarna</span></div><label>Kartennummer<input type="text" placeholder="1234 1234 1234 1234"></label><label>Gültig bis<input type="text" placeholder="MM / JJ"></label><label>Prüfziffer<input type="text" placeholder="CVC"></label>';e.insertAdjacentHTML('beforeend','<p class="fixture-mandate">Pflichtmandat für wiederkehrende Zahlungen.</p>'+(options?.wallets?.link==='never'?'':'<div class="fixture-link-signup"><label>Mobilnummer<input></label><label>Vollständiger Name<input></label></div>'));window.__fixturePayment=this;if(['ready','no_trial','no_discount'].includes(scenario))queueMicrotask(()=>this.handlers.ready?.());if(scenario==='loaderror')queueMicrotask(()=>this.handlers.loaderror?.());}});
            instance.loadActions=async()=>{
              instance.actionLoads++;
              if(window.__failNextActions){window.__failNextActions=false;return {type:'error',error:{message:'Fixture actions error'}};}
              if(window.__holdNextActions){window.__holdNextActions=false;return await new Promise(resolve=>{instance.resolveActions=()=>resolve({actions:{confirm}});});}
              return {actions:{confirm}};
            };
            if(window.__holdNextInit){window.__holdNextInit=false;await new Promise(resolve=>{instance.resolveInit=resolve;});instance.initResolved=true;}
            return instance;
          }});
        },scenario);
        const page=await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror',e=>errors.push(e.message));
        await page.goto(origin+(mode==='page'?'/abo/?plan='+plan:'/start/'),{waitUntil:'domcontentloaded'});
        await page.locator('.consent-decline').click();
        await page.addStyleTag({content:'.fixture-tabs,.fixture-wallets{display:flex;gap:8px;margin-bottom:14px}.fixture-tabs span,.fixture-wallets button{flex:1;padding:10px 4px;border:1px solid #d6d3dc;border-radius:10px;text-align:center;font:inherit;font-size:14px}.fixture-wallets button{background:#ffd15a;font-weight:700}.fixture-wallets button:first-child{background:#47cf82}'});
        if(textZoom>1)await page.addStyleTag({content:`html{font-size:${textZoom*100}%}`});
        if(mode==='page') await page.locator('#plan-next').click();
        else await page.evaluate(async plan=>{const {open}=await import('/abo/kasse.js');await open({plan,email:'fixture@example.invalid',source:'layout_fixture'});},plan);
        if(scenario==='already_subscribed') {
          await page.locator(mode==='page'?'#step-already':'.kasse-card .abo-summary').waitFor({state:'visible'});
          assert.deepEqual(errors,[]);cases++;continue;
        }
        if(scenario==='race') {
          await page.waitForFunction(()=>Boolean(window.__fixtureCheckouts[0]?.payment));
          const pay=page.locator('#pay-button');
          await page.evaluate(()=>window.__fixtureCheckouts[0].payment.handlers.ready());
          assert.equal(await pay.isDisabled(),false);
          const switchPlan=async value=>{
            await page.locator('#step-pay [data-back="plan"]').click();
            await page.locator('[data-plan="'+value+'"]').click();
            await page.locator('#plan-next').click();
          };
          await page.evaluate(()=>{window.__holdNextInit=true;});
          await switchPlan('monthly');
          await page.waitForFunction(()=>Boolean(window.__fixtureCheckouts[1]?.resolveInit));
          await page.evaluate(()=>{const old=window.__fixtureCheckouts[0];old.payment.handlers.ready();old.payment.handlers.loaderror();old.express.handlers.confirm();document.querySelector('#pay-button').dispatchEvent(new MouseEvent('click'));});
          assert.equal(await pay.isDisabled(),true);assert.match(await page.locator('#pay-summary').textContent(),/12,99/);
          await switchPlan('yearly');
          await page.waitForFunction(()=>Boolean(window.__fixtureCheckouts[2]?.payment));
          await page.evaluate(()=>window.__fixtureCheckouts[1].resolveInit());
          await page.waitForFunction(()=>window.__fixtureCheckouts[1].initResolved);
          assert.equal(await page.evaluate(()=>Boolean(window.__fixtureCheckouts[1].payment)),false);
          await page.evaluate(()=>{window.__fixtureCheckouts[2].payment.handlers.ready();window.__holdNextActions=true;});
          await pay.click();await page.waitForFunction(()=>Boolean(window.__fixtureCheckouts[2].resolveActions));
          await switchPlan('monthly');
          await page.waitForFunction(()=>Boolean(window.__fixtureCheckouts[3]?.payment));
          await page.evaluate(()=>{window.__fixtureCheckouts[3].payment.handlers.ready();window.__fixtureCheckouts[2].resolveActions();});
          assert.equal(await pay.isDisabled(),false);assert.match(await page.locator('#pay-summary').textContent(),/12,99/);
          await page.evaluate(()=>{window.__holdNextActions=true;});
          await pay.click();await page.waitForFunction(()=>Boolean(window.__fixtureCheckouts[3].resolveActions));
          await page.evaluate(()=>document.querySelector('#pay-button').dispatchEvent(new MouseEvent('click')));
          assert.equal(await page.evaluate(()=>window.__fixtureCheckouts[3].actionLoads),1);
          await page.evaluate(()=>window.__fixtureCheckouts[3].resolveActions());
          await page.getByText('Fixture confirmation error',{exact:true}).waitFor({state:'visible'});
          assert.equal(await pay.isDisabled(),false);
          await page.evaluate(()=>{window.__failNextActions=true;});await pay.click();
          await page.getByText('Fixture actions error',{exact:true}).waitFor({state:'visible'});
          assert.equal(await page.evaluate(()=>window.__fixtureCheckouts[3].confirmed),1);
          await pay.click();await page.getByText('Fixture confirmation error',{exact:true}).waitFor({state:'visible'});
          assert.deepEqual(await page.evaluate(()=>window.__fixtureCheckouts.map(c=>c.confirmed)),[0,0,0,2]);
          assert.equal(sessions.length,4);assert.deepEqual(errors,[]);cases++;
          console.log(JSON.stringify({mode,width,scenario,oldSessionsConfirmed:0,currentSessionRetriesVerified:true}));continue;
        }
        if(mode==='modal'){assert.equal(sessions.length,1,'The real UID guard permits exactly one fixture session before mounting payments');const message=await page.locator('.kasse-card [role=alert]').textContent();if(scenario==='loaderror')assert.match(message,/Zahlungsarten konnten nicht geladen werden/);else assert.equal(message?.trim()||'','','No unexpected checkout error before the payment fixture');}
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
          const pay=box.querySelector(mode==='page'?'#pay-button':'.abo-button'), details=box.querySelector('.abo-checkout-details'),email=box.querySelector('.abo-checkout-email');
          const before=(a,b)=>Boolean(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);
          const cs=getComputedStyle(summary), ds=getComputedStyle(details), input=fields.querySelector('input');
          return {order:[before(fields,summary),before(summary,express),before(express,pay),before(pay,email),before(email,details)],summary:summary.textContent,details:details.textContent,email:email.textContent,
            legalLinkStyles:[...details.querySelectorAll('a[href="/nutzungsbedingungen.html"],a[href="/datenschutz.html"]')].map(e=>({decoration:getComputedStyle(e).textDecorationLine,weight:getComputedStyle(e).fontWeight})),summaryWeights:[...summary.children].map(e=>getComputedStyle(e).fontWeight),summaryClipped:summary.scrollHeight>summary.clientHeight+1||cs.maxHeight!=='none'||cs.overflowY!=='visible',inputFont:parseFloat(getComputedStyle(input).fontSize),inputHeight:input.getBoundingClientRect().height,payHeight:pay.getBoundingClientRect().height,containerOverflow:box.scrollWidth>box.clientWidth+1,
            duplicateHidden:box.querySelector(mode==='page'?'#pay-summary-short':'.kasse-short').hidden,font:parseFloat(cs.fontSize),detailsFont:parseFloat(ds.fontSize),border:cs.borderTopWidth,group:summary.getAttribute('aria-label'),button:pay.textContent,
            inlineLinkSignup:box.querySelectorAll('.fixture-link-signup').length,expressLink:[...express.querySelectorAll('button')].some(e=>e.textContent==='Link'&&e.getBoundingClientRect().height>0),mandate:fields.querySelector('.fixture-mandate')?.textContent,appearance:window.__fixtureAppearance,summaryHeight:Math.round(summary.getBoundingClientRect().height),detailsHeight:Math.round(details.getBoundingClientRect().height),overflow:document.documentElement.scrollWidth>innerWidth+1};
        },mode);
        assert.deepEqual(result.order,[true,true,true,true,true]); assert.equal(result.duplicateHidden,true); assert.equal(result.font,14*textZoom); assert.deepEqual(result.summaryWeights,['400','400']);assert.deepEqual(result.legalLinkStyles,[{decoration:'none',weight:'600'},{decoration:'none',weight:'600'}]);assert.equal(result.summaryClipped,false);assert.ok(result.inputFont>=16*textZoom);assert.ok(result.inputHeight>=44);assert.ok(result.payHeight>=44);assert.equal(result.containerOverflow,false);assert.match(result.email,/fixture@example\.invalid/u); assert.ok(result.detailsFont>=14); assert.equal(result.border,'0px'); assert.equal(result.group,'Preis und Laufzeit');assert.equal(result.button,'Zahlungspflichtig abonnieren');assert.equal(result.overflow,false);assert.equal(result.inlineLinkSignup,0);assert.equal(result.expressLink,true);assert.equal(result.mandate,'Pflichtmandat für wiederkehrende Zahlungen.');assert.equal(result.appearance.variables.fontSizeBase,'16px');assert.equal(result.appearance.variables.fontSizeSm,'14px');
        assert.match(result.summary,/Inkl\. MwSt\./u); assert.match(result.details,/Verträge hier kündigen/u); assert.match(result.details,/30 Tage/u);assert.match(result.details,/Widerrufsbelehrung/u);
        if(plan==='yearly'){
          for(const value of ['69,99','1 Jahr Mindestlaufzeit','danach unbefristet','1 Monat Kündigungsfrist'])assert.ok(result.summary.includes(value),value);
          if(scenario==='no_trial'){assert.match(result.summary,/Heute 49,99/u);assert.doesNotMatch(result.summary,/0,00|16\.11\.2026/u);assert.doesNotMatch(result.details,/kostenlos testen|Kündigst du vorher/u);}
          else {assert.match(result.summary,/Heute 0,00/u);assert.match(result.summary,/16\.11\.2026/u);assert.match(result.details,/7 Tage kostenlos testen\. Kündigst du vorher, zahlst du nichts\./u);}
          if(scenario==='no_discount')assert.doesNotMatch(result.summary,/49,99|1\. Jahr/u);else assert.match(result.summary,/49,99.*1\. Jahr/u);
        }
        else {assert.match(result.summary,/12,99/u);assert.match(result.summary,/Monat/u);assert.match(result.summary,/jederzeit zum Monatsende/u);assert.doesNotMatch(result.summary,/49,99|0,00/u);assert.doesNotMatch(result.details,/kostenlos testen|Kündigst du vorher/u);}
        if(width===390){assert.ok(result.summaryHeight<=80,`compact price block: ${result.summaryHeight}px`);assert.ok(result.summary.trim().split(/\s+/u).length<=34);}
        assert.equal(sessions.length,scenario==='delayed'&&mode==='modal'?2:1);assert.equal(sessions[0].body.plan,plan);assert.equal(sessions[0].token,'Bearer fixture-owner');assert.deepEqual(errors,[]);
        if(mode==='modal'){
          assert.equal(await page.locator('#kasse-title').evaluate(e=>document.activeElement===e),true);
          await page.keyboard.press('Tab');assert.equal(await page.locator('.kasse-close').evaluate(e=>document.activeElement===e),true);
        }
        await payControl.focus();await page.keyboard.press('Tab');
        assert.match(await page.evaluate(()=>document.activeElement.getAttribute('href')||''),/kuendigen\.html$/u);
        for(const href of ['/nutzungsbedingungen.html','/datenschutz.html']){await page.locator('.abo-checkout-details a[href="'+href+'"]').focus();assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');}
        if(process.env.SCREENSHOT_DIR&&plan==='yearly'&&scenario==='ready'){
          fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
          const suffix=textZoom>1?'-text225':'';
          // Clicking plain summary text removes the initial pointer focus ring without changing focus CSS.
          await page.locator('.abo-summary').click();
          await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`checkout-${mode}-${width}${suffix}.png`),fullPage:true});
          if(textZoom>1){await payControl.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`checkout-${mode}-${width}${suffix}-buttons.png`),fullPage:true});}
        }
        if(mode==='modal'){await page.keyboard.press('Escape');assert.equal(await page.locator('.kasse').count(),0);}

        console.log(JSON.stringify({mode,plan,width,textZoom,scenario,summaryHeight:result.summaryHeight,detailsHeight:result.detailsHeight,font:result.font,detailsFont:result.detailsFont}));
        cases++;
      } finally {await context.close();}
    }
    console.log(JSON.stringify({passed:cases,scope:'24 original cases + 4 yearly pricing variants + 4 320px/225% text cases; standalone/modal; Escape; no real services',browserClosed:true}));
  } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
