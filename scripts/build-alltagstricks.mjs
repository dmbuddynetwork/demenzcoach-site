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
const url = "https://dementiacoachapp.com/alltagstricks/";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Situation der App -> passende Seite des Demenz-Übersetzers (Trick und Situation verlinken sich gegenseitig).
const pages = {
  wash: ["ich-will-nicht-duschen", "„Ich will nicht duschen.“"],
  dress: ["ich-ziehe-mich-nicht-um", "„Ich ziehe mich nicht um.“"],
  work: ["ich-muss-zur-arbeit", "„Ich muss zur Arbeit.“"],
  car: ["ich-will-auto-fahren", "„Ich will Auto fahren.“"],
  daycare: ["ich-gehe-nicht-in-die-tagespflege", "„Ich gehe nicht in die Tagespflege.“"],
  getup: ["ich-bleibe-heute-im-bett", "„Ich bleibe heute im Bett.“"],
  night: ["ich-muss-aufstehen-nachts", "Nachts aufstehen"],
  accuse: ["du-hast-mein-geld-gestohlen", "„Du hast mein Geld gestohlen.“"],
  jealous: ["du-hast-einen-anderen", "„Du hast einen anderen.“"],
  sunset: ["da-ist-jemand-im-zimmer", "„Da ist jemand im Zimmer.“"],
  leave: ["es-wird-dunkel-ich-muss-los", "„Es wird dunkel, ich muss los.“"],
  evening: ["es-wird-dunkel-ich-muss-los", "„Es wird dunkel, ich muss los.“"],
  recognize: ["wer-sind-sie", "„Wer sind Sie?“"],
  dead: ["wo-ist-meine-mutter", "„Wo ist meine Mutter?“"],
  child: ["wo-sind-meine-kinder", "„Wo sind meine Kinder?“"],
  repeat: ["wann-gehen-wir", "„Wann gehen wir?“"],
  anger: ["lass-mich-in-ruhe", "„Lass mich in Ruhe!“"],
  follow: ["lass-mich-nicht-allein", "„Lass mich nicht allein.“"],
  eat: ["ich-habe-schon-gegessen", "„Ich habe schon gegessen.“"],
  bathroom: ["ich-muss-nicht-aufs-klo", "„Ich muss nicht aufs Klo.“"],
};
for (const [slug] of Object.values(pages)) {
  if (!fs.existsSync(path.join(root, "demenz-uebersetzer", `${slug}.html`))) throw new Error(`missing page ${slug}`);
}

const store = (ct) => `https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&amp;ct=${ct}&amp;mt=8`;
const categories = Object.entries(data.categories);
const title = `Alltagstricks bei Demenz: ${data.tricks.length} kleine Hilfen mit Bildern | Demenz Coach`;
const description = `Roter Teller, Bild an der Toilettentür, Tafel für den Tag: ${data.tricks.length} einfache Alltagstricks für Angehörige von Menschen mit Demenz, jeder mit Zeichnung.`;
const sourceLink = id => {
  const source = references.sources[id];
  if (!source) throw new Error(`Unknown source ${id}`);
  return `<a href="${esc(source.url)}" rel="noopener">${esc(source.label)}</a>`;
};
const groupSources = (key, name) => `<details class="tricks-sources"><summary>Quellen zum Thema ${esc(name)}</summary><ul>${references.categories[key].map(id => `<li>${sourceLink(id)}</li>`).join("")}</ul><p>Weiterführende Informationen zur Einordnung. Die Organisationen sind nicht mit Demenz Coach verbunden.</p></details>`;

// Gleiches Aussehen wie die Ergebnisseite des Übersetzers (Daniel, 8. Nov 17:01: „soll wie eine Seite wirken“):
// dieselbe Trick-Karte wie unter „Das kannst du tun“, Themen als Überschriften wie „Das kannst du sagen“,
// Sprungliste wie „Mehr zu dieser Situation“.
const card = (t) => {
  const links = [...new Set(t.situations.filter((s) => pages[s]).map((s) => pages[s][0]))].slice(0, 1)
    .map((slug) => {
      const label = Object.values(pages).find(([s]) => s === slug)[1];
      return `
                <a class="text-link translator-trick-link" href="../demenz-uebersetzer/${slug}.html" data-related-link="trick-${t.id}-${slug}">${esc(label)}</a>`;
    });
  return `
            <article class="translator-trick" id="${t.id}">
              <img class="translator-trick-art" src="img/${t.drawing}.webp" width="300" height="220" loading="lazy" decoding="async" alt="">
              <div class="translator-trick-text">
                <h3 class="translator-trick-title">${esc(t.title)}</h3>
                <p>${esc(t.text)}</p>${t.source ? `<p class="article-meta">Zum Weiterlesen: ${sourceLink(t.source)}</p>` : ""}${links.join("")}
              </div>
            </article>`;
};

