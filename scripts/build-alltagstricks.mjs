// Baut /alltagstricks/ aus alltagstricks/tricks.json (Kopie von dementia/Design/care-tricks.json, dieselbe Liste wie in der App).
// Aufruf: node scripts/build-alltagstricks.mjs .   (danach node scripts/validate-seo.mjs .)
import fs from "node:fs";
import path from "node:path";
import { rewriteGermanRouteReferences } from './migrate-german-situation-routes.mjs';

const root = path.resolve(process.argv[2] ?? ".");
const data = JSON.parse(fs.readFileSync(path.join(root, "alltagstricks/tricks.json"), "utf8"));
const references = JSON.parse(fs.readFileSync(path.join(root, "alltagstricks/sources.json"), "utf8"));
// Website clarifications do not rewrite the shared App source list.
for (const [id, override] of Object.entries(references.overrides)) {
  if (!data.tricks.some(trick => trick.id === id) || !references.sources[override.source]) throw new Error(`Unknown source override: ${id}`);
}
data.tricks = data.tricks.map(trick => ({ ...trick, ...references.overrides[trick.id] }));
// Website-Ordnung: eigene Themen und Hinweisboxen, die App-Liste bleibt unverändert (alltagstricks/site-categories.json).
const siteCategories = JSON.parse(fs.readFileSync(path.join(root, 'alltagstricks/site-categories.json'), 'utf8'));
for (const [id, key] of Object.entries(siteCategories.assign)) {
  if (!data.tricks.some(trick => trick.id === id) || !siteCategories.categories[key]) throw new Error(`Unknown category assignment: ${id}`);
}
data.categories = siteCategories.categories;
Object.assign(references.notes, siteCategories.notes);
Object.assign(references.categories, siteCategories.sources);
data.tricks = data.tricks.map(trick => ({ ...trick, category: siteCategories.assign[trick.id] ?? trick.category }));
for (const trick of data.tricks) if (!data.categories[trick.category] || !references.categories[trick.category]) throw new Error(`Missing category data: ${trick.id}`);
// Reuse the five reviewed full tips, without rewriting the shared native App catalog.
const reviewed = JSON.parse(fs.readFileSync(path.join(root, 'content/teller-five-tricks.de.json'), 'utf8'));
const reviewedIDs = { 'teller-rot': 'roter-teller', 'becher-farbig': 'farbiger-becher', 'lieblingslied': 'lied-anziehen', 'nachtlicht-weg': 'nachtlicht' };
const reviewedFor = trick => reviewed.tips.find(tip => tip.id === (reviewedIDs[trick.id] || trick.id));
data.tricks = data.tricks.map(trick => { const tip = reviewedFor(trick); return tip ? { ...trick, title: tip.title, text: tip.text } : trick; });
const photo = reviewed.tips.find(tip => tip.id === 'foto-zimmertuer');
if (!photo) throw new Error('Missing reviewed photo tip');
data.tricks.push({ id: photo.id, category: 'orientierung', title: photo.title, text: photo.text, image: photo.image, situations: [], source: 'home' });
const detailPath = trick => `/alltagstricks/${reviewedFor(trick)?.id || trick.id}.html`;
const detailURLs = data.tricks.map(trick => `https://dementiacoachapp.com${detailPath(trick)}`);
if (new Set(detailURLs).size !== data.tricks.length) throw new Error('Duplicate tip detail route');
const url = "https://dementiacoachapp.com/alltagstricks/";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------------------------
// Neues Layout (26. Nov 2026, Daniel: Tipps-Seiten sollen aussehen und optimiert sein wie die Seiten des
// Demenz-Übersetzers): gleiche Kopfzeile, Sprechblase mit Zeichnung, Schritte wie „Das kannst du sagen/tun“,
// „Mehr zu …“-Liste, Plan-Angebot, App-Angebot, Ratgeberblock, Situations-Kacheln, weitere Tricks.
// ---------------------------------------------------------------------------------------------
const extended = JSON.parse(fs.readFileSync(path.join(root, 'content/tipps-ausfuehrlich.de.json'), 'utf8'));
const situationTiles = JSON.parse(fs.readFileSync(path.join(root, 'content/situation-tiles.de.json'), 'utf8'));
const tileByKey = Object.fromEntries(situationTiles.map(tile => [tile.key, tile]));
const store = (ct) => `https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&amp;ct=${ct}&amp;mt=8`;
const imageOf = trick => reviewedFor(trick)?.image || `/alltagstricks/img/${trick.drawing}.webp`;
const idOf = trick => reviewedFor(trick)?.id || trick.id;

