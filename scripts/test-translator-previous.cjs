// Nachfrage im Übersetzer: Die zuletzt gezeigte Antwort geht als „previous“ mit (Backend seit 26. Nov 2026, main 6aa206b).
// Nur bei Nachfragen („Situation: „…“ Nachfrage: …“), höchstens 400 Zeichen, immer ein String. Läuft ohne Browser und ohne Netz.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'demenz-uebersetzer', 'translator-ai.js'), 'utf8');
const sent = [];
let reply = null;
const sandbox = {
  console, TextEncoder, AbortController, setTimeout, clearTimeout,
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  fetch: async (url, init) => { sent.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, status: 200, headers: { get: () => null }, json: async () => reply }; }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox);
const ai = sandbox.DemenzTranslatorAI;
const answer = { kind: 'answer', meaning: 'Sie hat Angst.', phrases: ['Ich bin bei dir.', 'Wir schauen gemeinsam nach.'], avoid: 'Nicht widersprechen.', nextStep: 'Setz dich neben sie.', safetyLevel: 'standard', safetyMessage: null };
(async () => {
  reply = answer;
  // 1) Erste Frage: kein previous.
  await ai.ask('Mama sagt, jemand ist im Zimmer.');
  assert.equal(Object.hasOwn(sent[0].body, 'previous'), false);
  // 2) Nachfrage: previous = Sätze + „ Tun: “ + nächster Schritt.
  await ai.ask('Situation: „Mama sagt, jemand ist im Zimmer.“ Nachfrage: Das klappt nicht.');
  assert.equal(sent[1].body.previous, 'Ich bin bei dir. Wir schauen gemeinsam nach. Tun: Setz dich neben sie.');
  assert.equal(sent[1].body.text, 'Situation: „Mama sagt, jemand ist im Zimmer.“ Nachfrage: Das klappt nicht.');
  // 3) Auch die Zielklärung bei einer Nachfrage bekommt previous; eine neue Situation nicht.
  reply = { kind: 'goals', noSituation: false, goals: [{ goal: 'act_now', label: 'A' }, { goal: 'understand', label: 'B' }, { goal: 'self_care', label: 'C' }] };
  await ai.askGoals('Situation: „Mama sagt, jemand ist im Zimmer.“ Nachfrage: Sie schreit.');
  assert.match(sent[2].url, /\/goals\?/);
  assert.equal(typeof sent[2].body.previous, 'string');
  await ai.askGoals('Papa will nicht essen.');
  assert.equal(Object.hasOwn(sent[3].body, 'previous'), false);
  // 4) Höchstens 400 Zeichen.
  reply = { ...answer, phrases: ['x'.repeat(300), 'y'.repeat(300)] };
  await ai.ask('Papa will nicht essen.');
  reply = answer;
  await ai.ask('Situation: „Papa will nicht essen.“ Nachfrage: Und jetzt?');
  assert.equal(Array.from(sent[5].body.previous).length, 400);
  // 5) Aus dem Zwischenspeicher gezeigte Antworten werden über remember() die neue Grundlage.
  ai.remember({ kind: 'clarification', question: 'Wann passiert das meistens?', meaning: 'x', nextStep: 'y' });
  await ai.ask('Situation: „Papa will nicht essen.“ Nachfrage: Abends.');
  assert.equal(sent[6].body.previous, 'Wann passiert das meistens?');
  console.log(JSON.stringify({ ok: true, cases: 5 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
