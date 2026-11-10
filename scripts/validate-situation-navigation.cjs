// Native document links, immediate typed-goal state, and actual footer pointer hit testing.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:54929';
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});try{
 for(const width of [1280,390,320])for(const reducedMotion of ['no-preference','reduce']){
  const c=await b.newContext({viewport:{width,height:1000},reducedMotion});
  await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const p=await c.newPage();p.setDefaultTimeout(7000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/de/');if(await p.locator('.consent-decline').isVisible())await p.locator('.consent-decline').click();
  const link=p.locator('a[data-translator-key="umziehen"]').first();const target=new URL(await link.getAttribute('href'),p.url()).pathname;
  for(let reveal=0;reveal<8&&!await link.isVisible();reveal++){await p.locator('#e-tiles-end').scrollIntoViewIfNeeded();await p.waitForTimeout(80);}
  await link.click();await p.waitForURL(u=>u.pathname===target);
  assert.equal(await p.locator('link[rel="canonical"]').getAttribute('href'),'https://dementiacoachapp.com'+target);
  assert.match(await p.locator('h1').innerText(),/ziehe mich nicht um/u);await p.reload();assert.equal(new URL(p.url()).pathname,target);
  await p.goBack();await p.locator('#translator-input').waitFor();
  const original='Ich ziehe mich nicht um.';await p.locator('#translator-input').fill(original);await p.locator('#translator-input').press('Enter');
  await p.getByRole('heading',{name:'Was möchtest du jetzt erreichen?',exact:true}).waitFor();
  assert.equal(await p.locator('h1:visible').count(),1);assert.equal(await p.locator('.translator-goal').count(),3);
  assert.ok(await p.locator('h1:visible').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight;}),'goal heading is immediately in the viewport');
  assert.ok(await p.locator('#translator-form').isHidden());assert.equal(await p.locator('.translator-ai-wait').count(),0);
  const change=p.locator('.translator-change-situation a');assert.ok((await change.boundingBox()).height>=44);
  await change.click();assert.equal(await p.locator('#translator-input').inputValue(),original);
  assert.ok(await p.locator('#home-title').isVisible());assert.ok(await p.locator('#translator-input').evaluate(n=>n===document.activeElement));
  await p.locator('#translator-input').press('Enter');await p.locator('.translator-goal').first().click();
  await p.locator('.translator-phrases').waitFor();assert.equal(await p.locator('h1:visible').count(),1);
  assert.equal(await p.locator('#translator-form').count(),1);assert.ok(!(await p.locator('.translator-followup-question').evaluate(n=>n.open)));
  const summary=p.locator('.translator-followup-question summary');await summary.focus();await p.keyboard.press('Enter');
  assert.ok(await p.locator('#translator-input').isVisible());await p.locator('#translator-input').fill('Fiktiver Entwurf bleibt erhalten');
  await p.goto(base+'/de/');if(width===320)await p.addStyleTag({content:'html{font-size:225% !important}'});
  for(let reveal=0;reveal<16&&await p.locator('#e-tiles li[hidden]').count();reveal++){await p.locator('#e-tiles-end').scrollIntoViewIfNeeded();await p.waitForTimeout(80);}
  await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await p.waitForTimeout(400);
  const settings=p.locator('.consent-settings');
  const hit=await settings.evaluate(n=>{const r=n.getBoundingClientRect();const el=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);const chat=document.querySelector('.translator-chat');return {ok:n.contains(el),rect:r.toJSON(),hit:el?.outerHTML.slice(0,200),chat:chat?.getBoundingClientRect().toJSON(),bottom:chat?.style.bottom};});assert.ok(hit.ok,`settings not covered ${JSON.stringify(hit)} ${width}/${reducedMotion}`);
  await settings.click();assert.ok(await p.locator('.consent-banner').isVisible());await p.locator('.consent-decline').click();
  if(width===390&&reducedMotion==='reduce'){
   const field=p.locator('.translator-chat-input');await field.fill('Fiktiver Chatentwurf');
   await p.setViewportSize({width,height:280});await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await p.waitForTimeout(80);
   assert.equal(await field.inputValue(),'Fiktiver Chatentwurf');
   assert.ok(await field.evaluate(n=>n===document.activeElement),'short viewport does not steal focus');
   await p.setViewportSize({width,height:1000});await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await p.waitForTimeout(80);
   await p.locator('.translator-chat-close').click();assert.ok(await p.locator('.translator-chat').evaluate(n=>n.classList.contains('translator-chat-small')));
   await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(80);await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await p.waitForTimeout(80);
   assert.ok(await p.locator('.translator-chat').evaluate(n=>n.classList.contains('translator-chat-small')),'user minimization survives scrolling');
   await p.locator('.translator-chat-open').click();assert.equal(await field.inputValue(),'Fiktiver Chatentwurf');
  }
  assert.deepEqual(errors,[]);await c.close();
 }
 console.log('Situation navigation/goal/composer/footer passed: real href documents, reload/back, one visible H1, no fake wait, one collapsible form, actual settings clicks, 320px/225% and both motion preferences.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