// Situation der App -> Kachel (Schlüssel wie im Übersetzer) mit der passenden Seite.
const situationKeys = {
  eat: ['schongegessen', 'hunger'], drink: ['schongegessen'], wash: ['waschen'], bath: ['waschen', 'toilette'], teeth: ['waschen'],
  bathroom: ['toilette', 'toilettefinden'], accident: ['toilettefinden'], dress: ['umziehen', 'ausziehen'], shoes: ['umziehen'], coat: ['uhrzeit'],
  getup: ['liegen'], morning: ['liegen'], night: ['aufstehen', 'bett'], evening: ['abend', 'bett'], sunset: ['abend', 'jemand'], fear: ['jemand'],
  walk: ['uhrzeit'], leave: ['abend', 'nachhause'], home: ['wobin', 'nachhause'], work: ['arbeit'], car: ['auto'], keys: ['auto'],
  apathy: ['langweilig'], tv: ['langweilig'], cry: ['dumm'], words: ['dumm'], recognize: ['wer'], mirror: ['wer'], dead: ['mutter'], child: ['kinder'],
  repeat: ['uhrzeit'], anger: ['ruhe'], noise: ['ruhe'], follow: ['allein'], carer: ['kind'], visit: ['besuch'], daycare: ['tagespflege'],
  accuse: ['geld', 'luegen'], money: ['geld'], rummage: ['geld'], jealous: ['untreue'], help: ['hilfe'], doctor: ['krank'], cold: ['kalt'],
};
const categoryKeys = {
  essen: ['schongegessen', 'hunger'], trinken: ['schongegessen', 'hunger'], bad: ['waschen'], toilette: ['toilette', 'toilettefinden'], zaehne: ['waschen'], orientierung: ['wobin', 'wer'],
  schlaf: ['bett', 'aufstehen'], sicherheit: ['wobin', 'eingesperrt'], kleidung: ['umziehen', 'ausziehen'], beschaeftigung: ['langweilig', 'dumm'],
  gespraech: ['wer', 'ruhe'],
};
const goals = {
  essen: 'Mahlzeiten leichter machen', trinken: 'Getränke gut erkennbar anbieten', bad: 'Waschen ruhiger gestalten', toilette: 'Toilettengänge leichter machen', zaehne: 'Zähneputzen leichter machen', orientierung: 'Orientierung erleichtern',
  schlaf: 'Abend und Nacht ruhiger gestalten', sicherheit: 'Die Umgebung sicherer machen', kleidung: 'Anziehen leichter machen',
  beschaeftigung: 'Gemeinsam etwas Schönes tun', gespraech: 'Begegnungen leichter machen',
};
const guides = {
  essen: null, trinken: null, toilette: null, zaehne: null, bad: ['/de/ratgeber/demenz-will-sich-nicht-waschen.html', 'Demenz: wenn jemand sich nicht waschen will'],
  schlaf: ['/de/ratgeber/demenz-nachts-zur-arbeit.html', 'Nachts unruhig: ruhig reagieren'], gespraech: ['/de/ratgeber/demenz-kommunikation.html', 'Kommunikation bei Demenz: ruhig sprechen in schwierigen Momenten'],
  orientierung: ['/de/ratgeber/demenz-immer-dieselbe-frage.html', 'Immer dieselbe Frage: ruhig antworten'], sicherheit: ['/de/ratgeber/demenz-nach-hause-was-sagen.html', 'Will nach Hause: was du sagen kannst'],
  kleidung: null, beschaeftigung: null,
};
for (const [key, list] of [...Object.entries(situationKeys), ...Object.entries(categoryKeys)]) for (const tileKey of list) if (!tileByKey[tileKey]) throw new Error(`Unknown tile ${tileKey} in ${key}`);
for (const [, g] of Object.entries(guides)) if (g && !fs.existsSync(path.join(root, g[0].slice(1)))) throw new Error(`Missing guide ${g[0]}`);
const tilesFor = trick => {
  const keys = [...new Set([...trick.situations.flatMap(key => situationKeys[key] || []), ...(categoryKeys[trick.category] || [])])];
  return keys.slice(0, 4).map(key => tileByKey[key]);
};

