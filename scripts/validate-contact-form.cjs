// Exercise the email-preparation handler without opening an email app or sending.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../lovable-home.js'), 'utf8');
const handler = script.match(/document\.querySelectorAll\('\[data-contact-form\]'\)[\s\S]*?\n\}\);/)[0];
for (const valid of [false, true]) {
  let submit;
  const events = [];
  const form = { dataset: { recipient: 'demenzcoachapp@gmail.com' }, reportValidity: () => valid, addEventListener: (_, fn) => { submit = fn; } };
  const location = { href: '' };
  vm.runInNewContext(handler, {
    document: { querySelectorAll: () => [form] },
    window: { location },
    websiteAnalytics: { track: (event, data) => events.push({ event, data }) },
    FormData: class { get(key) { return { name: 'Test', subject: 'Frage & Hilfe', message: 'Nur ein Test.\nKeine echten Angaben.' }[key]; } },
    encodeURIComponent,
  });
  let prevented = false;
  submit({ preventDefault: () => { prevented = true; } });
  assert.ok(prevented);
  if (!valid) { assert.equal(location.href, ''); assert.equal(events.length, 0); continue; }
  const url = new URL(location.href);
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, 'demenzcoachapp@gmail.com');
  assert.equal(url.searchParams.get('subject'), 'Frage & Hilfe');
  assert.equal(url.searchParams.get('body'), 'Name: Test\n\nNur ein Test.\nKeine echten Angaben.');
  assert.equal(JSON.stringify(events), JSON.stringify([{ event: 'support_contact_click', data: { contact_method: 'prepared_email' } }]));
}
console.log('Contact form passed: validation, recipient, encoding, no message content in analytics; no email sent.');
