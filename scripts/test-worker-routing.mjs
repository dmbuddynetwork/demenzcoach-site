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
