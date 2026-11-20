// Two-way internal links between the German Ratgeber articles and the matching
// situation pages, as plain crawlable links (no ?situation= redirect hop).
// Ratgeber → situations: list inside "Für den nächsten Moment".
// Situation → Ratgeber: one line at the end of the "Warum …?" block
// (scripts/enrich-situation-schema.mjs must run first). Idempotent.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text);
const decode = s => s.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const map = {
  'demenz-diebstahlvorwuerfe': ['du-hast-mein-geld-gestohlen', 'du-luegst-mich-an', 'die-nachbarn-reden-ueber-mich'],
  'demenz-fragt-nach-verstorbener-mutter': ['wo-ist-meine-mutter', 'wo-ist-mein-mann', 'wo-sind-meine-kinder'],
  'demenz-immer-dieselbe-frage': ['wann-gehen-wir', 'wann-kommt-mein-sohn', 'ich-habe-schon-gegessen'],
  'demenz-kommunikation': ['wer-sind-sie', 'lass-mich-in-ruhe', 'ich-bin-doch-kein-kind', 'ich-bin-doch-nicht-dement'],
  'demenz-nachts-zur-arbeit': ['ich-muss-zur-arbeit', 'ich-muss-aufstehen-nachts', 'es-wird-dunkel-ich-muss-los'],
  'demenz-will-sich-nicht-waschen': ['ich-will-nicht-duschen', 'ich-ziehe-mich-nicht-um'],
};
const situationTitle = slug => decode(read(`de/demenz-uebersetzer/${slug}.html`).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)[1]);
const guideTitle = slug => decode(read(`de/ratgeber/${slug}.html`).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)[1]);

let changed = 0;
for (const [guide, situations] of Object.entries(map)) {
  const rel = `de/ratgeber/${guide}.html`;
  let html = read(rel), before = html;
  html = html.replace(/<ul class="guide-situation-links">[\s\S]*?<\/ul>/, '');
  const list = `<ul class="guide-situation-links">${situations.map(s => `<li><a class="text-link" data-related-link="situation-${s}" href="/de/demenz-uebersetzer/${s}.html">${escape(situationTitle(s))}</a></li>`).join('')}</ul>`;
  const anchor = /(<section class="related-guides" aria-labelledby="tool-link-title"><h2 id="tool-link-title">[^<]*<\/h2>)/;
  if (!anchor.test(html)) throw new Error(`No tool-link section: ${rel}`);
  html = html.replace(anchor, `$1${list}`);
  if (html !== before) { write(rel, html); changed++; }

  for (const s of situations) {
    const srel = `de/demenz-uebersetzer/${s}.html`;
    let page = read(srel), old = page;
    page = page.replace(/<p class="situation-more-guide">[\s\S]*?<\/p>/, '');
    const line = `<p class="situation-more-guide">Ausführlich im Ratgeber: <a class="text-link" href="/de/ratgeber/${guide}.html">${escape(guideTitle(guide))}</a></p>`;
    const end = page.indexOf('</section>', page.indexOf('<section class="e-card situation-more"'));
    if (page.indexOf('<section class="e-card situation-more"') < 0) throw new Error(`Run enrich-situation-schema first: ${srel}`);
    page = page.slice(0, end) + line + page.slice(end);
    if (page !== old) { write(srel, page); changed++; }
  }
}
console.log(JSON.stringify({changed}));
