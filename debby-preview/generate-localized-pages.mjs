import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const landingRoot = path.join(repoRoot, "landingpage");
const catalogPath = path.join(repoRoot, "DemenzCoach", "Localizable.xcstrings");
const asoPath = path.join(repoRoot, "fastlane", "aso-localizations.json");
const baseURL = "https://dmbuddynetwork.github.io/demenzcoach-site";
const appStoreURL = "https://apps.apple.com/app/id6790763941";
const indexEligibleLanguages = new Set(["de", "en"]);

const languages = [
  { code: "de", nativeName: "Deutsch", menu: "Menü" },
  { code: "en", nativeName: "English", menu: "Menu" },
  { code: "pl", nativeName: "Polski", menu: "Menu" },
  { code: "ro", nativeName: "Română", menu: "Meniu" },
  { code: "bg", nativeName: "Български", menu: "Меню" },
  { code: "hr", nativeName: "Hrvatski", menu: "Izbornik" },
  { code: "sk", nativeName: "Slovenčina", menu: "Ponuka" },
  { code: "hu", nativeName: "Magyar", menu: "Menü" },
  { code: "cs", nativeName: "Čeština", menu: "Nabídka" },
  { code: "uk", nativeName: "Українська", menu: "Меню" },
  { code: "bs", nativeName: "Bosanski", menu: "Meni" },
  { code: "sr", nativeName: "Srpski", menu: "Мени" },
  { code: "lt", nativeName: "Lietuvių", menu: "Meniu" },
  { code: "sl", nativeName: "Slovenščina", menu: "Meni" },
  { code: "lv", nativeName: "Latviešu", menu: "Izvēlne" },
  { code: "et", nativeName: "Eesti", menu: "Menüü" },
  { code: "ru", nativeName: "Русский", menu: "Меню" },
  { code: "tr", nativeName: "Türkçe", menu: "Menü" },
  { code: "ar", nativeName: "العربية", menu: "القائمة", rtl: true },
  { code: "fr", nativeName: "Français", menu: "Menu" },
  { code: "it", nativeName: "Italiano", menu: "Menu" },
  { code: "es", nativeName: "Español", menu: "Menú" },
  { code: "pt", nativeName: "Português", menu: "Menu" },
  { code: "nl", nativeName: "Nederlands", menu: "Menu" },
  { code: "el", nativeName: "Ελληνικά", menu: "Μενού" },
  { code: "sq", nativeName: "Shqip", menu: "Menyja" },
  { code: "fa", nativeName: "فارسی", menu: "منو", rtl: true },
  { code: "th", nativeName: "ไทย", menu: "เมนู" },
  { code: "da", nativeName: "Dansk", menu: "Menu" },
  { code: "fi", nativeName: "Suomi", menu: "Valikko" },
  { code: "ga", nativeName: "Gaeilge", menu: "Roghchlár" },
  { code: "mt", nativeName: "Malti", menu: "Menu" },
  { code: "sv", nativeName: "Svenska", menu: "Meny" }
];

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const aso = JSON.parse(fs.readFileSync(asoPath, "utf8"));
const asoByLanguage = new Map(
  aso.localizations.map((localization) => [localization.app_language, localization])
);

const requiredKeys = [
  "Jetzt im App Store",
  "Soforthilfe, wenn Worte fehlen",
  "Soforthilfe und ein persönlicher 7-Tage-Plan für schwierige Demenz-Momente.",
  "Kommunikationshilfe für pflegende Angehörige von Menschen mit Demenz.",
  "Kein Ersatz für medizinische Beratung oder örtliche Notfallhilfe.",
  "So kann eine konkrete Hilfe aussehen:",
  "Soforthilfe",
  "Lernen",
  "Selbstfürsorge",
  "Sicherheit und Hilfe",
  "Support",
  "Datenschutz",
  "Nutzungsbedingungen",
  "Impressum",
  "Sprachen",
  "Deine Hilfe",
  "Eine kurze Rückfrage",
  "Gespeichert",
  "Wie geht es dir gerade?",
  "Dein persönlicher 7-Tage-Plan",
  "Was ist gerade passiert?",
  "Direkt zur Soforthilfe",
  "Datenschutz & Kontrolle",
  "Hilf uns zu verstehen, welche Funktionen nützlich sind. Es werden keine eingegebenen Situationen, Aufnahmen, gespeicherten Sätze oder Check-in-Inhalte gesendet.",
  "Ohne Analyse fortfahren",
  "Analyse erlauben",
  "Einstellungen",
  "Schließen"
];

