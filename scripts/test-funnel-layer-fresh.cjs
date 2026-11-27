// Der Funnel-Layer von unten zeigt seit 27. Nov 2026 direkt die Angebotsseite (Daniel: Fragebogen nur für Ads), auch mit gespeichertem Stand.
// Seit Daniels zweiter Vorgabe (27. Nov: „wenn Niemand den Fragebogen beantwortet …“) sehen auch Werbe-Besucher (src=meta)
// die Angebotsseite. Den Fragebogen gibt es nur mit quiz=1; dort setzt er den gespeicherten Stand fort.
// Der Anmelde-Layer und der Funnel-Layer verdecken außerdem die untere Eingabeleiste. Nur Testdaten.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); const cases = [];
  try {
    const open = async (query, seed) => {
      const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); c.setDefaultTimeout(8000);
      await c.addInitScript((s) => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); if (s) sessionStorage.setItem('demenzCoachQuizProgress.v1', JSON.stringify(s)); } catch {} }, seed || null);
      await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
      const p = await c.newPage(); await p.goto(`${preview.origin}/start/${query}`); await p.locator('#screen h1, #screen h2').first().waitFor();
      return { c, p };
    };
    const saved = (src) => ({ version: 1, at: Date.now(), context: JSON.stringify([src, '']), screen: 'situation', choices: { relation: 'mama' }, tries: [], multi: {} });
    const heading = async (p) => ((await p.locator('#screen').innerText()) || '').toUpperCase();
    let s = await open('?src=layer&embed=1', saved('layer'));
    assert.equal(await s.p.evaluate(() => document.body.dataset.screen), 'plan', 'Layer zeigt die Angebotsseite');
    assert.match(await heading(s.p), /GRATIS FREISCHALTEN|12 MONATE/, 'Tarife sichtbar');
    await s.c.close(); cases.push('Layer zeigt Angebotsseite');
    s = await open('?src=anmeldung', saved('anmeldung'));
    assert.equal(await s.p.evaluate(() => document.body.dataset.screen), 'plan', 'Website-Einstieg zeigt die Angebotsseite');
    await s.c.close(); cases.push('Website-Einstieg zeigt Angebotsseite');
    s = await open('?src=meta&fbclid=t1&utm_source=facebook', saved('meta'));
    assert.equal(await s.p.evaluate(() => document.body.dataset.screen), 'plan', 'Werbung zeigt die Angebotsseite');
    await s.c.close(); cases.push('Werbe-Einstieg zeigt Angebotsseite');
    s = await open('?src=meta&quiz=1', saved('meta'));
    assert.doesNotMatch(await heading(s.p), /FÜR WEN SUCHST DU HILFE/, 'Fragebogen mit quiz=1 setzt weiter fort');
    assert.notEqual(await s.p.evaluate(() => document.body.dataset.screen), 'plan', 'quiz=1 bleibt im Fragebogen');
    await s.c.close(); cases.push('quiz=1 setzt Fragebogen fort');
    // Eingabeleiste: sichtbar ohne Layer, weg mit offenem Layer.
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); c.setDefaultTimeout(8000);
    await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
    await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
    const p = await c.newPage(); await p.goto(`${preview.origin}/de/`);
    const decline = p.getByRole('button', { name: 'Ablehnen', exact: true }); if (await decline.count()) await decline.click().catch(() => {});
    await p.evaluate(() => window.scrollTo(0, 1500)); await p.locator('.translator-chat-input').waitFor({ state: 'visible' });
    assert.ok(await p.evaluate(() => { const b = document.querySelector('.translator-chat-send').getBoundingClientRect(); return b.width >= 44 && Math.abs(b.width - b.height) < 1; }), 'Senden-Knopf ist rund');
    await p.evaluate(() => { const d = document.createElement('dialog'); d.className = 'dc-funnel-layer'; document.body.append(d); d.showModal(); });
    assert.equal(await p.locator('.translator-chat').isVisible(), false, 'Leiste ist unter offenem Layer weg');
    await p.evaluate(() => document.querySelector('dialog.dc-funnel-layer').close());
    assert.equal(await p.locator('.translator-chat').isVisible(), true, 'Leiste kommt nach dem Schließen zurück');
    await c.close(); cases.push('Leiste weg unter Layer');
    console.log(JSON.stringify({ ok: true, cases }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
