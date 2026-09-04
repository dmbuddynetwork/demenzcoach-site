import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "landingpage");
const baseURL = "https://dmbuddynetwork.github.io/demenzcoach-site";
const files = [
  "support.html",
  "datenschutz.html",
  "datenschutzoptionen.html",
  "nutzungsbedingungen.html",
  "impressum.html",
  "support-en.html",
  "privacy-en.html",
  "privacy-choices-en.html",
  "terms-en.html",
  "imprint-en.html"
];

for (const filename of files) {
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing legal page: ${filePath}`);
  }

  let html = fs.readFileSync(filePath, "utf8");
  const lang = /<html\s+lang="([^"]+)"/.exec(html)?.[1] ?? "de";
  const canonical = `${baseURL}/${filename}`;
  const metadata = [
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    `<link rel="canonical" href="${canonical}">`,
    '<link rel="icon" type="image/png" sizes="192x192" href="assets/favicon-192.png">',
    '<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">',
    '<link rel="manifest" href="site.webmanifest">',
    `<link rel="sitemap" type="application/xml" href="${baseURL}/sitemap.xml">`
  ].join("");

  if (!html.includes('rel="canonical"')) {
    html = html.replace("</head>", `${metadata}</head>`);
  }

  html = html.replace(
    /(<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href=")(?!https?:\/\/)([^"]+)(")/g,
    (_match, prefix, href, suffix) => `${prefix}${baseURL}/${href}${suffix}`
  );

  html = html.replace(
    /<body class="legal-page"(?![^>]*data-page-type)/,
    `<body class="legal-page" data-page-type="legal" data-page-language="${lang}" data-page-slug="${path.basename(filename, ".html")}"`
  );
  fs.writeFileSync(filePath, html);
}

console.log(`Optimized ${files.length} legal and support pages in ${root}.`);