const escapeHTML = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&#39;");

const jsonLD = (value) => JSON.stringify(value, null, 2).replaceAll("<", "\\u003c");

const applicationSchema = ({ code, name, description, screenshot }) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MobileApplication",
      "@id": `${baseURL}/#app`,
      "name": name,
      "applicationCategory": "HealthApplication",
      "operatingSystem": "iOS 17.0 or later",
      "description": description,
      "url": appStoreURL,
      "downloadUrl": appStoreURL,
      "installUrl": appStoreURL,
      "inLanguage": code,
      "image": screenshot,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "EUR",
        "availability": "https://schema.org/InStock",
        "url": appStoreURL
      },
      "publisher": { "@id": `${baseURL}/#organization` }
    },
    {
      "@type": "WebSite",
      "@id": `${baseURL}/#website`,
      "url": `${baseURL}/`,
      "name": "Demenz Coach",
      "publisher": { "@id": `${baseURL}/#organization` }
    },
    {
      "@type": "Organization",
      "@id": `${baseURL}/#organization`,
      "name": "Demenz Coach",
      "url": `${baseURL}/`
    }
  ]
});

const fileForLanguage = (code) => {
  if (code === "de") return "index.html";
  return `index-${code}.html`;
};

const urlForLanguage = (code) => {
  const filename = fileForLanguage(code);
  return code === "de" ? `${baseURL}/` : `${baseURL}/${filename}`;
};

const translation = (key, code) => {
  if (code === "de") return key;
  const value = catalog.strings[key]?.localizations?.[code]?.stringUnit?.value;
  if (!value) {
    throw new Error(`Missing ${code} translation for catalog key: ${key}`);
  }
  return value;
};

for (const key of requiredKeys) {
  if (!catalog.strings[key]) throw new Error(`Missing catalog key: ${key}`);
  for (const { code } of languages) translation(key, code);
}

for (const { code } of languages) {
  if (!asoByLanguage.has(code)) throw new Error(`Missing ASO localization for ${code}`);
}

const alternateLinks = () => [
  "<!-- localized-alternates:start -->",
  ...languages.filter(({ code }) => indexEligibleLanguages.has(code)).map(({ code }) =>
    `  <link rel="alternate" hreflang="${code}" href="${urlForLanguage(code)}">`
  ),
  `  <link rel="alternate" hreflang="x-default" href="${baseURL}/">`,
  "  <!-- localized-alternates:end -->"
].join("\n");

const languagePicker = (currentCode) => {
  const summary = escapeHTML(translation("Sprachen", currentCode));
  const links = languages.map(({ code, nativeName, rtl }) => {
    const current = code === currentCode ? " aria-current=\"page\"" : "";
    const direction = rtl ? " dir=\"rtl\"" : "";
    return `        <a href="${fileForLanguage(code)}" lang="${code}"${direction}${current}>${escapeHTML(nativeName)}</a>`;
  }).join("\n");
  return `<!-- language-picker:start -->
      <details class="language-picker">
        <summary>${summary}</summary>
        <div class="language-menu">
${links}
        </div>
      </details>
      <!-- language-picker:end -->`;
};

const replaceMarker = (source, name, replacement) => {
  const expression = new RegExp(
    `\\s*<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`,
    "m"
  );
  if (!expression.test(source)) throw new Error(`Missing ${name} markers`);
  return source.replace(expression, `\n  ${replacement}`);
};

for (const code of ["de", "en"]) {
  const filePath = path.join(landingRoot, fileForLanguage(code));
  let source = fs.readFileSync(filePath, "utf8");
  source = replaceMarker(source, "localized-alternates", alternateLinks());
  source = replaceMarker(source, "language-picker", languagePicker(code));
  fs.writeFileSync(filePath, source);
}

const generatedPages = [];

