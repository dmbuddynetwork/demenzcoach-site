import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "landingpage");
const baseURL = "https://dmbuddynetwork.github.io/demenzcoach-site";
const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const htmlFiles = [];

const walk = (directory, prefix = "") => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
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

  if (!title) fail(`${file}: missing title`);
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
    let target = path.resolve(root, relativeBase, clean);
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

const trackingScript = read("script.js");
for (const measurementField of ["campaign_token", "related_guide_click", "guide_read_depth"]) {
  if (!trackingScript.includes(measurementField)) {
    fail(`script.js: missing SEO measurement field ${measurementField}`);
  }
}

const acuteGuide = read("ratgeber/ploetzliche-verwirrtheit-demenz.html");
const acuteSafetyPosition = acuteGuide.indexOf("Plötzliche oder stark schwankende Verwirrtheit");
const acuteStoreCTA = acuteGuide.indexOf("https://apps.apple.com/");
if (acuteSafetyPosition === -1 || acuteStoreCTA === -1 || acuteStoreCTA < acuteSafetyPosition) {
  fail("ratgeber/ploetzliche-verwirrtheit-demenz.html: App Store CTA must follow the acute safety guidance");
}

for (const file of ["index.html", "index-en.html"]) {
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

for (const file of htmlFiles.filter((name) => /^index-[a-z]{2}\.html$/.test(name) && name !== "index-en.html")) {
  const robots = meta(read(file), "robots") ?? "";
  if (!robots.toLowerCase().includes("noindex")) {
    fail(`${file}: unreviewed translation must remain noindex`);
  }
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
