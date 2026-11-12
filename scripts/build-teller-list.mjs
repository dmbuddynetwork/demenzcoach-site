import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const data = JSON.parse(fs.readFileSync(path.join(root, 'content/teller-five-tricks.de.json'), 'utf8'));
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
if (data.canonical !== 'https://dementiacoachapp.com/de/demenz-alltagstipps.html' || data.tips.length !== 5 || new Set(data.tips.map(tip => tip.id)).size !== 5) throw Error('Invalid fixed five-tip list');
for (const tip of data.tips) {
  if (!tip.title || !tip.text || !tip.image.startsWith('/teller/') || !fs.existsSync(path.join(root, tip.image))) throw Error('Missing list content/asset');
  for (const source of tip.sources) if (!data.sources[source]) throw Error('Unknown list source');
}
const share = 'https://wa.me/?text=' + encodeURIComponent('5 kleine Alltagstipps bei Demenz: ' + data.canonical);
const schema = { '@context':'https://schema.org', '@type':'WebPage', name:data.title, description:data.description, url:data.canonical, inLanguage:'de', isAccessibleForFree:true, citation:Object.values(data.sources).map(source => source.url) };
const html = `<!doctype html>
<html lang="de">
<head>
 <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>${escape(data.title)} bei Demenz – zum Ausdrucken | Demenz Coach</title>
 <meta name="description" content="${escape(data.description)}"><meta name="robots" content="index,follow,max-image-preview:large">
 <link rel="canonical" href="${data.canonical}"><link rel="icon" href="/assets/favicon-192.png">
 <meta property="og:type" content="website"><meta property="og:locale" content="de_DE"><meta property="og:site_name" content="Demenz Coach App">
 <meta property="og:title" content="${escape(data.title)} bei Demenz"><meta property="og:description" content="${escape(data.description)}"><meta property="og:url" content="${data.canonical}">
 <meta property="og:image" content="https://dementiacoachapp.com/assets/og-fuenf-tipps-v1.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Fünf kleine Alltagstipps zum Ausprobieren und Weitergeben – Demenz Coach App">
 <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(data.title)} bei Demenz"><meta name="twitter:description" content="${escape(data.description)}"><meta name="twitter:image" content="https://dementiacoachapp.com/assets/og-fuenf-tipps-v1.png">
 <link rel="stylesheet" href="/teller/liste.css"><script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>
</head>
<body>
 <a class="skip" href="#liste">Zur Liste springen</a>
 <header><div class="nav-wrap"><a class="brand" href="/de/"><img src="/assets/lovable-logo.jpg" width="34" height="34" alt="">Demenz Coach App</a>
  <details class="site-menu"><summary>Menü</summary><nav aria-label="Hauptnavigation"><a href="/de/">Zur Alltagshilfe</a><a href="https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&amp;ct=web_de_home_nav&amp;mt=8" target="_blank" rel="noopener noreferrer">Zur App</a><button type="button" data-font-toggle aria-pressed="false">Schrift größer</button></nav></details>
 </div></header>
 <main id="liste"><h1>${escape(data.title)}</h1><p class="intro">${escape(data.description)}</p>
  <div class="actions"><button class="action" type="button" data-print-list>Liste drucken</button><a class="action secondary" href="${escape(share)}" target="_blank" rel="noopener noreferrer">Per WhatsApp teilen</a></div>
  <ol class="tips">${data.tips.map(tip => `<li class="tip" id="${tip.id}"><img src="${tip.image}" width="88" height="92" alt=""><div><h2>${escape(tip.title)}</h2><p>${escape(tip.text)}</p></div></li>`).join('\n   ')}</ol>
  <p class="note">${escape(data.note)}</p>
  <p class="print-url">Diese Liste: dementiacoachapp.com/de/demenz-alltagstipps.html</p>
 </main>
 <footer><nav aria-label="Weitere Informationen"><a href="/de/">Demenz Coach</a><a href="/datenschutz.html">Datenschutz</a><a href="/impressum.html">Impressum</a></nav><p>Allgemeine Alltagshinweise; kein Ersatz für individuelle Beratung.</p></footer>
 <script src="/teller/liste.js" defer></script>
</body></html>\n`;
fs.writeFileSync(path.join(root, 'de/demenz-alltagstipps.html'), html);
console.log('Built the fixed five-tip public list without auth, experiment or analytics scripts.');
