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
  const split = page.indexOf('// --- Start ');
  assert.ok(split > 0);
  for (const outcome of ["pending", "failed", "action_required", "paid", "trialing", "no_payment_due", "auth_error"]) {
    const nodes = new Map();
    const events = [];
    const calls = [];
    const node = (id) => {
      if (!nodes.has(id)) nodes.set(id, { hidden: true, textContent: "", addEventListener() {}, setAttribute() {}, classList: { add() {} } });
      return nodes.get(id);
    };
    const active = ["paid", "trialing", "no_payment_due"].includes(outcome);
    const context = createContext({
      createPaymentStatusController, paymentStatusText, URLSearchParams,
      location: { search: "?status=fertig&session_id=cs_synthetic" },
      localStorage: { getItem: () => null },
      document: { getElementById: node, querySelectorAll: () => [] },
      window: { scrollTo() {}, DEMENZ_ABO_CONFIG: { firebase: { apiKey: "synthetic" }, signIn: { apple: true }, endpoint: "https://synthetic.invalid", appStoreURL: "https://apps.apple.com/" }, DemenzConsent: { track: (...args) => events.push(args), trackMarketing: (...args) => events.push(args) } },
      fetch: async (url, options) => {
        calls.push({ url, options });
        if (url.includes("/session-status")) return { ok: outcome !== "auth_error", status: 404, json: async () => ({ status: "complete", paymentStatus: "unpaid", outcome, active }) };
        if (url.endsWith("/entitlement")) return { ok: true, json: async () => ({ active: false }) };
        assert.fail(`unexpected network call ${url}`);
      }
    });
    runInContext(page.slice(0, split), context);
    runInContext('state.auth = {}; state.user = { isAnonymous: true, getIdToken: async () => "synthetic_owner_token" };', context);
    runInContext(page.slice(split), context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls[0].options.headers.Authorization, "Bearer synthetic_owner_token");
    assert.equal(node("done-plan").hidden, !active, outcome);
    assert.equal(node("done-plan-link").hidden, !active, outcome);
    assert.equal(node("app-store-link").hidden, !active, outcome);
    assert.equal(node("payment-status-retry").hidden, active, outcome);
    assert.equal(node("done-status").textContent, paymentStatusText[outcome === "auth_error" ? "unverified" : outcome][1]);
    assert.equal(node("link-card").hidden, outcome === "auth_error", "owned pending subscriptions can secure their anonymous account");
    assert.equal(events.filter(([name]) => /purchase/iu.test(name)).length, 0, "neither fake purchase nor marketing conversion");
  }
});
