// Hosted URLs come only from the authenticated session endpoint. The callback
// still verifies payment on our server; arriving back is never proof of access.
export function hostedCheckoutURL(value) {
  if (typeof value !== "string" || value.length > 8192) throw new Error("invalid_checkout_url");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.port || url.username || url.password) {
    throw new Error("invalid_checkout_url");
  }
  return url.href;
}

export function createHostedCheckoutRedirect(navigate) {
  const redirected = new WeakSet();
  return (session, { attempt = session, isCurrent = () => true } = {}) => {
    if (session?.checkoutMode !== "hosted") return false;
    // A changed plan, account or closed sheet must not redirect a stale reply.
    if (!isCurrent()) return true;
    const url = hostedCheckoutURL(session.url);
    if (redirected.has(attempt)) return true;
    redirected.add(attempt);
    try { navigate(url, attempt); }
    catch (error) { redirected.delete(attempt); throw error; }
    return true;
  };
}

// Reserve during the user's click, before requesting the authenticated session.
// Mobile and blocked popups keep the normal same-tab redirect. Nothing here
// interprets a closed window as a payment result.
const preparingWindows = new WeakMap();
export function reserveCheckoutWindow(browser) {
  if (!browser?.matchMedia?.("(min-width: 1000px) and (pointer: fine)").matches) return null;
  if (browser.navigator?.userActivation?.isActive === false) return null;
  const existing = preparingWindows.get(browser);
  if (existing && !existing.closed) { existing.focus(); return existing; }
  const screen = browser.screen || {};
  const width = Math.min(600, Math.max(320, (screen.availWidth || browser.innerWidth) - 32));
  const height = Math.min(860, Math.max(320, (screen.availHeight || browser.innerHeight) - 64));
  const left = Math.round((screen.availLeft || 0) + ((screen.availWidth || browser.innerWidth) - width) / 2);
  const top = Math.round((screen.availTop || 0) + ((screen.availHeight || browser.innerHeight) - height) / 2);
  let child;
  try { child = browser.open("/abo/checkout-opening.html", "_blank", `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`); }
  catch { return null; }
  if (!child) return null;
  try { child.opener = null; } catch { child.close(); return null; }
  let handedOff = false;
  const forget = () => { if (preparingWindows.get(browser) === ticket) preparingWindows.delete(browser); };
  const ticket = {
    get closed() { return child.closed; },
    get handedOff() { return handedOff; },
    focus() { try { if (child.closed) return false; child.focus(); return true; } catch { return false; } },
    navigate(value) {
      const url = hostedCheckoutURL(value);
      if (child.closed) throw Object.assign(new Error("checkout_window_closed"), { code: "checkout_window_closed" });
      child.location.replace(url);
      handedOff = true;
      forget();
    },
    discard() {
      // Never discard a real payment form: it may contain unsaved input or a
      // completed payment whose protected return has not loaded yet.
      if (handedOff) return;
      forget();
      try { if (!child.closed) child.close(); } catch { /* Already gone. */ }
    }
  };
  preparingWindows.set(browser, ticket);
  return ticket;
}
