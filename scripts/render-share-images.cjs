// Recompose existing brand illustrations as the approved social-preview layout.
// Local browser rendering only; no generated artwork or remote services.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const root = path.resolve(__dirname, '..');
(async () => {
  let preview, browser;
  try {
    preview = await createPreviewServer();
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const variants = [
      ['og-alltag-v2.png', 'Was sagen?<br>Was tun?', 'Unterstützung im Demenz-Alltag'],
      ['og-fuenf-tipps-v1.png', '5 kleine<br>Alltagstipps', 'Zum Ausprobieren und Weitergeben']
    ];
    for (const [file, title, subline] of variants) {
      const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
      try {
        await context.route('**/*', route => new URL(route.request().url()).origin === preview.origin ? route.continue() : route.abort());
        const page = await context.newPage();
        await page.setContent(`<!doctype html><html lang="de"><head><meta charset="utf-8"><base href="${preview.origin}/"><style>
          @font-face{font-family:Lato;src:url('/teller/lato-400.woff2')}@font-face{font-family:Lato;src:url('/teller/lato-700.woff2');font-weight:700}
          *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#f1edf8;color:#25232b;font-family:Lato,Arial,sans-serif}
          .brand{position:absolute;top:54px;left:68px;display:flex;align-items:center;gap:15px;font-size:29px;font-weight:700}.brand img{width:48px;height:48px}
          main{display:flex;align-items:center;gap:54px;padding:140px 68px 35px;height:630px}.scene{width:330px;height:390px;object-fit:contain;flex:none}
          h1{font-size:76px;line-height:1.08;letter-spacing:-2px;margin:0 0 25px}p{font-size:28px;line-height:1.4;margin:0;max-width:570px;color:#625e69}
        </style></head><body><div class="brand"><img src="/assets/lovable-logo.jpg" alt="">Demenz Coach App</div><main><img class="scene" src="/assets/zeichnungen/v-umarmung.webp" alt=""><div><h1>${title}</h1><p>${subline}</p></div></main></body></html>`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        if (await page.evaluate(() => [...document.images].some(image => !image.complete || !image.naturalWidth))) throw Error('Missing preview asset');
        await page.screenshot({ path: path.join(root, 'assets', file) });
        console.log(file + ': 1200×630, existing assets only');
      } finally { await context.close(); }
    }
  } finally { if (browser) await browser.close(); if (preview) await preview.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