const sections = categories.map(([key, name]) => {
  const tricks = data.tricks.filter((t) => t.category === key);
  return `
          <section class="tricks-group" id="${key}" aria-labelledby="${key}-title">
            <h2 class="translator-step" id="${key}-title">${esc(name)}</h2>
            ${references.notes[key] ? `<p class="tricks-safety">${esc(references.notes[key])}</p>` : ""}
            ${groupSources(key, name)}${tricks.map(card).join("")}
          </section>`;
}).join("");

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Article", "@id": `${url}#content`, headline: "Alltagstricks bei Demenz", description, inLanguage: "de",
      isAccessibleForFree: true, datePublished: "2026-11-08", dateModified: references.checkedAt,
      author: { "@id": "https://dementiacoachapp.com/#organization" }, publisher: { "@id": "https://dementiacoachapp.com/#organization" },
      image: `https://dementiacoachapp.com/alltagstricks/img/illu-plate-red.webp`,
      citation: Object.values(references.sources).map(source => source.url) },
    { "@type": "ItemList", "@id": `${url}#tricks`, name: "Alltagstricks bei Demenz", numberOfItems: data.tricks.length,
      itemListElement: data.tricks.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.title, url: `${url}#${t.id}` })) },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Start", item: "https://dementiacoachapp.com/de/" },
      { "@type": "ListItem", position: 2, name: "Alltagstricks", item: url }] },
    { "@type": "Organization", "@id": "https://dementiacoachapp.com/#organization", name: "Demenz Coach", url: "https://dementiacoachapp.com/" },
  ],
};

