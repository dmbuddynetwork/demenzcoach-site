#!/usr/bin/env node
// Adds the vetted everyday situations (from the iOS app catalog, reviewed translations) to every
// language home /xx/. Without them those pages were only an app teaser, too thin for Google.
// Data: content/language-situations.json. Re-run after changing the data; the block is replaced in place.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'content/language-situations.json'), 'utf8'));
const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const start = '<!-- situations:start -->';
const end = '<!-- situations:end -->';

function block(lang) {
  const { heading, labels, situations } = data.languages[lang];
  const items = situations.map((s) => `
          <article class="e-loc-situation" id="s-${esc(s.id)}">
            <h3>${esc(s.title)}</h3>
            <p class="e-loc-label">${esc(labels.say)}</p>
            <p class="e-loc-say"><q>${esc(s.say)}</q></p>
            <p class="e-loc-label">${esc(labels.next)}</p>
            <p>${esc(s.next)}</p>
            <p class="e-loc-label">${esc(labels.why)}</p>
            <p>${esc(s.why)}</p>
            <p><strong>${esc(labels.avoid)}</strong> <q>${esc(s.avoid)}</q></p>
          </article>`).join('');
  return `${start}
        <section id="situations" class="e-card e-loc-situations" aria-labelledby="situations-title">
          <h2 id="situations-title">${esc(heading)}</h2>${items}
        </section>
        ${end}`;
}

let changed = 0;
for (const lang of Object.keys(data.languages)) {
  const file = path.join(root, lang, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const fresh = block(lang);
  if (html.includes(start)) {
    html = html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), fresh);
  } else {
    const anchor = '<section id="learn"';
    if (!html.includes(anchor)) throw new Error(`No #learn section in ${lang}/index.html`);
    html = html.replace(anchor, `${fresh}\n        ${anchor}`);
  }
  fs.writeFileSync(file, html);
  changed += 1;
}
console.log(`Situations block written to ${changed} language homes.`);
