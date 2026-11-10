import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Das Site-Repo hat kein package.json; das echte Browser-Modul als ES-Modul laden.
const source = await readFile(new URL("../abo/payment-status.js", import.meta.url), "utf8");
const { createPaymentStatusController } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("no success before the protected server response; paid and trial stay distinct", async () => {
  let resolve;
  const views = [];
  let activations = 0;
  const check = createPaymentStatusController({ sessionID: "cs_synthetic", loadStatus: () => new Promise((done) => { resolve = done; }), render: (view) => views.push(view), activate: () => { activations += 1; } });
  const pending = check();
  assert.deepEqual(views, ["checking"]);
  assert.equal(activations, 0);
  resolve({ status: "complete", active: true, outcome: "trialing" });
  await pending;
  assert.equal(views.at(-1), "trialing");
  assert.equal(activations, 1);
  const paid = check();
  resolve({ status: "complete", active: true, outcome: "paid" });
  await paid;
  assert.equal(views.at(-1), "paid");
  assert.equal(activations, 1, "manual retries do not repeat account/upgrade actions");
});

test("unpaid completion, expired, missing proof, failure, auth and network errors never activate", async () => {
  for (const response of [
    { status: "complete", paymentStatus: "unpaid", outcome: "pending", active: false },
    { status: "complete", paymentStatus: "no_payment_required" },
    { status: "expired", outcome: "paid", active: true },
    { status: "complete", outcome: "failed", active: false },
    { status: "complete", outcome: "action_required", active: false },
    { status: "complete", paymentStatus: "paid", outcome: "paid", active: false },
    new Error("session_not_found"), new Error("network")
  ]) {
    const views = [];
    let activations = 0;
    const check = createPaymentStatusController({ sessionID: "cs_synthetic", loadStatus: async () => { if (response instanceof Error) throw response; return response; }, render: (view) => views.push(view), activate: () => { activations += 1; } });
    await check();
    assert.equal(activations, 0);
    assert.ok(!["paid", "trialing"].includes(views.at(-1)));
  }
});

test("a forged return URL without a session never loads status or activates", async () => {
  const views = [];
  const check = createPaymentStatusController({ sessionID: null, loadStatus: () => assert.fail("must not load"), render: (view) => views.push(view), activate: () => assert.fail("must not activate") });
  await check();
  assert.equal(views.at(-1), "unverified");
});

