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
        const page = await context.newPage(), errors=[]; page.on('pageerror', e=>errors.push(e.message));
        const response=await page.goto(preview.origin+'/de/demenz-alltagstipps.html', { waitUntil:'networkidle' }); assert.equal(response.status(),200);
        await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator('ol.tips > li').count(),5);
        assert.deepEqual(await page.locator('.tip h2').allTextContents(),data.tips.map(t=>t.title));
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
        await page.emulateMedia({media:'print'});assert.equal(await page.locator('.actions').isVisible(),false);assert.equal(await page.locator('.print-url').isVisible(),true);assert.equal(await page.locator('.tip').count(),5);
        const pdf=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
        const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;assert.equal(pages,1,'All five tips fit on one A4 page');
        if(evidence&&width===1280){fs.writeFileSync(path.join(evidence,'LISTE-A4.pdf'),pdf);await page.screenshot({path:path.join(evidence,'LISTE-PRINT.png'),fullPage:true});}
        assert.deepEqual(errors,[]);checks.push({width,direct200:true,fiveTopics:true,shareCanonicalOnly:true,printCalls:1,A4pages:pages,noAuthOrAnalytics:true,errors});
      } finally { await context.close(); }
    }
    assert.deepEqual(remoteRequests,[]);
    const report={passed:true,checks,remoteRequests,realProviderMailModelOrShareActions:0};
    if(evidence)fs.writeFileSync(path.join(evidence,'LIST-REPORT.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
  } finally { if(browser)await browser.close();if(preview)await preview.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