for (const language of languages.filter(({ code }) => !["de", "en"].includes(code))) {
  const { code, nativeName, menu, rtl = false } = language;
  const locale = asoByLanguage.get(code);
  const paragraphs = locale.description.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  const featureLines = locale.description.split("\n")
    .map((value) => value.trim())
    .filter((value) => value.startsWith("•"))
    .map((value) => value.replace(/^•\s*/, ""));
  const intro = paragraphs.find((paragraph) => !paragraph.startsWith("•") && paragraph !== paragraphs[0])
    ?? locale.promotional_text;
  const safety = paragraphs.at(-1);
  const filename = fileForLanguage(code);
  const direction = rtl ? " dir=\"rtl\"" : "";
  const campaign = `web_${code}`;
  const heroScreenshot = rtl ? "clarification" : "result";
  const screenshotURL = `${baseURL}/assets/app-${code}-${heroScreenshot}.webp`;
  const analyticsCopy = {
    menuOpen: menu,
    menuClose: translation("Schließen", code),
    privacyURL: "privacy-en.html",
    analytics: {
      title: translation("Datenschutz & Kontrolle", code),
      text: translation(
        "Hilf uns zu verstehen, welche Funktionen nützlich sind. Es werden keine eingegebenen Situationen, Aufnahmen, gespeicherten Sätze oder Check-in-Inhalte gesendet.",
        code
      ),
      decline: translation("Ohne Analyse fortfahren", code),
      accept: translation("Analyse erlauben", code),
      privacy: translation("Datenschutz", code),
      settings: translation("Einstellungen", code)
    }
  };
  const inlineCopy = JSON.stringify(analyticsCopy).replaceAll("<", "\\u003c");
  const features = featureLines.slice(0, 5).map((feature) =>
    `            <li><span aria-hidden="true">✓</span><div><strong>${escapeHTML(feature)}</strong></div></li>`
  ).join("\n");

  const html = `<!doctype html>
<html lang="${code}"${direction}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHTML(locale.promotional_text)}">
  <meta name="robots" content="noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="#f7f3ea">
  <meta name="apple-itunes-app" content="app-id=6790763941">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Demenz Coach">
  <meta property="og:locale" content="${code}">
  <meta property="og:title" content="${escapeHTML(locale.name)}">
  <meta property="og:description" content="${escapeHTML(locale.promotional_text)}">
  <meta property="og:url" content="${urlForLanguage(code)}">
  <meta property="og:image" content="${screenshotURL}">
  <meta property="og:image:width" content="720">
  <meta property="og:image:height" content="1566">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHTML(locale.name)}">
  <meta name="twitter:description" content="${escapeHTML(locale.promotional_text)}">
  <meta name="twitter:image" content="${screenshotURL}">
  <title>${escapeHTML(locale.name)} – ${escapeHTML(locale.subtitle)}</title>
  <link rel="icon" type="image/png" sizes="192x192" href="assets/favicon-192.png">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">
  <link rel="canonical" href="${urlForLanguage(code)}">
  ${alternateLinks()}
  <link rel="sitemap" type="application/xml" href="${baseURL}/sitemap.xml">
  <link rel="preload" href="assets/app-${code}-${heroScreenshot}.webp" as="image" type="image/webp">
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">${jsonLD(applicationSchema({
    code,
    name: locale.name,
    description: locale.promotional_text,
    screenshot: screenshotURL
  }))}</script>
</head>
<body data-page-type="localized-product-draft" data-page-language="${code}" data-page-slug="home-${code}">
  <a class="skip-link" href="#main">${escapeHTML(translation("Direkt zur Soforthilfe", code))}</a>
  <header class="site-header">
    <div class="container nav-wrap">
      <a class="brand" href="#top" aria-label="Dementia Coach">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
        <span>${escapeHTML(locale.name)}</span>
      </a>
      <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">
        <span class="sr-only">${escapeHTML(menu)}</span><span></span><span></span>
      </button>
      <nav id="site-nav" class="site-nav" aria-label="${escapeHTML(menu)}">
        <a href="#screens">${escapeHTML(translation("Soforthilfe", code))}</a>
        <a href="#learn">${escapeHTML(translation("Lernen", code))}</a>
        <a href="#safety">${escapeHTML(translation("Sicherheit und Hilfe", code))}</a>
        ${languagePicker(code)}
        <a class="button button-small" href="#download">${escapeHTML(translation("Jetzt im App Store", code))}</a>
      </nav>
    </div>
  </header>

  <main id="main">
    <section id="top" class="hero section">
      <div class="hero-orb orb-one" aria-hidden="true"></div>
      <div class="hero-orb orb-two" aria-hidden="true"></div>
      <div class="container hero-grid">
        <div class="hero-copy reveal">
          <span class="eyebrow">${escapeHTML(translation("Kommunikationshilfe für pflegende Angehörige von Menschen mit Demenz.", code))}</span>
          <h1>${escapeHTML(translation("Soforthilfe, wenn Worte fehlen", code))}</h1>
          <p class="hero-lead">${escapeHTML(locale.promotional_text)}</p>
          <div class="hero-actions">
            <a class="button" href="https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&amp;ct=${campaign}_hero&amp;mt=8" data-store-link="hero-${code}">${escapeHTML(translation("Jetzt im App Store", code))}</a>
            <a class="text-link" href="#screens">${escapeHTML(translation("So kann eine konkrete Hilfe aussehen:", code))} <span aria-hidden="true">↓</span></a>
          </div>
          <ul class="trust-list">
            <li><span aria-hidden="true">✓</span>${escapeHTML(translation("Kein Ersatz für medizinische Beratung oder örtliche Notfallhilfe.", code))}</li>
          </ul>
        </div>
        <div class="hero-visual reveal">
          <div class="image-halo" aria-hidden="true"></div>
          <img src="assets/app-${code}-${heroScreenshot}.webp" width="720" height="1566" fetchpriority="high" alt="${escapeHTML(translation("Deine Hilfe", code))}">
        </div>
      </div>
    </section>

    <section class="reassurance">
      <div class="container reassurance-grid">
        <p>${escapeHTML(translation("Soforthilfe", code))}</p>
        <p>${escapeHTML(translation("Lernen", code))}</p>
        <p>${escapeHTML(translation("Selbstfürsorge", code))}</p>
      </div>
    </section>

    <section id="screens" class="section app-showcase">
      <div class="container">
        <div class="section-heading reveal">
          <span class="eyebrow">${escapeHTML(translation("So kann eine konkrete Hilfe aussehen:", code))}</span>
          <h2>${escapeHTML(translation("Soforthilfe und ein persönlicher 7-Tage-Plan für schwierige Demenz-Momente.", code))}</h2>
          <p>${escapeHTML(locale.promotional_text)}</p>
        </div>
        <div class="screenshot-grid">
          ${rtl ? "" : `<figure class="screenshot-card reveal">
            <img src="assets/app-${code}-clarification.webp" width="720" height="1566" loading="lazy" decoding="async" alt="${escapeHTML(translation("Eine kurze Rückfrage", code))}">
            <figcaption><strong>${escapeHTML(translation("Eine kurze Rückfrage", code))}</strong></figcaption>
          </figure>`}
          <figure class="screenshot-card reveal">
            <img src="assets/app-${code}-plan.webp" width="720" height="1566" loading="lazy" decoding="async" alt="${escapeHTML(translation("Dein persönlicher 7-Tage-Plan", code))}">
            <figcaption><strong>${escapeHTML(translation("Dein persönlicher 7-Tage-Plan", code))}</strong></figcaption>
          </figure>
          <figure class="screenshot-card reveal">
            <img src="assets/app-${code}-self-care.webp" width="720" height="1566" loading="lazy" decoding="async" alt="${escapeHTML(translation("Wie geht es dir gerade?", code))}">
            <figcaption><strong>${escapeHTML(translation("Wie geht es dir gerade?", code))}</strong></figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section id="learn" class="section benefits">
      <div class="container benefit-grid">
        <div class="benefit-copy reveal">
          <span class="eyebrow">${escapeHTML(translation("Lernen", code))}</span>
          <h2>${escapeHTML(locale.subtitle)}</h2>
          <p>${escapeHTML(intro)}</p>
          <ul class="check-list">
${features}
          </ul>
        </div>
        <figure class="feature-screenshot reveal">
          <img src="assets/app-${code}-plan.webp" width="720" height="1566" loading="lazy" decoding="async" alt="${escapeHTML(translation("Dein persönlicher 7-Tage-Plan", code))}">
          <figcaption>${escapeHTML(translation("Dein persönlicher 7-Tage-Plan", code))}</figcaption>
        </figure>
      </div>
    </section>

    <section id="safety" class="section safety-section">
      <div class="container">
        <div class="section-heading reveal">
          <span class="eyebrow">${escapeHTML(translation("Sicherheit und Hilfe", code))}</span>
          <h2>${escapeHTML(translation("Kein Ersatz für medizinische Beratung oder örtliche Notfallhilfe.", code))}</h2>
          <p>${escapeHTML(safety)}</p>
        </div>
      </div>
    </section>

    <section id="download" class="section final-cta">
      <div class="container cta-panel reveal">
        <div>
          <span class="eyebrow">${escapeHTML(locale.name)}</span>
          <h2>${escapeHTML(locale.subtitle)}</h2>
          <p>${escapeHTML(translation("Kommunikationshilfe für pflegende Angehörige von Menschen mit Demenz.", code))}</p>
        </div>
        <a class="button button-light" href="https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&amp;ct=${campaign}_footer&amp;mt=8" data-store-link="footer-${code}">${escapeHTML(translation("Jetzt im App Store", code))}</a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <a class="brand" href="#top"><span class="brand-mark" aria-hidden="true"><i></i><i></i></span><span>${escapeHTML(locale.name)}</span></a>
      <p>${escapeHTML(translation("Kein Ersatz für medizinische Beratung oder örtliche Notfallhilfe.", code))}</p>
      <nav>
        <a href="support-en.html">${escapeHTML(translation("Support", code))} <small lang="en">(English)</small></a>
        <a href="privacy-en.html">${escapeHTML(translation("Datenschutz", code))} <small lang="en">(English)</small></a>
        <a href="terms-en.html">${escapeHTML(translation("Nutzungsbedingungen", code))} <small lang="en">(English)</small></a>
        <a href="imprint-en.html">${escapeHTML(translation("Impressum", code))} <small lang="en">(English)</small></a>
      </nav>
    </div>
  </footer>
  <script>window.demenzCoachSiteLocale=${inlineCopy};</script>
  <script src="script.js"></script>
</body>
</html>
`;

  fs.writeFileSync(path.join(landingRoot, filename), html);
  generatedPages.push({
    code,
    file: filename,
    direction: rtl ? "rtl" : "ltr",
    screenshotPrefix: `assets/app-${code}-`
  });
}