const head = ({ pageURL, pageTitle, pageDescription, pageImage, pageSchema, slug, extraHead = '' }) => `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${esc(pageDescription)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="#faf8f4">
  <meta name="apple-itunes-app" content="app-id=6790763941">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Demenz Coach">
  <meta property="og:locale" content="de_DE">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(pageDescription)}">
  <meta property="og:url" content="${pageURL}">
  <meta property="og:image" content="${esc(pageImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(pageTitle)}">
  <meta name="twitter:description" content="${esc(pageDescription)}">
  <meta name="twitter:image" content="${esc(pageImage)}">
  <title>${esc(pageTitle)}</title>
  <link rel="canonical" href="${pageURL}">
  <link rel="alternate" hreflang="de" href="${pageURL}">
  <link rel="alternate" hreflang="x-default" href="${pageURL}">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="stylesheet" href="/translator.css">
  <link rel="stylesheet" href="/einfach.css">
  <link rel="stylesheet" href="/de/homepage.css">
  <link rel="stylesheet" href="/alltagstricks/tricks.css">${extraHead}
  <script>(function(){var d=document.documentElement,u=navigator.userAgent||'';d.classList.add('app-check');try{if(localStorage.getItem('demenzcoach.textSize.v1')==='large')d.classList.add('e-large');}catch(e){}document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-font-toggle]');if(!b)return;var on=d.classList.toggle('e-large');b.setAttribute('aria-pressed',String(on));try{if(on)localStorage.setItem('demenzcoach.textSize.v1','large');else localStorage.removeItem('demenzcoach.textSize.v1');}catch(e){}});document.addEventListener('DOMContentLoaded',function(){var b=document.querySelector('[data-font-toggle]');if(b)b.setAttribute('aria-pressed',String(d.classList.contains('e-large')));});if(/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))d.classList.add('is-ios');document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href*="apps.apple.com"]');if(a){a.target='_blank';a.rel='noopener';}},true);})();</script>
  <script type="application/ld+json">${JSON.stringify(pageSchema, null, 2)}</script>
</head>
<body class="einfach homepage-v2" data-page-type="translator-tool" data-page-language="de" data-page-slug="${slug}">
  <a class="skip-link" href="#main">Zum Inhalt springen</a>
  <header class="e-header">
    <div class="e-wrap">
      <a class="e-brand" href="/de/" aria-label="Demenz Coach App Startseite"><img src="/assets/lovable-logo.jpg" width="40" height="40" alt=""><span>Demenz Coach App</span></a>
      <nav aria-label="Hauptnavigation"><button type="button" class="e-font-toggle" data-font-toggle aria-pressed="false" aria-label="Schrift größer" title="Schrift größer">Schrift größer</button><a href="${store('seo_de_tricks_nav')}" data-store-link="seo-de-tricks-nav">Zur App</a></nav>
    </div>
  </header>
`;

const footer = `  <footer class="e-footer">
    <div class="e-wrap">
      <nav aria-label="Weitere Seiten">
        <a href="/alltagstricks/">Alltagstricks</a>
        <a href="/de/demenz-uebersetzer/">Alle Sätze</a>
        <a href="/de/ratgeber/">Ratgeber</a>
        <a href="/impressum.html">Impressum</a>
        <a href="/abo/kuendigen.html">Verträge hier kündigen</a>
        <a href="/datenschutz.html">Datenschutz</a>
        <a href="/nutzungsbedingungen.html">Nutzungsbedingungen</a>
        <a href="/support.html">Support</a>
      </nav>
      <p>Allgemeine Alltagshinweise für Angehörige, ohne Gewähr. Kein Medizinprodukt und kein Ersatz für ärztliche, pflegerische oder rechtliche Beratung. Bei Gefahr: Notruf 112.</p>
    </div>
  </footer>
  <script>window.demenzCoachSiteLocale={"menuOpen":"Menü öffnen","menuClose":"Menü schließen","privacyURL":"/datenschutz.html"};</script>
  <script src="/lovable-home.js?v=20261108a"></script>
  <script src="/demenz-uebersetzer/translator-signup.js"></script>
  <script src="/alltagstricks/tips-chat.js"></script>
  <script>(function(){var list=document.getElementById('e-tiles'),end=document.getElementById('e-tiles-end');if(!list||!end||!('IntersectionObserver' in window))return;var step=6,items=[].slice.call(list.children);items.forEach(function(li,i){if(i>=step)li.hidden=true;});function rest(){return list.querySelectorAll('li[hidden]');}var io=new IntersectionObserver(function(e){if(!e[0].isIntersecting)return;var h=rest();for(var i=0;i<step&&i<h.length;i++)h[i].hidden=false;if(!rest().length)io.disconnect();else{io.unobserve(end);io.observe(end);}},{rootMargin:'400px 0px'});io.observe(end);})();</script>
  <script>(function(){var host=document.getElementById('tricks-signup');if(!host)return;var b=window.DemenzTranslatorSignup&&window.DemenzTranslatorSignup.box();if(b){host.append(b);}else{var d=host.closest('details');if(d)d.hidden=true;}})();</script>
</body>
</html>
`;

