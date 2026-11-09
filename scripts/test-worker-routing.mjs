// Tests für cloudflare-worker.js: alte Startseiten-Adressen → 301 auf /de/ bzw. /xx/,
// Ordner-Startseiten, echte 404 und Suchanfragen-Erhalt. Ausführen: node --test scripts/test-worker-routing.mjs
// Hinweis: In Produktion liefert Cloudflare vorhandene Dateien direkt aus; der Worker läuft nur für
// Adressen ohne passende Datei sowie für die run_worker_first-Adressen aus wrangler.jsonc.
import test from "node:test";
import assert from "node:assert/strict";
import worker, { legacyHomeTarget } from "../cloudflare-worker.js";

// Dateien, die es im Repo wirklich gibt (Ausschnitt), als Attrappe für env.ASSETS.
const assetPaths = new Set([
  "/de/index.html",
  "/de/app/index.html",
  "/en/index.html",
  "/fr/index.html",
  "/sv/index.html",
  "/index.html",
  "/index-en.html",
  "/datenschutz.html",
  "/abo/kuendigen.html",
  "/demenz-uebersetzer/index.html",
  "/404.html"
]);

const env = {
  ASSETS: {
    fetch: async (url) => {
      const { pathname } = new URL(url);
      return assetPaths.has(pathname)
        ? new Response(`asset:${pathname}`, { status: 200 })
        : new Response("not found", { status: 404 });
    }
  }
};

const request = (path, method = "GET") =>
  worker.fetch(new Request(`https://dementiacoachapp.com${path}`, { method }), env);

const assertRedirect = async (path, target, method = "GET") => {
  const response = await request(path, method);
  assert.equal(response.status, 301, `${method} ${path} should be 301`);
  assert.equal(response.headers.get("location"), `https://dementiacoachapp.com${target}`, `${method} ${path} → ${target}`);
};

test("root redirects permanently to the German home", async () => {
  await assertRedirect("/", "/de/");
  await assertRedirect("/index.html", "/de/");
});

test("legacy localized homes redirect to their language URL", async () => {
  await assertRedirect("/index-en.html", "/en/");
  await assertRedirect("/index-fr.html", "/fr/");
  await assertRedirect("/index-sv.html", "/sv/");
});

test("redirects preserve the query string", async () => {
  await assertRedirect("/?utm_source=x", "/de/?utm_source=x");
  await assertRedirect("/index-en.html?a=1&b=2", "/en/?a=1&b=2");
});

test("HEAD requests redirect like GET", async () => {
  await assertRedirect("/", "/de/", "HEAD");
  await assertRedirect("/index-en.html", "/en/", "HEAD");
});

test("unknown legacy home language is a real 404", async () => {
  assert.equal(legacyHomeTarget("/index-zz.html"), null);
  const response = await request("/index-zz.html");
  assert.equal(response.status, 404);
});

test("language homes serve their directory index without redirect loops", async () => {
  for (const path of ["/de/", "/en/", "/fr/", "/de/app/"]) {
    const response = await request(path);
    assert.equal(response.status, 200, `${path} should serve content`);
    assert.equal(await response.text(), `asset:${path}index.html`);
  }
});

test("directory URLs without slash still get the canonical slash redirect", async () => {
  await assertRedirect("/de", "/de/");
  await assertRedirect("/en", "/en/");
});

test("conditional directory requests retain the asset's 304 instead of becoming 404", async () => {
  const cachedEnv = { ASSETS: { fetch: async () => new Response(null, {
    status: 304, headers: { etag: '"cached-page"' }
  }) } };
  const response = await worker.fetch(new Request('https://dementiacoachapp.com/fr/', {
    headers: { 'if-none-match': '"cached-page"' }
  }), cachedEnv);
  assert.equal(response.status, 304);
  assert.equal(response.headers.get('etag'), '"cached-page"');
});

test("worker 404 keeps real status and does not invent redirects", async () => {
  for (const path of ["/zz/", "/nicht-da", "//evil.com/", "/index-de.html"]) {
    const response = await request(path);
    assert.equal(response.status, 404, `${path} should be 404`);
  }
});

test("non-GET methods are not redirected", async () => {
  const response = await request("/", "POST");
  assert.equal(response.status, 404);
});

test("redirect targets are fixed internal paths only", () => {
  assert.equal(legacyHomeTarget("/index-en.html"), "/en/");
  assert.equal(legacyHomeTarget("/index-EN.html"), null);
  assert.equal(legacyHomeTarget("/index-abc.html"), null);
  assert.equal(legacyHomeTarget("//evil.com/"), null);
  assert.equal(legacyHomeTarget("/de/"), null);
  assert.equal(legacyHomeTarget("/de/index.html"), null);
});

