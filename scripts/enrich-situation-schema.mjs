// Situation pages: adds a visible "Warum …?" block below the answer and
// BreadcrumbList + FAQPage JSON-LD. Block and FAQ text come 1:1 from the
// reviewed entries in content/ready-situations.<lang>.json (short, meanings,
// avoid, next) plus the visible phrases of the answer, so the structured data
// never says more than the page shows. The answer itself stays untouched
// (seo-generator-guard compares it with the reviewed view).
// Idempotent: re-running replaces both blocks.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const origin = 'https://dementiacoachapp.com';
const decode = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const json = o => JSON.stringify(o).replaceAll('<', '\\u003c');
// "zu widersprechen („…“)," → "Zu widersprechen („…“)"
const item = s => { const t = s.trim().replace(/[\s,;.–-]+$/, ''); return t.charAt(0).toUpperCase() + t.slice(1); };

const ui = {
  de: {
    dir: 'de/demenz-uebersetzer', home: 'Demenz Coach', tool: 'Demenz-Übersetzer',
    why: q => `Warum sagt ein Mensch mit Demenz ${q}?`,
    say: q => `Was kann ich sagen, wenn ein Mensch mit Demenz sagt: ${q}?`,
    meanings: 'Was dahinterstecken kann', avoid: 'Besser vermeiden', next: 'Was außerdem hilft',
    avoidQ: q => `Was sollte ich vermeiden, wenn ein Mensch mit Demenz sagt: ${q}?`,
    nextQ: q => `Was hilft außerdem, wenn ein Mensch mit Demenz sagt: ${q}?`,
    quote: p => `„${p}“`,
  },
  en: {
    dir: 'en/dementia-translator', home: 'Dementia Coach', tool: 'Dementia Translator',
    why: q => `Why does a person with dementia say ${q}?`,
    say: q => `What can I say when a person with dementia says ${q}?`,
    meanings: 'What may be behind it', avoid: 'Better to avoid', next: 'What else helps',
    avoidQ: q => `What should I avoid when a person with dementia says ${q}?`,
    nextQ: q => `What else helps when a person with dementia says ${q}?`,
    quote: p => `“${p}”`,
  },
};

const routes = JSON.parse(fs.readFileSync(path.join(root, 'content/generator-public-routes.json'), 'utf8')).routes;
let changed = 0, pages = 0;
for (const [lang, t] of Object.entries(ui)) {
  const entries = new Map(JSON.parse(fs.readFileSync(path.join(root, `content/ready-situations.${lang}.json`), 'utf8')).map(e => [e.page?.path, e]));
  for (const route of routes.filter(r => r.language === lang && !r.selfCare && !r.safetyOnly)) {
    const rel = route.path.slice(1), file = path.join(root, rel);
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('data-situation-topic=')) throw new Error(`Not a situation page: ${rel}`);
    const parent = rel.startsWith('de/ratgeber/') ? {name: 'Ratgeber', item: `${origin}/de/ratgeber/`} : {name: t.tool, item: `${origin}/${t.dir}/`};
    const entry = entries.get('/' + rel);
    if (!entry) throw new Error(`No reviewed entry: ${rel}`);
    const result = html.match(/<div id="translator-result"[\s\S]*?<div class="translator-next"/)?.[0];
    if (!result) throw new Error(`No answer block: ${rel}`);
    // "„Ich habe nichts gegessen.“?" reads badly: drop a final period inside the quote.
    const quote = decode(result.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '').replace(/\.(?=[“”"]$)/, '');
    const phrases = [...(result.match(/<div class="translator-phrases">[\s\S]*?(?=<img class="translator-scene-art"|<h3)/)?.[0] || '').matchAll(/<q>([\s\S]*?)<\/q>/g)].map(m => decode(m[1]));
    if (!quote || !phrases.length) throw new Error(`Missing quote/phrases: ${rel}`);
    const meanings = (entry.meanings || []).map(item), avoid = (entry.avoid || []).map(item), next = (entry.next || []).map(item);
    const list = (title, items) => items.length ? `<h3>${escape(title)}</h3><ul>${items.map(i => `<li>${escape(i)}</li>`).join('')}</ul>` : '';
    const section = `<section class="e-card situation-more" id="mehr-verstehen" aria-labelledby="mehr-verstehen-title"><h2 id="mehr-verstehen-title">${escape(t.why(quote))}</h2>${entry.short ? `<p>${escape(entry.short)}</p>` : ''}${list(t.meanings, meanings)}${list(t.avoid, avoid)}${list(t.next, next)}</section>`;

    const title = decode(html.match(/<title>([\s\S]*?)<\/title>/)[1]).replace(/\s*\|\s*(Demenz|Dementia) Coach$/, '');
    const url = `${origin}/${rel}`;
    const faq = [];
    if (entry.short || meanings.length) faq.push([t.why(quote), [entry.short, ...meanings].filter(Boolean).join(' ')]);
    faq.push([t.say(quote), phrases.map(t.quote).join(' ')]);
    if (avoid.length) faq.push([t.avoidQ(quote), avoid.join('. ') + '.']);
    if (next.length) faq.push([t.nextQ(quote), next.join(' ')]);
    const graph = [
      {'@type': 'BreadcrumbList', itemListElement: [
        {'@type': 'ListItem', position: 1, name: t.home, item: `${origin}/${lang}/`},
        {'@type': 'ListItem', position: 2, ...parent},
        {'@type': 'ListItem', position: 3, name: title, item: url},
      ]},
      {'@type': 'FAQPage', '@id': `${url}#faq`, inLanguage: lang, mainEntity: faq.map(([q, a]) => ({'@type': 'Question', name: q, acceptedAnswer: {'@type': 'Answer', text: a}}))},
    ];
    const block = `<script type="application/ld+json" id="situation-faq-schema">${json({'@context': 'https://schema.org', '@graph': graph})}</script>`;

    let next_ = html.replace(/<script type="application\/ld\+json" id="situation-faq-schema">[\s\S]*?<\/script>/, '')
      .replace(/<section class="e-card situation-more"[\s\S]*?<\/section>/, '');
    next_ = next_.replace('</head>', `${block}</head>`);
    const sources = next_.indexOf('<details class="translator-sources"');
    const after = next_.indexOf('</details>', sources) + '</details>'.length;
    if (sources < 0 || after < sources) throw new Error(`No sources anchor: ${rel}`);
    next_ = next_.slice(0, after) + section + next_.slice(after);
    pages++;
    if (next_ !== html) { fs.writeFileSync(file, next_); changed++; }
  }
}
console.log(JSON.stringify({pages, changed}));
