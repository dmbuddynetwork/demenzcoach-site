import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "landingpage");
const baseURL = "https://dementiacoachapp.com";
const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const htmlFiles = [];

const walk = (directory, prefix = "") => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    // vorschau/: nicht indexierte Testversionen (noindex), eigenes Layout, nicht Teil der Live-Seiten.
    if (!prefix && entry.name === "vorschau") continue;
    // teller/ und plate/ (EN): Landingpages für Social-Media-Traffic (noindex), eigenes Layout.
    if (!prefix && (entry.name === "teller" || entry.name === "plate")) continue;
    // abo/ und start/: Kassen- und Werbeseiten mit eigenen Regeln (noindex), keine SEO-Seiten.
    if (!prefix && (entry.name === "abo" || entry.name === "start")) continue;
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, relative);
    else if (entry.name.endsWith(".html")) htmlFiles.push(relative);
  }
};
walk(root);

const attribute = (html, tag, name) => {
  const tagMatch = new RegExp(`<${tag}\\b[^>]*>`, "i").exec(html)?.[0];
  return tagMatch
    ? new RegExp(`${name}=["']([^"']+)["']`, "i").exec(tagMatch)?.[1]
    : undefined;
};

const meta = (html, name, property = false) =>
  new RegExp(`<meta\\s+[^>]*${property ? "property" : "name"}=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i").exec(html)?.[1]
  ?? new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${property ? "property" : "name"}=["']${name}["'][^>]*>`, "i").exec(html)?.[1];

const hrefs = (html) => [...html.matchAll(/<(?:a|link)\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi)]
  .map((match) => match[1]);

const indexableURLs = new Map();
const titles = new Map();
const descriptions = new Map();

// Alte Startseiten-Adressen (/, /index.html, /index-xx.html) sind dauerhaft auf /de/ bzw. /xx/
// umgezogen. Auf Cloudflare leitet der Worker per 301 um; die Dateien selbst sind nur noch
// HTML-Weiterleitungs-Stubs als Fallback für Hosting ohne Server-Weiterleitungen (GitHub Pages).
const germanRoutes = JSON.parse(read('german-situation-routes.json'));
const germanStubTargets = new Map(germanRoutes.pages.map(page => [page.source, page.to]));
const legacyHomeStubTarget = (file) => {
  if (germanStubTargets.has(file)) return germanStubTargets.get(file);
  if (file === "index.html") return "/de/";
  const match = /^index-([a-z]{2})\.html$/.exec(file);
  return match ? `/${match[1]}/` : null;
};

