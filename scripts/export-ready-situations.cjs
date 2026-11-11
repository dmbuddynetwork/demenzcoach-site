// Offline export of reviewed public answers from the existing app renderer.
// No user profile, authentication, provider request, second renderer or hand-authored answer HTML.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(process.env.SITE_ROOT || path.join(__dirname, '..'));
const verifyOnly = process.argv.includes('--verify-only');
const topicArgument=process.argv.find(value=>value.startsWith('--topics='));
const topicFilter=topicArgument?new Set(topicArgument.slice(9).split(',')):null;
const evidenceArg = process.argv.indexOf('--evidence-dir');
const evidence = evidenceArg >= 0 ? path.resolve(process.argv[evidenceArg + 1]) : null;
const sha = value => createHash('sha256').update(value).digest('hex');
const original = Object.fromEntries(['de', 'en'].map(lang => [lang, fs.readFileSync(path.join(root, `content/ready-situations.${lang}.json`), 'utf8')]));
const entries = Object.fromEntries(Object.entries(original).map(([lang, value]) => [lang, JSON.parse(value)]));
const bindings = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts/build-ready-situations.mjs'), root, '--view-bindings', ...(topicArgument?[topicArgument]:[])], { encoding: 'utf8' }));
for (const lang of ['de', 'en']) {
  if (Object.keys(bindings[lang].sources).length < 11) throw Error('Incomplete current app dependencies');
  for (const rel of ['abo/web-auth.js', 'abo/email-auth.js', 'abo/email-account.js', 'abo/email-link-bootstrap.js']) {
    if (!bindings[lang].sources[rel]) throw Error(`Missing current email/auth dependency: ${rel}`);
  }
}
function verifySources() {
  for (const bound of Object.values(bindings)) for (const [rel, expected] of Object.entries(bound.sources)) {
    if (sha(fs.readFileSync(path.join(root, rel))) !== expected) throw Error(`App source changed during export: ${rel}`);
  }
  for (const lang of ['de', 'en']) if (fs.readFileSync(path.join(root, `content/ready-situations.${lang}.json`), 'utf8') !== original[lang]) throw Error('Content changed during export');
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  try {
    const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (rel.split('/').some(segment => segment.startsWith('.'))) throw Error('Not a public asset');
    let file = path.resolve(root, '.' + rel);
    if (!file.startsWith(root + path.sep)) throw Error('Outside public root');
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!types[path.extname(file)]) throw Error('Not a public asset');
    res.setHeader('Content-Type', types[path.extname(file)]);
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  let browser;
  const report = { mode: verifyOnly ? 'verify-only' : 'fresh-export', actualRenderer: true, cases: [], sources: bindings, providerRequests: 0, externalRequestsBlocked: 0 };
  try {
    verifySources();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    for (const lang of ['de', 'en']) for (const entry of entries[lang].filter(value=>!topicFilter||topicFilter.has(value.page.topicId))) {
      const goal = lang === 'de' && !entry.selfCare ? 'jetzt' : '';
      if (entry.reviewStatus !== 'reviewed') throw Error('Only reviewed public catalog entries may be exported');
      const captures = [], formPositions = [];
      for (let repetition = 0; repetition < 2; repetition++) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, reducedMotion: 'reduce' });
        const errors = [], forbidden = [];
        try {
          await context.addInitScript(() => {
            localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied');
            localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied');
          });
          await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin === origin) return route.continue();
            report.externalRequestsBlocked++;
            if (/cloudfunctions\.net|firebase|stripe|google-analytics|googletagmanager|facebook|tiktok|openai/i.test(url.href)) forbidden.push(url.origin + url.pathname);
            return route.abort();
          });
          const page = await context.newPage(); page.setDefaultTimeout(15000);
          page.on('pageerror', error => errors.push(error.message));
          const url = new URL(`/${lang}/`, origin); url.searchParams.set('situation', entry.key); if (goal) url.searchParams.set('ziel', goal);
          await page.goto(url.href, { waitUntil: 'networkidle' });
          await page.locator('#translator-result:not([hidden])').waitFor();
          const observed = await page.evaluate(key => {
            const output = document.getElementById('translator-result');
            const primary = document.querySelectorAll('#translator-form');
            const topMode = document.body.dataset.translatorInputPosition === 'top';
            if (primary.length !== 1) throw Error('Expected exactly one real primary form in document');
            const isBefore = Boolean(primary[0].compareDocumentPosition(output) & Node.DOCUMENT_POSITION_FOLLOWING);
            if (topMode ? (output.contains(primary[0]) || !isBefore || !primary[0].hidden) : !output.contains(primary[0])) throw Error('Primary form is not in its declared live position');
            const clone = output.cloneNode(true); clone.querySelector('#translator-form')?.remove();
            const data=JSON.parse(document.getElementById('translator-data').textContent),entry=data.entries.find(item=>item.key===key);
            if(!entry)throw Error('Expected fixed catalog key');
            const translate=window.DemenzTranslatorLocale?.create(data.ui)||((text)=>text);
            const publicPersonal={formal:false,callName:'',me:'',role:''};
            const expectedPhrases=entry.phrases.map(phrase=>translate(entry.selfCare?phrase:window.DemenzTranslatorCore.personalize(phrase,publicPersonal,data.formal)));
            return { primaryFormPosition: topMode ? 'top' : 'below', expectedPhrases, html: clone.innerHTML, text: output.textContent, input: document.getElementById('translator-input').value,
              rawData: JSON.stringify(JSON.parse(document.getElementById('translator-data').textContent)),
              personalKeys: Object.keys(localStorage).filter(key => !['demenzcoach.analyticsConsent.v1', 'demenzcoach.marketingConsent.v1'].includes(key)), sessionKeys: Object.keys(sessionStorage) };
          },entry.key);
          if (errors.length) throw Error(`App errors: ${errors.join('; ')}`);
          if (forbidden.length) throw Error(`Public initialization attempted a provider call: ${forbidden.join('; ')}`);
          if (observed.input || observed.personalKeys.length || observed.sessionKeys.length) throw Error('Personalized/nonempty context is not exportable');
          if (!observed.expectedPhrases.every(phrase => observed.text.includes(phrase))) throw Error('Wrong public answer');
          if (sha(observed.rawData) !== bindings[lang].dataHash) throw Error('Actual app data differs from current builder bindings');
          const actualPath=new URL(page.url()).pathname;
          if(actualPath!==entry.page.path)throw Error(`Public entry did not normalize to its fixed path: ${lang}/${entry.key}`);
          captures.push(observed.html.split(origin).join('https://dementiacoachapp.com'));
          formPositions.push(observed.primaryFormPosition);
        } finally { await context.close(); }
      }
      if (formPositions[0] !== formPositions[1]) throw Error('Nondeterministic primary form position');
      if (captures[0] !== captures[1]) throw Error(`Nondeterministic actual DOM: ${lang}/${entry.key}`);
      entry.view = { key: entry.key, language: lang, goal, bindings: bindings[lang], html: captures[0], formExcluded: true };
      report.cases.push({ language: lang, key: entry.key, goal, freshContexts: 2, identicalDOM: true, htmlSHA256: sha(captures[0]), originalFormExcluded: true, primaryFormPosition: formPositions[0] });
      verifySources();
      console.log(JSON.stringify({exported:lang+'/'+entry.key,cases:report.cases.length,freshContexts:report.cases.length*2,identicalDOM:true}));
    }
    verifySources();
    let changed = 0;
    for (const lang of ['de', 'en']) {
      const next = JSON.stringify(entries[lang], null, 2) + '\n';
      if (verifyOnly && next !== original[lang]) throw Error('Fresh actual DOM does not equal the stored exported views');
      if (!verifyOnly && next !== original[lang]) { fs.writeFileSync(path.join(root, `content/ready-situations.${lang}.json`), next); changed++; }
    }
    report.filesChanged = changed; report.providerRequests = 0;
    if (evidence) { fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(path.join(evidence, 'export-report.json'), JSON.stringify(report, null, 2) + '\n'); }
    console.log(JSON.stringify({ mode: report.mode, cases: report.cases.length, freshContexts: report.cases.length * 2, dependencies: Object.keys(bindings.de.sources).length, identicalDOM: true, providerRequests: 0, filesChanged: changed }));
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
