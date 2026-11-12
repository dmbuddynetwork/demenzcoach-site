// Production account UI and email adapter, synthetic Firebase SDK only. No emails/accounts.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createPreviewServer}=require('./generator-preview.cjs');
(async()=>{let preview,browser;const cases=[];try{
 preview=await createPreviewServer();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 for(const language of ['de','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});const errors=[];
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/abo/web-auth.js')return route.fulfill({contentType:'text/javascript',body:`
const user={uid:'expired-fixture',isAnonymous:true,emailVerified:false,email:null,providerData:[],getIdToken:async()=>'synthetic'};
const auth={currentUser:user};const sdk={async sendSignInLinkToEmail(a,email,settings){window.__fakeLink=settings.url+'&oobCode=expired-fixture';},isSignInWithEmailLink:(a,url)=>new URL(url).searchParams.has('oobCode'),EmailAuthProvider:{credentialWithLink(){throw Object.assign(new Error('fixture expired'),{code:'auth/expired-action-code'});}}};export async function webAuth(){return {auth,sdk}};`});
   if(url.origin!==preview.origin)return route.abort();return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(preview.origin+'/abo/konto.html?returnTo='+encodeURIComponent(language==='de'?'/de/':'/en/dementia-translator/'),{waitUntil:'networkidle'});
  await page.locator('.dc-signup input').fill('caregiver@example.test');await page.locator('.dc-signup .offer-body .primary').click();
  await page.waitForFunction(()=>window.__fakeLink);const callback=await page.evaluate(()=>window.__fakeLink);
  await page.goto(callback,{waitUntil:'networkidle'});
  await page.locator('#account-status').filter({hasText:language==='de'?/ungültig oder abgelaufen/:/invalid or has expired/}).waitFor();
  assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('#account-send').isVisible(),true);
  await page.locator('#account-email').fill('caregiver@example.test'); await page.locator('#account-send').click();
  await page.getByRole('heading',{name:language==='de'?'Bestätige kurz deine E-Mail':'Confirm your email',exact:true}).waitFor();
  assert.equal(await page.locator('.signup-address').innerText(),'caregiver@example.test');
  assert.equal(await page.locator('input[type=tel]').count(),0);assert.deepEqual(errors,[]);
  cases.push(language+': expired-link message, clean URL, new-link form, no phone');await context.close();
 }
 console.log(JSON.stringify({passed:true,cases,realEmails:0,realAccounts:0}));
}finally{if(browser)await browser.close();if(preview)await preview.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
