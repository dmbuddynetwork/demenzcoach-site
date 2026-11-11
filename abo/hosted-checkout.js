// Only server-created Stripe Checkout URLs may receive the customer.
export function openHostedCheckout(value) {
  if (typeof value !== "string") throw new Error("checkout_url_missing");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.port || url.username || url.password) {
    throw new Error("checkout_url_invalid");
  }
  window.location.assign(url.href);
}
