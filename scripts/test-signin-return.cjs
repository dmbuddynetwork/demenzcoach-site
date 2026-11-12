// Actual app modules with mocked identity transport. No mail, Google or AI providers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const authModule = `
const read=()=>JSON.parse(localStorage.getItem('__returnUser')||'{"uid":"return-guest","isAnonymous":true,"emailVerified":false}');
const auth={get currentUser(){const u=read();return u&&{...u,getIdToken:async()=>'controlled-token'}}};
const set=email=>{localStorage.setItem('__returnUser',JSON.stringify({uid:'return-guest',email,emailVerified:true,isAnonymous:false}));dispatchEvent(new Event('demenz-auth-changed'))};
addEventListener('storage',e=>{if(e.key==='__returnUser')dispatchEvent(new Event('demenz-auth-changed'))});
const sdk={isSignInWithEmailLink:(_,u)=>new URL(u).searchParams.get('mode')==='signIn',EmailAuthProvider:{credentialWithLink:(email,url)=>({email,url})},sendSignInLinkToEmail:async(_,email,settings)=>{window.__returnLink=settings.url;window.__mockMailCount=(window.__mockMailCount||0)+1},linkWithCredential:async(_,c)=>set(c.email),reauthenticateWithCredential:async(_,c)=>set(c.email),signInWithCredential:async(_,c)=>set(c.email)};
export async function webAuth(){return{auth,sdk}}`;
const googleModule = `export function createGoogleAccess(){return{begin:async()=>{localStorage.setItem('__returnUser',JSON.stringify({uid:'return-guest',email:'care@example.test',emailVerified:true,isAnonymous:false}));return{signedIn:true}}}}`;
const harness = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main><section class="translator-goal-answer"><p id="existing-answer">Vorhandene hilfreiche Antwort</p><textarea id="translator-input">Meine unveränderte Eingabe</textarea><section id="offer" data-signup-credit-offer="true"></section></section></main><script src="/abo/abo-config.js"></script><script type="module">
import {mountInlineSignup} from '/abo/inline-signup.js';
window.DemenzKiFreigabe={refresh:async()=>({enabled:true,verified:true,paid:false}),takePending:()=>sessionStorage.removeItem('demenzCoachKiOffen')};
await mountInlineSignup(document.querySelector('#offer'),{bonus:3,en:false,purpose:'intro',creditActive:true,returnTo:'/de/'});
</script></body></html>`;
(async()=>{
  let preview,browser;const report={providerCalls:0,realEmails:0,checks:[],errors:[]};
  try{
    preview=await createPreviewServer();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
    const output=process.env.SIGNIN_RETURN_EVIDENCE;if(output)fs.mkdirSync(output,{recursive:true});
    async function context(width=390){
      const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await c.addInitScript(()=>{try{localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied')}catch{}});
      await c.route('**/*',async r=>{const u=new URL(r.request().url());
        if(u.pathname==='/__signin-test.html')return r.fulfill({contentType:'text/html',body:harness});
        if(u.pathname==='/abo/web-auth.js')return r.fulfill({contentType:'text/javascript',body:authModule});
        if(u.pathname==='/abo/google-auth.js')return r.fulfill({contentType:'text/javascript',body:googleModule});
        if(u.hostname.endsWith('cloudfunctions.net')){
          if(r.request().method()==='OPTIONS')return r.fulfill({status:204});
          assert.ok(u.pathname.endsWith('/access'),'No automatic AI/other backend requests');
          return r.fulfill({json:{enabled:true,verified:true,paid:false,used:1,remaining:3,anonymousAnswers:1,registeredAdditional:3}});
        }
        return u.origin===preview.origin?r.continue():r.abort();
      });
      c.on('page',p=>{p.setDefaultTimeout(10000);p.on('pageerror',e=>report.errors.push(e.message))});return c;
    }
    for(const width of [390,1280]){
      const c=await context(width);try{
        const p=await c.newPage();await p.goto(preview.origin+'/__signin-test.html');await p.getByRole('dialog').waitFor();
        await p.locator('.dc-signup').getByLabel('Deine E-Mail-Adresse',{exact:true}).fill('care@example.test');await p.getByRole('button',{name:'Kostenlos freischalten',exact:true}).click();
        await p.getByRole('heading',{name:'Bestätige kurz deine E-Mail',exact:true}).waitFor();
        const link=new URL(await p.evaluate(()=>window.__returnLink));link.searchParams.set('mode','signIn');link.searchParams.set('oobCode','controlled-code');
        assert.equal(await p.evaluate(()=>window.__mockMailCount),1);
        const callback=await c.newPage();await callback.goto(link.href);await callback.waitForURL(preview.origin+'/de/');
        await callback.locator('.dc-signin-notice').waitFor();assert.equal(new URL(callback.url()).search,'');
        await p.getByRole('dialog').waitFor({state:'detached'});await p.locator('.dc-signin-notice').waitFor();
        assert.equal(new URL(p.url()).pathname,'/__signin-test.html');
        assert.equal(await p.locator('#existing-answer').innerText(),'Vorhandene hilfreiche Antwort');
        assert.equal(await p.locator('#translator-input').inputValue(),'Meine unveränderte Eingabe');
        assert.equal(await p.getByRole('button',{name:'Weiter',exact:true}).count(),0);
        assert.equal(await p.locator('.dc-signin-notice a').getAttribute('href'),'/start/','Eligible setup remains optional');
        assert.equal(await p.evaluate(()=>document.activeElement.closest('.dc-signin-notice')!==null),false,'Notice does not steal focus');
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        if(output)await p.screenshot({path:path.join(output,`RETURN-NOTICE-${width}.png`)});
        await callback.reload();assert.equal(await callback.locator('.dc-signin-notice').count(),0,'Destination hint is consumed once');
        await p.getByRole('button',{name:'Anmeldehinweis schließen',exact:true}).click();assert.equal(await p.locator('.dc-signin-notice').count(),0);
        report.checks.push(`Email callback redirects; original sheet closes; exact answer/draft/focus retained; optional setup; one-time dismissible hint ${width}`);
      }finally{await c.close()}
    }
    {const c=await context();try{const p=await c.newPage();await p.goto(preview.origin+'/__signin-test.html');await p.getByRole('button',{name:'Mit Google fortfahren',exact:true}).click();await p.getByRole('dialog').waitFor({state:'detached'});await p.locator('.dc-signin-notice').waitFor();assert.equal(await p.locator('#existing-answer').innerText(),'Vorhandene hilfreiche Antwort');report.checks.push('Google controller shares immediate verified in-place completion, no success wall')}finally{await c.close()}}
    // Account destinations and queued notice guards use actual shared module, not auth transport.
    {const c=await context();try{
      const p=await c.newPage();await p.goto(preview.origin+'/de/');
      const checks=await p.evaluate(async()=>{
        const m=await import('/abo/signin-success.js');const user={uid:'fixture',isAnonymous:false,emailVerified:true,email:'care@example.test'};const values=new Map();let replaced=null;
        const host={location:{origin:location.origin,replace:v=>replaced=v},sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};
        const denied=m.redirectAfterSignIn({target:'/abo/?plan=yearly',user:{...user,emailVerified:false},host});
        if(denied||replaced!==null||values.size)throw Error('Unverified user redirected');
        m.redirectAfterSignIn({target:'/abo/?plan=yearly&src=return_test',user,host});const allowed=replaced;
        m.redirectAfterSignIn({target:'https://example.invalid/steal',user,host});const sanitized=replaced;
        values.set('demenzCoachKiOffen',JSON.stringify({text:'Vorhandener Entwurf',until:Date.now()+60000}));m.redirectAfterSignIn({target:'/de/',user,host});
        const draftFlag=values.get('demenzcoach.signupDraftReturn.v1');const marker=JSON.parse(values.get('demenzcoach.signinNotice.v1'));
        return{allowed,sanitized,draftFlag,markerKeys:Object.keys(marker).sort(),markerHasPII:JSON.stringify(marker).includes('care@')};
      });
      assert.deepEqual(checks,{allowed:'/abo/?plan=yearly&src=return_test',sanitized:'/de/',draftFlag:'1',markerKeys:['createdAt','offerSetup','path'],markerHasPII:false});
      for(const kind of ['expired','future','wrong-path','signed-out','unverified']){
        const count=await p.evaluate(async kind=>{const m=await import('/abo/signin-success.js');const marker={createdAt:Date.now()+(kind==='expired'?-61000:kind==='future'?10000:0),path:kind==='wrong-path'?'/abo/':location.pathname};sessionStorage.setItem('demenzcoach.signinNotice.v1',JSON.stringify(marker));await m.consumeSignInNotice({loadAuth:async()=>({auth:{currentUser:kind==='signed-out'?null:{uid:'x',email:'x@example.test',isAnonymous:false,emailVerified:kind!=='unverified'}}})});return document.querySelectorAll('.dc-signin-notice').length},kind);assert.equal(count,0,kind);
      }
      report.checks.push('Safe internal target and checkout params retained; unsafe external target rejected; draft restores without auto-submit; no PII marker; expired/future/wrong-path/unverified/signed-out notices suppressed');
    }finally{await c.close()}}
    {const c=await context();try{const p=await c.newPage();await p.goto(preview.origin+'/de/');await p.evaluate(async()=>{const user={uid:'return-guest',email:'care@example.test',emailVerified:true,isAnonymous:false};localStorage.setItem('__returnUser',JSON.stringify(user));sessionStorage.setItem('demenzCoachKiOffen',JSON.stringify({text:'Mein vorhandener Situationsentwurf',until:Date.now()+60000}));const m=await import('/abo/signin-success.js');m.redirectAfterSignIn({target:'/en/dementia-translator/',user})});await p.waitForURL(preview.origin+'/en/dementia-translator/');await p.locator('.dc-signin-notice').waitFor();assert.ok((await p.locator('.dc-signin-notice').innerText()).includes('You are signed in.'));assert.ok(!(await p.locator('.dc-signin-notice').innerText()).includes('care@example.test'));assert.equal(await p.locator('#translator-input').inputValue(),'Mein vorhandener Situationsentwurf');assert.equal(await p.evaluate(()=>sessionStorage.getItem('demenzcoach.signupDraftReturn.v1')),null);report.checks.push('English destination receives localized nonblocking notice without email; actual translator restores draft without auto-answer request')}finally{await c.close()}}
    {const c=await context();try{const p=await c.newPage();await p.goto(preview.origin+'/abo/konto.html?returnTo=%2Fde%2F&intent=signin');await p.locator('.dc-signup').getByLabel('Deine E-Mail-Adresse',{exact:true}).fill('care@example.test');await p.getByRole('button',{name:'Mit E-Mail fortfahren',exact:true}).click();await p.getByRole('heading',{name:'Bestätige kurz deine E-Mail',exact:true}).waitFor();const link=new URL(await p.evaluate(()=>window.__returnLink));link.searchParams.set('mode','signIn');link.searchParams.set('oobCode','controlled-code');const callback=await c.newPage();await callback.goto(link.href);await callback.waitForURL(preview.origin+'/de/');await p.waitForURL(preview.origin+'/de/');await p.locator('.dc-signin-notice').waitFor();assert.equal(await p.locator('.web-account').count(),0);assert.equal(await p.getByRole('button',{name:'Weiter',exact:true}).count(),0);report.checks.push('Actual original account Sent page and actual callback both auto-return to intended home without intermediate success page')}finally{await c.close()}}
    assert.deepEqual(report.errors,[]);report.passed=true;if(output)fs.writeFileSync(path.join(output,'RETURN-REPORT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{if(browser)await browser.close();if(preview)await preview.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