test("actual return-page code sends the owner token, hides pending access and emits no purchase", async () => {
  const { createContext, runInContext } = await import("node:vm");
  const { paymentStatusText } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const page = (await readFile(new URL("../abo/abo.js", import.meta.url), "utf8")).replace(/^import .*payment-status.js.*;\n/mu, "");
  const emailModule = await readFile(new URL("../abo/email-auth.js", import.meta.url), "utf8");
  const { emailAccountURL } = await import(`data:text/javascript;base64,${Buffer.from(emailModule).toString("base64")}`);
  const code = page.replace(/^import .*email-auth.js.*;\n/mu, "");
  const split = code.indexOf('// --- Start ');
  assert.ok(split > 0);
  for (const outcome of ["pending", "failed", "action_required", "paid", "trialing", "no_payment_due", "auth_error", "legacy_paid", "legacy_unpaid", "legacy_no_payment_required", "signed_out", "token_error"]) {
    const nodes = new Map();
    const events = [];
    const calls = [];
    const node = (id) => {
      if (!nodes.has(id)) nodes.set(id, { hidden: true, textContent: "", handlers: {}, addEventListener(name, handler) { this.handlers[name] = handler; }, setAttribute() {}, replaceChildren(...children) { this.children = children; }, classList: { add() {} } });
      return nodes.get(id);
    };
    const active = ["paid", "trialing", "no_payment_due"].includes(outcome);
    const context = createContext({
      createPaymentStatusController, paymentStatusText, emailAccountURL, URLSearchParams,
      location: { search: "?status=fertig&session_id=cs_synthetic", origin: "https://dementiacoachapp.com" },
      localStorage: { getItem: () => null },
      document: { getElementById: node, querySelectorAll: (selector) => selector === "[data-manage]" ? [node("payment-status-manage")] : [] },
      window: { scrollTo() {}, DEMENZ_ABO_CONFIG: { firebase: { apiKey: "synthetic" }, signIn: { apple: true }, endpoint: "https://synthetic.invalid", appStoreURL: "https://apps.apple.com/" }, DemenzConsent: { track: (...args) => events.push(args), trackMarketing: (...args) => events.push(args) } },
      fetch: async (url, options) => {
        calls.push({ url, options });
        if (url.includes("/session-status")) return { ok: outcome !== "auth_error", status: 404, json: async () => outcome.startsWith("legacy_")
          ? { status: "complete", paymentStatus: outcome.slice("legacy_".length) }
          : { status: "complete", paymentStatus: "unpaid", outcome, active } };
        if (url.endsWith("/portal")) return { ok: true, json: async () => ({ url: "https://billing.stripe.com/p/synthetic-own-customer" }) };
        if (url.endsWith("/entitlement")) return { ok: true, json: async () => ({ active: false }) };
        assert.fail(`unexpected network call ${url}`);
      }
    });
    runInContext(code.slice(0, split), context);
    runInContext(`state.auth = {}; state.user = ${outcome === "signed_out" ? "null" : `{ isAnonymous: true, getIdToken: async () => ${outcome === "token_error" ? '{ throw new Error("token unavailable"); }' : '"synthetic_owner_token"'} }`};`, context);
    runInContext(code.slice(split), context);
    await new Promise((resolve) => setImmediate(resolve));
    const authenticated = !["signed_out", "token_error"].includes(outcome);
    if (authenticated) assert.equal(calls[0].options.headers.Authorization, "Bearer synthetic_owner_token");
    else assert.equal(calls.length, 0);
    assert.equal(node("done-plan").hidden, !active, outcome);
    assert.equal(node("done-plan-link").hidden, !active, outcome);
    assert.equal(node("app-store-link").hidden, !active, outcome);
    assert.equal(node("payment-status-retry").hidden, active, outcome);
    const view = outcome.startsWith("legacy_") ? "legacy" : ["auth_error", "signed_out", "token_error"].includes(outcome) ? "unverified" : outcome;
    assert.equal(node("done-status").textContent, paymentStatusText[view][1]);
    assert.equal(node("link-card").hidden, !authenticated, "only the current authenticated guest can secure its own account");
    assert.equal(node("payment-status-manage").hidden, !authenticated || active);
    if (outcome.startsWith("legacy_")) {
      assert.equal(calls.some(({ url }) => url.endsWith("/entitlement")), false, "no entitlement-based legacy success");
      await node("payment-status-manage").handlers.click();
      assert.equal(calls.at(-1).options.method, "POST");
      assert.equal(calls.at(-1).options.headers.Authorization, "Bearer synthetic_owner_token");
      assert.equal(context.location.href, "https://billing.stripe.com/p/synthetic-own-customer");
    }
    assert.equal(events.filter(([name]) => /purchase/iu.test(name)).length, 0, "neither fake purchase nor marketing conversion");
  }
});

