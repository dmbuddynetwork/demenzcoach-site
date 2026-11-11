import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../abo/checkout-redirect.js", import.meta.url), "utf8");
const { hostedCheckoutURL, createHostedCheckoutRedirect } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const session = { checkoutMode: "hosted", url: "https://checkout.stripe.com/c/pay/cs_fixture#provider-state" };

test("only the provider's HTTPS checkout origin is accepted, preserving provider state", () => {
  assert.equal(hostedCheckoutURL(session.url), session.url);
  for (const value of [undefined, "", "javascript:alert(1)", "http://checkout.stripe.com/pay", "https://checkout.stripe.com.evil.example/pay", "https://evil.example/pay", "https://user@checkout.stripe.com/pay", "https://checkout.stripe.com:444/pay"]) {
    assert.throws(() => hostedCheckoutURL(value));
  }
});

test("a legacy clientSecret response stays on the Elements path", () => {
  const navigate = [];
  assert.equal(createHostedCheckoutRedirect((url) => navigate.push(url))({ clientSecret: "fixture" }), false);
  assert.deepEqual(navigate, []);
});

test("one checkout attempt redirects only once, even with duplicate replies", () => {
  const navigate = [], attempt = {};
  const redirect = createHostedCheckoutRedirect((url) => navigate.push(url));
  assert.equal(redirect(session, { attempt }), true);
  assert.equal(redirect({ ...session }, { attempt }), true);
  assert.deepEqual(navigate, [session.url]);
});

test("a changed plan/account or closed sheet cannot redirect a stale reply", () => {
  const navigate = [], attempt = {};
  const redirect = createHostedCheckoutRedirect((url) => navigate.push(url));
  assert.equal(redirect(session, { attempt, isCurrent: () => false }), true);
  assert.deepEqual(navigate, []);
  redirect(session, { attempt, isCurrent: () => true });
  assert.deepEqual(navigate, [session.url]);
});

test("a genuine new attempt after Cancel can reopen the same provider session", () => {
  const navigate = [];
  const redirect = createHostedCheckoutRedirect((url) => navigate.push(url));
  redirect(session, { attempt: {} });
  redirect(session, { attempt: {} });
  assert.deepEqual(navigate, [session.url, session.url]);
});

test("a blocked navigation can be retried, without falling back to success", () => {
  let count = 0;
  const attempt = {};
  const redirect = createHostedCheckoutRedirect(() => { count++; if (count === 1) throw new Error("blocked"); });
  assert.throws(() => redirect(session, { attempt }));
  assert.equal(redirect(session, { attempt }), true);
  assert.equal(count, 2);
});

test("a malformed hosted reply never navigates or quietly mounts an embedded checkout", () => {
  let navigated = false;
  const redirect = createHostedCheckoutRedirect(() => { navigated = true; });
  assert.throws(() => redirect({ checkoutMode: "hosted", url: "https://evil.example/pay" }));
  assert.equal(navigated, false);
});
