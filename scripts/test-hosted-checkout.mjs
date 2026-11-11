import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../abo/checkout-redirect.js", import.meta.url), "utf8");
const { hostedCheckoutURL, createHostedCheckoutRedirect, reserveCheckoutWindow } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
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

function windowFixture({ desktop = true, active = true, blocked = false } = {}) {
  const calls = [], children = [];
  const browser = {
    matchMedia: () => ({ matches: desktop }), navigator: { userActivation: { isActive: active } },
    screen: { availWidth: 1440, availHeight: 1080, availLeft: 0, availTop: 0 },
    open(...args) {
      calls.push(args); if (blocked) return null;
      const child = { closed: false, opener: browser, focused: 0, url: null,
        focus() { this.focused++; }, close() { this.closed = true; }, location: { replace(url) { child.url = url; } } };
      children.push(child); return child;
    }
  };
  return { browser, calls, children };
}

test("desktop reserves one centered narrow window during the click; opener is removed", () => {
  const { browser, calls, children } = windowFixture();
  const ticket = reserveCheckoutWindow(browser);
  assert.equal(reserveCheckoutWindow(browser), ticket);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["/abo/checkout-opening.html", "_blank", "popup=yes,width=600,height=860,left=420,top=110,resizable=yes,scrollbars=yes"]);
  assert.equal(children[0].opener, null);
  ticket.navigate(session.url);
  assert.equal(children[0].url, session.url);
  assert.equal(ticket.handedOff, true);
  ticket.discard();
  assert.equal(children[0].closed, false, "never close a handed-off financial form");
});

test("mobile, inactive user gestures and blocked windows retain the existing same-tab path", () => {
  for (const options of [{ desktop: false }, { active: false }, { blocked: true }]) {
    const f = windowFixture(options);
    assert.equal(reserveCheckoutWindow(f.browser), null);
    assert.equal(f.calls.length, options.blocked ? 1 : 0);
  }
});

test("closed preparation is a neutral cancellation, not a surprise same-tab navigation", () => {
  const f = windowFixture(), ticket = reserveCheckoutWindow(f.browser);
  f.children[0].closed = true;
  assert.throws(() => ticket.navigate(session.url), { code: "checkout_window_closed" });
  assert.equal(f.children[0].url, null);
  assert.equal(ticket.handedOff, false);
  assert.equal(ticket.focus(), false);
});

test("discarding a stale attempt closes only its preparation window; a retry gets a new one", () => {
  const f = windowFixture(), ticket = reserveCheckoutWindow(f.browser);
  ticket.discard();
  assert.equal(f.children[0].closed, true);
  const next = reserveCheckoutWindow(f.browser);
  assert.notEqual(next, ticket);
  next.navigate(session.url);
  ticket.discard();
  assert.equal(f.children[1].closed, false);
});

test("invalid provider URLs never leave the preparation window", () => {
  const f = windowFixture(), ticket = reserveCheckoutWindow(f.browser);
  assert.throws(() => ticket.navigate("https://other.example/pay"));
  assert.equal(f.children[0].url, null);
  ticket.discard();
});