// Bausteine
const said = (label, title, imageSrc) => `<div class="translator-said translator-said-with-art"><div class="translator-said-text"><p class="translator-said-label">${esc(label)}</p><h1 tabindex="-1" class="translator-said-bubble">${title}</h1></div><img class="translator-said-art" src="${imageSrc}" alt="" width="300" height="220" decoding="async"></div>`;
const nextRows = (rows) => `<div class="translator-next"><p class="translator-next-title">${esc(rows.title)}</p><nav class="translator-next-rows" aria-label="${esc(rows.title)}">${rows.items.map(([href, label, attrs = '']) => `<a class="translator-copy" href="${href}"${attrs}>${esc(label)}</a>`).join('')}</nav></div>`;
const planCta = ({ key, src, heading, text }) => `<aside class="translator-plan-cta"><img class="translator-plan-art" src="/assets/zeichnungen/app-tablet.webp" width="480" height="409" alt="" loading="lazy" decoding="async"><div><h2>${esc(heading)}</h2><p>${esc(text)}</p><a class="button" href="/start/?src=${src}&amp;direkt=1${key ? `&amp;s=${key}` : ''}" data-related-link="plan_${src}"${key ? ` data-direct-situation="${key}"` : ''}>Persönliche Hilfe ansehen</a></div></aside>`;
const printOffer = `<details class="translator-extra-offers"><summary>Alle Sätze zum Ausdrucken</summary><div id="tricks-signup"></div></details>`;
const appCta = (heading, text) => `<aside class="article-cta translator-app-cta"><div><h2>${esc(heading)}</h2><p>${esc(text)}</p></div><div class="translator-app-visual"><img src="/assets/app-de-help.webp" width="720" height="1566" loading="lazy" decoding="async" alt="Demenz Coach App: Hilfe für eine konkrete Situation"><a class="button" href="${store('seo_de_tricks')}" data-store-link="seo_de_tricks">Kostenlos im App Store</a></div></aside>`;
const situationTilesBlock = (title, tiles, ct) => `<section class="home-situations" aria-labelledby="${ct}-title"><h2 class="home-section-title" id="${ct}-title">${esc(title)}</h2><ul class="e-tiles" role="list">${tiles.map(tile => `<li><a class="e-tile" href="${tile.href}" data-related-link="situation_${tile.key}"><img src="${tile.img}" width="${tile.w}" height="${tile.h}" alt="" loading="lazy" decoding="async"><span>${esc(tile.label)}</span></a></li>`).join('')}</ul></section>`;
const trickTile = trick => `<li><a class="e-tile" href="${detailPath(trick)}" data-related-link="trick_${trick.id}"><img src="${imageOf(trick)}" width="300" height="220" alt="" loading="lazy" decoding="async"><span>${esc(trick.title)}</span></a></li>`;
const trickTilesBlock = (title, tricks, id) => `<section class="home-situations" aria-labelledby="${id}-title"><h2 class="home-section-title" id="${id}-title">${esc(title)}</h2><ul class="e-tiles" role="list">${tricks.map(trickTile).join('')}</ul></section>`;
const endlessTricks = (tricks) => `<div class="e-moments-block e-tiles-block e-tiles-more-block"><h2 class="e-moments-title" id="e-tiles-more-title">Weitere Alltagstricks</h2><ul class="e-tiles" id="e-tiles" role="list" aria-labelledby="e-tiles-more-title">${tricks.map(trickTile).join('')}</ul><div id="e-tiles-end" aria-hidden="true"></div></div>`;
const faqHTML = faq => faq.map(item => `<h3>${esc(item.q)}</h3><p>${esc(item.a)}</p>`).join('');
const listHTML = (items, tag = 'ul', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''}>${items.map(item => `<li>${esc(item)}</li>`).join('')}</${tag}>`;
const sourcesBlock = entries => `<section class="tricks-sources-block" aria-label="Zum Weiterlesen"><h2>Zum Weiterlesen</h2><ul>${entries.map(source => `<li><a href="${esc(source.url)}" rel="noopener">${esc(source.label)}</a></li>`).join('')}</ul><p class="article-meta">Weiterführende Informationen zur Einordnung. Die Organisationen sind nicht mit Demenz Coach verbunden.</p></section>`;
const howFooter = `<section class="section translator-how" aria-label="Hinweise"><div class="container content-narrow"><p class="article-meta">Quellenstand: <time datetime="${references.checkedAt}">9. November 2026</time> · <a href="/de/ratgeber/redaktion.html">Redaktionelle Leitlinien</a> · Anbieterin: <a href="/impressum.html">Deborah Frey</a></p></div></section>`;
const wrap = (inner, extra = '') => `  <main id="main">
    <section id="top" class="e-hero e-home" aria-labelledby="home-title">
      <div class="e-wrap">
        <div class="home-intro"><p id="home-title" hidden>Alltagstricks bei Demenz</p></div>
        <div class="translator-result">
${inner}
        </div>
${extra}
      </div>
    </section>
    ${howFooter}
  </main>
`;

const organization = { '@type': 'Organization', '@id': 'https://dementiacoachapp.com/#organization', name: 'Demenz Coach', url: 'https://dementiacoachapp.com/' };
const crumbs = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, item], index) => ({ '@type': 'ListItem', position: index + 1, name, item })) });
const faqSchema = (pageURL, faq) => ({ '@type': 'FAQPage', '@id': `${pageURL}#faq`, inLanguage: 'de', mainEntity: faq.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) });

const categories = Object.entries(data.categories);
const title = `Alltagstricks bei Demenz: ${data.tricks.length} kleine Hilfen mit Bildern | Demenz Coach`;
const description = `Roter Teller, Bild an der Toilettentür, Tafel für den Tag: ${data.tricks.length} einfache Alltagstricks für Angehörige von Menschen mit Demenz, jeder mit Zeichnung.`;
const sourceLink = id => {
  const source = references.sources[id];
  if (!source) throw new Error(`Unknown source ${id}`);
  return `<a href="${esc(source.url)}" rel="noopener">${esc(source.label)}</a>`;
};
const groupSources = (key, name) => `<details class="tricks-sources"><summary>Quellen zum Thema ${esc(name)}</summary><ul>${references.categories[key].map(id => `<li>${sourceLink(id)}</li>`).join('')}</ul><p>Weiterführende Informationen zur Einordnung. Die Organisationen sind nicht mit Demenz Coach verbunden.</p></details>`;

