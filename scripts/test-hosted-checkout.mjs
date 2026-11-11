import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const source = await readFile(new URL('../abo/hosted-checkout.js', import.meta.url), 'utf8');
const { openHostedCheckout } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('redirects only to HTTPS Stripe Checkout, preserving its complete session URL', () => {
  const previous = globalThis.window;
  const redirected = [];
  globalThis.window = { location: { assign: url => redirected.push(url) } };
  try {
    for (const input of [undefined, null, '', '/relative', 'javascript:alert(1)', 'http://checkout.stripe.com/c/pay/x',
      'https://checkout.stripe.com.evil.invalid/pay', 'https://checkout.stripe.com@evil.invalid/pay',
      'https://user:password@checkout.stripe.com/pay', 'https://checkout.stripe.com:8443/pay']) {
      assert.throws(() => openHostedCheckout(input));
    }
    assert.deepEqual(redirected, []);
    const url = 'https://checkout.stripe.com/c/pay/cs_test_preview#stripe-fragment';
    openHostedCheckout(url);
    assert.deepEqual(redirected, [url]);
  } finally {
    if (previous === undefined) delete globalThis.window; else globalThis.window = previous;
  }
});