const validateRedirectStub = (file, html, robots, canonical, title, expectedTarget) => {
  const refreshTarget = /<meta\s+http-equiv=["']refresh["']\s+content=["']0;\s*url=([^"']+)["']/i.exec(html)?.[1];
  if (refreshTarget !== expectedTarget) fail(`${file}: stub must refresh to ${expectedTarget}, found ${refreshTarget}`);
  if (!robots.toLowerCase().includes("noindex")) fail(`${file}: redirect stub must be noindex`);
  if (canonical !== `${baseURL}${expectedTarget}`) fail(`${file}: stub canonical must be ${baseURL}${expectedTarget}`);
  if (!html.includes(`<a href="${expectedTarget}"`)) fail(`${file}: stub needs a crawlable link to ${expectedTarget}`);
  if (!title) fail(`${file}: missing title`);
};

for (const file of htmlFiles) {
  const html = read(file);
  const documentLanguage = attribute(html, "html", "lang") ?? "und";
  const title = /<title>([^<]+)<\/title>/i.exec(html)?.[1]?.trim();
  const description = meta(html, "description");
  const robots = meta(html, "robots") ?? "";
  const noindex = robots.toLowerCase().includes("noindex");
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  const canonical = /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i.exec(html)?.[1]
    ?? /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i.exec(html)?.[1];

  const stubTarget = legacyHomeStubTarget(file);
  if (stubTarget) {
    validateRedirectStub(file, html, robots, canonical, title, stubTarget);
    continue;
  }

  if (!title) fail(`${file}: missing title`);
  // Schlichtes Layout im App-Stil (einfach.css, 8. Nov 2026) für Startseite und Übersetzer-Seiten.
  if (!/href=["'][^"']*lovable-home\.css\?v=/.test(html) && !/href=["'][^"']*einfach\.css["']/.test(html)) fail(`${file}: missing current shared layout`);
  if (/href=["'][^"']*\/(?:styles)\.css|href=["']styles\.css/.test(html)) fail(`${file}: legacy stylesheet remains`);
  if (/src=["'][^"']*\bscript\.js["']/.test(html)) fail(`${file}: legacy navigation script remains`);
  if (!description && file !== "404.html") fail(`${file}: missing meta description`);
  if (h1Count !== 1) fail(`${file}: expected one h1, found ${h1Count}`);
  if (file === "404.html") {
    if (!noindex) fail("404.html: must be noindex");
    continue;
  }
  if (!robots) fail(`${file}: missing robots meta`);
  if (!canonical) fail(`${file}: missing canonical`);
  if (canonical && !canonical.startsWith(`${baseURL}/`)) fail(`${file}: non-production canonical ${canonical}`);

  if (!noindex && canonical) {
    indexableURLs.set(canonical, file);
    const titleKey = `${documentLanguage}:${title}`;
    const descriptionKey = `${documentLanguage}:${description}`;
    if (titles.has(titleKey)) fail(`${file}: duplicate title also used by ${titles.get(titleKey)}`);
    else titles.set(titleKey, file);
    if (descriptions.has(descriptionKey)) fail(`${file}: duplicate description also used by ${descriptions.get(descriptionKey)}`);
    else descriptions.set(descriptionKey, file);
  }

  for (const script of html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(script[1]);
    } catch (error) {
      fail(`${file}: invalid JSON-LD (${error.message})`);
    }
  }

  const relativeBase = path.dirname(file);
  for (const href of hrefs(html)) {
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(href)) continue;
    const clean = decodeURIComponent(href.split("?")[0]);
    let target = clean.startsWith('/') ? path.join(root, clean) : path.resolve(root, relativeBase, clean);
    if (clean.endsWith("/")) target = path.join(target, "index.html");
    if (!fs.existsSync(target)) fail(`${file}: missing internal target ${href}`);
  }
}

const campaignManifestPath = path.join(root, "seo-campaigns.json");
if (!fs.existsSync(campaignManifestPath)) {
  fail("seo-campaigns.json: missing SEO campaign mapping");
} else {
  const campaignManifest = JSON.parse(fs.readFileSync(campaignManifestPath, "utf8"));
  const campaignTokens = new Set();
  for (const campaign of campaignManifest.campaigns ?? []) {
    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(campaign.campaign_token ?? "")) {
      fail(`seo-campaigns.json: invalid token for ${campaign.page_slug}`);
      continue;
    }
    if (campaignTokens.has(campaign.campaign_token)) {
      fail(`seo-campaigns.json: duplicate campaign token ${campaign.campaign_token}`);
    }
    campaignTokens.add(campaign.campaign_token);
    const relativePath = new URL(campaign.page_url).pathname
      .replace("/demenzcoach-site/", "");
    const html = read(relativePath);
    if (!html.includes(`ct=${campaign.campaign_token}&amp;mt=8`)) {
      fail(`${relativePath}: missing mapped campaign token ${campaign.campaign_token}`);
    }
    if ((html.match(/data-related-link=/g) ?? []).length < 2) {
      fail(`${relativePath}: expected at least two internal related-guide links`);
    }
  }
  const expectedStageEvents = [
    "app_store_click",
    "app_install_recorded",
    "first_help_received",
    "first_qualifying_help_received",
    "user_activated"
  ];
  const serializedStages = JSON.stringify(campaignManifest.stages ?? []);
  expectedStageEvents.forEach((event) => {
    if (!serializedStages.includes(event)) {
      fail(`seo-campaigns.json: missing funnel event ${event}`);
    }
  });
}

const trackingScript = read("lovable-home.js");
for (const measurementField of ["campaign_token", "related_guide_click", "guide_read_depth"]) {
  if (!trackingScript.includes(measurementField)) {
    fail(`script.js: missing SEO measurement field ${measurementField}`);
  }
}

for (const file of ["de/index.html", "en/index.html"]) {
  const html = read(file);
  const scripts = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
  const serialized = JSON.stringify(scripts);
  if (!serialized.includes('"MobileApplication"')) fail(`${file}: missing MobileApplication schema`);
  if (!serialized.includes('"offers"') || !serialized.includes('"price":"0"')) {
    fail(`${file}: missing truthful free Offer schema`);
  }
}

const sitemap = read("sitemap.xml");
const sitemapURLs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (new Set(sitemapURLs).size !== sitemapURLs.length) fail("sitemap.xml: duplicate loc entries");
for (const url of indexableURLs.keys()) {
  if (!sitemapURLs.includes(url)) fail(`sitemap.xml: missing indexable URL ${url}`);
}
for (const url of sitemapURLs) {
  if (!indexableURLs.has(url)) fail(`sitemap.xml: contains non-indexable or unknown URL ${url}`);
}

const homeLanguages = [
  "de", "en", "pl", "ro", "bg", "hr", "sk", "hu", "cs", "uk", "bs",
  "sr", "lt", "sl", "lv", "et", "ru", "tr", "ar", "fr", "it", "es",
  "pt", "nl", "el", "sq", "fa", "th", "da", "fi", "ga", "mt", "sv"
];
const storeLocaleByLanguage = {
  ar: "ar-SA", cs: "cs", da: "da", de: "de-DE", el: "el", en: "en-US",
  es: "es-ES", fi: "fi", fr: "fr-FR", hr: "hr", hu: "hu", it: "it",
  nl: "nl-NL", pl: "pl", pt: "pt-PT", ro: "ro", ru: "ru", sk: "sk",
  sl: "sl-SI", sv: "sv", th: "th", tr: "tr", uk: "uk"
};

for (const language of homeLanguages) {
  // Seit Nov 2026 liegt jede Startseite unter ihrer Sprach-Adresse /xx/ (SEO: eine stabile URL je Sprache).
  const file = `${language}/index.html`;
  const html = read(file);
  const robots = meta(html, "robots") ?? "";
  if (robots.toLowerCase().includes("noindex")) fail(`${file}: localized home must be indexable`);
  if (html.includes('data-page-type="localized-product-draft"')) fail(`${file}: draft page type remains`);
  // Die deutsche Startseite ist seit 8. Nov 2026 der Demenz-Übersetzer im App-Stil (einfach.css, ohne Store-Galerie).
  const simpleHome = /<body[^>]*class="[^"]*\beinfach\b/.test(html);
  if (simpleHome) {
    if (!/href="[^"]*einfach\.css"/.test(html)) fail(`${file}: missing simple layout einfach.css`);
    if (!/src="\/?lovable-home\.js(?:\?v=[^"]+)?"/.test(html)) fail(`${file}: missing shared consent and navigation script`);
  } else {
    if (!/href="lovable-home\.css(?:\?v=[^"]+)?"/.test(html)) fail(`${file}: missing shared Lovable design system`);
    if (!/src="lovable-home\.js(?:\?v=[^"]+)?"/.test(html)) fail(`${file}: missing shared accessible navigation script`);
  }

  const alternates = new Map([...html.matchAll(/<link\s+rel=["']alternate["']\s+hreflang=["']([^"']+)["']\s+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => [match[1], match[2]]));
  for (const alternateLanguage of [...homeLanguages, "x-default"]) {
    // x-default zeigt auf /de/: die Wurzel / leitet dauerhaft dorthin, Deutsch ist die Standardsprache.
    const expectedAlternateURL = `${baseURL}/${alternateLanguage === "x-default" ? "de" : alternateLanguage}/`;
    if (!alternates.has(alternateLanguage)) fail(`${file}: missing reciprocal hreflang ${alternateLanguage}`);
    else if (alternates.get(alternateLanguage) !== expectedAlternateURL) {
      fail(`${file}: hreflang ${alternateLanguage} must point to ${expectedAlternateURL}, found ${alternates.get(alternateLanguage)}`);
    }
  }

  const expectedStoreLocale = storeLocaleByLanguage[language] ?? "en-US";
  const storeImages = [...html.matchAll(/<img\s+[^>]*src=["']\/?assets\/store\/([^/]+)\/([^"']+\.webp)["'][^>]*>/gi)];
  if (storeImages.length < 6 && !simpleHome) fail(`${file}: expected at least six final Store screenshot references`);
  for (const [, storeLocale, asset] of storeImages) {
    if (storeLocale !== expectedStoreLocale) fail(`${file}: unexpected Store locale ${storeLocale}`);
    if (!fs.existsSync(path.join(root, "assets", "store", storeLocale, asset))) {
      fail(`${file}: missing final Store screenshot assets/store/${storeLocale}/${asset}`);
    }
  }
  const fallbackExpected = !storeLocaleByLanguage[language];
  const hasFallbackLabel = html.includes('class="screenshot-language-note"');
  if (fallbackExpected !== hasFallbackLabel) fail(`${file}: Store screenshot fallback disclosure mismatch`);
}

for (const asset of [
  "assets/og-de.webp",
  "assets/og-en.webp",
  "assets/favicon-192.png",
  "assets/favicon-512.png",
  "assets/apple-touch-icon.png",
  "site.webmanifest"
]) {
  if (!fs.existsSync(path.join(root, asset))) fail(`missing SEO asset ${asset}`);
}

for (const file of htmlFiles) {
  const html = read(file);
  for (const match of html.matchAll(/href=["']https:\/\/apps\.apple\.com\/app\/apple-store\/id6790763941\?([^"']+)["']/g)) {
    const params = new URLSearchParams(match[1].replaceAll("&amp;", "&"));
    const campaign = params.get("ct");
    if (!campaign || campaign.length > 30) fail(`${file}: invalid App Store campaign token`);
  }
}

if (warnings.length) warnings.forEach((message) => console.warn(`WARN ${message}`));
if (errors.length) {
  errors.forEach((message) => console.error(`ERROR ${message}`));
  process.exitCode = 1;
} else {
  console.log(`SEO validation passed: ${htmlFiles.length} HTML files, ${indexableURLs.size} indexable URLs, ${sitemapURLs.length} sitemap URLs.`);
}