// Karte wie unter „Das kannst du tun“ im Übersetzer
const card = (t) => {
  const tile = tilesFor(t)[0];
  return `
            <article class="translator-trick" id="${t.id}">
              <img class="translator-trick-art" src="${imageOf(t)}" width="300" height="220" loading="lazy" decoding="async" alt="">
              <div class="translator-trick-text">
                <h3 class="translator-trick-title">${esc(t.title)}</h3>
                <p>${esc(t.text)}</p>${t.source ? `<p class="article-meta">Zum Weiterlesen: ${sourceLink(t.source)}</p>` : ''}
                <a class="text-link translator-trick-link" href="${detailPath(t)}" data-tip-detail="${t.id}">Trick ansehen →</a>${tile ? `
                <a class="text-link translator-trick-link" href="${tile.href}" data-related-link="trick-${t.id}-${tile.key}">${esc(tile.label)}</a>` : ''}
              </div>
            </article>`;
};
const sections = categories.map(([key, name]) => {
  const tricks = data.tricks.filter((t) => t.category === key);
  return `
          <section class="tricks-group" id="${key}" aria-labelledby="${key}-title">
            <h2 class="translator-step" id="${key}-title">${esc(name)}</h2>
            ${references.notes[key] ? `<p class="tricks-safety">${esc(references.notes[key])}</p>` : ''}
            ${groupSources(key, name)}${tricks.map(card).join('')}
          </section>`;
}).join('');

const overviewFaq = [
  { q: 'Was sind Alltagstricks bei Demenz?', a: 'Alltagstricks sind kleine, einfache Veränderungen im Alltag. Zum Beispiel ein Teller, der sich vom Tisch abhebt, ein Bild an der Toilettentür oder ein festes Abendritual. Sie sind Angebote zum Ausprobieren, keine Behandlung.' },
  { q: 'Wie probiere ich einen Alltagstrick aus?', a: 'Wähle einen Trick, der zur Situation passt. Probiere ihn in Ruhe aus und beobachte, wie die Person reagiert. Wenn es ihr gefällt, behaltet ihr es bei. Wenn nicht, lass es und probiere später etwas anderes.' },
  { q: 'Was mache ich, wenn die Person einen Trick ablehnt?', a: 'Dränge nicht und erkläre nicht lange. Lass den Trick weg und warte einen anderen Moment ab. Manchmal passt ein anderer Trick besser. Die Wünsche der Person gehen vor.' },
  { q: 'Ersetzen die Tricks ärztlichen oder pflegerischen Rat?', a: 'Nein. Die Tricks sind allgemeine Alltagshinweise ohne Gewähr. Bei gesundheitlichen Fragen, Schluckproblemen oder besonderen Vorgaben fragst du das Behandlungsteam. Bei Gefahr rufst du den Notruf 112.' },
];
const overviewSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Article', '@id': `${url}#content`, headline: 'Alltagstricks bei Demenz', description, inLanguage: 'de', isAccessibleForFree: true, datePublished: '2026-11-08', dateModified: references.checkedAt,
      author: { '@id': organization['@id'] }, publisher: { '@id': organization['@id'] }, image: 'https://dementiacoachapp.com/alltagstricks/img/illu-plate-red.webp',
      citation: Object.values(references.sources).map(source => source.url) },
    { '@type': 'ItemList', '@id': `${url}#tricks`, name: 'Alltagstricks bei Demenz', numberOfItems: data.tricks.length,
      itemListElement: data.tricks.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.title, url: `https://dementiacoachapp.com${detailPath(t)}` })) },
    crumbs([['Start', 'https://dementiacoachapp.com/de/'], ['Alltagstricks', url]]),
    faqSchema(url, overviewFaq),
    organization,
  ],
};
const overviewPage = ({ pageURL = url, pageTitle = title, pageDescription = description, schema: pageSchema = overviewSchema, slug = 'alltagstricks', label = 'Kleine Hilfen für jeden Tag',
  heading = 'Alltagstricks', image = '/alltagstricks/img/illu-plate-red.webp', intro, jump, content, extraHead = '' }) => {
  const inner = `          ${said(label, heading, image)}
          <div class="translator-answer tricks-answer">${intro}</div>
          ${jump}
          <div class="translator-answer tricks-answer">${content}
          </div>
          ${planCta({ key: '', src: 'tricks', heading: 'Welcher Trick passt zu euch?', text: 'In der persönlichen Hilfe wählst du die Situation, die dich beschäftigt, und bekommst Satzideen und kleine nächste Schritte.' })}
          ${printOffer}
          ${appCta('Der passende Trick im richtigen Moment', 'Die App zeigt dir zu eurer Situation, was du sagen und tun kannst, und den passenden Trick dazu. Kostenlos laden, Abo nur, wenn du willst.')}`;
  return head({ pageURL, pageTitle, pageDescription, pageImage: `https://dementiacoachapp.com${image}`, pageSchema, slug, extraHead })
    + wrap(inner, `        <section class="e-card situation-more" id="mehr-verstehen" aria-labelledby="mehr-verstehen-title"><h2 id="mehr-verstehen-title">Fragen und Antworten zu Alltagstricks</h2>${faqHTML(overviewFaq)}</section>
        ${situationTilesBlock('Oder wähle eine Situation:', situationTiles.slice(0, 8), 'situationen')}`) + footer;
};

