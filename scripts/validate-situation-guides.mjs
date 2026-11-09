import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const slugs = ['demenz-immer-dieselbe-frage', 'demenz-will-sich-nicht-waschen', 'demenz-diebstahlvorwuerfe', 'demenz-fragt-nach-verstorbener-mutter', 'demenz-nachts-zur-arbeit'];
const home = read('de/index.html');
assert.match(home, /<h1[^>]*>Demenz: Was soll ich sagen\?<\/h1>/);
assert.ok(home.includes('href="/ratgeber/"'), 'homepage must link to the guide hub');
for (const slug of slugs) {
  const html = read(`ratgeber/${slug}.html`);
  assert.ok(read('ratgeber/index.html').includes(`href="${slug}.html"`), `${slug}: missing hub link`);
  assert.ok(!html.includes('hreflang="en"'), `${slug}: no invented English counterpart`);
  for (const id of ['formulierungen', 'naechster-schritt', 'sicherheit']) {
    assert.ok(html.includes(`href="#${id}"`) && html.includes(`id="${id}"`), `${slug}: broken jump link`);
  }
  const schema = JSON.parse(html.match(/application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const article = schema['@graph'].find(item => item['@type'] === 'Article');
  assert.equal(article.inLanguage, 'de');
  assert.ok(article.citation.length > 0);
  for (const url of article.citation) assert.ok(html.includes(`href="${url}"`), `${slug}: source not visible`);
  assert.ok(html.indexOf('id="sicherheit"') < html.indexOf('class="article-cta"'), `${slug}: safety must precede app offer`);
  assert.ok(html.includes('data-related-link="passende-situation"'), `${slug}: missing contextual tool link`);
  assert.ok(html.includes('Anbieterin: <a href="/impressum.html">Deborah Frey</a>'), `${slug}: missing provider attribution`);
  assert.ok((html.match(/data-related-link=/g) || []).length >= 2);
}
console.log('Five situation guides: metadata, discoverability, sources, jump links and safety placement passed.');