// Optional real-page smoke: existing Playwright/Chrome, all external services
// intercepted. No live account, payment, portal session, mail or phone operation.
test("isolated actual page supports legacy recovery and strict rich states", { skip: !process.env.PAYMENT_STATUS_BROWSER }, async () => {
  const { createRequire } = await import("node:module");
  const { createServer } = await import("node:http");
  const { resolve, extname, sep } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2" };
  const server = createServer(async (request, response) => {
    try {
      let pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/fixture-own-portal") { response.end("<h1>Synthetic own portal</h1>"); return; }
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = resolve(root, "." + pathname);
      if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error("outside fixture root");
      response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
      response.end(await readFile(file));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const rows = [
      ...["paid", "unpaid", "no_payment_required"].map((paymentStatus) => ({ label: `legacy-${paymentStatus}`, status: { status: "complete", paymentStatus }, view: "Prüfe deinen Zahlungsstatus", active: false })),
      { label: "rich-paid", status: { status: "complete", outcome: "paid", active: true }, view: "Deine Zahlung ist bestätigt", active: true },
      { label: "rich-trial", status: { status: "complete", outcome: "trialing", active: true }, view: "Deine Probezeit ist aktiv", active: true },
      { label: "rich-pending", status: { status: "complete", outcome: "pending", active: false }, view: "Deine Zahlung wird noch geprüft", active: false },
      { label: "rich-failed", status: { status: "complete", outcome: "failed", active: false }, view: "Dein Zugang ist noch nicht freigeschaltet", active: false },
      { label: "status-error", error: true, view: "Zahlungsstatus noch nicht bestätigt", active: false },
      { label: "network-error", networkError: true, view: "Zahlungsstatus noch nicht bestätigt", active: false },
      { label: "legacy-portal-error", status: { status: "complete", paymentStatus: "unpaid" }, portalError: true, view: "Prüfe deinen Zahlungsstatus", active: false },
      { label: "legacy-own-permanent-account", status: { status: "complete", paymentStatus: "paid" }, permanent: true, emailVerified: true, view: "Prüfe deinen Zahlungsstatus", active: false },
      { label: "legacy-own-phone-account", status: { status: "complete", paymentStatus: "paid" }, permanent: true, emailVerified: false, view: "Prüfe deinen Zahlungsstatus", active: false },
      { label: "signed-out", signedOut: true, view: "Zahlungsstatus noch nicht bestätigt", active: false }
    ];
    for (const row of rows) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      const calls = [], errors = [];
      try {
        await context.route("**/*", async (route) => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin === origin) return route.continue();
          const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization,Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
          if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
          if (url.pathname.endsWith("/firebase-app.js")) return route.fulfill({ contentType: "text/javascript", body: "export const initializeApp=()=>({});", headers });
          if (url.pathname.endsWith("/firebase-auth.js")) {
            const user = row.signedOut ? "null" : `{isAnonymous:${!row.permanent},emailVerified:${row.emailVerified === true},getIdToken:async()=>"fixture-owner-token"}`;
            return route.fulfill({ contentType: "text/javascript", headers, body: `const user=${user}; export const getAuth=()=>({currentUser:user}); export const getRedirectResult=async()=>null; export const onAuthStateChanged=(auth,cb)=>{setTimeout(()=>cb(user),0);return ()=>{}};` });
          }
          if (url.hostname.endsWith("cloudfunctions.net")) {
            calls.push({ path: url.pathname, method: request.method(), token: request.headers().authorization, body: request.postData() });
            if (url.pathname.endsWith("/session-status")) return row.networkError ? route.abort() : route.fulfill({ headers, status: row.error ? 404 : 200, json: row.status || {} });
            if (url.pathname.endsWith("/entitlement")) return route.fulfill({ headers, json: { active: false } });
            if (url.pathname.endsWith("/portal")) return route.fulfill({ headers, status: row.portalError ? 500 : 200, json: { url: origin + "/fixture-own-portal" } });
            assert.fail(`unexpected backend operation ${url.pathname}`);
          }
          return route.abort();
        });
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(origin + "/abo/?status=fertig&session_id=cs_synthetic_legacy", { waitUntil: "domcontentloaded" });
        await page.waitForFunction((expected) => document.getElementById("done-title")?.textContent === expected, row.view);
        assert.equal(await page.locator("#done-plan").isVisible(), row.active, row.label);
        assert.equal(await page.locator("#done-plan-link").isVisible(), row.active, row.label);
        assert.equal(await page.locator("#link-card").isVisible(), !row.signedOut && !row.emailVerified, row.label);
        assert.equal(await page.locator("#payment-status-manage").isVisible(), !row.signedOut && !row.active, row.label);
        assert.equal(await page.evaluate(() => (window.dataLayer || []).some((entry) => entry[0] === "event" && /purchase/iu.test(entry[1]))), false);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        if (row.label.startsWith("legacy-")) {
          assert.equal(calls.some(({ path }) => path.endsWith("/entitlement")), false);
          if (process.env.PAYMENT_STATUS_SCREENSHOTS && row.label === "legacy-unpaid") {
            const { mkdir } = await import("node:fs/promises");
            await mkdir(process.env.PAYMENT_STATUS_SCREENSHOTS, { recursive: true });
            await page.screenshot({ path: resolve(process.env.PAYMENT_STATUS_SCREENSHOTS, "legacy-return-mobile.png"), fullPage: true });
          }
          await page.locator("#payment-status-manage").click();
          if (row.portalError) {
            await page.locator("#error").waitFor({ state: "visible" });
            assert.equal(new URL(page.url()).pathname, "/abo/");
            assert.equal(await page.locator("#done-plan").isVisible(), false);
          } else await page.waitForURL(origin + "/fixture-own-portal");
          const portal = calls.find(({ path }) => path.endsWith("/portal"));
          assert.deepEqual({ method: portal.method, token: portal.token, body: portal.body }, { method: "POST", token: "Bearer fixture-owner-token", body: null });
        }
        assert.deepEqual(errors, [], row.label);
      } finally { await context.close(); }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((done) => server.close(done));
  }
});