fs.writeFileSync(
  path.join(landingRoot, "localized-pages.json"),
  `${JSON.stringify({
    sourceCatalog: "DemenzCoach/Localizable.xcstrings",
    sourceASO: "fastlane/aso-localizations.json",
    pages: languages.map(({ code, nativeName, rtl = false }) => ({
      code,
      nativeName,
      file: fileForLanguage(code),
      direction: rtl ? "rtl" : "ltr",
      generated: !["de", "en"].includes(code)
    }))
  }, null, 2)}\n`
);

const publicPages = [
  ...languages
    .filter(({ code }) => indexEligibleLanguages.has(code))
    .map(({ code }) => urlForLanguage(code)),
  `${baseURL}/support.html`,
  `${baseURL}/datenschutz.html`,
  `${baseURL}/datenschutzoptionen.html`,
  `${baseURL}/nutzungsbedingungen.html`,
  `${baseURL}/impressum.html`,
  `${baseURL}/support-en.html`,
  `${baseURL}/privacy-en.html`,
  `${baseURL}/privacy-choices-en.html`,
  `${baseURL}/terms-en.html`,
  `${baseURL}/imprint-en.html`
];

const seoManifestPath = path.join(landingRoot, "seo-pages.json");
const seoPages = fs.existsSync(seoManifestPath)
  ? JSON.parse(fs.readFileSync(seoManifestPath, "utf8")).pages
  : [];

