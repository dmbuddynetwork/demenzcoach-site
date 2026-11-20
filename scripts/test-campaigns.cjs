// Kampagnen-Framework: Regeln, Aktualität von data.js, Landingpage je Kampagne, Tracking-Felder. Nur lokale Testdaten.
const assert = require('node:assert/strict'), fs = require('node:fs'), { execFileSync } = require('node:child_process');
const regeln = require('../kampagnen/regeln.js');
const daten = JSON.parse(fs.readFileSync(__dirname + '/../intern/kampagnen/kampagnen.json', 'utf8'));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
(async () => {
  const report = [];
  // 1 Regeln
  assert.deepEqual(regeln.pruefe(daten), [], 'Beispieldaten sind gültig');
  const kopie = (f) => { const d = JSON.parse(JSON.stringify(daten)); f(d); return regeln.pruefe(d); };
  assert.ok(kopie(d => { d.kampagnen[1].landing.ueberschrift = 'Diagnose und Therapie für Mama'; }).some(m => /medizinisch/.test(m)), 'medizinisch wird abgelehnt');
  assert.ok(kopie(d => { d.kampagnen[1].anzeigen[0].text = 'Über 1,7 Millionen Familien vertrauen uns'; }).some(m => /Beleg/.test(m)), 'erfundene Zahl wird abgelehnt');
  assert.ok(kopie(d => { d.kampagnen[1].anzeigen[0].text = 'Nur heute: Letzte Chance'; }).some(m => /Dringlichkeit/.test(m)), 'falsche Dringlichkeit wird abgelehnt');
  assert.ok(kopie(d => { d.kampagnen[1].landing.moment = 'quatsch'; }).some(m => /moment/.test(m)), 'unbekannter Moment');
  assert.ok(kopie(d => { d.kampagnen[2].id = d.kampagnen[1].id; }).some(m => /doppelt/.test(m)), 'doppelte id');
  assert.ok(kopie(d => { d.kampagnen[1].landing.ueberschrift = 'x'.repeat(71); }).some(m => /Zeichen/.test(m)), 'zu lang');
  assert.match(regeln.link(daten.kampagnen[1], 'a2'), /^https:\/\/dementiacoachapp\.com\/start\/\?k=nach-hause&a=a2&src=meta&utm_source=meta&utm_medium=paid&utm_campaign=nach-hause&utm_content=a2$/);
  report.push('Regeln');
  // 2 data.js aktuell
  execFileSync('node', [__dirname + '/build-campaigns.mjs', '--check']); report.push('data.js aktuell');
  // 3 Landingpage
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  const open = async (query, track) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); c.setDefaultTimeout(8000);
    await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
    await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
    const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(`${preview.origin}/start/${query}`); await p.locator('#screen h1').waitFor();
    if (track) await p.evaluate(() => { window.__events = []; window.DemenzConsent.track = (n, x) => window.__events.push([n, x]); });
    return { c, p, errors };
  };
  const h1 = async (p) => (await p.locator('#screen h1').textContent()).trim();
  let s = await open(''); assert.equal(await h1(s.p), 'Tipps und Tricks zum Ausdrucken'); assert.equal(await s.p.locator('#screen h1.start-hero').count(), 1); await s.c.close(); report.push('ohne Kampagne = Standard');
  s = await open('?k=tipps-druck&a=a1'); assert.equal(await h1(s.p), 'Tipps und Tricks zum Ausdrucken'); await s.c.close(); report.push('aktive Kampagne');
  s = await open('?k=nach-hause&a=a1'); assert.equal(await h1(s.p), 'Tipps und Tricks zum Ausdrucken', 'Entwurf ohne vorschau bleibt unsichtbar'); await s.c.close(); report.push('Entwurf versteckt');
  s = await open('?k=gibt-es-nicht'); assert.equal(await h1(s.p), 'Tipps und Tricks zum Ausdrucken'); await s.c.close(); report.push('unbekannte Kampagne');
  const entwurf = daten.kampagnen.find(k => k.id === 'nach-hause');
  assert.ok(!fs.readFileSync(__dirname + '/../kampagnen/data.js', 'utf8').includes('nach-hause'), 'Entwürfe stehen nicht in der öffentlichen data.js');
  s = await open('?k=nach-hause&a=a1&vorschau=1#v=' + encodeURIComponent(JSON.stringify({ landing: entwurf.landing, src: entwurf.kanal })), true);
  assert.equal(await h1(s.p), 'Was sagst du, wenn sie nach Hause will?');
  await s.p.locator('.start-pic').first().click();
  await s.p.waitForFunction(() => window.__events.length > 0);
  assert.match(await s.p.evaluate(() => sessionStorage.getItem('demenzCoachQuizProgress.v1')), /"context":"\[\\"meta\\",\\"nachhause\\"\]"/, 'Moment aus der Kampagne ist gesetzt');
  const ev = await s.p.evaluate(() => window.__events);
  assert.ok(ev.length > 0 && ev.every(([, x]) => x.kampagne === 'nach-hause' && x.anzeige === 'a1'), 'jeder Schritt trägt Kampagne und Anzeige: ' + JSON.stringify(ev));
  assert.deepEqual(s.errors, []); await s.c.close(); report.push('Entwurf mit Vorschau, Moment, Tracking');
  s = await open('?k=nach-hause&vorschau=1#v=' + encodeURIComponent(JSON.stringify({ landing: { ueberschrift: 'Testtext aus der Verwaltung', frage: 'Wer braucht Hilfe?', grossbuchstaben: false, moment: '' } })));
  assert.equal(await h1(s.p), 'Testtext aus der Verwaltung'); assert.equal((await s.p.locator('#screen h2.start-question').textContent()).trim(), 'Wer braucht Hilfe?'); assert.equal(await s.p.locator('#screen h1.start-hero').count(), 0);
  await s.c.close(); report.push('Vorschau mit ungespeicherten Änderungen');
  s = await open('?m=wer'); assert.match(await h1(s.p), /Wer sind Sie/); await s.c.close(); report.push('alter ?m= bleibt');
  await browser.close(); await preview.close();
  console.log(JSON.stringify({ ok: true, cases: report }));
})().catch(e => { console.error(e); process.exit(1); });
