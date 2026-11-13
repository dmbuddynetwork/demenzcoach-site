// Existing care copy only; local production Worker, real Chrome and controlled account transport.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const root = path.resolve(__dirname, '..');
const reviewed = require('../content/teller-five-tricks.de.json');
const catalog = require('../alltagstricks/tricks.json');
const refs = require('../alltagstricks/sources.json');
const esc = text => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const aliases = {'teller-rot':'roter-teller','becher-farbig':'farbiger-becher','lieblingslied':'lied-anziehen','nachtlicht-weg':'nachtlicht'};
(async () => {
 let preview, browser;
 const report = { directPages: [], views: [], legacyLinks: [], realProviderMailModelActions: 0 };
 try {
  const { tipDetailRoutes, tipDetailHref } = await import(pathToFileURL(path.join(root,'alltagstricks/detail-links.js')));
  const paths = [...new Set(Object.values(tipDetailRoutes))]; assert.equal(paths.length,122);
  for (const old of catalog.tricks) {
   const selected = reviewed.tips.find(tip => tip.id === (aliases[old.id] || old.id));
   const expected = selected || {...old,...refs.overrides[old.id]};
   const route = tipDetailRoutes[old.id], html = fs.readFileSync(path.join(root,route),'utf8');
   assert.ok(html.includes('<h1>'+esc(expected.title)+'</h1>'),old.id);
   assert.ok(html.includes('<p>'+esc(expected.text)+'</p>'),old.id);
   if(refs.notes[old.category])assert.ok(html.includes(esc(refs.notes[old.category])),old.id+' retains full category safeguard');
  }
  for (const tip of reviewed.tips) {
   const route=tipDetailRoutes[tip.id],html=fs.readFileSync(path.join(root,route),'utf8');
   assert.ok(html.includes(esc(tip.text))); assert.ok(html.includes('src="'+tip.image+'"'));
   for(const id of tip.sources)assert.ok(html.includes(esc(reviewed.sources[id].url)),tip.id+' source');
   if(['roter-teller','farbiger-becher'].includes(tip.id)) {
    const note=html.indexOf(esc(reviewed.note));assert.ok(note>0&&note<html.indexOf('translator-next tricks-jump'),'full food note precedes next actions');
   }
  }
  const origin='https://local.example';
  assert.equal(tipDetailHref('/alltagstricks/#becher-farbig',origin),'/alltagstricks/farbiger-becher.html');
  for(const url of ['https://foreign.example/alltagstricks/#teller-rot','/alltagstricks/?private=1#teller-rot','/alltagstricks/#unknown','/de/demenz-alltagstipps.html'])assert.equal(tipDetailHref(url,origin),null,url);
  preview=await createPreviewServer();
  // Every generated destination must directly resolve through the actual Worker.
  for(let i=0;i<paths.length;i+=8)await Promise.all(paths.slice(i,i+8).map(async route=>{
   const response=await fetch(preview.origin+route,{redirect:'manual'});assert.equal(response.status,200,route);const html=await response.text();
   assert.ok(html.includes('rel="canonical" href="https://dementiacoachapp.com'+route+'"'),route);
   const image=html.match(/class="tip-detail-art" src="([^"]+)"/)[1];assert.ok(fs.existsSync(path.join(root,image)),image);
   report.directPages.push({route,status:response.status});
  }));
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  const fixtureSource=fs.readFileSync(path.join(__dirname,'test-signup-sheet.cjs'),'utf8');const auth=fixtureSource.match(/const authModule = `([\s\S]*?)`;/)[1];
  for(const width of [390,1280]) {
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   try {
    await context.addInitScript(()=>{localStorage.setItem('demenzcoach.analyticsConsent.v1','denied');localStorage.setItem('demenzcoach.marketingConsent.v1','denied');});
    await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname==='/abo/web-auth.js')return route.fulfill({contentType:'text/javascript',body:auth});if(u.hostname.endsWith('cloudfunctions.net')&&u.pathname.endsWith('/access'))return route.fulfill({json:{enabled:true,verified:false,paid:false,remaining:1,registeredAdditional:3,contract:'signup-bonus-v1'}});return u.origin===preview.origin?route.continue():route.abort();});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(preview.origin+'/de/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('.content-feed')?.dataset.contentLoaded==='6');
    assert.equal(await page.locator('.home-situations .e-tile').count(),2);
    const first=await page.locator('#e-tiles > li').evaluateAll(nodes=>nodes.slice(0,7).map(n=>({tip:n.dataset.feedVerifiedTip||null,interlude:n.hasAttribute('data-feed-interlude')})));
    assert.equal(first.slice(0,6).filter(n=>n.tip).length,5);assert.equal(first[6].interlude,true);
    assert.deepEqual(await page.locator('[data-feed-verified-tip] a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href'))),reviewed.tips.map(t=>'/alltagstricks/'+t.id+'.html'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(process.env.TIP_ROUTE_EVIDENCE){await page.evaluate(()=>document.querySelectorAll('img[loading=lazy]').forEach(n=>n.loading='eager'));await page.waitForTimeout(200);await page.screenshot({path:path.join(process.env.TIP_ROUTE_EVIDENCE,'HOME-'+width+'.png'),fullPage:true});}
    await page.evaluate(()=>{const more=document.querySelector('.content-feed-more');for(let i=0;i<40&&!more.hidden;i++)more.click();});
    const all=await page.locator('[data-content-item] > a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));
    assert.equal(all.length,161);assert.equal(new Set(all).size,161);const tips=all.filter(url=>url.startsWith('/alltagstricks/')&&url.endsWith('.html'));assert.equal(tips.length,122);assert.deepEqual(new Set(tips),new Set(paths));
    // Actual card navigation, reload and clean direct URL: no trip through the print list.
    await page.locator('[data-feed-verified-tip="farbiger-becher"] a').click();await page.waitForURL('**/alltagstricks/farbiger-becher.html');await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('h1').textContent(),'Farbiger Becher');assert.ok((await page.locator('main').innerText()).includes(reviewed.note));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(process.env.TIP_ROUTE_EVIDENCE)await page.screenshot({path:path.join(process.env.TIP_ROUTE_EVIDENCE,'DETAIL-'+width+'.png'),fullPage:true});
    // Normal shared bootstrap updates legacy cross-promotions and subsequent rendered nodes.
    await page.goto(preview.origin+'/de/demenz-uebersetzer/ich-habe-schon-gegessen.html',{waitUntil:'networkidle'});
    const before=await page.locator('a[href^="/alltagstricks/"][href$=".html"]').count();assert.ok(before>0);
    await page.evaluate(()=>{const a=document.createElement('a');a.id='dynamic-tip';a.href='/alltagstricks/#nachtlicht-weg';a.textContent='Vorhandener Tipp';document.querySelector('main').append(a);});
    await page.waitForFunction(()=>document.querySelector('#dynamic-tip')?.getAttribute('href')==='/alltagstricks/nachtlicht.html');
    assert.equal(await page.locator('a[href^="/alltagstricks/#"]').count(),0);report.legacyLinks.push({width,existingGuideLinks:before,dynamicKnownAnchor:true});
    assert.deepEqual(errors,[]);report.views.push({width,initialCards:6,reviewedTipsBeforeQuestion:5,twoSituationExamples:true,allLoaded:161,ownTipPages:122,unique:true,actualCardClickAndReload:true,foodSafeguards:true,noOverflow:true,errors});
   } finally {await context.close();}
  }
  if(process.env.TIP_ROUTE_EVIDENCE)fs.writeFileSync(path.join(process.env.TIP_ROUTE_EVIDENCE,'DETAIL-ROUTE-CHECKS.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({directPages:report.directPages.length,views:report.views,legacyLinks:report.legacyLinks,realProviderMailModelActions:0}));
 } finally {await browser?.close();await preview?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