const overviewIntro = `<p class="translator-meaning">${data.tricks.length} Möglichkeiten für euren Alltag. Wähle aus, was die Person möchte und was zu eurer Situation passt. Jeder Trick hat eine eigene Seite mit Schritten, Sätzen zum Sagen und Hinweisen.</p><p class="translator-meaning"><a class="text-link" href="/alltagstricks/essen-trinken.html">Essen und Trinken: sechs Hilfen gezielt auswählen →</a></p>`;
const overviewJump = nextRows({ title: 'Themen', items: categories.map(([key, name]) => [`#${key}`, name]) });
fs.writeFileSync(path.join(root, 'alltagstricks/index.html'), rewriteGermanRouteReferences(overviewPage({ intro: overviewIntro, jump: overviewJump, content: sections }).replace(/[ \t]+$/gm, ''), 'alltagstricks/index.html'));

// Ein kuratierter Einstieg statt einer zweiten vollständigen Kopie der Sammlung.
const topicURL = 'https://dementiacoachapp.com/alltagstricks/essen-trinken.html';
const selectedIDs = new Set(['unterlage-einfarbig', 'gemeinsam-essen', 'essen-beschreiben', 'kleine-portionen', 'becher-farbig', 'anstossen']);
const selected = data.tricks.filter(trick => selectedIDs.has(trick.id));
if (selected.length !== selectedIDs.size) throw new Error('Missing food topic selection');
const topicTitle = 'Essen und Trinken bei Demenz: 6 Alltagshilfen | Demenz Coach';
const topicDescription = 'Sechs Möglichkeiten für Mahlzeiten und Getränke bei Demenz: einen übersichtlichen Tisch gestalten, gemeinsam essen und passende Trinkangebote auswählen.';
const topicSchema = structuredClone(overviewSchema);
const topicArticle = topicSchema['@graph'][0];
Object.assign(topicArticle, { '@id': `${topicURL}#content`, headline: 'Essen und Trinken bei Demenz', description: topicDescription, datePublished: '2026-11-09', citation: ['eating', 'drinking'].map(id => references.sources[id].url) });
Object.assign(topicSchema['@graph'][1], { '@id': `${topicURL}#tricks`, name: 'Sechs Alltagshilfen für Essen und Trinken', numberOfItems: selected.length, itemListElement: selected.map((trick, index) => ({ '@type': 'ListItem', position: index + 1, name: trick.title, url: `${topicURL}#${trick.id}` })) });
topicSchema['@graph'][2].itemListElement.push({ '@type': 'ListItem', position: 3, name: 'Essen und Trinken', item: topicURL });
topicSchema['@graph'] = topicSchema['@graph'].filter(node => node['@type'] !== 'FAQPage');
const topicContent = ['essen', 'trinken'].map(key => `<section class="tricks-group" id="${key}" aria-labelledby="${key}-title"><h2 class="translator-step" id="${key}-title">${esc(data.categories[key])}</h2><p class="tricks-safety">${esc(references.notes[key])}</p>${selected.filter(trick => trick.category === key).map(card).join('')}${groupSources(key, data.categories[key])}</section>`).join('');
const choices = [
  ['unterlage-einfarbig', 'Tisch übersichtlicher machen', 'Weniger Dinge und Muster'],
  ['gemeinsam-essen', 'Gemeinsam essen', 'Zusammen am Tisch sitzen'],
  ['becher-farbig', 'Getränke gut erkennen', 'Ein gut erkennbares Gefäß anbieten'],
].map(([id, label, detail]) => {
  const trick = selected.find(item => item.id === id);
  return `<li><a class="food-choice" href="${detailPath(trick)}"><img src="${imageOf(trick)}" width="300" height="220" alt="" decoding="async"><span class="food-choice-copy"><strong>${label}</strong><span>${detail}</span></span><span class="food-choice-arrow" aria-hidden="true">→</span></a></li>`;
}).join('');
const topicIntro = `<p class="translator-meaning food-lead">Sechs kleine Hilfen. Beginne mit einer Veränderung, die die Person möchte.</p><section class="food-choices" aria-labelledby="auswahl-title"><h2 id="auswahl-title">Womit möchtest du anfangen?</h2><ul>${choices}</ul></section><aside class="food-care-note" aria-labelledby="food-care-title"><h2 id="food-care-title">Bitte beachten</h2><p>Bei bekannten Kau- oder Schluckproblemen oder individuellen Ernährungsvorgaben frage vor Änderungen das Behandlungsteam. Diese Seite gibt allgemeine Alltagshinweise und ersetzt keine individuelle Beratung.</p></aside><details class="food-context"><summary>Eine Idee in Ruhe ausprobieren</summary><p>Beobachte, ob das Angebot angenehm ist. Wenn es nicht passt, höre auf und probiere später etwas anderes. Vorlieben, vertraute Abläufe und die Selbstständigkeit der Person stehen im Mittelpunkt.</p></details>`;
fs.writeFileSync(path.join(root, 'alltagstricks/essen-trinken.html'), rewriteGermanRouteReferences(overviewPage({
  pageURL: topicURL, pageTitle: topicTitle, pageDescription: topicDescription, schema: topicSchema, slug: 'essen-trinken', label: 'Sechs Alltagshilfen', heading: 'Essen und Trinken bei Demenz',
  image: '/alltagstricks/img/illu-plate-red.webp', intro: topicIntro, jump: nextRows({ title: 'Die sechs Ideen', items: [['#essen', 'Beim Essen'], ['#trinken', 'Beim Trinken'], ['/alltagstricks/', 'Alle Alltagstricks']] }),
  content: topicContent, extraHead: '\n  <link rel="stylesheet" href="/alltagstricks/essen-trinken.css">',
}).replace(/[ \t]+$/gm, ''), 'alltagstricks/essen-trinken.html'));

