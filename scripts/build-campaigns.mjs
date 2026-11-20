// Prüft kampagnen/kampagnen.json mit den Regeln und schreibt kampagnen/data.js (wird von /start/ geladen).
// Aufruf: node scripts/build-campaigns.mjs [--check]   (--check schreibt nichts und prüft, ob data.js aktuell ist)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const regeln = require('../kampagnen/regeln.js');
const quelle = new URL('../kampagnen/kampagnen.json', import.meta.url), ziel = new URL('../kampagnen/data.js', import.meta.url);
const daten = JSON.parse(readFileSync(quelle, 'utf8'));
const fehler = regeln.pruefe(daten);
if (fehler.length) { console.error('Kampagnen-Prüfung fehlgeschlagen:\n- ' + fehler.join('\n- ')); process.exit(1); }
// Nur das, was die Seite braucht: keine Notizen, keine Zielgruppen, keine Anzeigentexte.
const oeffentlich = { version: daten.version, standard: daten.standard, kampagnen: daten.kampagnen.filter(k => k.status !== 'pausiert').map(k => ({ id: k.id, status: k.status, kanal: k.kanal, src: k.tracking?.src || k.kanal, landing: k.landing })) };
const inhalt = `// Erzeugt von scripts/build-campaigns.mjs aus kampagnen/kampagnen.json. Nicht von Hand ändern.\nwindow.DEMENZ_KAMPAGNEN = ${JSON.stringify(oeffentlich)};\n`;
if (process.argv.includes('--check')) {
  if (!existsSync(ziel) || readFileSync(ziel, 'utf8') !== inhalt) { console.error('kampagnen/data.js ist nicht aktuell: node scripts/build-campaigns.mjs'); process.exit(1); }
  console.log(`Kampagnen ok: ${daten.kampagnen.length} Kampagnen, data.js aktuell`);
} else { writeFileSync(ziel, inhalt); console.log(`kampagnen/data.js geschrieben (${oeffentlich.kampagnen.length} Kampagnen)`); }
