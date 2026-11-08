// Baut /alltagstricks/ aus alltagstricks/tricks.json (Kopie von dementia/Design/care-tricks.json, dieselbe Liste wie in der App).
// Aufruf: node scripts/build-alltagstricks.mjs .   (danach node scripts/validate-seo.mjs .)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const data = JSON.parse(fs.readFileSync(path.join(root, "alltagstricks/tricks.json"), "utf8"));
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
                <p>${esc(t.text)}</p>${links.join("")}
              </div>
            </article>`;
};

const sections = categories.map(([key, name]) => {
  const tricks = data.tricks.filter((t) => t.category === key);
  return `
          <section class="tricks-group" id="${key}" aria-labelledby="${key}-title">
            <h2 class="translator-step" id="${key}-title">${esc(name)}</h2>${tricks.map(card).join("")}
          </section>`;
}).join("");

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Article", "@id": `${url}#content`, headline: "Alltagstricks bei Demenz", description, inLanguage: "de",
      isAccessibleForFree: true, datePublished: "2026-11-08", dateModified: "2026-11-08",
      author: { "@id": "https://dementiacoachapp.com/#organization" }, publisher: { "@id": "https://dementiacoachapp.com/#organization" },
      image: `https://dementiacoachapp.com/alltagstricks/img/illu-plate-red.webp`,
      citation: ["https://www.deutsche-alzheimer.de/mit-demenz-leben/umgang-und-kommunikation", "https://www.wegweiser-demenz.de/"] },
    { "@type": "ItemList", "@id": `${url}#tricks`, name: "Alltagstricks bei Demenz", numberOfItems: data.tricks.length,
      itemListElement: data.tricks.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.title, url: `${url}#${t.id}` })) },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Start", item: "https://dementiacoachapp.com/" },
      { "@type": "ListItem", position: 2, name: "Alltagstricks", item: url }] },
    { "@type": "Organization", "@id": "https://dementiacoachapp.com/#organization", name: "Demenz Coach", url: "https://dementiacoachapp.com/" },
  ],
};

const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="#f6f5f2">
  <meta name="apple-itunes-app" content="app-id=6790763941">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Demenz Coach">
  <meta property="og:locale" content="de_DE">
  <meta property="og:title" content="Alltagstricks bei Demenz">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://dementiacoachapp.com/assets/og-teller.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <title>${esc(title)}</title>
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="de" href="${url}">
  <link rel="alternate" hreflang="x-default" href="${url}">
  <link rel="icon" type="image/png" sizes="192x192" href="../assets/favicon-192.png">
  <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
  <link rel="manifest" href="../site.webmanifest">
  <link rel="stylesheet" href="../translator.css">
  <link rel="stylesheet" href="../einfach.css">
  <style>
    body.einfach .tricks-group { scroll-margin-top: 16px; }
    body.einfach .tricks-group + .tricks-group { margin-top: 32px; }
    body.einfach .translator-trick { scroll-margin-top: 16px; }
    body.einfach h3.translator-trick-title { margin: 0 0 6px; font-size: var(--e-size, 1.0625rem) !important; line-height: 1.35; }
    body.einfach .translator-trick-link { display: block; }
    body.einfach .translator-trick:target { border-color: var(--e-purple); box-shadow: 0 0 0 2px var(--e-purple); }
    body.einfach .tricks-jump { margin: 24px 0 8px; }
  </style>
  <script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>
</head>
<body class="einfach" data-page-type="translator-tool" data-page-language="de" data-page-slug="alltagstricks">
  <a class="skip-link" href="#main">Zum Inhalt springen</a>
  <header class="e-header">
    <div class="e-wrap">
      <a class="e-brand" href="/" aria-label="Demenz Coach Startseite"><img src="/assets/lovable-logo.jpg" width="40" height="40" alt=""><span>Demenz Coach</span></a>
      <nav aria-label="Hauptnavigation"><a href="${store("seo_de_tricks_nav")}" data-store-link="seo-de-tricks-nav">Zur App</a></nav>
    </div>
  </header>
  <main id="main" class="content-main">
    <section class="content-hero translator-hero">
      <div class="container content-narrow">
        <h1>Alltagstricks<span class="translator-h1-sub"><span class="translator-h1-dash">: </span>Kleine Hilfen für jeden Tag</span></h1>
        <p>${data.tricks.length} einfache Tricks, die viele Familien nutzen. Probiere aus, was zu euch passt.</p>
        <div class="translator-next tricks-jump">
          <p class="translator-next-title">Themen</p>
          <nav class="translator-next-rows" aria-label="Themen">${categories.map(([k, n]) => `
            <a class="translator-copy" href="#${k}">${esc(n)}</a>`).join("")}
          </nav>
        </div>
        <div class="translator-result">
          <div class="translator-answer">${sections}
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
        <p class="article-meta">Aktualisiert: <time datetime="2026-11-08">8. November 2026</time> · <a href="/ratgeber/redaktion.html">Demenz Coach Redaktion</a> · Quellen: <a href="https://www.deutsche-alzheimer.de/mit-demenz-leben/umgang-und-kommunikation" rel="noopener">Deutsche Alzheimer Gesellschaft</a>, <a href="https://www.wegweiser-demenz.de/" rel="noopener">Wegweiser Demenz</a></p>
      </div>
    </section>
  </main>
  <footer class="e-footer">
    <div class="e-wrap">
      <nav aria-label="Weitere Seiten">
        <a href="/demenz-uebersetzer/">Demenz-Übersetzer</a>
        <a href="/ratgeber/">Ratgeber</a>
        <a href="/impressum.html">Impressum</a>
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
`;
fs.writeFileSync(path.join(root, "alltagstricks/index.html"), html);

const sitemapPath = path.join(root, "sitemap.xml");
let sitemap = fs.readFileSync(sitemapPath, "utf8");
if (!sitemap.includes(`<loc>${url}</loc>`)) {
  sitemap = sitemap.replace("</urlset>", `  <url>
    <loc>${url}</loc>
    <xhtml:link rel="alternate" hreflang="de" href="${url}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${url}"/>
  </url>
</urlset>`);
  fs.writeFileSync(sitemapPath, sitemap);
}
console.log(`alltagstricks/index.html: ${data.tricks.length} tricks`);