// Migration contracts use the explicit original-content digest, not a copy of rewritten output.
const { default: germanRoutes } = await import('../german-situation-routes.json', { with: { type: 'json' } });
const { germanSituationTarget } = await import('../cloudflare-worker.js');
const fs = await import('node:fs');
const { createHash } = await import('node:crypto');
const siteRoot = new URL('../', import.meta.url);
const siteRead = file => fs.readFileSync(new URL(file, siteRoot), 'utf8');
const visibleText = html => html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)[1]
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const physical = pathname => pathname.endsWith('/') ? pathname.slice(1) + 'index.html' : pathname.slice(1);
const diskEnv = { ASSETS: { fetch: async (input, request) => {
  const url = new URL(typeof input === 'string' ? input : input.url || input);
  const file = physical(decodeURIComponent(url.pathname));
  if (file.includes('..') || !fs.existsSync(new URL(file, siteRoot)) || !fs.statSync(new URL(file, siteRoot)).isFile()) return new Response('', { status: 404 });
  return new Response(request?.method === 'HEAD' ? null : siteRead(file), { headers: { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain' } });
} } };
const diskRequest = (pathname, method = 'GET') => worker.fetch(new Request('https://dementiacoachapp.com' + pathname, { method }), diskEnv);

test('52 German pages retain their visible source copy and each have one indexable static canonical', async () => {
  assert.equal(germanRoutes.pages.length, 52);
  assert.equal(new Set(germanRoutes.pages.map(p => p.to)).size, 52);
  const sitemap = siteRead('sitemap.xml');
  for (const page of germanRoutes.pages) {
    const html = siteRead(page.target);
    assert.equal(createHash('sha256').update(visibleText(html)).digest('hex'), page.visibleTextSha256, page.target + ': original visible text');
    assert.match(html, /<html lang="de"/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, page.target);
    assert.ok(html.includes('<link rel="canonical" href="https://dementiacoachapp.com' + page.to + '">'), page.target);
    assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(html), page.target);
    assert.equal((sitemap.match(new RegExp('<loc>https://dementiacoachapp\\.com' + page.to.replaceAll('.', '\\.') + '</loc>', 'g')) || []).length, 1);
    assert.ok(!sitemap.includes('<loc>https://dementiacoachapp.com' + page.from + '</loc>'));
    assert.equal((await diskRequest(page.to)).status, 200, page.to);
  }
});

test('all legacy German aliases redirect once to a real page for GET and HEAD', async () => {
  const wrangler = siteRead('wrangler.jsonc');
  const patterns = [...wrangler.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  for (const page of germanRoutes.pages) for (const alias of page.aliases) {
    assert.ok(patterns.some(p => p.endsWith('*') ? alias.startsWith(p.slice(0, -1)) : alias === p), 'Worker-first covers ' + alias);
    for (const method of ['GET', 'HEAD']) {
      const response = await diskRequest(alias, method);
      assert.equal(response.status, 301, alias);
      assert.equal(response.headers.get('location'), 'https://dementiacoachapp.com' + page.to, alias);
      assert.equal((await diskRequest(page.to, method)).status, 200, 'no redirect chain: ' + alias);
    }
  }
});

test('all 45 old situation queries use the existing fachlich chosen link and discard text fields', async () => {
  assert.equal(Object.keys(germanRoutes.situations).length, 45);
  assert.equal(germanRoutes.situations.nachhause, '/de/ratgeber/demenz-nach-hause-was-sagen.html');
  assert.equal(germanRoutes.situations.umziehen, '/de/demenz-uebersetzer/ich-ziehe-mich-nicht-um.html');
  for (const [key, target] of Object.entries(germanRoutes.situations)) {
    const response = await diskRequest('/de/?situation=' + key + '&ziel=jetzt&teller=website&utm_source=test&text=PRIVATE&prompt=PRIVATE&__proto__=bad');
    const location = new URL(response.headers.get('location'));
    assert.equal(response.status, 301);
    assert.equal(location.pathname, target.split('#')[0]);
    assert.equal(location.search, '?ziel=jetzt&teller=website&utm_source=test');
    assert.ok(!location.href.includes('PRIVATE'));
    assert.equal((await diskRequest(location.pathname + location.search)).status, 200, key);
  }
  assert.equal(germanSituationTarget(new Request('https://dementiacoachapp.com/de/?situation=unknown')), null);
  assert.equal(germanSituationTarget(new Request('https://dementiacoachapp.com/en/?situation=umziehen')), null);
  assert.equal(germanSituationTarget(new Request('https://dementiacoachapp.com/de/?situation=umziehen', { method: 'POST' })), null);
});

test('moved pages resolve their local resources and retain the existing privacy fragment', async () => {
  let assets = 0;
  for (const page of germanRoutes.pages) {
    const html = siteRead(page.target);
    for (const tag of html.matchAll(/<(?:script|img|link)\b[^>]*>/gi)) {
      for (const attr of tag[0].matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
        const url = new URL(attr[1].replaceAll('&amp;', '&'), 'https://dementiacoachapp.com' + page.to);
        if (url.origin !== 'https://dementiacoachapp.com') continue;
        const file = physical(url.pathname);
        assert.ok(fs.existsSync(new URL(file, siteRoot)), page.to + ': ' + attr[1]);
        assets++;
      }
    }
  }
  assert.ok(assets > 300);
  assert.ok(siteRead('datenschutz.html').includes('id="ki-uebersetzer"'));
});

test('reciprocal language metadata goes straight to the German canonical with no other English changes', () => {
  assert.equal(germanRoutes.hreflangSources.length, 46);
  for (const item of germanRoutes.hreflangSources) {
    const html = siteRead(item.file);
    const normalized = html.replace(/<link\b[^>]*rel="alternate"[^>]*>/g, tag =>
      /hreflang="(?:de|x-default)"/.test(tag) ? tag.replace(/href="[^"]+"/, 'href="__GERMAN_CANONICAL__"') : tag);
    assert.equal(createHash('sha256').update(normalized).digest('hex'), item.unchangedExceptAlternateHrefsSha256, item.file + ': no other byte changed');
    for (const tag of html.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/g)) {
      if (!/hreflang="(?:de|x-default)"/.test(tag[0])) continue;
      const target = /href="([^"]+)"/.exec(tag[0])[1];
      const url = new URL(target);
      assert.ok(url.pathname.startsWith('/de/'), item.file);
      const germanHTML = siteRead(physical(url.pathname));
      assert.ok(germanHTML.includes('<link rel="canonical" href="' + target + '">'), 'direct canonical target');
    }
  }
});
