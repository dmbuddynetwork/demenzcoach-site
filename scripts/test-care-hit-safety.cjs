// Ausholen bei der Pflege: kein Kasten „Erst die Sicherheit“; echte Gewalt bleibt. Dieselben Regeln wie backend/server.mjs (careHit*).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const box = { window: {}, module: { exports: {} } };
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(root, 'demenz-uebersetzer/translator-core.js'), 'utf8'), box);
const html = fs.readFileSync(path.join(root, 'de/index.html'), 'utf8');
const data = JSON.parse(html.match(/id="translator-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const hit = (text) => box.window.DemenzTranslatorCore.match(text, data).safetyHit;
const quiet = [
  'Er schlägt nach mir, wenn ich ihn wasche', 'Mama schlägt um sich, wenn ich sie anziehe',
  'Papa schlägt nach mir beim Duschen', 'Opa schlägt wild um sich, wenn ich ihm die Windel wechsle',
  'Er schlägt nach mir, wenn ich ihm die Zähne putzen will'
];
const alarm = [
  'Er schlägt mich, wenn ich ihn wasche', 'Er schlägt nach mir', 'Er schlägt nach mir mit einem Stock, wenn ich ihn wasche',
  'Er schlägt nach mir beim Waschen und trifft mich im Gesicht', 'Er schlägt nach mir beim Waschen und ich blute',
  'Er schlägt nach mir beim Waschen, er hat mich gebissen', 'Oma schlägt nach der Pflegerin, wenn sie gewaschen wird',
  'Er schlägt nach unserer Tochter beim Baden', 'Opa schlägt wild um sich beim Anziehen und droht mir',
  'Er schlägt nach mir beim Duschen, ich habe Todesangst', 'Er schlägt nach mir beim Anziehen. Gestern hat er mich geschlagen.'
];
for (const text of quiet) assert.equal(hit(text), false, text);
for (const text of alarm) assert.equal(hit(text), true, text);
console.log(JSON.stringify({ passed: true, quiet: quiet.length, alarm: alarm.length }));