const productAlternates = [
  ["de", urlForLanguage("de")],
  ["en", urlForLanguage("en")],
  ["x-default", urlForLanguage("de")]
];

const sitemapEntry = (url, alternates = []) => `  <url>
    <loc>${escapeHTML(url)}</loc>
${alternates.map(([language, href]) =>
    `    <xhtml:link rel="alternate" hreflang="${language}" href="${escapeHTML(href)}"/>`
  ).join("\n")}
  </url>`;

const seoEntries = seoPages.map((page) => {
  const alternate = seoPages.find((candidate) => {
    if (candidate.lang === page.lang) return false;
    if (page.type !== candidate.type) return false;
    if (page.type === "article") {
      return candidate.slug === page.alternateSlug;
    }
    return true;
  });
  const alternates = alternate
    ? [
        [page.lang, page.url],
        [alternate.lang, alternate.url],
        ["x-default", page.lang === "de" ? page.url : alternate.url]
      ]
    : [
        [page.lang, page.url],
        ["x-default", page.url]
      ];
  return sitemapEntry(page.url, alternates);
});

fs.writeFileSync(
  path.join(landingRoot, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${publicPages.map((url) =>
    sitemapEntry(url, indexEligibleLanguages.has(url === `${baseURL}/` ? "de" : url.endsWith("index-en.html") ? "en" : "")
      ? productAlternates
      : [])
  ).join("\n")}
${seoEntries.join("\n")}
</urlset>
`
);

fs.writeFileSync(
  path.join(landingRoot, "robots.txt"),
  `User-agent: *
Allow: /

Sitemap: ${baseURL}/sitemap.xml
`
);

console.log(`Generated ${generatedPages.length} localized landing pages and updated de/en navigation.`);
