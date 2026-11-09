import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sources = JSON.parse(read('alltagstricks/sources.json'));
const raw = JSON.parse(read('alltagstricks/tricks.json'));
const schemaOf = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];

test('all topics expose specific primary-source links, and overrides keep existing anchors', () => {
  const html = read('alltagstricks/index.html');
  for (const category of Object.keys(raw.categories)) {
    assert.ok(sources.categories[category]?.length, `missing sources: ${category}`);
    const group = html.slice(html.indexOf(`id="${category}"`)).split('</section>')[0];
    for (const id of sources.categories[category]) {
      assert.ok(sources.sources[id], `unknown source ${id}`);
      assert.ok(group.includes(`href="${sources.sources[id].url}"`), `source not visible in ${category}`);
    }
  }
  for (const [id, override] of Object.entries(sources.overrides)) {
    assert.ok(raw.tricks.some(trick => trick.id === id), `orphan override ${id}`);
    assert.ok(html.includes(`id="${id}"`), `existing deep link lost: ${id}`);
    assert.ok(html.includes(override.text), `clarification missing: ${id}`);
    assert.ok(sources.sources[override.source]);
  }
  const list = schemaOf(html).find(item => item['@type'] === 'ItemList');
  assert.equal(list.numberOfItems, raw.tricks.length);
  assert.equal((html.match(/<article class="translator-trick"/g) || []).length, raw.tricks.length);
  for (const source of Object.values(sources.sources)) assert.equal(new URL(source.url).protocol, 'https:');
});

test('curated food topic has distinct metadata, visible citations, real anchors and discovery links', () => {
  const html = read('alltagstricks/essen-trinken.html');
  const url = 'https://dementiacoachapp.com/alltagstricks/essen-trinken.html';
  assert.ok(html.includes(`<link rel="canonical" href="${url}">`));
  assert.ok(!html.includes('noindex'));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  const schema = schemaOf(html);
  const article = schema.find(item => item['@type'] === 'Article');
  const list = schema.find(item => item['@type'] === 'ItemList');
  assert.equal(list.numberOfItems, 6);
  assert.equal((html.match(/<article class="translator-trick"/g) || []).length, 6);
  for (const item of list.itemListElement) assert.ok(html.includes(`id="${new URL(item.url).hash.slice(1)}"`));
  for (const source of article.citation) assert.ok(html.includes(`href="${source}"`));
  assert.ok(html.includes('Behandlungsteam'));
  assert.ok(html.includes('href="/alltagstricks/"'));
  assert.ok(read('alltagstricks/index.html').includes('href="/alltagstricks/essen-trinken.html"'));
  assert.equal((read('sitemap.xml').match(new RegExp(`<loc>${url.replaceAll('.', '\\.')}</loc>`, 'g')) || []).length, 1);
});

test('publisher attribution uses the real provider and preserves distinct mother-page intent', () => {
  assert.ok(read('impressum.html').includes('Deborah Frey'));
  assert.ok(read('ratgeber/redaktion.html').includes('Anbieterin von Demenz Coach'));
  assert.ok(read('ratgeber/redaktion.html').includes('keine Berufs- oder Fachqualifikation'));
  const quick = read('demenz-uebersetzer/wo-ist-meine-mutter.html');
  const guide = read('ratgeber/demenz-fragt-nach-verstorbener-mutter.html');
  assert.match(quick, /<title>[^<]*kurze Antworten/);
  assert.match(guide, /<title>[^<]*Über verstorbene Angehörige sprechen/);
  assert.ok(guide.includes('href="/demenz-uebersetzer/wo-ist-meine-mutter.html"'));
  assert.ok(quick.includes('ratgeber/demenz-fragt-nach-verstorbener-mutter.html'));
});

test('marketing entry pages do not hard-code an unverified free-week offer', () => {
  const files = ['de/index.html', ...fs.readdirSync(new URL('demenz-uebersetzer/', root))
    .filter(file => file.endsWith('.html')).map(file => `demenz-uebersetzer/${file}`)];
  for (const file of files) {
    const visible = read(file).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    assert.ok(!visible.includes('7 Tage kostenlos testen'), `${file}: unsupported static trial promise`);
  }
});