const overviewHeading = 'Alltagstricks<span class="translator-h1-sub"><span class="translator-h1-dash">: </span>Kleine Hilfen für jeden Tag</span>';
const overviewIntro = `<p>${data.tricks.length} Möglichkeiten für euren Alltag. Wähle aus, was die Person möchte und was zu eurer Situation passt.</p><p><a href="/alltagstricks/essen-trinken.html">Essen und Trinken: sechs Hilfen gezielt auswählen →</a></p>`;
const navigation = categories.map(([key, name]) => `<a class="translator-copy" href="#${key}">${esc(name)}</a>`).join("");
const renderPage = ({ pageURL = url, pageTitle = title, pageDescription = description,
  headline = overviewHeading, intro = overviewIntro, jumpLinks = navigation, content = sections,
  pageSchema = schema, slug = "alltagstricks", breadcrumb = '<a href="/de/">Startseite</a> › Alltagstricks',
  extraStyles = "", jumpTitle = "Themen", brandName = "Demenz Coach" } = {}) => `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${esc(pageDescription)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="#f6f5f2">
  <meta name="apple-itunes-app" content="app-id=6790763941">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Demenz Coach">
  <meta property="og:locale" content="de_DE">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(pageDescription)}">
  <meta property="og:url" content="${pageURL}">
  <meta property="og:image" content="https://dementiacoachapp.com/assets/og-teller.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <title>${esc(pageTitle)}</title>
  <link rel="canonical" href="${pageURL}">
  <link rel="alternate" hreflang="de" href="${pageURL}">
  <link rel="alternate" hreflang="x-default" href="${pageURL}">
  <link rel="icon" type="image/png" sizes="192x192" href="../assets/favicon-192.png">
  <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
  <link rel="manifest" href="../site.webmanifest">
  <link rel="stylesheet" href="../translator.css">
  <link rel="stylesheet" href="../einfach.css">${extraStyles}
  <style>
    body.einfach .tricks-group { scroll-margin-top: 16px; }
    body.einfach .tricks-group + .tricks-group { margin-top: 32px; }
    body.einfach .translator-trick { scroll-margin-top: 16px; }
    body.einfach h3.translator-trick-title { margin: 0 0 6px; font-size: var(--e-size, 1.0625rem) !important; line-height: 1.35; }
    body.einfach .translator-trick-link { display: block; }
    body.einfach .translator-trick:target { border-color: var(--e-purple); box-shadow: 0 0 0 2px var(--e-purple); }
    body.einfach .tricks-jump { margin: 24px 0 8px; }
  </style>
  <script type="application/ld+json">${JSON.stringify(pageSchema, null, 2)}</script>
</head>
<body class="einfach" data-page-type="translator-tool" data-page-language="de" data-page-slug="${slug}">
  <a class="skip-link" href="#main">Zum Inhalt springen</a>
  <header class="e-header">
    <div class="e-wrap">
      <a class="e-brand" href="/de/" aria-label="${brandName} Startseite"><img src="/assets/lovable-logo.jpg" width="40" height="40" alt=""><span>${brandName}</span></a>
      <nav aria-label="Hauptnavigation"><a href="${store("seo_de_tricks_nav")}" data-store-link="seo-de-tricks-nav">Zur App</a></nav>
    </div>
  </header>
  <main id="main" class="content-main">
    <section class="content-hero translator-hero">
      <div class="container content-narrow">
        <nav aria-label="Brotkrumen">${breadcrumb}</nav>
        <h1>${headline}</h1>
        <div class="tricks-intro">${intro}</div>
        <div class="translator-next tricks-jump">
          <p class="translator-next-title">${jumpTitle}</p>
          <nav class="translator-next-rows" aria-label="${jumpTitle}">${jumpLinks}
          </nav>
        </div>
        <div class="translator-result">
          <div class="translator-answer">${content}
          </div>
          <div class="translator-result-links">
            <a class="translator-copy" href="/demenz-uebersetzer/" data-related-link="demenz-uebersetzer">Satz übersetzen</a>
          </div>
        </div>
      </div>
    </section>
    <section class="section translator-how" aria-label="App">
      <div class="container content-narrow">
        <aside class="article-cta translator-static-cta">
          <div>
            <span class="eyebrow">Demenz Coach für iPhone</span>
            <h2>Der passende Trick im richtigen Moment</h2>
            <p>Die App zeigt dir zu eurer Situation, was du sagen und tun kannst, und den passenden Trick dazu.</p>
          </div>
          <a class="button" href="${store("seo_de_tricks")}" data-store-link="seo_de_tricks">Kostenlos im App Store</a>
        </aside>
        <p class="article-meta">Quellenstand: <time datetime="${references.checkedAt}">9. November 2026</time> · <a href="/ratgeber/redaktion.html">Redaktionelle Leitlinien</a> · Anbieterin: <a href="/impressum.html">Deborah Frey</a></p>
      </div>
    </section>
  </main>
  <footer class="e-footer">
    <div class="e-wrap">
      <nav aria-label="Weitere Seiten">
        <a href="/demenz-uebersetzer/">Demenz-Übersetzer</a>
        <a href="/ratgeber/">Ratgeber</a>
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
</body>
</html>
`.replace(/[ \t]+$/gm, '');
fs.writeFileSync(path.join(root, "alltagstricks/index.html"), rewriteGermanRouteReferences(renderPage(), "alltagstricks/index.html"));

// Ein kuratierter Einstieg statt einer zweiten vollständigen Kopie der Sammlung.
const topicURL = 'https://dementiacoachapp.com/alltagstricks/essen-trinken.html';
const selectedIDs = new Set(['unterlage-einfarbig', 'gemeinsam-essen', 'essen-beschreiben', 'kleine-portionen', 'becher-farbig', 'anstossen']);
const selected = data.tricks.filter(trick => selectedIDs.has(trick.id));
if (selected.length !== selectedIDs.size) throw new Error('Missing food topic selection');
const topicTitle = 'Essen und Trinken bei Demenz: 6 Alltagshilfen | Demenz Coach';
const topicDescription = 'Sechs Möglichkeiten für Mahlzeiten und Getränke bei Demenz: einen übersichtlichen Tisch gestalten, gemeinsam essen und passende Trinkangebote auswählen.';
const topicSchema = structuredClone(schema);
const article = topicSchema['@graph'][0];
Object.assign(article, { '@id': `${topicURL}#content`, headline: 'Essen und Trinken bei Demenz', description: topicDescription,
  datePublished: '2026-11-09', citation: ['eating', 'drinking'].map(id => references.sources[id].url) });
