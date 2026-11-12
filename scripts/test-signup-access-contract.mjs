import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
const source = await readFile(new URL('../abo/ki-freigabe.js', import.meta.url), 'utf8');
function fixture(enabled, language = 'de') {
  const host = { DEMENZ_ABO_CONFIG: { translatorGate: { enabled } }, document: { readyState: 'loading', documentElement: { lang: language }, addEventListener() {} }, addEventListener() {} };
  // No dynamic-import callback: auth cannot initialize, which exercises its
  // real failure path without creating users or requesting any model response.
  runInContext(source, createContext({ window: host }));
  return host.DemenzKiFreigabe;
}
test('a new client retains the access handshake when Firebase authentication cannot initialize', async () => {
  const value = await fixture(true).requestContext({ requestID: 'synthetic-operation' });
  assert.equal(value['X-Translator-Access-Contract'], 'signup-bonus-v1');
  assert.equal(value['X-Translator-Request-ID'], 'synthetic-operation');
  assert.equal(value.Authorization, undefined);
});
test('disabled clients retain the existing legacy transport without a handshake', async () => {
  assert.equal(Object.keys(await fixture(false).requestContext({ requestID: 'synthetic-operation' })).length, 0);
});
test('regional English uses the English signup and account return path', () => {
  for (const locale of ['en', 'en-US', 'en-GB']) assert.equal(fixture(false, locale).returnPath(), '/en/dementia-translator/');
  assert.equal(fixture(false, 'de-DE').returnPath(), '/de/');
});
