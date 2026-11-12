import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../cloudflare-worker.js';
const origin = 'https://dementiacoachapp.com';
const paths = ['/teller', '/teller/', '/teller/index.html'];
const mailValues = ['mail_weiter', 'mail_willkommen'];
const otherQueries = ['', '?q=fb', '?q=mail', '?q=mail_weiteres', '?q=mail_willkommens', '?q=MAIL_WEITER', '?q=MAIL_WILLKOMMEN', '?q=mail_weiter%20', '?q=%20mail_willkommen', '?q=mail_weiter&q=fb', '?q=mail_weiter&q=mail_weiter', '?q=mail_willkommen&q=mail_willkommen', '?q=mail_weiter&q=mail_willkommen', '?q=fb&q=mail_willkommen', '?utm_source=mail_weiter', '?utm_source=mail_willkommen'];

test('exact existing mail links skip allocation for either old arm and preserve no-store/method policy', async () => {
  for (const path of paths) for (const mail of mailValues) for (const arm of ['', 'website', 'funnel']) for (const method of ['GET', 'HEAD']) {
    const response = await worker.fetch(new Request(origin + path + '?q=' + mail + '&text=synthetic-private-value', {
      method, headers: arm ? { Cookie: 'dc_teller_v1=' + arm } : {}
    }), {});
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), origin + '/de/demenz-alltagstipps.html');
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  }
  for(const path of paths) for(const mail of mailValues) assert.equal((await worker.fetch(new Request(origin + path + '?q=' + mail, { method:'POST' }), {})).status, 405);
});

test('other, malformed and duplicate mail parameters keep the existing ad experiment', async () => {
  for (const path of paths) for (const query of otherQueries) for(const arm of ['website','funnel']) {
    const response = await worker.fetch(new Request(origin + path + query, { headers:{ Cookie:'dc_teller_v1='+arm } }), {});
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), origin + (arm==='website'?'/de/':'/start/') + '?teller='+arm, path+query);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
  }
});

test('the fixed list is a directly served content page, never an experiment redirect', async () => {
  const response = await worker.fetch(new Request(origin + '/de/demenz-alltagstipps.html'), { ASSETS:{ fetch:() => new Response('fixed list', { headers:{ 'Content-Type':'text/html' } }) } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Location'), null);
});

test('the former draft URL has one exact permanent compatibility redirect', async () => {
  const response = await worker.fetch(new Request(origin + '/teller/liste.html?text=synthetic-private-value', { headers:{ Cookie:'dc_teller_v1=funnel' } }), {});
  assert.equal(response.status,301);
  assert.equal(response.headers.get('Location'),origin+'/de/demenz-alltagstipps.html');
  assert.equal(response.headers.get('Set-Cookie'),null);
  assert.ok(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8').includes('"/teller/liste.html"'));
});

test('static fallback repairs both exact links before storage reads or random allocation', () => {
  const html = fs.readFileSync(new URL('../teller/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const path of paths) for(const mail of mailValues) {
    let reads = 0, samples = 0;
    const redirects = [];
    vm.runInNewContext(script, { URL, location:{ href:origin+path+'?q='+mail+'&text=synthetic-private-value', replace:value=>redirects.push(value) },
      localStorage:{ getItem(){ reads++; throw Error('Must not read assignment'); } },
      crypto:{ getRandomValues(){ samples++; throw Error('Must not allocate'); } } });
    assert.deepEqual(redirects, ['/de/demenz-alltagstipps.html']); assert.equal(reads, 0); assert.equal(samples, 0);
  }
});


test('static fallback leaves all other and duplicate mail queries in both original allocation arms', () => {
  const script=fs.readFileSync(new URL('../teller/index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  for(const path of paths) for(const query of otherQueries) for(const sample of [0,2**31]) {
    const redirects=[];let samples=0;
    vm.runInNewContext(script,{URL,location:{href:origin+path+query,replace:value=>redirects.push(value)},localStorage:{getItem(){return null;}},crypto:{getRandomValues(array){samples++;array[0]=sample;return array;}}});
    assert.deepEqual(redirects,[sample===0?'/de/?teller=website':'/start/?teller=funnel'],path+query);assert.equal(samples,1);
  }
});

test('social metadata describes the actual AI flow and points to real landscape preview assets', () => {
  for (const file of ['de/index.html', 'de/demenz-uebersetzer/index.html', 'de/demenz-alltagstipps.html']) {
    const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /Eingabe bleibt im Browser/u);
    for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) assert.match(html, new RegExp('<meta property="' + property + '" content="[^\"]+"'));
    const image = new URL(html.match(/<meta property="og:image" content="([^"]+)"/)[1]);
    assert.equal(image.origin, origin);
    const png = fs.readFileSync(new URL('..' + image.pathname, import.meta.url));
    assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
    if (file !== 'de/demenz-alltagstipps.html') {
      assert.match(html, /Die KI schlägt passende Worte und kleine nächste Schritte/u);
      assert.doesNotMatch(html.match(/<meta property="og:description"[^>]*>/)[0], /Kostenlos, ohne Anmeldung/u);
    }
  }
});