// Jeder Trick bekommt eine eigene, direkt ladbare Seite.
const order = data.tricks.map(trick => trick.id);
for (const trick of data.tricks) {
  const tip = reviewedFor(trick), pageURL = `https://dementiacoachapp.com${detailPath(trick)}`;
  const more = extended[trick.id];
  if (!more) throw new Error(`Missing extended content for ${trick.id}`);
  for (const field of ['why', 'steps', 'say', 'watch', 'stop', 'faq', 'meta']) if (!more[field] || (Array.isArray(more[field]) && !more[field].length)) throw new Error(`Missing ${field} for ${trick.id}`);
  const categoryName = data.categories[trick.category];
  const notes = [...new Set([references.notes[trick.category], tip && ['essen', 'trinken'].includes(trick.category) ? reviewed.note : ''].filter(Boolean))];
  const sourceEntries = tip ? tip.sources.map(id => reviewed.sources[id]) : (trick.source ? [references.sources[trick.source]] : references.categories[trick.category].map(id => references.sources[id]));
  if (sourceEntries.some(source => !source)) throw new Error(`Missing sources for ${trick.id}`);
  const image = imageOf(trick);
  const tiles = tilesFor(trick);
  const sameCategory = data.tricks.filter(other => other.category === trick.category && other.id !== trick.id);
  const index = order.indexOf(trick.id);
  const sibling = sameCategory.find(other => order.indexOf(other.id) > index) || sameCategory[0];
  const feed = [...data.tricks.slice(index + 1), ...data.tricks.slice(0, index)].filter(other => other.category !== trick.category || !sameCategory.slice(0, 6).includes(other)).slice(0, 30);
  const guide = guides[trick.category];
  const faq = more.faq;
  const detailTitle = `${trick.title} bei Demenz: Alltagstipp | Demenz Coach`;
  const detailSchema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', '@id': `${pageURL}#content`, headline: trick.title, description: more.meta, inLanguage: 'de', isAccessibleForFree: true, datePublished: '2026-11-08', dateModified: references.checkedAt,
      author: { '@id': organization['@id'] }, publisher: { '@id': organization['@id'] }, image: `https://dementiacoachapp.com${image}`, mainEntityOfPage: pageURL, citation: sourceEntries.map(source => source.url) },
    crumbs([['Start', 'https://dementiacoachapp.com/de/'], ['Alltagstricks', url], [categoryName, `${url}#${trick.category}`], [trick.title, pageURL]]),
    faqSchema(pageURL, faq), organization ] };
  const rows = { title: 'Mehr zu diesem Trick', items: [
    ...tiles.slice(0, 2).map(tile => [tile.href, tile.label, ` data-related-link="tip-${trick.id}-${tile.key}"`]),
    ...(sibling ? [[detailPath(sibling), sibling.title, ` data-related-link="tip-${trick.id}-next"`]] : []),
    [`/alltagstricks/#${trick.category}`, `Alle Tricks: ${categoryName}`],
    ['/de/', 'Eigene Situation beschreiben'],
  ] };
  const inner = `          ${said(`Alltagstrick · ${categoryName}`, esc(trick.title), image)}
          <div class="translator-answer tricks-answer">
            <p class="translator-goal-chosen">Dein Ziel: ${esc(goals[trick.category])}</p>
            <h3 class="translator-step">So geht’s</h3>
            <p class="translator-meaning translator-do">${esc(trick.text)}</p>
            ${listHTML(more.steps, 'ol', 'trick-steps')}
            <img class="translator-scene-art trick-scene-art" src="${image}" alt="" width="300" height="220" decoding="async">
            <h3 class="translator-step">Das kannst du dazu sagen</h3>
            <div class="translator-phrases">${more.say.map(line => `<div class="translator-phrase"><q>${esc(line.replace(/^[„“"]|[“”"]$/g, ''))}</q></div>`).join('')}</div>
            <h3 class="translator-step">Warum das helfen kann</h3>
            <p class="translator-meaning">${esc(more.why)}</p>
            ${notes.map(note => `<p class="tricks-safety">${esc(note)}</p>`).join('')}
          </div>
          ${nextRows(rows)}
          ${planCta({ key: tiles[0]?.key || '', src: 'trick', heading: 'Und wenn dieser Moment wiederkommt?', text: 'Passende Worte und nächste Schritte für schwierige Alltagssituationen. Wähle, wobei du Unterstützung brauchst.' })}
          ${printOffer}
          ${appCta('Der passende Trick im richtigen Moment', 'Die App zeigt dir zu eurer Situation, was du sagen und tun kannst, und den passenden Trick dazu. Kostenlos laden, Abo nur, wenn du willst.')}`;
  const extra = `        <section class="e-card situation-more" id="mehr-verstehen" aria-labelledby="mehr-verstehen-title">
          <h2 id="mehr-verstehen-title">Mehr zu „${esc(trick.title)}“</h2>
          <h3>Worauf du achten kannst</h3>${listHTML(more.watch)}
          <h3>Wenn es nicht passt</h3><p>${esc(more.stop)}</p>
          ${faqHTML(faq)}
          ${guide ? `<p class="situation-more-guide">Ausführlich im Ratgeber: <a class="text-link" href="${guide[0]}">${esc(guide[1])}</a></p>` : ''}
        </section>
        ${sourcesBlock(sourceEntries)}
        ${tiles.length ? situationTilesBlock('Dazu passen diese Situationen', tiles, 'situationen') : ''}
        ${trickTilesBlock(`Mehr Tricks: ${categoryName}`, sameCategory.slice(0, 6), 'gleiches-thema')}
        ${endlessTricks(feed)}`;
  const html = head({ pageURL, pageTitle: detailTitle, pageDescription: more.meta, pageImage: `https://dementiacoachapp.com${image}`, pageSchema: detailSchema, slug: `tip-${trick.id}` }) + wrap(inner, extra) + footer;
  const relative = detailPath(trick).slice(1);
  fs.writeFileSync(path.join(root, relative), rewriteGermanRouteReferences(html.replace(/[ \t]+$/gm, ''), relative));
}
// Upgrade only known legacy tip anchors, including dynamically rendered cross-promotions.
const routes = Object.fromEntries(data.tricks.map(trick => [trick.id, detailPath(trick)]));
for (const tip of reviewed.tips) routes[tip.id] = detailPath(data.tricks.find(trick => reviewedFor(trick)?.id === tip.id));
fs.writeFileSync(path.join(root, 'alltagstricks/detail-links.js'), `// Generated by build-alltagstricks.mjs; known own-site tip links only.\nexport const tipDetailRoutes = Object.freeze(${JSON.stringify(routes)});\nexport function tipDetailHref(value, origin = location.origin) {\n  let url; try { url = new URL(value, origin); } catch { return null; }\n  if (![origin, 'https://dementiacoachapp.com'].includes(url.origin) || url.pathname !== '/alltagstricks/' || url.search) return null;\n  const key = url.hash.slice(1);\n  return Object.prototype.hasOwnProperty.call(tipDetailRoutes, key) ? tipDetailRoutes[key] : null;\n}\nexport function enhanceTipLinks(root = document) {\n  const links = [...(root.matches?.('a[href]') ? [root] : []), ...root.querySelectorAll('a[href]')];\n  for (const link of links) { const target = tipDetailHref(link.getAttribute('href')); if (target) link.setAttribute('href', target); }\n}\nif (typeof document !== 'undefined') {\n  const start = () => { enhanceTipLinks(); new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) enhanceTipLinks(node); }).observe(document.body, { childList: true, subtree: true }); };\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();\n}\n`);
const sitemapPath = path.join(root, "sitemap.xml");
let sitemap = fs.readFileSync(sitemapPath, "utf8");
for (const pageURL of [url, topicURL, ...detailURLs]) {
if (!sitemap.includes(`<loc>${pageURL}</loc>`)) {
  sitemap = sitemap.replace("</urlset>", `  <url>
    <loc>${pageURL}</loc>
    <xhtml:link rel="alternate" hreflang="de" href="${pageURL}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${pageURL}"/>
  </url>
</urlset>`);
  fs.writeFileSync(sitemapPath, sitemap);
}
}
console.log(`Alltagstricks: ${data.tricks.length} entries with topic sources; Essen/Trinken: ${selected.length} curated entries.`);
