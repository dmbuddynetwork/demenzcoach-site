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
    try { navigate(url); }
    catch (error) { redirected.delete(attempt); throw error; }
    return true;
  };
}