Object.assign(topicSchema['@graph'][1], { '@id': `${topicURL}#tricks`, name: 'Sechs Alltagshilfen für Essen und Trinken',
  numberOfItems: selected.length, itemListElement: selected.map((trick, index) => ({ '@type': 'ListItem', position: index + 1, name: trick.title, url: `${topicURL}#${trick.id}` })) });
topicSchema['@graph'][2].itemListElement.push({ '@type': 'ListItem', position: 3, name: 'Essen und Trinken', item: topicURL });
const topicContent = ['essen', 'trinken'].map(key => `<section class="tricks-group" id="${key}" aria-labelledby="${key}-title"><h2 class="translator-step" id="${key}-title">${esc(data.categories[key])}</h2><p class="tricks-safety">${esc(references.notes[key])}</p>${selected.filter(trick => trick.category === key).map(card).join('')}${groupSources(key, data.categories[key])}</section>`).join('');
const choices = [
  ['unterlage-einfarbig', 'Tisch übersichtlicher machen', 'Weniger Dinge und Muster'],
  ['gemeinsam-essen', 'Gemeinsam essen', 'Zusammen am Tisch sitzen'],
  ['becher-farbig', 'Getränke gut erkennen', 'Ein gut erkennbares Gefäß anbieten'],
].map(([id, label, detail]) => {
  const trick = selected.find(item => item.id === id);
  return `<li><a class="food-choice" href="#${id}"><img src="img/${trick.drawing}.webp" width="300" height="220" alt="" decoding="async"><span class="food-choice-copy"><strong>${label}</strong><span>${detail}</span></span><span class="food-choice-arrow" aria-hidden="true">→</span></a></li>`;
}).join('');
fs.writeFileSync(path.join(root, 'alltagstricks/essen-trinken.html'), rewriteGermanRouteReferences(renderPage({
  pageURL: topicURL, pageTitle: topicTitle, pageDescription: topicDescription, headline: 'Essen und Trinken bei Demenz',
  intro: `<p class="food-lead">Sechs kleine Hilfen. Beginne mit einer Veränderung, die die Person möchte.</p><section class="food-choices" aria-labelledby="auswahl-title"><h2 id="auswahl-title">Womit möchtest du anfangen?</h2><ul>${choices}</ul></section><aside class="food-care-note" aria-labelledby="food-care-title"><h2 id="food-care-title">Bitte beachten</h2><p>Bei bekannten Kau- oder Schluckproblemen oder individuellen Ernährungsvorgaben frage vor Änderungen das Behandlungsteam. Diese Seite gibt allgemeine Alltagshinweise und ersetzt keine individuelle Beratung.</p></aside><details class="food-context"><summary>Eine Idee in Ruhe ausprobieren</summary><p>Beobachte, ob das Angebot angenehm ist. Wenn es nicht passt, höre auf und probiere später etwas anderes. Vorlieben, vertraute Abläufe und die Selbstständigkeit der Person stehen im Mittelpunkt.</p></details>`,
  extraStyles: '\n  <link rel="stylesheet" href="/alltagstricks/essen-trinken.css">', jumpTitle: 'Die sechs Ideen', brandName: 'Demenz Coach App',
  jumpLinks: '<a class="translator-copy" href="#essen">Beim Essen</a><a class="translator-copy" href="#trinken">Beim Trinken</a>',
  content: `${topicContent}<p><a href="/alltagstricks/">Alle Alltagstricks ansehen →</a></p>`, pageSchema: topicSchema, slug: 'essen-trinken',
  breadcrumb: '<a href="/de/">Startseite</a> › <a href="/alltagstricks/">Alltagstricks</a> › Essen und Trinken'
}), "alltagstricks/essen-trinken.html"));

const sitemapPath = path.join(root, "sitemap.xml");
let sitemap = fs.readFileSync(sitemapPath, "utf8");
for (const pageURL of [url, topicURL]) {
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
