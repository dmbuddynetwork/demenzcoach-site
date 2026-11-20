// Verwaltungsseite /intern/kampagnen/: laden, bearbeiten, Vorschau, Regelprüfung, Links, Export. Nur lokale Testdaten.
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createPreviewServer } = require('./generator-preview.cjs');
const shots = process.env.KAMPAGNEN_SHOTS || '';
(async () => {
  const preview = await createPreviewServer(); const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH }); const report = [];
  try {
    const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); c.setDefaultTimeout(8000);
    await c.addInitScript(() => { try { localStorage.setItem('demenzcoach.analyticsConsent.v1', 'denied'); localStorage.setItem('demenzcoach.marketingConsent.v1', 'denied'); } catch {} });
    await c.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
    const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(preview.origin + '/intern/kampagnen/');
    await p.locator('#list .item').first().waitFor();
    assert.equal(await p.locator('#list .item').count(), 5); report.push('5 Kampagnen geladen');
    assert.equal(await p.locator('#check .ok').count(), 1, 'Startdaten erfüllen alle Regeln');
    // Kampagne wählen, Überschrift ändern: Vorschau folgt
    await p.locator('#list .item', { hasText: 'Ich will nach Hause' }).click();
    const frame = p.frameLocator('#preview');
    await frame.locator('#screen h1').filter({ hasText: /Was sagst du, wenn sie nach Hause will/i }).waitFor();
    await p.locator('[data-p="landing.ueberschrift"]').fill('Sie will nach Hause? Das hilft jetzt');
    await frame.locator('#screen h1').filter({ hasText: /Sie will nach Hause\? Das hilft jetzt/i }).waitFor(); report.push('Vorschau folgt der Eingabe');
    if (shots) { await p.waitForTimeout(600); await p.screenshot({ path: path.join(shots, 'verwaltung-desktop.png') }); }
    // Regelverstoß wird sofort gezeigt und sperrt den Download
    await p.locator('[data-p="anzeigen.0.text"]').fill('Über 1,7 Millionen Familien vertrauen uns. Nur heute!');
    await p.locator('#check .problems li').first().waitFor();
    assert.ok(await p.locator('#check .problems li').count() >= 1); assert.equal(await p.locator('#save').isDisabled(), true); report.push('Regelverstoß sichtbar, Download gesperrt');
    await p.locator('[data-p="anzeigen.0.text"]').fill('„Ich will nach Hause.“ Was jetzt? Drei Sätze, die helfen.');
    await p.locator('#check .ok').waitFor(); assert.equal(await p.locator('#save').isDisabled(), false);
    // Links
    const link = await p.locator('.link code').first().innerText(); assert.match(link, /\/start\/\?k=nach-hause&a=a1&src=meta&utm_source=meta&utm_medium=paid&utm_campaign=nach-hause&utm_content=a1$/); report.push('Tracking-Link je Anzeige');
    // neue Kampagne + Anzeige
    await p.locator('#neu').click(); await p.locator('#neueAnzeige').click();
    assert.equal(await p.locator('#list .item').count(), 6); assert.equal(await p.locator('.ad').count(), 1); report.push('neue Kampagne und Anzeige');
    // Export
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#csv').click()]);
    assert.equal(dl.suggestedFilename(), 'anzeigen.csv');
    await p.locator('[data-p="anzeigen.0.text"]').fill('Ein ehrlicher Satz für den Test.'); await p.locator('#check .ok').waitFor();
    const [dl2] = await Promise.all([p.waitForEvent('download'), p.locator('#save').click()]);
    assert.equal(dl2.suggestedFilename(), 'kampagnen.json'); report.push('Export CSV und JSON');
    assert.deepEqual(errors, []);
    // Handy
    const m = await browser.newContext({ viewport: { width: 390, height: 844 } }); await m.route('**/*', r => new URL(r.request().url()).origin === preview.origin ? r.continue() : r.abort());
    const q = await m.newPage(); await q.goto(preview.origin + '/intern/kampagnen/'); await q.locator('#list .item').first().waitFor();
    assert.ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'kein horizontales Scrollen am Handy'); report.push('Handy ohne Seitwärts-Scrollen');
    console.log(JSON.stringify({ ok: true, cases: report }));
  } finally { await browser.close(); await preview.close(); }
})().catch(e => { console.error(e); process.exit(1); });
