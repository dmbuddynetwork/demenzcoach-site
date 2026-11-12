const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const evidence = process.env.TELLER_LIST_EVIDENCE;
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/teller-five-tricks.de.json')));
(async () => {
  let preview, browser; const checks = [], remoteRequests = [];
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive:true });
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless:true, ...(process.env.CHROME_PATH ? { executablePath:process.env.CHROME_PATH } : {}) });
    for (const width of [390,1280]) {
      const context = await browser.newContext({ viewport:{ width,height:1000 }, reducedMotion:'reduce' });
      try {
        await context.route('**/*', route => { const url=new URL(route.request().url()); if(url.origin===preview.origin)return route.continue(); remoteRequests.push(url.origin+url.pathname); return route.abort(); });
        const page = await context.newPage(), errors=[]; page.setDefaultTimeout(5000); page.on('pageerror', e=>errors.push(e.message));
        const response=await page.goto(preview.origin+'/de/demenz-alltagstipps.html', { waitUntil:'networkidle' }); assert.equal(response.status(),200);
        await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator('ol.tips > li').count(),5);
        assert.deepEqual(await page.locator('.tip h2').allTextContents(),data.tips.map(t=>t.title));
        assert.deepEqual(await page.locator('.tip p').allTextContents(),data.tips.map(t=>t.text));
        assert.equal(await page.getByText('Quellen und Einordnung',{exact:true}).count(),0);
        assert.equal(await page.locator('.sources').count(),0);
        for(const link of await page.locator('footer nav a').all()) {
          assert.deepEqual(await link.evaluate(el=>{const s=getComputedStyle(el);return {decoration:s.textDecorationLine,weight:s.fontWeight};}),{decoration:'none',weight:'400'});
          await link.focus();assert.equal(await link.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
        }
        await page.evaluate(()=>window.scrollTo(0,0));
        assert.equal(Object.keys(data.sources).length,3);
        const menu=page.locator('.site-menu'), toggle=menu.locator('summary'), navigation=page.getByRole('navigation',{name:'Hauptnavigation',exact:true});
        assert.equal(await navigation.isVisible(),false);
        await toggle.focus();await page.keyboard.press('Enter');assert.equal(await navigation.isVisible(),true);
        assert.equal(await navigation.getByRole('link',{name:'Zur Alltagshilfe',exact:true}).getAttribute('href'),'/de/');
        const app=new URL(await navigation.getByRole('link',{name:'Zur App',exact:true}).getAttribute('href'));
        assert.equal(app.hostname,'apps.apple.com');assert.equal(app.pathname,'/app/apple-store/id6790763941');
        await page.keyboard.press('Tab');assert.equal(await navigation.getByRole('link',{name:'Zur Alltagshilfe',exact:true}).evaluate(el=>el===document.activeElement),true);
        if(evidence&&width===390)await page.screenshot({path:path.join(evidence,'LISTE-MENU-390.png'),fullPage:true});
        await page.keyboard.press('Escape');assert.equal(await navigation.isVisible(),false);assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
        await toggle.click();await page.mouse.click(5,400);assert.equal(await navigation.isVisible(),false);
        await page.evaluate(()=>window.scrollTo(0,600));assert.equal(await page.locator('header').evaluate(el=>el.getBoundingClientRect().top),0);
        await page.evaluate(()=>window.scrollTo(0,0));
        assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),data.canonical);
        const share=new URL(await page.getByRole('link',{name:'Per WhatsApp teilen',exact:true}).getAttribute('href'));
        assert.equal(share.hostname,'wa.me');assert.equal(share.searchParams.get('text'),'5 kleine Alltagstipps bei Demenz: '+data.canonical);
        assert.equal(share.searchParams.get('text').includes('?'),false);
        assert.equal(await page.locator('form,input,[data-funnel-entry]').count(),0);
        assert.equal(await page.locator('script[src*="lovable-home"],script[src*="auth"],script[src*="experiment"]').count(),0);
        await page.evaluate(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++;};});
        await page.getByRole('button',{name:'Liste drucken',exact:true}).click();assert.equal(await page.evaluate(()=>window.__printCalls),1);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.equal(await page.evaluate(()=>[...document.images].some(image=>!image.complete||!image.naturalWidth)),false);
        if(evidence)await page.screenshot({path:path.join(evidence,`LISTE-${width}.png`),fullPage:true});
        await toggle.click();await navigation.getByRole('button',{name:'Schrift größer',exact:true}).click();
        assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('e-large')),true);
        assert.equal(await page.getByRole('button',{name:'Schrift größer',exact:true}).getAttribute('aria-pressed'),'true');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('e-large')),true);
        await toggle.click();assert.equal(await navigation.isVisible(),true);
        if(evidence&&width===390)await page.screenshot({path:path.join(evidence,'LISTE-MENU-GROSS-390.png'),fullPage:true});
        await page.emulateMedia({media:'print'});assert.equal(await menu.isVisible(),false);assert.equal(await page.locator('header').evaluate(el=>getComputedStyle(el).position),'static');assert.equal(await page.locator('.actions').isVisible(),false);assert.equal(await page.locator('.print-url').isVisible(),true);assert.equal(await page.locator('.tip').count(),5);
        const pdf=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
        const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;assert.equal(pages,1,'All five tips fit on one A4 page');
        if(evidence&&width===1280){fs.writeFileSync(path.join(evidence,'LISTE-A4.pdf'),pdf);await page.screenshot({path:path.join(evidence,'LISTE-PRINT.png'),fullPage:true});}
        assert.deepEqual(errors,[]);checks.push({width,direct200:true,fiveTopics:true,shareCanonicalOnly:true,printCalls:1,A4pages:pages,sourceDisclosureRemoved:true,quietFooterLinksWithKeyboardFocus:true,internalSourcesRetained:true,nativeMenuKeyboardAndFocus:true,stickyHeader:true,largeTextPersisted:true,menuAndLargeTextSafeInPrint:true,noAuthOrAnalytics:true,errors});
      } finally { await context.close(); }
    }
    const blocked=await browser.newContext({viewport:{width:390,height:850}});
    try {
      await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
      const page=await blocked.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(preview.origin+'/de/demenz-alltagstipps.html');await page.locator('.site-menu summary').click();
      const button=page.getByRole('button',{name:'Schrift größer',exact:true});await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');await button.click();assert.equal(await button.getAttribute('aria-pressed'),'false');assert.deepEqual(errors,[]);
      checks.push({blockedStorageFunctional:true,errors});
    } finally {await blocked.close();}
    assert.deepEqual(remoteRequests,[]);
    const report={passed:true,checks,remoteRequests,realProviderMailModelOrShareActions:0};
    if(evidence)fs.writeFileSync(path.join(evidence,'LIST-REPORT.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
  } finally { if(browser)await browser.close();if(preview)await preview.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
