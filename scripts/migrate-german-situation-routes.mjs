// One explicit migration manifest, existing content only. Safe to rerun after a generator.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const defaultRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const origin = 'https://dementiacoachapp.com';
const manifest = JSON.parse(fs.readFileSync(new URL('../german-situation-routes.json', import.meta.url), 'utf8'));
const paths = new Map(manifest.pages.flatMap(p => p.aliases.map(a => [a, p.to])));
const targets = new Set(manifest.pages.map(p => p.to));
const decode = value => value.replaceAll('&amp;', '&');
const mappedURL = value => {
  const url = new URL(decode(value), origin);
  if (url.origin !== origin) return null;
  const mapped = paths.get(url.pathname);
  if (!mapped) return null;
  url.pathname = mapped;
  return url;
};
export const rewriteGermanRouteReferences = (html, sourceFile, moved = false) => {
  const base = new URL('/' + sourceFile, origin);
  // Use each old document's actual base for relative assets before changing its location.
  let result = html.replace(/<(?:a|link|img|script|form|source)\b[^>]*>/gi, tag =>
    tag.replace(/\b(href|src|action|srcset)=(["'])(.*?)\2/gi, (all, attr, quote, value) => {
      const rewrite = v => {
        if (!v || /^(?:#|data:|mailto:|tel:|javascript:)/i.test(v)) return v;
        const url = new URL(decode(v), base);
        if (url.origin !== origin) return v;
        const mapped = paths.get(url.pathname);
        const absoluteMetadata = attr.toLowerCase() === 'href' && /^<link\b/i.test(tag) && /\brel=["'](?:canonical|alternate)["']/i.test(tag);
        if (!mapped && !moved && !absoluteMetadata) return v;
        if (mapped) url.pathname = mapped;
        else if (moved && (url.pathname === '/' || url.pathname === '/index.html')) url.pathname = '/de/';
        const next = absoluteMetadata || /^https?:/i.test(v) ? url.href : url.pathname + url.search + url.hash;
        return next.replaceAll('&', '&amp;');
      };
      const next = attr.toLowerCase() === 'srcset'
        ? (moved ? value.split(',').map(item => { const [url, ...size] = item.trim().split(/\s+/); return [rewrite(url), ...size].join(' '); }).join(', ') : value)
        : rewrite(value);
      return attr + '=' + quote + next + quote;
    }));
  // Structured data and embedded translator entries use absolute production URLs.
  result = result.replace(/https:\/\/dementiacoachapp\.com\/[^"'<>\s\\]*/g, value => {
    const url = mappedURL(value);
    return url ? url.href : value;
  });
  return result;
};
const redirectStub = page => '<!doctype html>\n<html lang="de"><head><meta charset="utf-8">\n'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
  + '<meta name="robots" content="noindex,follow">\n<meta http-equiv="refresh" content="0; url=' + page.to + '">\n'
  + '<link rel="canonical" href="' + origin + page.to + '">\n<title>Weiter zur deutschen Seite | Demenz Coach</title>\n'
  + '</head><body><p>Diese Seite findest du jetzt unter <a href="' + page.to + '">der deutschen Adresse</a>.</p></body></html>\n';
export const migrateGermanSituationRoutes = (root = defaultRoot) => {
  if (manifest.pages.length !== 52 || Object.keys(manifest.situations).length !== 45) throw Error('Unexpected migration scope');
  let writes = 0;
  const write = (file, content) => {
    const target = path.join(root, file);
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === content) return;
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); writes++;
  };
  for (const page of manifest.pages) {
    const destination = path.join(root, page.target);
    if (!fs.existsSync(destination)) {
      const html = fs.readFileSync(path.join(root, page.source), 'utf8');
      if (html.includes('noindex')) throw Error('Source must be the existing indexable page: ' + page.source);
      write(page.target, rewriteGermanRouteReferences(html, page.source, true));
    }
    write(page.source, redirectStub(page));
  }
  // No translated content or preview copies are rewritten. German links there stay valid via 301.
  const files = ['404.html', 'de/index.html'];
  for (const dir of ['demenz-uebersetzer', 'ratgeber', 'de/demenz-uebersetzer', 'de/ratgeber', 'alltagstricks']) {
    for (const name of fs.readdirSync(path.join(root, dir))) if (name.endsWith('.html')) files.push(path.join(dir, name));
  }
  const oldSources = new Set(manifest.pages.map(p => p.source));
  for (const file of files) {
    if (!fs.existsSync(path.join(root, file)) || oldSources.has(file)) continue;
    write(file, rewriteGermanRouteReferences(fs.readFileSync(path.join(root, file), 'utf8'), file));
  }
  // Only reciprocal German/x-default alternate hrefs; English content and canonical stay byte-identical.
  for (const item of manifest.hreflangSources) {
    const html = fs.readFileSync(path.join(root, item.file), 'utf8');
    const next = html.replace(/<link\b[^>]*rel=["']alternate["'][^>]*>/gi, tag =>
      /\bhreflang=["'](?:de|x-default)["']/i.test(tag) ? rewriteGermanRouteReferences(tag, item.file) : tag);
    write(item.file, next);
  }
  const sitemapPath = path.join(root, 'sitemap.xml');
  const xml = fs.readFileSync(sitemapPath, 'utf8').replace(/<loc>(.*?)<\/loc>/g, (all, value) => {
    const url = mappedURL(value); return url ? '<loc>' + url.href + '</loc>' : all;
  });
  write('sitemap.xml', xml);
  const campaignFile = path.join(root, 'seo-campaigns.json');
  const campaigns = JSON.parse(fs.readFileSync(campaignFile, 'utf8'));
  for (const row of campaigns.campaigns) {
    const mapped = mappedURL(row.page_url); if (mapped) row.page_url = mapped.href;
  }
  write('seo-campaigns.json', JSON.stringify(campaigns, null, 2) + '\n');
  for (const page of manifest.pages) if (!targets.has(page.to)) throw Error('Missing canonical destination');
  return { pages: manifest.pages.length, situations: Object.keys(manifest.situations).length, writes };
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(migrateGermanSituationRoutes(path.resolve(process.argv[2] || defaultRoot))));
}
